use starknet::ContractAddress;

/// Standardized Yield (SY) Token
/// Wraps yield-bearing tokens into a standardized interface.
/// 1 SY represents 1 share of the underlying yield-bearing asset.
///
/// The exchange_rate can come from two sources:
/// 1. ERC-4626 vaults (like Nostra nstSTRK): Call convert_to_assets(WAD) directly
/// 2. Custom oracles: A separate oracle that implements IIndexOracle
///
/// Constructor takes an `index_oracle` parameter and `is_erc4626` flag:
/// - For ERC-4626 tokens: pass underlying address as oracle, set is_erc4626=true
/// - For custom oracles: pass oracle address, set is_erc4626=false
///
/// Architecture:
/// This contract uses the SYComponent for core SY logic (deposit, redeem, exchange rate)
/// and implements SYHooksTrait to bridge the component with ERC20 and other components.
#[starknet::contract]
pub mod SY {
    use core::num::traits::Zero;
    use horizon::components::sy_component::SYComponent;
    use horizon::interfaces::i_sy::{AssetType, ISY, ISYAdmin};
    use horizon::libraries::roles::{DEFAULT_ADMIN_ROLE, PAUSER_ROLE};
    use openzeppelin_access::accesscontrol::AccessControlComponent;
    use openzeppelin_access::ownable::OwnableComponent;
    use openzeppelin_interfaces::upgrades::IUpgradeable;
    use openzeppelin_introspection::src5::SRC5Component;
    use openzeppelin_security::pausable::PausableComponent;
    use openzeppelin_security::reentrancyguard::ReentrancyGuardComponent;
    use openzeppelin_token::erc20::{DefaultConfig, ERC20Component};
    use openzeppelin_upgrades::UpgradeableComponent;
    use starknet::storage::{StorageMapReadAccess, StoragePointerReadAccess};
    use starknet::{ClassHash, ContractAddress, get_caller_address};
    use super::{IERC20Dispatcher, IERC20DispatcherTrait};

