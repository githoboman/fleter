// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Owned} from "./Owned.sol";

contract Treasury is Owned {
    uint256 public constant VAULT_BPS = 4000;
    uint256 public constant AI_BPS = 3500;
    uint256 public constant RESERVE_BPS = 2500;

    address public vaultRecipient;
    address public aiFundRecipient;
    address public reserveRecipient;

    event AllocationRecipientsUpdated(address vaultRecipient, address aiFundRecipient, address reserveRecipient);
    event FundsDistributed(uint256 vaultAmount, uint256 aiAmount, uint256 reserveAmount);

    error TransferFailed();

    constructor(
        address vaultRecipient_,
        address aiFundRecipient_,
        address reserveRecipient_,
        address owner_
    ) Owned(owner_) {
        require(
            vaultRecipient_ != address(0)
                && aiFundRecipient_ != address(0)
                && reserveRecipient_ != address(0),
            "zero address"
        );

        vaultRecipient = vaultRecipient_;
        aiFundRecipient = aiFundRecipient_;
        reserveRecipient = reserveRecipient_;
    }

    receive() external payable {}

    function setRecipients(address vaultRecipient_, address aiFundRecipient_, address reserveRecipient_) external onlyOwner {
        require(
            vaultRecipient_ != address(0) && aiFundRecipient_ != address(0) && reserveRecipient_ != address(0),
            "zero recipient"
        );

        vaultRecipient = vaultRecipient_;
        aiFundRecipient = aiFundRecipient_;
        reserveRecipient = reserveRecipient_;

        emit AllocationRecipientsUpdated(vaultRecipient_, aiFundRecipient_, reserveRecipient_);
    }

    function distribute() external {
        uint256 balance = address(this).balance;
        require(balance > 0, "no treasury balance");

        uint256 vaultAmount = (balance * VAULT_BPS) / 10_000;
        uint256 aiAmount = (balance * AI_BPS) / 10_000;
        uint256 reserveAmount = balance - vaultAmount - aiAmount;

        _nativeTransfer(vaultRecipient, vaultAmount);
        _nativeTransfer(aiFundRecipient, aiAmount);
        _nativeTransfer(reserveRecipient, reserveAmount);

        emit FundsDistributed(vaultAmount, aiAmount, reserveAmount);
    }

    function _nativeTransfer(address to, uint256 amount) internal {
        (bool ok,) = payable(to).call{value: amount}("");
        if (!ok) revert TransferFailed();
    }
}
