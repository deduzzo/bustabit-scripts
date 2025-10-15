/**
 * REAL BUSTABIT SEED GENERATOR
 *
 * Genera valori di crash REALI usando l'algoritmo provably fair di Bustabit
 * Basato sul codice sorgente ufficiale: https://github.com/bustabit/verifier
 *
 * IMPORTANTE: Questo sostituisce la vecchia generazione random che era SBAGLIATA!
 */

const crypto = require('crypto');

// Salt per i game dopo 12279450 (post-VX)
// Fonte: https://bitcointalk.org/index.php?topic=5560454
const GAME_SALT = '00000000000000000001e08b7fd44f95e3e950ac65650a8031a6d5e1750e34be';

// Terminating hash per verificare la chain
const TERMINATING_HASH = '567a98370fb7545137ddb53687723cf0b8a1f5e93b1f76f4a1da29416930fa59';

/**
 * Calcola il crash point da un hash usando l'algoritmo provably fair di Bustabit
 * @param {string} serverSeed - Hash del game (64 hex chars)
 * @returns {number} Crash multiplier (es. 1.83, 10.91, etc.)
 */
function crashPointFromHash(serverSeed) {
    if (!/^[0-9a-f]{64}$/i.test(serverSeed)) {
        throw new Error('Hash must be a 64 character hex string');
    }

    // Step 1: HMAC-SHA256 con salt come UTF-8 string e hash come binary
    const hmac = crypto.createHmac('sha256', GAME_SALT);
    hmac.update(Buffer.from(serverSeed, 'hex'));
    const hmacResult = hmac.digest('hex');

    // Step 2: Take first 13 hex chars (52 bits)
    const h = parseInt(hmacResult.substring(0, 13), 16);
    const e = Math.pow(2, 52);

    // Step 3: 1% chance of instant crash
    if (h % 33 === 0) {
        return 1.00;
    }

    // Step 4: Calculate crash point: 99 / (1 - (h / 2^52))
    const x = h / e;
    const crashPoint = 99 / (1 - x);

    // Step 5: Floor and divide by 100, minimum 1.00x
    return Math.max(1.00, Math.floor(crashPoint) / 100);
}

/**
 * Genera il precedente hash nella chain usando SHA-256
 * @param {string} hash - Hash corrente (64 hex chars)
 * @returns {string} Hash precedente (64 hex chars)
 */
function getPreviousHash(hash) {
    return crypto
        .createHash('sha256')
        .update(Buffer.from(hash, 'hex'))
        .digest('hex');
}

/**
 * Genera una sequenza di crash points partendo da un hash
 * @param {string} finalHash - Hash finale (più recente) - se null usa TERMINATING_HASH
 * @param {number} count - Numero di valori da generare
 * @returns {Array<number>} Array di crash points (dal più vecchio al più recente)
 */
function generateCrashSequence(finalHash, count) {
    const crashes = [];
    let currentHash = finalHash || TERMINATING_HASH;

    // Genera count valori andando indietro nella chain
    for (let i = 0; i < count; i++) {
        const crashPoint = crashPointFromHash(currentHash);
        crashes.unshift(crashPoint); // Aggiungi all'inizio per ordine cronologico
        currentHash = getPreviousHash(currentHash);
    }

    return crashes;
}

/**
 * Genera un hash casuale valido per testing
 * @returns {string} Hash casuale (64 hex chars)
 */
function generateRandomHash() {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Genera un seed di crash values per simulazioni
 * @param {number} count - Numero di valori da generare (default: 10000)
 * @param {string} startHash - Hash di partenza (default: random)
 * @returns {Array<number>} Array di crash values
 */
function generateTestSeed(count = 10000, startHash = null) {
    const hash = startHash || generateRandomHash();
    return generateCrashSequence(hash, count);
}

// Export
module.exports = {
    crashPointFromHash,
    getPreviousHash,
    generateCrashSequence,
    generateRandomHash,
    generateTestSeed,
    GAME_SALT,
    TERMINATING_HASH
};

// Test se eseguito direttamente
if (require.main === module) {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║  REAL BUSTABIT SEED GENERATOR - Test                       ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    console.log('Generating 10 test values from random hash...\n');
    const testValues = generateTestSeed(10);

    testValues.forEach((crash, idx) => {
        console.log(`Game ${idx + 1}: ${crash.toFixed(2)}x`);
    });

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Statistics
    const avg = testValues.reduce((a, b) => a + b, 0) / testValues.length;
    const max = Math.max(...testValues);
    const min = Math.min(...testValues);
    const above2x = testValues.filter(c => c >= 2.0).length;

    console.log('📊 Statistics:\n');
    console.log(`   Average: ${avg.toFixed(2)}x`);
    console.log(`   Min: ${min.toFixed(2)}x`);
    console.log(`   Max: ${max.toFixed(2)}x`);
    console.log(`   Above 2x: ${above2x}/10 (${(above2x/10*100).toFixed(0)}%)`);
    console.log('');
}
