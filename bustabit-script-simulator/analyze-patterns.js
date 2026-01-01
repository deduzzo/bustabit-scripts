/**
 * Analisi pattern problematici per PaoloBet
 */

const crypto = require('crypto');

const GAME_SALT = "00000000000000000001e08b7fd44f95e3e950ac65650a8031a6d5e1750e34be";

function hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
}

function bytesToHex(bytes) {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function sha256(data) {
    const hash = crypto.createHash('sha256');
    hash.update(Buffer.from(data));
    return new Uint8Array(hash.digest());
}

function hmacSha256(key, data) {
    const hmac = crypto.createHmac('sha256', Buffer.from(key));
    hmac.update(Buffer.from(data));
    return hmac.digest('hex');
}

function gameResult(saltBytes, gameHash) {
    const nBits = 52;
    const hash = hmacSha256(saltBytes, gameHash);
    const seed = hash.slice(0, nBits / 4);
    const r = parseInt(seed, 16);
    let X = r / Math.pow(2, nBits);
    X = 99 / (1 - X);
    return Math.max(1, Math.floor(X) / 100);
}

function generateGameResults(startHash, amount) {
    let currentHash = hexToBytes(startHash);
    const saltBytes = Buffer.from(GAME_SALT, 'utf8');
    const results = [];
    for (let i = 0; i < amount; i++) {
        results.push(gameResult(saltBytes, currentHash));
        currentHash = sha256(currentHash);
    }
    return results;
}

const HASH_CHECKPOINTS_10M = require('./hash-checkpoints-10M.js').HASH_CHECKPOINTS_10M;

console.log('');
console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
console.log('║              ANALISI PATTERN PROBLEMATICI - 1M Partite                    ║');
console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
console.log('');

// Raccolta statistiche
let delays10x = [];
let delays5x = [];
let delays2x = [];
let lowStreaks = [];  // Sequenze consecutive < 2x
let coldStreaks = []; // Sequenze senza nulla >= 3x

let current10xDelay = 0;
let current5xDelay = 0;
let current2xDelay = 0;
let currentLowStreak = 0;
let currentColdStreak = 0;

console.log('🔄 Analisi in corso...');

for (let c = 0; c < 100; c++) {
    const checkpoint = HASH_CHECKPOINTS_10M[c * 100];
    const games = generateGameResults(checkpoint.hash, 10000);

    for (const bust of games) {
        // Delay 10x
        if (bust >= 10) {
            delays10x.push(current10xDelay);
            current10xDelay = 0;
        } else {
            current10xDelay++;
        }

        // Delay 5x
        if (bust >= 5) {
            delays5x.push(current5xDelay);
            current5xDelay = 0;
        } else {
            current5xDelay++;
        }

        // Delay 2x
        if (bust >= 2) {
            delays2x.push(current2xDelay);
            current2xDelay = 0;
        } else {
            current2xDelay++;
        }

        // Low streak (< 2x consecutivi)
        if (bust < 2) {
            currentLowStreak++;
        } else {
            if (currentLowStreak > 0) lowStreaks.push(currentLowStreak);
            currentLowStreak = 0;
        }

        // Cold streak (niente >= 3x)
        if (bust >= 3) {
            if (currentColdStreak > 0) coldStreaks.push(currentColdStreak);
            currentColdStreak = 0;
        } else {
            currentColdStreak++;
        }
    }

    if ((c + 1) % 20 === 0) {
        process.stdout.write(`\r   ${(c + 1) * 10}K partite...`);
    }
}

console.log('\r   1,000,000 partite analizzate!');
console.log('');

// Funzione per calcolare percentili
function percentile(arr, p) {
    const sorted = [...arr].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length * p)];
}

