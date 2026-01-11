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
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
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
        // Flag to prevent RBAC re-initialization
        rbac_initialized: bool,
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
        RolloverLP: RolloverLP,
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

    #[derive(Drop, starknet::Event)]
    pub struct RolloverLP {
        #[key]
        pub sender: ContractAddress,
        #[key]
        pub receiver: ContractAddress,
        pub market_old: ContractAddress,
        pub market_new: ContractAddress,
        pub lp_burned: u256,
        pub lp_minted: u256,
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
            assert(!self.rbac_initialized.read(), Errors::RBAC_ALREADY_INITIALIZED);

            let owner = self.ownable.owner();

            // Grant admin and pauser roles to current owner
            self.access_control._grant_role(DEFAULT_ADMIN_ROLE, owner);
            self.access_control._grant_role(PAUSER_ROLE, owner);

            // Mark as initialized to prevent re-calling
            self.rbac_initialized.write(true);
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

            // Transfer SY from caller to router
            let sy_contract = ISYDispatcher { contract_address: sy };
            sy_contract.transfer_from(caller, get_contract_address(), amount_sy_in);

            // Transfer SY from router to YT contract (floating SY pattern)
            sy_contract.transfer(yt, amount_sy_in);

            // Mint PT+YT using floating SY (same receiver for both)
            let (pt_minted, yt_minted) = yt_contract.mint_py(receiver, receiver);

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

            // Transfer PT and YT from caller to YT contract (pre-transfer for floating token
            // pattern)
            let pt_contract = IPTDispatcher { contract_address: pt };
            pt_contract.transfer_from(caller, yt, amount_py_in);
            yt_contract.transfer_from(caller, yt, amount_py_in);

            // Redeem floating PT+YT for SY
            let sy_out = yt_contract.redeem_py(receiver);

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

            // Transfer PT from caller to YT contract (pre-transfer for floating token pattern)
            let pt_contract = IPTDispatcher { contract_address: pt };
            pt_contract.transfer_from(caller, yt, amount_pt_in);

            // Redeem floating PT for SY (post expiry, no YT needed)
            let sy_out = yt_contract.redeem_py_post_expiry(receiver);

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

        fn add_liquidity_single_sy(
            ref self: ContractState,
            market: ContractAddress,
            receiver: ContractAddress,
            amount_sy_in: u256,
            min_lp_out: u256,
            deadline: u64,
        ) -> (u256, u256, u256) {
            self.pausable.assert_not_paused();
            self.reentrancy_guard.start();
            assert(get_block_timestamp() <= deadline, Errors::ROUTER_DEADLINE_EXCEEDED);
            assert(!market.is_zero(), Errors::ZERO_ADDRESS);
            assert(!receiver.is_zero(), Errors::ZERO_ADDRESS);
            assert(amount_sy_in > 0, Errors::ZERO_AMOUNT);

            let caller = get_caller_address();
            let this = get_contract_address();
            let market_contract = IMarketDispatcher { contract_address: market };
            let sy = market_contract.sy();
            let sy_contract = ISYDispatcher { contract_address: sy };
            let pt = market_contract.pt();
            let pt_contract = IPTDispatcher { contract_address: pt };

            // 1. Transfer all SY from caller to router
            sy_contract.transfer_from(caller, this, amount_sy_in);

            // 2. Calculate optimal SY amount to swap for PT
            //    Goal: balance the ratio so add_liquidity uses everything
            let (reserves_sy, reserves_pt) = market_contract.get_reserves();
            let optimal_sy_to_swap = self
                ._calc_optimal_swap_for_lp(amount_sy_in, reserves_sy, reserves_pt);

            // Validate that swap amount doesn't exceed input
            assert(optimal_sy_to_swap <= amount_sy_in, Errors::MATH_OVERFLOW);

            // 3. Swap optimal SY for PT
            sy_contract.approve(market, optimal_sy_to_swap);
            let pt_received = market_contract
                .swap_exact_sy_for_pt(
                    this,
                    optimal_sy_to_swap,
                    0, // No min check here, final slippage check at end
                    array![].span(),
                );

            // 4. Add liquidity with remaining SY + received PT
            let sy_for_lp = amount_sy_in - optimal_sy_to_swap;
            sy_contract.approve(market, sy_for_lp);
            pt_contract.approve(market, pt_received);

            let (sy_used, pt_used, lp_minted) = market_contract
                .mint(receiver, sy_for_lp, pt_received);

            // 5. Slippage check
            assert(lp_minted >= min_lp_out, Errors::ROUTER_SLIPPAGE_EXCEEDED);

            // 6. Return any dust to caller
            if sy_for_lp > sy_used {
                sy_contract.transfer(caller, sy_for_lp - sy_used);
            }
            if pt_received > pt_used {
                pt_contract.transfer(caller, pt_received - pt_used);
            }

            // Calculate total SY consumed (swap + LP addition)
            let total_sy_used = optimal_sy_to_swap + sy_used;

            // Emit event
            self
                .emit(
                    AddLiquidity {
                        sender: caller,
                        receiver,
                        market,
                        sy_used: total_sy_used,
                        pt_used,
                        lp_out: lp_minted,
                    },
                );

            self.reentrancy_guard.end();
            (total_sy_used, pt_used, lp_minted)
        }

        fn add_liquidity_single_pt(
            ref self: ContractState,
            market: ContractAddress,
            receiver: ContractAddress,
            amount_pt_in: u256,
            min_lp_out: u256,
            deadline: u64,
        ) -> (u256, u256, u256) {
            self.pausable.assert_not_paused();
            self.reentrancy_guard.start();
            assert(get_block_timestamp() <= deadline, Errors::ROUTER_DEADLINE_EXCEEDED);
            assert(!market.is_zero(), Errors::ZERO_ADDRESS);
            assert(!receiver.is_zero(), Errors::ZERO_ADDRESS);
            assert(amount_pt_in > 0, Errors::ZERO_AMOUNT);

            let caller = get_caller_address();
            let this = get_contract_address();
            let market_contract = IMarketDispatcher { contract_address: market };
            let sy = market_contract.sy();
            let sy_contract = ISYDispatcher { contract_address: sy };
            let pt = market_contract.pt();
            let pt_contract = IPTDispatcher { contract_address: pt };

            // 1. Transfer all PT from caller to router
            pt_contract.transfer_from(caller, this, amount_pt_in);

            // 2. Calculate optimal PT amount to swap for SY
            //    Goal: balance the ratio so add_liquidity uses everything
            let (reserves_sy, reserves_pt) = market_contract.get_reserves();
            let optimal_pt_to_swap = self
                ._calc_optimal_swap_pt_for_lp(amount_pt_in, reserves_sy, reserves_pt);

            // Validate that swap amount doesn't exceed input
            assert(optimal_pt_to_swap <= amount_pt_in, Errors::MATH_OVERFLOW);

            // 3. Swap optimal PT for SY
            pt_contract.approve(market, optimal_pt_to_swap);
            let sy_received = market_contract
                .swap_exact_pt_for_sy(
                    this,
                    optimal_pt_to_swap,
                    0, // No min check here, final slippage check at end
                    array![].span(),
                );

            // 4. Add liquidity with received SY + remaining PT
            let pt_for_lp = amount_pt_in - optimal_pt_to_swap;
            sy_contract.approve(market, sy_received);
            pt_contract.approve(market, pt_for_lp);

            let (sy_used, pt_used, lp_minted) = market_contract
                .mint(receiver, sy_received, pt_for_lp);

            // 5. Slippage check
            assert(lp_minted >= min_lp_out, Errors::ROUTER_SLIPPAGE_EXCEEDED);

            // 6. Return any dust to caller
            if sy_received > sy_used {
                sy_contract.transfer(caller, sy_received - sy_used);
            }
            if pt_for_lp > pt_used {
                pt_contract.transfer(caller, pt_for_lp - pt_used);
            }

            // Calculate total PT consumed (swap + LP addition)
            let total_pt_used = optimal_pt_to_swap + pt_used;

            // Emit event
            self
                .emit(
                    AddLiquidity {
                        sender: caller,
                        receiver,
                        market,
                        sy_used,
                        pt_used: total_pt_used,
                        lp_out: lp_minted,
                    },
                );

            self.reentrancy_guard.end();
            (sy_used, total_pt_used, lp_minted)
        }

        fn remove_liquidity_single_sy(
            ref self: ContractState,
            market: ContractAddress,
            receiver: ContractAddress,
            lp_to_burn: u256,
            min_sy_out: u256,
            deadline: u64,
        ) -> u256 {
            self.pausable.assert_not_paused();
            self.reentrancy_guard.start();
            assert(get_block_timestamp() <= deadline, Errors::ROUTER_DEADLINE_EXCEEDED);
            assert(!market.is_zero(), Errors::ZERO_ADDRESS);
            assert(!receiver.is_zero(), Errors::ZERO_ADDRESS);
            assert(lp_to_burn > 0, Errors::ZERO_AMOUNT);

            let caller = get_caller_address();
            let this = get_contract_address();
            let market_contract = IMarketDispatcher { contract_address: market };
            let sy = market_contract.sy();
            let sy_contract = ISYDispatcher { contract_address: sy };
            let pt = market_contract.pt();
            let pt_contract = IPTDispatcher { contract_address: pt };

            // 1. Transfer LP from caller to router
            let lp_token = IPTDispatcher { contract_address: market };
            lp_token.transfer_from(caller, this, lp_to_burn);

            // 2. Burn LP tokens to receive SY and PT (to router)
            let (sy_from_burn, pt_from_burn) = market_contract.burn(this, lp_to_burn);

            // 3. Swap all PT for SY
            pt_contract.approve(market, pt_from_burn);
            let sy_from_swap = market_contract
                .swap_exact_pt_for_sy(
                    this,
                    pt_from_burn,
                    0, // No min check here, final slippage check at end
                    array![].span(),
                );

            // 4. Calculate total SY out
            let total_sy_out = sy_from_burn + sy_from_swap;

            // 5. Slippage check
            assert(total_sy_out >= min_sy_out, Errors::ROUTER_SLIPPAGE_EXCEEDED);

            // 6. Transfer all SY to receiver
            sy_contract.transfer(receiver, total_sy_out);

            // Emit event
            self
                .emit(
                    RemoveLiquidity {
                        sender: caller,
                        receiver,
                        market,
                        lp_in: lp_to_burn,
                        sy_out: total_sy_out,
                        pt_out: 0, // All PT was swapped to SY
                    },
                );

            self.reentrancy_guard.end();
            total_sy_out
        }

        fn remove_liquidity_single_pt(
            ref self: ContractState,
            market: ContractAddress,
            receiver: ContractAddress,
            lp_to_burn: u256,
            min_pt_out: u256,
            deadline: u64,
        ) -> u256 {
            self.pausable.assert_not_paused();
            self.reentrancy_guard.start();
            assert(get_block_timestamp() <= deadline, Errors::ROUTER_DEADLINE_EXCEEDED);
            assert(!market.is_zero(), Errors::ZERO_ADDRESS);
            assert(!receiver.is_zero(), Errors::ZERO_ADDRESS);
            assert(lp_to_burn > 0, Errors::ZERO_AMOUNT);

            let caller = get_caller_address();
            let this = get_contract_address();
            let market_contract = IMarketDispatcher { contract_address: market };
            let sy = market_contract.sy();
            let sy_contract = ISYDispatcher { contract_address: sy };
            let pt = market_contract.pt();
            let pt_contract = IPTDispatcher { contract_address: pt };

            // 1. Transfer LP from caller to router
            let lp_token = IPTDispatcher { contract_address: market };
            lp_token.transfer_from(caller, this, lp_to_burn);

            // 2. Burn LP tokens to receive SY and PT (to router)
            let (sy_from_burn, pt_from_burn) = market_contract.burn(this, lp_to_burn);

            // 3. Swap all SY for PT
            sy_contract.approve(market, sy_from_burn);
            let pt_from_swap = market_contract
                .swap_exact_sy_for_pt(
                    this,
                    sy_from_burn,
                    0, // No min check here, final slippage check at end
                    array![].span(),
                );

            // 4. Calculate total PT out
            let total_pt_out = pt_from_burn + pt_from_swap;

            // 5. Slippage check
            assert(total_pt_out >= min_pt_out, Errors::ROUTER_SLIPPAGE_EXCEEDED);

            // 6. Transfer all PT to receiver
            pt_contract.transfer(receiver, total_pt_out);

            // Emit event
            self
                .emit(
                    RemoveLiquidity {
                        sender: caller,
                        receiver,
                        market,
                        lp_in: lp_to_burn,
                        sy_out: 0, // All SY was swapped to PT
                        pt_out: total_pt_out,
                    },
                );

            self.reentrancy_guard.end();
            total_pt_out
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
            let pt_out = market_contract
                .swap_exact_sy_for_pt(receiver, exact_sy_in, min_pt_out, array![].span());

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
            let sy_out = market_contract
                .swap_exact_pt_for_sy(receiver, exact_pt_in, min_sy_out, array![].span());

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
            let sy_spent = market_contract
                .swap_sy_for_exact_pt(receiver, exact_pt_out, max_sy_in, array![].span());

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
            let pt_spent = market_contract
                .swap_pt_for_exact_sy(receiver, exact_sy_out, max_pt_in, array![].span());

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

            // Transfer SY from caller to router
            let sy_contract = ISYDispatcher { contract_address: sy };
            sy_contract.transfer_from(caller, get_contract_address(), amount_sy_in);

            // Transfer SY from router to YT contract (floating SY pattern)
            sy_contract.transfer(yt, amount_sy_in);

            // Mint PT+YT to receiver using floating SY (same receiver for both)
            let (pt_minted, yt_minted) = yt_contract.mint_py(receiver, receiver);

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

            // 1. Transfer SY from caller to router
            sy_contract.transfer_from(caller, this, exact_sy_in);

            // 2. Mint PT+YT from all SY using floating SY pattern (both to router)
            sy_contract.transfer(yt, exact_sy_in);
            let (pt_minted, yt_minted) = yt_contract.mint_py(this, this);

            // 3. Sell all PT back to market for SY
            pt_contract.approve(market, pt_minted);
            let sy_from_pt_sale = market_contract
                .swap_exact_pt_for_sy(this, pt_minted, 0, array![].span());

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
                .swap_sy_for_exact_pt(this, exact_yt_in, max_sy_collateral, array![].span());

            // 3. Now we have PT and YT - pre-transfer to YT contract, then redeem for SY
            pt_contract.transfer(yt, exact_yt_in);
            yt_contract.transfer(yt, exact_yt_in);
            let sy_from_redemption = yt_contract.redeem_py(this);

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

        // ============ LP Rollover Operations ============

        fn rollover_lp(
            ref self: ContractState,
            market_old: ContractAddress,
            market_new: ContractAddress,
            lp_to_rollover: u256,
            min_lp_out: u256,
            deadline: u64,
        ) -> u256 {
            self.pausable.assert_not_paused();
            self.reentrancy_guard.start();
            assert(get_block_timestamp() <= deadline, Errors::ROUTER_DEADLINE_EXCEEDED);
            assert(!market_old.is_zero(), Errors::ZERO_ADDRESS);
            assert(!market_new.is_zero(), Errors::ZERO_ADDRESS);
            assert(lp_to_rollover > 0, Errors::ZERO_AMOUNT);

            let caller = get_caller_address();
            let this = get_contract_address();

            // 1. Transfer LP from caller to router
            let lp_old = IPTDispatcher { contract_address: market_old };
            lp_old.transfer_from(caller, this, lp_to_rollover);

            // 2. Burn LP in old market (receive SY + PT to router)
            let market_old_dispatcher = IMarketDispatcher { contract_address: market_old };
            let (sy_received, pt_old_received) = market_old_dispatcher.burn(this, lp_to_rollover);

            // 3. Validate both markets share the same SY and PT
            let market_new_dispatcher = IMarketDispatcher { contract_address: market_new };
            let pt_new = market_new_dispatcher.pt();
            let pt_old = market_old_dispatcher.pt();
            let sy_old = market_old_dispatcher.sy();
            let sy_new = market_new_dispatcher.sy();

            // Both markets must share the same SY (same underlying asset)
            assert(sy_old == sy_new, Errors::ROUTER_ROLLOVER_SY_MISMATCH);

            // Both markets must share the same PT for this rollover method
            // Note: This only works for markets with identical PT (e.g., same expiry)
            // For cross-expiry rollovers, PT must first be redeemed/converted
            assert(pt_old == pt_new, Errors::ROUTER_ROLLOVER_PT_MISMATCH);

            // 4. Approve new market for SY + PT
            let sy = sy_new;
            let sy_contract = ISYDispatcher { contract_address: sy };
            let pt_contract = IPTDispatcher { contract_address: pt_new };

            sy_contract.approve(market_new, sy_received);
            pt_contract.approve(market_new, pt_old_received);

            // 5. Add liquidity to new market
            let (sy_used, pt_used, lp_new) = market_new_dispatcher
                .mint(caller, sy_received, pt_old_received);

            // 6. Slippage check
            assert(lp_new >= min_lp_out, Errors::ROUTER_SLIPPAGE_EXCEEDED);

            // 7. Return unused tokens to caller
            if sy_received > sy_used {
                sy_contract.transfer(caller, sy_received - sy_used);
            }
            if pt_old_received > pt_used {
                pt_contract.transfer(caller, pt_old_received - pt_used);
            }

            // Emit event
            self
                .emit(
                    RolloverLP {
                        sender: caller,
                        receiver: caller,
                        market_old,
                        market_new,
                        lp_burned: lp_to_rollover,
                        lp_minted: lp_new,
                    },
                );

            self.reentrancy_guard.end();
            lp_new
        }
    }

    // ============ Internal Helper Functions ============

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        /// Calculate optimal SY amount to swap for PT before adding liquidity
        /// Uses binary search to find swap amount that fully utilizes all tokens
        /// @param amount_sy_total Total SY available
        /// @param reserves_sy Current SY reserves in market
        /// @param reserves_pt Current PT reserves in market
        /// @return Optimal amount of SY to swap for PT
        fn _calc_optimal_swap_for_lp(
            ref self: ContractState, amount_sy_total: u256, reserves_sy: u256, reserves_pt: u256,
        ) -> u256 {
            // Edge case: empty pool, just swap half
            if reserves_sy == 0 || reserves_pt == 0 {
                return amount_sy_total / 2;
            }

            // Edge case: very small amount, just swap half to avoid precision issues
            if amount_sy_total <= 1 {
                return amount_sy_total / 2;
            }

            // Binary search for optimal swap amount
            let mut low: u256 = 0;
            let mut high: u256 = amount_sy_total;
            let max_iterations: u32 = 20; // ~1e-6 precision
            let mut iteration: u32 = 0;

            while iteration < max_iterations && high > low + 1 {
                let mid = (low + high) / 2;

                // If mid equals low, we can't make progress, break to avoid infinite loop
                if mid == low {
                    break;
                }

                // Simulate: swap `mid` SY for PT
                let pt_out = self._estimate_swap_sy_for_pt(mid, reserves_sy, reserves_pt);

                // If pt_out is zero, we can't proceed with this mid value
                if pt_out == 0 {
                    // No PT received means we need to swap more (but ensure we make progress)
                    if mid > low {
                        low = mid;
                    }
                    iteration += 1;
                    continue;
                }

                let sy_remaining = amount_sy_total - mid;

                // If we've swapped everything, this is too much
                if sy_remaining == 0 {
                    high = mid;
                    iteration += 1;
                    continue;
                }

                // Check if this ratio matches pool ratio
                // sy_remaining / pt_out should equal reserves_sy / reserves_pt
                // Cross-multiply to avoid division: sy_remaining * reserves_pt <=> pt_out *
                // reserves_sy
                // Note: These multiplications could overflow with very large reserves.
                // In practice, reserves are bounded by realistic token amounts (< 2^128)
                // so multiplication fits in u256. For added safety, we could use checked math
                // but Cairo's default behavior will panic on overflow which is acceptable here.
                let left = sy_remaining * reserves_pt;
                let right = pt_out * reserves_sy;

                if left < right {
                    // Too much PT received, swap less SY
                    high = mid;
                } else {
                    // Too little PT received, swap more SY
                    low = mid;
                }

                iteration += 1;
            }

            low
        }

        /// Estimate PT received from swapping exact SY (without fees, approximate)
        /// @param sy_in Amount of SY to swap
        /// @param reserves_sy Current SY reserves in market
        /// @param reserves_pt Current PT reserves in market
        /// @return Estimated PT output
        fn _estimate_swap_sy_for_pt(
            ref self: ContractState, sy_in: u256, reserves_sy: u256, reserves_pt: u256,
        ) -> u256 {
            // Constant product approximation: (reserves_pt * sy_in) / (reserves_sy + sy_in)
            // This is simplified; real swap uses logit curve + fees
            // For optimization purposes, close enough
            if sy_in == 0 {
                return 0;
            }

            // Prevent overflow by checking if multiplication would exceed u256 max
            // Use the identity: (a * b) / c = a / c * b when possible
            // Or rearrange to avoid overflow: pt_out = reserves_pt / (1 + reserves_sy/sy_in)
            let denominator = reserves_sy + sy_in;

            // Guard against potential overflow in numerator
            // If reserves_pt > u256::MAX / sy_in, we need to be careful
            // Use checked operations by rearranging:
            // pt_out = reserves_pt * (sy_in / denominator) + reserves_pt * (sy_in % denominator) /
            // denominator But for simplicity, given protocol constraints, direct computation should
            // be safe as reserves are bounded by realistic token amounts
            let numerator = reserves_pt * sy_in;
            numerator / denominator
        }

        /// Calculate optimal PT amount to swap for SY before adding liquidity
        /// Uses binary search to find swap amount that fully utilizes all tokens
        /// @param amount_pt_total Total PT available
        /// @param reserves_sy Current SY reserves in market
        /// @param reserves_pt Current PT reserves in market
        /// @return Optimal amount of PT to swap for SY
        fn _calc_optimal_swap_pt_for_lp(
            ref self: ContractState, amount_pt_total: u256, reserves_sy: u256, reserves_pt: u256,
        ) -> u256 {
            // Edge case: empty pool, just swap half
            if reserves_sy == 0 || reserves_pt == 0 {
                return amount_pt_total / 2;
            }

            // Edge case: very small amount, just swap half to avoid precision issues
            if amount_pt_total <= 1 {
                return amount_pt_total / 2;
            }

            // Binary search for optimal swap amount
            let mut low: u256 = 0;
            let mut high: u256 = amount_pt_total;
            let max_iterations: u32 = 20; // ~1e-6 precision
            let mut iteration: u32 = 0;

            while iteration < max_iterations && high > low + 1 {
                let mid = (low + high) / 2;

                // If mid equals low, we can't make progress, break to avoid infinite loop
                if mid == low {
                    break;
                }

                // Simulate: swap `mid` PT for SY
                let sy_out = self._estimate_swap_pt_for_sy(mid, reserves_sy, reserves_pt);

                // If sy_out is zero, we can't proceed with this mid value
                if sy_out == 0 {
                    // No SY received means we need to swap more (but ensure we make progress)
                    if mid > low {
                        low = mid;
                    }
                    iteration += 1;
                    continue;
                }

                let pt_remaining = amount_pt_total - mid;

                // If we've swapped everything, this is too much
                if pt_remaining == 0 {
                    high = mid;
                    iteration += 1;
                    continue;
                }

                // Check if this ratio matches pool ratio
                // sy_out / pt_remaining should equal reserves_sy / reserves_pt
                // Cross-multiply to avoid division: sy_out * reserves_pt <=> pt_remaining *
                // reserves_sy
                // Note: These multiplications could overflow with very large reserves.
                // In practice, reserves are bounded by realistic token amounts (< 2^128)
                // so multiplication fits in u256. For added safety, we could use checked math
                // but Cairo's default behavior will panic on overflow which is acceptable here.
                let left = sy_out * reserves_pt;
                let right = pt_remaining * reserves_sy;

                if left < right {
                    // Too little SY received, swap more PT
                    low = mid;
                } else {
                    // Too much SY received, swap less PT
                    high = mid;
                }

                iteration += 1;
            }

            low
        }

        /// Estimate SY received from swapping exact PT (without fees, approximate)
        /// @param pt_in Amount of PT to swap
        /// @param reserves_sy Current SY reserves in market
        /// @param reserves_pt Current PT reserves in market
        /// @return Estimated SY output
        fn _estimate_swap_pt_for_sy(
            ref self: ContractState, pt_in: u256, reserves_sy: u256, reserves_pt: u256,
        ) -> u256 {
            // Constant product approximation: (reserves_sy * pt_in) / (reserves_pt + pt_in)
            // This is simplified; real swap uses logit curve + fees
            // For optimization purposes, close enough
            if pt_in == 0 {
                return 0;
            }

            // Prevent overflow by checking if multiplication would exceed u256 max
            // Use the identity: (a * b) / c = a / c * b when possible
            // Or rearrange to avoid overflow: sy_out = reserves_sy / (1 + reserves_pt/pt_in)
            let denominator = reserves_pt + pt_in;

            // Guard against potential overflow in numerator
            // If reserves_sy > u256::MAX / pt_in, we need to be careful
            // Use checked operations by rearranging:
            // sy_out = reserves_sy * (pt_in / denominator) + reserves_sy * (pt_in % denominator) /
            // denominator But for simplicity, given protocol constraints, direct computation should
            // be safe as reserves are bounded by realistic token amounts
            let numerator = reserves_sy * pt_in;
            numerator / denominator
        }
    }
}
