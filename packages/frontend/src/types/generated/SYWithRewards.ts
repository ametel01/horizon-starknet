export const SYWITHREWARDS_ABI = [
  {
    type: 'impl',
    name: 'SYWithRewardsImpl',
    interface_name: 'horizon::interfaces::i_sy_with_rewards::ISYWithRewards',
  },
  {
    type: 'struct',
    name: 'core::byte_array::ByteArray',
    members: [
      {
        name: 'data',
        type: 'core::array::Array::<core::bytes_31::bytes31>',
      },
      {
        name: 'pending_word',
        type: 'core::felt252',
      },
      {
        name: 'pending_word_len',
        type: 'core::internal::bounded_int::BoundedInt::<0, 30>',
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
    name: 'core::array::Span::<core::starknet::contract_address::ContractAddress>',
    members: [
      {
        name: 'snapshot',
        type: '@core::array::Array::<core::starknet::contract_address::ContractAddress>',
      },
    ],
  },
  {
    type: 'enum',
    name: 'horizon::interfaces::i_sy::AssetType',
    variants: [
      {
        name: 'Token',
        type: '()',
      },
      {
        name: 'Liquidity',
        type: '()',
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
    type: 'interface',
    name: 'horizon::interfaces::i_sy_with_rewards::ISYWithRewards',
    items: [
      {
        type: 'function',
        name: 'name',
        inputs: [],
        outputs: [
          {
            type: 'core::byte_array::ByteArray',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'symbol',
        inputs: [],
        outputs: [
          {
            type: 'core::byte_array::ByteArray',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'decimals',
        inputs: [],
        outputs: [
          {
            type: 'core::integer::u8',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'total_supply',
        inputs: [],
        outputs: [
          {
            type: 'core::integer::u256',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'balance_of',
        inputs: [
          {
            name: 'account',
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
        name: 'allowance',
        inputs: [
          {
            name: 'owner',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'spender',
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
        name: 'transfer',
        inputs: [
          {
            name: 'recipient',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'amount',
            type: 'core::integer::u256',
          },
        ],
        outputs: [
          {
            type: 'core::bool',
          },
        ],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'transfer_from',
        inputs: [
          {
            name: 'sender',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'recipient',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'amount',
            type: 'core::integer::u256',
          },
        ],
        outputs: [
          {
            type: 'core::bool',
          },
        ],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'approve',
        inputs: [
          {
            name: 'spender',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'amount',
            type: 'core::integer::u256',
          },
        ],
        outputs: [
          {
            type: 'core::bool',
          },
        ],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'deposit',
        inputs: [
          {
            name: 'receiver',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'amount_shares_to_deposit',
            type: 'core::integer::u256',
          },
          {
            name: 'min_shares_out',
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
        name: 'redeem',
        inputs: [
          {
            name: 'receiver',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'amount_sy_to_redeem',
            type: 'core::integer::u256',
          },
          {
            name: 'min_token_out',
            type: 'core::integer::u256',
          },
          {
            name: 'burn_from_internal_balance',
            type: 'core::bool',
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
        name: 'exchange_rate',
        inputs: [],
        outputs: [
          {
            type: 'core::integer::u256',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'underlying_asset',
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
        name: 'get_tokens_in',
        inputs: [],
        outputs: [
          {
            type: 'core::array::Span::<core::starknet::contract_address::ContractAddress>',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'get_tokens_out',
        inputs: [],
        outputs: [
          {
            type: 'core::array::Span::<core::starknet::contract_address::ContractAddress>',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'is_valid_token_in',
        inputs: [
          {
            name: 'token',
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
        name: 'is_valid_token_out',
        inputs: [
          {
            name: 'token',
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
        name: 'asset_info',
        inputs: [],
        outputs: [
          {
            type: '(horizon::interfaces::i_sy::AssetType, core::starknet::contract_address::ContractAddress, core::integer::u8)',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'preview_deposit',
        inputs: [
          {
            name: 'amount_to_deposit',
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
        name: 'preview_redeem',
        inputs: [
          {
            name: 'amount_sy',
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
        name: 'get_exchange_rate_watermark',
        inputs: [],
        outputs: [
          {
            type: 'core::integer::u256',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'get_reward_tokens',
        inputs: [],
        outputs: [
          {
            type: 'core::array::Span::<core::starknet::contract_address::ContractAddress>',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'claim_rewards',
        inputs: [
          {
            name: 'user',
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        outputs: [
          {
            type: 'core::array::Span::<core::integer::u256>',
          },
        ],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'accrued_rewards',
        inputs: [
          {
            name: 'user',
            type: 'core::starknet::contract_address::ContractAddress',
          },
        ],
        outputs: [
          {
            type: 'core::array::Span::<core::integer::u256>',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'reward_index',
        inputs: [
          {
            name: 'token',
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
        name: 'user_reward_index',
        inputs: [
          {
            name: 'user',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'token',
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
        name: 'is_reward_token',
        inputs: [
          {
            name: 'token',
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
        name: 'reward_tokens_count',
        inputs: [],
        outputs: [
          {
            type: 'core::integer::u32',
          },
        ],
        state_mutability: 'view',
      },
    ],
  },
  {
    type: 'impl',
    name: 'SYWithRewardsAdminImpl',
    interface_name: 'horizon::interfaces::i_sy_with_rewards::ISYWithRewardsAdmin',
  },
  {
    type: 'interface',
    name: 'horizon::interfaces::i_sy_with_rewards::ISYWithRewardsAdmin',
    items: [
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
    ],
  },
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
    name: 'AccessControlImpl',
    interface_name: 'openzeppelin_interfaces::access::accesscontrol::IAccessControl',
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
    type: 'constructor',
    name: 'constructor',
    inputs: [
      {
        name: 'name',
        type: 'core::byte_array::ByteArray',
      },
      {
        name: 'symbol',
        type: 'core::byte_array::ByteArray',
      },
      {
        name: 'underlying',
        type: 'core::starknet::contract_address::ContractAddress',
      },
      {
        name: 'index_oracle',
        type: 'core::starknet::contract_address::ContractAddress',
      },
      {
        name: 'is_erc4626',
        type: 'core::bool',
      },
      {
        name: 'asset_type',
        type: 'horizon::interfaces::i_sy::AssetType',
      },
      {
        name: 'pauser',
        type: 'core::starknet::contract_address::ContractAddress',
      },
      {
        name: 'tokens_in',
        type: 'core::array::Span::<core::starknet::contract_address::ContractAddress>',
      },
      {
        name: 'tokens_out',
        type: 'core::array::Span::<core::starknet::contract_address::ContractAddress>',
      },
      {
        name: 'reward_tokens',
        type: 'core::array::Span::<core::starknet::contract_address::ContractAddress>',
      },
    ],
  },
  {
    type: 'event',
    name: 'openzeppelin_token::erc20::erc20::ERC20Component::Transfer',
    kind: 'struct',
    members: [
      {
        name: 'from',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
      {
        name: 'to',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
      {
        name: 'value',
        type: 'core::integer::u256',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'openzeppelin_token::erc20::erc20::ERC20Component::Approval',
    kind: 'struct',
    members: [
      {
        name: 'owner',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
      {
        name: 'spender',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
      {
        name: 'value',
        type: 'core::integer::u256',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'openzeppelin_token::erc20::erc20::ERC20Component::Event',
    kind: 'enum',
    variants: [
      {
        name: 'Transfer',
        type: 'openzeppelin_token::erc20::erc20::ERC20Component::Transfer',
        kind: 'nested',
      },
      {
        name: 'Approval',
        type: 'openzeppelin_token::erc20::erc20::ERC20Component::Approval',
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
    name: 'openzeppelin_security::reentrancyguard::ReentrancyGuardComponent::Event',
    kind: 'enum',
    variants: [],
  },
  {
    type: 'event',
    name: 'horizon::components::sy_component::SYComponent::Deposit',
    kind: 'struct',
    members: [
      {
        name: 'caller',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
      {
        name: 'receiver',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
      {
        name: 'underlying',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
      {
        name: 'amount_deposited',
        type: 'core::integer::u256',
        kind: 'data',
      },
      {
        name: 'amount_sy_minted',
        type: 'core::integer::u256',
        kind: 'data',
      },
      {
        name: 'exchange_rate',
        type: 'core::integer::u256',
        kind: 'data',
      },
      {
        name: 'total_supply_after',
        type: 'core::integer::u256',
        kind: 'data',
      },
      {
        name: 'timestamp',
        type: 'core::integer::u64',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'horizon::components::sy_component::SYComponent::Redeem',
    kind: 'struct',
    members: [
      {
        name: 'caller',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
      {
        name: 'receiver',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
      {
        name: 'underlying',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
      {
        name: 'amount_sy_burned',
        type: 'core::integer::u256',
        kind: 'data',
      },
      {
        name: 'amount_redeemed',
        type: 'core::integer::u256',
        kind: 'data',
      },
      {
        name: 'exchange_rate',
        type: 'core::integer::u256',
        kind: 'data',
      },
      {
        name: 'total_supply_after',
        type: 'core::integer::u256',
        kind: 'data',
      },
      {
        name: 'timestamp',
        type: 'core::integer::u64',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'horizon::components::sy_component::SYComponent::OracleRateUpdated',
    kind: 'struct',
    members: [
      {
        name: 'sy',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
      {
        name: 'underlying',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
      {
        name: 'old_rate',
        type: 'core::integer::u256',
        kind: 'data',
      },
      {
        name: 'new_rate',
        type: 'core::integer::u256',
        kind: 'data',
      },
      {
        name: 'rate_change_bps',
        type: 'core::integer::u256',
        kind: 'data',
      },
      {
        name: 'timestamp',
        type: 'core::integer::u64',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'horizon::components::sy_component::SYComponent::NegativeYieldDetected',
    kind: 'struct',
    members: [
      {
        name: 'sy',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
      {
        name: 'underlying',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
      {
        name: 'watermark_rate',
        type: 'core::integer::u256',
        kind: 'data',
      },
      {
        name: 'current_rate',
        type: 'core::integer::u256',
        kind: 'data',
      },
      {
        name: 'rate_drop_bps',
        type: 'core::integer::u256',
        kind: 'data',
      },
      {
        name: 'timestamp',
        type: 'core::integer::u64',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'horizon::components::sy_component::SYComponent::Event',
    kind: 'enum',
    variants: [
      {
        name: 'Deposit',
        type: 'horizon::components::sy_component::SYComponent::Deposit',
        kind: 'nested',
      },
      {
        name: 'Redeem',
        type: 'horizon::components::sy_component::SYComponent::Redeem',
        kind: 'nested',
      },
      {
        name: 'OracleRateUpdated',
        type: 'horizon::components::sy_component::SYComponent::OracleRateUpdated',
        kind: 'nested',
      },
      {
        name: 'NegativeYieldDetected',
        type: 'horizon::components::sy_component::SYComponent::NegativeYieldDetected',
        kind: 'nested',
      },
    ],
  },
  {
    type: 'event',
    name: 'horizon::components::reward_manager_component::RewardManagerComponent::RewardsClaimed',
    kind: 'struct',
    members: [
      {
        name: 'user',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
      {
        name: 'reward_token',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
      {
        name: 'amount',
        type: 'core::integer::u256',
        kind: 'data',
      },
      {
        name: 'timestamp',
        type: 'core::integer::u64',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'horizon::components::reward_manager_component::RewardManagerComponent::RewardIndexUpdated',
    kind: 'struct',
    members: [
      {
        name: 'reward_token',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
      {
        name: 'old_index',
        type: 'core::integer::u256',
        kind: 'data',
      },
      {
        name: 'new_index',
        type: 'core::integer::u256',
        kind: 'data',
      },
      {
        name: 'rewards_added',
        type: 'core::integer::u256',
        kind: 'data',
      },
      {
        name: 'total_supply',
        type: 'core::integer::u256',
        kind: 'data',
      },
      {
        name: 'timestamp',
        type: 'core::integer::u64',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'horizon::components::reward_manager_component::RewardManagerComponent::RewardTokenAdded',
    kind: 'struct',
    members: [
      {
        name: 'reward_token',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
      {
        name: 'index',
        type: 'core::integer::u32',
        kind: 'data',
      },
      {
        name: 'timestamp',
        type: 'core::integer::u64',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'horizon::components::reward_manager_component::RewardManagerComponent::Event',
    kind: 'enum',
    variants: [
      {
        name: 'RewardsClaimed',
        type: 'horizon::components::reward_manager_component::RewardManagerComponent::RewardsClaimed',
        kind: 'nested',
      },
      {
        name: 'RewardIndexUpdated',
        type: 'horizon::components::reward_manager_component::RewardManagerComponent::RewardIndexUpdated',
        kind: 'nested',
      },
      {
        name: 'RewardTokenAdded',
        type: 'horizon::components::reward_manager_component::RewardManagerComponent::RewardTokenAdded',
        kind: 'nested',
      },
    ],
  },
  {
    type: 'event',
    name: 'horizon::tokens::sy_with_rewards::SYWithRewards::Event',
    kind: 'enum',
    variants: [
      {
        name: 'ERC20Event',
        type: 'openzeppelin_token::erc20::erc20::ERC20Component::Event',
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
        name: 'ReentrancyGuardEvent',
        type: 'openzeppelin_security::reentrancyguard::ReentrancyGuardComponent::Event',
        kind: 'flat',
      },
      {
        name: 'SYEvent',
        type: 'horizon::components::sy_component::SYComponent::Event',
        kind: 'flat',
      },
      {
        name: 'RewardsEvent',
        type: 'horizon::components::reward_manager_component::RewardManagerComponent::Event',
        kind: 'flat',
      },
    ],
  },
] as const;
