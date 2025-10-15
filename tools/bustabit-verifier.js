/**
 * BUSTABIT PROVABLY FAIR VERIFIER
 *
 * Genera i VERI valori di crash di Bustabit usando il sistema provably fair
 * Basato su: https://github.com/bustabit/verifier
 */

const crypto = require('crypto');

/**
 * Calcola il crash point da un hash usando l'algoritmo provably fair di Bustabit
 * @param {string} serverSeed - Hash del game (64 hex chars)
 * @returns {number} Crash multiplier (es. 1.83, 10.91, etc.)
 */
function crashPointFromHash(serverSeed) {
    // Validate hash
    if (!/^[0-9a-f]{64}$/i.test(serverSeed)) {
        throw new Error('Hash must be a 64 character hex string');
    }

    // Bustabit provably fair algorithm (for games > 12279450):
    // 1. HMAC-SHA256(key=GAME_SALT as UTF-8, message=hash as binary)
    // 2. Take first 13 hex chars (52 bits) from HMAC result
    // 3. Check for instant crash (h % 33 === 0)
    // 4. Calculate: crashPoint = 99 / (1 - (h / 2^52))
    // 5. Return: max(1, floor(crashPoint) / 100)

    // GAME_SALT per i game dopo 12279450 (VX shutdown)
    // Fonte: https://bitcointalk.org/index.php?topic=5560454
    // IMPORTANTE: Usata come stringa UTF-8, NON come hex!
    const salt = '00000000000000000001e08b7fd44f95e3e950ac65650a8031a6d5e1750e34be';

    // Step 1: HMAC-SHA256 con salt come UTF-8 string e hash come binary
    const hmac = crypto.createHmac('sha256', salt);
    hmac.update(Buffer.from(serverSeed, 'hex'));
    const hmacResult = hmac.digest('hex');

    // Step 2: Take first 13 hex chars (52 bits)
    const hs = hmacResult.substring(0, 13);
    const h = parseInt(hs, 16);
    const e = Math.pow(2, 52);

    // Step 3: 1% chance of instant crash
    if (h % 33 === 0) {
        return 1.00;
    }

    // Step 4: Normalize to [0,1) and calculate crash point
    const x = h / e;
    const crashPoint = 99 / (1 - x);

    // Step 5: Floor and divide by 100, minimum 1.00x
    return Math.max(1.00, Math.floor(crashPoint) / 100);
}

/**
 * Genera il precedente hash nella chain
 * SHA-256(previousHash)
 */
function getPreviousHash(hash) {
    return crypto
        .createHash('sha256')
        .update(hash)
        .digest('hex');
}

/**
 * Genera una sequenza di crash points partendo da un hash
 * @param {string} finalHash - Hash finale (più recente)
 * @param {number} count - Numero di valori da generare
 * @returns {Array} Array di crash points (dal più vecchio al più recente)
 */
function generateCrashSequence(finalHash, count) {
    const crashes = [];
    let currentHash = finalHash;

    // Genera count valori andando indietro nella chain
    for (let i = 0; i < count; i++) {
        const crashPoint = crashPointFromHash(currentHash);
        crashes.unshift(crashPoint); // Aggiungi all'inizio (così ordine cronologico corretto)
        currentHash = getPreviousHash(currentHash);
    }

    return crashes;
}

/**
 * Test: Genera ultimi 10 valori dal hash fornito
 */
function testWithRealHash() {
    // Hash reale fornito dall'utente
    const realHash = '94aa062026624e59a0ace092568d5f46e21b9bf1d5173609db8645dd62bdfc44';

    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║         BUSTABIT PROVABLY FAIR VERIFIER                    ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    console.log('📋 Testing with REAL Bustabit hash:\n');
    console.log(`Hash: ${realHash}\n`);

    console.log('Generating last 10 crash values...\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const crashes = generateCrashSequence(realHash, 10);

    crashes.forEach((crash, idx) => {
        console.log(`Game ${idx + 1}: ${crash.toFixed(2)}x`);
    });

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Statistics
    const avg = crashes.reduce((a, b) => a + b, 0) / crashes.length;
    const max = Math.max(...crashes);
    const min = Math.min(...crashes);
    const above2x = crashes.filter(c => c >= 2.0).length;
    const above3x = crashes.filter(c => c >= 3.0).length;

    console.log('📊 Statistics:\n');
    console.log(`   Average: ${avg.toFixed(2)}x`);
    console.log(`   Min: ${min.toFixed(2)}x`);
    console.log(`   Max: ${max.toFixed(2)}x`);
    console.log(`   Above 2x: ${above2x}/10 (${(above2x/10*100).toFixed(0)}%)`);
    console.log(`   Above 3x: ${above3x}/10 (${(above3x/10*100).toFixed(0)}%)`);
    console.log('');
}

/**
 * Verifica che l'algoritmo sia corretto generando 100 valori
 */
function testDistribution() {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║         DISTRIBUTION TEST (1000 games)                     ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    // Usa un hash seed casuale
    let hash = crypto.randomBytes(32).toString('hex');
    const crashes = generateCrashSequence(hash, 1000);

    // Calcola distribuzione
    const ranges = {
        '1.00-1.50': 0,
        '1.51-2.00': 0,
        '2.01-3.00': 0,
        '3.01-5.00': 0,
        '5.01-10.00': 0,
        '10.01+': 0
    };

    crashes.forEach(c => {
        if (c <= 1.50) ranges['1.00-1.50']++;
        else if (c <= 2.00) ranges['1.51-2.00']++;
        else if (c <= 3.00) ranges['2.01-3.00']++;
        else if (c <= 5.00) ranges['3.01-5.00']++;
        else if (c <= 10.00) ranges['5.01-10.00']++;
        else ranges['10.01+']++;
    });

    console.log('Distribution:\n');
    Object.entries(ranges).forEach(([range, count]) => {
        const pct = (count / 1000 * 100).toFixed(1);
        const bar = '█'.repeat(Math.floor(count / 20));
        console.log(`   ${range.padEnd(12)} ${count.toString().padStart(4)} (${pct.padStart(5)}%) ${bar}`);
    });

    console.log('');

    // Expected probabilities (circa)
    console.log('Expected vs Actual:\n');
    const prob2x = crashes.filter(c => c >= 2.0).length / 1000;
    const prob3x = crashes.filter(c => c >= 3.0).length / 1000;
    const prob5x = crashes.filter(c => c >= 5.0).length / 1000;

    console.log(`   P(≥2x):  Expected ~49.5%,  Actual ${(prob2x * 100).toFixed(1)}%`);
    console.log(`   P(≥3x):  Expected ~33.0%,  Actual ${(prob3x * 100).toFixed(1)}%`);
    console.log(`   P(≥5x):  Expected ~19.8%,  Actual ${(prob5x * 100).toFixed(1)}%`);
    console.log('');
}

// Export functions
module.exports = {
    crashPointFromHash,
    getPreviousHash,
    generateCrashSequence
};

// Run tests if executed directly
if (require.main === module) {
    testWithRealHash();
    console.log('\n');
    testDistribution();
}
