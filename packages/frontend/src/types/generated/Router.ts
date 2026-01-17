export const ROUTER_ABI = [
  {
    type: 'impl',
    name: 'UpgradeableImpl',
    interface_name: 'openzeppelin_interfaces::upgrades::IUpgradeable',
  },
  {
    type: 'interface',
    name: 'openzeppelin_interfaces::upgrades::IUpgradeable',
    items: [
      {
        type: 'function',
        name: 'upgrade',
        inputs: [
          {
            name: 'new_class_hash',
            type: 'core::starknet::class_hash::ClassHash',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
    ],
  },
  {
    type: 'impl',
    name: 'RouterImpl',
    interface_name: 'horizon::interfaces::i_router::IRouter',
  },
  {
    type: 'struct',
    name: 'core::array::Span::<core::felt252>',
    members: [
      {
        name: 'snapshot',
        type: '@core::array::Array::<core::felt252>',
      },
    ],
  },
  {
    type: 'struct',
    name: 'horizon::interfaces::i_router::Call',
    members: [
      {
        name: 'to',
        type: 'core::starknet::contract_address::ContractAddress',
      },
      {
        name: 'selector',
        type: 'core::felt252',
      },
      {
        name: 'calldata',
        type: 'core::array::Span::<core::felt252>',
      },
    ],
  },
  {
    type: 'struct',
    name: 'core::array::Span::<horizon::interfaces::i_router::Call>',
    members: [
      {
        name: 'snapshot',
        type: '@core::array::Array::<horizon::interfaces::i_router::Call>',
      },
    ],
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
    type: 'struct',
    name: 'horizon::interfaces::i_router::ApproxParams',
    members: [
      {
        name: 'guess_min',
        type: 'core::integer::u256',
      },
      {
        name: 'guess_max',
        type: 'core::integer::u256',
      },
      {
        name: 'guess_offchain',
        type: 'core::integer::u256',
      },
      {
        name: 'max_iteration',
        type: 'core::integer::u256',
      },
      {
        name: 'eps',
        type: 'core::integer::u256',
      },
    ],
  },
  {
    type: 'struct',
    name: 'core::array::Span::<core::starknet::contract_address::ContractAddress>',
    members: [
      {
        name: 'snapshot',
        type: '@core::array::Array::<core::starknet::contract_address::ContractAddress>',
      },
    ],
  },
  {
    type: 'struct',
    name: 'core::array::Span::<core::integer::u256>',
    members: [
      {
        name: 'snapshot',
        type: '@core::array::Array::<core::integer::u256>',
      },
    ],
  },
  {
    type: 'struct',
    name: 'horizon::interfaces::i_router::SwapData',
    members: [
      {
        name: 'aggregator',
        type: 'core::starknet::contract_address::ContractAddress',
      },
      {
        name: 'calldata',
        type: 'core::array::Span::<core::felt252>',
      },
    ],
  },
  {
    type: 'struct',
    name: 'horizon::interfaces::i_router::TokenInput',
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
        name: 'swap_data',
        type: 'horizon::interfaces::i_router::SwapData',
      },
    ],
  },
  {
    type: 'struct',
    name: 'horizon::interfaces::i_router::TokenOutput',
    members: [
      {
        name: 'token',
        type: 'core::starknet::contract_address::ContractAddress',
      },
      {
        name: 'min_amount',
        type: 'core::integer::u256',
      },
      {
        name: 'swap_data',
        type: 'horizon::interfaces::i_router::SwapData',
      },
    ],
  },
  {
    type: 'interface',
    name: 'horizon::interfaces::i_router::IRouter',
    items: [
      {
        type: 'function',
        name: 'multicall',
        inputs: [
          {
            name: 'calls',
            type: 'core::array::Span::<horizon::interfaces::i_router::Call>',
          },
        ],
        outputs: [
          {
            type: 'core::array::Array::<core::array::Span::<core::felt252>>',
          },
        ],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'pause',
        inputs: [],
        outputs: [],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'unpause',
        inputs: [],
        outputs: [],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'initialize_rbac',
        inputs: [],
        outputs: [],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'mint_py_from_sy',
        inputs: [
          {
            name: 'yt',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'receiver',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'amount_sy_in',
            type: 'core::integer::u256',
          },
          {
            name: 'min_py_out',
            type: 'core::integer::u256',
          },
          {
            name: 'deadline',
            type: 'core::integer::u64',
          },
        ],
        outputs: [
          {
            type: '(core::integer::u256, core::integer::u256)',
          },
        ],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'redeem_py_to_sy',
        inputs: [
          {
            name: 'yt',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'receiver',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'amount_py_in',
            type: 'core::integer::u256',
          },
          {
            name: 'min_sy_out',
            type: 'core::integer::u256',
          },
          {
            name: 'deadline',
            type: 'core::integer::u64',
          },
        ],
        outputs: [
          {
            type: 'core::integer::u256',
          },
        ],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'redeem_pt_post_expiry',
        inputs: [
          {
            name: 'yt',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'receiver',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'amount_pt_in',
            type: 'core::integer::u256',
          },
          {
            name: 'min_sy_out',
            type: 'core::integer::u256',
          },
          {
            name: 'deadline',
            type: 'core::integer::u64',
          },
        ],
        outputs: [
          {
            type: 'core::integer::u256',
          },
        ],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'add_liquidity',
        inputs: [
          {
            name: 'market',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'receiver',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'sy_desired',
            type: 'core::integer::u256',
          },
          {
            name: 'pt_desired',
            type: 'core::integer::u256',
          },
          {
            name: 'min_lp_out',
            type: 'core::integer::u256',
          },
          {
            name: 'deadline',
            type: 'core::integer::u64',
          },
        ],
        outputs: [
          {
            type: '(core::integer::u256, core::integer::u256, core::integer::u256)',
          },
        ],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'remove_liquidity',
        inputs: [
          {
            name: 'market',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'receiver',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'lp_to_burn',
            type: 'core::integer::u256',
          },
          {
            name: 'min_sy_out',
            type: 'core::integer::u256',
          },
          {
            name: 'min_pt_out',
            type: 'core::integer::u256',
          },
          {
            name: 'deadline',
            type: 'core::integer::u64',
          },
        ],
        outputs: [
          {
            type: '(core::integer::u256, core::integer::u256)',
          },
        ],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'add_liquidity_single_sy',
        inputs: [
          {
            name: 'market',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'receiver',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'amount_sy_in',
            type: 'core::integer::u256',
          },
          {
            name: 'min_lp_out',
            type: 'core::integer::u256',
          },
          {
            name: 'deadline',
            type: 'core::integer::u64',
          },
        ],
        outputs: [
          {
            type: '(core::integer::u256, core::integer::u256, core::integer::u256)',
          },
        ],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'add_liquidity_single_sy_with_approx',
        inputs: [
          {
            name: 'market',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'receiver',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'amount_sy_in',
            type: 'core::integer::u256',
          },
          {
            name: 'min_lp_out',
            type: 'core::integer::u256',
          },
          {
            name: 'approx',
            type: 'horizon::interfaces::i_router::ApproxParams',
          },
          {
            name: 'deadline',
            type: 'core::integer::u64',
          },
        ],
        outputs: [
          {
            type: '(core::integer::u256, core::integer::u256, core::integer::u256)',
          },
        ],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'add_liquidity_single_pt',
        inputs: [
          {
            name: 'market',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'receiver',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'amount_pt_in',
            type: 'core::integer::u256',
          },
          {
            name: 'min_lp_out',
            type: 'core::integer::u256',
          },
          {
            name: 'deadline',
            type: 'core::integer::u64',
          },
        ],
        outputs: [
          {
            type: '(core::integer::u256, core::integer::u256, core::integer::u256)',
          },
        ],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'remove_liquidity_single_sy',
        inputs: [
          {
            name: 'market',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'receiver',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'lp_to_burn',
            type: 'core::integer::u256',
          },
          {
            name: 'min_sy_out',
            type: 'core::integer::u256',
          },
          {
            name: 'deadline',
            type: 'core::integer::u64',
          },
        ],
        outputs: [
          {
            type: 'core::integer::u256',
          },
        ],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'remove_liquidity_single_pt',
        inputs: [
          {
            name: 'market',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'receiver',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'lp_to_burn',
            type: 'core::integer::u256',
          },
          {
            name: 'min_pt_out',
            type: 'core::integer::u256',
          },
          {
            name: 'deadline',
            type: 'core::integer::u64',
          },
        ],
        outputs: [
          {
            type: 'core::integer::u256',
          },
        ],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'swap_exact_sy_for_pt',
        inputs: [
          {
            name: 'market',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'receiver',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'exact_sy_in',
            type: 'core::integer::u256',
          },
          {
            name: 'min_pt_out',
            type: 'core::integer::u256',
          },
          {
            name: 'deadline',
            type: 'core::integer::u64',
          },
        ],
        outputs: [
          {
            type: 'core::integer::u256',
          },
        ],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'swap_exact_sy_for_pt_with_approx',
        inputs: [
          {
            name: 'market',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'receiver',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'exact_sy_in',
            type: 'core::integer::u256',
          },
          {
            name: 'min_pt_out',
            type: 'core::integer::u256',
          },
          {
            name: 'approx',
            type: 'horizon::interfaces::i_router::ApproxParams',
          },
          {
            name: 'deadline',
            type: 'core::integer::u64',
          },
        ],
        outputs: [
          {
            type: 'core::integer::u256',
          },
        ],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'swap_exact_pt_for_sy',
        inputs: [
          {
            name: 'market',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'receiver',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'exact_pt_in',
            type: 'core::integer::u256',
          },
          {
            name: 'min_sy_out',
            type: 'core::integer::u256',
          },
          {
            name: 'deadline',
            type: 'core::integer::u64',
          },
        ],
        outputs: [
          {
            type: 'core::integer::u256',
          },
        ],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'swap_sy_for_exact_pt',
        inputs: [
          {
            name: 'market',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'receiver',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'exact_pt_out',
            type: 'core::integer::u256',
          },
          {
            name: 'max_sy_in',
            type: 'core::integer::u256',
          },
          {
            name: 'deadline',
            type: 'core::integer::u64',
          },
        ],
        outputs: [
          {
            type: 'core::integer::u256',
          },
        ],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'swap_pt_for_exact_sy',
        inputs: [
          {
            name: 'market',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'receiver',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'exact_sy_out',
            type: 'core::integer::u256',
          },
          {
            name: 'max_pt_in',
            type: 'core::integer::u256',
          },
          {
            name: 'deadline',
            type: 'core::integer::u64',
          },
        ],
        outputs: [
          {
            type: 'core::integer::u256',
          },
        ],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'mint_py_and_keep',
        inputs: [
          {
            name: 'yt',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'market',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'receiver',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'amount_sy_in',
            type: 'core::integer::u256',
          },
          {
            name: 'min_pt_out',
            type: 'core::integer::u256',
          },
          {
            name: 'deadline',
            type: 'core::integer::u64',
          },
        ],
        outputs: [
          {
            type: '(core::integer::u256, core::integer::u256)',
          },
        ],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'buy_pt_from_sy',
        inputs: [
          {
            name: 'market',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'receiver',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'amount_sy_in',
            type: 'core::integer::u256',
          },
          {
            name: 'min_pt_out',
            type: 'core::integer::u256',
          },
          {
            name: 'deadline',
            type: 'core::integer::u64',
          },
        ],
        outputs: [
          {
            type: 'core::integer::u256',
          },
        ],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'sell_pt_for_sy',
        inputs: [
          {
            name: 'market',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'receiver',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'amount_pt_in',
            type: 'core::integer::u256',
          },
          {
            name: 'min_sy_out',
            type: 'core::integer::u256',
          },
          {
            name: 'deadline',
            type: 'core::integer::u64',
          },
        ],
        outputs: [
          {
            type: 'core::integer::u256',
          },
        ],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'swap_exact_sy_for_yt',
        inputs: [
          {
            name: 'yt',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'market',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'receiver',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'exact_sy_in',
            type: 'core::integer::u256',
          },
          {
            name: 'min_yt_out',
            type: 'core::integer::u256',
          },
          {
            name: 'deadline',
            type: 'core::integer::u64',
          },
        ],
        outputs: [
          {
            type: 'core::integer::u256',
          },
        ],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'swap_exact_yt_for_sy',
        inputs: [
          {
            name: 'yt',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'market',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'receiver',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'exact_yt_in',
            type: 'core::integer::u256',
          },
          {
            name: 'max_sy_collateral',
            type: 'core::integer::u256',
          },
          {
            name: 'min_sy_out',
            type: 'core::integer::u256',
          },
          {
            name: 'deadline',
            type: 'core::integer::u64',
          },
        ],
        outputs: [
          {
            type: 'core::integer::u256',
          },
        ],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'rollover_lp',
        inputs: [
          {
            name: 'market_old',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'market_new',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'lp_to_rollover',
            type: 'core::integer::u256',
          },
          {
            name: 'min_lp_out',
            type: 'core::integer::u256',
          },
          {
            name: 'deadline',
            type: 'core::integer::u64',
          },
        ],
        outputs: [
          {
            type: 'core::integer::u256',
          },
        ],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'redeem_due_interest_and_rewards',
        inputs: [
          {
            name: 'user',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'yts',
            type: 'core::array::Span::<core::starknet::contract_address::ContractAddress>',
          },
          {
            name: 'markets',
            type: 'core::array::Span::<core::starknet::contract_address::ContractAddress>',
          },
        ],
        outputs: [
          {
            type: '(core::integer::u256, core::array::Array::<core::array::Span::<core::integer::u256>>)',
          },
        ],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'swap_exact_token_for_pt',
        inputs: [
          {
            name: 'market',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'receiver',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'input',
            type: 'horizon::interfaces::i_router::TokenInput',
          },
          {
            name: 'min_pt_out',
            type: 'core::integer::u256',
          },
          {
            name: 'deadline',
            type: 'core::integer::u64',
          },
        ],
        outputs: [
          {
            type: 'core::integer::u256',
          },
        ],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'swap_exact_pt_for_token',
        inputs: [
          {
            name: 'market',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'receiver',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'exact_pt_in',
            type: 'core::integer::u256',
          },
          {
            name: 'output',
            type: 'horizon::interfaces::i_router::TokenOutput',
          },
          {
            name: 'deadline',
            type: 'core::integer::u64',
          },
        ],
        outputs: [
          {
            type: 'core::integer::u256',
          },
        ],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'swap_exact_token_for_yt',
        inputs: [
          {
            name: 'yt',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'market',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'receiver',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'input',
            type: 'horizon::interfaces::i_router::TokenInput',
          },
          {
            name: 'min_yt_out',
            type: 'core::integer::u256',
          },
          {
            name: 'deadline',
            type: 'core::integer::u64',
          },
        ],
        outputs: [
          {
            type: 'core::integer::u256',
          },
        ],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'swap_exact_yt_for_token',
        inputs: [
          {
            name: 'yt',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'market',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'receiver',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'exact_yt_in',
            type: 'core::integer::u256',
          },
          {
            name: 'max_sy_collateral',
            type: 'core::integer::u256',
          },
          {
            name: 'output',
            type: 'horizon::interfaces::i_router::TokenOutput',
          },
          {
            name: 'deadline',
            type: 'core::integer::u64',
          },
        ],
        outputs: [
          {
            type: 'core::integer::u256',
          },
        ],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'add_liquidity_single_token',
        inputs: [
          {
            name: 'market',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'receiver',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'input',
            type: 'horizon::interfaces::i_router::TokenInput',
          },
          {
            name: 'min_lp_out',
            type: 'core::integer::u256',
          },
          {
            name: 'deadline',
            type: 'core::integer::u64',
          },
        ],
        outputs: [
          {
            type: '(core::integer::u256, core::integer::u256, core::integer::u256)',
          },
        ],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'add_liquidity_single_token_keep_yt',
        inputs: [
          {
            name: 'market',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'receiver',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'input',
            type: 'horizon::interfaces::i_router::TokenInput',
          },
          {
            name: 'min_lp_out',
            type: 'core::integer::u256',
          },
          {
            name: 'min_yt_out',
            type: 'core::integer::u256',
          },
          {
            name: 'deadline',
            type: 'core::integer::u64',
          },
        ],
        outputs: [
          {
            type: '(core::integer::u256, core::integer::u256)',
          },
        ],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'remove_liquidity_single_token',
        inputs: [
          {
            name: 'market',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'receiver',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'lp_to_burn',
            type: 'core::integer::u256',
          },
          {
            name: 'output',
            type: 'horizon::interfaces::i_router::TokenOutput',
          },
          {
            name: 'deadline',
            type: 'core::integer::u64',
          },
        ],
        outputs: [
          {
            type: 'core::integer::u256',
          },
        ],
        state_mutability: 'external',
      },
    ],
  },
  {
    type: 'impl',
    name: 'OwnableImpl',
    interface_name: 'openzeppelin_interfaces::access::ownable::IOwnable',
  },
  {
    type: 'interface',
    name: 'openzeppelin_interfaces::access::ownable::IOwnable',
    items: [
      {
        type: 'function',
        name: 'owner',
        inputs: [],
        outputs: [
          {
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'transfer_ownership',
        inputs: [
          {
            name: 'new_owner',
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'renounce_ownership',
        inputs: [],
        outputs: [],
        state_mutability: 'external',
      },
    ],
  },
  {
    type: 'impl',
    name: 'AccessControlImpl',
    interface_name: 'openzeppelin_interfaces::access::accesscontrol::IAccessControl',
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
    name: 'openzeppelin_interfaces::access::accesscontrol::IAccessControl',
    items: [
      {
        type: 'function',
        name: 'has_role',
        inputs: [
          {
            name: 'role',
            type: 'core::felt252',
          },
          {
            name: 'account',
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
        name: 'get_role_admin',
        inputs: [
          {
            name: 'role',
            type: 'core::felt252',
          },
        ],
        outputs: [
          {
            type: 'core::felt252',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'grant_role',
        inputs: [
          {
            name: 'role',
            type: 'core::felt252',
          },
          {
            name: 'account',
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'revoke_role',
        inputs: [
          {
            name: 'role',
            type: 'core::felt252',
          },
          {
            name: 'account',
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'renounce_role',
        inputs: [
          {
            name: 'role',
            type: 'core::felt252',
          },
          {
            name: 'account',
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
    ],
  },
  {
    type: 'impl',
    name: 'PausableImpl',
    interface_name: 'openzeppelin_interfaces::security::pausable::IPausable',
  },
  {
    type: 'interface',
    name: 'openzeppelin_interfaces::security::pausable::IPausable',
    items: [
      {
        type: 'function',
        name: 'is_paused',
        inputs: [],
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
        name: 'owner',
        type: 'core::starknet::contract_address::ContractAddress',
      },
    ],
  },
  {
    type: 'event',
    name: 'horizon::router::Router::MintPY',
    kind: 'struct',
    members: [
      {
        name: 'sender',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
      {
        name: 'receiver',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
      {
        name: 'yt',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'data',
      },
      {
        name: 'sy_in',
        type: 'core::integer::u256',
        kind: 'data',
      },
      {
        name: 'pt_out',
        type: 'core::integer::u256',
        kind: 'data',
      },
      {
        name: 'yt_out',
        type: 'core::integer::u256',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'horizon::router::Router::RedeemPY',
    kind: 'struct',
    members: [
      {
        name: 'sender',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
      {
        name: 'receiver',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
      {
        name: 'yt',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'data',
      },
      {
        name: 'py_in',
        type: 'core::integer::u256',
        kind: 'data',
      },
      {
        name: 'sy_out',
        type: 'core::integer::u256',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'horizon::router::Router::AddLiquidity',
    kind: 'struct',
    members: [
      {
        name: 'sender',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
      {
        name: 'receiver',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
      {
        name: 'market',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'data',
      },
      {
        name: 'sy_used',
        type: 'core::integer::u256',
        kind: 'data',
      },
      {
        name: 'pt_used',
        type: 'core::integer::u256',
        kind: 'data',
      },
      {
        name: 'lp_out',
        type: 'core::integer::u256',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'horizon::router::Router::RemoveLiquidity',
    kind: 'struct',
    members: [
      {
        name: 'sender',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
      {
        name: 'receiver',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
      {
        name: 'market',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'data',
      },
      {
        name: 'lp_in',
        type: 'core::integer::u256',
        kind: 'data',
      },
      {
        name: 'sy_out',
        type: 'core::integer::u256',
        kind: 'data',
      },
      {
        name: 'pt_out',
        type: 'core::integer::u256',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'horizon::router::Router::Swap',
    kind: 'struct',
    members: [
      {
        name: 'sender',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
      {
        name: 'receiver',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
      {
        name: 'market',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'data',
      },
      {
        name: 'sy_in',
        type: 'core::integer::u256',
        kind: 'data',
      },
      {
        name: 'pt_in',
        type: 'core::integer::u256',
        kind: 'data',
      },
      {
        name: 'sy_out',
        type: 'core::integer::u256',
        kind: 'data',
      },
      {
        name: 'pt_out',
        type: 'core::integer::u256',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'horizon::router::Router::SwapYT',
    kind: 'struct',
    members: [
      {
        name: 'sender',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
      {
        name: 'receiver',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
      {
        name: 'yt',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'data',
      },
      {
        name: 'market',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'data',
      },
      {
        name: 'sy_in',
        type: 'core::integer::u256',
        kind: 'data',
      },
      {
        name: 'yt_in',
        type: 'core::integer::u256',
        kind: 'data',
      },
      {
        name: 'sy_out',
        type: 'core::integer::u256',
        kind: 'data',
      },
      {
        name: 'yt_out',
        type: 'core::integer::u256',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'horizon::router::Router::RolloverLP',
    kind: 'struct',
    members: [
      {
        name: 'sender',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
      {
        name: 'receiver',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
      {
        name: 'market_old',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'data',
      },
      {
        name: 'market_new',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'data',
      },
      {
        name: 'lp_burned',
        type: 'core::integer::u256',
        kind: 'data',
      },
      {
        name: 'lp_minted',
        type: 'core::integer::u256',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'openzeppelin_access::ownable::ownable::OwnableComponent::OwnershipTransferred',
    kind: 'struct',
    members: [
      {
        name: 'previous_owner',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
      {
        name: 'new_owner',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
    ],
  },
  {
    type: 'event',
    name: 'openzeppelin_access::ownable::ownable::OwnableComponent::OwnershipTransferStarted',
    kind: 'struct',
    members: [
      {
        name: 'previous_owner',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
      {
        name: 'new_owner',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
    ],
  },
  {
    type: 'event',
    name: 'openzeppelin_access::ownable::ownable::OwnableComponent::Event',
    kind: 'enum',
    variants: [
      {
        name: 'OwnershipTransferred',
        type: 'openzeppelin_access::ownable::ownable::OwnableComponent::OwnershipTransferred',
        kind: 'nested',
      },
      {
        name: 'OwnershipTransferStarted',
        type: 'openzeppelin_access::ownable::ownable::OwnableComponent::OwnershipTransferStarted',
        kind: 'nested',
      },
    ],
  },
  {
    type: 'event',
    name: 'openzeppelin_upgrades::upgradeable::UpgradeableComponent::Upgraded',
    kind: 'struct',
    members: [
      {
        name: 'class_hash',
        type: 'core::starknet::class_hash::ClassHash',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'openzeppelin_upgrades::upgradeable::UpgradeableComponent::Event',
    kind: 'enum',
    variants: [
      {
        name: 'Upgraded',
        type: 'openzeppelin_upgrades::upgradeable::UpgradeableComponent::Upgraded',
        kind: 'nested',
      },
    ],
  },
  {
    type: 'event',
    name: 'openzeppelin_introspection::src5::SRC5Component::Event',
    kind: 'enum',
    variants: [],
  },
  {
    type: 'event',
    name: 'openzeppelin_access::accesscontrol::accesscontrol::AccessControlComponent::RoleGranted',
    kind: 'struct',
    members: [
      {
        name: 'role',
        type: 'core::felt252',
        kind: 'data',
      },
      {
        name: 'account',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'data',
      },
      {
        name: 'sender',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'openzeppelin_access::accesscontrol::accesscontrol::AccessControlComponent::RoleGrantedWithDelay',
    kind: 'struct',
    members: [
      {
        name: 'role',
        type: 'core::felt252',
        kind: 'data',
      },
      {
        name: 'account',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'data',
      },
      {
        name: 'sender',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'data',
      },
      {
        name: 'delay',
        type: 'core::integer::u64',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'openzeppelin_access::accesscontrol::accesscontrol::AccessControlComponent::RoleRevoked',
    kind: 'struct',
    members: [
      {
        name: 'role',
        type: 'core::felt252',
        kind: 'data',
      },
      {
        name: 'account',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'data',
      },
      {
        name: 'sender',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'openzeppelin_access::accesscontrol::accesscontrol::AccessControlComponent::RoleAdminChanged',
    kind: 'struct',
    members: [
      {
        name: 'role',
        type: 'core::felt252',
        kind: 'data',
      },
      {
        name: 'previous_admin_role',
        type: 'core::felt252',
        kind: 'data',
      },
      {
        name: 'new_admin_role',
        type: 'core::felt252',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'openzeppelin_access::accesscontrol::accesscontrol::AccessControlComponent::Event',
    kind: 'enum',
    variants: [
      {
        name: 'RoleGranted',
        type: 'openzeppelin_access::accesscontrol::accesscontrol::AccessControlComponent::RoleGranted',
        kind: 'nested',
      },
      {
        name: 'RoleGrantedWithDelay',
        type: 'openzeppelin_access::accesscontrol::accesscontrol::AccessControlComponent::RoleGrantedWithDelay',
        kind: 'nested',
      },
      {
        name: 'RoleRevoked',
        type: 'openzeppelin_access::accesscontrol::accesscontrol::AccessControlComponent::RoleRevoked',
        kind: 'nested',
      },
      {
        name: 'RoleAdminChanged',
        type: 'openzeppelin_access::accesscontrol::accesscontrol::AccessControlComponent::RoleAdminChanged',
        kind: 'nested',
      },
    ],
  },
  {
    type: 'event',
    name: 'openzeppelin_security::pausable::PausableComponent::Paused',
    kind: 'struct',
    members: [
      {
        name: 'account',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'openzeppelin_security::pausable::PausableComponent::Unpaused',
    kind: 'struct',
    members: [
      {
        name: 'account',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'openzeppelin_security::pausable::PausableComponent::Event',
    kind: 'enum',
    variants: [
      {
        name: 'Paused',
        type: 'openzeppelin_security::pausable::PausableComponent::Paused',
        kind: 'nested',
      },
      {
        name: 'Unpaused',
        type: 'openzeppelin_security::pausable::PausableComponent::Unpaused',
        kind: 'nested',
      },
    ],
  },
  {
    type: 'event',
    name: 'openzeppelin_security::reentrancyguard::ReentrancyGuardComponent::Event',
    kind: 'enum',
    variants: [],
  },
  {
    type: 'event',
    name: 'horizon::router::Router::Event',
    kind: 'enum',
    variants: [
      {
        name: 'MintPY',
        type: 'horizon::router::Router::MintPY',
        kind: 'nested',
      },
      {
        name: 'RedeemPY',
        type: 'horizon::router::Router::RedeemPY',
        kind: 'nested',
      },
      {
        name: 'AddLiquidity',
        type: 'horizon::router::Router::AddLiquidity',
        kind: 'nested',
      },
      {
        name: 'RemoveLiquidity',
        type: 'horizon::router::Router::RemoveLiquidity',
        kind: 'nested',
      },
      {
        name: 'Swap',
        type: 'horizon::router::Router::Swap',
        kind: 'nested',
      },
      {
        name: 'SwapYT',
        type: 'horizon::router::Router::SwapYT',
        kind: 'nested',
      },
      {
        name: 'RolloverLP',
        type: 'horizon::router::Router::RolloverLP',
        kind: 'nested',
      },
      {
        name: 'OwnableEvent',
        type: 'openzeppelin_access::ownable::ownable::OwnableComponent::Event',
        kind: 'flat',
      },
      {
        name: 'UpgradeableEvent',
        type: 'openzeppelin_upgrades::upgradeable::UpgradeableComponent::Event',
        kind: 'flat',
      },
      {
        name: 'SRC5Event',
        type: 'openzeppelin_introspection::src5::SRC5Component::Event',
        kind: 'flat',
      },
      {
        name: 'AccessControlEvent',
        type: 'openzeppelin_access::accesscontrol::accesscontrol::AccessControlComponent::Event',
        kind: 'flat',
      },
      {
        name: 'PausableEvent',
        type: 'openzeppelin_security::pausable::PausableComponent::Event',
        kind: 'flat',
      },
      {
        name: 'ReentrancyGuardEvent',
        type: 'openzeppelin_security::reentrancyguard::ReentrancyGuardComponent::Event',
        kind: 'flat',
      },
    ],
  },
] as const;
