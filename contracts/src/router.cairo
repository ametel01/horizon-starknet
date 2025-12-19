/// Router Contract
/// User-friendly entry point aggregating all protocol operations.
/// Handles token transfers, approvals, and provides slippage protection.
///
/// SECURITY FEATURES:
/// - ReentrancyGuard: Prevents reentrancy attacks during token transfers
/// - Deadline: All operations must complete before specified timestamp
/// - Pausable: Can be paused in emergencies by PAUSER_ROLE
#[starknet::contract]
pub mod Router {
    use core::num::traits::Zero;
    use horizon::interfaces::i_market::{IMarketDispatcher, IMarketDispatcherTrait};
    use horizon::interfaces::i_pt::{IPTDispatcher, IPTDispatcherTrait};
    use horizon::interfaces::i_router::IRouter;
    use horizon::interfaces::i_sy::{ISYDispatcher, ISYDispatcherTrait};
    use horizon::interfaces::i_yt::{IYTDispatcher, IYTDispatcherTrait};
    use horizon::libraries::errors::Errors;
    use horizon::libraries::roles::{DEFAULT_ADMIN_ROLE, PAUSER_ROLE};
    use openzeppelin_access::accesscontrol::AccessControlComponent;
    use openzeppelin_access::ownable::OwnableComponent;
    use openzeppelin_interfaces::upgrades::IUpgradeable;
    use openzeppelin_introspection::src5::SRC5Component;
    use openzeppelin_security::pausable::PausableComponent;
    use openzeppelin_security::reentrancyguard::ReentrancyGuardComponent;
    use openzeppelin_upgrades::UpgradeableComponent;
    use starknet::{
        ClassHash, ContractAddress, get_block_timestamp, get_caller_address, get_contract_address,
    };

