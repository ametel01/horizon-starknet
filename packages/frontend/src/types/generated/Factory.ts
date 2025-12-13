export const FACTORY_ABI = [
  {
    type: 'impl',
    name: 'FactoryImpl',
    interface_name: 'horizon::interfaces::i_factory::IFactory',
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
    name: 'horizon::interfaces::i_factory::IFactory',
    items: [
      {
        type: 'function',
        name: 'create_yield_contracts',
        inputs: [
          {
            name: 'sy',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'expiry',
            type: 'core::integer::u64',
          },
        ],
        outputs: [
          {
            type: '(core::starknet::contract_address::ContractAddress, core::starknet::contract_address::ContractAddress)',
          },
        ],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'get_pt',
        inputs: [
          {
            name: 'sy',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'expiry',
            type: 'core::integer::u64',
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
        name: 'get_yt',
        inputs: [
          {
            name: 'sy',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'expiry',
            type: 'core::integer::u64',
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
        name: 'is_valid_pt',
        inputs: [
          {
            name: 'pt',
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
        name: 'is_valid_yt',
        inputs: [
          {
            name: 'yt',
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
    ],
  },
  {
    type: 'constructor',
    name: 'constructor',
    inputs: [
      {
        name: 'yt_class_hash',
        type: 'core::starknet::class_hash::ClassHash',
      },
      {
        name: 'pt_class_hash',
        type: 'core::starknet::class_hash::ClassHash',
      },
    ],
  },
  {
    type: 'event',
    name: 'horizon::factory::Factory::YieldContractsCreated',
    kind: 'struct',
    members: [
      {
        name: 'sy',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
      {
        name: 'expiry',
        type: 'core::integer::u64',
        kind: 'key',
      },
      {
        name: 'pt',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'data',
      },
      {
        name: 'yt',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'data',
      },
      {
        name: 'creator',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'horizon::factory::Factory::Event',
    kind: 'enum',
    variants: [
      {
        name: 'YieldContractsCreated',
        type: 'horizon::factory::Factory::YieldContractsCreated',
        kind: 'nested',
      },
    ],
  },
] as const;
