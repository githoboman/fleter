/**
 * Write side: BitDrum's one-tap UP / DOWN stake, mapped onto a DreamDEX
 * Event Contract market order (IOC) sized by walking the live book.
 */
import { erc20Abi, type Address, type Hex } from "viem";
import {
  fromHuman,
  toHuman,
  quoteBinaryStakeOverBook,
  ORDER_TYPE,
  type BinaryStakeQuote,
} from "@somnia-chain/markets-sdk";
import { getExchange, requireSigner, BITDRUM_BUILDER, COLLATERAL_ADDRESS, COLLATERAL_DECIMALS } from "./client";
import { snapshotUpDown, type UpDownSnapshot } from "./markets";

export type Direction = "UP" | "DOWN";
const sideOf = (d: Direction): "BUY_YES" | "BUY_NO" => (d === "UP" ? "BUY_YES" : "BUY_NO");

export type StakeQuoteView = {
  raw: BinaryStakeQuote;
  direction: Direction;
  /** Shares bought == payout (in collateral) if this side wins. */
  payoutIfWin: number;
  /** Collateral actually escrowed (max loss). */
  maxLoss: number;
  /** Worst price per share paid, in the side's own terms (0..1). */
  limitPrice: number;
  /** payoutIfWin / maxLoss - 1 */
  profitMultiple: number;
};

const bookParamsCache = new Map<string, Promise<Awaited<ReturnType<ReturnType<typeof getExchange>["client"]["getBinaryBookParams"]>>>>();

/** Tick / lot / min-quantity for a pool — immutable per pool, so cache it. */
export function getBookParams(pool: Address) {
  const key = pool.toLowerCase();
  let p = bookParamsCache.get(key);
  if (!p) {
    p = getExchange().client.getBinaryBookParams(pool);
    p.catch(() => bookParamsCache.delete(key));
    bookParamsCache.set(key, p);
  }
  return p;
}

/**
 * Protective-limit cushion for interactive wallets. The DreamDEX market maker
 * re-quotes every few seconds (we measured 17¢ moves in ~5s) and a wallet
 * confirmation takes ~10s, so the SDK's 3% default routinely lands behind the
 * book and the IOC crosses nothing. Fills still happen at resting prices —
 * the cushion only decides how far the sweep may chase, never what you pay.
 */
export const DEFAULT_SLIPPAGE_BPS = 1500n;

/** Quote a stake (human collateral units, e.g. 5 USDC) against the live book. */
export async function quoteStake(
  snap: UpDownSnapshot,
  direction: Direction,
  stakeHuman: number,
  slippageBps = DEFAULT_SLIPPAGE_BPS,
): Promise<StakeQuoteView | null> {
  const dec = snap.quoteDecimals;
  const params = await getBookParams(snap.pool);
  const q = quoteBinaryStakeOverBook(
    snap.book,
    sideOf(direction),
    fromHuman(stakeHuman, dec),
    10n ** BigInt(dec),
    { ...params, slippageBps },
  );
  if (!q) return null;
  const payoutIfWin = toHuman(q.quantity, dec);
  const maxLoss = toHuman(q.escrow, dec);
  return {
    raw: q,
    direction,
    payoutIfWin,
    maxLoss,
    limitPrice: toHuman(q.limitPrice, dec),
    profitMultiple: maxLoss > 0 ? payoutIfWin / maxLoss - 1 : 0,
  };
}

export type PlaceStakeResult = {
  hash: string;
  filledShares: number;
  fullyFilled: boolean;
  /** The quote the order was actually sized from (fresh book at send time). */
  quote: StakeQuoteView;
};

/**
 * Execute a stake. Re-snapshots the book immediately before sending so the
 * protective limit reflects the market *now*, not when the user first looked.
 * Requires attachWallet() to have been called.
 */
export async function placeStake(
  snap: UpDownSnapshot,
  direction: Direction,
  stakeHuman: number,
  slippageBps = DEFAULT_SLIPPAGE_BPS,
): Promise<PlaceStakeResult> {
  const ex = requireSigner();
  const fresh = await snapshotUpDown(snap.market).catch(() => snap);
  const quote = await quoteStake(fresh, direction, stakeHuman, slippageBps);
  if (!quote) throw new Error("No fillable liquidity for this stake right now — the book just moved.");
  const res = await ex.trader.placeOrder({
    pool: fresh.pool,
    side: quote.raw.side,
    price: quote.raw.yesPrice,
    quantity: quote.raw.quantity,
    orderType: ORDER_TYPE.MARKET,
    autoApprove: true,
    ...(BITDRUM_BUILDER ? { builder: BITDRUM_BUILDER } : {}),
  });
  const filled = res.fills.reduce((sum, f) => sum + f.quantityFilled, 0n);
  return {
    hash: res.hash,
    filledShares: toHuman(filled, fresh.quoteDecimals),
    fullyFilled: filled === quote.raw.quantity,
    quote,
  };
}

/** Redeem winning shares after resolution. */
export async function redeemWinnings(marketId: Hex, amountRaw: bigint, outcomeIdx?: 0 | 1) {
  const ex = requireSigner();
  return ex.trader.redeem({ marketId, amount: amountRaw, ...(outcomeIdx === undefined ? {} : { outcomeIdx }), autoApprove: true });
}

/** Testnet collateral faucet (TestUSDC on Shannon). */
export async function claimTestCollateral() {
  const ex = requireSigner();
  return ex.trader.faucet();
}

/** Wallet's native STT balance (gas) in human units. */
export async function readGasBalance(address: Address): Promise<number> {
  const raw = await getExchange().client.getViemClient().getBalance({ address });
  return toHuman(raw, 18);
}

/** Wallet's collateral (TestUSDC) balance in human units. */
export async function readCollateralBalance(address: Address): Promise<number> {
  const ex = getExchange();
  const raw = await ex.client.getViemClient().readContract({
    address: COLLATERAL_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address],
  });
  return toHuman(raw, COLLATERAL_DECIMALS);
}

export type { Address };
