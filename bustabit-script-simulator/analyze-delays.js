/**
 * ANALISI RITARDI MASSIMI PER PAYOUT
 * Analizza su 10 milioni di partite quanto ritardano al massimo i vari payout
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

function sha256(data) {
    const hash = crypto.createHash('sha256');
    hash.update(Buffer.from(data));
    return new Uint8Array(hash.digest());
}

function bytesToHex(bytes) {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
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
    const result = Math.floor(X);
    return Math.max(1, result / 100);
}

// Genera crash values dalla catena hash
function generateCrashValues(startHash, amount) {
    let currentHash = hexToBytes(startHash);
    const saltBytes = Buffer.from(GAME_SALT, 'utf8');
    const crashes = [];

    for (let i = 0; i < amount; i++) {
        const crash = gameResult(saltBytes, currentHash);
        crashes.push(crash);
        currentHash = sha256(currentHash);

        if (i % 100000 === 0 && i > 0) {
            console.log(`   Generati ${(i/1000000).toFixed(1)}M crash values...`);
        }
    }

    return crashes;
}

// Analizza ritardi per un dato payout
function analyzeDelays(crashes, targetPayout) {
    const delays = [];
    let currentDelay = 0;

    for (const crash of crashes) {
        if (crash >= targetPayout) {
            if (currentDelay > 0) {
                delays.push(currentDelay);
            }
            currentDelay = 0;
        } else {
            currentDelay++;
        }
    }

    if (delays.length === 0) return null;

    const sorted = [...delays].sort((a, b) => a - b);
    const max = Math.max(...delays);
    const min = Math.min(...delays);
    const avg = delays.reduce((a, b) => a + b, 0) / delays.length;
    const median = sorted[Math.floor(sorted.length / 2)];
    const p90 = sorted[Math.floor(sorted.length * 0.90)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];
    const p999 = sorted[Math.floor(sorted.length * 0.999)];

    // Distribuzione dei ritardi
    const distribution = {};
    for (const d of delays) {
        const bucket = Math.floor(d / 5) * 5;
        distribution[bucket] = (distribution[bucket] || 0) + 1;
    }

    return {
        count: delays.length,
        min,
        max,
        avg: avg.toFixed(2),
        median,
        p90,
        p95,
        p99,
        p999,
        distribution
    };
}

// Main
async function main() {
    const START_HASH = '1ba3ae00558a9e96ae2bc1ac1126fb47c46610c0b7735f58bbefcb24eba095dc';
    const TOTAL_GAMES = 1000000; // 1 milione per test veloce

    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
    console.log('║              ANALISI RITARDI MASSIMI - 1 MILIONE DI PARTITE               ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('   Generazione crash values in corso...');

    const startTime = Date.now();
    const crashes = generateCrashValues(START_HASH, TOTAL_GAMES);
    const genTime = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`   Completato in ${genTime}s`);
    console.log('');

    // Analizza vari payout
    const payouts = [1.5, 2.0, 2.5, 3.0, 4.0, 5.0, 10.0, 20.0, 50.0, 100.0];

    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('                         RISULTATI ANALISI RITARDI');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('');
    console.log('Payout │ Occorrenze │ Ritardo │ Ritardo │ Ritardo │ P90  │ P95  │ P99  │ P99.9 │ MAX');
    console.log('       │            │ Medio   │ Mediano │ Minimo  │      │      │      │       │    ');
    console.log('───────┼────────────┼─────────┼─────────┼─────────┼──────┼──────┼──────┼───────┼────');

    const results = {};

    for (const payout of payouts) {
        const stats = analyzeDelays(crashes, payout);
        results[payout] = stats;

        if (stats) {
            console.log(
                `${payout.toFixed(1).padStart(5)}x │ ` +
                `${stats.count.toString().padStart(10)} │ ` +
                `${stats.avg.padStart(7)} │ ` +
                `${stats.median.toString().padStart(7)} │ ` +
                `${stats.min.toString().padStart(7)} │ ` +
                `${stats.p90.toString().padStart(4)} │ ` +
                `${stats.p95.toString().padStart(4)} │ ` +
                `${stats.p99.toString().padStart(4)} │ ` +
                `${stats.p999.toString().padStart(5)} │ ` +
                `${stats.max.toString().padStart(4)}`
            );
        }
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('                         INTERPRETAZIONE RISULTATI');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('');

    // Analisi dettagliata per 2x, 3x, 10x
    const keyPayouts = [2.0, 3.0, 10.0];

    for (const payout of keyPayouts) {
        const stats = results[payout];
        if (stats) {
            console.log(`📊 PAYOUT ${payout}x:`);
            console.log(`   - Esce in media ogni ${stats.avg} partite`);
            console.log(`   - Il 90% delle volte esce entro ${stats.p90} partite`);
            console.log(`   - Il 95% delle volte esce entro ${stats.p95} partite`);
            console.log(`   - Il 99% delle volte esce entro ${stats.p99} partite`);
            console.log(`   - Il 99.9% delle volte esce entro ${stats.p999} partite`);
            console.log(`   - MASSIMO OSSERVATO: ${stats.max} partite`);
            console.log('');

            // Suggerimento entry
            const safeEntry = stats.p95;
            const veryLateEntry = stats.p99;
            console.log(`   💡 SUGGERIMENTO ENTRY:`);
            console.log(`      - Entry "sicuro" (95%): dopo ${safeEntry} partite senza ${payout}x`);
            console.log(`      - Entry "molto ritardato" (99%): dopo ${veryLateEntry} partite`);
            console.log(`      - ⚠️  Può ritardare fino a ${stats.max} partite (raro ma possibile)`);
            console.log('');
        }
    }

    // Calcolo probabilità di successo con martingala
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('                    SIMULAZIONE STRATEGIA "DELAY BET"');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('');

    // Simula strategia: punta su 3x quando ritarda più di P90
    const payout3x = 3.0;
    const entryDelay = results[payout3x].p90; // Entry dopo il 90° percentile
    const baseBet = 100; // 1 bit

    let balance = 100000; // 1000 bits
    let wins = 0;
    let losses = 0;
    let currentDelay = 0;
    let betting = false;
    let betAmount = 0;
    let totalBets = 0;
    let maxDrawdown = 0;
    let startBalance = balance;

    for (let i = 0; i < crashes.length; i++) {
        const crash = crashes[i];

        if (crash >= payout3x) {
            if (betting) {
                // Vinto!
                balance += betAmount * (payout3x - 1);
                wins++;
                betting = false;
            }
            currentDelay = 0;
        } else {
            currentDelay++;
            if (betting) {
                // Perso, aumenta bet
                balance -= betAmount;
                losses++;
                betAmount = Math.ceil(betAmount * 1.5); // Martingala leggera
                if (betAmount > balance * 0.1) {
                    // Troppo rischioso, reset
                    betting = false;
                    betAmount = baseBet;
                }
            }

            if (!betting && currentDelay >= entryDelay) {
                // Inizia a puntare
                betting = true;
                betAmount = baseBet;
                totalBets++;
            }
        }

        const drawdown = (startBalance - balance) / startBalance * 100;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }

    const profit = balance - startBalance;
    const profitPct = (profit / startBalance * 100).toFixed(2);

    console.log(`   Strategia: Punta su ${payout3x}x quando ritarda > ${entryDelay} partite`);
    console.log(`   Capitale iniziale: ${(startBalance/100).toLocaleString()} bits`);
    console.log(`   Capitale finale: ${(balance/100).toLocaleString()} bits`);
    console.log(`   Profitto: ${profitPct}%`);
    console.log(`   Vincite: ${wins} | Perdite: ${losses}`);
    console.log(`   Win Rate: ${(wins/(wins+losses)*100).toFixed(1)}%`);
    console.log(`   Max Drawdown: ${maxDrawdown.toFixed(2)}%`);
    console.log(`   Sequenze di bet: ${totalBets}`);
    console.log('');
}

main().catch(console.error);
