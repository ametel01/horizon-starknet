/// Factory Contract
/// Deploys and tracks PT/YT pairs for different SY tokens and expiries.
/// Each (SY, expiry) combination can only have one PT/YT pair.
/// Also deploys SYWithRewards contracts for reward-enabled SY tokens.
#[starknet::contract]
pub mod Factory {
    use core::num::traits::Zero;
    use horizon::interfaces::i_factory::IFactory;
    use horizon::interfaces::i_sy::{AssetType, ISYDispatcher, ISYDispatcherTrait};
    use horizon::interfaces::i_yt::{IYTDispatcher, IYTDispatcherTrait};
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
    use starknet::{ClassHash, ContractAddress, get_block_timestamp, get_caller_address};
    use super::{IERC20MetadataDispatcher, IERC20MetadataDispatcherTrait};

    // Fee rate limits (WAD units, 10^18 = 100%)
    // Maximum reward fee rate: 20% (0.2e18)
    pub const MAX_REWARD_FEE_RATE: u256 = 200_000_000_000_000_000;
    // Maximum interest fee rate: 50% (0.5e18)
    pub const MAX_INTEREST_FEE_RATE: u256 = 500_000_000_000_000_000;

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
        // Class hash for YT contract deployment
        yt_class_hash: ClassHash,
        // Class hash for PT contract (passed to YT constructor)
        pt_class_hash: ClassHash,
        // Mapping: (SY, expiry) -> PT address
        pt_registry: Map<(ContractAddress, u64), ContractAddress>,
        // Mapping: (SY, expiry) -> YT address
        yt_registry: Map<(ContractAddress, u64), ContractAddress>,
        // Set of valid PT addresses deployed by this factory
        valid_pts: Map<ContractAddress, bool>,
        // Set of valid YT addresses deployed by this factory
        valid_yts: Map<ContractAddress, bool>,
        // Counter for unique salt generation
        deploy_count: u256,
        // === NEW STORAGE - ADDED AT END ===
        #[substorage(v0)]
        src5: SRC5Component::Storage,
        #[substorage(v0)]
        access_control: AccessControlComponent::Storage,
        // Flag to prevent RBAC re-initialization
        rbac_initialized: bool,
        // Class hash for SYWithRewards contract deployment
        sy_with_rewards_class_hash: ClassHash,
        // Set of valid SY addresses deployed by this factory
        valid_sys: Map<ContractAddress, bool>,
        // Treasury address for protocol fee collection and post-expiry yield
        treasury: ContractAddress,
        // Fee rate for reward token harvesting (in WAD, e.g., 3% = 0.03 * 10^18)
        reward_fee_rate: u256,
        // Default fee rate for interest accrual (in WAD, e.g., 3% = 0.03 * 10^18)
        default_interest_fee_rate: u256,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        YieldContractsCreated: YieldContractsCreated,
        ClassHashesUpdated: ClassHashesUpdated,
        SYWithRewardsDeployed: SYWithRewardsDeployed,
        SYWithRewardsClassHashUpdated: SYWithRewardsClassHashUpdated,
        RewardFeeRateSet: RewardFeeRateSet,
        DefaultInterestFeeRateSet: DefaultInterestFeeRateSet,
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
    pub struct YieldContractsCreated {
        #[key]
        pub sy: ContractAddress,
        #[key]
        pub expiry: u64,
        pub pt: ContractAddress,
        pub yt: ContractAddress,
        pub creator: ContractAddress,
        // Enrichment fields for indexer
        pub underlying: ContractAddress,
        pub underlying_symbol: ByteArray,
        pub initial_exchange_rate: u256,
        pub timestamp: u64,
        pub market_index: u32,
    }

    #[derive(Drop, starknet::Event)]
    pub struct ClassHashesUpdated {
        pub yt_class_hash: ClassHash,
        pub pt_class_hash: ClassHash,
    }

    #[derive(Drop, starknet::Event)]
    pub struct SYWithRewardsDeployed {
        #[key]
        pub sy: ContractAddress,
        pub name: ByteArray,
        pub symbol: ByteArray,
        pub underlying: ContractAddress,
        pub deployer: ContractAddress,
        pub timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct SYWithRewardsClassHashUpdated {
        pub old_class_hash: ClassHash,
        pub new_class_hash: ClassHash,
    }

