use horizon::libraries::math::WAD;
use starknet::ContractAddress;

/// Mock yield-bearing token for testing (ERC-4626 compatible)
/// A non-rebasing, value-accruing shares token with:
/// - An underlying ERC20 asset
/// - An externally settable index for yield simulation
/// - Full ERC-4626 deposit/mint/withdraw/redeem functions
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
    use starknet::{ContractAddress, get_caller_address, get_contract_address};
    use super::{IERC20Dispatcher, IERC20DispatcherTrait, WAD};

    component!(path: ERC20Component, storage: erc20, event: ERC20Event);

    impl ERC20InternalImpl = ERC20Component::InternalImpl<ContractState>;

    #[storage]
    struct Storage {
        #[substorage(v0)]
        erc20: ERC20Component::Storage,
        // The underlying asset (e.g., STRK)
        underlying: ContractAddress,
        // The index in WAD (starts at 1e18, increases to represent yield)
        // assets = shares * index / WAD
        index_wad: u256,
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
        self.index_wad.write(WAD); // Start at 1:1
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
            // Total assets = total shares * index / WAD
            let total_shares = self.erc20.ERC20_total_supply.read();
            let index = self.index_wad.read();
            (total_shares * index) / WAD
        }

        // ============ ERC-4626 Conversion Functions ============

        fn convert_to_shares(self: @ContractState, assets: u256) -> u256 {
            let index = self.index_wad.read();
            if index == 0 {
                return assets; // 1:1 if index is 0
            }
            (assets * WAD) / index
        }

        fn convert_to_assets(self: @ContractState, shares: u256) -> u256 {
            let index = self.index_wad.read();
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
        fn index(self: @ContractState) -> u256 {
            self.index_wad.read()
        }

        /// Set the index (admin only, for testing)
        fn set_index(ref self: ContractState, new_index_wad: u256) {
            let caller = get_caller_address();
            assert(caller == self.admin.read(), 'MYT: not admin');

            let old_index = self.index_wad.read();
            // Enforce monotonic non-decreasing (can be removed for negative yield tests)
            assert(new_index_wad >= old_index, 'MYT: index can only increase');

            self.index_wad.write(new_index_wad);
            self.emit(IndexUpdated { old_index, new_index: new_index_wad });
        }

        /// Increase index by basis points (admin only, for testing)
        fn increase_index_bps(ref self: ContractState, bps: u32) {
            let caller = get_caller_address();
            assert(caller == self.admin.read(), 'MYT: not admin');

            let old_index = self.index_wad.read();
            // new_index = old_index * (10000 + bps) / 10000
            let new_index = (old_index * (10000 + bps.into())) / 10000;

            self.index_wad.write(new_index);
            self.emit(IndexUpdated { old_index, new_index });
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
}

/// Extended interface for MockYieldToken (includes test controls)
#[starknet::interface]
pub trait IMockYieldTokenExt<TContractState> {
    // Index access (for IIndexOracle compatibility)
    fn index(self: @TContractState) -> u256;

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
