/**
 * Test PAOLOBET HYBRID v4.1
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

// PAOLOBET v4.1 Config (OTTIMIZZATO)
const CONFIG = {
    baseBetPercent: 0.2,
    step1Mult: 3.0,
    step2Mult: 8.0,
    minProfit: 25,
    mode2Target: 3.0,
    mode2MaxBets: 10,
    maxColdStreak: 4,
    resumeOnMult: 3,
    resumeAfterGames: 12
};

function simulate(crashes, config, startBalance) {
    let balance = startBalance;
    let mode = 1;
    const baseBet = Math.floor(startBalance * config.baseBetPercent / 100);
    const minProfit = config.minProfit;
    const mults = [config.step1Mult, config.step2Mult];
    const maxSteps = 2;

    let mode1Step = 0;
    let mode1TotalLoss = 0;
    let mode2Bets = 0;
    let mode2LossToRecover = 0;

    let coldStreakCount = 0;
    let suspended = false;
    let suspendedGames = 0;

    function getMode1Mult(step) {
        return mults[Math.min(step, maxSteps - 1)];
    }

    function getMode1Bet(step) {
        if (step === 0) return baseBet;
        const mult = getMode1Mult(step);
        return Math.max(Math.ceil((mode1TotalLoss + minProfit) / (mult - 1)), baseBet);
    }

    for (let i = 0; i < crashes.length; i++) {
        const crash = crashes[i];

        if (crash >= 3) coldStreakCount = 0;
        else coldStreakCount++;

        if (coldStreakCount >= config.maxColdStreak) {
            suspended = true;
            suspendedGames = 0;
        }

        if (suspended) {
            suspendedGames++;
            const resumeByMult = crash >= config.resumeOnMult;
            const resumeByGames = config.resumeAfterGames > 0 && suspendedGames >= config.resumeAfterGames;

            if (resumeByMult || resumeByGames) {
                suspended = false;
                coldStreakCount = 0;
                suspendedGames = 0;
            }
            continue;
        }

        if (mode === 1) {
            const mult = getMode1Mult(mode1Step);
            let bet = getMode1Bet(mode1Step);

            if (bet > balance) {
                mode = 2;
                mode2LossToRecover = mode1TotalLoss;
                mode2Bets = 0;
                mode1Step = 0;
                mode1TotalLoss = 0;
                i--;
                continue;
            }

            balance -= bet;
            if (crash >= mult) {
                balance += bet + Math.floor(bet * (mult - 1));
                mode1Step = 0;
                mode1TotalLoss = 0;
            } else {
                mode1TotalLoss += bet;
                mode1Step++;
                if (mode1Step >= maxSteps) {
                    mode = 2;
                    mode2LossToRecover = mode1TotalLoss;
                    mode2Bets = 0;
                    mode1Step = 0;
                    mode1TotalLoss = 0;
                }
            }
        } else {
            const target = config.mode2Target;
            const requiredBet = Math.ceil((mode2LossToRecover + minProfit) / (target - 1));

            if (requiredBet > balance) {
                mode = 1;
                mode2LossToRecover = 0;
                mode2Bets = 0;
                continue;
            }

            balance -= requiredBet;
            mode2Bets++;

            if (crash >= target) {
                balance += requiredBet + Math.floor(requiredBet * (target - 1));
                mode = 1;
                mode2LossToRecover = 0;
                mode2Bets = 0;
            } else {
                mode2LossToRecover += requiredBet;
                if (mode2Bets >= config.mode2MaxBets) {
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
        bankrupt: balance < baseBet
    };
}

async function runTest() {
    let checkpoints;
    try {
        checkpoints = require('./hash-checkpoints-10M.js').HASH_CHECKPOINTS_10M;
    } catch (e) {
        checkpoints = require('./hash-checkpoints.js').HASH_CHECKPOINTS;
    }

    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
    console.log('║              TEST PAOLOBET HYBRID v4.1 (OTTIMIZZATO)                      ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
    console.log('');

    const SESSIONS = 1000;
    const GAMES = 500;
    const BALANCE = 100000;

    console.log('   Configurazione:');
    console.log(`   - Progressione: [${CONFIG.step1Mult}x, ${CONFIG.step2Mult}x]`);
    console.log(`   - baseBetPercent: ${CONFIG.baseBetPercent}%`);
    console.log(`   - minProfit: ${CONFIG.minProfit} bits`);
    console.log(`   - maxColdStreak: ${CONFIG.maxColdStreak}`);
    console.log(`   - resumeOnMult: ${CONFIG.resumeOnMult}x OR ${CONFIG.resumeAfterGames} games`);
    console.log('');
    console.log(`   Sessioni: ${SESSIONS} | Partite/sessione: ${GAMES}`);
    console.log('');

    let totalProfit = 0;
    let bankrupts = 0;
    const profits = [];

    for (let i = 0; i < SESSIONS; i++) {
        const checkpointIdx = Math.floor(Math.random() * checkpoints.length);
        const skipGames = Math.floor(Math.random() * 1000);
        let hash = hexToBytes(checkpoints[checkpointIdx].hash);
        for (let j = 0; j < skipGames; j++) hash = sha256(hash);

        const crashes = generateGames(bytesToHex(hash), GAMES);
        const result = simulate(crashes, CONFIG, BALANCE);

        totalProfit += result.profitPercent;
        profits.push(result.profitPercent);
        if (result.bankrupt) bankrupts++;

        if ((i + 1) % 100 === 0) {
            const ev = totalProfit / (i + 1);
            process.stdout.write(`\r   [${((i + 1) / SESSIONS * 100).toFixed(0)}%] EV: ${ev >= 0 ? '+' : ''}${ev.toFixed(2)}%`);
        }
    }

    profits.sort((a, b) => a - b);
    const ev = totalProfit / SESSIONS;
    const br = (bankrupts / SESSIONS) * 100;
    const p5 = profits[Math.floor(profits.length * 0.05)];
    const p50 = profits[Math.floor(profits.length * 0.50)];
    const p95 = profits[Math.floor(profits.length * 0.95)];

    console.log('\r                                                                            ');
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('                              RISULTATI v4.1');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('');
    console.log(`   EV:         ${ev >= 0 ? '+' : ''}${ev.toFixed(2)}%`);
    console.log(`   Bankrupt:   ${br.toFixed(1)}%`);
    console.log(`   P5/P50/P95: ${p5.toFixed(0)}% / ${p50.toFixed(0)}% / ${p95.toFixed(0)}%`);
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
}

runTest().catch(console.error);
