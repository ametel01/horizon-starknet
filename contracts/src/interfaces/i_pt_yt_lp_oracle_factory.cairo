use horizon::interfaces::i_pt_yt_lp_oracle::OracleType;
use starknet::{ClassHash, ContractAddress};

/// Interface for the PT/YT/LP Oracle Factory.
/// Deploys per-market oracle instances, prevents duplicates, and provides a registry.
///
/// Reference: Pendle's PendleChainlinkOracleFactory.sol
#[starknet::interface]
pub trait IPtYtLpOracleFactory<TContractState> {
    /// Deploy a new oracle instance. Reverts if duplicate (market, duration, oracle_type).
    fn deploy_oracle(
        ref self: TContractState, market: ContractAddress, duration: u32, oracle_type: OracleType,
    ) -> ContractAddress;

    /// Look up an existing oracle. Returns zero address if not deployed.
    fn get_oracle(
        self: @TContractState, market: ContractAddress, duration: u32, oracle_type: OracleType,
    ) -> ContractAddress;

    /// PyLpOracle address used by all deployed instances.
    fn py_lp_oracle(self: @TContractState) -> ContractAddress;

    /// Oracle class hash used for deployment.
    fn oracle_class_hash(self: @TContractState) -> ClassHash;

    /// Total number of oracles deployed.
    fn oracle_count(self: @TContractState) -> u32;
}
