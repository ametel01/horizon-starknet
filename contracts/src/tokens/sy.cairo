use starknet::ContractAddress;

/// Standardized Yield (SY) Token
/// Wraps yield-bearing tokens into a standardized interface.
/// 1 SY represents 1 share of the underlying yield-bearing asset.
///
/// The exchange_rate can come from two sources:
/// 1. Native yield tokens: The underlying token itself implements index()
/// 2. Bridged tokens (like wstETH): A separate oracle provides the index
///
/// Constructor takes an `index_oracle` parameter:
/// - For native tokens: pass underlying address (implements IIndexOracle)
/// - For bridged tokens: pass oracle address that syncs from L1
#[starknet::contract]
pub mod SY {
    use core::num::traits::Zero;
    use horizon::interfaces::i_index_oracle::{IIndexOracleDispatcher, IIndexOracleDispatcherTrait};
    use horizon::interfaces::i_sy::ISY;
    use horizon::libraries::errors::Errors;
    use openzeppelin_token::erc20::{DefaultConfig, ERC20Component, ERC20HooksEmptyImpl};
    use starknet::storage::{
        StorageMapReadAccess, StoragePointerReadAccess, StoragePointerWriteAccess,
    };
    use starknet::{ContractAddress, get_caller_address, get_contract_address};
    use super::{IERC20Dispatcher, IERC20DispatcherTrait};

    component!(path: ERC20Component, storage: erc20, event: ERC20Event);

    // Only use internal impl - do NOT embed ERC20MixinImpl to avoid duplicate entry points
    impl ERC20InternalImpl = ERC20Component::InternalImpl<ContractState>;

    #[storage]
    struct Storage {
        #[substorage(v0)]
        erc20: ERC20Component::Storage,
        // The underlying yield-bearing token address (ERC20)
        underlying: ContractAddress,
        // The index oracle address (implements IIndexOracle)
        // Can be same as underlying for native yield tokens,
        // or a separate oracle for bridged tokens
        index_oracle: ContractAddress,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        #[flat]
        ERC20Event: ERC20Component::Event,
        Deposit: Deposit,
        Redeem: Redeem,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Deposit {
        #[key]
        pub caller: ContractAddress,
        #[key]
        pub receiver: ContractAddress,
        pub amount_deposited: u256,
        pub amount_sy_minted: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Redeem {
        #[key]
        pub caller: ContractAddress,
        #[key]
        pub receiver: ContractAddress,
        pub amount_sy_burned: u256,
        pub amount_redeemed: u256,
    }

    /// @param name SY token name
    /// @param symbol SY token symbol
    /// @param underlying The underlying yield-bearing token (ERC20)
    /// @param index_oracle The index source (same as underlying for native, or oracle for bridged)
    #[constructor]
    fn constructor(
        ref self: ContractState,
        name: ByteArray,
        symbol: ByteArray,
        underlying: ContractAddress,
        index_oracle: ContractAddress,
    ) {
        // Initialize ERC20
        self.erc20.initializer(name, symbol);

        // Initialize SY state
        assert(!underlying.is_zero(), Errors::ZERO_ADDRESS);
        assert(!index_oracle.is_zero(), Errors::ZERO_ADDRESS);
        self.underlying.write(underlying);
        self.index_oracle.write(index_oracle);
    }

    #[abi(embed_v0)]
    impl SYImpl of ISY<ContractState> {
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

        /// Deposit underlying yield-bearing tokens to mint SY
        /// SY is 1:1 with the underlying shares (not assets).
        /// @param receiver Address to receive the minted SY
        /// @param amount_shares_to_deposit Amount of underlying shares to deposit
        /// @return Amount of SY minted (equal to shares deposited)
        fn deposit(
            ref self: ContractState, receiver: ContractAddress, amount_shares_to_deposit: u256,
        ) -> u256 {
            assert(!receiver.is_zero(), Errors::ZERO_ADDRESS);
            assert(amount_shares_to_deposit > 0, Errors::SY_ZERO_DEPOSIT);

            let caller = get_caller_address();

            // Transfer underlying shares from caller to this contract
            let underlying_addr = self.underlying.read();
            let underlying_token = IERC20Dispatcher { contract_address: underlying_addr };
            let success = underlying_token
                .transfer_from(caller, get_contract_address(), amount_shares_to_deposit);
            assert(success, Errors::SY_INSUFFICIENT_BALANCE);

            // SY is 1:1 with underlying shares
            let sy_to_mint = amount_shares_to_deposit;

            // Mint SY to receiver
            self.erc20.mint(receiver, sy_to_mint);

            self
                .emit(
                    Deposit {
                        caller,
                        receiver,
                        amount_deposited: amount_shares_to_deposit,
                        amount_sy_minted: sy_to_mint,
                    },
                );

            sy_to_mint
        }

        /// Redeem SY for underlying yield-bearing tokens
        /// @param receiver Address to receive the underlying tokens
        /// @param amount_sy_to_redeem Amount of SY to burn
        /// @return Amount of underlying shares redeemed (equal to SY burned)
        fn redeem(
            ref self: ContractState, receiver: ContractAddress, amount_sy_to_redeem: u256,
        ) -> u256 {
            assert(!receiver.is_zero(), Errors::ZERO_ADDRESS);
            assert(amount_sy_to_redeem > 0, Errors::SY_ZERO_REDEEM);

            let caller = get_caller_address();

            // Burn SY from caller
            self.erc20.burn(caller, amount_sy_to_redeem);

            // SY is 1:1 with underlying shares
            let shares_to_return = amount_sy_to_redeem;

            // Transfer underlying to receiver
            let underlying_addr = self.underlying.read();
            let underlying_token = IERC20Dispatcher { contract_address: underlying_addr };
            let success = underlying_token.transfer(receiver, shares_to_return);
            assert(success, Errors::SY_INSUFFICIENT_BALANCE);

            self
                .emit(
                    Redeem {
                        caller,
                        receiver,
                        amount_sy_burned: amount_sy_to_redeem,
                        amount_redeemed: shares_to_return,
                    },
                );

            shares_to_return
        }

        /// Get the current exchange rate (assets per share in WAD)
        /// This reads from the configured index oracle
        fn exchange_rate(self: @ContractState) -> u256 {
            let oracle_addr = self.index_oracle.read();
            let oracle = IIndexOracleDispatcher { contract_address: oracle_addr };
            oracle.index()
        }

        /// Get the underlying token address
        fn underlying_asset(self: @ContractState) -> ContractAddress {
            self.underlying.read()
        }
    }

    // Internal functions
    #[generate_trait]
    pub impl InternalImpl of InternalTrait {
        /// Preview how much SY would be minted for a deposit (1:1)
        fn preview_deposit(self: @ContractState, amount_to_deposit: u256) -> u256 {
            amount_to_deposit
        }

        /// Preview how much underlying would be returned for a redemption (1:1)
        fn preview_redeem(self: @ContractState, amount_sy: u256) -> u256 {
            amount_sy
        }

        /// Get the index oracle address
        fn get_index_oracle(self: @ContractState) -> ContractAddress {
            self.index_oracle.read()
        }
    }
}

// Interface for calling external ERC20 tokens
#[starknet::interface]
pub trait IERC20<TContractState> {
    fn transfer(ref self: TContractState, recipient: ContractAddress, amount: u256) -> bool;
    fn transfer_from(
        ref self: TContractState, sender: ContractAddress, recipient: ContractAddress, amount: u256,
    ) -> bool;
    fn approve(ref self: TContractState, spender: ContractAddress, amount: u256) -> bool;
    fn balance_of(self: @TContractState, account: ContractAddress) -> u256;
}
