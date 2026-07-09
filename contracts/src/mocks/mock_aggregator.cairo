use starknet::ContractAddress;

/// Mock aggregator contract for testing token routing without external dependencies.
/// Allows configuring exchange rates between token pairs for deterministic testing.
#[starknet::contract]
pub mod MockAggregator {
    use horizon::interfaces::i_aggregator_router::IAggregatorRouter;
    use horizon::libraries::math::WAD;
    use horizon::mocks::mock_erc20::{IMockERC20Dispatcher, IMockERC20DispatcherTrait};
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess};
    use starknet::{ContractAddress, get_caller_address, get_contract_address};

    #[storage]
    struct Storage {
        /// Exchange rates: (token_in, token_out) => rate in WAD
        /// rate represents how many token_out per 1 token_in (scaled by WAD)
        exchange_rates: Map<(ContractAddress, ContractAddress), u256>,
        /// Test-only override for aggregators that report one amount and deliver another
        lie_enabled: Map<(ContractAddress, ContractAddress), bool>,
        reported_amounts: Map<(ContractAddress, ContractAddress), u256>,
        delivered_amounts: Map<(ContractAddress, ContractAddress), u256>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        ExchangeRateSet: ExchangeRateSet,
        Swap: Swap,
    }

    #[derive(Drop, starknet::Event)]
    pub struct ExchangeRateSet {
        #[key]
        pub token_in: ContractAddress,
        #[key]
        pub token_out: ContractAddress,
        pub rate: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Swap {
        #[key]
        pub token_in: ContractAddress,
        #[key]
        pub token_out: ContractAddress,
        pub amount_in: u256,
        pub amount_out: u256,
        pub receiver: ContractAddress,
    }

    #[constructor]
    fn constructor(ref self: ContractState) { // No initialization needed
    }

    #[abi(embed_v0)]
    impl MockAggregatorImpl of super::IMockAggregator<ContractState> {
        /// Set the exchange rate for a token pair
        /// @param token_in Input token address
        /// @param token_out Output token address
        /// @param rate Exchange rate in WAD (amount_out = amount_in * rate / WAD)
        fn set_exchange_rate(
            ref self: ContractState,
            token_in: ContractAddress,
            token_out: ContractAddress,
            rate: u256,
        ) {
            self.exchange_rates.write((token_in, token_out), rate);
            self.emit(ExchangeRateSet { token_in, token_out, rate });
        }

        /// Get the exchange rate for a token pair
        /// @param token_in Input token address
        /// @param token_out Output token address
        /// @return Exchange rate in WAD (0 if not set)
        fn get_exchange_rate(
            self: @ContractState, token_in: ContractAddress, token_out: ContractAddress,
        ) -> u256 {
            self.exchange_rates.read((token_in, token_out))
        }

        /// Configure a dishonest output for tests.
        /// The aggregator returns reported_amount but only mints delivered_amount.
        fn set_reported_output(
            ref self: ContractState,
            token_in: ContractAddress,
            token_out: ContractAddress,
            reported_amount: u256,
            delivered_amount: u256,
        ) {
            self.lie_enabled.write((token_in, token_out), true);
            self.reported_amounts.write((token_in, token_out), reported_amount);
            self.delivered_amounts.write((token_in, token_out), delivered_amount);
        }
    }

    #[abi(embed_v0)]
    impl AggregatorRouterImpl of IAggregatorRouter<ContractState> {
        /// Execute a token swap through the mock aggregator
        /// Uses configured exchange rates to calculate output amount.
        /// Transfers tokens from caller and mints output tokens to receiver.
        ///
        /// @param token_in Address of the input token to swap from
        /// @param token_out Address of the output token to swap to
        /// @param amount_in Amount of input tokens to swap
        /// @param min_amount_out Minimum output tokens to receive (slippage protection)
        /// @param receiver Address to receive the output tokens
        /// @param calldata Additional calldata (ignored in mock)
        /// @return Amount of output tokens received
        fn swap(
            ref self: ContractState,
            token_in: ContractAddress,
            token_out: ContractAddress,
            amount_in: u256,
            min_amount_out: u256,
            receiver: ContractAddress,
            calldata: Span<felt252>,
        ) -> u256 {
            // Silence unused variable warning
            let _ = calldata;
            // Look up the configured exchange rate
            let (reported_amount, delivered_amount) = if self
                .lie_enabled
                .read((token_in, token_out)) {
                (
                    self.reported_amounts.read((token_in, token_out)),
                    self.delivered_amounts.read((token_in, token_out)),
                )
            } else {
                let rate = self.exchange_rates.read((token_in, token_out));
                assert(rate > 0, 'MockAggregator: rate not set');

                // Calculate output amount: amount_out = amount_in * rate / WAD
                let amount_out = (amount_in * rate) / WAD;
                (amount_out, amount_out)
            };
            assert(reported_amount >= min_amount_out, 'MockAggregator: slippage');

            let caller = get_caller_address();
            let this = get_contract_address();

            // Transfer input tokens from caller to this contract
            let token_in_dispatcher = IMockERC20Dispatcher { contract_address: token_in };
            token_in_dispatcher.transfer_from(caller, this, amount_in);

            // Mint output tokens to receiver (mock behavior - simulates swap)
            let token_out_dispatcher = IMockERC20Dispatcher { contract_address: token_out };
            if delivered_amount > 0 {
                token_out_dispatcher.mint(receiver, delivered_amount);
            }

            self
                .emit(
                    Swap { token_in, token_out, amount_in, amount_out: reported_amount, receiver },
                );

            reported_amount
        }
    }
}

/// Interface for MockAggregator configuration
#[starknet::interface]
pub trait IMockAggregator<TContractState> {
    /// Set the exchange rate for a token pair
    fn set_exchange_rate(
        ref self: TContractState, token_in: ContractAddress, token_out: ContractAddress, rate: u256,
    );

    /// Get the exchange rate for a token pair
    fn get_exchange_rate(
        self: @TContractState, token_in: ContractAddress, token_out: ContractAddress,
    ) -> u256;

    /// Configure a dishonest output for tests.
    fn set_reported_output(
        ref self: TContractState,
        token_in: ContractAddress,
        token_out: ContractAddress,
        reported_amount: u256,
        delivered_amount: u256,
    );
}
