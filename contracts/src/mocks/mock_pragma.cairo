use starknet::ContractAddress;

/// Mock Pragma Summary Stats contract for testing
/// Simulates TWAP price feeds with yield accrual over time
///
/// Supported pairs:
/// - WSTETH/USD (pair_id: 412383036120118613857092)
/// - SSTRK/USD (pair_id: 1537084272803954643780)
///
/// The mock calculates prices as:
///   price = base_price * (1 + annual_yield_rate * time_elapsed / SECONDS_PER_YEAR)
///
/// This simulates yield-bearing assets appreciating over time.

/// DataType enum matching Pragma's interface
#[derive(Drop, Copy, Serde, starknet::Store, Default)]
pub enum DataType {
    #[default]
    SpotEntry: felt252,
    FutureEntry: (felt252, u64),
}

/// AggregationMode enum matching Pragma's interface
#[derive(Drop, Copy, Serde)]
pub enum AggregationMode {
    Median,
    Mean,
    Error,
}

/// Known pair IDs (felt252 representations)
pub const WSTETH_USD_PAIR_ID: felt252 = 412383036120118613857092;
pub const SSTRK_USD_PAIR_ID: felt252 = 1537084272803954643780;

/// Time constants
const SECONDS_PER_YEAR: u64 = 31536000; // 365 days

/// Price decimals (Pragma uses 8 decimals)
const PRICE_DECIMALS: u32 = 8;
const PRICE_MULTIPLIER: u128 = 100000000; // 10^8

#[starknet::interface]
pub trait IMockPragmaSummaryStats<TContractState> {
    /// Calculate TWAP (Time Weighted Average Price)
    /// Returns (price, decimals) where real_price = price / 10^decimals
    fn calculate_twap(
        self: @TContractState,
        data_type: DataType,
        aggregation_mode: AggregationMode,
        time: u64,
        start_time: u64,
    ) -> (u128, u32);

    /// Get the oracle address (for compatibility)
    fn get_oracle_address(self: @TContractState) -> ContractAddress;

    // Admin functions for testing
    fn set_base_price(ref self: TContractState, pair_id: felt252, price: u128);
    fn set_annual_yield_rate_bps(ref self: TContractState, pair_id: felt252, rate_bps: u32);
    fn get_base_price(self: @TContractState, pair_id: felt252) -> u128;
    fn get_annual_yield_rate_bps(self: @TContractState, pair_id: felt252) -> u32;
    fn get_deployment_timestamp(self: @TContractState) -> u64;
    fn admin(self: @TContractState) -> ContractAddress;
}

