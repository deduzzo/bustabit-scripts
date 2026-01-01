/**
 * CALIBRAZIONE COMPLETA PAOLOBET v3.8
 *
 * Testa tutte le combinazioni di parametri per trovare la configurazione ottimale.
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
 * Simula PAOLOBET v3.8 con parametri configurabili
 */
function simulate({
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
    maxBetsConfig = 400
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
    let maxBets = maxBetsConfig;

    const initMult = currentMult;
    const initBet = baseBet;

    let delay10x = 0, delay5x = 0, coldStreak = 0;
    let isSuspended = false, signalReceived = false, waitAfterSignal = 0;
    let recentGames = [];

    let gamesPlayed = 0, betsPlaced = 0, suspendGames = 0;
    let wins = 0, losses = 0;
    let targetReached = false, targetGame = 0;
    let balanceATL = startBalance;
    let balanceATH = startBalance;
    let x2div2Count = 0;
    let maxBetReached = 0;
    let maxMultReached = 0;

    function reset() {
        currentMult = initMult;
        baseBet = initBet;
        failBets = 0;
        normalBets = normalBetsConfig;
        maxBets = maxBetsConfig;
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
                if (count5x >= 2 && delaysOk) return true;
                if (count5x < 2) signalReceived = false;
                return false;
            }
        }

        const last10 = recentGames.slice(-10);
        const count5x = last10.filter(g => g >= 5).length;
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

        // Track max bet/mult
        if (currentBet > maxBetReached) maxBetReached = currentBet;
        if (currentMult > maxMultReached) maxMultReached = currentMult;

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
        if (balance > balanceATH) balanceATH = balance;
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
        winRate: betsPlaced > 0 ? wins / betsPlaced * 100 : 0,
        busted: balance <= initBet,
        maxDrawdown: ((balanceATL - startBalance) / startBalance) * 100,
        finalBalance: balance,
        x2div2Count,
        x2div2PerWin: wins > 0 ? x2div2Count / wins : 0,
        maxBetReached,
        maxMultReached,
        avgBetPerGame: betsPlaced > 0 ? (wins + losses) / betsPlaced : 0
    };
}

const HASH_CHECKPOINTS_10M = require('./hash-checkpoints-10M.js').HASH_CHECKPOINTS_10M;

