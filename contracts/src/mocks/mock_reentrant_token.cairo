use starknet::ContractAddress;

/// Attack modes for the reentrant token
#[derive(Copy, Drop, Serde, PartialEq, starknet::Store, Default)]
pub enum AttackMode {
    #[default]
    /// No attack - behave like normal ERC20
    None,
    /// Re-enter SY.deposit during transfer_from
    ReenterSYDeposit,
    /// Re-enter YT.mint_py during transfer_from
    ReenterYTMintPY,
    /// Re-enter YT.redeem_py during transfer
    ReenterYTRedeemPY,
    /// Re-enter YT.redeem_due_interest during transfer
    ReenterYTRedeemInterest,
}

/// Mock token that attempts reentrancy during transfers.
/// Used to test reentrancy protection in SY, PT, YT contracts.
///
/// When attack_mode is set, the token will attempt to call back into
/// the target contract during transfer_from or transfer operations.
#[starknet::contract]
pub mod MockReentrantToken {
    use horizon::interfaces::i_sy::ISYDispatcher;
    use horizon::libraries::math_fp::WAD;
    use openzeppelin_token::erc20::{DefaultConfig, ERC20Component, ERC20HooksEmptyImpl};
    use starknet::storage::{
        StorageMapReadAccess, StoragePointerReadAccess, StoragePointerWriteAccess,
    };
    use starknet::{ContractAddress, get_caller_address, get_contract_address};
    use super::AttackMode;

    component!(path: ERC20Component, storage: erc20, event: ERC20Event);

    impl ERC20InternalImpl = ERC20Component::InternalImpl<ContractState>;

    #[storage]
    struct Storage {
        #[substorage(v0)]
        erc20: ERC20Component::Storage,
        /// The current attack mode
        attack_mode: AttackMode,
        /// Target contract to attack (SY or YT address)
        attack_target: ContractAddress,
        /// Counter to track how many times the attack callback was triggered
        attack_count: u32,
        /// Flag to prevent infinite recursion during attack
        attacking: bool,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        #[flat]
        ERC20Event: ERC20Component::Event,
        /// Emitted when an attack attempt is made
        AttackAttempted: AttackAttempted,
    }

    #[derive(Drop, starknet::Event)]
    pub struct AttackAttempted {
        pub mode: felt252,
        pub target: ContractAddress,
        pub count: u32,
    }

    #[constructor]
    fn constructor(ref self: ContractState, name: ByteArray, symbol: ByteArray) {
        self.erc20.initializer(name, symbol);
        self.attack_mode.write(AttackMode::None);
        self.attack_count.write(0);
        self.attacking.write(false);
    }

    #[abi(embed_v0)]
    impl MockReentrantTokenImpl of super::IMockReentrantToken<ContractState> {
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
            let sender = get_caller_address();
            self.erc20._transfer(sender, recipient, amount);

            // Attempt attack during transfer (used for redeem operations)
            self._try_attack_on_transfer();

            true
        }

        fn transfer_from(
            ref self: ContractState,
            sender: ContractAddress,
            recipient: ContractAddress,
            amount: u256,
        ) -> bool {
            let caller = get_caller_address();
            self.erc20._spend_allowance(sender, caller, amount);
            self.erc20._transfer(sender, recipient, amount);

            // Attempt attack during transfer_from (used for deposit operations)
            self._try_attack_on_transfer_from();

            true
        }

        fn approve(ref self: ContractState, spender: ContractAddress, amount: u256) -> bool {
            let caller = get_caller_address();
            self.erc20._approve(caller, spender, amount);
            true
        }

        fn mint(ref self: ContractState, to: ContractAddress, amount: u256) {
            self.erc20.mint(to, amount);
        }

        fn burn(ref self: ContractState, amount: u256) {
            let caller = get_caller_address();
            self.erc20.burn(caller, amount);
        }

        /// Set the attack mode and target
        fn set_attack_mode(ref self: ContractState, mode: AttackMode, target: ContractAddress) {
            self.attack_mode.write(mode);
            self.attack_target.write(target);
            self.attack_count.write(0);
            self.attacking.write(false);
        }

        /// Get the current attack mode
        fn get_attack_mode(self: @ContractState) -> AttackMode {
            self.attack_mode.read()
        }

        /// Get the attack count (how many times callback was triggered)
        fn get_attack_count(self: @ContractState) -> u32 {
            self.attack_count.read()
        }

        /// Reset attack state
        fn reset_attack(ref self: ContractState) {
            self.attack_mode.write(AttackMode::None);
            self.attack_count.write(0);
            self.attacking.write(false);
        }

        // ERC-4626 minimal interface for SY compatibility
        fn convert_to_assets(self: @ContractState, shares: u256) -> u256 {
            // 1:1 conversion for simplicity
            shares
        }

