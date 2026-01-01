/**
 * SIMULAZIONE COMPLETA PAOLOBET v3.8
 *
 * Testa l'algoritmo corretto su partite reali per verificare:
 * 1. Il recupero funziona correttamente
 * 2. L'impatto dell'house edge 1%
 * 3. Performance complessiva
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

/**
 * Simula PAOLOBET v3.8 con formula corretta
 */
function simulateV38({
    startingBalance,
    games,
    takeProfit = 50,
    betPercent = 0.6,
    mult = 1.5,
    normalBetsConfig = 15,
    timesToChange = 8,
    multFactor = 2,
    enableProtection = true,
    maxDelay10x = 20,
    maxDelay5x = 10,
    maxColdStreak = 6,
    resumeWaitGames = 7,
    maxBetMultiple = 16,
    trackRecovery = false
}) {
    const startBalance = startingBalance;
    const targetProfit = Math.floor(startBalance * (takeProfit / 100));

    let calculatedBet = Math.floor(startBalance * (betPercent / 100));
    calculatedBet = Math.max(100, Math.floor(calculatedBet / 100) * 100);

    let balance = startBalance;
    let currentMult = mult;
    let baseBet = calculatedBet;
    let normalBets = normalBetsConfig;
    let failBets = 0;
    let maxBets = 400;

    const initMult = currentMult;
    const initBet = baseBet;
    const originalProfit = initBet * (initMult - 1);

    let delay10x = 0, delay5x = 0, coldStreak = 0;
    let isSuspended = false, signalReceived = false, waitAfterSignal = 0;
    let recentGames = [];

    let gamesPlayed = 0, betsPlaced = 0, suspendGames = 0;
    let wins = 0, losses = 0;
    let targetReached = false, targetGame = 0;
    let balanceATL = startBalance;
    let x2div2Count = 0;

    // Tracking recuperi
    let recoveryLog = [];
    let currentCycleLosses = 0;
    let currentCycleStart = 0;

    function reset() {
        if (trackRecovery && currentCycleLosses > 0) {
            recoveryLog.push({
                startGame: currentCycleStart,
                endGame: gamesPlayed,
                losses: currentCycleLosses,
                bet: baseBet,
                mult: currentMult,
                x2div2Count
            });
        }
        currentMult = initMult;
        baseBet = initBet;
        failBets = 0;
        normalBets = normalBetsConfig;
        maxBets = 400;
        currentCycleLosses = 0;
        currentCycleStart = gamesPlayed;
        x2div2Count = 0;
    }

    function checkResume(lastBust) {
        if (lastBust >= 10) {
            signalReceived = true;
            waitAfterSignal = resumeWaitGames;
            return false;
        }

        const delaysOk = delay10x <= maxDelay10x &&
                         delay5x <= maxDelay5x &&
                         coldStreak <= maxColdStreak;

        if (signalReceived) {
            waitAfterSignal--;
            if (waitAfterSignal <= 0) {
                const last10 = recentGames.slice(-10);
                const count5x = last10.filter(g => g >= 5).length;
                if (count5x >= 2 && delaysOk) {
                    return true;
                }
                if (count5x < 2) signalReceived = false;
                return false;
            }
        }

        const last10 = recentGames.slice(-10);
        const count5x = last10.filter(g => g >= 5).length;
        if (count5x >= 3 && delaysOk) {
            return true;
        }

        return false;
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
            if (checkResume(bust)) {
                isSuspended = false;
                signalReceived = false;
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
            // VITTORIA
            balance += currentBet * currentMult;
            wins++;
            reset();
        } else {
            // PERDITA
            losses++;
            currentCycleLosses += currentBet;

            if (normalBets > 0) {
                currentMult++;
                normalBets--;
            } else {
                failBets++;
                if (failBets % timesToChange === 0) {
                    // FORMULA CORRETTA v3.8: mult / factor + 1
                    const newBet = baseBet * multFactor;
                    const maxBet = initBet * maxBetMultiple;

                    if (newBet > maxBet) {
                        currentMult++;
                    } else {
                        currentMult = currentMult / multFactor + 1;
                        baseBet = newBet;
                        x2div2Count++;
                    }
                } else {
                    currentMult++;
                }
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
        wins,
        losses,
        winRate: wins / (wins + losses) * 100,
        busted: balance <= initBet,
        maxDrawdown: ((balanceATL - startBalance) / startBalance) * 100,
        finalBalance: balance,
        recoveryLog
    };
}

/**
 * Simula PAOLOBET v3.7 con formula SBAGLIATA per confronto
 */
function simulateV37_OLD({
    startingBalance,
    games,
    takeProfit = 50,
    betPercent = 0.6,
    mult = 1.5,
    normalBetsConfig = 15,
    timesToChange = 8,
    multFactor = 2,
    enableProtection = true,
    maxDelay10x = 20,
    maxDelay5x = 10,
    maxColdStreak = 6,
    resumeWaitGames = 7,
    maxBetMultiple = 16
}) {
    const startBalance = startingBalance;
    const targetProfit = Math.floor(startBalance * (takeProfit / 100));

    let calculatedBet = Math.floor(startBalance * (betPercent / 100));
    calculatedBet = Math.max(100, Math.floor(calculatedBet / 100) * 100);

    let balance = startBalance;
    let currentMult = mult;
    let baseBet = calculatedBet;
    let normalBets = normalBetsConfig;
    let failBets = 0;
    let maxBets = 400;

    const initMult = currentMult;
    const initBet = baseBet;

    let delay10x = 0, delay5x = 0, coldStreak = 0;
    let isSuspended = false, signalReceived = false, waitAfterSignal = 0;
    let recentGames = [];

    let gamesPlayed = 0, betsPlaced = 0, suspendGames = 0;
    let wins = 0, losses = 0;
    let targetReached = false, targetGame = 0;
    let balanceATL = startBalance;

    function reset() {
        currentMult = initMult;
        baseBet = initBet;
        failBets = 0;
        normalBets = normalBetsConfig;
        maxBets = 400;
    }

    function checkResume(lastBust) {
        if (lastBust >= 10) {
            signalReceived = true;
            waitAfterSignal = resumeWaitGames;
            return false;
        }

        const delaysOk = delay10x <= maxDelay10x &&
                         delay5x <= maxDelay5x &&
                         coldStreak <= maxColdStreak;

        if (signalReceived) {
            waitAfterSignal--;
            if (waitAfterSignal <= 0) {
                const last10 = recentGames.slice(-10);
                const count5x = last10.filter(g => g >= 5).length;
                if (count5x >= 2 && delaysOk) {
                    return true;
                }
                if (count5x < 2) signalReceived = false;
                return false;
            }
        }

        const last10 = recentGames.slice(-10);
        const count5x = last10.filter(g => g >= 5).length;
        if (count5x >= 3 && delaysOk) {
            return true;
        }

        return false;
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
            if (checkResume(bust)) {
                isSuspended = false;
                signalReceived = false;
            }
            continue;
        }

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
            wins++;
            reset();
        } else {
            losses++;

            if (normalBets > 0) {
                currentMult++;
                normalBets--;
            } else {
                failBets++;
                if (failBets % timesToChange === 0) {
                    // FORMULA VECCHIA SBAGLIATA: (mult - 1) / factor + 1
                    const newBet = baseBet * multFactor;
                    const maxBet = initBet * maxBetMultiple;

                    if (newBet > maxBet) {
                        currentMult++;
                    } else {
                        currentMult = (currentMult - 1) / multFactor + 1;  // BUG!
                        baseBet = newBet;
                    }
                } else {
                    currentMult++;
                }
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
        wins,
        losses,
        winRate: wins / (wins + losses) * 100,
        busted: balance <= initBet,
        maxDrawdown: ((balanceATL - startBalance) / startBalance) * 100,
        finalBalance: balance
    };
}

const HASH_CHECKPOINTS_10M = require('./hash-checkpoints-10M.js').HASH_CHECKPOINTS_10M;

async function main() {
    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
    console.log('║        CONFRONTO PAOLOBET v3.7 (bug) vs v3.8 (corretto)                  ║');
    console.log('║                      Con House Edge 1% reale                              ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
    console.log('');

    const NUM_SESSIONS = 500;
    const GAMES_PER_SESSION = 3000;
    const STARTING_BALANCE = 100000;

    console.log('📊 CONFIGURAZIONE TEST:');
    console.log('   Sessioni:         ' + NUM_SESSIONS);
    console.log('   Partite/sessione: ' + GAMES_PER_SESSION);
    console.log('   Balance iniziale: ' + (STARTING_BALANCE/100) + ' bits');
    console.log('   Take Profit:      50%');
    console.log('   Pattern Prot:     SI (20/10/6)');
    console.log('');

    console.log('🔄 Generazione partite...');
    const allGames = [];
    for (let i = 0; i < NUM_SESSIONS; i++) {
        allGames.push(generateGameResults(
            HASH_CHECKPOINTS_10M[i % HASH_CHECKPOINTS_10M.length].hash,
            GAMES_PER_SESSION
        ));
    }
    console.log('   ✓ Pronto');
    console.log('');

    // Test v3.7 (bug)
    console.log('🔄 Testing v3.7 (formula sbagliata)...');
    const v37Results = [];
    for (let i = 0; i < NUM_SESSIONS; i++) {
        v37Results.push(simulateV37_OLD({
            startingBalance: STARTING_BALANCE,
            games: allGames[i],
            takeProfit: 50,
            betPercent: 0.6,
            mult: 1.5
        }));
    }
    console.log('   ✓ Completato');

    // Test v3.8 (corretto)
    console.log('🔄 Testing v3.8 (formula corretta)...');
    const v38Results = [];
    for (let i = 0; i < NUM_SESSIONS; i++) {
        v38Results.push(simulateV38({
            startingBalance: STARTING_BALANCE,
            games: allGames[i],
            takeProfit: 50,
            betPercent: 0.6,
            mult: 1.5
        }));
    }
    console.log('   ✓ Completato');

    // Calcola statistiche
    function calcStats(results) {
        const hits = results.filter(r => r.targetReached);
        const busted = results.filter(r => r.busted);
        return {
            hitRate: (hits.length / results.length * 100),
            avgProfit: results.reduce((a, r) => a + r.profitPercent, 0) / results.length,
            avgBets: results.reduce((a, r) => a + r.betsPlaced, 0) / results.length,
            avgGames: results.reduce((a, r) => a + r.gamesPlayed, 0) / results.length,
            avgTargetGame: hits.length > 0 ? hits.reduce((a, r) => a + r.targetGame, 0) / hits.length : 0,
            suspendPercent: results.reduce((a, r) => a + r.suspendGames, 0) / results.reduce((a, r) => a + r.gamesPlayed, 0) * 100,
            avgDrawdown: results.reduce((a, r) => a + r.maxDrawdown, 0) / results.length,
            bustedRate: (busted.length / results.length * 100),
            avgWinRate: results.reduce((a, r) => a + r.winRate, 0) / results.length
        };
    }

    const stats37 = calcStats(v37Results);
    const stats38 = calcStats(v38Results);

    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('                              📊 RISULTATI');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    console.log('┌─────────────────┬──────────────────┬──────────────────┬──────────────┐');
    console.log('│ Metrica         │ v3.7 (bug)       │ v3.8 (corretto)  │ Differenza   │');
    console.log('├─────────────────┼──────────────────┼──────────────────┼──────────────┤');

    function row(label, v37, v38, format = 'percent') {
        let val37, val38, diff;
        if (format === 'percent') {
            val37 = (v37 >= 0 ? '+' : '') + v37.toFixed(1) + '%';
            val38 = (v38 >= 0 ? '+' : '') + v38.toFixed(1) + '%';
            diff = (v38 - v37 >= 0 ? '+' : '') + (v38 - v37).toFixed(1) + '%';
        } else if (format === 'number') {
            val37 = v37.toFixed(0);
            val38 = v38.toFixed(0);
            diff = (v38 - v37 >= 0 ? '+' : '') + (v38 - v37).toFixed(0);
        }
        console.log('│ ' + label.padEnd(15) + ' │ ' + val37.padStart(16) + ' │ ' + val38.padStart(16) + ' │ ' + diff.padStart(12) + ' │');
    }

    row('Hit Rate', stats37.hitRate, stats38.hitRate);
    row('EV (profitto)', stats37.avgProfit, stats38.avgProfit);
    row('Win Rate bet', stats37.avgWinRate, stats38.avgWinRate);
    row('Drawdown max', stats37.avgDrawdown, stats38.avgDrawdown);
    row('Busted', stats37.bustedRate, stats38.bustedRate);
    row('Suspend %', stats37.suspendPercent, stats38.suspendPercent);
    row('Avg Bets', stats37.avgBets, stats38.avgBets, 'number');
    row('@Game 50%', stats37.avgTargetGame, stats38.avgTargetGame, 'number');

    console.log('└─────────────────┴──────────────────┴──────────────────┴──────────────┘');
    console.log('');

    // Analisi differenza
    const evDiff = stats38.avgProfit - stats37.avgProfit;
    const hitDiff = stats38.hitRate - stats37.hitRate;

    if (evDiff > 0) {
        console.log('✅ v3.8 ha EV migliore di ' + evDiff.toFixed(2) + '% rispetto a v3.7');
    } else {
        console.log('⚠️ v3.8 ha EV peggiore di ' + (-evDiff).toFixed(2) + '% rispetto a v3.7');
    }

    if (hitDiff > 0) {
        console.log('✅ v3.8 ha hit rate migliore di ' + hitDiff.toFixed(1) + '% rispetto a v3.7');
    } else if (hitDiff < -1) {
        console.log('⚠️ v3.8 ha hit rate peggiore di ' + (-hitDiff).toFixed(1) + '% rispetto a v3.7');
    } else {
        console.log('→ Hit rate simile (differenza < 1%)');
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('');

    // Test senza protezione per vedere l'impatto puro della formula
    console.log('🔄 Testing SENZA protezione per isolare impatto formula...');

    const v37NoProtResults = [];
    const v38NoProtResults = [];
    for (let i = 0; i < NUM_SESSIONS; i++) {
        v37NoProtResults.push(simulateV37_OLD({
            startingBalance: STARTING_BALANCE,
            games: allGames[i],
            takeProfit: 50,
            betPercent: 0.6,
            mult: 1.5,
            enableProtection: false
        }));
        v38NoProtResults.push(simulateV38({
            startingBalance: STARTING_BALANCE,
            games: allGames[i],
            takeProfit: 50,
            betPercent: 0.6,
            mult: 1.5,
            enableProtection: false
        }));
    }

    const stats37NP = calcStats(v37NoProtResults);
    const stats38NP = calcStats(v38NoProtResults);

    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('                     SENZA PROTEZIONE (impatto puro formula)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    console.log('┌─────────────────┬──────────────────┬──────────────────┬──────────────┐');
    console.log('│ Metrica         │ v3.7 (bug)       │ v3.8 (corretto)  │ Differenza   │');
    console.log('├─────────────────┼──────────────────┼──────────────────┼──────────────┤');

    row('Hit Rate', stats37NP.hitRate, stats38NP.hitRate);
    row('EV (profitto)', stats37NP.avgProfit, stats38NP.avgProfit);
    row('Win Rate bet', stats37NP.avgWinRate, stats38NP.avgWinRate);
    row('Drawdown max', stats37NP.avgDrawdown, stats38NP.avgDrawdown);
    row('Busted', stats37NP.bustedRate, stats38NP.bustedRate);

    console.log('└─────────────────┴──────────────────┴──────────────────┴──────────────┘');
    console.log('');

    const evDiffNP = stats38NP.avgProfit - stats37NP.avgProfit;
    console.log('📊 Impatto puro della correzione formula: ' + (evDiffNP >= 0 ? '+' : '') + evDiffNP.toFixed(2) + '% EV');
    console.log('');
}

main().catch(console.error);
