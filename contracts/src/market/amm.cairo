/// AMM Market Contract
/// Implements the PT/SY trading pool with time-aware pricing.
/// The market acts as an LP token itself (ERC20) for liquidity providers.
/// - Pausable: Can be paused in emergencies by PAUSER_ROLE
/// - Upgradeable: Can be upgraded by owner

#[starknet::contract]
pub mod Market {
    use core::num::traits::Zero;
    use horizon::interfaces::i_market::{IMarket, IMarketAdmin};
    use horizon::interfaces::i_pt::{IPTDispatcher, IPTDispatcherTrait};
    use horizon::interfaces::i_sy::{ISYDispatcher, ISYDispatcherTrait};
    use horizon::libraries::errors::Errors;
    use horizon::libraries::roles::{DEFAULT_ADMIN_ROLE, PAUSER_ROLE};
    use horizon::market::market_math_fp::{
        MINIMUM_LIQUIDITY, MarketState, calc_burn_lp, calc_mint_lp, calc_swap_exact_pt_for_sy,
        calc_swap_exact_sy_for_pt, calc_swap_pt_for_exact_sy, calc_swap_sy_for_exact_pt,
        check_slippage, get_ln_implied_rate, get_time_to_expiry,
    };
    use openzeppelin_access::accesscontrol::AccessControlComponent;
    use openzeppelin_access::ownable::OwnableComponent;
    use openzeppelin_interfaces::upgrades::IUpgradeable;
    use openzeppelin_introspection::src5::SRC5Component;
    use openzeppelin_security::pausable::PausableComponent;
    use openzeppelin_token::erc20::{DefaultConfig, ERC20Component, ERC20HooksEmptyImpl};
    use openzeppelin_upgrades::UpgradeableComponent;
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use starknet::{
        ClassHash, ContractAddress, get_block_timestamp, get_caller_address, get_contract_address,
    };

