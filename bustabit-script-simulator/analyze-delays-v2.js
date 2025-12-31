/**
 * ANALISI RITARDI V2 - STRATEGIA CONSERVATIVA
 *
 * Invece di martingala, usiamo bet fisso e entry MOLTO ritardato
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

function generateCrashValues(startHash, amount) {
    let currentHash = hexToBytes(startHash);
    const saltBytes = Buffer.from(GAME_SALT, 'utf8');
    const crashes = [];

    for (let i = 0; i < amount; i++) {
        const crash = gameResult(saltBytes, currentHash);
        crashes.push(crash);
        currentHash = sha256(currentHash);
    }
    return crashes;
}

// Simula strategia delay bet conservativa
function simulateDelayStrategy(crashes, config) {
    const { targetPayout, entryDelay, maxBetsPerSequence, betPercent } = config;

    let balance = 1000000; // 10,000 bits
    const initBalance = balance;
    let currentDelay = 0;
    let betting = false;
    let betsInSequence = 0;
    let totalWins = 0;
    let totalLosses = 0;
    let sequences = 0;
    let maxDrawdown = 0;
    let peakBalance = balance;

    for (const crash of crashes) {
        if (crash >= targetPayout) {
            if (betting) {
                // Vinto!
                const betAmount = Math.floor(balance * betPercent / 100);
                const winAmount = Math.floor(betAmount * (targetPayout - 1));
                balance += winAmount;
                totalWins++;
                betting = false;
                betsInSequence = 0;
            }
            currentDelay = 0;
            if (balance > peakBalance) peakBalance = balance;
        } else {
            currentDelay++;

            if (betting) {
                // Perso
                const betAmount = Math.floor(balance * betPercent / 100);
                balance -= betAmount;
                totalLosses++;
                betsInSequence++;

                // Max bets per sequenza raggiunto, stop
                if (betsInSequence >= maxBetsPerSequence) {
                    betting = false;
                    betsInSequence = 0;
                }
            } else if (currentDelay >= entryDelay) {
                // Inizia sequenza di bet
                betting = true;
                betsInSequence = 0;
                sequences++;
            }
        }

        const dd = (peakBalance - balance) / peakBalance * 100;
        if (dd > maxDrawdown) maxDrawdown = dd;
    }

    return {
        finalBalance: balance,
        profit: balance - initBalance,
        profitPct: ((balance - initBalance) / initBalance * 100).toFixed(2),
        wins: totalWins,
        losses: totalLosses,
        winRate: (totalWins / (totalWins + totalLosses) * 100).toFixed(1),
        sequences,
        maxDrawdown: maxDrawdown.toFixed(2)
    };
}

async function main() {
    const START_HASH = '1ba3ae00558a9e96ae2bc1ac1126fb47c46610c0b7735f58bbefcb24eba095dc';
    const TOTAL_GAMES = 1000000;

    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
    console.log('║           TEST STRATEGIE "DELAY BET" CONSERVATIVE                         ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('   Generazione 1M crash values...');
    const crashes = generateCrashValues(START_HASH, TOTAL_GAMES);
    console.log('   Completato!');
    console.log('');

    // Test diverse configurazioni
    const configs = [
        // Payout 2x - entry molto ritardato
        { name: '2x dopo 10 delay, 3 bet max, 0.5%', targetPayout: 2.0, entryDelay: 10, maxBetsPerSequence: 3, betPercent: 0.5 },
        { name: '2x dopo 12 delay, 5 bet max, 0.3%', targetPayout: 2.0, entryDelay: 12, maxBetsPerSequence: 5, betPercent: 0.3 },
        { name: '2x dopo 15 delay, 5 bet max, 0.2%', targetPayout: 2.0, entryDelay: 15, maxBetsPerSequence: 5, betPercent: 0.2 },

        // Payout 3x - entry ritardato
        { name: '3x dopo 15 delay, 5 bet max, 0.5%', targetPayout: 3.0, entryDelay: 15, maxBetsPerSequence: 5, betPercent: 0.5 },
        { name: '3x dopo 18 delay, 8 bet max, 0.3%', targetPayout: 3.0, entryDelay: 18, maxBetsPerSequence: 8, betPercent: 0.3 },
        { name: '3x dopo 20 delay, 10 bet max, 0.2%', targetPayout: 3.0, entryDelay: 20, maxBetsPerSequence: 10, betPercent: 0.2 },
        { name: '3x dopo 25 delay, 8 bet max, 0.3%', targetPayout: 3.0, entryDelay: 25, maxBetsPerSequence: 8, betPercent: 0.3 },

        // Payout 10x - entry molto ritardato
        { name: '10x dopo 50 delay, 20 bet max, 0.2%', targetPayout: 10.0, entryDelay: 50, maxBetsPerSequence: 20, betPercent: 0.2 },
        { name: '10x dopo 60 delay, 30 bet max, 0.1%', targetPayout: 10.0, entryDelay: 60, maxBetsPerSequence: 30, betPercent: 0.1 },
        { name: '10x dopo 70 delay, 25 bet max, 0.15%', targetPayout: 10.0, entryDelay: 70, maxBetsPerSequence: 25, betPercent: 0.15 },
    ];

    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('                              RISULTATI TEST');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('');
    console.log('Strategia                              │ Profitto │ WinRate │ MaxDD  │ Seq');
    console.log('───────────────────────────────────────┼──────────┼─────────┼────────┼─────');

    let bestConfig = null;
    let bestProfit = -Infinity;

    for (const config of configs) {
        const result = simulateDelayStrategy(crashes, config);

        console.log(
            `${config.name.padEnd(39)} │ ` +
            `${(result.profitPct + '%').padStart(8)} │ ` +
            `${(result.winRate + '%').padStart(7)} │ ` +
            `${(result.maxDrawdown + '%').padStart(6)} │ ` +
            `${result.sequences.toString().padStart(4)}`
        );

        if (parseFloat(result.profitPct) > bestProfit) {
            bestProfit = parseFloat(result.profitPct);
            bestConfig = { config, result };
        }
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════');

    if (bestConfig && bestProfit > 0) {
        console.log('🏆 MIGLIORE CONFIGURAZIONE:');
        console.log(`   ${bestConfig.config.name}`);
        console.log(`   Profitto: ${bestConfig.result.profitPct}%`);
        console.log(`   Win Rate: ${bestConfig.result.winRate}%`);
        console.log(`   Max Drawdown: ${bestConfig.result.maxDrawdown}%`);
    } else {
        console.log('⚠️  NESSUNA CONFIGURAZIONE PROFITTEVOLE');
        console.log('   Il delay betting non supera il house edge su 1M di partite');
    }
    console.log('');

    // Test con 10M partite per la migliore configurazione
    if (bestConfig && bestProfit > 0) {
        console.log('═══════════════════════════════════════════════════════════════════════════');
        console.log('   Test su campioni diversi per confermare...');

        const checkpoints = require('./hash-checkpoints-10M.js').HASH_CHECKPOINTS_10M;
        let totalProfit = 0;
        let positives = 0;
        const sampleSize = 100;

        for (let i = 0; i < sampleSize; i++) {
            const hash = checkpoints[i * 100].hash; // Ogni 100k partite
            const testCrashes = generateCrashValues(hash, 100000);
            const result = simulateDelayStrategy(testCrashes, bestConfig.config);
            totalProfit += parseFloat(result.profitPct);
            if (parseFloat(result.profitPct) > 0) positives++;
        }

        console.log(`   Media profitto su ${sampleSize} campioni: ${(totalProfit/sampleSize).toFixed(2)}%`);
        console.log(`   Sessioni positive: ${positives}/${sampleSize} (${(positives/sampleSize*100).toFixed(1)}%)`);
    }
    console.log('');
}

main().catch(console.error);
