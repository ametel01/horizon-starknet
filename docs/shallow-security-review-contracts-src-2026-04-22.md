# Shallow Security Review: `contracts/src`

Date: 2026-04-22

Scope:
- Static, source-only pass over `contracts/src`
- Cross-checked against a subset of related tests under `contracts/tests`
- No dynamic validation or exploit PoCs in this pass

This document records potential findings for a deeper follow-up review. Severity and exploitability should be revalidated before triage is finalized.

## Potential Findings

### 1. Medium: YT floating-balance entrypoints can let arbitrary callers capture pre-transferred assets

Affected code:
- `contracts/src/tokens/yt.cairo:596-641`
- `contracts/src/tokens/yt.cairo:662-696`
- `contracts/tests/tokens/test_yt_reserve.cairo:225-249`

Why this stands out:
- `mint_py()` does not bind the staged SY amount to `msg.sender`; it mints against the entire `actual_balance - sy_reserve` delta currently sitting on the YT contract.
- `redeem_py()` similarly consumes the entire PT/YT balance currently staged on the YT contract.
- The reserve tests explicitly model direct transfers as "floating" balances and confirm they remain available for later consumption.

Relevant excerpts:
- `yt.cairo:599-605` reads the full floating SY balance and immediately promotes it into `sy_reserve`.
- `yt.cairo:610-619` mints PT/YT to arbitrary receivers chosen by the caller.
- `yt.cairo:665-680` burns all PT/YT currently sitting on the contract, not an amount tied to the caller.

Impact hypothesis:
- If SY, PT, or YT is transferred to the YT contract in a separate transaction, the next caller can likely consume that staged balance and mint/redeem for themselves.
- This creates a theft/front-run surface for accidental transfers, asynchronous integrations, or any flow that stages tokens before calling the consume function.

Why this is only a potential finding:
- The pattern may be intentional for Pendle-style "floating token" flows when used atomically through the router.
- The risk is around direct contract interaction and any integration that stages assets across transactions.

Suggested follow-up:
- Confirm whether direct calls to `mint_py`, `redeem_py`, `redeem_py_post_expiry`, `mint_py_multi`, and `redeem_py_multi` are considered supported UX.
- Consider binding staged balances to the caller, switching to pull-based `transfer_from`, or adding a recovery/sweep path for stray transfers.

### 2. Medium: Router trusts aggregator return values instead of verifying actual output delivered to the receiver

Affected code:
- `contracts/src/router.cairo:1723-1745`
- `contracts/src/router.cairo:1938-1959`
- `contracts/src/router.cairo:2008-2029`
- `contracts/src/router.cairo:2467-2488`
- `contracts/src/router.cairo:2563-2584`
- `contracts/src/mocks/mock_aggregator.cairo:91-115`

Why this stands out:
- In several output-side aggregator flows, the router sends the aggregator output directly to `receiver`.
- The router then accepts the aggregator's returned `token_out_received` value as proof of execution and uses it for the slippage check.
- There is no on-chain verification of the receiver's token balance delta in these paths.

Relevant excerpts:
- `router.cairo:1730-1744`, `1945-1959`, `2012-2029`, `2474-2488`, and `2570-2584` all rely on `aggregator.swap(...) -> token_out_received`.
- The mock implementation at `mock_aggregator.cairo:91-115` highlights the trust model: the interface is free to both move tokens and self-report the output amount.

Impact hypothesis:
- A malicious or buggy aggregator can return a compliant number while delivering less than advertised, or no tokens at all, to the receiver.
- In that case, the router's slippage protection becomes a check on an untrusted return value rather than on actual asset delivery.

Why this is only a potential finding:
- Users may be expected to choose trusted aggregators.
- Some real aggregator implementations may be honest enough that this is only an integration trust issue, not an exploitable protocol bug.

Suggested follow-up:
- Prefer routing aggregator outputs to the router first, measure actual balance delta, then forward to the user.
- If direct-to-receiver delivery must remain, consider whitelisting aggregators and validating behavior per integration.
- Add negative tests with a malicious aggregator that lies about `amount_out`.

### 3. Medium: `max_staleness` is configurable but not enforced in the Pragma index oracle

Affected code:
- `contracts/src/oracles/pragma_index_oracle.cairo:243-251`
- `contracts/src/oracles/pragma_index_oracle.cairo:348-388`

Why this stands out:
- `set_config()` stores both `twap_window` and `max_staleness`.
- `_fetch_oracle_index()` only uses `twap_window`; `max_staleness` is never read when fetching or validating oracle data.

Relevant excerpts:
- `pragma_index_oracle.cairo:243-251` persists `max_staleness` and emits it in `ConfigUpdated`.
- `pragma_index_oracle.cairo:348-388` fetches TWAP data without any freshness gate tied to `max_staleness`.

Impact hypothesis:
- Operators may believe they have configured a freshness bound, while stale oracle data may still be accepted indefinitely as long as the underlying oracle call returns a value.
- Because the YT index is used for minting, redemption, and interest accounting, stale pricing can distort accrual and settlement behavior.

Why this is only a potential finding:
- It depends on whether `calculate_twap(...)` already enforces freshness internally. That guarantee is not enforced or documented in this contract.

Suggested follow-up:
- Verify Pragma's `calculate_twap(...)` semantics.
- If freshness is not enforced upstream, add an explicit staleness check here and cover it with tests.

## Notes

- This pass intentionally focused on high-signal trust boundaries: staged balances, external aggregators, and oracle freshness.
- I did not attempt to prove exploitability for each item in this pass.
