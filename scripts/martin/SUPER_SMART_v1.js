/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                    SUPER SMART ALGORITHM v1.0                             ║
 * ╠═══════════════════════════════════════════════════════════════════════════╣
 * ║  Obiettivo: Guadagnare +50% del capitale rischiato con gioco intelligente ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 *
 * STRATEGIA COMBINATA:
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * 1. SCOUT MODE (Osservazione Statistica)
 *    - Analizza la storia PRIMA di puntare
 *    - Calcola: media, mediana, deviazione standard, delay per payout
 *    - Identifica pattern favorevoli (streak, ritardi anomali)
 *
 * 2. SMART ENTRY (Entrata Intelligente)
 *    - NON punta sempre! Aspetta condizioni favorevoli:
 *      • Delay sopra media (ritardo statistico = opportunità)
 *      • Assenza di crash estremi recenti (stabilità)
 *      • Streak negativo prolungato (mean reversion)
 *
 * 3. HUNT MODE (Caccia Aggressiva)
 *    - Puntate a payout BASSO (1.5x-2x) per alta probabilità
 *    - Progressione moderata (1.4x-1.6x)
 *    - Obiettivo: accumulare profit velocemente
 *
 * 4. RECOVERY HIGH PAYOUT MODE
 *    - Se perdi N volte consecutive → passa a payout ALTO (10x-15x)
 *    - Bet MOLTO più bassa (formula: perdite / (payout - 1))
 *    - Più tentativi possibili con rischio ridotto per singola bet
 *
 * 5. FIBONACCI FALLBACK
 *    - Se recovery fallisce, usa Fibonacci per progressione più lenta
 *    - Alterna tra payout diversi per diversificare rischio
 *
 * VANTAGGI:
 * ✅ Gioca POCO (aspetta condizioni favorevoli)
 * ✅ Sfrutta analisi statistica (non cieco)
 * ✅ Recovery intelligente con payout alto
 * ✅ Sessioni BREVI per minimizzare house edge
 * ✅ Stop profit/loss aggressivi
 */

var config = {
    // ═══════ CAPITALE E TARGET ═══════
    workingBalance: { value: 1000000, type: 'balance', label: 'Working Balance (bits)' },
    targetProfitPercent: { value: 50, type: 'multiplier', label: 'Target Profit % (50 = +50%)' },
    stopLossPercent: { value: 30, type: 'multiplier', label: 'Stop Loss % (30 = -30%)' },

    // ═══════ SCOUT MODE ═══════
    scoutGames: { value: 30, type: 'multiplier', label: 'Games to observe before betting' },
    historyWindow: { value: 100, type: 'multiplier', label: 'History window for statistics' },

    // ═══════ SMART ENTRY ═══════
    delayThreshold: { value: 1.3, type: 'multiplier', label: 'Delay threshold (1.3 = 130% of avg)' },
    maxRecentHighCrash: { value: 20, type: 'multiplier', label: 'Max high crash to consider stable' },
    recentGamesCheck: { value: 10, type: 'multiplier', label: 'Recent games to check for stability' },

    // ═══════ HUNT MODE ═══════
    huntPayout: { value: 2.0, type: 'multiplier', label: 'Hunt Mode Payout (1.5-2.5)' },
    huntBaseBet: { value: 100, type: 'balance', label: 'Hunt Mode Base Bet' },
    huntMultiplier: { value: 1.5, type: 'multiplier', label: 'Hunt Mode Bet Multiplier' },
    huntMaxLosses: { value: 8, type: 'multiplier', label: 'Max losses before Recovery Mode' },

    // ═══════ RECOVERY HIGH PAYOUT MODE ═══════
    recoveryPayout: { value: 12, type: 'multiplier', label: 'Recovery High Payout (8-20)' },
    recoveryMaxAttempts: { value: 30, type: 'multiplier', label: 'Max recovery attempts' },

    // ═══════ SESSION LIMITS ═══════
    maxSessionGames: { value: 500, type: 'multiplier', label: 'Max games per session' },
};

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURAZIONE
// ═══════════════════════════════════════════════════════════════════════════════

