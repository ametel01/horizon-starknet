CREATE TABLE "factory_class_hashes_updated" (
	"_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_number" bigint NOT NULL,
	"block_timestamp" timestamp NOT NULL,
	"transaction_hash" text NOT NULL,
	"yt_class_hash" text NOT NULL,
	"pt_class_hash" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "factory_yield_contracts_created" (
	"_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_number" bigint NOT NULL,
	"block_timestamp" timestamp NOT NULL,
	"transaction_hash" text NOT NULL,
	"sy" text NOT NULL,
	"expiry" bigint NOT NULL,
	"pt" text NOT NULL,
	"yt" text NOT NULL,
	"creator" text NOT NULL,
	"underlying" text NOT NULL,
	"underlying_symbol" text NOT NULL,
	"initial_exchange_rate" numeric(78, 0) NOT NULL,
	"market_index" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_burn" (
	"_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_number" bigint NOT NULL,
	"block_timestamp" timestamp NOT NULL,
	"transaction_hash" text NOT NULL,
	"sender" text NOT NULL,
	"receiver" text NOT NULL,
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
CREATE TABLE "market_factory_class_hash_updated" (
	"_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_number" bigint NOT NULL,
	"block_timestamp" timestamp NOT NULL,
	"transaction_hash" text NOT NULL,
	"old_class_hash" text NOT NULL,
	"new_class_hash" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_factory_market_created" (
	"_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_number" bigint NOT NULL,
	"block_timestamp" timestamp NOT NULL,
	"transaction_hash" text NOT NULL,
	"pt" text NOT NULL,
	"expiry" bigint NOT NULL,
	"market" text NOT NULL,
	"creator" text NOT NULL,
	"scalar_root" numeric(78, 0) NOT NULL,
	"initial_anchor" numeric(78, 0) NOT NULL,
	"fee_rate" numeric(78, 0) NOT NULL,
	"sy" text NOT NULL,
	"yt" text NOT NULL,
	"underlying" text NOT NULL,
	"underlying_symbol" text NOT NULL,
	"initial_exchange_rate" numeric(78, 0) NOT NULL,
	"market_index" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_fees_collected" (
	"_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_number" bigint NOT NULL,
	"block_timestamp" timestamp NOT NULL,
	"transaction_hash" text NOT NULL,
	"collector" text NOT NULL,
	"receiver" text NOT NULL,
	"market" text NOT NULL,
	"amount" numeric(78, 0) NOT NULL,
	"expiry" bigint NOT NULL,
	"fee_rate" numeric(78, 0) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_implied_rate_updated" (
	"_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_number" bigint NOT NULL,
	"block_timestamp" timestamp NOT NULL,
	"transaction_hash" text NOT NULL,
	"market" text NOT NULL,
	"expiry" bigint NOT NULL,
	"old_rate" numeric(78, 0) NOT NULL,
	"new_rate" numeric(78, 0) NOT NULL,
	"time_to_expiry" bigint NOT NULL,
	"exchange_rate" numeric(78, 0) NOT NULL,
	"sy_reserve" numeric(78, 0) NOT NULL,
	"pt_reserve" numeric(78, 0) NOT NULL,
	"total_lp" numeric(78, 0) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_mint" (
	"_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_number" bigint NOT NULL,
	"block_timestamp" timestamp NOT NULL,
	"transaction_hash" text NOT NULL,
	"sender" text NOT NULL,
	"receiver" text NOT NULL,
	"expiry" bigint NOT NULL,
	"market" text NOT NULL,
	"sy" text NOT NULL,
	"pt" text NOT NULL,
	"sy_amount" numeric(78, 0) NOT NULL,
	"pt_amount" numeric(78, 0) NOT NULL,
	"lp_amount" numeric(78, 0) NOT NULL,
	"exchange_rate" numeric(78, 0) NOT NULL,
	"implied_rate" numeric(78, 0) NOT NULL,
	"sy_reserve_after" numeric(78, 0) NOT NULL,
	"pt_reserve_after" numeric(78, 0) NOT NULL,
	"total_lp_after" numeric(78, 0) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_swap" (
	"_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_number" bigint NOT NULL,
	"block_timestamp" timestamp NOT NULL,
	"transaction_hash" text NOT NULL,
	"sender" text NOT NULL,
	"receiver" text NOT NULL,
	"expiry" bigint NOT NULL,
	"market" text NOT NULL,
	"sy" text NOT NULL,
	"pt" text NOT NULL,
	"pt_in" numeric(78, 0) NOT NULL,
	"sy_in" numeric(78, 0) NOT NULL,
	"pt_out" numeric(78, 0) NOT NULL,
	"sy_out" numeric(78, 0) NOT NULL,
	"fee" numeric(78, 0) NOT NULL,
	"implied_rate_before" numeric(78, 0) NOT NULL,
	"implied_rate_after" numeric(78, 0) NOT NULL,
	"exchange_rate" numeric(78, 0) NOT NULL,
	"sy_reserve_after" numeric(78, 0) NOT NULL,
	"pt_reserve_after" numeric(78, 0) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "router_add_liquidity" (
	"_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_number" bigint NOT NULL,
	"block_timestamp" timestamp NOT NULL,
	"transaction_hash" text NOT NULL,
	"sender" text NOT NULL,
	"receiver" text NOT NULL,
	"market" text NOT NULL,
	"sy_used" numeric(78, 0) NOT NULL,
	"pt_used" numeric(78, 0) NOT NULL,
	"lp_out" numeric(78, 0) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "router_mint_py" (
	"_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_number" bigint NOT NULL,
	"block_timestamp" timestamp NOT NULL,
	"transaction_hash" text NOT NULL,
	"sender" text NOT NULL,
	"receiver" text NOT NULL,
	"yt" text NOT NULL,
	"sy_in" numeric(78, 0) NOT NULL,
	"pt_out" numeric(78, 0) NOT NULL,
	"yt_out" numeric(78, 0) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "router_redeem_py" (
	"_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_number" bigint NOT NULL,
	"block_timestamp" timestamp NOT NULL,
	"transaction_hash" text NOT NULL,
	"sender" text NOT NULL,
	"receiver" text NOT NULL,
	"yt" text NOT NULL,
	"py_in" numeric(78, 0) NOT NULL,
	"sy_out" numeric(78, 0) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "router_remove_liquidity" (
	"_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_number" bigint NOT NULL,
	"block_timestamp" timestamp NOT NULL,
	"transaction_hash" text NOT NULL,
	"sender" text NOT NULL,
	"receiver" text NOT NULL,
	"market" text NOT NULL,
	"lp_in" numeric(78, 0) NOT NULL,
	"sy_out" numeric(78, 0) NOT NULL,
	"pt_out" numeric(78, 0) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "router_swap" (
	"_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_number" bigint NOT NULL,
	"block_timestamp" timestamp NOT NULL,
	"transaction_hash" text NOT NULL,
	"sender" text NOT NULL,
	"receiver" text NOT NULL,
	"market" text NOT NULL,
	"sy_in" numeric(78, 0) NOT NULL,
	"pt_in" numeric(78, 0) NOT NULL,
	"sy_out" numeric(78, 0) NOT NULL,
	"pt_out" numeric(78, 0) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "router_swap_yt" (
	"_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_number" bigint NOT NULL,
	"block_timestamp" timestamp NOT NULL,
	"transaction_hash" text NOT NULL,
	"sender" text NOT NULL,
	"receiver" text NOT NULL,
	"yt" text NOT NULL,
	"market" text NOT NULL,
	"sy_in" numeric(78, 0) NOT NULL,
	"yt_in" numeric(78, 0) NOT NULL,
	"sy_out" numeric(78, 0) NOT NULL,
	"yt_out" numeric(78, 0) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sy_deposit" (
	"_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_number" bigint NOT NULL,
	"block_timestamp" timestamp NOT NULL,
	"transaction_hash" text NOT NULL,
	"caller" text NOT NULL,
	"receiver" text NOT NULL,
	"underlying" text NOT NULL,
	"sy" text NOT NULL,
	"amount_deposited" numeric(78, 0) NOT NULL,
	"amount_sy_minted" numeric(78, 0) NOT NULL,
	"exchange_rate" numeric(78, 0) NOT NULL,
	"total_supply_after" numeric(78, 0) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sy_oracle_rate_updated" (
	"_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_number" bigint NOT NULL,
	"block_timestamp" timestamp NOT NULL,
	"transaction_hash" text NOT NULL,
	"sy" text NOT NULL,
	"underlying" text NOT NULL,
	"old_rate" numeric(78, 0) NOT NULL,
	"new_rate" numeric(78, 0) NOT NULL,
	"rate_change_bps" numeric(78, 0) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sy_redeem" (
	"_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_number" bigint NOT NULL,
	"block_timestamp" timestamp NOT NULL,
	"transaction_hash" text NOT NULL,
	"caller" text NOT NULL,
	"receiver" text NOT NULL,
	"underlying" text NOT NULL,
	"sy" text NOT NULL,
	"amount_sy_burned" numeric(78, 0) NOT NULL,
	"amount_redeemed" numeric(78, 0) NOT NULL,
	"exchange_rate" numeric(78, 0) NOT NULL,
	"total_supply_after" numeric(78, 0) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "yt_expiry_reached" (
	"_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_number" bigint NOT NULL,
	"block_timestamp" timestamp NOT NULL,
	"transaction_hash" text NOT NULL,
	"market" text NOT NULL,
	"yt" text NOT NULL,
	"pt" text NOT NULL,
	"sy" text NOT NULL,
	"expiry" bigint NOT NULL,
	"final_exchange_rate" numeric(78, 0) NOT NULL,
	"final_py_index" numeric(78, 0) NOT NULL,
	"total_pt_supply" numeric(78, 0) NOT NULL,
	"total_yt_supply" numeric(78, 0) NOT NULL,
	"sy_reserve" numeric(78, 0) NOT NULL,
	"pt_reserve" numeric(78, 0) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "yt_interest_claimed" (
	"_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_number" bigint NOT NULL,
	"block_timestamp" timestamp NOT NULL,
	"transaction_hash" text NOT NULL,
	"user" text NOT NULL,
	"yt" text NOT NULL,
	"expiry" bigint NOT NULL,
	"sy" text NOT NULL,
	"amount_sy" numeric(78, 0) NOT NULL,
	"yt_balance" numeric(78, 0) NOT NULL,
	"py_index_at_claim" numeric(78, 0) NOT NULL,
	"exchange_rate" numeric(78, 0) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "yt_mint_py" (
	"_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_number" bigint NOT NULL,
	"block_timestamp" timestamp NOT NULL,
	"transaction_hash" text NOT NULL,
	"caller" text NOT NULL,
	"receiver" text NOT NULL,
	"expiry" bigint NOT NULL,
	"yt" text NOT NULL,
	"sy" text NOT NULL,
	"pt" text NOT NULL,
	"amount_sy_deposited" numeric(78, 0) NOT NULL,
	"amount_py_minted" numeric(78, 0) NOT NULL,
	"py_index" numeric(78, 0) NOT NULL,
	"exchange_rate" numeric(78, 0) NOT NULL,
	"total_pt_supply_after" numeric(78, 0) NOT NULL,
	"total_yt_supply_after" numeric(78, 0) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "yt_redeem_py" (
	"_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_number" bigint NOT NULL,
	"block_timestamp" timestamp NOT NULL,
	"transaction_hash" text NOT NULL,
	"caller" text NOT NULL,
	"receiver" text NOT NULL,
	"expiry" bigint NOT NULL,
	"yt" text NOT NULL,
	"sy" text NOT NULL,
	"pt" text NOT NULL,
	"amount_py_redeemed" numeric(78, 0) NOT NULL,
	"amount_sy_returned" numeric(78, 0) NOT NULL,
	"py_index" numeric(78, 0) NOT NULL,
	"exchange_rate" numeric(78, 0) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "yt_redeem_py_post_expiry" (
	"_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"block_number" bigint NOT NULL,
	"block_timestamp" timestamp NOT NULL,
	"transaction_hash" text NOT NULL,
	"caller" text NOT NULL,
	"receiver" text NOT NULL,
	"expiry" bigint NOT NULL,
	"yt" text NOT NULL,
	"sy" text NOT NULL,
	"pt" text NOT NULL,
	"amount_pt_redeemed" numeric(78, 0) NOT NULL,
	"amount_sy_returned" numeric(78, 0) NOT NULL,
	"final_py_index" numeric(78, 0) NOT NULL,
	"final_exchange_rate" numeric(78, 0) NOT NULL
);
--> statement-breakpoint
CREATE INDEX "factory_ycc_sy_idx" ON "factory_yield_contracts_created" USING btree ("sy");--> statement-breakpoint
CREATE INDEX "factory_ycc_expiry_idx" ON "factory_yield_contracts_created" USING btree ("expiry");--> statement-breakpoint
CREATE INDEX "factory_ycc_creator_idx" ON "factory_yield_contracts_created" USING btree ("creator");--> statement-breakpoint
CREATE INDEX "factory_ycc_underlying_idx" ON "factory_yield_contracts_created" USING btree ("underlying");--> statement-breakpoint
CREATE INDEX "market_burn_sender_idx" ON "market_burn" USING btree ("sender");--> statement-breakpoint
CREATE INDEX "market_burn_receiver_idx" ON "market_burn" USING btree ("receiver");--> statement-breakpoint
CREATE INDEX "market_burn_expiry_idx" ON "market_burn" USING btree ("expiry");--> statement-breakpoint
CREATE INDEX "market_burn_market_idx" ON "market_burn" USING btree ("market");--> statement-breakpoint
CREATE INDEX "mf_mc_pt_idx" ON "market_factory_market_created" USING btree ("pt");--> statement-breakpoint
CREATE INDEX "mf_mc_expiry_idx" ON "market_factory_market_created" USING btree ("expiry");--> statement-breakpoint
CREATE INDEX "mf_mc_market_idx" ON "market_factory_market_created" USING btree ("market");--> statement-breakpoint
CREATE INDEX "mf_mc_underlying_idx" ON "market_factory_market_created" USING btree ("underlying");--> statement-breakpoint
CREATE INDEX "market_fc_collector_idx" ON "market_fees_collected" USING btree ("collector");--> statement-breakpoint
CREATE INDEX "market_fc_receiver_idx" ON "market_fees_collected" USING btree ("receiver");--> statement-breakpoint
CREATE INDEX "market_fc_market_idx" ON "market_fees_collected" USING btree ("market");--> statement-breakpoint
CREATE INDEX "market_iru_market_idx" ON "market_implied_rate_updated" USING btree ("market");--> statement-breakpoint
CREATE INDEX "market_iru_expiry_idx" ON "market_implied_rate_updated" USING btree ("expiry");--> statement-breakpoint
CREATE INDEX "market_iru_timestamp_idx" ON "market_implied_rate_updated" USING btree ("block_timestamp");--> statement-breakpoint
CREATE INDEX "market_mint_sender_idx" ON "market_mint" USING btree ("sender");--> statement-breakpoint
CREATE INDEX "market_mint_receiver_idx" ON "market_mint" USING btree ("receiver");--> statement-breakpoint
CREATE INDEX "market_mint_expiry_idx" ON "market_mint" USING btree ("expiry");--> statement-breakpoint
CREATE INDEX "market_mint_market_idx" ON "market_mint" USING btree ("market");--> statement-breakpoint
CREATE INDEX "market_swap_sender_idx" ON "market_swap" USING btree ("sender");--> statement-breakpoint
CREATE INDEX "market_swap_receiver_idx" ON "market_swap" USING btree ("receiver");--> statement-breakpoint
CREATE INDEX "market_swap_expiry_idx" ON "market_swap" USING btree ("expiry");--> statement-breakpoint
CREATE INDEX "market_swap_market_idx" ON "market_swap" USING btree ("market");--> statement-breakpoint
CREATE INDEX "market_swap_timestamp_idx" ON "market_swap" USING btree ("block_timestamp");--> statement-breakpoint
CREATE INDEX "router_al_sender_idx" ON "router_add_liquidity" USING btree ("sender");--> statement-breakpoint
CREATE INDEX "router_al_receiver_idx" ON "router_add_liquidity" USING btree ("receiver");--> statement-breakpoint
CREATE INDEX "router_al_market_idx" ON "router_add_liquidity" USING btree ("market");--> statement-breakpoint
CREATE INDEX "router_mint_sender_idx" ON "router_mint_py" USING btree ("sender");--> statement-breakpoint
CREATE INDEX "router_mint_receiver_idx" ON "router_mint_py" USING btree ("receiver");--> statement-breakpoint
CREATE INDEX "router_mint_yt_idx" ON "router_mint_py" USING btree ("yt");--> statement-breakpoint
CREATE INDEX "router_redeem_sender_idx" ON "router_redeem_py" USING btree ("sender");--> statement-breakpoint
CREATE INDEX "router_redeem_receiver_idx" ON "router_redeem_py" USING btree ("receiver");--> statement-breakpoint
CREATE INDEX "router_rl_sender_idx" ON "router_remove_liquidity" USING btree ("sender");--> statement-breakpoint
CREATE INDEX "router_rl_receiver_idx" ON "router_remove_liquidity" USING btree ("receiver");--> statement-breakpoint
CREATE INDEX "router_rl_market_idx" ON "router_remove_liquidity" USING btree ("market");--> statement-breakpoint
CREATE INDEX "router_swap_sender_idx" ON "router_swap" USING btree ("sender");--> statement-breakpoint
CREATE INDEX "router_swap_receiver_idx" ON "router_swap" USING btree ("receiver");--> statement-breakpoint
CREATE INDEX "router_swap_market_idx" ON "router_swap" USING btree ("market");--> statement-breakpoint
CREATE INDEX "router_swap_yt_sender_idx" ON "router_swap_yt" USING btree ("sender");--> statement-breakpoint
CREATE INDEX "router_swap_yt_receiver_idx" ON "router_swap_yt" USING btree ("receiver");--> statement-breakpoint
CREATE INDEX "router_swap_yt_market_idx" ON "router_swap_yt" USING btree ("market");--> statement-breakpoint
CREATE INDEX "router_swap_yt_yt_idx" ON "router_swap_yt" USING btree ("yt");--> statement-breakpoint
CREATE INDEX "sy_deposit_caller_idx" ON "sy_deposit" USING btree ("caller");--> statement-breakpoint
CREATE INDEX "sy_deposit_receiver_idx" ON "sy_deposit" USING btree ("receiver");--> statement-breakpoint
CREATE INDEX "sy_deposit_sy_idx" ON "sy_deposit" USING btree ("sy");--> statement-breakpoint
CREATE INDEX "sy_deposit_underlying_idx" ON "sy_deposit" USING btree ("underlying");--> statement-breakpoint
CREATE INDEX "sy_oru_sy_idx" ON "sy_oracle_rate_updated" USING btree ("sy");--> statement-breakpoint
CREATE INDEX "sy_oru_underlying_idx" ON "sy_oracle_rate_updated" USING btree ("underlying");--> statement-breakpoint
CREATE INDEX "sy_redeem_caller_idx" ON "sy_redeem" USING btree ("caller");--> statement-breakpoint
CREATE INDEX "sy_redeem_receiver_idx" ON "sy_redeem" USING btree ("receiver");--> statement-breakpoint
CREATE INDEX "sy_redeem_sy_idx" ON "sy_redeem" USING btree ("sy");--> statement-breakpoint
CREATE INDEX "yt_er_yt_idx" ON "yt_expiry_reached" USING btree ("yt");--> statement-breakpoint
CREATE INDEX "yt_er_pt_idx" ON "yt_expiry_reached" USING btree ("pt");--> statement-breakpoint
CREATE INDEX "yt_er_expiry_idx" ON "yt_expiry_reached" USING btree ("expiry");--> statement-breakpoint
CREATE INDEX "yt_ic_user_idx" ON "yt_interest_claimed" USING btree ("user");--> statement-breakpoint
CREATE INDEX "yt_ic_yt_idx" ON "yt_interest_claimed" USING btree ("yt");--> statement-breakpoint
CREATE INDEX "yt_ic_expiry_idx" ON "yt_interest_claimed" USING btree ("expiry");--> statement-breakpoint
CREATE INDEX "yt_mint_caller_idx" ON "yt_mint_py" USING btree ("caller");--> statement-breakpoint
CREATE INDEX "yt_mint_receiver_idx" ON "yt_mint_py" USING btree ("receiver");--> statement-breakpoint
CREATE INDEX "yt_mint_expiry_idx" ON "yt_mint_py" USING btree ("expiry");--> statement-breakpoint
CREATE INDEX "yt_mint_yt_idx" ON "yt_mint_py" USING btree ("yt");--> statement-breakpoint
CREATE INDEX "yt_redeem_caller_idx" ON "yt_redeem_py" USING btree ("caller");--> statement-breakpoint
CREATE INDEX "yt_redeem_receiver_idx" ON "yt_redeem_py" USING btree ("receiver");--> statement-breakpoint
CREATE INDEX "yt_redeem_expiry_idx" ON "yt_redeem_py" USING btree ("expiry");--> statement-breakpoint
CREATE INDEX "yt_redeem_pe_caller_idx" ON "yt_redeem_py_post_expiry" USING btree ("caller");--> statement-breakpoint
CREATE INDEX "yt_redeem_pe_receiver_idx" ON "yt_redeem_py_post_expiry" USING btree ("receiver");--> statement-breakpoint
CREATE INDEX "yt_redeem_pe_expiry_idx" ON "yt_redeem_py_post_expiry" USING btree ("expiry");