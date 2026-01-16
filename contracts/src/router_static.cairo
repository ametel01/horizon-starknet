/// RouterStatic Contract
/// Read-only contract providing preview functions for frontend quotes.
/// All functions are view-only (no state changes) and do not require token transfers.
///
/// This contract mirrors the market math calculations but without executing actual trades,
/// making it suitable for frontend quote previews and UI display.
#[starknet::contract]
pub mod RouterStatic {
    use core::num::traits::Zero;
    use horizon::interfaces::i_market::{IMarketDispatcher, IMarketDispatcherTrait};
    use horizon::interfaces::i_router_static::{IRouterStatic, MarketInfo, TokenToSyEstimate};
    use horizon::interfaces::i_yt::{IYTDispatcher, IYTDispatcherTrait};
    use horizon::libraries::errors::Errors;
    use horizon::libraries::math_fp::{wad_div, wad_mul};
    use horizon::market::market_math_fp::{
        MarketState, calc_burn_lp, calc_mint_lp, calc_swap_exact_pt_for_sy,
        calc_swap_exact_sy_for_pt, get_ln_implied_rate, get_pt_price, get_time_to_expiry,
    };
    use starknet::{ContractAddress, get_block_timestamp};

    #[storage]
    struct Storage {}

    #[constructor]
    fn constructor(ref self: ContractState) { // Stateless contract - no initialization needed
    }

    #[abi(embed_v0)]
    impl RouterStaticImpl of IRouterStatic<ContractState> {
        /// Get the current PT/SY exchange rate from a market
        /// This is the instantaneous rate at which PT trades for SY
        /// @param market The market address to query
        /// @return Exchange rate in WAD (1e18 = 1:1)
        fn get_pt_to_sy_rate(self: @ContractState, market: ContractAddress) -> u256 {
            assert(!market.is_zero(), Errors::ZERO_ADDRESS);

            let market_contract = IMarketDispatcher { contract_address: market };
            let state = self._get_market_state_view(market);
            let time_to_expiry = get_time_to_expiry(
                market_contract.expiry(), get_block_timestamp(),
            );

            // Get the ln(implied rate) and compute PT price
            let ln_implied_rate = get_ln_implied_rate(@state, time_to_expiry);
            get_pt_price(ln_implied_rate, time_to_expiry)
        }

        /// Get the LP token value in SY terms
        /// This calculates how much SY + PT (converted to SY equivalent) each LP token represents
        /// @param market The market address to query
        /// @return LP value in SY terms (WAD scaled)
        fn get_lp_to_sy_rate(self: @ContractState, market: ContractAddress) -> u256 {
            assert(!market.is_zero(), Errors::ZERO_ADDRESS);

            let market_contract = IMarketDispatcher { contract_address: market };
            let total_lp = market_contract.total_lp_supply();

            if total_lp == 0 {
                return 0;
            }

            let (sy_reserve, pt_reserve) = market_contract.get_reserves();
            let state = self._get_market_state_view(market);
            let time_to_expiry = get_time_to_expiry(
                market_contract.expiry(), get_block_timestamp(),
            );

            // Get PT price in SY terms
            let ln_implied_rate = get_ln_implied_rate(@state, time_to_expiry);
            let pt_price = get_pt_price(ln_implied_rate, time_to_expiry);

            // Total value in SY = sy_reserve + pt_reserve * pt_price
            let pt_value_in_sy = wad_mul(pt_reserve, pt_price);
            let total_value = sy_reserve + pt_value_in_sy;

            // LP value = total_value / total_lp
            wad_div(total_value, total_lp)
        }

