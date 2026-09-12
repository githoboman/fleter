/**
 * Positions: the wallet's open Up/Down holdings (marked to the book) plus the
 * settled winners it can redeem — shaped for the BitDrum portfolio views.
 */
import type { Address, Hex } from "viem";
import { toHuman } from "@somnia-chain/markets-sdk";
import { getExchange, ORACLE_PRICE_DECIMALS } from "./client";
import { redeemWinnings } from "./trade";

export type PositionStatus = "LIVE" | "SETTLING" | "WIN" | "LOSS" | "VOID";

export type DreamPosition = {
  key: string;
  marketId: Hex;
  pool: Address;
  asset: string;
  direction: "UP" | "DOWN";
  outcomeIdx: 0 | 1;
  status: PositionStatus;
  intervalSec: number | null;
  expiry: number;
  /** Threshold in USD when known (fixed strike only; reference opens are read separately). */
  strike: number | null;
  /** Shares held == payout if this side wins (collateral units). */
  shares: number;
  costBasis: number;
  avgCost: number;
  /** Book-marked value; null when the market has never traded. */
  markValue: number | null;
  unrealizedPnl: number | null;
  /** Redeemable now (settled winner / void). */
  claimable: { amountRaw: bigint; estPayout: number } | null;
};

const nowSec = () => Math.floor(Date.now() / 1000);

function statusFor(market: { status: string; expiry: string; winningOutcome?: number | null; voided: boolean }, outcomeIdx: 0 | 1): PositionStatus {
  if (market.voided) return "VOID";
  if (market.status === "Resolved" || market.status === "Finalized") {
    if (market.winningOutcome == null) return "SETTLING";
    return market.winningOutcome === outcomeIdx ? "WIN" : "LOSS";
  }
  if (Number(market.expiry) <= nowSec()) return "SETTLING";
  return "LIVE";
}

export async function fetchPositions(address: Address): Promise<DreamPosition[]> {
  const ex = getExchange();
  const [open, claimable] = await Promise.all([
    ex.client.getOpenPositionsWithPnL(address),
    ex.client.getClaimable(address).catch(() => []),
  ]);
  const claimByKey = new Map(claimable.map((c) => [`${c.marketId.toLowerCase()}-${c.outcomeIdx}`, c]));

  const rows: DreamPosition[] = [];
  for (const p of open) {
    const dec = p.market.quoteDecimals;
    const legs: Array<[0 | 1, typeof p.outcomes.yes]> = [
      [0, p.outcomes.yes],
      [1, p.outcomes.no],
    ];
    for (const [outcomeIdx, leg] of legs) {
      if (leg.balance <= 0n) continue;
      const key = `${p.market.id.toLowerCase()}-${outcomeIdx}`;
      const claim = claimByKey.get(key);
      const strikeRaw = Number(p.market.strike);
      rows.push({
        key,
        marketId: p.market.id as Hex,
        pool: p.market.poolAddress as Address,
        asset: p.market.asset,
        direction: outcomeIdx === 0 ? "UP" : "DOWN",
        outcomeIdx,
        status: statusFor(p.market, outcomeIdx),
        intervalSec: p.market.intervalSec ? Number(p.market.intervalSec) : null,
        expiry: Number(p.market.expiry),
        strike: strikeRaw > 0 ? strikeRaw / 10 ** ORACLE_PRICE_DECIMALS : null,
        shares: toHuman(leg.balance, dec),
        costBasis: toHuman(leg.costBasis, dec),
        avgCost: toHuman(leg.avgCost, dec),
        markValue: leg.markValue === null ? null : toHuman(leg.markValue, dec),
        unrealizedPnl: leg.unrealizedPnl === null ? null : toHuman(leg.unrealizedPnl, dec),
        claimable: claim ? { amountRaw: claim.amount, estPayout: toHuman(claim.estPayout, dec) } : null,
      });
    }
  }
  // Newest window first.
  return rows.sort((a, b) => b.expiry - a.expiry);
}

export async function redeemPosition(p: DreamPosition) {
  if (!p.claimable) throw new Error("Nothing to redeem on this position yet.");
  return redeemWinnings(p.marketId, p.claimable.amountRaw, p.outcomeIdx);
}
