/**
 * TEST FINE - Ottimizzazione parametri M1-ALT
 */

const crypto = require('crypto');

const GAME_SALT = "00000000000000000001e08b7fd44f95e3e950ac65650a8031a6d5e1750e34be";

function hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
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

function generateGames(startHash, numGames) {
    const saltBytes = Buffer.from(GAME_SALT, 'utf8');
    let currentHash = hexToBytes(startHash);
    const hashes = [new Uint8Array(currentHash)];
    for (let i = 1; i < numGames; i++) {
        currentHash = sha256(currentHash);
        hashes.push(new Uint8Array(currentHash));
    }
    return hashes.reverse().map(h => gameResult(saltBytes, h));
}

function simulateHybrid(crashes, config) {
    const startBalance = 100000;
    let balance = startBalance;

    let mode = 1;
    let mode1Step = 0;
    let mode1TotalLoss = 0;
    let mode1CurrentMult = config.mode1StartMult;
    let mode1CurrentBet = Math.floor(startBalance * config.baseBetPercent / 100 / 100) * 100;
    let mode1BaseBet = mode1CurrentBet;

    let mode2Bets = 0;
    let mode2LossToRecover = 0;

    let stats = { mode1Wins: 0, mode2Entries: 0, mode2Wins: 0, mode2Fails: 0 };

    for (let i = 0; i < crashes.length; i++) {
        const crash = crashes[i];

        if (mode === 1) {
            let bet = mode1CurrentBet;
            let target = mode1CurrentMult;

            if (bet > balance) {
                mode = 2;
                mode2LossToRecover = mode1TotalLoss;
                mode2Bets = 0;
                stats.mode2Entries++;
                i--;
                continue;
            }

            balance -= bet;

            if (crash >= target) {
                const profit = Math.floor(bet * (target - 1));
                balance += bet + profit;
                stats.mode1Wins++;
                mode1Step = 0;
                mode1TotalLoss = 0;
                mode1CurrentMult = config.mode1StartMult;
                mode1CurrentBet = mode1BaseBet;
            } else {
                mode1TotalLoss += bet;
                mode1Step++;

                if (mode1Step >= config.mode1MaxAttempts) {
                    mode = 2;
                    mode2LossToRecover = mode1TotalLoss;
                    mode2Bets = 0;
                    stats.mode2Entries++;
                    mode1Step = 0;
                    mode1TotalLoss = 0;
                    mode1CurrentMult = config.mode1StartMult;
                    mode1CurrentBet = mode1BaseBet;
                } else {
                    // Strategia alternata
                    if (mode1Step <= config.multIncreasesBeforeBet) {
                        mode1CurrentMult += config.mode1MultIncrease;
                    } else {
                        const stepAfterInitial = mode1Step - config.multIncreasesBeforeBet;
                        if (stepAfterInitial % 2 === 1) {
                            mode1CurrentBet = Math.floor(mode1CurrentBet * config.mode1BetMultiplier / 100) * 100;
                        } else {
                            mode1CurrentMult += config.mode1MultIncrease;
                        }
                    }
                }
            }
        } else {
            const target = config.mode2Target;
            const profitMult = target - 1;
            const baseBetProfit = Math.floor(mode1BaseBet * 0.5);
            let requiredBet = Math.ceil((mode2LossToRecover + baseBetProfit) / profitMult / 100) * 100;
            requiredBet = Math.max(requiredBet, mode1BaseBet);

            if (requiredBet > balance) {
                stats.mode2Fails++;
                mode = 1;
                mode2LossToRecover = 0;
                mode2Bets = 0;
                continue;
            }

            balance -= requiredBet;
            mode2Bets++;

            if (crash >= target) {
                const profit = Math.floor(requiredBet * (target - 1));
                balance += requiredBet + profit;
                stats.mode2Wins++;
                mode = 1;
                mode2LossToRecover = 0;
                mode2Bets = 0;
            } else {
                mode2LossToRecover += requiredBet;
                if (mode2Bets >= config.mode2MaxBets) {
                    stats.mode2Fails++;
                    mode = 1;
                    mode2LossToRecover = 0;
                    mode2Bets = 0;
                }
            }
        }

        if (balance < mode1BaseBet) break;
    }

    return {
        profit: balance - startBalance,
        profitPercent: ((balance - startBalance) / startBalance) * 100,
        ...stats
    };
}

