CREATE TABLE "factory_default_interest_fee_rate_set" (
	"_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_number" bigint NOT NULL,
	"block_timestamp" timestamp NOT NULL,
	"transaction_hash" text NOT NULL,
	"event_index" integer NOT NULL,
	"old_fee_rate" numeric(78, 0) NOT NULL,
	"new_fee_rate" numeric(78, 0) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "factory_expiry_divisor_set" (
	"_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_number" bigint NOT NULL,
	"block_timestamp" timestamp NOT NULL,
	"transaction_hash" text NOT NULL,
	"event_index" integer NOT NULL,
	"old_expiry_divisor" bigint NOT NULL,
	"new_expiry_divisor" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "factory_reward_fee_rate_set" (
	"_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_number" bigint NOT NULL,
	"block_timestamp" timestamp NOT NULL,
	"transaction_hash" text NOT NULL,
	"event_index" integer NOT NULL,
	"old_fee_rate" numeric(78, 0) NOT NULL,
	"new_fee_rate" numeric(78, 0) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "factory_sy_with_rewards_class_hash_updated" (
	"_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_number" bigint NOT NULL,
	"block_timestamp" timestamp NOT NULL,
	"transaction_hash" text NOT NULL,
	"event_index" integer NOT NULL,
	"old_class_hash" text NOT NULL,
	"new_class_hash" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "factory_sy_with_rewards_deployed" (
	"_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_number" bigint NOT NULL,
	"block_timestamp" timestamp NOT NULL,
	"transaction_hash" text NOT NULL,
	"event_index" integer NOT NULL,
	"sy" text NOT NULL,
	"name" text NOT NULL,
	"symbol" text NOT NULL,
	"underlying" text NOT NULL,
	"deployer" text NOT NULL,
	"timestamp_field" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_factory_default_rate_impact_sensitivity_updated" (
	"_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_number" bigint NOT NULL,
	"block_timestamp" timestamp NOT NULL,
	"transaction_hash" text NOT NULL,
	"event_index" integer NOT NULL,
	"old_sensitivity" numeric(78, 0) NOT NULL,
	"new_sensitivity" numeric(78, 0) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_factory_yield_contract_factory_updated" (
	"_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_number" bigint NOT NULL,
	"block_timestamp" timestamp NOT NULL,
	"transaction_hash" text NOT NULL,
	"event_index" integer NOT NULL,
	"old_factory" text NOT NULL,
	"new_factory" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_skim" (
	"_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_number" bigint NOT NULL,
	"block_timestamp" timestamp NOT NULL,
	"transaction_hash" text NOT NULL,
	"event_index" integer NOT NULL,
	"market" text NOT NULL,
	"caller" text NOT NULL,
	"sy_excess" numeric(78, 0) NOT NULL,
	"pt_excess" numeric(78, 0) NOT NULL,
	"sy_reserve_after" numeric(78, 0) NOT NULL,
	"pt_reserve_after" numeric(78, 0) NOT NULL,
	"event_timestamp" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "yt_flash_mint_py" (
	"_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_number" bigint NOT NULL,
	"block_timestamp" timestamp NOT NULL,
	"transaction_hash" text NOT NULL,
	"event_index" integer NOT NULL,
	"caller" text NOT NULL,
	"receiver" text NOT NULL,
	"yt" text NOT NULL,
	"amount_py" numeric(78, 0) NOT NULL,
	"fee_sy" numeric(78, 0) NOT NULL,
	"sy" text NOT NULL,
	"pt" text NOT NULL,
	"timestamp" bigint NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "factory_difrs_event_key" ON "factory_default_interest_fee_rate_set" USING btree ("block_number","transaction_hash","event_index");--> statement-breakpoint
CREATE UNIQUE INDEX "factory_eds_event_key" ON "factory_expiry_divisor_set" USING btree ("block_number","transaction_hash","event_index");--> statement-breakpoint
CREATE UNIQUE INDEX "factory_rfrs_event_key" ON "factory_reward_fee_rate_set" USING btree ("block_number","transaction_hash","event_index");--> statement-breakpoint
CREATE UNIQUE INDEX "factory_swrchu_event_key" ON "factory_sy_with_rewards_class_hash_updated" USING btree ("block_number","transaction_hash","event_index");--> statement-breakpoint
CREATE INDEX "factory_sywrd_sy_idx" ON "factory_sy_with_rewards_deployed" USING btree ("sy");--> statement-breakpoint
CREATE INDEX "factory_sywrd_underlying_idx" ON "factory_sy_with_rewards_deployed" USING btree ("underlying");--> statement-breakpoint
CREATE INDEX "factory_sywrd_deployer_idx" ON "factory_sy_with_rewards_deployed" USING btree ("deployer");--> statement-breakpoint
CREATE UNIQUE INDEX "factory_sywrd_event_key" ON "factory_sy_with_rewards_deployed" USING btree ("block_number","transaction_hash","event_index");--> statement-breakpoint
CREATE UNIQUE INDEX "mf_drisu_event_key" ON "market_factory_default_rate_impact_sensitivity_updated" USING btree ("block_number","transaction_hash","event_index");--> statement-breakpoint
CREATE UNIQUE INDEX "mf_ycfu_event_key" ON "market_factory_yield_contract_factory_updated" USING btree ("block_number","transaction_hash","event_index");--> statement-breakpoint
CREATE INDEX "market_skim_market_idx" ON "market_skim" USING btree ("market");--> statement-breakpoint
CREATE INDEX "market_skim_caller_idx" ON "market_skim" USING btree ("caller");--> statement-breakpoint
CREATE UNIQUE INDEX "market_skim_event_key" ON "market_skim" USING btree ("block_number","transaction_hash","event_index");--> statement-breakpoint
CREATE INDEX "yt_fmpy_caller_idx" ON "yt_flash_mint_py" USING btree ("caller");--> statement-breakpoint
CREATE INDEX "yt_fmpy_receiver_idx" ON "yt_flash_mint_py" USING btree ("receiver");--> statement-breakpoint
CREATE INDEX "yt_fmpy_yt_idx" ON "yt_flash_mint_py" USING btree ("yt");--> statement-breakpoint
CREATE UNIQUE INDEX "yt_fmpy_event_key" ON "yt_flash_mint_py" USING btree ("block_number","transaction_hash","event_index");