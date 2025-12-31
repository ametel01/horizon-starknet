CREATE TABLE "sy_negative_yield_detected" (
	"_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_number" bigint NOT NULL,
	"block_timestamp" timestamp NOT NULL,
	"transaction_hash" text NOT NULL,
	"event_index" integer NOT NULL,
	"sy" text NOT NULL,
	"underlying" text NOT NULL,
	"watermark_rate" numeric(78, 0) NOT NULL,
	"current_rate" numeric(78, 0) NOT NULL,
	"rate_drop_bps" numeric(78, 0) NOT NULL,
	"event_timestamp" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sy_pause_state" (
	"_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_number" bigint NOT NULL,
	"block_timestamp" timestamp NOT NULL,
	"transaction_hash" text NOT NULL,
	"event_index" integer NOT NULL,
	"sy" text NOT NULL,
	"account" text NOT NULL,
	"is_paused" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sy_reward_index_updated" (
	"_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_number" bigint NOT NULL,
	"block_timestamp" timestamp NOT NULL,
	"transaction_hash" text NOT NULL,
	"event_index" integer NOT NULL,
	"reward_token" text NOT NULL,
	"sy" text NOT NULL,
	"old_index" numeric(78, 0) NOT NULL,
	"new_index" numeric(78, 0) NOT NULL,
	"rewards_added" numeric(78, 0) NOT NULL,
	"total_supply" numeric(78, 0) NOT NULL,
	"event_timestamp" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sy_reward_token_added" (
	"_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_number" bigint NOT NULL,
	"block_timestamp" timestamp NOT NULL,
	"transaction_hash" text NOT NULL,
	"event_index" integer NOT NULL,
	"reward_token" text NOT NULL,
	"sy" text NOT NULL,
	"token_index" integer NOT NULL,
	"event_timestamp" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sy_rewards_claimed" (
	"_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_number" bigint NOT NULL,
	"block_timestamp" timestamp NOT NULL,
	"transaction_hash" text NOT NULL,
	"event_index" integer NOT NULL,
	"user" text NOT NULL,
	"reward_token" text NOT NULL,
	"sy" text NOT NULL,
	"amount" numeric(78, 0) NOT NULL,
	"event_timestamp" bigint NOT NULL
);
--> statement-breakpoint
CREATE INDEX "sy_nyd_sy_idx" ON "sy_negative_yield_detected" USING btree ("sy");--> statement-breakpoint
CREATE INDEX "sy_nyd_underlying_idx" ON "sy_negative_yield_detected" USING btree ("underlying");--> statement-breakpoint
CREATE INDEX "sy_nyd_timestamp_idx" ON "sy_negative_yield_detected" USING btree ("block_timestamp");--> statement-breakpoint
CREATE UNIQUE INDEX "sy_nyd_event_key" ON "sy_negative_yield_detected" USING btree ("block_number","transaction_hash","event_index");--> statement-breakpoint
CREATE INDEX "sy_ps_sy_idx" ON "sy_pause_state" USING btree ("sy");--> statement-breakpoint
CREATE INDEX "sy_ps_timestamp_idx" ON "sy_pause_state" USING btree ("block_timestamp");--> statement-breakpoint
CREATE UNIQUE INDEX "sy_ps_event_key" ON "sy_pause_state" USING btree ("block_number","transaction_hash","event_index");--> statement-breakpoint
CREATE INDEX "sy_riu_sy_idx" ON "sy_reward_index_updated" USING btree ("sy");--> statement-breakpoint
CREATE INDEX "sy_riu_token_idx" ON "sy_reward_index_updated" USING btree ("reward_token");--> statement-breakpoint
CREATE INDEX "sy_riu_timestamp_idx" ON "sy_reward_index_updated" USING btree ("block_timestamp");--> statement-breakpoint
CREATE UNIQUE INDEX "sy_riu_event_key" ON "sy_reward_index_updated" USING btree ("block_number","transaction_hash","event_index");--> statement-breakpoint
CREATE INDEX "sy_rta_sy_idx" ON "sy_reward_token_added" USING btree ("sy");--> statement-breakpoint
CREATE INDEX "sy_rta_token_idx" ON "sy_reward_token_added" USING btree ("reward_token");--> statement-breakpoint
CREATE UNIQUE INDEX "sy_rta_event_key" ON "sy_reward_token_added" USING btree ("block_number","transaction_hash","event_index");--> statement-breakpoint
CREATE INDEX "sy_rc_user_idx" ON "sy_rewards_claimed" USING btree ("user");--> statement-breakpoint
CREATE INDEX "sy_rc_sy_idx" ON "sy_rewards_claimed" USING btree ("sy");--> statement-breakpoint
CREATE INDEX "sy_rc_token_idx" ON "sy_rewards_claimed" USING btree ("reward_token");--> statement-breakpoint
CREATE INDEX "sy_rc_timestamp_idx" ON "sy_rewards_claimed" USING btree ("block_timestamp");--> statement-breakpoint
CREATE UNIQUE INDEX "sy_rc_event_key" ON "sy_rewards_claimed" USING btree ("block_number","transaction_hash","event_index");