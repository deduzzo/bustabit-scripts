/**
 * FINE-TUNING PAOLOBET v3.8
 *
 * Test più dettagliato attorno ai parametri ottimali trovati.
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

function simulate(config) {
    const {
        startingBalance, games, takeProfit = 50, betPercent = 0.6, mult = 1.5,
        normalBetsConfig = 15, timesToChange = 8, multFactor = 2,
        enableProtection = true, maxDelay10x = 20, maxDelay5x = 10,
        maxColdStreak = 6, resumeWaitGames = 7, maxBetMultiple = 16, maxBetsConfig = 400
    } = config;

    const startBalance = startingBalance;
    const targetProfit = Math.floor(startBalance * (takeProfit / 100));
    let calculatedBet = Math.floor(startBalance * (betPercent / 100));
    calculatedBet = Math.max(100, Math.floor(calculatedBet / 100) * 100);

    let balance = startBalance, currentMult = mult, baseBet = calculatedBet;
    let normalBets = normalBetsConfig, failBets = 0, maxBets = maxBetsConfig;
    const initMult = currentMult, initBet = baseBet;

    let delay10x = 0, delay5x = 0, coldStreak = 0;
    let isSuspended = false, signalReceived = false, waitAfterSignal = 0;
    let recentGames = [];

    let gamesPlayed = 0, betsPlaced = 0, suspendGames = 0;
    let wins = 0, losses = 0, targetReached = false, targetGame = 0;
    let balanceATL = startBalance, x2div2Count = 0, maxBetReached = 0;

    function reset() {
        currentMult = initMult; baseBet = initBet; failBets = 0;
        normalBets = normalBetsConfig; maxBets = maxBetsConfig;
    }

    function checkResume(lastBust) {
        if (lastBust >= 10) { signalReceived = true; waitAfterSignal = resumeWaitGames; return false; }
        const delaysOk = delay10x <= maxDelay10x && delay5x <= maxDelay5x && coldStreak <= maxColdStreak;
        if (signalReceived) {
            waitAfterSignal--;
            if (waitAfterSignal <= 0) {
                const count5x = recentGames.slice(-10).filter(g => g >= 5).length;
                if (count5x >= 2 && delaysOk) return true;
                if (count5x < 2) signalReceived = false;
            }
        }
        const count5x = recentGames.slice(-10).filter(g => g >= 5).length;
        if (count5x >= 3 && delaysOk) return true;
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

        if (balance - startBalance >= targetProfit) { targetReached = true; targetGame = i + 1; break; }
        if (isSuspended) { suspendGames++; if (checkResume(bust)) { isSuspended = false; signalReceived = false; } continue; }
        if (enableProtection && (delay10x > maxDelay10x || delay5x > maxDelay5x || coldStreak > maxColdStreak)) {
            isSuspended = true; signalReceived = false; continue;
        }
        if (maxBets <= 0) reset();

        const currentBet = Math.round(baseBet);
        if (currentBet > balance) break;
        if (currentBet > maxBetReached) maxBetReached = currentBet;

        balance -= currentBet;
        betsPlaced++;

        if (currentMult <= bust) {
            balance += currentBet * currentMult;
            wins++;
            reset();
        } else {
            losses++;
            if (normalBets > 0) { currentMult++; normalBets--; }
            else {
                failBets++;
                if (failBets % timesToChange === 0) {
                    const newBet = baseBet * multFactor;
                    const maxBet = initBet * maxBetMultiple;
                    if (newBet > maxBet) currentMult++;
                    else { currentMult = currentMult / multFactor + 1; baseBet = newBet; x2div2Count++; }
                } else currentMult++;
            }
            maxBets--;
        }
        if (balance < balanceATL) balanceATL = balance;
    }

    return {
        profitPercent: ((balance - startBalance) / startBalance) * 100,
        targetReached, targetGame, betsPlaced, wins, losses,
        winRate: betsPlaced > 0 ? wins / betsPlaced * 100 : 0,
        busted: balance <= initBet,
        maxDrawdown: ((balanceATL - startBalance) / startBalance) * 100,
        x2div2Count, maxBetReached, suspendGames, gamesPlayed
    };
}

const HASH_CHECKPOINTS_10M = require('./hash-checkpoints-10M.js').HASH_CHECKPOINTS_10M;

async function main() {
    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
    console.log('║              FINE-TUNING PAOLOBET v3.8                                    ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
    console.log('');

    const NUM_SESSIONS = 500;
    const GAMES_PER_SESSION = 3000;
    const STARTING_BALANCE = 100000;

    console.log('📊 Test su ' + NUM_SESSIONS + ' sessioni × ' + GAMES_PER_SESSION + ' partite');
    console.log('');

    console.log('🔄 Generazione partite...');
    const allGames = [];
    for (let i = 0; i < NUM_SESSIONS; i++) {
        allGames.push(generateGameResults(HASH_CHECKPOINTS_10M[i % HASH_CHECKPOINTS_10M.length].hash, GAMES_PER_SESSION));
    }
    console.log('   ✓ Pronto');
    console.log('');

    // Test fine-grained attorno a normalBets=25
    const configs = [
        // Variazioni normalBets attorno a 25
        { name: 'n22', normalBetsConfig: 22, timesToChange: 8 },
        { name: 'n23', normalBetsConfig: 23, timesToChange: 8 },
        { name: 'n24', normalBetsConfig: 24, timesToChange: 8 },
        { name: 'n25', normalBetsConfig: 25, timesToChange: 8 },
        { name: 'n26', normalBetsConfig: 26, timesToChange: 8 },
        { name: 'n27', normalBetsConfig: 27, timesToChange: 8 },
        { name: 'n28', normalBetsConfig: 28, timesToChange: 8 },

        // Combinazioni con timesToChange variato
        { name: 'n25+t7', normalBetsConfig: 25, timesToChange: 7 },
        { name: 'n25+t9', normalBetsConfig: 25, timesToChange: 9 },
        { name: 'n25+t10', normalBetsConfig: 25, timesToChange: 10 },

        // Combinazioni top trovate prima
        { name: 'n25+t10 (comb)', normalBetsConfig: 25, timesToChange: 10 },
        { name: 't10 only', normalBetsConfig: 15, timesToChange: 10 },

        // Test protezione più aggressiva
        { name: 'n25 prot15/8/5', normalBetsConfig: 25, timesToChange: 8, maxDelay10x: 15, maxDelay5x: 8, maxColdStreak: 5 },
        { name: 'n25 prot25/12/8', normalBetsConfig: 25, timesToChange: 8, maxDelay10x: 25, maxDelay5x: 12, maxColdStreak: 8 },
    ];

    const results = [];

    for (const config of configs) {
        process.stdout.write('🔄 Testing "' + config.name + '"...');

        const sessionResults = [];
        for (let i = 0; i < NUM_SESSIONS; i++) {
            sessionResults.push(simulate({
                startingBalance: STARTING_BALANCE,
                games: allGames[i],
                takeProfit: 50,
                betPercent: 0.6,
                mult: 1.5,
                enableProtection: true,
                maxDelay10x: config.maxDelay10x || 20,
                maxDelay5x: config.maxDelay5x || 10,
                maxColdStreak: config.maxColdStreak || 6,
                ...config
            }));
        }

        const hits = sessionResults.filter(r => r.targetReached);
        const busted = sessionResults.filter(r => r.busted);

        results.push({
            name: config.name,
            hitRate: hits.length / sessionResults.length * 100,
            avgProfit: sessionResults.reduce((a, r) => a + r.profitPercent, 0) / sessionResults.length,
            winRate: sessionResults.reduce((a, r) => a + r.winRate, 0) / sessionResults.length,
            avgTargetGame: hits.length > 0 ? hits.reduce((a, r) => a + r.targetGame, 0) / hits.length : 0,
            avgDrawdown: sessionResults.reduce((a, r) => a + r.maxDrawdown, 0) / sessionResults.length,
            bustedRate: busted.length / sessionResults.length * 100,
            avgX2div2: sessionResults.reduce((a, r) => a + r.x2div2Count, 0) / sessionResults.length,
            avgMaxBet: sessionResults.reduce((a, r) => a + r.maxBetReached, 0) / sessionResults.length,
            avgWins: sessionResults.reduce((a, r) => a + r.wins, 0) / sessionResults.length,
            suspendPct: sessionResults.reduce((a, r) => a + r.suspendGames, 0) /
                        sessionResults.reduce((a, r) => a + r.gamesPlayed, 0) * 100
        });

        console.log(' ✓');
    }

    // Ordina per EV
    results.sort((a, b) => b.avgProfit - a.avgProfit);

    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('                    RISULTATI (ordinati per EV)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    console.log('┌──────────────────┬──────────┬──────────┬──────────┬──────────┬──────────┬──────────┐');
    console.log('│ Config           │ EV %     │ Hit Rate │ Drawdown │ x2÷2/Ses │ MaxBet   │ @Game50% │');
    console.log('├──────────────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤');

    for (const r of results) {
        const ev = r.avgProfit >= 0 ? '+' + r.avgProfit.toFixed(1) + '%' : r.avgProfit.toFixed(1) + '%';
        const tg = r.avgTargetGame > 0 ? '~' + Math.round(r.avgTargetGame) : '-';
        console.log(
            '│ ' + r.name.padEnd(16) +
            ' │ ' + ev.padStart(8) +
            ' │ ' + (r.hitRate.toFixed(1) + '%').padStart(8) +
            ' │ ' + (r.avgDrawdown.toFixed(0) + '%').padStart(8) +
            ' │ ' + r.avgX2div2.toFixed(1).padStart(8) +
            ' │ ' + (r.avgMaxBet / 100).toFixed(0).padStart(8) +
            ' │ ' + tg.padStart(8) + ' │'
        );
    }

    console.log('└──────────────────┴──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘');
    console.log('');

    // Migliore
    const best = results[0];
    console.log('🏆 MIGLIORE CONFIGURAZIONE: "' + best.name + '"');
    console.log('   EV:       ' + (best.avgProfit >= 0 ? '+' : '') + best.avgProfit.toFixed(2) + '%');
    console.log('   Hit Rate: ' + best.hitRate.toFixed(1) + '%');
    console.log('   Drawdown: ' + best.avgDrawdown.toFixed(0) + '%');
    console.log('   x2÷2/ses: ' + best.avgX2div2.toFixed(1));
    console.log('   MaxBet:   ' + (best.avgMaxBet/100).toFixed(0) + ' bits');
    console.log('');
}

main().catch(console.error);
