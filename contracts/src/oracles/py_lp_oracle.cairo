/// PT/YT/LP Oracle Helper Contract
///
/// Provides Pendle-style TWAP oracle functionality for pricing PT, YT, and LP tokens.
/// This contract queries the Market's observation buffer to calculate manipulation-resistant
/// prices using Time-Weighted Average Price (TWAP) of ln(implied rate).
///
/// Key formulas:
/// - PT to SY: exp(-ln_rate_twap * time_to_expiry / SECONDS_PER_YEAR)
/// - YT to SY: WAD - PT_to_SY (before expiry), 0 (after expiry)
/// - LP to SY: (SY_reserve + PT_reserve * PT_to_SY) / total_LP
/// - LP to Asset: (SY_reserve + PT_reserve * PT_to_Asset) / total_LP (Pendle exact formula)
///
/// For PT/YT asset-denominated rates, we adjust by the SY exchange rate and handle
/// index discrepancies per Pendle's formula. LP to Asset uses Pendle's direct approach.
///
/// Reference: Pendle's PendlePYOracleLib.sol and PendleLpOracleLib.sol

#[starknet::contract]
pub mod PyLpOracle {
    use horizon::interfaces::i_market::{
        IMarketDispatcher, IMarketDispatcherTrait, IMarketOracleDispatcher,
        IMarketOracleDispatcherTrait,
    };
    use horizon::interfaces::i_py_lp_oracle::{IPyLpOracle, OracleReadinessState};
    use horizon::interfaces::i_sy::{ISYDispatcher, ISYDispatcherTrait};
    use horizon::interfaces::i_yt::{IYTDispatcher, IYTDispatcherTrait};
    use horizon::libraries::math_fp::{WAD, exp_neg_wad, wad_div, wad_mul};
    use horizon::market::market_math_fp::SECONDS_PER_YEAR;
    use starknet::{ContractAddress, get_block_timestamp};

    /// Minimum block time assumption for cardinality calculation (10 seconds).
    /// Starknet typically has ~20s blocks, but we use a conservative estimate.
    /// This matches Pendle's blockCycleNumerator / denominator approach.
    const MIN_BLOCK_TIME: u64 = 10;

    #[storage]
    struct Storage {}

    #[constructor]
    fn constructor(ref self: ContractState) { // Stateless oracle - no initialization needed
    }

    #[abi(embed_v0)]
    impl PyLpOracleImpl of IPyLpOracle<ContractState> {
        /// Get PT price in SY terms using TWAP.
        /// Formula: PT_price = exp(-ln_rate_twap * time_to_expiry / SECONDS_PER_YEAR)
        fn get_pt_to_sy_rate(self: @ContractState, market: ContractAddress, duration: u32) -> u256 {
            let market_contract = IMarketDispatcher { contract_address: market };
            let expiry = market_contract.expiry();
            let current_time = get_block_timestamp();

            // After expiry, PT = 1 SY (redeemable 1:1)
            if current_time >= expiry {
                return WAD;
            }

            let time_to_expiry = expiry - current_time;
            let ln_rate = self.get_ln_implied_rate_twap(market, duration);

            // PT_price = exp(-ln_rate * time_to_expiry / SECONDS_PER_YEAR)
            self._get_pt_price_from_ln_rate(ln_rate, time_to_expiry)
        }

        /// Get YT price in SY terms using TWAP.
        /// Before expiry: YT_price = WAD - PT_price (since PT + YT = 1 SY worth of principal)
        /// After expiry: YT_price = 0 (no more yield to accrue)
        fn get_yt_to_sy_rate(self: @ContractState, market: ContractAddress, duration: u32) -> u256 {
            let market_contract = IMarketDispatcher { contract_address: market };
            let expiry = market_contract.expiry();
            let current_time = get_block_timestamp();

            // After expiry, YT is worthless
            if current_time >= expiry {
                return 0;
            }

            let pt_rate = self.get_pt_to_sy_rate(market, duration);

            // YT + PT = 1 SY (in principal terms)
            if pt_rate >= WAD {
                return 0;
            }

            WAD - pt_rate
        }

