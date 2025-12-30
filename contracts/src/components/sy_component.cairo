/// SYComponent - Reusable component for Standardized Yield token logic
///
/// This component encapsulates the core SY functionality (deposit, redeem, exchange rate)
/// and uses a hooks pattern to bridge with the containing contract's ERC20 component
/// and other components (pausable, reentrancy guard, rewards, etc.).
///
/// Architecture:
/// ```
/// ┌─────────────────────────────────────────────────────────────────┐
/// │                        SY Contract                               │
/// │  ┌──────────────┐
/// ┌──────────────┐
/// ┌──────────────────────┐  │
/// │  │ ERC20Comp    │  │ SYComponent  │  │ Pausable/Ownable/etc │  │
/// │  │              │  │              │  │                      │  │
/// │  │ - balances   │  │ - underlying │  │ - paused             │  │
/// │  │ - supply     │  │ - oracle     │  │ - owner              │  │
/// │  │ - mint()     │◄─┤ - tokens_in  │  │                      │  │
/// │  │ - burn()     │  │ - deposit()  │  │                      │  │
/// │  └──────────────┘
/// └──────────────┘
/// └──────────────────────┘  │
/// │         ▲                  │                                     │
/// │         │    SYHooksTrait  │                                     │
/// │         └──────────────────┘
/// │
/// │                                                                  │
/// │  impl SYHooksImpl: mint_sy() → self.erc20.mint()                │
/// └─────────────────────────────────────────────────────────────────┘
/// ```
use starknet::ContractAddress;

/// Interface for calling external ERC20 tokens (component-local definition)
#[starknet::interface]
pub trait IERC20External<TContractState> {
    fn decimals(self: @TContractState) -> u8;
    fn transfer(ref self: TContractState, recipient: ContractAddress, amount: u256) -> bool;
    fn transfer_from(
        ref self: TContractState, sender: ContractAddress, recipient: ContractAddress, amount: u256,
    ) -> bool;
    fn approve(ref self: TContractState, spender: ContractAddress, amount: u256) -> bool;
    fn balance_of(self: @TContractState, account: ContractAddress) -> u256;
}

