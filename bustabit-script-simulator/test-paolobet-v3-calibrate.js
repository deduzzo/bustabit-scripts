/**
 * CALIBRAZIONE SOGLIE Pattern Protection
 */

const crypto = require('crypto');
const fs = require('fs');

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

function simulateV3({ startingBalance, games, takeProfit = 50, betPercent = 0.6, mult = 1.5, enableProtection = true, maxDelay10x = 28, maxDelay5x = 13, maxColdStreak = 8, resumeWaitGames = 5 }) {
    const startBalance = startingBalance;
    const targetProfit = Math.floor(startBalance * (takeProfit / 100));

    let calculatedBet = Math.floor(startBalance * (betPercent / 100));
    calculatedBet = Math.max(100, Math.floor(calculatedBet / 100) * 100);

    let balance = startBalance;
    let currentMult = mult;
    let baseBet = calculatedBet;
    let normalBets = 15;
    let failBets = 0;
    let negativeChanges = 0;
    let maxBets = 400;

    const initMult = currentMult;
    const initBet = baseBet;

    let delay10x = 0, delay5x = 0, coldStreak = 0;
    let isSuspended = false, signalReceived = false, waitAfterSignal = 0;
    let recentGames = [];

    let gamesPlayed = 0, betsPlaced = 0, suspendGames = 0;
    let targetReached = false, targetGame = 0;
    let balanceATL = startBalance;

    function reset() {
        currentMult = initMult;
        baseBet = initBet;
        failBets = 0;
        normalBets = 15;
        negativeChanges = 0;
        maxBets = 400;
    }

    for (let i = 0; i < games.length; i++) {
        const bust = games[i];
        gamesPlayed++;

        recentGames.push(bust);
        if (recentGames.length > 30) recentGames.shift();

        if (bust >= 10) delay10x = 0; else delay10x++;
        if (bust >= 5) delay5x = 0; else delay5x++;
        if (bust >= 3) coldStreak = 0; else coldStreak++;

        if (balance - startBalance >= targetProfit) {
            targetReached = true;
            targetGame = i + 1;
            break;
        }

        if (isSuspended) {
            suspendGames++;
            // Check resume
            if (bust >= 10) {
                signalReceived = true;
                waitAfterSignal = resumeWaitGames;
            }
            if (signalReceived) {
                waitAfterSignal--;
                if (waitAfterSignal <= 0) {
                    const count5x = recentGames.slice(-10).filter(g => g >= 5).length;
                    if (count5x >= 2) {
                        isSuspended = false;
                        signalReceived = false;
                        // NO reset! Continua da dove era
                    } else {
                        signalReceived = false;
                    }
                }
            } else {
                const count5x = recentGames.slice(-10).filter(g => g >= 5).length;
                if (count5x >= 3) {
                    isSuspended = false;
                    // NO reset! Continua da dove era
                }
            }
            continue;
        }

        // Check suspend
        if (enableProtection) {
            if (delay10x > maxDelay10x || delay5x > maxDelay5x || coldStreak > maxColdStreak) {
                isSuspended = true;
                signalReceived = false;
                continue;
            }
        }

        if (maxBets <= 0) reset();

        const currentBet = Math.round(baseBet);
        if (currentBet > balance) break;

        balance -= currentBet;
        betsPlaced++;

        if (currentMult <= bust) {
            balance += currentBet * currentMult;
            if (bust < currentMult) {
                currentMult -= parseInt(bust, 10) - 1;
            } else {
                reset();
            }
        } else {
            if (normalBets <= 0) {
                failBets++;
                if (failBets % 8 === 0) {
                    negativeChanges++;
                    currentMult = (currentMult / 2) + negativeChanges;
                    baseBet *= 2;
                } else {
                    currentMult++;
                }
            } else {
                currentMult++;
                normalBets--;
            }
            maxBets--;
        }

        if (balance < balanceATL) balanceATL = balance;
    }

    return {
        profitPercent: ((balance - startBalance) / startBalance) * 100,
        targetReached,
        targetGame,
        betsPlaced,
        gamesPlayed,
        suspendGames,
        busted: balance < 100,
        maxDrawdown: ((balanceATL - startBalance) / startBalance) * 100
    };
}

const HASH_CHECKPOINTS_10M = require('./hash-checkpoints-10M.js').HASH_CHECKPOINTS_10M;

