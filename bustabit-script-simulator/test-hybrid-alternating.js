/**
 * TEST PAOLOBET HYBRID - STRATEGIA ALTERNATA
 *
 * Testa diverse configurazioni di alternanza:
 * - Quante volte aumentare il moltiplicatore prima di aumentare la puntata
 * - Quanto allungare Mode 1 prima di passare a Mode 2
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

/**
 * Simula la strategia alternata
 *
 * @param {number[]} crashes - Array di crash values
 * @param {object} config - Configurazione
 *   - baseBetPercent: % del balance per bet base
 *   - mode1StartMult: moltiplicatore iniziale (es: 1.5)
 *   - mode1MultIncrease: incremento moltiplicatore (es: 1.0, quindi 1.5 → 2.5)
 *   - mode1BetMultiplier: moltiplicatore puntata quando aumenta (es: 2.0)
 *   - multIncreasesBeforeBet: quante volte aumentare mult prima di aumentare bet
 *   - mode1MaxAttempts: tentativi max in Mode 1
 *   - mode2Target: target Mode 2 (es: 3.1)
 *   - mode2MaxBets: max tentativi Mode 2
 */
function simulateHybrid(crashes, config) {
    const startBalance = 100000; // 1000 bits in satoshi
    let balance = startBalance;

    let mode = 1;
    let mode1Step = 0;  // Passi in Mode 1
    let mode1TotalLoss = 0;
    let mode1CurrentMult = config.mode1StartMult;
    let mode1CurrentBet = Math.floor(startBalance * config.baseBetPercent / 100 / 100) * 100;
    let mode1BaseBet = mode1CurrentBet;

    let mode2Bets = 0;
    let mode2LossToRecover = 0;

    let stats = {
        mode1Wins: 0,
        mode1WinsAfterLoss: 0,
        mode2Entries: 0,
        mode2Wins: 0,
        mode2Fails: 0,
        maxMode2Loss: 0,
        betsPlaced: 0
    };

    for (let i = 0; i < crashes.length; i++) {
        const crash = crashes[i];

        if (mode === 1) {
            // Calcola bet e target per Mode 1
            let bet = mode1CurrentBet;
            let target = mode1CurrentMult;

            if (bet > balance) {
                // Non possiamo permetterci, vai a Mode 2
                mode = 2;
                mode2LossToRecover = mode1TotalLoss;
                mode2Bets = 0;
                stats.mode2Entries++;
                i--; // Riprova questa partita in Mode 2
                continue;
            }

            stats.betsPlaced++;
            balance -= bet;

            if (crash >= target) {
                // VINTO!
                const profit = Math.floor(bet * (target - 1));
                balance += bet + profit;

                if (mode1Step > 0) stats.mode1WinsAfterLoss++;
                else stats.mode1Wins++;

                // Reset Mode 1
                mode1Step = 0;
                mode1TotalLoss = 0;
                mode1CurrentMult = config.mode1StartMult;
                mode1CurrentBet = mode1BaseBet;
            } else {
                // PERSO
                mode1TotalLoss += bet;
                mode1Step++;

                if (mode1Step >= config.mode1MaxAttempts) {
                    // Passa a Mode 2
                    mode = 2;
                    mode2LossToRecover = mode1TotalLoss;
                    mode2Bets = 0;
                    stats.mode2Entries++;

                    // Reset Mode 1 state
                    mode1Step = 0;
                    mode1TotalLoss = 0;
                    mode1CurrentMult = config.mode1StartMult;
                    mode1CurrentBet = mode1BaseBet;
                } else {
                    // Strategia alternata: aumenta mult o bet?
                    // Pattern: primi N step aumentano mult, poi alterna
                    const multIncreases = Math.min(mode1Step, config.multIncreasesBeforeBet);
                    const betIncreases = mode1Step - multIncreases;

                    // Alterna dopo i primi multIncreasesBeforeBet
                    if (mode1Step <= config.multIncreasesBeforeBet) {
                        // Aumenta moltiplicatore
                        mode1CurrentMult += config.mode1MultIncrease;
                    } else {
                        // Alterna: step dispari = mult, step pari = bet (o viceversa)
                        const stepAfterInitial = mode1Step - config.multIncreasesBeforeBet;
                        if (stepAfterInitial % 2 === 1) {
                            // Aumenta bet
                            mode1CurrentBet = Math.floor(mode1CurrentBet * config.mode1BetMultiplier / 100) * 100;
                        } else {
                            // Aumenta mult
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
                // Non possiamo recuperare, reset forzato
                stats.mode2Fails++;
                if (mode2LossToRecover > stats.maxMode2Loss) {
                    stats.maxMode2Loss = mode2LossToRecover;
                }
                mode = 1;
                mode2LossToRecover = 0;
                mode2Bets = 0;
                continue;
            }

            stats.betsPlaced++;
            balance -= requiredBet;
            mode2Bets++;

            if (crash >= target) {
                // VINTO! Recovery completo
                const profit = Math.floor(requiredBet * (target - 1));
                balance += requiredBet + profit;
                stats.mode2Wins++;

                mode = 1;
                mode2LossToRecover = 0;
                mode2Bets = 0;
            } else {
                // PERSO
                mode2LossToRecover += requiredBet;

                if (mode2Bets >= config.mode2MaxBets) {
                    // Max tentativi, reset forzato
                    stats.mode2Fails++;
                    if (mode2LossToRecover > stats.maxMode2Loss) {
                        stats.maxMode2Loss = mode2LossToRecover;
                    }
                    mode = 1;
                    mode2LossToRecover = 0;
                    mode2Bets = 0;
                }
            }
        }

        // Check bankrupt
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

async function runTests() {
    // Carica checkpoints
    let checkpoints;
    try {
        checkpoints = require('./hash-checkpoints-10M.js').HASH_CHECKPOINTS_10M;
    } catch (e) {
        checkpoints = require('./hash-checkpoints.js').HASH_CHECKPOINTS;
    }

    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
    console.log('║         TEST STRATEGIA ALTERNATA - TROVA CONFIGURAZIONE OTTIMALE         ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
    console.log('');

    const SESSIONS = 10000;
    const GAMES_PER_SESSION = 500;

    // Configurazioni da testare
    const configs = [
        // Pattern: multIncreasesBeforeBet, maxAttempts
        // Aumenta mult 1 volta, poi alterna
        { name: 'M1-ALT (max 4)', multIncreasesBeforeBet: 1, mode1MaxAttempts: 4 },
        { name: 'M1-ALT (max 5)', multIncreasesBeforeBet: 1, mode1MaxAttempts: 5 },
        { name: 'M1-ALT (max 6)', multIncreasesBeforeBet: 1, mode1MaxAttempts: 6 },

        // Aumenta mult 2 volte, poi alterna
        { name: 'M2-ALT (max 4)', multIncreasesBeforeBet: 2, mode1MaxAttempts: 4 },
        { name: 'M2-ALT (max 5)', multIncreasesBeforeBet: 2, mode1MaxAttempts: 5 },
        { name: 'M2-ALT (max 6)', multIncreasesBeforeBet: 2, mode1MaxAttempts: 6 },
        { name: 'M2-ALT (max 8)', multIncreasesBeforeBet: 2, mode1MaxAttempts: 8 },

        // Aumenta mult 3 volte, poi alterna
        { name: 'M3-ALT (max 5)', multIncreasesBeforeBet: 3, mode1MaxAttempts: 5 },
        { name: 'M3-ALT (max 6)', multIncreasesBeforeBet: 3, mode1MaxAttempts: 6 },
        { name: 'M3-ALT (max 8)', multIncreasesBeforeBet: 3, mode1MaxAttempts: 8 },

        // Solo mult (PAOLOBET originale)
        { name: 'SOLO-MULT (max 4)', multIncreasesBeforeBet: 100, mode1MaxAttempts: 4 },
        { name: 'SOLO-MULT (max 6)', multIncreasesBeforeBet: 100, mode1MaxAttempts: 6 },

        // Solo bet (Martingale classico)
        { name: 'SOLO-BET (max 4)', multIncreasesBeforeBet: 0, mode1MaxAttempts: 4 },
        { name: 'SOLO-BET (max 6)', multIncreasesBeforeBet: 0, mode1MaxAttempts: 6 },
    ];

    const baseConfig = {
        baseBetPercent: 0.3,
        mode1StartMult: 1.5,
        mode1MultIncrease: 1.0,  // 1.5 → 2.5 → 3.5 ...
        mode1BetMultiplier: 2.0, // Raddoppia la puntata
        mode2Target: 3.1,
        mode2MaxBets: 15
    };

    const results = [];

    for (const testConfig of configs) {
        const config = { ...baseConfig, ...testConfig };

        let totalProfit = 0;
        let totalMode2Entries = 0;
        let totalMode2Wins = 0;
        let totalMode2Fails = 0;
        let maxMode2Loss = 0;
        let bankrupts = 0;

        for (let s = 0; s < SESSIONS; s++) {
            const checkpointIdx = Math.floor(Math.random() * checkpoints.length);
            const skipGames = Math.floor(Math.random() * 1000);

            let hash = hexToBytes(checkpoints[checkpointIdx].hash);
            for (let i = 0; i < skipGames; i++) hash = sha256(hash);

            const crashes = generateGames(
                Array.from(hash).map(b => b.toString(16).padStart(2, '0')).join(''),
                GAMES_PER_SESSION
            );

            const result = simulateHybrid(crashes, config);
            totalProfit += result.profit;
            totalMode2Entries += result.mode2Entries;
            totalMode2Wins += result.mode2Wins;
            totalMode2Fails += result.mode2Fails;
            if (result.maxMode2Loss > maxMode2Loss) maxMode2Loss = result.maxMode2Loss;
            if (result.finalBalance < 100) bankrupts++;
        }

        const avgProfit = totalProfit / SESSIONS / 100; // in bits
        const avgProfitPercent = (totalProfit / SESSIONS / 100000) * 100;
        const mode2Rate = (totalMode2Entries / SESSIONS) * 100;
        const mode2WinRate = totalMode2Entries > 0 ? (totalMode2Wins / totalMode2Entries) * 100 : 0;
        const bankruptRate = (bankrupts / SESSIONS) * 100;

        results.push({
            name: testConfig.name,
            avgProfit,
            avgProfitPercent,
            mode2Rate,
            mode2WinRate,
            mode2Fails: totalMode2Fails,
            maxMode2Loss: maxMode2Loss / 100,
            bankruptRate
        });

        process.stdout.write(`\r   Testato: ${testConfig.name.padEnd(20)} EV: ${avgProfitPercent >= 0 ? '+' : ''}${avgProfitPercent.toFixed(3)}%`);
    }

    console.log('\n');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('                              📊 RISULTATI');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('');

    // Ordina per profitto
    results.sort((a, b) => b.avgProfitPercent - a.avgProfitPercent);

    console.log('   Config               │ EV %     │ Mode2/sess │ M2 Win% │ Max M2 Loss │ Bankrupt%');
    console.log('   ─────────────────────┼──────────┼────────────┼─────────┼─────────────┼──────────');

    for (const r of results) {
        const ev = (r.avgProfitPercent >= 0 ? '+' : '') + r.avgProfitPercent.toFixed(3) + '%';
        console.log(`   ${r.name.padEnd(20)} │ ${ev.padStart(8)} │ ${r.mode2Rate.toFixed(1).padStart(10)} │ ${r.mode2WinRate.toFixed(1).padStart(7)}% │ ${r.maxMode2Loss.toFixed(0).padStart(11)} │ ${r.bankruptRate.toFixed(2).padStart(8)}%`);
    }

    console.log('');
    console.log('   Legenda:');
    console.log('   - M1/M2/M3: aumenta moltiplicatore 1/2/3 volte prima di alternare');
    console.log('   - ALT: poi alterna tra mult e bet');
    console.log('   - SOLO-MULT: solo aumento moltiplicatore (PAOLOBET originale)');
    console.log('   - SOLO-BET: solo aumento puntata (Martingale classico)');
    console.log('');

    // Mostra progressione esempio per il migliore
    const best = results[0];
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log(`   🏆 MIGLIORE: ${best.name}`);
    console.log('═══════════════════════════════════════════════════════════════════════════════');

    // Trova la config corrispondente
    const bestConfig = configs.find(c => c.name === best.name);
    showProgression(bestConfig, baseConfig);
}

function showProgression(testConfig, baseConfig) {
    const config = { ...baseConfig, ...testConfig };

    console.log('');
    console.log('   PROGRESSIONE MODE 1:');
    console.log('   ─────────────────────────────────────────────────────────────────');

    let mult = config.mode1StartMult;
    let bet = 30; // 0.3% di 10000 bits
    let totalLoss = 0;

    for (let step = 0; step < config.mode1MaxAttempts; step++) {
        const prob = (1 / mult) * 99; // Probabilità approssimata
        const winProfit = Math.floor(bet * (mult - 1));
        const netIfWin = winProfit - totalLoss;

        console.log(`   Step ${step + 1}: ${bet} bits @ ${mult.toFixed(2)}x (prob ~${prob.toFixed(0)}%) → se vinci: +${winProfit} lordo, ${netIfWin >= 0 ? '+' : ''}${netIfWin} netto`);

        totalLoss += bet;

        if (step < config.mode1MaxAttempts - 1) {
            // Applica strategia alternata
            if (step < config.multIncreasesBeforeBet) {
                mult += config.mode1MultIncrease;
                console.log(`           ↓ aumenta MULT → ${mult.toFixed(2)}x`);
            } else {
                const stepAfterInitial = step - config.multIncreasesBeforeBet + 1;
                if (stepAfterInitial % 2 === 1) {
                    bet = Math.floor(bet * config.mode1BetMultiplier);
                    console.log(`           ↓ aumenta BET → ${bet} bits`);
                } else {
                    mult += config.mode1MultIncrease;
                    console.log(`           ↓ aumenta MULT → ${mult.toFixed(2)}x`);
                }
            }
        }
    }

    console.log('');
    console.log(`   Se perdi tutto → Mode 2 con ${totalLoss} bits da recuperare`);
    console.log('');
}

runTests().catch(console.error);
