/**
 * TEST PAOLOBET v3.0 - Con Pattern Protection
 * Confronto: CON protezione vs SENZA protezione
 */

const crypto = require('crypto');
const fs = require('fs');
const EventEmitter = require('events');

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

/**
 * Simula PaoloBet v3 con opzione protezione
 */
function simulateV3({
    startingBalance,
    games,
    takeProfit = 50,
    betPercent = 0.6,
    mult = 1.5,
    enableProtection = true,
    maxDelay10x = 28,
    maxDelay5x = 13,
    maxColdStreak = 8,
    resumeWaitGames = 5
}) {
    const startBalance = startingBalance;
    const targetProfit = Math.floor(startBalance * (takeProfit / 100));

    let calculatedBet = Math.floor(startBalance * (betPercent / 100));
    calculatedBet = Math.max(100, Math.floor(calculatedBet / 100) * 100);

    // State
    let balance = startBalance;
    let currentMult = mult;
    let baseBet = calculatedBet;
    let normalBets = 15;
    let failBets = 0;
    let negativeChanges = 0;
    let maxBets = 400;
    let multRecovered = 0;

    const initMult = currentMult;
    const initBet = baseBet;
    const initNormalBets = normalBets;
    const initMaxBets = maxBets;

    // Pattern protection state
    let delay10x = 0;
    let delay5x = 0;
    let coldStreak = 0;
    let isSuspended = false;
    let signalReceived = false;
    let waitAfterSignal = 0;
    let recentGames = [];

    // Stats
    let gamesPlayed = 0;
    let betsPlaced = 0;
    let suspendCount = 0;
    let suspendGames = 0;
    let targetReached = false;
    let targetGame = 0;
    let balanceATL = startBalance;

    function reset() {
        currentMult = initMult;
        baseBet = initBet;
        failBets = 0;
        normalBets = initNormalBets;
        negativeChanges = 0;
        maxBets = initMaxBets;
        multRecovered = 0;
    }

    function checkSuspension() {
        if (!enableProtection) return false;
        if (delay10x > maxDelay10x) return true;
        if (delay5x > maxDelay5x) return true;
        if (coldStreak > maxColdStreak) return true;
        return false;
    }

    function checkResume(bust) {
        if (bust >= 10) {
            signalReceived = true;
            waitAfterSignal = resumeWaitGames;
            return false;
        }

        if (signalReceived) {
            waitAfterSignal--;
            if (waitAfterSignal <= 0) {
                const last10 = recentGames.slice(-10);
                const count5x = last10.filter(g => g >= 5).length;
                if (count5x >= 2) {
                    return true;
                }
                signalReceived = false;
                return false;
            }
        }

        const last10 = recentGames.slice(-10);
        const count5x = last10.filter(g => g >= 5).length;
        if (count5x >= 3) {
            return true;
        }

        return false;
    }

    for (let i = 0; i < games.length; i++) {
        const bust = games[i];
        gamesPlayed++;

        // Update pattern tracking
        recentGames.push(bust);
        if (recentGames.length > 30) recentGames.shift();

        if (bust >= 10) delay10x = 0; else delay10x++;
        if (bust >= 5) delay5x = 0; else delay5x++;
        if (bust >= 3) coldStreak = 0; else coldStreak++;

        // Check take profit
        const currentProfit = balance - startBalance;
        if (currentProfit >= targetProfit) {
            targetReached = true;
            targetGame = i + 1;
            break;
        }

        // Handle suspension
        if (isSuspended) {
            suspendGames++;
            if (checkResume(bust)) {
                isSuspended = false;
                signalReceived = false;
                reset();
            }
            continue;
        }

        // Check if should suspend
        if (checkSuspension()) {
            isSuspended = true;
            suspendCount++;
            signalReceived = false;
            continue;
        }

        // Reset if max bets
        if (maxBets <= 0) reset();

        // Calculate bet
        const currentBet = Math.round(baseBet);
        if (currentBet > balance) break; // Bust

        // Place bet
        balance -= currentBet;
        betsPlaced++;

        const targetMult = currentMult;
        const won = targetMult <= bust;

        if (won) {
            balance += currentBet * targetMult;

            // Handle win
            if (bust < currentMult) {
                currentMult -= parseInt(bust, 10) - 1;
            } else {
                reset();
            }
        } else {
            // Handle loss
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
        profit: balance - startBalance,
        profitPercent: ((balance - startBalance) / startBalance) * 100,
        balance,
        betsPlaced,
        gamesPlayed,
        targetReached,
        targetGame,
        suspendCount,
        suspendGames,
        busted: balance < 100,
        maxDrawdown: ((balanceATL - startBalance) / startBalance) * 100
    };
}

// Load checkpoints
let HASH_CHECKPOINTS_10M = null;
try {
    HASH_CHECKPOINTS_10M = require('./hash-checkpoints-10M.js').HASH_CHECKPOINTS_10M;
} catch (e) {
    console.error('Checkpoints non trovati!');
    process.exit(1);
}

async function main() {
    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
    console.log('║        TEST PAOLOBET v3.0 - Pattern Protection Comparison                 ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
    console.log('');

    const NUM_SESSIONS = 1000;
    const GAMES_PER_SESSION = 3000;
    const STARTING_BALANCE = 100000; // 1000 bits

    console.log(`📊 Test Setup:`);
    console.log(`   Sessioni:    ${NUM_SESSIONS}`);
    console.log(`   Partite:     ${GAMES_PER_SESSION}/sessione`);
    console.log(`   Bankroll:    ${STARTING_BALANCE / 100} bits`);
    console.log(`   Target:      +50%`);
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Pre-genera tutti i game
    console.log('🔄 Generazione partite...');
    const allGames = [];
    for (let i = 0; i < NUM_SESSIONS; i++) {
        const hash = HASH_CHECKPOINTS_10M[i % HASH_CHECKPOINTS_10M.length].hash;
        allGames.push(generateGameResults(hash, GAMES_PER_SESSION));
        if ((i + 1) % 200 === 0) process.stdout.write(`\r   ${i + 1}/${NUM_SESSIONS}...`);
    }
    console.log(`\r   ✓ ${NUM_SESSIONS} sessioni generate`);
    console.log('');

    // Test SENZA protezione
    console.log('🔄 Test SENZA Pattern Protection...');
    const resultsNoProtection = [];
    for (let i = 0; i < NUM_SESSIONS; i++) {
        const result = simulateV3({
            startingBalance: STARTING_BALANCE,
            games: allGames[i],
            takeProfit: 50,
            betPercent: 0.6,
            mult: 1.5,
            enableProtection: false
        });
        resultsNoProtection.push(result);
        if ((i + 1) % 200 === 0) process.stdout.write(`\r   ${i + 1}/${NUM_SESSIONS}...`);
    }
    console.log(`\r   ✓ Completato`);

    // Test CON protezione
    console.log('🔄 Test CON Pattern Protection...');
    const resultsWithProtection = [];
    for (let i = 0; i < NUM_SESSIONS; i++) {
        const result = simulateV3({
            startingBalance: STARTING_BALANCE,
            games: allGames[i],
            takeProfit: 50,
            betPercent: 0.6,
            mult: 1.5,
            enableProtection: true,
            maxDelay10x: 28,
            maxDelay5x: 13,
            maxColdStreak: 8,
            resumeWaitGames: 5
        });
        resultsWithProtection.push(result);
        if ((i + 1) % 200 === 0) process.stdout.write(`\r   ${i + 1}/${NUM_SESSIONS}...`);
    }
    console.log(`\r   ✓ Completato`);
    console.log('');

    // Calcola statistiche
    function calcStats(results, name) {
        const targetHits = results.filter(r => r.targetReached);
        const busted = results.filter(r => r.busted);
        const avgProfit = results.reduce((a, r) => a + r.profitPercent, 0) / results.length;
        const avgBets = results.reduce((a, r) => a + r.betsPlaced, 0) / results.length;
        const avgGames = results.reduce((a, r) => a + r.gamesPlayed, 0) / results.length;
        const avgTargetGame = targetHits.length > 0 ? targetHits.reduce((a, r) => a + r.targetGame, 0) / targetHits.length : 0;
        const avgDrawdown = results.reduce((a, r) => a + r.maxDrawdown, 0) / results.length;
        const avgSuspendCount = results.reduce((a, r) => a + (r.suspendCount || 0), 0) / results.length;
        const avgSuspendGames = results.reduce((a, r) => a + (r.suspendGames || 0), 0) / results.length;

        return {
            name,
            hitRate: (targetHits.length / results.length * 100),
            bustRate: (busted.length / results.length * 100),
            avgProfit,
            avgBets,
            avgGames,
            avgTargetGame,
            avgDrawdown,
            avgSuspendCount,
            avgSuspendGames
        };
    }

    const statsNo = calcStats(resultsNoProtection, 'SENZA Protezione');
    const statsWith = calcStats(resultsWithProtection, 'CON Protezione');

    // Output
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('                              📊 RISULTATI CONFRONTO');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    console.log('┌──────────────────────┬───────────────────┬───────────────────┬───────────┐');
    console.log('│ Metrica              │ SENZA Protezione  │ CON Protezione    │ Δ Diff    │');
    console.log('├──────────────────────┼───────────────────┼───────────────────┼───────────┤');

    function formatDiff(val1, val2, higherIsBetter = true) {
        const diff = val2 - val1;
        const sign = diff >= 0 ? '+' : '';
        const color = (higherIsBetter && diff > 0) || (!higherIsBetter && diff < 0) ? '✅' : (diff === 0 ? '➖' : '❌');
        return `${color} ${sign}${diff.toFixed(1)}`;
    }

    console.log(`│ Hit Rate +50%        │ ${statsNo.hitRate.toFixed(1).padStart(16)}% │ ${statsWith.hitRate.toFixed(1).padStart(16)}% │ ${formatDiff(statsNo.hitRate, statsWith.hitRate).padStart(9)} │`);
    console.log(`│ Bust Rate            │ ${statsNo.bustRate.toFixed(1).padStart(16)}% │ ${statsWith.bustRate.toFixed(1).padStart(16)}% │ ${formatDiff(statsNo.bustRate, statsWith.bustRate, false).padStart(9)} │`);
    console.log(`│ EV (Expected Value)  │ ${(statsNo.avgProfit >= 0 ? '+' : '') + statsNo.avgProfit.toFixed(2).padStart(15)}% │ ${(statsWith.avgProfit >= 0 ? '+' : '') + statsWith.avgProfit.toFixed(2).padStart(15)}% │ ${formatDiff(statsNo.avgProfit, statsWith.avgProfit).padStart(9)} │`);
    console.log(`│ Avg Bets             │ ${statsNo.avgBets.toFixed(0).padStart(17)} │ ${statsWith.avgBets.toFixed(0).padStart(17)} │ ${formatDiff(statsNo.avgBets, statsWith.avgBets, false).padStart(9)} │`);
    console.log(`│ Avg Games            │ ${statsNo.avgGames.toFixed(0).padStart(17)} │ ${statsWith.avgGames.toFixed(0).padStart(17)} │           │`);
    console.log(`│ Avg Game @50%        │ ${(statsNo.avgTargetGame > 0 ? '~' + Math.round(statsNo.avgTargetGame) : '-').padStart(17)} │ ${(statsWith.avgTargetGame > 0 ? '~' + Math.round(statsWith.avgTargetGame) : '-').padStart(17)} │           │`);
    console.log(`│ Avg Drawdown         │ ${statsNo.avgDrawdown.toFixed(0).padStart(16)}% │ ${statsWith.avgDrawdown.toFixed(0).padStart(16)}% │ ${formatDiff(statsNo.avgDrawdown, statsWith.avgDrawdown, false).padStart(9)} │`);
    console.log('└──────────────────────┴───────────────────┴───────────────────┴───────────┘');
    console.log('');

    // Stats protezione
    console.log('📊 STATISTICHE PROTEZIONE:');
    console.log('────────────────────────────────────────────────────────────────────────────');
    console.log(`   Sospensioni medie:    ${statsWith.avgSuspendCount.toFixed(1)} per sessione`);
    console.log(`   Game in sospensione:  ${statsWith.avgSuspendGames.toFixed(0)} (${(statsWith.avgSuspendGames / statsWith.avgGames * 100).toFixed(1)}% del tempo)`);
    console.log('');

    // Verdetto
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('                              🎯 VERDETTO');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    const hitImprovement = statsWith.hitRate - statsNo.hitRate;
    const evImprovement = statsWith.avgProfit - statsNo.avgProfit;
    const bustImprovement = statsNo.bustRate - statsWith.bustRate;

    if (evImprovement > 0 && hitImprovement >= 0) {
        console.log('✅ PROTEZIONE MIGLIORA I RISULTATI!');
        console.log('');
        console.log(`   EV migliorato di:     +${evImprovement.toFixed(2)}%`);
        console.log(`   Hit rate:             ${hitImprovement >= 0 ? '+' : ''}${hitImprovement.toFixed(1)}%`);
        console.log(`   Bust rate ridotto di: ${bustImprovement.toFixed(1)}%`);
    } else if (evImprovement < 0 && hitImprovement > 0) {
        console.log('⚖️  RISULTATI MISTI');
        console.log('');
        console.log(`   Hit rate migliorato:  +${hitImprovement.toFixed(1)}%`);
        console.log(`   Ma EV ridotto di:     ${evImprovement.toFixed(2)}%`);
        console.log('   La protezione evita bust ma riduce opportunità');
    } else {
        console.log('❌ PROTEZIONE NON MIGLIORA I RISULTATI');
        console.log('   Considera di disabilitarla o regolare le soglie');
    }
    console.log('');

    // Salva risultati
    fs.writeFileSync('./paolobet-v3-comparison.json', JSON.stringify({
        withoutProtection: statsNo,
        withProtection: statsWith,
        improvement: {
            hitRate: hitImprovement,
            ev: evImprovement,
            bustRate: bustImprovement
        }
    }, null, 2));
    console.log('💾 Risultati salvati in paolobet-v3-comparison.json');
    console.log('');
}

main().catch(console.error);
