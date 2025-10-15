/**
 * Test con formula corretta: floor(99/(1-x)) / 100
 */

function crashPoint_v1(hash) {
    const hs = hash.substring(0, 13);
    const h = parseInt(hs, 16);
    const e = Math.pow(2, 52);
    if (h % 33 === 0) return 1.00;

    const x = h / e;
    const result = 99 / (1 - x);
    // Version 1: floor(result * 100) / 100
    return Math.floor(result * 100) / 100;
}

function crashPoint_v2(hash) {
    const hs = hash.substring(0, 13);
    const h = parseInt(hs, 16);
    const e = Math.pow(2, 52);
    if (h % 33 === 0) return 1.00;

    const x = h / e;
    const result = 99 / (1 - x);
    // Version 2: floor(result) / 100
    return Math.max(1, Math.floor(result) / 100);
}

const testCases = [
    { game: 12306896, hash: '94aa062026624e59a0ace092568d5f46e21b9bf1d5173609db8645dd62bdfc44', expected: 10.91 },
    { game: 12306895, hash: '94e66d98029c61ecd27c4fb6b381d401c823cf3dfbdac9246756d5b655e125aa', expected: 4.26 },
    { game: 12306894, hash: '8d3b9726ca7bc5e3637bf2079e09eaf2a9d67df4e6f50ff23a7b593bd802cca6', expected: 1.83 }
];

console.log('Testing different floor/divide approaches:\n');

testCases.forEach(tc => {
    console.log(`Game ${tc.game} (expected ${tc.expected}x):`);

    const v1 = crashPoint_v1(tc.hash);
    const v2 = crashPoint_v2(tc.hash);

    const match1 = Math.abs(v1 - tc.expected) < 0.01 ? '✅' : '❌';
    const match2 = Math.abs(v2 - tc.expected) < 0.01 ? '✅' : '❌';

    console.log(`  v1 floor(r*100)/100: ${v1.toFixed(2)}x ${match1}`);
    console.log(`  v2 floor(r)/100:     ${v2.toFixed(2)}x ${match2}`);
    console.log('');
});
