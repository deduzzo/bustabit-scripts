/**
 * Test con gli hash reali forniti dall'utente
 */
const crypto = require('crypto');

function testWithDifferentSalts(hash, expected) {
    const salts = [
        '0000000000000000004d6ec16dafe9d8370958664c1dc422f452892264c59526',
        '0000000000000000000000000000000000000000000000000000000000000000',
        '', // no salt (just SHA256)
    ];

    console.log(`\nTesting hash: ${hash.substring(0, 16)}...`);
    console.log(`Expected: ${expected}x\n`);

    salts.forEach((salt, idx) => {
        let hmacResult;
        if (salt === '') {
            // No HMAC, just use the hash directly
            hmacResult = hash;
        } else {
            const hmac = crypto.createHmac('sha256', salt);
            hmac.update(hash);
            hmacResult = hmac.digest('hex');
        }

        const hs = hmacResult.substring(0, 13);
        const h = parseInt(hs, 16);
        const e = Math.pow(2, 52);

        if (h % 33 === 0) {
            console.log(`Salt ${idx}: 1.00x (instant crash)`);
            return;
        }

        const x = h / e;
        const crashPoint = Math.floor(99 / (1 - x) * 100) / 100;

        const match = Math.abs(crashPoint - expected) < 0.01 ? '✅' : '❌';
        console.log(`Salt ${idx}: ${crashPoint.toFixed(2)}x ${match}`);
    });
}

const testCases = [
    { hash: '94aa062026624e59a0ace092568d5f46e21b9bf1d5173609db8645dd62bdfc44', expected: 10.91 },
    { hash: '94e66d98029c61ecd27c4fb6b381d401c823cf3dfbdac9246756d5b655e125aa', expected: 4.26 },
    { hash: '8d3b9726ca7bc5e3637bf2079e09eaf2a9d67df4e6f50ff23a7b593bd802cca6', expected: 1.83 }
];

console.log('═'.repeat(60));
console.log('TESTING WITH DIFFERENT SALTS');
console.log('═'.repeat(60));

testCases.forEach(tc => testWithDifferentSalts(tc.hash, tc.expected));
