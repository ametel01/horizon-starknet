use horizon::libraries::math::WAD;
use starknet::ContractAddress;

/// Time constants
const SECONDS_PER_YEAR: u64 = 31536000; // 365 days
const DEFAULT_YIELD_RATE_BPS: u32 = 500; // 5% APR default

/// Mock yield-bearing token for testing (ERC-4626 compatible)
/// A non-rebasing, value-accruing shares token with:
/// - An underlying ERC20 asset
/// - Time-based yield simulation (index increases over time)
/// - Full ERC-4626 deposit/mint/withdraw/redeem functions
///
/// The index automatically increases based on deployment timestamp:
///   current_index = base_index * (1 + annual_yield_rate * time_elapsed / year)
///
/// Mimics Nostra's nstSTRK and other ERC-4626 vaults.
/// Can be used as:
/// - The underlying token for SY
/// - Its own index oracle (via convert_to_assets)
#[starknet::contract]
pub mod MockYieldToken {
    use core::num::traits::Bounded;
    use horizon::interfaces::i_erc4626::IERC4626;
    use openzeppelin_token::erc20::{DefaultConfig, ERC20Component, ERC20HooksEmptyImpl};
    use starknet::storage::{
        StorageMapReadAccess, StoragePointerReadAccess, StoragePointerWriteAccess,
    };
    use starknet::{ContractAddress, get_block_timestamp, get_caller_address, get_contract_address};
    use super::{
        DEFAULT_YIELD_RATE_BPS, IERC20Dispatcher, IERC20DispatcherTrait, SECONDS_PER_YEAR, WAD,
    };

    component!(path: ERC20Component, storage: erc20, event: ERC20Event);

    impl ERC20InternalImpl = ERC20Component::InternalImpl<ContractState>;

    #[storage]
    struct Storage {
        #[substorage(v0)]
        erc20: ERC20Component::Storage,
        // The underlying asset (e.g., STRK)
        underlying: ContractAddress,
        // The base index in WAD (starts at 1e18)
        // This is the baseline - actual index increases over time
        base_index_wad: u256,
        // Deployment timestamp for yield calculation
        deployment_timestamp: u64,
        // Annual yield rate in basis points (e.g., 500 = 5% APR)
        annual_yield_rate_bps: u32,
        // Admin address for test controls
        admin: ContractAddress,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        #[flat]
        ERC20Event: ERC20Component::Event,
        IndexUpdated: IndexUpdated,
        Deposit: Deposit,
        Withdraw: Withdraw,
    }

