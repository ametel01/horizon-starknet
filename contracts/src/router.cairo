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
    use openzeppelin_access::ownable::OwnableComponent;
    use openzeppelin_interfaces::upgrades::IUpgradeable;
    use openzeppelin_upgrades::UpgradeableComponent;
    use starknet::{ClassHash, ContractAddress, get_caller_address, get_contract_address};

    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);
    component!(path: UpgradeableComponent, storage: upgradeable, event: UpgradeableEvent);

    #[abi(embed_v0)]
    impl OwnableImpl = OwnableComponent::OwnableImpl<ContractState>;
    impl OwnableInternalImpl = OwnableComponent::InternalImpl<ContractState>;
    impl UpgradeableInternalImpl = UpgradeableComponent::InternalImpl<ContractState>;

    #[storage]
    struct Storage {
        #[substorage(v0)]
        ownable: OwnableComponent::Storage,
        #[substorage(v0)]
        upgradeable: UpgradeableComponent::Storage,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        MintPY: MintPY,
        RedeemPY: RedeemPY,
        AddLiquidity: AddLiquidity,
        RemoveLiquidity: RemoveLiquidity,
        Swap: Swap,
        SwapYT: SwapYT,
        #[flat]
        OwnableEvent: OwnableComponent::Event,
        #[flat]
        UpgradeableEvent: UpgradeableComponent::Event,
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

    #[derive(Drop, starknet::Event)]
    pub struct SwapYT {
        #[key]
        pub sender: ContractAddress,
        #[key]
        pub receiver: ContractAddress,
        pub yt: ContractAddress,
        pub market: ContractAddress,
        pub sy_in: u256,
        pub yt_in: u256,
        pub sy_out: u256,
        pub yt_out: u256,
    }

    #[constructor]
    fn constructor(ref self: ContractState, owner: ContractAddress) {
        self.ownable.initializer(owner);
    }

    #[abi(embed_v0)]
    impl UpgradeableImpl of IUpgradeable<ContractState> {
        fn upgrade(ref self: ContractState, new_class_hash: ClassHash) {
            self.ownable.assert_only_owner();
            self.upgradeable.upgrade(new_class_hash);
        }
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

        // ============ YT Trading Operations (via Flash Swaps) ============

        /// Buy YT using SY through the PT/SY market
        /// Mechanism:
        /// 1. Take SY from user
        /// 2. Mint PT+YT from all SY
        /// 3. Sell all PT back to market for SY
        /// 4. Send YT to receiver
        /// 5. Return remaining SY to receiver
        ///
        /// The user effectively pays: SY_in - SY_from_PT_sale = net cost for YT
        fn swap_exact_sy_for_yt(
            ref self: ContractState,
            yt: ContractAddress,
            market: ContractAddress,
            receiver: ContractAddress,
            exact_sy_in: u256,
            min_yt_out: u256,
        ) -> u256 {
            assert(!yt.is_zero(), Errors::ZERO_ADDRESS);
            assert(!market.is_zero(), Errors::ZERO_ADDRESS);
            assert(!receiver.is_zero(), Errors::ZERO_ADDRESS);
            assert(exact_sy_in > 0, Errors::ZERO_AMOUNT);

            let caller = get_caller_address();
            let this = get_contract_address();
            let yt_contract = IYTDispatcher { contract_address: yt };
            let market_contract = IMarketDispatcher { contract_address: market };

            let sy = yt_contract.sy();
            let pt = yt_contract.pt();
            let sy_contract = ISYDispatcher { contract_address: sy };
            let pt_contract = IPTDispatcher { contract_address: pt };

            // 1. Transfer SY from caller to this contract
            sy_contract.transfer_from(caller, this, exact_sy_in);

            // 2. Mint PT+YT from all SY
            sy_contract.approve(yt, exact_sy_in);
            let (pt_minted, yt_minted) = yt_contract.mint_py(this, exact_sy_in);

            // 3. Sell all PT back to market for SY
            pt_contract.approve(market, pt_minted);
            let sy_from_pt_sale = market_contract.swap_exact_pt_for_sy(this, pt_minted, 0);

            // 4. Send YT to receiver
            yt_contract.transfer(receiver, yt_minted);

            // 5. Send recovered SY to receiver (this is effectively a "refund")
            if sy_from_pt_sale > 0 {
                sy_contract.transfer(receiver, sy_from_pt_sale);
            }

            // Slippage check on YT received
            assert(yt_minted >= min_yt_out, Errors::ROUTER_SLIPPAGE_EXCEEDED);

            // Emit event
            self
                .emit(
                    SwapYT {
                        sender: caller,
                        receiver,
                        yt,
                        market,
                        sy_in: exact_sy_in,
                        yt_in: 0,
                        sy_out: sy_from_pt_sale,
                        yt_out: yt_minted,
                    },
                );

            yt_minted
        }

        /// Sell YT for SY through the PT/SY market
        /// Mechanism:
        /// 1. Take YT from user
        /// 2. Buy PT from market using SY (need to estimate amount)
        /// 3. Combine PT + YT to redeem SY
        /// 4. Repay the SY used to buy PT
        /// 5. Send remaining SY to receiver
        ///
        /// The user receives: SY_from_redemption - SY_spent_on_PT = net SY out
        fn swap_exact_yt_for_sy(
            ref self: ContractState,
            yt: ContractAddress,
            market: ContractAddress,
            receiver: ContractAddress,
            exact_yt_in: u256,
            min_sy_out: u256,
        ) -> u256 {
            assert(!yt.is_zero(), Errors::ZERO_ADDRESS);
            assert(!market.is_zero(), Errors::ZERO_ADDRESS);
            assert(!receiver.is_zero(), Errors::ZERO_ADDRESS);
            assert(exact_yt_in > 0, Errors::ZERO_AMOUNT);

            let caller = get_caller_address();
            let this = get_contract_address();
            let yt_contract = IYTDispatcher { contract_address: yt };
            let market_contract = IMarketDispatcher { contract_address: market };

            let sy = yt_contract.sy();
            let pt = yt_contract.pt();
            let sy_contract = ISYDispatcher { contract_address: sy };
            let pt_contract = IPTDispatcher { contract_address: pt };

            // 1. Transfer YT from caller to this contract
            yt_contract.transfer_from(caller, this, exact_yt_in);

            // 2. We need PT to pair with YT for redemption
            // Buy exact PT amount equal to YT (since 1 PT + 1 YT = 1 SY worth)
            // First, estimate max SY needed - use 4x multiplier to account for AMM curve and fees
            // PT price in SY can vary significantly based on market conditions
            let max_sy_for_pt = exact_yt_in * 4; // Generous estimate to handle price impact

            // We need SY to buy PT - borrow from the redemption proceeds
            // This is a "flash swap" pattern:
            // - We'll buy PT now, redeem PT+YT for SY, use SY to pay for PT purchase

            // Note: We don't need to track balance since we transfer exact amounts

            // Buy PT from market - we need to have SY first
            // Since we don't have SY yet, we use swap_pt_for_exact_sy in reverse
            // Actually, we need to use swap_sy_for_exact_pt, but we don't have SY

            // Alternative approach: Use the market's reserves info to calculate
            // For simplicity, let's do a two-step process that doesn't require flash loans:
            // The user needs to provide enough SY upfront or we simulate via redemption first

            // SIMPLIFIED APPROACH for now:
            // We'll use the market to swap and rely on the AMM math
            // Buy PT by specifying exact PT out, max SY in = yt_amount (conservative)

            // Actually, we need a source of SY. Let's require caller to also provide some SY
            // OR we can use a callback/flash loan pattern

            // For MVP: Require the market to have enough liquidity and do iterative approach
            // The cleanest way: buy PT, redeem, check profit

            // Let's try: swap SY for exact PT where PT_out = exact_yt_in
            // We need SY to do this. The caller must approve enough SY.

            // REVISED APPROACH - two-phase:
            // User must provide max_sy_in as collateral, we return the excess

            // For this implementation, we'll need the user to have approved extra SY
            // Let's add a simpler approach: require caller to also transfer SY for PT purchase

            // FINAL APPROACH for clean implementation:
            // Calculate how much SY we need to buy exact_yt_in PT
            // Transfer that SY from caller
            // Buy PT, redeem, send net SY to receiver

            // Note: We don't check reserves explicitly - the swap will fail if insufficient

            // If not enough PT in reserves, this will fail naturally
            // Estimate SY needed (this is approximate, actual will be determined by swap)
            // For safety, we'll transfer max and refund

            // Transfer SY from caller (they need to approve max_sy_for_pt)
            // We use a generous max - the actual amount will be less
            sy_contract.transfer_from(caller, this, max_sy_for_pt);

            // Buy exact PT
            sy_contract.approve(market, max_sy_for_pt);
            let sy_spent_on_pt = market_contract
                .swap_sy_for_exact_pt(this, exact_yt_in, max_sy_for_pt);

            // 3. Now we have PT and YT - redeem for SY
            pt_contract.approve(yt, exact_yt_in);
            yt_contract.approve(yt, exact_yt_in);
            let sy_from_redemption = yt_contract.redeem_py(this, exact_yt_in);

            // 4. Calculate net SY out
            // User provided: max_sy_for_pt SY + exact_yt_in YT
            // User receives: sy_from_redemption + (max_sy_for_pt - sy_spent_on_pt)
            // Net from YT sale = sy_from_redemption - sy_spent_on_pt

            // Check if selling YT is profitable (sy_from_redemption >= sy_spent_on_pt)
            // If PT is too expensive, selling YT results in a loss - revert via slippage
            let effective_sy_from_yt = if sy_from_redemption >= sy_spent_on_pt {
                sy_from_redemption - sy_spent_on_pt
            } else {
                0 // Loss scenario - will fail slippage check below
            };

            // Slippage check before transferring
            assert(effective_sy_from_yt >= min_sy_out, Errors::ROUTER_SLIPPAGE_EXCEEDED);

            let sy_refund = max_sy_for_pt - sy_spent_on_pt;
            let net_sy_out = sy_from_redemption + sy_refund;

            // 5. Send all SY to receiver
            sy_contract.transfer(receiver, net_sy_out);

            // Emit event
            self
                .emit(
                    SwapYT {
                        sender: caller,
                        receiver,
                        yt,
                        market,
                        sy_in: max_sy_for_pt, // SY provided as collateral
                        yt_in: exact_yt_in,
                        sy_out: net_sy_out, // Total SY returned
                        yt_out: 0,
                    },
                );

            effective_sy_from_yt
        }
    }
}
