/// Yield Token (YT)
/// Represents the yield portion of a yield-bearing asset until expiry.
/// YT holders can claim accrued yield from the underlying SY.
/// At expiry, YT becomes worthless and only PT can redeem SY.
#[starknet::contract]
pub mod YT {
    use core::num::traits::Zero;
    use horizon::components::reward_manager_component::RewardManagerComponent;
    use horizon::interfaces::i_pt::{IPTDispatcher, IPTDispatcherTrait};
    use horizon::interfaces::i_sy::{ISYDispatcher, ISYDispatcherTrait};
    use horizon::interfaces::i_yt::{IYT, IYTAdmin};
    use horizon::libraries::errors::Errors;
    use horizon::libraries::math_fp::{wad_div, wad_mul};
    use horizon::libraries::roles::{DEFAULT_ADMIN_ROLE, PAUSER_ROLE};
    use horizon::tokens::pt::{IPTInitDispatcher, IPTInitDispatcherTrait};
    use openzeppelin_access::accesscontrol::AccessControlComponent;
    use openzeppelin_access::ownable::OwnableComponent;
    use openzeppelin_introspection::src5::SRC5Component;
    use openzeppelin_security::pausable::PausableComponent;
    use openzeppelin_security::reentrancyguard::ReentrancyGuardComponent;
    use openzeppelin_token::erc20::{DefaultConfig, ERC20Component, ERC20HooksEmptyImpl};
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };
    use starknet::syscalls::deploy_syscall;
    use starknet::{
        ClassHash, ContractAddress, SyscallResultTrait, get_block_info, get_block_timestamp,
        get_caller_address, get_contract_address,
    };

    component!(path: ERC20Component, storage: erc20, event: ERC20Event);
    component!(path: SRC5Component, storage: src5, event: SRC5Event);
    component!(path: AccessControlComponent, storage: access_control, event: AccessControlEvent);
    component!(path: PausableComponent, storage: pausable, event: PausableEvent);
    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);
    component!(
        path: ReentrancyGuardComponent, storage: reentrancy_guard, event: ReentrancyGuardEvent,
    );
    component!(path: RewardManagerComponent, storage: reward_manager, event: RewardManagerEvent);

    impl ERC20InternalImpl = ERC20Component::InternalImpl<ContractState>;
    impl AccessControlInternalImpl = AccessControlComponent::InternalImpl<ContractState>;
    impl PausableInternalImpl = PausableComponent::InternalImpl<ContractState>;
    impl OwnableInternalImpl = OwnableComponent::InternalImpl<ContractState>;
    impl ReentrancyGuardInternalImpl = ReentrancyGuardComponent::InternalImpl<ContractState>;
    impl RewardManagerInternalImpl = RewardManagerComponent::InternalImpl<ContractState>;
    impl RewardManagerViewImpl = RewardManagerComponent::ViewImpl<ContractState>;

    /// RewardHooksTrait implementation for YT
    /// Rewards are distributed based on YT balance (not SY), since YT holders earn yield
    impl RewardHooksImpl of RewardManagerComponent::RewardHooksTrait<ContractState> {
        fn user_sy_balance(self: @ContractState, user: ContractAddress) -> u256 {
            // Use YT balance for reward distribution (YT holders earn rewards)
            self.erc20.ERC20_balances.read(user)
        }

        fn total_sy_supply(self: @ContractState) -> u256 {
            // Use YT total supply for reward distribution
            self.erc20.ERC20_total_supply.read()
        }
    }

    #[abi(embed_v0)]
    impl AccessControlImpl =
        AccessControlComponent::AccessControlImpl<ContractState>;
    #[abi(embed_v0)]
    impl PausableImpl = PausableComponent::PausableImpl<ContractState>;
    #[abi(embed_v0)]
    impl OwnableImpl = OwnableComponent::OwnableImpl<ContractState>;

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
        reentrancy_guard: ReentrancyGuardComponent::Storage,
        #[substorage(v0)]
        reward_manager: RewardManagerComponent::Storage,
        // The SY token this YT is derived from
        sy: ContractAddress,
        // The corresponding PT contract
        pt: ContractAddress,
        // Expiry timestamp
        expiry: u64,
        // Global PY index (tracks SY exchange rate for yield calculation)
        py_index_stored: u256,
        // PY index captured at expiry (0 means not yet captured)
        // After expiry, this caps the yield calculation so YT holders don't benefit from
        // post-expiry yield
        py_index_at_expiry: u256,
        // User's last recorded PY index (for interest calculation)
        user_py_index: Map<ContractAddress, u256>,
        // User's accrued but unclaimed interest (in SY)
        user_interest: Map<ContractAddress, u256>,
        // Flag to emit ExpiryReached event only once
        expiry_event_emitted: bool,
        // Expected SY balance held by contract (tracks deposits/withdrawals)
        // Used to detect "floating" SY from direct transfers
        sy_reserve: u256,
        // Treasury address for protocol fee collection and post-expiry yield
        treasury: ContractAddress,
        // Accumulated post-expiry yield for treasury redemption
        // After expiry, yield that would have gone to YT holders is captured here
        post_expiry_sy_for_treasury: u256,
        // Protocol fee rate on interest claims (WAD-scaled, e.g., 0.03e18 = 3%)
        // Fee is deducted from interest and sent to treasury
        interest_fee_rate: u256,
        // Same-block index caching: block number of last index fetch
        // Avoids redundant oracle calls within the same block
        last_index_block: u64,
        // Same-block index caching: cached index value from last fetch
        cached_index: u256,
        // Token decimals (factory-provided, matches SY)
        decimals: u8,
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
        ReentrancyGuardEvent: ReentrancyGuardComponent::Event,
        #[flat]
        RewardManagerEvent: RewardManagerComponent::Event,
        MintPY: MintPY,
        RedeemPY: RedeemPY,
        RedeemPYPostExpiry: RedeemPYPostExpiry,
        InterestClaimed: InterestClaimed,
        ExpiryReached: ExpiryReached,
        TreasuryInterestRedeemed: TreasuryInterestRedeemed,
        InterestFeeRateSet: InterestFeeRateSet,
        MintPYMulti: MintPYMulti,
        RedeemPYMulti: RedeemPYMulti,
        RedeemPYWithInterest: RedeemPYWithInterest,
        PostExpiryDataSet: PostExpiryDataSet,
        PyIndexUpdated: PyIndexUpdated,
    }

    #[derive(Drop, starknet::Event)]
    pub struct MintPY {
        #[key]
        pub caller: ContractAddress,
        #[key]
        pub receiver_pt: ContractAddress,
        #[key]
        pub receiver_yt: ContractAddress,
        pub expiry: u64,
        pub amount_sy_deposited: u256,
        pub amount_py_minted: u256,
        pub pt: ContractAddress,
        pub sy: ContractAddress,
        pub py_index: u256,
        pub exchange_rate: u256,
        pub total_pt_supply_after: u256,
        pub total_yt_supply_after: u256,
        pub timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct RedeemPY {
        #[key]
        pub caller: ContractAddress,
        #[key]
        pub receiver: ContractAddress,
        #[key]
        pub expiry: u64,
        pub sy: ContractAddress,
        pub pt: ContractAddress,
        pub amount_py_redeemed: u256,
        pub amount_sy_returned: u256,
        pub py_index: u256,
        pub exchange_rate: u256,
        pub timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct RedeemPYPostExpiry {
        #[key]
        pub caller: ContractAddress,
        #[key]
        pub receiver: ContractAddress,
        #[key]
        pub expiry: u64,
        pub amount_pt_redeemed: u256,
        pub amount_sy_returned: u256,
        pub pt: ContractAddress,
        pub sy: ContractAddress,
        pub final_py_index: u256,
        pub final_exchange_rate: u256,
        pub timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct InterestClaimed {
        #[key]
        pub user: ContractAddress,
        #[key]
        pub yt: ContractAddress,
        #[key]
        pub expiry: u64,
        pub amount_sy: u256,
        pub sy: ContractAddress,
        pub yt_balance: u256,
        pub py_index_at_claim: u256,
        pub exchange_rate: u256,
        pub timestamp: u64,
    }

    /// Emitted once when the first post-expiry redemption occurs
    /// Captures the final state of the YT/PT system at expiry
    #[derive(Drop, starknet::Event)]
    pub struct ExpiryReached {
        #[key]
        pub market: ContractAddress,
        #[key]
        pub yt: ContractAddress,
        #[key]
        pub pt: ContractAddress,
        pub sy: ContractAddress,
        pub expiry: u64,
        pub final_exchange_rate: u256,
        pub final_py_index: u256,
        pub total_pt_supply: u256,
        pub total_yt_supply: u256,
        pub sy_reserve: u256,
        pub pt_reserve: u256,
        pub timestamp: u64,
    }

    /// Emitted when post-expiry yield is claimed for treasury
    #[derive(Drop, starknet::Event)]
    pub struct TreasuryInterestRedeemed {
        #[key]
        pub yt: ContractAddress,
        #[key]
        pub treasury: ContractAddress,
        pub amount_sy: u256,
        pub sy: ContractAddress,
        pub expiry_index: u256,
        pub current_index: u256,
        pub total_yt_supply: u256,
        pub timestamp: u64,
    }

    /// Emitted when the interest fee rate is updated
    #[derive(Drop, starknet::Event)]
    pub struct InterestFeeRateSet {
        #[key]
        pub yt: ContractAddress,
        pub old_rate: u256,
        pub new_rate: u256,
        pub timestamp: u64,
    }

    /// Emitted when batch minting PT/YT for multiple receivers
    #[derive(Drop, starknet::Event)]
    pub struct MintPYMulti {
        #[key]
        pub caller: ContractAddress,
        #[key]
        pub expiry: u64,
        pub total_sy_deposited: u256,
        pub total_py_minted: u256,
        pub receiver_count: u32,
        pub timestamp: u64,
    }

    /// Emitted when batch redeeming PT/YT for multiple receivers
    #[derive(Drop, starknet::Event)]
    pub struct RedeemPYMulti {
        #[key]
        pub caller: ContractAddress,
        #[key]
        pub expiry: u64,
        pub total_py_redeemed: u256,
        pub total_sy_returned: u256,
        pub receiver_count: u32,
        pub timestamp: u64,
    }

    /// Emitted when redeeming PT/YT with optional interest claim
    #[derive(Drop, starknet::Event)]
    pub struct RedeemPYWithInterest {
        #[key]
        pub caller: ContractAddress,
        #[key]
        pub receiver: ContractAddress,
        #[key]
        pub expiry: u64,
        pub amount_py_redeemed: u256,
        pub amount_sy_from_redeem: u256,
        pub amount_interest_claimed: u256,
        pub timestamp: u64,
    }

    /// Emitted once when post-expiry data is first initialized (Pendle-style)
    /// This marks the transition to post-expiry accounting
    #[derive(Drop, starknet::Event)]
    pub struct PostExpiryDataSet {
        #[key]
        pub yt: ContractAddress,
        #[key]
        pub pt: ContractAddress,
        pub sy: ContractAddress,
        pub expiry: u64,
        pub first_py_index: u256,
        pub exchange_rate_at_init: u256,
        pub total_pt_supply: u256,
        pub total_yt_supply: u256,
        pub timestamp: u64,
    }

    /// Emitted when the PY index is updated (Pendle-style pyIndexCurrent behavior)
    /// This event tracks index changes for off-chain monitoring and indexing
    #[derive(Drop, starknet::Event)]
    pub struct PyIndexUpdated {
        #[key]
        pub yt: ContractAddress,
        pub old_index: u256,
        pub new_index: u256,
        pub exchange_rate: u256,
        pub block_number: u64,
        pub timestamp: u64,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        name: ByteArray,
        symbol: ByteArray,
        sy: ContractAddress,
        pt_class_hash: ClassHash,
        expiry: u64,
        pauser: ContractAddress,
        treasury: ContractAddress,
        decimals: u8,
        reward_tokens: Span<ContractAddress>,
    ) {
        // Initialize ERC20 for YT
        self.erc20.initializer(name.clone(), symbol.clone());

        // Initialize AccessControl and grant roles to pauser
        self.access_control.initializer();
        self.access_control._grant_role(DEFAULT_ADMIN_ROLE, pauser);
        self.access_control._grant_role(PAUSER_ROLE, pauser);

        // Initialize ownable for upgrade control
        self.ownable.initializer(pauser);

        // Validate inputs
        assert(!sy.is_zero(), Errors::ZERO_ADDRESS);
        assert(expiry > get_block_timestamp(), Errors::YT_INVALID_EXPIRY);
        assert(!treasury.is_zero(), Errors::ZERO_ADDRESS);

        self.sy.write(sy);
        self.expiry.write(expiry);
        self.treasury.write(treasury);
        self.decimals.write(decimals);

        // Initialize PY index from SY's current exchange rate
        let sy_dispatcher = ISYDispatcher { contract_address: sy };
        let initial_index = sy_dispatcher.exchange_rate();
        self.py_index_stored.write(initial_index);

        // Get SY symbol for derived PT naming
        let sy_symbol = sy_dispatcher.symbol();

        // Construct PT name and symbol from SY symbol (e.g., "PT-stETH")
        let mut pt_name: ByteArray = "PT-";
        pt_name.append(@sy_symbol);
        let mut pt_symbol: ByteArray = "PT-";
        pt_symbol.append(@sy_symbol);

        // Deploy PT contract
        // PT constructor args: name, symbol, sy, expiry, pauser, decimals
        let mut pt_calldata: Array<felt252> = array![];
        // Serialize PT name (ByteArray)
        Serde::serialize(@pt_name, ref pt_calldata);
        // Serialize PT symbol (ByteArray)
        Serde::serialize(@pt_symbol, ref pt_calldata);
        // SY address
        pt_calldata.append(sy.into());
        // Expiry
        pt_calldata.append(expiry.into());
        // Pauser address
        pt_calldata.append(pauser.into());
        // Decimals (factory-provided, matches SY)
        pt_calldata.append(decimals.into());

        let (pt_address, _) = deploy_syscall(pt_class_hash, 0, pt_calldata.span(), false)
            .unwrap_syscall();
        self.pt.write(pt_address);

        // Initialize PT with YT address (this contract)
        let pt_init = IPTInitDispatcher { contract_address: pt_address };
        pt_init.initialize_yt(get_contract_address());

        // Initialize RewardManagerComponent if reward tokens are provided
        if reward_tokens.len() > 0 {
            self.reward_manager.initializer(reward_tokens);
        }
    }

    #[abi(embed_v0)]
    impl YTImpl of IYT<ContractState> {
        fn name(self: @ContractState) -> ByteArray {
            self.erc20.ERC20_name.read()
        }

        fn symbol(self: @ContractState) -> ByteArray {
            self.erc20.ERC20_symbol.read()
        }

        fn decimals(self: @ContractState) -> u8 {
            self.decimals.read()
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
            // Update global PY index first to ensure accurate interest calculation
            self._update_py_index();

            // Update interest before transfer to ensure accurate accounting
            let sender = get_caller_address();
            self._update_user_interest(sender);
            self._update_user_interest(recipient);

            self.erc20._transfer(sender, recipient, amount);
            true
        }

        fn transfer_from(
            ref self: ContractState,
            sender: ContractAddress,
            recipient: ContractAddress,
            amount: u256,
        ) -> bool {
            // Update global PY index first to ensure accurate interest calculation
            self._update_py_index();

            // Update interest before transfer
            self._update_user_interest(sender);
            self._update_user_interest(recipient);

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

        fn sy(self: @ContractState) -> ContractAddress {
            self.sy.read()
        }

        fn pt(self: @ContractState) -> ContractAddress {
            self.pt.read()
        }

        fn expiry(self: @ContractState) -> u64 {
            self.expiry.read()
        }

        fn is_expired(self: @ContractState) -> bool {
            get_block_timestamp() >= self.expiry.read()
        }

        /// Mint PT + YT by consuming floating SY (Pendle-style)
        /// Caller must transfer SY to this contract before calling.
        /// PY amount = syToAsset(index, floatingSy) = floatingSy * index / WAD
        /// @param receiver_pt Address to receive minted PT
        /// @param receiver_yt Address to receive minted YT
        /// @return (amount_pt_minted, amount_yt_minted) in asset terms
        fn mint_py(
            ref self: ContractState, receiver_pt: ContractAddress, receiver_yt: ContractAddress,
        ) -> (u256, u256) {
            // Check not paused - mint operations can be paused in emergency
            self.pausable.assert_not_paused();
            // Defense-in-depth: prevent reentrancy during external calls
            self.reentrancy_guard.start();

            assert(!self.is_expired(), Errors::YT_EXPIRED);
            assert(!receiver_pt.is_zero(), Errors::ZERO_ADDRESS);
            assert(!receiver_yt.is_zero(), Errors::ZERO_ADDRESS);

            let caller = get_caller_address();

            // Update global PY index first
            self._update_py_index();

            // Update YT receiver's interest before minting (PT receiver doesn't accrue YT interest)
            self._update_user_interest(receiver_yt);

            // Get floating SY (pre-transferred by caller)
            let sy_addr = self.sy.read();
            let sy = ISYDispatcher { contract_address: sy_addr };
            let actual_balance = sy.balance_of(get_contract_address());
            let sy_reserve = self.sy_reserve.read();
            assert(actual_balance > sy_reserve, Errors::YT_NO_FLOATING_SY);
            let amount_sy = actual_balance - sy_reserve;

            // Update sy_reserve to track expected SY balance
            self.sy_reserve.write(actual_balance);

            // Calculate PY amount using Pendle's syToAsset formula:
            // amount_py = syAmount * pyIndex / WAD
            // This converts SY amount to "asset" (underlying) terms
            let py_index = self.py_index_stored.read();
            let amount_py = wad_mul(amount_sy, py_index);

            // Mint PT to PT receiver
            let pt_addr = self.pt.read();
            let pt = IPTDispatcher { contract_address: pt_addr };
            pt.mint(receiver_pt, amount_py);

            // Mint YT to YT receiver
            self.erc20.mint(receiver_yt, amount_py);

            self
                .emit(
                    MintPY {
                        caller,
                        receiver_pt,
                        receiver_yt,
                        expiry: self.expiry.read(),
                        amount_sy_deposited: amount_sy,
                        amount_py_minted: amount_py,
                        pt: pt_addr,
                        sy: sy_addr,
                        py_index,
                        exchange_rate: sy.exchange_rate(),
                        total_pt_supply_after: pt.total_supply(),
                        total_yt_supply_after: self.erc20.ERC20_total_supply.read(),
                        timestamp: get_block_timestamp(),
                    },
                );

            self.reentrancy_guard.end();
            (amount_py, amount_py)
        }

        /// Redeem PT + YT for SY (before expiry) using floating tokens
        /// Caller must transfer PT and YT to this contract before calling.
        /// SY returned = assetToSy(index, pyAmount) = pyAmount * WAD / index
        /// @param receiver Address to receive the SY
        /// @return Amount of SY returned
        fn redeem_py(ref self: ContractState, receiver: ContractAddress) -> u256 {
            // Defense-in-depth: prevent reentrancy during external calls
            self.reentrancy_guard.start();

            assert(!self.is_expired(), Errors::YT_EXPIRED);
            assert(!receiver.is_zero(), Errors::ZERO_ADDRESS);

            let caller = get_caller_address();
            let this = get_contract_address();

            // Update global PY index
            self._update_py_index();

            // Get floating PT and YT (pre-transferred by caller)
            let pt_addr = self.pt.read();
            let pt = IPTDispatcher { contract_address: pt_addr };
            let amount_pt = pt.balance_of(this);
            let amount_yt = self.erc20.ERC20_balances.read(this);

            // PT and YT amounts must match (they're minted 1:1)
            assert(amount_pt > 0, Errors::YT_NO_FLOATING_PY);
            assert(amount_pt == amount_yt, Errors::YT_PT_YT_MISMATCH);

            // Update the contract's own interest (for YT it holds temporarily)
            // This ensures any accrued interest during transfer is accounted for
            self._update_user_interest(this);

            // Burn floating PT (from this contract)
            pt.burn(this, amount_pt);

            // Burn floating YT (from this contract)
            self.erc20.burn(this, amount_yt);

            // Calculate SY to return using Pendle's assetToSy formula:
            // amount_sy = pyAmount * WAD / pyIndex
            // This converts "asset" (underlying) terms back to SY terms
            let py_index = self.py_index_stored.read();
            let amount_sy = wad_div(amount_pt, py_index);

            // Transfer SY to receiver
            let sy_addr = self.sy.read();
            let sy = ISYDispatcher { contract_address: sy_addr };
            let success = sy.transfer(receiver, amount_sy);
            assert(success, Errors::YT_INSUFFICIENT_SY);

            // Reset sy_reserve to actual balance (Pendle-style)
            // This prevents reserve drift from rounding errors in assetToSy conversion
            self.sy_reserve.write(sy.balance_of(this));

            self
                .emit(
                    RedeemPY {
                        caller,
                        receiver,
                        expiry: self.expiry.read(),
                        sy: sy_addr,
                        pt: pt_addr,
                        amount_py_redeemed: amount_pt,
                        amount_sy_returned: amount_sy,
                        py_index,
                        exchange_rate: sy.exchange_rate(),
                        timestamp: get_block_timestamp(),
                    },
                );

            self.reentrancy_guard.end();
            amount_sy
        }

        /// Redeem PT for SY after expiry using floating PT (YT is worthless)
        /// Caller must transfer PT to this contract before calling.
        /// SY returned = assetToSy(expiryIndex, ptAmount) = ptAmount * WAD / expiryIndex
        /// Uses the frozen expiry index to ensure consistent redemption value.
        /// Post-expiry interest (yield accrued after expiry) is carved out per-redemption
        /// and redirected to treasury.
        /// @param receiver Address to receive the SY
        /// @return Amount of SY returned to user
        fn redeem_py_post_expiry(ref self: ContractState, receiver: ContractAddress) -> u256 {
            // Defense-in-depth: prevent reentrancy during external calls
            self.reentrancy_guard.start();

            assert(self.is_expired(), Errors::YT_NOT_EXPIRED);
            assert(!receiver.is_zero(), Errors::ZERO_ADDRESS);

            let caller = get_caller_address();
            let this = get_contract_address();

            // Update global PY index one last time (captures expiry index if not yet done)
            self._update_py_index();

            // Get floating PT (pre-transferred by caller)
            let pt_addr = self.pt.read();
            let pt = IPTDispatcher { contract_address: pt_addr };
            let amount_pt = pt.balance_of(this);
            assert(amount_pt > 0, Errors::YT_NO_FLOATING_PT);

            // Get the frozen expiry index for consistent redemption
            let expiry_index = self.py_index_at_expiry.read();

            // Emit ExpiryReached event on first post-expiry redemption
            if !self.expiry_event_emitted.read() {
                self.expiry_event_emitted.write(true);
                let sy_addr = self.sy.read();
                let sy = ISYDispatcher { contract_address: sy_addr };
                // Note: market, sy_reserve, pt_reserve are set to 0 as YT doesn't have market
                // reference
                let zero_address: ContractAddress = 0.try_into().unwrap();
                self
                    .emit(
                        ExpiryReached {
                            market: zero_address,
                            yt: this,
                            pt: pt_addr,
                            sy: sy_addr,
                            expiry: self.expiry.read(),
                            final_exchange_rate: sy.exchange_rate(),
                            final_py_index: expiry_index,
                            total_pt_supply: pt.total_supply(),
                            total_yt_supply: self.erc20.ERC20_total_supply.read(),
                            sy_reserve: 0, // YT doesn't have market reserve info
                            pt_reserve: 0, // YT doesn't have market reserve info
                            timestamp: get_block_timestamp(),
                        },
                    );
            }

            // Burn floating PT (from this contract)
            pt.burn(this, amount_pt);

            // Calculate SY to return using assetToSy with frozen expiry index:
            // user_sy = ptAmount * WAD / expiryIndex
            let user_sy = wad_div(amount_pt, expiry_index);

            // Calculate per-redemption treasury carve-out for post-expiry interest
            // If current index > expiry index, the delta is post-expiry yield that goes to treasury
            let sy_addr = self.sy.read();
            let sy = ISYDispatcher { contract_address: sy_addr };
            let current_index = sy.exchange_rate();

            let mut treasury_sy: u256 = 0;
            if current_index > expiry_index {
                // Treasury gets: assetToSy(current) - assetToSy(expiry)
                // = ptAmount/current - ptAmount/expiry (in WAD terms)
                // = ptAmount * (expiry - current) / (expiry * current) [negative, but we swap]
                // Actually: current > expiry means more SY per PT at current vs expiry
                // Treasury carve-out = ptAmount * (current - expiry) / (expiry * current)
                let index_diff = current_index - expiry_index;
                let denominator = wad_mul(expiry_index, current_index);
                treasury_sy = wad_div(wad_mul(amount_pt, index_diff), denominator);

                // Transfer treasury portion if applicable
                if treasury_sy > 0 {
                    let treasury_addr = self.treasury.read();
                    if !treasury_addr.is_zero() {
                        let success = sy.transfer(treasury_addr, treasury_sy);
                        assert(success, Errors::YT_INSUFFICIENT_SY);
                    }
                    // Track accumulated treasury interest
                    let current_treasury = self.post_expiry_sy_for_treasury.read();
                    self.post_expiry_sy_for_treasury.write(current_treasury + treasury_sy);
                }
            }

            // Transfer user's SY
            let success = sy.transfer(receiver, user_sy);
            assert(success, Errors::YT_INSUFFICIENT_SY);

            // Reset sy_reserve to actual balance (Pendle-style)
            // This prevents reserve drift from rounding errors in assetToSy conversion
            self.sy_reserve.write(sy.balance_of(this));

            self
                .emit(
                    RedeemPYPostExpiry {
                        caller,
                        receiver,
                        expiry: self.expiry.read(),
                        amount_pt_redeemed: amount_pt,
                        amount_sy_returned: user_sy,
                        pt: pt_addr,
                        sy: sy_addr,
                        final_py_index: expiry_index,
                        final_exchange_rate: current_index,
                        timestamp: get_block_timestamp(),
                    },
                );

            self.reentrancy_guard.end();
            user_sy
        }

        /// Batch mint PT + YT for multiple receivers using floating SY
        /// Total floating SY is split according to the amounts array
        /// @param receivers_pt Array of addresses to receive PT
        /// @param receivers_yt Array of addresses to receive YT
        /// @param amounts Array of SY amounts for each entry (must sum to floating SY)
        /// @return (pt_amounts, yt_amounts) Arrays of minted amounts in asset terms
        fn mint_py_multi(
            ref self: ContractState,
            receivers_pt: Array<ContractAddress>,
            receivers_yt: Array<ContractAddress>,
            amounts: Array<u256>,
        ) -> (Array<u256>, Array<u256>) {
            self.pausable.assert_not_paused();
            self.reentrancy_guard.start();

            assert(!self.is_expired(), Errors::YT_EXPIRED);
            assert(receivers_pt.len() == amounts.len(), Errors::YT_ARRAY_LENGTH_MISMATCH);
            assert(receivers_yt.len() == amounts.len(), Errors::YT_ARRAY_LENGTH_MISMATCH);
            assert(receivers_pt.len() > 0, Errors::ZERO_AMOUNT);

            let caller = get_caller_address();

            // Update global PY index once for all operations
            self._update_py_index();
            let py_index = self.py_index_stored.read();

            // Get floating SY (pre-transferred by caller)
            let sy_addr = self.sy.read();
            let sy = ISYDispatcher { contract_address: sy_addr };
            let actual_balance = sy.balance_of(get_contract_address());
            let sy_reserve = self.sy_reserve.read();
            assert(actual_balance > sy_reserve, Errors::YT_NO_FLOATING_SY);
            let floating_sy = actual_balance - sy_reserve;

            // Calculate total SY from amounts and verify it matches floating SY
            let mut total_sy: u256 = 0;
            let mut i: u32 = 0;
            let len = amounts.len();
            while i < len {
                total_sy += *amounts.at(i);
                i += 1;
            }
            assert(total_sy == floating_sy, Errors::YT_ARRAY_LENGTH_MISMATCH);

            // Update sy_reserve
            self.sy_reserve.write(actual_balance);

            // Mint PT/YT to each receiver
            let pt_addr = self.pt.read();
            let pt = IPTDispatcher { contract_address: pt_addr };

            let mut pt_amounts: Array<u256> = array![];
            let mut yt_amounts: Array<u256> = array![];
            let mut total_py: u256 = 0;
            i = 0;
            while i < len {
                let receiver_pt = *receivers_pt.at(i);
                let receiver_yt = *receivers_yt.at(i);
                let amount_sy = *amounts.at(i);

                assert(!receiver_pt.is_zero(), Errors::ZERO_ADDRESS);
                assert(!receiver_yt.is_zero(), Errors::ZERO_ADDRESS);
                assert(amount_sy > 0, Errors::ZERO_AMOUNT);

                // Update YT receiver's interest before minting
                self._update_user_interest(receiver_yt);

                // Calculate PY amount using syToAsset formula
                let amount_py = wad_mul(amount_sy, py_index);
                total_py += amount_py;

                // Mint PT to PT receiver, YT to YT receiver
                pt.mint(receiver_pt, amount_py);
                self.erc20.mint(receiver_yt, amount_py);

                pt_amounts.append(amount_py);
                yt_amounts.append(amount_py);
                i += 1;
            }

            // Emit batch event
            self
                .emit(
                    MintPYMulti {
                        caller,
                        expiry: self.expiry.read(),
                        total_sy_deposited: total_sy,
                        total_py_minted: total_py,
                        receiver_count: len,
                        timestamp: get_block_timestamp(),
                    },
                );

            self.reentrancy_guard.end();
            (pt_amounts, yt_amounts)
        }

        /// Batch redeem PT + YT for multiple receivers using floating tokens (before expiry)
        /// Caller must transfer PT and YT to this contract before calling.
        /// Amounts must sum to the floating PT/YT balance.
        /// Uses assetToSy formula for each amount.
        /// @param receivers Array of addresses to receive SY
        /// @param amounts Array of PY amounts to redeem for each receiver (in asset terms)
        /// @return Array of SY amounts returned
        fn redeem_py_multi(
            ref self: ContractState, receivers: Array<ContractAddress>, amounts: Array<u256>,
        ) -> Array<u256> {
            self.reentrancy_guard.start();

            assert(!self.is_expired(), Errors::YT_EXPIRED);
            assert(receivers.len() == amounts.len(), Errors::YT_ARRAY_LENGTH_MISMATCH);
            assert(receivers.len() > 0, Errors::ZERO_AMOUNT);

            let caller = get_caller_address();
            let this = get_contract_address();

            // Update global PY index once
            self._update_py_index();
            let py_index = self.py_index_stored.read();

            // Get floating PT and YT (pre-transferred by caller)
            let pt_addr = self.pt.read();
            let pt = IPTDispatcher { contract_address: pt_addr };
            let floating_pt = pt.balance_of(this);
            let floating_yt = self.erc20.ERC20_balances.read(this);

            assert(floating_pt > 0, Errors::YT_NO_FLOATING_PY);
            assert(floating_pt == floating_yt, Errors::YT_PT_YT_MISMATCH);

            // Calculate total from amounts and verify it matches floating tokens
            let mut total_py: u256 = 0;
            let mut i: u32 = 0;
            let len = amounts.len();
            while i < len {
                total_py += *amounts.at(i);
                i += 1;
            }
            assert(total_py == floating_pt, Errors::YT_ARRAY_LENGTH_MISMATCH);

            // Update the contract's own interest (for YT it holds temporarily)
            self._update_user_interest(this);

            // Burn all floating PT and YT
            pt.burn(this, floating_pt);
            self.erc20.burn(this, floating_yt);

            // Transfer SY to each receiver using assetToSy formula
            let sy_addr = self.sy.read();
            let sy = ISYDispatcher { contract_address: sy_addr };

            let mut sy_amounts: Array<u256> = array![];
            let mut total_sy: u256 = 0;
            i = 0;
            while i < len {
                let receiver = *receivers.at(i);
                let amount_py = *amounts.at(i);

                assert(!receiver.is_zero(), Errors::ZERO_ADDRESS);
                assert(amount_py > 0, Errors::ZERO_AMOUNT);

                // Calculate SY amount using assetToSy formula
                let amount_sy = wad_div(amount_py, py_index);
                total_sy += amount_sy;

                let success = sy.transfer(receiver, amount_sy);
                assert(success, Errors::YT_INSUFFICIENT_SY);

                sy_amounts.append(amount_sy);
                i += 1;
            }

            // Reset sy_reserve to actual balance (Pendle-style)
            self.sy_reserve.write(sy.balance_of(this));

            // Emit batch event
            self
                .emit(
                    RedeemPYMulti {
                        caller,
                        expiry: self.expiry.read(),
                        total_py_redeemed: total_py,
                        total_sy_returned: total_sy,
                        receiver_count: len,
                        timestamp: get_block_timestamp(),
                    },
                );

            self.reentrancy_guard.end();
            sy_amounts
        }

        /// Redeem PT + YT for SY with optional interest claim using floating tokens
        /// Caller must transfer PT and YT to this contract before calling.
        /// Convenience function that combines redeem_py and redeem_due_interest.
        /// Uses assetToSy formula for principal redemption.
        /// @param receiver Address to receive the SY (both from redeem and interest)
        /// @param redeem_interest If true, also claims caller's accrued interest
        /// @return (sy_from_redeem, interest_claimed)
        fn redeem_py_with_interest(
            ref self: ContractState, receiver: ContractAddress, redeem_interest: bool,
        ) -> (u256, u256) {
            self.reentrancy_guard.start();

            assert(!self.is_expired(), Errors::YT_EXPIRED);
            assert(!receiver.is_zero(), Errors::ZERO_ADDRESS);

            let caller = get_caller_address();
            let this = get_contract_address();

            // Update global PY index
            self._update_py_index();
            let py_index = self.py_index_stored.read();

            // Get floating PT and YT (pre-transferred by caller)
            let pt_addr = self.pt.read();
            let pt = IPTDispatcher { contract_address: pt_addr };
            let amount_pt = pt.balance_of(this);
            let amount_yt = self.erc20.ERC20_balances.read(this);

            assert(amount_pt > 0, Errors::YT_NO_FLOATING_PY);
            assert(amount_pt == amount_yt, Errors::YT_PT_YT_MISMATCH);

            // Update the contract's own interest (for YT it holds temporarily)
            self._update_user_interest(this);

            // Burn floating PT and YT
            pt.burn(this, amount_pt);
            self.erc20.burn(this, amount_yt);

            // Calculate SY to return using assetToSy formula:
            // sy_from_redeem = pyAmount * WAD / pyIndex
            let sy_from_redeem = wad_div(amount_pt, py_index);

            let sy_addr = self.sy.read();
            let sy = ISYDispatcher { contract_address: sy_addr };

            // Transfer SY from redemption to receiver
            let success = sy.transfer(receiver, sy_from_redeem);
            assert(success, Errors::YT_INSUFFICIENT_SY);

            // Handle interest claim if requested (caller's accumulated interest)
            let mut interest_claimed: u256 = 0;
            if redeem_interest {
                // Update caller's interest first to ensure it's current
                self._update_user_interest(caller);

                let interest = self.user_interest.read(caller);
                if interest > 0 {
                    self.user_interest.write(caller, 0);

                    // Apply protocol fee
                    let fee_rate = self.interest_fee_rate.read();
                    let fee = wad_mul(interest, fee_rate);
                    let user_interest = interest - fee;

                    // Transfer net interest to receiver
                    if user_interest > 0 {
                        let success = sy.transfer(receiver, user_interest);
                        assert(success, Errors::YT_INSUFFICIENT_SY);
                    }

                    // Transfer fee to treasury if applicable
                    if fee > 0 {
                        let treasury = self.treasury.read();
                        if !treasury.is_zero() {
                            let success = sy.transfer(treasury, fee);
                            assert(success, Errors::YT_INSUFFICIENT_SY);
                        }
                    }

                    interest_claimed = user_interest;
                }
            }

            // Reset sy_reserve to actual balance (Pendle-style)
            self.sy_reserve.write(sy.balance_of(this));

            self
                .emit(
                    RedeemPYWithInterest {
                        caller,
                        receiver,
                        expiry: self.expiry.read(),
                        amount_py_redeemed: amount_pt,
                        amount_sy_from_redeem: sy_from_redeem,
                        amount_interest_claimed: interest_claimed,
                        timestamp: get_block_timestamp(),
                    },
                );

            self.reentrancy_guard.end();
            (sy_from_redeem, interest_claimed)
        }

        /// Get current PY index (fetched from SY exchange rate)
        /// After expiry, returns the captured expiry index to prevent post-expiry yield accrual
        /// Uses same-block caching to avoid redundant oracle calls
        fn py_index_current(self: @ContractState) -> u256 {
            // After expiry, always return the frozen expiry index if captured
            if self.is_expired() {
                let expiry_index = self.py_index_at_expiry.read();
                if expiry_index > 0 {
                    return expiry_index;
                }
            }

            // Check same-block cache to avoid redundant oracle calls
            let current_block = get_block_info().unbox().block_number;
            if current_block == self.last_index_block.read() && self.cached_index.read() > 0 {
                return self.cached_index.read();
            }

            // Cache miss or stale - fetch from SY
            let sy = ISYDispatcher { contract_address: self.sy.read() };
            let current_rate = sy.exchange_rate();
            let stored_index = self.py_index_stored.read();

            // Always use max of current and stored (watermark pattern)
            if current_rate > stored_index {
                current_rate
            } else {
                stored_index
            }
        }

        /// Get stored PY index
        fn py_index_stored(self: @ContractState) -> u256 {
            self.py_index_stored.read()
        }

        /// Update and return the current PY index (Pendle-style pyIndexCurrent)
        /// Unlike py_index_current() which is view-only, this function:
        /// - Fetches the current exchange rate from SY
        /// - Updates py_index_stored if the rate is higher (watermark pattern)
        /// - Emits PyIndexUpdated event when index changes
        /// - Updates same-block cache
        /// After expiry, captures and freezes the expiry index on first call.
        /// @return The current PY index
        fn update_py_index(ref self: ContractState) -> u256 {
            self._update_py_index_with_event();
            self.py_index_stored.read()
        }

        /// Get expected SY balance held by this contract
        /// Tracks deposits minus withdrawals, not actual balance
        fn sy_reserve(self: @ContractState) -> u256 {
            self.sy_reserve.read()
        }

        /// Get "floating" SY - tokens sent directly to contract outside normal operations
        /// Returns difference between actual balance and expected reserve
        fn get_floating_sy(self: @ContractState) -> u256 {
            let sy = ISYDispatcher { contract_address: self.sy.read() };
            let actual = sy.balance_of(get_contract_address());
            let reserved = self.sy_reserve.read();
            if actual > reserved {
                actual - reserved
            } else {
                0
            }
        }

        /// Get "floating" PT - PT tokens pre-transferred to this contract for redemption
        /// Returns PT balance held by this contract (normally 0, positive when tokens staged for
        /// redeem)
        fn get_floating_pt(self: @ContractState) -> u256 {
            let pt = IPTDispatcher { contract_address: self.pt.read() };
            pt.balance_of(get_contract_address())
        }

        /// Get "floating" YT - YT tokens pre-transferred to this contract for redemption
        /// Returns YT balance held by this contract (normally 0, positive when tokens staged for
        /// redeem)
        fn get_floating_yt(self: @ContractState) -> u256 {
            self.erc20.ERC20_balances.read(get_contract_address())
        }

        /// Claim accrued interest for a user
        /// @param user Address to claim interest for
        /// @return Amount of SY claimed
        fn redeem_due_interest(ref self: ContractState, user: ContractAddress) -> u256 {
            // Defense-in-depth: prevent reentrancy during external calls
            self.reentrancy_guard.start();

            // Update global index and user's interest
            self._update_py_index();
            self._update_user_interest(user);

            // Get user's YT balance before clearing interest
            let yt_balance = self.erc20.ERC20_balances.read(user);

            // Get and clear user's accrued interest
            let interest = self.user_interest.read(user);
            if interest == 0 {
                self.reentrancy_guard.end();
                return 0;
            }

            self.user_interest.write(user, 0);

            // Apply protocol fee
            let fee_rate = self.interest_fee_rate.read();
            let fee = wad_mul(interest, fee_rate);
            let user_interest = interest - fee;

            // Transfer net interest to user
            let sy_addr = self.sy.read();
            let sy = ISYDispatcher { contract_address: sy_addr };
            if user_interest > 0 {
                let success = sy.transfer(user, user_interest);
                assert(success, Errors::YT_INSUFFICIENT_SY);
            }

            // Transfer fee to treasury if applicable
            if fee > 0 {
                let treasury = self.treasury.read();
                if !treasury.is_zero() {
                    let success = sy.transfer(treasury, fee);
                    assert(success, Errors::YT_INSUFFICIENT_SY);
                }
            }

            // Reset sy_reserve to actual balance (Pendle-style)
            self.sy_reserve.write(sy.balance_of(get_contract_address()));

            self
                .emit(
                    InterestClaimed {
                        user,
                        yt: get_contract_address(),
                        expiry: self.expiry.read(),
                        amount_sy: user_interest,
                        sy: sy_addr,
                        yt_balance,
                        py_index_at_claim: self.py_index_stored.read(),
                        exchange_rate: sy.exchange_rate(),
                        timestamp: get_block_timestamp(),
                    },
                );

            self.reentrancy_guard.end();
            user_interest
        }

        /// Get user's pending interest (view only)
        fn get_user_interest(self: @ContractState, user: ContractAddress) -> u256 {
            let current_index = self.py_index_current();
            let user_index = self.user_py_index.read(user);
            let yt_balance = self.erc20.ERC20_balances.read(user);
            let accrued = self.user_interest.read(user);

            if user_index == 0 || yt_balance == 0 {
                return accrued;
            }

            // Calculate new interest since last update
            // Pendle formula: interest = balance × (curr - prev) / (prev × curr)
            if current_index > user_index {
                let index_diff = current_index - user_index;
                let denominator = wad_mul(user_index, current_index);
                let new_interest = wad_div(wad_mul(yt_balance, index_diff), denominator);
                accrued + new_interest
            } else {
                accrued
            }
        }

        /// Get the treasury address for protocol fee collection
        fn treasury(self: @ContractState) -> ContractAddress {
            self.treasury.read()
        }

        /// Get pending post-expiry yield for treasury
        /// This is yield that accrued after expiry, which would have gone to YT holders
        /// but is now redirected to treasury since YT becomes worthless at expiry.
        /// Returns the amount of SY available for treasury redemption.
        fn get_post_expiry_treasury_interest(self: @ContractState) -> u256 {
            // Only applicable after expiry
            if !self.is_expired() {
                return 0;
            }

            let expiry_index = self.py_index_at_expiry.read();
            // If expiry index not yet captured, no post-expiry interest
            if expiry_index == 0 {
                return 0;
            }

            // Get actual current exchange rate (not the frozen expiry index)
            let sy = ISYDispatcher { contract_address: self.sy.read() };
            let current_index = sy.exchange_rate();

            // If index hasn't increased since expiry, no post-expiry yield
            if current_index <= expiry_index {
                return 0;
            }

            // Calculate total post-expiry interest for all YT
            // Formula: total_yt × (current - expiry) / expiry
            let total_yt = self.erc20.ERC20_total_supply.read();
            let index_diff = current_index - expiry_index;
            let total_owed = wad_div(wad_mul(total_yt, index_diff), expiry_index);

            // Subtract what has already been claimed by treasury
            let claimed = self.post_expiry_sy_for_treasury.read();
            if total_owed > claimed {
                total_owed - claimed
            } else {
                0
            }
        }

        /// Get the current interest fee rate (WAD-scaled)
        fn interest_fee_rate(self: @ContractState) -> u256 {
            self.interest_fee_rate.read()
        }

        /// Get the PY index captured at first post-expiry action (Pendle: firstPYIndex)
        /// Returns 0 if expiry hasn't been reached or first post-expiry action hasn't occurred
        fn first_py_index(self: @ContractState) -> u256 {
            self.py_index_at_expiry.read()
        }

        /// Get total SY interest accumulated for treasury since expiry
        /// (Pendle: totalSyInterestForTreasury)
        /// This is post-expiry yield carved out from redemptions and redirected to treasury
        fn total_sy_interest_for_treasury(self: @ContractState) -> u256 {
            self.post_expiry_sy_for_treasury.read()
        }

        /// Get complete post-expiry data in one call
        /// Returns (first_py_index, total_sy_interest_for_treasury, is_post_expiry_initialized)
        fn get_post_expiry_data(self: @ContractState) -> (u256, u256, bool) {
            let first_index = self.py_index_at_expiry.read();
            let treasury_interest = self.post_expiry_sy_for_treasury.read();
            let is_initialized = first_index > 0;
            (first_index, treasury_interest, is_initialized)
        }
    }

    #[abi(embed_v0)]
    impl YTAdminImpl of IYTAdmin<ContractState> {
        fn pause(ref self: ContractState) {
            self.access_control.assert_only_role(PAUSER_ROLE);
            self.pausable.pause();
        }

        fn unpause(ref self: ContractState) {
            self.access_control.assert_only_role(PAUSER_ROLE);
            self.pausable.unpause();
        }

        /// Claim post-expiry yield for treasury
        /// After expiry, any yield that accrues on the underlying SY is captured for treasury.
        /// This redirects "orphaned" yield that would otherwise be locked forever.
        /// Only callable by admin after expiry.
        /// @return Amount of SY transferred to treasury
        fn redeem_post_expiry_interest_for_treasury(ref self: ContractState) -> u256 {
            self.access_control.assert_only_role(DEFAULT_ADMIN_ROLE);
            assert(self.is_expired(), Errors::YT_NOT_EXPIRED);

            // Ensure expiry index is captured
            self._update_py_index();

            let expiry_index = self.py_index_at_expiry.read();
            if expiry_index == 0 {
                return 0;
            }

            // Get actual current exchange rate
            let sy_addr = self.sy.read();
            let sy = ISYDispatcher { contract_address: sy_addr };
            let current_index = sy.exchange_rate();

            // If index hasn't increased since expiry, no post-expiry yield
            if current_index <= expiry_index {
                return 0;
            }

            // Calculate total post-expiry interest for all YT
            // Formula: total_yt × (current - expiry) / expiry
            let total_yt = self.erc20.ERC20_total_supply.read();
            let index_diff = current_index - expiry_index;
            let total_owed = wad_div(wad_mul(total_yt, index_diff), expiry_index);

            // Calculate amount available (total - already claimed)
            let already_claimed = self.post_expiry_sy_for_treasury.read();
            if total_owed <= already_claimed {
                return 0;
            }
            let amount = total_owed - already_claimed;

            // Update claimed amount
            self.post_expiry_sy_for_treasury.write(total_owed);

            // Transfer SY to treasury
            let treasury_addr = self.treasury.read();
            let success = sy.transfer(treasury_addr, amount);
            assert(success, Errors::YT_INSUFFICIENT_SY);

            // Reset sy_reserve to actual balance (Pendle-style)
            self.sy_reserve.write(sy.balance_of(get_contract_address()));

            // Emit event
            self
                .emit(
                    TreasuryInterestRedeemed {
                        yt: get_contract_address(),
                        treasury: treasury_addr,
                        amount_sy: amount,
                        sy: sy_addr,
                        expiry_index,
                        current_index,
                        total_yt_supply: total_yt,
                        timestamp: get_block_timestamp(),
                    },
                );

            amount
        }

        /// Set the protocol fee rate on interest claims (admin only)
        /// @param rate Fee rate in WAD (e.g., 0.03e18 = 3%), max 50% (0.5e18)
        fn set_interest_fee_rate(ref self: ContractState, rate: u256) {
            self.access_control.assert_only_role(DEFAULT_ADMIN_ROLE);
            // Max 50% fee (0.5e18 = 500000000000000000)
            assert(rate <= 500000000000000000, Errors::YT_INVALID_FEE_RATE);

            let old_rate = self.interest_fee_rate.read();
            self.interest_fee_rate.write(rate);

            self
                .emit(
                    InterestFeeRateSet {
                        yt: get_contract_address(),
                        old_rate,
                        new_rate: rate,
                        timestamp: get_block_timestamp(),
                    },
                );
        }
    }

    // Internal functions
    #[generate_trait]
    impl InternalImpl of InternalTrait {
        /// Update the global PY index from SY's exchange rate
        /// If expired, captures the expiry index on first call to prevent post-expiry yield accrual
        /// Uses same-block caching to avoid redundant oracle calls
        fn _update_py_index(ref self: ContractState) {
            // If expired, handle expiry index capture
            if self.is_expired() {
                if self.py_index_at_expiry.read() == 0 {
                    // First call after expiry - compute and capture current index (Pendle-style)
                    let current_index = self._fetch_current_index();
                    self.py_index_at_expiry.write(current_index);
                    self.py_index_stored.write(current_index);

                    // Emit PostExpiryDataSet event (equivalent to Pendle's _setPostExpiryData)
                    let this = get_contract_address();
                    let sy_addr = self.sy.read();
                    let pt_addr = self.pt.read();
                    let sy = ISYDispatcher { contract_address: sy_addr };
                    let pt = IPTDispatcher { contract_address: pt_addr };
                    self
                        .emit(
                            PostExpiryDataSet {
                                yt: this,
                                pt: pt_addr,
                                sy: sy_addr,
                                expiry: self.expiry.read(),
                                first_py_index: current_index,
                                exchange_rate_at_init: sy.exchange_rate(),
                                total_pt_supply: pt.total_supply(),
                                total_yt_supply: self.erc20.ERC20_total_supply.read(),
                                timestamp: get_block_timestamp(),
                            },
                        );
                }
                return;
            }

            // Check same-block cache to avoid redundant oracle calls
            let current_block = get_block_info().unbox().block_number;
            let cached_block = self.last_index_block.read();
            if current_block == cached_block && self.cached_index.read() > 0 {
                // Cache hit - use cached index (already stored)
                return;
            }

            // Cache miss or stale - fetch from oracle and update cache
            let current_index = self._fetch_current_index();

            // Update stored index if current is higher (watermark pattern)
            let stored_index = self.py_index_stored.read();
            if current_index > stored_index {
                self.py_index_stored.write(current_index);
            }

            // Update cache for current block
            self.last_index_block.write(current_block);
            self.cached_index.write(current_index);
        }

        /// Update the global PY index with PyIndexUpdated event emission (Pendle-style)
        /// Similar to _update_py_index but emits PyIndexUpdated when index changes
        /// Used by the external update_py_index() function
        fn _update_py_index_with_event(ref self: ContractState) {
            let old_index = self.py_index_stored.read();
            let sy_addr = self.sy.read();
            let sy = ISYDispatcher { contract_address: sy_addr };

            // If expired, handle expiry index capture
            if self.is_expired() {
                if self.py_index_at_expiry.read() == 0 {
                    // First call after expiry - compute and capture current index (Pendle-style)
                    let current_index = self._fetch_current_index();
                    self.py_index_at_expiry.write(current_index);
                    self.py_index_stored.write(current_index);

                    // Emit PyIndexUpdated event for the expiry capture
                    if current_index != old_index {
                        let current_block = get_block_info().unbox().block_number;
                        self
                            .emit(
                                PyIndexUpdated {
                                    yt: get_contract_address(),
                                    old_index,
                                    new_index: current_index,
                                    exchange_rate: sy.exchange_rate(),
                                    block_number: current_block,
                                    timestamp: get_block_timestamp(),
                                },
                            );
                    }

                    // Emit PostExpiryDataSet event (equivalent to Pendle's _setPostExpiryData)
                    let this = get_contract_address();
                    let pt_addr = self.pt.read();
                    let pt = IPTDispatcher { contract_address: pt_addr };
                    self
                        .emit(
                            PostExpiryDataSet {
                                yt: this,
                                pt: pt_addr,
                                sy: sy_addr,
                                expiry: self.expiry.read(),
                                first_py_index: current_index,
                                exchange_rate_at_init: sy.exchange_rate(),
                                total_pt_supply: pt.total_supply(),
                                total_yt_supply: self.erc20.ERC20_total_supply.read(),
                                timestamp: get_block_timestamp(),
                            },
                        );
                }
                return;
            }

            // Check same-block cache to avoid redundant oracle calls
            let current_block = get_block_info().unbox().block_number;
            let cached_block = self.last_index_block.read();
            if current_block == cached_block && self.cached_index.read() > 0 {
                // Cache hit - no update needed, no event
                return;
            }

            // Cache miss or stale - fetch from oracle and update cache
            let current_index = self._fetch_current_index();
            let exchange_rate = sy.exchange_rate();

            // Update stored index if current is higher (watermark pattern)
            if current_index > old_index {
                self.py_index_stored.write(current_index);

                // Emit PyIndexUpdated event for index change
                self
                    .emit(
                        PyIndexUpdated {
                            yt: get_contract_address(),
                            old_index,
                            new_index: current_index,
                            exchange_rate,
                            block_number: current_block,
                            timestamp: get_block_timestamp(),
                        },
                    );
            }

            // Update cache for current block
            self.last_index_block.write(current_block);
            self.cached_index.write(current_index);
        }

        /// Fetch current index from SY oracle (internal helper)
        /// Returns max of oracle rate and stored index (watermark pattern)
        fn _fetch_current_index(ref self: ContractState) -> u256 {
            let sy = ISYDispatcher { contract_address: self.sy.read() };
            let current_rate = sy.exchange_rate();
            let stored_index = self.py_index_stored.read();

            // Watermark pattern - never decrease
            if current_rate > stored_index {
                current_rate
            } else {
                stored_index
            }
        }

        /// Update a user's accrued interest based on their YT balance
        /// Pendle-style: excludes address(0) and address(this) from interest tracking
        fn _update_user_interest(ref self: ContractState, user: ContractAddress) {
            // Skip zero address
            if user.is_zero() {
                return;
            }
            // Skip the YT contract itself (Pendle excludes address(this))
            // This prevents the contract from accruing interest to itself
            if user == get_contract_address() {
                return;
            }

            let current_index = self.py_index_stored.read();
            let user_index = self.user_py_index.read(user);
            let yt_balance = self.erc20.ERC20_balances.read(user);

            // If user has a previous index and YT balance, calculate interest
            if user_index > 0 && yt_balance > 0 && current_index > user_index {
                // Pendle formula: interest = balance × (curr - prev) / (prev × curr)
                // This normalization accounts for SY's increased value - users get fewer SY
                // tokens, but each is worth more. Invariant: totalSyRedeemable unchanged.
                let index_diff = current_index - user_index;
                let denominator = wad_mul(user_index, current_index);
                let new_interest = wad_div(wad_mul(yt_balance, index_diff), denominator);

                let accrued = self.user_interest.read(user);
                self.user_interest.write(user, accrued + new_interest);
            }

            // Update user's index to current
            if current_index > 0 {
                self.user_py_index.write(user, current_index);
            }
        }
    }
}
