/// Market Factory Contract
/// Deploys and tracks Market contracts for PT/SY trading pools.
/// Each PT can only have one market.
#[starknet::contract]
pub mod MarketFactory {
    use core::num::traits::Zero;
    use horizon::interfaces::i_market_factory::IMarketFactory;
    use horizon::interfaces::i_pt::{IPTDispatcher, IPTDispatcherTrait};
    use horizon::libraries::errors::Errors;
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };
    use starknet::syscalls::deploy_syscall;
    use starknet::{ClassHash, ContractAddress, get_block_timestamp, get_caller_address};

    #[storage]
    struct Storage {
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
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        MarketCreated: MarketCreated,
    }

    #[derive(Drop, starknet::Event)]
    pub struct MarketCreated {
        #[key]
        pub pt: ContractAddress,
        pub market: ContractAddress,
        pub creator: ContractAddress,
        pub scalar_root: u256,
        pub initial_anchor: u256,
        pub fee_rate: u256,
    }

    #[constructor]
    fn constructor(ref self: ContractState, market_class_hash: ClassHash) {
        assert(!market_class_hash.is_zero(), Errors::ZERO_ADDRESS);
        self.market_class_hash.write(market_class_hash);
        self.deploy_count.write(0);
        self.market_count.write(0);
    }

    #[abi(embed_v0)]
    impl MarketFactoryImpl of IMarketFactory<ContractState> {
        /// Create a new market for a PT token
        /// @param pt The PT token address
        /// @param scalar_root Controls rate sensitivity (in WAD)
        /// @param initial_anchor Initial ln(implied rate) (in WAD)
        /// @param fee_rate Fee rate in WAD (e.g., 0.01 WAD = 1%)
        /// @return The address of the created market
        fn create_market(
            ref self: ContractState,
            pt: ContractAddress,
            scalar_root: u256,
            initial_anchor: u256,
            fee_rate: u256,
        ) -> ContractAddress {
            // Validate inputs
            assert(!pt.is_zero(), Errors::ZERO_ADDRESS);

            // Check PT is valid and not expired
            let pt_contract = IPTDispatcher { contract_address: pt };
            let expiry = pt_contract.expiry();
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
            // Market constructor: name, symbol, pt, scalar_root, initial_anchor, fee_rate
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

            // fee_rate (u256 = 2 felts)
            calldata.append(fee_rate.low.into());
            calldata.append(fee_rate.high.into());

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

            // Emit event
            self
                .emit(
                    MarketCreated {
                        pt,
                        market: market_address,
                        creator: get_caller_address(),
                        scalar_root,
                        initial_anchor,
                        fee_rate,
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

        /// Get market address by index (0-based)
        fn get_market_at(self: @ContractState, index: u32) -> ContractAddress {
            assert(index < self.market_count.read(), Errors::INDEX_OUT_OF_BOUNDS);
            self.market_list.read(index)
        }
    }
}