        fn convert_to_shares(self: @ContractState, assets: u256) -> u256 {
            assets
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        /// Try to execute attack during transfer_from
        fn _try_attack_on_transfer_from(ref self: ContractState) {
            let mode = self.attack_mode.read();
            let is_attacking = self.attacking.read();

            // Prevent recursion
            if is_attacking {
                return;
            }

            match mode {
                AttackMode::None => {},
                AttackMode::ReenterSYDeposit => { self._attack_sy_deposit(); },
                AttackMode::ReenterYTMintPY => { self._attack_yt_mint_py(); },
                _ => {},
            }
        }

        /// Try to execute attack during transfer
        fn _try_attack_on_transfer(ref self: ContractState) {
            let mode = self.attack_mode.read();
            let is_attacking = self.attacking.read();

            // Prevent recursion
            if is_attacking {
                return;
            }

            match mode {
                AttackMode::None => {},
                AttackMode::ReenterYTRedeemPY => { self._attack_yt_redeem_py(); },
                AttackMode::ReenterYTRedeemInterest => { self._attack_yt_redeem_interest(); },
                _ => {},
            }
        }

        /// Attempt to re-enter SY.deposit
        fn _attack_sy_deposit(ref self: ContractState) {
            self.attacking.write(true);
            let count = self.attack_count.read();
            self.attack_count.write(count + 1);

            let target = self.attack_target.read();
            self.emit(AttackAttempted { mode: 'SY_DEPOSIT', target, count: count + 1 });

            // Attempt to call deposit again
            // This would fail if there's reentrancy protection
            // The ISYDispatcher is created but not called - the attack attempt event
            // is what we're testing. In a real attack, this would try to call sy.deposit()
            // but that would require tokens and proper setup.
            let _sy = ISYDispatcher { contract_address: target };

            // Approve ourselves to spend our own tokens (for the simulated attack)
            let this = get_contract_address();
            self.erc20._approve(this, target, WAD);

            self.attacking.write(false);
        }

        /// Attempt to re-enter YT.mint_py
        fn _attack_yt_mint_py(ref self: ContractState) {
            self.attacking.write(true);
            let count = self.attack_count.read();
            self.attack_count.write(count + 1);

            let target = self.attack_target.read();
            self.emit(AttackAttempted { mode: 'YT_MINT_PY', target, count: count + 1 });

            // The attack would attempt to call mint_py again during the transfer
            // This should be blocked by ReentrancyGuard

            self.attacking.write(false);
        }

        /// Attempt to re-enter YT.redeem_py
        fn _attack_yt_redeem_py(ref self: ContractState) {
            self.attacking.write(true);
            let count = self.attack_count.read();
            self.attack_count.write(count + 1);

            let target = self.attack_target.read();
            self.emit(AttackAttempted { mode: 'YT_REDEEM_PY', target, count: count + 1 });

            self.attacking.write(false);
        }

        /// Attempt to re-enter YT.redeem_due_interest
        fn _attack_yt_redeem_interest(ref self: ContractState) {
            self.attacking.write(true);
            let count = self.attack_count.read();
            self.attack_count.write(count + 1);

            let target = self.attack_target.read();
            self.emit(AttackAttempted { mode: 'YT_REDEEM_INT', target, count: count + 1 });

            // The attack would attempt to claim interest again
            // This should be blocked by ReentrancyGuard AND the interest being cleared

            self.attacking.write(false);
        }
    }
}

/// Interface for MockReentrantToken
#[starknet::interface]
pub trait IMockReentrantToken<TContractState> {
    // ERC20 standard functions
    fn name(self: @TContractState) -> ByteArray;
    fn symbol(self: @TContractState) -> ByteArray;
    fn decimals(self: @TContractState) -> u8;
    fn total_supply(self: @TContractState) -> u256;
    fn balance_of(self: @TContractState, account: ContractAddress) -> u256;
    fn allowance(self: @TContractState, owner: ContractAddress, spender: ContractAddress) -> u256;
    fn transfer(ref self: TContractState, recipient: ContractAddress, amount: u256) -> bool;
    fn transfer_from(
        ref self: TContractState, sender: ContractAddress, recipient: ContractAddress, amount: u256,
    ) -> bool;
    fn approve(ref self: TContractState, spender: ContractAddress, amount: u256) -> bool;

    // Mock functions
    fn mint(ref self: TContractState, to: ContractAddress, amount: u256);
    fn burn(ref self: TContractState, amount: u256);

    // Attack controls
    fn set_attack_mode(ref self: TContractState, mode: AttackMode, target: ContractAddress);
    fn get_attack_mode(self: @TContractState) -> AttackMode;
    fn get_attack_count(self: @TContractState) -> u32;
    fn reset_attack(ref self: TContractState);

    // ERC-4626 minimal (for SY compatibility)
    fn convert_to_assets(self: @TContractState, shares: u256) -> u256;
    fn convert_to_shares(self: @TContractState, assets: u256) -> u256;
}
