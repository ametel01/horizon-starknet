-- Rename fee_rate to ln_fee_rate_root (preserves existing data)
ALTER TABLE "market_fees_collected" RENAME COLUMN "fee_rate" TO "ln_fee_rate_root";
