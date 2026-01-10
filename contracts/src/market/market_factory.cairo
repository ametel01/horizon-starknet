/// Market Factory Contract
/// Deploys and tracks Market contracts for PT/SY trading pools.
/// Each PT can only have one market.
#[starknet::contract]
pub mod MarketFactory {
    use core::num::traits::Zero;
    use horizon::interfaces::i_market::{IMarketDispatcher, IMarketDispatcherTrait};
    use horizon::interfaces::i_market_factory::{IMarketFactory, MarketConfig};
    use horizon::interfaces::i_pt::{IPTDispatcher, IPTDispatcherTrait};
    use horizon::interfaces::i_sy::{ISYDispatcher, ISYDispatcherTrait};
    use horizon::libraries::errors::Errors;
    use horizon::libraries::roles::DEFAULT_ADMIN_ROLE;
    use openzeppelin_access::accesscontrol::AccessControlComponent;
    use openzeppelin_access::ownable::OwnableComponent;
    use openzeppelin_interfaces::upgrades::IUpgradeable;
    use openzeppelin_introspection::src5::SRC5Component;
    use openzeppelin_upgrades::UpgradeableComponent;
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };
    use starknet::syscalls::deploy_syscall;
    use starknet::{
        ClassHash, ContractAddress, get_block_timestamp, get_caller_address, get_contract_address,
    };
    use super::{IERC20MetadataDispatcher, IERC20MetadataDispatcherTrait};

    // ============ Market Parameter Bounds ============
    // These constants define valid ranges for market creation parameters

    /// Minimum scalar_root: 1 WAD (ensures some rate sensitivity)
    const MIN_SCALAR_ROOT: u256 = 1_000_000_000_000_000_000; // 1 WAD

    /// Maximum scalar_root: 1000 WAD (prevents extreme rate sensitivity that could cause overflow)
    const MAX_SCALAR_ROOT: u256 = 1_000_000_000_000_000_000_000; // 1000 WAD

    /// Maximum initial_anchor (ln implied rate): ~4.6 WAD (corresponds to ~100x implied rate)
    /// Using same value as market_math::MAX_LN_IMPLIED_RATE
    const MAX_INITIAL_ANCHOR: u256 = 4_600_000_000_000_000_000; // ~4.6 WAD

    /// Minimum initial_anchor: 1 WAD (Pendle requires initial_anchor >= WAD)
    /// This ensures the starting ln(implied rate) is valid (rate >= 1)
    const MIN_INITIAL_ANCHOR: u256 = 1_000_000_000_000_000_000; // 1 WAD

    /// Maximum ln_fee_rate_root: ln(1.05) WAD ≈ 0.0488 WAD (Pendle bound)
    /// At 1 year to expiry, this gives max 5% fee: exp(0.0488 * 1) ≈ 1.05
    /// Using precise value: ln(1.05) = 0.04879016416943092...
    const MAX_LN_FEE_RATE_ROOT: u256 = 48_790_164_169_432_000; // ln(1.05) WAD

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

    #[storage]
    struct Storage {
        // === EXISTING STORAGE - DO NOT MODIFY ORDER ===
        #[substorage(v0)]
        ownable: OwnableComponent::Storage,
        #[substorage(v0)]
        upgradeable: UpgradeableComponent::Storage,
        // Class hash for Market contract deployment
        market_class_hash: ClassHash,
        // Mapping: PT address -> Market address
        market_registry: Map<ContractAddress, ContractAddress>,
        // Set of valid market addresses deployed by this factory
        valid_markets: Map<ContractAddress, bool>,
        // Counter for unique salt generation
        deploy_count: u256,
        // List of all market addresses (indexed)
        market_list: Map<u32, ContractAddress>,
        // Total number of markets created
        market_count: u32,
        // === NEW STORAGE - ADDED AT END ===
        #[substorage(v0)]
        src5: SRC5Component::Storage,
        #[substorage(v0)]
        access_control: AccessControlComponent::Storage,
        // Flag to prevent RBAC re-initialization
        rbac_initialized: bool,
        // === FEE CONFIGURATION (Pendle-style) ===
        // Treasury address for receiving reserve fees
        treasury: ContractAddress,
        // Default reserve fee percent (0-100)
        default_reserve_fee_percent: u8,
        // Per-router per-market ln_fee_rate_root overrides
        // Key: (router, market) -> ln_fee_rate_root (0 = no override)
        overridden_fee: Map<(ContractAddress, ContractAddress), u256>,
        // === RATE IMPACT FEE CONFIGURATION ===
        // Default rate impact sensitivity factor (in WAD)
        // Controls how much fees increase based on trade's rate impact
        // E.g., 0.1 WAD (10%) means 10% rate change → ~1% additional fee
        default_rate_impact_sensitivity: u256,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        MarketCreated: MarketCreated,
        MarketClassHashUpdated: MarketClassHashUpdated,
        TreasuryUpdated: TreasuryUpdated,
        DefaultReserveFeeUpdated: DefaultReserveFeeUpdated,
        OverrideFeeSet: OverrideFeeSet,
        DefaultRateImpactSensitivityUpdated: DefaultRateImpactSensitivityUpdated,
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
    pub struct MarketCreated {
        #[key]
        pub pt: ContractAddress,
        #[key]
        pub expiry: u64,
        pub market: ContractAddress,
        pub creator: ContractAddress,
        pub scalar_root: u256,
        pub initial_anchor: u256,
        pub ln_fee_rate_root: u256,
        pub reserve_fee_percent: u8,
        pub sy: ContractAddress,
        pub yt: ContractAddress,
        pub underlying: ContractAddress,
        pub underlying_symbol: ByteArray,
        pub initial_exchange_rate: u256,
        pub timestamp: u64,
        pub market_index: u32,
    }

    #[derive(Drop, starknet::Event)]
    pub struct MarketClassHashUpdated {
        pub old_class_hash: ClassHash,
        pub new_class_hash: ClassHash,
    }

    #[derive(Drop, starknet::Event)]
    pub struct TreasuryUpdated {
        pub old_treasury: ContractAddress,
        pub new_treasury: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct DefaultReserveFeeUpdated {
        pub old_percent: u8,
        pub new_percent: u8,
    }

    #[derive(Drop, starknet::Event)]
    pub struct OverrideFeeSet {
        #[key]
        pub router: ContractAddress,
        #[key]
        pub market: ContractAddress,
        pub ln_fee_rate_root: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct DefaultRateImpactSensitivityUpdated {
        pub old_sensitivity: u256,
        pub new_sensitivity: u256,
    }

    #[constructor]
    fn constructor(ref self: ContractState, owner: ContractAddress, market_class_hash: ClassHash) {
        assert(!market_class_hash.is_zero(), Errors::ZERO_ADDRESS);
        self.ownable.initializer(owner);
        self.market_class_hash.write(market_class_hash);
        self.deploy_count.write(0);
        self.market_count.write(0);

        // Initialize AccessControl and grant admin role to owner
        self.access_control.initializer();
        self.access_control._grant_role(DEFAULT_ADMIN_ROLE, owner);
    }

    #[abi(embed_v0)]
    impl UpgradeableImpl of IUpgradeable<ContractState> {
        fn upgrade(ref self: ContractState, new_class_hash: ClassHash) {
            self.ownable.assert_only_owner();
            self.upgradeable.upgrade(new_class_hash);
        }
    }

    #[abi(embed_v0)]
    impl MarketFactoryImpl of IMarketFactory<ContractState> {
        /// Create a new market for a PT token
        /// @param pt The PT token address
        /// @param scalar_root Controls rate sensitivity (in WAD)
        /// @param initial_anchor Initial ln(implied rate) (in WAD)
        /// @param ln_fee_rate_root Log fee rate root (Pendle-style) in WAD
        /// @param reserve_fee_percent Reserve fee in base-100 (0-100), sent to treasury
        /// @param reward_tokens Span of reward token addresses for LP rewards
        /// @return The address of the created market
        fn create_market(
            ref self: ContractState,
            pt: ContractAddress,
            scalar_root: u256,
            initial_anchor: u256,
            ln_fee_rate_root: u256,
            reserve_fee_percent: u8,
            reward_tokens: Span<ContractAddress>,
        ) -> ContractAddress {
            // Validate PT address
            assert(!pt.is_zero(), Errors::ZERO_ADDRESS);

            // Validate market parameters to prevent AMM math issues and economic attacks
            // scalar_root must be within [1 WAD, 1000 WAD] to ensure proper rate sensitivity
            assert(
                scalar_root >= MIN_SCALAR_ROOT && scalar_root <= MAX_SCALAR_ROOT,
                Errors::MARKET_FACTORY_INVALID_SCALAR,
            );

            // initial_anchor (ln implied rate) must be within [1 WAD, MAX] (Pendle bounds)
            // Minimum ensures rate >= 1, maximum prevents extreme pricing
            assert(
                initial_anchor >= MIN_INITIAL_ANCHOR && initial_anchor <= MAX_INITIAL_ANCHOR,
                Errors::MARKET_FACTORY_INVALID_ANCHOR,
            );

            // ln_fee_rate_root must not exceed ln(1.05) to cap fees at 5% (Pendle bound)
            assert(ln_fee_rate_root <= MAX_LN_FEE_RATE_ROOT, Errors::MARKET_FACTORY_INVALID_FEE);

            // reserve_fee_percent must be <= 100
            assert(reserve_fee_percent <= 100, Errors::MARKET_FACTORY_INVALID_FEE);

            // Check PT is valid and not expired
            let pt_contract = IPTDispatcher { contract_address: pt };
            let expiry = pt_contract.expiry();
            let sy = pt_contract.sy();
            let yt = pt_contract.yt();
            assert(expiry > get_block_timestamp(), Errors::MARKET_EXPIRED);

            // Check if market already exists for this PT
            let existing_market = self.market_registry.read(pt);
            assert(existing_market.is_zero(), Errors::MARKET_FACTORY_ALREADY_EXISTS);

            // Get class hash
            let market_class_hash = self.market_class_hash.read();

            // Generate unique salt
            let count = self.deploy_count.read();
            self.deploy_count.write(count + 1);

            // Build Market constructor calldata
            // Market constructor: name, symbol, pt, scalar_root, initial_anchor, ln_fee_rate_root,
            // reserve_fee_percent, pauser, factory, reward_tokens
            let mut calldata: Array<felt252> = array![];

            // Name: "PT-SY LP" (simplified)
            calldata.append(0); // data array length
            calldata.append('PT-SY LP'); // pending_word
            calldata.append(8); // pending_word_len

            // Symbol: "LP"
            calldata.append(0);
            calldata.append('LP');
            calldata.append(2);

            // PT address
            calldata.append(pt.into());

            // scalar_root (u256 = 2 felts)
            calldata.append(scalar_root.low.into());
            calldata.append(scalar_root.high.into());

            // initial_anchor (u256 = 2 felts)
            calldata.append(initial_anchor.low.into());
            calldata.append(initial_anchor.high.into());

            // ln_fee_rate_root (u256 = 2 felts)
            calldata.append(ln_fee_rate_root.low.into());
            calldata.append(ln_fee_rate_root.high.into());

            // reserve_fee_percent (u8 = 1 felt)
            calldata.append(reserve_fee_percent.into());

            // pauser address (factory owner gets PAUSER_ROLE on created markets)
            calldata.append(self.ownable.owner().into());

            // factory address (this contract - for querying fee config and treasury)
            calldata.append(get_contract_address().into());

            // reward_tokens (Span<ContractAddress> = array length + elements)
            calldata.append(reward_tokens.len().into());
            let mut i = 0;
            while i < reward_tokens.len() {
                calldata.append((*reward_tokens.at(i)).into());
                i += 1;
            };

            // Deploy Market contract
            let salt: felt252 = count.low.into();
            let (market_address, _) =
                match deploy_syscall(market_class_hash, salt, calldata.span(), false) {
                Result::Ok(result) => result,
                Result::Err(_) => panic!("{}", Errors::MARKET_FACTORY_DEPLOY_FAILED),
            };

            // Register the new market
            self.market_registry.write(pt, market_address);
            self.valid_markets.write(market_address, true);

            // Add to market list
            let current_count = self.market_count.read();
            self.market_list.write(current_count, market_address);
            self.market_count.write(current_count + 1);

            // Get additional event data from SY
            let sy_contract = ISYDispatcher { contract_address: sy };
            let underlying = sy_contract.underlying_asset();
            let initial_exchange_rate = sy_contract.exchange_rate();

            // Get underlying token symbol
            let underlying_token = IERC20MetadataDispatcher { contract_address: underlying };
            let underlying_symbol = underlying_token.symbol();

            // Emit event
            self
                .emit(
                    MarketCreated {
                        pt,
                        expiry,
                        market: market_address,
                        creator: get_caller_address(),
                        scalar_root,
                        initial_anchor,
                        ln_fee_rate_root,
                        reserve_fee_percent,
                        sy,
                        yt,
                        underlying,
                        underlying_symbol,
                        initial_exchange_rate,
                        timestamp: get_block_timestamp(),
                        market_index: current_count,
                    },
                );

            market_address
        }

        /// Get the market address for a given PT
        fn get_market(self: @ContractState, pt: ContractAddress) -> ContractAddress {
            self.market_registry.read(pt)
        }

        /// Check if a market address was deployed by this factory
        fn is_valid_market(self: @ContractState, market: ContractAddress) -> bool {
            self.valid_markets.read(market)
        }

        /// Get the market class hash used for deployments
        fn market_class_hash(self: @ContractState) -> ClassHash {
            self.market_class_hash.read()
        }

        /// Get the total number of markets created
        fn get_market_count(self: @ContractState) -> u32 {
            self.market_count.read()
        }

        /// Get all market addresses created by this factory
        /// WARNING: May exceed gas limits for large numbers of markets. Use get_markets_paginated
        /// for production.
        fn get_all_markets(self: @ContractState) -> Array<ContractAddress> {
            let count = self.market_count.read();
            let mut markets: Array<ContractAddress> = array![];
            let mut i: u32 = 0;
            while i < count {
                markets.append(self.market_list.read(i));
                i += 1;
            }
            markets
        }

        /// Get market addresses with pagination
        /// @param offset Starting index (0-based)
        /// @param limit Maximum number of markets to return
        /// @return (markets, has_more) - Array of market addresses and whether more markets exist
        fn get_markets_paginated(
            self: @ContractState, offset: u32, limit: u32,
        ) -> (Array<ContractAddress>, bool) {
            let count = self.market_count.read();
            let mut markets: Array<ContractAddress> = array![];

            // If offset is beyond count, return empty array
            if offset >= count {
                return (markets, false);
            }

            // Calculate end index (exclusive)
            let end = if offset + limit > count {
                count
            } else {
                offset + limit
            };

            // Collect markets in range
            let mut i: u32 = offset;
            while i < end {
                markets.append(self.market_list.read(i));
                i += 1;
            }

            // Check if there are more markets after this page
            let has_more = end < count;

            (markets, has_more)
        }

        /// Get active (non-expired) market addresses with pagination
        /// @param offset Number of active markets to skip
        /// @param limit Maximum number of active markets to return
        /// @return (active_markets, has_more) - Array of active market addresses and whether more
        /// exist
        fn get_active_markets_paginated(
            self: @ContractState, offset: u32, limit: u32,
        ) -> (Array<ContractAddress>, bool) {
            let total_count = self.market_count.read();
            let mut active_markets: Array<ContractAddress> = array![];
            let mut skipped: u32 = 0;
            let mut collected: u32 = 0;
            let mut i: u32 = 0;
            let mut has_more = false;

            // Iterate through all markets to find active ones
            while i < total_count {
                let market_address = self.market_list.read(i);
                let market = IMarketDispatcher { contract_address: market_address };

                // Check if market is not expired
                if !market.is_expired() {
                    // Skip until we reach the offset
                    if skipped < offset {
                        skipped += 1;
                    } else if collected < limit {
                        // Collect active markets up to limit
                        active_markets.append(market_address);
                        collected += 1;
                    } else {
                        // We found more active markets after collecting limit
                        has_more = true;
                        break;
                    }
                }
                i += 1;
            }

            (active_markets, has_more)
        }

        /// Get market address by index (0-based)
        fn get_market_at(self: @ContractState, index: u32) -> ContractAddress {
            assert(index < self.market_count.read(), Errors::INDEX_OUT_OF_BOUNDS);
            self.market_list.read(index)
        }

        /// Set new market class hash (owner only)
        fn set_market_class_hash(ref self: ContractState, new_class_hash: ClassHash) {
            self.ownable.assert_only_owner();
            assert(!new_class_hash.is_zero(), Errors::ZERO_ADDRESS);

            let old_class_hash = self.market_class_hash.read();
            self.market_class_hash.write(new_class_hash);

            self.emit(MarketClassHashUpdated { old_class_hash, new_class_hash });
        }

        /// Initialize RBAC after upgrade (one-time setup)
        /// Owner calls this to bootstrap AccessControl roles
        fn initialize_rbac(ref self: ContractState) {
            self.ownable.assert_only_owner();
            assert(!self.rbac_initialized.read(), Errors::RBAC_ALREADY_INITIALIZED);

            let owner = self.ownable.owner();

            // Grant admin role to current owner
            self.access_control._grant_role(DEFAULT_ADMIN_ROLE, owner);

            // Mark as initialized to prevent re-calling
            self.rbac_initialized.write(true);
        }

        // ============ Fee Configuration (Pendle-style) ============

        /// Get market configuration for a specific router
        /// Returns treasury, effective ln_fee_rate_root (override or 0), reserve_fee_percent,
        /// and rate_impact_sensitivity
        fn get_market_config(
            self: @ContractState, market: ContractAddress, router: ContractAddress,
        ) -> MarketConfig {
            let treasury = self.treasury.read();
            let reserve_fee_percent = self.default_reserve_fee_percent.read();
            let rate_impact_sensitivity = self.default_rate_impact_sensitivity.read();

            // Get override fee for this router/market pair (0 if not set)
            let ln_fee_rate_root = self.overridden_fee.read((router, market));

            MarketConfig {
                treasury, ln_fee_rate_root, reserve_fee_percent, rate_impact_sensitivity,
            }
        }

        /// Get the treasury address
        fn get_treasury(self: @ContractState) -> ContractAddress {
            self.treasury.read()
        }

        /// Get the default reserve fee percent
        fn get_default_reserve_fee_percent(self: @ContractState) -> u8 {
            self.default_reserve_fee_percent.read()
        }

        /// Set the treasury address (owner only)
        fn set_treasury(ref self: ContractState, treasury: ContractAddress) {
            self.ownable.assert_only_owner();

            let old_treasury = self.treasury.read();
            self.treasury.write(treasury);

            self.emit(TreasuryUpdated { old_treasury, new_treasury: treasury });
        }

        /// Set the default reserve fee percent (owner only)
        fn set_default_reserve_fee_percent(ref self: ContractState, percent: u8) {
            self.ownable.assert_only_owner();
            assert(percent <= 100, Errors::MARKET_FACTORY_INVALID_FEE);

            let old_percent = self.default_reserve_fee_percent.read();
            self.default_reserve_fee_percent.write(percent);

            self.emit(DefaultReserveFeeUpdated { old_percent, new_percent: percent });
        }

        /// Set fee override for a specific router/market pair (owner only)
        /// @param router Router address
        /// @param market Market address (must be a valid market deployed by this factory)
        /// @param ln_fee_rate_root Override ln fee rate root (0 to clear override)
        fn set_override_fee(
            ref self: ContractState,
            router: ContractAddress,
            market: ContractAddress,
            ln_fee_rate_root: u256,
        ) {
            self.ownable.assert_only_owner();

            // Validate market is a valid market deployed by this factory
            assert(self.valid_markets.read(market), Errors::MARKET_FACTORY_INVALID_MARKET);

            // If setting a non-zero override, validate it's less than market's base fee
            // This prevents routers from having higher fees than the base market fee
            if ln_fee_rate_root != 0 {
                let market_contract = IMarketDispatcher { contract_address: market };
                let market_ln_fee_rate_root = market_contract.get_ln_fee_rate_root();
                assert(
                    ln_fee_rate_root < market_ln_fee_rate_root,
                    Errors::MARKET_FACTORY_OVERRIDE_TOO_HIGH,
                );
            }

            self.overridden_fee.write((router, market), ln_fee_rate_root);

            self.emit(OverrideFeeSet { router, market, ln_fee_rate_root });
        }

        // ============ Rate Impact Fee Configuration ============

        /// Get the default rate impact sensitivity
        fn get_default_rate_impact_sensitivity(self: @ContractState) -> u256 {
            self.default_rate_impact_sensitivity.read()
        }

        /// Set the default rate impact sensitivity (owner only)
        /// Controls how much fees increase based on trade's rate impact
        /// @param sensitivity Sensitivity factor in WAD (0 to disable dynamic fees)
        fn set_default_rate_impact_sensitivity(ref self: ContractState, sensitivity: u256) {
            self.ownable.assert_only_owner();

            // Cap sensitivity at 10 WAD (1000%) to prevent extreme fee multipliers
            // At 10 WAD sensitivity, a 10% rate change would give 100% fee increase (capped at 2x)
            let max_sensitivity: u256 = 10_000_000_000_000_000_000; // 10 WAD
            assert(sensitivity <= max_sensitivity, Errors::MARKET_FACTORY_INVALID_FEE);

            let old_sensitivity = self.default_rate_impact_sensitivity.read();
            self.default_rate_impact_sensitivity.write(sensitivity);

            self
                .emit(
                    DefaultRateImpactSensitivityUpdated {
                        old_sensitivity, new_sensitivity: sensitivity,
                    },
                );
        }
    }
}

/// Interface for ERC20 metadata (symbol)
#[starknet::interface]
trait IERC20Metadata<TContractState> {
    fn symbol(self: @TContractState) -> ByteArray;
}
