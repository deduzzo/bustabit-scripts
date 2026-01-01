/**
 * OPTIMIZE PAOLOBET v5 - FINAL TUNING
 *
 * Fine-tuning della configurazione [3, 9] con Cold=5, Resume=4x OR 12g
 * Obiettivo: trovare il miglior bilancio EV / Rischio
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
    const customMults = config.mults;
    const maxSteps = customMults.length;

    let mode1Step = 0;
    let mode1TotalLoss = 0;
    let mode2Bets = 0;
    let mode2LossToRecover = 0;

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

async function runTests() {
    let checkpoints;
    try {
        checkpoints = require('./hash-checkpoints-10M.js').HASH_CHECKPOINTS_10M;
    } catch (e) {
        checkpoints = require('./hash-checkpoints.js').HASH_CHECKPOINTS;
    }

    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
    console.log('║              OPTIMIZE PAOLOBET v5 - FINAL TUNING                          ║');
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

    // Test comprehensive di tutte le combinazioni promettenti
    const configs = [
        // Progressione [3, 9] base
        { name: '[3,9] bet=0.2% cs=5', mults: [3, 9], baseBetPercent: 0.2, minProfit: 20, maxColdStreak: 5, resumeOnMult: 4, resumeAfterGames: 12, mode2Target: 3, mode2MaxBets: 20 },
        { name: '[3,9] bet=0.25% cs=5', mults: [3, 9], baseBetPercent: 0.25, minProfit: 20, maxColdStreak: 5, resumeOnMult: 4, resumeAfterGames: 12, mode2Target: 3, mode2MaxBets: 20 },
        { name: '[3,9] bet=0.3% cs=5', mults: [3, 9], baseBetPercent: 0.3, minProfit: 20, maxColdStreak: 5, resumeOnMult: 4, resumeAfterGames: 12, mode2Target: 3, mode2MaxBets: 20 },

        // Progressione [2, 8] (più sicura)
        { name: '[2,8] bet=0.2% cs=5', mults: [2, 8], baseBetPercent: 0.2, minProfit: 20, maxColdStreak: 5, resumeOnMult: 4, resumeAfterGames: 12, mode2Target: 3, mode2MaxBets: 20 },
        { name: '[2,8] bet=0.25% cs=5', mults: [2, 8], baseBetPercent: 0.25, minProfit: 20, maxColdStreak: 5, resumeOnMult: 4, resumeAfterGames: 12, mode2Target: 3, mode2MaxBets: 20 },
        { name: '[2,8] bet=0.3% cs=5', mults: [2, 8], baseBetPercent: 0.3, minProfit: 20, maxColdStreak: 5, resumeOnMult: 4, resumeAfterGames: 12, mode2Target: 3, mode2MaxBets: 20 },

        // Progressione [2.5, 7.5] (compromesso)
        { name: '[2.5,7.5] bet=0.25% cs=5', mults: [2.5, 7.5], baseBetPercent: 0.25, minProfit: 20, maxColdStreak: 5, resumeOnMult: 4, resumeAfterGames: 12, mode2Target: 3, mode2MaxBets: 20 },

        // Progressione [2, 5, 10]
        { name: '[2,5,10] bet=0.25% cs=5', mults: [2, 5, 10], baseBetPercent: 0.25, minProfit: 20, maxColdStreak: 5, resumeOnMult: 4, resumeAfterGames: 12, mode2Target: 3, mode2MaxBets: 20 },

        // Cold streak 6 (più sicuro)
        { name: '[3,9] bet=0.25% cs=6', mults: [3, 9], baseBetPercent: 0.25, minProfit: 20, maxColdStreak: 6, resumeOnMult: 4, resumeAfterGames: 12, mode2Target: 3, mode2MaxBets: 20 },
        { name: '[3,9] bet=0.3% cs=6', mults: [3, 9], baseBetPercent: 0.3, minProfit: 20, maxColdStreak: 6, resumeOnMult: 4, resumeAfterGames: 12, mode2Target: 3, mode2MaxBets: 20 },

        // Mode2 più aggressivo
        { name: '[3,9] bet=0.25% m2=2.5x', mults: [3, 9], baseBetPercent: 0.25, minProfit: 20, maxColdStreak: 5, resumeOnMult: 4, resumeAfterGames: 12, mode2Target: 2.5, mode2MaxBets: 25 },
        { name: '[3,9] bet=0.3% m2=2.5x', mults: [3, 9], baseBetPercent: 0.3, minProfit: 20, maxColdStreak: 5, resumeOnMult: 4, resumeAfterGames: 12, mode2Target: 2.5, mode2MaxBets: 25 },
    ];

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   TEST CONFIGURAZIONI FINALI');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('   Config                        EV        BR      P5       P50     Score');
    console.log('   ─────────────────────────────────────────────────────────────────────────');

    const results = [];

    for (const cfg of configs) {
        let total = 0, bankrupts = 0;
        const profits = [];

        for (const crashes of sessions) {
            const result = simulate(crashes, cfg, BALANCE);
            total += result.profitPercent;
            profits.push(result.profitPercent);
            if (result.bankrupt) bankrupts++;
        }

        profits.sort((a, b) => a - b);
        const ev = total / SESSIONS;
        const br = (bankrupts / SESSIONS) * 100;
        const p5 = profits[Math.floor(profits.length * 0.05)];
        const p50 = profits[Math.floor(profits.length * 0.50)];
        const p95 = profits[Math.floor(profits.length * 0.95)];

        // Score: bilancia EV e rischio (penalizza P5 molto negativo e bankrupt alto)
        const score = ev - (br * 2) - (Math.abs(Math.min(0, p5 + 50)) * 0.2);

        results.push({ ...cfg, ev, br, p5, p50, p95, score });

        console.log(`   ${cfg.name.padEnd(28)} ${ev >= 0 ? '+' : ''}${ev.toFixed(2).padStart(6)}%  ${br.toFixed(1).padStart(4)}%  ${p5.toFixed(0).padStart(5)}%  ${p50.toFixed(0).padStart(5)}%  ${score.toFixed(1).padStart(6)}`);
    }

    // Ordina per score
    results.sort((a, b) => b.score - a.score);

    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   TOP 3 CONFIGURAZIONI (per Score)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    for (let i = 0; i < 3; i++) {
        const r = results[i];
        console.log(`   ${i + 1}. ${r.name}`);
        console.log(`      Mults: [${r.mults.join(', ')}]`);
        console.log(`      EV: +${r.ev.toFixed(2)}% | BR: ${r.br.toFixed(1)}% | P5: ${r.p5.toFixed(0)}% | P50: ${r.p50.toFixed(0)}%`);
        console.log(`      Score: ${r.score.toFixed(1)}`);
        console.log('');
    }

    // Ordina per EV puro
    results.sort((a, b) => b.ev - a.ev);

    console.log('   TOP 3 per EV PURO:');
    for (let i = 0; i < 3; i++) {
        const r = results[i];
        console.log(`   ${i + 1}. ${r.name} → EV: +${r.ev.toFixed(2)}% | BR: ${r.br.toFixed(1)}%`);
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════════');

    // Trova la migliore per score
    results.sort((a, b) => b.score - a.score);
    const best = results[0];

    console.log('');
    console.log('   CONFIGURAZIONE CONSIGLIATA (miglior bilancio EV/Rischio):');
    console.log('');
    console.log(`   Progressione: [${best.mults.join('x, ')}x]`);
    console.log(`   baseBetPercent: ${best.baseBetPercent}%`);
    console.log(`   minProfit: ${best.minProfit} bits`);
    console.log(`   maxColdStreak: ${best.maxColdStreak}`);
    console.log(`   resumeOnMult: ${best.resumeOnMult}x OR ${best.resumeAfterGames} games`);
    console.log(`   mode2Target: ${best.mode2Target}x`);
    console.log(`   mode2MaxBets: ${best.mode2MaxBets}`);
    console.log('');
    console.log(`   EV: +${best.ev.toFixed(2)}%`);
    console.log(`   Bankrupt: ${best.br.toFixed(1)}%`);
    console.log(`   P5/P50/P95: ${best.p5.toFixed(0)}% / ${best.p50.toFixed(0)}% / ${best.p95.toFixed(0)}%`);
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════════');

    // Salva
    const fs = require('fs');
    fs.writeFileSync('./paolobet-v5-final.json', JSON.stringify({
        recommended: best,
        allResults: results
    }, null, 2));

    console.log('');
    console.log('   Risultati salvati in paolobet-v5-final.json');
    console.log('');
}

runTests().catch(console.error);
