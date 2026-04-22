/// RewardManagerComponent - Reusable component for reward token accounting
///
/// This component tracks reward distributions for SY holders using a global index model:
/// - When rewards arrive, the global index increases proportionally to total supply
/// - Each user's accrued rewards = user_balance * (global_index - user_index)
/// - Users can claim their accrued rewards at any time
///
/// Architecture:
/// ```
/// ┌─────────────────────────────────────────────────────────────────┐
/// │                     SYWithRewards Contract                       │
/// │  ┌──────────────┐
/// ┌──────────────────┐
/// ┌─────────────────┐   │
/// │  │ ERC20Comp    │  │ RewardManager    │  │ SYComponent     │   │
/// │  │              │  │ Component        │  │                 │   │
/// │  │ - balances   │──►- reward_tokens   │  │ - deposit()     │   │
/// │  │ - supply     │  │ - reward_index   │  │ - redeem()      │   │
/// │  │              │  │ - user_accrued   │  │                 │   │
/// │  └──────────────┘  │ - claim_rewards()│
/// └─────────────────┘   │
/// │         ▲          └──────────────────┘
/// │
/// │         │                  │                                    │
/// │         │   RewardHooks    │                                    │
/// │         └──────────────────┘
/// │
/// │  impl RewardHooksImpl: user_sy_balance() → self.erc20.balance() │
/// └─────────────────────────────────────────────────────────────────┘
/// ```
///
/// The hooks pattern allows the RewardManager to query balances without
/// knowing about the ERC20 component directly.
use starknet::ContractAddress;

/// Interface for calling external ERC20 reward tokens
#[starknet::interface]
pub trait IERC20Reward<TContractState> {
    fn transfer(ref self: TContractState, recipient: ContractAddress, amount: u256) -> bool;
    fn balance_of(self: @TContractState, account: ContractAddress) -> u256;
}

