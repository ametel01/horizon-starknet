// Import contract class files directly from contracts build output
// These contain the ABI in the 'abi' field
import FactoryContract from '@contracts/horizon_Factory.contract_class.json';
import MarketContract from '@contracts/horizon_Market.contract_class.json';
import MarketFactoryContract from '@contracts/horizon_MarketFactory.contract_class.json';
import MockYieldTokenContract from '@contracts/horizon_MockYieldToken.contract_class.json';
import PTContract from '@contracts/horizon_PT.contract_class.json';
import RouterContract from '@contracts/horizon_Router.contract_class.json';
import SYContract from '@contracts/horizon_SY.contract_class.json';
import YTContract from '@contracts/horizon_YT.contract_class.json';
import type { Abi } from 'starknet';

// Extract ABIs from contract class files
export const FACTORY_ABI = FactoryContract.abi as Abi;
export const MARKET_FACTORY_ABI = MarketFactoryContract.abi as Abi;
export const ROUTER_ABI = RouterContract.abi as Abi;
export const MARKET_ABI = MarketContract.abi as Abi;
export const SY_ABI = SYContract.abi as Abi;
export const PT_ABI = PTContract.abi as Abi;
export const YT_ABI = YTContract.abi as Abi;
export const MOCK_YIELD_TOKEN_ABI = MockYieldTokenContract.abi as Abi;

// ERC20 ABI subset for token interactions
export const ERC20_ABI: Abi = [
  {
    name: 'balanceOf',
    type: 'function',
    inputs: [{ name: 'account', type: 'core::starknet::contract_address::ContractAddress' }],
    outputs: [{ type: 'core::integer::u256' }],
    state_mutability: 'view',
  },
  {
    name: 'allowance',
    type: 'function',
    inputs: [
      { name: 'owner', type: 'core::starknet::contract_address::ContractAddress' },
      { name: 'spender', type: 'core::starknet::contract_address::ContractAddress' },
    ],
    outputs: [{ type: 'core::integer::u256' }],
    state_mutability: 'view',
  },
  {
    name: 'approve',
    type: 'function',
    inputs: [
      { name: 'spender', type: 'core::starknet::contract_address::ContractAddress' },
      { name: 'amount', type: 'core::integer::u256' },
    ],
    outputs: [{ type: 'core::bool' }],
    state_mutability: 'external',
  },
  {
    name: 'transfer',
    type: 'function',
    inputs: [
      { name: 'recipient', type: 'core::starknet::contract_address::ContractAddress' },
      { name: 'amount', type: 'core::integer::u256' },
    ],
    outputs: [{ type: 'core::bool' }],
    state_mutability: 'external',
  },
  {
    name: 'transfer_from',
    type: 'function',
    inputs: [
      { name: 'sender', type: 'core::starknet::contract_address::ContractAddress' },
      { name: 'recipient', type: 'core::starknet::contract_address::ContractAddress' },
      { name: 'amount', type: 'core::integer::u256' },
    ],
    outputs: [{ type: 'core::bool' }],
    state_mutability: 'external',
  },
  {
    name: 'name',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'core::felt252' }],
    state_mutability: 'view',
  },
  {
    name: 'symbol',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'core::felt252' }],
    state_mutability: 'view',
  },
  {
    name: 'decimals',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'core::integer::u8' }],
    state_mutability: 'view',
  },
  {
    name: 'total_supply',
    type: 'function',
    inputs: [],
    outputs: [{ type: 'core::integer::u256' }],
    state_mutability: 'view',
  },
];
