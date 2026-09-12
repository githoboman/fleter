from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel
import uvicorn

from agent import (
    generate_pom,
    generate_preview_pom,
    generate_preview_signal,
    generate_signal,
)

app = FastAPI(title="BitDrum AI Agent API")


class SignalRequest(BaseModel):
    market_id: str


class PreviewSignalRequest(BaseModel):
    direction: str
    stake: str
    duration_seconds: int = 300


@app.get("/health")
def health():
    return {"status": "healthy"}


@app.post("/signal")
async def get_signal(request: SignalRequest):
    try:
        signal = await generate_signal(request.market_id)
        return {"market_id": request.market_id, "signal": signal}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/signal/preview")
async def get_preview_signal(request: PreviewSignalRequest):
    try:
        signal = await generate_preview_signal(
            request.direction,
            request.stake,
            request.duration_seconds,
        )
        return {"market_id": "preview", "signal": signal}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/pom/{market_id}")
async def get_pom(market_id: str):
    try:
        pom = await generate_pom(market_id)
        return {"market_id": market_id, "pom": pom}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/pom-preview")
async def get_pom_preview(
    direction: str = Query(default="Long"),
    stake: str = Query(default="0"),
    duration_seconds: int = Query(default=300),
):
    try:
        pom = await generate_preview_pom(direction, stake, duration_seconds)
        return {"market_id": "preview", "pom": pom}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
