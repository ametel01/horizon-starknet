export const MARKET_ABI = [
  {
    type: 'impl',
    name: 'MarketImpl',
    interface_name: 'horizon::interfaces::i_market::IMarket',
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
    name: 'horizon::interfaces::i_market::IMarket',
    items: [
      {
        type: 'function',
        name: 'sy',
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
        name: 'pt',
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
        name: 'yt',
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
        name: 'expiry',
        inputs: [],
        outputs: [
          {
            type: 'core::integer::u64',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'is_expired',
        inputs: [],
        outputs: [
          {
            type: 'core::bool',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'get_reserves',
        inputs: [],
        outputs: [
          {
            type: '(core::integer::u256, core::integer::u256)',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'total_lp_supply',
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
        name: 'mint',
        inputs: [
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
        name: 'burn',
        inputs: [
          {
            name: 'receiver',
            type: 'core::starknet::contract_address::ContractAddress',
          },
          {
            name: 'lp_to_burn',
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
        name: 'swap_exact_pt_for_sy',
        inputs: [
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
        name: 'swap_exact_sy_for_pt',
        inputs: [
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
        name: 'swap_pt_for_exact_sy',
        inputs: [
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
        name: 'get_ln_implied_rate',
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
        name: 'get_total_fees_collected',
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
        name: 'factory',
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
        name: 'get_scalar_root',
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
        name: 'get_initial_anchor',
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
        name: 'get_ln_fee_rate_root',
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
        name: 'get_reserve_fee_percent',
        inputs: [],
        outputs: [
          {
            type: 'core::integer::u8',
          },
        ],
        state_mutability: 'view',
      },
    ],
  },
  {
    type: 'impl',
    name: 'MarketAdminImpl',
    interface_name: 'horizon::interfaces::i_market::IMarketAdmin',
  },
  {
    type: 'interface',
    name: 'horizon::interfaces::i_market::IMarketAdmin',
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
      {
        type: 'function',
        name: 'collect_fees',
        inputs: [
          {
            name: 'receiver',
            type: 'core::starknet::contract_address::ContractAddress',
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
        name: 'set_scalar_root',
        inputs: [
          {
            name: 'new_scalar_root',
            type: 'core::integer::u256',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
    ],
  },
  {
    type: 'impl',
    name: 'MarketOracleImpl',
    interface_name: 'horizon::interfaces::i_market::IMarketOracle',
  },
  {
    type: 'struct',
    name: 'horizon::interfaces::i_market::OracleState',
    members: [
      {
        name: 'last_ln_implied_rate',
        type: 'core::integer::u256',
      },
      {
        name: 'observation_index',
        type: 'core::integer::u16',
      },
      {
        name: 'observation_cardinality',
        type: 'core::integer::u16',
      },
      {
        name: 'observation_cardinality_next',
        type: 'core::integer::u16',
      },
    ],
  },
  {
    type: 'interface',
    name: 'horizon::interfaces::i_market::IMarketOracle',
    items: [
      {
        type: 'function',
        name: 'observe',
        inputs: [
          {
            name: 'seconds_agos',
            type: 'core::array::Array::<core::integer::u32>',
          },
        ],
        outputs: [
          {
            type: 'core::array::Array::<core::integer::u256>',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'increase_observations_cardinality_next',
        inputs: [
          {
            name: 'cardinality_next',
            type: 'core::integer::u16',
          },
        ],
        outputs: [],
        state_mutability: 'external',
      },
      {
        type: 'function',
        name: 'get_observation',
        inputs: [
          {
            name: 'index',
            type: 'core::integer::u16',
          },
        ],
        outputs: [
          {
            type: '(core::integer::u64, core::integer::u256, core::bool)',
          },
        ],
        state_mutability: 'view',
      },
      {
        type: 'function',
        name: 'get_oracle_state',
        inputs: [],
        outputs: [
          {
            type: 'horizon::interfaces::i_market::OracleState',
          },
        ],
        state_mutability: 'view',
      },
    ],
  },
  {
    type: 'impl',
    name: 'ERC20Impl',
    interface_name: 'openzeppelin_interfaces::token::erc20::IERC20',
  },
  {
    type: 'interface',
    name: 'openzeppelin_interfaces::token::erc20::IERC20',
    items: [
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
    ],
  },
  {
    type: 'impl',
    name: 'ERC20MetadataImpl',
    interface_name: 'openzeppelin_interfaces::token::erc20::IERC20Metadata',
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
    type: 'interface',
    name: 'openzeppelin_interfaces::token::erc20::IERC20Metadata',
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
        name: 'ln_fee_rate_root',
        type: 'core::integer::u256',
      },
      {
        name: 'reserve_fee_percent',
        type: 'core::integer::u8',
      },
      {
        name: 'pauser',
        type: 'core::starknet::contract_address::ContractAddress',
      },
      {
        name: 'factory',
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
    name: 'horizon::market::amm::Market::Mint',
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
        name: 'expiry',
        type: 'core::integer::u64',
        kind: 'key',
      },
      {
        name: 'sy',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'data',
      },
      {
        name: 'pt',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'data',
      },
      {
        name: 'sy_amount',
        type: 'core::integer::u256',
        kind: 'data',
      },
      {
        name: 'pt_amount',
        type: 'core::integer::u256',
        kind: 'data',
      },
      {
        name: 'lp_amount',
        type: 'core::integer::u256',
        kind: 'data',
      },
      {
        name: 'exchange_rate',
        type: 'core::integer::u256',
        kind: 'data',
      },
      {
        name: 'implied_rate',
        type: 'core::integer::u256',
        kind: 'data',
      },
      {
        name: 'sy_reserve_after',
        type: 'core::integer::u256',
        kind: 'data',
      },
      {
        name: 'pt_reserve_after',
        type: 'core::integer::u256',
        kind: 'data',
      },
      {
        name: 'total_lp_after',
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
    name: 'horizon::market::amm::Market::Burn',
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
        name: 'expiry',
        type: 'core::integer::u64',
        kind: 'key',
      },
      {
        name: 'sy',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'data',
      },
      {
        name: 'pt',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'data',
      },
      {
        name: 'lp_amount',
        type: 'core::integer::u256',
        kind: 'data',
      },
      {
        name: 'sy_amount',
        type: 'core::integer::u256',
        kind: 'data',
      },
      {
        name: 'pt_amount',
        type: 'core::integer::u256',
        kind: 'data',
      },
      {
        name: 'exchange_rate',
        type: 'core::integer::u256',
        kind: 'data',
      },
      {
        name: 'implied_rate',
        type: 'core::integer::u256',
        kind: 'data',
      },
      {
        name: 'sy_reserve_after',
        type: 'core::integer::u256',
        kind: 'data',
      },
      {
        name: 'pt_reserve_after',
        type: 'core::integer::u256',
        kind: 'data',
      },
      {
        name: 'total_lp_after',
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
    name: 'horizon::market::amm::Market::Swap',
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
        name: 'expiry',
        type: 'core::integer::u64',
        kind: 'key',
      },
      {
        name: 'sy',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'data',
      },
      {
        name: 'pt',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'data',
      },
      {
        name: 'pt_in',
        type: 'core::integer::u256',
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
        name: 'sy_out',
        type: 'core::integer::u256',
        kind: 'data',
      },
      {
        name: 'total_fee',
        type: 'core::integer::u256',
        kind: 'data',
      },
      {
        name: 'lp_fee',
        type: 'core::integer::u256',
        kind: 'data',
      },
      {
        name: 'reserve_fee',
        type: 'core::integer::u256',
        kind: 'data',
      },
      {
        name: 'implied_rate_before',
        type: 'core::integer::u256',
        kind: 'data',
      },
      {
        name: 'implied_rate_after',
        type: 'core::integer::u256',
        kind: 'data',
      },
      {
        name: 'exchange_rate',
        type: 'core::integer::u256',
        kind: 'data',
      },
      {
        name: 'sy_reserve_after',
        type: 'core::integer::u256',
        kind: 'data',
      },
      {
        name: 'pt_reserve_after',
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
    name: 'horizon::market::amm::Market::ImpliedRateUpdated',
    kind: 'struct',
    members: [
      {
        name: 'market',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
      {
        name: 'expiry',
        type: 'core::integer::u64',
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
        name: 'timestamp',
        type: 'core::integer::u64',
        kind: 'data',
      },
      {
        name: 'time_to_expiry',
        type: 'core::integer::u64',
        kind: 'data',
      },
      {
        name: 'exchange_rate',
        type: 'core::integer::u256',
        kind: 'data',
      },
      {
        name: 'sy_reserve',
        type: 'core::integer::u256',
        kind: 'data',
      },
      {
        name: 'pt_reserve',
        type: 'core::integer::u256',
        kind: 'data',
      },
      {
        name: 'total_lp',
        type: 'core::integer::u256',
        kind: 'data',
      },
    ],
  },
  {
    type: 'event',
    name: 'horizon::market::amm::Market::FeesCollected',
    kind: 'struct',
    members: [
      {
        name: 'collector',
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
        kind: 'key',
      },
      {
        name: 'amount',
        type: 'core::integer::u256',
        kind: 'data',
      },
      {
        name: 'expiry',
        type: 'core::integer::u64',
        kind: 'data',
      },
      {
        name: 'ln_fee_rate_root',
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
    name: 'horizon::market::amm::Market::ReserveFeeTransferred',
    kind: 'struct',
    members: [
      {
        name: 'market',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
      {
        name: 'treasury',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
      {
        name: 'caller',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
      {
        name: 'amount',
        type: 'core::integer::u256',
        kind: 'data',
      },
      {
        name: 'expiry',
        type: 'core::integer::u64',
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
    name: 'horizon::market::amm::Market::ScalarRootUpdated',
    kind: 'struct',
    members: [
      {
        name: 'market',
        type: 'core::starknet::contract_address::ContractAddress',
        kind: 'key',
      },
      {
        name: 'old_value',
        type: 'core::integer::u256',
        kind: 'data',
      },
      {
        name: 'new_value',
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
    name: 'horizon::market::amm::Market::Event',
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
        name: 'Mint',
        type: 'horizon::market::amm::Market::Mint',
        kind: 'nested',
      },
      {
        name: 'Burn',
        type: 'horizon::market::amm::Market::Burn',
        kind: 'nested',
      },
      {
        name: 'Swap',
        type: 'horizon::market::amm::Market::Swap',
        kind: 'nested',
      },
      {
        name: 'ImpliedRateUpdated',
        type: 'horizon::market::amm::Market::ImpliedRateUpdated',
        kind: 'nested',
      },
      {
        name: 'FeesCollected',
        type: 'horizon::market::amm::Market::FeesCollected',
        kind: 'nested',
      },
      {
        name: 'ReserveFeeTransferred',
        type: 'horizon::market::amm::Market::ReserveFeeTransferred',
        kind: 'nested',
      },
      {
        name: 'ScalarRootUpdated',
        type: 'horizon::market::amm::Market::ScalarRootUpdated',
        kind: 'nested',
      },
    ],
  },
] as const;
