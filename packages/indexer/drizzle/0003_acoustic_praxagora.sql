ALTER TABLE "factory_yield_contracts_created" ADD COLUMN "underlying" text NOT NULL;--> statement-breakpoint
ALTER TABLE "factory_yield_contracts_created" ADD COLUMN "underlying_symbol" text NOT NULL;--> statement-breakpoint
ALTER TABLE "factory_yield_contracts_created" ADD COLUMN "initial_exchange_rate" numeric(78, 0) NOT NULL;--> statement-breakpoint
ALTER TABLE "factory_yield_contracts_created" ADD COLUMN "market_index" integer NOT NULL;--> statement-breakpoint
CREATE INDEX "factory_ycc_underlying_idx" ON "factory_yield_contracts_created" USING btree ("underlying");