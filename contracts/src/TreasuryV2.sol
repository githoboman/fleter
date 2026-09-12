// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Owned} from "./Owned.sol";

/**
 * @title TreasuryV2
 * @notice Immediately distributes protocol fees on receipt.
 *
 * V2 changes from V1:
 * - Fee distribution is automatic: `receive()` splits and forwards incoming
 *   native STT to configured recipients immediately, with no manual `distribute()` call.
 * - Simplified to two recipients: vault (replenishment) and reserve (ops/team).
 * - AI fund allocation removed.
 * - Owner can update recipients at any time.
 *
 * Default split: 60% back to vault (improves pool depth and payout rates),
 * 40% to reserve (team operations / future mainnet vault seed).
 */
contract TreasuryV2 is Owned {
    uint256 public constant VAULT_BPS   = 6000; // 60%
    uint256 public constant RESERVE_BPS = 4000; // 40%

    address public vaultRecipient;
    address public reserveRecipient;

    event RecipientsUpdated(address vaultRecipient, address reserveRecipient);
    event FeeDistributed(uint256 vaultAmount, uint256 reserveAmount);

    error TransferFailed();
    error ZeroRecipient();

    constructor(address vaultRecipient_, address reserveRecipient_, address owner_) Owned(owner_) {
        require(vaultRecipient_ != address(0) && reserveRecipient_ != address(0), "zero address");
        vaultRecipient   = vaultRecipient_;
        reserveRecipient = reserveRecipient_;
    }

    /**
     * @notice Automatically split and forward incoming fees.
     *         Called by PredictionMarketV2 on every settled market.
     */
    receive() external payable {
        if (msg.value == 0) return;

        uint256 vaultAmount   = (msg.value * VAULT_BPS) / 10_000;
        uint256 reserveAmount = msg.value - vaultAmount;

        if (vaultAmount > 0) _nativeTransfer(vaultRecipient, vaultAmount);
        if (reserveAmount > 0) _nativeTransfer(reserveRecipient, reserveAmount);

        emit FeeDistributed(vaultAmount, reserveAmount);
    }

    /**
     * @notice Update distribution recipients.
     */
    function setRecipients(address vaultRecipient_, address reserveRecipient_) external onlyOwner {
        if (vaultRecipient_ == address(0) || reserveRecipient_ == address(0)) revert ZeroRecipient();
        vaultRecipient   = vaultRecipient_;
        reserveRecipient = reserveRecipient_;
        emit RecipientsUpdated(vaultRecipient_, reserveRecipient_);
    }

    function _nativeTransfer(address to, uint256 amount) internal {
        (bool ok,) = payable(to).call{value: amount}("");
        if (!ok) revert TransferFailed();
    }
}
