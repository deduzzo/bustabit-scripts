/**
 * Analisi ritardo 10x dall'hash specifico
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
        const bust = gameResult(saltBytes, currentHash);
        results.push({
            game: i + 1,
            bust: bust,
            hash: bytesToHex(currentHash)
        });
        currentHash = sha256(currentHash);
    }
    return results;
}

// Hash fornito dall'utente
const USER_HASH = '37bbe88f43f0f9808c9464a24a07a1a150cb396830674a4671a3cdc47e3ebba7';

console.log('');
console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
console.log('║              ANALISI RITARDO 10x - Hash Specifico                         ║');
console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
console.log('');
console.log('Hash:', USER_HASH);
console.log('');

// Genera 500 partite dall'hash
const games = generateGameResults(USER_HASH, 500);

// Trova tutti i 10x+
console.log('📊 PRIMI 100 RISULTATI:');
console.log('────────────────────────────────────────────────────────────────────────────');
let delay10x = 0;
let delays10x = [];
let first10xFound = false;

for (let i = 0; i < 100; i++) {
    const g = games[i];
    const marker = g.bust >= 10 ? ' ★ 10x+!' : (g.bust >= 5 ? ' ● 5x+' : '');
    if (i < 50) {
        console.log(`   Game ${(i+1).toString().padStart(3)}: ${g.bust.toFixed(2).padStart(8)}x${marker}`);
    }

    if (g.bust >= 10) {
        if (!first10xFound) {
            console.log(`\n   ⚡ PRIMO 10x+ al game ${i+1} (delay: ${delay10x})`);
            first10xFound = true;
        }
        delays10x.push(delay10x);
        delay10x = 0;
    } else {
        delay10x++;
    }
}

console.log('');
console.log('📈 ANALISI DELAY 10x (su 500 partite):');
console.log('────────────────────────────────────────────────────────────────────────────');

// Reset e calcola su tutte 500 partite
delay10x = 0;
delays10x = [];
let maxDelay = 0;
let maxDelayGame = 0;

for (let i = 0; i < games.length; i++) {
    if (games[i].bust >= 10) {
        delays10x.push(delay10x);
        if (delay10x > maxDelay) {
            maxDelay = delay10x;
            maxDelayGame = i + 1;
        }
        delay10x = 0;
    } else {
        delay10x++;
    }
}

// Statistiche
delays10x.sort((a, b) => a - b);
const avg = delays10x.reduce((a, b) => a + b, 0) / delays10x.length;
const median = delays10x[Math.floor(delays10x.length / 2)];
const p75 = delays10x[Math.floor(delays10x.length * 0.75)];
const p90 = delays10x[Math.floor(delays10x.length * 0.90)];
const p95 = delays10x[Math.floor(delays10x.length * 0.95)];

console.log(`   Occorrenze 10x+:    ${delays10x.length} su 500 partite`);
console.log(`   Frequenza:          ${(delays10x.length / 500 * 100).toFixed(1)}%`);
console.log('');
console.log(`   Media delay:        ${avg.toFixed(1)} partite`);
console.log(`   Mediana delay:      ${median} partite`);
console.log(`   P75 (25% peggiori): ${p75} partite`);
console.log(`   P90 (10% peggiori): ${p90} partite`);
console.log(`   P95 (5% peggiori):  ${p95} partite`);
console.log(`   MAX delay:          ${maxDelay} partite (al game ${maxDelayGame})`);
console.log('');

// Analisi su 1M partite per statistiche più accurate
console.log('📊 ANALISI ESTESA (1M partite da checkpoints):');
console.log('────────────────────────────────────────────────────────────────────────────');

const HASH_CHECKPOINTS_10M = require('./hash-checkpoints-10M.js').HASH_CHECKPOINTS_10M;

let allDelays = [];
let totalGames = 0;
let total10x = 0;

// Analizza 100 checkpoint x 10000 partite = 1M partite
for (let c = 0; c < 100; c++) {
    const checkpoint = HASH_CHECKPOINTS_10M[c * 100];
    const gamesChunk = generateGameResults(checkpoint.hash, 10000);

    let d = 0;
    for (const g of gamesChunk) {
        totalGames++;
        if (g.bust >= 10) {
            total10x++;
            allDelays.push(d);
            d = 0;
        } else {
            d++;
        }
    }

    if ((c + 1) % 20 === 0) {
        process.stdout.write(`\r   Analizzate ${(c + 1) * 10000 / 1000}K partite...`);
    }
}

console.log(`\r   Analizzate 1,000,000 partite       `);
console.log('');

allDelays.sort((a, b) => a - b);
const avgAll = allDelays.reduce((a, b) => a + b, 0) / allDelays.length;
const medianAll = allDelays[Math.floor(allDelays.length / 2)];
const p75All = allDelays[Math.floor(allDelays.length * 0.75)];
const p90All = allDelays[Math.floor(allDelays.length * 0.90)];
const p95All = allDelays[Math.floor(allDelays.length * 0.95)];
const p99All = allDelays[Math.floor(allDelays.length * 0.99)];
const maxAll = allDelays[allDelays.length - 1];

console.log(`   Occorrenze 10x+:    ${total10x.toLocaleString()} (${(total10x / totalGames * 100).toFixed(2)}%)`);
console.log('');
console.log('   STATISTICHE DELAY 10x:');
console.log(`   ─────────────────────────────────────`);
console.log(`   Media:              ${avgAll.toFixed(1)} partite`);
console.log(`   Mediana:            ${medianAll} partite`);
console.log(`   P75:                ${p75All} partite`);
console.log(`   P90:                ${p90All} partite`);
console.log(`   P95:                ${p95All} partite`);
console.log(`   P99:                ${p99All} partite`);
console.log(`   MAX:                ${maxAll} partite`);
console.log('');

// Soglie consigliate
console.log('🎯 SOGLIE CONSIGLIATE PER PAOLOBET:');
console.log('────────────────────────────────────────────────────────────────────────────');
console.log('');
console.log('   SOSPENDI quando delay 10x supera:');
console.log(`      Conservativo:    ${p90All} partite (P90 - sospendi 10% del tempo)`);
console.log(`      Bilanciato:      ${p95All} partite (P95 - sospendi 5% del tempo)`);
console.log(`      Aggressivo:      ${Math.floor(p99All * 0.8)} partite (80% P99)`);
console.log('');
console.log('   RIPRENDI quando:');
console.log(`      - Esce un 10x+ E`);
console.log(`      - Negli ultimi 10-15 game ci sono almeno 2-3 valori >= 5x`);
console.log(`      - O esce un 20x+ (forte segnale di regolarizzazione)`);
console.log('');

// Analisi "regolarizzazione" dopo lunghi delay
console.log('📊 ANALISI POST-DELAY (cosa succede dopo un lungo ritardo):');
console.log('────────────────────────────────────────────────────────────────────────────');

// Trova i delay più lunghi e analizza i 20 game successivi
let longDelays = [];
let d = 0;
let gameIdx = 0;

for (let c = 0; c < 20; c++) {
    const checkpoint = HASH_CHECKPOINTS_10M[c * 100];
    const gamesChunk = generateGameResults(checkpoint.hash, 10000);

    for (let i = 0; i < gamesChunk.length; i++) {
        if (gamesChunk[i].bust >= 10) {
            if (d >= p90All) {
                // Analizza i prossimi 30 game
                const nextGames = gamesChunk.slice(i, i + 30);
                const count10x = nextGames.filter(g => g.bust >= 10).length;
                const count5x = nextGames.filter(g => g.bust >= 5).length;
                const firstNext10x = nextGames.findIndex(g => g.bust >= 10);
                longDelays.push({
                    delay: d,
                    next30_10x: count10x,
                    next30_5x: count5x,
                    nextFirst10x: firstNext10x
                });
            }
            d = 0;
        } else {
            d++;
        }
    }
}

if (longDelays.length > 0) {
    const avg10xAfter = longDelays.reduce((a, b) => a + b.next30_10x, 0) / longDelays.length;
    const avg5xAfter = longDelays.reduce((a, b) => a + b.next30_5x, 0) / longDelays.length;
    const avgFirstNext = longDelays.reduce((a, b) => a + b.nextFirst10x, 0) / longDelays.length;

    console.log(`   Analizzati ${longDelays.length} casi di delay >= ${p90All} (P90)`);
    console.log('');
    console.log('   Nei 30 game successivi al primo 10x dopo lungo delay:');
    console.log(`      Media 10x+:      ${avg10xAfter.toFixed(1)} (atteso ~3)`);
    console.log(`      Media 5x+:       ${avg5xAfter.toFixed(1)} (atteso ~6)`);
    console.log(`      Prossimo 10x:    dopo ~${avgFirstNext.toFixed(0)} partite`);
}

console.log('');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('                         RACCOMANDAZIONI FINALI');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');
console.log('   1. SOSPENDI se delay 10x > ' + p95All + ' partite');
console.log('   2. ATTENDI che esca un 10x+');
console.log('   3. DOPO il 10x, attendi ancora ~5-8 partite');
console.log('   4. RIPRENDI solo se negli ultimi 15 game hai visto >= 2 valori 5x+');
console.log('');