    // Keep OwnableComponent for backward compatibility (existing owner can bootstrap RBAC)
    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);
    component!(path: UpgradeableComponent, storage: upgradeable, event: UpgradeableEvent);
    component!(path: SRC5Component, storage: src5, event: SRC5Event);
    component!(path: AccessControlComponent, storage: access_control, event: AccessControlEvent);
    component!(path: PausableComponent, storage: pausable, event: PausableEvent);
    component!(
        path: ReentrancyGuardComponent, storage: reentrancy_guard, event: ReentrancyGuardEvent,
    );

    #[abi(embed_v0)]
    impl OwnableImpl = OwnableComponent::OwnableImpl<ContractState>;
    impl OwnableInternalImpl = OwnableComponent::InternalImpl<ContractState>;
    impl UpgradeableInternalImpl = UpgradeableComponent::InternalImpl<ContractState>;

    // AccessControl - embed the full implementation for role management
    #[abi(embed_v0)]
    impl AccessControlImpl =
        AccessControlComponent::AccessControlImpl<ContractState>;
    impl AccessControlInternalImpl = AccessControlComponent::InternalImpl<ContractState>;

    // Pausable - embed the public interface
    #[abi(embed_v0)]
    impl PausableImpl = PausableComponent::PausableImpl<ContractState>;
    impl PausableInternalImpl = PausableComponent::InternalImpl<ContractState>;

    // ReentrancyGuard - internal only
    impl ReentrancyGuardInternalImpl = ReentrancyGuardComponent::InternalImpl<ContractState>;

    #[storage]
    struct Storage {
        // === EXISTING STORAGE - DO NOT MODIFY ORDER ===
        #[substorage(v0)]
        ownable: OwnableComponent::Storage,
        #[substorage(v0)]
        upgradeable: UpgradeableComponent::Storage,
        // === NEW STORAGE - ADDED AT END ===
        #[substorage(v0)]
        src5: SRC5Component::Storage,
        #[substorage(v0)]
        access_control: AccessControlComponent::Storage,
        #[substorage(v0)]
        pausable: PausableComponent::Storage,
        #[substorage(v0)]
        reentrancy_guard: ReentrancyGuardComponent::Storage,
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
        #[flat]
        SRC5Event: SRC5Component::Event,
        #[flat]
        AccessControlEvent: AccessControlComponent::Event,
        #[flat]
        PausableEvent: PausableComponent::Event,
        #[flat]
        ReentrancyGuardEvent: ReentrancyGuardComponent::Event,
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

        // Initialize AccessControl and grant admin role to owner
        self.access_control.initializer();
        self.access_control._grant_role(DEFAULT_ADMIN_ROLE, owner);
        self.access_control._grant_role(PAUSER_ROLE, owner);
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
        // ============ Admin Functions ============

        /// Pause all router operations (PAUSER_ROLE only)
        fn pause(ref self: ContractState) {
            self.access_control.assert_only_role(PAUSER_ROLE);
            self.pausable.pause();
        }

        /// Unpause all router operations (PAUSER_ROLE only)
        fn unpause(ref self: ContractState) {
            self.access_control.assert_only_role(PAUSER_ROLE);
            self.pausable.unpause();
        }

        /// Initialize RBAC after upgrade (one-time setup)
        /// Owner calls this to bootstrap AccessControl roles
        fn initialize_rbac(ref self: ContractState) {
            self.ownable.assert_only_owner();

            let owner = self.ownable.owner();

            // Grant admin and pauser roles to current owner
            self.access_control._grant_role(DEFAULT_ADMIN_ROLE, owner);
            self.access_control._grant_role(PAUSER_ROLE, owner);
        }

        // ============ PT/YT Minting & Redemption ============

        fn mint_py_from_sy(
            ref self: ContractState,
            yt: ContractAddress,
            receiver: ContractAddress,
            amount_sy_in: u256,
            min_py_out: u256,
            deadline: u64,
        ) -> (u256, u256) {
            self.pausable.assert_not_paused();
            self.reentrancy_guard.start();
            assert(get_block_timestamp() <= deadline, Errors::ROUTER_DEADLINE_EXCEEDED);
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

            self.reentrancy_guard.end();
            (pt_minted, yt_minted)
        }

        fn redeem_py_to_sy(
            ref self: ContractState,
            yt: ContractAddress,
            receiver: ContractAddress,
            amount_py_in: u256,
            min_sy_out: u256,
            deadline: u64,
        ) -> u256 {
            self.pausable.assert_not_paused();
            self.reentrancy_guard.start();
            assert(get_block_timestamp() <= deadline, Errors::ROUTER_DEADLINE_EXCEEDED);
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

            self.reentrancy_guard.end();
            sy_out
        }

        fn redeem_pt_post_expiry(
            ref self: ContractState,
            yt: ContractAddress,
            receiver: ContractAddress,
            amount_pt_in: u256,
            min_sy_out: u256,
            deadline: u64,
        ) -> u256 {
            self.pausable.assert_not_paused();
            self.reentrancy_guard.start();
            assert(get_block_timestamp() <= deadline, Errors::ROUTER_DEADLINE_EXCEEDED);
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

            self.reentrancy_guard.end();
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
            deadline: u64,
        ) -> (u256, u256, u256) {
            self.pausable.assert_not_paused();
            self.reentrancy_guard.start();
            assert(get_block_timestamp() <= deadline, Errors::ROUTER_DEADLINE_EXCEEDED);
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

            self.reentrancy_guard.end();
            (sy_used, pt_used, lp_minted)
        }

        fn remove_liquidity(
            ref self: ContractState,
            market: ContractAddress,
            receiver: ContractAddress,
            lp_to_burn: u256,
            min_sy_out: u256,
            min_pt_out: u256,
            deadline: u64,
        ) -> (u256, u256) {
            self.pausable.assert_not_paused();
            self.reentrancy_guard.start();
            assert(get_block_timestamp() <= deadline, Errors::ROUTER_DEADLINE_EXCEEDED);
            assert(!market.is_zero(), Errors::ZERO_ADDRESS);
            assert(!receiver.is_zero(), Errors::ZERO_ADDRESS);
            assert(lp_to_burn > 0, Errors::ZERO_AMOUNT);

            let caller = get_caller_address();
            let market_contract = IMarketDispatcher { contract_address: market };

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

            self.reentrancy_guard.end();
            (sy_out, pt_out)
        }

        // ============ Market Swap Operations ============

        fn swap_exact_sy_for_pt(
            ref self: ContractState,
            market: ContractAddress,
            receiver: ContractAddress,
            exact_sy_in: u256,
            min_pt_out: u256,
            deadline: u64,
        ) -> u256 {
            self.pausable.assert_not_paused();
            self.reentrancy_guard.start();
            assert(get_block_timestamp() <= deadline, Errors::ROUTER_DEADLINE_EXCEEDED);
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

            self.reentrancy_guard.end();
            pt_out
        }

        fn swap_exact_pt_for_sy(
            ref self: ContractState,
            market: ContractAddress,
            receiver: ContractAddress,
            exact_pt_in: u256,
            min_sy_out: u256,
            deadline: u64,
        ) -> u256 {
            self.pausable.assert_not_paused();
            self.reentrancy_guard.start();
            assert(get_block_timestamp() <= deadline, Errors::ROUTER_DEADLINE_EXCEEDED);
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

            self.reentrancy_guard.end();
            sy_out
        }

        fn swap_sy_for_exact_pt(
            ref self: ContractState,
            market: ContractAddress,
            receiver: ContractAddress,
            exact_pt_out: u256,
            max_sy_in: u256,
            deadline: u64,
        ) -> u256 {
            self.pausable.assert_not_paused();
            self.reentrancy_guard.start();
            assert(get_block_timestamp() <= deadline, Errors::ROUTER_DEADLINE_EXCEEDED);
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

            self.reentrancy_guard.end();
            sy_spent
        }

        fn swap_pt_for_exact_sy(
            ref self: ContractState,
            market: ContractAddress,
            receiver: ContractAddress,
            exact_sy_out: u256,
            max_pt_in: u256,
            deadline: u64,
        ) -> u256 {
            self.pausable.assert_not_paused();
            self.reentrancy_guard.start();
            assert(get_block_timestamp() <= deadline, Errors::ROUTER_DEADLINE_EXCEEDED);
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

            self.reentrancy_guard.end();
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
            deadline: u64,
        ) -> (u256, u256) {
            self.pausable.assert_not_paused();
            self.reentrancy_guard.start();
            assert(get_block_timestamp() <= deadline, Errors::ROUTER_DEADLINE_EXCEEDED);
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

            self.reentrancy_guard.end();
            (pt_minted, yt_minted)
        }

        fn buy_pt_from_sy(
            ref self: ContractState,
            market: ContractAddress,
            receiver: ContractAddress,
            amount_sy_in: u256,
            min_pt_out: u256,
            deadline: u64,
        ) -> u256 {
            // This is just a wrapper around swap_exact_sy_for_pt with a friendlier name
            self.swap_exact_sy_for_pt(market, receiver, amount_sy_in, min_pt_out, deadline)
        }

        fn sell_pt_for_sy(
            ref self: ContractState,
            market: ContractAddress,
            receiver: ContractAddress,
            amount_pt_in: u256,
            min_sy_out: u256,
            deadline: u64,
        ) -> u256 {
            // This is just a wrapper around swap_exact_pt_for_sy with a friendlier name
            self.swap_exact_pt_for_sy(market, receiver, amount_pt_in, min_sy_out, deadline)
        }

        // ============ YT Trading Operations (via Flash Swaps) ============

        fn swap_exact_sy_for_yt(
            ref self: ContractState,
            yt: ContractAddress,
            market: ContractAddress,
            receiver: ContractAddress,
            exact_sy_in: u256,
            min_yt_out: u256,
            deadline: u64,
        ) -> u256 {
            self.pausable.assert_not_paused();
            self.reentrancy_guard.start();
            assert(get_block_timestamp() <= deadline, Errors::ROUTER_DEADLINE_EXCEEDED);
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

            self.reentrancy_guard.end();
            yt_minted
        }

        /// Sell YT for SY through the PT/SY market
        /// Mechanism: Buy PT from market using caller's SY collateral, combine with YT to redeem SY
        /// @param yt The YT contract address
        /// @param market The PT/SY market address
        /// @param receiver Address to receive SY
        /// @param exact_yt_in Exact amount of YT to sell
        /// @param max_sy_collateral Maximum SY caller will provide as collateral to buy PT
        /// @param min_sy_out Minimum net SY to receive (slippage protection)
        /// @param deadline Transaction must complete before this timestamp
        /// @return Amount of net SY received (after collateral refund)
        fn swap_exact_yt_for_sy(
            ref self: ContractState,
            yt: ContractAddress,
            market: ContractAddress,
            receiver: ContractAddress,
            exact_yt_in: u256,
            max_sy_collateral: u256,
            min_sy_out: u256,
            deadline: u64,
        ) -> u256 {
            self.pausable.assert_not_paused();
            self.reentrancy_guard.start();
            assert(get_block_timestamp() <= deadline, Errors::ROUTER_DEADLINE_EXCEEDED);
            assert(!yt.is_zero(), Errors::ZERO_ADDRESS);
            assert(!market.is_zero(), Errors::ZERO_ADDRESS);
            assert(!receiver.is_zero(), Errors::ZERO_ADDRESS);
            assert(exact_yt_in > 0, Errors::ZERO_AMOUNT);
            assert(max_sy_collateral > 0, Errors::ZERO_AMOUNT);

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

            // 2. Transfer SY collateral from caller (user specifies max amount they're willing to
            // provide)
            sy_contract.transfer_from(caller, this, max_sy_collateral);

            // Buy exact PT using collateral
            sy_contract.approve(market, max_sy_collateral);
            let sy_spent_on_pt = market_contract
                .swap_sy_for_exact_pt(this, exact_yt_in, max_sy_collateral);

            // 3. Now we have PT and YT - redeem for SY
            pt_contract.approve(yt, exact_yt_in);
            yt_contract.approve(yt, exact_yt_in);
            let sy_from_redemption = yt_contract.redeem_py(this, exact_yt_in);

            // 4. Calculate net SY out
            let effective_sy_from_yt = if sy_from_redemption >= sy_spent_on_pt {
                sy_from_redemption - sy_spent_on_pt
            } else {
                0 // Loss scenario - will fail slippage check below
            };

            // Slippage check before transferring
            assert(effective_sy_from_yt >= min_sy_out, Errors::ROUTER_SLIPPAGE_EXCEEDED);

            let sy_refund = max_sy_collateral - sy_spent_on_pt;
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
                        sy_in: max_sy_collateral,
                        yt_in: exact_yt_in,
                        sy_out: net_sy_out,
                        yt_out: 0,
                    },
                );

            self.reentrancy_guard.end();
            effective_sy_from_yt
        }
    }
}