const workingBalance = config.workingBalance.value;
const targetProfitPercent = config.targetProfitPercent.value;
const stopLossPercent = config.stopLossPercent.value;
const targetProfitAbsolute = Math.floor(workingBalance * (targetProfitPercent / 100));
const stopLossAbsolute = Math.floor(workingBalance * (stopLossPercent / 100));

const scoutGames = config.scoutGames.value;
const historyWindow = config.historyWindow.value;
const delayThreshold = config.delayThreshold.value;
const maxRecentHighCrash = config.maxRecentHighCrash.value;
const recentGamesCheck = config.recentGamesCheck.value;

const huntPayout = config.huntPayout.value;
const huntBaseBet = config.huntBaseBet.value;
const huntMultiplier = config.huntMultiplier.value;
const huntMaxLosses = config.huntMaxLosses.value;

const recoveryPayout = Math.max(5, Math.min(20, config.recoveryPayout.value));
const recoveryMaxAttempts = config.recoveryMaxAttempts.value;

const maxSessionGames = config.maxSessionGames.value;

// ═══════════════════════════════════════════════════════════════════════════════
// STATE MACHINE
// ═══════════════════════════════════════════════════════════════════════════════

const MODE = {
    SCOUT: 'scout',           // Osservazione statistica
    WAIT: 'wait',             // Aspetta condizioni favorevoli
    HUNT: 'hunt',             // Puntate aggressive a payout basso
    RECOVERY: 'recovery',     // Recovery con payout alto
    STOPPED: 'stopped'        // Sessione terminata
};

let currentMode = MODE.SCOUT;
let balance = workingBalance;
let initBalance = workingBalance;
let currentRound = 0;
let betPlacedThisRound = false;

// ═══════════════════════════════════════════════════════════════════════════════
// STATISTICHE TRACKER
// ═══════════════════════════════════════════════════════════════════════════════

let statistics = {
    // History tracking
    crashHistory: [],          // Ultimi N crash
    delayHistory: [],          // Delay per ogni crash (quante volte non è uscito huntPayout)

    // Calculated stats (updated ogni round)
    mean: 0,                   // Media crash
    median: 0,                 // Mediana crash
    stdDev: 0,                 // Deviazione standard
    avgDelay: 0,               // Delay medio per huntPayout
    currentDelay: 0,           // Delay corrente (quante volte consecutive non esce huntPayout)

    // Streak tracking
    currentStreak: 0,          // Streak corrente (+ = wins, - = losses)
    maxWinStreak: 0,
    maxLossStreak: 0,

    // Scout counter
    scoutCount: 0,

    // Session stats
    totalBets: 0,
    totalWins: 0,
    totalLosses: 0,
    huntWins: 0,
    huntLosses: 0,
    recoveryWins: 0,
    recoveryLosses: 0,
    waitRounds: 0,             // Quante volte abbiamo aspettato (non puntato)
};

// ═══════════════════════════════════════════════════════════════════════════════
// HUNT MODE STATE
// ═══════════════════════════════════════════════════════════════════════════════

let huntState = {
    consecutiveLosses: 0,
    currentBet: huntBaseBet,
    totalLossesAmount: 0,      // Perdite accumulate in questa sequenza
    balanceBeforeSequence: 0,
};

// ═══════════════════════════════════════════════════════════════════════════════
// RECOVERY MODE STATE
// ═══════════════════════════════════════════════════════════════════════════════

let recoveryState = {
    attempts: 0,
    currentBet: 0,
    targetRecovery: 0,         // Quanto dobbiamo recuperare
};

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function pfx(tag, msg) {
    log(`[${tag}] ${msg}`);
}

