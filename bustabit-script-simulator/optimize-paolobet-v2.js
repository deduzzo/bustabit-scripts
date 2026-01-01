/**
 * OPTIMIZER PAOLOBET v2 - Ottimizzazione avanzata
 * Testa: progressione, mode2, coldStreak threshold, resume condition
 */

const crypto = require('crypto');
const fs = require('fs');

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

function simulate(crashes, config, startBalance) {
    let balance = startBalance;
    let mode = 1;

    const baseBet = Math.floor(startBalance * config.baseBetPercent / 100);
    const minProfit = config.minProfit;

    let mode1Step = 0;
    let mode1TotalLoss = 0;
    let mode2Bets = 0;
    let mode2LossToRecover = 0;

    let coldStreak = 0;
    let isSuspended = false;

    let stats = { mode1Wins: 0, mode2Entries: 0, mode2Wins: 0, betsPlaced: 0, suspensions: 0 };

    function getMode1Mult(step) {
        return config.startMult + (step * config.multIncrease);
    }

    function getMode1Bet(step) {
        if (step === 0) return baseBet;
        const mult = getMode1Mult(step);
        const profitMult = mult - 1;
        const requiredBet = Math.ceil((mode1TotalLoss + minProfit) / profitMult);
        return Math.max(requiredBet, baseBet);
    }

    function resetAll() {
        mode = 1;
        mode1Step = 0;
        mode1TotalLoss = 0;
        mode2Bets = 0;
        mode2LossToRecover = 0;
    }

    for (let i = 0; i < crashes.length; i++) {
        const crash = crashes[i];

        // Cold streak check
        if (crash >= config.resumeAt) {
            coldStreak = 0;
            if (isSuspended) {
                isSuspended = false;
            }
        } else if (crash >= 3) {
            coldStreak = 0;
        } else {
            coldStreak++;
        }

        if (!isSuspended && coldStreak > config.maxColdStreak) {
            isSuspended = true;
            stats.suspensions++;
        }

        if (isSuspended) continue;

        if (mode === 1) {
            const mult = getMode1Mult(mode1Step);
            let bet = getMode1Bet(mode1Step);

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

            stats.betsPlaced++;
            balance -= bet;

            if (crash >= mult) {
                const profit = Math.floor(bet * (mult - 1));
                balance += bet + profit;
                stats.mode1Wins++;
                resetAll();
            } else {
                mode1TotalLoss += bet;
                mode1Step++;
                if (mode1Step >= config.maxSteps) {
                    mode = 2;
                    mode2LossToRecover = mode1TotalLoss;
                    mode2Bets = 0;
                    stats.mode2Entries++;
                    mode1Step = 0;
                    mode1TotalLoss = 0;
                }
            }
        } else {
            const target = config.mode2Target;
            const profitMult = target - 1;
            const requiredBet = Math.ceil((mode2LossToRecover + minProfit) / profitMult);

            if (requiredBet > balance) {
                resetAll();
                continue;
            }

            stats.betsPlaced++;
            balance -= requiredBet;
            mode2Bets++;

            if (crash >= target) {
                const profit = Math.floor(requiredBet * (target - 1));
                balance += requiredBet + profit;
                stats.mode2Wins++;
                resetAll();
            } else {
                mode2LossToRecover += requiredBet;
                if (mode2Bets >= config.mode2MaxBets) {
                    resetAll();
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

async function runOptimization() {
    let checkpoints;
    try {
        checkpoints = require('./hash-checkpoints-10M.js').HASH_CHECKPOINTS_10M;
    } catch (e) {
        checkpoints = require('./hash-checkpoints.js').HASH_CHECKPOINTS;
    }

    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
    console.log('║          OPTIMIZER PAOLOBET v2 - OTTIMIZZAZIONE AVANZATA                  ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
    console.log('');

    const SESSIONS = 1000;
    const GAMES = 500;
    const BALANCE = 100000;

    // Parametri da testare
    const startMults = [1.3, 1.5, 1.8, 2.0];
    const multIncreases = [0.8, 1.0, 1.2];
    const maxStepsValues = [3, 4, 5, 6];
    const mode2Targets = [2.5, 3.0, 3.5];
    const mode2MaxBetsValues = [10, 15, 20];
    const minProfits = [10, 15, 20];
    const coldStreakValues = [6, 7, 8, 9, 10];
    const resumeAtValues = [5, 10, 15];

    // Best from v1
    const baseConfig = {
        baseBetPercent: 0.2
    };

    // FASE 1: Ottimizza progressione Mode 1
    console.log('   FASE 1: Ottimizzazione Progressione Mode 1');
    console.log('   ─────────────────────────────────────────────');

    let phase1Results = [];
    let tested = 0;
    const total1 = startMults.length * multIncreases.length * maxStepsValues.length;

    for (const startMult of startMults) {
        for (const multIncrease of multIncreases) {
            for (const maxSteps of maxStepsValues) {
                const config = {
                    ...baseConfig,
                    startMult,
                    multIncrease,
                    maxSteps,
                    minProfit: 15,
                    mode2Target: 3.0,
                    mode2MaxBets: 15,
                    maxColdStreak: 8,
                    resumeAt: 10
                };

                let totalProfit = 0;
                let bankrupts = 0;

                for (let s = 0; s < SESSIONS; s++) {
                    const idx = Math.floor(Math.random() * checkpoints.length);
                    const skip = Math.floor(Math.random() * 1000);
                    let hash = hexToBytes(checkpoints[idx].hash);
                    for (let j = 0; j < skip; j++) hash = sha256(hash);
                    const crashes = generateGames(bytesToHex(hash), GAMES);
                    const result = simulate(crashes, config, BALANCE);
                    totalProfit += result.profit;
                    if (result.bankrupt) bankrupts++;
                }

                const ev = (totalProfit / SESSIONS / BALANCE) * 100;
                phase1Results.push({ startMult, multIncrease, maxSteps, ev, bankruptRate: (bankrupts/SESSIONS)*100 });
                tested++;
                process.stdout.write('\r   [' + tested + '/' + total1 + '] SM=' + startMult + ' MI=' + multIncrease + ' Steps=' + maxSteps);
            }
        }
    }

    console.log('\n');
    phase1Results.sort((a, b) => b.ev - a.ev);

    console.log('   StartM │ +Mult │ Steps │   EV %   │ Bankr%');
    console.log('   ───────┼───────┼───────┼──────────┼───────');
    for (let i = 0; i < 10 && i < phase1Results.length; i++) {
        const r = phase1Results[i];
        const ev = (r.ev >= 0 ? '+' : '') + r.ev.toFixed(2) + '%';
        console.log('   ' + r.startMult.toFixed(1).padStart(5) + 'x │ ' + ('+' + r.multIncrease.toFixed(1)).padStart(5) + ' │ ' + String(r.maxSteps).padStart(5) + ' │ ' + ev.padStart(8) + ' │ ' + r.bankruptRate.toFixed(1).padStart(5) + '%');
    }

    const best1 = phase1Results[0];
    console.log('');
    console.log('   🏆 MIGLIORE: ' + best1.startMult + 'x +' + best1.multIncrease + ' (' + best1.maxSteps + ' step)');
    console.log('');

    // FASE 2: Ottimizza Mode 2
    console.log('   FASE 2: Ottimizzazione Mode 2');
    console.log('   ─────────────────────────────────────────────');

    let phase2Results = [];
    tested = 0;
    const total2 = mode2Targets.length * mode2MaxBetsValues.length * minProfits.length;

    for (const mode2Target of mode2Targets) {
        for (const mode2MaxBets of mode2MaxBetsValues) {
            for (const minProfit of minProfits) {
                const config = {
                    ...baseConfig,
                    startMult: best1.startMult,
                    multIncrease: best1.multIncrease,
                    maxSteps: best1.maxSteps,
                    minProfit,
                    mode2Target,
                    mode2MaxBets,
                    maxColdStreak: 8,
                    resumeAt: 10
                };

                let totalProfit = 0;
                let bankrupts = 0;

                for (let s = 0; s < SESSIONS; s++) {
                    const idx = Math.floor(Math.random() * checkpoints.length);
                    const skip = Math.floor(Math.random() * 1000);
                    let hash = hexToBytes(checkpoints[idx].hash);
                    for (let j = 0; j < skip; j++) hash = sha256(hash);
                    const crashes = generateGames(bytesToHex(hash), GAMES);
                    const result = simulate(crashes, config, BALANCE);
                    totalProfit += result.profit;
                    if (result.bankrupt) bankrupts++;
                }

                const ev = (totalProfit / SESSIONS / BALANCE) * 100;
                phase2Results.push({ mode2Target, mode2MaxBets, minProfit, ev, bankruptRate: (bankrupts/SESSIONS)*100 });
                tested++;
                process.stdout.write('\r   [' + tested + '/' + total2 + '] M2T=' + mode2Target + 'x MaxB=' + mode2MaxBets + ' MinP=' + minProfit);
            }
        }
    }

    console.log('\n');
    phase2Results.sort((a, b) => b.ev - a.ev);

    console.log('   M2 Tgt │ MaxBet │ MinProf │   EV %   │ Bankr%');
    console.log('   ───────┼────────┼─────────┼──────────┼───────');
    for (let i = 0; i < 10 && i < phase2Results.length; i++) {
        const r = phase2Results[i];
        const ev = (r.ev >= 0 ? '+' : '') + r.ev.toFixed(2) + '%';
        console.log('   ' + r.mode2Target.toFixed(1).padStart(5) + 'x │ ' + String(r.mode2MaxBets).padStart(6) + ' │ ' + String(r.minProfit).padStart(7) + ' │ ' + ev.padStart(8) + ' │ ' + r.bankruptRate.toFixed(1).padStart(5) + '%');
    }

    const best2 = phase2Results[0];
    console.log('');
    console.log('   🏆 MIGLIORE: M2=' + best2.mode2Target + 'x MaxBets=' + best2.mode2MaxBets + ' MinProfit=' + best2.minProfit);
    console.log('');

    // FASE 3: Cold Streak fine-tuning
    console.log('   FASE 3: Cold Streak + Resume Condition');
    console.log('   ─────────────────────────────────────────────');

    let phase3Results = [];
    tested = 0;
    const total3 = coldStreakValues.length * resumeAtValues.length;

    for (const maxColdStreak of coldStreakValues) {
        for (const resumeAt of resumeAtValues) {
            const config = {
                ...baseConfig,
                startMult: best1.startMult,
                multIncrease: best1.multIncrease,
                maxSteps: best1.maxSteps,
                minProfit: best2.minProfit,
                mode2Target: best2.mode2Target,
                mode2MaxBets: best2.mode2MaxBets,
                maxColdStreak,
                resumeAt
            };

            let totalProfit = 0;
            let bankrupts = 0;
            let totalSuspensions = 0;

            for (let s = 0; s < SESSIONS; s++) {
                const idx = Math.floor(Math.random() * checkpoints.length);
                const skip = Math.floor(Math.random() * 1000);
                let hash = hexToBytes(checkpoints[idx].hash);
                for (let j = 0; j < skip; j++) hash = sha256(hash);
                const crashes = generateGames(bytesToHex(hash), GAMES);
                const result = simulate(crashes, config, BALANCE);
                totalProfit += result.profit;
                if (result.bankrupt) bankrupts++;
                totalSuspensions += result.suspensions;
            }

            const ev = (totalProfit / SESSIONS / BALANCE) * 100;
            phase3Results.push({ 
                maxColdStreak, 
                resumeAt, 
                ev, 
                bankruptRate: (bankrupts/SESSIONS)*100,
                suspsPerSession: totalSuspensions / SESSIONS
            });
            tested++;
            process.stdout.write('\r   [' + tested + '/' + total3 + '] ColdStreak=' + maxColdStreak + ' ResumeAt=' + resumeAt + 'x');
        }
    }

    console.log('\n');
    phase3Results.sort((a, b) => b.ev - a.ev);

    console.log('   Cold │ Resume │   EV %   │ Bankr% │ Susp/s');
    console.log('   ─────┼────────┼──────────┼────────┼───────');
    for (let i = 0; i < 15 && i < phase3Results.length; i++) {
        const r = phase3Results[i];
        const ev = (r.ev >= 0 ? '+' : '') + r.ev.toFixed(2) + '%';
        console.log('   ' + String(r.maxColdStreak).padStart(4) + ' │ ' + (r.resumeAt + 'x').padStart(6) + ' │ ' + ev.padStart(8) + ' │ ' + r.bankruptRate.toFixed(1).padStart(6) + '% │ ' + r.suspsPerSession.toFixed(1).padStart(5));
    }

    const best3 = phase3Results[0];

    // RISULTATO FINALE
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('                     🏆 CONFIGURAZIONE OTTIMALE FINALE');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('');
    console.log('   PROGRESSIONE MODE 1:');
    console.log('   ────────────────────');
    console.log('   startMult:       ' + best1.startMult + 'x');
    console.log('   multIncrease:    +' + best1.multIncrease);
    console.log('   maxSteps:        ' + best1.maxSteps);
    console.log('');
    console.log('   MODE 2:');
    console.log('   ────────────────────');
    console.log('   mode2Target:     ' + best2.mode2Target + 'x');
    console.log('   mode2MaxBets:    ' + best2.mode2MaxBets);
    console.log('   minProfit:       ' + best2.minProfit + ' bits');
    console.log('');
    console.log('   COLD STREAK:');
    console.log('   ────────────────────');
    console.log('   maxColdStreak:   ' + best3.maxColdStreak);
    console.log('   resumeAt:        ' + best3.resumeAt + 'x');
    console.log('');
    console.log('   RISULTATO:');
    console.log('   ────────────────────');
    console.log('   EV ATTESO:       ' + (best3.ev >= 0 ? '+' : '') + best3.ev.toFixed(3) + '%');
    console.log('   BANKRUPT RATE:   ' + best3.bankruptRate.toFixed(2) + '%');
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════════');

    // Salva
    fs.writeFileSync('./paolobet-optimization-v2-results.json', JSON.stringify({
        progression: { startMult: best1.startMult, multIncrease: best1.multIncrease, maxSteps: best1.maxSteps },
        mode2: { target: best2.mode2Target, maxBets: best2.mode2MaxBets, minProfit: best2.minProfit },
        coldStreak: { threshold: best3.maxColdStreak, resumeAt: best3.resumeAt },
        ev: best3.ev,
        bankruptRate: best3.bankruptRate,
        allResults: { phase1: phase1Results.slice(0,20), phase2: phase2Results.slice(0,20), phase3: phase3Results }
    }, null, 2));

    console.log('');
    console.log('   💾 Salvato in paolobet-optimization-v2-results.json');
    console.log('');
}

runOptimization().catch(console.error);
