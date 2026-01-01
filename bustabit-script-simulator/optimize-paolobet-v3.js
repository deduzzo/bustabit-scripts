/**
 * OPTIMIZE PAOLOBET v3 - Test delle 5 Idee Smart
 *
 * 1. Progressione Non-Lineare (custom multipliers per step)
 * 2. Bet Sizing Dinamico (adatta bet in base a profitto)
 * 3. Resume Multi-Condizione (mult OR after N games)
 * 4. Mode 2 Adattivo (target varia in base a perdita)
 * 5. Profit Lock (riduci bet quando in profitto alto)
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
// BASELINE v3.3 (per confronto)
// ═══════════════════════════════════════════════════════════════════════════════

const BASELINE_CONFIG = {
    baseBetPercent: 0.2,
    startMult: 2.0,
    multIncrease: 1.2,
    maxSteps: 6,
    minProfit: 20,
    mode2Target: 3.0,
    mode2MaxBets: 20,
    maxColdStreak: 8,
    resumeAt: 5
};

function simulateBaseline(crashes, config, startBalance) {
    let balance = startBalance;
    let mode = 1;
    const baseBet = Math.floor(startBalance * config.baseBetPercent / 100);
    const minProfit = config.minProfit;

    let mode1Step = 0;
    let mode1TotalLoss = 0;
    let mode2Bets = 0;
    let mode2LossToRecover = 0;

    // Cold streak
    let coldStreakCount = 0;
    let suspended = false;

    function getMode1Mult(step) {
        return config.startMult + (step * config.multIncrease);
    }

    function getMode1Bet(step) {
        if (step === 0) return baseBet;
        const mult = getMode1Mult(step);
        const profitMult = mult - 1;
        return Math.max(Math.ceil((mode1TotalLoss + minProfit) / profitMult), baseBet);
    }

    for (let i = 0; i < crashes.length; i++) {
        const crash = crashes[i];

        // Cold streak check
        if (crash >= 3) coldStreakCount = 0;
        else coldStreakCount++;

        if (coldStreakCount >= config.maxColdStreak) {
            suspended = true;
        }
        if (suspended) {
            if (crash >= config.resumeAt) {
                suspended = false;
                coldStreakCount = 0;
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
                if (mode1Step >= config.maxSteps) {
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
// IDEA 1: Progressione Non-Lineare
// ═══════════════════════════════════════════════════════════════════════════════

function simulateNonLinear(crashes, config, startBalance, customMults) {
    let balance = startBalance;
    let mode = 1;
    const baseBet = Math.floor(startBalance * config.baseBetPercent / 100);
    const minProfit = config.minProfit;

    let mode1Step = 0;
    let mode1TotalLoss = 0;
    let mode2Bets = 0;
    let mode2LossToRecover = 0;

    let coldStreakCount = 0;
    let suspended = false;

    const maxSteps = customMults.length;

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

        if (coldStreakCount >= config.maxColdStreak) suspended = true;
        if (suspended) {
            if (crash >= config.resumeAt) {
                suspended = false;
                coldStreakCount = 0;
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
// IDEA 2: Bet Sizing Dinamico
// ═══════════════════════════════════════════════════════════════════════════════

function simulateDynamicBet(crashes, config, startBalance, dynamicConfig) {
    let balance = startBalance;
    let mode = 1;
    const minProfit = config.minProfit;
    const minBaseBet = Math.floor(startBalance * 0.1 / 100); // Minimum check

    let mode1Step = 0;
    let mode1TotalLoss = 0;
    let mode2Bets = 0;
    let mode2LossToRecover = 0;

    let coldStreakCount = 0;
    let suspended = false;

    // Dynamic: baseBetPercent varia in base al profitto
    function getBaseBet() {
        const profitPercent = ((balance - startBalance) / startBalance) * 100;

        if (profitPercent >= dynamicConfig.boostThreshold) {
            // In forte profitto: riduce bet per proteggere
            return Math.floor(startBalance * dynamicConfig.reducedBetPercent / 100);
        } else if (profitPercent <= dynamicConfig.aggressiveThreshold) {
            // In perdita o basso profitto: più aggressivo
            return Math.floor(startBalance * dynamicConfig.aggressiveBetPercent / 100);
        }
        return Math.floor(startBalance * config.baseBetPercent / 100);
    }

    function getMode1Mult(step) {
        return config.startMult + (step * config.multIncrease);
    }

    function getMode1Bet(step) {
        const baseBet = getBaseBet();
        if (step === 0) return baseBet;
        const mult = getMode1Mult(step);
        return Math.max(Math.ceil((mode1TotalLoss + minProfit) / (mult - 1)), baseBet);
    }

    for (let i = 0; i < crashes.length; i++) {
        const crash = crashes[i];
        const baseBet = getBaseBet();

        if (crash >= 3) coldStreakCount = 0;
        else coldStreakCount++;

        if (coldStreakCount >= config.maxColdStreak) suspended = true;
        if (suspended) {
            if (crash >= config.resumeAt) {
                suspended = false;
                coldStreakCount = 0;
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
                if (mode1Step >= config.maxSteps) {
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

        if (balance < minBaseBet) break;
    }

    return {
        profit: balance - startBalance,
        profitPercent: ((balance - startBalance) / startBalance) * 100,
        bankrupt: balance < minBaseBet
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// IDEA 3: Resume Multi-Condizione
// ═══════════════════════════════════════════════════════════════════════════════

function simulateMultiResume(crashes, config, startBalance, resumeConfig) {
    let balance = startBalance;
    let mode = 1;
    const baseBet = Math.floor(startBalance * config.baseBetPercent / 100);
    const minProfit = config.minProfit;

    let mode1Step = 0;
    let mode1TotalLoss = 0;
    let mode2Bets = 0;
    let mode2LossToRecover = 0;

    let coldStreakCount = 0;
    let suspended = false;
    let suspendedGames = 0;

    function getMode1Mult(step) {
        return config.startMult + (step * config.multIncrease);
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
            // Resume se: mult >= resumeAt OPPURE dopo N games
            const resumeByMult = crash >= resumeConfig.resumeOnMult;
            const resumeByGames = suspendedGames >= resumeConfig.resumeAfterGames;

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
                if (mode1Step >= config.maxSteps) {
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
// IDEA 4: Mode 2 Adattivo
// ═══════════════════════════════════════════════════════════════════════════════

function simulateAdaptiveMode2(crashes, config, startBalance, adaptiveConfig) {
    let balance = startBalance;
    let mode = 1;
    const baseBet = Math.floor(startBalance * config.baseBetPercent / 100);
    const minProfit = config.minProfit;
    const minBaseBet = baseBet;

    let mode1Step = 0;
    let mode1TotalLoss = 0;
    let mode2Bets = 0;
    let mode2LossToRecover = 0;

    let coldStreakCount = 0;
    let suspended = false;

    function getMode1Mult(step) {
        return config.startMult + (step * config.multIncrease);
    }

    function getMode1Bet(step) {
        if (step === 0) return baseBet;
        const mult = getMode1Mult(step);
        return Math.max(Math.ceil((mode1TotalLoss + minProfit) / (mult - 1)), baseBet);
    }

    // Target adattivo in base alla perdita da recuperare
    function getMode2Target(lossToRecover) {
        const lossPercent = (lossToRecover / startBalance) * 100;

        if (lossPercent < adaptiveConfig.lowLossThreshold) {
            return adaptiveConfig.highTarget; // Perdita bassa → target alto
        } else if (lossPercent > adaptiveConfig.highLossThreshold) {
            return adaptiveConfig.lowTarget; // Perdita alta → target basso (più prob)
        }
        return config.mode2Target; // Default
    }

    for (let i = 0; i < crashes.length; i++) {
        const crash = crashes[i];

        if (crash >= 3) coldStreakCount = 0;
        else coldStreakCount++;

        if (coldStreakCount >= config.maxColdStreak) suspended = true;
        if (suspended) {
            if (crash >= config.resumeAt) {
                suspended = false;
                coldStreakCount = 0;
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
                if (mode1Step >= config.maxSteps) {
                    mode = 2;
                    mode2LossToRecover = mode1TotalLoss;
                    mode2Bets = 0;
                    mode1Step = 0;
                    mode1TotalLoss = 0;
                }
            }
        } else {
            const target = getMode2Target(mode2LossToRecover);
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
// IDEA 5: Profit Lock
// ═══════════════════════════════════════════════════════════════════════════════

function simulateProfitLock(crashes, config, startBalance, lockConfig) {
    let balance = startBalance;
    let mode = 1;
    const minProfit = config.minProfit;
    const minBaseBet = Math.floor(startBalance * 0.1 / 100); // Minimum check
    let profitLocked = false;

    let mode1Step = 0;
    let mode1TotalLoss = 0;
    let mode2Bets = 0;
    let mode2LossToRecover = 0;

    let coldStreakCount = 0;
    let suspended = false;

    function getBaseBet() {
        const profitPercent = ((balance - startBalance) / startBalance) * 100;

        if (profitPercent >= lockConfig.lockThreshold) {
            profitLocked = true;
        }

        if (profitLocked) {
            // Se locked, usa bet ridotto
            return Math.floor(startBalance * lockConfig.lockedBetPercent / 100);
        }
        return Math.floor(startBalance * config.baseBetPercent / 100);
    }

    function getMode1Mult(step) {
        return config.startMult + (step * config.multIncrease);
    }

    function getMode1Bet(step) {
        const baseBet = getBaseBet();
        if (step === 0) return baseBet;
        const mult = getMode1Mult(step);
        return Math.max(Math.ceil((mode1TotalLoss + minProfit) / (mult - 1)), baseBet);
    }

    for (let i = 0; i < crashes.length; i++) {
        const crash = crashes[i];
        const baseBet = getBaseBet();

        if (crash >= 3) coldStreakCount = 0;
        else coldStreakCount++;

        if (coldStreakCount >= config.maxColdStreak) suspended = true;
        if (suspended) {
            if (crash >= config.resumeAt) {
                suspended = false;
                coldStreakCount = 0;
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
                if (mode1Step >= config.maxSteps) {
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

        if (balance < minBaseBet) break;
    }

    return {
        profit: balance - startBalance,
        profitPercent: ((balance - startBalance) / startBalance) * 100,
        bankrupt: balance < minBaseBet
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
    console.log('║              OPTIMIZE PAOLOBET v3 - TEST 5 IDEE SMART                     ║');
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

    // ═══════════════════════════════════════════════════════════════════════════
    // TEST BASELINE
    // ═══════════════════════════════════════════════════════════════════════════

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   BASELINE v3.3 (riferimento)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    let baselineTotal = 0;
    let baselineBankrupts = 0;
    for (const crashes of sessions) {
        const result = simulateBaseline(crashes, BASELINE_CONFIG, BALANCE);
        baselineTotal += result.profitPercent;
        if (result.bankrupt) baselineBankrupts++;
    }
    const baselineEV = baselineTotal / SESSIONS;
    const baselineBR = (baselineBankrupts / SESSIONS) * 100;
    console.log(`   EV: ${baselineEV >= 0 ? '+' : ''}${baselineEV.toFixed(4)}% | Bankrupt: ${baselineBR.toFixed(1)}%`);
    console.log('');

    const allResults = {
        baseline: { ev: baselineEV, bankruptRate: baselineBR }
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // IDEA 1: Progressione Non-Lineare
    // ═══════════════════════════════════════════════════════════════════════════

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   IDEA 1: Progressione Non-Lineare');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const progressions = [
        { name: 'Decrescente', mults: [2.0, 3.5, 4.5, 5.2, 5.8, 6.2] },
        { name: 'Fibonacci', mults: [2.0, 3.0, 5.0, 8.0] },
        { name: 'Aggressiva', mults: [1.5, 2.5, 4.0, 7.0, 12.0] },
        { name: 'Conservativa', mults: [2.5, 3.0, 3.5, 4.0, 4.5, 5.0] },
        { name: 'Salti Grandi', mults: [2.0, 4.0, 8.0] },
        { name: 'Ibrida', mults: [2.0, 3.0, 4.5, 6.5, 9.0] }
    ];

    allResults.idea1 = [];
    for (const prog of progressions) {
        let total = 0, bankrupts = 0;
        for (const crashes of sessions) {
            const result = simulateNonLinear(crashes, BASELINE_CONFIG, BALANCE, prog.mults);
            total += result.profitPercent;
            if (result.bankrupt) bankrupts++;
        }
        const ev = total / SESSIONS;
        const br = (bankrupts / SESSIONS) * 100;
        const diff = ev - baselineEV;
        const icon = diff > 0 ? '✅' : (diff < -1 ? '❌' : '➖');
        console.log(`   ${prog.name.padEnd(15)} [${prog.mults.join(', ')}]`);
        console.log(`      EV: ${ev >= 0 ? '+' : ''}${ev.toFixed(4)}% (${diff >= 0 ? '+' : ''}${diff.toFixed(2)}%) | BR: ${br.toFixed(1)}% ${icon}`);
        allResults.idea1.push({ name: prog.name, mults: prog.mults, ev, bankruptRate: br, diff });
    }
    console.log('');

    // ═══════════════════════════════════════════════════════════════════════════
    // IDEA 2: Bet Sizing Dinamico
    // ═══════════════════════════════════════════════════════════════════════════

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   IDEA 2: Bet Sizing Dinamico');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const dynamicConfigs = [
        { name: 'Conservativo', boostThreshold: 15, reducedBetPercent: 0.1, aggressiveThreshold: -5, aggressiveBetPercent: 0.3 },
        { name: 'Bilanciato', boostThreshold: 10, reducedBetPercent: 0.15, aggressiveThreshold: 0, aggressiveBetPercent: 0.25 },
        { name: 'Aggressivo', boostThreshold: 20, reducedBetPercent: 0.15, aggressiveThreshold: -10, aggressiveBetPercent: 0.4 },
        { name: 'Solo Protect', boostThreshold: 10, reducedBetPercent: 0.1, aggressiveThreshold: -100, aggressiveBetPercent: 0.2 },
        { name: 'Solo Boost', boostThreshold: 100, reducedBetPercent: 0.2, aggressiveThreshold: 0, aggressiveBetPercent: 0.3 }
    ];

    allResults.idea2 = [];
    for (const dc of dynamicConfigs) {
        let total = 0, bankrupts = 0;
        for (const crashes of sessions) {
            const result = simulateDynamicBet(crashes, BASELINE_CONFIG, BALANCE, dc);
            total += result.profitPercent;
            if (result.bankrupt) bankrupts++;
        }
        const ev = total / SESSIONS;
        const br = (bankrupts / SESSIONS) * 100;
        const diff = ev - baselineEV;
        const icon = diff > 0 ? '✅' : (diff < -1 ? '❌' : '➖');
        console.log(`   ${dc.name.padEnd(15)} (boost@${dc.boostThreshold}%→${dc.reducedBetPercent}%, aggr@${dc.aggressiveThreshold}%→${dc.aggressiveBetPercent}%)`);
        console.log(`      EV: ${ev >= 0 ? '+' : ''}${ev.toFixed(4)}% (${diff >= 0 ? '+' : ''}${diff.toFixed(2)}%) | BR: ${br.toFixed(1)}% ${icon}`);
        allResults.idea2.push({ ...dc, ev, bankruptRate: br, diff });
    }
    console.log('');

    // ═══════════════════════════════════════════════════════════════════════════
    // IDEA 3: Resume Multi-Condizione
    // ═══════════════════════════════════════════════════════════════════════════

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   IDEA 3: Resume Multi-Condizione (5x OR after N games)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const resumeConfigs = [
        { name: '5x OR 10 games', resumeOnMult: 5, resumeAfterGames: 10 },
        { name: '5x OR 15 games', resumeOnMult: 5, resumeAfterGames: 15 },
        { name: '5x OR 20 games', resumeOnMult: 5, resumeAfterGames: 20 },
        { name: '3x OR 10 games', resumeOnMult: 3, resumeAfterGames: 10 },
        { name: '3x OR 15 games', resumeOnMult: 3, resumeAfterGames: 15 },
        { name: '10x OR 5 games', resumeOnMult: 10, resumeAfterGames: 5 },
        { name: '5x ONLY', resumeOnMult: 5, resumeAfterGames: 9999 }
    ];

    allResults.idea3 = [];
    for (const rc of resumeConfigs) {
        let total = 0, bankrupts = 0;
        for (const crashes of sessions) {
            const result = simulateMultiResume(crashes, BASELINE_CONFIG, BALANCE, rc);
            total += result.profitPercent;
            if (result.bankrupt) bankrupts++;
        }
        const ev = total / SESSIONS;
        const br = (bankrupts / SESSIONS) * 100;
        const diff = ev - baselineEV;
        const icon = diff > 0 ? '✅' : (diff < -1 ? '❌' : '➖');
        console.log(`   ${rc.name.padEnd(18)} EV: ${ev >= 0 ? '+' : ''}${ev.toFixed(4)}% (${diff >= 0 ? '+' : ''}${diff.toFixed(2)}%) | BR: ${br.toFixed(1)}% ${icon}`);
        allResults.idea3.push({ ...rc, ev, bankruptRate: br, diff });
    }
    console.log('');

    // ═══════════════════════════════════════════════════════════════════════════
    // IDEA 4: Mode 2 Adattivo
    // ═══════════════════════════════════════════════════════════════════════════

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   IDEA 4: Mode 2 Adattivo (target varia in base a perdita)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const adaptiveConfigs = [
        { name: 'Standard', lowLossThreshold: 0.1, highLossThreshold: 0.3, highTarget: 4.0, lowTarget: 2.5 },
        { name: 'Ampio Range', lowLossThreshold: 0.05, highLossThreshold: 0.5, highTarget: 5.0, lowTarget: 2.0 },
        { name: 'Conservativo', lowLossThreshold: 0.1, highLossThreshold: 0.2, highTarget: 3.5, lowTarget: 2.5 },
        { name: 'Aggressivo', lowLossThreshold: 0.15, highLossThreshold: 0.4, highTarget: 5.0, lowTarget: 2.0 },
        { name: 'Solo Alto', lowLossThreshold: 0.05, highLossThreshold: 100, highTarget: 4.0, lowTarget: 3.0 },
        { name: 'Solo Basso', lowLossThreshold: 0, highLossThreshold: 0.2, highTarget: 3.0, lowTarget: 2.0 }
    ];

    allResults.idea4 = [];
    for (const ac of adaptiveConfigs) {
        let total = 0, bankrupts = 0;
        for (const crashes of sessions) {
            const result = simulateAdaptiveMode2(crashes, BASELINE_CONFIG, BALANCE, ac);
            total += result.profitPercent;
            if (result.bankrupt) bankrupts++;
        }
        const ev = total / SESSIONS;
        const br = (bankrupts / SESSIONS) * 100;
        const diff = ev - baselineEV;
        const icon = diff > 0 ? '✅' : (diff < -1 ? '❌' : '➖');
        console.log(`   ${ac.name.padEnd(15)} (loss<${ac.lowLossThreshold}%→${ac.highTarget}x, loss>${ac.highLossThreshold}%→${ac.lowTarget}x)`);
        console.log(`      EV: ${ev >= 0 ? '+' : ''}${ev.toFixed(4)}% (${diff >= 0 ? '+' : ''}${diff.toFixed(2)}%) | BR: ${br.toFixed(1)}% ${icon}`);
        allResults.idea4.push({ ...ac, ev, bankruptRate: br, diff });
    }
    console.log('');

    // ═══════════════════════════════════════════════════════════════════════════
    // IDEA 5: Profit Lock
    // ═══════════════════════════════════════════════════════════════════════════

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   IDEA 5: Profit Lock (riduci bet quando in profitto)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const lockConfigs = [
        { name: 'Lock@10%→0.1%', lockThreshold: 10, lockedBetPercent: 0.1 },
        { name: 'Lock@15%→0.1%', lockThreshold: 15, lockedBetPercent: 0.1 },
        { name: 'Lock@10%→0.15%', lockThreshold: 10, lockedBetPercent: 0.15 },
        { name: 'Lock@15%→0.15%', lockThreshold: 15, lockedBetPercent: 0.15 },
        { name: 'Lock@5%→0.1%', lockThreshold: 5, lockedBetPercent: 0.1 },
        { name: 'Lock@20%→0.1%', lockThreshold: 20, lockedBetPercent: 0.1 }
    ];

    allResults.idea5 = [];
    for (const lc of lockConfigs) {
        let total = 0, bankrupts = 0;
        for (const crashes of sessions) {
            const result = simulateProfitLock(crashes, BASELINE_CONFIG, BALANCE, lc);
            total += result.profitPercent;
            if (result.bankrupt) bankrupts++;
        }
        const ev = total / SESSIONS;
        const br = (bankrupts / SESSIONS) * 100;
        const diff = ev - baselineEV;
        const icon = diff > 0 ? '✅' : (diff < -1 ? '❌' : '➖');
        console.log(`   ${lc.name.padEnd(18)} EV: ${ev >= 0 ? '+' : ''}${ev.toFixed(4)}% (${diff >= 0 ? '+' : ''}${diff.toFixed(2)}%) | BR: ${br.toFixed(1)}% ${icon}`);
        allResults.idea5.push({ ...lc, ev, bankruptRate: br, diff });
    }
    console.log('');

    // ═══════════════════════════════════════════════════════════════════════════
    // RIEPILOGO FINALE
    // ═══════════════════════════════════════════════════════════════════════════

    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('                              RIEPILOGO FINALE');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('');
    console.log(`   BASELINE v3.3: EV ${baselineEV >= 0 ? '+' : ''}${baselineEV.toFixed(4)}%`);
    console.log('');

    // Trova il migliore per ogni idea
    const best = [];

    const best1 = allResults.idea1.reduce((a, b) => a.ev > b.ev ? a : b);
    if (best1.diff > 0) best.push({ idea: '1-NonLinear', ...best1 });
    console.log(`   IDEA 1 (Non-Lineare): Best = ${best1.name} → EV ${best1.ev >= 0 ? '+' : ''}${best1.ev.toFixed(4)}% (${best1.diff >= 0 ? '+' : ''}${best1.diff.toFixed(2)}%)`);

    const best2 = allResults.idea2.reduce((a, b) => a.ev > b.ev ? a : b);
    if (best2.diff > 0) best.push({ idea: '2-DynamicBet', ...best2 });
    console.log(`   IDEA 2 (Dynamic Bet): Best = ${best2.name} → EV ${best2.ev >= 0 ? '+' : ''}${best2.ev.toFixed(4)}% (${best2.diff >= 0 ? '+' : ''}${best2.diff.toFixed(2)}%)`);

    const best3 = allResults.idea3.reduce((a, b) => a.ev > b.ev ? a : b);
    if (best3.diff > 0) best.push({ idea: '3-MultiResume', ...best3 });
    console.log(`   IDEA 3 (Multi-Resume): Best = ${best3.name} → EV ${best3.ev >= 0 ? '+' : ''}${best3.ev.toFixed(4)}% (${best3.diff >= 0 ? '+' : ''}${best3.diff.toFixed(2)}%)`);

    const best4 = allResults.idea4.reduce((a, b) => a.ev > b.ev ? a : b);
    if (best4.diff > 0) best.push({ idea: '4-AdaptiveMode2', ...best4 });
    console.log(`   IDEA 4 (Adaptive M2): Best = ${best4.name} → EV ${best4.ev >= 0 ? '+' : ''}${best4.ev.toFixed(4)}% (${best4.diff >= 0 ? '+' : ''}${best4.diff.toFixed(2)}%)`);

    const best5 = allResults.idea5.reduce((a, b) => a.ev > b.ev ? a : b);
    if (best5.diff > 0) best.push({ idea: '5-ProfitLock', ...best5 });
    console.log(`   IDEA 5 (Profit Lock): Best = ${best5.name} → EV ${best5.ev >= 0 ? '+' : ''}${best5.ev.toFixed(4)}% (${best5.diff >= 0 ? '+' : ''}${best5.diff.toFixed(2)}%)`);

    console.log('');

    if (best.length > 0) {
        console.log('   IDEE CHE MIGLIORANO IL BASELINE:');
        best.sort((a, b) => b.diff - a.diff);
        for (const b of best) {
            console.log(`   ✅ ${b.idea}: +${b.diff.toFixed(2)}% miglioramento`);
        }
    } else {
        console.log('   ⚠️  Nessuna idea migliora significativamente il baseline');
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════════');

    // Salva risultati
    const fs = require('fs');
    fs.writeFileSync('./paolobet-v3-ideas-results.json', JSON.stringify(allResults, null, 2));
    console.log('');
    console.log('   Risultati salvati in paolobet-v3-ideas-results.json');
    console.log('');
}

runTests().catch(console.error);
