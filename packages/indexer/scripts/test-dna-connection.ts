/**
 * Test DNA connection to verify token works
 */

import { createAuthenticatedClient } from "@apibara/protocol";
import { StarknetStream } from "@apibara/starknet";

async function testConnection() {
  const streamUrl = "https://mainnet.starknet.a5a.ch";
  const dnaToken = process.env.DNA_TOKEN;

  console.log("Testing DNA connection...");
  console.log(`Stream URL: ${streamUrl}`);
  console.log(`DNA_TOKEN: ${dnaToken ? "set" : "NOT SET"}`);

  if (!dnaToken) {
    console.error("❌ DNA_TOKEN environment variable is required");
    process.exit(1);
  }

  try {
    const client = createAuthenticatedClient(StarknetStream, streamUrl);

    console.log("Fetching stream status...");
    const status = await client.status();

    console.log("✅ Connection successful!");
    console.log("Current block:", status.currentHead?.orderKey?.toString());
  } catch (error) {
    console.error("❌ Connection failed:", error);
    process.exit(1);
  }
}

testConnection();