    component!(path: ERC20Component, storage: erc20, event: ERC20Event);
    component!(path: SRC5Component, storage: src5, event: SRC5Event);
    component!(path: AccessControlComponent, storage: access_control, event: AccessControlEvent);
    component!(path: PausableComponent, storage: pausable, event: PausableEvent);
    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);
    component!(path: UpgradeableComponent, storage: upgradeable, event: UpgradeableEvent);

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

    // Upgradeable - internal only
    impl UpgradeableInternalImpl = UpgradeableComponent::InternalImpl<ContractState>;

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
        #[substorage(v0)]
        upgradeable: UpgradeableComponent::Storage,
        // Token addresses
        sy: ContractAddress,
        pt: ContractAddress,
        yt: ContractAddress,
        // Pool reserves
        sy_reserve: u256,
        pt_reserve: u256,
        // Market parameters
        scalar_root: u256,
        initial_anchor: u256,
        fee_rate: u256,
        // Expiry info
        expiry: u64,
        // Cached implied rate
        last_ln_implied_rate: u256,
        // Total fees collected (in SY)
        total_fees_collected: u256,
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
        #[flat]
        UpgradeableEvent: UpgradeableComponent::Event,
        Mint: Mint,
        Burn: Burn,
        Swap: Swap,
        ImpliedRateUpdated: ImpliedRateUpdated,
        FeesCollected: FeesCollected,
        ScalarRootUpdated: ScalarRootUpdated,
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
        pub fee: u256,
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
        pub fee_rate: u256,
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
        fee_rate: u256,
        pauser: ContractAddress,
    ) {
        // Initialize LP token (ERC20)
        self.erc20.initializer(name, symbol);

        // Validate inputs
        assert(!pt.is_zero(), Errors::ZERO_ADDRESS);
        assert(!pauser.is_zero(), Errors::ZERO_ADDRESS);

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
        self.expiry.write(expiry);

        // Store market parameters
        self.scalar_root.write(scalar_root);
        self.initial_anchor.write(initial_anchor);
        self.fee_rate.write(fee_rate);

        // Initialize reserves to 0
        self.sy_reserve.write(0);
        self.pt_reserve.write(0);
        self.last_ln_implied_rate.write(initial_anchor);
        self.total_fees_collected.write(0);
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
            self.erc20.ERC20_total_supply.read()
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

            // For first mint, permanently lock MINIMUM_LIQUIDITY by minting to dead address
            // Using address 1 since OpenZeppelin ERC20 doesn't allow minting to zero address
            // This prevents first depositor attacks and ensures pool can never be fully drained
            if is_first_mint {
                let dead_address: ContractAddress = 1.try_into().unwrap();
                self.erc20.mint(dead_address, MINIMUM_LIQUIDITY);
            }

            // Mint LP tokens to receiver
            self.erc20.mint(receiver, lp_to_mint);

            // Update implied rate cache
            self._update_implied_rate();

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
                        total_lp_after: self.erc20.ERC20_total_supply.read(),
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
                        total_lp_after: self.erc20.ERC20_total_supply.read(),
                        timestamp: get_block_timestamp(),
                    },
                );

            (sy_out, pt_out)
        }

        /// Swap exact PT for SY
        /// @param receiver Address to receive SY
        /// @param exact_pt_in Exact amount of PT to sell
        /// @param min_sy_out Minimum SY to receive (slippage protection)
        /// @return Amount of SY received
        fn swap_exact_pt_for_sy(
            ref self: ContractState, receiver: ContractAddress, exact_pt_in: u256, min_sy_out: u256,
        ) -> u256 {
            self.pausable.assert_not_paused();
            assert(!self.is_expired(), Errors::MARKET_EXPIRED);
            assert(!receiver.is_zero(), Errors::ZERO_ADDRESS);
            assert(exact_pt_in > 0, Errors::ZERO_AMOUNT);

            let caller = get_caller_address();
            let state = self._get_market_state();
            let time_to_expiry = get_time_to_expiry(self.expiry.read(), get_block_timestamp());

            // Capture implied rate before swap
            let implied_rate_before = get_ln_implied_rate(@state, time_to_expiry);

            // Calculate output
            let (sy_out, fee) = calc_swap_exact_pt_for_sy(@state, exact_pt_in, time_to_expiry);
            assert(check_slippage(sy_out, min_sy_out), Errors::MARKET_SLIPPAGE_EXCEEDED);

            // Transfer PT from caller
            let pt_contract = IPTDispatcher { contract_address: self.pt.read() };
            assert(
                pt_contract.transfer_from(caller, get_contract_address(), exact_pt_in),
                Errors::MARKET_TRANSFER_FAILED,
            );

            // Update reserves
            self.sy_reserve.write(self.sy_reserve.read() - sy_out);
            self.pt_reserve.write(self.pt_reserve.read() + exact_pt_in);
            self.total_fees_collected.write(self.total_fees_collected.read() + fee);

            // Transfer SY to receiver
            let sy_addr = self.sy.read();
            let pt_addr = self.pt.read();
            let sy_contract = ISYDispatcher { contract_address: sy_addr };
            assert(sy_contract.transfer(receiver, sy_out), Errors::MARKET_TRANSFER_FAILED);

            // Update implied rate cache
            self._update_implied_rate();

            // Get implied rate after swap
            let implied_rate_after = self.last_ln_implied_rate.read();

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
                        fee,
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
        /// @return Amount of SY spent
        fn swap_sy_for_exact_pt(
            ref self: ContractState, receiver: ContractAddress, exact_pt_out: u256, max_sy_in: u256,
        ) -> u256 {
            self.pausable.assert_not_paused();
            assert(!self.is_expired(), Errors::MARKET_EXPIRED);
            assert(!receiver.is_zero(), Errors::ZERO_ADDRESS);
            assert(exact_pt_out > 0, Errors::ZERO_AMOUNT);

            let caller = get_caller_address();
            let state = self._get_market_state();
            let time_to_expiry = get_time_to_expiry(self.expiry.read(), get_block_timestamp());

            // Capture implied rate before swap
            let implied_rate_before = get_ln_implied_rate(@state, time_to_expiry);

            // Calculate input required
            let (sy_in, fee) = calc_swap_sy_for_exact_pt(@state, exact_pt_out, time_to_expiry);
            assert(sy_in <= max_sy_in, Errors::MARKET_SLIPPAGE_EXCEEDED);

            // Transfer SY from caller
            let sy_addr = self.sy.read();
            let pt_addr = self.pt.read();
            let sy_contract = ISYDispatcher { contract_address: sy_addr };
            assert(
                sy_contract.transfer_from(caller, get_contract_address(), sy_in),
                Errors::MARKET_TRANSFER_FAILED,
            );

            // Update reserves
            self.sy_reserve.write(self.sy_reserve.read() + sy_in);
            self.pt_reserve.write(self.pt_reserve.read() - exact_pt_out);
            self.total_fees_collected.write(self.total_fees_collected.read() + fee);

            // Transfer PT to receiver
            let pt_contract = IPTDispatcher { contract_address: pt_addr };
            assert(pt_contract.transfer(receiver, exact_pt_out), Errors::MARKET_TRANSFER_FAILED);

            // Update implied rate cache
            self._update_implied_rate();

            // Get implied rate after swap
            let implied_rate_after = self.last_ln_implied_rate.read();

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
                        fee,
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
        /// @return Amount of PT received
        fn swap_exact_sy_for_pt(
            ref self: ContractState, receiver: ContractAddress, exact_sy_in: u256, min_pt_out: u256,
        ) -> u256 {
            self.pausable.assert_not_paused();
            assert(!self.is_expired(), Errors::MARKET_EXPIRED);
            assert(!receiver.is_zero(), Errors::ZERO_ADDRESS);
            assert(exact_sy_in > 0, Errors::ZERO_AMOUNT);

            let caller = get_caller_address();
            let state = self._get_market_state();
            let time_to_expiry = get_time_to_expiry(self.expiry.read(), get_block_timestamp());

            // Capture implied rate before swap
            let implied_rate_before = get_ln_implied_rate(@state, time_to_expiry);

            // Calculate output
            let (pt_out, fee) = calc_swap_exact_sy_for_pt(@state, exact_sy_in, time_to_expiry);
            assert(check_slippage(pt_out, min_pt_out), Errors::MARKET_SLIPPAGE_EXCEEDED);

            // Transfer SY from caller
            let sy_addr = self.sy.read();
            let pt_addr = self.pt.read();
            let sy_contract = ISYDispatcher { contract_address: sy_addr };
            assert(
                sy_contract.transfer_from(caller, get_contract_address(), exact_sy_in),
                Errors::MARKET_TRANSFER_FAILED,
            );

            // Update reserves
            self.sy_reserve.write(self.sy_reserve.read() + exact_sy_in);
            self.pt_reserve.write(self.pt_reserve.read() - pt_out);
            self.total_fees_collected.write(self.total_fees_collected.read() + fee);

            // Transfer PT to receiver
            let pt_contract = IPTDispatcher { contract_address: pt_addr };
            assert(pt_contract.transfer(receiver, pt_out), Errors::MARKET_TRANSFER_FAILED);

            // Update implied rate cache
            self._update_implied_rate();

            // Get implied rate after swap
            let implied_rate_after = self.last_ln_implied_rate.read();

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
                        fee,
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
        /// @return Amount of PT spent
        fn swap_pt_for_exact_sy(
            ref self: ContractState, receiver: ContractAddress, exact_sy_out: u256, max_pt_in: u256,
        ) -> u256 {
            self.pausable.assert_not_paused();
            assert(!self.is_expired(), Errors::MARKET_EXPIRED);
            assert(!receiver.is_zero(), Errors::ZERO_ADDRESS);
            assert(exact_sy_out > 0, Errors::ZERO_AMOUNT);

            let caller = get_caller_address();
            let state = self._get_market_state();
            let time_to_expiry = get_time_to_expiry(self.expiry.read(), get_block_timestamp());

            // Capture implied rate before swap
            let implied_rate_before = get_ln_implied_rate(@state, time_to_expiry);

            // Calculate input required
            let (pt_in, fee) = calc_swap_pt_for_exact_sy(@state, exact_sy_out, time_to_expiry);
            assert(pt_in <= max_pt_in, Errors::MARKET_SLIPPAGE_EXCEEDED);

            // Transfer PT from caller
            let sy_addr = self.sy.read();
            let pt_addr = self.pt.read();
            let pt_contract = IPTDispatcher { contract_address: pt_addr };
            assert(
                pt_contract.transfer_from(caller, get_contract_address(), pt_in),
                Errors::MARKET_TRANSFER_FAILED,
            );

            // Update reserves
            self.sy_reserve.write(self.sy_reserve.read() - exact_sy_out);
            self.pt_reserve.write(self.pt_reserve.read() + pt_in);
            self.total_fees_collected.write(self.total_fees_collected.read() + fee);

            // Transfer SY to receiver
            let sy_contract = ISYDispatcher { contract_address: sy_addr };
            assert(sy_contract.transfer(receiver, exact_sy_out), Errors::MARKET_TRANSFER_FAILED);

            // Update implied rate cache
            self._update_implied_rate();

            // Get implied rate after swap
            let implied_rate_after = self.last_ln_implied_rate.read();

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
                        fee,
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
        fn get_ln_implied_rate(self: @ContractState) -> u256 {
            let state = self._get_market_state();
            let time_to_expiry = get_time_to_expiry(self.expiry.read(), get_block_timestamp());
            get_ln_implied_rate(@state, time_to_expiry)
        }

        fn get_total_fees_collected(self: @ContractState) -> u256 {
            self.total_fees_collected.read()
        }

        fn get_scalar_root(self: @ContractState) -> u256 {
            self.scalar_root.read()
        }

        fn get_initial_anchor(self: @ContractState) -> u256 {
            self.initial_anchor.read()
        }

        fn get_fee_rate(self: @ContractState) -> u256 {
            self.fee_rate.read()
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

        /// Collect accumulated trading fees (owner only)
        /// Fees are collected in SY tokens and transferred to the specified receiver
        /// @param receiver Address to receive the collected SY fees
        /// @return Amount of SY fees collected
        fn collect_fees(ref self: ContractState, receiver: ContractAddress) -> u256 {
            // Only owner can collect fees
            self.ownable.assert_only_owner();

            // Validate receiver
            assert(!receiver.is_zero(), Errors::ZERO_ADDRESS);

            // Get collected fees
            let fees = self.total_fees_collected.read();
            if fees == 0 {
                return 0;
            }

            // Reset collected fees
            self.total_fees_collected.write(0);

            // Transfer SY fees to receiver
            let sy_addr = self.sy.read();
            let sy_contract = ISYDispatcher { contract_address: sy_addr };
            assert(sy_contract.transfer(receiver, fees), Errors::MARKET_TRANSFER_FAILED);

            // Emit event
            self
                .emit(
                    FeesCollected {
                        collector: get_caller_address(),
                        receiver,
                        market: get_contract_address(),
                        amount: fees,
                        expiry: self.expiry.read(),
                        fee_rate: self.fee_rate.read(),
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

    // Upgradeable implementation
    #[abi(embed_v0)]
    impl UpgradeableImpl of IUpgradeable<ContractState> {
        /// Upgrade the contract to a new implementation (owner only)
        fn upgrade(ref self: ContractState, new_class_hash: ClassHash) {
            self.ownable.assert_only_owner();
            self.upgradeable.upgrade(new_class_hash);
        }
    }

    // Internal functions
    #[generate_trait]
    pub impl InternalImpl of InternalTrait {
        /// Build current market state from storage
        fn _get_market_state(self: @ContractState) -> MarketState {
            MarketState {
                sy_reserve: self.sy_reserve.read(),
                pt_reserve: self.pt_reserve.read(),
                total_lp: self.erc20.ERC20_total_supply.read(),
                scalar_root: self.scalar_root.read(),
                initial_anchor: self.initial_anchor.read(),
                fee_rate: self.fee_rate.read(),
                expiry: self.expiry.read(),
                last_ln_implied_rate: self.last_ln_implied_rate.read(),
            }
        }

        /// Update the cached implied rate
        fn _update_implied_rate(ref self: ContractState) {
            let old_rate = self.last_ln_implied_rate.read();
            let state = self._get_market_state();
            let time_to_expiry = get_time_to_expiry(self.expiry.read(), get_block_timestamp());
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
                            timestamp: get_block_timestamp(),
                            time_to_expiry,
                            exchange_rate: sy_contract.exchange_rate(),
                            sy_reserve: self.sy_reserve.read(),
                            pt_reserve: self.pt_reserve.read(),
                            total_lp: self.erc20.ERC20_total_supply.read(),
                        },
                    );
            }
        }
    }
}
