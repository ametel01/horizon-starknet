use starknet::ContractAddress;

/// Admin interface for PragmaIndexOracle
#[starknet::interface]
pub trait IPragmaIndexOracleAdmin<TContractState> {
    /// Update the stored index from oracle (call periodically to persist watermark)
    fn update_index(ref self: TContractState) -> u256;
    /// Update TWAP window and staleness parameters (OPERATOR_ROLE)
    fn set_config(ref self: TContractState, twap_window: u64, max_staleness: u64);
    /// Pause the oracle (returns stored index instead of fetching) (PAUSER_ROLE)
    fn pause(ref self: TContractState);
    /// Unpause the oracle (PAUSER_ROLE)
    fn unpause(ref self: TContractState);
    /// Emergency index update (DEFAULT_ADMIN_ROLE only, for recovery scenarios)
    fn emergency_set_index(ref self: TContractState, new_index: u256);
    /// Initialize RBAC after upgrade (one-time setup)
    fn initialize_rbac(ref self: TContractState);

    // View functions
    fn get_pragma_oracle(self: @TContractState) -> ContractAddress;
    fn get_numerator_pair_id(self: @TContractState) -> felt252;
    fn get_denominator_pair_id(self: @TContractState) -> felt252;
    fn get_twap_window(self: @TContractState) -> u64;
    fn get_max_staleness(self: @TContractState) -> u64;
    fn get_stored_index(self: @TContractState) -> u256;
    fn get_last_update_timestamp(self: @TContractState) -> u64;
    fn is_paused(self: @TContractState) -> bool;
}

/// Generic Pragma Oracle Adapter implementing IIndexOracle
///
/// Converts Pragma TWAP price feeds to exchange rate index format.
/// Supports two modes:
/// 1. Single feed mode: Direct index from one price feed (denominator_pair_id = 0)
/// 2. Dual feed mode: Calculate ratio from two USD-denominated prices (numerator/denominator)
///
/// Example use cases:
/// - wstETH/stETH rate: Use WSTETH/USD / STETH/USD (dual feed)
/// - Direct rate feeds: Use single numerator pair with denominator_pair_id = 0
#[starknet::contract]
pub mod PragmaIndexOracle {
    use core::num::traits::Zero;
    use horizon::interfaces::i_index_oracle::IIndexOracle;
    use horizon::interfaces::i_pragma_summary_stats::{
        AggregationMode, DataType, IPragmaSummaryStatsDispatcher,
        IPragmaSummaryStatsDispatcherTrait,
    };
    use horizon::libraries::math_fp::{WAD, max};
    use horizon::libraries::roles::{DEFAULT_ADMIN_ROLE, OPERATOR_ROLE, PAUSER_ROLE};
    use openzeppelin_access::accesscontrol::AccessControlComponent;
    use openzeppelin_access::ownable::OwnableComponent;
    use openzeppelin_interfaces::upgrades::IUpgradeable;
    use openzeppelin_introspection::src5::SRC5Component;
    use openzeppelin_upgrades::UpgradeableComponent;
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use starknet::{ClassHash, ContractAddress, get_block_timestamp, get_caller_address};

