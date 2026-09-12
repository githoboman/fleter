# BitDrum AI Agent

The AI Agent is the intelligence layer of the protocol, providing real-time trading signals and determining the dynamic payout rates (POM).

## Role in the System
- **Signal Inference**: Predicts market direction (UP/DOWN/NEUTRAL).
- **POM Computation**: Calculates the profit multiplier (5-70%) based on market conditions.
- **Top Trader Aggregation**: Weighs positioning of ORACLE-tier traders to inform signals.

## Stack
- Python / FastAPI
- ONNX Runtime (Time-series classifier)
- OpenAI API (LLM for rationales)
- PostgreSQL (Historical performance)

## Environment

Create `backend/ai-agent/.env`:

```env
GATEWAY_URL=http://localhost:3001/api
OPENAI_API_KEY=optional
```

Notes:

- `GATEWAY_URL` must point at the BitDrum gateway API.
- `OPENAI_API_KEY` is optional. If unset, the agent falls back to deterministic template rationales.

## Run

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python3 main.py
```

Health check:

- [http://localhost:8000/health](http://localhost:8000/health)
