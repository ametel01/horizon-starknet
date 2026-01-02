/**
 * Test DNA connection to verify token works
 */

import { createAuthenticatedClient } from "@apibara/protocol";
import { StarknetStream } from "@apibara/starknet";

import { createScriptLogger } from "../src/lib/logger";

const log = createScriptLogger("test-dna-connection");

async function testConnection() {
  const streamUrl = "https://mainnet.starknet.a5a.ch";
  const dnaToken = process.env["DNA_TOKEN"];

  log.info(
    { streamUrl, tokenSet: Boolean(dnaToken) },
    "Testing DNA connection..."
  );

  if (!dnaToken) {
    log.fatal("DNA_TOKEN environment variable is required");
    process.exit(1);
  }

  try {
    const client = createAuthenticatedClient(StarknetStream, streamUrl);

    log.info("Fetching stream status...");
    const status = await client.status();

    log.info(
      { currentBlock: status.currentHead?.orderKey?.toString() },
      "Connection successful"
    );
  } catch (error) {
    log.fatal({ error }, "Connection failed");
    process.exit(1);
  }
}

testConnection();
