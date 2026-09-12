// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Subscription, Tier} from "./Types.sol";
import {Owned} from "./Owned.sol";

contract SubscriptionsContract is Owned {
    /// @dev Subscription fees in native STT (18 decimals)
    uint256 public constant PRO_FEE = 10 ether;    // 10 STT
    uint256 public constant ELITE_FEE = 25 ether;  // 25 STT

    address public signalRevenuePool;

    mapping(address => Subscription) public subscriptions;

    event SignalRevenuePoolUpdated(address indexed signalRevenuePool);
    event Subscribed(address indexed user, Tier tier, uint256 expiresAt, uint256 feePaid);

    error TransferFailed();

    constructor(address signalRevenuePool_, address owner_) Owned(owner_) {
        require(signalRevenuePool_ != address(0), "zero address");
        signalRevenuePool = signalRevenuePool_;
    }

    receive() external payable {}

    function setSignalRevenuePool(address signalRevenuePool_) external onlyOwner {
        require(signalRevenuePool_ != address(0), "zero pool");
        signalRevenuePool = signalRevenuePool_;
        emit SignalRevenuePoolUpdated(signalRevenuePool_);
    }

    function subscribe(Tier tier) external payable {
        require(tier == Tier.PRO || tier == Tier.ELITE, "invalid tier");

        uint256 fee = currentFee(tier);
        require(msg.value == fee, "incorrect fee");

        (bool ok,) = payable(signalRevenuePool).call{value: fee}("");
        if (!ok) revert TransferFailed();

        subscriptions[msg.sender] = Subscription({
            tier: tier,
            expiresAt: block.timestamp + 30 days
        });

        emit Subscribed(msg.sender, tier, block.timestamp + 30 days, fee);
    }

    function isActive(address user, Tier tier) external view returns (bool) {
        Subscription memory subscription = subscriptions[user];
        return subscription.tier >= tier && subscription.expiresAt > block.timestamp;
    }

    function currentFee(Tier tier) public pure returns (uint256) {
        if (tier == Tier.PRO) {
            return PRO_FEE;
        }
        if (tier == Tier.ELITE) {
            return ELITE_FEE;
        }
        revert("invalid tier");
    }
}
