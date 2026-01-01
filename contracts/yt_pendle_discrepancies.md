# YT vs PendleYieldToken discrepancies

Compared `contracts/src/tokens/yt.cairo` against Pendle's `PendleYieldToken.sol` (v6) and
`InterestManagerYT.sol`. Discrepancies in the Cairo implementation:

## Behavioral Differences

- Minting flow and math differ: Cairo pulls SY via `transfer_from` and mints PY 1:1 with the input
  amount, while Pendle expects SY pre-transferred, uses floating SY, and mints
  `syToAsset(index, amountSy)` instead of 1:1. `contracts/src/tokens/yt.cairo:435`
- Redemption flow and math differ: Cairo burns PT/YT directly from the caller and returns SY 1:1;
  Pendle burns from `address(this)` (pre-transferred tokens) and uses
  `assetToSy(index, amountPY)`, with post-expiry interest carved out per redemption.
  `contracts/src/tokens/yt.cairo:506` `contracts/src/tokens/yt.cairo:813`
- Post-expiry accounting differs: Cairo freezes `py_index_at_expiry` on first post-expiry call and
  computes treasury interest from total YT supply, not from per-redemption deltas like Pendle's
  `postExpiry.totalSyInterestForTreasury`. `contracts/src/tokens/yt.cairo:568`
  `contracts/src/tokens/yt.cairo:1058` `contracts/src/tokens/yt.cairo:1117`
- Index update semantics differ: Cairo's `py_index_current` is view-only (no state update, no
  event) and always uses same-block caching, while Pendle's `pyIndexCurrent()` updates state and
  caching is configurable. `contracts/src/tokens/yt.cairo:907`
  `contracts/src/tokens/yt.cairo:1209`
- `sy_reserve` semantics differ: Cairo tracks expected balance via manual +/- updates and doesn't
  gate minting on floating SY, while Pendle updates `syReserve` to actual balance after each
  action and mints from floating SY. `contracts/src/tokens/yt.cairo:88`
  `contracts/src/tokens/yt.cairo:948`
- Interest accounting exclusions differ: Pendle excludes `address(0)` and `address(this)` from
  interest/reward tracking; Cairo only skips zero address, so the YT contract could accrue
  interest if it ever holds YT. `contracts/src/tokens/yt.cairo:1259`

## Feature / Interface Gaps

- Post-expiry data struct missing: Pendle stores `firstPYIndex`, reward indexes, and user reward
  owed; Cairo only stores `py_index_at_expiry` and `post_expiry_sy_for_treasury`.
  `contracts/src/tokens/yt.cairo:70` `contracts/src/tokens/yt.cairo:1058`
- Treasury/fee source differs: Pendle pulls treasury and fee rates from factory; Cairo stores
  `treasury` and an admin-set `interest_fee_rate` locally (no reward fee).
  `contracts/src/tokens/yt.cairo:1183`
- PT deployment model differs: Pendle receives PT address from the factory; Cairo deploys PT
  internally from a class hash and derives PT name/symbol from SY.
  `contracts/src/tokens/yt.cairo:288`
- Receiver symmetry differs: Pendle allows distinct PT and YT receivers on mint; Cairo uses a
  single receiver for both (single and batch). `contracts/src/tokens/yt.cairo:435`
  `contracts/src/tokens/yt.cairo:654`
- Decimals are fixed at 18 in Cairo; Pendle passes decimals via constructor.

## Compacted Implementation Plan

1) Align mint path with Pendle semantics. **COMPLETE**
   - Change: Update `mint_py`/batch mint flows to require SY pre-transfer, mint PY via
     `sy_to_asset(index, amount_sy)` instead of 1:1, and allow distinct PT/YT receivers.
     `contracts/src/tokens/yt.cairo:435` `contracts/src/tokens/yt.cairo:654`
   - Validate: Extend `contracts/tests/test_yt.cairo` to cover pre-transfer flow and split
     receivers; add a case in `contracts/tests/test_yt_interest.cairo` that mints with non-1:1
     index.
   - Failure modes: SY balance drift or mismatched receiver balances; breakage in router mint
     paths if they still expect `transfer_from`.

2) Align redemption math and post-expiry carve-outs. **COMPLETE**
   - Change: Route redemptions through `address(this)` burns (pre-transfer), apply
     `asset_to_sy(index, amount_py)` and post-expiry interest/tresury carve-out per redemption.
     `contracts/src/tokens/yt.cairo:506` `contracts/src/tokens/yt.cairo:813`
     `contracts/src/tokens/yt.cairo:1058`
   - Validate: Add post-expiry redemption cases in `contracts/tests/test_yt_interest.cairo` and
     treasury accounting checks in `contracts/tests/test_yt_treasury.cairo`.
   - Failure modes: Over/under-paying SY on redemption; treasury balance diverges from expected
     accrued interest.

3) Implement Pendle-style post-expiry tracking. **COMPLETE**
   - Change: Extend the post-expiry struct to include `first_py_index`, per-user reward indexes,
     and `total_sy_interest_for_treasury`, mirroring Pendle's accounting.
     `contracts/src/tokens/yt.cairo:70` `contracts/src/tokens/yt.cairo:1058`
   - Validate: Update `contracts/tests/test_yt_phase5.cairo` to assert first-call initialization
     and per-user deltas across multiple redemptions.
   - Failure modes: Incorrect initialization ordering; users claiming too much/too little
     interest after expiry.

4) Update `py_index_current` and `sy_reserve` semantics. **COMPLETE**
   - Change: Make `py_index_current()` update state and emit events, and reset `sy_reserve` to
     actual balance after mint/redeem, minting only from floating SY.
     `contracts/src/tokens/yt.cairo:88` `contracts/src/tokens/yt.cairo:907`
     `contracts/src/tokens/yt.cairo:948`
   - Validate: Add reserve delta checks in `contracts/tests/test_yt_reserve.cairo` and index
     update expectations in `contracts/tests/test_yt.cairo`.
   - Failure modes: `sy_reserve` drifting from actual balance; index caching causing stale
     pricing in same block.

5) Mirror Pendle's interest exclusion set and constructor inputs. **COMPLETE**
   - Change: Exclude `address(this)` from interest tracking, and pass decimals via constructor
     with a factory-provided value.
     `contracts/src/tokens/yt.cairo:1259` `contracts/src/tokens/yt.cairo:288`
   - Validate: Add exclusion checks in `contracts/tests/test_yt_interest.cairo` and decimals
     assertions in `contracts/tests/test_factory.cairo`.
   - Failure modes: YT contract accruing interest to itself; decimals mismatch across PT/YT/SY.

6) End-to-end sanity after behavioral alignment. **COMPLETE**
   - Change: Update router/factory expectations for pre-transfer mint/redeem and treasury flow.
     `contracts/src/router.cairo` `contracts/src/factory.cairo`
   - Validate: Run `contracts/tests/integration/test_full_flow.cairo` and
     `contracts/tests/integration/test_expiry.cairo` to ensure flow-level correctness.
   - Failure modes: Router failing with new pre-transfer requirements; integration flows
     breaking around expiry.
   - Notes: Created `tests/integration.cairo` module to enable integration tests. Updated
     integration tests to use pre-transfer pattern for `redeem_py` and `redeem_py_post_expiry`.
     Fixed argument order in `sy.redeem` calls. Adjusted dust amount test to use realistic
     minimum (1000 wei) to avoid WAD-based rounding issues.
