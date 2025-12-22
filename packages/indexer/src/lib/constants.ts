/**
 * Contract addresses and configuration per network
 */

export type NetworkConfig = {
  factory: `0x${string}`;
  marketFactory: `0x${string}`;
  router: `0x${string}`;
  startingBlock: number;
};

export const MAINNET: NetworkConfig = {
  factory: "0x02e7ce691e51fe60b92f25bb845100b4797cd7961647408294a8074fe966f5fd",
  marketFactory:
    "0x014aa95f5c995f57f29f9c6de9d4c245ea231bd695741876c02a887fda8ad9b2",
  router: "0x04d76ca0b5ce4cb9ed2f4a32de04682637f805512ba2afd2d5ab463d61667870",
  startingBlock: 4_556_000, // Horizon mainnet deployment block
};

export const SEPOLIA: NetworkConfig = {
  factory: "0x00f6b0761a883e86e3d4a1c908e5b09b37c7c0a9ebf893d9287b1fbe011d0033",
  marketFactory:
    "0x024cde81f6c21ae3e1cc911a573dc28f1f6acea8039fdcb27a9cdcc41488546e",
  router: "0x036d91febd5235683cb2d12c0918e4ca6150f97e49075b73a8907af61eadd8aa",
  startingBlock: 4_194_445, // Match DNA_INGESTION_DANGEROUSLY_OVERRIDE_STARTING_BLOCK
};

export const DEVNET: NetworkConfig = {
  factory: "0x06a17d4caceef24805c4827c8f3fdedd365dfcfc5a2d0ebb0c665d60e338f0f7", // Will be set after deployment
  marketFactory:
    "0x05a312e97a580ae4e20356cf8c195b87a4c5745ce1c001e714c6b6324c518e2a",
  router: "0x030808007aeac8be44a3c0d0bd3f3f6af02205f4ef38fc07b4107bc674e58bc7",
  startingBlock: 0,
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
