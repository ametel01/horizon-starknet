ALTER TABLE "market_fees_collected" ADD COLUMN "ln_fee_rate_root" numeric(78, 0) NOT NULL;--> statement-breakpoint
ALTER TABLE "market_fees_collected" DROP COLUMN "fee_rate";