        /// Get the LP token value in PT terms
        /// This calculates how much PT each LP token represents when all value is converted to PT
        /// @param market The market address to query
        /// @return LP value in PT terms (WAD scaled)
        fn get_lp_to_pt_rate(self: @ContractState, market: ContractAddress) -> u256 {
            assert(!market.is_zero(), Errors::ZERO_ADDRESS);

            let market_contract = IMarketDispatcher { contract_address: market };
            let total_lp = market_contract.total_lp_supply();

            if total_lp == 0 {
                return 0;
            }

            let (sy_reserve, pt_reserve) = market_contract.get_reserves();
            let state = self._get_market_state_view(market);
            let time_to_expiry = get_time_to_expiry(
                market_contract.expiry(), get_block_timestamp(),
            );

            // Get PT price in SY terms
            let ln_implied_rate = get_ln_implied_rate(@state, time_to_expiry);
            let pt_price = get_pt_price(ln_implied_rate, time_to_expiry);

            // Avoid division by zero if pt_price is 0
            if pt_price == 0 {
                return 0;
            }

            // Convert SY to PT equivalent: sy_in_pt = sy_reserve / pt_price
            let sy_value_in_pt = wad_div(sy_reserve, pt_price);

            // Total value in PT = pt_reserve + sy_value_in_pt
            let total_value = pt_reserve + sy_value_in_pt;

            // LP value in PT = total_value / total_lp
            wad_div(total_value, total_lp)
        }

        /// Preview the PT output for an exact SY input swap
        /// @param market The market address
        /// @param sy_in Amount of SY to swap
        /// @return Expected PT output (before slippage, includes fees)
        fn preview_swap_exact_sy_for_pt(
            self: @ContractState, market: ContractAddress, sy_in: u256,
        ) -> u256 {
            assert(!market.is_zero(), Errors::ZERO_ADDRESS);

            if sy_in == 0 {
                return 0;
            }

            let market_contract = IMarketDispatcher { contract_address: market };

            // Check market not expired
            assert(!market_contract.is_expired(), Errors::MARKET_EXPIRED);

            let state = self._get_market_state_view(market);
            let time_to_expiry = get_time_to_expiry(
                market_contract.expiry(), get_block_timestamp(),
            );

            // Calculate swap output
            let (pt_out, _result) = calc_swap_exact_sy_for_pt(@state, sy_in, time_to_expiry);
            pt_out
        }

        /// Preview the SY output for an exact PT input swap
        /// @param market The market address
        /// @param pt_in Amount of PT to swap
        /// @return Expected SY output (before slippage, includes fees)
        fn preview_swap_exact_pt_for_sy(
            self: @ContractState, market: ContractAddress, pt_in: u256,
        ) -> u256 {
            assert(!market.is_zero(), Errors::ZERO_ADDRESS);

            if pt_in == 0 {
                return 0;
            }

            let market_contract = IMarketDispatcher { contract_address: market };

            // Check market not expired
            assert(!market_contract.is_expired(), Errors::MARKET_EXPIRED);

            let state = self._get_market_state_view(market);
            let time_to_expiry = get_time_to_expiry(
                market_contract.expiry(), get_block_timestamp(),
            );

            // Calculate swap output
            let result = calc_swap_exact_pt_for_sy(@state, pt_in, time_to_expiry);
            result.net_sy_to_account
        }

        /// Preview LP output for adding liquidity with only SY
        /// This simulates the add_liquidity_single_sy flow:
        /// 1. Swap some SY for PT to get the right ratio
        /// 2. Add liquidity with remaining SY + received PT
        /// @param market The market address
        /// @param sy_in Total amount of SY to use
        /// @return Expected LP tokens to receive
        fn preview_add_liquidity_single_sy(
            self: @ContractState, market: ContractAddress, sy_in: u256,
        ) -> u256 {
            assert(!market.is_zero(), Errors::ZERO_ADDRESS);

            if sy_in == 0 {
                return 0;
            }

            let market_contract = IMarketDispatcher { contract_address: market };

            // Check market not expired
            assert(!market_contract.is_expired(), Errors::MARKET_EXPIRED);

            let state = self._get_market_state_view(market);
            let time_to_expiry = get_time_to_expiry(
                market_contract.expiry(), get_block_timestamp(),
            );

            let (reserves_sy, reserves_pt) = market_contract.get_reserves();

            // Handle empty pool case - cannot add single-sided liquidity to empty pool
            // (no swap possible without existing reserves)
            if reserves_sy == 0 || reserves_pt == 0 {
                return 0;
            }

            // Calculate optimal SY amount to swap for PT
            let optimal_sy_to_swap = self
                ._calc_optimal_swap_for_lp(sy_in, reserves_sy, reserves_pt);

            if optimal_sy_to_swap >= sy_in {
                return 0;
            }

            // Preview the swap
            let (pt_received, _) = calc_swap_exact_sy_for_pt(
                @state, optimal_sy_to_swap, time_to_expiry,
            );

            let sy_for_lp = sy_in - optimal_sy_to_swap;

            // Calculate LP tokens from remaining SY + received PT
            let (lp_to_mint, _sy_used, _pt_used, _is_first) = calc_mint_lp(
                @state, sy_for_lp, pt_received,
            );

            lp_to_mint
        }

