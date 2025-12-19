/// Role Constants for Horizon Protocol RBAC
/// Uses felt252 selectors for gas-efficient role checks

/// Default admin role - can grant/revoke all other roles
/// Value is 0 to match OpenZeppelin's DEFAULT_ADMIN_ROLE
pub const DEFAULT_ADMIN_ROLE: felt252 = 0;

/// Pauser role - can pause/unpause protocol functions for emergency response
pub const PAUSER_ROLE: felt252 = selector!("PAUSER_ROLE");

/// Operator role - can update operational parameters (oracle config, etc.)
pub const OPERATOR_ROLE: felt252 = selector!("OPERATOR_ROLE");
