/**
 * TEST ESTENSIVO PAOLOBET v3.1 - Calibrazione Parametri Pattern Protection
 * Testa tutte le combinazioni su migliaia di sessioni
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
    let suspendCount = 0;

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
                        // NO reset - continua da dove era (v3.1 fix)
                    } else {
                        signalReceived = false;
                    }
                }
            } else {
                const count5x = recentGames.slice(-10).filter(g => g >= 5).length;
                if (count5x >= 3) {
                    isSuspended = false;
                    // NO reset - continua da dove era (v3.1 fix)
                }
            }
            continue;
        }

        // Check suspend
        if (enableProtection) {
            if (delay10x > maxDelay10x || delay5x > maxDelay5x || coldStreak > maxColdStreak) {
                isSuspended = true;
                signalReceived = false;
                suspendCount++;
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
                // Recupero parziale - FIX v3.2
                const recovered = parseInt(bust, 10) - 1;
                currentMult -= recovered;

                // FIX 1: Riduci anche failBets per estendere il ciclo
                if (failBets > 0) {
                    failBets = Math.max(0, failBets - recovered);
                }

                // FIX 2: Se mult torna a init, reset completo (incluso baseBet!)
                if (currentMult <= initMult) {
                    reset();
                }
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
        suspendCount,
        busted: balance < 100,
        maxDrawdown: ((balanceATL - startBalance) / startBalance) * 100
    };
}

const HASH_CHECKPOINTS_10M = require('./hash-checkpoints-10M.js').HASH_CHECKPOINTS_10M;

async function main() {
    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
    console.log('║         TEST ESTENSIVO PAOLOBET v3.1 - Pattern Protection                ║');
    console.log('║                    10,000 checkpoint x 2000 partite                       ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
    console.log('');

    const NUM_SESSIONS = 2000;
    const GAMES_PER_SESSION = 3000;
    const STARTING_BALANCE = 100000;

    // Pre-genera game da checkpoint diversi
    console.log('🔄 Generazione partite da 2000 checkpoint...');
    const allGames = [];
    const step = Math.floor(HASH_CHECKPOINTS_10M.length / NUM_SESSIONS);
    for (let i = 0; i < NUM_SESSIONS; i++) {
        const idx = (i * step) % HASH_CHECKPOINTS_10M.length;
        allGames.push(generateGameResults(HASH_CHECKPOINTS_10M[idx].hash, GAMES_PER_SESSION));
    }
    console.log('   ✓ Pronto (' + NUM_SESSIONS + ' sessioni x ' + GAMES_PER_SESSION + ' partite = ' + (NUM_SESSIONS * GAMES_PER_SESSION / 1000000).toFixed(1) + 'M partite)');
    console.log('');

    // Configurazioni da testare - griglia completa
    const delay10xValues = [20, 25, 28, 30, 35, 40];
    const delay5xValues = [10, 13, 15, 18, 20];
    const coldStreakValues = [6, 8, 10, 12];
    const resumeWaitValues = [3, 5, 7];

    const configs = [
        { name: 'BASELINE (no prot)', enableProtection: false }
    ];

    // Genera tutte le combinazioni
    for (const d10 of delay10xValues) {
        for (const d5 of delay5xValues) {
            for (const cs of coldStreakValues) {
                for (const rw of resumeWaitValues) {
                    configs.push({
                        name: `${d10}/${d5}/${cs}/${rw}`,
                        enableProtection: true,
                        maxDelay10x: d10,
                        maxDelay5x: d5,
                        maxColdStreak: cs,
                        resumeWaitGames: rw
                    });
                }
            }
        }
    }

    console.log(`📊 Testing ${configs.length} configurazioni...`);
    console.log('');

    const results = [];
    let tested = 0;

    for (const config of configs) {
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
        const bustedCount = sessionResults.filter(r => r.busted).length;

        results.push({
            name: config.name,
            config: config,
            hitRate: (targetHits.length / sessionResults.length * 100),
            avgProfit,
            avgBets,
            avgGames,
            avgTargetGame,
            suspendPercent: (avgSuspendGames / avgGames * 100),
            avgDrawdown,
            bustedPercent: (bustedCount / sessionResults.length * 100)
        });

        tested++;
        if (tested % 50 === 0 || tested === configs.length) {
            process.stdout.write(`\r   Testati ${tested}/${configs.length} (${(tested/configs.length*100).toFixed(0)}%)...`);
        }
    }

    console.log('\n');

    // Ordina per EV
    const sortedByEV = [...results].sort((a, b) => b.avgProfit - a.avgProfit);

    // Ordina per Hit Rate
    const sortedByHitRate = [...results].sort((a, b) => b.hitRate - a.hitRate);

    // Baseline
    const baseline = results.find(r => r.name === 'BASELINE (no prot)');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('                         📊 TOP 20 PER EV (Profitto Atteso)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('┌────────────────────┬──────────┬──────────┬───────────┬───────────┬───────────┐');
    console.log('│ Config             │ Hit Rate │ EV %     │ Avg Bets  │ Suspend % │ Drawdown  │');
    console.log('├────────────────────┼──────────┼──────────┼───────────┼───────────┼───────────┤');

    for (let i = 0; i < Math.min(20, sortedByEV.length); i++) {
        const r = sortedByEV[i];
        const ev = r.avgProfit >= 0 ? `+${r.avgProfit.toFixed(1)}%` : `${r.avgProfit.toFixed(1)}%`;
        const marker = i === 0 ? ' 🏆' : '';
        console.log(
            `│ ${r.name.padEnd(18)} │ ${r.hitRate.toFixed(1).padStart(7)}% │ ${ev.padStart(8)} │ ${r.avgBets.toFixed(0).padStart(9)} │ ${r.suspendPercent.toFixed(1).padStart(8)}% │ ${r.avgDrawdown.toFixed(0).padStart(8)}% │${marker}`
        );
    }
    console.log('└────────────────────┴──────────┴──────────┴───────────┴───────────┴───────────┘');

    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('                         📊 TOP 20 PER HIT RATE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('┌────────────────────┬──────────┬──────────┬───────────┬───────────┬───────────┐');
    console.log('│ Config             │ Hit Rate │ EV %     │ Avg Bets  │ Suspend % │ Drawdown  │');
    console.log('├────────────────────┼──────────┼──────────┼───────────┼───────────┼───────────┤');

    for (let i = 0; i < Math.min(20, sortedByHitRate.length); i++) {
        const r = sortedByHitRate[i];
        const ev = r.avgProfit >= 0 ? `+${r.avgProfit.toFixed(1)}%` : `${r.avgProfit.toFixed(1)}%`;
        const marker = i === 0 ? ' 🏆' : '';
        console.log(
            `│ ${r.name.padEnd(18)} │ ${r.hitRate.toFixed(1).padStart(7)}% │ ${ev.padStart(8)} │ ${r.avgBets.toFixed(0).padStart(9)} │ ${r.suspendPercent.toFixed(1).padStart(8)}% │ ${r.avgDrawdown.toFixed(0).padStart(8)}% │${marker}`
        );
    }
    console.log('└────────────────────┴──────────┴──────────┴───────────┴───────────┴───────────┘');

    // Trova configurazioni bilanciate (hit rate >= baseline con EV positivo)
    const balanced = results
        .filter(r => r.hitRate >= baseline.hitRate && r.avgProfit > 0)
        .sort((a, b) => b.avgProfit - a.avgProfit);

    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('                 📊 TOP 20 BILANCIATE (Hit >= Baseline + EV > 0)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('┌────────────────────┬──────────┬──────────┬───────────┬───────────┬───────────┐');
    console.log('│ Config             │ Hit Rate │ EV %     │ Avg Bets  │ Suspend % │ Drawdown  │');
    console.log('├────────────────────┼──────────┼──────────┼───────────┼───────────┼───────────┤');

    for (let i = 0; i < Math.min(20, balanced.length); i++) {
        const r = balanced[i];
        const ev = r.avgProfit >= 0 ? `+${r.avgProfit.toFixed(1)}%` : `${r.avgProfit.toFixed(1)}%`;
        const marker = i === 0 ? ' 🏆' : '';
        console.log(
            `│ ${r.name.padEnd(18)} │ ${r.hitRate.toFixed(1).padStart(7)}% │ ${ev.padStart(8)} │ ${r.avgBets.toFixed(0).padStart(9)} │ ${r.suspendPercent.toFixed(1).padStart(8)}% │ ${r.avgDrawdown.toFixed(0).padStart(8)}% │${marker}`
        );
    }
    console.log('└────────────────────┴──────────┴──────────┴───────────┴───────────┴───────────┘');

    // Analisi per singolo parametro
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('                    📈 ANALISI IMPATTO SINGOLI PARAMETRI');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    // Analisi maxDelay10x
    console.log('📊 maxDelay10x (soglia sospensione ritardo 10x):');
    for (const val of delay10xValues) {
        const subset = results.filter(r => r.config.maxDelay10x === val && r.config.enableProtection);
        const avgHit = subset.reduce((a, r) => a + r.hitRate, 0) / subset.length;
        const avgEV = subset.reduce((a, r) => a + r.avgProfit, 0) / subset.length;
        const evStr = avgEV >= 0 ? `+${avgEV.toFixed(2)}%` : `${avgEV.toFixed(2)}%`;
        console.log(`   ${val.toString().padStart(2)}: Hit ${avgHit.toFixed(1)}%, EV ${evStr}`);
    }

    console.log('');
    console.log('📊 maxDelay5x (soglia sospensione ritardo 5x):');
    for (const val of delay5xValues) {
        const subset = results.filter(r => r.config.maxDelay5x === val && r.config.enableProtection);
        const avgHit = subset.reduce((a, r) => a + r.hitRate, 0) / subset.length;
        const avgEV = subset.reduce((a, r) => a + r.avgProfit, 0) / subset.length;
        const evStr = avgEV >= 0 ? `+${avgEV.toFixed(2)}%` : `${avgEV.toFixed(2)}%`;
        console.log(`   ${val.toString().padStart(2)}: Hit ${avgHit.toFixed(1)}%, EV ${evStr}`);
    }

    console.log('');
    console.log('📊 maxColdStreak (soglia sospensione no 3x+):');
    for (const val of coldStreakValues) {
        const subset = results.filter(r => r.config.maxColdStreak === val && r.config.enableProtection);
        const avgHit = subset.reduce((a, r) => a + r.hitRate, 0) / subset.length;
        const avgEV = subset.reduce((a, r) => a + r.avgProfit, 0) / subset.length;
        const evStr = avgEV >= 0 ? `+${avgEV.toFixed(2)}%` : `${avgEV.toFixed(2)}%`;
        console.log(`   ${val.toString().padStart(2)}: Hit ${avgHit.toFixed(1)}%, EV ${evStr}`);
    }

    console.log('');
    console.log('📊 resumeWaitGames (partite attesa dopo segnale):');
    for (const val of resumeWaitValues) {
        const subset = results.filter(r => r.config.resumeWaitGames === val && r.config.enableProtection);
        const avgHit = subset.reduce((a, r) => a + r.hitRate, 0) / subset.length;
        const avgEV = subset.reduce((a, r) => a + r.avgProfit, 0) / subset.length;
        const evStr = avgEV >= 0 ? `+${avgEV.toFixed(2)}%` : `${avgEV.toFixed(2)}%`;
        console.log(`   ${val.toString().padStart(2)}: Hit ${avgHit.toFixed(1)}%, EV ${evStr}`);
    }

    // Riepilogo finale
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('                           🏆 CONFIGURAZIONE OTTIMALE');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('');

    const best = sortedByEV[0];
    const bestBalanced = balanced[0];

    console.log(`   BASELINE (senza protezione):`);
    console.log(`      Hit Rate: ${baseline.hitRate.toFixed(1)}%`);
    console.log(`      EV:       ${baseline.avgProfit >= 0 ? '+' : ''}${baseline.avgProfit.toFixed(2)}%`);
    console.log('');

    console.log(`   MIGLIORE EV: "${best.name}"`);
    console.log(`      maxDelay10x:     ${best.config.maxDelay10x}`);
    console.log(`      maxDelay5x:      ${best.config.maxDelay5x}`);
    console.log(`      maxColdStreak:   ${best.config.maxColdStreak}`);
    console.log(`      resumeWaitGames: ${best.config.resumeWaitGames}`);
    console.log(`      ────────────────────────`);
    console.log(`      Hit Rate: ${best.hitRate.toFixed(1)}% (${best.hitRate > baseline.hitRate ? '+' : ''}${(best.hitRate - baseline.hitRate).toFixed(1)}%)`);
    console.log(`      EV:       ${best.avgProfit >= 0 ? '+' : ''}${best.avgProfit.toFixed(2)}% (${best.avgProfit > baseline.avgProfit ? '+' : ''}${(best.avgProfit - baseline.avgProfit).toFixed(2)}%)`);
    console.log(`      Drawdown: ${best.avgDrawdown.toFixed(0)}%`);
    console.log('');

    if (bestBalanced && bestBalanced.name !== best.name) {
        console.log(`   MIGLIORE BILANCIATA: "${bestBalanced.name}"`);
        console.log(`      maxDelay10x:     ${bestBalanced.config.maxDelay10x}`);
        console.log(`      maxDelay5x:      ${bestBalanced.config.maxDelay5x}`);
        console.log(`      maxColdStreak:   ${bestBalanced.config.maxColdStreak}`);
        console.log(`      resumeWaitGames: ${bestBalanced.config.resumeWaitGames}`);
        console.log(`      ────────────────────────`);
        console.log(`      Hit Rate: ${bestBalanced.hitRate.toFixed(1)}%`);
        console.log(`      EV:       ${bestBalanced.avgProfit >= 0 ? '+' : ''}${bestBalanced.avgProfit.toFixed(2)}%`);
        console.log('');
    }

    // Salva risultati completi
    fs.writeFileSync('./paolobet-v3-extensive-results.json', JSON.stringify({
        testParams: {
            sessions: NUM_SESSIONS,
            gamesPerSession: GAMES_PER_SESSION,
            totalGames: NUM_SESSIONS * GAMES_PER_SESSION
        },
        baseline,
        bestEV: best,
        bestBalanced,
        top20EV: sortedByEV.slice(0, 20),
        top20HitRate: sortedByHitRate.slice(0, 20),
        top20Balanced: balanced.slice(0, 20),
        allResults: results
    }, null, 2));

    console.log('💾 Risultati salvati in paolobet-v3-extensive-results.json');
    console.log('');
}

main().catch(console.error);
