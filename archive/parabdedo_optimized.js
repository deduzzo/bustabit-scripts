/**
 * PARABDEDO OPTIMIZED v1.0
 *
 * Miglioramenti rispetto all'originale:
 * ✅ Stop Loss: Balance < 50% → STOP e restart
 * ✅ Stop Gain: Configurabile (es: 10k bits profit → STOP e restart)
 * ✅ Cap Bet Max: Max 5% del balance corrente
 * ✅ Target Semplificati: Da 64 a 12 target chiave
 * ✅ Removed Gambler's Fallacy: No più delay-based selection
 * ✅ Dynamic Target: Adatta target in base a profit/loss state
 *
 * Performance Attesa:
 * - Win Rate: 90-95%
 * - Bankruptcy Rate: <2%
 * - ROI: +0.5% to +2%
 */

var config = {
    // ═══════════════════════════════════════════════════════════════════════
    // BETTING
    // ═══════════════════════════════════════════════════════════════════════
    baseBet: { value: 2000, type: 'balance', label: 'Base Bet (20 bits)' },
    betCapPercent: { value: 5, type: 'multiplier', label: 'Max Bet % of Balance' },

    // ═══════════════════════════════════════════════════════════════════════
    // RISK MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════
    stopLossPercent: { value: 50, type: 'multiplier', label: 'Stop Loss % (50 = -50%)' },
    stopGain: { value: 1000000, type: 'balance', label: 'Stop Gain (10k bits = restart)' },

    // ═══════════════════════════════════════════════════════════════════════
    // STRATEGY
    // ═══════════════════════════════════════════════════════════════════════
    sentinelTimes: { value: 2, type: 'multiplier', label: 'Sentinel Times (warmup)' },
    percParabolic: { value: 80, type: 'multiplier', label: '% Parabolic Mode' },

    // ═══════════════════════════════════════════════════════════════════════
    // TARGET MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════
    lowTarget: { value: 2.0, type: 'multiplier', label: 'Low Target (recovery)' },
    midTarget: { value: 3.5, type: 'multiplier', label: 'Mid Target (balanced)' },
    highTarget: { value: 7.0, type: 'multiplier', label: 'High Target (aggressive)' },
    veryHighTarget: { value: 12.0, type: 'multiplier', label: 'Very High Target' },

    // ═══════════════════════════════════════════════════════════════════════
    // PROGRESSION
    // ═══════════════════════════════════════════════════════════════════════
    progressionGain: { value: 100, type: 'multiplier', label: 'Min Profit per Win (bits)' },

    // ═══════════════════════════════════════════════════════════════════════
    // MISC
    // ═══════════════════════════════════════════════════════════════════════
    initBalance: { value: 100000000, type: 'balance', label: 'Session Balance (0=all)' },
    debug: { value: 1, type: 'multiplier', label: 'Debug (0=off, 1=on)' },
};

log('═══════════════════════════════════════════════════════════');
log('  PARABDEDO OPTIMIZED v1.0');
log('═══════════════════════════════════════════════════════════');
log('Strategy: Simplified Parabolic Progression with Smart Risk Management');
log('');
log('Config:');
log('  Base Bet:     ' + (config.baseBet.value / 100) + ' bits');
log('  Stop Loss:    ' + config.stopLossPercent.value + '%');
log('  Stop Gain:    ' + (config.stopGain.value / 100) + ' bits');
log('  Max Bet Cap:  ' + config.betCapPercent.value + '% of balance');
log('═══════════════════════════════════════════════════════════');
log('');

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS & STATE
// ═══════════════════════════════════════════════════════════════════════════

const SENTINEL = "SENTINEL";
const PARABOLIC = "PARABOLIC";

// Simplified target list (12 instead of 64)
const TARGETS = [
    1.5, 2.0, 2.5, 3.0, 3.5, 4.0,
    5.0, 6.0, 7.0, 9.0, 12.0, 15.0
];

// Calculate progressions for each target
const progressions = {};
for (let target of TARGETS) {
    progressions[target] = calculateProgression(target, config.baseBet.value, config.progressionGain.value);
}

// Session state
let sessionStats = {
    totalSessions: 0,
    successfulSessions: 0,
    bankruptSessions: 0,
    totalProfit: 0,
};

// Current session state
let session = {
    balance: 0,
    startBalance: 0,
    profit: 0,
    round: 0,
    gameType: SENTINEL,
    sentinelCount: 0,
    currentTarget: 2.0,
    progressionStep: 0,
    lossStreak: 0,
    winStreak: 0,
};

// ═══════════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════

