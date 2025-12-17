export const ROUTER_ABI = [
  {
    type: 'impl',
    name: 'UpgradeableImpl',
    interface_name: 'openzeppelin_upgrades::interface::IUpgradeable',
  },
  {
    type: 'interface',
    name: 'openzeppelin_upgrades::interface::IUpgradeable',
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
    type: 'interface',
    name: 'horizon::interfaces::i_router::IRouter',
    items: [
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
            name: 'min_sy_out',
            type: 'core::integer::u256',
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
    interface_name: 'openzeppelin_access::ownable::interface::IOwnable',
  },
  {
    type: 'interface',
    name: 'openzeppelin_access::ownable::interface::IOwnable',
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
        name: 'OwnableEvent',
        type: 'openzeppelin_access::ownable::ownable::OwnableComponent::Event',
        kind: 'flat',
      },
      {
        name: 'UpgradeableEvent',
        type: 'openzeppelin_upgrades::upgradeable::UpgradeableComponent::Event',
        kind: 'flat',
      },
    ],
  },
] as const;
