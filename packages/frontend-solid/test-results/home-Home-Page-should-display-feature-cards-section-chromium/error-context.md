# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e4]: "[plugin:vite:import-analysis] Failed to resolve import \"@deploy/addresses/devnet.json\" from \"src/shared/config/addresses.ts\". Does the file exist?"
  - generic [ref=e5]: /home/ametel/source/horizon-starknet/packages/frontend-solid/src/shared/config/addresses.ts:1:31
  - generic [ref=e6]: 1 | import devnetAddressesRaw from "@deploy/addresses/devnet.json"; | ^ 2 | import forkAddressesRaw from "@deploy/addresses/fork.json"; 3 | import mainnetAddressesRaw from "@deploy/addresses/mainnet.json";
  - generic [ref=e7]: at TransformPluginContext._formatLog (file:///home/ametel/source/horizon-starknet/packages/frontend-solid/node_modules/vinxi/node_modules/vite/dist/node/chunks/dep-D4NMHUTW.js:42528:41) at TransformPluginContext.error (file:///home/ametel/source/horizon-starknet/packages/frontend-solid/node_modules/vinxi/node_modules/vite/dist/node/chunks/dep-D4NMHUTW.js:42525:16) at normalizeUrl (file:///home/ametel/source/horizon-starknet/packages/frontend-solid/node_modules/vinxi/node_modules/vite/dist/node/chunks/dep-D4NMHUTW.js:40504:23) at process.processTicksAndRejections (node:internal/process/task_queues:105:5) at async file:///home/ametel/source/horizon-starknet/packages/frontend-solid/node_modules/vinxi/node_modules/vite/dist/node/chunks/dep-D4NMHUTW.js:40623:37 at async Promise.all (index 0) at async TransformPluginContext.transform (file:///home/ametel/source/horizon-starknet/packages/frontend-solid/node_modules/vinxi/node_modules/vite/dist/node/chunks/dep-D4NMHUTW.js:40550:7) at async EnvironmentPluginContainer.transform (file:///home/ametel/source/horizon-starknet/packages/frontend-solid/node_modules/vinxi/node_modules/vite/dist/node/chunks/dep-D4NMHUTW.js:42323:18) at async loadAndTransform (file:///home/ametel/source/horizon-starknet/packages/frontend-solid/node_modules/vinxi/node_modules/vite/dist/node/chunks/dep-D4NMHUTW.js:35739:27) at async viteTransformMiddleware (file:///home/ametel/source/horizon-starknet/packages/frontend-solid/node_modules/vinxi/node_modules/vite/dist/node/chunks/dep-D4NMHUTW.js:37254:24
  - generic [ref=e8]:
    - text: Click outside, press Esc key, or fix the code to dismiss.
    - text: You can also disable this overlay by setting
    - code [ref=e9]: server.hmr.overlay
    - text: to
    - code [ref=e10]: "false"
    - text: in
    - code [ref=e11]: vite.config.js
    - text: .
```