        /// Get LP token price in SY terms using TWAP.
        /// LP value = (SY_reserve + PT_reserve * PT_price_in_SY) / total_LP
        ///
        /// This calculates the value of LP tokens based on the underlying reserves.
        fn get_lp_to_sy_rate(self: @ContractState, market: ContractAddress, duration: u32) -> u256 {
            let market_contract = IMarketDispatcher { contract_address: market };
            let (sy_reserve, pt_reserve) = market_contract.get_reserves();
            let total_lp = market_contract.total_lp_supply();

            if total_lp == 0 {
                return WAD; // Default to 1:1 for empty pool
            }

            // Get PT price in SY terms
            let pt_to_sy = self.get_pt_to_sy_rate(market, duration);

            // Total value in SY terms = SY_reserve + PT_reserve * PT_price
            let pt_value_in_sy = wad_mul(pt_reserve, pt_to_sy);
            let total_value_in_sy = sy_reserve + pt_value_in_sy;

            // LP price = total_value / total_lp
            wad_div(total_value_in_sy, total_lp)
        }

        /// Get PT price in underlying asset terms using TWAP.
        /// Adjusts for the SY/asset exchange rate.
        ///
        /// Pendle formula:
        /// If sy_index >= py_index: asset_rate = pt_to_sy * sy_index / WAD
        /// Else: asset_rate = pt_to_sy * sy_index / py_index (haircut for negative yield)
        fn get_pt_to_asset_rate(
            self: @ContractState, market: ContractAddress, duration: u32,
        ) -> u256 {
            let pt_to_sy = self.get_pt_to_sy_rate(market, duration);
            self._apply_sy_to_asset_rate(market, pt_to_sy)
        }

        /// Get YT price in underlying asset terms using TWAP.
        fn get_yt_to_asset_rate(
            self: @ContractState, market: ContractAddress, duration: u32,
        ) -> u256 {
            let yt_to_sy = self.get_yt_to_sy_rate(market, duration);
            self._apply_sy_to_asset_rate(market, yt_to_sy)
        }

        /// Get LP token price in underlying asset terms using TWAP.
        ///
        /// Computes LP value in SY terms first, then converts to asset terms
        /// using the SY exchange rate. This correctly values both SY and PT
        /// reserves in asset-denominated units.
        ///
        /// Formula: lp_to_asset = lp_to_sy * sy_to_asset_rate
        fn get_lp_to_asset_rate(
            self: @ContractState, market: ContractAddress, duration: u32,
        ) -> u256 {
            let lp_to_sy = self.get_lp_to_sy_rate(market, duration);
            self._apply_sy_to_asset_rate(market, lp_to_sy)
        }

        /// Check if the oracle has sufficient history for the requested duration.
        ///
        /// This implements Pendle's oracle readiness check:
        /// 1. Calculate required cardinality: (duration / min_block_time) + 1
        /// 2. Check if current cardinality is sufficient
        /// 3. Check if oldest observation is old enough
        fn check_oracle_state(
            self: @ContractState, market: ContractAddress, duration: u32,
        ) -> OracleReadinessState {
            let market_oracle = IMarketOracleDispatcher { contract_address: market };
            let oracle_state = market_oracle.get_oracle_state();

            // Calculate required cardinality using Pendle's formula
            // cardinality_required = (duration * 1000 + block_cycle_numerator - 1) /
            // block_cycle_numerator + 1
            // Simplified: (duration / min_block_time) + 1
            let duration_u64: u64 = duration.into();
            let observations_needed: u16 = if duration_u64 <= MIN_BLOCK_TIME {
                2 // Minimum 2 observations for any TWAP
            } else {
                let n = duration_u64 / MIN_BLOCK_TIME;
                // Cap to u16 max and add 1 for safety
                let capped: u16 = if n > 0xFFFE_u64 {
                    0xFFFF_u16
                } else {
                    (n + 1).try_into().unwrap()
                };
                capped
            };

            let cardinality_required = observations_needed;
            let increase_cardinality_required = oracle_state
                .observation_cardinality_next < cardinality_required;

            // Check if oldest observation is old enough
            // Get oldest observation timestamp
            let oldest_observation_satisfied = if oracle_state.observation_cardinality == 0 {
                false
            } else {
                let oldest_idx = self
                    ._get_oldest_observation_index(
                        market_oracle,
                        oracle_state.observation_index,
                        oracle_state.observation_cardinality,
                    );
                let (oldest_ts, _, _) = market_oracle.get_observation(oldest_idx);
                let current_time = get_block_timestamp();

                // Oldest observation must be at least `duration` seconds old
                if current_time < oldest_ts {
                    false
                } else {
                    (current_time - oldest_ts) >= duration_u64
                }
            };

            OracleReadinessState {
                increase_cardinality_required, cardinality_required, oldest_observation_satisfied,
            }
        }

