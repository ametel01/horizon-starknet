CREATE TABLE "market_factory_default_reserve_fee_updated" (
	"_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_number" bigint NOT NULL,
	"block_timestamp" timestamp NOT NULL,
	"transaction_hash" text NOT NULL,
	"event_index" integer NOT NULL,
	"old_percent" integer NOT NULL,
	"new_percent" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_factory_override_fee_set" (
	"_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_number" bigint NOT NULL,
	"block_timestamp" timestamp NOT NULL,
	"transaction_hash" text NOT NULL,
	"event_index" integer NOT NULL,
	"router" text NOT NULL,
	"market" text NOT NULL,
	"ln_fee_rate_root" numeric(78, 0) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_factory_treasury_updated" (
	"_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_number" bigint NOT NULL,
	"block_timestamp" timestamp NOT NULL,
	"transaction_hash" text NOT NULL,
	"event_index" integer NOT NULL,
	"old_treasury" text NOT NULL,
	"new_treasury" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_reserve_fee_transferred" (
	"_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_number" bigint NOT NULL,
	"block_timestamp" timestamp NOT NULL,
	"transaction_hash" text NOT NULL,
	"event_index" integer NOT NULL,
	"market" text NOT NULL,
	"treasury" text NOT NULL,
	"caller" text NOT NULL,
	"amount" numeric(78, 0) NOT NULL,
	"expiry" bigint NOT NULL,
	"timestamp" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "market_factory_market_created" ADD COLUMN "ln_fee_rate_root" numeric(78, 0) NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE "market_factory_market_created" ADD COLUMN "reserve_fee_percent" integer NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE "market_swap" ADD COLUMN "total_fee" numeric(78, 0);--> statement-breakpoint
ALTER TABLE "market_swap" ADD COLUMN "lp_fee" numeric(78, 0);--> statement-breakpoint
ALTER TABLE "market_swap" ADD COLUMN "reserve_fee" numeric(78, 0);--> statement-breakpoint
CREATE UNIQUE INDEX "mf_drfu_event_key" ON "market_factory_default_reserve_fee_updated" USING btree ("block_number","transaction_hash","event_index");--> statement-breakpoint
CREATE INDEX "mf_ofs_router_idx" ON "market_factory_override_fee_set" USING btree ("router");--> statement-breakpoint
CREATE INDEX "mf_ofs_market_idx" ON "market_factory_override_fee_set" USING btree ("market");--> statement-breakpoint
CREATE UNIQUE INDEX "mf_ofs_event_key" ON "market_factory_override_fee_set" USING btree ("block_number","transaction_hash","event_index");--> statement-breakpoint
CREATE UNIQUE INDEX "mf_tu_event_key" ON "market_factory_treasury_updated" USING btree ("block_number","transaction_hash","event_index");--> statement-breakpoint
CREATE INDEX "market_rft_market_idx" ON "market_reserve_fee_transferred" USING btree ("market");--> statement-breakpoint
CREATE INDEX "market_rft_treasury_idx" ON "market_reserve_fee_transferred" USING btree ("treasury");--> statement-breakpoint
CREATE INDEX "market_rft_caller_idx" ON "market_reserve_fee_transferred" USING btree ("caller");--> statement-breakpoint
CREATE INDEX "market_rft_expiry_idx" ON "market_reserve_fee_transferred" USING btree ("expiry");--> statement-breakpoint
CREATE UNIQUE INDEX "market_rft_event_key" ON "market_reserve_fee_transferred" USING btree ("block_number","transaction_hash","event_index");--> statement-breakpoint
ALTER TABLE "market_factory_market_created" DROP COLUMN "fee_rate";