// ═══════════════════════════════════════════════════════════════════════════════
// RISULTATI
// ═══════════════════════════════════════════════════════════════════════════════

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('                    PATTERN 1: DELAY 10x (già usato per 1.5x)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
const avg10x = delays10x.reduce((a, b) => a + b, 0) / delays10x.length;
console.log(`   Frequenza 10x:      ${(delays10x.length / 1000000 * 100).toFixed(2)}%`);
console.log(`   Media delay:        ${avg10x.toFixed(1)} partite`);
console.log(`   P90:                ${percentile(delays10x, 0.90)} partite`);
console.log(`   P95:                ${percentile(delays10x, 0.95)} partite`);
console.log(`   P99:                ${percentile(delays10x, 0.99)} partite`);
console.log(`   MAX:                ${Math.max(...delays10x)} partite`);
console.log('');
console.log(`   🎯 SOGLIA SOSPENSIONE: > ${percentile(delays10x, 0.95)} partite senza 10x`);
console.log('');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('                    PATTERN 2: DELAY 5x (importante per 1.5x)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
const avg5x = delays5x.reduce((a, b) => a + b, 0) / delays5x.length;
console.log(`   Frequenza 5x:       ${(delays5x.length / 1000000 * 100).toFixed(2)}%`);
console.log(`   Media delay:        ${avg5x.toFixed(1)} partite`);
console.log(`   P90:                ${percentile(delays5x, 0.90)} partite`);
console.log(`   P95:                ${percentile(delays5x, 0.95)} partite`);
console.log(`   P99:                ${percentile(delays5x, 0.99)} partite`);
console.log(`   MAX:                ${Math.max(...delays5x)} partite`);
console.log('');
console.log(`   🎯 SOGLIA SOSPENSIONE: > ${percentile(delays5x, 0.95)} partite senza 5x`);
console.log('');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('                    PATTERN 3: DELAY 2x (critico per martingala)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
const avg2x = delays2x.reduce((a, b) => a + b, 0) / delays2x.length;
console.log(`   Frequenza 2x:       ${(delays2x.length / 1000000 * 100).toFixed(2)}%`);
console.log(`   Media delay:        ${avg2x.toFixed(1)} partite`);
console.log(`   P90:                ${percentile(delays2x, 0.90)} partite`);
console.log(`   P95:                ${percentile(delays2x, 0.95)} partite`);
console.log(`   P99:                ${percentile(delays2x, 0.99)} partite`);
console.log(`   MAX:                ${Math.max(...delays2x)} partite`);
console.log('');
console.log(`   🎯 SOGLIA ATTENZIONE: > ${percentile(delays2x, 0.95)} partite senza 2x`);
console.log('');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('                    PATTERN 4: LOW STREAKS (consecutivi < 2x)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
const avgLow = lowStreaks.reduce((a, b) => a + b, 0) / lowStreaks.length;
console.log(`   Media streak basso: ${avgLow.toFixed(1)} partite`);
console.log(`   P90:                ${percentile(lowStreaks, 0.90)} partite`);
console.log(`   P95:                ${percentile(lowStreaks, 0.95)} partite`);
console.log(`   P99:                ${percentile(lowStreaks, 0.99)} partite`);
console.log(`   MAX:                ${Math.max(...lowStreaks)} partite`);
console.log('');
console.log(`   🎯 SOGLIA PERICOLO: > ${percentile(lowStreaks, 0.95)} crash < 2x consecutivi`);
console.log('');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('                    PATTERN 5: COLD STREAKS (niente >= 3x)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
const avgCold = coldStreaks.reduce((a, b) => a + b, 0) / coldStreaks.length;
console.log(`   Media cold streak:  ${avgCold.toFixed(1)} partite`);
console.log(`   P90:                ${percentile(coldStreaks, 0.90)} partite`);
console.log(`   P95:                ${percentile(coldStreaks, 0.95)} partite`);
console.log(`   P99:                ${percentile(coldStreaks, 0.99)} partite`);
console.log(`   MAX:                ${Math.max(...coldStreaks)} partite`);
console.log('');
console.log(`   🎯 SOGLIA FREDDO: > ${percentile(coldStreaks, 0.95)} partite senza 3x+`);
console.log('');

// ═══════════════════════════════════════════════════════════════════════════════
// RACCOMANDAZIONI FINALI
// ═══════════════════════════════════════════════════════════════════════════════

console.log('');
console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
console.log('║                    RACCOMANDAZIONI PER PAOLOBET v3                        ║');
console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
console.log('');
console.log('   SOSPENDI IL GIOCO QUANDO:');
console.log('   ─────────────────────────────────────────────────────────────────────────');
console.log(`   • Delay 10x > ${percentile(delays10x, 0.95)} partite (P95)`);
console.log(`   • Delay 5x > ${percentile(delays5x, 0.95)} partite (P95)`);
console.log(`   • Cold streak (no 3x+) > ${percentile(coldStreaks, 0.95)} partite (P95)`);
console.log('');
console.log('   RIPRENDI IL GIOCO QUANDO:');
console.log('   ─────────────────────────────────────────────────────────────────────────');
console.log('   • Esce un 10x+ (segnale forte)');
console.log('   • OPPURE escono 2+ valori >= 5x negli ultimi 10 game');
console.log('   • DOPO il segnale, attendi 3-5 partite per conferma');
console.log('');
console.log('   INDICATORE "SALUTE" DEL GIOCO (ultimi 20 game):');
console.log('   ─────────────────────────────────────────────────────────────────────────');
console.log('   • BUONO: 2+ 10x, 4+ 5x, media > 3x');
console.log('   • NORMALE: 1 10x, 2-3 5x, media 2-3x');
console.log('   • FREDDO: 0 10x, 0-1 5x, media < 2x → SOSPENDI');
console.log('');

// Salva le soglie per uso nello script
const thresholds = {
    delay10x: { p90: percentile(delays10x, 0.90), p95: percentile(delays10x, 0.95), p99: percentile(delays10x, 0.99) },
    delay5x: { p90: percentile(delays5x, 0.90), p95: percentile(delays5x, 0.95), p99: percentile(delays5x, 0.99) },
    delay2x: { p90: percentile(delays2x, 0.90), p95: percentile(delays2x, 0.95), p99: percentile(delays2x, 0.99) },
    lowStreak: { p90: percentile(lowStreaks, 0.90), p95: percentile(lowStreaks, 0.95), p99: percentile(lowStreaks, 0.99) },
    coldStreak: { p90: percentile(coldStreaks, 0.90), p95: percentile(coldStreaks, 0.95), p99: percentile(coldStreaks, 0.99) }
};

require('fs').writeFileSync('./pattern-thresholds.json', JSON.stringify(thresholds, null, 2));
console.log('💾 Soglie salvate in pattern-thresholds.json');
console.log('');
