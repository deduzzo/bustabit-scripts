/**
 * TEST PROGRESSIONI LUNGHE
 * Obiettivo: moltiplicatori alti (5-6x), puntate basse, meno Mode 2
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
 * Simula con progressione configurabile
 * progression: array di {mult, betMult} per ogni step
 * es: [{mult: 2.0, betMult: 1}, {mult: 2.5, betMult: 1}, {mult: 3.0, betMult: 1.5}]
 */
function simulate(crashes, config, startBalance) {
    let balance = startBalance;
    let mode = 1;

    const baseBet = Math.floor(startBalance * config.baseBetPercent / 100 / 100) * 100;

    // Mode 1 state
    let mode1Step = 0;
    let mode1TotalLoss = 0;

    // Mode 2 state
    let mode2Bets = 0;
    let mode2LossToRecover = 0;

    let stats = {
        mode1Wins: 0,
        mode2Entries: 0,
        mode2Wins: 0,
        mode2Fails: 0
    };

    for (let i = 0; i < crashes.length; i++) {
        const crash = crashes[i];

        if (mode === 1) {
            const step = config.progression[Math.min(mode1Step, config.progression.length - 1)];
            let bet = Math.floor(baseBet * step.betMult / 100) * 100;
            if (bet < 100) bet = 100;

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
                stats.mode1Wins++;
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
            const baseBetProfit = Math.floor(baseBet * 0.5);
            let requiredBet = Math.ceil((mode2LossToRecover + baseBetProfit) / profitMult / 100) * 100;
            requiredBet = Math.max(requiredBet, baseBet);

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

async function runTests() {
    let checkpoints;
    try {
        checkpoints = require('./hash-checkpoints-10M.js').HASH_CHECKPOINTS_10M;
    } catch (e) {
        checkpoints = require('./hash-checkpoints.js').HASH_CHECKPOINTS;
    }

    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
    console.log('║           TEST PROGRESSIONI LUNGHE - MOLTIPLICATORI ALTI                 ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
    console.log('');

    const SESSIONS = 20000;
    const GAMES = 500;
    const BALANCE = 100000;

    // Definisci diverse progressioni da testare
    const progressions = [
        {
            name: 'SOLO MULT 2→6 (5 step)',
            progression: [
                {mult: 2.0, betMult: 1},
                {mult: 3.0, betMult: 1},
                {mult: 4.0, betMult: 1},
                {mult: 5.0, betMult: 1},
                {mult: 6.0, betMult: 1},
            ],
            mode2Target: 3.0,
        },
        {
            name: 'SOLO MULT 2→5 (4 step)',
            progression: [
                {mult: 2.0, betMult: 1},
                {mult: 3.0, betMult: 1},
                {mult: 4.0, betMult: 1},
                {mult: 5.0, betMult: 1},
            ],
            mode2Target: 3.0,
        },
        {
            name: 'SOLO MULT 1.5→4.5 (7 step +0.5)',
            progression: [
                {mult: 1.5, betMult: 1},
                {mult: 2.0, betMult: 1},
                {mult: 2.5, betMult: 1},
                {mult: 3.0, betMult: 1},
                {mult: 3.5, betMult: 1},
                {mult: 4.0, betMult: 1},
                {mult: 4.5, betMult: 1},
            ],
            mode2Target: 3.0,
        },
        {
            name: 'SOLO MULT 2→5 (7 step +0.5)',
            progression: [
                {mult: 2.0, betMult: 1},
                {mult: 2.5, betMult: 1},
                {mult: 3.0, betMult: 1},
                {mult: 3.5, betMult: 1},
                {mult: 4.0, betMult: 1},
                {mult: 4.5, betMult: 1},
                {mult: 5.0, betMult: 1},
            ],
            mode2Target: 3.0,
        },
        {
            name: 'MULT+BET 2→4 poi x1.5 (6 step)',
            progression: [
                {mult: 2.0, betMult: 1},
                {mult: 2.5, betMult: 1},
                {mult: 3.0, betMult: 1},
                {mult: 3.5, betMult: 1},
                {mult: 4.0, betMult: 1},
                {mult: 4.0, betMult: 1.5},
            ],
            mode2Target: 3.0,
        },
        {
            name: 'MULT+BET alt 2→5 (8 step)',
            progression: [
                {mult: 2.0, betMult: 1},
                {mult: 2.5, betMult: 1},
                {mult: 3.0, betMult: 1},
                {mult: 3.0, betMult: 1.3},
                {mult: 3.5, betMult: 1.3},
                {mult: 4.0, betMult: 1.3},
                {mult: 4.5, betMult: 1.3},
                {mult: 5.0, betMult: 1.3},
            ],
            mode2Target: 3.0,
        },
        {
            name: 'AGGRESSIVO 3→6 (4 step)',
            progression: [
                {mult: 3.0, betMult: 1},
                {mult: 4.0, betMult: 1},
                {mult: 5.0, betMult: 1},
                {mult: 6.0, betMult: 1},
            ],
            mode2Target: 3.0,
        },
        {
            name: 'CONSERVATIVO 1.5→3 (6 step)',
            progression: [
                {mult: 1.5, betMult: 1},
                {mult: 1.8, betMult: 1},
                {mult: 2.0, betMult: 1},
                {mult: 2.3, betMult: 1},
                {mult: 2.6, betMult: 1},
                {mult: 3.0, betMult: 1},
            ],
            mode2Target: 2.5,
        },
        {
            name: 'PAOLOBET OG (MULT+1) 1.5→4.5',
            progression: [
                {mult: 1.5, betMult: 1},
                {mult: 2.5, betMult: 1},
                {mult: 3.5, betMult: 1},
                {mult: 4.5, betMult: 1},
            ],
            mode2Target: 3.0,
        },
        {
            name: 'LUNGO 2→6 step piccoli (9 step)',
            progression: [
                {mult: 2.0, betMult: 1},
                {mult: 2.5, betMult: 1},
                {mult: 3.0, betMult: 1},
                {mult: 3.5, betMult: 1},
                {mult: 4.0, betMult: 1},
                {mult: 4.5, betMult: 1},
                {mult: 5.0, betMult: 1},
                {mult: 5.5, betMult: 1},
                {mult: 6.0, betMult: 1},
            ],
            mode2Target: 3.0,
        },
    ];

    const results = [];

    for (const prog of progressions) {
        const config = {
            baseBetPercent: 0.3,
            progression: prog.progression,
            mode2Target: prog.mode2Target,
            mode2MaxBets: 15
        };

        let totalProfit = 0;
        let bankrupts = 0;
        let totalMode2 = 0;
        let totalMode2Wins = 0;
        let targets = 0;

        for (let s = 0; s < SESSIONS; s++) {
            const checkpointIdx = Math.floor(Math.random() * checkpoints.length);
            const skipGames = Math.floor(Math.random() * 1000);

            let hash = hexToBytes(checkpoints[checkpointIdx].hash);
            for (let i = 0; i < skipGames; i++) hash = sha256(hash);

            const crashes = generateGames(bytesToHex(hash), GAMES);
            const result = simulate(crashes, config, BALANCE);

            totalProfit += result.profit;
            if (result.bankrupt) bankrupts++;
            if (result.profitPercent >= 20) targets++;
            totalMode2 += result.mode2Entries;
            totalMode2Wins += result.mode2Wins;
        }

        const ev = (totalProfit / SESSIONS / BALANCE) * 100;
        const bankruptRate = (bankrupts / SESSIONS) * 100;
        const targetRate = (targets / SESSIONS) * 100;
        const mode2PerSession = totalMode2 / SESSIONS;
        const mode2WinRate = totalMode2 > 0 ? (totalMode2Wins / totalMode2) * 100 : 0;

        // Calcola perdita totale Mode1 se perdi tutti gli step
        let maxMode1Loss = 0;
        for (const step of prog.progression) {
            maxMode1Loss += 30 * step.betMult; // 30 bits base
        }

        results.push({
            name: prog.name,
            steps: prog.progression.length,
            maxMult: prog.progression[prog.progression.length - 1].mult,
            maxMode1Loss,
            ev,
            bankruptRate,
            targetRate,
            mode2PerSession,
            mode2WinRate
        });

        process.stdout.write(`\r   Testato: ${prog.name.substring(0, 30).padEnd(30)}`);
    }

    console.log('\n');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('                              📊 RISULTATI');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('');

    // Ordina per EV
    results.sort((a, b) => b.ev - a.ev);

    console.log('   Progressione                    │ Step │ MaxX │ M1Loss │   EV %   │ Bankr% │ M2/sess');
    console.log('   ────────────────────────────────┼──────┼──────┼────────┼──────────┼────────┼────────');

    for (const r of results) {
        const ev = (r.ev >= 0 ? '+' : '') + r.ev.toFixed(2) + '%';
        console.log(`   ${r.name.substring(0, 32).padEnd(32)} │ ${String(r.steps).padStart(4)} │ ${r.maxMult.toFixed(1).padStart(4)}x │ ${String(r.maxMode1Loss).padStart(6)} │ ${ev.padStart(8)} │ ${r.bankruptRate.toFixed(1).padStart(6)}% │ ${r.mode2PerSession.toFixed(1).padStart(6)}`);
    }

    console.log('');
    console.log('   Legenda:');
    console.log('   - M1Loss: bits persi in Mode1 se fallisci tutti gli step');
    console.log('   - M2/sess: quante volte entri in Mode2 per sessione');
    console.log('');

    // Mostra progressione del migliore
    const best = results[0];
    const bestProg = progressions.find(p => p.name === best.name);

    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log(`   🏆 MIGLIORE: ${best.name}`);
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('');
    console.log('   PROGRESSIONE:');

    let totalLoss = 0;
    for (let i = 0; i < bestProg.progression.length; i++) {
        const step = bestProg.progression[i];
        const bet = 30 * step.betMult;
        const prob = (1 / step.mult) * 99;
        const winProfit = Math.floor(bet * (step.mult - 1));
        totalLoss += bet;
        const netIfWin = winProfit - (totalLoss - bet);

        console.log(`   Step ${i + 1}: ${bet.toFixed(0)} bits @ ${step.mult.toFixed(2)}x (~${prob.toFixed(0)}%) → netto ${netIfWin >= 0 ? '+' : ''}${netIfWin.toFixed(0)} bits`);
    }
    console.log(`\n   → Mode 2 con ${totalLoss.toFixed(0)} bits da recuperare`);
    console.log('');
}

runTests().catch(console.error);
