import "apibara/types";

declare module "apibara/types" {
  interface ApibaraRuntimeConfig {
    network?: "mainnet" | "sepolia" | "devnet";
  }
}
