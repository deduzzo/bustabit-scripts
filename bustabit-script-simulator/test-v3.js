/**
 * TEST PAOLOBET HYBRID v3.0
 * Progressione +1 Ottimizzata
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
 * Simula PAOLOBET HYBRID v3.0
 */
function simulateV3(crashes, config, startBalance) {
    let balance = startBalance;
    let mode = 1;

    const baseBet = Math.floor(startBalance * config.baseBetPercent / 100);
    const minProfit = config.minProfit;

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
        mode2Fails: 0,
        maxDrawdown: 0
    };

    let peakBalance = startBalance;

    // Funzione per calcolare moltiplicatore
    function getMode1Mult(step) {
        return config.startMult + (step * config.multIncrease);
    }

    // Funzione per calcolare bet (con recovery)
    function getMode1Bet(step) {
        if (step === 0) return baseBet;
        const mult = getMode1Mult(step);
        const profitMult = mult - 1;
        const requiredBet = Math.ceil((mode1TotalLoss + minProfit) / profitMult);
        return Math.max(requiredBet, baseBet);
    }

    for (let i = 0; i < crashes.length; i++) {
        const crash = crashes[i];

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

            balance -= bet;

            if (crash >= mult) {
                // WIN
                const profit = Math.floor(bet * (mult - 1));
                balance += bet + profit;

                if (mode1Step > 0) stats.mode1WinsWithRecovery++;
                else stats.mode1Wins++;

                mode1Step = 0;
                mode1TotalLoss = 0;
            } else {
                // LOSS
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
            // Mode 2
            const target = config.mode2Target;
            const profitMult = target - 1;
            const requiredBet = Math.ceil((mode2LossToRecover + minProfit) / profitMult);

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

        // Track drawdown
        if (balance > peakBalance) peakBalance = balance;
        const drawdown = (peakBalance - balance) / peakBalance * 100;
        if (drawdown > stats.maxDrawdown) stats.maxDrawdown = drawdown;

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
    console.log('║              TEST PAOLOBET HYBRID v3.0                                    ║');
    console.log('║              PROGRESSIONE +1 OTTIMIZZATA                                  ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
    console.log('');

    const SESSIONS = 50000;
    const GAMES = 500;
    const BALANCE = 100000;
    const BASE_BET = 30;
    const MIN_PROFIT = 15;

    // Config v3.0
    const config = {
        baseBetPercent: 0.3,
        startMult: 1.5,
        multIncrease: 1.0,
        maxSteps: 4,
        minProfit: MIN_PROFIT,
        mode2Target: 3.0,
        mode2MaxBets: 15
    };

    console.log('   PROGRESSIONE:');
    let totalLoss = 0;
    for (let s = 0; s < config.maxSteps; s++) {
        const mult = config.startMult + (s * config.multIncrease);
        const prob = Math.floor((1 / mult) * 99);
        let bet = BASE_BET;
        if (s > 0) {
            const profitMult = mult - 1;
            bet = Math.max(Math.ceil((totalLoss + MIN_PROFIT) / profitMult), BASE_BET);
        }
        const winProfit = Math.floor(bet * (mult - 1));
        const netIfWin = winProfit - totalLoss;
        console.log(`   Step ${s + 1}: ${bet} bits @ ${mult.toFixed(2)}x (~${prob}%) → netto +${netIfWin} bits`);
        totalLoss += bet;
    }
    console.log(`   → Mode 2 con ${totalLoss} bits da recuperare`);
    console.log('');
    console.log(`   Sessioni: ${SESSIONS} | Partite/sessione: ${GAMES}`);
    console.log('');

    let totalProfit = 0;
    let totalMode1Wins = 0;
    let totalMode1Recovery = 0;
    let totalMode2Entries = 0;
    let totalMode2Wins = 0;
    let totalMode2Fails = 0;
    let bankrupts = 0;
    let targets = 0;
    const profits = [];
    const drawdowns = [];

    const startTime = Date.now();

    for (let i = 0; i < SESSIONS; i++) {
        const checkpointIdx = Math.floor(Math.random() * checkpoints.length);
        const skipGames = Math.floor(Math.random() * 1000);

        let hash = hexToBytes(checkpoints[checkpointIdx].hash);
        for (let j = 0; j < skipGames; j++) hash = sha256(hash);

        const crashes = generateGames(bytesToHex(hash), GAMES);
        const result = simulateV3(crashes, config, BALANCE);

        totalProfit += result.profit;
        profits.push(result.profitPercent);
        drawdowns.push(result.maxDrawdown);

        totalMode1Wins += result.mode1Wins;
        totalMode1Recovery += result.mode1WinsWithRecovery;
        totalMode2Entries += result.mode2Entries;
        totalMode2Wins += result.mode2Wins;
        totalMode2Fails += result.mode2Fails;

        if (result.bankrupt) bankrupts++;
        if (result.profitPercent >= 20) targets++;

        if ((i + 1) % 5000 === 0) {
            const ev = (totalProfit / (i + 1) / BALANCE) * 100;
            const pct = ((i + 1) / SESSIONS * 100).toFixed(1);
            process.stdout.write(`\r   [${pct}%] ${i + 1}/${SESSIONS} - EV: ${ev >= 0 ? '+' : ''}${ev.toFixed(3)}%`);
        }
    }

    const elapsed = (Date.now() - startTime) / 1000;

    console.log(`\r   COMPLETATO in ${elapsed.toFixed(1)}s                              `);
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('                              📊 RISULTATI');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('');

    const avgProfitPercent = (totalProfit / SESSIONS / BALANCE) * 100;
    const targetRate = (targets / SESSIONS) * 100;
    const bankruptRate = (bankrupts / SESSIONS) * 100;
    const mode2Rate = totalMode2Entries / SESSIONS;
    const mode2WinRate = totalMode2Entries > 0 ? (totalMode2Wins / totalMode2Entries) * 100 : 0;

    const icon = avgProfitPercent >= 0 ? '✅' : '❌';

    console.log('   EV:');
    console.log('   ─────────────────────────────────────────────────────────────────');
    console.log(`   📈 PROFITTO MEDIO: ${avgProfitPercent >= 0 ? '+' : ''}${avgProfitPercent.toFixed(4)}% ${icon}`);
    console.log(`   📊 Per sessione:   ${(totalProfit / SESSIONS / 100).toFixed(2)} bits`);
    console.log('');

    console.log('   ESITI:');
    console.log('   ─────────────────────────────────────────────────────────────────');
    console.log(`   🎯 TARGET (+20%): ${targets}/${SESSIONS} (${targetRate.toFixed(2)}%)`);
    console.log(`   💀 BANKRUPT:      ${bankrupts}/${SESSIONS} (${bankruptRate.toFixed(2)}%)`);
    console.log('');

    console.log('   MODE 1:');
    console.log('   ─────────────────────────────────────────────────────────────────');
    console.log(`   ✅ Vittorie dirette:   ${totalMode1Wins} (${(totalMode1Wins/SESSIONS).toFixed(1)}/sess)`);
    console.log(`   🎉 Recovery in Mode1:  ${totalMode1Recovery} (${(totalMode1Recovery/SESSIONS).toFixed(1)}/sess)`);
    const mode1RecoveryRate = (totalMode1Recovery / (totalMode1Wins + totalMode1Recovery)) * 100;
    console.log(`   📊 Recovery rate:      ${mode1RecoveryRate.toFixed(1)}%`);
    console.log('');

    console.log('   MODE 2:');
    console.log('   ─────────────────────────────────────────────────────────────────');
    console.log(`   📥 Entrate in Mode2:   ${totalMode2Entries} (${mode2Rate.toFixed(2)}/sess)`);
    console.log(`   ✅ Recovery success:   ${totalMode2Wins} (${mode2WinRate.toFixed(1)}%)`);
    console.log(`   ❌ Recovery fail:      ${totalMode2Fails} (${(100-mode2WinRate).toFixed(1)}%)`);
    console.log('');

    // Distribuzione
    profits.sort((a, b) => a - b);
    drawdowns.sort((a, b) => a - b);

    const p5 = profits[Math.floor(profits.length * 0.05)];
    const p25 = profits[Math.floor(profits.length * 0.25)];
    const p50 = profits[Math.floor(profits.length * 0.50)];
    const p75 = profits[Math.floor(profits.length * 0.75)];
    const p95 = profits[Math.floor(profits.length * 0.95)];

    console.log('   DISTRIBUZIONE PROFITTI:');
    console.log('   ─────────────────────────────────────────────────────────────────');
    console.log(`   5%: ${p5.toFixed(1)}% | 25%: ${p25.toFixed(1)}% | 50%: ${p50.toFixed(1)}% | 75%: ${p75.toFixed(1)}% | 95%: ${p95.toFixed(1)}%`);
    console.log('');

    const d50 = drawdowns[Math.floor(drawdowns.length * 0.50)];
    const d95 = drawdowns[Math.floor(drawdowns.length * 0.95)];
    const dMax = drawdowns[drawdowns.length - 1];

    console.log('   DRAWDOWN:');
    console.log('   ─────────────────────────────────────────────────────────────────');
    console.log(`   Mediano: ${d50.toFixed(1)}% | 95°: ${d95.toFixed(1)}% | Max: ${dMax.toFixed(1)}%`);
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
}

runTests().catch(console.error);
