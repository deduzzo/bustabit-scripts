import { hmac } from '@noble/hashes/hmac';
import { sha256 } from '@noble/hashes/sha256';
import { Input, bytesToHex } from '@noble/hashes/utils';

export function gameResult(key: Input, gameHash: Uint8Array) {
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
