export const ROUTERSTATIC_ABI = [
  {
    type: 'impl',
    name: 'RouterStaticImpl',
    interface_name: 'horizon::interfaces::i_router_static::IRouterStatic',
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
    name: 'horizon::interfaces::i_router_static::MarketInfo',
    members: [
      {
        name: 'sy',
        type: 'core::starknet::contract_address::ContractAddress',
      },
      {
        name: 'pt',
        type: 'core::starknet::contract_address::ContractAddress',
      },
      {
        name: 'yt',
        type: 'core::starknet::contract_address::ContractAddress',
      },
      {
        name: 'expiry',
        type: 'core::integer::u64',
      },
      {
        name: 'is_expired',
        type: 'core::bool',
      },
      {
        name: 'sy_reserve',
        type: 'core::integer::u256',
      },
      {
        name: 'pt_reserve',
        type: 'core::integer::u256',
      },
      {
        name: 'total_lp',
        type: 'core::integer::u256',
      },
      {
        name: 'ln_implied_rate',
        type: 'core::integer::u256',
      },
      {
        name: 'pt_to_sy_rate',
        type: 'core::integer::u256',
      },
      {
        name: 'lp_to_sy_rate',
        type: 'core::integer::u256',
      },
      {
        name: 'scalar_root',
        type: 'core::integer::u256',
      },
      {
        name: 'ln_fee_rate_root',
        type: 'core::integer::u256',
      },
    ],
  },
  {
    type: 'struct',
    name: 'horizon::interfaces::i_router_static::TokenToSyEstimate',
    members: [
      {
        name: 'token',
        type: 'core::starknet::contract_address::ContractAddress',
      },
      {
        name: 'amount',
        type: 'core::integer::u256',
      },
      {
        name: 'estimated_sy_amount',
        type: 'core::integer::u256',
      },
    ],
  },
  {
    type: 'interface',
    name: 'horizon::interfaces::i_router_static::IRouterStatic',
    items: [
      {
        type: 'function',
        name: 'get_pt_to_sy_rate',
        inputs: [
          {
            name: 'market',
            type: 'core::starknet::contract_address::ContractAddress',
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
        name: 'get_lp_to_pt_rate',
        inputs: [
          {
            name: 'market',
            type: 'core::starknet::contract_address::ContractAddress',
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
        name: 'preview_swap_exact_sy_for_pt',
        inputs: [
          {
            name: 'market',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'sy_in',
            type: 'core::integer::u256',
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
        name: 'preview_swap_exact_pt_for_sy',
        inputs: [
          {
            name: 'market',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'pt_in',
            type: 'core::integer::u256',
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
        name: 'preview_add_liquidity_single_sy',
        inputs: [
          {
            name: 'market',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'sy_in',
            type: 'core::integer::u256',
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
        name: 'preview_remove_liquidity_single_sy',
        inputs: [
          {
            name: 'market',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'lp_in',
            type: 'core::integer::u256',
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
        name: 'get_market_info',
        inputs: [
          {
            name: 'market',
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        outputs: [
          {
            type: 'horizon::interfaces::i_router_static::MarketInfo',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'preview_swap_exact_token_for_pt',
        inputs: [
          {
            name: 'market',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'estimate',
            type: 'horizon::interfaces::i_router_static::TokenToSyEstimate',
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
        name: 'preview_add_liquidity_single_token',
        inputs: [
          {
            name: 'market',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'estimate',
            type: 'horizon::interfaces::i_router_static::TokenToSyEstimate',
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
    name: 'horizon::router_static::RouterStatic::Event',
    kind: 'enum',
    variants: [],
  },
] as const;
