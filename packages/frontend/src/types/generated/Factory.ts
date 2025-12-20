export const FACTORY_ABI = [
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
      {
        type: 'function',
        name: 'yt_class_hash',
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
        name: 'pt_class_hash',
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
        name: 'set_class_hashes',
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
    type: 'constructor',
    name: 'constructor',
    inputs: [
      {
        name: 'owner',
        type: 'core::starknet::contract_address::ContractAddress',
      },
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
    name: 'horizon::factory::Factory::ClassHashesUpdated',
    kind: 'struct',
    members: [
      {
        name: 'yt_class_hash',
        type: 'core::starknet::class_hash::ClassHash',
        kind: 'data',
      },
      {
        name: 'pt_class_hash',
        type: 'core::starknet::class_hash::ClassHash',
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
    name: 'horizon::factory::Factory::Event',
    kind: 'enum',
    variants: [
      {
        name: 'YieldContractsCreated',
        type: 'horizon::factory::Factory::YieldContractsCreated',
        kind: 'nested',
      },
      {
        name: 'ClassHashesUpdated',
        type: 'horizon::factory::Factory::ClassHashesUpdated',
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
    ],
  },
] as const;
