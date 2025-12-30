import { generateGameResults } from './src/data/newProvablyFair.js';

// L'utente vuole simulare 10 giochi che FINISCONO con il game #12424169
const endHash = '4488d92d89d0ed7fbb2ea23b219d569f63207e32fc44b957858838835c1719f1';

console.log('User wants to simulate 10 games ENDING at:');
console.log('Hash:', endHash);
console.log('');

const results = generateGameResults(endHash, 10);

// Expected data: dal più vecchio (#12424160) al più recente (#12424169)
const expectedGames = [
  { id: 12424160, bust: 1.09, hash: 'f6966d8a5541bcadf0a5066f77fc70d42d0924fc636548a8ee3a81a5352e0605' },
  { id: 12424161, bust: 14.1, hash: 'fca482ef66e40c70662fd002c99c5bb50ea21637484874e01f897ee8e4af130e' },
  { id: 12424162, bust: 1.55, hash: 'c2afa1058b4635c47cff25bc786490f7474b11cf605ce1afdc44d2c2d0406b32' },
  { id: 12424163, bust: 1.16, hash: '40a8b57ce76f70a1a941a3508dc61d200a837bcf5d0589b2a23d172bc3714298' },
  { id: 12424164, bust: 9.2, hash: '8d979188df27e1ac5d356e7616265e260a4b5a2e94239e921aac10a5ec080a21' },
  { id: 12424165, bust: 1.88, hash: 'edabb8310216cfa6a1b2907fa7593a7ac6607cc5c1d4f865bfc34016718da1d9' },
  { id: 12424166, bust: 41.46, hash: '70857ecd59a239f3589824a993a37c3141bcfec87686a06e65b3c59acf92cf30' },
  { id: 12424167, bust: 4.71, hash: '9d3bc0c5b47166a06311743240ab79fabf8da8acedc810787ca904c2cdb491f8' },
  { id: 12424168, bust: 5.56, hash: '1f497e8ba3a58b87976a9207a4596c2e00c11494237127f22d0f57785fcadd23' },
  { id: 12424169, bust: 1.46, hash: '4488d92d89d0ed7fbb2ea23b219d569f63207e32fc44b957858838835c1719f1' },
];

console.log('Simulation order (oldest to newest):');
console.log('Game ID  | Bust  | Hash Match | Status');
console.log('---------|-------|------------|-------');

let allMatch = true;
for (let i = 0; i < results.length; i++) {
  const expected = expectedGames[i];
  const calculated = results[i];

  const bustMatch = Math.abs(calculated.bust - expected.bust) < 0.01;
  const hashMatch = calculated.hash === expected.hash;
  const match = bustMatch && hashMatch;

  if (!match) allMatch = false;

  const gameId = expected.id.toString().padStart(8);
  const bust = expected.bust.toFixed(2).padEnd(5);
  const status = match ? '✓' : '✗';

  console.log(`${gameId} | ${bust} | ${hashMatch ? 'YES' : 'NO '}        | ${status}`);

  if (!bustMatch) {
    console.log(`         └─ Bust mismatch! Expected ${expected.bust}, got ${calculated.bust}`);
  }
  if (!hashMatch) {
    console.log(`         └─ Hash mismatch!`);
    console.log(`            Expected:   ${expected.hash}`);
    console.log(`            Calculated: ${calculated.hash}`);
  }
}

console.log('');
console.log('IMPORTANT CHECKS:');
console.log('First game (oldest):', results[0].hash.slice(0, 16) + '...');
console.log('Last game (newest, user\'s hash):', results[9].hash.slice(0, 16) + '...');
console.log('User provided:', endHash.slice(0, 16) + '...');
console.log('Last game matches user hash?', results[9].hash === endHash ? '✓ YES' : '✗ NO');
console.log('');
console.log(allMatch ? '✓ All games match perfectly!' : '✗ Some games do not match');
