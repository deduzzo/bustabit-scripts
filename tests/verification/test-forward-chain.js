/**
 * Test: forse devo andare AVANTI nella chain, non indietro?
 */
const crypto = require('crypto');

function crashPointFromHash(hash, salt) {
    if (salt) {
        const hmac = crypto.createHmac('sha256', salt);
        hmac.update(hash);
        hash = hmac.digest('hex');
    }

    const hs = hash.substring(0, 13);
    const h = parseInt(hs, 16);
    const e = Math.pow(2, 52);

    if (h % 33 === 0) return 1.00;

    const x = h / e;
    return Math.floor(99 / (1 - x) * 100) / 100;
}

// Il "Terminating hash" è il punto di INIZIO?
const terminatingHash = '567a98370fb7545137ddb53687723cf0b8a1f5e93b1f76f4a1da29416930fa59';

// Expected results (dall'utente)
const expectedGames = [
    { game: 12306896, hash: '94aa062026624e59a0ace092568d5f46e21b9bf1d5173609db8645dd62bdfc44', bust: 10.91 },
    { game: 12306895, hash: '94e66d98029c61ecd27c4fb6b381d401c823cf3dfbdac9246756d5b655e125aa', bust: 4.26 },
    { game: 12306894, hash: '8d3b9726ca7bc5e3637bf2079e09eaf2a9d67df4e6f50ff23a7b593bd802cca6', bust: 1.83 }
];

console.log('Testing if game hash directly gives crash point...\n');

const salt = '0000000000000000004d6ec16dafe9d8370958664c1dc422f452892264c59526';

expectedGames.forEach(game => {
    const withSalt = crashPointFromHash(game.hash, salt);
    const withoutSalt = crashPointFromHash(game.hash, null);

    console.log(`Game ${game.game}:`);
    console.log(`  Expected:     ${game.bust.toFixed(2)}x`);
    console.log(`  With salt:    ${withSalt.toFixed(2)}x ${Math.abs(withSalt - game.bust) < 0.01 ? '✅' : '❌'}`);
    console.log(`  Without salt: ${withoutSalt.toFixed(2)}x ${Math.abs(withoutSalt - game.bust) < 0.01 ? '✅' : '❌'}`);
    console.log('');
});

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log('Testing if there\'s a CLIENT SEED involved...\n');

// Forse c'è un client seed? Proviamo con game number come seed
expectedGames.forEach(game => {
    const clientSeeds = [
        game.game.toString(),
        '',
        'client_seed',
        '0'
    ];

    console.log(`Game ${game.game} (expected ${game.bust}x):`);

    clientSeeds.forEach((clientSeed, idx) => {
        const combined = game.hash + clientSeed;
        const result = crashPointFromHash(combined, null);
        const match = Math.abs(result - game.bust) < 0.01 ? '✅' : '❌';
        console.log(`  Client seed "${clientSeed}": ${result.toFixed(2)}x ${match}`);
    });

    console.log('');
});
