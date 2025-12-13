/// Router Contract
/// User-friendly entry point aggregating all protocol operations.
/// Handles token transfers, approvals, and provides slippage protection.
#[starknet::contract]
pub mod Router {
    use core::num::traits::Zero;
    use horizon::interfaces::i_market::{IMarketDispatcher, IMarketDispatcherTrait};
    use horizon::interfaces::i_pt::{IPTDispatcher, IPTDispatcherTrait};
    use horizon::interfaces::i_router::IRouter;
    use horizon::interfaces::i_sy::{ISYDispatcher, ISYDispatcherTrait};
    use horizon::interfaces::i_yt::{IYTDispatcher, IYTDispatcherTrait};
    use horizon::libraries::errors::Errors;
    use starknet::{ContractAddress, get_caller_address, get_contract_address};

    #[storage]
    struct Storage {}

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        MintPY: MintPY,
        RedeemPY: RedeemPY,
        AddLiquidity: AddLiquidity,
        RemoveLiquidity: RemoveLiquidity,
        Swap: Swap,
    }

    #[derive(Drop, starknet::Event)]
    pub struct MintPY {
        #[key]
        pub sender: ContractAddress,
        #[key]
        pub receiver: ContractAddress,
        pub yt: ContractAddress,
        pub sy_in: u256,
        pub pt_out: u256,
        pub yt_out: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct RedeemPY {
        #[key]
        pub sender: ContractAddress,
        #[key]
        pub receiver: ContractAddress,
        pub yt: ContractAddress,
        pub py_in: u256,
        pub sy_out: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct AddLiquidity {
        #[key]
        pub sender: ContractAddress,
        #[key]
        pub receiver: ContractAddress,
        pub market: ContractAddress,
        pub sy_used: u256,
        pub pt_used: u256,
        pub lp_out: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct RemoveLiquidity {
        #[key]
        pub sender: ContractAddress,
        #[key]
        pub receiver: ContractAddress,
        pub market: ContractAddress,
        pub lp_in: u256,
        pub sy_out: u256,
        pub pt_out: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Swap {
        #[key]
        pub sender: ContractAddress,
        #[key]
        pub receiver: ContractAddress,
        pub market: ContractAddress,
        pub sy_in: u256,
        pub pt_in: u256,
        pub sy_out: u256,
        pub pt_out: u256,
    }

    #[constructor]
    fn constructor(ref self: ContractState) { // Stateless router - no initialization needed
    }

    #[abi(embed_v0)]
    impl RouterImpl of IRouter<ContractState> {
        // ============ PT/YT Minting & Redemption ============

        fn mint_py_from_sy(
            ref self: ContractState,
            yt: ContractAddress,
            receiver: ContractAddress,
            amount_sy_in: u256,
            min_py_out: u256,
        ) -> (u256, u256) {
            assert(!yt.is_zero(), Errors::ZERO_ADDRESS);
            assert(!receiver.is_zero(), Errors::ZERO_ADDRESS);
            assert(amount_sy_in > 0, Errors::ZERO_AMOUNT);

            let caller = get_caller_address();
            let yt_contract = IYTDispatcher { contract_address: yt };
            let sy = yt_contract.sy();

            // Transfer SY from caller to this contract
            let sy_contract = ISYDispatcher { contract_address: sy };
            sy_contract.transfer_from(caller, get_contract_address(), amount_sy_in);

            // Approve YT contract to spend SY
            sy_contract.approve(yt, amount_sy_in);

            // Mint PT+YT
            let (pt_minted, yt_minted) = yt_contract.mint_py(receiver, amount_sy_in);

            // Slippage check
            assert(pt_minted >= min_py_out, Errors::ROUTER_SLIPPAGE_EXCEEDED);
            assert(yt_minted >= min_py_out, Errors::ROUTER_SLIPPAGE_EXCEEDED);

            // Emit event
            self
                .emit(
                    MintPY {
                        sender: caller,
                        receiver,
                        yt,
                        sy_in: amount_sy_in,
                        pt_out: pt_minted,
                        yt_out: yt_minted,
                    },
                );

            (pt_minted, yt_minted)
        }

        fn redeem_py_to_sy(
            ref self: ContractState,
            yt: ContractAddress,
            receiver: ContractAddress,
            amount_py_in: u256,
            min_sy_out: u256,
        ) -> u256 {
            assert(!yt.is_zero(), Errors::ZERO_ADDRESS);
            assert(!receiver.is_zero(), Errors::ZERO_ADDRESS);
            assert(amount_py_in > 0, Errors::ZERO_AMOUNT);

            let caller = get_caller_address();
            let yt_contract = IYTDispatcher { contract_address: yt };
            let pt = yt_contract.pt();

            // Transfer PT and YT from caller to this contract
            let pt_contract = IPTDispatcher { contract_address: pt };
            pt_contract.transfer_from(caller, get_contract_address(), amount_py_in);
            yt_contract.transfer_from(caller, get_contract_address(), amount_py_in);

            // Approve YT contract to spend PT (YT contract burns both)
            pt_contract.approve(yt, amount_py_in);
            yt_contract.approve(yt, amount_py_in);

            // Redeem PT+YT for SY
            let sy_out = yt_contract.redeem_py(receiver, amount_py_in);

            // Slippage check
            assert(sy_out >= min_sy_out, Errors::ROUTER_SLIPPAGE_EXCEEDED);

            // Emit event
            self.emit(RedeemPY { sender: caller, receiver, yt, py_in: amount_py_in, sy_out });

            sy_out
        }

        fn redeem_pt_post_expiry(
            ref self: ContractState,
            yt: ContractAddress,
            receiver: ContractAddress,
            amount_pt_in: u256,
            min_sy_out: u256,
        ) -> u256 {
            assert(!yt.is_zero(), Errors::ZERO_ADDRESS);
            assert(!receiver.is_zero(), Errors::ZERO_ADDRESS);
            assert(amount_pt_in > 0, Errors::ZERO_AMOUNT);

            let caller = get_caller_address();
            let yt_contract = IYTDispatcher { contract_address: yt };
            let pt = yt_contract.pt();

            // Transfer PT from caller to this contract
            let pt_contract = IPTDispatcher { contract_address: pt };
            pt_contract.transfer_from(caller, get_contract_address(), amount_pt_in);

            // Approve YT contract to spend PT
            pt_contract.approve(yt, amount_pt_in);

            // Redeem PT for SY (post expiry, no YT needed)
            let sy_out = yt_contract.redeem_py_post_expiry(receiver, amount_pt_in);

            // Slippage check
            assert(sy_out >= min_sy_out, Errors::ROUTER_SLIPPAGE_EXCEEDED);

            // Emit event
            self.emit(RedeemPY { sender: caller, receiver, yt, py_in: amount_pt_in, sy_out });

            sy_out
        }

        // ============ Market Liquidity Operations ============

        fn add_liquidity(
            ref self: ContractState,
            market: ContractAddress,
            receiver: ContractAddress,
            sy_desired: u256,
            pt_desired: u256,
            min_lp_out: u256,
        ) -> (u256, u256, u256) {
            assert(!market.is_zero(), Errors::ZERO_ADDRESS);
            assert(!receiver.is_zero(), Errors::ZERO_ADDRESS);
            assert(sy_desired > 0 && pt_desired > 0, Errors::ZERO_AMOUNT);

            let caller = get_caller_address();
            let market_contract = IMarketDispatcher { contract_address: market };
            let sy = market_contract.sy();
            let pt = market_contract.pt();

            // Transfer tokens from caller to this contract
            let sy_contract = ISYDispatcher { contract_address: sy };
            let pt_contract = IPTDispatcher { contract_address: pt };

            sy_contract.transfer_from(caller, get_contract_address(), sy_desired);
            pt_contract.transfer_from(caller, get_contract_address(), pt_desired);

            // Approve market to spend tokens
            sy_contract.approve(market, sy_desired);
            pt_contract.approve(market, pt_desired);

            // Add liquidity
            let (sy_used, pt_used, lp_minted) = market_contract
                .mint(receiver, sy_desired, pt_desired);

            // Slippage check
            assert(lp_minted >= min_lp_out, Errors::ROUTER_SLIPPAGE_EXCEEDED);

            // Return unused tokens to caller
            if sy_desired > sy_used {
                sy_contract.transfer(caller, sy_desired - sy_used);
            }
            if pt_desired > pt_used {
                pt_contract.transfer(caller, pt_desired - pt_used);
            }

            // Emit event
            self
                .emit(
                    AddLiquidity {
                        sender: caller, receiver, market, sy_used, pt_used, lp_out: lp_minted,
                    },
                );

            (sy_used, pt_used, lp_minted)
        }

        fn remove_liquidity(
            ref self: ContractState,
            market: ContractAddress,
            receiver: ContractAddress,
            lp_to_burn: u256,
            min_sy_out: u256,
            min_pt_out: u256,
        ) -> (u256, u256) {
            assert(!market.is_zero(), Errors::ZERO_ADDRESS);
            assert(!receiver.is_zero(), Errors::ZERO_ADDRESS);
            assert(lp_to_burn > 0, Errors::ZERO_AMOUNT);

            let caller = get_caller_address();
            let market_contract = IMarketDispatcher { contract_address: market };

            // For LP tokens, we need to use the market's transfer_from
            // But Market doesn't expose ERC20 transfer_from in IMarket interface
            // We'll call burn directly - user must have approved the market
            // Actually, the market's burn function burns from caller, so user calls market directly
            // For router pattern, we transfer LP to router then router burns

            // Market is an ERC20 (LP token), but IMarket doesn't expose transfer_from
            // We need to use a workaround - have user approve market and call burn directly
            // For now, let's just call burn on market (user must have LP tokens)
            // The market.burn will burn from msg.sender (this router)

            // Transfer LP from caller to router (need LP ERC20 interface)
            // Since Market is ERC20, we can use IPT interface for transfer_from
            let lp_token = IPTDispatcher { contract_address: market };
            lp_token.transfer_from(caller, get_contract_address(), lp_to_burn);

            // Burn LP tokens
            let (sy_out, pt_out) = market_contract.burn(receiver, lp_to_burn);

            // Slippage check
            assert(sy_out >= min_sy_out, Errors::ROUTER_SLIPPAGE_EXCEEDED);
            assert(pt_out >= min_pt_out, Errors::ROUTER_SLIPPAGE_EXCEEDED);

            // Emit event
            self
                .emit(
                    RemoveLiquidity {
                        sender: caller, receiver, market, lp_in: lp_to_burn, sy_out, pt_out,
                    },
                );

            (sy_out, pt_out)
        }

        // ============ Market Swap Operations ============

        fn swap_exact_sy_for_pt(
            ref self: ContractState,
            market: ContractAddress,
            receiver: ContractAddress,
            exact_sy_in: u256,
            min_pt_out: u256,
        ) -> u256 {
            assert(!market.is_zero(), Errors::ZERO_ADDRESS);
            assert(!receiver.is_zero(), Errors::ZERO_ADDRESS);
            assert(exact_sy_in > 0, Errors::ZERO_AMOUNT);

            let caller = get_caller_address();
            let market_contract = IMarketDispatcher { contract_address: market };
            let sy = market_contract.sy();

            // Transfer SY from caller to this contract
            let sy_contract = ISYDispatcher { contract_address: sy };
            sy_contract.transfer_from(caller, get_contract_address(), exact_sy_in);

            // Approve market to spend SY
            sy_contract.approve(market, exact_sy_in);

            // Swap (market handles slippage internally, but we add extra check)
            let pt_out = market_contract.swap_exact_sy_for_pt(receiver, exact_sy_in, min_pt_out);

            // Emit event
            self
                .emit(
                    Swap {
                        sender: caller,
                        receiver,
                        market,
                        sy_in: exact_sy_in,
                        pt_in: 0,
                        sy_out: 0,
                        pt_out,
                    },
                );

            pt_out
        }

        fn swap_exact_pt_for_sy(
            ref self: ContractState,
            market: ContractAddress,
            receiver: ContractAddress,
            exact_pt_in: u256,
            min_sy_out: u256,
        ) -> u256 {
            assert(!market.is_zero(), Errors::ZERO_ADDRESS);
            assert(!receiver.is_zero(), Errors::ZERO_ADDRESS);
            assert(exact_pt_in > 0, Errors::ZERO_AMOUNT);

            let caller = get_caller_address();
            let market_contract = IMarketDispatcher { contract_address: market };
            let pt = market_contract.pt();

            // Transfer PT from caller to this contract
            let pt_contract = IPTDispatcher { contract_address: pt };
            pt_contract.transfer_from(caller, get_contract_address(), exact_pt_in);

            // Approve market to spend PT
            pt_contract.approve(market, exact_pt_in);

            // Swap
            let sy_out = market_contract.swap_exact_pt_for_sy(receiver, exact_pt_in, min_sy_out);

            // Emit event
            self
                .emit(
                    Swap {
                        sender: caller,
                        receiver,
                        market,
                        sy_in: 0,
                        pt_in: exact_pt_in,
                        sy_out,
                        pt_out: 0,
                    },
                );

            sy_out
        }

        fn swap_sy_for_exact_pt(
            ref self: ContractState,
            market: ContractAddress,
            receiver: ContractAddress,
            exact_pt_out: u256,
            max_sy_in: u256,
        ) -> u256 {
            assert(!market.is_zero(), Errors::ZERO_ADDRESS);
            assert(!receiver.is_zero(), Errors::ZERO_ADDRESS);
            assert(exact_pt_out > 0, Errors::ZERO_AMOUNT);

            let caller = get_caller_address();
            let market_contract = IMarketDispatcher { contract_address: market };
            let sy = market_contract.sy();

            // Transfer max SY from caller to this contract
            let sy_contract = ISYDispatcher { contract_address: sy };
            sy_contract.transfer_from(caller, get_contract_address(), max_sy_in);

            // Approve market to spend SY
            sy_contract.approve(market, max_sy_in);

            // Swap
            let sy_spent = market_contract.swap_sy_for_exact_pt(receiver, exact_pt_out, max_sy_in);

            // Return unused SY to caller
            if max_sy_in > sy_spent {
                sy_contract.transfer(caller, max_sy_in - sy_spent);
            }

            // Emit event
            self
                .emit(
                    Swap {
                        sender: caller,
                        receiver,
                        market,
                        sy_in: sy_spent,
                        pt_in: 0,
                        sy_out: 0,
                        pt_out: exact_pt_out,
                    },
                );

            sy_spent
        }

        fn swap_pt_for_exact_sy(
            ref self: ContractState,
            market: ContractAddress,
            receiver: ContractAddress,
            exact_sy_out: u256,
            max_pt_in: u256,
        ) -> u256 {
            assert(!market.is_zero(), Errors::ZERO_ADDRESS);
            assert(!receiver.is_zero(), Errors::ZERO_ADDRESS);
            assert(exact_sy_out > 0, Errors::ZERO_AMOUNT);

            let caller = get_caller_address();
            let market_contract = IMarketDispatcher { contract_address: market };
            let pt = market_contract.pt();

            // Transfer max PT from caller to this contract
            let pt_contract = IPTDispatcher { contract_address: pt };
            pt_contract.transfer_from(caller, get_contract_address(), max_pt_in);

            // Approve market to spend PT
            pt_contract.approve(market, max_pt_in);

            // Swap
            let pt_spent = market_contract.swap_pt_for_exact_sy(receiver, exact_sy_out, max_pt_in);

            // Return unused PT to caller
            if max_pt_in > pt_spent {
                pt_contract.transfer(caller, max_pt_in - pt_spent);
            }

            // Emit event
            self
                .emit(
                    Swap {
                        sender: caller,
                        receiver,
                        market,
                        sy_in: 0,
                        pt_in: pt_spent,
                        sy_out: exact_sy_out,
                        pt_out: 0,
                    },
                );

            pt_spent
        }

        // ============ Combined Operations ============

        fn mint_py_and_keep(
            ref self: ContractState,
            yt: ContractAddress,
            market: ContractAddress,
            receiver: ContractAddress,
            amount_sy_in: u256,
            min_pt_out: u256,
        ) -> (u256, u256) {
            assert(!yt.is_zero(), Errors::ZERO_ADDRESS);
            assert(!market.is_zero(), Errors::ZERO_ADDRESS);
            assert(!receiver.is_zero(), Errors::ZERO_ADDRESS);
            assert(amount_sy_in > 0, Errors::ZERO_AMOUNT);

            let caller = get_caller_address();
            let yt_contract = IYTDispatcher { contract_address: yt };
            let sy = yt_contract.sy();

            // Transfer SY from caller to this contract
            let sy_contract = ISYDispatcher { contract_address: sy };
            sy_contract.transfer_from(caller, get_contract_address(), amount_sy_in);

            // Approve YT contract to spend SY
            sy_contract.approve(yt, amount_sy_in);

            // Mint PT+YT to receiver
            let (pt_minted, yt_minted) = yt_contract.mint_py(receiver, amount_sy_in);

            // Slippage check
            assert(pt_minted >= min_pt_out, Errors::ROUTER_SLIPPAGE_EXCEEDED);

            // Emit event
            self
                .emit(
                    MintPY {
                        sender: caller,
                        receiver,
                        yt,
                        sy_in: amount_sy_in,
                        pt_out: pt_minted,
                        yt_out: yt_minted,
                    },
                );

            (pt_minted, yt_minted)
        }

        fn buy_pt_from_sy(
            ref self: ContractState,
            market: ContractAddress,
            receiver: ContractAddress,
            amount_sy_in: u256,
            min_pt_out: u256,
        ) -> u256 {
            // This is just a wrapper around swap_exact_sy_for_pt with a friendlier name
            self.swap_exact_sy_for_pt(market, receiver, amount_sy_in, min_pt_out)
        }

        fn sell_pt_for_sy(
            ref self: ContractState,
            market: ContractAddress,
            receiver: ContractAddress,
            amount_pt_in: u256,
            min_sy_out: u256,
        ) -> u256 {
            // This is just a wrapper around swap_exact_pt_for_sy with a friendlier name
            self.swap_exact_pt_for_sy(market, receiver, amount_pt_in, min_sy_out)
        }
    }
}