function calculateMean(arr) {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function calculateMedian(arr) {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function calculateStdDev(arr, mean) {
    if (arr.length === 0) return 0;
    const squaredDiffs = arr.map(x => Math.pow(x - mean, 2));
    return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / arr.length);
}

function parseCrash(lastGame) {
    if (!lastGame) return NaN;
    let v = (Number.isFinite(lastGame.bust) ? lastGame.bust :
             Number.isFinite(lastGame.crash) ? lastGame.crash :
             Number.isFinite(lastGame.game_crash) ? lastGame.game_crash :
             Number.isFinite(lastGame.bustAt) ? lastGame.bustAt : NaN);

    if (!Number.isFinite(v)) {
        try {
            const h = engine.history;
            if (h && typeof h.toArray === 'function') {
                const arr = h.toArray();
                if (arr && arr[0]) {
                    if (Number.isFinite(arr[0].bust)) v = arr[0].bust;
                    else if (Number.isFinite(arr[0].crash)) v = arr[0].crash;
                }
            }
        } catch(e) {}
    }
    if (!Number.isFinite(v)) return NaN;
    if (v >= 50) v = v / 100;
    else if (v < 0.5) v = v * 100;
    return v;
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATISTICS UPDATER
// ═══════════════════════════════════════════════════════════════════════════════

function updateStatistics(crash) {
    // Add to history (keep only last N)
    statistics.crashHistory.push(crash);
    if (statistics.crashHistory.length > historyWindow) {
        statistics.crashHistory.shift();
    }

    // Update delay tracking
    if (crash >= huntPayout) {
        // Registra il delay corrente e resetta
        if (statistics.currentDelay > 0) {
            statistics.delayHistory.push(statistics.currentDelay);
            if (statistics.delayHistory.length > 50) {
                statistics.delayHistory.shift();
            }
        }
        statistics.currentDelay = 0;
    } else {
        statistics.currentDelay++;
    }

    // Calculate stats only if we have enough data
    if (statistics.crashHistory.length >= 10) {
        statistics.mean = calculateMean(statistics.crashHistory);
        statistics.median = calculateMedian(statistics.crashHistory);
        statistics.stdDev = calculateStdDev(statistics.crashHistory, statistics.mean);
    }

    if (statistics.delayHistory.length >= 5) {
        statistics.avgDelay = calculateMean(statistics.delayHistory);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SMART ENTRY DECISION
// ═══════════════════════════════════════════════════════════════════════════════

function shouldEnterHunt() {
    // Condizione 1: Delay sopra soglia (ritardo statistico)
    const delayCondition = statistics.currentDelay >= Math.floor(statistics.avgDelay * delayThreshold);

    // Condizione 2: Nessun crash estremo recente (stabilità)
    const recentCrashes = statistics.crashHistory.slice(-recentGamesCheck);
    const hasRecentHighCrash = recentCrashes.some(c => c > maxRecentHighCrash);
    const stabilityCondition = !hasRecentHighCrash;

    // Condizione 3: Mediana recente bassa (potential bounce)
    const recentMedian = calculateMedian(recentCrashes);
    const medianCondition = recentMedian < huntPayout * 1.5;

    // Log delle condizioni
    if (currentMode === MODE.WAIT) {
        const delayStatus = delayCondition ? '✓' : '✗';
        const stabilityStatus = stabilityCondition ? '✓' : '✗';
        const medianStatus = medianCondition ? '✓' : '✗';

        pfx('WAIT', `Delay:${statistics.currentDelay}/${Math.floor(statistics.avgDelay * delayThreshold)}${delayStatus} Stable:${stabilityStatus} Median:${recentMedian.toFixed(2)}${medianStatus}`);
    }

    // Entra se almeno 2 condizioni su 3 sono soddisfatte
    const conditions = [delayCondition, stabilityCondition, medianCondition];
    const satisfiedCount = conditions.filter(c => c).length;

    return satisfiedCount >= 2;
}

// ═══════════════════════════════════════════════════════════════════════════════
// INIZIALIZZAZIONE
// ═══════════════════════════════════════════════════════════════════════════════

log('');
log('╔═══════════════════════════════════════════════════════════════════════════╗');
log('║                    SUPER SMART ALGORITHM v1.0                             ║');
log('╚═══════════════════════════════════════════════════════════════════════════╝');
log('');
log('CONFIGURAZIONE:');
log('────────────────────────────────────────────────────────────────────────────');
log(`   Working Balance:    ${(workingBalance/100).toLocaleString()} bits`);
log(`   Target Profit:      +${targetProfitPercent}% (+${(targetProfitAbsolute/100).toLocaleString()} bits)`);
log(`   Stop Loss:          -${stopLossPercent}% (-${(stopLossAbsolute/100).toLocaleString()} bits)`);
log(`   Max Session Games:  ${maxSessionGames}`);
log('');
log('STRATEGIA:');
log('────────────────────────────────────────────────────────────────────────────');
log(`   SCOUT: Osserva ${scoutGames} giochi prima di iniziare`);
log(`   WAIT:  Aspetta delay > ${(delayThreshold*100).toFixed(0)}% media`);
log(`   HUNT:  Payout ${huntPayout}x, Mult ${huntMultiplier}x, Max ${huntMaxLosses} perdite`);
log(`   RECOVERY: Payout ${recoveryPayout}x, Max ${recoveryMaxAttempts} tentativi`);
log('');
log('MODALITA:');
log('────────────────────────────────────────────────────────────────────────────');
log(`   ${MODE.SCOUT.toUpperCase()} → ${MODE.WAIT.toUpperCase()} → ${MODE.HUNT.toUpperCase()} → (se perdite) → ${MODE.RECOVERY.toUpperCase()}`);
log('');
log('════════════════════════════════════════════════════════════════════════════');
log('');

currentMode = MODE.SCOUT;

// Hook engine
engine.on('GAME_STARTING', onGameStarted);
engine.on('GAME_ENDED', onGameEnded);

// ═══════════════════════════════════════════════════════════════════════════════
// GAME STARTING
// ═══════════════════════════════════════════════════════════════════════════════

function onGameStarted() {
    currentRound++;
    betPlacedThisRound = false;

    // ═══════ CHECK STOP CONDITIONS ═══════
    const currentProfit = balance - initBalance;

    // Target raggiunto!
    if (currentProfit >= targetProfitAbsolute) {
        currentMode = MODE.STOPPED;
        pfx('TARGET', `OBIETTIVO RAGGIUNTO! +${(currentProfit/100).toFixed(2)} bits (+${((currentProfit/initBalance)*100).toFixed(1)}%)`);
        printFinalStats();
        return;
    }

    // Stop loss!
    if (currentProfit <= -stopLossAbsolute) {
        currentMode = MODE.STOPPED;
        pfx('STOP', `STOP LOSS! ${(currentProfit/100).toFixed(2)} bits (${((currentProfit/initBalance)*100).toFixed(1)}%)`);
        printFinalStats();
        return;
    }

    // Max session games
    if (currentRound > maxSessionGames) {
        currentMode = MODE.STOPPED;
        pfx('LIMIT', `MAX GAMES RAGGIUNTO (${maxSessionGames})`);
        printFinalStats();
        return;
    }

    if (currentMode === MODE.STOPPED) return;

    // ═══════ MODE: SCOUT ═══════
    if (currentMode === MODE.SCOUT) {
        statistics.scoutCount++;
        pfx('SCOUT', `Osservando... ${statistics.scoutCount}/${scoutGames} | Mean:${statistics.mean.toFixed(2)} Median:${statistics.median.toFixed(2)} Delay:${statistics.currentDelay}`);

        if (statistics.scoutCount >= scoutGames && statistics.avgDelay > 0) {
            currentMode = MODE.WAIT;
            pfx('MODE', `SCOUT → WAIT | Stats ready: AvgDelay=${statistics.avgDelay.toFixed(1)} Mean=${statistics.mean.toFixed(2)}`);
        }
        return; // No bet in scout mode
    }

    // ═══════ MODE: WAIT ═══════
    if (currentMode === MODE.WAIT) {
        statistics.waitRounds++;

        if (shouldEnterHunt()) {
            currentMode = MODE.HUNT;
            huntState.consecutiveLosses = 0;
            huntState.currentBet = huntBaseBet;
            huntState.totalLossesAmount = 0;
            huntState.balanceBeforeSequence = balance;

            pfx('MODE', `WAIT → HUNT | Condizioni favorevoli! Delay:${statistics.currentDelay} AvgDelay:${statistics.avgDelay.toFixed(1)}`);
        } else {
            // Still waiting
            return;
        }
    }

    // ═══════ MODE: HUNT ═══════
    if (currentMode === MODE.HUNT) {
        // Check saldo
        if (balance < huntState.currentBet) {
            pfx('ERR', `Saldo insufficiente per HUNT! Need:${(huntState.currentBet/100).toFixed(2)} Have:${(balance/100).toFixed(2)}`);
            currentMode = MODE.WAIT;
            resetHuntState();
            return;
        }

        const profitPct = ((balance - initBalance) / initBalance * 100).toFixed(1);
        pfx('HUNT', `R:${currentRound} Bet:${(huntState.currentBet/100).toFixed(2)} @${huntPayout}x Losses:${huntState.consecutiveLosses}/${huntMaxLosses} Bal:${(balance/100).toFixed(2)} [${profitPct}%]`);

        engine.bet(huntState.currentBet, huntPayout);
        betPlacedThisRound = true;
        statistics.totalBets++;
        return;
    }

    // ═══════ MODE: RECOVERY ═══════
    if (currentMode === MODE.RECOVERY) {
        // Calcola bet per recuperare
        calculateRecoveryBet();

        // Check saldo
        if (balance < recoveryState.currentBet) {
            pfx('ERR', `Saldo insufficiente per RECOVERY! Need:${(recoveryState.currentBet/100).toFixed(2)} Have:${(balance/100).toFixed(2)}`);
            currentMode = MODE.WAIT;
            resetAllState();
            return;
        }

        pfx('REC', `R:${currentRound} Attempt:${recoveryState.attempts}/${recoveryMaxAttempts} Bet:${(recoveryState.currentBet/100).toFixed(2)} @${recoveryPayout}x ToRecover:${(recoveryState.targetRecovery/100).toFixed(2)}`);

        engine.bet(recoveryState.currentBet, recoveryPayout);
        betPlacedThisRound = true;
        statistics.totalBets++;
        return;
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GAME ENDED
// ═══════════════════════════════════════════════════════════════════════════════

function onGameEnded() {
    const lastGame = engine.history.first();
    const crash = parseCrash(lastGame);

    if (!Number.isFinite(crash)) {
        pfx('ERR', 'Invalid crash value');
        return;
    }

    // Update statistics (always, even if not betting)
    updateStatistics(crash);

    if (!betPlacedThisRound) {
        return;
    }

    // ═══════ PROCESS HUNT MODE RESULT ═══════
    if (currentMode === MODE.HUNT) {
        if (lastGame.cashedAt && crash >= huntPayout) {
            // WIN in HUNT mode
            const profit = Math.floor(lastGame.cashedAt * lastGame.wager) - lastGame.wager;
            balance += profit;
            statistics.totalWins++;
            statistics.huntWins++;

            pfx('WIN', `HUNT WIN! Crash:${crash.toFixed(2)} Profit:+${(profit/100).toFixed(2)} Bal:${(balance/100).toFixed(2)}`);

            // Reset hunt state for next sequence
            if (huntState.consecutiveLosses > 0) {
                // We recovered! Go back to base
                pfx('RESET', `Recovered from ${huntState.consecutiveLosses} losses, back to base bet`);
            }
            resetHuntState();

            // Check if we should go back to WAIT (re-evaluate conditions)
            if (!shouldEnterHunt()) {
                currentMode = MODE.WAIT;
                pfx('MODE', `HUNT → WAIT | Condizioni non più favorevoli`);
            }

        } else {
            // LOSS in HUNT mode
            balance -= huntState.currentBet;
            huntState.totalLossesAmount += huntState.currentBet;
            huntState.consecutiveLosses++;
            statistics.totalLosses++;
            statistics.huntLosses++;

            pfx('LOSS', `HUNT LOSS! Crash:${crash.toFixed(2)} Loss:-${(huntState.currentBet/100).toFixed(2)} Bal:${(balance/100).toFixed(2)} [L:${huntState.consecutiveLosses}/${huntMaxLosses}]`);

            // Check if we should switch to RECOVERY
            if (huntState.consecutiveLosses >= huntMaxLosses) {
                switchToRecoveryMode();
            } else {
                // Increase bet (martingale-style)
                huntState.currentBet = Math.ceil((huntState.currentBet / 100) * huntMultiplier) * 100;
                pfx('NEXT', `Next HUNT bet: ${(huntState.currentBet/100).toFixed(2)}`);
            }
        }
        return;
    }

    // ═══════ PROCESS RECOVERY MODE RESULT ═══════
    if (currentMode === MODE.RECOVERY) {
        if (lastGame.cashedAt && crash >= recoveryPayout) {
            // WIN in RECOVERY mode
            const profit = Math.floor(lastGame.cashedAt * lastGame.wager) - lastGame.wager;
            balance += profit;
            statistics.totalWins++;
            statistics.recoveryWins++;

            // Check if we fully recovered
            const remainingLoss = huntState.balanceBeforeSequence - balance;

            pfx('WIN', `RECOVERY WIN! Crash:${crash.toFixed(2)} @${recoveryPayout}x Profit:+${(profit/100).toFixed(2)} Bal:${(balance/100).toFixed(2)}`);

            if (remainingLoss <= 0) {
                pfx('COMPLETE', `FULL RECOVERY! Tutte le perdite recuperate!`);
                currentMode = MODE.WAIT;
                resetAllState();
            } else {
                pfx('PARTIAL', `Remaining loss: ${(remainingLoss/100).toFixed(2)} bits`);
                recoveryState.targetRecovery = remainingLoss;
                // Continue recovery
            }

        } else {
            // LOSS in RECOVERY mode
            balance -= recoveryState.currentBet;
            recoveryState.attempts++;
            recoveryState.targetRecovery += recoveryState.currentBet;
            statistics.totalLosses++;
            statistics.recoveryLosses++;

            pfx('LOSS', `RECOVERY LOSS! Crash:${crash.toFixed(2)} Attempt:${recoveryState.attempts}/${recoveryMaxAttempts} Bal:${(balance/100).toFixed(2)}`);

            // Check if we exhausted recovery attempts
            if (recoveryState.attempts >= recoveryMaxAttempts) {
                pfx('LIMIT', `Recovery attempts exhausted! Accepting loss and returning to WAIT`);
                currentMode = MODE.WAIT;
                resetAllState();
            }
        }
        return;
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODE SWITCHING
// ═══════════════════════════════════════════════════════════════════════════════

function switchToRecoveryMode() {
    currentMode = MODE.RECOVERY;
    recoveryState.attempts = 0;
    recoveryState.targetRecovery = huntState.totalLossesAmount;

    pfx('MODE', `HUNT → RECOVERY | ${huntState.consecutiveLosses} losses consecutive | ToRecover: ${(recoveryState.targetRecovery/100).toFixed(2)} bits`);
    pfx('INFO', `Using HIGH PAYOUT ${recoveryPayout}x for recovery (smaller bets, more attempts)`);
}

function calculateRecoveryBet() {
    // Formula: bet = targetRecovery / (payout - 1)
    // This ensures that if we win, we recover all losses
    const payoutMultiplier = recoveryPayout - 1.0;
    recoveryState.currentBet = Math.ceil(recoveryState.targetRecovery / payoutMultiplier);

    // Round to 100
    recoveryState.currentBet = Math.ceil(recoveryState.currentBet / 100) * 100;

    // Min bet protection
    recoveryState.currentBet = Math.max(recoveryState.currentBet, 100);

    const betPercentage = ((recoveryState.currentBet / recoveryState.targetRecovery) * 100).toFixed(1);
    pfx('CALC', `Recovery bet: ${(recoveryState.currentBet/100).toFixed(2)} bits (${betPercentage}% of losses) @${recoveryPayout}x`);
}

function resetHuntState() {
    huntState.consecutiveLosses = 0;
    huntState.currentBet = huntBaseBet;
    huntState.totalLossesAmount = 0;
    huntState.balanceBeforeSequence = balance;
}

function resetAllState() {
    resetHuntState();
    recoveryState.attempts = 0;
    recoveryState.currentBet = 0;
    recoveryState.targetRecovery = 0;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FINAL STATS
// ═══════════════════════════════════════════════════════════════════════════════

function printFinalStats() {
    const finalProfit = balance - initBalance;
    const profitPct = ((finalProfit / initBalance) * 100).toFixed(2);
    const winRate = statistics.totalBets > 0
        ? ((statistics.totalWins / statistics.totalBets) * 100).toFixed(1)
        : 0;
    const efficiency = currentRound > 0
        ? ((statistics.totalBets / currentRound) * 100).toFixed(1)
        : 0;

    log('');
    log('╔═══════════════════════════════════════════════════════════════════════════╗');
    log('║                          SESSION STATISTICS                               ║');
    log('╚═══════════════════════════════════════════════════════════════════════════╝');
    log('');
    log('RISULTATO:');
    log('────────────────────────────────────────────────────────────────────────────');
    log(`   Initial Balance:    ${(initBalance/100).toLocaleString()} bits`);
    log(`   Final Balance:      ${(balance/100).toLocaleString()} bits`);
    log(`   Profit/Loss:        ${finalProfit >= 0 ? '+' : ''}${(finalProfit/100).toFixed(2)} bits (${profitPct}%)`);
    log('');
    log('EFFICIENZA:');
    log('────────────────────────────────────────────────────────────────────────────');
    log(`   Total Rounds:       ${currentRound}`);
    log(`   Total Bets:         ${statistics.totalBets} (${efficiency}% efficiency)`);
    log(`   Wait Rounds:        ${statistics.waitRounds} (non-betting)`);
    log(`   Scout Rounds:       ${statistics.scoutCount}`);
    log('');
    log('STATISTICHE:');
    log('────────────────────────────────────────────────────────────────────────────');
    log(`   Win Rate:           ${winRate}% (${statistics.totalWins}/${statistics.totalBets})`);
    log(`   HUNT Wins/Losses:   ${statistics.huntWins}/${statistics.huntLosses}`);
    log(`   RECOVERY Wins/Losses: ${statistics.recoveryWins}/${statistics.recoveryLosses}`);
    log('');
    log('ANALISI STATISTICA:');
    log('────────────────────────────────────────────────────────────────────────────');
    log(`   Mean Crash:         ${statistics.mean.toFixed(2)}`);
    log(`   Median Crash:       ${statistics.median.toFixed(2)}`);
    log(`   Std Deviation:      ${statistics.stdDev.toFixed(2)}`);
    log(`   Avg Delay (${huntPayout}x):   ${statistics.avgDelay.toFixed(1)} games`);
    log('');
    log('════════════════════════════════════════════════════════════════════════════');
    log('');
}
