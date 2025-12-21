#!/usr/bin/env bun
/**
 * Generate events-only ABIs from full contract ABIs
 *
 * This script extracts only event definitions and their required struct
 * dependencies from the full contract ABIs. This minimizes the ABI size
 * for the indexer which only needs to decode events.
 *
 * Usage: bun run scripts/generate-events-abi.ts
 */

import { existsSync, mkdirSync, readdirSync, writeFileSync } from "fs";
import { join } from "path";

// Configuration
const FRONTEND_ABI_DIR = join(
  import.meta.dir,
  "../../frontend/src/types/generated"
);
const OUTPUT_DIR = join(import.meta.dir, "../src/lib/abi");

// Contracts to process for events
const CONTRACTS = [
  "Factory",
  "MarketFactory",
  "Router",
  "Market",
  "SY",
  "PT",
  "YT",
] as const;

type AbiItem = {
  type: string;
  name: string;
  kind?: string;
  members?: Array<{ name: string; type: string; kind?: string }>;
  variants?: Array<{ name: string; type: string; kind?: string }>;
};

function extractReferencedTypes(members: AbiItem["members"]): Set<string> {
  const types = new Set<string>();
  if (!members) return types;

  for (const member of members) {
    // Add the type itself
    types.add(member.type);

    // Handle generic types like Span<T>, Array<T>, Option<T>
    const genericMatch = member.type.match(/<(.+)>/);
    if (genericMatch) {
      types.add(genericMatch[1]);
    }

    // Handle tuple types like (T1, T2)
    const tupleMatch = member.type.match(/^\((.+)\)$/);
    if (tupleMatch) {
      const innerTypes = tupleMatch[1].split(",").map((t) => t.trim());
      for (const t of innerTypes) {
        types.add(t);
      }
    }
  }

  return types;
}

function isHorizonEvent(item: AbiItem): boolean {
  return item.type === "event" && item.name.startsWith("horizon::");
}

function isStructEvent(item: AbiItem): boolean {
  return item.type === "event" && item.kind === "struct";
}

function processContract(name: string): boolean {
  const inputPath = join(FRONTEND_ABI_DIR, `${name}.ts`);

  if (!existsSync(inputPath)) {
    console.warn(`  Skipping ${name}: file not found`);
    return false;
  }

  // Import the ABI module
  const abiModule = require(inputPath);
  const abiName = `${name.toUpperCase()}_ABI`;
  const fullAbi: AbiItem[] = abiModule[abiName];

  if (!fullAbi || !Array.isArray(fullAbi)) {
    console.warn(`  Skipping ${name}: ABI not found or invalid`);
    return false;
  }

  // Step 1: Find all Horizon events (struct kind only, not enum wrappers)
  const horizonEvents = fullAbi.filter(
    (item) => isHorizonEvent(item) && isStructEvent(item)
  );

  if (horizonEvents.length === 0) {
    console.log(`  ${name}: No Horizon events found`);
    return false;
  }

  // Step 2: Collect all types referenced by events
  const referencedTypes = new Set<string>();
  for (const event of horizonEvents) {
    const types = extractReferencedTypes(event.members);
    for (const t of types) {
      referencedTypes.add(t);
    }
  }

  // Step 3: Find struct definitions for referenced types
  const requiredStructs: AbiItem[] = [];
  const structsToProcess = [...referencedTypes];
  const processedStructs = new Set<string>();

  while (structsToProcess.length > 0) {
    const typeName = structsToProcess.pop()!;
    if (processedStructs.has(typeName)) continue;
    processedStructs.add(typeName);

    const struct = fullAbi.find(
      (item) => item.type === "struct" && item.name === typeName
    );
    if (struct) {
      requiredStructs.push(struct);
      // Also check for nested types in this struct
      const nestedTypes = extractReferencedTypes(struct.members);
      for (const t of nestedTypes) {
        if (!processedStructs.has(t)) {
          structsToProcess.push(t);
        }
      }
    }
  }

  // Step 4: Build the events-only ABI (structs first, then events)
  const eventsAbi = [...requiredStructs, ...horizonEvents];

  // Step 5: Write output as JSON (for easy import)
  const outputPath = join(OUTPUT_DIR, `${name.toLowerCase()}.json`);
  writeFileSync(outputPath, JSON.stringify(eventsAbi, null, 2));

  console.log(
    `  ${name}: ${horizonEvents.length} events, ${requiredStructs.length} structs`
  );

  return true;
}

function main(): void {
  console.log("Generating events-only ABIs for indexer...\n");

  if (!existsSync(FRONTEND_ABI_DIR)) {
    console.error(`Frontend ABIs not found: ${FRONTEND_ABI_DIR}`);
    console.log("Run 'bun run codegen' in packages/frontend first.");
    process.exit(1);
  }

  // Create output directory
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const processedContracts: string[] = [];

  for (const contract of CONTRACTS) {
    const result = processContract(contract);
    if (result) {
      processedContracts.push(contract);
    }
  }

  // Generate index file only for contracts with events
  const imports = processedContracts.map(
    (c) =>
      `import ${c.toLowerCase()}Abi from "./${c.toLowerCase()}.json" with { type: "json" };`
  );

  const exports = processedContracts.map((c) => {
    const exportName =
      c === "MarketFactory"
        ? "MARKET_FACTORY_EVENTS_ABI"
        : `${c.toUpperCase()}_EVENTS_ABI`;
    return `export const ${exportName} = ${c.toLowerCase()}Abi;`;
  });

  const indexContent = `// Auto-generated events-only ABIs for Horizon Protocol
// Generated by: bun run codegen
// Only includes Horizon-specific events and required struct definitions

${imports.join("\n")}

${exports.join("\n")}
`;

  writeFileSync(join(OUTPUT_DIR, "index.ts"), indexContent);

  console.log(`\nOutput: ${OUTPUT_DIR}`);
}

main();
