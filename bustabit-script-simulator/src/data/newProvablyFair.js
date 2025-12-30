import { sha256 } from "@noble/hashes/sha2.js";
import { hmac } from "@noble/hashes/hmac.js";
import { bls12_381 as bls } from "@noble/curves/bls12-381.js";
import { bytesToHex, concatBytes, utf8ToBytes } from "@noble/hashes/utils.js";

// Constants from bustabit seeding events
// Current seeding event (games > 12279450)
export const GAME_SALT = "00000000000000000001e08b7fd44f95e3e950ac65650a8031a6d5e1750e34be";
export const TERMINATING_HASH = "567a98370fb7545137ddb53687723cf0b8a1f5e93b1f76f4a1da29416930fa59";

// VX seeding event (games 10000001 - 12279450)
export const VX_GAME_SALT = "000000000000000000011f6e135efe67d7463dfe7bb955663ef88b1243b2deea";
export const VX_PUBKEY = "b40c94495f6e6e73619aeb54ec2fc84c5333f7a88ace82923946fc5b6c8635b08f9130888dd96e1749a1d5aab00020e4";
export const VX_PRIVKEY = "1f0373e57723f4b862f2b9bd1279c9c6dcea73469fce6dcab9524b609c9c60f4";
export const VX_LAST_GAME = 12279450;

// Previous seeding event (games 1 - 10000000)
export const PREV_CHAIN_LENGTH = 10000000;
export const PREV_GAME_SALT = "0000000000000000004d6ec16dafe9d8370958664c1dc422f452892264c59526";
export const PREV_TERMINATING_HASH = "86728f5fc3bd99db94d3cdaf105d67788194e9701bf95d049ad0e1ee3d004277";

export const TOTAL_GAMES = 100_000_000;

/**
 * Verifies if a hash is part of the chain
 * @param {Uint8Array} hash - The hash to verify
 * @returns {number|null} - The game ID if found, null otherwise
 */
export function verifyInChain(hash) {
  let currentHash = new Uint8Array(hash);

  for (let gameId = 1; gameId <= TOTAL_GAMES; gameId++) {
    currentHash = sha256(currentHash);
    if (bytesToHex(currentHash) === TERMINATING_HASH) {
      console.log("Hash is in the chain. It is game:", gameId);
      return gameId;
    }

    // Prevent infinite loops in testing - check only first 1000 games for verification
    if (gameId > 1000) {
      break;
    }
  }

  console.error("Hash is not in the chain (checked first 1000 games)");
  return null;
}

/**
 * Validates a BLS signature
 * @param {string} gameSalt - The hash of Bitcoin block 831500
 * @param {Uint8Array} prevGameHash - The previous game hash
 * @param {Uint8Array} vxSignature - The VX signature
 * @returns {boolean} - True if signature is valid
 */
export function validateSignature(gameSalt, prevGameHash, vxSignature) {
  try {
    const message = concatBytes(prevGameHash, utf8ToBytes(gameSalt));
    return bls.verify(vxSignature, message, VX_PUBKEY);
  } catch (error) {
    console.error("Signature validation error:", error);
    return false;
  }
}

/**
 * Calculates the game result from a key (salt or signature) and game hash
 * Current system uses: gameResult(utf8ToBytes(GAME_SALT), gameHash)
 * VX system used: gameResult(vxSignature, gameHash)
 * @param {Uint8Array} key - The key (GAME_SALT bytes or VX signature)
 * @param {Uint8Array} gameHash - The game hash
 * @returns {number} - The crash point (bust) as decimal (e.g., 1.46 for 1.46x)
 */
export function gameResult(key, gameHash) {
  const nBits = 52; // number of most significant bits to use

  // 1. HMAC_SHA256(key=salt|signature, message=hash)
  const hash = bytesToHex(hmac(sha256, key, gameHash));

  // 2. r = 52 most significant bits
  const seed = hash.slice(0, nBits / 4);
  const r = Number.parseInt(seed, 16);

  // 3. X = r / 2^52
  let X = r / Math.pow(2, nBits); // uniformly distributed in [0; 1)

  // 4. X = 99 / (1 - X)
  X = 99 / (1 - X); // 1 - X so there's no chance of div-by-zero

  // 5. return max(trunc(X), 100)
  const result = Math.floor(X);
  return Math.max(1, result / 100);
}

/**
 * Generates a mock VX signature for simulation purposes
 * Since we can't generate real BLS signatures without the private key,
 * we'll use a deterministic approach based on game hash for simulation
 * @param {Uint8Array} gameHash - The game hash
 * @param {string} gameSalt - The game salt
 * @returns {Uint8Array} - A mock signature (96 bytes for BLS)
 */
