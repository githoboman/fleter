# Keeper Implementation Details

## Objectives

Automate the settlement of expired prediction markets to ensure a smooth user experience.

## Implementation Steps

### 1. Polling Engine
- Implement a loop that queries Starknet every 3 seconds for markets in `LOCKED` state.
- Check if `current_timestamp >= market.expiry`.

### 2. Price Fetching
- Integrate Pragma SDK to fetch the latest signed BTC/USD price.
- Verify price freshness before submitting.

### 3. Transaction Submission
- Use the **Starkzap Server SDK** to sign and send the `settle` transaction.
- Implement retry logic for failed transactions (due to gas or network issues).

## Required Criteria

- [ ] Keeper must be able to handle multiple expired markets in a single batch.
- [ ] Total latency from expiry to settlement should be < 10 seconds.
- [ ] Logs must be detailed for every settlement attempt.
- [ ] Must support AVNU Paymaster integration for gasless settlement.
