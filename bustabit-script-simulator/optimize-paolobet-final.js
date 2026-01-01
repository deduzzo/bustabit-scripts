/**
 * OPTIMIZE PAOLOBET FINAL - Fine Tuning Completo v4.0
 *
 * Test sistematico di TUTTI i parametri per trovare la combinazione ottimale
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

function testConfig(sessions, config, balance) {
    let total = 0, bankrupts = 0;
    const profits = [];

    for (const crashes of sessions) {
        const result = simulate(crashes, config, balance);
        total += result.profitPercent;
        profits.push(result.profitPercent);
        if (result.bankrupt) bankrupts++;
    }

    profits.sort((a, b) => a - b);
    const ev = total / sessions.length;
    const br = (bankrupts / sessions.length) * 100;
    const p5 = profits[Math.floor(profits.length * 0.05)];
    const p50 = profits[Math.floor(profits.length * 0.50)];

    // Score: bilancia EV, bankrupt e P5
    const score = ev - (br * 3) - (Math.abs(Math.min(0, p5 + 50)) * 0.3);

    return { ev, br, p5, p50, score };
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
    console.log('║           OPTIMIZE PAOLOBET FINAL - FINE TUNING COMPLETO                  ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
    console.log('');

    const SESSIONS = 1000;
    const GAMES = 500;
    const BALANCE = 100000;

    console.log(`   Sessioni: ${SESSIONS} | Partite/sessione: ${GAMES}`);
    console.log('');

    // Prepara sessioni
    const sessions = [];
    for (let i = 0; i < SESSIONS; i++) {
        const checkpointIdx = Math.floor(Math.random() * checkpoints.length);
        const skipGames = Math.floor(Math.random() * 1000);
        let hash = hexToBytes(checkpoints[checkpointIdx].hash);
        for (let j = 0; j < skipGames; j++) hash = sha256(hash);
        sessions.push(generateGames(bytesToHex(hash), GAMES));
    }

    // Config base v4.0
    const baseConfig = {
        baseBetPercent: 0.2,
        step1Mult: 3.0,
        step2Mult: 9.0,
        minProfit: 20,
        mode2Target: 3.0,
        mode2MaxBets: 20,
        maxColdStreak: 5,
        resumeOnMult: 4,
        resumeAfterGames: 12
    };

    // Test baseline
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   BASELINE v4.0');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const baseline = testConfig(sessions, baseConfig, BALANCE);
    console.log(`   EV: ${baseline.ev >= 0 ? '+' : ''}${baseline.ev.toFixed(2)}% | BR: ${baseline.br.toFixed(1)}% | P5: ${baseline.p5.toFixed(0)}% | Score: ${baseline.score.toFixed(1)}`);
    console.log('');

    const allResults = { baseline };

    // ═══════════════════════════════════════════════════════════════════════════
    // FASE 1: Step 1 Multiplier
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   FASE 1: Step 1 Multiplier (attuale: 3.0x)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const step1Values = [2.0, 2.5, 3.0, 3.5, 4.0];
    let bestStep1 = 3.0, bestStep1Score = baseline.score;
    allResults.step1 = [];

    for (const v of step1Values) {
        const cfg = { ...baseConfig, step1Mult: v };
        const r = testConfig(sessions, cfg, BALANCE);
        const diff = r.ev - baseline.ev;
        const icon = r.score > baseline.score ? '✅' : (r.score > baseline.score - 1 ? '➖' : '❌');
        console.log(`   ${v.toFixed(1)}x → EV: ${r.ev >= 0 ? '+' : ''}${r.ev.toFixed(2)}% (${diff >= 0 ? '+' : ''}${diff.toFixed(2)}%) | BR: ${r.br.toFixed(1)}% ${icon}`);
        if (r.score > bestStep1Score) { bestStep1 = v; bestStep1Score = r.score; }
        allResults.step1.push({ value: v, ...r });
    }
    console.log(`   >>> Migliore: ${bestStep1.toFixed(1)}x`);
    console.log('');

    // ═══════════════════════════════════════════════════════════════════════════
    // FASE 2: Step 2 Multiplier
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   FASE 2: Step 2 Multiplier (attuale: 9.0x)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const step2Values = [6.0, 7.0, 8.0, 9.0, 10.0, 12.0];
    let bestStep2 = 9.0, bestStep2Score = bestStep1Score;
    allResults.step2 = [];

    for (const v of step2Values) {
        const cfg = { ...baseConfig, step1Mult: bestStep1, step2Mult: v };
        const r = testConfig(sessions, cfg, BALANCE);
        const diff = r.ev - baseline.ev;
        const icon = r.score > bestStep1Score ? '✅' : (r.score > bestStep1Score - 1 ? '➖' : '❌');
        console.log(`   ${v.toFixed(1)}x → EV: ${r.ev >= 0 ? '+' : ''}${r.ev.toFixed(2)}% (${diff >= 0 ? '+' : ''}${diff.toFixed(2)}%) | BR: ${r.br.toFixed(1)}% ${icon}`);
        if (r.score > bestStep2Score) { bestStep2 = v; bestStep2Score = r.score; }
        allResults.step2.push({ value: v, ...r });
    }
    console.log(`   >>> Migliore: ${bestStep2.toFixed(1)}x`);
    console.log('');

    // ═══════════════════════════════════════════════════════════════════════════
    // FASE 3: baseBetPercent
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   FASE 3: baseBetPercent (attuale: 0.2%)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const betValues = [0.15, 0.2, 0.25, 0.3, 0.35];
    let bestBet = 0.2, bestBetScore = bestStep2Score;
    allResults.baseBet = [];

    for (const v of betValues) {
        const cfg = { ...baseConfig, step1Mult: bestStep1, step2Mult: bestStep2, baseBetPercent: v };
        const r = testConfig(sessions, cfg, BALANCE);
        const diff = r.ev - baseline.ev;
        const icon = r.score > bestStep2Score ? '✅' : (r.score > bestStep2Score - 1 ? '➖' : '❌');
        console.log(`   ${v}% → EV: ${r.ev >= 0 ? '+' : ''}${r.ev.toFixed(2)}% (${diff >= 0 ? '+' : ''}${diff.toFixed(2)}%) | BR: ${r.br.toFixed(1)}% ${icon}`);
        if (r.score > bestBetScore) { bestBet = v; bestBetScore = r.score; }
        allResults.baseBet.push({ value: v, ...r });
    }
    console.log(`   >>> Migliore: ${bestBet}%`);
    console.log('');

    // ═══════════════════════════════════════════════════════════════════════════
    // FASE 4: minProfit
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   FASE 4: minProfit (attuale: 20 bits)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const profitValues = [10, 15, 20, 25, 30];
    let bestProfit = 20, bestProfitScore = bestBetScore;
    allResults.minProfit = [];

    for (const v of profitValues) {
        const cfg = { ...baseConfig, step1Mult: bestStep1, step2Mult: bestStep2, baseBetPercent: bestBet, minProfit: v };
        const r = testConfig(sessions, cfg, BALANCE);
        const diff = r.ev - baseline.ev;
        const icon = r.score > bestBetScore ? '✅' : (r.score > bestBetScore - 1 ? '➖' : '❌');
        console.log(`   ${v} bits → EV: ${r.ev >= 0 ? '+' : ''}${r.ev.toFixed(2)}% (${diff >= 0 ? '+' : ''}${diff.toFixed(2)}%) | BR: ${r.br.toFixed(1)}% ${icon}`);
        if (r.score > bestProfitScore) { bestProfit = v; bestProfitScore = r.score; }
        allResults.minProfit.push({ value: v, ...r });
    }
    console.log(`   >>> Migliore: ${bestProfit} bits`);
    console.log('');

    // ═══════════════════════════════════════════════════════════════════════════
    // FASE 5: mode2Target
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   FASE 5: mode2Target (attuale: 3.0x)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const m2TargetValues = [2.0, 2.5, 3.0, 3.5, 4.0];
    let bestM2Target = 3.0, bestM2TargetScore = bestProfitScore;
    allResults.mode2Target = [];

    for (const v of m2TargetValues) {
        const cfg = { ...baseConfig, step1Mult: bestStep1, step2Mult: bestStep2, baseBetPercent: bestBet, minProfit: bestProfit, mode2Target: v };
        const r = testConfig(sessions, cfg, BALANCE);
        const diff = r.ev - baseline.ev;
        const icon = r.score > bestProfitScore ? '✅' : (r.score > bestProfitScore - 1 ? '➖' : '❌');
        console.log(`   ${v.toFixed(1)}x → EV: ${r.ev >= 0 ? '+' : ''}${r.ev.toFixed(2)}% (${diff >= 0 ? '+' : ''}${diff.toFixed(2)}%) | BR: ${r.br.toFixed(1)}% ${icon}`);
        if (r.score > bestM2TargetScore) { bestM2Target = v; bestM2TargetScore = r.score; }
        allResults.mode2Target.push({ value: v, ...r });
    }
    console.log(`   >>> Migliore: ${bestM2Target.toFixed(1)}x`);
    console.log('');

    // ═══════════════════════════════════════════════════════════════════════════
    // FASE 6: mode2MaxBets
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   FASE 6: mode2MaxBets (attuale: 20)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const m2BetsValues = [10, 15, 20, 25, 30];
    let bestM2Bets = 20, bestM2BetsScore = bestM2TargetScore;
    allResults.mode2MaxBets = [];

    for (const v of m2BetsValues) {
        const cfg = { ...baseConfig, step1Mult: bestStep1, step2Mult: bestStep2, baseBetPercent: bestBet, minProfit: bestProfit, mode2Target: bestM2Target, mode2MaxBets: v };
        const r = testConfig(sessions, cfg, BALANCE);
        const diff = r.ev - baseline.ev;
        const icon = r.score > bestM2TargetScore ? '✅' : (r.score > bestM2TargetScore - 1 ? '➖' : '❌');
        console.log(`   ${v} → EV: ${r.ev >= 0 ? '+' : ''}${r.ev.toFixed(2)}% (${diff >= 0 ? '+' : ''}${diff.toFixed(2)}%) | BR: ${r.br.toFixed(1)}% ${icon}`);
        if (r.score > bestM2BetsScore) { bestM2Bets = v; bestM2BetsScore = r.score; }
        allResults.mode2MaxBets.push({ value: v, ...r });
    }
    console.log(`   >>> Migliore: ${bestM2Bets}`);
    console.log('');

    // ═══════════════════════════════════════════════════════════════════════════
    // FASE 7: maxColdStreak
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   FASE 7: maxColdStreak (attuale: 5)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const coldValues = [4, 5, 6, 7, 8];
    let bestCold = 5, bestColdScore = bestM2BetsScore;
    allResults.maxColdStreak = [];

    for (const v of coldValues) {
        const cfg = { ...baseConfig, step1Mult: bestStep1, step2Mult: bestStep2, baseBetPercent: bestBet, minProfit: bestProfit, mode2Target: bestM2Target, mode2MaxBets: bestM2Bets, maxColdStreak: v };
        const r = testConfig(sessions, cfg, BALANCE);
        const diff = r.ev - baseline.ev;
        const icon = r.score > bestM2BetsScore ? '✅' : (r.score > bestM2BetsScore - 1 ? '➖' : '❌');
        console.log(`   ${v} → EV: ${r.ev >= 0 ? '+' : ''}${r.ev.toFixed(2)}% (${diff >= 0 ? '+' : ''}${diff.toFixed(2)}%) | BR: ${r.br.toFixed(1)}% ${icon}`);
        if (r.score > bestColdScore) { bestCold = v; bestColdScore = r.score; }
        allResults.maxColdStreak.push({ value: v, ...r });
    }
    console.log(`   >>> Migliore: ${bestCold}`);
    console.log('');

    // ═══════════════════════════════════════════════════════════════════════════
    // FASE 8: resumeOnMult
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   FASE 8: resumeOnMult (attuale: 4x)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const resumeMultValues = [3, 4, 5, 6];
    let bestResumeMult = 4, bestResumeMultScore = bestColdScore;
    allResults.resumeOnMult = [];

    for (const v of resumeMultValues) {
        const cfg = { ...baseConfig, step1Mult: bestStep1, step2Mult: bestStep2, baseBetPercent: bestBet, minProfit: bestProfit, mode2Target: bestM2Target, mode2MaxBets: bestM2Bets, maxColdStreak: bestCold, resumeOnMult: v };
        const r = testConfig(sessions, cfg, BALANCE);
        const diff = r.ev - baseline.ev;
        const icon = r.score > bestColdScore ? '✅' : (r.score > bestColdScore - 1 ? '➖' : '❌');
        console.log(`   ${v}x → EV: ${r.ev >= 0 ? '+' : ''}${r.ev.toFixed(2)}% (${diff >= 0 ? '+' : ''}${diff.toFixed(2)}%) | BR: ${r.br.toFixed(1)}% ${icon}`);
        if (r.score > bestResumeMultScore) { bestResumeMult = v; bestResumeMultScore = r.score; }
        allResults.resumeOnMult.push({ value: v, ...r });
    }
    console.log(`   >>> Migliore: ${bestResumeMult}x`);
    console.log('');

    // ═══════════════════════════════════════════════════════════════════════════
    // FASE 9: resumeAfterGames
    // ═══════════════════════════════════════════════════════════════════════════
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   FASE 9: resumeAfterGames (attuale: 12)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const resumeGamesValues = [0, 8, 10, 12, 15, 20];
    let bestResumeGames = 12, bestResumeGamesScore = bestResumeMultScore;
    allResults.resumeAfterGames = [];

    for (const v of resumeGamesValues) {
        const cfg = { ...baseConfig, step1Mult: bestStep1, step2Mult: bestStep2, baseBetPercent: bestBet, minProfit: bestProfit, mode2Target: bestM2Target, mode2MaxBets: bestM2Bets, maxColdStreak: bestCold, resumeOnMult: bestResumeMult, resumeAfterGames: v };
        const r = testConfig(sessions, cfg, BALANCE);
        const diff = r.ev - baseline.ev;
        const icon = r.score > bestResumeMultScore ? '✅' : (r.score > bestResumeMultScore - 1 ? '➖' : '❌');
        console.log(`   ${v === 0 ? 'OFF' : v + 'g'} → EV: ${r.ev >= 0 ? '+' : ''}${r.ev.toFixed(2)}% (${diff >= 0 ? '+' : ''}${diff.toFixed(2)}%) | BR: ${r.br.toFixed(1)}% ${icon}`);
        if (r.score > bestResumeGamesScore) { bestResumeGames = v; bestResumeGamesScore = r.score; }
        allResults.resumeAfterGames.push({ value: v, ...r });
    }
    console.log(`   >>> Migliore: ${bestResumeGames === 0 ? 'OFF' : bestResumeGames + 'g'}`);
    console.log('');

    // ═══════════════════════════════════════════════════════════════════════════
    // CONFIGURAZIONE FINALE
    // ═══════════════════════════════════════════════════════════════════════════
    const finalConfig = {
        step1Mult: bestStep1,
        step2Mult: bestStep2,
        baseBetPercent: bestBet,
        minProfit: bestProfit,
        mode2Target: bestM2Target,
        mode2MaxBets: bestM2Bets,
        maxColdStreak: bestCold,
        resumeOnMult: bestResumeMult,
        resumeAfterGames: bestResumeGames
    };

    const finalResult = testConfig(sessions, finalConfig, BALANCE);

    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('                    CONFIGURAZIONE FINALE OTTIMIZZATA');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('');
    console.log('   MODO 1 (Progressione):');
    console.log(`      step1Mult:      ${finalConfig.step1Mult.toFixed(1)}x`);
    console.log(`      step2Mult:      ${finalConfig.step2Mult.toFixed(1)}x`);
    console.log('');
    console.log('   PARAMETRI:');
    console.log(`      baseBetPercent: ${finalConfig.baseBetPercent}%`);
    console.log(`      minProfit:      ${finalConfig.minProfit} bits`);
    console.log('');
    console.log('   MODO 2 (Recovery):');
    console.log(`      mode2Target:    ${finalConfig.mode2Target.toFixed(1)}x`);
    console.log(`      mode2MaxBets:   ${finalConfig.mode2MaxBets}`);
    console.log('');
    console.log('   PROTEZIONE:');
    console.log(`      maxColdStreak:  ${finalConfig.maxColdStreak}`);
    console.log(`      resumeOnMult:   ${finalConfig.resumeOnMult}x`);
    console.log(`      resumeAfterGames: ${finalConfig.resumeAfterGames === 0 ? 'OFF' : finalConfig.resumeAfterGames}`);
    console.log('');
    console.log('   PERFORMANCE:');
    console.log(`      EV:        ${finalResult.ev >= 0 ? '+' : ''}${finalResult.ev.toFixed(2)}%`);
    console.log(`      Bankrupt:  ${finalResult.br.toFixed(1)}%`);
    console.log(`      P5/P50:    ${finalResult.p5.toFixed(0)}% / ${finalResult.p50.toFixed(0)}%`);
    console.log(`      Score:     ${finalResult.score.toFixed(1)}`);
    console.log('');

    // Confronto con baseline
    const evDiff = finalResult.ev - baseline.ev;
    const brDiff = finalResult.br - baseline.br;
    console.log('   CONFRONTO CON BASELINE:');
    console.log(`      EV:       ${evDiff >= 0 ? '+' : ''}${evDiff.toFixed(2)}%`);
    console.log(`      Bankrupt: ${brDiff >= 0 ? '+' : ''}${brDiff.toFixed(1)}%`);
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════════');

    // Salva risultati
    const fs = require('fs');
    fs.writeFileSync('./paolobet-final-optimal.json', JSON.stringify({
        baseline: { config: baseConfig, result: baseline },
        optimal: { config: finalConfig, result: finalResult },
        allResults
    }, null, 2));

    console.log('');
    console.log('   Risultati salvati in paolobet-final-optimal.json');
    console.log('');
}

runTests().catch(console.error);
