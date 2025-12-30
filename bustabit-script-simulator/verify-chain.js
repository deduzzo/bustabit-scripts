import { sha256 } from '@noble/hashes/sha2.js';
import { hmac } from '@noble/hashes/hmac.js';
import { hexToBytes, bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

const GAME_SALT = "00000000000000000001e08b7fd44f95e3e950ac65650a8031a6d5e1750e34be";

function gameResult(key, gameHash) {
  const nBits = 52;
  const hash = bytesToHex(hmac(sha256, key, gameHash));
  const seed = hash.slice(0, nBits / 4);
  const r = Number.parseInt(seed, 16);
  let X = r / Math.pow(2, nBits);
  X = 99 / (1 - X);
  const result = Math.floor(X);
  return Math.max(1, result / 100);
}

// Expected data from bustabit verifier
const expectedGames = [
  { id: 12424169, bust: 1.46, hash: '4488d92d89d0ed7fbb2ea23b219d569f63207e32fc44b957858838835c1719f1' },
  { id: 12424168, bust: 5.56, hash: '1f497e8ba3a58b87976a9207a4596c2e00c11494237127f22d0f57785fcadd23' },
  { id: 12424167, bust: 4.71, hash: '9d3bc0c5b47166a06311743240ab79fabf8da8acedc810787ca904c2cdb491f8' },
  { id: 12424166, bust: 41.46, hash: '70857ecd59a239f3589824a993a37c3141bcfec87686a06e65b3c59acf92cf30' },
  { id: 12424165, bust: 1.88, hash: 'edabb8310216cfa6a1b2907fa7593a7ac6607cc5c1d4f865bfc34016718da1d9' },
  { id: 12424164, bust: 9.2, hash: '8d979188df27e1ac5d356e7616265e260a4b5a2e94239e921aac10a5ec080a21' },
  { id: 12424163, bust: 1.16, hash: '40a8b57ce76f70a1a941a3508dc61d200a837bcf5d0589b2a23d172bc3714298' },
  { id: 12424162, bust: 1.55, hash: 'c2afa1058b4635c47cff25bc786490f7474b11cf605ce1afdc44d2c2d0406b32' },
  { id: 12424161, bust: 14.1, hash: 'fca482ef66e40c70662fd002c99c5bb50ea21637484874e01f897ee8e4af130e' },
  { id: 12424160, bust: 1.09, hash: 'f6966d8a5541bcadf0a5066f77fc70d42d0924fc636548a8ee3a81a5352e0605' },
];

console.log('Verifying bustabit game chain...\n');
console.log('Game ID | Expected Bust | Calculated Bust | Hash Match | Status');
console.log('--------|---------------|-----------------|------------|-------');

const saltBytes = utf8ToBytes(GAME_SALT);
let allCorrect = true;

// Verify each game
for (let i = 0; i < expectedGames.length; i++) {
  const expected = expectedGames[i];
  const gameHash = hexToBytes(expected.hash);

  // Calculate bust
  const calculatedBust = gameResult(saltBytes, gameHash);

  // Verify hash chain (each hash should be sha256 of next)
  let hashChainMatch = true;
  if (i < expectedGames.length - 1) {
    const nextGameHash = hexToBytes(expectedGames[i + 1].hash);
    const calculatedPrevHash = bytesToHex(sha256(nextGameHash));
    hashChainMatch = calculatedPrevHash === expected.hash;
  }

  const bustMatch = Math.abs(calculatedBust - expected.bust) < 0.01;
  const status = bustMatch && hashChainMatch ? '✓' : '✗';

  if (!bustMatch || !hashChainMatch) {
    allCorrect = false;
  }

  console.log(
    `${expected.id} | ${expected.bust.toFixed(2)}x | ${calculatedBust.toFixed(2)}x | ${hashChainMatch ? 'YES' : 'NO'} | ${status}`
  );

  if (!bustMatch) {
    console.log(`  └─ Bust mismatch! Expected ${expected.bust}x, got ${calculatedBust}x`);
  }
  if (!hashChainMatch && i < expectedGames.length - 1) {
    console.log(`  └─ Hash chain broken!`);
  }
}

console.log('\n' + (allCorrect ? '✓ All games verified successfully!' : '✗ Some games failed verification'));

// Now test the hash chain generation
console.log('\n--- Testing Hash Chain Generation ---');
let currentHash = hexToBytes(expectedGames[0].hash);
console.log('Starting from game:', expectedGames[0].id);
console.log('Hash:', expectedGames[0].hash);

for (let i = 1; i < expectedGames.length; i++) {
  currentHash = sha256(currentHash);
  const calculatedHash = bytesToHex(currentHash);
  const match = calculatedHash === expectedGames[i].hash;
  console.log(`\nGame ${expectedGames[i].id}:`);
  console.log(`  Expected:   ${expectedGames[i].hash}`);
  console.log(`  Calculated: ${calculatedHash}`);
  console.log(`  Match: ${match ? '✓' : '✗'}`);
}
