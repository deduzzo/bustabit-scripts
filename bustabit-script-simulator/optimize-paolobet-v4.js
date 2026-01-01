/**
 * OPTIMIZE PAOLOBET v4 - Combinazione Idee Vincenti
 *
 * Test combinazioni:
 * - Idea 1: Salti Grandi [2, 4, 8] + varianti
 * - Idea 3: 3x OR N games
 * - Combinazioni delle due
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

// ═══════════════════════════════════════════════════════════════════════════════
// SIMULATORE COMBINATO
// ═══════════════════════════════════════════════════════════════════════════════

function simulate(crashes, config, startBalance) {
    let balance = startBalance;
    let mode = 1;
    const baseBet = Math.floor(startBalance * config.baseBetPercent / 100);
    const minProfit = config.minProfit;
    const customMults = config.mults;
    const maxSteps = customMults.length;

    let mode1Step = 0;
    let mode1TotalLoss = 0;
    let mode2Bets = 0;
    let mode2LossToRecover = 0;

    // Cold streak + Multi-Resume
    let coldStreakCount = 0;
    let suspended = false;
    let suspendedGames = 0;

    function getMode1Mult(step) {
        return customMults[Math.min(step, maxSteps - 1)];
    }

    function getMode1Bet(step) {
        if (step === 0) return baseBet;
        const mult = getMode1Mult(step);
        return Math.max(Math.ceil((mode1TotalLoss + minProfit) / (mult - 1)), baseBet);
    }

    for (let i = 0; i < crashes.length; i++) {
        const crash = crashes[i];

        // Cold streak check
        if (crash >= 3) coldStreakCount = 0;
        else coldStreakCount++;

        if (coldStreakCount >= config.maxColdStreak) {
            suspended = true;
            suspendedGames = 0;
        }

        if (suspended) {
            suspendedGames++;
            // Multi-condizione resume
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

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN TEST RUNNER
// ═══════════════════════════════════════════════════════════════════════════════

async function runTests() {
    let checkpoints;
    try {
        checkpoints = require('./hash-checkpoints-10M.js').HASH_CHECKPOINTS_10M;
    } catch (e) {
        checkpoints = require('./hash-checkpoints.js').HASH_CHECKPOINTS;
    }

    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
    console.log('║              OPTIMIZE PAOLOBET v4 - COMBINAZIONE VINCENTI                 ║');
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

    const allResults = [];

    // ═══════════════════════════════════════════════════════════════════════════
    // FASE 1: Varianti "Salti Grandi"
    // ═══════════════════════════════════════════════════════════════════════════

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   FASE 1: Varianti Progressione "Salti Grandi"');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const baseConfig = {
        baseBetPercent: 0.2,
        minProfit: 20,
        mode2Target: 3.0,
        mode2MaxBets: 20,
        maxColdStreak: 8,
        resumeOnMult: 5,
        resumeAfterGames: 0
    };

    const progressions = [
        // Originale vincitore
        { name: '[2, 4, 8]', mults: [2, 4, 8] },

        // Varianti 3 step
        { name: '[2, 5, 10]', mults: [2, 5, 10] },
        { name: '[2, 4, 10]', mults: [2, 4, 10] },
        { name: '[2, 5, 8]', mults: [2, 5, 8] },
        { name: '[1.5, 4, 8]', mults: [1.5, 4, 8] },
        { name: '[2.5, 5, 10]', mults: [2.5, 5, 10] },

        // Varianti 4 step
        { name: '[2, 3, 5, 8]', mults: [2, 3, 5, 8] },
        { name: '[2, 4, 6, 10]', mults: [2, 4, 6, 10] },
        { name: '[2, 3, 6, 12]', mults: [2, 3, 6, 12] },

        // Varianti 2 step (ultra semplice)
        { name: '[2, 8]', mults: [2, 8] },
        { name: '[2, 10]', mults: [2, 10] },
        { name: '[3, 9]', mults: [3, 9] },
    ];

    let bestProg = null;
    let bestProgEV = -Infinity;

    for (const prog of progressions) {
        const config = { ...baseConfig, mults: prog.mults };
        let total = 0, bankrupts = 0;

        for (const crashes of sessions) {
            const result = simulate(crashes, config, BALANCE);
            total += result.profitPercent;
            if (result.bankrupt) bankrupts++;
        }

        const ev = total / SESSIONS;
        const br = (bankrupts / SESSIONS) * 100;

        if (ev > bestProgEV) {
            bestProgEV = ev;
            bestProg = prog;
        }

        const icon = ev > 12 ? '✅' : (ev > 10 ? '➖' : '❌');
        console.log(`   ${prog.name.padEnd(18)} EV: ${ev >= 0 ? '+' : ''}${ev.toFixed(4)}% | BR: ${br.toFixed(1)}% ${icon}`);

        allResults.push({
            phase: 'progressions',
            name: prog.name,
            mults: prog.mults,
            ev,
            bankruptRate: br
        });
    }

    console.log('');
    console.log(`   >>> Migliore: ${bestProg.name} con EV ${bestProgEV >= 0 ? '+' : ''}${bestProgEV.toFixed(4)}%`);
    console.log('');

    // ═══════════════════════════════════════════════════════════════════════════
    // FASE 2: Combinazione con Multi-Resume
    // ═══════════════════════════════════════════════════════════════════════════

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   FASE 2: Combinazione ${bestProg.name} + Multi-Resume`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const resumeConfigs = [
        { name: '5x ONLY', resumeOnMult: 5, resumeAfterGames: 0 },
        { name: '3x ONLY', resumeOnMult: 3, resumeAfterGames: 0 },
        { name: '5x OR 10g', resumeOnMult: 5, resumeAfterGames: 10 },
        { name: '5x OR 15g', resumeOnMult: 5, resumeAfterGames: 15 },
        { name: '3x OR 10g', resumeOnMult: 3, resumeAfterGames: 10 },
        { name: '3x OR 15g', resumeOnMult: 3, resumeAfterGames: 15 },
        { name: '4x OR 12g', resumeOnMult: 4, resumeAfterGames: 12 },
    ];

    let bestResume = null;
    let bestResumeEV = -Infinity;

    for (const rc of resumeConfigs) {
        const config = {
            ...baseConfig,
            mults: bestProg.mults,
            resumeOnMult: rc.resumeOnMult,
            resumeAfterGames: rc.resumeAfterGames
        };

        let total = 0, bankrupts = 0;
        for (const crashes of sessions) {
            const result = simulate(crashes, config, BALANCE);
            total += result.profitPercent;
            if (result.bankrupt) bankrupts++;
        }

        const ev = total / SESSIONS;
        const br = (bankrupts / SESSIONS) * 100;

        if (ev > bestResumeEV) {
            bestResumeEV = ev;
            bestResume = rc;
        }

        const diff = ev - bestProgEV;
        const icon = diff > 0 ? '✅' : (diff > -0.5 ? '➖' : '❌');
        console.log(`   ${rc.name.padEnd(12)} EV: ${ev >= 0 ? '+' : ''}${ev.toFixed(4)}% (${diff >= 0 ? '+' : ''}${diff.toFixed(2)}%) | BR: ${br.toFixed(1)}% ${icon}`);

        allResults.push({
            phase: 'resume',
            name: rc.name,
            ...rc,
            mults: bestProg.mults,
            ev,
            bankruptRate: br
        });
    }

    console.log('');
    console.log(`   >>> Migliore Resume: ${bestResume.name} con EV ${bestResumeEV >= 0 ? '+' : ''}${bestResumeEV.toFixed(4)}%`);
    console.log('');

    // ═══════════════════════════════════════════════════════════════════════════
    // FASE 3: Fine-tuning Cold Streak
    // ═══════════════════════════════════════════════════════════════════════════

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   FASE 3: Fine-tuning Cold Streak');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const coldStreakValues = [5, 6, 7, 8, 9, 10, 12, 15];
    let bestColdStreak = 8;
    let bestColdEV = bestResumeEV;

    for (const cs of coldStreakValues) {
        const config = {
            ...baseConfig,
            mults: bestProg.mults,
            resumeOnMult: bestResume.resumeOnMult,
            resumeAfterGames: bestResume.resumeAfterGames,
            maxColdStreak: cs
        };

        let total = 0, bankrupts = 0;
        for (const crashes of sessions) {
            const result = simulate(crashes, config, BALANCE);
            total += result.profitPercent;
            if (result.bankrupt) bankrupts++;
        }

        const ev = total / SESSIONS;
        const br = (bankrupts / SESSIONS) * 100;

        if (ev > bestColdEV) {
            bestColdEV = ev;
            bestColdStreak = cs;
        }

        const diff = ev - bestResumeEV;
        const icon = diff > 0 ? '✅' : (diff > -0.5 ? '➖' : '❌');
        console.log(`   ColdStreak=${cs.toString().padEnd(3)} EV: ${ev >= 0 ? '+' : ''}${ev.toFixed(4)}% (${diff >= 0 ? '+' : ''}${diff.toFixed(2)}%) | BR: ${br.toFixed(1)}% ${icon}`);

        allResults.push({
            phase: 'coldStreak',
            maxColdStreak: cs,
            ev,
            bankruptRate: br
        });
    }

    console.log('');
    console.log(`   >>> Migliore Cold Streak: ${bestColdStreak} con EV ${bestColdEV >= 0 ? '+' : ''}${bestColdEV.toFixed(4)}%`);
    console.log('');

    // ═══════════════════════════════════════════════════════════════════════════
    // FASE 4: Fine-tuning baseBetPercent e minProfit
    // ═══════════════════════════════════════════════════════════════════════════

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   FASE 4: Fine-tuning baseBetPercent e minProfit');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const betConfigs = [
        { baseBetPercent: 0.15, minProfit: 15 },
        { baseBetPercent: 0.15, minProfit: 20 },
        { baseBetPercent: 0.2, minProfit: 15 },
        { baseBetPercent: 0.2, minProfit: 20 },
        { baseBetPercent: 0.2, minProfit: 25 },
        { baseBetPercent: 0.25, minProfit: 20 },
        { baseBetPercent: 0.25, minProfit: 25 },
        { baseBetPercent: 0.3, minProfit: 20 },
    ];

    let bestBetConfig = { baseBetPercent: 0.2, minProfit: 20 };
    let bestBetEV = bestColdEV;

    for (const bc of betConfigs) {
        const config = {
            mults: bestProg.mults,
            resumeOnMult: bestResume.resumeOnMult,
            resumeAfterGames: bestResume.resumeAfterGames,
            maxColdStreak: bestColdStreak,
            mode2Target: 3.0,
            mode2MaxBets: 20,
            ...bc
        };

        let total = 0, bankrupts = 0;
        for (const crashes of sessions) {
            const result = simulate(crashes, config, BALANCE);
            total += result.profitPercent;
            if (result.bankrupt) bankrupts++;
        }

        const ev = total / SESSIONS;
        const br = (bankrupts / SESSIONS) * 100;

        if (ev > bestBetEV) {
            bestBetEV = ev;
            bestBetConfig = bc;
        }

        const diff = ev - bestColdEV;
        const icon = diff > 0 ? '✅' : (diff > -0.5 ? '➖' : '❌');
        console.log(`   bet=${bc.baseBetPercent}% profit=${bc.minProfit} EV: ${ev >= 0 ? '+' : ''}${ev.toFixed(4)}% (${diff >= 0 ? '+' : ''}${diff.toFixed(2)}%) | BR: ${br.toFixed(1)}% ${icon}`);

        allResults.push({
            phase: 'betConfig',
            ...bc,
            ev,
            bankruptRate: br
        });
    }

    console.log('');

    // ═══════════════════════════════════════════════════════════════════════════
    // CONFIGURAZIONE FINALE OTTIMALE
    // ═══════════════════════════════════════════════════════════════════════════

    const finalConfig = {
        mults: bestProg.mults,
        baseBetPercent: bestBetConfig.baseBetPercent,
        minProfit: bestBetConfig.minProfit,
        mode2Target: 3.0,
        mode2MaxBets: 20,
        maxColdStreak: bestColdStreak,
        resumeOnMult: bestResume.resumeOnMult,
        resumeAfterGames: bestResume.resumeAfterGames
    };

    // Test finale con più sessioni
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   VALIDAZIONE FINALE (test esteso)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    let totalFinal = 0, bankruptsFinal = 0;
    const profits = [];

    for (const crashes of sessions) {
        const result = simulate(crashes, finalConfig, BALANCE);
        totalFinal += result.profitPercent;
        profits.push(result.profitPercent);
        if (result.bankrupt) bankruptsFinal++;
    }

    profits.sort((a, b) => a - b);
    const evFinal = totalFinal / SESSIONS;
    const brFinal = (bankruptsFinal / SESSIONS) * 100;
    const p5 = profits[Math.floor(profits.length * 0.05)];
    const p50 = profits[Math.floor(profits.length * 0.50)];
    const p95 = profits[Math.floor(profits.length * 0.95)];

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('                         CONFIGURAZIONE OTTIMALE v4.0');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('');
    console.log('   PROGRESSIONE:');
    console.log(`      Moltiplicatori: ${finalConfig.mults.join('x → ')}x`);
    console.log('');
    console.log('   PARAMETRI:');
    console.log(`      baseBetPercent: ${finalConfig.baseBetPercent}%`);
    console.log(`      minProfit:      ${finalConfig.minProfit} bits`);
    console.log(`      mode2Target:    ${finalConfig.mode2Target}x`);
    console.log(`      mode2MaxBets:   ${finalConfig.mode2MaxBets}`);
    console.log('');
    console.log('   PROTEZIONE:');
    console.log(`      maxColdStreak:  ${finalConfig.maxColdStreak}`);
    console.log(`      resumeOnMult:   ${finalConfig.resumeOnMult}x`);
    console.log(`      resumeAfterGames: ${finalConfig.resumeAfterGames || 'OFF'}`);
    console.log('');
    console.log('   PERFORMANCE:');
    console.log(`      EV:        ${evFinal >= 0 ? '+' : ''}${evFinal.toFixed(4)}%`);
    console.log(`      Bankrupt:  ${brFinal.toFixed(1)}%`);
    console.log(`      P5/P50/P95: ${p5.toFixed(1)}% / ${p50.toFixed(1)}% / ${p95.toFixed(1)}%`);
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════════');

    // Salva risultati
    const fs = require('fs');
    fs.writeFileSync('./paolobet-v4-optimal.json', JSON.stringify({
        config: finalConfig,
        performance: {
            ev: evFinal,
            bankruptRate: brFinal,
            percentiles: { p5, p50, p95 }
        },
        allResults
    }, null, 2));

    console.log('');
    console.log('   Risultati salvati in paolobet-v4-optimal.json');
    console.log('');
}

runTests().catch(console.error);
