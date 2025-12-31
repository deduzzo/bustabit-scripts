/**
 * ANALISI STRATEGIE AD ALTA FREQUENZA
 * Bet su payout bassi con alta probabilità per aumentare frequenza
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

// Strategia: bet fisso su payout basso ogni X partite (skip some)
function simulateSkipStrategy(crashes, config) {
    const { targetPayout, betPercent, skipGames, maxConsecutiveLosses, sessionStopLoss, sessionTakeProfit } = config;

    let balance = 1000000; // 10,000 bits
    const initBalance = balance;
    let gameCount = 0;
    let skipCounter = 0;
    let consecutiveLosses = 0;
    let totalBets = 0;
    let wins = 0;
    let losses = 0;
    let maxDrawdown = 0;
    let peakBalance = balance;
    let stopped = false;

    for (const crash of crashes) {
        if (stopped) break;

        gameCount++;
        skipCounter++;

        // Skip logic - salta alcune partite
        if (skipCounter <= skipGames) continue;
        skipCounter = 0;

        // Check stop conditions
        const currentProfit = (balance - initBalance) / initBalance * 100;
        if (currentProfit <= -sessionStopLoss) {
            stopped = true;
            break;
        }
        if (currentProfit >= sessionTakeProfit) {
            stopped = true;
            break;
        }

        // Bet
        const betAmount = Math.floor(balance * betPercent / 100);
        totalBets++;

        if (crash >= targetPayout) {
            // Win
            balance += Math.floor(betAmount * (targetPayout - 1));
            wins++;
            consecutiveLosses = 0;
        } else {
            // Loss
            balance -= betAmount;
            losses++;
            consecutiveLosses++;

            if (consecutiveLosses >= maxConsecutiveLosses) {
                // Pausa dopo troppe perdite consecutive
                skipCounter = -skipGames; // Skip extra
                consecutiveLosses = 0;
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
        maxDrawdown: maxDrawdown.toFixed(2),
        gamesPlayed: gameCount
    };
}

// Strategia: bet solo quando vedi pattern positivo
function simulatePatternStrategy(crashes, config) {
    const {
        observePayout,
        betPayout,
        betPercent,
        minWinsToEnter,
        observeWindow,
        maxBetsPerSession,
        sessionStopLoss,
        sessionTakeProfit
    } = config;

    let balance = 1000000;
    const initBalance = balance;
    let totalBets = 0;
    let wins = 0;
    let losses = 0;
    let maxDrawdown = 0;
    let peakBalance = balance;

    // Window buffer per osservare pattern
    const window = [];

    for (const crash of crashes) {
        // Aggiorna window
        window.push(crash >= observePayout ? 1 : 0);
        if (window.length > observeWindow) window.shift();

        // Check stop conditions
        const currentProfit = (balance - initBalance) / initBalance * 100;
        if (currentProfit <= -sessionStopLoss || currentProfit >= sessionTakeProfit) break;
        if (totalBets >= maxBetsPerSession) break;

        // Conta wins nella window
        const recentWins = window.reduce((a, b) => a + b, 0);

        // Bet solo se pattern favorevole
        if (window.length >= observeWindow && recentWins >= minWinsToEnter) {
            const betAmount = Math.floor(balance * betPercent / 100);
            totalBets++;

            if (crash >= betPayout) {
                balance += Math.floor(betAmount * (betPayout - 1));
                wins++;
            } else {
                balance -= betAmount;
                losses++;
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

// Strategia flat betting su payout molto basso
function simulateFlatLowPayout(crashes, config) {
    const { targetPayout, betPercent, sessionStopLoss, sessionTakeProfit } = config;

    let balance = 1000000;
    const initBalance = balance;
    let totalBets = 0;
    let wins = 0;
    let losses = 0;
    let maxDrawdown = 0;
    let peakBalance = balance;

    for (const crash of crashes) {
        const currentProfit = (balance - initBalance) / initBalance * 100;
        if (currentProfit <= -sessionStopLoss || currentProfit >= sessionTakeProfit) break;

        const betAmount = Math.floor(balance * betPercent / 100);
        totalBets++;

        if (crash >= targetPayout) {
            balance += Math.floor(betAmount * (targetPayout - 1));
            wins++;
        } else {
            balance -= betAmount;
            losses++;
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

// Strategia: entry solo dopo X perdite consecutive
function simulateDelayedEntry(crashes, config) {
    const { targetPayout, betPercent, entryAfterLosses, maxBetsPerSequence } = config;

    let balance = 1000000;
    const initBalance = balance;
    let totalBets = 0;
    let wins = 0;
    let losses = 0;
    let maxDrawdown = 0;
    let peakBalance = balance;
    let consecutiveLosses = 0;
    let betting = false;
    let betsInSequence = 0;

    for (const crash of crashes) {
        if (crash >= targetPayout) {
            if (betting) {
                const betAmount = Math.floor(balance * betPercent / 100);
                balance += Math.floor(betAmount * (targetPayout - 1));
                wins++;
                totalBets++;
                betting = false;
                betsInSequence = 0;
            }
            consecutiveLosses = 0;
        } else {
            consecutiveLosses++;

            if (betting) {
                const betAmount = Math.floor(balance * betPercent / 100);
                balance -= betAmount;
                losses++;
                totalBets++;
                betsInSequence++;

                if (betsInSequence >= maxBetsPerSequence) {
                    betting = false;
                    betsInSequence = 0;
                }
            } else if (consecutiveLosses >= entryAfterLosses) {
                betting = true;
                betsInSequence = 0;
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
    console.log('║       ANALISI STRATEGIE AD ALTA FREQUENZA - 1M PARTITE                    ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('   Generazione crash values...');
    const crashes = generateCrashValues(START_HASH, TOTAL_GAMES);
    console.log('   Completato!');
    console.log('');

    // Test flat betting su payout bassi con stop
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('            TEST FLAT BET SU PAYOUT BASSI (con stop loss/profit)');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('');

    const flatConfigs = [
        { name: '@1.10x, 0.1%, SL5%, TP3%', targetPayout: 1.10, betPercent: 0.1, sessionStopLoss: 5, sessionTakeProfit: 3 },
        { name: '@1.10x, 0.2%, SL5%, TP3%', targetPayout: 1.10, betPercent: 0.2, sessionStopLoss: 5, sessionTakeProfit: 3 },
        { name: '@1.15x, 0.2%, SL5%, TP3%', targetPayout: 1.15, betPercent: 0.2, sessionStopLoss: 5, sessionTakeProfit: 3 },
        { name: '@1.20x, 0.3%, SL5%, TP3%', targetPayout: 1.20, betPercent: 0.3, sessionStopLoss: 5, sessionTakeProfit: 3 },
        { name: '@1.30x, 0.3%, SL5%, TP5%', targetPayout: 1.30, betPercent: 0.3, sessionStopLoss: 5, sessionTakeProfit: 5 },
        { name: '@1.50x, 0.5%, SL8%, TP5%', targetPayout: 1.50, betPercent: 0.5, sessionStopLoss: 8, sessionTakeProfit: 5 },
    ];

    console.log('Config                         │ Profit │ WinRate │ BetFreq │ MaxDD │ Bets');
    console.log('───────────────────────────────┼────────┼─────────┼─────────┼───────┼──────');

    for (const config of flatConfigs) {
        const result = simulateFlatLowPayout(crashes, config);
        console.log(
            `${config.name.padEnd(30)} │ ` +
            `${(result.profit + '%').padStart(6)} │ ` +
            `${(result.winRate + '%').padStart(7)} │ ` +
            `${(result.betFreq + '%').padStart(7)} │ ` +
            `${(result.maxDrawdown + '%').padStart(5)} │ ` +
            `${result.totalBets.toString().padStart(5)}`
        );
    }

    // Test delayed entry
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('          TEST DELAYED ENTRY (bet dopo X perdite consecutive)');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('');

    const delayedConfigs = [
        { name: '@1.20x delay 3, 5 bet max', targetPayout: 1.20, betPercent: 0.5, entryAfterLosses: 3, maxBetsPerSequence: 5 },
        { name: '@1.20x delay 4, 5 bet max', targetPayout: 1.20, betPercent: 0.5, entryAfterLosses: 4, maxBetsPerSequence: 5 },
        { name: '@1.30x delay 3, 5 bet max', targetPayout: 1.30, betPercent: 0.5, entryAfterLosses: 3, maxBetsPerSequence: 5 },
        { name: '@1.30x delay 4, 5 bet max', targetPayout: 1.30, betPercent: 0.5, entryAfterLosses: 4, maxBetsPerSequence: 5 },
        { name: '@1.50x delay 4, 5 bet max', targetPayout: 1.50, betPercent: 0.5, entryAfterLosses: 4, maxBetsPerSequence: 5 },
        { name: '@1.50x delay 5, 8 bet max', targetPayout: 1.50, betPercent: 0.3, entryAfterLosses: 5, maxBetsPerSequence: 8 },
        { name: '@1.80x delay 5, 5 bet max', targetPayout: 1.80, betPercent: 0.5, entryAfterLosses: 5, maxBetsPerSequence: 5 },
        { name: '@1.80x delay 6, 8 bet max', targetPayout: 1.80, betPercent: 0.3, entryAfterLosses: 6, maxBetsPerSequence: 8 },
        { name: '@2.00x delay 6, 5 bet max', targetPayout: 2.00, betPercent: 0.5, entryAfterLosses: 6, maxBetsPerSequence: 5 },
        { name: '@2.00x delay 7, 8 bet max', targetPayout: 2.00, betPercent: 0.3, entryAfterLosses: 7, maxBetsPerSequence: 8 },
    ];

    console.log('Config                         │ Profit │ WinRate │ BetFreq │ MaxDD │ Bets');
    console.log('───────────────────────────────┼────────┼─────────┼─────────┼───────┼──────');

    for (const config of delayedConfigs) {
        const result = simulateDelayedEntry(crashes, config);
        console.log(
            `${config.name.padEnd(30)} │ ` +
            `${(result.profit + '%').padStart(6)} │ ` +
            `${(result.winRate + '%').padStart(7)} │ ` +
            `${(result.betFreq + '%').padStart(7)} │ ` +
            `${(result.maxDrawdown + '%').padStart(5)} │ ` +
            `${result.totalBets.toString().padStart(5)}`
        );
    }

    // Grid search per trovare la configurazione migliore
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('        GRID SEARCH OTTIMALE (target: profit > 0, freq >= 5%)');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('');

    let bestConfig = null;
    let bestScore = -Infinity;

    const payouts = [1.15, 1.20, 1.30, 1.50, 1.80];
    const delays = [3, 4, 5, 6, 7, 8];
    const maxBets = [3, 5, 8, 10];
    const betPercents = [0.2, 0.3, 0.5];

    for (const tp of payouts) {
        for (const delay of delays) {
            // Delay deve essere sensato per il payout
            const p99 = tp <= 1.2 ? 3 : tp <= 1.5 ? 5 : tp <= 2.0 ? 7 : 12;
            if (delay < Math.max(2, p99 - 3)) continue;

            for (const mb of maxBets) {
                for (const bp of betPercents) {
                    const config = {
                        targetPayout: tp,
                        betPercent: bp,
                        entryAfterLosses: delay,
                        maxBetsPerSequence: mb
                    };

                    const result = simulateDelayedEntry(crashes, config);
                    const profit = parseFloat(result.profit);
                    const betFreq = parseFloat(result.betFreq);
                    const maxDD = parseFloat(result.maxDrawdown);

                    // Score: profit positivo con alta frequenza e basso drawdown
                    if (profit > -5 && betFreq >= 3) {
                        const score = profit + betFreq * 0.5 - maxDD * 0.1;
                        if (score > bestScore) {
                            bestScore = score;
                            bestConfig = { config, result };
                        }
                    }
                }
            }
        }
    }

    if (bestConfig) {
        console.log('   MIGLIORE CONFIGURAZIONE SINGLE PAYOUT:');
        console.log(`   Payout: @${bestConfig.config.targetPayout}x`);
        console.log(`   Entry: dopo ${bestConfig.config.entryAfterLosses} perdite consecutive`);
        console.log(`   Bet: ${bestConfig.config.betPercent}% capitale, max ${bestConfig.config.maxBetsPerSequence} bets per sequenza`);
        console.log(`   Risultati: Profit ${bestConfig.result.profit}%, WinRate ${bestConfig.result.winRate}%, Freq ${bestConfig.result.betFreq}%`);
    }

    // Test su più campioni per la best config
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('                    VALIDAZIONE SU 100 SESSIONI');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('');

    const checkpoints = require('./hash-checkpoints-10M.js').HASH_CHECKPOINTS_10M;
    const sessionSize = 10000;
    const sampleSize = 100;

    if (bestConfig) {
        let totalProfit = 0;
        let positives = 0;
        let totalBets = 0;

        for (let i = 0; i < sampleSize; i++) {
            const hash = checkpoints[i * 100].hash;
            const testCrashes = generateCrashValues(hash, sessionSize);
            const result = simulateDelayedEntry(testCrashes, bestConfig.config);
            totalProfit += parseFloat(result.profit);
            totalBets += result.totalBets;
            if (parseFloat(result.profit) > 0) positives++;
        }

        console.log(`   Test su ${sampleSize} sessioni da ${sessionSize} partite:`);
        console.log(`   Media profitto: ${(totalProfit/sampleSize).toFixed(3)}%`);
        console.log(`   Media bets per sessione: ${(totalBets/sampleSize).toFixed(0)}`);
        console.log(`   Media betting freq: ${(totalBets/sampleSize/sessionSize*100).toFixed(2)}%`);
        console.log(`   Sessioni positive: ${positives}/${sampleSize} (${(positives/sampleSize*100).toFixed(1)}%)`);
    }

    // Test strategie combinate per frequenza alta
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('              TEST STRATEGIE COMBINATE MULTI-PAYOUT');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('');

    // Combinazioni che potrebbero raggiungere 10% betting
    await testCombinedStrategies(crashes, checkpoints, sessionSize, sampleSize);
}

async function testCombinedStrategies(crashes, checkpoints, sessionSize, sampleSize) {
    // Strategia: bet su più payout con delay diversi
    function simulateCombined(crashes, strategies) {
        let balance = 1000000;
        const initBalance = balance;
        let totalBets = 0;
        let wins = 0;
        let losses = 0;
        let maxDrawdown = 0;
        let peakBalance = balance;

        const states = strategies.map(() => ({
            consecutiveLosses: 0,
            betting: false,
            betsInSeq: 0
        }));

        for (const crash of crashes) {
            // Aggiorna contatori per ogni strategia
            for (let i = 0; i < strategies.length; i++) {
                const s = strategies[i];
                const state = states[i];

                if (crash >= s.targetPayout) {
                    state.consecutiveLosses = 0;
                } else {
                    state.consecutiveLosses++;
                }
            }

            // Trova quale strategia può bet (priorità in ordine)
            let didBet = false;
            for (let i = 0; i < strategies.length && !didBet; i++) {
                const s = strategies[i];
                const state = states[i];

                const shouldBet = state.betting || state.consecutiveLosses >= s.entryAfterLosses;

                if (shouldBet) {
                    if (!state.betting) {
                        state.betting = true;
                        state.betsInSeq = 0;
                    }

                    const betAmount = Math.floor(balance * s.betPercent / 100);
                    totalBets++;
                    didBet = true;

                    if (crash >= s.targetPayout) {
                        balance += Math.floor(betAmount * (s.targetPayout - 1));
                        wins++;
                        state.betting = false;
                        state.betsInSeq = 0;
                        state.consecutiveLosses = 0;
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

    const combos = [
        {
            name: 'Triple Layer @1.3/@1.5/@1.8',
            strategies: [
                { targetPayout: 1.30, betPercent: 0.3, entryAfterLosses: 4, maxBets: 5 },
                { targetPayout: 1.50, betPercent: 0.3, entryAfterLosses: 5, maxBets: 5 },
                { targetPayout: 1.80, betPercent: 0.3, entryAfterLosses: 6, maxBets: 5 },
            ]
        },
        {
            name: 'Dual Conservative @1.5/@2.0',
            strategies: [
                { targetPayout: 1.50, betPercent: 0.3, entryAfterLosses: 5, maxBets: 5 },
                { targetPayout: 2.00, betPercent: 0.3, entryAfterLosses: 7, maxBets: 8 },
            ]
        },
        {
            name: 'Wide Range @1.2/@1.5/@2.0/@3.0',
            strategies: [
                { targetPayout: 1.20, betPercent: 0.2, entryAfterLosses: 4, maxBets: 3 },
                { targetPayout: 1.50, betPercent: 0.2, entryAfterLosses: 5, maxBets: 5 },
                { targetPayout: 2.00, betPercent: 0.2, entryAfterLosses: 7, maxBets: 5 },
                { targetPayout: 3.00, betPercent: 0.2, entryAfterLosses: 12, maxBets: 8 },
            ]
        },
        {
            name: 'Low Payout Focus @1.2/@1.3/@1.5',
            strategies: [
                { targetPayout: 1.20, betPercent: 0.3, entryAfterLosses: 3, maxBets: 5 },
                { targetPayout: 1.30, betPercent: 0.3, entryAfterLosses: 4, maxBets: 5 },
                { targetPayout: 1.50, betPercent: 0.3, entryAfterLosses: 5, maxBets: 5 },
            ]
        },
    ];

    console.log('Strategia                              │ Profit │ WinRate │ BetFreq │ MaxDD');
    console.log('───────────────────────────────────────┼────────┼─────────┼─────────┼──────');

    let bestCombo = null;
    let bestScore = -Infinity;

    for (const combo of combos) {
        const result = simulateCombined(crashes, combo.strategies);
        const profit = parseFloat(result.profit);
        const betFreq = parseFloat(result.betFreq);

        console.log(
            `${combo.name.padEnd(38)} │ ` +
            `${(result.profit + '%').padStart(6)} │ ` +
            `${(result.winRate + '%').padStart(7)} │ ` +
            `${(result.betFreq + '%').padStart(7)} │ ` +
            `${(result.maxDrawdown + '%').padStart(5)}`
        );

        if (betFreq >= 5 && profit > bestScore) {
            bestScore = profit;
            bestCombo = { combo, result };
        }
    }

    if (bestCombo) {
        console.log('');
        console.log(`   Migliore combo: ${bestCombo.combo.name}`);
        console.log('');
        console.log('   Validazione su 100 sessioni:');

        let totalProfit = 0;
        let positives = 0;
        let totalBets = 0;

        for (let i = 0; i < sampleSize; i++) {
            const hash = checkpoints[i * 100].hash;
            const testCrashes = generateCrashValues(hash, sessionSize);
            const result = simulateCombined(testCrashes, bestCombo.combo.strategies);
            totalProfit += parseFloat(result.profit);
            totalBets += result.totalBets;
            if (parseFloat(result.profit) > 0) positives++;
        }

        console.log(`   Media profitto: ${(totalProfit/sampleSize).toFixed(3)}%`);
        console.log(`   Media bets: ${(totalBets/sampleSize).toFixed(0)} per sessione`);
        console.log(`   Media freq: ${(totalBets/sampleSize/sessionSize*100).toFixed(2)}%`);
        console.log(`   Sessioni positive: ${positives}/${sampleSize} (${(positives/sampleSize*100).toFixed(1)}%)`);
    }

    console.log('');
}

main().catch(console.error);