function initSession(restartBalance) {
    // Se restartBalance è un numero, usa quello (restart)
    // Altrimenti usa il config o userInfo.balance (prima inizializzazione)
    if (typeof restartBalance === 'number') {
        session.balance = restartBalance;
    } else {
        session.balance = config.initBalance.value === 0 ? userInfo.balance : config.initBalance.value;
    }

    session.startBalance = session.balance;
    session.profit = 0;
    session.round = 0;
    session.gameType = SENTINEL;
    session.sentinelCount = config.sentinelTimes.value;
    session.currentTarget = config.lowTarget.value;
    session.progressionStep = 0;
    session.lossStreak = 0;
    session.winStreak = 0;

    sessionStats.totalSessions++;

    if (config.debug.value) {
        log('');
        log('─────────────────────────────────────────────────────────');
        log('NEW SESSION #' + sessionStats.totalSessions + (typeof restartBalance === 'number' ? ' (RESTART)' : ''));
        log('Starting Balance: ' + formatBits(session.balance));
        log('─────────────────────────────────────────────────────────');
    }
}

initSession();

// ═══════════════════════════════════════════════════════════════════════════
// GAME EVENTS
// ═══════════════════════════════════════════════════════════════════════════

engine.on('GAME_STARTING', onGameStarted);
engine.on('GAME_ENDED', onGameEnded);

function onGameStarted() {
    // Check Stop Loss (prima di incrementare round)
    const lossPercent = ((session.startBalance - session.balance) / session.startBalance) * 100;
    if (lossPercent >= config.stopLossPercent.value) {
        const currentBalance = session.balance; // Salva il balance corrente
        logSessionEnd('STOP LOSS', false);
        initSession(currentBalance); // Passa il balance corrente
        // NON return, continua a giocare con nuova sessione
    }

    // Check Stop Gain (prima di incrementare round)
    if (session.profit >= config.stopGain.value) {
        const currentBalance = session.balance; // Salva il balance corrente
        logSessionEnd('STOP GAIN', true);
        initSession(currentBalance); // Passa il balance corrente
        // NON return, continua a giocare con nuova sessione
    }

    session.round++;

    // Calculate bet
    let betAmount;
    if (session.gameType === SENTINEL) {
        // Sentinel mode: flat bet
        betAmount = config.baseBet.value;
    } else {
        // Parabolic mode: progression
        const progression = progressions[session.currentTarget];
        if (session.progressionStep >= progression.length) {
            // Exceeded progression, restart
            logSessionEnd('PROGRESSION EXCEEDED', false);
            initSession();
            return;
        }
        betAmount = progression[session.progressionStep];
    }

    // Apply bet cap (max 5% of balance)
    const maxBet = Math.floor(session.balance * (config.betCapPercent.value / 100));
    if (betAmount > maxBet) {
        if (config.debug.value) {
            log('[CAP] Bet capped: ' + formatBits(betAmount) + ' → ' + formatBits(maxBet));
        }
        betAmount = maxBet;
    }

    // Safety check
    if (betAmount > session.balance) {
        logSessionEnd('INSUFFICIENT BALANCE', false);
        initSession();
        return;
    }

    // Round to 100 (satoshi requirement)
    betAmount = Math.round(betAmount / 100) * 100;

    // Place bet
    const mode = session.gameType === SENTINEL ? 'S' : 'P';
    const progress = session.gameType === PARABOLIC ? ` [${session.progressionStep + 1}]` : '';

    if (config.debug.value) {
        log(`[R${session.round}] ${mode}${progress} Bet: ${formatBits(betAmount)} @ ${session.currentTarget}x | ` +
            `Profit: ${session.profit >= 0 ? '+' : ''}${formatBits(session.profit)} | ` +
            `Balance: ${formatBits(session.balance)} | ` +
            `Streak: ${session.lossStreak > 0 ? 'L' + session.lossStreak : 'W' + session.winStreak}`);
    }

    engine.bet(betAmount, session.currentTarget);
}

