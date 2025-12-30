// Test script to verify hash calculation
const CryptoJS = require('crypto-js');

// Old algorithm (legacy)
function hashToBustOld(seed) {
  const nBits = 52;
  const hmac = CryptoJS.HmacSHA256(CryptoJS.enc.Hex.parse(seed), '0000000000000000004d6ec16dafe9d8370958664c1dc422f452892264c59526');
  let hash = hmac.toString(CryptoJS.enc.Hex);
  hash = hash.slice(0, nBits / 4);
  const r = parseInt(hash, 16);
  let X = r / Math.pow(2, nBits);
  X = 99 / (1 - X);
  const result = Math.floor(X);
  return Math.max(1, result / 100);
}

// Test hash
const testHash = '4488d92d89d0ed7fbb2ea23b219d569f63207e32fc44b957858838835c1719f1';
const expectedBust = 1.46;

console.log('Testing hash:', testHash);
console.log('Expected bust:', expectedBust);
console.log('Calculated bust (old algorithm):', hashToBustOld(testHash));

// Let's also calculate step by step to debug
console.log('\n--- Step by step calculation ---');
const nBits = 52;
const hmac = CryptoJS.HmacSHA256(CryptoJS.enc.Hex.parse(testHash), '0000000000000000004d6ec16dafe9d8370958664c1dc422f452892264c59526');
const hmacHex = hmac.toString(CryptoJS.enc.Hex);
console.log('1. HMAC result:', hmacHex);

const seed = hmacHex.slice(0, nBits / 4);
console.log('2. First 13 hex chars:', seed);

const r = parseInt(seed, 16);
console.log('3. Integer r:', r);

let X = r / Math.pow(2, nBits);
console.log('4. X = r / 2^52:', X);

X = 99 / (1 - X);
console.log('5. X = 99 / (1 - X):', X);

const result = Math.floor(X);
console.log('6. floor(X):', result);

const bust = Math.max(1, result / 100);
console.log('7. Final bust:', bust);
