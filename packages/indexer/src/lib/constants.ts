/**
 * Contract addresses and configuration per network
 */

export interface NetworkConfig {
  factory: `0x${string}`;
  marketFactory: `0x${string}`;
  router: `0x${string}`;
  startingBlock: number;
  // Known deployed contracts (for factory-pattern indexers to work after restarts)
  knownYTContracts: `0x${string}`[];
  knownSYContracts: `0x${string}`[];
  knownMarkets: `0x${string}`[];
}

export const MAINNET: NetworkConfig = {
  factory: "0x04fd6d42072f76612ae0a5f97d191ab4c5ede3688d2df0185352e01b7f2fc444",
  marketFactory:
    "0x0465bc423ddde2495e9d4c31563e0b333d9c8b818a86d3d76064fd652ee4be6f",
  router: "0x07ccd371e51703e562cf7c7789d4252b7a63845dc87f25a07cf8b5c28e80563b",
  startingBlock: 4_643_300, // Horizon mainnet deployment block (2025-12-23)
  // Known contracts from deploy/addresses/mainnet.json
  knownYTContracts: [
    "0x070c396667613d74cb473ad937d717355222c76a41d3a1d2b34299eefda6405d", // hrzSTRK YT
  ],
  knownSYContracts: [
    "0x0601a6717bedf8010f68ec2e4993ea12c208ed949ed76b33b616add725dbc15c", // SY-hrzSTRK
  ],
  knownMarkets: [
    "0x004d2f052b91f5c744e67816e72e426cab538661deda0d38143a9cefad973c18", // hrzSTRK Market
  ],
};

export const SEPOLIA: NetworkConfig = {
  factory: "0x00f6b0761a883e86e3d4a1c908e5b09b37c7c0a9ebf893d9287b1fbe011d0033",
  marketFactory:
    "0x024cde81f6c21ae3e1cc911a573dc28f1f6acea8039fdcb27a9cdcc41488546e",
  router: "0x036d91febd5235683cb2d12c0918e4ca6150f97e49075b73a8907af61eadd8aa",
  startingBlock: 4_194_445, // Match DNA_INGESTION_DANGEROUSLY_OVERRIDE_STARTING_BLOCK
  // Known contracts from deploy/addresses/sepolia.json
  knownYTContracts: [
    "0x0595db5e6daa41b9d888bcf1765f23e866323a1f43f9ed8b0be20f1075ec4ba6", // nstSTRK YT
    "0x004045dc1f51548dee2f5fc41a6d0e5cc13c949ad0b4118a19d772a358dc717f", // sSTRK YT
    "0x011f2f15f438850fbbbd584c7e1c0707d48fd4670225f9e61f8cb678a608ed02", // wstETH YT
  ],
  knownSYContracts: [
    "0x057a93b798e5891c2a2f6ccc77f5357ecf95592d882a80af13f9f92994ce8fa6", // SY-nstSTRK
    "0x05bf68285c7aee4e12b78cbdde18aee0f0e04ed3d0d2742014970d33365ca430", // SY-sSTRK
    "0x04c292bdb11e0df67834a234c8a9129469a2a138789e3e7e7b4859f14b9ec00c", // SY-wstETH
  ],
  knownMarkets: [
    "0x0433adacb011cdde4bed36494ef9d742cbcbc29ad0a331bfe8db4243e90a3e98", // nstSTRK Market
    "0x07d65f79294b6fd9eea67b0859d97f993d9adeb50def8bc3f63a3438d7e27a8e", // sSTRK Market
    "0x078b27891eab0224898ca40d6f764122823497b3260c05d16c8c0940b95205bd", // wstETH Market
  ],
};

export const DEVNET: NetworkConfig = {
  factory: "0x00893e6062346f58b31c8b12a1a43109520154e9c25b4c8f7f70a2ef0248ffcc",
  marketFactory:
    "0x036ca9bb1231eab175282fd183329ffad8d3d963066057d406d39a0e89c3ce5a",
  router: "0x03b3709282cf4b5ee496889e2c9ed68a872364ce8e5d03a90532d5e4252d5fa4",
  startingBlock: 0,
  // Known contracts from deploy/addresses/devnet.json (2026-01-03)
  // Note: Markets show 0x0 in devnet.json - they are discovered dynamically from MarketFactory events
  knownYTContracts: [
    "0x0143a74315e0a5519be7828443e9c3e5b7bce7eb844852ac8e3818fe55c41db2", // nstSTRK YT
    "0x04ef0885b582b110ddde49c5a5e4b4426d0e71afbb18310c8f0acd20b13ec694", // sSTRK YT
    "0x02aae9f4cfea1383b91ee522e5af61ba42f2237c2a07c7ebadb5ac1e3f644821", // wstETH YT
  ],
  knownSYContracts: [
    "0x00afa4b40deaa0ee8307de627dd03c6b61a38a31942f1bfed67fe9c63efe0c12", // SY-nstSTRK
    "0x0543759da00b9eab75f09c380feb2a9c2703ad6b297e9278f64971d498bbd6b6", // SY-sSTRK
    "0x0514f39b7c1db7c5ac1ead7413aea2b6f81ede469319ab7591761863bdad8266", // SY-wstETH
  ],
  knownMarkets: [
    // Markets are discovered dynamically from MarketFactory.MarketCreated events
    // devnet.json shows 0x0 for markets - they are created after initial deploy
  ],
};

/**
 * Get network config based on preset name
 */
export function getNetworkConfig(preset?: string): NetworkConfig {
  switch (preset) {
    case "mainnet":
      return MAINNET;
    case "sepolia":
      return SEPOLIA;
    case "devnet":
      return DEVNET;
    default:
      return MAINNET;
  }
}
