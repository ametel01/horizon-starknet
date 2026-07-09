# Horizon Frontend

## Dependency Audit Notes

- `bun audit --cwd packages/frontend` still reports a high `ws` advisory through `@next/bundle-analyzer -> webpack-bundle-analyzer -> ws@7.5.10`. `@next/bundle-analyzer` is a dev-only dependency used by the `analyze` script, so this path is not reachable in the production frontend runtime.
- The AVNU runtime peer path resolves to `ethers@6.17.0 -> ws@8.21.0`, which is outside the high advisory range observed in issue #66.
