/**
 * Botrem (Bot Chain Markets) exchange singleton for Botrem.
 *
 * One read-only exchange is created lazily; when the user connects a wallet,
 * call `attachWallet(walletClient, address)` and the same instance becomes a
 * signer. Testnet (Shannon, 50312) only — this is the hackathon target.
 *
 * Note: we deliberately never call `loadMarkets()`. Every read/write Botrem
 * needs lives on `ex.client` / `ex.trader` (pool- and marketId-addressed), and
 * the symbol registry load costs ~15s against the testnet indexer.
 */
import type { Address, Chain, WalletClient } from "viem";
import { writeContract as viemWriteContract } from "viem/actions";
import {
  SomniaMarkets as BotChainMarkets,
  SOMNIA_TESTNET_ADDRESSES as BOTCHAIN_TESTNET_ADDRESSES,
  SOMNIA_TESTNET_PRICE_FEED as BOTCHAIN_TESTNET_PRICE_FEED,
} from "@somnia-chain/markets-sdk";
import { somniaShannon as botchainShannon } from "@somnia-chain/markets-sdk/chains";

export const DREAMDEX_TESTNET = {
  indexerUrl: "https://dev.smk.botchain.host/v1/graphql",
  wsRpcUrl: "https://rpc.bohr.life",
  // The SDK inlines its own viem Chain typing; the runtime object is a plain viem chain.
  chain: botchainShannon as unknown as Chain,
  addresses: BOTCHAIN_TESTNET_ADDRESSES,
  priceFeed: BOTCHAIN_TESTNET_PRICE_FEED,
} as const;

/** Botrem testnet collateral (BOT, 6dp). */
export const COLLATERAL_ADDRESS = BOTCHAIN_TESTNET_ADDRESSES.collateral as Address;
export const COLLATERAL_SYMBOL = "BOT";
export const COLLATERAL_DECIMALS = 6;

/**
 * Oracle answers (opening / resolution prices / fixed strikes) carry no decimals
 * on the indexer. The SDK documents 2 as the empirical scale for OracleHub
 * answers, and we verified it against the live index price on Shannon
 * (raw 7921119 → $79,211.19). markets.ts still sanity-checks against live.
 */
export const ORACLE_PRICE_DECIMALS = 2;

/** Optional: Botrem's builder address, for routing-fee attribution. */
export const BOTREM_BUILDER = process.env.NEXT_PUBLIC_BOTREM_BUILDER as
  | `0x${string}`
  | undefined;

// Kept on globalThis so a dev-server hot reload of this module does not mint a
// fresh, signer-less exchange while React still thinks the wallet is attached.
const g = globalThis as unknown as { __botremExchange?: BotChainMarkets };

export function getExchange(): BotChainMarkets {
  if (!g.__botremExchange) {
    g.__botremExchange = new BotChainMarkets({
      indexerUrl: DREAMDEX_TESTNET.indexerUrl,
      chain: DREAMDEX_TESTNET.chain,
      wsRpcUrl: DREAMDEX_TESTNET.wsRpcUrl,
      addresses: DREAMDEX_TESTNET.addresses,
      priceFeed: DREAMDEX_TESTNET.priceFeed,
    });
  }
  return g.__botremExchange;
}

/** Address the exchange will sign with, or undefined when no wallet is attached. */
export function signerAddress(): Address | undefined {
  return getExchange().walletAddress;
}

/** Throws a user-facing error if the exchange cannot sign. */
export function requireSigner(): BotChainMarkets {
  const ex = getExchange();
  if (!ex.walletAddress) throw new Error("Wallet not attached — reconnect your wallet and try again.");
  return ex;
}

/**
 * Turn the read-only exchange into a signer bound to the connected wallet.
 *
 * The SDK's injected-wallet path hardcodes `gas: 10M` and fixed EIP-1559 fees
 * into every `eth_sendTransaction`, which MetaMask rejects with -32602
 * ("Invalid parameters"). Injected wallets estimate gas and fees themselves,
 * so we strip those fields before the request reaches the wallet.
 */
export function attachWallet(walletClient: WalletClient, address: Address): BotChainMarkets {
  const ex = getExchange();
  type WriteArgs = Parameters<typeof viemWriteContract>[1];
  const injected = walletClient.extend((client) => ({
    writeContract: ((args: WriteArgs) => {
      const { gas: _gas, maxFeePerGas: _maxFee, maxPriorityFeePerGas: _tip, ...rest } = args;
      void _gas; void _maxFee; void _tip;
      return viemWriteContract(client, rest as WriteArgs);
    }) as WalletClient["writeContract"],
  }));
  ex.setSigner({ walletClient: injected as unknown as WalletClient, account: address });
  return ex;
}

/** Return the exchange to unauthenticated reads (wallet disconnected). */
export function detachWallet() {
  getExchange().setSigner({});
}

/** Explorer link for a Bot Chain testnet tx hash. */
export function explorerTxUrl(hash: string) {
  return `https://scan.bohr.life/tx/${hash}`;
}