        /// Preview SY output for removing liquidity to single SY
        /// This simulates the remove_liquidity_single_sy flow:
        /// 1. Burn LP to get SY + PT
        /// 2. Swap all PT for SY
        /// @param market The market address
        /// @param lp_in Amount of LP tokens to burn
        /// @return Expected SY output
        fn preview_remove_liquidity_single_sy(
            self: @ContractState, market: ContractAddress, lp_in: u256,
        ) -> u256 {
            assert(!market.is_zero(), Errors::ZERO_ADDRESS);

            if lp_in == 0 {
                return 0;
            }

            let market_contract = IMarketDispatcher { contract_address: market };
            let state = self._get_market_state_view(market);
            let time_to_expiry = get_time_to_expiry(
                market_contract.expiry(), get_block_timestamp(),
            );

            // Calculate tokens received from burning LP
            let (sy_from_burn, pt_from_burn) = calc_burn_lp(@state, lp_in);

            // If market is expired, PT can be redeemed 1:1 for SY
            if market_contract.is_expired() {
                return sy_from_burn + pt_from_burn;
            }

            // If no PT from burn, just return SY
            if pt_from_burn == 0 {
                return sy_from_burn;
            }

            // Create state after LP burn for PT swap simulation
            // Note: We need to adjust reserves to reflect the LP burn
            let adjusted_state = MarketState {
                sy_reserve: state.sy_reserve - sy_from_burn,
                pt_reserve: state.pt_reserve - pt_from_burn,
                total_lp: state.total_lp - lp_in,
                scalar_root: state.scalar_root,
                initial_anchor: state.initial_anchor,
                ln_fee_rate_root: state.ln_fee_rate_root,
                reserve_fee_percent: state.reserve_fee_percent,
                expiry: state.expiry,
                last_ln_implied_rate: state.last_ln_implied_rate,
                py_index: state.py_index,
                rate_impact_sensitivity: state.rate_impact_sensitivity,
            };

            // Check there's enough liquidity for the swap
            if adjusted_state.sy_reserve == 0 || adjusted_state.pt_reserve == 0 {
                return sy_from_burn;
            }

            // Preview swapping PT for SY
            let result = calc_swap_exact_pt_for_sy(@adjusted_state, pt_from_burn, time_to_expiry);
            let sy_from_swap = result.net_sy_to_account;

            sy_from_burn + sy_from_swap
        }

        /// Get comprehensive market state for frontend display
        /// @param market The market address
        /// @return MarketInfo struct with all relevant market data
        fn get_market_info(self: @ContractState, market: ContractAddress) -> MarketInfo {
            assert(!market.is_zero(), Errors::ZERO_ADDRESS);

            let market_contract = IMarketDispatcher { contract_address: market };
            let state = self._get_market_state_view(market);
            let current_time = get_block_timestamp();
            let expiry = market_contract.expiry();
            let time_to_expiry = get_time_to_expiry(expiry, current_time);

            let (sy_reserve, pt_reserve) = market_contract.get_reserves();
            let total_lp = market_contract.total_lp_supply();

            let ln_implied_rate = get_ln_implied_rate(@state, time_to_expiry);
            let pt_price = get_pt_price(ln_implied_rate, time_to_expiry);

            // Calculate LP value
            let lp_to_sy_rate = if total_lp == 0 {
                0
            } else {
                let pt_value_in_sy = wad_mul(pt_reserve, pt_price);
                let total_value = sy_reserve + pt_value_in_sy;
                wad_div(total_value, total_lp)
            };

            MarketInfo {
                sy: market_contract.sy(),
                pt: market_contract.pt(),
                yt: market_contract.yt(),
                expiry,
                is_expired: current_time >= expiry,
                sy_reserve,
                pt_reserve,
                total_lp,
                ln_implied_rate,
                pt_to_sy_rate: pt_price,
                lp_to_sy_rate,
                scalar_root: market_contract.get_scalar_root(),
                ln_fee_rate_root: market_contract.get_ln_fee_rate_root(),
            }
        }