    #[derive(Drop, starknet::Event)]
    pub struct IndexUpdated {
        pub old_index: u256,
        pub new_index: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Deposit {
        #[key]
        pub caller: ContractAddress,
        #[key]
        pub owner: ContractAddress,
        pub assets: u256,
        pub shares: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Withdraw {
        #[key]
        pub caller: ContractAddress,
        #[key]
        pub receiver: ContractAddress,
        #[key]
        pub owner: ContractAddress,
        pub assets: u256,
        pub shares: u256,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        name: ByteArray,
        symbol: ByteArray,
        underlying: ContractAddress,
        admin: ContractAddress,
    ) {
        self.erc20.initializer(name, symbol);
        self.underlying.write(underlying);
        self.base_index_wad.write(WAD); // Start at 1:1
        self.deployment_timestamp.write(get_block_timestamp());
        self.annual_yield_rate_bps.write(DEFAULT_YIELD_RATE_BPS); // 5% APR default
        self.admin.write(admin);
    }

    #[abi(embed_v0)]
    impl ERC4626Impl of IERC4626<ContractState> {
        // ============ ERC20 Base ============

        fn name(self: @ContractState) -> ByteArray {
            self.erc20.ERC20_name.read()
        }

        fn symbol(self: @ContractState) -> ByteArray {
            self.erc20.ERC20_symbol.read()
        }

        fn decimals(self: @ContractState) -> u8 {
            18
        }

        fn total_supply(self: @ContractState) -> u256 {
            self.erc20.ERC20_total_supply.read()
        }

        fn balance_of(self: @ContractState, account: ContractAddress) -> u256 {
            self.erc20.ERC20_balances.read(account)
        }

        fn allowance(
            self: @ContractState, owner: ContractAddress, spender: ContractAddress,
        ) -> u256 {
            self.erc20.ERC20_allowances.read((owner, spender))
        }

        fn transfer(ref self: ContractState, recipient: ContractAddress, amount: u256) -> bool {
            let sender = get_caller_address();
            self.erc20._transfer(sender, recipient, amount);
            true
        }

        fn transfer_from(
            ref self: ContractState,
            sender: ContractAddress,
            recipient: ContractAddress,
            amount: u256,
        ) -> bool {
            let caller = get_caller_address();
            self.erc20._spend_allowance(sender, caller, amount);
            self.erc20._transfer(sender, recipient, amount);
            true
        }

        fn approve(ref self: ContractState, spender: ContractAddress, amount: u256) -> bool {
            let caller = get_caller_address();
            self.erc20._approve(caller, spender, amount);
            true
        }

        // ============ ERC-4626 Asset Info ============

        fn asset(self: @ContractState) -> ContractAddress {
            self.underlying.read()
        }

        fn total_assets(self: @ContractState) -> u256 {
            // Total assets = total shares * current_index / WAD
            let total_shares = self.erc20.ERC20_total_supply.read();
            let index = InternalImpl::_get_current_index(self);
            (total_shares * index) / WAD
        }

        // ============ ERC-4626 Conversion Functions ============

        fn convert_to_shares(self: @ContractState, assets: u256) -> u256 {
            let index = InternalImpl::_get_current_index(self);
            if index == 0 {
                return assets; // 1:1 if index is 0
            }
            (assets * WAD) / index
        }

        fn convert_to_assets(self: @ContractState, shares: u256) -> u256 {
            let index = InternalImpl::_get_current_index(self);
            (shares * index) / WAD
        }

        // ============ ERC-4626 Deposit Functions ============

        fn max_deposit(self: @ContractState, receiver: ContractAddress) -> u256 {
            // No deposit limit for mock
            Bounded::<u256>::MAX
        }

        fn preview_deposit(self: @ContractState, assets: u256) -> u256 {
            Self::convert_to_shares(self, assets)
        }

        fn deposit(ref self: ContractState, assets: u256, receiver: ContractAddress) -> u256 {
            assert(assets > 0, 'MYT: zero assets');

            let caller = get_caller_address();

            // Calculate shares
            let shares = Self::convert_to_shares(@self, assets);
            assert(shares > 0, 'MYT: zero shares');

            // Transfer underlying from caller
            let underlying = IERC20Dispatcher { contract_address: self.underlying.read() };
            let success = underlying.transfer_from(caller, get_contract_address(), assets);
            assert(success, 'MYT: transfer failed');

            // Mint shares to receiver
            self.erc20.mint(receiver, shares);

            self.emit(Deposit { caller, owner: receiver, assets, shares });

            shares
        }

        // ============ ERC-4626 Mint Functions ============

        fn max_mint(self: @ContractState, receiver: ContractAddress) -> u256 {
            // No mint limit for mock
            Bounded::<u256>::MAX
        }

        fn preview_mint(self: @ContractState, shares: u256) -> u256 {
            Self::convert_to_assets(self, shares)
        }

        fn mint(ref self: ContractState, shares: u256, receiver: ContractAddress) -> u256 {
            assert(shares > 0, 'MYT: zero shares');

            let caller = get_caller_address();

            // Calculate assets needed
            let assets = Self::convert_to_assets(@self, shares);
            assert(assets > 0, 'MYT: zero assets');

            // Transfer underlying from caller
            let underlying = IERC20Dispatcher { contract_address: self.underlying.read() };
            let success = underlying.transfer_from(caller, get_contract_address(), assets);
            assert(success, 'MYT: transfer failed');

            // Mint shares to receiver
            self.erc20.mint(receiver, shares);

            self.emit(Deposit { caller, owner: receiver, assets, shares });

            assets
        }

        // ============ ERC-4626 Withdraw Functions ============

        fn max_withdraw(self: @ContractState, owner: ContractAddress) -> u256 {
            let shares = self.erc20.ERC20_balances.read(owner);
            Self::convert_to_assets(self, shares)
        }

        fn preview_withdraw(self: @ContractState, assets: u256) -> u256 {
            Self::convert_to_shares(self, assets)
        }

        fn withdraw(
            ref self: ContractState,
            assets: u256,
            receiver: ContractAddress,
            owner: ContractAddress,
        ) -> u256 {
            assert(assets > 0, 'MYT: zero assets');

            let caller = get_caller_address();

            // Calculate shares to burn
            let shares = Self::convert_to_shares(@self, assets);
            assert(shares > 0, 'MYT: zero shares');

            // If caller is not owner, check and spend allowance
            if caller != owner {
                self.erc20._spend_allowance(owner, caller, shares);
            }

            // Burn shares from owner
            self.erc20.burn(owner, shares);

            // Transfer underlying to receiver
            let underlying = IERC20Dispatcher { contract_address: self.underlying.read() };
            let success = underlying.transfer(receiver, assets);
            assert(success, 'MYT: transfer failed');

            self.emit(Withdraw { caller, receiver, owner, assets, shares });

            shares
        }

        // ============ ERC-4626 Redeem Functions ============

        fn max_redeem(self: @ContractState, owner: ContractAddress) -> u256 {
            self.erc20.ERC20_balances.read(owner)
        }

        fn preview_redeem(self: @ContractState, shares: u256) -> u256 {
            Self::convert_to_assets(self, shares)
        }

        fn redeem(
            ref self: ContractState,
            shares: u256,
            receiver: ContractAddress,
            owner: ContractAddress,
        ) -> u256 {
            assert(shares > 0, 'MYT: zero shares');

            let caller = get_caller_address();

            // If caller is not owner, check and spend allowance
            if caller != owner {
                self.erc20._spend_allowance(owner, caller, shares);
            }

            // Calculate assets
            let assets = Self::convert_to_assets(@self, shares);
            assert(assets > 0, 'MYT: zero assets');

            // Burn shares from owner
            self.erc20.burn(owner, shares);

            // Transfer underlying to receiver
            let underlying = IERC20Dispatcher { contract_address: self.underlying.read() };
            let success = underlying.transfer(receiver, assets);
            assert(success, 'MYT: transfer failed');

            self.emit(Withdraw { caller, receiver, owner, assets, shares });

            assets
        }
    }

    #[abi(embed_v0)]
    impl MockYieldTokenExtImpl of super::IMockYieldTokenExt<ContractState> {
        /// Get the current index (for compatibility with IIndexOracle)
        /// Index increases over time based on deployment timestamp and yield rate
        fn index(self: @ContractState) -> u256 {
            InternalImpl::_get_current_index(self)
        }

        /// Get the base index (without time-based yield)
        fn base_index(self: @ContractState) -> u256 {
            self.base_index_wad.read()
        }

        /// Set the base index (admin only, for testing)
        fn set_index(ref self: ContractState, new_index_wad: u256) {
            let caller = get_caller_address();
            assert(caller == self.admin.read(), 'MYT: not admin');

            let old_index = self.base_index_wad.read();
            // Enforce monotonic non-decreasing (can be removed for negative yield tests)
            assert(new_index_wad >= old_index, 'MYT: index can only increase');

            self.base_index_wad.write(new_index_wad);
            self.emit(IndexUpdated { old_index, new_index: new_index_wad });
        }

        /// Increase base index by basis points (admin only, for testing)
        fn increase_index_bps(ref self: ContractState, bps: u32) {
            let caller = get_caller_address();
            assert(caller == self.admin.read(), 'MYT: not admin');

            let old_index = self.base_index_wad.read();
            // new_index = old_index * (10000 + bps) / 10000
            let new_index = (old_index * (10000 + bps.into())) / 10000;

            self.base_index_wad.write(new_index);
            self.emit(IndexUpdated { old_index, new_index });
        }

        /// Set the annual yield rate in basis points (admin only, for testing)
        fn set_yield_rate_bps(ref self: ContractState, rate_bps: u32) {
            let caller = get_caller_address();
            assert(caller == self.admin.read(), 'MYT: not admin');
            self.annual_yield_rate_bps.write(rate_bps);
        }

        /// Get the annual yield rate in basis points
        fn get_yield_rate_bps(self: @ContractState) -> u32 {
            self.annual_yield_rate_bps.read()
        }

        /// Get the deployment timestamp
        fn get_deployment_timestamp(self: @ContractState) -> u64 {
            self.deployment_timestamp.read()
        }

        /// Mint shares directly to an address (admin only, for testing)
        /// Bypasses deposit flow - useful for test setup
        fn mint_shares(ref self: ContractState, to: ContractAddress, shares: u256) {
            let caller = get_caller_address();
            assert(caller == self.admin.read(), 'MYT: not admin');
            self.erc20.mint(to, shares);
        }

        /// Get the admin address
        fn admin(self: @ContractState) -> ContractAddress {
            self.admin.read()
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        /// Calculate the current index with time-based yield accrual
        /// current_index = base_index * (1 + annual_yield_rate * time_elapsed / year)
        fn _get_current_index(self: @ContractState) -> u256 {
            let base_index = self.base_index_wad.read();
            let yield_rate_bps = self.annual_yield_rate_bps.read();
            let deployment_ts = self.deployment_timestamp.read();
            let current_time = get_block_timestamp();

            // Time elapsed since deployment
            let time_elapsed = if current_time > deployment_ts {
                current_time - deployment_ts
            } else {
                0
            };

            // Calculate yield accrual
            // yield = base_index * yield_rate_bps * time_elapsed / (10000 * SECONDS_PER_YEAR)
            if yield_rate_bps > 0 && time_elapsed > 0 {
                let time_elapsed_u256: u256 = time_elapsed.into();
                let base_u256: u256 = base_index;
                let yield_bps_u256: u256 = yield_rate_bps.into();
                let seconds_per_year_u256: u256 = SECONDS_PER_YEAR.into();

                // Calculate yield: base * rate * time / (10000 * year)
                let numerator: u256 = base_u256 * yield_bps_u256 * time_elapsed_u256;
                let denominator: u256 = 10000_u256 * seconds_per_year_u256;
                let yield_accrual: u256 = numerator / denominator;

                base_index + yield_accrual
            } else {
                base_index
            }
        }
    }
}

/// Extended interface for MockYieldToken (includes test controls)
#[starknet::interface]
pub trait IMockYieldTokenExt<TContractState> {
    // Index access (for IIndexOracle compatibility)
    fn index(self: @TContractState) -> u256;
    fn base_index(self: @TContractState) -> u256;

    // Yield rate controls
    fn set_yield_rate_bps(ref self: TContractState, rate_bps: u32);
    fn get_yield_rate_bps(self: @TContractState) -> u32;
    fn get_deployment_timestamp(self: @TContractState) -> u64;

    // Test controls (admin only)
    fn set_index(ref self: TContractState, new_index_wad: u256);
    fn increase_index_bps(ref self: TContractState, bps: u32);
    fn mint_shares(ref self: TContractState, to: ContractAddress, shares: u256);
    fn admin(self: @TContractState) -> ContractAddress;
}

/// Combined interface for testing convenience
/// Includes full ERC-4626 and test controls
#[starknet::interface]
pub trait IMockYieldToken<TContractState> {
    // ERC20 standard
    fn name(self: @TContractState) -> ByteArray;
    fn symbol(self: @TContractState) -> ByteArray;
    fn decimals(self: @TContractState) -> u8;
    fn total_supply(self: @TContractState) -> u256;
    fn balance_of(self: @TContractState, account: ContractAddress) -> u256;
    fn allowance(self: @TContractState, owner: ContractAddress, spender: ContractAddress) -> u256;
    fn transfer(ref self: TContractState, recipient: ContractAddress, amount: u256) -> bool;
    fn transfer_from(
        ref self: TContractState, sender: ContractAddress, recipient: ContractAddress, amount: u256,
    ) -> bool;
    fn approve(ref self: TContractState, spender: ContractAddress, amount: u256) -> bool;

    // ERC-4626 Asset Info
    fn asset(self: @TContractState) -> ContractAddress;
    fn total_assets(self: @TContractState) -> u256;

    // ERC-4626 Conversion Functions
    fn convert_to_shares(self: @TContractState, assets: u256) -> u256;
    fn convert_to_assets(self: @TContractState, shares: u256) -> u256;

    // ERC-4626 Deposit Functions
    fn max_deposit(self: @TContractState, receiver: ContractAddress) -> u256;
    fn preview_deposit(self: @TContractState, assets: u256) -> u256;
    fn deposit(ref self: TContractState, assets: u256, receiver: ContractAddress) -> u256;

    // ERC-4626 Mint Functions
    fn max_mint(self: @TContractState, receiver: ContractAddress) -> u256;
    fn preview_mint(self: @TContractState, shares: u256) -> u256;
    fn mint(ref self: TContractState, shares: u256, receiver: ContractAddress) -> u256;

    // ERC-4626 Withdraw Functions
    fn max_withdraw(self: @TContractState, owner: ContractAddress) -> u256;
    fn preview_withdraw(self: @TContractState, assets: u256) -> u256;
    fn withdraw(
        ref self: TContractState, assets: u256, receiver: ContractAddress, owner: ContractAddress,
    ) -> u256;

    // ERC-4626 Redeem Functions
    fn max_redeem(self: @TContractState, owner: ContractAddress) -> u256;
    fn preview_redeem(self: @TContractState, shares: u256) -> u256;
    fn redeem(
        ref self: TContractState, shares: u256, receiver: ContractAddress, owner: ContractAddress,
    ) -> u256;

    // Index (IIndexOracle compatibility)
    fn index(self: @TContractState) -> u256;
    fn base_index(self: @TContractState) -> u256;

    // Yield rate controls
    fn set_yield_rate_bps(ref self: TContractState, rate_bps: u32);
    fn get_yield_rate_bps(self: @TContractState) -> u32;
    fn get_deployment_timestamp(self: @TContractState) -> u64;

    // Test controls (admin only)
    fn set_index(ref self: TContractState, new_index_wad: u256);
    fn increase_index_bps(ref self: TContractState, bps: u32);
    fn mint_shares(ref self: TContractState, to: ContractAddress, shares: u256);
    fn admin(self: @TContractState) -> ContractAddress;
}

/// Interface for calling external ERC20 tokens
#[starknet::interface]
pub trait IERC20<TContractState> {
    fn transfer(ref self: TContractState, recipient: ContractAddress, amount: u256) -> bool;
    fn transfer_from(
        ref self: TContractState, sender: ContractAddress, recipient: ContractAddress, amount: u256,
    ) -> bool;
    fn balance_of(self: @TContractState, account: ContractAddress) -> u256;
}
