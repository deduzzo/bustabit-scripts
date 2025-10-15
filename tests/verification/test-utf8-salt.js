/**
 * Test usando GAME_SALT come UTF-8 string, non hex!
 */
const crypto = require('crypto');

function crashPoint_withUTF8Salt(hashHex) {
    // GAME_SALT as UTF-8 string (not hex!)
    const salt = '00000000000000000001e08b7fd44f95e3e950ac65650a8031a6d5e1750e34be';

    // Hash as hex string
    const hmac = crypto.createHmac('sha256', salt);  // salt is already a string
    hmac.update(Buffer.from(hashHex, 'hex'));  // hash as binary
    const hmacResult = hmac.digest('hex');

    const hs = hmacResult.substring(0, 13);
    const h = parseInt(hs, 16);
    const e = Math.pow(2, 52);

    if (h % 33 === 0) return 1.00;

    const x = h / e;
    const result = 99 / (1 - x);
    return Math.max(1, Math.floor(result) / 100);
}

const testCases = [
    { game: 12306896, hash: '94aa062026624e59a0ace092568d5f46e21b9bf1d5173609db8645dd62bdfc44', expected: 10.91 },
    { game: 12306895, hash: '94e66d98029c61ecd27c4fb6b381d401c823cf3dfbdac9246756d5b655e125aa', expected: 4.26 },
    { game: 12306894, hash: '8d3b9726ca7bc5e3637bf2079e09eaf2a9d67df4e6f50ff23a7b593bd802cca6', expected: 1.83 }
];

console.log('Testing with GAME_SALT as UTF-8 string:\n');

testCases.forEach(tc => {
    console.log(`Game ${tc.game} (expected ${tc.expected}x):`);
    const result = crashPoint_withUTF8Salt(tc.hash);
    const match = Math.abs(result - tc.expected) < 0.01 ? '✅ MATCH!' : '❌';
    console.log(`  → ${result.toFixed(2)}x ${match}\n`);
});