        /// Get the TWAP ln(implied rate) for a given duration.
        ///
        /// If duration == 0: returns the spot rate from storage (last_ln_implied_rate)
        /// If duration > 0: calculates TWAP = (cumulative_now - cumulative_past) / duration
        fn get_ln_implied_rate_twap(
            self: @ContractState, market: ContractAddress, duration: u32,
        ) -> u256 {
            let market_oracle = IMarketOracleDispatcher { contract_address: market };

            if duration == 0 {
                // Use spot rate from storage
                let oracle_state = market_oracle.get_oracle_state();
                return oracle_state.last_ln_implied_rate;
            }

            // Query cumulative values at [duration, 0]
            let mut seconds_agos: Array<u32> = ArrayTrait::new();
            seconds_agos.append(duration);
            seconds_agos.append(0);

            let cumulatives = market_oracle.observe(seconds_agos);

            // TWAP = (cumulative_now - cumulative_past) / duration
            let cumulative_past = *cumulatives.at(0);
            let cumulative_now = *cumulatives.at(1);

            // Handle edge case where cumulative hasn't changed
            if cumulative_now <= cumulative_past {
                return 0;
            }

            let delta = cumulative_now - cumulative_past;
            let duration_u256: u256 = duration.into();

            delta / duration_u256
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        /// Calculate PT price from ln(implied rate) and time to expiry.
        /// PT_price = exp(-ln_rate * time_to_expiry / SECONDS_PER_YEAR)
        fn _get_pt_price_from_ln_rate(
            self: @ContractState, ln_rate: u256, time_to_expiry: u64,
        ) -> u256 {
            if time_to_expiry == 0 || ln_rate == 0 {
                return WAD; // At expiry or zero rate, PT = 1 SY
            }

            // exponent = ln_rate * time_to_expiry / SECONDS_PER_YEAR
            let time_in_years_wad = wad_div(time_to_expiry.into() * WAD, SECONDS_PER_YEAR * WAD);
            let exponent = wad_mul(ln_rate, time_in_years_wad);

            // PT_price = exp(-exponent)
            exp_neg_wad(exponent)
        }

        /// Apply SY to asset rate conversion.
        /// Handles the Pendle-style adjustment for index discrepancies.
        ///
        /// If sy_index >= py_index: rate_in_asset = rate_in_sy * sy_index / WAD
        /// Else: rate_in_asset = rate_in_sy * sy_index / py_index
        fn _apply_sy_to_asset_rate(
            self: @ContractState, market: ContractAddress, rate_in_sy: u256,
        ) -> u256 {
            let market_contract = IMarketDispatcher { contract_address: market };
            let sy_addr = market_contract.sy();
            let yt_addr = market_contract.yt();

            let sy_contract = ISYDispatcher { contract_address: sy_addr };
            let yt_contract = IYTDispatcher { contract_address: yt_addr };

            let sy_index = sy_contract.exchange_rate();
            let py_index = yt_contract.py_index_current();

            // Pendle's formula for handling index discrepancy:
            // If sy_index >= py_index (normal case): multiply by sy_index
            // If sy_index < py_index (negative yield): scale down by ratio
            if sy_index >= py_index {
                // Normal case: rate_in_asset = rate_in_sy * sy_index / WAD
                wad_mul(rate_in_sy, sy_index)
            } else {
                // Negative yield protection: rate_in_asset = rate_in_sy * sy_index / py_index
                wad_div(wad_mul(rate_in_sy, sy_index), py_index)
            }
        }

        /// Get the index of the oldest observation in the ring buffer.
        fn _get_oldest_observation_index(
            self: @ContractState,
            market_oracle: IMarketOracleDispatcher,
            current_index: u16,
            cardinality: u16,
        ) -> u16 {
            if cardinality == 0 {
                return 0;
            }

            // Candidate for oldest is (current_index + 1) % cardinality
            let candidate = (current_index + 1) % cardinality;

            // Check if candidate is initialized
            let (_, _, initialized) = market_oracle.get_observation(candidate);

            if initialized {
                candidate
            } else {
                // Buffer hasn't wrapped yet - oldest is at slot 0
                0
            }
        }
    }
}
