/**
 * ANALISI RITARDI LOW PAYOUT
 * Analizza ritardi per @1.16x, @1.5x e strategie inverse
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
    const avg = delays.reduce((a, b) => a + b, 0) / delays.length;
    const p50 = sorted[Math.floor(sorted.length * 0.50)];
    const p75 = sorted[Math.floor(sorted.length * 0.75)];
    const p90 = sorted[Math.floor(sorted.length * 0.90)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];

    return { count: delays.length, avg: avg.toFixed(2), p50, p75, p90, p95, p99, max };
}

// Simula strategia: quando @X ritarda, punta su @Y
function simulateReverseStrategy(crashes, config) {
    const { watchPayout, watchDelay, betPayout, betPercent, maxBets } = config;

    let balance = 1000000; // 10,000 bits
    const initBalance = balance;
    let currentDelay = 0;
    let betting = false;
    let betsInSequence = 0;
    let totalBets = 0;
    let wins = 0;
    let losses = 0;
    let maxDrawdown = 0;
    let peakBalance = balance;

    for (const crash of crashes) {
        // Controlla se il payout osservato (watchPayout) è uscito
        if (crash >= watchPayout) {
            currentDelay = 0;
            if (betting) {
                // Se stavo puntando e il watchPayout esce, non succede nulla per il bet
            }
        } else {
            currentDelay++;
        }

        // Se sto puntando, verifico se il betPayout è uscito
        if (betting) {
            if (crash >= betPayout) {
                // Vinto!
                const betAmount = Math.floor(balance * betPercent / 100);
                const winAmount = Math.floor(betAmount * (betPayout - 1));
                balance += winAmount;
                wins++;
                betting = false;
                betsInSequence = 0;
            } else {
                // Perso
                const betAmount = Math.floor(balance * betPercent / 100);
                balance -= betAmount;
                losses++;
                betsInSequence++;
                totalBets++;

                if (betsInSequence >= maxBets) {
                    betting = false;
                    betsInSequence = 0;
                }
            }
        } else if (currentDelay >= watchDelay) {
            // Inizia a puntare
            betting = true;
            betsInSequence = 0;
            totalBets++;

            // Prima bet immediatamente
            if (crash >= betPayout) {
                const betAmount = Math.floor(balance * betPercent / 100);
                const winAmount = Math.floor(betAmount * (betPayout - 1));
                balance += winAmount;
                wins++;
                betting = false;
            } else {
                const betAmount = Math.floor(balance * betPercent / 100);
                balance -= betAmount;
                losses++;
                betsInSequence++;
            }
        }

        if (balance > peakBalance) peakBalance = balance;
        const dd = (peakBalance - balance) / peakBalance * 100;
        if (dd > maxDrawdown) maxDrawdown = dd;
    }

    return {
        profit: ((balance - initBalance) / initBalance * 100).toFixed(2),
        wins, losses,
        winRate: (wins / (wins + losses) * 100).toFixed(1),
        totalBets,
        betFreq: (totalBets / crashes.length * 100).toFixed(2),
        maxDrawdown: maxDrawdown.toFixed(2)
    };
}

// Simula strategia multi-payout combinata
function simulateMultiStrategy(crashes, strategies) {
    let balance = 1000000;
    const initBalance = balance;
    let totalBets = 0;
    let wins = 0;
    let losses = 0;
    let maxDrawdown = 0;
    let peakBalance = balance;

    // Stato per ogni strategia
    const states = strategies.map(() => ({
        delay: 0,
        betting: false,
        betsInSeq: 0
    }));

    for (const crash of crashes) {
        let betThisRound = false;
        let betAmount = 0;
        let targetPayout = 0;
        let stratIdx = -1;

        // Trova la strategia da eseguire (priorità alla prima che matcha)
        for (let i = 0; i < strategies.length; i++) {
            const s = strategies[i];
            const state = states[i];

            if (crash >= s.watchPayout) {
                state.delay = 0;
            } else {
                state.delay++;
            }

            if (state.betting || state.delay >= s.watchDelay) {
                if (!state.betting) {
                    state.betting = true;
                    state.betsInSeq = 0;
                }

                if (!betThisRound) {
                    betThisRound = true;
                    betAmount = Math.floor(balance * s.betPercent / 100);
                    targetPayout = s.betPayout;
                    stratIdx = i;
                }
            }
        }

        if (betThisRound && stratIdx >= 0) {
            const state = states[stratIdx];
            const s = strategies[stratIdx];
            totalBets++;

            if (crash >= targetPayout) {
                balance += Math.floor(betAmount * (targetPayout - 1));
                wins++;
                state.betting = false;
                state.betsInSeq = 0;
            } else {
                balance -= betAmount;
                losses++;
                state.betsInSeq++;

                if (state.betsInSeq >= s.maxBets) {
                    state.betting = false;
                    state.betsInSeq = 0;
                }
            }
        }

        if (balance > peakBalance) peakBalance = balance;
        const dd = (peakBalance - balance) / peakBalance * 100;
        if (dd > maxDrawdown) maxDrawdown = dd;
    }

    return {
        profit: ((balance - initBalance) / initBalance * 100).toFixed(2),
        wins, losses,
        winRate: wins + losses > 0 ? (wins / (wins + losses) * 100).toFixed(1) : '0',
        totalBets,
        betFreq: (totalBets / crashes.length * 100).toFixed(2),
        maxDrawdown: maxDrawdown.toFixed(2)
    };
}

async function main() {
    const START_HASH = '1ba3ae00558a9e96ae2bc1ac1126fb47c46610c0b7735f58bbefcb24eba095dc';
    const TOTAL_GAMES = 1000000;

    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
    console.log('║         ANALISI RITARDI LOW PAYOUT - 1 MILIONE DI PARTITE                 ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('   Generazione crash values...');
    const crashes = generateCrashValues(START_HASH, TOTAL_GAMES);
    console.log('   Completato!');
    console.log('');

    // Analisi ritardi
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('                       ANALISI RITARDI PER PAYOUT');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('');
    console.log('Payout │ Prob.Teorica │ Ritardo │ P50 │ P75 │ P90 │ P95 │ P99 │  MAX');
    console.log('───────┼──────────────┼─────────┼─────┼─────┼─────┼─────┼─────┼──────');

    const payouts = [1.10, 1.16, 1.20, 1.30, 1.50, 1.80, 2.0, 3.0, 5.0, 7.3, 10.0];
    const delayStats = {};

    for (const p of payouts) {
        const stats = analyzeDelays(crashes, p);
        delayStats[p] = stats;
        const probTeorica = ((99 / p)).toFixed(1) + '%';

        console.log(
            `${p.toFixed(2).padStart(5)}x │ ` +
            `${probTeorica.padStart(12)} │ ` +
            `${stats.avg.padStart(7)} │ ` +
            `${stats.p50.toString().padStart(3)} │ ` +
            `${stats.p75.toString().padStart(3)} │ ` +
            `${stats.p90.toString().padStart(3)} │ ` +
            `${stats.p95.toString().padStart(3)} │ ` +
            `${stats.p99.toString().padStart(3)} │ ` +
            `${stats.max.toString().padStart(5)}`
        );
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('            TEST STRATEGIE "INVERSE" (watch X, bet Y)');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('');

    // Strategie da testare
    const reverseStrategies = [
        // Idea utente: @1.16x ritarda -> bet @7.3x (rapporto 7.3/1.16 = 6.3)
        { name: '@1.16 delay 3 -> bet @7.3', watchPayout: 1.16, watchDelay: 3, betPayout: 7.3, betPercent: 0.3, maxBets: 5 },
        { name: '@1.16 delay 4 -> bet @7.3', watchPayout: 1.16, watchDelay: 4, betPayout: 7.3, betPercent: 0.3, maxBets: 5 },
        { name: '@1.16 delay 5 -> bet @7.3', watchPayout: 1.16, watchDelay: 5, betPayout: 7.3, betPercent: 0.3, maxBets: 5 },

        // Idea utente: @1.5x ritarda -> bet @3x
        { name: '@1.5 delay 3 -> bet @3', watchPayout: 1.5, watchDelay: 3, betPayout: 3.0, betPercent: 0.5, maxBets: 5 },
        { name: '@1.5 delay 4 -> bet @3', watchPayout: 1.5, watchDelay: 4, betPayout: 3.0, betPercent: 0.5, maxBets: 5 },
        { name: '@1.5 delay 5 -> bet @3', watchPayout: 1.5, watchDelay: 5, betPayout: 3.0, betPercent: 0.5, maxBets: 5 },
        { name: '@1.5 delay 6 -> bet @3', watchPayout: 1.5, watchDelay: 6, betPayout: 3.0, betPercent: 0.3, maxBets: 8 },

        // Varianti con payout diversi
        { name: '@1.3 delay 3 -> bet @2', watchPayout: 1.3, watchDelay: 3, betPayout: 2.0, betPercent: 0.5, maxBets: 5 },
        { name: '@1.3 delay 4 -> bet @2', watchPayout: 1.3, watchDelay: 4, betPayout: 2.0, betPercent: 0.5, maxBets: 5 },
        { name: '@1.2 delay 4 -> bet @1.8', watchPayout: 1.2, watchDelay: 4, betPayout: 1.8, betPercent: 0.5, maxBets: 5 },
        { name: '@1.2 delay 5 -> bet @1.8', watchPayout: 1.2, watchDelay: 5, betPayout: 1.8, betPercent: 0.5, maxBets: 5 },
    ];

    console.log('Strategia                      │ Profit │ WinRate │ BetFreq │ MaxDD │ Bets');
    console.log('───────────────────────────────┼────────┼─────────┼─────────┼───────┼──────');

    for (const config of reverseStrategies) {
        const result = simulateReverseStrategy(crashes, config);
        console.log(
            `${config.name.padEnd(30)} │ ` +
            `${(result.profit + '%').padStart(6)} │ ` +
            `${(result.winRate + '%').padStart(7)} │ ` +
            `${(result.betFreq + '%').padStart(7)} │ ` +
            `${(result.maxDrawdown + '%').padStart(5)} │ ` +
            `${result.totalBets.toString().padStart(5)}`
        );
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('                  TEST STRATEGIE COMBINATE (Multi-Layer)');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('');

    // Combinazioni di strategie per raggiungere 10% betting
    const multiConfigs = [
        {
            name: 'Combo A: @1.5->@3 + @1.3->@2',
            strategies: [
                { watchPayout: 1.5, watchDelay: 4, betPayout: 3.0, betPercent: 0.3, maxBets: 5 },
                { watchPayout: 1.3, watchDelay: 3, betPayout: 2.0, betPercent: 0.3, maxBets: 5 },
            ]
        },
        {
            name: 'Combo B: @1.16->@7.3 + @1.5->@3',
            strategies: [
                { watchPayout: 1.16, watchDelay: 4, betPayout: 7.3, betPercent: 0.2, maxBets: 5 },
                { watchPayout: 1.5, watchDelay: 4, betPayout: 3.0, betPercent: 0.3, maxBets: 5 },
            ]
        },
        {
            name: 'Combo C: @1.2->@1.8 + @1.5->@3 + @3->@10',
            strategies: [
                { watchPayout: 1.2, watchDelay: 4, betPayout: 1.8, betPercent: 0.3, maxBets: 5 },
                { watchPayout: 1.5, watchDelay: 5, betPayout: 3.0, betPercent: 0.3, maxBets: 5 },
                { watchPayout: 3.0, watchDelay: 10, betPayout: 10.0, betPercent: 0.15, maxBets: 10 },
            ]
        },
        {
            name: 'Combo D: Aggressive Multi-Layer',
            strategies: [
                { watchPayout: 1.16, watchDelay: 3, betPayout: 5.0, betPercent: 0.2, maxBets: 3 },
                { watchPayout: 1.3, watchDelay: 3, betPayout: 2.5, betPercent: 0.3, maxBets: 4 },
                { watchPayout: 1.5, watchDelay: 4, betPayout: 3.0, betPercent: 0.3, maxBets: 5 },
                { watchPayout: 2.0, watchDelay: 6, betPayout: 5.0, betPercent: 0.2, maxBets: 5 },
            ]
        },
    ];

    console.log('Strategia                              │ Profit │ WinRate │ BetFreq │ MaxDD');
    console.log('───────────────────────────────────────┼────────┼─────────┼─────────┼──────');

    for (const mc of multiConfigs) {
        const result = simulateMultiStrategy(crashes, mc.strategies);
        console.log(
            `${mc.name.padEnd(38)} │ ` +
            `${(result.profit + '%').padStart(6)} │ ` +
            `${(result.winRate + '%').padStart(7)} │ ` +
            `${(result.betFreq + '%').padStart(7)} │ ` +
            `${(result.maxDrawdown + '%').padStart(5)}`
        );
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('                    RICERCA CONFIGURAZIONE OTTIMALE');
    console.log('                    (Target: ~10% betting, profit > 0)');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('');

    // Grid search per trovare configurazione ottimale
    let bestConfig = null;
    let bestScore = -Infinity;

    const watchPayouts = [1.16, 1.2, 1.3, 1.5];
    const watchDelays = [2, 3, 4, 5];
    const betPayouts = [1.8, 2.0, 2.5, 3.0, 5.0, 7.3];
    const betPercents = [0.2, 0.3, 0.5];
    const maxBetsList = [3, 5, 8];

    for (const wp of watchPayouts) {
        for (const wd of watchDelays) {
            for (const bp of betPayouts) {
                // bp deve essere > wp per avere senso
                if (bp <= wp * 1.2) continue;

                for (const bpc of betPercents) {
                    for (const mb of maxBetsList) {
                        const config = {
                            watchPayout: wp,
                            watchDelay: wd,
                            betPayout: bp,
                            betPercent: bpc,
                            maxBets: mb
                        };

                        const result = simulateReverseStrategy(crashes, config);
                        const profit = parseFloat(result.profit);
                        const betFreq = parseFloat(result.betFreq);

                        // Score: profit positivo + vicinanza al 10% betting
                        if (profit > 0 && betFreq >= 5) {
                            const score = profit - Math.abs(betFreq - 10) * 0.1;
                            if (score > bestScore) {
                                bestScore = score;
                                bestConfig = { config, result };
                            }
                        }
                    }
                }
            }
        }
    }

    if (bestConfig) {
        console.log('   MIGLIORE CONFIGURAZIONE TROVATA:');
        console.log(`   Watch: @${bestConfig.config.watchPayout}x ritardo ${bestConfig.config.watchDelay}`);
        console.log(`   Bet: @${bestConfig.config.betPayout}x, ${bestConfig.config.betPercent}% capitale, max ${bestConfig.config.maxBets} bets`);
        console.log(`   Risultati: Profit ${bestConfig.result.profit}%, WinRate ${bestConfig.result.winRate}%, BetFreq ${bestConfig.result.betFreq}%`);
    } else {
        console.log('   Nessuna configurazione profittevole trovata con betting >= 5%');
    }

    // Test su campioni diversi per la miglior configurazione
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('                    VALIDAZIONE SU CAMPIONI MULTIPLI');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('');

    const checkpoints = require('./hash-checkpoints-10M.js').HASH_CHECKPOINTS_10M;

    if (bestConfig) {
        let totalProfit = 0;
        let positives = 0;
        const sampleSize = 100;
        const sessionSize = 10000;

        for (let i = 0; i < sampleSize; i++) {
            const hash = checkpoints[i * 100].hash;
            const testCrashes = generateCrashValues(hash, sessionSize);
            const result = simulateReverseStrategy(testCrashes, bestConfig.config);
            totalProfit += parseFloat(result.profit);
            if (parseFloat(result.profit) > 0) positives++;
        }

        console.log(`   Test su ${sampleSize} sessioni da ${sessionSize} partite:`);
        console.log(`   Media profitto: ${(totalProfit/sampleSize).toFixed(3)}%`);
        console.log(`   Sessioni positive: ${positives}/${sampleSize} (${(positives/sampleSize*100).toFixed(1)}%)`);
    }

    console.log('');
}

main().catch(console.error);
