export const MARKETFACTORY_ABI = [
  {
    type: 'impl',
    name: 'MarketFactoryImpl',
    interface_name: 'horizon::interfaces::i_market_factory::IMarketFactory',
  },
  {
    type: 'struct',
    name: 'core::integer::u256',
    members: [
      {
        name: 'low',
        type: 'core::integer::u128',
      },
      {
        name: 'high',
        type: 'core::integer::u128',
      },
    ],
  },
  {
    type: 'enum',
    name: 'core::bool',
    variants: [
      {
        name: 'False',
        type: '()',
      },
      {
        name: 'True',
        type: '()',
      },
    ],
  },
  {
    type: 'interface',
    name: 'horizon::interfaces::i_market_factory::IMarketFactory',
    items: [
      {
        type: 'function',
        name: 'create_market',
        inputs: [
          {
            name: 'pt',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'scalar_root',
            type: 'core::integer::u256',
          },
          {
            name: 'initial_anchor',
            type: 'core::integer::u256',
          },
          {
            name: 'fee_rate',
            type: 'core::integer::u256',
          },
        ],
        outputs: [
          {
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'get_market',
        inputs: [
          {
            name: 'pt',
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        outputs: [
          {
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'is_valid_market',
        inputs: [
          {
            name: 'market',
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        outputs: [
          {
            type: 'core::bool',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'market_class_hash',
        inputs: [],
        outputs: [
          {
            type: 'core::starknet::class_hash::ClassHash',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'get_market_count',
        inputs: [],
        outputs: [
          {
            type: 'core::integer::u32',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'get_all_markets',
        inputs: [],
        outputs: [
          {
            type: 'core::array::Array::<core::starknet::contract_address::ContractAddress>',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'get_market_at',
        inputs: [
          {
            name: 'index',
            type: 'core::integer::u32',
          },
        ],
        outputs: [
          {
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        state_mutability: 'view',
      },
    ],
  },
  {
    type: 'constructor',
    name: 'constructor',
    inputs: [
      {
        name: 'market_class_hash',
        type: 'core::starknet::class_hash::ClassHash',
      },
    ],
  },
  {
    type: 'event',
    name: 'horizon::market::market_factory::MarketFactory::MarketCreated',
    kind: 'struct',
    members: [
      {
        name: 'pt',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
      {
        name: 'market',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'data',
      },
      {
        name: 'creator',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'data',
      },
      {
        name: 'scalar_root',
        type: 'core::integer::u256',
        kind: 'data',
      },
      {
        name: 'initial_anchor',
        type: 'core::integer::u256',
        kind: 'data',
      },
      {
        name: 'fee_rate',
        type: 'core::integer::u256',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'horizon::market::market_factory::MarketFactory::Event',
    kind: 'enum',
    variants: [
      {
        name: 'MarketCreated',
        type: 'horizon::market::market_factory::MarketFactory::MarketCreated',
        kind: 'nested',
      },
    ],
  },
] as const;