    #[derive(Drop, starknet::Event)]
    pub struct RewardFeeRateSet {
        pub old_fee_rate: u256,
        pub new_fee_rate: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct DefaultInterestFeeRateSet {
        pub old_fee_rate: u256,
        pub new_fee_rate: u256,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        yt_class_hash: ClassHash,
        pt_class_hash: ClassHash,
        treasury: ContractAddress,
    ) {
        assert(!yt_class_hash.is_zero(), Errors::ZERO_ADDRESS);
        assert(!pt_class_hash.is_zero(), Errors::ZERO_ADDRESS);
        assert(!treasury.is_zero(), Errors::ZERO_ADDRESS);

        self.ownable.initializer(owner);
        self.yt_class_hash.write(yt_class_hash);
        self.pt_class_hash.write(pt_class_hash);
        self.treasury.write(treasury);
        self.deploy_count.write(0);

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
    impl FactoryImpl of IFactory<ContractState> {
        /// Create new PT and YT contracts for a given SY and expiry
        /// @param sy The standardized yield token address
        /// @param expiry The expiry timestamp
        /// @return (PT address, YT address)
        fn create_yield_contracts(
            ref self: ContractState, sy: ContractAddress, expiry: u64,
        ) -> (ContractAddress, ContractAddress) {
            // Validate inputs
            assert(!sy.is_zero(), Errors::ZERO_ADDRESS);
            assert(expiry > get_block_timestamp(), Errors::FACTORY_INVALID_EXPIRY);

            // Check if contracts already exist for this SY/expiry pair
            let existing_yt = self.yt_registry.read((sy, expiry));
            assert(existing_yt.is_zero(), Errors::FACTORY_ALREADY_EXISTS);

            // Get class hashes
            let yt_class_hash = self.yt_class_hash.read();
            let pt_class_hash = self.pt_class_hash.read();

            // Generate unique salt using deploy count
            let count = self.deploy_count.read();
            self.deploy_count.write(count + 1);

            // Get SY symbol for derived naming
            let sy_dispatcher = ISYDispatcher { contract_address: sy };
            let sy_symbol = sy_dispatcher.symbol();

            // Construct YT name and symbol from SY symbol (e.g., "YT-stETH")
            let mut yt_name: ByteArray = "YT-";
            yt_name.append(@sy_symbol);
            let mut yt_symbol: ByteArray = "YT-";
            yt_symbol.append(@sy_symbol);

            // Get decimals from SY to ensure consistency across SY/PT/YT
            let sy_decimals = sy_dispatcher.decimals();

            // Build YT constructor calldata
            // YT constructor: name, symbol, sy, pt_class_hash, expiry, pauser, treasury, decimals
            let mut yt_calldata: Array<felt252> = array![];

            // Serialize YT name (ByteArray)
            Serde::serialize(@yt_name, ref yt_calldata);

            // Serialize YT symbol (ByteArray)
            Serde::serialize(@yt_symbol, ref yt_calldata);

            // SY address
            yt_calldata.append(sy.into());

            // PT class hash
            yt_calldata.append(pt_class_hash.into());

            // Expiry
            yt_calldata.append(expiry.into());

            // Pauser address (factory owner gets PAUSER_ROLE on created YT)
            yt_calldata.append(self.ownable.owner().into());

            // Treasury address for post-expiry yield and protocol fees
            yt_calldata.append(self.treasury.read().into());

            // Decimals (matches SY for consistency)
            yt_calldata.append(sy_decimals.into());

            // Deploy YT contract (which will deploy PT internally)
            let salt: felt252 = count.low.into();
            let (yt_address, _) =
                match deploy_syscall(yt_class_hash, salt, yt_calldata.span(), false) {
                Result::Ok(result) => result,
                Result::Err(_) => panic!("{}", Errors::FACTORY_DEPLOY_FAILED),
            };

            // Get PT address from deployed YT
            let yt = IYTDispatcher { contract_address: yt_address };
            let pt_address = yt.pt();

            // Register the new contracts
            self.pt_registry.write((sy, expiry), pt_address);
            self.yt_registry.write((sy, expiry), yt_address);
            self.valid_pts.write(pt_address, true);
            self.valid_yts.write(yt_address, true);

            // Gather enrichment data for indexer
            let underlying = sy_dispatcher.underlying_asset();
            let underlying_token = IERC20MetadataDispatcher { contract_address: underlying };
            let underlying_symbol = underlying_token.symbol();
            let initial_exchange_rate = sy_dispatcher.exchange_rate();
            let timestamp = get_block_timestamp();
            // market_index is the deploy count before increment (0-indexed)
            let market_index: u32 = count.low.try_into().unwrap();

            // Emit enriched event
            self
                .emit(
                    YieldContractsCreated {
                        sy,
                        expiry,
                        pt: pt_address,
                        yt: yt_address,
                        creator: get_caller_address(),
                        underlying,
                        underlying_symbol,
                        initial_exchange_rate,
                        timestamp,
                        market_index,
                    },
                );

            (pt_address, yt_address)
        }

        /// Get the PT address for a given SY and expiry
        fn get_pt(self: @ContractState, sy: ContractAddress, expiry: u64) -> ContractAddress {
            self.pt_registry.read((sy, expiry))
        }

        /// Get the YT address for a given SY and expiry
        fn get_yt(self: @ContractState, sy: ContractAddress, expiry: u64) -> ContractAddress {
            self.yt_registry.read((sy, expiry))
        }

        /// Check if a PT address was deployed by this factory
        fn is_valid_pt(self: @ContractState, pt: ContractAddress) -> bool {
            self.valid_pts.read(pt)
        }

        /// Check if a YT address was deployed by this factory
        fn is_valid_yt(self: @ContractState, yt: ContractAddress) -> bool {
            self.valid_yts.read(yt)
        }

        /// Get the YT class hash used for deployments
        fn yt_class_hash(self: @ContractState) -> ClassHash {
            self.yt_class_hash.read()
        }

        /// Get the PT class hash used for deployments
        fn pt_class_hash(self: @ContractState) -> ClassHash {
            self.pt_class_hash.read()
        }

        /// Set new class hashes for PT/YT deployments (owner only)
        fn set_class_hashes(
            ref self: ContractState, yt_class_hash: ClassHash, pt_class_hash: ClassHash,
        ) {
            self.ownable.assert_only_owner();
            assert(!yt_class_hash.is_zero(), Errors::ZERO_ADDRESS);
            assert(!pt_class_hash.is_zero(), Errors::ZERO_ADDRESS);

            self.yt_class_hash.write(yt_class_hash);
            self.pt_class_hash.write(pt_class_hash);

            self.emit(ClassHashesUpdated { yt_class_hash, pt_class_hash });
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

        // ============ SYWithRewards Support ============

        /// Get the SYWithRewards class hash used for deployments
        fn sy_with_rewards_class_hash(self: @ContractState) -> ClassHash {
            self.sy_with_rewards_class_hash.read()
        }

        /// Set the SYWithRewards class hash (owner only)
        fn set_sy_with_rewards_class_hash(ref self: ContractState, class_hash: ClassHash) {
            self.ownable.assert_only_owner();
            assert(!class_hash.is_zero(), Errors::ZERO_ADDRESS);

            let old_class_hash = self.sy_with_rewards_class_hash.read();
            self.sy_with_rewards_class_hash.write(class_hash);

            self.emit(SYWithRewardsClassHashUpdated { old_class_hash, new_class_hash: class_hash });
        }

        /// Deploy a new SYWithRewards contract
        fn deploy_sy_with_rewards(
            ref self: ContractState,
            name: ByteArray,
            symbol: ByteArray,
            underlying: ContractAddress,
            index_oracle: ContractAddress,
            is_erc4626: bool,
            asset_type: AssetType,
            pauser: ContractAddress,
            tokens_in: Span<ContractAddress>,
            tokens_out: Span<ContractAddress>,
            reward_tokens: Span<ContractAddress>,
            salt: felt252,
        ) -> ContractAddress {
            // Validate inputs
            assert(!underlying.is_zero(), Errors::ZERO_ADDRESS);
            assert(!index_oracle.is_zero(), Errors::ZERO_ADDRESS);
            assert(!pauser.is_zero(), Errors::ZERO_ADDRESS);

            let class_hash = self.sy_with_rewards_class_hash.read();
            assert(!class_hash.is_zero(), Errors::ZERO_ADDRESS);

            // Build constructor calldata for SYWithRewards
            // Constructor: name, symbol, underlying, index_oracle, is_erc4626, asset_type, pauser,
            // tokens_in, tokens_out, reward_tokens
            let mut calldata: Array<felt252> = array![];

            // Serialize name (ByteArray)
            Serde::serialize(@name, ref calldata);

            // Serialize symbol (ByteArray)
            Serde::serialize(@symbol, ref calldata);

            // Underlying address
            calldata.append(underlying.into());

            // Index oracle address
            calldata.append(index_oracle.into());

            // is_erc4626 (bool)
            calldata.append(if is_erc4626 {
                1
            } else {
                0
            });

            // Asset type (enum)
            Serde::serialize(@asset_type, ref calldata);

            // Pauser address
            calldata.append(pauser.into());

            // Serialize tokens_in (Span<ContractAddress>)
            Serde::serialize(@tokens_in, ref calldata);

            // Serialize tokens_out (Span<ContractAddress>)
            Serde::serialize(@tokens_out, ref calldata);

            // Serialize reward_tokens (Span<ContractAddress>)
            Serde::serialize(@reward_tokens, ref calldata);

            // Deploy SYWithRewards contract
            let (sy_address, _) = match deploy_syscall(class_hash, salt, calldata.span(), false) {
                Result::Ok(result) => result,
                Result::Err(_) => panic!("{}", Errors::FACTORY_DEPLOY_FAILED),
            };

            // Register the new SY contract
            self.valid_sys.write(sy_address, true);

            // Emit deployment event
            self
                .emit(
                    SYWithRewardsDeployed {
                        sy: sy_address,
                        name,
                        symbol,
                        underlying,
                        deployer: get_caller_address(),
                        timestamp: get_block_timestamp(),
                    },
                );

            sy_address
        }

        /// Check if an SY address was deployed by this factory
        fn is_valid_sy(self: @ContractState, sy: ContractAddress) -> bool {
            self.valid_sys.read(sy)
        }

        // ============ Treasury Support ============

        /// Get the treasury address for protocol fee collection and post-expiry yield
        fn treasury(self: @ContractState) -> ContractAddress {
            self.treasury.read()
        }

        /// Set the treasury address (owner only)
        fn set_treasury(ref self: ContractState, treasury: ContractAddress) {
            self.ownable.assert_only_owner();
            assert(!treasury.is_zero(), Errors::ZERO_ADDRESS);
            self.treasury.write(treasury);
        }

        // ============ Fee Rate Management ============

        /// Get the reward fee rate (in WAD, 10^18 = 100%)
        fn get_reward_fee_rate(self: @ContractState) -> u256 {
            self.reward_fee_rate.read()
        }

        /// Set the reward fee rate (owner only)
        /// @param rate Fee rate in WAD (e.g., 3% = 0.03 * 10^18)
        fn set_reward_fee_rate(ref self: ContractState, rate: u256) {
            self.ownable.assert_only_owner();
            assert(rate <= MAX_REWARD_FEE_RATE, Errors::FACTORY_INVALID_FEE_RATE);

            let old_rate = self.reward_fee_rate.read();
            self.reward_fee_rate.write(rate);

            self.emit(RewardFeeRateSet { old_fee_rate: old_rate, new_fee_rate: rate });
        }

        /// Get the default interest fee rate (in WAD, 10^18 = 100%)
        fn get_default_interest_fee_rate(self: @ContractState) -> u256 {
            self.default_interest_fee_rate.read()
        }

        /// Set the default interest fee rate (owner only)
        /// @param rate Fee rate in WAD (e.g., 3% = 0.03 * 10^18)
        fn set_default_interest_fee_rate(ref self: ContractState, rate: u256) {
            self.ownable.assert_only_owner();
            assert(rate <= MAX_INTEREST_FEE_RATE, Errors::FACTORY_INVALID_FEE_RATE);

            let old_rate = self.default_interest_fee_rate.read();
            self.default_interest_fee_rate.write(rate);

            self.emit(DefaultInterestFeeRateSet { old_fee_rate: old_rate, new_fee_rate: rate });
        }
    }
}

/// Interface for ERC20 metadata (symbol) - used for underlying token enrichment
#[starknet::interface]
pub trait IERC20Metadata<TContractState> {
    fn symbol(self: @TContractState) -> ByteArray;
}
