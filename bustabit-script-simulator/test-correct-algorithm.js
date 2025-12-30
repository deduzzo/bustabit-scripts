import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { hexToBytes, bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

const GAME_SALT = "00000000000000000001e08b7fd44f95e3e950ac65650a8031a6d5e1750e34be";

function gameResult(key, gameHash) {
  const nBits = 52;

  // 1. HMAC_SHA256(key=salt, message=hash)
  const hash = bytesToHex(hmac(sha256, key, gameHash));

  // 2. r = 52 most significant bits
  const seed = hash.slice(0, nBits / 4);
  const r = Number.parseInt(seed, 16);

  // 3. X = r / 2^52
  let X = r / Math.pow(2, nBits);

  // 4. X = 99 / (1 - X)
  X = 99 / (1 - X);

  // 5. return max(trunc(X), 100)
  const result = Math.floor(X);
  return Math.max(1, result / 100);
}

const testHash = '4488d92d89d0ed7fbb2ea23b219d569f63207e32fc44b957858838835c1719f1';
const gameHash = hexToBytes(testHash);
const saltBytes = utf8ToBytes(GAME_SALT);

console.log('Game Hash:', testHash);
console.log('Game Salt (UTF-8):', GAME_SALT);
console.log('');

const bust = gameResult(saltBytes, gameHash);
console.log('Calculated Bust:', bust, 'x');
console.log('Expected:', 1.46, 'x');
console.log('Match:', bust === 1.46 ? 'YES ✓' : 'NO ✗');

// Debug step by step
console.log('\n--- Debug ---');
const hash = bytesToHex(hmac(sha256, saltBytes, gameHash));
console.log('HMAC result:', hash);
const seed = hash.slice(0, 13);
console.log('First 13 hex chars:', seed);
const r = Number.parseInt(seed, 16);
console.log('r:', r);
let X = r / Math.pow(2, 52);
console.log('X = r / 2^52:', X);
X = 99 / (1 - X);
console.log('X = 99 / (1 - X):', X);
const result = Math.floor(X);
console.log('floor(X):', result);
console.log('result / 100:', result / 100);
