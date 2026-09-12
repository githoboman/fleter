# AI Agent Implementation Details

## Objectives

Deliver institutional-grade trading signals and a fair, dynamic risk/reward multiplier.

## Implementation Steps

### 1. Feature Engineering
- Aggregate real-time data: BTC/USD price, pool ratios, and top-trader positioning.
- Calculate price momentum (1m, 5m, 15m) and volatility (ATR).

### 2. Signal Inference (Python/FastAPI)
- Build a classification model to output bias (-1 to 1) and confidence (0-100).
- Integrate an LLM to generate a human-readable `rationale` for each signal.

### 3. POM Engine
- Implement the POM formula: `profit_pct = 0.05 + (normalized_weighted_sum * 0.65)`.
- Use pool imbalance and signal confidence as key weights.

## Required Criteria

- [ ] AI signals must be generated at market open and updated every 30 seconds until the join window closes.
- [ ] POM must be fixed when the join window closes.
- [ ] Average signal accuracy should be logged and surfaced in the UI.
- [ ] Rationale generation must avoid financial advice language (neutral/analytical).