async function main() {
    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
    console.log('║            CALIBRAZIONE COMPLETA PAOLOBET v3.8                           ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
    console.log('');

    const NUM_SESSIONS = 300;
    const GAMES_PER_SESSION = 3000;
    const STARTING_BALANCE = 100000;

    console.log('📊 CONFIGURAZIONE TEST:');
    console.log('   Sessioni:         ' + NUM_SESSIONS);
    console.log('   Partite/sessione: ' + GAMES_PER_SESSION);
    console.log('   Balance iniziale: ' + (STARTING_BALANCE/100) + ' bits');
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

    // Configurazioni da testare
    const configs = [
        // Baseline
        { name: 'Baseline (orig)', normalBetsConfig: 15, timesToChange: 8, enableProtection: true },

        // Variazioni normalBets (fase conservativa più lunga = meno x2÷2)
        { name: 'normalBets=10', normalBetsConfig: 10, timesToChange: 8, enableProtection: true },
        { name: 'normalBets=20', normalBetsConfig: 20, timesToChange: 8, enableProtection: true },
        { name: 'normalBets=25', normalBetsConfig: 25, timesToChange: 8, enableProtection: true },
        { name: 'normalBets=30', normalBetsConfig: 30, timesToChange: 8, enableProtection: true },

        // Variazioni timesToChange (più alto = x2÷2 meno frequente)
        { name: 'timesToChange=6', normalBetsConfig: 15, timesToChange: 6, enableProtection: true },
        { name: 'timesToChange=10', normalBetsConfig: 15, timesToChange: 10, enableProtection: true },
        { name: 'timesToChange=12', normalBetsConfig: 15, timesToChange: 12, enableProtection: true },
        { name: 'timesToChange=15', normalBetsConfig: 15, timesToChange: 15, enableProtection: true },

        // Combinazioni interessanti
        { name: 'n20+t10', normalBetsConfig: 20, timesToChange: 10, enableProtection: true },
        { name: 'n25+t12', normalBetsConfig: 25, timesToChange: 12, enableProtection: true },
        { name: 'n30+t15', normalBetsConfig: 30, timesToChange: 15, enableProtection: true },

        // Senza protezione per confronto
        { name: 'NO PROT baseline', normalBetsConfig: 15, timesToChange: 8, enableProtection: false },
        { name: 'NO PROT n25+t12', normalBetsConfig: 25, timesToChange: 12, enableProtection: false },
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
                ...config
            }));
        }

        const hits = sessionResults.filter(r => r.targetReached);
        const busted = sessionResults.filter(r => r.busted);

        results.push({
            name: config.name,
            hitRate: hits.length / sessionResults.length * 100,
            avgProfit: sessionResults.reduce((a, r) => a + r.profitPercent, 0) / sessionResults.length,
            avgBets: sessionResults.reduce((a, r) => a + r.betsPlaced, 0) / sessionResults.length,
            avgWins: sessionResults.reduce((a, r) => a + r.wins, 0) / sessionResults.length,
            avgLosses: sessionResults.reduce((a, r) => a + r.losses, 0) / sessionResults.length,
            winRate: sessionResults.reduce((a, r) => a + r.winRate, 0) / sessionResults.length,
            avgTargetGame: hits.length > 0 ? hits.reduce((a, r) => a + r.targetGame, 0) / hits.length : 0,
            suspendPercent: sessionResults.reduce((a, r) => a + r.suspendGames, 0) /
                           sessionResults.reduce((a, r) => a + r.gamesPlayed, 0) * 100,
            avgDrawdown: sessionResults.reduce((a, r) => a + r.maxDrawdown, 0) / sessionResults.length,
            bustedRate: busted.length / sessionResults.length * 100,
            avgX2div2: sessionResults.reduce((a, r) => a + r.x2div2Count, 0) / sessionResults.length,
            x2div2PerWin: sessionResults.reduce((a, r) => a + r.x2div2PerWin, 0) / sessionResults.length,
            avgMaxBet: sessionResults.reduce((a, r) => a + r.maxBetReached, 0) / sessionResults.length,
            avgMaxMult: sessionResults.reduce((a, r) => a + r.maxMultReached, 0) / sessionResults.length
        });

        console.log(' ✓');
    }

    // Tabella risultati principali
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('                         RISULTATI PRINCIPALI');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    console.log('┌──────────────────┬──────────┬──────────┬──────────┬──────────┬──────────┐');
    console.log('│ Config           │ Hit Rate │ EV %     │ Win Rate │ Drawdown │ Busted % │');
    console.log('├──────────────────┼──────────┼──────────┼──────────┼──────────┼──────────┤');

    for (const r of results) {
        const ev = r.avgProfit >= 0 ? '+' + r.avgProfit.toFixed(1) + '%' : r.avgProfit.toFixed(1) + '%';
        console.log(
            '│ ' + r.name.padEnd(16) +
            ' │ ' + (r.hitRate.toFixed(1) + '%').padStart(8) +
            ' │ ' + ev.padStart(8) +
            ' │ ' + (r.winRate.toFixed(1) + '%').padStart(8) +
            ' │ ' + (r.avgDrawdown.toFixed(0) + '%').padStart(8) +
            ' │ ' + (r.bustedRate.toFixed(1) + '%').padStart(8) + ' │'
        );
    }

    console.log('└──────────────────┴──────────┴──────────┴──────────┴──────────┴──────────┘');

    // Tabella betting behavior
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('                         COMPORTAMENTO BETTING');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    console.log('┌──────────────────┬──────────┬──────────┬──────────┬────────────┬──────────┐');
    console.log('│ Config           │ Avg Bets │ Avg Wins │ x2÷2/Ses │ x2÷2/Win   │ MaxBet   │');
    console.log('├──────────────────┼──────────┼──────────┼──────────┼────────────┼──────────┤');

    for (const r of results) {
        console.log(
            '│ ' + r.name.padEnd(16) +
            ' │ ' + r.avgBets.toFixed(0).padStart(8) +
            ' │ ' + r.avgWins.toFixed(0).padStart(8) +
            ' │ ' + r.avgX2div2.toFixed(1).padStart(8) +
            ' │ ' + r.x2div2PerWin.toFixed(2).padStart(10) +
            ' │ ' + (r.avgMaxBet / 100).toFixed(0).padStart(8) + ' │'
        );
    }

    console.log('└──────────────────┴──────────┴──────────┴──────────┴────────────┴──────────┘');

    // Trova configurazioni ottimali
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('                         🏆 CONFIGURAZIONI OTTIMALI');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    const withProt = results.filter(r => !r.name.includes('NO PROT'));

    // Migliore EV
    const bestEV = [...withProt].sort((a, b) => b.avgProfit - a.avgProfit)[0];
    console.log('   📈 Migliore EV: "' + bestEV.name + '"');
    console.log('      EV: ' + (bestEV.avgProfit >= 0 ? '+' : '') + bestEV.avgProfit.toFixed(2) + '%');
    console.log('      Hit Rate: ' + bestEV.hitRate.toFixed(1) + '%, Drawdown: ' + bestEV.avgDrawdown.toFixed(0) + '%');
    console.log('      x2÷2/sessione: ' + bestEV.avgX2div2.toFixed(1) + ', MaxBet: ' + (bestEV.avgMaxBet/100).toFixed(0) + ' bits');
    console.log('');

    // Migliore hit rate
    const bestHit = [...withProt].sort((a, b) => b.hitRate - a.hitRate)[0];
    console.log('   🎯 Migliore Hit Rate: "' + bestHit.name + '"');
    console.log('      Hit Rate: ' + bestHit.hitRate.toFixed(1) + '%');
    console.log('      EV: ' + (bestHit.avgProfit >= 0 ? '+' : '') + bestHit.avgProfit.toFixed(2) + '%, Drawdown: ' + bestHit.avgDrawdown.toFixed(0) + '%');
    console.log('');

    // Minore drawdown
    const bestDD = [...withProt].sort((a, b) => b.avgDrawdown - a.avgDrawdown)[0];
    console.log('   🛡️ Minore Drawdown: "' + bestDD.name + '"');
    console.log('      Drawdown: ' + bestDD.avgDrawdown.toFixed(0) + '%');
    console.log('      EV: ' + (bestDD.avgProfit >= 0 ? '+' : '') + bestDD.avgProfit.toFixed(2) + '%, Hit Rate: ' + bestDD.hitRate.toFixed(1) + '%');
    console.log('');

    // Meno x2÷2 (betting più conservativo)
    const leastX2 = [...withProt].sort((a, b) => a.avgX2div2 - b.avgX2div2)[0];
    console.log('   🐢 Betting più conservativo: "' + leastX2.name + '"');
    console.log('      x2÷2/sessione: ' + leastX2.avgX2div2.toFixed(1));
    console.log('      MaxBet medio: ' + (leastX2.avgMaxBet/100).toFixed(0) + ' bits');
    console.log('      EV: ' + (leastX2.avgProfit >= 0 ? '+' : '') + leastX2.avgProfit.toFixed(2) + '%');
    console.log('');

    // Bilanciato (EV > 0, hit > 65%, drawdown > -50%)
    const balanced = withProt
        .filter(r => r.avgProfit > 0 && r.hitRate > 65 && r.avgDrawdown > -55)
        .sort((a, b) => (b.avgProfit * 0.4 + b.hitRate * 0.4 - b.avgX2div2 * 0.2) -
                        (a.avgProfit * 0.4 + a.hitRate * 0.4 - a.avgX2div2 * 0.2))[0];

    if (balanced) {
        console.log('   ⚖️ Migliore bilanciato: "' + balanced.name + '"');
        console.log('      EV: ' + (balanced.avgProfit >= 0 ? '+' : '') + balanced.avgProfit.toFixed(2) + '%');
        console.log('      Hit Rate: ' + balanced.hitRate.toFixed(1) + '%');
        console.log('      Drawdown: ' + balanced.avgDrawdown.toFixed(0) + '%');
        console.log('      x2÷2/sessione: ' + balanced.avgX2div2.toFixed(1));
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('');
}

main().catch(console.error);
