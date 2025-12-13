use starknet::ContractAddress;

/// Principal Token (PT)
/// Represents the principal portion of a yield-bearing asset.
/// PT can be redeemed for the underlying SY at or after expiry.
/// PT + YT = 1 SY (before expiry)

/// Interface for PT initialization (separate from IPT)
#[starknet::interface]
pub trait IPTInit<TContractState> {
    fn initialize_yt(ref self: TContractState, yt: ContractAddress);
}

#[starknet::contract]
pub mod PT {
    use core::num::traits::Zero;
    use openzeppelin_token::erc20::{DefaultConfig, ERC20Component, ERC20HooksEmptyImpl};
    use starknet::storage::{
        StorageMapReadAccess, StoragePointerReadAccess, StoragePointerWriteAccess,
    };
    use starknet::{ContractAddress, get_block_timestamp, get_caller_address};
    use yield_tokenization::interfaces::i_pt::IPT;
    use yield_tokenization::libraries::errors::Errors;

    component!(path: ERC20Component, storage: erc20, event: ERC20Event);

    // Only use internal impl - we implement our own IPT interface
    impl ERC20InternalImpl = ERC20Component::InternalImpl<ContractState>;

    #[storage]
    struct Storage {
        #[substorage(v0)]
        erc20: ERC20Component::Storage,
        // The SY token this PT is derived from
        sy: ContractAddress,
        // The corresponding YT contract (only YT can mint/burn PT)
        yt: ContractAddress,
        // Expiry timestamp (Unix seconds)
        expiry: u64,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        #[flat]
        ERC20Event: ERC20Component::Event,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        name: ByteArray,
        symbol: ByteArray,
        sy: ContractAddress,
        expiry: u64,
    ) {
        // Initialize ERC20
        self.erc20.initializer(name, symbol);

        // Initialize PT state
        assert(!sy.is_zero(), Errors::ZERO_ADDRESS);
        assert(expiry > get_block_timestamp(), Errors::PT_INVALID_EXPIRY);

        self.sy.write(sy);
        self.expiry.write(expiry);
        // YT address will be set after deployment via initialize_yt
    // This is because YT deploys PT, so PT doesn't know YT's address at construction
    }

    #[abi(embed_v0)]
    impl PTImpl of IPT<ContractState> {
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

        /// Get the SY token address
        fn sy(self: @ContractState) -> ContractAddress {
            self.sy.read()
        }

        /// Get the YT token address
        fn yt(self: @ContractState) -> ContractAddress {
            self.yt.read()
        }

        /// Get the expiry timestamp
        fn expiry(self: @ContractState) -> u64 {
            self.expiry.read()
        }

        /// Check if the PT has expired
        fn is_expired(self: @ContractState) -> bool {
            get_block_timestamp() >= self.expiry.read()
        }

        /// Mint PT tokens - only callable by YT contract
        fn mint(ref self: ContractState, to: ContractAddress, amount: u256) {
            self.assert_only_yt();
            assert(!to.is_zero(), Errors::ZERO_ADDRESS);
            self.erc20.mint(to, amount);
        }

        /// Burn PT tokens - only callable by YT contract
        fn burn(ref self: ContractState, from: ContractAddress, amount: u256) {
            self.assert_only_yt();
            self.erc20.burn(from, amount);
        }
    }

    // External initialization function (separate from IPT interface)
    #[abi(embed_v0)]
    impl PTInitImpl of super::IPTInit<ContractState> {
        fn initialize_yt(ref self: ContractState, yt: ContractAddress) {
            assert(self.yt.read().is_zero(), Errors::PT_YT_ALREADY_SET);
            assert(!yt.is_zero(), Errors::ZERO_ADDRESS);
            self.yt.write(yt);
        }
    }

    // Internal functions
    #[generate_trait]
    pub impl InternalImpl of InternalTrait {
        /// Assert that caller is the YT contract
        fn assert_only_yt(self: @ContractState) {
            let caller = get_caller_address();
            let yt = self.yt.read();
            assert(!yt.is_zero(), Errors::PT_YT_NOT_SET);
            assert(caller == yt, Errors::PT_ONLY_YT);
        }
    }
}
