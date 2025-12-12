/// AMM Market Contract
/// Implements the PT/SY trading pool with time-aware pricing.
/// The market acts as an LP token itself (ERC20) for liquidity providers.

#[starknet::contract]
pub mod Market {
    use core::num::traits::Zero;
    use openzeppelin_token::erc20::{DefaultConfig, ERC20Component, ERC20HooksEmptyImpl};
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use starknet::{ContractAddress, get_block_timestamp, get_caller_address, get_contract_address};
    use yield_tokenization::interfaces::i_market::IMarket;
    use yield_tokenization::interfaces::i_pt::{IPTDispatcher, IPTDispatcherTrait};
    use yield_tokenization::interfaces::i_sy::{ISYDispatcher, ISYDispatcherTrait};
    use yield_tokenization::libraries::errors::Errors;
    use yield_tokenization::market::market_math::{
        MarketState, calc_burn_lp, calc_mint_lp, calc_swap_exact_pt_for_sy,
        calc_swap_exact_sy_for_pt, calc_swap_pt_for_exact_sy, calc_swap_sy_for_exact_pt,
        check_slippage, get_ln_implied_rate, get_time_to_expiry,
    };

    component!(path: ERC20Component, storage: erc20, event: ERC20Event);

    // ERC20 component for LP token functionality
    #[abi(embed_v0)]
    impl ERC20Impl = ERC20Component::ERC20Impl<ContractState>;
    #[abi(embed_v0)]
    impl ERC20MetadataImpl = ERC20Component::ERC20MetadataImpl<ContractState>;
    impl ERC20InternalImpl = ERC20Component::InternalImpl<ContractState>;

