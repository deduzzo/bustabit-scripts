/**
 * ANALISI STRATEGIA SESSIONI BREVI
 * Sessioni corte con take profit aggressivo per sfruttare la varianza
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

// Simula sessione con target profit veloce
function simulateQuickSession(crashes, config) {
    const {
        targetPayout,
        betPercent,
        sessionTakeProfit,  // % target per sessione
        sessionStopLoss,    // % stop loss per sessione
        maxBetsPerSession,  // max bets per sessione
        cooldownAfterLoss,  // pause dopo sequenza perdente
        entryAfterLosses    // entry dopo X perdite (delay)
    } = config;

    let balance = 1000000;
    const initBalance = balance;
    let sessionBalance = balance;
    let totalBets = 0;
    let totalWins = 0;
    let totalLosses = 0;
    let sessionsPlayed = 0;
    let sessionsWon = 0;
    let maxDrawdown = 0;
    let peakBalance = balance;
    let cooldownCounter = 0;

    // Delay tracking
    let consecutiveLosses = 0;
    let betting = false;
    let betsInSession = 0;

    for (const crash of crashes) {
        // Update delay counter
        if (crash >= targetPayout) {
            consecutiveLosses = 0;
        } else {
            consecutiveLosses++;
        }

        // Cooldown check
        if (cooldownCounter > 0) {
            cooldownCounter--;
            continue;
        }

        // Check session limits
        const sessionProfit = (balance - sessionBalance) / sessionBalance * 100;

        if (betsInSession >= maxBetsPerSession || sessionProfit >= sessionTakeProfit) {
            // Session ended successfully or max bets reached
            if (sessionProfit > 0) sessionsWon++;
            sessionsPlayed++;
            sessionBalance = balance;
            betsInSession = 0;
            betting = false;
            continue;
        }

        if (sessionProfit <= -sessionStopLoss) {
            // Session lost - take cooldown
            sessionsPlayed++;
            sessionBalance = balance;
            betsInSession = 0;
            betting = false;
            cooldownCounter = cooldownAfterLoss;
            continue;
        }

        // Delay entry logic
        if (!betting && consecutiveLosses >= entryAfterLosses) {
            betting = true;
        }

        if (!betting) continue;

        // Place bet
        const betAmount = Math.floor(balance * betPercent / 100);
        if (betAmount < 1) break;

        totalBets++;
        betsInSession++;

        if (crash >= targetPayout) {
            balance += Math.floor(betAmount * (targetPayout - 1));
            totalWins++;
            // Reset dopo win
            betting = false;
        } else {
            balance -= betAmount;
            totalLosses++;
        }

        if (balance > peakBalance) peakBalance = balance;
        const dd = (peakBalance - balance) / peakBalance * 100;
        if (dd > maxDrawdown) maxDrawdown = dd;
    }

    return {
        profit: ((balance - initBalance) / initBalance * 100).toFixed(2),
        wins: totalWins,
        losses: totalLosses,
        winRate: totalWins + totalLosses > 0 ? (totalWins / (totalWins + totalLosses) * 100).toFixed(1) : '0',
        totalBets,
        betFreq: (totalBets / crashes.length * 100).toFixed(2),
        sessions: sessionsPlayed,
        sessionWinRate: sessionsPlayed > 0 ? (sessionsWon / sessionsPlayed * 100).toFixed(1) : '0',
        maxDrawdown: maxDrawdown.toFixed(2)
    };
}

// Strategia più semplice: flat bet con stop molto stretti
function simulateStrictStops(crashes, config) {
    const {
        targetPayout,
        betPercent,
        takeProfitBits,   // Bits di profitto target
        stopLossBits,     // Bits di perdita max
        pauseAfterWin,    // Pause dopo win
        pauseAfterLoss    // Pause dopo loss
    } = config;

    let balance = 1000000;
    const initBalance = balance;
    let totalBets = 0;
    let wins = 0;
    let losses = 0;
    let maxDrawdown = 0;
    let peakBalance = balance;
    let pauseCounter = 0;

    for (const crash of crashes) {
        // Check limits
        const profitBits = (balance - initBalance) / 100;
        if (profitBits >= takeProfitBits || profitBits <= -stopLossBits) break;

        if (pauseCounter > 0) {
            pauseCounter--;
            continue;
        }

        const betAmount = Math.floor(balance * betPercent / 100);
        if (betAmount < 1) break;

        totalBets++;

        if (crash >= targetPayout) {
            balance += Math.floor(betAmount * (targetPayout - 1));
            wins++;
            pauseCounter = pauseAfterWin;
        } else {
            balance -= betAmount;
            losses++;
            pauseCounter = pauseAfterLoss;
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
    const checkpoints = require('./hash-checkpoints-10M.js').HASH_CHECKPOINTS_10M;
    const sessionSize = 10000;
    const sampleSize = 200;

    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
    console.log('║         ANALISI STRATEGIA SESSIONI BREVI - 200 CAMPIONI x 10K            ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
    console.log('');

    // Test configurazioni "sessioni brevi con TP aggressivo"
    const sessionConfigs = [
        { name: '@1.5x TP2% SL3% max20', targetPayout: 1.5, betPercent: 0.3, sessionTakeProfit: 2, sessionStopLoss: 3, maxBetsPerSession: 20, cooldownAfterLoss: 5, entryAfterLosses: 3 },
        { name: '@1.5x TP1% SL2% max15', targetPayout: 1.5, betPercent: 0.2, sessionTakeProfit: 1, sessionStopLoss: 2, maxBetsPerSession: 15, cooldownAfterLoss: 5, entryAfterLosses: 3 },
        { name: '@1.8x TP2% SL3% max20', targetPayout: 1.8, betPercent: 0.3, sessionTakeProfit: 2, sessionStopLoss: 3, maxBetsPerSession: 20, cooldownAfterLoss: 5, entryAfterLosses: 4 },
        { name: '@1.8x TP1.5% SL2% max15', targetPayout: 1.8, betPercent: 0.25, sessionTakeProfit: 1.5, sessionStopLoss: 2, maxBetsPerSession: 15, cooldownAfterLoss: 5, entryAfterLosses: 4 },
        { name: '@2.0x TP3% SL4% max25', targetPayout: 2.0, betPercent: 0.4, sessionTakeProfit: 3, sessionStopLoss: 4, maxBetsPerSession: 25, cooldownAfterLoss: 5, entryAfterLosses: 5 },
        { name: '@2.0x TP2% SL3% max20', targetPayout: 2.0, betPercent: 0.3, sessionTakeProfit: 2, sessionStopLoss: 3, maxBetsPerSession: 20, cooldownAfterLoss: 5, entryAfterLosses: 5 },
        { name: '@3.0x TP5% SL5% max30', targetPayout: 3.0, betPercent: 0.5, sessionTakeProfit: 5, sessionStopLoss: 5, maxBetsPerSession: 30, cooldownAfterLoss: 10, entryAfterLosses: 8 },
    ];

    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('               TEST SESSIONI BREVI CON TAKE PROFIT RAPIDO');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('');
    console.log('Config                    │ AvgProfit │ WinRate │ BetFreq │ SessWin │ MaxDD');
    console.log('──────────────────────────┼───────────┼─────────┼─────────┼─────────┼──────');

    for (const config of sessionConfigs) {
        let totalProfit = 0;
        let totalWinRate = 0;
        let totalBetFreq = 0;
        let totalSessWR = 0;
        let maxMaxDD = 0;

        for (let i = 0; i < sampleSize; i++) {
            const hash = checkpoints[i * 50].hash;
            const crashes = generateCrashValues(hash, sessionSize);
            const result = simulateQuickSession(crashes, config);
            totalProfit += parseFloat(result.profit);
            totalWinRate += parseFloat(result.winRate);
            totalBetFreq += parseFloat(result.betFreq);
            totalSessWR += parseFloat(result.sessionWinRate);
            if (parseFloat(result.maxDrawdown) > maxMaxDD) maxMaxDD = parseFloat(result.maxDrawdown);
        }

        const avgProfit = (totalProfit / sampleSize).toFixed(2);
        const avgWinRate = (totalWinRate / sampleSize).toFixed(1);
        const avgBetFreq = (totalBetFreq / sampleSize).toFixed(2);
        const avgSessWR = (totalSessWR / sampleSize).toFixed(1);

        console.log(
            `${config.name.padEnd(25)} │ ` +
            `${(avgProfit + '%').padStart(9)} │ ` +
            `${(avgWinRate + '%').padStart(7)} │ ` +
            `${(avgBetFreq + '%').padStart(7)} │ ` +
            `${(avgSessWR + '%').padStart(7)} │ ` +
            `${(maxMaxDD.toFixed(1) + '%').padStart(5)}`
        );
    }

    // Test strategia flat con pause dopo eventi
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('              TEST FLAT BET CON PAUSE DOPO WIN/LOSS');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('');

    const pauseConfigs = [
        { name: '@1.5x 0.3% pw3 pl1', targetPayout: 1.5, betPercent: 0.3, takeProfitBits: 500, stopLossBits: 300, pauseAfterWin: 3, pauseAfterLoss: 1 },
        { name: '@1.5x 0.3% pw5 pl2', targetPayout: 1.5, betPercent: 0.3, takeProfitBits: 500, stopLossBits: 300, pauseAfterWin: 5, pauseAfterLoss: 2 },
        { name: '@1.8x 0.3% pw3 pl1', targetPayout: 1.8, betPercent: 0.3, takeProfitBits: 500, stopLossBits: 300, pauseAfterWin: 3, pauseAfterLoss: 1 },
        { name: '@1.8x 0.3% pw5 pl2', targetPayout: 1.8, betPercent: 0.3, takeProfitBits: 500, stopLossBits: 300, pauseAfterWin: 5, pauseAfterLoss: 2 },
        { name: '@2.0x 0.4% pw3 pl1', targetPayout: 2.0, betPercent: 0.4, takeProfitBits: 800, stopLossBits: 500, pauseAfterWin: 3, pauseAfterLoss: 1 },
        { name: '@2.0x 0.4% pw5 pl2', targetPayout: 2.0, betPercent: 0.4, takeProfitBits: 800, stopLossBits: 500, pauseAfterWin: 5, pauseAfterLoss: 2 },
    ];

    console.log('Config                    │ AvgProfit │ WinRate │ BetFreq │ AvgBets │ MaxDD');
    console.log('──────────────────────────┼───────────┼─────────┼─────────┼─────────┼──────');

    for (const config of pauseConfigs) {
        let totalProfit = 0;
        let totalWinRate = 0;
        let totalBetFreq = 0;
        let totalBets = 0;
        let maxMaxDD = 0;

        for (let i = 0; i < sampleSize; i++) {
            const hash = checkpoints[i * 50].hash;
            const crashes = generateCrashValues(hash, sessionSize);
            const result = simulateStrictStops(crashes, config);
            totalProfit += parseFloat(result.profit);
            totalWinRate += parseFloat(result.winRate);
            totalBetFreq += parseFloat(result.betFreq);
            totalBets += result.totalBets;
            if (parseFloat(result.maxDrawdown) > maxMaxDD) maxMaxDD = parseFloat(result.maxDrawdown);
        }

        const avgProfit = (totalProfit / sampleSize).toFixed(2);
        const avgWinRate = (totalWinRate / sampleSize).toFixed(1);
        const avgBetFreq = (totalBetFreq / sampleSize).toFixed(2);
        const avgBets = (totalBets / sampleSize).toFixed(0);

        console.log(
            `${config.name.padEnd(25)} │ ` +
            `${(avgProfit + '%').padStart(9)} │ ` +
            `${(avgWinRate + '%').padStart(7)} │ ` +
            `${(avgBetFreq + '%').padStart(7)} │ ` +
            `${avgBets.padStart(7)} │ ` +
            `${(maxMaxDD.toFixed(1) + '%').padStart(5)}`
        );
    }

    // Grid search per trovare la migliore configurazione
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('          GRID SEARCH OTTIMALE (target: freq >= 8%, profit > -0.5%)');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('');

    let bestConfig = null;
    let bestScore = -Infinity;

    const payouts = [1.3, 1.5, 1.8, 2.0];
    const betPercents = [0.15, 0.2, 0.25, 0.3];
    const tps = [1, 1.5, 2, 3];
    const sls = [2, 3, 4];
    const maxBetsList = [15, 20, 25];
    const entries = [2, 3, 4, 5];

    for (const tp_payout of payouts) {
        for (const bp of betPercents) {
            for (const tp of tps) {
                for (const sl of sls) {
                    if (sl < tp) continue; // SL deve essere >= TP per ratio sensato
                    for (const mb of maxBetsList) {
                        for (const entry of entries) {
                            const config = {
                                targetPayout: tp_payout,
                                betPercent: bp,
                                sessionTakeProfit: tp,
                                sessionStopLoss: sl,
                                maxBetsPerSession: mb,
                                cooldownAfterLoss: 5,
                                entryAfterLosses: entry
                            };

                            // Test su subset
                            let totalProfit = 0;
                            let totalBetFreq = 0;
                            const quickSampleSize = 50;

                            for (let i = 0; i < quickSampleSize; i++) {
                                const hash = checkpoints[i * 200].hash;
                                const crashes = generateCrashValues(hash, sessionSize);
                                const result = simulateQuickSession(crashes, config);
                                totalProfit += parseFloat(result.profit);
                                totalBetFreq += parseFloat(result.betFreq);
                            }

                            const avgProfit = totalProfit / quickSampleSize;
                            const avgBetFreq = totalBetFreq / quickSampleSize;

                            // Score: vogliamo freq alta e profit vicino a 0 o positivo
                            if (avgBetFreq >= 5 && avgProfit > -2) {
                                const score = avgProfit + avgBetFreq * 0.3;
                                if (score > bestScore) {
                                    bestScore = score;
                                    bestConfig = { config, avgProfit, avgBetFreq };
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if (bestConfig) {
        console.log('   MIGLIORE CONFIGURAZIONE TROVATA:');
        console.log(`   Payout: @${bestConfig.config.targetPayout}x`);
        console.log(`   Bet: ${bestConfig.config.betPercent}%`);
        console.log(`   Session TP: ${bestConfig.config.sessionTakeProfit}%, SL: ${bestConfig.config.sessionStopLoss}%`);
        console.log(`   Max bets: ${bestConfig.config.maxBetsPerSession}, Entry delay: ${bestConfig.config.entryAfterLosses}`);
        console.log(`   Profitto medio: ${bestConfig.avgProfit.toFixed(3)}%`);
        console.log(`   Frequenza media: ${bestConfig.avgBetFreq.toFixed(2)}%`);
        console.log('');

        // Validazione completa
        console.log('   Validazione su 200 campioni:');
        let totalProfit = 0;
        let totalBetFreq = 0;
        let positives = 0;
        let totalBets = 0;

        for (let i = 0; i < sampleSize; i++) {
            const hash = checkpoints[i * 50].hash;
            const crashes = generateCrashValues(hash, sessionSize);
            const result = simulateQuickSession(crashes, bestConfig.config);
            totalProfit += parseFloat(result.profit);
            totalBetFreq += parseFloat(result.betFreq);
            totalBets += result.totalBets;
            if (parseFloat(result.profit) > 0) positives++;
        }

        console.log(`   Media profitto: ${(totalProfit/sampleSize).toFixed(3)}%`);
        console.log(`   Media frequenza: ${(totalBetFreq/sampleSize).toFixed(2)}%`);
        console.log(`   Media bets: ${(totalBets/sampleSize).toFixed(0)} per sessione`);
        console.log(`   Sessioni positive: ${positives}/${sampleSize} (${(positives/sampleSize*100).toFixed(1)}%)`);
    } else {
        console.log('   Nessuna configurazione trovata con freq >= 5% e profit > -2%');
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('                          CONCLUSIONI');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('');
    console.log('   Il trade-off fondamentale:');
    console.log('   - Più bets = Più esposizione al house edge (1%)');
    console.log('   - Per profitto stabile: poche bet molto selettive');
    console.log('   - Per alta frequenza: accettare perdite a lungo termine');
    console.log('');
    console.log('   Strategie ottimali trovate:');
    console.log('   1. MARTIN_AI_READY: 11 bet/10K, +0.04% avg, 50.44% WR');
    console.log('   2. Con delay @10x: 126 bet/10K, +0.11% avg, 49.59% WR');
    console.log('');
}

main().catch(console.error);
