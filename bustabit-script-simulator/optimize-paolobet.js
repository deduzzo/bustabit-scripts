/**
 * OPTIMIZER PAOLOBET HYBRID v3.1
 * Trova i parametri ottimali testando combinazioni su 1000 hash
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

    let cycleLoss = 0;
    let cycleResets = 0;
    let mode1Step = 0;
    let mode1TotalLoss = 0;
    let mode2Bets = 0;
    let mode2LossToRecover = 0;

    let delay10x = 0;
    let delay5x = 0;
    let coldStreak = 0;
    let isSuspended = false;
    let gameCount = 0;
    let warmupComplete = false;

    let stats = {
        mode1Wins: 0,
        mode1WinsWithRecovery: 0,
        mode2Entries: 0,
        mode2Wins: 0,
        mode2Fails: 0,
        cycleResets: 0,
        betsPlaced: 0
    };

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

    function resetCycle() {
        cycleLoss = 0;
        mode = 1;
        mode1Step = 0;
        mode1TotalLoss = 0;
        mode2Bets = 0;
        mode2LossToRecover = 0;
    }

    function resetAll() {
        mode = 1;
        mode1Step = 0;
        mode1TotalLoss = 0;
        mode2Bets = 0;
        mode2LossToRecover = 0;
        cycleLoss = 0;
    }

    function checkCycleLossLimit() {
        const maxLoss = balance * config.cycleLossLimit / 100;
        if (cycleLoss >= maxLoss) {
            cycleResets++;
            stats.cycleResets++;
            resetCycle();
            return true;
        }
        return false;
    }

    function checkProtection(bust) {
        if (!config.enableProtection) return;

        if (bust >= 10) {
            delay10x = 0; delay5x = 0; coldStreak = 0;
        } else if (bust >= 5) {
            delay10x++; delay5x = 0; coldStreak = 0;
        } else if (bust >= 3) {
            delay10x++; delay5x++; coldStreak = 0;
        } else {
            delay10x++; delay5x++; coldStreak++;
        }

        if (!isSuspended) {
            if (delay10x > config.maxDelay10x) isSuspended = true;
            else if (delay5x > config.maxDelay5x) isSuspended = true;
            else if (coldStreak > config.maxColdStreak) isSuspended = true;
        }

        if (isSuspended && bust >= 10) isSuspended = false;
    }

    for (let i = 0; i < crashes.length; i++) {
        const crash = crashes[i];
        gameCount++;

        if (!warmupComplete && gameCount <= config.warmupGames) {
            checkProtection(crash);
            continue;
        }
        warmupComplete = true;
        checkProtection(crash);
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
                if (mode1Step > 0) stats.mode1WinsWithRecovery++;
                else stats.mode1Wins++;
                resetAll();
            } else {
                mode1TotalLoss += bet;
                cycleLoss += bet;
                if (checkCycleLossLimit()) continue;
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
                stats.mode2Fails++;
                resetCycle();
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
                cycleLoss += requiredBet;
                if (checkCycleLossLimit()) continue;
                if (mode2Bets >= config.mode2MaxBets) {
                    stats.mode2Fails++;
                    resetCycle();
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
    console.log('║          OPTIMIZER PAOLOBET HYBRID v3.1                                   ║');
    console.log('║          Ricerca parametri ottimali su 1000 hash                          ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
    console.log('');

    const SESSIONS = 1000;
    const GAMES = 500;
    const BALANCE = 100000;

    const cycleLossLimits = [3, 5, 7, 10, 15, 100];
    const baseBetPercents = [0.2, 0.3, 0.4, 0.5];
    const maxDelay10xValues = [10, 15, 20, 100];
    const maxDelay5xValues = [5, 8, 12, 100];
    const maxColdStreakValues = [3, 5, 8, 100];
    const warmupGamesValues = [0, 5, 10, 20];

    const baseConfig = {
        startMult: 1.5,
        multIncrease: 1.0,
        maxSteps: 4,
        minProfit: 15,
        mode2Target: 3.0,
        mode2MaxBets: 15
    };

    console.log('   FASE 1: Ottimizzazione cycleLossLimit e baseBetPercent');
    console.log('   ───────────────────────────────────────────────────────');

    const phase1Results = [];
    let tested = 0;
    const totalPhase1 = cycleLossLimits.length * baseBetPercents.length;

    for (const cycleLossLimit of cycleLossLimits) {
        for (const baseBetPercent of baseBetPercents) {
            const config = {
                ...baseConfig,
                cycleLossLimit,
                baseBetPercent,
                enableProtection: false,
                maxDelay10x: 100,
                maxDelay5x: 100,
                maxColdStreak: 100,
                warmupGames: 0
            };

            let totalProfit = 0;
            let bankrupts = 0;
            let totalCycleResets = 0;

            for (let s = 0; s < SESSIONS; s++) {
                const idx = Math.floor(Math.random() * checkpoints.length);
                const skip = Math.floor(Math.random() * 1000);
                let hash = hexToBytes(checkpoints[idx].hash);
                for (let i = 0; i < skip; i++) hash = sha256(hash);
                const crashes = generateGames(bytesToHex(hash), GAMES);
                const result = simulate(crashes, config, BALANCE);
                totalProfit += result.profit;
                if (result.bankrupt) bankrupts++;
                totalCycleResets += result.cycleResets;
            }

            const ev = (totalProfit / SESSIONS / BALANCE) * 100;
            phase1Results.push({
                cycleLossLimit,
                baseBetPercent,
                ev,
                bankruptRate: (bankrupts / SESSIONS) * 100,
                cycleResetsPerSession: totalCycleResets / SESSIONS
            });

            tested++;
            process.stdout.write('\r   [' + tested + '/' + totalPhase1 + '] CLL=' + cycleLossLimit + '% BBP=' + baseBetPercent + '% → EV: ' + (ev >= 0 ? '+' : '') + ev.toFixed(3) + '%');
        }
    }

    console.log('\n');
    phase1Results.sort((a, b) => b.ev - a.ev);

    console.log('   CycleLoss │ BaseBet │   EV %   │ Bankr% │ Resets/sess');
    console.log('   ──────────┼─────────┼──────────┼────────┼────────────');

    for (let i = 0; i < 10 && i < phase1Results.length; i++) {
        const r = phase1Results[i];
        const ev = (r.ev >= 0 ? '+' : '') + r.ev.toFixed(3) + '%';
        const cll = r.cycleLossLimit === 100 ? 'OFF' : r.cycleLossLimit + '%';
        console.log('   ' + cll.padStart(8) + ' │ ' + (r.baseBetPercent + '%').padStart(7) + ' │ ' + ev.padStart(8) + ' │ ' + r.bankruptRate.toFixed(1).padStart(6) + '% │ ' + r.cycleResetsPerSession.toFixed(2).padStart(10));
    }

    const bestPhase1 = phase1Results[0];
    console.log('');
    console.log('   🏆 MIGLIORE FASE 1: CycleLoss=' + bestPhase1.cycleLossLimit + '% BaseBet=' + bestPhase1.baseBetPercent + '%');
    console.log('');

    console.log('   FASE 2: Ottimizzazione Pattern Protection');
    console.log('   ───────────────────────────────────────────────────────');

    const phase2Results = [];
    const protectionConfigs = [
        { enableProtection: false, maxDelay10x: 100, maxDelay5x: 100, maxColdStreak: 100, warmupGames: 0 }
    ];

    for (const d10 of maxDelay10xValues) {
        for (const d5 of maxDelay5xValues) {
            for (const cs of maxColdStreakValues) {
                for (const wu of warmupGamesValues) {
                    if (d10 === 100 && d5 === 100 && cs === 100) continue;
                    protectionConfigs.push({
                        enableProtection: true,
                        maxDelay10x: d10,
                        maxDelay5x: d5,
                        maxColdStreak: cs,
                        warmupGames: wu
                    });
                }
            }
        }
    }

    const totalPhase2 = protectionConfigs.length;
    console.log('   Testing ' + totalPhase2 + ' configurazioni protection...');
    tested = 0;

    for (const protConfig of protectionConfigs) {
        const config = {
            ...baseConfig,
            cycleLossLimit: bestPhase1.cycleLossLimit,
            baseBetPercent: bestPhase1.baseBetPercent,
            ...protConfig
        };

        let totalProfit = 0;
        let bankrupts = 0;
        let totalBets = 0;

        for (let s = 0; s < SESSIONS; s++) {
            const idx = Math.floor(Math.random() * checkpoints.length);
            const skip = Math.floor(Math.random() * 1000);
            let hash = hexToBytes(checkpoints[idx].hash);
            for (let i = 0; i < skip; i++) hash = sha256(hash);
            const crashes = generateGames(bytesToHex(hash), GAMES);
            const result = simulate(crashes, config, BALANCE);
            totalProfit += result.profit;
            if (result.bankrupt) bankrupts++;
            totalBets += result.betsPlaced;
        }

        const ev = (totalProfit / SESSIONS / BALANCE) * 100;
        phase2Results.push({
            ...protConfig,
            ev,
            bankruptRate: (bankrupts / SESSIONS) * 100,
            betsPerSession: totalBets / SESSIONS
        });

        tested++;
        if (tested % 20 === 0 || tested === totalPhase2) {
            process.stdout.write('\r   [' + tested + '/' + totalPhase2 + '] Testing...');
        }
    }

    console.log('\n');
    phase2Results.sort((a, b) => b.ev - a.ev);

    console.log('   Protection │ D10x │ D5x │ Cold │ Warm │   EV %   │ Bankr% │ Bets/s');
    console.log('   ───────────┼──────┼─────┼──────┼──────┼──────────┼────────┼───────');

    for (let i = 0; i < 15 && i < phase2Results.length; i++) {
        const r = phase2Results[i];
        const ev = (r.ev >= 0 ? '+' : '') + r.ev.toFixed(3) + '%';
        const prot = r.enableProtection ? 'ON' : 'OFF';
        const d10 = r.maxDelay10x === 100 ? '-' : r.maxDelay10x;
        const d5 = r.maxDelay5x === 100 ? '-' : r.maxDelay5x;
        const cs = r.maxColdStreak === 100 ? '-' : r.maxColdStreak;
        console.log('   ' + prot.padStart(9) + ' │ ' + String(d10).padStart(4) + ' │ ' + String(d5).padStart(3) + ' │ ' + String(cs).padStart(4) + ' │ ' + String(r.warmupGames).padStart(4) + ' │ ' + ev.padStart(8) + ' │ ' + r.bankruptRate.toFixed(1).padStart(6) + '% │ ' + r.betsPerSession.toFixed(0).padStart(5));
    }

    const bestPhase2 = phase2Results[0];
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('                          🏆 CONFIGURAZIONE OTTIMALE');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('');
    console.log('   cycleLossLimit:    ' + bestPhase1.cycleLossLimit + '%');
    console.log('   baseBetPercent:    ' + bestPhase1.baseBetPercent + '%');
    console.log('   enableProtection:  ' + (bestPhase2.enableProtection ? 'SI' : 'NO'));
    if (bestPhase2.enableProtection) {
        console.log('   maxDelay10x:       ' + (bestPhase2.maxDelay10x === 100 ? 'OFF' : bestPhase2.maxDelay10x));
        console.log('   maxDelay5x:        ' + (bestPhase2.maxDelay5x === 100 ? 'OFF' : bestPhase2.maxDelay5x));
        console.log('   maxColdStreak:     ' + (bestPhase2.maxColdStreak === 100 ? 'OFF' : bestPhase2.maxColdStreak));
        console.log('   warmupGames:       ' + bestPhase2.warmupGames);
    }
    console.log('');
    console.log('   EV ATTESO:         ' + (bestPhase2.ev >= 0 ? '+' : '') + bestPhase2.ev.toFixed(4) + '%');
    console.log('   BANKRUPT RATE:     ' + bestPhase2.bankruptRate.toFixed(2) + '%');
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════════');

    fs.writeFileSync('./paolobet-optimization-results.json', JSON.stringify({
        phase1: phase1Results.slice(0, 20),
        phase2: phase2Results.slice(0, 30),
        optimal: { cycleLossLimit: bestPhase1.cycleLossLimit, baseBetPercent: bestPhase1.baseBetPercent, ...bestPhase2 }
    }, null, 2));

    console.log('');
    console.log('   💾 Risultati salvati in paolobet-optimization-results.json');
    console.log('');
}

runOptimization().catch(console.error);
