/// Factory Contract
/// Deploys and tracks PT/YT pairs for different SY tokens and expiries.
/// Each (SY, expiry) combination can only have one PT/YT pair.
#[starknet::contract]
pub mod Factory {
    use core::num::traits::Zero;
    use horizon::interfaces::i_factory::IFactory;
    use horizon::interfaces::i_sy::{ISYDispatcher, ISYDispatcherTrait};
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
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        YieldContractsCreated: YieldContractsCreated,
        ClassHashesUpdated: ClassHashesUpdated,
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
    }

    #[derive(Drop, starknet::Event)]
    pub struct ClassHashesUpdated {
        pub yt_class_hash: ClassHash,
        pub pt_class_hash: ClassHash,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        yt_class_hash: ClassHash,
        pt_class_hash: ClassHash,
    ) {
        assert(!yt_class_hash.is_zero(), Errors::ZERO_ADDRESS);
        assert(!pt_class_hash.is_zero(), Errors::ZERO_ADDRESS);

        self.ownable.initializer(owner);
        self.yt_class_hash.write(yt_class_hash);
        self.pt_class_hash.write(pt_class_hash);
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

            // Build YT constructor calldata
            // YT constructor: name, symbol, sy, pt_class_hash, expiry
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

            // Emit event
            self
                .emit(
                    YieldContractsCreated {
                        sy, expiry, pt: pt_address, yt: yt_address, creator: get_caller_address(),
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
    }
}
