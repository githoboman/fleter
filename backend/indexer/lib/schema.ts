import { bigint, boolean, integer, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Traders — enriched on-chain profile for each wallet
// ---------------------------------------------------------------------------
export const traders = pgTable("traders", {
  id: uuid("id").primaryKey().defaultRandom(),
  address: text("address").notNull().unique(),
  displayName: text("display_name"),
  tier: text("tier").notNull().default("SCOUT"), // ORACLE | PROPHET | TRADER | SCOUT
  marketsEntered: integer("markets_entered").notNull().default(0),
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  draws: integer("draws").notNull().default(0),
  totalStaked: numeric("total_staked").notNull().default("0"),
  totalClaimed: numeric("total_claimed").notNull().default("0"),
  compositeScore: numeric("composite_score").notNull().default("0"),
  lastActive: timestamp("last_active", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// Markets — every prediction market opened on-chain
// ---------------------------------------------------------------------------
export const markets = pgTable("markets", {
  id: uuid("id").primaryKey().defaultRandom(),
  marketId: text("market_id").notNull().unique(), // hex u64 from contract
  openerAddress: text("opener_address").notNull(),
  openerDirection: text("opener_direction").notNull(), // Long | Short
  pomProfitBps: integer("pom_profit_bps").notNull(),
  stake: numeric("stake").notNull(),
  longPool: numeric("long_pool").notNull().default("0"),
  shortPool: numeric("short_pool").notNull().default("0"),
  joinDeadline: bigint("join_deadline", { mode: "number" }),
  state: text("state").notNull().default("OPEN"), // OPEN | LOCKED | CLAIMABLE | CLOSED
  entryPrice: numeric("entry_price"),
  settlementPrice: numeric("settlement_price"),
  outcome: text("outcome"), // Long | Short | Draw
  transactionHash: text("transaction_hash"),
  openedAt: timestamp("opened_at", { withTimezone: true }).defaultNow(),
  settledAt: timestamp("settled_at", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// Stakes — individual participant positions in markets
// ---------------------------------------------------------------------------
export const stakes = pgTable("stakes", {
  id: uuid("id").primaryKey().defaultRandom(),
  marketId: text("market_id").notNull(),
  participantAddress: text("participant_address").notNull(),
  direction: text("direction").notNull(), // Long | Short
  stakeAmount: numeric("stake_amount").notNull(),
  claimed: boolean("claimed").notNull().default(false),
  payout: numeric("payout"),
  transactionHash: text("transaction_hash"),
  timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// AI Signal Log — for accuracy tracking after settlement
// ---------------------------------------------------------------------------
export const aiSignals = pgTable("ai_signals", {
  id: uuid("id").primaryKey().defaultRandom(),
  marketId: text("market_id").notNull(),
  direction: text("direction").notNull(), // BULLISH | BEARISH | NEUTRAL
  confidence: integer("confidence"),
  rationale: text("rationale"),
  isAccurate: boolean("is_accurate"), // populated after settlement
  generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// Follows — off-chain social graph (no on-chain events needed)
// ---------------------------------------------------------------------------
export const follows = pgTable("follows", {
  id: uuid("id").primaryKey().defaultRandom(),
  followerAddress: text("follower_address").notNull(),
  followingAddress: text("following_address").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
