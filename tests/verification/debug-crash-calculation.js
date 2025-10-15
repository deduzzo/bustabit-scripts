/**
 * Debug: Verifica calcolo crash point
 */

function crashPointFromHash(serverSeed) {
    const hash = serverSeed;
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Hash:', hash);

    const hs = hash.substring(0, 13);
    console.log('First 13 chars:', hs);

    const h = parseInt(hs, 16);
    console.log('Parsed as hex:', h);

    const e = Math.pow(2, 52);
    console.log('2^52:', e);

    // Check instant crash
    console.log('h % 33:', h % 33);
    if (h % 33 === 0) {
        console.log('→ INSTANT CRASH: 1.00x');
        return 1.00;
    }

    // Original calculation (WRONG?)
    const crashPoint1 = Math.floor((100 * e - h) / (e - h)) / 100.0;
    console.log('\nMio calcolo:');
    console.log('  (100 * e - h) / (e - h) =', (100 * e - h) / (e - h));
    console.log('  floor(...) / 100 =', crashPoint1);

    // Alternative calculation (from bustabit verifier)
    const crashPoint2 = (100 * e - h) / (e - h);
    console.log('\nAlternativo (senza floor):');
    console.log('  (100 * e - h) / (e - h) =', crashPoint2);

    // Another approach
    const crashPoint3 = Math.floor(100 * (e - h) / (e - h - 1)) / 100;
    console.log('\nForma alternativa:');
    console.log('  floor(100 * (e - h) / (e - h - 1)) / 100 =', crashPoint3);

    return Math.max(1.00, crashPoint1);
}

// Test con i 3 hash forniti dall'utente
console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║  DEBUG CRASH CALCULATION                                   ║');
console.log('╚════════════════════════════════════════════════════════════╝');

const testCases = [
    { game: 12306896, hash: '94aa062026624e59a0ace092568d5f46e21b9bf1d5173609db8645dd62bdfc44', expected: 10.91 },
    { game: 12306895, hash: '94e66d98029c61ecd27c4fb6b381d401c823cf3dfbdac9246756d5b655e125aa', expected: 4.26 },
    { game: 12306894, hash: '8d3b9726ca7bc5e3637bf2079e09eaf2a9d67df4e6f50ff23a7b593bd802cca6', expected: 1.83 }
];

testCases.forEach(tc => {
    console.log(`\n\n═══ Game ${tc.game} (Expected: ${tc.expected}x) ═══`);
    const result = crashPointFromHash(tc.hash);
    console.log('\n→ CALCULATED:', result.toFixed(2) + 'x');
    console.log('→ EXPECTED:  ', tc.expected.toFixed(2) + 'x');
    console.log('→ MATCH:', Math.abs(result - tc.expected) < 0.01 ? '✅' : '❌');
});
