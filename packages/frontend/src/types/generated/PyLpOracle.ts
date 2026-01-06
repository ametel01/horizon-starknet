export const PYLPORACLE_ABI = [
  {
    type: 'impl',
    name: 'PyLpOracleImpl',
    interface_name: 'horizon::interfaces::i_py_lp_oracle::IPyLpOracle',
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
    type: 'struct',
    name: 'horizon::interfaces::i_py_lp_oracle::OracleReadinessState',
    members: [
      {
        name: 'increase_cardinality_required',
        type: 'core::bool',
      },
      {
        name: 'cardinality_required',
        type: 'core::integer::u16',
      },
      {
        name: 'oldest_observation_satisfied',
        type: 'core::bool',
      },
    ],
  },
  {
    type: 'interface',
    name: 'horizon::interfaces::i_py_lp_oracle::IPyLpOracle',
    items: [
      {
        type: 'function',
        name: 'get_pt_to_sy_rate',
        inputs: [
          {
            name: 'market',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'duration',
            type: 'core::integer::u32',
          },
        ],
        outputs: [
          {
            type: 'core::integer::u256',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'get_yt_to_sy_rate',
        inputs: [
          {
            name: 'market',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'duration',
            type: 'core::integer::u32',
          },
        ],
        outputs: [
          {
            type: 'core::integer::u256',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'get_lp_to_sy_rate',
        inputs: [
          {
            name: 'market',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'duration',
            type: 'core::integer::u32',
          },
        ],
        outputs: [
          {
            type: 'core::integer::u256',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'get_pt_to_asset_rate',
        inputs: [
          {
            name: 'market',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'duration',
            type: 'core::integer::u32',
          },
        ],
        outputs: [
          {
            type: 'core::integer::u256',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'get_yt_to_asset_rate',
        inputs: [
          {
            name: 'market',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'duration',
            type: 'core::integer::u32',
          },
        ],
        outputs: [
          {
            type: 'core::integer::u256',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'get_lp_to_asset_rate',
        inputs: [
          {
            name: 'market',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'duration',
            type: 'core::integer::u32',
          },
        ],
        outputs: [
          {
            type: 'core::integer::u256',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'check_oracle_state',
        inputs: [
          {
            name: 'market',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'duration',
            type: 'core::integer::u32',
          },
        ],
        outputs: [
          {
            type: 'horizon::interfaces::i_py_lp_oracle::OracleReadinessState',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'get_ln_implied_rate_twap',
        inputs: [
          {
            name: 'market',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'duration',
            type: 'core::integer::u32',
          },
        ],
        outputs: [
          {
            type: 'core::integer::u256',
          },
        ],
        state_mutability: 'view',
      },
    ],
  },
  {
    type: 'constructor',
    name: 'constructor',
    inputs: [],
  },
  {
    type: 'event',
    name: 'horizon::oracles::py_lp_oracle::PyLpOracle::Event',
    kind: 'enum',
    variants: [],
  },
] as const;
