/// Yield Token (YT)
/// Represents the yield portion of a yield-bearing asset until expiry.
/// YT holders can claim accrued yield from the underlying SY.
/// At expiry, YT becomes worthless and only PT can redeem SY.
#[starknet::contract]
pub mod YT {
    use core::num::traits::Zero;
    use horizon::interfaces::i_pt::{IPTDispatcher, IPTDispatcherTrait};
    use horizon::interfaces::i_sy::{ISYDispatcher, ISYDispatcherTrait};
    use horizon::interfaces::i_yt::IYT;
    use horizon::libraries::errors::Errors;
    use horizon::libraries::math::{wad_div, wad_mul};
    use horizon::tokens::pt::{IPTInitDispatcher, IPTInitDispatcherTrait};
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

    impl ERC20InternalImpl = ERC20Component::InternalImpl<ContractState>;

    #[storage]
    struct Storage {
        #[substorage(v0)]
        erc20: ERC20Component::Storage,
        // The SY token this YT is derived from
        sy: ContractAddress,
        // The corresponding PT contract
        pt: ContractAddress,
        // Expiry timestamp
        expiry: u64,
        // Global PY index (tracks SY exchange rate for yield calculation)
        py_index_stored: u256,
        // User's last recorded PY index (for interest calculation)
        user_py_index: Map<ContractAddress, u256>,
        // User's accrued but unclaimed interest (in SY)
        user_interest: Map<ContractAddress, u256>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        #[flat]
        ERC20Event: ERC20Component::Event,
        MintPY: MintPY,
        RedeemPY: RedeemPY,
        RedeemPYPostExpiry: RedeemPYPostExpiry,
        InterestClaimed: InterestClaimed,
    }

