// Test del nuovo algoritmo con @noble/hashes
import { sha256 } from '@noble/hashes/sha2.js';
import { hmac } from '@noble/hashes/hmac.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';

// Nuovo algoritmo
function gameResult(vxSignature, gameHash) {
  const nBits = 52;

  // 1. HMAC_SHA256(key=signature, message=hash)
  const hash = bytesToHex(hmac(sha256, vxSignature, gameHash));

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

// Per testare, abbiamo bisogno di una firma VX
// L'hash del gioco che ci hai dato
const gameHash = hexToBytes('4488d92d89d0ed7fbb2ea23b219d569f63207e32fc44b957858838835c1719f1');

// Dobbiamo avere la firma VX corrispondente per calcolare il risultato
// Per ora simuliamo con una firma mock
const mockSignature = sha256(gameHash); // Questo è solo per test

console.log('Game Hash:', bytesToHex(gameHash));
console.log('Mock Signature:', bytesToHex(mockSignature));

const result = gameResult(mockSignature, gameHash);
console.log('Result with mock signature:', result);

// Per ottenere 1.46x, dobbiamo trovare quale firma VX produce quel risultato
// Proviamo a invertire il calcolo
console.log('\n--- Target: 1.46x ---');
const targetBust = 1.46;
// result / 100 = 1.46
// result = 146
// floor(X) = 146
// X = 99 / (1 - r/2^52)
// X ≈ 146
// 99 / (1 - r/2^52) = 146
// 99 = 146 * (1 - r/2^52)
// 99/146 = 1 - r/2^52
// r/2^52 = 1 - 99/146
// r/2^52 ≈ 0.3219

const targetX = 146; // floor(X) dovrebbe essere 146
const targetRatio = 1 - (99 / targetX);
console.log('Target r/2^52:', targetRatio);
const targetR = targetRatio * Math.pow(2, 52);
console.log('Target r:', targetR);
const targetHex = Math.floor(targetR).toString(16).padStart(13, '0');
console.log('Target hex (first 13 chars of HMAC):', targetHex);
