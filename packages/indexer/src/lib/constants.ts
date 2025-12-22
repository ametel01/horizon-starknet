/**
 * Contract addresses and configuration per network
 */

export type NetworkConfig = {
  factory: `0x${string}`;
  marketFactory: `0x${string}`;
  router: `0x${string}`;
  startingBlock: number;
  // Known deployed contracts (for factory-pattern indexers to work after restarts)
  knownYTContracts: `0x${string}`[];
  knownSYContracts: `0x${string}`[];
  knownMarkets: `0x${string}`[];
};

export const MAINNET: NetworkConfig = {
  factory: "0x02e7ce691e51fe60b92f25bb845100b4797cd7961647408294a8074fe966f5fd",
  marketFactory:
    "0x014aa95f5c995f57f29f9c6de9d4c245ea231bd695741876c02a887fda8ad9b2",
  router: "0x04d76ca0b5ce4cb9ed2f4a32de04682637f805512ba2afd2d5ab463d61667870",
  startingBlock: 4_556_460, // Horizon mainnet deployment block
  // Known contracts from deploy/addresses/mainnet.json
  knownYTContracts: [
    "0x0125e4070194897078c46cb37731a38e3fff03ac3c2db91758671fc70ca804da", // hrzSTRK YT
  ],
  knownSYContracts: [
    "0x06c6c003bae41be14074ec93659cc8a3af3bbec99c54fd921e1ff68c54a38867", // SY-hrzSTRK
  ],
  knownMarkets: [
    "0x064f967a496330bae100b9931f520054c6d3298f6386d9130cc388a6e9079720", // hrzSTRK Market
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
  factory: "0x06a17d4caceef24805c4827c8f3fdedd365dfcfc5a2d0ebb0c665d60e338f0f7",
  marketFactory:
    "0x05a312e97a580ae4e20356cf8c195b87a4c5745ce1c001e714c6b6324c518e2a",
  router: "0x030808007aeac8be44a3c0d0bd3f3f6af02205f4ef38fc07b4107bc674e58bc7",
  startingBlock: 0,
  // Known contracts from deploy/addresses/devnet.json
  knownYTContracts: [
    "0x05e2fb0f7965d54863b1caadc4326a6e515ed55e01aee0f3021c5d6956a7783e", // nstSTRK YT
    "0x07c2c668685021643253ad05f72df84173430037c0761236d7762e09a3ac105e", // sSTRK YT
    "0x01c5eb1f2f49d645d4f024f59f117d13502a147250c93791ccebfa80d0d4cae9", // wstETH YT
  ],
  knownSYContracts: [
    "0x03d9a5277800d6b9bf6e8ce43ced73ee91a343a0481de716ef4fa8ac1b9a4dc3", // SY-nstSTRK
    "0x04fe75f4082ce83ac94736c9fc05f465a5d3aba1606b8387167d0614a7752a42", // SY-sSTRK
    "0x01a6bfced4b29533bb4f68ae2edd0807ca283bd6591dd20183fc16421578ee6f", // SY-wstETH
  ],
  knownMarkets: [
    "0x0382a6cb6b0703db78b0bd19e18dc0de277bd99e6f489bef1975834c05443f48", // nstSTRK Market
    "0x04de4a8983b6cf35e36e70d3677be9bfb74ab24ef7d26e4beb793e90fdce6d1a", // sSTRK Market
    "0x0575cb615ebdd49d872ca2a41cc8c6437f7166758d8c38bb20386d6b561ab58f", // wstETH Market
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
