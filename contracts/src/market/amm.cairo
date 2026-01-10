/// AMM Market Contract
/// Implements the PT/SY trading pool with time-aware pricing.
/// The market acts as an LP token itself (ERC20) for liquidity providers.
/// - Pausable: Can be paused in emergencies by PAUSER_ROLE
/// - Non-upgradeable: Deployed per-PT via MarketFactory, new markets use new class hash

#[starknet::contract]
pub mod Market {
    use core::num::traits::Zero;
    use horizon::components::reward_manager_component::RewardManagerComponent;
    use horizon::interfaces::i_market::{IMarket, IMarketAdmin, IMarketOracle, OracleState};
    use horizon::interfaces::i_market_callback::{
        IMarketSwapCallbackDispatcher, IMarketSwapCallbackDispatcherTrait,
    };
    use horizon::interfaces::i_market_factory::{
        IMarketFactoryDispatcher, IMarketFactoryDispatcherTrait,
    };
    use horizon::interfaces::i_pt::{IPTDispatcher, IPTDispatcherTrait};
    use horizon::interfaces::i_sy::{ISYDispatcher, ISYDispatcherTrait};
    use horizon::interfaces::i_yt::{IYTDispatcher, IYTDispatcherTrait};
    use horizon::libraries::errors::Errors;
    use horizon::libraries::oracle_lib::{self, Observation, SurroundingObservations};
    use horizon::libraries::roles::{DEFAULT_ADMIN_ROLE, PAUSER_ROLE};
    use horizon::market::market_math_fp::{
        MINIMUM_LIQUIDITY, MarketState, calc_burn_lp, calc_mint_lp, calc_swap_exact_pt_for_sy,
        calc_swap_exact_sy_for_pt, calc_swap_pt_for_exact_sy, calc_swap_sy_for_exact_pt,
        check_slippage, get_ln_implied_rate, get_time_to_expiry, set_initial_ln_implied_rate,
    };
    use openzeppelin_access::accesscontrol::AccessControlComponent;
    use openzeppelin_access::ownable::OwnableComponent;
    use openzeppelin_introspection::src5::SRC5Component;
    use openzeppelin_security::pausable::PausableComponent;
    use openzeppelin_token::erc20::{DefaultConfig, ERC20Component};
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };
    use starknet::{ContractAddress, get_block_timestamp, get_caller_address, get_contract_address};

    /// Interface for Market LP reward functions
    #[starknet::interface]
    pub trait IMarketRewards<TContractState> {
        /// Get all registered reward tokens
        fn get_reward_tokens(self: @TContractState) -> Span<ContractAddress>;

        /// Claim all accrued rewards for a user
        fn claim_rewards(ref self: TContractState, user: ContractAddress) -> Span<u256>;

        /// Get user's accrued (unclaimed) rewards for all tokens
        fn accrued_rewards(self: @TContractState, user: ContractAddress) -> Span<u256>;

        /// Get the current global reward index for a specific token
        fn reward_index(self: @TContractState, token: ContractAddress) -> u256;

        /// Get user's reward index for a specific token
        fn user_reward_index(
            self: @TContractState, user: ContractAddress, token: ContractAddress,
        ) -> u256;

        /// Check if a token is registered as a reward token
        fn is_reward_token(self: @TContractState, token: ContractAddress) -> bool;

        /// Get the number of registered reward tokens
        fn reward_tokens_count(self: @TContractState) -> u32;
    }

    /// Maximum cardinality for TWAP oracle buffer (8760 = 1 year of hourly observations).
    /// Prevents unbounded storage growth while allowing sufficient TWAP history.
    const MAX_CARDINALITY: u16 = 8760;

    component!(path: ERC20Component, storage: erc20, event: ERC20Event);
    component!(path: SRC5Component, storage: src5, event: SRC5Event);
    component!(path: AccessControlComponent, storage: access_control, event: AccessControlEvent);
    component!(path: PausableComponent, storage: pausable, event: PausableEvent);
    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);
    component!(path: RewardManagerComponent, storage: reward_manager, event: RewardManagerEvent);

    // ERC20 component for LP token functionality
    #[abi(embed_v0)]
    impl ERC20Impl = ERC20Component::ERC20Impl<ContractState>;
    #[abi(embed_v0)]
    impl ERC20MetadataImpl = ERC20Component::ERC20MetadataImpl<ContractState>;
    impl ERC20InternalImpl = ERC20Component::InternalImpl<ContractState>;

    // AccessControl - embed the public interface
    #[abi(embed_v0)]
    impl AccessControlImpl =
        AccessControlComponent::AccessControlImpl<ContractState>;
    impl AccessControlInternalImpl = AccessControlComponent::InternalImpl<ContractState>;

    // Pausable - embed the public interface
    #[abi(embed_v0)]
    impl PausableImpl = PausableComponent::PausableImpl<ContractState>;
    impl PausableInternalImpl = PausableComponent::InternalImpl<ContractState>;

    // Ownable - embed the public interface
    #[abi(embed_v0)]
    impl OwnableImpl = OwnableComponent::OwnableImpl<ContractState>;
    impl OwnableInternalImpl = OwnableComponent::InternalImpl<ContractState>;

    // RewardManager - internal implementations
    impl RewardInternalImpl = RewardManagerComponent::InternalImpl<ContractState>;
    impl RewardViewImpl = RewardManagerComponent::ViewImpl<ContractState>;

    #[storage]
    struct Storage {
        #[substorage(v0)]
        erc20: ERC20Component::Storage,
        #[substorage(v0)]
        src5: SRC5Component::Storage,
        #[substorage(v0)]
        access_control: AccessControlComponent::Storage,
        #[substorage(v0)]
        pausable: PausableComponent::Storage,
        #[substorage(v0)]
        ownable: OwnableComponent::Storage,
        // Token addresses
        sy: ContractAddress,
        pt: ContractAddress,
        yt: ContractAddress,
        // Factory address (for querying fee config and treasury)
        factory: ContractAddress,
        // Pool reserves
        sy_reserve: u256,
        pt_reserve: u256,
        // Market parameters
        scalar_root: u256,
        initial_anchor: u256,
        ln_fee_rate_root: u256, // Pendle-style log fee rate root
        reserve_fee_percent: u8, // Reserve fee in base-100 (0-100), sent to treasury
        // Expiry info
        expiry: u64,
        // Cached implied rate
        last_ln_implied_rate: u256,
        // LP fees collected (in SY) - reserve fees are sent to treasury immediately
        lp_fees_collected: u256,
        // TWAP oracle - ring buffer of ln(implied rate) observations
        observations: Map<u16, Observation>,
        observation_index: u16,
        observation_cardinality: u16,
        observation_cardinality_next: u16,
        #[substorage(v0)]
        reward_manager: RewardManagerComponent::Storage,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        #[flat]
        ERC20Event: ERC20Component::Event,
        #[flat]
        SRC5Event: SRC5Component::Event,
        #[flat]
        AccessControlEvent: AccessControlComponent::Event,
        #[flat]
        PausableEvent: PausableComponent::Event,
        #[flat]
        OwnableEvent: OwnableComponent::Event,
        Mint: Mint,
        Burn: Burn,
        Swap: Swap,
        ImpliedRateUpdated: ImpliedRateUpdated,
        FeesCollected: FeesCollected,
        ReserveFeeTransferred: ReserveFeeTransferred,
        ScalarRootUpdated: ScalarRootUpdated,
        #[flat]
        RewardManagerEvent: RewardManagerComponent::Event,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Mint {
        #[key]
        pub sender: ContractAddress,
        #[key]
        pub receiver: ContractAddress,
        #[key]
        pub expiry: u64,
        pub sy: ContractAddress,
        pub pt: ContractAddress,
        pub sy_amount: u256,
        pub pt_amount: u256,
        pub lp_amount: u256,
        pub exchange_rate: u256,
        pub implied_rate: u256,
        pub sy_reserve_after: u256,
        pub pt_reserve_after: u256,
        pub total_lp_after: u256,
        pub timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Burn {
        #[key]
        pub sender: ContractAddress,
        #[key]
        pub receiver: ContractAddress,
        #[key]
        pub expiry: u64,
        pub sy: ContractAddress,
        pub pt: ContractAddress,
        pub lp_amount: u256,
        pub sy_amount: u256,
        pub pt_amount: u256,
        pub exchange_rate: u256,
        pub implied_rate: u256,
        pub sy_reserve_after: u256,
        pub pt_reserve_after: u256,
        pub total_lp_after: u256,
        pub timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Swap {
        #[key]
        pub sender: ContractAddress,
        #[key]
        pub receiver: ContractAddress,
        #[key]
        pub expiry: u64,
        pub sy: ContractAddress,
        pub pt: ContractAddress,
        pub pt_in: u256,
        pub sy_in: u256,
        pub pt_out: u256,
        pub sy_out: u256,
        pub total_fee: u256, // Total fee in SY (lp_fee + reserve_fee)
        pub lp_fee: u256, // Fee portion that stays in pool for LPs
        pub reserve_fee: u256, // Fee portion sent to treasury
        pub implied_rate_before: u256,
        pub implied_rate_after: u256,
        pub exchange_rate: u256,
        pub sy_reserve_after: u256,
        pub pt_reserve_after: u256,
        pub timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct ImpliedRateUpdated {
        #[key]
        pub market: ContractAddress,
        #[key]
        pub expiry: u64,
        pub old_rate: u256,
        pub new_rate: u256,
        pub timestamp: u64,
        pub time_to_expiry: u64,
        pub exchange_rate: u256,
        pub sy_reserve: u256,
        pub pt_reserve: u256,
        pub total_lp: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct FeesCollected {
        #[key]
        pub collector: ContractAddress,
        #[key]
        pub receiver: ContractAddress,
        #[key]
        pub market: ContractAddress,
        pub amount: u256,
        pub expiry: u64,
        pub ln_fee_rate_root: u256,
        pub timestamp: u64,
    }

    /// Event emitted when reserve fees are transferred to treasury (Pendle-style immediate
    /// transfer)
    #[derive(Drop, starknet::Event)]
    pub struct ReserveFeeTransferred {
        #[key]
        pub market: ContractAddress,
        #[key]
        pub treasury: ContractAddress,
        #[key]
        pub caller: ContractAddress, // The router/caller that initiated the swap
        pub amount: u256, // Reserve fee amount in SY
        pub expiry: u64,
        pub timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct ScalarRootUpdated {
        #[key]
        pub market: ContractAddress,
        pub old_value: u256,
        pub new_value: u256,
        pub timestamp: u64,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        name: ByteArray,
        symbol: ByteArray,
        pt: ContractAddress,
        scalar_root: u256,
        initial_anchor: u256,
        ln_fee_rate_root: u256,
        reserve_fee_percent: u8,
        pauser: ContractAddress,
        factory: ContractAddress,
        reward_tokens: Span<ContractAddress>,
    ) {
        // Initialize LP token (ERC20)
        self.erc20.initializer(name, symbol);

        // Validate inputs (factory can be zero for standalone markets)
        assert(!pt.is_zero(), Errors::ZERO_ADDRESS);
        assert(!pauser.is_zero(), Errors::ZERO_ADDRESS);
        // Note: factory can be zero - swap functions handle this gracefully

        // Get SY and YT from PT contract
        let pt_contract = IPTDispatcher { contract_address: pt };
        let sy = pt_contract.sy();
        let yt = pt_contract.yt();
        let expiry = pt_contract.expiry();

        assert(!sy.is_zero(), Errors::ZERO_ADDRESS);
        assert(!yt.is_zero(), Errors::ZERO_ADDRESS);
        assert(expiry > get_block_timestamp(), Errors::MARKET_EXPIRED);

        // Initialize access control - grant admin and pauser roles
        self.access_control._grant_role(DEFAULT_ADMIN_ROLE, pauser);
        self.access_control._grant_role(PAUSER_ROLE, pauser);

        // Initialize ownable for upgrade control
        self.ownable.initializer(pauser);

        // Store addresses
        self.sy.write(sy);
        self.pt.write(pt);
        self.yt.write(yt);
        self.factory.write(factory);
        self.expiry.write(expiry);

        // Store market parameters
        self.scalar_root.write(scalar_root);
        self.initial_anchor.write(initial_anchor);
        self.ln_fee_rate_root.write(ln_fee_rate_root);
        self.reserve_fee_percent.write(reserve_fee_percent);

        // Initialize reserves to 0
        self.sy_reserve.write(0);
        self.pt_reserve.write(0);
        // Note: last_ln_implied_rate starts at 0 and is properly calculated
        // after first mint using set_initial_ln_implied_rate (Pendle parity)
        self.last_ln_implied_rate.write(0);
        self.lp_fees_collected.write(0);

        // Initialize TWAP oracle with first observation at deployment time
        let timestamp = get_block_timestamp();
        let init_result = oracle_lib::initialize(timestamp);
        self.observations.write(0_u16, init_result.observation);
        self.observation_index.write(0_u16);
        self.observation_cardinality.write(init_result.cardinality);
        self.observation_cardinality_next.write(init_result.cardinality_next);

        // Initialize RewardManager component (if reward_tokens provided)
        // LP rewards are optional - pass empty span to disable reward tracking
        if reward_tokens.len() > 0 {
            self.reward_manager.initializer(reward_tokens);
        }
    }

    /// Custom ERC20 hooks - update rewards on every LP token transfer
    ///
    /// This is the key integration point: when LP tokens are transferred, we must
    /// update both parties' reward state BEFORE the balance changes.
    ///
    /// Note: Unlike SYWithRewards, Market doesn't block operations when paused via ERC20 hooks.
    /// Pausability is enforced at the mint/swap level, not transfer level.
    impl ERC20HooksImpl of ERC20Component::ERC20HooksTrait<ContractState> {
        fn before_update(
            ref self: ERC20Component::ComponentState<ContractState>,
            from: ContractAddress,
            recipient: ContractAddress,
            amount: u256,
        ) {
            // Update rewards for both parties BEFORE balance changes
            // Skip if no rewards configured (reward_tokens_count == 0)
            let mut contract = self.get_contract_mut();
            if contract.reward_manager.reward_tokens_count.read() > 0 {
                contract.reward_manager.update_rewards_for_two(from, recipient);
            }
        }

        fn after_update(
            ref self: ERC20Component::ComponentState<ContractState>,
            from: ContractAddress,
            recipient: ContractAddress,
            amount: u256,
        ) { // No additional logic needed after update
        }
    }

    /// Implement RewardHooksTrait - bridge RewardManager to ERC20 for LP balance info
    ///
    /// The RewardManager needs balance information to calculate rewards for LPs.
    /// These hooks provide that without the component knowing about ERC20 directly.
    impl RewardHooksImpl of RewardManagerComponent::RewardHooksTrait<ContractState> {
        /// Get user's LP token balance (for reward calculation)
        fn user_sy_balance(self: @ContractState, user: ContractAddress) -> u256 {
            // LP token balance (Market IS the LP token)
            self.erc20.balance_of(user)
        }

        /// Get total LP token supply (for global index calculation)
        fn total_sy_supply(self: @ContractState) -> u256 {
            // Total LP supply
            self.erc20.total_supply()
        }
    }

    #[abi(embed_v0)]
    impl MarketImpl of IMarket<ContractState> {
        /// Get the SY token address
        fn sy(self: @ContractState) -> ContractAddress {
            self.sy.read()
        }

        /// Get the PT token address
        fn pt(self: @ContractState) -> ContractAddress {
            self.pt.read()
        }

        /// Get the YT token address
        fn yt(self: @ContractState) -> ContractAddress {
            self.yt.read()
        }

        /// Get the expiry timestamp
        fn expiry(self: @ContractState) -> u64 {
            self.expiry.read()
        }

        /// Check if the market has expired
        fn is_expired(self: @ContractState) -> bool {
            get_block_timestamp() >= self.expiry.read()
        }

        /// Get current reserves
        fn get_reserves(self: @ContractState) -> (u256, u256) {
            (self.sy_reserve.read(), self.pt_reserve.read())
        }

        /// Get total LP token supply
        fn total_lp_supply(self: @ContractState) -> u256 {
            self.erc20.total_supply()
        }

        /// Add liquidity to the pool
        /// @param receiver Address to receive LP tokens
        /// @param sy_desired Amount of SY to add
        /// @param pt_desired Amount of PT to add
        /// @return (sy_used, pt_used, lp_minted)
        fn mint(
            ref self: ContractState, receiver: ContractAddress, sy_desired: u256, pt_desired: u256,
        ) -> (u256, u256, u256) {
            // Check if paused
            self.pausable.assert_not_paused();

            // Validate
            assert(!self.is_expired(), Errors::MARKET_EXPIRED);
            assert(!receiver.is_zero(), Errors::ZERO_ADDRESS);
            assert(sy_desired > 0 && pt_desired > 0, Errors::ZERO_AMOUNT);

            let caller = get_caller_address();
            let state = self._get_market_state();

            // Calculate LP tokens to mint
            // For first mint, is_first_mint=true and MINIMUM_LIQUIDITY must be locked
            let (lp_to_mint, sy_used, pt_used, is_first_mint) = calc_mint_lp(
                @state, sy_desired, pt_desired,
            );
            assert(lp_to_mint > 0, Errors::MARKET_ZERO_LIQUIDITY);

            // Transfer tokens from caller
            let sy_contract = ISYDispatcher { contract_address: self.sy.read() };
            let pt_contract = IPTDispatcher { contract_address: self.pt.read() };

            assert(
                sy_contract.transfer_from(caller, get_contract_address(), sy_used),
                Errors::MARKET_TRANSFER_FAILED,
            );
            assert(
                pt_contract.transfer_from(caller, get_contract_address(), pt_used),
                Errors::MARKET_TRANSFER_FAILED,
            );

            // Update reserves
            self.sy_reserve.write(self.sy_reserve.read() + sy_used);
            self.pt_reserve.write(self.pt_reserve.read() + pt_used);

            // For first mint, lock MINIMUM_LIQUIDITY to treasury (Pendle-style).
            // Fallback to a dead address if factory/treasury is unset.
            if is_first_mint {
                let recipient = self._get_minimum_liquidity_recipient();
                self.erc20.mint(recipient, MINIMUM_LIQUIDITY);
            }

            // Mint LP tokens to receiver
            self.erc20.mint(receiver, lp_to_mint);

            // Update implied rate cache
            // For first mint, use Pendle's setInitialLnImpliedRate to properly compute
            // the initial rate based on reserves and initial_anchor
            if is_first_mint {
                self._set_initial_ln_implied_rate();
            } else {
                self._update_implied_rate();
            }

            // Get current state for event
            let sy_addr = self.sy.read();
            let pt_addr = self.pt.read();
            let sy_contract = ISYDispatcher { contract_address: sy_addr };

            // Emit event
            self
                .emit(
                    Mint {
                        sender: caller,
                        receiver,
                        expiry: self.expiry.read(),
                        sy: sy_addr,
                        pt: pt_addr,
                        sy_amount: sy_used,
                        pt_amount: pt_used,
                        lp_amount: lp_to_mint,
                        exchange_rate: sy_contract.exchange_rate(),
                        implied_rate: self.last_ln_implied_rate.read(),
                        sy_reserve_after: self.sy_reserve.read(),
                        pt_reserve_after: self.pt_reserve.read(),
                        total_lp_after: self.erc20.total_supply(),
                        timestamp: get_block_timestamp(),
                    },
                );

            (sy_used, pt_used, lp_to_mint)
        }

        /// Remove liquidity from the pool
        /// @param receiver Address to receive tokens
        /// @param lp_to_burn Amount of LP tokens to burn
        /// @return (sy_out, pt_out)
        fn burn(
            ref self: ContractState, receiver: ContractAddress, lp_to_burn: u256,
        ) -> (u256, u256) {
            // Can burn even after expiry
            assert(!receiver.is_zero(), Errors::ZERO_ADDRESS);
            assert(lp_to_burn > 0, Errors::ZERO_AMOUNT);

            let caller = get_caller_address();
            let state = self._get_market_state();

            // Calculate tokens to return
            let (sy_out, pt_out) = calc_burn_lp(@state, lp_to_burn);
            assert(sy_out > 0 || pt_out > 0, Errors::MARKET_ZERO_LIQUIDITY);

            // Burn LP tokens from caller
            self.erc20.burn(caller, lp_to_burn);

            // Update reserves
            self.sy_reserve.write(self.sy_reserve.read() - sy_out);
            self.pt_reserve.write(self.pt_reserve.read() - pt_out);

            // Transfer tokens to receiver
            if sy_out > 0 {
                let sy_contract = ISYDispatcher { contract_address: self.sy.read() };
                assert(sy_contract.transfer(receiver, sy_out), Errors::MARKET_TRANSFER_FAILED);
            }
            if pt_out > 0 {
                let pt_contract = IPTDispatcher { contract_address: self.pt.read() };
                assert(pt_contract.transfer(receiver, pt_out), Errors::MARKET_TRANSFER_FAILED);
            }

            // Update implied rate cache (if not expired)
            if !self.is_expired() {
                self._update_implied_rate();
            }

            // Get current state for event
            let sy_addr = self.sy.read();
            let pt_addr = self.pt.read();
            let sy_contract = ISYDispatcher { contract_address: sy_addr };

            // Emit event
            self
                .emit(
                    Burn {
                        sender: caller,
                        receiver,
                        expiry: self.expiry.read(),
                        sy: sy_addr,
                        pt: pt_addr,
                        lp_amount: lp_to_burn,
                        sy_amount: sy_out,
                        pt_amount: pt_out,
                        exchange_rate: sy_contract.exchange_rate(),
                        implied_rate: self.last_ln_implied_rate.read(),
                        sy_reserve_after: self.sy_reserve.read(),
                        pt_reserve_after: self.pt_reserve.read(),
                        total_lp_after: self.erc20.total_supply(),
                        timestamp: get_block_timestamp(),
                    },
                );

            (sy_out, pt_out)
        }

        /// Swap exact PT for SY
        /// @param receiver Address to receive SY
        /// @param exact_pt_in Exact amount of PT to sell
        /// @param min_sy_out Minimum SY to receive (slippage protection)
        /// @param callback_data Optional callback data (empty span = no callback)
        /// @return Amount of SY received
        fn swap_exact_pt_for_sy(
            ref self: ContractState,
            receiver: ContractAddress,
            exact_pt_in: u256,
            min_sy_out: u256,
            callback_data: Span<felt252>,
        ) -> u256 {
            self.pausable.assert_not_paused();
            assert(!self.is_expired(), Errors::MARKET_EXPIRED);
            assert(!receiver.is_zero(), Errors::ZERO_ADDRESS);
            assert(exact_pt_in > 0, Errors::ZERO_AMOUNT);

            let caller = get_caller_address();
            let state = self._get_market_state_with_effective_fee(caller);
            let time_to_expiry = get_time_to_expiry(self.expiry.read(), get_block_timestamp());

            // Capture implied rate before swap
            let implied_rate_before = get_ln_implied_rate(@state, time_to_expiry);

            // Calculate output with full TradeResult (includes fee split)
            let result = calc_swap_exact_pt_for_sy(@state, exact_pt_in, time_to_expiry);
            let sy_out = result.net_sy_to_account;
            assert(check_slippage(sy_out, min_sy_out), Errors::MARKET_SLIPPAGE_EXCEEDED);

            // Get contract addresses
            let sy_addr = self.sy.read();
            let pt_addr = self.pt.read();
            let sy_contract = ISYDispatcher { contract_address: sy_addr };
            let pt_contract = IPTDispatcher { contract_address: pt_addr };

            // --- PULL: Transfer PT from caller (safe - caller controls it) ---
            assert(
                pt_contract.transfer_from(caller, get_contract_address(), exact_pt_in),
                Errors::MARKET_TRANSFER_FAILED,
            );

            // --- CALCULATE: Determine effective reserve fee (pure check, no side effects) ---
            let (treasury, actual_reserve_fee) = self
                ._get_effective_reserve_fee(result.net_sy_to_reserve);
            let lp_fee = result.net_sy_fee - actual_reserve_fee;

            // --- EFFECTS: Update ALL state BEFORE external transfers (CEI pattern) ---
            self.lp_fees_collected.write(self.lp_fees_collected.read() + lp_fee);
            self.sy_reserve.write(self.sy_reserve.read() - sy_out - actual_reserve_fee);
            self.pt_reserve.write(self.pt_reserve.read() + exact_pt_in);
            self._update_implied_rate();
            let implied_rate_after = self.last_ln_implied_rate.read();

            // --- INTERACTIONS: External transfers OUT (after state is finalized) ---
            assert(sy_contract.transfer(receiver, sy_out), Errors::MARKET_TRANSFER_FAILED);
            self
                ._transfer_reserve_fee_to_treasury(
                    sy_contract, treasury, actual_reserve_fee, caller,
                );

            // Invoke callback if requested
            if callback_data.len() > 0 {
                let callback = IMarketSwapCallbackDispatcher { contract_address: caller };
                // net_pt_to_account is negative (user sent PT to market)
                let net_pt = (exact_pt_in, true); // (magnitude, is_negative=true)
                // net_sy_to_account is positive (market sent SY to receiver)
                let net_sy = (sy_out, false);
                callback.swap_callback(net_pt, net_sy, callback_data);
            }

            // Emit event
            self
                .emit(
                    Swap {
                        sender: caller,
                        receiver,
                        expiry: self.expiry.read(),
                        sy: sy_addr,
                        pt: pt_addr,
                        pt_in: exact_pt_in,
                        sy_in: 0,
                        pt_out: 0,
                        sy_out,
                        total_fee: result.net_sy_fee,
                        lp_fee,
                        reserve_fee: actual_reserve_fee,
                        implied_rate_before,
                        implied_rate_after,
                        exchange_rate: sy_contract.exchange_rate(),
                        sy_reserve_after: self.sy_reserve.read(),
                        pt_reserve_after: self.pt_reserve.read(),
                        timestamp: get_block_timestamp(),
                    },
                );

            sy_out
        }

        /// Swap SY for exact PT
        /// @param receiver Address to receive PT
        /// @param exact_pt_out Exact amount of PT to buy
        /// @param max_sy_in Maximum SY to spend (slippage protection)
        /// @param callback_data Optional callback data (empty span = no callback)
        /// @return Amount of SY spent
        fn swap_sy_for_exact_pt(
            ref self: ContractState,
            receiver: ContractAddress,
            exact_pt_out: u256,
            max_sy_in: u256,
            callback_data: Span<felt252>,
        ) -> u256 {
            self.pausable.assert_not_paused();
            assert(!self.is_expired(), Errors::MARKET_EXPIRED);
            assert(!receiver.is_zero(), Errors::ZERO_ADDRESS);
            assert(exact_pt_out > 0, Errors::ZERO_AMOUNT);

            let caller = get_caller_address();
            let state = self._get_market_state_with_effective_fee(caller);
            let time_to_expiry = get_time_to_expiry(self.expiry.read(), get_block_timestamp());

            // Capture implied rate before swap
            let implied_rate_before = get_ln_implied_rate(@state, time_to_expiry);

            // Calculate input required with full TradeResult (includes fee split)
            let result = calc_swap_sy_for_exact_pt(@state, exact_pt_out, time_to_expiry);
            let sy_in = result.net_sy_to_account;
            assert(sy_in <= max_sy_in, Errors::MARKET_SLIPPAGE_EXCEEDED);

            // Get contract addresses
            let sy_addr = self.sy.read();
            let pt_addr = self.pt.read();
            let sy_contract = ISYDispatcher { contract_address: sy_addr };
            let pt_contract = IPTDispatcher { contract_address: pt_addr };

            // --- PULL: Transfer SY from caller (safe - caller controls it) ---
            assert(
                sy_contract.transfer_from(caller, get_contract_address(), sy_in),
                Errors::MARKET_TRANSFER_FAILED,
            );

            // --- CALCULATE: Determine effective reserve fee (pure check, no side effects) ---
            let (treasury, actual_reserve_fee) = self
                ._get_effective_reserve_fee(result.net_sy_to_reserve);
            let lp_fee = result.net_sy_fee - actual_reserve_fee;

            // --- EFFECTS: Update ALL state BEFORE external transfers (CEI pattern) ---
            self.lp_fees_collected.write(self.lp_fees_collected.read() + lp_fee);
            self.sy_reserve.write(self.sy_reserve.read() + sy_in - actual_reserve_fee);
            self.pt_reserve.write(self.pt_reserve.read() - exact_pt_out);
            self._update_implied_rate();
            let implied_rate_after = self.last_ln_implied_rate.read();

            // --- INTERACTIONS: External transfers OUT (after state is finalized) ---
            assert(pt_contract.transfer(receiver, exact_pt_out), Errors::MARKET_TRANSFER_FAILED);
            self
                ._transfer_reserve_fee_to_treasury(
                    sy_contract, treasury, actual_reserve_fee, caller,
                );

            // Invoke callback if requested
            if callback_data.len() > 0 {
                let callback = IMarketSwapCallbackDispatcher { contract_address: caller };
                // net_pt_to_account is positive (market sent PT to receiver)
                let net_pt = (exact_pt_out, false);
                // net_sy_to_account is negative (user sent SY to market)
                let net_sy = (sy_in, true); // (magnitude, is_negative=true)
                callback.swap_callback(net_pt, net_sy, callback_data);
            }

            // Emit event
            self
                .emit(
                    Swap {
                        sender: caller,
                        receiver,
                        expiry: self.expiry.read(),
                        sy: sy_addr,
                        pt: pt_addr,
                        pt_in: 0,
                        sy_in,
                        pt_out: exact_pt_out,
                        sy_out: 0,
                        total_fee: result.net_sy_fee,
                        lp_fee,
                        reserve_fee: actual_reserve_fee,
                        implied_rate_before,
                        implied_rate_after,
                        exchange_rate: sy_contract.exchange_rate(),
                        sy_reserve_after: self.sy_reserve.read(),
                        pt_reserve_after: self.pt_reserve.read(),
                        timestamp: get_block_timestamp(),
                    },
                );

            sy_in
        }

        /// Swap exact SY for PT
        /// @param receiver Address to receive PT
        /// @param exact_sy_in Exact amount of SY to sell
        /// @param min_pt_out Minimum PT to receive (slippage protection)
        /// @param callback_data Optional callback data (empty span = no callback)
        /// @return Amount of PT received
        fn swap_exact_sy_for_pt(
            ref self: ContractState,
            receiver: ContractAddress,
            exact_sy_in: u256,
            min_pt_out: u256,
            callback_data: Span<felt252>,
        ) -> u256 {
            self.pausable.assert_not_paused();
            assert(!self.is_expired(), Errors::MARKET_EXPIRED);
            assert(!receiver.is_zero(), Errors::ZERO_ADDRESS);
            assert(exact_sy_in > 0, Errors::ZERO_AMOUNT);

            let caller = get_caller_address();
            let state = self._get_market_state_with_effective_fee(caller);
            let time_to_expiry = get_time_to_expiry(self.expiry.read(), get_block_timestamp());

            // Capture implied rate before swap
            let implied_rate_before = get_ln_implied_rate(@state, time_to_expiry);

            // Calculate output with full TradeResult (includes fee split)
            let (pt_out, result) = calc_swap_exact_sy_for_pt(@state, exact_sy_in, time_to_expiry);
            assert(check_slippage(pt_out, min_pt_out), Errors::MARKET_SLIPPAGE_EXCEEDED);

            // Get contract addresses
            let sy_addr = self.sy.read();
            let pt_addr = self.pt.read();
            let sy_contract = ISYDispatcher { contract_address: sy_addr };
            let pt_contract = IPTDispatcher { contract_address: pt_addr };

            // --- PULL: Transfer SY from caller (safe - caller controls it) ---
            assert(
                sy_contract.transfer_from(caller, get_contract_address(), exact_sy_in),
                Errors::MARKET_TRANSFER_FAILED,
            );

            // --- CALCULATE: Determine effective reserve fee (pure check, no side effects) ---
            let (treasury, actual_reserve_fee) = self
                ._get_effective_reserve_fee(result.net_sy_to_reserve);
            let lp_fee = result.net_sy_fee - actual_reserve_fee;

            // --- EFFECTS: Update ALL state BEFORE external transfers (CEI pattern) ---
            self.lp_fees_collected.write(self.lp_fees_collected.read() + lp_fee);
            self.sy_reserve.write(self.sy_reserve.read() + exact_sy_in - actual_reserve_fee);
            self.pt_reserve.write(self.pt_reserve.read() - pt_out);
            self._update_implied_rate();
            let implied_rate_after = self.last_ln_implied_rate.read();

            // --- INTERACTIONS: External transfers OUT (after state is finalized) ---
            assert(pt_contract.transfer(receiver, pt_out), Errors::MARKET_TRANSFER_FAILED);
            self
                ._transfer_reserve_fee_to_treasury(
                    sy_contract, treasury, actual_reserve_fee, caller,
                );

            // Invoke callback if requested
            if callback_data.len() > 0 {
                let callback = IMarketSwapCallbackDispatcher { contract_address: caller };
                // net_pt_to_account is positive (market sent PT to receiver)
                let net_pt = (pt_out, false);
                // net_sy_to_account is negative (user sent SY to market)
                let net_sy = (exact_sy_in, true); // (magnitude, is_negative=true)
                callback.swap_callback(net_pt, net_sy, callback_data);
            }

            // Emit event
            self
                .emit(
                    Swap {
                        sender: caller,
                        receiver,
                        expiry: self.expiry.read(),
                        sy: sy_addr,
                        pt: pt_addr,
                        pt_in: 0,
                        sy_in: exact_sy_in,
                        pt_out,
                        sy_out: 0,
                        total_fee: result.net_sy_fee,
                        lp_fee,
                        reserve_fee: actual_reserve_fee,
                        implied_rate_before,
                        implied_rate_after,
                        exchange_rate: sy_contract.exchange_rate(),
                        sy_reserve_after: self.sy_reserve.read(),
                        pt_reserve_after: self.pt_reserve.read(),
                        timestamp: get_block_timestamp(),
                    },
                );

            pt_out
        }

        /// Swap PT for exact SY
        /// @param receiver Address to receive SY
        /// @param exact_sy_out Exact amount of SY to buy
        /// @param max_pt_in Maximum PT to spend (slippage protection)
        /// @param callback_data Optional callback data (empty span = no callback)
        /// @return Amount of PT spent
        fn swap_pt_for_exact_sy(
            ref self: ContractState,
            receiver: ContractAddress,
            exact_sy_out: u256,
            max_pt_in: u256,
            callback_data: Span<felt252>,
        ) -> u256 {
            self.pausable.assert_not_paused();
            assert(!self.is_expired(), Errors::MARKET_EXPIRED);
            assert(!receiver.is_zero(), Errors::ZERO_ADDRESS);
            assert(exact_sy_out > 0, Errors::ZERO_AMOUNT);

            let caller = get_caller_address();
            let state = self._get_market_state_with_effective_fee(caller);
            let time_to_expiry = get_time_to_expiry(self.expiry.read(), get_block_timestamp());

            // Capture implied rate before swap
            let implied_rate_before = get_ln_implied_rate(@state, time_to_expiry);

            // Calculate input required with full TradeResult (includes fee split)
            let (pt_in, result) = calc_swap_pt_for_exact_sy(@state, exact_sy_out, time_to_expiry);
            assert(pt_in <= max_pt_in, Errors::MARKET_SLIPPAGE_EXCEEDED);

            // Get contract addresses
            let sy_addr = self.sy.read();
            let pt_addr = self.pt.read();
            let sy_contract = ISYDispatcher { contract_address: sy_addr };
            let pt_contract = IPTDispatcher { contract_address: pt_addr };

            // --- PULL: Transfer PT from caller (safe - caller controls it) ---
            assert(
                pt_contract.transfer_from(caller, get_contract_address(), pt_in),
                Errors::MARKET_TRANSFER_FAILED,
            );

            // --- CALCULATE: Determine effective reserve fee (pure check, no side effects) ---
            let (treasury, actual_reserve_fee) = self
                ._get_effective_reserve_fee(result.net_sy_to_reserve);
            let lp_fee = result.net_sy_fee - actual_reserve_fee;

            // --- EFFECTS: Update ALL state BEFORE external transfers (CEI pattern) ---
            self.lp_fees_collected.write(self.lp_fees_collected.read() + lp_fee);
            self.sy_reserve.write(self.sy_reserve.read() - exact_sy_out - actual_reserve_fee);
            self.pt_reserve.write(self.pt_reserve.read() + pt_in);
            self._update_implied_rate();
            let implied_rate_after = self.last_ln_implied_rate.read();

            // --- INTERACTIONS: External transfers OUT (after state is finalized) ---
            assert(sy_contract.transfer(receiver, exact_sy_out), Errors::MARKET_TRANSFER_FAILED);
            self
                ._transfer_reserve_fee_to_treasury(
                    sy_contract, treasury, actual_reserve_fee, caller,
                );

            // Invoke callback if requested
            if callback_data.len() > 0 {
                let callback = IMarketSwapCallbackDispatcher { contract_address: caller };
                // net_pt_to_account is negative (user sent PT to market)
                let net_pt = (pt_in, true); // (magnitude, is_negative=true)
                // net_sy_to_account is positive (market sent SY to receiver)
                let net_sy = (exact_sy_out, false);
                callback.swap_callback(net_pt, net_sy, callback_data);
            }

            // Emit event
            self
                .emit(
                    Swap {
                        sender: caller,
                        receiver,
                        expiry: self.expiry.read(),
                        sy: sy_addr,
                        pt: pt_addr,
                        pt_in,
                        sy_in: 0,
                        pt_out: 0,
                        sy_out: exact_sy_out,
                        total_fee: result.net_sy_fee,
                        lp_fee,
                        reserve_fee: actual_reserve_fee,
                        implied_rate_before,
                        implied_rate_after,
                        exchange_rate: sy_contract.exchange_rate(),
                        sy_reserve_after: self.sy_reserve.read(),
                        pt_reserve_after: self.pt_reserve.read(),
                        timestamp: get_block_timestamp(),
                    },
                );

            pt_in
        }

        /// Get the current ln(implied rate)
        /// Uses _get_market_state_view for read-only access (no side effects)
        fn get_ln_implied_rate(self: @ContractState) -> u256 {
            let state = self._get_market_state_view();
            let time_to_expiry = get_time_to_expiry(self.expiry.read(), get_block_timestamp());
            get_ln_implied_rate(@state, time_to_expiry)
        }

        fn get_total_fees_collected(self: @ContractState) -> u256 {
            // Returns LP fees only (reserve fees are sent to treasury immediately)
            self.lp_fees_collected.read()
        }

        /// Get the factory address
        fn factory(self: @ContractState) -> ContractAddress {
            self.factory.read()
        }

        fn get_scalar_root(self: @ContractState) -> u256 {
            self.scalar_root.read()
        }

        fn get_initial_anchor(self: @ContractState) -> u256 {
            self.initial_anchor.read()
        }

        /// Returns the market's base ln_fee_rate_root.
        /// This is the default fee used for swaps unless a per-router override is set in factory.
        /// Per-router overrides (if any) are caller-specific and queried via
        /// factory.get_market_config().
        fn get_ln_fee_rate_root(self: @ContractState) -> u256 {
            self.ln_fee_rate_root.read()
        }

        /// Returns the effective reserve fee percent used in swaps.
        /// When factory is set, returns factory's value (enables protocol-wide changes).
        /// When factory is zero (standalone market), returns market's stored value.
        fn get_reserve_fee_percent(self: @ContractState) -> u8 {
            let factory = self.factory.read();
            if !factory.is_zero() {
                let factory_contract = IMarketFactoryDispatcher { contract_address: factory };
                // Pass zero address as caller since reserve_fee_percent doesn't vary by caller
                let config = factory_contract
                    .get_market_config(get_contract_address(), Zero::zero());
                config.reserve_fee_percent
            } else {
                self.reserve_fee_percent.read()
            }
        }
    }

    // Reward functions for LP incentives
    #[abi(embed_v0)]
    impl MarketRewardsImpl of IMarketRewards<ContractState> {
        /// Get all registered reward tokens for LP rewards
        fn get_reward_tokens(self: @ContractState) -> Span<ContractAddress> {
            self.reward_manager.get_reward_tokens()
        }

        /// Claim all accrued LP rewards for a user
        /// @param user Address to claim rewards for
        /// @return Array of claimed amounts (one per reward token, in order)
        fn claim_rewards(ref self: ContractState, user: ContractAddress) -> Span<u256> {
            self.reward_manager.claim_rewards(user)
        }

        /// Get user's accrued (unclaimed) LP rewards for all tokens
        /// Note: Does not include pending rewards from unreflected index updates
        /// @param user User address to query
        /// @return Array of accrued amounts (one per reward token, in order)
        fn accrued_rewards(self: @ContractState, user: ContractAddress) -> Span<u256> {
            self.reward_manager.accrued_rewards(user)
        }

        /// Get the current global reward index for a specific token
        /// @param token Reward token address
        /// @return Global reward index (scaled by WAD)
        fn reward_index(self: @ContractState, token: ContractAddress) -> u256 {
            self.reward_manager.reward_index(token)
        }

        /// Get user's reward index for a specific token
        /// @param user User address
        /// @param token Reward token address
        /// @return User's last checkpointed reward index
        fn user_reward_index(
            self: @ContractState, user: ContractAddress, token: ContractAddress,
        ) -> u256 {
            self.reward_manager.user_reward_index(user, token)
        }

        /// Check if a token is registered as a reward token
        /// @param token Token address to check
        /// @return True if token is a registered reward token
        fn is_reward_token(self: @ContractState, token: ContractAddress) -> bool {
            self.reward_manager.is_reward_token(token)
        }

        /// Get the number of registered reward tokens
        /// @return Count of reward tokens
        fn reward_tokens_count(self: @ContractState) -> u32 {
            self.reward_manager.reward_tokens_count()
        }
    }

    // Admin functions for pausability and fee collection
    #[abi(embed_v0)]
    impl MarketAdminImpl of IMarketAdmin<ContractState> {
        /// Pause all market operations (PAUSER_ROLE only)
        fn pause(ref self: ContractState) {
            self.access_control.assert_only_role(PAUSER_ROLE);
            self.pausable.pause();
        }

        /// Unpause all market operations (PAUSER_ROLE only)
        fn unpause(ref self: ContractState) {
            self.access_control.assert_only_role(PAUSER_ROLE);
            self.pausable.unpause();
        }

        /// Reset LP fee counter and emit analytics event (owner only)
        /// Note: In Pendle-style fee model, LP fees stay in pool reserves (no transfer).
        /// Reserve fees are sent to treasury immediately during swaps.
        /// This function is for analytics tracking only - it resets the counter and emits an event.
        /// @param receiver Address recorded in the event (no actual transfer occurs)
        /// @return Amount of LP fees tracked since last reset
        fn collect_fees(ref self: ContractState, receiver: ContractAddress) -> u256 {
            // Only owner can collect fees
            self.ownable.assert_only_owner();

            // Validate receiver
            assert(!receiver.is_zero(), Errors::ZERO_ADDRESS);

            // Note: In Pendle-style fee model:
            // - Reserve fees are transferred to treasury immediately during each swap
            // - LP fees stay in the pool reserves, benefiting LPs on withdrawal
            // This function now only tracks cumulative LP fees for analytics purposes
            // The actual LP fees are embedded in pool reserves

            // Get tracked LP fees (for analytics)
            let fees = self.lp_fees_collected.read();
            if fees == 0 {
                return 0;
            }

            // Reset tracked LP fees counter
            self.lp_fees_collected.write(0);

            // Note: We don't transfer SY here because LP fees are already in reserves
            // They benefit LPs proportionally when they burn LP tokens

            // Emit event for tracking purposes
            self
                .emit(
                    FeesCollected {
                        collector: get_caller_address(),
                        receiver,
                        market: get_contract_address(),
                        amount: fees,
                        expiry: self.expiry.read(),
                        ln_fee_rate_root: self.ln_fee_rate_root.read(),
                        timestamp: get_block_timestamp(),
                    },
                );

            fees
        }

        /// Set the scalar root parameter (owner only)
        /// Controls rate sensitivity - higher values mean rates change more with pool imbalance
        /// Typical values: 0.01-0.5 WAD (10^16 to 5*10^17)
        /// @param new_scalar_root New scalar root value in WAD
        fn set_scalar_root(ref self: ContractState, new_scalar_root: u256) {
            // Only owner can update scalar root
            self.ownable.assert_only_owner();

            // Validate non-zero
            assert(new_scalar_root > 0, Errors::ZERO_AMOUNT);

            // Get old value for event
            let old_value = self.scalar_root.read();

            // Update scalar root
            self.scalar_root.write(new_scalar_root);

            // Update implied rate cache with new scalar root
            self._update_implied_rate();

            // Emit event
            self
                .emit(
                    ScalarRootUpdated {
                        market: get_contract_address(),
                        old_value,
                        new_value: new_scalar_root,
                        timestamp: get_block_timestamp(),
                    },
                );
        }
    }

    // TWAP Oracle functions
    #[abi(embed_v0)]
    impl MarketOracleImpl of IMarketOracle<ContractState> {
        /// Query cumulative ln(implied rate) values at multiple time offsets.
        /// Returns an array of cumulative values that can be used to compute TWAP:
        /// TWAP = (cumulative_now - cumulative_past) / duration
        fn observe(self: @ContractState, seconds_agos: Array<u32>) -> Array<u256> {
            let time = get_block_timestamp();
            let index = self.observation_index.read();
            let cardinality = self.observation_cardinality.read();
            let ln_implied_rate = self.last_ln_implied_rate.read();

            assert(cardinality > 0, Errors::ORACLE_ZERO_CARDINALITY);

            // Get newest observation
            let newest = self.observations.read(index);

            // Compute oldest observation once (not per-iteration)
            let candidate_idx = (index + 1) % cardinality;
            let candidate = self.observations.read(candidate_idx);
            let oldest_idx = oracle_lib::get_oldest_observation_index(
                index, cardinality, candidate.initialized,
            );
            let oldest = self.observations.read(oldest_idx);

            // Build all observations array once for binary search (lazy - only if needed)
            // We'll populate this on first binary search need
            let mut all_obs_built: bool = false;
            let mut all_obs: Array<Observation> = ArrayTrait::new();

            // Build surrounding observations for each seconds_ago query
            let mut surrounding_observations: Array<SurroundingObservations> = ArrayTrait::new();
            let mut i: usize = 0;
            while i < seconds_agos.len() {
                let seconds_ago: u64 = (*seconds_agos.at(i)).into();
                assert(seconds_ago <= time, Errors::ORACLE_TARGET_IN_FUTURE);
                let target = time - seconds_ago;

                // Try to get surrounding without binary search
                let surrounding =
                    match oracle_lib::get_surrounding_observations(
                        target, newest, oldest, ln_implied_rate,
                    ) {
                    Option::Some(s) => s,
                    Option::None => {
                        // Need binary search - build all_obs once on first need
                        if !all_obs_built {
                            let mut j: u16 = 0;
                            while j < cardinality {
                                all_obs.append(self.observations.read(j));
                                j += 1;
                            }
                            all_obs_built = true;
                        }
                        oracle_lib::binary_search(all_obs.span(), target, index, cardinality)
                    },
                };
                surrounding_observations.append(surrounding);
                i += 1;
            }

            // Compute cumulative values using observe helper
            oracle_lib::observe(
                time, seconds_agos.span(), newest, ln_implied_rate, surrounding_observations.span(),
            )
        }

        /// Pre-allocate observation buffer slots to reduce storage costs during swaps.
        /// Only grows the buffer (cannot shrink). Capped at MAX_CARDINALITY to prevent bloat.
        fn increase_observations_cardinality_next(ref self: ContractState, cardinality_next: u16) {
            // Cap cardinality to prevent unbounded storage growth
            assert(cardinality_next <= MAX_CARDINALITY, Errors::ORACLE_CARDINALITY_EXCEEDS_MAX);

            let current_next = self.observation_cardinality_next.read();
            let grow_result = oracle_lib::grow(current_next, cardinality_next);

            // Write pre-initialized observations to storage
            let mut slots = grow_result.slots_to_initialize;
            while let Option::Some((idx, obs)) = slots.pop_front() {
                self.observations.write(idx, obs);
            }

            // Update cardinality_next if changed
            if grow_result.cardinality_next != current_next {
                self.observation_cardinality_next.write(grow_result.cardinality_next);
            }
        }

        /// Read a single observation from the ring buffer.
        /// Returns (block_timestamp, ln_implied_rate_cumulative, initialized)
        /// Reverts if index is out of bounds (>= observation_cardinality).
        fn get_observation(self: @ContractState, index: u16) -> (u64, u256, bool) {
            let cardinality = self.observation_cardinality.read();
            assert(index < cardinality, Errors::ORACLE_INDEX_OUT_OF_BOUNDS);
            let obs = self.observations.read(index);
            (obs.block_timestamp, obs.ln_implied_rate_cumulative, obs.initialized)
        }

        /// Get oracle state for external TWAP calculations.
        /// Returns the last_ln_implied_rate and oracle buffer indices.
        fn get_oracle_state(self: @ContractState) -> OracleState {
            OracleState {
                last_ln_implied_rate: self.last_ln_implied_rate.read(),
                observation_index: self.observation_index.read(),
                observation_cardinality: self.observation_cardinality.read(),
                observation_cardinality_next: self.observation_cardinality_next.read(),
            }
        }
    }

    // Internal functions
    #[generate_trait]
    pub impl InternalImpl of InternalTrait {
        /// Build current market state from storage
        /// Updates and fetches py_index from YT contract per-call to ensure fresh value
        /// Calls update_py_index() instead of py_index_current() to advance YT's stored index,
        /// ensuring interest calculations stay accurate during swaps
        /// Note: rate_impact_sensitivity is 0 for non-swap operations (mint/burn)
        fn _get_market_state(self: @ContractState) -> MarketState {
            // Fetch and update py_index from YT - this is the SY -> asset conversion rate
            // Using update_py_index() ensures the YT's stored index advances during swaps,
            // preventing interest calculation lag (Pendle-style pyIndexCurrent behavior)
            let yt_contract = IYTDispatcher { contract_address: self.yt.read() };
            let py_index = yt_contract.update_py_index();

            MarketState {
                sy_reserve: self.sy_reserve.read(),
                pt_reserve: self.pt_reserve.read(),
                total_lp: self.erc20.total_supply(),
                scalar_root: self.scalar_root.read(),
                initial_anchor: self.initial_anchor.read(),
                ln_fee_rate_root: self.ln_fee_rate_root.read(),
                reserve_fee_percent: self.reserve_fee_percent.read(),
                expiry: self.expiry.read(),
                last_ln_implied_rate: self.last_ln_implied_rate.read(),
                py_index,
                rate_impact_sensitivity: 0 // Not used for non-swap operations
            }
        }

        /// Build current market state from storage (read-only version for view functions)
        /// Uses py_index_current() instead of update_py_index() to avoid side effects.
        /// This ensures view functions remain side-effect-free and don't attempt
        /// mutating external calls.
        fn _get_market_state_view(self: @ContractState) -> MarketState {
            // Use py_index_current() for read-only access (no storage writes)
            let yt_contract = IYTDispatcher { contract_address: self.yt.read() };
            let py_index = yt_contract.py_index_current();

            MarketState {
                sy_reserve: self.sy_reserve.read(),
                pt_reserve: self.pt_reserve.read(),
                total_lp: self.erc20.total_supply(),
                scalar_root: self.scalar_root.read(),
                initial_anchor: self.initial_anchor.read(),
                ln_fee_rate_root: self.ln_fee_rate_root.read(),
                reserve_fee_percent: self.reserve_fee_percent.read(),
                expiry: self.expiry.read(),
                last_ln_implied_rate: self.last_ln_implied_rate.read(),
                py_index,
                rate_impact_sensitivity: 0 // Not used for view functions
            }
        }

        /// Build current market state with effective fee configuration (considering factory
        /// settings and per-router overrides)
        /// When factory is set:
        ///   - Uses factory's reserve_fee_percent (allows protocol-wide fee changes)
        ///   - Uses factory's rate_impact_sensitivity (enables dynamic fee adjustment)
        ///   - Uses per-router ln_fee_rate_root override if set, else market's base fee
        /// When factory is zero (standalone market):
        ///   - Falls back to market's own stored values (sensitivity = 0)
        fn _get_market_state_with_effective_fee(
            self: @ContractState, caller: ContractAddress,
        ) -> MarketState {
            let yt_contract = IYTDispatcher { contract_address: self.yt.read() };
            let py_index = yt_contract.update_py_index();

            // Query factory for effective fee config
            let factory = self.factory.read();
            let (
                effective_ln_fee_rate_root,
                effective_reserve_fee_percent,
                effective_rate_impact_sensitivity,
            ) =
                if !factory
                .is_zero() {
                let factory_contract = IMarketFactoryDispatcher { contract_address: factory };
                let config = factory_contract.get_market_config(get_contract_address(), caller);

                // For ln_fee_rate_root: use override if set (non-zero), otherwise market's base fee
                let ln_fee = if config.ln_fee_rate_root != 0 {
                    config.ln_fee_rate_root
                } else {
                    self.ln_fee_rate_root.read()
                };

                // For reserve_fee_percent and rate_impact_sensitivity: always use factory's value
                // (enables protocol-wide changes)
                (ln_fee, config.reserve_fee_percent, config.rate_impact_sensitivity)
            } else {
                // No factory - use market's own stored values, no rate impact sensitivity
                (self.ln_fee_rate_root.read(), self.reserve_fee_percent.read(), 0)
            };

            MarketState {
                sy_reserve: self.sy_reserve.read(),
                pt_reserve: self.pt_reserve.read(),
                total_lp: self.erc20.total_supply(),
                scalar_root: self.scalar_root.read(),
                initial_anchor: self.initial_anchor.read(),
                ln_fee_rate_root: effective_ln_fee_rate_root,
                reserve_fee_percent: effective_reserve_fee_percent,
                expiry: self.expiry.read(),
                last_ln_implied_rate: self.last_ln_implied_rate.read(),
                py_index,
                rate_impact_sensitivity: effective_rate_impact_sensitivity,
            }
        }

        /// Calculate effective reserve fee (checks if transfer will occur)
        /// Returns (treasury_address, amount_to_transfer)
        /// If treasury is zero, amount_to_transfer is 0 (fee stays in pool as LP fee)
        /// IMPORTANT: This is a pure check - no side effects. Call before state updates.
        fn _get_effective_reserve_fee(
            self: @ContractState, reserve_fee: u256,
        ) -> (ContractAddress, u256) {
            if reserve_fee == 0 {
                return (Zero::zero(), 0);
            }

            // Get treasury from factory - if no factory, fee stays in pool (benefits LPs)
            let factory = self.factory.read();
            if factory.is_zero() {
                return (Zero::zero(), 0);
            }

            let factory_contract = IMarketFactoryDispatcher { contract_address: factory };
            let treasury = factory_contract.get_treasury();

            // Only transfer if treasury is set - otherwise fee stays in pool
            if treasury.is_zero() {
                return (Zero::zero(), 0);
            }

            (treasury, reserve_fee)
        }

        /// Resolve recipient for the permanently locked MINIMUM_LIQUIDITY on first mint.
        /// Uses factory treasury when configured; otherwise falls back to a dead address.
        fn _get_minimum_liquidity_recipient(self: @ContractState) -> ContractAddress {
            let factory = self.factory.read();
            if !factory.is_zero() {
                let factory_contract = IMarketFactoryDispatcher { contract_address: factory };
                let treasury = factory_contract.get_treasury();
                if !treasury.is_zero() {
                    return treasury;
                }
            }

            // OpenZeppelin ERC20 disallows minting to zero address.
            1.try_into().unwrap()
        }

        /// Transfer reserve fees to treasury (Pendle-style)
        /// IMPORTANT: Call this AFTER state updates (CEI pattern)
        /// Assumes _get_effective_reserve_fee was called first to determine amount
        fn _transfer_reserve_fee_to_treasury(
            ref self: ContractState,
            sy_contract: ISYDispatcher,
            treasury: ContractAddress,
            reserve_fee: u256,
            caller: ContractAddress,
        ) {
            if reserve_fee == 0 || treasury.is_zero() {
                return;
            }

            // Transfer to treasury
            assert(sy_contract.transfer(treasury, reserve_fee), Errors::MARKET_TRANSFER_FAILED);

            self
                .emit(
                    ReserveFeeTransferred {
                        market: get_contract_address(),
                        treasury,
                        caller,
                        amount: reserve_fee,
                        expiry: self.expiry.read(),
                        timestamp: get_block_timestamp(),
                    },
                );
        }

        /// Update the cached implied rate and write TWAP observation.
        /// CRITICAL: Writes observation with OLD rate BEFORE updating the rate.
        /// This ensures the cumulative calculation reflects the rate that was active
        /// during the elapsed time period.
        fn _update_implied_rate(ref self: ContractState) {
            let timestamp = get_block_timestamp();
            let old_rate = self.last_ln_implied_rate.read();

            // --- TWAP: Write observation BEFORE updating rate ---
            // The cumulative calculation uses old_rate × time_delta
            let last_obs = self.observations.read(self.observation_index.read());
            let write_result = oracle_lib::write(
                last_obs,
                self.observation_index.read(),
                timestamp,
                old_rate, // MUST use stored (old) rate
                self.observation_cardinality.read(),
                self.observation_cardinality_next.read(),
            );
            // Persist observation changes (no-op if same block)
            self.observations.write(write_result.index, write_result.observation);
            self.observation_index.write(write_result.index);
            self.observation_cardinality.write(write_result.cardinality);
            // --- End TWAP write ---

            // Calculate new rate
            let state = self._get_market_state();
            let time_to_expiry = get_time_to_expiry(self.expiry.read(), timestamp);
            let new_rate = get_ln_implied_rate(@state, time_to_expiry);

            // Only update and emit if rate has changed
            if new_rate != old_rate {
                self.last_ln_implied_rate.write(new_rate);

                // Get exchange rate for event
                let sy_contract = ISYDispatcher { contract_address: self.sy.read() };

                self
                    .emit(
                        ImpliedRateUpdated {
                            market: get_contract_address(),
                            expiry: self.expiry.read(),
                            old_rate,
                            new_rate,
                            timestamp,
                            time_to_expiry,
                            exchange_rate: sy_contract.exchange_rate(),
                            sy_reserve: self.sy_reserve.read(),
                            pt_reserve: self.pt_reserve.read(),
                            total_lp: self.erc20.total_supply(),
                        },
                    );
            }
        }

        /// Set the initial ln(implied rate) for first mint.
        /// Mirrors Pendle's setInitialLnImpliedRate - called AFTER first liquidity is added.
        /// Computes the initial rate based on pool proportion and initial_anchor.
        /// Also writes an observation to establish the TWAP baseline.
        fn _set_initial_ln_implied_rate(ref self: ContractState) {
            let timestamp = get_block_timestamp();
            let old_rate = self.last_ln_implied_rate.read(); // Expected to be 0

            // --- TWAP: Write observation with stored (0) rate BEFORE setting initial rate ---
            let last_obs = self.observations.read(self.observation_index.read());
            let write_result = oracle_lib::write(
                last_obs,
                self.observation_index.read(),
                timestamp,
                old_rate, // Use stored rate (0 before first mint)
                self.observation_cardinality.read(),
                self.observation_cardinality_next.read(),
            );
            // Persist observation changes
            self.observations.write(write_result.index, write_result.observation);
            self.observation_index.write(write_result.index);
            self.observation_cardinality.write(write_result.cardinality);
            // --- End TWAP write ---

            let state = self._get_market_state();
            let time_to_expiry = get_time_to_expiry(self.expiry.read(), timestamp);

            // Use Pendle's formula to compute initial implied rate
            let initial_rate = set_initial_ln_implied_rate(@state, time_to_expiry);

            // Store the computed rate
            self.last_ln_implied_rate.write(initial_rate);

            // Get exchange rate for event
            let sy_contract = ISYDispatcher { contract_address: self.sy.read() };

            // Emit event for the initial rate
            self
                .emit(
                    ImpliedRateUpdated {
                        market: get_contract_address(),
                        expiry: self.expiry.read(),
                        old_rate, // Was 0 before first mint
                        new_rate: initial_rate,
                        timestamp,
                        time_to_expiry,
                        exchange_rate: sy_contract.exchange_rate(),
                        sy_reserve: self.sy_reserve.read(),
                        pt_reserve: self.pt_reserve.read(),
                        total_lp: self.erc20.total_supply(),
                    },
                );
        }
    }
}
