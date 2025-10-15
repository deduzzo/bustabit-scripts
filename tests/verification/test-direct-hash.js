/**
 * Forse l'hash fornito è GIÀ l'HMAC result?
 */

function crashPointFromHash_NoHMAC(hash) {
    // Use hash directly without HMAC
    const hs = hash.substring(0, 13);
    const h = parseInt(hs, 16);
    const e = Math.pow(2, 52);

    console.log('  First 13 chars:', hs);
    console.log('  Parsed int:', h);
    console.log('  h % 33:', h % 33);

    if (h % 33 === 0) {
        console.log('  → INSTANT CRASH');
        return 1.00;
    }

    const x = h / e;
    const crashPoint = 99 / (1 - x);

    console.log('  x:', x);
    console.log('  99 / (1-x):', crashPoint);

    return Math.floor(crashPoint * 100) / 100;
}

const testCases = [
    { game: 12306896, hash: '94aa062026624e59a0ace092568d5f46e21b9bf1d5173609db8645dd62bdfc44', expected: 10.91 },
    { game: 12306895, hash: '94e66d98029c61ecd27c4fb6b381d401c823cf3dfbdac9246756d5b655e125aa', expected: 4.26 },
    { game: 12306894, hash: '8d3b9726ca7bc5e3637bf2079e09eaf2a9d67df4e6f50ff23a7b593bd802cca6', expected: 1.83 }
];

console.log('Testing: Maybe hash is ALREADY the HMAC result?\n');

testCases.forEach(tc => {
    console.log(`Game ${tc.game} (expected ${tc.expected}x):`);
    const result = crashPointFromHash_NoHMAC(tc.hash);
    const match = Math.abs(result - tc.expected) < 0.01 ? '✅' : '❌';
    console.log(`  → ${result.toFixed(2)}x ${match}\n`);
});
