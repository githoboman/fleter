import os
from typing import Any, Dict

import httpx

GATEWAY_URL = os.getenv("GATEWAY_URL", "http://localhost:3001/api")


async def fetch_market_context(market_id: str) -> Dict[str, Any]:
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(f"{GATEWAY_URL}/internal/market-context/{market_id}")
        response.raise_for_status()
        return response.json()


async def fetch_preview_context(direction: str, stake: str, duration_seconds: int) -> Dict[str, Any]:
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(
            f"{GATEWAY_URL}/internal/market-context/preview",
            params={
                "direction": direction,
                "stake": stake,
                "durationSeconds": duration_seconds,
            },
        )
        response.raise_for_status()
        return response.json()


async def persist_signal(market_id: str, direction: str, confidence: int, rationale: str) -> None:
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(
            f"{GATEWAY_URL}/internal/ai-signals",
            json={
                "market_id": market_id,
                "direction": direction,
                "confidence": confidence,
                "rationale": rationale,
            },
        )
        response.raise_for_status()
