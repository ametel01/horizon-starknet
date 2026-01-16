pub mod Errors {
    // General errors
    pub const ZERO_ADDRESS: felt252 = 'HZN: zero address';
    pub const ZERO_AMOUNT: felt252 = 'HZN: zero amount';
    pub const UNAUTHORIZED: felt252 = 'HZN: unauthorized';

    // SY errors
    pub const SY_ZERO_DEPOSIT: felt252 = 'HZN: zero deposit';
    pub const SY_ZERO_REDEEM: felt252 = 'HZN: zero redeem';
    pub const SY_INSUFFICIENT_BALANCE: felt252 = 'HZN: insufficient balance';
    pub const SY_EMPTY_TOKENS_IN: felt252 = 'HZN: empty tokens_in';
    pub const SY_EMPTY_TOKENS_OUT: felt252 = 'HZN: empty tokens_out';
    pub const SY_INVALID_TOKEN_IN: felt252 = 'HZN: invalid token_in';
    pub const SY_INVALID_TOKEN_OUT: felt252 = 'HZN: invalid token_out';
    pub const SY_INSUFFICIENT_SHARES_OUT: felt252 = 'HZN: insufficient shares out';
    pub const SY_INSUFFICIENT_TOKEN_OUT: felt252 = 'HZN: insufficient token out';

    // PT errors
    pub const PT_ONLY_YT: felt252 = 'HZN: only YT';
    pub const PT_ONLY_DEPLOYER: felt252 = 'HZN: only deployer';
    pub const PT_YT_NOT_SET: felt252 = 'HZN: YT not set';
    pub const PT_YT_ALREADY_SET: felt252 = 'HZN: YT already set';
    pub const PT_INVALID_EXPIRY: felt252 = 'HZN: invalid expiry';

    // YT errors
    pub const YT_EXPIRED: felt252 = 'HZN: expired';
    pub const YT_NOT_EXPIRED: felt252 = 'HZN: not expired';
    pub const YT_INVALID_EXPIRY: felt252 = 'HZN: invalid expiry';
    pub const YT_INSUFFICIENT_PT: felt252 = 'HZN: insufficient PT';
    pub const YT_INSUFFICIENT_YT: felt252 = 'HZN: insufficient YT';
    pub const YT_INSUFFICIENT_SY: felt252 = 'HZN: insufficient SY';
    pub const YT_INVALID_FEE_RATE: felt252 = 'HZN: invalid fee rate';
    pub const YT_ARRAY_LENGTH_MISMATCH: felt252 = 'HZN: array length mismatch';
    pub const YT_NO_FLOATING_SY: felt252 = 'HZN: no floating SY';
    pub const YT_NO_FLOATING_PY: felt252 = 'HZN: no floating PT/YT';
    pub const YT_NO_FLOATING_PT: felt252 = 'HZN: no floating PT';
    pub const YT_PT_YT_MISMATCH: felt252 = 'HZN: PT/YT amount mismatch';

    // Market errors
    pub const MARKET_EXPIRED: felt252 = 'HZN: market expired';
    pub const MARKET_INSUFFICIENT_LIQUIDITY: felt252 = 'HZN: insufficient liquidity';
    pub const MARKET_SLIPPAGE_EXCEEDED: felt252 = 'HZN: slippage exceeded';
    pub const MARKET_ZERO_LIQUIDITY: felt252 = 'HZN: zero liquidity';
    pub const MARKET_INVALID_RESERVES: felt252 = 'HZN: invalid reserves';
    pub const MARKET_TRANSFER_FAILED: felt252 = 'HZN: transfer failed';
    pub const MARKET_INVALID_TRADE: felt252 = 'HZN: invalid trade direction';
    pub const MARKET_RATE_BELOW_ONE: felt252 = 'HZN: rate below 1';
    pub const MARKET_PROPORTION_TOO_HIGH: felt252 = 'HZN: proportion > 96%';
    pub const MARKET_INFEASIBLE_TRADE: felt252 = 'HZN: trade infeasible';

    // Market Factory errors
    pub const MARKET_FACTORY_ALREADY_EXISTS: felt252 = 'HZN: market already exists';
    pub const MARKET_FACTORY_DEPLOY_FAILED: felt252 = 'HZN: market deploy failed';
    pub const INDEX_OUT_OF_BOUNDS: felt252 = 'HZN: index out of bounds';
    pub const MARKET_FACTORY_INVALID_SCALAR: felt252 = 'HZN: invalid scalar';
    pub const MARKET_FACTORY_INVALID_ANCHOR: felt252 = 'HZN: invalid anchor';
    pub const MARKET_FACTORY_INVALID_FEE: felt252 = 'HZN: invalid fee';
    pub const MARKET_FACTORY_INVALID_MARKET: felt252 = 'HZN: invalid market';
    pub const MARKET_FACTORY_OVERRIDE_TOO_HIGH: felt252 = 'HZN: override fee too high';

    // Router errors
    pub const ROUTER_SLIPPAGE_EXCEEDED: felt252 = 'HZN: slippage exceeded';
    pub const ROUTER_DEADLINE_EXCEEDED: felt252 = 'HZN: deadline exceeded';
    pub const ROUTER_ROLLOVER_PT_MISMATCH: felt252 = 'HZN: rollover PT mismatch';
    pub const ROUTER_ROLLOVER_SY_MISMATCH: felt252 = 'HZN: rollover SY mismatch';
    pub const ROUTER_MULTICALL_INVALID_TARGET: felt252 = 'HZN: multicall invalid target';
    pub const ROUTER_MULTICALL_FAILED: felt252 = 'HZN: multicall call failed';
    pub const ROUTER_INVALID_AGGREGATOR: felt252 = 'HZN: invalid aggregator';
    pub const ROUTER_AGGREGATOR_SWAP_FAILED: felt252 = 'HZN: aggregator swap failed';
    pub const ROUTER_TOKEN_NOT_SUPPORTED: felt252 = 'HZN: token not supported';

    // Math errors
    pub const MATH_OVERFLOW: felt252 = 'HZN: overflow';
    pub const MATH_UNDERFLOW: felt252 = 'HZN: underflow';
    pub const MATH_DIVISION_BY_ZERO: felt252 = 'HZN: division by zero';

    // Factory errors
    pub const FACTORY_ALREADY_EXISTS: felt252 = 'HZN: pair already exists';
    pub const FACTORY_INVALID_EXPIRY: felt252 = 'HZN: invalid expiry';
    pub const FACTORY_DEPLOY_FAILED: felt252 = 'HZN: deploy failed';

    // RBAC errors
    pub const RBAC_ALREADY_INITIALIZED: felt252 = 'HZN: RBAC already init';

    // PragmaIndexOracle errors
    pub const PIO_ZERO_ADMIN: felt252 = 'HZN: zero admin';
    pub const PIO_ZERO_ORACLE: felt252 = 'HZN: zero oracle';
    pub const PIO_ZERO_PAIR: felt252 = 'HZN: zero numerator pair';
    pub const PIO_INVALID_INDEX: felt252 = 'HZN: invalid initial index';
    pub const PIO_NOT_ADMIN: felt252 = 'HZN: not admin';
    pub const PIO_PAUSED: felt252 = 'HZN: paused';
    pub const PIO_WINDOW_TOO_SHORT: felt252 = 'HZN: window too short';
    pub const PIO_STALENESS_INVALID: felt252 = 'HZN: staleness < window';
    pub const PIO_ZERO_DENOM_PRICE: felt252 = 'HZN: zero denom price';
    pub const PIO_INDEX_BELOW_WAD: felt252 = 'HZN: index below WAD';

    // RewardManager errors
    pub const REWARD_EMPTY_TOKENS: felt252 = 'HZN: empty reward tokens';
    pub const REWARD_TOKEN_EXISTS: felt252 = 'HZN: reward token exists';
    pub const REWARD_TRANSFER_FAILED: felt252 = 'HZN: reward transfer failed';

    // Oracle errors
    pub const ORACLE_ZERO_CARDINALITY: felt252 = 'HZN: oracle zero cardinality';
    pub const ORACLE_TARGET_TOO_OLD: felt252 = 'HZN: oracle target too old';
    pub const ORACLE_TARGET_IN_FUTURE: felt252 = 'HZN: oracle target in future';
    pub const ORACLE_UNINITIALIZED: felt252 = 'HZN: oracle uninitialized';
    pub const ORACLE_INVALID_OBS_LENGTH: felt252 = 'HZN: invalid obs length';
    pub const ORACLE_INDEX_OUT_OF_BOUNDS: felt252 = 'HZN: oracle idx out of bounds';
    pub const ORACLE_CARDINALITY_EXCEEDS_MAX: felt252 = 'HZN: cardinality exceeds max';
}
