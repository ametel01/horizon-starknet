use starknet::ContractAddress;

/// Time constants
const SECONDS_PER_DAY: u64 = 86400; // 24 hours
/// Mint amount per call: 100 tokens (18 decimals)
const MINT_AMOUNT: u256 = 100_000000000000000000;

/// Faucet contract for distributing mock yield tokens on mainnet
/// Allows users to mint 100 tokens per day per address (one call per day)
/// Uses OpenZeppelin Ownable for access control
#[starknet::contract]
pub mod Faucet {
    use openzeppelin_access::ownable::OwnableComponent;
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };
    use starknet::{ContractAddress, get_block_timestamp, get_caller_address};
    use super::{
        IMockYieldTokenDispatcher, IMockYieldTokenDispatcherTrait, MINT_AMOUNT, SECONDS_PER_DAY,
    };

    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);

    // Ownable
    #[abi(embed_v0)]
    impl OwnableImpl = OwnableComponent::OwnableImpl<ContractState>;
    impl OwnableInternalImpl = OwnableComponent::InternalImpl<ContractState>;

    #[storage]
    struct Storage {
        #[substorage(v0)]
        ownable: OwnableComponent::Storage,
        // The mock yield token this faucet distributes
        token: ContractAddress,
        // Track if address has minted today
        // Key: (address, day_number) -> has minted
        has_minted_today: Map<(ContractAddress, u64), bool>,
        // Track if faucet is paused
        paused: bool,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        #[flat]
        OwnableEvent: OwnableComponent::Event,
        Minted: Minted,
        Paused: Paused,
        Unpaused: Unpaused,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Minted {
        #[key]
        pub recipient: ContractAddress,
        pub day: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Paused {}

    #[derive(Drop, starknet::Event)]
    pub struct Unpaused {}

    #[constructor]
    fn constructor(ref self: ContractState, token: ContractAddress, owner: ContractAddress) {
        self.ownable.initializer(owner);
        self.token.write(token);
        self.paused.write(false);
    }

    #[abi(embed_v0)]
    impl FaucetImpl of super::IFaucet<ContractState> {
        /// Mint 100 tokens to the caller (once per day)
        fn mint(ref self: ContractState) {
            assert(!self.paused.read(), 'Faucet: paused');

            let caller = get_caller_address();
            let current_day = self._get_current_day();

            // Check if already minted today
            assert(
                !self.has_minted_today.read((caller, current_day)), 'Faucet: already minted today',
            );

            // Mark as minted for today
            self.has_minted_today.write((caller, current_day), true);

            // Mint tokens to caller via the mock yield token
            let token = IMockYieldTokenDispatcher { contract_address: self.token.read() };
            token.mint_shares(caller, MINT_AMOUNT);

            self.emit(Minted { recipient: caller, day: current_day });
        }

        /// Get the token address this faucet distributes
        fn token(self: @ContractState) -> ContractAddress {
            self.token.read()
        }

        /// Get the mint amount (100 tokens)
        fn mint_amount(self: @ContractState) -> u256 {
            MINT_AMOUNT
        }

        /// Check if an address can mint today
        fn can_mint(self: @ContractState, account: ContractAddress) -> bool {
            let current_day = self._get_current_day();
            !self.has_minted_today.read((account, current_day))
        }

        /// Check if an address has minted today
        fn has_minted_today(self: @ContractState, account: ContractAddress) -> bool {
            let current_day = self._get_current_day();
            self.has_minted_today.read((account, current_day))
        }

        /// Get current day number (for tracking)
        fn current_day(self: @ContractState) -> u64 {
            self._get_current_day()
        }

        /// Check if faucet is paused
        fn is_paused(self: @ContractState) -> bool {
            self.paused.read()
        }

        // ============ Owner Functions ============

        /// Pause the faucet (owner only)
        fn pause(ref self: ContractState) {
            self.ownable.assert_only_owner();
            self.paused.write(true);
            self.emit(Paused {});
        }

        /// Unpause the faucet (owner only)
        fn unpause(ref self: ContractState) {
            self.ownable.assert_only_owner();
            self.paused.write(false);
            self.emit(Unpaused {});
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        /// Get the current day number (timestamp / seconds_per_day)
        fn _get_current_day(self: @ContractState) -> u64 {
            get_block_timestamp() / SECONDS_PER_DAY
        }
    }
}

/// Interface for the Faucet contract
#[starknet::interface]
pub trait IFaucet<TContractState> {
    // User functions
    fn mint(ref self: TContractState);
    fn token(self: @TContractState) -> ContractAddress;
    fn mint_amount(self: @TContractState) -> u256;
    fn can_mint(self: @TContractState, account: ContractAddress) -> bool;
    fn has_minted_today(self: @TContractState, account: ContractAddress) -> bool;
    fn current_day(self: @TContractState) -> u64;
    fn is_paused(self: @TContractState) -> bool;

    // Owner functions
    fn pause(ref self: TContractState);
    fn unpause(ref self: TContractState);
}

/// Interface for calling MockYieldToken's mint_shares
#[starknet::interface]
pub trait IMockYieldToken<TContractState> {
    fn mint_shares(ref self: TContractState, to: ContractAddress, shares: u256);
}