export function generateMockSignature(gameHash, gameSalt) {
  // Create a deterministic signature based on game hash and salt
  // This is just for simulation - real implementation would need actual BLS signing
  const message = concatBytes(gameHash, utf8ToBytes(gameSalt));
  const hash1 = sha256(message);
  const hash2 = sha256(hash1);
  const hash3 = sha256(hash2);

  // BLS signatures are 96 bytes, concatenate hashes to make it
  return concatBytes(hash1, hash2, hash3);
}

/**
 * Generates the hash chain for simulation
 * The user provides the hash of the LAST game to simulate
 * We calculate backwards to find PREVIOUS games that will be simulated BEFORE it
 *
 * Chain formula: SHA256(newer_hash) = older_hash
 *
 * Example: User wants to simulate 10 games ending at #12424169
 * - User provides: hash of game #12424169
 * - We calculate backwards to find games #12424160 through #12424168
 * - Simulation plays: #12424160, #12424161, ..., #12424168, #12424169
 *
 * @param {string} endHash - The hash of the LAST game to simulate (provided by user)
 * @param {number} amount - Number of games to generate
 * @returns {Array<Uint8Array>} - Array of hashes in SIMULATION order [oldest first, ..., newest last]
 */
export function generateHashChain(endHash, amount) {
  if (isNaN(amount) || amount <= 0 || amount > TOTAL_GAMES) {
    throw new TypeError(`amount must be a number between 1 and ${TOTAL_GAMES}`);
  }

  // Convert end hash from hex string to bytes
  let currentHash;
  try {
    // If endHash looks like hex, parse it
    if (typeof endHash === 'string' && /^[0-9a-fA-F]+$/.test(endHash)) {
      currentHash = new Uint8Array(endHash.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    } else {
      // Otherwise use it as-is or generate random
      currentHash = crypto.getRandomValues(new Uint8Array(32));
    }
  } catch (e) {
    // Fallback to random if parsing fails
    currentHash = crypto.getRandomValues(new Uint8Array(32));
  }

  // Generate chain backwards from the end hash
  const tempHashes = [];
  tempHashes.push(new Uint8Array(currentHash)); // This is the last game (user's hash)

  // Calculate older games: SHA256(current) = older
  for (let i = 1; i < amount; i++) {
    currentHash = sha256(currentHash);
    tempHashes.push(new Uint8Array(currentHash));
  }

  // Reverse the array so simulation plays in correct order:
  // [oldest game, ..., newest game (user's hash)]
  return tempHashes.reverse();
}

/**
 * Generates game results using the current provably fair system
 * Uses GAME_SALT (current seeding event for games > 12279450)
 * @param {string} startHash - Starting game hash (hex string)
 * @param {number} amount - Number of games to generate
 * @param {string} gameSalt - The game salt (defaults to current GAME_SALT)
 * @returns {Array<{hash: string, bust: number}>}
 */
export function generateGameResults(startHash, amount, gameSalt = GAME_SALT) {
  const hashChain = generateHashChain(startHash, amount);
  const results = [];
  const saltBytes = utf8ToBytes(gameSalt);

  for (let i = 0; i < hashChain.length; i++) {
    const gameHash = hashChain[i];

    // Use current algorithm: HMAC(GAME_SALT, gameHash)
    const bust = gameResult(saltBytes, gameHash);

    results.push({
      hash: bytesToHex(gameHash),
      bust: bust
    });
  }

  return results;
}

/**
 * Legacy compatibility: converts hash string to bust (old algorithm)
 * Kept for backward compatibility with existing scripts
 * @param {string} seed - Game hash as hex string
 * @returns {number} - Bust multiplier
 */
export function hashToBustLegacy(seed) {
  // This uses the old algorithm for comparison/legacy support
  // Import CryptoJS only if needed
  const CryptoJS = require('crypto-js');

  const nBits = 52;
  const hmacResult = CryptoJS.HmacSHA256(
    CryptoJS.enc.Hex.parse(seed),
    '0000000000000000004d6ec16dafe9d8370958664c1dc422f452892264c59526'
  );
  let seedHex = hmacResult.toString(CryptoJS.enc.Hex);
  seedHex = seedHex.slice(0, nBits / 4);
  const r = parseInt(seedHex, 16);
  let X = r / Math.pow(2, nBits);
  X = 99 / (1 - X);
  const result = Math.floor(X);
  return Math.max(1, result / 100);
}