async function runTests() {
    let checkpoints;
    try {
        checkpoints = require('./hash-checkpoints-10M.js').HASH_CHECKPOINTS_10M;
    } catch (e) {
        checkpoints = require('./hash-checkpoints.js').HASH_CHECKPOINTS;
    }

    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
    console.log('║              TEST FINE - OTTIMIZZAZIONE PARAMETRI                         ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
    console.log('');

    const SESSIONS = 5000;
    const GAMES_PER_SESSION = 500;

    // Test combinazioni ridotte
    const tests = [];

    // Varia: startMult, multIncrease, betMultiplier, maxAttempts, mode2Target
    for (const startMult of [1.3, 1.5, 2.0]) {
        for (const multIncrease of [0.5, 1.0]) {
            for (const betMult of [1.5, 2.0]) {
                for (const maxAttempts of [3, 4, 5]) {
                    for (const mode2Target of [2.5, 3.0]) {
                        tests.push({
                            mode1StartMult: startMult,
                            mode1MultIncrease: multIncrease,
                            mode1BetMultiplier: betMult,
                            mode1MaxAttempts: maxAttempts,
                            mode2Target: mode2Target,
                            multIncreasesBeforeBet: 1,
                            baseBetPercent: 0.3,
                            mode2MaxBets: 15
                        });
                    }
                }
            }
        }
    }

    console.log(`   Testing ${tests.length} configurazioni su ${SESSIONS} sessioni...`);
    console.log('');

    const results = [];
    let tested = 0;

    for (const config of tests) {
        let totalProfit = 0;
        let totalMode2Entries = 0;
        let bankrupts = 0;

        for (let s = 0; s < SESSIONS; s++) {
            const checkpointIdx = Math.floor(Math.random() * checkpoints.length);
            const skipGames = Math.floor(Math.random() * 1000);

            let hash = hexToBytes(checkpoints[checkpointIdx].hash);
            for (let i = 0; i < skipGames; i++) hash = sha256(hash);

            const crashes = generateGames(
                Array.from(hash).map(b => b.toString(16).padStart(2, '0')).join(''),
                GAMES_PER_SESSION
            );

            const result = simulateHybrid(crashes, config);
            totalProfit += result.profit;
            totalMode2Entries += result.mode2Entries;
            if (result.profit <= -90000) bankrupts++;
        }

        const avgProfitPercent = (totalProfit / SESSIONS / 100000) * 100;
        const mode2Rate = totalMode2Entries / SESSIONS;

        results.push({
            config,
            avgProfitPercent,
            mode2Rate,
            bankruptRate: (bankrupts / SESSIONS) * 100
        });

        tested++;
        if (tested % 50 === 0) {
            process.stdout.write(`\r   Progresso: ${tested}/${tests.length} (${((tested/tests.length)*100).toFixed(0)}%)`);
        }
    }

    console.log('\n');

    // Top 15 risultati
    results.sort((a, b) => b.avgProfitPercent - a.avgProfitPercent);

    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('                          🏆 TOP 15 CONFIGURAZIONI');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('');
    console.log('   StartM │ +Mult │ xBet │ Max │ M2Tgt │   EV %   │ M2/sess │ Bankr%');
    console.log('   ───────┼───────┼──────┼─────┼───────┼──────────┼─────────┼───────');

    for (let i = 0; i < 15 && i < results.length; i++) {
        const r = results[i];
        const c = r.config;
        const ev = (r.avgProfitPercent >= 0 ? '+' : '') + r.avgProfitPercent.toFixed(3) + '%';
        console.log(`   ${c.mode1StartMult.toFixed(1).padStart(5)}x │ ${('+'+c.mode1MultIncrease.toFixed(1)).padStart(5)} │ ${('x'+c.mode1BetMultiplier.toFixed(1)).padStart(4)} │ ${String(c.mode1MaxAttempts).padStart(3)} │ ${c.mode2Target.toFixed(1).padStart(5)}x │ ${ev.padStart(8)} │ ${r.mode2Rate.toFixed(1).padStart(7)} │ ${r.bankruptRate.toFixed(1).padStart(5)}%`);
    }

    console.log('');

    // Mostra progressione del migliore
    const best = results[0];
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('   PROGRESSIONE MIGLIORE CONFIGURAZIONE:');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    showBestProgression(best.config);
}

function showBestProgression(config) {
    console.log('');
    let mult = config.mode1StartMult;
    let bet = 30;
    let totalLoss = 0;

    for (let step = 0; step < config.mode1MaxAttempts; step++) {
        const prob = (1 / mult) * 99;
        const winProfit = Math.floor(bet * (mult - 1));
        const netIfWin = winProfit - totalLoss;

        console.log(`   Step ${step + 1}: ${bet} bits @ ${mult.toFixed(2)}x (~${prob.toFixed(0)}%) → lordo +${winProfit}, netto ${netIfWin >= 0 ? '+' : ''}${netIfWin}`);

        totalLoss += bet;

        if (step < config.mode1MaxAttempts - 1) {
            if (step < config.multIncreasesBeforeBet) {
                mult += config.mode1MultIncrease;
            } else {
                const stepAfterInitial = step - config.multIncreasesBeforeBet + 1;
                if (stepAfterInitial % 2 === 1) {
                    bet = Math.floor(bet * config.mode1BetMultiplier);
                } else {
                    mult += config.mode1MultIncrease;
                }
            }
        }
    }

    console.log(`\n   → Se perdi tutto: Mode 2 @ ${config.mode2Target}x con ${totalLoss} bits da recuperare`);
    console.log('');
}

runTests().catch(console.error);
