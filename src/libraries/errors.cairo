pub mod Errors {
    // General errors
    pub const ZERO_ADDRESS: felt252 = 'YT: zero address';
    pub const ZERO_AMOUNT: felt252 = 'YT: zero amount';
    pub const UNAUTHORIZED: felt252 = 'YT: unauthorized';

    // SY errors
    pub const SY_ZERO_DEPOSIT: felt252 = 'SY: zero deposit';
    pub const SY_ZERO_REDEEM: felt252 = 'SY: zero redeem';
    pub const SY_INSUFFICIENT_BALANCE: felt252 = 'SY: insufficient balance';

    // PT errors
    pub const PT_ONLY_YT: felt252 = 'PT: only YT';
    pub const PT_YT_NOT_SET: felt252 = 'PT: YT not set';
    pub const PT_YT_ALREADY_SET: felt252 = 'PT: YT already set';
    pub const PT_INVALID_EXPIRY: felt252 = 'PT: invalid expiry';

    // YT errors
    pub const YT_EXPIRED: felt252 = 'YT: expired';
    pub const YT_NOT_EXPIRED: felt252 = 'YT: not expired';
    pub const YT_INVALID_EXPIRY: felt252 = 'YT: invalid expiry';
    pub const YT_INSUFFICIENT_PT: felt252 = 'YT: insufficient PT';
    pub const YT_INSUFFICIENT_YT: felt252 = 'YT: insufficient YT';
    pub const YT_INSUFFICIENT_SY: felt252 = 'YT: insufficient SY';

    // Market errors
    pub const MARKET_EXPIRED: felt252 = 'Market: expired';
    pub const MARKET_INSUFFICIENT_LIQUIDITY: felt252 = 'Market: insufficient liquidity';
    pub const MARKET_SLIPPAGE_EXCEEDED: felt252 = 'Market: slippage exceeded';
    pub const MARKET_ZERO_LIQUIDITY: felt252 = 'Market: zero liquidity';
    pub const MARKET_INVALID_RESERVES: felt252 = 'Market: invalid reserves';

    // Market Factory errors
    pub const MARKET_FACTORY_ALREADY_EXISTS: felt252 = 'MktFactory: already exists';
    pub const MARKET_FACTORY_DEPLOY_FAILED: felt252 = 'MktFactory: deploy failed';

    // Math errors
    pub const MATH_OVERFLOW: felt252 = 'Math: overflow';
    pub const MATH_UNDERFLOW: felt252 = 'Math: underflow';
    pub const MATH_DIVISION_BY_ZERO: felt252 = 'Math: division by zero';

    // Factory errors
    pub const FACTORY_ALREADY_EXISTS: felt252 = 'Factory: already exists';
    pub const FACTORY_INVALID_EXPIRY: felt252 = 'Factory: invalid expiry';
    pub const FACTORY_DEPLOY_FAILED: felt252 = 'Factory: deploy failed';
}
