use horizon::libraries::math::WAD;
use starknet::ContractAddress;

/// Mock yield-bearing token for testing (ERC4626-like)
/// A non-rebasing, value-accruing shares token with:
/// - An underlying ERC20 asset
/// - An externally settable index for yield simulation
/// - ERC4626-like deposit/redeem functions
///
/// Implements both IYieldToken and IIndexOracle, so it can be used as:
/// - The underlying token for SY
/// - The index oracle for SY (same address)
#[starknet::contract]
pub mod MockYieldToken {
    use horizon::interfaces::i_yield_token::IYieldToken;
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
        // The underlying asset (e.g., mock USDC or ETH)
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
        pub receiver: ContractAddress,
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
    impl MockYieldTokenImpl of IYieldToken<ContractState> {
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

        /// Returns the underlying asset address
        fn asset(self: @ContractState) -> ContractAddress {
            self.underlying.read()
        }

        /// Returns the current index (exchange rate) in WAD
        fn index(self: @ContractState) -> u256 {
            self.index_wad.read()
        }

        /// Convert shares to assets: assets = floor(shares * index / WAD)
        fn convert_to_assets(self: @ContractState, shares: u256) -> u256 {
            let index = self.index_wad.read();
            (shares * index) / WAD
        }

        /// Convert assets to shares: shares = floor(assets * WAD / index)
        fn convert_to_shares(self: @ContractState, assets: u256) -> u256 {
            let index = self.index_wad.read();
            (assets * WAD) / index
        }
    }

    // Note: IYieldToken already implements index(), which satisfies IIndexOracle
    // The ABI exposes `index()` which can be called via IIndexOracleDispatcher

    #[abi(embed_v0)]
    impl MockYieldTokenExtImpl of super::IMockYieldTokenExt<ContractState> {
        /// Deposit underlying assets to mint shares
        /// @param assets Amount of underlying assets to deposit
        /// @param receiver Address to receive the minted shares
        /// @return shares Amount of shares minted
        fn deposit(ref self: ContractState, assets: u256, receiver: ContractAddress) -> u256 {
            assert(assets > 0, 'MYT: zero assets');

            let caller = get_caller_address();
            let index = self.index_wad.read();

            // Calculate shares: shares = floor(assets * WAD / index)
            let shares = (assets * WAD) / index;
            assert(shares > 0, 'MYT: zero shares');

            // Transfer underlying from caller
            let underlying = IERC20Dispatcher { contract_address: self.underlying.read() };
            let success = underlying.transfer_from(caller, get_contract_address(), assets);
            assert(success, 'MYT: transfer failed');

            // Mint shares to receiver
            self.erc20.mint(receiver, shares);

            self.emit(Deposit { caller, receiver, assets, shares });

            shares
        }

        /// Redeem shares for underlying assets
        /// @param shares Amount of shares to redeem
        /// @param receiver Address to receive the underlying assets
        /// @param owner Address that owns the shares
        /// @return assets Amount of assets returned
        fn redeem(
            ref self: ContractState,
            shares: u256,
            receiver: ContractAddress,
            owner: ContractAddress,
        ) -> u256 {
            assert(shares > 0, 'MYT: zero shares');

            let caller = get_caller_address();
            let index = self.index_wad.read();

            // If caller is not owner, check and spend allowance
            if caller != owner {
                self.erc20._spend_allowance(owner, caller, shares);
            }

            // Calculate assets: assets = floor(shares * index / WAD)
            let assets = (shares * index) / WAD;
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

        /// Set the index (admin only, for testing)
        /// @param new_index_wad New index value in WAD
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
        /// @param bps Basis points to increase (e.g., 100 = 1%)
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
    // ERC4626-like deposit/redeem
    fn deposit(ref self: TContractState, assets: u256, receiver: ContractAddress) -> u256;
    fn redeem(
        ref self: TContractState, shares: u256, receiver: ContractAddress, owner: ContractAddress,
    ) -> u256;

    // Test controls (admin only)
    fn set_index(ref self: TContractState, new_index_wad: u256);
    fn increase_index_bps(ref self: TContractState, bps: u32);
    fn mint_shares(ref self: TContractState, to: ContractAddress, shares: u256);
    fn admin(self: @TContractState) -> ContractAddress;
}

/// Combined interface for testing convenience
/// Includes IYieldToken (ERC20 + index) and IMockYieldTokenExt (test controls)
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

    // Yield token specific
    fn asset(self: @TContractState) -> ContractAddress;
    fn index(self: @TContractState) -> u256;
    fn convert_to_assets(self: @TContractState, shares: u256) -> u256;
    fn convert_to_shares(self: @TContractState, assets: u256) -> u256;

    // ERC4626-like deposit/redeem
    fn deposit(ref self: TContractState, assets: u256, receiver: ContractAddress) -> u256;
    fn redeem(
        ref self: TContractState, shares: u256, receiver: ContractAddress, owner: ContractAddress,
    ) -> u256;

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
