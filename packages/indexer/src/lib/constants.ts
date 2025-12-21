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
  startingBlock: 800_000,
};

export const SEPOLIA: NetworkConfig = {
  factory: "0x00f6b0761a883e86e3d4a1c908e5b09b37c7c0a9ebf893d9287b1fbe011d0033",
  marketFactory:
    "0x024cde81f6c21ae3e1cc911a573dc28f1f6acea8039fdcb27a9cdcc41488546e",
  router: "0x036d91febd5235683cb2d12c0918e4ca6150f97e49075b73a8907af61eadd8aa",
  startingBlock: 100_000,
};

export const DEVNET: NetworkConfig = {
  factory: "0x0", // Will be set after deployment
  marketFactory: "0x0",
  router: "0x0",
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
