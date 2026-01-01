/**
 * TEST PROGRESSIONI CON RECUPERO GARANTITO
 * Ogni step ha bet calcolato per recuperare perdite precedenti + profitto
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

function bytesToHex(bytes) {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Genera progressione con recupero garantito
 * @param {number[]} mults - Array di moltiplicatori per ogni step
 * @param {number} baseBet - Puntata base in bits
 * @param {number} minProfit - Profitto minimo da garantire quando si vince
 */
function generateRecoveryProgression(mults, baseBet, minProfit) {
    const progression = [];
    let totalLoss = 0;

    for (let i = 0; i < mults.length; i++) {
        const mult = mults[i];
        const profitMult = mult - 1;

        // Bet deve recuperare totalLoss + garantire minProfit
        let bet;
        if (i === 0) {
            bet = baseBet;
        } else {
            bet = Math.ceil((totalLoss + minProfit) / profitMult);
            bet = Math.max(bet, baseBet); // Minimo baseBet
        }

        // Arrotonda a multipli di 100 satoshi (0.01 bits)
        bet = Math.ceil(bet);

        progression.push({ mult, bet });
        totalLoss += bet;
    }

    return progression;
}

function simulate(crashes, config, startBalance) {
    let balance = startBalance;
    let mode = 1;

    const baseBet = Math.floor(startBalance * config.baseBetPercent / 100);

    // Mode 1 state
    let mode1Step = 0;
    let mode1TotalLoss = 0;

    // Mode 2 state
    let mode2Bets = 0;
    let mode2LossToRecover = 0;

    let stats = {
        mode1Wins: 0,
        mode1WinsWithRecovery: 0,
        mode2Entries: 0,
        mode2Wins: 0,
        mode2Fails: 0
    };

    for (let i = 0; i < crashes.length; i++) {
        const crash = crashes[i];

        if (mode === 1) {
            const step = config.progression[Math.min(mode1Step, config.progression.length - 1)];
            let bet = step.bet;

            // Ricalcola bet per recupero se necessario
            if (mode1Step > 0) {
                const profitMult = step.mult - 1;
                const requiredBet = Math.ceil((mode1TotalLoss + config.minProfit) / profitMult);
                bet = Math.max(requiredBet, step.bet);
            }

            if (bet > balance) {
                mode = 2;
                mode2LossToRecover = mode1TotalLoss;
                mode2Bets = 0;
                stats.mode2Entries++;
                mode1Step = 0;
                mode1TotalLoss = 0;
                i--;
                continue;
            }

            balance -= bet;

            if (crash >= step.mult) {
                // WIN
                const profit = Math.floor(bet * (step.mult - 1));
                balance += bet + profit;

                if (mode1Step > 0) stats.mode1WinsWithRecovery++;
                else stats.mode1Wins++;

                mode1Step = 0;
                mode1TotalLoss = 0;
            } else {
                // LOSS
                mode1TotalLoss += bet;
                mode1Step++;

                if (mode1Step >= config.progression.length) {
                    mode = 2;
                    mode2LossToRecover = mode1TotalLoss;
                    mode2Bets = 0;
                    stats.mode2Entries++;
                    mode1Step = 0;
                    mode1TotalLoss = 0;
                }
            }
        } else {
            // Mode 2
            const target = config.mode2Target;
            const profitMult = target - 1;
            const requiredBet = Math.ceil((mode2LossToRecover + config.minProfit) / profitMult);

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

        if (balance < baseBet) break;
    }

    return {
        profit: balance - startBalance,
        profitPercent: ((balance - startBalance) / startBalance) * 100,
        bankrupt: balance < baseBet,
        ...stats
    };
}

function showProgression(name, mults, baseBet, minProfit) {
    console.log(`\n   ${name}:`);
    let totalLoss = 0;

    for (let i = 0; i < mults.length; i++) {
        const mult = mults[i];
        const profitMult = mult - 1;
        const prob = (1 / mult) * 99;

        let bet;
        if (i === 0) {
            bet = baseBet;
        } else {
            bet = Math.ceil((totalLoss + minProfit) / profitMult);
            bet = Math.max(bet, baseBet);
        }

        const winProfit = Math.floor(bet * profitMult);
        const netIfWin = winProfit - totalLoss;

        console.log(`   Step ${i + 1}: ${bet} bits @ ${mult.toFixed(2)}x (~${prob.toFixed(0)}%) → netto +${netIfWin} bits`);
        totalLoss += bet;
    }

    console.log(`   → Mode 2 con ${totalLoss} bits da recuperare\n`);
    return totalLoss;
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
    console.log('║       TEST PROGRESSIONI CON RECUPERO GARANTITO (IBRIDO)                  ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
    console.log('');

    const SESSIONS = 30000;
    const GAMES = 500;
    const BALANCE = 100000;
    const BASE_BET = 30;  // 0.3% di 10000 bits = 30 bits
    const MIN_PROFIT = 15; // Profitto minimo garantito

    // Diverse sequenze di moltiplicatori da testare
    const multSequences = [
        { name: '1.5→2.5→3.5 (3 step, +1)', mults: [1.5, 2.5, 3.5] },
        { name: '1.5→2.5→3.5→4.5 (4 step, +1)', mults: [1.5, 2.5, 3.5, 4.5] },
        { name: '1.5→2.5→3.5→4.5→5.5 (5 step, +1)', mults: [1.5, 2.5, 3.5, 4.5, 5.5] },
        { name: '2.0→3.0→4.0→5.0 (4 step, +1)', mults: [2.0, 3.0, 4.0, 5.0] },
        { name: '2.0→3.0→4.0→5.0→6.0 (5 step, +1)', mults: [2.0, 3.0, 4.0, 5.0, 6.0] },
        { name: '2.0→2.5→3.0→3.5→4.0 (5 step, +0.5)', mults: [2.0, 2.5, 3.0, 3.5, 4.0] },
        { name: '2.0→2.5→3.0→3.5→4.0→4.5 (6 step, +0.5)', mults: [2.0, 2.5, 3.0, 3.5, 4.0, 4.5] },
        { name: '2.0→2.5→3.0→3.5→4.0→4.5→5.0 (7 step)', mults: [2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0] },
        { name: '1.5→2.0→2.5→3.0→3.5→4.0 (6 step, +0.5)', mults: [1.5, 2.0, 2.5, 3.0, 3.5, 4.0] },
        { name: '1.5→2.0→2.5→3.0→3.5→4.0→4.5 (7 step)', mults: [1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5] },
        { name: '1.8→2.3→2.8→3.3→3.8→4.3 (6 step)', mults: [1.8, 2.3, 2.8, 3.3, 3.8, 4.3] },
        { name: '2.0→2.8→3.6→4.4→5.2 (5 step, +0.8)', mults: [2.0, 2.8, 3.6, 4.4, 5.2] },
    ];

    const results = [];

    for (const seq of multSequences) {
        const progression = generateRecoveryProgression(seq.mults, BASE_BET, MIN_PROFIT);

        // Calcola M1Loss totale
        let m1Loss = 0;
        for (const step of progression) {
            m1Loss += step.bet;
        }

        const config = {
            baseBetPercent: 0.3,
            progression,
            minProfit: MIN_PROFIT,
            mode2Target: 3.0,
            mode2MaxBets: 15
        };

        let totalProfit = 0;
        let bankrupts = 0;
        let totalMode2 = 0;
        let totalMode2Wins = 0;
        let totalMode1Wins = 0;
        let totalMode1Recovery = 0;

        for (let s = 0; s < SESSIONS; s++) {
            const checkpointIdx = Math.floor(Math.random() * checkpoints.length);
            const skipGames = Math.floor(Math.random() * 1000);

            let hash = hexToBytes(checkpoints[checkpointIdx].hash);
            for (let i = 0; i < skipGames; i++) hash = sha256(hash);

            const crashes = generateGames(bytesToHex(hash), GAMES);
            const result = simulate(crashes, config, BALANCE);

            totalProfit += result.profit;
            if (result.bankrupt) bankrupts++;
            totalMode2 += result.mode2Entries;
            totalMode2Wins += result.mode2Wins;
            totalMode1Wins += result.mode1Wins;
            totalMode1Recovery += result.mode1WinsWithRecovery;
        }

        const ev = (totalProfit / SESSIONS / BALANCE) * 100;
        const bankruptRate = (bankrupts / SESSIONS) * 100;
        const mode2PerSession = totalMode2 / SESSIONS;
        const mode1WinRate = (totalMode1Wins + totalMode1Recovery) / SESSIONS;
        const mode1RecoveryRate = totalMode1Recovery / (totalMode1Wins + totalMode1Recovery) * 100;

        results.push({
            name: seq.name,
            steps: seq.mults.length,
            maxMult: seq.mults[seq.mults.length - 1],
            m1Loss,
            ev,
            bankruptRate,
            mode2PerSession,
            mode1WinRate,
            mode1RecoveryRate,
            mults: seq.mults
        });

        process.stdout.write(`\r   Testato: ${seq.name.substring(0, 40).padEnd(40)}`);
    }

    console.log('\n');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('                              📊 RISULTATI');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('');

    // Ordina per EV
    results.sort((a, b) => b.ev - a.ev);

    console.log('   Progressione                           │ Step │ MaxX │ M1Loss │   EV %   │ Bankr% │ M2/sess │ M1Rec%');
    console.log('   ───────────────────────────────────────┼──────┼──────┼────────┼──────────┼────────┼─────────┼───────');

    for (const r of results) {
        const ev = (r.ev >= 0 ? '+' : '') + r.ev.toFixed(2) + '%';
        console.log(`   ${r.name.padEnd(39)} │ ${String(r.steps).padStart(4)} │ ${r.maxMult.toFixed(1).padStart(4)}x │ ${String(r.m1Loss).padStart(6)} │ ${ev.padStart(8)} │ ${r.bankruptRate.toFixed(1).padStart(6)}% │ ${r.mode2PerSession.toFixed(1).padStart(7)} │ ${r.mode1RecoveryRate.toFixed(0).padStart(5)}%`);
    }

    console.log('');
    console.log('   M1Rec% = % di vittorie Mode1 che sono recovery (dopo almeno 1 loss)');
    console.log('');

    // Top 3 progressioni dettagliate
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('                          🏆 TOP 3 PROGRESSIONI');
    console.log('═══════════════════════════════════════════════════════════════════════════════');

    for (let i = 0; i < 3 && i < results.length; i++) {
        const r = results[i];
        showProgression(`#${i + 1} ${r.name}`, r.mults, BASE_BET, MIN_PROFIT);
    }
}

runTests().catch(console.error);
