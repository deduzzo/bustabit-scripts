/**
 * TEST PAOLOBET HYBRID v2.0
 * Strategia Alternata + Recovery
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

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
 * Simula PAOLOBET HYBRID v2.0
 */
function simulateHybridV2(crashes, config, startBalance) {
    let balance = startBalance;
    let mode = 1;

    // Mode 1 state
    let mode1Step = 0;
    let mode1TotalLoss = 0;
    let mode1CurrentMult = config.mode1StartMult;
    let mode1CurrentBet = Math.floor(startBalance * config.baseBetPercent / 100 / 100) * 100;
    const mode1BaseBet = mode1CurrentBet;

    // Mode 2 state
    let mode2Bets = 0;
    let mode2LossToRecover = 0;

    let stats = {
        mode1Wins: 0,
        mode1WinsAfterLoss: 0,
        mode2Entries: 0,
        mode2Wins: 0,
        mode2Fails: 0,
        betsPlaced: 0,
        maxDrawdown: 0
    };

    let peakBalance = startBalance;

    for (let i = 0; i < crashes.length; i++) {
        const crash = crashes[i];

        if (mode === 1) {
            let bet = Math.floor(mode1CurrentBet / 100) * 100;
            if (bet < 100) bet = 100;

            if (bet > balance) {
                mode = 2;
                mode2LossToRecover = mode1TotalLoss;
                mode2Bets = 0;
                stats.mode2Entries++;
                mode1Step = 0;
                mode1TotalLoss = 0;
                mode1CurrentMult = config.mode1StartMult;
                mode1CurrentBet = mode1BaseBet;
                i--;
                continue;
            }

            stats.betsPlaced++;
            balance -= bet;

            if (crash >= mode1CurrentMult) {
                // WIN
                const profit = Math.floor(bet * (mode1CurrentMult - 1));
                balance += bet + profit;

                if (mode1Step > 0) stats.mode1WinsAfterLoss++;
                else stats.mode1Wins++;

                mode1Step = 0;
                mode1TotalLoss = 0;
                mode1CurrentMult = config.mode1StartMult;
                mode1CurrentBet = mode1BaseBet;
            } else {
                // LOSS
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
                    if (mode1Step <= config.multIncreasesFirst) {
                        mode1CurrentMult += config.mode1MultIncrease;
                    } else {
                        const stepAfterInitial = mode1Step - config.multIncreasesFirst;
                        if (stepAfterInitial % 2 === 1) {
                            mode1CurrentBet = Math.floor(mode1CurrentBet * config.mode1BetMultiplier / 100) * 100;
                        } else {
                            mode1CurrentMult += config.mode1MultIncrease;
                        }
                    }
                }
            }
        } else {
            // Mode 2: Recovery
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

            stats.betsPlaced++;
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

        // Bankrupt check
        if (balance < mode1BaseBet) {
            break;
        }
    }

    return {
        finalBalance: balance,
        profit: balance - startBalance,
        profitPercent: ((balance - startBalance) / startBalance) * 100,
        ...stats
    };
}

