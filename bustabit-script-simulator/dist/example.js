/**
 * Example usage of the seeding algorithm functions.
 *
 * This file demonstrates how to use the verifyInChain, validateSignature,
 * and gameResult functions.
 */
import { hexToBytes } from "@noble/hashes/utils";
import { verifyInChain, validateSignature, gameResult } from "./seeding.js";
console.log("=== Bustabit Seeding Algorithm Examples ===\n");
// Example 1: Verify a hash is in the chain
console.log("Example 1: Verify hash in chain");
console.log("-".repeat(50));
const exampleHash = hexToBytes("70eed5c29bde5132f4e41ec8b117a31533e5b055c6c21174d932b377a1855a04");
const gameId = verifyInChain(exampleHash);
if (gameId) {
    console.log(`✓ Hash is in the chain. It is game: ${gameId}`);
}
else {
    console.log("✗ Hash is not in the chain");
}
console.log();
// Example 2: Validate a signature
console.log("Example 2: Validate VX signature");
console.log("-".repeat(50));
// Note: These are placeholder values for demonstration
const gameSalt = "abc123def456"; // Would be the hash of Bitcoin block 831500
const prevGameHash = hexToBytes("70eed5c29bde5132f4e41ec8b117a31533e5b055c6c21174d932b377a1855a04");
// This would be a real VX signature in practice
const placeholderSignature = new Uint8Array(96); // BLS signatures are 96 bytes
console.log("Note: Using placeholder signature for demonstration");
const isValid = validateSignature(gameSalt, prevGameHash, placeholderSignature);
console.log(`Signature valid: ${isValid ? "✓" : "✗"}`);
console.log();
// Example 3: Calculate game result
console.log("Example 3: Calculate game result");
console.log("-".repeat(50));
// Using placeholder values for demonstration
const vxSignature = new Uint8Array(96);
const gameHash = hexToBytes("70eed5c29bde5132f4e41ec8b117a31533e5b055c6c21174d932b377a1855a04");
const crashPoint = gameResult(vxSignature, gameHash);
console.log(`Crash point: ${crashPoint.toFixed(2)}x`);
console.log();
console.log("=== Examples Complete ===");
//# sourceMappingURL=example.js.map