    #[storage]
    struct Storage {
        #[substorage(v0)]
        erc20: ERC20Component::Storage,
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
        Mint: Mint,
        Burn: Burn,
        Swap: Swap,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Mint {
        #[key]
        pub sender: ContractAddress,
        #[key]
        pub receiver: ContractAddress,
        pub sy_amount: u256,
        pub pt_amount: u256,
        pub lp_amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Burn {
        #[key]
        pub sender: ContractAddress,
        #[key]
        pub receiver: ContractAddress,
        pub lp_amount: u256,
        pub sy_amount: u256,
        pub pt_amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Swap {
        #[key]
        pub sender: ContractAddress,
        #[key]
        pub receiver: ContractAddress,
        pub pt_in: u256,
        pub sy_in: u256,
        pub pt_out: u256,
        pub sy_out: u256,
        pub fee: u256,
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
    ) {
        // Initialize LP token (ERC20)
        self.erc20.initializer(name, symbol);

        // Validate inputs
        assert(!pt.is_zero(), Errors::ZERO_ADDRESS);

        // Get SY and YT from PT contract
        let pt_contract = IPTDispatcher { contract_address: pt };
        let sy = pt_contract.sy();
        let yt = pt_contract.yt();
        let expiry = pt_contract.expiry();

        assert(!sy.is_zero(), Errors::ZERO_ADDRESS);
        assert(!yt.is_zero(), Errors::ZERO_ADDRESS);
        assert(expiry > get_block_timestamp(), Errors::MARKET_EXPIRED);

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
            // Validate
            assert(!self.is_expired(), Errors::MARKET_EXPIRED);
            assert(!receiver.is_zero(), Errors::ZERO_ADDRESS);
            assert(sy_desired > 0 && pt_desired > 0, Errors::ZERO_AMOUNT);

            let caller = get_caller_address();
            let state = self._get_market_state();

            // Calculate LP tokens to mint
            let (lp_to_mint, sy_used, pt_used) = calc_mint_lp(@state, sy_desired, pt_desired);
            assert(lp_to_mint > 0, Errors::MARKET_ZERO_LIQUIDITY);

            // Transfer tokens from caller
            let sy_contract = ISYDispatcher { contract_address: self.sy.read() };
            let pt_contract = IPTDispatcher { contract_address: self.pt.read() };

            sy_contract.transfer_from(caller, get_contract_address(), sy_used);
            pt_contract.transfer_from(caller, get_contract_address(), pt_used);

            // Update reserves
            self.sy_reserve.write(self.sy_reserve.read() + sy_used);
            self.pt_reserve.write(self.pt_reserve.read() + pt_used);

            // Mint LP tokens
            self.erc20.mint(receiver, lp_to_mint);

            // Update implied rate cache
            self._update_implied_rate();

            // Emit event
            self
                .emit(
                    Mint {
                        sender: caller,
                        receiver,
                        sy_amount: sy_used,
                        pt_amount: pt_used,
                        lp_amount: lp_to_mint,
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
                sy_contract.transfer(receiver, sy_out);
            }
            if pt_out > 0 {
                let pt_contract = IPTDispatcher { contract_address: self.pt.read() };
                pt_contract.transfer(receiver, pt_out);
            }

            // Update implied rate cache (if not expired)
            if !self.is_expired() {
                self._update_implied_rate();
            }

            // Emit event
            self
                .emit(
                    Burn {
                        sender: caller,
                        receiver,
                        lp_amount: lp_to_burn,
                        sy_amount: sy_out,
                        pt_amount: pt_out,
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
            assert(!self.is_expired(), Errors::MARKET_EXPIRED);
            assert(!receiver.is_zero(), Errors::ZERO_ADDRESS);
            assert(exact_pt_in > 0, Errors::ZERO_AMOUNT);

            let caller = get_caller_address();
            let state = self._get_market_state();
            let time_to_expiry = get_time_to_expiry(self.expiry.read(), get_block_timestamp());

            // Calculate output
            let (sy_out, fee) = calc_swap_exact_pt_for_sy(@state, exact_pt_in, time_to_expiry);
            assert(check_slippage(sy_out, min_sy_out), Errors::MARKET_SLIPPAGE_EXCEEDED);

            // Transfer PT from caller
            let pt_contract = IPTDispatcher { contract_address: self.pt.read() };
            pt_contract.transfer_from(caller, get_contract_address(), exact_pt_in);

            // Update reserves
            self.sy_reserve.write(self.sy_reserve.read() - sy_out);
            self.pt_reserve.write(self.pt_reserve.read() + exact_pt_in);
            self.total_fees_collected.write(self.total_fees_collected.read() + fee);

            // Transfer SY to receiver
            let sy_contract = ISYDispatcher { contract_address: self.sy.read() };
            sy_contract.transfer(receiver, sy_out);

            // Update implied rate cache
            self._update_implied_rate();

            // Emit event
            self
                .emit(
                    Swap {
                        sender: caller,
                        receiver,
                        pt_in: exact_pt_in,
                        sy_in: 0,
                        pt_out: 0,
                        sy_out,
                        fee,
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
            assert(!self.is_expired(), Errors::MARKET_EXPIRED);
            assert(!receiver.is_zero(), Errors::ZERO_ADDRESS);
            assert(exact_pt_out > 0, Errors::ZERO_AMOUNT);

            let caller = get_caller_address();
            let state = self._get_market_state();
            let time_to_expiry = get_time_to_expiry(self.expiry.read(), get_block_timestamp());

            // Calculate input required
            let (sy_in, fee) = calc_swap_sy_for_exact_pt(@state, exact_pt_out, time_to_expiry);
            assert(sy_in <= max_sy_in, Errors::MARKET_SLIPPAGE_EXCEEDED);

            // Transfer SY from caller
            let sy_contract = ISYDispatcher { contract_address: self.sy.read() };
            sy_contract.transfer_from(caller, get_contract_address(), sy_in);

            // Update reserves
            self.sy_reserve.write(self.sy_reserve.read() + sy_in);
            self.pt_reserve.write(self.pt_reserve.read() - exact_pt_out);
            self.total_fees_collected.write(self.total_fees_collected.read() + fee);

            // Transfer PT to receiver
            let pt_contract = IPTDispatcher { contract_address: self.pt.read() };
            pt_contract.transfer(receiver, exact_pt_out);

            // Update implied rate cache
            self._update_implied_rate();

            // Emit event
            self
                .emit(
                    Swap {
                        sender: caller,
                        receiver,
                        pt_in: 0,
                        sy_in,
                        pt_out: exact_pt_out,
                        sy_out: 0,
                        fee,
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
            assert(!self.is_expired(), Errors::MARKET_EXPIRED);
            assert(!receiver.is_zero(), Errors::ZERO_ADDRESS);
            assert(exact_sy_in > 0, Errors::ZERO_AMOUNT);

            let caller = get_caller_address();
            let state = self._get_market_state();
            let time_to_expiry = get_time_to_expiry(self.expiry.read(), get_block_timestamp());

            // Calculate output
            let (pt_out, fee) = calc_swap_exact_sy_for_pt(@state, exact_sy_in, time_to_expiry);
            assert(check_slippage(pt_out, min_pt_out), Errors::MARKET_SLIPPAGE_EXCEEDED);

            // Transfer SY from caller
            let sy_contract = ISYDispatcher { contract_address: self.sy.read() };
            sy_contract.transfer_from(caller, get_contract_address(), exact_sy_in);

            // Update reserves
            self.sy_reserve.write(self.sy_reserve.read() + exact_sy_in);
            self.pt_reserve.write(self.pt_reserve.read() - pt_out);
            self.total_fees_collected.write(self.total_fees_collected.read() + fee);

            // Transfer PT to receiver
            let pt_contract = IPTDispatcher { contract_address: self.pt.read() };
            pt_contract.transfer(receiver, pt_out);

            // Update implied rate cache
            self._update_implied_rate();

            // Emit event
            self
                .emit(
                    Swap {
                        sender: caller,
                        receiver,
                        pt_in: 0,
                        sy_in: exact_sy_in,
                        pt_out,
                        sy_out: 0,
                        fee,
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
            assert(!self.is_expired(), Errors::MARKET_EXPIRED);
            assert(!receiver.is_zero(), Errors::ZERO_ADDRESS);
            assert(exact_sy_out > 0, Errors::ZERO_AMOUNT);

            let caller = get_caller_address();
            let state = self._get_market_state();
            let time_to_expiry = get_time_to_expiry(self.expiry.read(), get_block_timestamp());

            // Calculate input required
            let (pt_in, fee) = calc_swap_pt_for_exact_sy(@state, exact_sy_out, time_to_expiry);
            assert(pt_in <= max_pt_in, Errors::MARKET_SLIPPAGE_EXCEEDED);

            // Transfer PT from caller
            let pt_contract = IPTDispatcher { contract_address: self.pt.read() };
            pt_contract.transfer_from(caller, get_contract_address(), pt_in);

            // Update reserves
            self.sy_reserve.write(self.sy_reserve.read() - exact_sy_out);
            self.pt_reserve.write(self.pt_reserve.read() + pt_in);
            self.total_fees_collected.write(self.total_fees_collected.read() + fee);

            // Transfer SY to receiver
            let sy_contract = ISYDispatcher { contract_address: self.sy.read() };
            sy_contract.transfer(receiver, exact_sy_out);

            // Update implied rate cache
            self._update_implied_rate();

            // Emit event
            self
                .emit(
                    Swap {
                        sender: caller,
                        receiver,
                        pt_in,
                        sy_in: 0,
                        pt_out: 0,
                        sy_out: exact_sy_out,
                        fee,
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
            let state = self._get_market_state();
            let time_to_expiry = get_time_to_expiry(self.expiry.read(), get_block_timestamp());
            let new_rate = get_ln_implied_rate(@state, time_to_expiry);
            self.last_ln_implied_rate.write(new_rate);
        }
    }
}
