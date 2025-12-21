export const SY_ABI = [
  {
    type: 'impl',
    name: 'SYImpl',
    interface_name: 'horizon::interfaces::i_sy::ISY',
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
    type: 'interface',
    name: 'horizon::interfaces::i_sy::ISY',
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
    ],
  },
  {
    type: 'impl',
    name: 'SYAdminImpl',
    interface_name: 'horizon::interfaces::i_sy::ISYAdmin',
  },
  {
    type: 'interface',
    name: 'horizon::interfaces::i_sy::ISYAdmin',
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
        name: 'pauser',
        type: 'core::starknet::contract_address::ContractAddress',
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
    name: 'horizon::tokens::sy::SY::Deposit',
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
        name: 'amount_deposited',
        type: 'core::integer::u256',
        kind: 'data',
      },
      {
        name: 'amount_sy_minted',
        type: 'core::integer::u256',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'horizon::tokens::sy::SY::Redeem',
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
        name: 'amount_sy_burned',
        type: 'core::integer::u256',
        kind: 'data',
      },
      {
        name: 'amount_redeemed',
        type: 'core::integer::u256',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'horizon::tokens::sy::SY::Event',
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
        name: 'Deposit',
        type: 'horizon::tokens::sy::SY::Deposit',
        kind: 'nested',
      },
      {
        name: 'Redeem',
        type: 'horizon::tokens::sy::SY::Redeem',
        kind: 'nested',
      },
    ],
  },
] as const;
