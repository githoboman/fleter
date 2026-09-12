import { PGlite } from "@electric-sql/pglite";
import * as fs from "fs";

async function run() {
  console.log("Initializing local PGLite database...");
  const db = new PGlite("memory://");
  
  const ddl = `
CREATE TABLE IF NOT EXISTS "ai_signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"market_id" text NOT NULL,
	"direction" text NOT NULL,
	"confidence" integer,
	"rationale" text,
	"is_accurate" boolean,
	"generated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "follows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"follower_address" text NOT NULL,
	"following_address" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "markets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"market_id" text NOT NULL,
	"opener_address" text NOT NULL,
	"opener_direction" text NOT NULL,
	"pom_profit_bps" integer NOT NULL,
	"stake" numeric NOT NULL,
	"long_pool" numeric DEFAULT '0' NOT NULL,
	"short_pool" numeric DEFAULT '0' NOT NULL,
	"join_deadline" bigint,
	"state" text DEFAULT 'OPEN' NOT NULL,
	"entry_price" numeric,
	"settlement_price" numeric,
	"outcome" text,
	"transaction_hash" text,
	"opened_at" timestamp with time zone DEFAULT now(),
	"settled_at" timestamp with time zone,
	CONSTRAINT "markets_market_id_unique" UNIQUE("market_id")
);

CREATE TABLE IF NOT EXISTS "stakes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"market_id" text NOT NULL,
	"participant_address" text NOT NULL,
	"direction" text NOT NULL,
	"stake_amount" numeric NOT NULL,
	"claimed" boolean DEFAULT false NOT NULL,
	"payout" numeric,
	"transaction_hash" text,
	"timestamp" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "traders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"address" text NOT NULL,
	"display_name" text,
	"tier" text DEFAULT 'SCOUT' NOT NULL,
	"markets_entered" integer DEFAULT 0 NOT NULL,
	"wins" integer DEFAULT 0 NOT NULL,
	"losses" integer DEFAULT 0 NOT NULL,
	"draws" integer DEFAULT 0 NOT NULL,
	"total_staked" numeric DEFAULT '0' NOT NULL,
	"total_claimed" numeric DEFAULT '0' NOT NULL,
	"composite_score" numeric DEFAULT '0' NOT NULL,
	"last_active" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "traders_address_unique" UNIQUE("address")
);
  `;
  
  await db.exec(ddl);
  console.log("Database initialized successfully!");
}

run().catch(console.error);