#[starknet::component]
pub mod RewardManagerComponent {
    use core::num::traits::Zero;
    use horizon::libraries::errors::Errors;
    use horizon::libraries::math_fp::WAD;
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };
    use starknet::{ContractAddress, get_block_timestamp, get_contract_address};
    use super::{IERC20RewardDispatcher, IERC20RewardDispatcherTrait};

    /// Component storage - reward token tracking and accounting
    #[storage]
    pub struct Storage {
        /// Reward tokens list: index -> token address
        pub reward_tokens: Map<u32, ContractAddress>,
        /// Number of reward tokens registered
        pub reward_tokens_count: u32,
        /// O(1) lookup for registered reward tokens
        pub is_reward_token: Map<ContractAddress, bool>,
        /// Global reward index per token (scaled by WAD)
        /// Represents cumulative rewards per SY share
        pub reward_index: Map<ContractAddress, u256>,
        /// Last known balance of each reward token in this contract
        /// Used to detect incoming rewards
        pub reward_last_balance: Map<ContractAddress, u256>,
        /// User's last checkpointed index per token: (user, token) -> index
        pub user_reward_index: Map<(ContractAddress, ContractAddress), u256>,
        /// User's accrued (unclaimed) rewards per token: (user, token) -> amount
        pub user_accrued: Map<(ContractAddress, ContractAddress), u256>,
    }

    /// Component events
    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        RewardsClaimed: RewardsClaimed,
        RewardIndexUpdated: RewardIndexUpdated,
        RewardTokenAdded: RewardTokenAdded,
    }

    /// Emitted when a user claims their accrued rewards
    #[derive(Drop, starknet::Event)]
    pub struct RewardsClaimed {
        #[key]
        pub user: ContractAddress,
        #[key]
        pub reward_token: ContractAddress,
        pub amount: u256,
        pub timestamp: u64,
    }

    /// Emitted when the global reward index is updated (new rewards detected)
    #[derive(Drop, starknet::Event)]
    pub struct RewardIndexUpdated {
        #[key]
        pub reward_token: ContractAddress,
        pub old_index: u256,
        pub new_index: u256,
        pub rewards_added: u256,
        pub total_supply: u256,
        pub timestamp: u64,
    }

    /// Emitted when a new reward token is registered
    #[derive(Drop, starknet::Event)]
    pub struct RewardTokenAdded {
        #[key]
        pub reward_token: ContractAddress,
        pub index: u32,
        pub timestamp: u64,
    }

    /// Hooks trait - contracts MUST implement to provide balance information
    ///
    /// This trait enables loose coupling: the RewardManager doesn't know about
    /// the ERC20 component directly, but the containing contract bridges them.
    pub trait RewardHooksTrait<TContractState> {
        /// Get user's SY balance (for reward calculation)
        fn user_sy_balance(self: @TContractState, user: ContractAddress) -> u256;

        /// Get total SY supply (for global index calculation)
        fn total_sy_supply(self: @TContractState) -> u256;
    }

    /// Internal implementation - core reward tracking logic
    #[generate_trait]
    pub impl InternalImpl<
        TContractState,
        +HasComponent<TContractState>,
        +Drop<TContractState>,
        impl Hooks: RewardHooksTrait<TContractState>,
    > of InternalTrait<TContractState> {
        /// Initialize the RewardManager with a list of reward tokens
        /// Called from contract constructor
        ///
        /// @param reward_tokens Initial reward tokens to track
        fn initializer(
            ref self: ComponentState<TContractState>, reward_tokens: Span<ContractAddress>,
        ) {
            // Validate at least one reward token
            assert(reward_tokens.len() > 0, Errors::REWARD_EMPTY_TOKENS);

            let mut i: u32 = 0;
            for token in reward_tokens {
                assert(!(*token).is_zero(), Errors::ZERO_ADDRESS);

                // Register the reward token
                self.reward_tokens.write(i, *token);
                self.is_reward_token.write(*token, true);

                // Initialize index to WAD (so first rewards are distributed from zero)
                self.reward_index.write(*token, WAD);

                // Get initial balance (might have pre-existing rewards)
                let token_dispatcher = IERC20RewardDispatcher { contract_address: *token };
                let initial_balance = token_dispatcher.balance_of(get_contract_address());
                self.reward_last_balance.write(*token, initial_balance);

                self
                    .emit(
                        RewardTokenAdded {
                            reward_token: *token, index: i, timestamp: get_block_timestamp(),
                        },
                    );

                i += 1;
            }
            self.reward_tokens_count.write(i);
        }

        /// Update rewards for two users (called on ERC20 transfers)
        /// This should be called BEFORE the balance change occurs
        ///
        /// @param user1 First user address (can be zero for mint)
        /// @param user2 Second user address (can be zero for burn)
        fn update_rewards_for_two(
            ref self: ComponentState<TContractState>,
            user1: ContractAddress,
            user2: ContractAddress,
        ) {
            // First update global index to account for any new rewards
            self._update_global_reward_index();

            // Update user1's accrued rewards (if not zero address)
            if !user1.is_zero() {
                self._update_user_rewards(user1);
            }

            // Update user2's accrued rewards (if not zero and different from user1)
            if !user2.is_zero() && user1 != user2 {
                self._update_user_rewards(user2);
            }
        }

        /// Update a single user's rewards
        /// Useful for after_deposit/after_redeem hooks
        ///
        /// @param user User address to update
        fn update_user_rewards(ref self: ComponentState<TContractState>, user: ContractAddress) {
            if user.is_zero() {
                return;
            }
            self._update_global_reward_index();
            self._update_user_rewards(user);
        }

        /// Claim all accrued rewards for a user
        /// Updates global index and user rewards before claiming
        ///
        /// @param user Address to claim rewards for
        /// @return Array of claimed amounts (one per reward token, in order)
        fn claim_rewards(
            ref self: ComponentState<TContractState>, user: ContractAddress,
        ) -> Span<u256> {
            assert(!user.is_zero(), Errors::ZERO_ADDRESS);

            // Update to latest state before claiming
            self._update_global_reward_index();
            self._update_user_rewards(user);

            let count = self.reward_tokens_count.read();
            let mut amounts: Array<u256> = array![];
            let mut i: u32 = 0;

            while i < count {
                let token = self.reward_tokens.read(i);
                let accrued = self.user_accrued.read((user, token));

                if accrued > 0 {
                    // Clear user's accrued balance
                    self.user_accrued.write((user, token), 0);

                    // Update last_balance to reflect outgoing transfer
                    let last_balance = self.reward_last_balance.read(token);
                    self.reward_last_balance.write(token, last_balance - accrued);

                    // Transfer rewards to user
                    let token_dispatcher = IERC20RewardDispatcher { contract_address: token };
                    let success = token_dispatcher.transfer(user, accrued);
                    assert(success, Errors::REWARD_TRANSFER_FAILED);

                    self
                        .emit(
                            RewardsClaimed {
                                user,
                                reward_token: token,
                                amount: accrued,
                                timestamp: get_block_timestamp(),
                            },
                        );
                }

                amounts.append(accrued);
                i += 1;
            }

            amounts.span()
        }

        /// Check for new rewards and update global index
        /// Called internally before any user-level updates
        fn _update_global_reward_index(ref self: ComponentState<TContractState>) {
            let contract = self.get_contract();
            let total_supply = Hooks::total_sy_supply(contract);

            // Can't distribute rewards if no supply exists
            if total_supply == 0 {
                return;
            }

            let count = self.reward_tokens_count.read();
            let mut i: u32 = 0;

            while i < count {
                let token = self.reward_tokens.read(i);
                let token_dispatcher = IERC20RewardDispatcher { contract_address: token };

                // Get current balance in contract
                let current_balance = token_dispatcher.balance_of(get_contract_address());
                let last_balance = self.reward_last_balance.read(token);

                // If balance increased, new rewards have arrived
                if current_balance > last_balance {
                    let new_rewards = current_balance - last_balance;
                    let old_index = self.reward_index.read(token);

                    // index += new_rewards * WAD / total_supply
                    // This distributes rewards proportionally to all current holders
                    let index_delta = (new_rewards * WAD) / total_supply;
                    let new_index = old_index + index_delta;

                    self.reward_index.write(token, new_index);
                    self.reward_last_balance.write(token, current_balance);

                    self
                        .emit(
                            RewardIndexUpdated {
                                reward_token: token,
                                old_index,
                                new_index,
                                rewards_added: new_rewards,
                                total_supply,
                                timestamp: get_block_timestamp(),
                            },
                        );
                }

                i += 1;
            };
        }

        /// Update user's accrued rewards based on current global index
        /// Should only be called after _update_global_reward_index
        fn _update_user_rewards(ref self: ComponentState<TContractState>, user: ContractAddress) {
            let contract = self.get_contract();
            let user_balance = Hooks::user_sy_balance(contract, user);

            let count = self.reward_tokens_count.read();
            let mut i: u32 = 0;

            while i < count {
                let token = self.reward_tokens.read(i);
                let global_index = self.reward_index.read(token);
                let user_index = self.user_reward_index.read((user, token));

                // If user has never interacted, initialize their index to current global
                // (they don't get retroactive rewards)
                if user_index == 0 {
                    self.user_reward_index.write((user, token), global_index);
                } else if global_index > user_index {
                    // Calculate newly accrued rewards:
                    // new_accrued = user_balance * (global_index - user_index) / WAD
                    let index_delta = global_index - user_index;
                    let new_accrued = (user_balance * index_delta) / WAD;

                    if new_accrued > 0 {
                        let current_accrued = self.user_accrued.read((user, token));
                        self.user_accrued.write((user, token), current_accrued + new_accrued);
                    }

                    // Update user's checkpoint to current global index
                    self.user_reward_index.write((user, token), global_index);
                }

                i += 1;
            };
        }
    }

    /// View functions implementation
    #[generate_trait]
    pub impl ViewImpl<TContractState, +HasComponent<TContractState>> of ViewTrait<TContractState> {
        /// Get all registered reward tokens
        fn get_reward_tokens(self: @ComponentState<TContractState>) -> Span<ContractAddress> {
            let count = self.reward_tokens_count.read();
            let mut tokens: Array<ContractAddress> = array![];
            let mut i: u32 = 0;
            while i < count {
                tokens.append(self.reward_tokens.read(i));
                i += 1;
            }
            tokens.span()
        }

        /// Get user's accrued (unclaimed) rewards for all tokens
        /// Note: Does not include pending rewards from unreflected index updates
        /// Call claim_rewards to get the exact claimable amount
        fn accrued_rewards(
            self: @ComponentState<TContractState>, user: ContractAddress,
        ) -> Span<u256> {
            let count = self.reward_tokens_count.read();
            let mut amounts: Array<u256> = array![];
            let mut i: u32 = 0;
            while i < count {
                let token = self.reward_tokens.read(i);
                amounts.append(self.user_accrued.read((user, token)));
                i += 1;
            }
            amounts.span()
        }

        /// Get the current global reward index for a specific token
        fn reward_index(self: @ComponentState<TContractState>, token: ContractAddress) -> u256 {
            self.reward_index.read(token)
        }

        /// Get user's reward index for a specific token
        fn user_reward_index(
            self: @ComponentState<TContractState>, user: ContractAddress, token: ContractAddress,
        ) -> u256 {
            self.user_reward_index.read((user, token))
        }

        /// Check if a token is registered as a reward token
        fn is_reward_token(self: @ComponentState<TContractState>, token: ContractAddress) -> bool {
            self.is_reward_token.read(token)
        }

        /// Get the number of registered reward tokens
        fn reward_tokens_count(self: @ComponentState<TContractState>) -> u32 {
            self.reward_tokens_count.read()
        }
    }
}
