// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Direction} from "./Types.sol";
import {ILiquidityVault} from "./interfaces/ILiquidityVault.sol";
import {Owned} from "./Owned.sol";

/**
 * @title LiquidityVaultV2
 * @notice Vault that provides opposing liquidity for every user position.
 *
 * V2 changes from V1:
 * - `rescue(to, amount)` allows the owner to withdraw any stranded native STT
 *   in an emergency. This path was absent in V1, making fund recovery impossible.
 * - `deposit()` remains open to owner only.
 * - `fundMarket()` and `payWinner()` remain restricted to the market contract.
 *
 * Economic invariant:
 *   The vault commits `stakeAmount` for each participant on the opposite direction.
 *   At settlement it receives `totalPool − fee` back, then pays winners
 *   `stake + profit`. Net: vault earns the fee and the loser's stake minus the
 *   winner's profit (≈ positive EV if ~50% win rate and profit < 100%).
 */
contract LiquidityVaultV2 is Owned, ILiquidityVault {
    address public predictionMarket;

    mapping(uint256 => uint256) public committedByMarket;

    event PredictionMarketUpdated(address indexed predictionMarket);
    event MarketFunded(uint256 indexed marketId, Direction direction, uint256 amount, address recipient);
    event WinnerPaid(address indexed recipient, uint256 principal, uint256 profit);
    event Deposited(address indexed depositor, uint256 amount);
    event Rescued(address indexed to, uint256 amount);

    error Unauthorized();
    error TransferFailed();
    error InsufficientBalance();

    constructor(address owner_) Owned(owner_) {}

    receive() external payable {}

    modifier onlyPredictionMarket() {
        if (msg.sender != predictionMarket) revert Unauthorized();
        _;
    }

    // ── Admin ─────────────────────────────────────────────────────────────────

    function setPredictionMarket(address predictionMarket_) external onlyOwner {
        require(predictionMarket_ != address(0), "zero market");
        predictionMarket = predictionMarket_;
        emit PredictionMarketUpdated(predictionMarket_);
    }

    /**
     * @notice Seed or top up the vault with native STT. Owner only.
     */
    function deposit() external payable {
        if (msg.sender != owner()) revert Unauthorized();
        emit Deposited(msg.sender, msg.value);
    }

    /**
     * @notice Emergency withdrawal for the owner. Allows recovery of stranded funds.
     * @dev Only callable by owner. Does not bypass market accounting — use only
     *      when markets are settled and no committed funds are outstanding.
     */
    function rescue(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "zero to");
        if (address(this).balance < amount) revert InsufficientBalance();
        _nativeTransfer(to, amount);
        emit Rescued(to, amount);
    }

    // ── Market interface ──────────────────────────────────────────────────────

    function fundMarket(uint256 marketId, Direction direction, uint256 amount, address recipient)
        external
        onlyPredictionMarket
    {
        committedByMarket[marketId] += amount;
        _nativeTransfer(recipient, amount);
        emit MarketFunded(marketId, direction, amount, recipient);
    }

    function payWinner(address recipient, uint256 principal, uint256 profit) external onlyPredictionMarket {
        _nativeTransfer(recipient, principal + profit);
        emit WinnerPaid(recipient, principal, profit);
    }

    // ── Views ─────────────────────────────────────────────────────────────────

    function availableLiquidity() external view returns (uint256) {
        return address(this).balance;
    }

    // ── Internal ──────────────────────────────────────────────────────────────

    function _nativeTransfer(address to, uint256 amount) internal {
        (bool ok,) = payable(to).call{value: amount}("");
        if (!ok) revert TransferFailed();
    }
}