    // Declare all components
    component!(path: ERC20Component, storage: erc20, event: ERC20Event);
    component!(path: SRC5Component, storage: src5, event: SRC5Event);
    component!(path: AccessControlComponent, storage: access_control, event: AccessControlEvent);
    component!(path: PausableComponent, storage: pausable, event: PausableEvent);
    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);
    component!(path: UpgradeableComponent, storage: upgradeable, event: UpgradeableEvent);
    component!(
        path: ReentrancyGuardComponent, storage: reentrancy_guard, event: ReentrancyGuardEvent,
    );
    component!(path: SYComponent, storage: sy, event: SYEvent);

    // Only use internal impl - do NOT embed ERC20MixinImpl to avoid duplicate entry points
    impl ERC20InternalImpl = ERC20Component::InternalImpl<ContractState>;
    impl AccessControlInternalImpl = AccessControlComponent::InternalImpl<ContractState>;
    impl PausableInternalImpl = PausableComponent::InternalImpl<ContractState>;
    impl OwnableInternalImpl = OwnableComponent::InternalImpl<ContractState>;
    impl UpgradeableInternalImpl = UpgradeableComponent::InternalImpl<ContractState>;
    impl ReentrancyGuardInternalImpl = ReentrancyGuardComponent::InternalImpl<ContractState>;

    // SY component internal impl with hooks
    // Note: SYHooksImpl is resolved by the compiler since it's in the same scope
    impl SYInternalImpl = SYComponent::InternalImpl<ContractState>;
    impl SYViewImpl = SYComponent::ViewImpl<ContractState>;

    /// Custom ERC20 hooks - enforce pausable on deposits and transfers
    ///
    /// When the contract is paused:
    /// - Deposits (mints) are blocked: from is zero address
    /// - Transfers are blocked: neither from nor to is zero
    /// - Redemptions (burns) are ALLOWED: to is zero address
    ///
    /// This ensures users can always exit their positions during emergencies.
    impl ERC20HooksImpl of ERC20Component::ERC20HooksTrait<ContractState> {
        fn before_update(
            ref self: ERC20Component::ComponentState<ContractState>,
            from: ContractAddress,
            recipient: ContractAddress,
            amount: u256,
        ) {
            // Allow burns (redemptions) even when paused - users must be able to exit
            // Burns have recipient == zero address
            if recipient.is_zero() {
                return;
            }

            // Block mints (deposits) and transfers when paused
            let contract = self.get_contract();
            contract.pausable.assert_not_paused();
        }

        fn after_update(
            ref self: ERC20Component::ComponentState<ContractState>,
            from: ContractAddress,
            recipient: ContractAddress,
            amount: u256,
        ) { // No additional logic needed after update
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
        upgradeable: UpgradeableComponent::Storage,
        #[substorage(v0)]
        reentrancy_guard: ReentrancyGuardComponent::Storage,
        #[substorage(v0)]
        sy: SYComponent::Storage,
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
        #[flat]
        ReentrancyGuardEvent: ReentrancyGuardComponent::Event,
        #[flat]
        SYEvent: SYComponent::Event,
    }

    /// Implement SYHooksTrait - bridge SYComponent to ERC20 and other components
    ///
    /// This is where the composition magic happens: the SY component calls these hooks
    /// and we delegate to the appropriate components (ERC20 for minting, pausable for checks, etc.)
    impl SYHooksImpl of SYComponent::SYHooksTrait<ContractState> {
        /// Mint SY tokens via ERC20 component
        fn mint_sy(ref self: ContractState, to: ContractAddress, amount: u256) {
            self.erc20.mint(to, amount);
        }

        /// Burn SY tokens via ERC20 component
        fn burn_sy(ref self: ContractState, from: ContractAddress, amount: u256) {
            self.erc20.burn(from, amount);
        }

        /// Get total SY supply from ERC20 component
        fn total_sy_supply(self: @ContractState) -> u256 {
            self.erc20.ERC20_total_supply.read()
        }

        /// Before deposit: check pausable state and start reentrancy guard
        fn before_deposit(ref self: ContractState, receiver: ContractAddress, amount: u256) {
            self.pausable.assert_not_paused();
            self.reentrancy_guard.start();
        }

        /// After deposit: end reentrancy guard
        /// In SYWithRewards, this would also update reward state
        fn after_deposit(ref self: ContractState, receiver: ContractAddress, sy_minted: u256) {
            self.reentrancy_guard.end();
        }

        /// Before redeem: start reentrancy guard (no pause check for redemptions)
        fn before_redeem(ref self: ContractState, receiver: ContractAddress, amount_sy: u256) {
            self.reentrancy_guard.start();
        }

        /// After redeem: end reentrancy guard
        /// In SYWithRewards, this would also update reward state
        fn after_redeem(ref self: ContractState, receiver: ContractAddress, amount_redeemed: u256) {
            self.reentrancy_guard.end();
        }
    }

    /// @param name SY token name
    /// @param symbol SY token symbol
    /// @param underlying The underlying yield-bearing token (ERC20)
    /// @param index_oracle The index source (same as underlying for ERC-4626, or oracle for
    /// bridged)
    /// @param is_erc4626 Whether the index_oracle is an ERC-4626 vault
    /// @param asset_type Asset classification (Token or Liquidity)
    /// @param pauser Address with PAUSER_ROLE for emergency pause
    /// @param tokens_in Valid tokens for deposit (must include underlying)
    /// @param tokens_out Valid tokens for redemption (must include underlying)
    #[constructor]
    fn constructor(
        ref self: ContractState,
        name: ByteArray,
        symbol: ByteArray,
        underlying: ContractAddress,
        index_oracle: ContractAddress,
        is_erc4626: bool,
        asset_type: AssetType,
        pauser: ContractAddress,
        tokens_in: Span<ContractAddress>,
        tokens_out: Span<ContractAddress>,
    ) {
        // Initialize ERC20
        self.erc20.initializer(name, symbol);

        // Initialize AccessControl and grant roles to pauser
        self.access_control.initializer();
        self.access_control._grant_role(DEFAULT_ADMIN_ROLE, pauser);
        self.access_control._grant_role(PAUSER_ROLE, pauser);

        // Initialize ownable for upgrade control
        self.ownable.initializer(pauser);

        // Initialize SY component
        self
            .sy
            .initializer(underlying, index_oracle, is_erc4626, asset_type, tokens_in, tokens_out);
    }

    #[abi(embed_v0)]
    impl SYImpl of ISY<ContractState> {
        fn name(self: @ContractState) -> ByteArray {
            self.erc20.ERC20_name.read()
        }

        fn symbol(self: @ContractState) -> ByteArray {
            self.erc20.ERC20_symbol.read()
        }

        fn decimals(self: @ContractState) -> u8 {
            let underlying_addr = self.sy.underlying.read();
            let underlying_token = IERC20Dispatcher { contract_address: underlying_addr };
            underlying_token.decimals()
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
            true
        }

        fn approve(ref self: ContractState, spender: ContractAddress, amount: u256) -> bool {
            let caller = get_caller_address();
            self.erc20._approve(caller, spender, amount);
            true
        }

        /// Deposit underlying yield-bearing tokens to mint SY
        /// Delegates to SYComponent
        fn deposit(
            ref self: ContractState,
            receiver: ContractAddress,
            amount_shares_to_deposit: u256,
            min_shares_out: u256,
        ) -> u256 {
            self.sy.deposit(receiver, amount_shares_to_deposit, min_shares_out)
        }

        /// Redeem SY for underlying yield-bearing tokens
        /// Delegates to SYComponent
        fn redeem(
            ref self: ContractState,
            receiver: ContractAddress,
            amount_sy_to_redeem: u256,
            min_token_out: u256,
            burn_from_internal_balance: bool,
        ) -> u256 {
            self.sy.redeem(receiver, amount_sy_to_redeem, min_token_out, burn_from_internal_balance)
        }

        /// Get the current exchange rate (assets per share in WAD)
        fn exchange_rate(self: @ContractState) -> u256 {
            self.sy.exchange_rate()
        }

        /// Get the underlying token address
        fn underlying_asset(self: @ContractState) -> ContractAddress {
            self.sy.underlying_asset()
        }

        /// Get all valid tokens that can be deposited to mint SY
        fn get_tokens_in(self: @ContractState) -> Span<ContractAddress> {
            self.sy.get_tokens_in()
        }

        /// Get all valid tokens that can be received when redeeming SY
        fn get_tokens_out(self: @ContractState) -> Span<ContractAddress> {
            self.sy.get_tokens_out()
        }

        /// Check if a token can be deposited to mint SY (O(1) lookup)
        fn is_valid_token_in(self: @ContractState, token: ContractAddress) -> bool {
            self.sy.is_valid_token_in(token)
        }

        /// Check if a token can be received when redeeming SY (O(1) lookup)
        fn is_valid_token_out(self: @ContractState, token: ContractAddress) -> bool {
            self.sy.is_valid_token_out(token)
        }

        /// Returns asset classification, underlying address, and decimals
        fn asset_info(self: @ContractState) -> (AssetType, ContractAddress, u8) {
            self.sy.asset_info()
        }

        /// Preview how much SY would be minted for a deposit (1:1)
        fn preview_deposit(self: @ContractState, amount_to_deposit: u256) -> u256 {
            self.sy.preview_deposit(amount_to_deposit)
        }

        /// Preview how much underlying would be returned for a redemption (1:1)
        fn preview_redeem(self: @ContractState, amount_sy: u256) -> u256 {
            self.sy.preview_redeem(amount_sy)
        }
    }

    #[abi(embed_v0)]
    impl SYAdminImpl of ISYAdmin<ContractState> {
        fn pause(ref self: ContractState) {
            self.access_control.assert_only_role(PAUSER_ROLE);
            self.pausable.pause();
        }

        fn unpause(ref self: ContractState) {
            self.access_control.assert_only_role(PAUSER_ROLE);
            self.pausable.unpause();
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

    // Internal functions - expose component internals for tests and other contracts
    #[generate_trait]
    pub impl InternalImpl of InternalTrait {
        /// Get the index oracle address
        fn get_index_oracle(self: @ContractState) -> ContractAddress {
            self.sy.get_index_oracle()
        }

        /// Check if this SY uses an ERC-4626 vault for exchange rate
        fn get_is_erc4626(self: @ContractState) -> bool {
            self.sy.get_is_erc4626()
        }
    }
}

// Interface for calling external ERC20 tokens
#[starknet::interface]
pub trait IERC20<TContractState> {
    fn decimals(self: @TContractState) -> u8;
    fn transfer(ref self: TContractState, recipient: ContractAddress, amount: u256) -> bool;
    fn transfer_from(
        ref self: TContractState, sender: ContractAddress, recipient: ContractAddress, amount: u256,
    ) -> bool;
    fn approve(ref self: TContractState, spender: ContractAddress, amount: u256) -> bool;
    fn balance_of(self: @TContractState, account: ContractAddress) -> u256;
}
