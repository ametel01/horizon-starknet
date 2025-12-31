/// Yield Token (YT)
/// Represents the yield portion of a yield-bearing asset until expiry.
/// YT holders can claim accrued yield from the underlying SY.
/// At expiry, YT becomes worthless and only PT can redeem SY.
#[starknet::contract]
pub mod YT {
    use core::num::traits::Zero;
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
        ClassHash, ContractAddress, SyscallResultTrait, get_block_timestamp, get_caller_address,
        get_contract_address,
    };

    component!(path: ERC20Component, storage: erc20, event: ERC20Event);
    component!(path: SRC5Component, storage: src5, event: SRC5Event);
    component!(path: AccessControlComponent, storage: access_control, event: AccessControlEvent);
    component!(path: PausableComponent, storage: pausable, event: PausableEvent);
    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);
    component!(
        path: ReentrancyGuardComponent, storage: reentrancy_guard, event: ReentrancyGuardEvent,
    );

    impl ERC20InternalImpl = ERC20Component::InternalImpl<ContractState>;
    impl AccessControlInternalImpl = AccessControlComponent::InternalImpl<ContractState>;
    impl PausableInternalImpl = PausableComponent::InternalImpl<ContractState>;
    impl OwnableInternalImpl = OwnableComponent::InternalImpl<ContractState>;
    impl ReentrancyGuardInternalImpl = ReentrancyGuardComponent::InternalImpl<ContractState>;

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
        MintPY: MintPY,
        RedeemPY: RedeemPY,
        RedeemPYPostExpiry: RedeemPYPostExpiry,
        InterestClaimed: InterestClaimed,
        ExpiryReached: ExpiryReached,
    }

    #[derive(Drop, starknet::Event)]
    pub struct MintPY {
        #[key]
        pub caller: ContractAddress,
        #[key]
        pub receiver: ContractAddress,
        #[key]
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

    #[constructor]
    fn constructor(
        ref self: ContractState,
        name: ByteArray,
        symbol: ByteArray,
        sy: ContractAddress,
        pt_class_hash: ClassHash,
        expiry: u64,
        pauser: ContractAddress,
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

        self.sy.write(sy);
        self.expiry.write(expiry);

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
        // PT constructor args: name, symbol, sy, expiry, pauser
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

        let (pt_address, _) = deploy_syscall(pt_class_hash, 0, pt_calldata.span(), false)
            .unwrap_syscall();
        self.pt.write(pt_address);

        // Initialize PT with YT address (this contract)
        let pt_init = IPTInitDispatcher { contract_address: pt_address };
        pt_init.initialize_yt(get_contract_address());
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

        /// Mint PT + YT by depositing SY
        /// @param receiver Address to receive the minted PT and YT
        /// @param amount_sy_to_mint Amount of SY to deposit
        /// @return (amount_pt_minted, amount_yt_minted)
        fn mint_py(
            ref self: ContractState, receiver: ContractAddress, amount_sy_to_mint: u256,
        ) -> (u256, u256) {
            // Check not paused - mint operations can be paused in emergency
            self.pausable.assert_not_paused();
            // Defense-in-depth: prevent reentrancy during external calls
            self.reentrancy_guard.start();

            assert(!self.is_expired(), Errors::YT_EXPIRED);
            assert(!receiver.is_zero(), Errors::ZERO_ADDRESS);
            assert(amount_sy_to_mint > 0, Errors::ZERO_AMOUNT);

            let caller = get_caller_address();

            // Update global PY index first
            self._update_py_index();

            // Update receiver's interest before minting
            self._update_user_interest(receiver);

            // Transfer SY from caller to this contract
            let sy_addr = self.sy.read();
            let sy = ISYDispatcher { contract_address: sy_addr };
            let success = sy.transfer_from(caller, get_contract_address(), amount_sy_to_mint);
            assert(success, Errors::YT_INSUFFICIENT_SY);

            // Calculate PY amount: for simplicity, 1 SY = 1 PT + 1 YT
            // In production, this might account for the current index
            let amount_py = amount_sy_to_mint;

            // Mint PT to receiver
            let pt_addr = self.pt.read();
            let pt = IPTDispatcher { contract_address: pt_addr };
            pt.mint(receiver, amount_py);

            // Mint YT to receiver
            self.erc20.mint(receiver, amount_py);

            // Get current state for event
            let sy_addr = self.sy.read();
            let sy_contract = ISYDispatcher { contract_address: sy_addr };

            self
                .emit(
                    MintPY {
                        caller,
                        receiver,
                        expiry: self.expiry.read(),
                        amount_sy_deposited: amount_sy_to_mint,
                        amount_py_minted: amount_py,
                        pt: pt_addr,
                        sy: sy_addr,
                        py_index: self.py_index_stored.read(),
                        exchange_rate: sy_contract.exchange_rate(),
                        total_pt_supply_after: pt.total_supply(),
                        total_yt_supply_after: self.erc20.ERC20_total_supply.read(),
                        timestamp: get_block_timestamp(),
                    },
                );

            self.reentrancy_guard.end();
            (amount_py, amount_py)
        }

        /// Redeem PT + YT for SY (before expiry)
        /// @param receiver Address to receive the SY
        /// @param amount_py_to_redeem Amount of PT and YT to burn
        /// @return Amount of SY returned
        fn redeem_py(
            ref self: ContractState, receiver: ContractAddress, amount_py_to_redeem: u256,
        ) -> u256 {
            // Defense-in-depth: prevent reentrancy during external calls
            self.reentrancy_guard.start();

            assert(!self.is_expired(), Errors::YT_EXPIRED);
            assert(!receiver.is_zero(), Errors::ZERO_ADDRESS);
            assert(amount_py_to_redeem > 0, Errors::ZERO_AMOUNT);

            let caller = get_caller_address();

            // Update global PY index
            self._update_py_index();

            // Update caller's interest before burning
            self._update_user_interest(caller);

            // Burn PT from caller
            let pt_addr = self.pt.read();
            let pt = IPTDispatcher { contract_address: pt_addr };
            pt.burn(caller, amount_py_to_redeem);

            // Burn YT from caller
            self.erc20.burn(caller, amount_py_to_redeem);

            // Calculate SY to return: for simplicity, 1 PT + 1 YT = 1 SY
            let amount_sy = amount_py_to_redeem;

            // Transfer SY to receiver
            let sy_addr = self.sy.read();
            let sy = ISYDispatcher { contract_address: sy_addr };
            let success = sy.transfer(receiver, amount_sy);
            assert(success, Errors::YT_INSUFFICIENT_SY);

            self
                .emit(
                    RedeemPY {
                        caller,
                        receiver,
                        expiry: self.expiry.read(),
                        sy: sy_addr,
                        pt: pt_addr,
                        amount_py_redeemed: amount_py_to_redeem,
                        amount_sy_returned: amount_sy,
                        py_index: self.py_index_stored.read(),
                        exchange_rate: sy.exchange_rate(),
                        timestamp: get_block_timestamp(),
                    },
                );

            self.reentrancy_guard.end();
            amount_sy
        }

        /// Redeem PT for SY after expiry (YT is worthless)
        /// @param receiver Address to receive the SY
        /// @param amount_pt Amount of PT to burn
        /// @return Amount of SY returned
        fn redeem_py_post_expiry(
            ref self: ContractState, receiver: ContractAddress, amount_pt: u256,
        ) -> u256 {
            // Defense-in-depth: prevent reentrancy during external calls
            self.reentrancy_guard.start();

            assert(self.is_expired(), Errors::YT_NOT_EXPIRED);
            assert(!receiver.is_zero(), Errors::ZERO_ADDRESS);
            assert(amount_pt > 0, Errors::ZERO_AMOUNT);

            let caller = get_caller_address();

            // Update global PY index one last time
            self._update_py_index();

            // Emit ExpiryReached event on first post-expiry redemption
            if !self.expiry_event_emitted.read() {
                self.expiry_event_emitted.write(true);
                let sy_addr = self.sy.read();
                let pt_addr = self.pt.read();
                let sy = ISYDispatcher { contract_address: sy_addr };
                let pt = IPTDispatcher { contract_address: pt_addr };
                // Note: market, sy_reserve, pt_reserve are set to 0 as YT doesn't have market
                // reference
                let zero_address: ContractAddress = 0.try_into().unwrap();
                self
                    .emit(
                        ExpiryReached {
                            market: zero_address,
                            yt: get_contract_address(),
                            pt: pt_addr,
                            sy: sy_addr,
                            expiry: self.expiry.read(),
                            final_exchange_rate: sy.exchange_rate(),
                            final_py_index: self.py_index_stored.read(),
                            total_pt_supply: pt.total_supply(),
                            total_yt_supply: self.erc20.ERC20_total_supply.read(),
                            sy_reserve: 0, // YT doesn't have market reserve info
                            pt_reserve: 0, // YT doesn't have market reserve info
                            timestamp: get_block_timestamp(),
                        },
                    );
            }

            // Burn PT from caller (no YT needed post-expiry)
            let pt_addr = self.pt.read();
            let pt = IPTDispatcher { contract_address: pt_addr };
            pt.burn(caller, amount_pt);

            // Calculate SY to return: 1 PT = 1 SY post-expiry
            let amount_sy = amount_pt;

            // Transfer SY to receiver
            let sy_addr = self.sy.read();
            let sy = ISYDispatcher { contract_address: sy_addr };
            let success = sy.transfer(receiver, amount_sy);
            assert(success, Errors::YT_INSUFFICIENT_SY);

            self
                .emit(
                    RedeemPYPostExpiry {
                        caller,
                        receiver,
                        expiry: self.expiry.read(),
                        amount_pt_redeemed: amount_pt,
                        amount_sy_returned: amount_sy,
                        pt: pt_addr,
                        sy: sy_addr,
                        final_py_index: self.py_index_stored.read(),
                        final_exchange_rate: sy.exchange_rate(),
                        timestamp: get_block_timestamp(),
                    },
                );

            self.reentrancy_guard.end();
            amount_sy
        }

        /// Get current PY index (fetched from SY exchange rate)
        /// After expiry, returns the captured expiry index to prevent post-expiry yield accrual
        fn py_index_current(self: @ContractState) -> u256 {
            let sy = ISYDispatcher { contract_address: self.sy.read() };
            let current_rate = sy.exchange_rate();
            let stored_index = self.py_index_stored.read();

            // Always use max of current and stored (watermark pattern)
            let effective_index = if current_rate > stored_index {
                current_rate
            } else {
                stored_index
            };

            // After expiry, cap at the captured expiry index if it exists
            if self.is_expired() {
                let expiry_index = self.py_index_at_expiry.read();
                if expiry_index > 0 {
                    // Return the frozen expiry index
                    return expiry_index;
                }
                // Expiry index not yet captured - return current effective index
            // This will be captured on the next state-changing call
            }

            effective_index
        }

        /// Get stored PY index
        fn py_index_stored(self: @ContractState) -> u256 {
            self.py_index_stored.read()
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

            // Transfer interest as SY to user
            let sy_addr = self.sy.read();
            let sy = ISYDispatcher { contract_address: sy_addr };
            let success = sy.transfer(user, interest);
            assert(success, Errors::YT_INSUFFICIENT_SY);

            self
                .emit(
                    InterestClaimed {
                        user,
                        yt: get_contract_address(),
                        expiry: self.expiry.read(),
                        amount_sy: interest,
                        sy: sy_addr,
                        yt_balance,
                        py_index_at_claim: self.py_index_stored.read(),
                        exchange_rate: sy.exchange_rate(),
                        timestamp: get_block_timestamp(),
                    },
                );

            self.reentrancy_guard.end();
            interest
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
    }

    // Internal functions
    #[generate_trait]
    impl InternalImpl of InternalTrait {
        /// Update the global PY index from SY's exchange rate
        /// If expired, captures the expiry index on first call to prevent post-expiry yield accrual
        fn _update_py_index(ref self: ContractState) {
            // Get current effective index (max of oracle rate and stored)
            let current_index = self.py_index_current();

            // If expired, capture the expiry index on first call
            if self.is_expired() {
                if self.py_index_at_expiry.read() == 0 {
                    // First call after expiry - capture current index as the expiry cap
                    // This becomes the permanent cap for YT yield calculation
                    self.py_index_at_expiry.write(current_index);
                    self.py_index_stored.write(current_index);
                }
                return;
            }

            // Not expired - update stored index if current is higher
            let stored_index = self.py_index_stored.read();
            if current_index > stored_index {
                self.py_index_stored.write(current_index);
            }
        }

        /// Update a user's accrued interest based on their YT balance
        fn _update_user_interest(ref self: ContractState, user: ContractAddress) {
            if user.is_zero() {
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
