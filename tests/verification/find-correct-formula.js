/**
 * Trova la formula corretta provando diverse combinazioni
 */

function test(hash, expected, hexChars, divisor) {
    const hs = hash.substring(0, hexChars);
    const h = parseInt(hs, 16);

    if (h % 33 === 0) return { result: 1.00, match: Math.abs(1.00 - expected) < 0.01 };

    const crashPoint = Math.floor(divisor / (divisor - h)) / 100;
    const match = Math.abs(crashPoint - expected) < 0.01;

    return { result: crashPoint, match };
}

const testData = [
    { game: 12306896, hash: '94aa062026624e59a0ace092568d5f46e21b9bf1d5173609db8645dd62bdfc44', expected: 10.91 },
    { game: 12306895, hash: '94e66d98029c61ecd27c4fb6b381d401c823cf3dfbdac9246756d5b655e125aa', expected: 4.26 },
    { game: 12306894, hash: '8d3b9726ca7bc5e3637bf2079e09eaf2a9d67df4e6f50ff23a7b593bd802cca6', expected: 1.83 }
];

console.log('Finding correct formula...\n');

// Try different combinations
const hexOptions = [8, 10, 12, 13, 14, 16];
const divisorOptions = [
    Math.pow(2, 32),
    Math.pow(2, 40),
    Math.pow(2, 48),
    Math.pow(2, 52),
    Math.pow(2, 56),
    Math.pow(2, 64)
];

for (const hexChars of hexOptions) {
    for (const divisor of divisorOptions) {
        let allMatch = true;
        const results = [];

        for (const tc of testData) {
            const { result, match } = test(tc.hash, tc.expected, hexChars, divisor);
            results.push({ expected: tc.expected, result });
            if (!match) allMatch = false;
        }

        if (allMatch) {
            console.log('✅ FOUND IT!');
            console.log(`Hex chars: ${hexChars}`);
            console.log(`Divisor: ${divisor} (2^${Math.log2(divisor)})`);
            console.log(`Formula: floor(${divisor} / (${divisor} - h)) / 100`);
            console.log('\nResults:');
            results.forEach((r, i) => {
                console.log(`  Game ${testData[i].game}: ${r.result.toFixed(2)}x (expected ${r.expected}x)`);
            });
            console.log('');
        }
    }
}

console.log('If nothing found, trying alternative approaches...\n');

// Try different formula structure
function testAlt(hash, expected) {
    for (let hexChars = 6; hexChars <= 16; hexChars++) {
        const hs = hash.substring(0, hexChars);
        const h = parseInt(hs, 16);
        const maxVal = Math.pow(16, hexChars);

        // Try: (maxVal / (maxVal - h))
        const crash1 = Math.floor(100 * maxVal / (maxVal - h)) / 100;
        if (Math.abs(crash1 - expected) < 0.01) {
            return { hexChars, formula: `floor(100 * 16^${hexChars} / (16^${hexChars} - h)) / 100`, result: crash1 };
        }
    }
    return null;
}

console.log('Testing alternative formula structure:\n');
for (const tc of testData) {
    console.log(`Game ${tc.game} (expected ${tc.expected}x):`);
    const result = testAlt(tc.hash, tc.expected);
    if (result) {
        console.log(`  ✅ Found: ${result.hexChars} hex chars`);
        console.log(`  Formula: ${result.formula}`);
        console.log(`  Result: ${result.result.toFixed(2)}x`);
    } else {
        console.log(`  ❌ No match found`);
    }
}