async function main() {
    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
    console.log('║             CALIBRAZIONE SOGLIE Pattern Protection                        ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
    console.log('');

    const NUM_SESSIONS = 500;
    const GAMES_PER_SESSION = 3000;
    const STARTING_BALANCE = 100000;

    // Pre-genera game
    console.log('🔄 Generazione partite...');
    const allGames = [];
    for (let i = 0; i < NUM_SESSIONS; i++) {
        allGames.push(generateGameResults(HASH_CHECKPOINTS_10M[i % HASH_CHECKPOINTS_10M.length].hash, GAMES_PER_SESSION));
    }
    console.log('   ✓ Pronto');
    console.log('');

    // Configurazioni da testare
    const configs = [
        { name: 'SENZA Protezione', enableProtection: false },
        { name: 'P95 (originale)', enableProtection: true, maxDelay10x: 28, maxDelay5x: 13, maxColdStreak: 8, resumeWaitGames: 5 },
        { name: 'P99 (permissivo)', enableProtection: true, maxDelay10x: 44, maxDelay5x: 20, maxColdStreak: 12, resumeWaitGames: 3 },
        { name: 'Solo 10x delay', enableProtection: true, maxDelay10x: 35, maxDelay5x: 999, maxColdStreak: 999, resumeWaitGames: 3 },
        { name: 'Solo 10x strict', enableProtection: true, maxDelay10x: 25, maxDelay5x: 999, maxColdStreak: 999, resumeWaitGames: 5 },
        { name: 'Medio bilanciato', enableProtection: true, maxDelay10x: 35, maxDelay5x: 15, maxColdStreak: 10, resumeWaitGames: 3 },
        { name: 'Ultra permissivo', enableProtection: true, maxDelay10x: 50, maxDelay5x: 25, maxColdStreak: 15, resumeWaitGames: 2 },
    ];

    const results = [];

    for (const config of configs) {
        process.stdout.write(`🔄 Testing "${config.name}"...`);

        const sessionResults = [];
        for (let i = 0; i < NUM_SESSIONS; i++) {
            sessionResults.push(simulateV3({
                startingBalance: STARTING_BALANCE,
                games: allGames[i],
                takeProfit: 50,
                betPercent: 0.6,
                mult: 1.5,
                ...config
            }));
        }

        const targetHits = sessionResults.filter(r => r.targetReached);
        const avgProfit = sessionResults.reduce((a, r) => a + r.profitPercent, 0) / sessionResults.length;
        const avgBets = sessionResults.reduce((a, r) => a + r.betsPlaced, 0) / sessionResults.length;
        const avgGames = sessionResults.reduce((a, r) => a + r.gamesPlayed, 0) / sessionResults.length;
        const avgSuspendGames = sessionResults.reduce((a, r) => a + r.suspendGames, 0) / sessionResults.length;
        const avgTargetGame = targetHits.length > 0 ? targetHits.reduce((a, r) => a + r.targetGame, 0) / targetHits.length : 0;
        const avgDrawdown = sessionResults.reduce((a, r) => a + r.maxDrawdown, 0) / sessionResults.length;

        results.push({
            name: config.name,
            hitRate: (targetHits.length / sessionResults.length * 100),
            avgProfit,
            avgBets,
            avgGames,
            avgTargetGame,
            suspendPercent: (avgSuspendGames / avgGames * 100),
            avgDrawdown
        });

        console.log(` ✓`);
    }

    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('                              📊 RISULTATI');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    console.log('┌────────────────────┬──────────┬──────────┬───────────┬───────────┬───────────┬───────────┐');
    console.log('│ Config             │ Hit Rate │ EV %     │ Avg Bets  │ @Game 50% │ Suspend % │ Drawdown  │');
    console.log('├────────────────────┼──────────┼──────────┼───────────┼───────────┼───────────┼───────────┤');

    for (const r of results) {
        const ev = r.avgProfit >= 0 ? `+${r.avgProfit.toFixed(1)}%` : `${r.avgProfit.toFixed(1)}%`;
        const targetGame = r.avgTargetGame > 0 ? `~${Math.round(r.avgTargetGame)}` : '-';
        console.log(
            `│ ${r.name.padEnd(18)} │ ${r.hitRate.toFixed(1).padStart(7)}% │ ${ev.padStart(8)} │ ${r.avgBets.toFixed(0).padStart(9)} │ ${targetGame.padStart(9)} │ ${r.suspendPercent.toFixed(1).padStart(8)}% │ ${r.avgDrawdown.toFixed(0).padStart(8)}% │`
        );
    }

    console.log('└────────────────────┴──────────┴──────────┴───────────┴───────────┴───────────┴───────────┘');
    console.log('');

    // Trova il migliore bilanciato
    const baseline = results.find(r => r.name === 'SENZA Protezione');
    const withProtection = results.filter(r => r.name !== 'SENZA Protezione');

    // Migliore per EV
    const bestEV = withProtection.sort((a, b) => b.avgProfit - a.avgProfit)[0];

    // Migliore bilanciato (hit rate simile a baseline con EV migliore)
    const balanced = withProtection.filter(r => r.hitRate >= baseline.hitRate - 5).sort((a, b) => b.avgProfit - a.avgProfit)[0];

    console.log('🏆 RACCOMANDAZIONI:');
    console.log('────────────────────────────────────────────────────────────────────────────');
    console.log(`   Baseline (no prot):  Hit ${baseline.hitRate.toFixed(1)}%, EV ${baseline.avgProfit.toFixed(2)}%`);
    console.log('');
    console.log(`   Migliore EV:         "${bestEV.name}"`);
    console.log(`                        Hit ${bestEV.hitRate.toFixed(1)}%, EV ${bestEV.avgProfit.toFixed(2)}%`);
    if (balanced) {
        console.log('');
        console.log(`   Migliore bilanciato: "${balanced.name}"`);
        console.log(`                        Hit ${balanced.hitRate.toFixed(1)}%, EV ${balanced.avgProfit.toFixed(2)}%`);
    }
    console.log('');

    fs.writeFileSync('./paolobet-v3-calibration.json', JSON.stringify({ results }, null, 2));
    console.log('💾 Risultati salvati in paolobet-v3-calibration.json');
}

main().catch(console.error);
