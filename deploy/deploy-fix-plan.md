# Deploy scripts fix plan (devnet focus)

## Research notes (code-validated)
- `make dev-up` runs `docker-compose.yml`, which builds `docker/Dockerfile.deployer` and executes `deploy/scripts/docker-deploy.sh` -> `deploy/scripts/deploy.sh`.
- `contracts/src/factory.cairo` constructor now takes `(owner, yt_class_hash, pt_class_hash, treasury)` and `create_yield_contracts` passes treasury into the YT constructor.
- `contracts/src/tokens/yt.cairo` constructor now takes `treasury`, and `mint_py` takes only `(receiver_pt, receiver_yt)` using pre-transferred SY (floating SY pattern).
- `contracts/src/tokens/sy.cairo` constructor now takes `(name, symbol, underlying, index_oracle, is_erc4626, asset_type, pauser, tokens_in, tokens_out)`.
- `contracts/src/components/sy_component.cairo` initializer asserts non-empty `tokens_in` and `tokens_out` and validates `token_in`/`token_out` on deposit/redeem.
- `contracts/src/tokens/sy.cairo` `deposit` signature is now `(receiver, token_in, amount_shares_to_deposit, min_shares_out)`.

## Gaps in deploy scripts
- `deploy/scripts/deploy.sh`, `deploy/scripts/deploy-fork.sh`, and `deploy/scripts/mainnet.deploy.sh` still use the old Factory and SY constructor calldata (missing `treasury`, `asset_type`, `tokens_in`, `tokens_out`).
- Seed liquidity flow still uses the old SY `deposit` signature and calls `YT.mint_py` with an amount; it also never transfers SY to the YT contract before minting.
- `.env.example` does not mention a treasury address, so scripts need either a new env var or a safe default.

## Fix plan
1. Add a `TREASURY_ADDRESS` env var (default to deployer if unset) and pass it to Factory constructor in `deploy/scripts/deploy.sh`, `deploy/scripts/deploy-fork.sh`, and `deploy/scripts/mainnet.deploy.sh`.
2. Update SY deployments to pass `asset_type` (use `0` for `AssetType::Token`) plus `tokens_in`/`tokens_out` spans. For current devnet/fork/mainnet usage, pass a single entry equal to the underlying yield token address (`len=1`, then the address).
3. Update SY deposit calls in seed-liquidity blocks to pass `token_in` and `min_shares_out`, e.g. `sy.deposit(deployer, underlying, amount, 0)`.
4. Update YT minting flow to the floating SY pattern: transfer SY from deployer to YT (`sy.transfer(yt, amount)`), call `yt.mint_py(deployer, deployer)` with no amount, and remove the unused `sy.approve(yt, ...)` step.
5. Mirror these constructor and flow changes in the fork and mainnet scripts so they stay in sync with the Cairo contracts.
6. Update `.env.example` (and optionally `deploy/scripts/reset-env.sh`) to include `TREASURY_ADDRESS` so devnet deployments are reproducible without hidden defaults.

## Manual validation steps
- Run `make dev-up` and tail `docker-compose logs -f deployer` to confirm contract deployment and liquidity seeding succeed without constructor or calldata errors.
- Check `deploy/addresses/devnet.json` for non-empty Factory, MarketFactory, Router, SY, PT, YT, and Market addresses.
- Spot-check a market seed by calling `sncast call` on SY `balance_of` and Market `get_reserves` for the deployer to confirm liquidity was minted.
