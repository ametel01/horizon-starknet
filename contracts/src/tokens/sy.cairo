use starknet::ContractAddress;

/// Standardized Yield (SY) Token
/// Wraps yield-bearing tokens into a standardized interface.
/// 1 SY represents a claim to the underlying yield-bearing asset.
/// The exchange_rate tracks how much underlying 1 SY is worth.
#[starknet::contract]
pub mod SY {
    use core::num::traits::Zero;
    use openzeppelin_token::erc20::{DefaultConfig, ERC20Component, ERC20HooksEmptyImpl};
    use starknet::storage::{
        StorageMapReadAccess, StoragePointerReadAccess, StoragePointerWriteAccess,
    };
    use starknet::{ContractAddress, get_caller_address, get_contract_address};
    use yield_tokenization::interfaces::i_sy::ISY;
    use yield_tokenization::libraries::errors::Errors;
    use yield_tokenization::libraries::math::{WAD, wad_div, wad_mul};
    use super::{IERC20Dispatcher, IERC20DispatcherTrait};

    component!(path: ERC20Component, storage: erc20, event: ERC20Event);

    // Only use internal impl - do NOT embed ERC20MixinImpl to avoid duplicate entry points
    impl ERC20InternalImpl = ERC20Component::InternalImpl<ContractState>;

    #[storage]
    struct Storage {
        #[substorage(v0)]
        erc20: ERC20Component::Storage,
        // The underlying yield-bearing token address
        underlying: ContractAddress,
        // Current exchange rate: how much underlying per 1 SY (in WAD)
        // Starts at 1 WAD (1:1) and increases as yield accrues
        exchange_rate_stored: u256,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        #[flat]
        ERC20Event: ERC20Component::Event,
        Deposit: Deposit,
        Redeem: Redeem,
        ExchangeRateUpdated: ExchangeRateUpdated,
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

    #[derive(Drop, starknet::Event)]
    pub struct ExchangeRateUpdated {
        pub old_rate: u256,
        pub new_rate: u256,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        name: ByteArray,
        symbol: ByteArray,
        underlying: ContractAddress,
        initial_exchange_rate: u256,
    ) {
        // Initialize ERC20
        self.erc20.initializer(name, symbol);

        // Initialize SY state
        assert(!underlying.is_zero(), Errors::ZERO_ADDRESS);
        self.underlying.write(underlying);

        // Set initial exchange rate (default to 1 WAD if not specified)
        let rate = if initial_exchange_rate == 0 {
            WAD
        } else {
            initial_exchange_rate
        };
        self.exchange_rate_stored.write(rate);
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

        /// Deposit underlying tokens to mint SY
        /// @param receiver Address to receive the minted SY
        /// @param amount_token_to_deposit Amount of underlying to deposit
        /// @return Amount of SY minted
        fn deposit(
            ref self: ContractState, receiver: ContractAddress, amount_token_to_deposit: u256,
        ) -> u256 {
            assert(!receiver.is_zero(), Errors::ZERO_ADDRESS);
            assert(amount_token_to_deposit > 0, Errors::SY_ZERO_DEPOSIT);

            let caller = get_caller_address();

            // Transfer underlying from caller to this contract
            let underlying_addr = self.underlying.read();
            let mut underlying_token = IERC20Dispatcher { contract_address: underlying_addr };
            let success = underlying_token
                .transfer_from(caller, get_contract_address(), amount_token_to_deposit);
            assert(success, Errors::SY_INSUFFICIENT_BALANCE);

            // Calculate SY to mint based on exchange rate
            // sy_amount = underlying_amount / exchange_rate
            let exchange_rate = self.exchange_rate_stored.read();
            let sy_to_mint = wad_div(amount_token_to_deposit, exchange_rate);

            // Mint SY to receiver
            self.erc20.mint(receiver, sy_to_mint);

            self
                .emit(
                    Deposit {
                        caller,
                        receiver,
                        amount_deposited: amount_token_to_deposit,
                        amount_sy_minted: sy_to_mint,
                    },
                );

            sy_to_mint
        }

        /// Redeem SY for underlying tokens
        /// @param receiver Address to receive the underlying tokens
        /// @param amount_sy_to_redeem Amount of SY to burn
        /// @return Amount of underlying redeemed
        fn redeem(
            ref self: ContractState, receiver: ContractAddress, amount_sy_to_redeem: u256,
        ) -> u256 {
            assert(!receiver.is_zero(), Errors::ZERO_ADDRESS);
            assert(amount_sy_to_redeem > 0, Errors::SY_ZERO_REDEEM);

            let caller = get_caller_address();

            // Calculate underlying to return based on exchange rate
            // underlying_amount = sy_amount * exchange_rate
            let exchange_rate = self.exchange_rate_stored.read();
            let underlying_to_return = wad_mul(amount_sy_to_redeem, exchange_rate);

            // Burn SY from caller
            self.erc20.burn(caller, amount_sy_to_redeem);

            // Transfer underlying to receiver
            let underlying_addr = self.underlying.read();
            let mut underlying_token = IERC20Dispatcher { contract_address: underlying_addr };
            let success = underlying_token.transfer(receiver, underlying_to_return);
            assert(success, Errors::SY_INSUFFICIENT_BALANCE);

            self
                .emit(
                    Redeem {
                        caller,
                        receiver,
                        amount_sy_burned: amount_sy_to_redeem,
                        amount_redeemed: underlying_to_return,
                    },
                );

            underlying_to_return
        }

        /// Get the current exchange rate (underlying per SY in WAD)
        fn exchange_rate(self: @ContractState) -> u256 {
            self.exchange_rate_stored.read()
        }

        /// Get the underlying token address
        fn underlying_asset(self: @ContractState) -> ContractAddress {
            self.underlying.read()
        }
    }

    // Internal functions
    #[generate_trait]
    pub impl InternalImpl of InternalTrait {
        /// Update the exchange rate (called when yield accrues)
        /// Only increases - the rate should never decrease (watermark)
        fn update_exchange_rate(ref self: ContractState, new_rate: u256) {
            let old_rate = self.exchange_rate_stored.read();

            // Watermark: exchange rate can only increase
            if new_rate > old_rate {
                self.exchange_rate_stored.write(new_rate);
                self.emit(ExchangeRateUpdated { old_rate, new_rate });
            }
        }

        /// Preview how much SY would be minted for a deposit
        fn preview_deposit(self: @ContractState, amount_to_deposit: u256) -> u256 {
            let exchange_rate = self.exchange_rate_stored.read();
            wad_div(amount_to_deposit, exchange_rate)
        }

        /// Preview how much underlying would be returned for a redemption
        fn preview_redeem(self: @ContractState, amount_sy: u256) -> u256 {
            let exchange_rate = self.exchange_rate_stored.read();
            wad_mul(amount_sy, exchange_rate)
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