        /// Preview PT output for swapping any token to PT via aggregator
        /// The frontend provides pre-calculated SY estimate since aggregators
        /// cannot be called in view context.
        /// @param market The market address for PT/SY swaps
        /// @param estimate Token input with pre-calculated SY estimate
        /// @return Expected PT output
        fn preview_swap_exact_token_for_pt(
            self: @ContractState, market: ContractAddress, estimate: TokenToSyEstimate,
        ) -> u256 {
            assert(!market.is_zero(), Errors::ZERO_ADDRESS);
            assert(!estimate.token.is_zero(), Errors::ZERO_ADDRESS);

            // If no input amount or SY estimate provided, return 0
            if estimate.amount == 0 || estimate.estimated_sy_amount == 0 {
                return 0;
            }

            // Delegate to preview_swap_exact_sy_for_pt with the estimated SY amount
            self.preview_swap_exact_sy_for_pt(market, estimate.estimated_sy_amount)
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        /// Build market state from storage (read-only version)
        /// Uses py_index_current() to avoid side effects
        fn _get_market_state_view(self: @ContractState, market: ContractAddress) -> MarketState {
            let market_contract = IMarketDispatcher { contract_address: market };

            // Get YT contract for py_index
            let yt = market_contract.yt();
            let yt_contract = IYTDispatcher { contract_address: yt };
            let py_index = yt_contract.py_index_current();

            let (sy_reserve, pt_reserve) = market_contract.get_reserves();

            MarketState {
                sy_reserve,
                pt_reserve,
                total_lp: market_contract.total_lp_supply(),
                scalar_root: market_contract.get_scalar_root(),
                initial_anchor: market_contract.get_initial_anchor(),
                ln_fee_rate_root: market_contract.get_ln_fee_rate_root(),
                reserve_fee_percent: market_contract.get_reserve_fee_percent(),
                expiry: market_contract.expiry(),
                last_ln_implied_rate: market_contract.get_ln_implied_rate(),
                py_index,
                rate_impact_sensitivity: 0 // Not used for view functions
            }
        }

        /// Calculate optimal SY amount to swap for PT before adding liquidity
        /// Uses binary search to find swap amount that fully utilizes all tokens
        fn _calc_optimal_swap_for_lp(
            self: @ContractState, amount_sy_total: u256, reserves_sy: u256, reserves_pt: u256,
        ) -> u256 {
            // Edge case: empty pool, just swap half
            if reserves_sy == 0 || reserves_pt == 0 {
                return amount_sy_total / 2;
            }

            // Edge case: very small amount, just swap half to avoid precision issues
            if amount_sy_total <= 1 {
                return amount_sy_total / 2;
            }

            // Binary search for optimal swap amount
            let mut low: u256 = 0;
            let mut high: u256 = amount_sy_total;
            let max_iterations: u32 = 20;
            let mut iteration: u32 = 0;

            while iteration < max_iterations && high > low + 1 {
                let mid = (low + high) / 2;

                if mid == low {
                    break;
                }

                // Simulate swap using constant product approximation
                let pt_out = self._estimate_swap_sy_for_pt(mid, reserves_sy, reserves_pt);

                if pt_out == 0 {
                    if mid > low {
                        low = mid;
                    }
                    iteration += 1;
                    continue;
                }

                let sy_remaining = amount_sy_total - mid;

                if sy_remaining == 0 {
                    high = mid;
                    iteration += 1;
                    continue;
                }

                // Check if this ratio matches pool ratio
                let left = sy_remaining * reserves_pt;
                let right = pt_out * reserves_sy;

                if left < right {
                    high = mid;
                } else {
                    low = mid;
                }

                iteration += 1;
            }

            low
        }

        /// Estimate PT received from swapping exact SY (constant product approximation)
        fn _estimate_swap_sy_for_pt(
            self: @ContractState, sy_in: u256, reserves_sy: u256, reserves_pt: u256,
        ) -> u256 {
            if sy_in == 0 {
                return 0;
            }

            let denominator = reserves_sy + sy_in;
            let numerator = reserves_pt * sy_in;
            numerator / denominator
        }
    }
}
