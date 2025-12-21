use starknet::ContractAddress;

/// Principal Token (PT)
/// Represents the principal portion of a yield-bearing asset.
/// PT can be redeemed for the underlying SY at or after expiry.
/// PT + YT = 1 SY (before expiry)

/// Interface for PT initialization (separate from IPT)
#[starknet::interface]
pub trait IPTInit<TContractState> {
    fn initialize_yt(ref self: TContractState, yt: ContractAddress);
}

#[starknet::contract]
pub mod PT {
    use core::num::traits::Zero;
    use horizon::interfaces::i_pt::{IPT, IPTAdmin};
    use horizon::libraries::errors::Errors;
    use horizon::libraries::roles::{DEFAULT_ADMIN_ROLE, PAUSER_ROLE};
    use openzeppelin_access::accesscontrol::AccessControlComponent;
    use openzeppelin_access::ownable::OwnableComponent;
    use openzeppelin_interfaces::upgrades::IUpgradeable;
    use openzeppelin_introspection::src5::SRC5Component;
    use openzeppelin_security::pausable::PausableComponent;
    use openzeppelin_token::erc20::{DefaultConfig, ERC20Component, ERC20HooksEmptyImpl};
    use openzeppelin_upgrades::UpgradeableComponent;
    use starknet::storage::{
        StorageMapReadAccess, StoragePointerReadAccess, StoragePointerWriteAccess,
    };
    use starknet::{ClassHash, ContractAddress, get_block_timestamp, get_caller_address};

    component!(path: ERC20Component, storage: erc20, event: ERC20Event);
    component!(path: SRC5Component, storage: src5, event: SRC5Event);
    component!(path: AccessControlComponent, storage: access_control, event: AccessControlEvent);
    component!(path: PausableComponent, storage: pausable, event: PausableEvent);
    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);
    component!(path: UpgradeableComponent, storage: upgradeable, event: UpgradeableEvent);

    // Only use internal impl - we implement our own IPT interface
    impl ERC20InternalImpl = ERC20Component::InternalImpl<ContractState>;
    impl AccessControlInternalImpl = AccessControlComponent::InternalImpl<ContractState>;
    impl PausableInternalImpl = PausableComponent::InternalImpl<ContractState>;
    impl OwnableInternalImpl = OwnableComponent::InternalImpl<ContractState>;
    impl UpgradeableInternalImpl = UpgradeableComponent::InternalImpl<ContractState>;

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
        // The SY token this PT is derived from
        sy: ContractAddress,
        // The corresponding YT contract (only YT can mint/burn PT)
        yt: ContractAddress,
        // Expiry timestamp (Unix seconds)
        expiry: u64,
        // The deployer address (YT contract) - can only be set once
        deployer: ContractAddress,
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
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        name: ByteArray,
        symbol: ByteArray,
        sy: ContractAddress,
        expiry: u64,
        pauser: ContractAddress,
    ) {
        // Initialize ERC20
        self.erc20.initializer(name, symbol);

        // Initialize AccessControl and grant roles to pauser
        self.access_control.initializer();
        self.access_control._grant_role(DEFAULT_ADMIN_ROLE, pauser);
        self.access_control._grant_role(PAUSER_ROLE, pauser);

        // Initialize ownable for upgrade control
        self.ownable.initializer(pauser);

        // Initialize PT state
        assert(!sy.is_zero(), Errors::ZERO_ADDRESS);
        assert(expiry > get_block_timestamp(), Errors::PT_INVALID_EXPIRY);

        self.sy.write(sy);
        self.expiry.write(expiry);
        // Store deployer (the YT contract) to restrict initialize_yt access
        self.deployer.write(get_caller_address());
        // YT address will be set after deployment via initialize_yt
    // This is because YT deploys PT, so PT doesn't know YT's address at construction
    }

    #[abi(embed_v0)]
    impl PTImpl of IPT<ContractState> {
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

        /// Get the SY token address
        fn sy(self: @ContractState) -> ContractAddress {
            self.sy.read()
        }

        /// Get the YT token address
        fn yt(self: @ContractState) -> ContractAddress {
            self.yt.read()
        }

        /// Get the expiry timestamp
        fn expiry(self: @ContractState) -> u64 {
            self.expiry.read()
        }

        /// Check if the PT has expired
        fn is_expired(self: @ContractState) -> bool {
            get_block_timestamp() >= self.expiry.read()
        }

        /// Mint PT tokens - only callable by YT contract
        fn mint(ref self: ContractState, to: ContractAddress, amount: u256) {
            // Check not paused - mint operations can be paused in emergency
            self.pausable.assert_not_paused();
            self.assert_only_yt();
            assert(!to.is_zero(), Errors::ZERO_ADDRESS);
            self.erc20.mint(to, amount);
        }

        /// Burn PT tokens - only callable by YT contract
        fn burn(ref self: ContractState, from: ContractAddress, amount: u256) {
            self.assert_only_yt();
            self.erc20.burn(from, amount);
        }
    }

    // External initialization function (separate from IPT interface)
    #[abi(embed_v0)]
    impl PTInitImpl of super::IPTInit<ContractState> {
        /// Initialize the YT address - only callable by deployer (the YT contract)
        /// This prevents front-running attacks where an attacker could set themselves as YT
        fn initialize_yt(ref self: ContractState, yt: ContractAddress) {
            // Only the deployer (YT contract) can initialize
            assert(get_caller_address() == self.deployer.read(), Errors::PT_ONLY_DEPLOYER);
            assert(self.yt.read().is_zero(), Errors::PT_YT_ALREADY_SET);
            assert(!yt.is_zero(), Errors::ZERO_ADDRESS);
            self.yt.write(yt);
        }
    }

    #[abi(embed_v0)]
    impl PTAdminImpl of IPTAdmin<ContractState> {
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

    // Internal functions
    #[generate_trait]
    pub impl InternalImpl of InternalTrait {
        /// Assert that caller is the YT contract
        fn assert_only_yt(self: @ContractState) {
            let caller = get_caller_address();
            let yt = self.yt.read();
            assert(!yt.is_zero(), Errors::PT_YT_NOT_SET);
            assert(caller == yt, Errors::PT_ONLY_YT);
        }
    }
}