    #[derive(Drop, starknet::Event)]
    pub struct MintPY {
        #[key]
        pub caller: ContractAddress,
        #[key]
        pub receiver: ContractAddress,
        pub amount_sy_deposited: u256,
        pub amount_py_minted: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct RedeemPY {
        #[key]
        pub caller: ContractAddress,
        #[key]
        pub receiver: ContractAddress,
        pub amount_py_redeemed: u256,
        pub amount_sy_returned: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct RedeemPYPostExpiry {
        #[key]
        pub caller: ContractAddress,
        #[key]
        pub receiver: ContractAddress,
        pub amount_pt_redeemed: u256,
        pub amount_sy_returned: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct InterestClaimed {
        #[key]
        pub user: ContractAddress,
        pub amount_sy: u256,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        name: ByteArray,
        symbol: ByteArray,
        sy: ContractAddress,
        pt_class_hash: ClassHash,
        expiry: u64,
    ) {
        // Initialize ERC20 for YT
        self.erc20.initializer(name.clone(), symbol.clone());

        // Validate inputs
        assert(!sy.is_zero(), Errors::ZERO_ADDRESS);
        assert(expiry > get_block_timestamp(), Errors::YT_INVALID_EXPIRY);

        self.sy.write(sy);
        self.expiry.write(expiry);

        // Initialize PY index from SY's current exchange rate
        let sy_dispatcher = ISYDispatcher { contract_address: sy };
        let initial_index = sy_dispatcher.exchange_rate();
        self.py_index_stored.write(initial_index);

        // Deploy PT contract
        // PT constructor args: name, symbol, sy, expiry
        let mut pt_calldata: Array<felt252> = array![];
        // Serialize ByteArray for PT name (e.g., "PT-TokenName")
        pt_calldata.append(0); // data array length
        pt_calldata.append('PT Token'); // pending_word (simplified)
        pt_calldata.append(8); // pending_word_len
        // Serialize ByteArray for PT symbol
        pt_calldata.append(0);
        pt_calldata.append('PT');
        pt_calldata.append(2);
        // SY address
        pt_calldata.append(sy.into());
        // Expiry
        pt_calldata.append(expiry.into());

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
            let pt = IPTDispatcher { contract_address: self.pt.read() };
            pt.mint(receiver, amount_py);

            // Mint YT to receiver
            self.erc20.mint(receiver, amount_py);

            self
                .emit(
                    MintPY {
                        caller,
                        receiver,
                        amount_sy_deposited: amount_sy_to_mint,
                        amount_py_minted: amount_py,
                    },
                );

            (amount_py, amount_py)
        }

        /// Redeem PT + YT for SY (before expiry)
        /// @param receiver Address to receive the SY
        /// @param amount_py_to_redeem Amount of PT and YT to burn
        /// @return Amount of SY returned
        fn redeem_py(
            ref self: ContractState, receiver: ContractAddress, amount_py_to_redeem: u256,
        ) -> u256 {
            assert(!self.is_expired(), Errors::YT_EXPIRED);
            assert(!receiver.is_zero(), Errors::ZERO_ADDRESS);
            assert(amount_py_to_redeem > 0, Errors::ZERO_AMOUNT);

            let caller = get_caller_address();

            // Update global PY index
            self._update_py_index();

            // Update caller's interest before burning
            self._update_user_interest(caller);

            // Burn PT from caller
            let pt = IPTDispatcher { contract_address: self.pt.read() };
            pt.burn(caller, amount_py_to_redeem);

            // Burn YT from caller
            self.erc20.burn(caller, amount_py_to_redeem);

            // Calculate SY to return: for simplicity, 1 PT + 1 YT = 1 SY
            let amount_sy = amount_py_to_redeem;

            // Transfer SY to receiver
            let sy = ISYDispatcher { contract_address: self.sy.read() };
            let success = sy.transfer(receiver, amount_sy);
            assert(success, Errors::YT_INSUFFICIENT_SY);

            self
                .emit(
                    RedeemPY {
                        caller,
                        receiver,
                        amount_py_redeemed: amount_py_to_redeem,
                        amount_sy_returned: amount_sy,
                    },
                );

            amount_sy
        }

        /// Redeem PT for SY after expiry (YT is worthless)
        /// @param receiver Address to receive the SY
        /// @param amount_pt Amount of PT to burn
        /// @return Amount of SY returned
        fn redeem_py_post_expiry(
            ref self: ContractState, receiver: ContractAddress, amount_pt: u256,
        ) -> u256 {
            assert(self.is_expired(), Errors::YT_NOT_EXPIRED);
            assert(!receiver.is_zero(), Errors::ZERO_ADDRESS);
            assert(amount_pt > 0, Errors::ZERO_AMOUNT);

            let caller = get_caller_address();

            // Update global PY index one last time
            self._update_py_index();

            // Burn PT from caller (no YT needed post-expiry)
            let pt = IPTDispatcher { contract_address: self.pt.read() };
            pt.burn(caller, amount_pt);

            // Calculate SY to return: 1 PT = 1 SY post-expiry
            let amount_sy = amount_pt;

            // Transfer SY to receiver
            let sy = ISYDispatcher { contract_address: self.sy.read() };
            let success = sy.transfer(receiver, amount_sy);
            assert(success, Errors::YT_INSUFFICIENT_SY);

            self
                .emit(
                    RedeemPYPostExpiry {
                        caller,
                        receiver,
                        amount_pt_redeemed: amount_pt,
                        amount_sy_returned: amount_sy,
                    },
                );

            amount_sy
        }

        /// Get current PY index (fetched from SY exchange rate)
        fn py_index_current(self: @ContractState) -> u256 {
            let sy = ISYDispatcher { contract_address: self.sy.read() };
            sy.exchange_rate()
        }

        /// Get stored PY index
        fn py_index_stored(self: @ContractState) -> u256 {
            self.py_index_stored.read()
        }

        /// Claim accrued interest for a user
        /// @param user Address to claim interest for
        /// @return Amount of SY claimed
        fn redeem_due_interest(ref self: ContractState, user: ContractAddress) -> u256 {
            // Update global index and user's interest
            self._update_py_index();
            self._update_user_interest(user);

            // Get and clear user's accrued interest
            let interest = self.user_interest.read(user);
            if interest == 0 {
                return 0;
            }

            self.user_interest.write(user, 0);

            // Transfer interest as SY to user
            let sy = ISYDispatcher { contract_address: self.sy.read() };
            let success = sy.transfer(user, interest);
            assert(success, Errors::YT_INSUFFICIENT_SY);

            self.emit(InterestClaimed { user, amount_sy: interest });

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
            // interest = yt_balance * (current_index - user_index) / user_index
            // Reordered to maximize precision: (yt_balance * index_diff) / user_index
            if current_index > user_index {
                let index_diff = current_index - user_index;
                let new_interest = wad_div(wad_mul(yt_balance, index_diff), user_index);
                accrued + new_interest
            } else {
                accrued
            }
        }
    }

    // Internal functions
    #[generate_trait]
    impl InternalImpl of InternalTrait {
        /// Update the global PY index from SY's exchange rate
        fn _update_py_index(ref self: ContractState) {
            let current_index = self.py_index_current();
            let stored_index = self.py_index_stored.read();

            // Index should only increase (watermark pattern)
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
                // interest = yt_balance * (current_index - user_index) / user_index
                // Reordered to maximize precision: (yt_balance * index_diff) / user_index
                let index_diff = current_index - user_index;
                let new_interest = wad_div(wad_mul(yt_balance, index_diff), user_index);

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
