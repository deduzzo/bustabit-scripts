/**
 * Test con la salt corretta
 */
const crypto = require('crypto');

function crashPointFromHash(serverSeed, salt) {
    // Step 1: HMAC-SHA256
    const hmac = crypto.createHmac('sha256', salt);
    hmac.update(serverSeed);
    const hmacResult = hmac.digest('hex');

    console.log('  HMAC result:', hmacResult.substring(0, 32) + '...');

    // Step 2: Take first 13 hex chars (52 bits)
    const hs = hmacResult.substring(0, 13);
    const h = parseInt(hs, 16);
    const e = Math.pow(2, 52);

    console.log('  First 13 chars:', hs);
    console.log('  Parsed int:', h);
    console.log('  h % 33:', h % 33);

    // Step 3: Check instant crash
    if (h % 33 === 0) {
        return 1.00;
    }

    // Step 4: Calculate crash point
    const x = h / e;
    const crashPoint = 99 / (1 - x);

    console.log('  x (normalized):', x);
    console.log('  99 / (1 - x):', crashPoint);
    console.log('  floor(...) / 100:', Math.floor(crashPoint * 100) / 100);

    return Math.floor(crashPoint * 100) / 100;
}

const testCases = [
    { game: 12306896, hash: '94aa062026624e59a0ace092568d5f46e21b9bf1d5173609db8645dd62bdfc44', expected: 10.91 },
    { game: 12306895, hash: '94e66d98029c61ecd27c4fb6b381d401c823cf3dfbdac9246756d5b655e125aa', expected: 4.26 },
    { game: 12306894, hash: '8d3b9726ca7bc5e3637bf2079e09eaf2a9d67df4e6f50ff23a7b593bd802cca6', expected: 1.83 }
];

const salt = '00000000000000000001e08b7fd44f95e3e950ac65650a8031a6d5e1750e34be';

console.log('═'.repeat(70));
console.log('TESTING WITH CORRECT GAME_SALT');
console.log('═'.repeat(70));
console.log('Salt:', salt);
console.log('');

testCases.forEach(tc => {
    console.log(`\nGame ${tc.game} - Expected: ${tc.expected}x`);
    console.log('─'.repeat(70));
    console.log('  Hash:', tc.hash);

    const result = crashPointFromHash(tc.hash, salt);
    const match = Math.abs(result - tc.expected) < 0.01 ? '✅ MATCH' : '❌ NO MATCH';

    console.log('');
    console.log(`  → Result: ${result.toFixed(2)}x ${match}`);
});
