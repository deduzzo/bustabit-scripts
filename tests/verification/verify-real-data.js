/**
 * Verifica con i dati reali forniti dall'utente
 */

function crashPointFromHash_v1(hash) {
    const hs = hash.substring(0, 13);
    const h = parseInt(hs, 16);
    const e = Math.pow(2, 52);

    if (h % 33 === 0) return 1.00;

    const x = h / e;
    const crashPoint = 99 / (1 - x);
    return Math.floor(crashPoint * 100) / 100;
}

function crashPointFromHash_v2(hash) {
    const hs = hash.substring(0, 13);
    const h = parseInt(hs, 16);
    const e = Math.pow(2, 52);

    if (h % 33 === 0) return 1.00;

    // Try alternative formula
    const crashPoint = (99 * e) / (e - h);
    return Math.floor(crashPoint * 100) / 100;
}

function crashPointFromHash_v3(hash) {
    const hs = hash.substring(0, 13);
    const h = parseInt(hs, 16);
    const e = Math.pow(2, 52);

    if (h % 33 === 0) return 1.00;

    // Try another approach
    const r = h / e;  // 0 to 1
    const crashPoint = Math.floor((100 * e) / (e - h)) / 100;
    return Math.max(1.00, crashPoint);
}

const testData = [
    { game: 12306896, hash: '94aa062026624e59a0ace092568d5f46e21b9bf1d5173609db8645dd62bdfc44', expected: 10.91 },
    { game: 12306895, hash: '94e66d98029c61ecd27c4fb6b381d401c823cf3dfbdac9246756d5b655e125aa', expected: 4.26 },
    { game: 12306894, hash: '8d3b9726ca7bc5e3637bf2079e09eaf2a9d67df4e6f50ff23a7b593bd802cca6', expected: 1.83 }
];

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║  TESTING DIFFERENT FORMULAS                                ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

testData.forEach(tc => {
    console.log(`\nGame ${tc.game} - Expected: ${tc.expected}x`);
    console.log('─'.repeat(60));

    const v1 = crashPointFromHash_v1(tc.hash);
    const v2 = crashPointFromHash_v2(tc.hash);
    const v3 = crashPointFromHash_v3(tc.hash);

    console.log(`Formula 1 (99 / (1 - x)):        ${v1.toFixed(2)}x ${Math.abs(v1 - tc.expected) < 0.01 ? '✅' : '❌'}`);
    console.log(`Formula 2 (99*e / (e - h)):      ${v2.toFixed(2)}x ${Math.abs(v2 - tc.expected) < 0.01 ? '✅' : '❌'}`);
    console.log(`Formula 3 (floor(100*e/(e-h))):  ${v3.toFixed(2)}x ${Math.abs(v3 - tc.expected) < 0.01 ? '✅' : '❌'}`);
});
