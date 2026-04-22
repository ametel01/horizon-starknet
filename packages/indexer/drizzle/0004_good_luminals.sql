CREATE TABLE "yt_interest_fee_rate_set" (
	"_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_number" bigint NOT NULL,
	"block_timestamp" timestamp NOT NULL,
	"transaction_hash" text NOT NULL,
	"event_index" integer NOT NULL,
	"yt" text NOT NULL,
	"old_rate" numeric(78, 0) NOT NULL,
	"new_rate" numeric(78, 0) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "yt_mint_py_multi" (
	"_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_number" bigint NOT NULL,
	"block_timestamp" timestamp NOT NULL,
	"transaction_hash" text NOT NULL,
	"event_index" integer NOT NULL,
	"caller" text NOT NULL,
	"expiry" bigint NOT NULL,
	"yt" text NOT NULL,
	"total_sy_deposited" numeric(78, 0) NOT NULL,
	"total_py_minted" numeric(78, 0) NOT NULL,
	"receiver_count" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "yt_post_expiry_data_set" (
	"_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_number" bigint NOT NULL,
	"block_timestamp" timestamp NOT NULL,
	"transaction_hash" text NOT NULL,
	"event_index" integer NOT NULL,
	"yt" text NOT NULL,
	"pt" text NOT NULL,
	"sy" text NOT NULL,
	"expiry" bigint NOT NULL,
	"first_py_index" numeric(78, 0) NOT NULL,
	"exchange_rate_at_init" numeric(78, 0) NOT NULL,
	"total_pt_supply" numeric(78, 0) NOT NULL,
	"total_yt_supply" numeric(78, 0) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "yt_py_index_updated" (
	"_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_number" bigint NOT NULL,
	"block_timestamp" timestamp NOT NULL,
	"transaction_hash" text NOT NULL,
	"event_index" integer NOT NULL,
	"yt" text NOT NULL,
	"old_index" numeric(78, 0) NOT NULL,
	"new_index" numeric(78, 0) NOT NULL,
	"exchange_rate" numeric(78, 0) NOT NULL,
	"index_block_number" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "yt_redeem_py_multi" (
	"_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_number" bigint NOT NULL,
	"block_timestamp" timestamp NOT NULL,
	"transaction_hash" text NOT NULL,
	"event_index" integer NOT NULL,
	"caller" text NOT NULL,
	"expiry" bigint NOT NULL,
	"yt" text NOT NULL,
	"total_py_redeemed" numeric(78, 0) NOT NULL,
	"total_sy_returned" numeric(78, 0) NOT NULL,
	"receiver_count" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "yt_redeem_py_with_interest" (
	"_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_number" bigint NOT NULL,
	"block_timestamp" timestamp NOT NULL,
	"transaction_hash" text NOT NULL,
	"event_index" integer NOT NULL,
	"caller" text NOT NULL,
	"receiver" text NOT NULL,
	"expiry" bigint NOT NULL,
	"yt" text NOT NULL,
	"amount_py_redeemed" numeric(78, 0) NOT NULL,
	"amount_sy_from_redeem" numeric(78, 0) NOT NULL,
	"amount_interest_claimed" numeric(78, 0) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "yt_treasury_interest_redeemed" (
	"_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_number" bigint NOT NULL,
	"block_timestamp" timestamp NOT NULL,
	"transaction_hash" text NOT NULL,
	"event_index" integer NOT NULL,
	"yt" text NOT NULL,
	"treasury" text NOT NULL,
	"amount_sy" numeric(78, 0) NOT NULL,
	"sy" text NOT NULL,
	"expiry_index" numeric(78, 0) NOT NULL,
	"current_index" numeric(78, 0) NOT NULL,
	"total_yt_supply" numeric(78, 0) NOT NULL
);
--> statement-breakpoint
DROP INDEX "yt_mint_receiver_idx";--> statement-breakpoint
ALTER TABLE "yt_mint_py" ADD COLUMN "receiver_pt" text;--> statement-breakpoint
ALTER TABLE "yt_mint_py" ADD COLUMN "receiver_yt" text;--> statement-breakpoint
UPDATE "yt_mint_py"
SET
	"receiver_pt" = COALESCE("receiver_pt", "receiver"),
	"receiver_yt" = COALESCE("receiver_yt", "receiver");--> statement-breakpoint
ALTER TABLE "yt_mint_py" ALTER COLUMN "receiver_pt" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "yt_mint_py" ALTER COLUMN "receiver_yt" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "yt_ifrs_yt_idx" ON "yt_interest_fee_rate_set" USING btree ("yt");--> statement-breakpoint
CREATE UNIQUE INDEX "yt_ifrs_event_key" ON "yt_interest_fee_rate_set" USING btree ("block_number","transaction_hash","event_index");--> statement-breakpoint
CREATE INDEX "yt_mpm_caller_idx" ON "yt_mint_py_multi" USING btree ("caller");--> statement-breakpoint
CREATE INDEX "yt_mpm_expiry_idx" ON "yt_mint_py_multi" USING btree ("expiry");--> statement-breakpoint
CREATE INDEX "yt_mpm_yt_idx" ON "yt_mint_py_multi" USING btree ("yt");--> statement-breakpoint
CREATE UNIQUE INDEX "yt_mpm_event_key" ON "yt_mint_py_multi" USING btree ("block_number","transaction_hash","event_index");--> statement-breakpoint
CREATE INDEX "yt_peds_yt_idx" ON "yt_post_expiry_data_set" USING btree ("yt");--> statement-breakpoint
CREATE INDEX "yt_peds_pt_idx" ON "yt_post_expiry_data_set" USING btree ("pt");--> statement-breakpoint
CREATE UNIQUE INDEX "yt_peds_event_key" ON "yt_post_expiry_data_set" USING btree ("block_number","transaction_hash","event_index");--> statement-breakpoint
CREATE INDEX "yt_piu_yt_idx" ON "yt_py_index_updated" USING btree ("yt");--> statement-breakpoint
CREATE INDEX "yt_piu_block_idx" ON "yt_py_index_updated" USING btree ("index_block_number");--> statement-breakpoint
CREATE UNIQUE INDEX "yt_piu_event_key" ON "yt_py_index_updated" USING btree ("block_number","transaction_hash","event_index");--> statement-breakpoint
CREATE INDEX "yt_rpm_caller_idx" ON "yt_redeem_py_multi" USING btree ("caller");--> statement-breakpoint
CREATE INDEX "yt_rpm_expiry_idx" ON "yt_redeem_py_multi" USING btree ("expiry");--> statement-breakpoint
CREATE INDEX "yt_rpm_yt_idx" ON "yt_redeem_py_multi" USING btree ("yt");--> statement-breakpoint
CREATE UNIQUE INDEX "yt_rpm_event_key" ON "yt_redeem_py_multi" USING btree ("block_number","transaction_hash","event_index");--> statement-breakpoint
CREATE INDEX "yt_rpwi_caller_idx" ON "yt_redeem_py_with_interest" USING btree ("caller");--> statement-breakpoint
CREATE INDEX "yt_rpwi_receiver_idx" ON "yt_redeem_py_with_interest" USING btree ("receiver");--> statement-breakpoint
CREATE INDEX "yt_rpwi_expiry_idx" ON "yt_redeem_py_with_interest" USING btree ("expiry");--> statement-breakpoint
CREATE INDEX "yt_rpwi_yt_idx" ON "yt_redeem_py_with_interest" USING btree ("yt");--> statement-breakpoint
CREATE UNIQUE INDEX "yt_rpwi_event_key" ON "yt_redeem_py_with_interest" USING btree ("block_number","transaction_hash","event_index");--> statement-breakpoint
CREATE INDEX "yt_tir_yt_idx" ON "yt_treasury_interest_redeemed" USING btree ("yt");--> statement-breakpoint
CREATE INDEX "yt_tir_treasury_idx" ON "yt_treasury_interest_redeemed" USING btree ("treasury");--> statement-breakpoint
CREATE UNIQUE INDEX "yt_tir_event_key" ON "yt_treasury_interest_redeemed" USING btree ("block_number","transaction_hash","event_index");--> statement-breakpoint
CREATE INDEX "yt_mint_receiver_pt_idx" ON "yt_mint_py" USING btree ("receiver_pt");--> statement-breakpoint
CREATE INDEX "yt_mint_receiver_yt_idx" ON "yt_mint_py" USING btree ("receiver_yt");--> statement-breakpoint
ALTER TABLE "yt_mint_py" DROP COLUMN "receiver";