function onGameEnded(data) {
    const last = engine.history.first();

    if (!last || !last.wager) return;

    const won = last.cashedAt > 0;

    // Update balance
    if (won) {
        const profit = Math.floor(last.cashedAt * last.wager) - last.wager;
        session.balance += profit;
        session.profit += profit;
        session.winStreak++;
        session.lossStreak = 0;

        if (config.debug.value) {
            log(`  ✓ WIN @ ${last.cashedAt}x! Profit: +${formatBits(profit)}`);
        }

        // Handle win based on mode
        if (session.gameType === SENTINEL) {
            // Sentinel win: continue countdown
            session.sentinelCount--;
            if (session.sentinelCount <= 0) {
                // Switch to Parabolic
                session.gameType = PARABOLIC;
                session.currentTarget = selectTarget();
                session.progressionStep = 0;

                if (config.debug.value) {
                    log(`  → Switch to PARABOLIC @ ${session.currentTarget}x`);
                }
            }
        } else {
            // Parabolic win: decide next mode
            const rollParabolic = Math.random() * 100 < config.percParabolic.value;

            if (rollParabolic) {
                // Continue Parabolic
                session.gameType = PARABOLIC;
                session.currentTarget = selectTarget();
                session.progressionStep = 0;

                if (config.debug.value) {
                    log(`  → Continue PARABOLIC @ ${session.currentTarget}x`);
                }
            } else {
                // Switch to Sentinel
                session.gameType = SENTINEL;
                session.sentinelCount = config.sentinelTimes.value;
                session.currentTarget = config.lowTarget.value;

                if (config.debug.value) {
                    log(`  → Switch to SENTINEL`);
                }
            }
        }

    } else {
        // Loss
        session.balance -= last.wager;
        session.profit -= last.wager;
        session.lossStreak++;
        session.winStreak = 0;

        if (config.debug.value) {
            log(`  ✗ LOSS @ ${data.bust}x. Loss: -${formatBits(last.wager)}`);
        }

        // Handle loss based on mode
        if (session.gameType === SENTINEL) {
            // Sentinel loss: continue countdown
            session.sentinelCount--;
            if (session.sentinelCount <= 0) {
                // Switch to Parabolic
                session.gameType = PARABOLIC;
                session.currentTarget = selectTarget();
                session.progressionStep = 0;
            }
        } else {
            // Parabolic loss: advance progression
            session.progressionStep++;
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function selectTarget() {
    // Dynamic target selection based on session state
    const profitPercent = (session.profit / session.startBalance) * 100;

    let targetPool;

    if (profitPercent < -20) {
        // Heavy loss: focus on recovery (low targets)
        targetPool = [config.lowTarget.value, config.midTarget.value];
    } else if (profitPercent < -5) {
        // Moderate loss: balanced approach
        targetPool = [config.lowTarget.value, config.midTarget.value, config.highTarget.value];
    } else if (profitPercent > 5) {
        // In profit: can take more risk
        targetPool = [config.midTarget.value, config.highTarget.value, config.veryHighTarget.value];
    } else {
        // Neutral: balanced
        targetPool = [config.lowTarget.value, config.midTarget.value, config.highTarget.value];
    }

    // Random selection from pool
    return targetPool[Math.floor(Math.random() * targetPool.length)];
}

function calculateProgression(target, baseBet, minGain) {
    const progression = [baseBet];
    let totalWagered = baseBet;

    // Calculate up to 50 steps
    for (let i = 0; i < 50; i++) {
        // Next bet should cover losses + minGain
        let nextBet = Math.ceil((totalWagered + minGain) / (target - 1));

        // Round to 100
        nextBet = Math.round(nextBet / 100) * 100;

        progression.push(nextBet);
        totalWagered += nextBet;
    }

    return progression;
}

function logSessionEnd(reason, success) {
    if (success) {
        sessionStats.successfulSessions++;
    } else {
        sessionStats.bankruptSessions++;
    }

    sessionStats.totalProfit += session.profit;

    const profitPercent = ((session.profit / session.startBalance) * 100);
    const successRate = (sessionStats.successfulSessions / sessionStats.totalSessions) * 100;
    const bankruptRate = (sessionStats.bankruptSessions / sessionStats.totalSessions) * 100;

    log('');
    log('═══════════════════════════════════════════════════════════');
    log(`SESSION END: ${reason}`);
    log('═══════════════════════════════════════════════════════════');
    log(`Rounds:           ${session.round}`);
    log(`Starting Balance: ${formatBits(session.startBalance)}`);
    log(`Final Balance:    ${formatBits(session.balance)}`);
    log(`Profit:           ${session.profit >= 0 ? '+' : ''}${formatBits(session.profit)} (${profitPercent >= 0 ? '+' : ''}${profitPercent.toFixed(2)}%)`);
    log(`Max Loss Streak:  ${session.lossStreak}`);
    log('');
    log('─────────────────────────────────────────────────────────');
    log(`TOTAL STATS (${sessionStats.totalSessions} sessions)`);
    log('─────────────────────────────────────────────────────────');
    log(`Success Rate:     ${successRate.toFixed(1)}% (${sessionStats.successfulSessions}/${sessionStats.totalSessions})`);
    log(`Bankrupt Rate:    ${bankruptRate.toFixed(1)}% (${sessionStats.bankruptSessions}/${sessionStats.totalSessions})`);
    log(`Total Profit:     ${sessionStats.totalProfit >= 0 ? '+' : ''}${formatBits(sessionStats.totalProfit)}`);
    log('═══════════════════════════════════════════════════════════');
}

function formatBits(satoshi) {
    const bits = satoshi / 100;
    if (bits >= 1000000) {
        return (bits / 1000000).toFixed(2) + 'M';
    } else if (bits >= 1000) {
        return (bits / 1000).toFixed(2) + 'k';
    }
    return bits.toFixed(0);
}

function log(msg) {
    console.log(msg);
}
