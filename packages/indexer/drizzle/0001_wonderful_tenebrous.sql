CREATE INDEX "router_al_timestamp_idx" ON "router_add_liquidity" USING btree ("block_timestamp");--> statement-breakpoint
CREATE INDEX "router_mint_timestamp_idx" ON "router_mint_py" USING btree ("block_timestamp");--> statement-breakpoint
CREATE INDEX "router_redeem_timestamp_idx" ON "router_redeem_py" USING btree ("block_timestamp");--> statement-breakpoint
CREATE INDEX "router_rl_timestamp_idx" ON "router_remove_liquidity" USING btree ("block_timestamp");--> statement-breakpoint
CREATE INDEX "router_swap_timestamp_idx" ON "router_swap" USING btree ("block_timestamp");--> statement-breakpoint
CREATE INDEX "router_swap_yt_timestamp_idx" ON "router_swap_yt" USING btree ("block_timestamp");--> statement-breakpoint
CREATE INDEX "sy_deposit_timestamp_idx" ON "sy_deposit" USING btree ("block_timestamp");--> statement-breakpoint
CREATE INDEX "sy_redeem_timestamp_idx" ON "sy_redeem" USING btree ("block_timestamp");