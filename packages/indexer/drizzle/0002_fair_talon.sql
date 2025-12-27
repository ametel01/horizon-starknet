CREATE TABLE "market_scalar_root_updated" (
	"_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_number" bigint NOT NULL,
	"block_timestamp" timestamp NOT NULL,
	"transaction_hash" text NOT NULL,
	"event_index" integer NOT NULL,
	"market" text NOT NULL,
	"old_value" numeric(78, 0) NOT NULL,
	"new_value" numeric(78, 0) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "factory_class_hashes_updated" ADD COLUMN "event_index" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "factory_yield_contracts_created" ADD COLUMN "event_index" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "market_burn" ADD COLUMN "event_index" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "market_factory_class_hash_updated" ADD COLUMN "event_index" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "market_factory_market_created" ADD COLUMN "event_index" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "market_fees_collected" ADD COLUMN "event_index" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "market_implied_rate_updated" ADD COLUMN "event_index" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "market_mint" ADD COLUMN "event_index" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "market_swap" ADD COLUMN "event_index" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "router_add_liquidity" ADD COLUMN "event_index" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "router_mint_py" ADD COLUMN "event_index" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "router_redeem_py" ADD COLUMN "event_index" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "router_remove_liquidity" ADD COLUMN "event_index" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "router_swap" ADD COLUMN "event_index" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "router_swap_yt" ADD COLUMN "event_index" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "sy_deposit" ADD COLUMN "event_index" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "sy_oracle_rate_updated" ADD COLUMN "event_index" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "sy_redeem" ADD COLUMN "event_index" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "yt_expiry_reached" ADD COLUMN "event_index" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "yt_interest_claimed" ADD COLUMN "event_index" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "yt_mint_py" ADD COLUMN "event_index" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "yt_redeem_py" ADD COLUMN "event_index" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "yt_redeem_py_post_expiry" ADD COLUMN "event_index" integer NOT NULL;--> statement-breakpoint
CREATE INDEX "market_sru_market_idx" ON "market_scalar_root_updated" USING btree ("market");--> statement-breakpoint
CREATE INDEX "market_sru_timestamp_idx" ON "market_scalar_root_updated" USING btree ("block_timestamp");--> statement-breakpoint
CREATE UNIQUE INDEX "market_sru_event_key" ON "market_scalar_root_updated" USING btree ("block_number","transaction_hash","event_index");--> statement-breakpoint
CREATE UNIQUE INDEX "factory_chu_event_key" ON "factory_class_hashes_updated" USING btree ("block_number","transaction_hash","event_index");--> statement-breakpoint
CREATE UNIQUE INDEX "factory_ycc_event_key" ON "factory_yield_contracts_created" USING btree ("block_number","transaction_hash","event_index");--> statement-breakpoint
CREATE UNIQUE INDEX "market_burn_event_key" ON "market_burn" USING btree ("block_number","transaction_hash","event_index");--> statement-breakpoint
CREATE UNIQUE INDEX "mf_chu_event_key" ON "market_factory_class_hash_updated" USING btree ("block_number","transaction_hash","event_index");--> statement-breakpoint
CREATE UNIQUE INDEX "mf_mc_event_key" ON "market_factory_market_created" USING btree ("block_number","transaction_hash","event_index");--> statement-breakpoint
CREATE UNIQUE INDEX "market_fc_event_key" ON "market_fees_collected" USING btree ("block_number","transaction_hash","event_index");--> statement-breakpoint
CREATE UNIQUE INDEX "market_iru_event_key" ON "market_implied_rate_updated" USING btree ("block_number","transaction_hash","event_index");--> statement-breakpoint
CREATE UNIQUE INDEX "market_mint_event_key" ON "market_mint" USING btree ("block_number","transaction_hash","event_index");--> statement-breakpoint
CREATE UNIQUE INDEX "market_swap_event_key" ON "market_swap" USING btree ("block_number","transaction_hash","event_index");--> statement-breakpoint
CREATE UNIQUE INDEX "router_al_event_key" ON "router_add_liquidity" USING btree ("block_number","transaction_hash","event_index");--> statement-breakpoint
CREATE UNIQUE INDEX "router_mint_event_key" ON "router_mint_py" USING btree ("block_number","transaction_hash","event_index");--> statement-breakpoint
CREATE UNIQUE INDEX "router_redeem_event_key" ON "router_redeem_py" USING btree ("block_number","transaction_hash","event_index");--> statement-breakpoint
CREATE UNIQUE INDEX "router_rl_event_key" ON "router_remove_liquidity" USING btree ("block_number","transaction_hash","event_index");--> statement-breakpoint
CREATE UNIQUE INDEX "router_swap_event_key" ON "router_swap" USING btree ("block_number","transaction_hash","event_index");--> statement-breakpoint
CREATE UNIQUE INDEX "router_swap_yt_event_key" ON "router_swap_yt" USING btree ("block_number","transaction_hash","event_index");--> statement-breakpoint
CREATE UNIQUE INDEX "sy_deposit_event_key" ON "sy_deposit" USING btree ("block_number","transaction_hash","event_index");--> statement-breakpoint
CREATE UNIQUE INDEX "sy_oru_event_key" ON "sy_oracle_rate_updated" USING btree ("block_number","transaction_hash","event_index");--> statement-breakpoint
CREATE UNIQUE INDEX "sy_redeem_event_key" ON "sy_redeem" USING btree ("block_number","transaction_hash","event_index");--> statement-breakpoint
CREATE UNIQUE INDEX "yt_er_event_key" ON "yt_expiry_reached" USING btree ("block_number","transaction_hash","event_index");--> statement-breakpoint
CREATE UNIQUE INDEX "yt_ic_event_key" ON "yt_interest_claimed" USING btree ("block_number","transaction_hash","event_index");--> statement-breakpoint
CREATE UNIQUE INDEX "yt_mint_event_key" ON "yt_mint_py" USING btree ("block_number","transaction_hash","event_index");--> statement-breakpoint
CREATE UNIQUE INDEX "yt_redeem_event_key" ON "yt_redeem_py" USING btree ("block_number","transaction_hash","event_index");--> statement-breakpoint
CREATE UNIQUE INDEX "yt_redeem_pe_event_key" ON "yt_redeem_py_post_expiry" USING btree ("block_number","transaction_hash","event_index");