    // Keep OwnableComponent for backward compatibility (existing owner can bootstrap RBAC)
    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);
    component!(path: UpgradeableComponent, storage: upgradeable, event: UpgradeableEvent);
    component!(path: SRC5Component, storage: src5, event: SRC5Event);
    component!(path: AccessControlComponent, storage: access_control, event: AccessControlEvent);

    #[abi(embed_v0)]
    impl OwnableImpl = OwnableComponent::OwnableImpl<ContractState>;
    impl OwnableInternalImpl = OwnableComponent::InternalImpl<ContractState>;
    impl UpgradeableInternalImpl = UpgradeableComponent::InternalImpl<ContractState>;

    // AccessControl - embed the full implementation for role management
    #[abi(embed_v0)]
    impl AccessControlImpl =
        AccessControlComponent::AccessControlImpl<ContractState>;
    impl AccessControlInternalImpl = AccessControlComponent::InternalImpl<ContractState>;

    // Constants
    const WAD_DECIMALS: u32 = 18;
    const DEFAULT_TWAP_WINDOW: u64 = 3600; // 1 hour
    const DEFAULT_MAX_STALENESS: u64 = 86400; // 24 hours
    const MIN_TWAP_WINDOW: u64 = 300; // 5 minutes minimum

    #[storage]
    struct Storage {
        // === EXISTING STORAGE - DO NOT MODIFY ORDER ===
        #[substorage(v0)]
        ownable: OwnableComponent::Storage,
        #[substorage(v0)]
        upgradeable: UpgradeableComponent::Storage,
        /// Pragma Summary Stats contract address
        pragma_oracle: ContractAddress,
        /// Primary pair ID (numerator in ratio calculation)
        numerator_pair_id: felt252,
        /// Secondary pair ID (denominator in ratio, 0 for single-feed mode)
        denominator_pair_id: felt252,
        /// TWAP window duration in seconds
        twap_window: u64,
        /// Maximum allowed staleness in seconds
        max_staleness: u64,
        /// Stored index (monotonic watermark)
        stored_index: u256,
        /// Last update timestamp
        last_update_timestamp: u64,
        /// Paused state for emergencies
        paused: bool,
        // === NEW STORAGE - ADDED AT END ===
        #[substorage(v0)]
        src5: SRC5Component::Storage,
        #[substorage(v0)]
        access_control: AccessControlComponent::Storage,
        // Flag to prevent RBAC re-initialization
        rbac_initialized: bool,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        IndexUpdated: IndexUpdated,
        ConfigUpdated: ConfigUpdated,
        Paused: Paused,
        Unpaused: Unpaused,
        #[flat]
        OwnableEvent: OwnableComponent::Event,
        #[flat]
        UpgradeableEvent: UpgradeableComponent::Event,
        #[flat]
        SRC5Event: SRC5Component::Event,
        #[flat]
        AccessControlEvent: AccessControlComponent::Event,
    }

    #[derive(Drop, starknet::Event)]
    pub struct IndexUpdated {
        #[key]
        pub oracle: ContractAddress,
        pub old_index: u256,
        pub new_index: u256,
        pub timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct ConfigUpdated {
        pub twap_window: u64,
        pub max_staleness: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Paused {
        #[key]
        pub by: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Unpaused {
        #[key]
        pub by: ContractAddress,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        pragma_oracle: ContractAddress,
        numerator_pair_id: felt252,
        denominator_pair_id: felt252,
        initial_index: u256,
    ) {
        // Validate inputs
        assert(!pragma_oracle.is_zero(), 'HZN: zero oracle');
        assert(numerator_pair_id != 0, 'HZN: zero numerator pair');
        assert(initial_index >= WAD, 'HZN: invalid initial index');

        self.ownable.initializer(owner);
        self.pragma_oracle.write(pragma_oracle);
        self.numerator_pair_id.write(numerator_pair_id);
        self.denominator_pair_id.write(denominator_pair_id);
        self.twap_window.write(DEFAULT_TWAP_WINDOW);
        self.max_staleness.write(DEFAULT_MAX_STALENESS);
        self.stored_index.write(initial_index);
        self.last_update_timestamp.write(get_block_timestamp());
        self.paused.write(false);

        // Initialize AccessControl and grant roles to owner
        self.access_control.initializer();
        self.access_control._grant_role(DEFAULT_ADMIN_ROLE, owner);
        self.access_control._grant_role(OPERATOR_ROLE, owner);
        self.access_control._grant_role(PAUSER_ROLE, owner);
    }

    #[abi(embed_v0)]
    impl UpgradeableImpl of IUpgradeable<ContractState> {
        fn upgrade(ref self: ContractState, new_class_hash: ClassHash) {
            self.ownable.assert_only_owner();
            self.upgradeable.upgrade(new_class_hash);
        }
    }

    #[abi(embed_v0)]
    impl IndexOracleImpl of IIndexOracle<ContractState> {
        /// Returns the current exchange rate index in WAD (1e18)
        /// Uses monotonic watermark pattern - index can only increase
        fn index(self: @ContractState) -> u256 {
            // If paused, return stored index
            if self.paused.read() {
                return self.stored_index.read();
            }

            // Fetch fresh oracle data and apply watermark
            let oracle_index = self._fetch_oracle_index();
            let stored = self.stored_index.read();

            // Return max of stored and oracle (monotonic non-decreasing)
            max(oracle_index, stored)
        }
    }

    #[abi(embed_v0)]
    impl PragmaIndexOracleAdminImpl of super::IPragmaIndexOracleAdmin<ContractState> {
        /// Update the stored index from oracle
        fn update_index(ref self: ContractState) -> u256 {
            assert(!self.paused.read(), 'HZN: paused');

            let oracle_index = self._fetch_oracle_index();
            let old_index = self.stored_index.read();

            if oracle_index > old_index {
                self.stored_index.write(oracle_index);
                self.last_update_timestamp.write(get_block_timestamp());

                self
                    .emit(
                        IndexUpdated {
                            oracle: self.pragma_oracle.read(),
                            old_index,
                            new_index: oracle_index,
                            timestamp: get_block_timestamp(),
                        },
                    );
            }

            max(oracle_index, old_index)
        }

        /// Update TWAP window and staleness parameters (OPERATOR_ROLE)
        fn set_config(ref self: ContractState, twap_window: u64, max_staleness: u64) {
            self.access_control.assert_only_role(OPERATOR_ROLE);
            assert(twap_window >= MIN_TWAP_WINDOW, 'HZN: window too short');
            assert(max_staleness >= twap_window, 'HZN: staleness < window');

            self.twap_window.write(twap_window);
            self.max_staleness.write(max_staleness);

            self.emit(ConfigUpdated { twap_window, max_staleness });
        }

        /// Pause the oracle (PAUSER_ROLE)
        fn pause(ref self: ContractState) {
            self.access_control.assert_only_role(PAUSER_ROLE);
            self.paused.write(true);
            self.emit(Paused { by: get_caller_address() });
        }

        /// Unpause the oracle (PAUSER_ROLE)
        fn unpause(ref self: ContractState) {
            self.access_control.assert_only_role(PAUSER_ROLE);
            self.paused.write(false);
            self.emit(Unpaused { by: get_caller_address() });
        }

        /// Emergency index update (DEFAULT_ADMIN_ROLE only)
        /// Note: Index can only increase to maintain monotonic watermark pattern.
        /// Decreasing the index would allow stealing yield from YT holders.
        /// If oracle data was corrupted with too-high values, use contract upgrade for recovery.
        fn emergency_set_index(ref self: ContractState, new_index: u256) {
            self.access_control.assert_only_role(DEFAULT_ADMIN_ROLE);
            assert(new_index >= WAD, 'HZN: index below WAD');

            let old_index = self.stored_index.read();
            // Enforce monotonic watermark - index can only increase
            assert(new_index >= old_index, 'HZN: cannot decrease index');

            self.stored_index.write(new_index);
            self.last_update_timestamp.write(get_block_timestamp());

            self
                .emit(
                    IndexUpdated {
                        oracle: self.pragma_oracle.read(),
                        old_index,
                        new_index,
                        timestamp: get_block_timestamp(),
                    },
                );
        }

        /// Initialize RBAC after upgrade (one-time setup)
        /// Owner calls this to bootstrap AccessControl roles
        fn initialize_rbac(ref self: ContractState) {
            self.ownable.assert_only_owner();
            assert(!self.rbac_initialized.read(), 'HZN: RBAC already init');

            let owner = self.ownable.owner();

            // Grant roles to current owner
            self.access_control._grant_role(DEFAULT_ADMIN_ROLE, owner);
            self.access_control._grant_role(OPERATOR_ROLE, owner);
            self.access_control._grant_role(PAUSER_ROLE, owner);

            // Mark as initialized to prevent re-calling
            self.rbac_initialized.write(true);
        }

        // View functions
        fn get_pragma_oracle(self: @ContractState) -> ContractAddress {
            self.pragma_oracle.read()
        }

        fn get_numerator_pair_id(self: @ContractState) -> felt252 {
            self.numerator_pair_id.read()
        }

        fn get_denominator_pair_id(self: @ContractState) -> felt252 {
            self.denominator_pair_id.read()
        }

        fn get_twap_window(self: @ContractState) -> u64 {
            self.twap_window.read()
        }

        fn get_max_staleness(self: @ContractState) -> u64 {
            self.max_staleness.read()
        }

        fn get_stored_index(self: @ContractState) -> u256 {
            self.stored_index.read()
        }

        fn get_last_update_timestamp(self: @ContractState) -> u64 {
            self.last_update_timestamp.read()
        }

        fn is_paused(self: @ContractState) -> bool {
            self.paused.read()
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        /// Fetch index from Pragma oracle
        fn _fetch_oracle_index(self: @ContractState) -> u256 {
            let oracle = IPragmaSummaryStatsDispatcher {
                contract_address: self.pragma_oracle.read(),
            };

            let current_time = get_block_timestamp();
            let twap_window = self.twap_window.read();

            // Calculate start_time for TWAP window
            let start_time = if current_time > twap_window {
                current_time - twap_window
            } else {
                0
            };

            // Fetch numerator price
            let (num_price, num_decimals) = oracle
                .calculate_twap(
                    DataType::SpotEntry(self.numerator_pair_id.read()),
                    AggregationMode::Median,
                    twap_window,
                    start_time,
                );

            let denominator_pair = self.denominator_pair_id.read();

            if denominator_pair == 0 {
                // Single-feed mode: convert price directly to index
                self._price_to_wad(num_price, num_decimals)
            } else {
                // Dual-feed mode: calculate ratio
                let (denom_price, denom_decimals) = oracle
                    .calculate_twap(
                        DataType::SpotEntry(denominator_pair),
                        AggregationMode::Median,
                        twap_window,
                        start_time,
                    );

                assert(denom_price > 0, 'HZN: zero denom price');

                self._calculate_ratio_wad(num_price, num_decimals, denom_price, denom_decimals)
            }
        }

        /// Convert a single price to WAD format
        fn _price_to_wad(self: @ContractState, price: u128, decimals: u32) -> u256 {
            let price_u256: u256 = price.into();

            if decimals < WAD_DECIMALS {
                // Scale up: price * 10^(18 - decimals)
                let scale: u256 = self._pow10((WAD_DECIMALS - decimals).into());
                price_u256 * scale
            } else if decimals > WAD_DECIMALS {
                // Scale down: price / 10^(decimals - 18)
                let scale: u256 = self._pow10((decimals - WAD_DECIMALS).into());
                price_u256 / scale
            } else {
                price_u256
            }
        }

        /// Calculate ratio of two prices and return in WAD
        fn _calculate_ratio_wad(
            self: @ContractState,
            num_price: u128,
            num_decimals: u32,
            denom_price: u128,
            denom_decimals: u32,
        ) -> u256 {
            // ratio = (num / 10^num_dec) / (denom / 10^denom_dec) * WAD
            // = num * 10^denom_dec * WAD / (denom * 10^num_dec)

            let num_u256: u256 = num_price.into();
            let denom_u256: u256 = denom_price.into();

            let denom_scale: u256 = self._pow10(denom_decimals.into());
            let num_scale: u256 = self._pow10(num_decimals.into());

            // Multiply first to maintain precision
            let numerator = num_u256 * denom_scale * WAD;
            let denominator = denom_u256 * num_scale;

            numerator / denominator
        }

        /// Calculate 10^n
        fn _pow10(self: @ContractState, n: u256) -> u256 {
            if n == 0 {
                return 1;
            }
            let mut result: u256 = 1;
            let mut i: u256 = 0;
            while i < n {
                result = result * 10;
                i = i + 1;
            }
            result
        }
    }
}
