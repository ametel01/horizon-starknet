/// PT/YT/LP Oracle Wrapper Contract
///
/// Each instance is immutably configured for one (market, duration, oracle_type) combination.
/// Delegates price computation to the stateless PyLpOracle helper contract.
///
/// Non-upgradeable by design — external protocols get a stable, trustworthy price feed address.
///
/// Reference: Pendle's PendleChainlinkOracle.sol

#[starknet::contract]
pub mod PtYtLpOracle {
    use core::num::traits::Zero;
    use horizon::interfaces::i_pt_yt_lp_oracle::{IPtYtLpOracle, OracleType, PriceFeedResponse};
    use horizon::interfaces::i_py_lp_oracle::{IPyLpOracleDispatcher, IPyLpOracleDispatcherTrait};
    use horizon::libraries::errors::Errors;
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use starknet::{ContractAddress, get_block_timestamp};

    #[storage]
    struct Storage {
        py_lp_oracle: ContractAddress,
        market: ContractAddress,
        duration: u32,
        oracle_type: OracleType,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        py_lp_oracle: ContractAddress,
        market: ContractAddress,
        duration: u32,
        oracle_type: OracleType,
    ) {
        assert(!py_lp_oracle.is_zero(), Errors::PTYLP_ZERO_ORACLE);
        assert(!market.is_zero(), Errors::PTYLP_ZERO_MARKET);

        self.py_lp_oracle.write(py_lp_oracle);
        self.market.write(market);
        self.duration.write(duration);
        self.oracle_type.write(oracle_type);
    }

    #[abi(embed_v0)]
    impl PtYtLpOracleImpl of IPtYtLpOracle<ContractState> {
        /// Get the current price by delegating to PyLpOracle.
        fn get_price(self: @ContractState) -> u256 {
            let oracle = IPyLpOracleDispatcher { contract_address: self.py_lp_oracle.read() };
            let market_addr = self.market.read();
            let dur = self.duration.read();

            match self.oracle_type.read() {
                OracleType::PT_TO_SY => oracle.get_pt_to_sy_rate(market_addr, dur),
                OracleType::YT_TO_SY => oracle.get_yt_to_sy_rate(market_addr, dur),
                OracleType::LP_TO_SY => oracle.get_lp_to_sy_rate(market_addr, dur),
                OracleType::PT_TO_ASSET => oracle.get_pt_to_asset_rate(market_addr, dur),
                OracleType::YT_TO_ASSET => oracle.get_yt_to_asset_rate(market_addr, dur),
                OracleType::LP_TO_ASSET => oracle.get_lp_to_asset_rate(market_addr, dur),
            }
        }

        /// Get full price response with metadata.
        fn get_price_response(self: @ContractState) -> PriceFeedResponse {
            PriceFeedResponse {
                price: self.get_price(),
                decimals: 18,
                last_updated: get_block_timestamp(),
                oracle_type: self.oracle_type.read(),
            }
        }

        fn market(self: @ContractState) -> ContractAddress {
            self.market.read()
        }

        fn duration(self: @ContractState) -> u32 {
            self.duration.read()
        }

        fn oracle_type(self: @ContractState) -> OracleType {
            self.oracle_type.read()
        }

        fn py_lp_oracle(self: @ContractState) -> ContractAddress {
            self.py_lp_oracle.read()
        }
    }
}
