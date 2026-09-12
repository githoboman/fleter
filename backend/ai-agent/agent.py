import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from dotenv import load_dotenv

from tools import fetch_market_context, fetch_preview_context, persist_signal

load_dotenv()

try:
    from langchain_openai import ChatOpenAI
except Exception:  # pragma: no cover - optional runtime dependency
    ChatOpenAI = None


def clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(value, maximum))


def to_float(value: Any) -> float:
    if value is None:
        return 0.0
    return float(value)


def to_int(value: Any) -> int:
    if value is None:
        return 0
    return int(float(value))


def normalize_direction(direction: str) -> str:
    normalized = (direction or "").upper()

    if normalized in {"LONG", "UP", "BULLISH"}:
        return "UP"
    if normalized in {"SHORT", "DOWN", "BEARISH"}:
        return "DOWN"
    return "NEUTRAL"


def build_signal_metrics(context: Dict[str, Any]) -> Dict[str, Any]:
    market = context["market"]
    alignment = context["top_trader_alignment"]

    long_pool = to_float(market.get("long_pool"))
    short_pool = to_float(market.get("short_pool"))
    total_pool = max(long_pool + short_pool, 1.0)
    pool_imbalance = abs(long_pool - short_pool) / total_pool

    direction_bias = float(alignment.get("directionBias", 0))
    alignment_strength = float(alignment.get("alignmentStrength", 0))
    signal_accuracy_last_30d = float(context.get("signal_accuracy_last_30d", 0))

    confidence_score = clamp(
        (
            abs(direction_bias) * 0.55
            + alignment_strength * 0.20
            + pool_imbalance * 0.15
            + signal_accuracy_last_30d * 0.10
        )
        * 100,
        0,
        100,
    )

    if confidence_score < 40 or abs(direction_bias) < 0.12:
        direction = "NEUTRAL"
    else:
        direction = "UP" if direction_bias >= 0 else "DOWN"

    raw_pom = clamp(
        pool_imbalance * 0.30
        + alignment_strength * 0.25
        + (confidence_score / 100) * 0.20
        + signal_accuracy_last_30d * 0.15
        + 0.10,
        0,
        1,
    )
    pom_profit_pct = clamp(0.05 + raw_pom * 0.65, 0.05, 0.70)

    onchain_pom_bps = market.get("pom_profit_bps")
    pom_profit_bps = (
        int(onchain_pom_bps)
        if onchain_pom_bps is not None
        else int(round(pom_profit_pct * 10_000))
    )

    return {
        "direction": direction,
        "confidence": int(round(confidence_score)),
        "top_trader_alignment": round(alignment_strength, 4),
        "signal_accuracy_last_30d": round(signal_accuracy_last_30d * 100, 2),
        "direction_bias": round(direction_bias, 4),
        "pool_imbalance": round(pool_imbalance, 4),
        "qualifying_trader_count": to_int(alignment.get("totalQualifyingTraders")),
        "up_votes": to_int(alignment.get("longVotes")),
        "down_votes": to_int(alignment.get("shortVotes")),
        "pom_profit_bps": pom_profit_bps,
        "pom_profit_pct": round(pom_profit_bps / 100, 2),
    }


def build_template_rationale(metrics: Dict[str, Any]) -> str:
    direction = metrics["direction"]
    confidence = metrics["confidence"]

    if direction == "NEUTRAL":
        bias_text = "Top-trader conviction is split and the pool remains balanced."
    elif direction == "UP":
        bias_text = (
            f"{metrics['up_votes']} qualifying traders lean UP versus {metrics['down_votes']} DOWN, "
            "and the current pool skew supports a bullish edge."
        )
    else:
        bias_text = (
            f"{metrics['down_votes']} qualifying traders lean DOWN versus {metrics['up_votes']} UP, "
            "and the current pool skew supports a bearish edge."
        )

    return (
        f"{bias_text} Confidence is {confidence}% with "
        f"{metrics['signal_accuracy_last_30d']:.1f}% rolling 30-day signal accuracy."
    )


async def maybe_generate_llm_rationale(metrics: Dict[str, Any]) -> Optional[str]:
    if not ChatOpenAI or not os.getenv("OPENAI_API_KEY"):
        return None

    prompt = (
        "Write a concise BitDrum signal rationale in one sentence. "
        f"Direction: {metrics['direction']}. "
        f"Confidence: {metrics['confidence']}%. "
        f"Top trader alignment: {metrics['top_trader_alignment']}. "
        f"UP votes: {metrics['up_votes']}. DOWN votes: {metrics['down_votes']}. "
        f"Pool imbalance: {metrics['pool_imbalance']}. "
        f"Signal accuracy last 30d: {metrics['signal_accuracy_last_30d']}%."
    )

    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.2)
    response = await llm.ainvoke(prompt)
    return response.content.strip() if response and response.content else None


def enrich_signal_payload(market_id: str, metrics: Dict[str, Any], rationale: str) -> Dict[str, Any]:
    return {
        "market_id": market_id,
        "direction": metrics["direction"],
        "confidence": metrics["confidence"],
        "rationale": rationale,
        "top_trader_alignment": metrics["top_trader_alignment"],
        "signal_accuracy_last_30d": f"{metrics['signal_accuracy_last_30d']:.1f}%",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "pom_profit_bps": metrics["pom_profit_bps"],
        "pom_profit_pct": metrics["pom_profit_pct"],
        "qualifying_trader_count": metrics["qualifying_trader_count"],
        "up_votes": metrics["up_votes"],
        "down_votes": metrics["down_votes"],
    }


async def generate_signal(market_id: str) -> Dict[str, Any]:
    context = await fetch_market_context(market_id)
    metrics = build_signal_metrics(context)
    rationale = await maybe_generate_llm_rationale(metrics)
    if not rationale:
        rationale = build_template_rationale(metrics)

    payload = enrich_signal_payload(market_id, metrics, rationale)
    await persist_signal(
        market_id=market_id,
        direction=payload["direction"],
        confidence=payload["confidence"],
        rationale=payload["rationale"],
    )
    return payload


async def generate_preview_signal(direction: str, stake: str, duration_seconds: int = 300) -> Dict[str, Any]:
    context = await fetch_preview_context(direction, stake, duration_seconds)
    metrics = build_signal_metrics(context)
    rationale = await maybe_generate_llm_rationale(metrics)
    if not rationale:
        rationale = build_template_rationale(metrics)

    return enrich_signal_payload("preview", metrics, rationale)


async def generate_pom(market_id: str) -> Dict[str, Any]:
    context = await fetch_market_context(market_id)
    metrics = build_signal_metrics(context)
    return {
        "market_id": market_id,
        "direction": metrics["direction"],
        "confidence": metrics["confidence"],
        "pom_profit_bps": metrics["pom_profit_bps"],
        "pom_profit_pct": metrics["pom_profit_pct"],
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


async def generate_preview_pom(direction: str, stake: str, duration_seconds: int = 300) -> Dict[str, Any]:
    context = await fetch_preview_context(direction, stake, duration_seconds)
    metrics = build_signal_metrics(context)
    return {
        "market_id": "preview",
        "direction": metrics["direction"],
        "confidence": metrics["confidence"],
        "pom_profit_bps": metrics["pom_profit_bps"],
        "pom_profit_pct": metrics["pom_profit_pct"],
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
