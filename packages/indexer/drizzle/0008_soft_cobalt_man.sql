CREATE TABLE "market_burn_with_receivers" (
	"_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_number" bigint NOT NULL,
	"block_timestamp" timestamp NOT NULL,
	"transaction_hash" text NOT NULL,
	"event_index" integer NOT NULL,
	"sender" text NOT NULL,
	"receiver_sy" text NOT NULL,
	"receiver_pt" text NOT NULL,
	"expiry" bigint NOT NULL,
	"market" text NOT NULL,
	"sy" text NOT NULL,
	"pt" text NOT NULL,
	"lp_amount" numeric(78, 0) NOT NULL,
	"sy_amount" numeric(78, 0) NOT NULL,
	"pt_amount" numeric(78, 0) NOT NULL,
	"exchange_rate" numeric(78, 0) NOT NULL,
	"implied_rate" numeric(78, 0) NOT NULL,
	"sy_reserve_after" numeric(78, 0) NOT NULL,
	"pt_reserve_after" numeric(78, 0) NOT NULL,
	"total_lp_after" numeric(78, 0) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_reward_index_updated" (
	"_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_number" bigint NOT NULL,
	"block_timestamp" timestamp NOT NULL,
	"transaction_hash" text NOT NULL,
	"event_index" integer NOT NULL,
	"reward_token" text NOT NULL,
	"market" text NOT NULL,
	"old_index" numeric(78, 0) NOT NULL,
	"new_index" numeric(78, 0) NOT NULL,
	"rewards_added" numeric(78, 0) NOT NULL,
	"total_supply" numeric(78, 0) NOT NULL,
	"event_timestamp" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_reward_token_added" (
	"_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_number" bigint NOT NULL,
	"block_timestamp" timestamp NOT NULL,
	"transaction_hash" text NOT NULL,
	"event_index" integer NOT NULL,
	"reward_token" text NOT NULL,
	"market" text NOT NULL,
	"token_index" integer NOT NULL,
	"event_timestamp" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_rewards_claimed" (
	"_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_number" bigint NOT NULL,
	"block_timestamp" timestamp NOT NULL,
	"transaction_hash" text NOT NULL,
	"event_index" integer NOT NULL,
	"user" text NOT NULL,
	"reward_token" text NOT NULL,
	"market" text NOT NULL,
	"amount" numeric(78, 0) NOT NULL,
	"event_timestamp" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "router_rollover_lp" (
	"_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_number" bigint NOT NULL,
	"block_timestamp" timestamp NOT NULL,
	"transaction_hash" text NOT NULL,
	"event_index" integer NOT NULL,
	"sender" text NOT NULL,
	"receiver" text NOT NULL,
	"market_old" text NOT NULL,
	"market_new" text NOT NULL,
	"lp_burned" numeric(78, 0) NOT NULL,
	"lp_minted" numeric(78, 0) NOT NULL
);
--> statement-breakpoint
CREATE INDEX "market_burn_with_receivers_sender_idx" ON "market_burn_with_receivers" USING btree ("sender");--> statement-breakpoint
CREATE INDEX "market_burn_with_receivers_receiver_sy_idx" ON "market_burn_with_receivers" USING btree ("receiver_sy");--> statement-breakpoint
CREATE INDEX "market_burn_with_receivers_receiver_pt_idx" ON "market_burn_with_receivers" USING btree ("receiver_pt");--> statement-breakpoint
CREATE INDEX "market_burn_with_receivers_expiry_idx" ON "market_burn_with_receivers" USING btree ("expiry");--> statement-breakpoint
CREATE INDEX "market_burn_with_receivers_market_idx" ON "market_burn_with_receivers" USING btree ("market");--> statement-breakpoint
CREATE UNIQUE INDEX "market_burn_with_receivers_event_key" ON "market_burn_with_receivers" USING btree ("block_number","transaction_hash","event_index");--> statement-breakpoint
CREATE INDEX "market_riu_market_idx" ON "market_reward_index_updated" USING btree ("market");--> statement-breakpoint
CREATE INDEX "market_riu_token_idx" ON "market_reward_index_updated" USING btree ("reward_token");--> statement-breakpoint
CREATE INDEX "market_riu_timestamp_idx" ON "market_reward_index_updated" USING btree ("block_timestamp");--> statement-breakpoint
CREATE UNIQUE INDEX "market_riu_event_key" ON "market_reward_index_updated" USING btree ("block_number","transaction_hash","event_index");--> statement-breakpoint
CREATE INDEX "market_rta_market_idx" ON "market_reward_token_added" USING btree ("market");--> statement-breakpoint
CREATE INDEX "market_rta_token_idx" ON "market_reward_token_added" USING btree ("reward_token");--> statement-breakpoint
CREATE UNIQUE INDEX "market_rta_event_key" ON "market_reward_token_added" USING btree ("block_number","transaction_hash","event_index");--> statement-breakpoint
CREATE INDEX "market_rc_user_idx" ON "market_rewards_claimed" USING btree ("user");--> statement-breakpoint
CREATE INDEX "market_rc_market_idx" ON "market_rewards_claimed" USING btree ("market");--> statement-breakpoint
CREATE INDEX "market_rc_token_idx" ON "market_rewards_claimed" USING btree ("reward_token");--> statement-breakpoint
CREATE INDEX "market_rc_timestamp_idx" ON "market_rewards_claimed" USING btree ("block_timestamp");--> statement-breakpoint
CREATE UNIQUE INDEX "market_rc_event_key" ON "market_rewards_claimed" USING btree ("block_number","transaction_hash","event_index");--> statement-breakpoint
CREATE INDEX "router_rollover_sender_idx" ON "router_rollover_lp" USING btree ("sender");--> statement-breakpoint
CREATE INDEX "router_rollover_receiver_idx" ON "router_rollover_lp" USING btree ("receiver");--> statement-breakpoint
CREATE INDEX "router_rollover_market_old_idx" ON "router_rollover_lp" USING btree ("market_old");--> statement-breakpoint
CREATE INDEX "router_rollover_market_new_idx" ON "router_rollover_lp" USING btree ("market_new");--> statement-breakpoint
CREATE INDEX "router_rollover_timestamp_idx" ON "router_rollover_lp" USING btree ("block_timestamp");--> statement-breakpoint
CREATE UNIQUE INDEX "router_rollover_event_key" ON "router_rollover_lp" USING btree ("block_number","transaction_hash","event_index");