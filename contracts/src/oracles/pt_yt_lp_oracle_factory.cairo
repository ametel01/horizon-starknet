/// PT/YT/LP Oracle Factory Contract
///
/// Deploys per-market oracle wrapper instances, prevents duplicates, and provides a registry.
/// Upgradeable and owner-controlled, following the MarketFactory pattern.
///
/// Registry key: (market, packed_felt252) where packed_felt252 = duration * 256 + oracle_type_index
/// This gives one storage slot per unique (market, duration, oracle_type) triple.
///
/// Reference: Pendle's PendleChainlinkOracleFactory.sol

#[starknet::contract]
pub mod PtYtLpOracleFactory {
    use core::num::traits::Zero;
    use horizon::interfaces::i_pt_yt_lp_oracle::OracleType;
    use horizon::interfaces::i_pt_yt_lp_oracle_factory::IPtYtLpOracleFactory;
    use horizon::libraries::errors::Errors;
    use openzeppelin_access::ownable::OwnableComponent;
    use openzeppelin_interfaces::upgrades::IUpgradeable;
    use openzeppelin_upgrades::UpgradeableComponent;
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };
    use starknet::syscalls::deploy_syscall;
    use starknet::{ClassHash, ContractAddress};

    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);
    component!(path: UpgradeableComponent, storage: upgradeable, event: UpgradeableEvent);

    #[abi(embed_v0)]
    impl OwnableImpl = OwnableComponent::OwnableImpl<ContractState>;
    impl OwnableInternalImpl = OwnableComponent::InternalImpl<ContractState>;
    impl UpgradeableInternalImpl = UpgradeableComponent::InternalImpl<ContractState>;

    #[storage]
    struct Storage {
        #[substorage(v0)]
        ownable: OwnableComponent::Storage,
        #[substorage(v0)]
        upgradeable: UpgradeableComponent::Storage,
        /// Class hash for PtYtLpOracle contract deployment
        oracle_class_hash: ClassHash,
        /// PyLpOracle address passed to all deployed oracle instances
        py_lp_oracle: ContractAddress,
        /// Registry: (market, packed_key) -> oracle address
        registry: Map<(ContractAddress, felt252), ContractAddress>,
        /// Total number of oracles deployed (also used as deploy salt)
        oracle_count: u32,
        /// List of all oracle addresses (indexed)
        oracle_list: Map<u32, ContractAddress>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        OracleDeployed: OracleDeployed,
        #[flat]
        OwnableEvent: OwnableComponent::Event,
        #[flat]
        UpgradeableEvent: UpgradeableComponent::Event,
    }

    #[derive(Drop, starknet::Event)]
    pub struct OracleDeployed {
        #[key]
        pub market: ContractAddress,
        pub duration: u32,
        pub oracle_type: OracleType,
        pub oracle_address: ContractAddress,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        oracle_class_hash: ClassHash,
        py_lp_oracle: ContractAddress,
    ) {
        assert(!oracle_class_hash.is_zero(), Errors::ZERO_ADDRESS);
        assert(!py_lp_oracle.is_zero(), Errors::PTYLP_ZERO_ORACLE);

        self.ownable.initializer(owner);
        self.oracle_class_hash.write(oracle_class_hash);
        self.py_lp_oracle.write(py_lp_oracle);
        self.oracle_count.write(0);
    }

    #[abi(embed_v0)]
    impl UpgradeableImpl of IUpgradeable<ContractState> {
        fn upgrade(ref self: ContractState, new_class_hash: ClassHash) {
            self.ownable.assert_only_owner();
            self.upgradeable.upgrade(new_class_hash);
        }
    }

    #[abi(embed_v0)]
    impl PtYtLpOracleFactoryImpl of IPtYtLpOracleFactory<ContractState> {
        /// Deploy a new oracle instance. Reverts if duplicate (market, duration, oracle_type).
        fn deploy_oracle(
            ref self: ContractState,
            market: ContractAddress,
            duration: u32,
            oracle_type: OracleType,
        ) -> ContractAddress {
            assert(!market.is_zero(), Errors::PTYLP_ZERO_MARKET);

            // Check for duplicate
            let key = encode_registry_key(duration, oracle_type);
            let existing = self.registry.read((market, key));
            assert(existing.is_zero(), Errors::PTYLP_FACTORY_DUPLICATE);

            // Build constructor calldata: (py_lp_oracle, market, duration, oracle_type)
            let py_lp_oracle = self.py_lp_oracle.read();
            let mut calldata: Array<felt252> = array![];
            calldata.append(py_lp_oracle.into());
            calldata.append(market.into());
            calldata.append(duration.into());
            Serde::serialize(@oracle_type, ref calldata);

            // Deploy with counter-based salt
            let count = self.oracle_count.read();
            let salt: felt252 = count.into();
            let class_hash = self.oracle_class_hash.read();

            let (oracle_address, _) =
                match deploy_syscall(class_hash, salt, calldata.span(), false) {
                Result::Ok(result) => result,
                Result::Err(_) => panic!("{}", Errors::PTYLP_FACTORY_DEPLOY_FAILED),
            };

            // Register in registry + oracle_list
            self.registry.write((market, key), oracle_address);
            self.oracle_list.write(count, oracle_address);
            self.oracle_count.write(count + 1);

            // Emit event
            self.emit(OracleDeployed { market, duration, oracle_type, oracle_address });

            oracle_address
        }

        /// Look up an existing oracle. Returns zero address if not deployed.
        fn get_oracle(
            self: @ContractState, market: ContractAddress, duration: u32, oracle_type: OracleType,
        ) -> ContractAddress {
            let key = encode_registry_key(duration, oracle_type);
            self.registry.read((market, key))
        }

        fn py_lp_oracle(self: @ContractState) -> ContractAddress {
            self.py_lp_oracle.read()
        }

        fn oracle_class_hash(self: @ContractState) -> ClassHash {
            self.oracle_class_hash.read()
        }

        fn oracle_count(self: @ContractState) -> u32 {
            self.oracle_count.read()
        }
    }

    /// Encode (duration, oracle_type) into a single felt252 for the registry map key.
    /// Layout: duration * 256 + oracle_type_index (fits since duration is u32 and type is 0-5).
    fn encode_registry_key(duration: u32, oracle_type: OracleType) -> felt252 {
        let duration_felt: felt252 = duration.into();
        let type_index: felt252 = match oracle_type {
            OracleType::PT_TO_SY => 0,
            OracleType::YT_TO_SY => 1,
            OracleType::LP_TO_SY => 2,
            OracleType::PT_TO_ASSET => 3,
            OracleType::YT_TO_ASSET => 4,
            OracleType::LP_TO_ASSET => 5,
        };
        duration_felt * 256 + type_index
    }
}