async function test() {
    let checkpoints;
    try {
        checkpoints = require('./hash-checkpoints-10M.js').HASH_CHECKPOINTS_10M;
    } catch (e) {
        checkpoints = require('./hash-checkpoints.js').HASH_CHECKPOINTS;
    }

    const NUM_SESSIONS = 50000;
    const GAMES_PER_SESSION = 500;
    const START_BALANCE = 100000;

    // Config v2.0
    const config = {
        baseBetPercent: 0.3,
        mode1StartMult: 2.0,
        mode1MultIncrease: 0.5,
        mode1BetMultiplier: 1.5,
        mode1MaxAttempts: 3,
        multIncreasesFirst: 1,
        mode2Target: 3.0,
        mode2MaxBets: 15
    };

    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
    console.log('║              TEST PAOLOBET HYBRID v2.0 - STRATEGIA ALTERNATA             ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`   Sessioni: ${NUM_SESSIONS} | Partite/sessione: ${GAMES_PER_SESSION}`);
    console.log('');
    console.log('   MODO 1 (Alternata):');
    console.log(`   - Start: ${config.mode1StartMult}x | +Mult: ${config.mode1MultIncrease} | xBet: ${config.mode1BetMultiplier}`);
    console.log(`   - Max tentativi: ${config.mode1MaxAttempts}`);
    console.log('');
    console.log('   MODO 2 (Recovery):');
    console.log(`   - Target: ${config.mode2Target}x | Max bets: ${config.mode2MaxBets}`);
    console.log('');
    console.log('   Progressione Mode 1:');
    console.log('   Step 1: 30 bits @ 2.00x (50%)');
    console.log('   Step 2: 30 bits @ 2.50x (40%) ← +MULT');
    console.log('   Step 3: 45 bits @ 2.50x (40%) ← xBET');
    console.log('   → Mode 2 con 105 bits da recuperare');
    console.log('');

    let totalProfit = 0;
    let totalMode1Wins = 0;
    let totalMode1WinsAfterLoss = 0;
    let totalMode2Entries = 0;
    let totalMode2Wins = 0;
    let totalMode2Fails = 0;
    let bankrupts = 0;
    let targets = 0;
    const profits = [];
    const drawdowns = [];

    const startTime = Date.now();

    for (let i = 0; i < NUM_SESSIONS; i++) {
        const checkpointIdx = Math.floor(Math.random() * checkpoints.length);
        const skipGames = Math.floor(Math.random() * 1000);

        let hash = hexToBytes(checkpoints[checkpointIdx].hash);
        for (let j = 0; j < skipGames; j++) hash = sha256(hash);

        const crashes = generateGames(bytesToHex(hash), GAMES_PER_SESSION);
        const result = simulateHybridV2(crashes, config, START_BALANCE);

        totalProfit += result.profit;
        profits.push(result.profitPercent);
        drawdowns.push(result.maxDrawdown);

        totalMode1Wins += result.mode1Wins;
        totalMode1WinsAfterLoss += result.mode1WinsAfterLoss;
        totalMode2Entries += result.mode2Entries;
        totalMode2Wins += result.mode2Wins;
        totalMode2Fails += result.mode2Fails;

        if (result.finalBalance < 1000) bankrupts++;
        if (result.profitPercent >= 20) targets++;

        if ((i + 1) % 2500 === 0) {
            const ev = (totalProfit / (i + 1) / START_BALANCE) * 100;
            const pct = ((i + 1) / NUM_SESSIONS * 100).toFixed(1);
            process.stdout.write(`\r   [${pct}%] ${i + 1}/${NUM_SESSIONS} - EV: ${ev >= 0 ? '+' : ''}${ev.toFixed(3)}%`);
        }
    }

    const elapsed = (Date.now() - startTime) / 1000;

    console.log(`\r   COMPLETATO in ${elapsed.toFixed(1)}s                              `);
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('                              📊 RISULTATI');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('');

    const avgProfitPercent = (totalProfit / NUM_SESSIONS / START_BALANCE) * 100;
    const targetRate = (targets / NUM_SESSIONS) * 100;
    const bankruptRate = (bankrupts / NUM_SESSIONS) * 100;
    const mode2Rate = totalMode2Entries / NUM_SESSIONS;
    const mode2WinRate = totalMode2Entries > 0 ? (totalMode2Wins / totalMode2Entries) * 100 : 0;

    const icon = avgProfitPercent >= 0 ? '✅' : '❌';

    console.log('   EV:');
    console.log('   ─────────────────────────────────────────────────────────────────');
    console.log(`   📈 PROFITTO MEDIO: ${avgProfitPercent >= 0 ? '+' : ''}${avgProfitPercent.toFixed(4)}% ${icon}`);
    console.log(`   📊 Per sessione:   ${(totalProfit / NUM_SESSIONS / 100).toFixed(2)} bits`);
    console.log('');

    console.log('   ESITI:');
    console.log('   ─────────────────────────────────────────────────────────────────');
    console.log(`   🎯 TARGET (+20%): ${targets}/${NUM_SESSIONS} (${targetRate.toFixed(2)}%)`);
    console.log(`   💀 BANKRUPT:      ${bankrupts}/${NUM_SESSIONS} (${bankruptRate.toFixed(2)}%)`);
    console.log('');

    console.log('   MODE 1:');
    console.log('   ─────────────────────────────────────────────────────────────────');
    console.log(`   ✅ Vittorie dirette:   ${totalMode1Wins} (${(totalMode1Wins/NUM_SESSIONS).toFixed(1)}/sess)`);
    console.log(`   🎉 Recovery in Mode1:  ${totalMode1WinsAfterLoss} (${(totalMode1WinsAfterLoss/NUM_SESSIONS).toFixed(1)}/sess)`);
    console.log('');

    console.log('   MODE 2:');
    console.log('   ─────────────────────────────────────────────────────────────────');
    console.log(`   📥 Entrate in Mode2:   ${totalMode2Entries} (${mode2Rate.toFixed(1)}/sess)`);
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

test().catch(console.error);