#[starknet::component]
pub mod SYComponent {
    use core::num::traits::Zero;
    use horizon::interfaces::i_erc4626::{IERC4626MinimalDispatcher, IERC4626MinimalDispatcherTrait};
    use horizon::interfaces::i_index_oracle::{IIndexOracleDispatcher, IIndexOracleDispatcherTrait};
    use horizon::interfaces::i_sy::AssetType;
    use horizon::libraries::errors::Errors;
    use horizon::libraries::math_fp::WAD;
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };
    use starknet::{ContractAddress, get_block_timestamp, get_caller_address, get_contract_address};
    use super::{IERC20ExternalDispatcher, IERC20ExternalDispatcherTrait};

    /// Component storage - contains SY-specific state (NOT ERC20)
    #[storage]
    pub struct Storage {
        /// The underlying yield-bearing token address (ERC20)
        pub underlying: ContractAddress,
        /// The index oracle address (implements IIndexOracle or IERC4626)
        /// Can be same as underlying for native yield tokens,
        /// or a separate oracle for bridged tokens
        pub index_oracle: ContractAddress,
        /// Whether the index_oracle is an ERC-4626 vault
        /// If true, call convert_to_assets(WAD) instead of index()
        pub is_erc4626: bool,
        /// Last recorded exchange rate (for OracleRateUpdated event)
        pub last_exchange_rate: u256,
        /// Multi-token support: valid tokens for deposit
        pub tokens_in: Map<u32, ContractAddress>,
        pub tokens_in_count: u32,
        /// Multi-token support: valid tokens for redemption
        pub tokens_out: Map<u32, ContractAddress>,
        pub tokens_out_count: u32,
        /// O(1) token validation maps
        pub valid_tokens_in: Map<ContractAddress, bool>,
        pub valid_tokens_out: Map<ContractAddress, bool>,
        /// Asset classification (Token or Liquidity)
        pub asset_type: AssetType,
    }

    /// Component events
    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        Deposit: Deposit,
        Redeem: Redeem,
        OracleRateUpdated: OracleRateUpdated,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Deposit {
        #[key]
        pub caller: ContractAddress,
        #[key]
        pub receiver: ContractAddress,
        #[key]
        pub underlying: ContractAddress,
        pub amount_deposited: u256,
        pub amount_sy_minted: u256,
        pub exchange_rate: u256,
        pub total_supply_after: u256,
        pub timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Redeem {
        #[key]
        pub caller: ContractAddress,
        #[key]
        pub receiver: ContractAddress,
        #[key]
        pub underlying: ContractAddress,
        pub amount_sy_burned: u256,
        pub amount_redeemed: u256,
        pub exchange_rate: u256,
        pub total_supply_after: u256,
        pub timestamp: u64,
    }

    /// Emitted when the oracle exchange rate changes during a state-changing operation
    #[derive(Drop, starknet::Event)]
    pub struct OracleRateUpdated {
        #[key]
        pub sy: ContractAddress,
        #[key]
        pub underlying: ContractAddress,
        pub old_rate: u256,
        pub new_rate: u256,
        pub rate_change_bps: u256,
        pub timestamp: u64,
    }

    /// Hooks trait - contracts MUST implement to bridge with ERC20 and other components
    ///
    /// This trait enables composition: the SY component doesn't know about ERC20 directly,
    /// but the containing contract implements these hooks to connect them.
    pub trait SYHooksTrait<TContractState> {
        /// Mint SY tokens (contract calls erc20.mint internally)
        fn mint_sy(ref self: TContractState, to: ContractAddress, amount: u256);

        /// Burn SY tokens (contract calls erc20.burn internally)
        fn burn_sy(ref self: TContractState, from: ContractAddress, amount: u256);

        /// Get total SY supply (contract reads from erc20)
        fn total_sy_supply(self: @TContractState) -> u256;

        /// Called before deposit - for pausable check, reentrancy guard start
        fn before_deposit(ref self: TContractState, receiver: ContractAddress, amount: u256);

        /// Called after deposit - for rewards tracking, reentrancy guard end
        fn after_deposit(ref self: TContractState, receiver: ContractAddress, sy_minted: u256);

        /// Called before redeem - for reentrancy guard start
        fn before_redeem(ref self: TContractState, receiver: ContractAddress, amount_sy: u256);

        /// Called after redeem - for rewards tracking, reentrancy guard end
        fn after_redeem(ref self: TContractState, receiver: ContractAddress, amount_redeemed: u256);
    }

    /// Internal implementation - core SY logic with hooks
    #[generate_trait]
    pub impl InternalImpl<
        TContractState,
        +HasComponent<TContractState>,
        +Drop<TContractState>,
        impl Hooks: SYHooksTrait<TContractState>,
    > of InternalTrait<TContractState> {
        /// Initialize the SY component state
        /// Called from contract constructor
        fn initializer(
            ref self: ComponentState<TContractState>,
            underlying: ContractAddress,
            index_oracle: ContractAddress,
            is_erc4626: bool,
            asset_type: AssetType,
            tokens_in: Span<ContractAddress>,
            tokens_out: Span<ContractAddress>,
        ) {
            // Validate addresses
            assert(!underlying.is_zero(), Errors::ZERO_ADDRESS);
            assert(!index_oracle.is_zero(), Errors::ZERO_ADDRESS);

            // Store core configuration
            self.underlying.write(underlying);
            self.index_oracle.write(index_oracle);
            self.is_erc4626.write(is_erc4626);
            self.asset_type.write(asset_type);

            // Initialize last exchange rate from oracle
            let initial_rate = if is_erc4626 {
                let vault = IERC4626MinimalDispatcher { contract_address: index_oracle };
                vault.convert_to_assets(WAD)
            } else {
                let oracle = IIndexOracleDispatcher { contract_address: index_oracle };
                oracle.index()
            };
            self.last_exchange_rate.write(initial_rate);

            // Initialize tokens_in (valid deposit tokens) with O(1) lookup map
            assert(tokens_in.len() > 0, Errors::SY_EMPTY_TOKENS_IN);
            let mut i: u32 = 0;
            for token in tokens_in {
                assert(!(*token).is_zero(), Errors::ZERO_ADDRESS);
                self.tokens_in.write(i, *token);
                self.valid_tokens_in.write(*token, true);
                i += 1;
            }
            self.tokens_in_count.write(i);

            // Initialize tokens_out (valid redemption tokens) with O(1) lookup map
            assert(tokens_out.len() > 0, Errors::SY_EMPTY_TOKENS_OUT);
            let mut j: u32 = 0;
            for token in tokens_out {
                assert(!(*token).is_zero(), Errors::ZERO_ADDRESS);
                self.tokens_out.write(j, *token);
                self.valid_tokens_out.write(*token, true);
                j += 1;
            }
            self.tokens_out_count.write(j);
        }

        /// Deposit underlying yield-bearing tokens to mint SY
        /// SY is 1:1 with the underlying shares (not assets).
        ///
        /// @param receiver Address to receive the minted SY
        /// @param amount_shares_to_deposit Amount of underlying shares to deposit
        /// @param min_shares_out Minimum SY shares to receive (slippage protection)
        /// @return Amount of SY minted (equal to shares deposited)
        fn deposit(
            ref self: ComponentState<TContractState>,
            receiver: ContractAddress,
            amount_shares_to_deposit: u256,
            min_shares_out: u256,
        ) -> u256 {
            // Get mutable reference to contract for hooks
            let mut contract = self.get_contract_mut();

            // Hook: before_deposit (pausable check, reentrancy start)
            Hooks::before_deposit(ref contract, receiver, amount_shares_to_deposit);

            // Validate inputs
            assert(!receiver.is_zero(), Errors::ZERO_ADDRESS);
            assert(amount_shares_to_deposit > 0, Errors::SY_ZERO_DEPOSIT);

            // Check and emit oracle rate update if rate changed
            self._check_and_emit_rate_update();

            let caller = get_caller_address();

            // Transfer underlying shares from caller to this contract
            // SECURITY: This external call happens before mint (CEI violation).
            // We trust underlying to be a standard ERC20 without transfer hooks.
            // Underlying tokens are vetted yield-bearing assets (stETH, nstSTRK, etc).
            let underlying_addr = self.underlying.read();
            let underlying_token = IERC20ExternalDispatcher { contract_address: underlying_addr };
            let success = underlying_token
                .transfer_from(caller, get_contract_address(), amount_shares_to_deposit);
            assert(success, Errors::SY_INSUFFICIENT_BALANCE);

            // SY is 1:1 with underlying shares
            let sy_to_mint = amount_shares_to_deposit;

            // Slippage protection: ensure minimum shares out
            assert(sy_to_mint >= min_shares_out, Errors::SY_INSUFFICIENT_SHARES_OUT);

            // Hook: mint SY tokens (delegates to contract's ERC20)
            let mut contract = self.get_contract_mut();
            Hooks::mint_sy(ref contract, receiver, sy_to_mint);

            // Get total supply after mint for event
            let contract = self.get_contract();
            let total_supply_after = Hooks::total_sy_supply(contract);

            // Emit SY event
            self
                .emit(
                    Deposit {
                        caller,
                        receiver,
                        underlying: underlying_addr,
                        amount_deposited: amount_shares_to_deposit,
                        amount_sy_minted: sy_to_mint,
                        exchange_rate: self._exchange_rate(),
                        total_supply_after,
                        timestamp: get_block_timestamp(),
                    },
                );

            // Hook: after_deposit (rewards update, reentrancy end)
            let mut contract = self.get_contract_mut();
            Hooks::after_deposit(ref contract, receiver, sy_to_mint);

            sy_to_mint
        }

        /// Redeem SY for underlying yield-bearing tokens
        ///
        /// @param receiver Address to receive the underlying tokens
        /// @param amount_sy_to_redeem Amount of SY to burn
        /// @param min_token_out Minimum underlying tokens to receive (slippage protection)
        /// @param burn_from_internal_balance If true, burn from contract's own balance (Router
        /// pattern)
        /// @return Amount of underlying shares redeemed (equal to SY burned)
        fn redeem(
            ref self: ComponentState<TContractState>,
            receiver: ContractAddress,
            amount_sy_to_redeem: u256,
            min_token_out: u256,
            burn_from_internal_balance: bool,
        ) -> u256 {
            // Get mutable reference to contract for hooks
            let mut contract = self.get_contract_mut();

            // Hook: before_redeem (reentrancy start)
            Hooks::before_redeem(ref contract, receiver, amount_sy_to_redeem);

            // Validate inputs
            assert(!receiver.is_zero(), Errors::ZERO_ADDRESS);
            assert(amount_sy_to_redeem > 0, Errors::SY_ZERO_REDEEM);

            // Check and emit oracle rate update if rate changed
            self._check_and_emit_rate_update();

            let caller = get_caller_address();

            // Burn SY from either internal balance or caller
            let burn_from = if burn_from_internal_balance {
                // Router pattern: burn from contract's own balance
                // Caller must have transferred SY to this contract first
                get_contract_address()
            } else {
                // Standard pattern: burn from caller
                caller
            };

            let mut contract = self.get_contract_mut();
            Hooks::burn_sy(ref contract, burn_from, amount_sy_to_redeem);

            // SY is 1:1 with underlying shares
            let shares_to_return = amount_sy_to_redeem;

            // Slippage protection: ensure minimum token out
            assert(shares_to_return >= min_token_out, Errors::SY_INSUFFICIENT_TOKEN_OUT);

            // Transfer underlying to receiver
            let underlying_addr = self.underlying.read();
            let underlying_token = IERC20ExternalDispatcher { contract_address: underlying_addr };
            let success = underlying_token.transfer(receiver, shares_to_return);
            assert(success, Errors::SY_INSUFFICIENT_BALANCE);

            // Get total supply after burn for event
            let contract = self.get_contract();
            let total_supply_after = Hooks::total_sy_supply(contract);

            self
                .emit(
                    Redeem {
                        caller,
                        receiver,
                        underlying: underlying_addr,
                        amount_sy_burned: amount_sy_to_redeem,
                        amount_redeemed: shares_to_return,
                        exchange_rate: self._exchange_rate(),
                        total_supply_after,
                        timestamp: get_block_timestamp(),
                    },
                );

            // Hook: after_redeem (rewards update, reentrancy end)
            let mut contract = self.get_contract_mut();
            Hooks::after_redeem(ref contract, receiver, shares_to_return);

            shares_to_return
        }

        /// Get the current exchange rate (assets per share in WAD)
        /// For ERC-4626 vaults: calls convert_to_assets(WAD)
        /// For custom oracles: calls index()
        fn _exchange_rate(self: @ComponentState<TContractState>) -> u256 {
            let oracle_addr = self.index_oracle.read();

            if self.is_erc4626.read() {
                // ERC-4626: convert_to_assets(1 share) = exchange rate
                let vault = IERC4626MinimalDispatcher { contract_address: oracle_addr };
                vault.convert_to_assets(WAD)
            } else {
                // Custom oracle: call index()
                let oracle = IIndexOracleDispatcher { contract_address: oracle_addr };
                oracle.index()
            }
        }

        /// Check if exchange rate changed and emit OracleRateUpdated event if so
        /// Called during state-changing operations (deposit, redeem)
        fn _check_and_emit_rate_update(ref self: ComponentState<TContractState>) {
            let new_rate = self._exchange_rate();
            let old_rate = self.last_exchange_rate.read();

            // Only emit if rates differ and we have a previous rate (skip on first call)
            if old_rate > 0 && new_rate != old_rate {
                // Calculate rate change in basis points (10000 = 100%)
                // rate_change_bps = |new_rate - old_rate| * 10000 / old_rate
                let rate_diff = if new_rate > old_rate {
                    new_rate - old_rate
                } else {
                    old_rate - new_rate
                };
                let rate_change_bps = (rate_diff * 10000) / old_rate;

                self
                    .emit(
                        OracleRateUpdated {
                            sy: get_contract_address(),
                            underlying: self.underlying.read(),
                            old_rate,
                            new_rate,
                            rate_change_bps,
                            timestamp: get_block_timestamp(),
                        },
                    );
            }

            // Update stored rate
            if new_rate != old_rate {
                self.last_exchange_rate.write(new_rate);
            }
        }
    }

    /// View functions implementation - can be embedded or called internally
    #[generate_trait]
    pub impl ViewImpl<TContractState, +HasComponent<TContractState>> of ViewTrait<TContractState> {
        /// Get the current exchange rate (assets per share in WAD)
        fn exchange_rate(self: @ComponentState<TContractState>) -> u256 {
            let oracle_addr = self.index_oracle.read();

            if self.is_erc4626.read() {
                let vault = IERC4626MinimalDispatcher { contract_address: oracle_addr };
                vault.convert_to_assets(WAD)
            } else {
                let oracle = IIndexOracleDispatcher { contract_address: oracle_addr };
                oracle.index()
            }
        }

        /// Get the underlying token address
        fn underlying_asset(self: @ComponentState<TContractState>) -> ContractAddress {
            self.underlying.read()
        }

        /// Get all valid tokens that can be deposited to mint SY
        fn get_tokens_in(self: @ComponentState<TContractState>) -> Span<ContractAddress> {
            let count = self.tokens_in_count.read();
            let mut tokens: Array<ContractAddress> = array![];
            let mut i: u32 = 0;
            while i < count {
                tokens.append(self.tokens_in.read(i));
                i += 1;
            }
            tokens.span()
        }

        /// Get all valid tokens that can be received when redeeming SY
        fn get_tokens_out(self: @ComponentState<TContractState>) -> Span<ContractAddress> {
            let count = self.tokens_out_count.read();
            let mut tokens: Array<ContractAddress> = array![];
            let mut i: u32 = 0;
            while i < count {
                tokens.append(self.tokens_out.read(i));
                i += 1;
            }
            tokens.span()
        }

        /// Check if a token can be deposited to mint SY (O(1) lookup)
        fn is_valid_token_in(
            self: @ComponentState<TContractState>, token: ContractAddress,
        ) -> bool {
            self.valid_tokens_in.read(token)
        }

        /// Check if a token can be received when redeeming SY (O(1) lookup)
        fn is_valid_token_out(
            self: @ComponentState<TContractState>, token: ContractAddress,
        ) -> bool {
            self.valid_tokens_out.read(token)
        }

        /// Returns asset classification, underlying address, and decimals
        fn asset_info(self: @ComponentState<TContractState>) -> (AssetType, ContractAddress, u8) {
            let underlying_addr = self.underlying.read();
            let underlying_token = IERC20ExternalDispatcher { contract_address: underlying_addr };
            (self.asset_type.read(), underlying_addr, underlying_token.decimals())
        }

        /// Preview how much SY would be minted for a deposit (1:1)
        fn preview_deposit(self: @ComponentState<TContractState>, amount: u256) -> u256 {
            amount
        }

        /// Preview how much underlying would be returned for a redemption (1:1)
        fn preview_redeem(self: @ComponentState<TContractState>, amount: u256) -> u256 {
            amount
        }

        /// Get the index oracle address
        fn get_index_oracle(self: @ComponentState<TContractState>) -> ContractAddress {
            self.index_oracle.read()
        }

        /// Check if this SY uses an ERC-4626 vault for exchange rate
        fn get_is_erc4626(self: @ComponentState<TContractState>) -> bool {
            self.is_erc4626.read()
        }
    }
}