#[starknet::contract]
pub mod MockPragmaSummaryStats {
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };
    use starknet::{ContractAddress, get_block_timestamp, get_caller_address};
    use super::{
        AggregationMode, DataType, IMockPragmaSummaryStats, PRICE_DECIMALS, SECONDS_PER_YEAR,
        SSTRK_USD_PAIR_ID, WSTETH_USD_PAIR_ID,
    };

    #[storage]
    struct Storage {
        // Deployment timestamp for yield calculation baseline
        deployment_timestamp: u64,
        // Base prices for each pair (in 8 decimals)
        base_prices: Map<felt252, u128>,
        // Annual yield rate in basis points (e.g., 500 = 5% APR)
        annual_yield_rate_bps: Map<felt252, u32>,
        // Admin address for test controls
        admin: ContractAddress,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        BasePriceUpdated: BasePriceUpdated,
        YieldRateUpdated: YieldRateUpdated,
    }

    #[derive(Drop, starknet::Event)]
    pub struct BasePriceUpdated {
        pub pair_id: felt252,
        pub old_price: u128,
        pub new_price: u128,
    }

    #[derive(Drop, starknet::Event)]
    pub struct YieldRateUpdated {
        pub pair_id: felt252,
        pub old_rate_bps: u32,
        pub new_rate_bps: u32,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        admin: ContractAddress,
        wsteth_base_price: u128, // e.g., 400000000000 = $4000 with 8 decimals
        sstrk_base_price: u128, // e.g., 50000000 = $0.50 with 8 decimals
        wsteth_yield_bps: u32, // e.g., 400 = 4% APR
        sstrk_yield_bps: u32 // e.g., 800 = 8% APR
    ) {
        self.deployment_timestamp.write(get_block_timestamp());
        self.admin.write(admin);

        // Set initial base prices
        self.base_prices.write(WSTETH_USD_PAIR_ID, wsteth_base_price);
        self.base_prices.write(SSTRK_USD_PAIR_ID, sstrk_base_price);

        // Set initial yield rates
        self.annual_yield_rate_bps.write(WSTETH_USD_PAIR_ID, wsteth_yield_bps);
        self.annual_yield_rate_bps.write(SSTRK_USD_PAIR_ID, sstrk_yield_bps);
    }

    #[abi(embed_v0)]
    impl MockPragmaSummaryStatsImpl of IMockPragmaSummaryStats<ContractState> {
        /// Calculate TWAP with simulated yield accrual
        ///
        /// The price increases linearly based on time elapsed since deployment:
        /// current_price = base_price * (1 + yield_rate * time_elapsed / year)
        ///
        /// For a more realistic simulation, we calculate the average price over
        /// the requested time window [start_time, start_time + time]
        fn calculate_twap(
            self: @ContractState,
            data_type: DataType,
            aggregation_mode: AggregationMode,
            time: u64,
            start_time: u64,
        ) -> (u128, u32) {
            // Extract pair_id from data_type
            let pair_id = match data_type {
                DataType::SpotEntry(id) => id,
                DataType::FutureEntry((id, _)) => id,
            };

            let base_price = self.base_prices.read(pair_id);
            assert(base_price > 0, 'MPSS: unknown pair');

            let yield_rate_bps = self.annual_yield_rate_bps.read(pair_id);
            let deployment_ts = self.deployment_timestamp.read();

            // Calculate the midpoint of the time window for TWAP approximation
            let _end_time = start_time + time;
            let midpoint = start_time + (time / 2);

            // Time elapsed from deployment to midpoint
            let time_elapsed = if midpoint > deployment_ts {
                midpoint - deployment_ts
            } else {
                0
            };

            // Calculate price with yield accrual
            // price = base_price * (1 + yield_rate_bps / 10000 * time_elapsed / SECONDS_PER_YEAR)
            // To avoid overflow and maintain precision:
            // price = base_price + base_price * yield_rate_bps * time_elapsed / (10000 *
            // SECONDS_PER_YEAR)

            let yield_accrual = if yield_rate_bps > 0 && time_elapsed > 0 {
                // Calculate: base_price * yield_rate_bps * time_elapsed / (10000 * 31536000)
                // We need to be careful about overflow, so we'll rearrange:
                // = (base_price * time_elapsed / SECONDS_PER_YEAR) * yield_rate_bps / 10000

                let time_elapsed_u256: u256 = time_elapsed.into();
                let base_u256: u256 = base_price.into();
                let yield_bps_u256: u256 = yield_rate_bps.into();
                let seconds_per_year_u256: u256 = SECONDS_PER_YEAR.into();

                // Calculate yield: base * rate * time / (10000 * year)
                let numerator: u256 = base_u256 * yield_bps_u256 * time_elapsed_u256;
                let denominator: u256 = 10000_u256 * seconds_per_year_u256;
                let yield_u256: u256 = numerator / denominator;

                // Safe to convert back since yield should be << base_price
                let yield_u128: u128 = yield_u256.try_into().expect('yield overflow');
                yield_u128
            } else {
                0
            };

            let current_price = base_price + yield_accrual;

            (current_price, PRICE_DECIMALS)
        }

        /// Get oracle address (returns zero for mock)
        fn get_oracle_address(self: @ContractState) -> ContractAddress {
            0.try_into().unwrap()
        }

        /// Set base price for a pair (admin only)
        fn set_base_price(ref self: ContractState, pair_id: felt252, price: u128) {
            self.assert_admin();
            let old_price = self.base_prices.read(pair_id);
            self.base_prices.write(pair_id, price);
            self.emit(BasePriceUpdated { pair_id, old_price, new_price: price });
        }

        /// Set annual yield rate in basis points (admin only)
        fn set_annual_yield_rate_bps(ref self: ContractState, pair_id: felt252, rate_bps: u32) {
            self.assert_admin();
            let old_rate = self.annual_yield_rate_bps.read(pair_id);
            self.annual_yield_rate_bps.write(pair_id, rate_bps);
            self.emit(YieldRateUpdated { pair_id, old_rate_bps: old_rate, new_rate_bps: rate_bps });
        }

        /// Get base price for a pair
        fn get_base_price(self: @ContractState, pair_id: felt252) -> u128 {
            self.base_prices.read(pair_id)
        }

        /// Get annual yield rate in basis points
        fn get_annual_yield_rate_bps(self: @ContractState, pair_id: felt252) -> u32 {
            self.annual_yield_rate_bps.read(pair_id)
        }

        /// Get deployment timestamp
        fn get_deployment_timestamp(self: @ContractState) -> u64 {
            self.deployment_timestamp.read()
        }

        /// Get admin address
        fn admin(self: @ContractState) -> ContractAddress {
            self.admin.read()
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn assert_admin(self: @ContractState) {
            let caller = get_caller_address();
            assert(caller == self.admin.read(), 'MPSS: not admin');
        }
    }
}

/// Full interface matching Pragma's ISummaryStatsABI for compatibility
/// Only implements the functions we need; others will panic
#[starknet::interface]
pub trait ISummaryStatsABI<TContractState> {
    fn calculate_mean(
        self: @TContractState,
        data_type: DataType,
        start: u64,
        stop: u64,
        aggregation_mode: AggregationMode,
    ) -> (u128, u32);

    fn calculate_volatility(
        self: @TContractState,
        data_type: DataType,
        start_tick: u64,
        end_tick: u64,
        num_samples: u64,
        aggregation_mode: AggregationMode,
    ) -> (u128, u32);

    fn calculate_twap(
        self: @TContractState,
        data_type: DataType,
        aggregation_mode: AggregationMode,
        time: u64,
        start_time: u64,
    ) -> (u128, u32);

    fn get_oracle_address(self: @TContractState) -> ContractAddress;
}
