/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                    SUPER SMART ALGORITHM v2.0                             ║
 * ║                "IL CACCIATORE DI PROFITTO INTELLIGENTE"                   ║
 * ╠═══════════════════════════════════════════════════════════════════════════╣
 * ║  Obiettivo: +50% del capitale rischiato con minimo gioco                  ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 *
 * EVOLUZIONE DA v1.0:
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * + Fibonacci fallback per recovery più graduale
 * + Percentile-based entry (più preciso della media)
 * + Profit-aware payout selection (adatta payout al progresso)
 * + Alternating recovery mode (alterna payout alto/basso)
 * + Bonus incrementale sulle prime perdite
 * + Hot streak detection (capitalizza sui momenti positivi)
 * + Cool-down dopo disaster (protegge il capitale)
 *
 * STRATEGIA MULTI-FASE:
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * FASE 1 - SCOUT (Osservazione)
 *   → Raccoglie dati statistici senza puntare
 *   → Calcola percentili, delay, volatilità
 *
 * FASE 2 - WAIT (Attesa)
 *   → Aspetta condizioni FAVOREVOLI:
 *     • Delay nel top 30% (sopra 70° percentile)
 *     • No crash >15x nelle ultime 8 partite
 *     • Mediana recente sotto payout target
 *
 * FASE 3 - HUNT (Caccia)
 *   → Puntate aggressive con payout dinamico:
 *     • Profit <30%: usa 2.5x (più rischio per accumulo)
 *     • Profit 30-60%: usa 2.0x (bilanciato)
 *     • Profit >60%: usa 1.5x (sicurezza per chiudere)
 *   → Progressione 1.4x-1.6x
 *   → Bonus +1 bit per prime 3 perdite
 *
 * FASE 4a - RECOVERY HIGH (Recupero Rapido)
 *   → Payout ALTO (10x-15x) per bet minime
 *   → Bet = Perdite / (Payout - 1)
 *   → Max 20 tentativi
 *
 * FASE 4b - FIBONACCI FALLBACK (Recupero Graduale)
 *   → Se recovery rapido fallisce
 *   → Sequenza: 1,1,2,3,5,8,13,21...
 *   → Payout alternato (alto/basso)
 *   → Più lento ma più sostenibile
 *
 * FASE 5 - COOLDOWN
 *   → Dopo un disaster, pausa N giochi
 *   → Rianalizza le statistiche
 *   → Ricomincia solo quando stabilizzato
 */

var config = {
    // ═══════ CAPITALE E TARGET ═══════
    workingBalance: { value: 1000000, type: 'balance', label: 'Working Balance (bits)' },
    targetProfitPercent: { value: 50, type: 'multiplier', label: 'Target Profit % (50 = +50%)' },
    stopLossPercent: { value: 25, type: 'multiplier', label: 'Stop Loss % (25 = -25%)' },

    // ═══════ SCOUT MODE ═══════
    scoutGames: { value: 25, type: 'multiplier', label: 'Games to observe' },
    historyWindow: { value: 80, type: 'multiplier', label: 'History window' },

    // ═══════ SMART ENTRY ═══════
    delayPercentile: { value: 70, type: 'multiplier', label: 'Delay percentile to enter (70 = top 30%)' },
    maxRecentHighCrash: { value: 15, type: 'multiplier', label: 'Max high crash for stability' },
    recentGamesCheck: { value: 8, type: 'multiplier', label: 'Recent games to check' },

    // ═══════ HUNT MODE ═══════
    huntBaseBet: { value: 100, type: 'balance', label: 'Hunt Base Bet' },
    huntMultiplier: { value: 1.5, type: 'multiplier', label: 'Hunt Bet Multiplier' },
    huntMaxLosses: { value: 7, type: 'multiplier', label: 'Max losses before Recovery' },
    bonusPerLoss: { value: 100, type: 'balance', label: 'Bonus per loss (first 3)' },

    // ═══════ RECOVERY HIGH PAYOUT ═══════
    recoveryHighPayout: { value: 12, type: 'multiplier', label: 'Recovery High Payout (10-20)' },
    recoveryHighMaxAttempts: { value: 20, type: 'multiplier', label: 'Max high payout attempts' },

    // ═══════ FIBONACCI FALLBACK ═══════
    fibonacciEnabled: { value: 1, type: 'multiplier', label: 'Enable Fibonacci fallback (1=yes)' },
    fibonacciLowPayout: { value: 2.0, type: 'multiplier', label: 'Fibonacci low payout' },
    fibonacciHighPayout: { value: 8.0, type: 'multiplier', label: 'Fibonacci high payout' },
    fibonacciMaxSteps: { value: 12, type: 'multiplier', label: 'Fibonacci max steps' },

    // ═══════ COOLDOWN ═══════
    cooldownGames: { value: 15, type: 'multiplier', label: 'Cooldown games after disaster' },

    // ═══════ SESSION ═══════
    maxSessionGames: { value: 400, type: 'multiplier', label: 'Max games per session' },
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
const delayPercentile = config.delayPercentile.value;
const maxRecentHighCrash = config.maxRecentHighCrash.value;
const recentGamesCheck = config.recentGamesCheck.value;

const huntBaseBet = config.huntBaseBet.value;
const huntMultiplier = config.huntMultiplier.value;
const huntMaxLosses = config.huntMaxLosses.value;
const bonusPerLossAmount = config.bonusPerLoss.value;

const recoveryHighPayout = Math.max(8, Math.min(20, config.recoveryHighPayout.value));
const recoveryHighMaxAttempts = config.recoveryHighMaxAttempts.value;

const fibonacciEnabled = config.fibonacciEnabled.value === 1;
const fibonacciLowPayout = config.fibonacciLowPayout.value;
const fibonacciHighPayout = config.fibonacciHighPayout.value;
const fibonacciMaxSteps = config.fibonacciMaxSteps.value;

const cooldownGames = config.cooldownGames.value;
const maxSessionGames = config.maxSessionGames.value;

// ═══════════════════════════════════════════════════════════════════════════════
// FIBONACCI SEQUENCE GENERATOR
// ═══════════════════════════════════════════════════════════════════════════════

const FIBONACCI = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];

// ═══════════════════════════════════════════════════════════════════════════════
// STATE MACHINE
// ═══════════════════════════════════════════════════════════════════════════════

const MODE = {
    SCOUT: 'scout',
    WAIT: 'wait',
    HUNT: 'hunt',
    RECOVERY_HIGH: 'recovery_high',
    FIBONACCI: 'fibonacci',
    COOLDOWN: 'cooldown',
    STOPPED: 'stopped'
};

let currentMode = MODE.SCOUT;
let balance = workingBalance;
let initBalance = workingBalance;
let currentRound = 0;
let betPlacedThisRound = false;

// ═══════════════════════════════════════════════════════════════════════════════
// STATISTICHE TRACKER (ENHANCED)
// ═══════════════════════════════════════════════════════════════════════════════

let stats = {
    // History
    crashHistory: [],
    delayHistory: [],

    // Stats
    mean: 0,
    median: 0,
    stdDev: 0,
    percentile70Delay: 0,      // Delay al 70° percentile
    currentDelay: 0,

    // Counters
    scoutCount: 0,
    cooldownRemaining: 0,

    // Session
    totalBets: 0,
    totalWins: 0,
    totalLosses: 0,
    huntWins: 0,
    huntLosses: 0,
    recoveryWins: 0,
    recoveryLosses: 0,
    fibonacciWins: 0,
    fibonacciLosses: 0,
    waitRounds: 0,
    disasters: 0,

    // Hot streak
    currentWinStreak: 0,
    maxWinStreak: 0,
};

// ═══════════════════════════════════════════════════════════════════════════════
// HUNT STATE
// ═══════════════════════════════════════════════════════════════════════════════

let hunt = {
    consecutiveLosses: 0,
    currentBet: huntBaseBet,
    currentPayout: 2.0,        // Profit-aware, starts at 2.0
    totalLossesAmount: 0,
    balanceBeforeSequence: 0,
    bonusAccumulated: 0,
};

// ═══════════════════════════════════════════════════════════════════════════════
// RECOVERY STATE
// ═══════════════════════════════════════════════════════════════════════════════

let recovery = {
    attempts: 0,
    currentBet: 0,
    targetRecovery: 0,
};

// ═══════════════════════════════════════════════════════════════════════════════
// FIBONACCI STATE
// ═══════════════════════════════════════════════════════════════════════════════

let fib = {
    step: 0,
    currentBet: 0,
    useHighPayout: false,      // Alternates between high and low
    targetRecovery: 0,
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

function calculatePercentile(arr, percentile) {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
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
// PROFIT-AWARE PAYOUT CALCULATOR
// ═══════════════════════════════════════════════════════════════════════════════

function calculateOptimalPayout() {
    const currentProfit = balance - initBalance;
    const profitProgress = currentProfit / targetProfitAbsolute;

    // Vicino al target → sicurezza
    if (profitProgress >= 0.6) {
        return 1.5; // Alta probabilità, chiudi veloce
    }

    // Profit moderato → bilanciato
    if (profitProgress >= 0.3) {
        return 2.0;
    }

    // Profit basso o negativo → più rischio per recuperare/accumulare
    if (hunt.consecutiveLosses === 0) {
        return 2.5; // Può permettersi rischio
    }

    // In recupero → usa x2 per alta probabilità
    return 2.0;
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATISTICS UPDATER
// ═══════════════════════════════════════════════════════════════════════════════

function updateStatistics(crash) {
    // History
    stats.crashHistory.push(crash);
    if (stats.crashHistory.length > historyWindow) {
        stats.crashHistory.shift();
    }

    // Delay tracking (using 2.0 as reference)
    const refPayout = 2.0;
    if (crash >= refPayout) {
        if (stats.currentDelay > 0) {
            stats.delayHistory.push(stats.currentDelay);
            if (stats.delayHistory.length > 50) {
                stats.delayHistory.shift();
            }
        }
        stats.currentDelay = 0;
    } else {
        stats.currentDelay++;
    }

    // Calculate stats
    if (stats.crashHistory.length >= 10) {
        stats.mean = calculateMean(stats.crashHistory);
        stats.median = calculateMedian(stats.crashHistory);
        stats.stdDev = calculateStdDev(stats.crashHistory, stats.mean);
    }

    if (stats.delayHistory.length >= 5) {
        stats.percentile70Delay = calculatePercentile(stats.delayHistory, delayPercentile);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SMART ENTRY DECISION
// ═══════════════════════════════════════════════════════════════════════════════

function shouldEnterHunt() {
    // Condizione 1: Delay sopra il 70° percentile
    const delayCondition = stats.currentDelay >= stats.percentile70Delay;

    // Condizione 2: Stabilità (no crash estremi recenti)
    const recentCrashes = stats.crashHistory.slice(-recentGamesCheck);
    const hasRecentHighCrash = recentCrashes.some(c => c > maxRecentHighCrash);
    const stabilityCondition = !hasRecentHighCrash;

    // Condizione 3: Mediana recente bassa
    const recentMedian = calculateMedian(recentCrashes);
    const medianCondition = recentMedian < 3.0;

    // Condizione 4: Hot streak (bonus) - se abbiamo vinto ultimamente
    const hotStreakBonus = stats.currentWinStreak >= 2;

    // Log
    if (currentMode === MODE.WAIT) {
        const d = delayCondition ? '✓' : '✗';
        const s = stabilityCondition ? '✓' : '✗';
        const m = medianCondition ? '✓' : '✗';
        const h = hotStreakBonus ? '🔥' : '';
        pfx('WAIT', `Delay:${stats.currentDelay}/${stats.percentile70Delay.toFixed(0)}${d} Stable:${s} Med:${recentMedian.toFixed(1)}${m} ${h}`);
    }

    // Entra se almeno 2 su 3 condizioni OPPURE se hot streak + 1 condizione
    const conditions = [delayCondition, stabilityCondition, medianCondition];
    const satisfiedCount = conditions.filter(c => c).length;

    return satisfiedCount >= 2 || (hotStreakBonus && satisfiedCount >= 1);
}

// ═══════════════════════════════════════════════════════════════════════════════
// INIZIALIZZAZIONE
// ═══════════════════════════════════════════════════════════════════════════════

log('');
log('╔═══════════════════════════════════════════════════════════════════════════╗');
log('║              SUPER SMART ALGORITHM v2.0 - "IL CACCIATORE"                ║');
log('╚═══════════════════════════════════════════════════════════════════════════╝');
log('');
log('OBIETTIVO:');
log('────────────────────────────────────────────────────────────────────────────');
log(`   Working Balance:    ${(workingBalance/100).toLocaleString()} bits`);
log(`   TARGET:             +${targetProfitPercent}% (+${(targetProfitAbsolute/100).toLocaleString()} bits)`);
log(`   STOP LOSS:          -${stopLossPercent}% (-${(stopLossAbsolute/100).toLocaleString()} bits)`);
log('');
log('STRATEGIA MULTI-FASE:');
log('────────────────────────────────────────────────────────────────────────────');
log(`   1. SCOUT:           Osserva ${scoutGames} giochi`);
log(`   2. WAIT:            Aspetta delay > ${delayPercentile}° percentile`);
log(`   3. HUNT:            Payout dinamico 1.5-2.5x, Mult ${huntMultiplier}x`);
log(`   4. RECOVERY HIGH:   Payout ${recoveryHighPayout}x, max ${recoveryHighMaxAttempts} tentativi`);
if (fibonacciEnabled) {
    log(`   5. FIBONACCI:       ${fibonacciLowPayout}x/${fibonacciHighPayout}x alternati, max ${fibonacciMaxSteps} step`);
}
log(`   6. COOLDOWN:        ${cooldownGames} giochi dopo disaster`);
log('');
log('════════════════════════════════════════════════════════════════════════════');
log('');

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

    if (currentProfit >= targetProfitAbsolute) {
        currentMode = MODE.STOPPED;
        pfx('🎯 TARGET', `OBIETTIVO RAGGIUNTO! +${(currentProfit/100).toFixed(2)} bits (+${((currentProfit/initBalance)*100).toFixed(1)}%)`);
        printFinalStats();
        return;
    }

    if (currentProfit <= -stopLossAbsolute) {
        currentMode = MODE.STOPPED;
        pfx('🛑 STOP', `STOP LOSS! ${(currentProfit/100).toFixed(2)} bits`);
        printFinalStats();
        return;
    }

    if (currentRound > maxSessionGames) {
        currentMode = MODE.STOPPED;
        pfx('⏱️ LIMIT', `MAX GAMES (${maxSessionGames})`);
        printFinalStats();
        return;
    }

    if (currentMode === MODE.STOPPED) return;

    // ═══════ MODE: COOLDOWN ═══════
    if (currentMode === MODE.COOLDOWN) {
        stats.cooldownRemaining--;
        pfx('❄️ COOL', `Cooldown: ${stats.cooldownRemaining} remaining`);

        if (stats.cooldownRemaining <= 0) {
            currentMode = MODE.WAIT;
            resetAllState();
            pfx('MODE', `COOLDOWN → WAIT`);
        }
        return;
    }

    // ═══════ MODE: SCOUT ═══════
    if (currentMode === MODE.SCOUT) {
        stats.scoutCount++;
        pfx('🔍 SCOUT', `${stats.scoutCount}/${scoutGames} | Mean:${stats.mean.toFixed(2)} Med:${stats.median.toFixed(2)} P70Delay:${stats.percentile70Delay.toFixed(1)}`);

        if (stats.scoutCount >= scoutGames && stats.percentile70Delay > 0) {
            currentMode = MODE.WAIT;
            pfx('MODE', `SCOUT → WAIT`);
        }
        return;
    }

    // ═══════ MODE: WAIT ═══════
    if (currentMode === MODE.WAIT) {
        stats.waitRounds++;

        if (shouldEnterHunt()) {
            currentMode = MODE.HUNT;
            hunt.consecutiveLosses = 0;
            hunt.currentBet = huntBaseBet;
            hunt.totalLossesAmount = 0;
            hunt.balanceBeforeSequence = balance;
            hunt.bonusAccumulated = 0;
            hunt.currentPayout = calculateOptimalPayout();

            pfx('MODE', `WAIT → HUNT | Delay:${stats.currentDelay} >= P70:${stats.percentile70Delay.toFixed(1)}`);
        }
        return;
    }

    // ═══════ MODE: HUNT ═══════
    if (currentMode === MODE.HUNT) {
        hunt.currentPayout = calculateOptimalPayout();
        const totalBet = hunt.currentBet + hunt.bonusAccumulated;

        if (balance < totalBet) {
            pfx('ERR', `Saldo insufficiente HUNT!`);
            triggerCooldown();
            return;
        }

        const profitPct = ((balance - initBalance) / initBalance * 100).toFixed(1);
        pfx('🎯 HUNT', `R:${currentRound} Bet:${(totalBet/100).toFixed(2)} @${hunt.currentPayout}x L:${hunt.consecutiveLosses}/${huntMaxLosses} [${profitPct}%]`);

        engine.bet(totalBet, hunt.currentPayout);
        betPlacedThisRound = true;
        stats.totalBets++;
        return;
    }

    // ═══════ MODE: RECOVERY HIGH ═══════
    if (currentMode === MODE.RECOVERY_HIGH) {
        calculateRecoveryBet();

        if (balance < recovery.currentBet) {
            if (fibonacciEnabled) {
                switchToFibonacci();
            } else {
                pfx('ERR', `Saldo insufficiente RECOVERY!`);
                triggerCooldown();
            }
            return;
        }

        pfx('🔥 REC', `Attempt:${recovery.attempts}/${recoveryHighMaxAttempts} Bet:${(recovery.currentBet/100).toFixed(2)} @${recoveryHighPayout}x ToRecover:${(recovery.targetRecovery/100).toFixed(2)}`);

        engine.bet(recovery.currentBet, recoveryHighPayout);
        betPlacedThisRound = true;
        stats.totalBets++;
        return;
    }

    // ═══════ MODE: FIBONACCI ═══════
    if (currentMode === MODE.FIBONACCI) {
        calculateFibonacciBet();
        const currentPayout = fib.useHighPayout ? fibonacciHighPayout : fibonacciLowPayout;

        if (balance < fib.currentBet) {
            pfx('ERR', `Saldo insufficiente FIBONACCI!`);
            triggerCooldown();
            return;
        }

        pfx('🌀 FIB', `Step:${fib.step}/${fibonacciMaxSteps} Bet:${(fib.currentBet/100).toFixed(2)} @${currentPayout}x ${fib.useHighPayout ? '(HIGH)' : '(LOW)'}`);

        engine.bet(fib.currentBet, currentPayout);
        betPlacedThisRound = true;
        stats.totalBets++;
        return;
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GAME ENDED
// ═══════════════════════════════════════════════════════════════════════════════

function onGameEnded() {
    const lastGame = engine.history.first();
    const crash = parseCrash(lastGame);

    if (!Number.isFinite(crash)) return;

    updateStatistics(crash);

    if (!betPlacedThisRound) return;

    // ═══════ HUNT RESULT ═══════
    if (currentMode === MODE.HUNT) {
        const totalBet = hunt.currentBet + hunt.bonusAccumulated;

        if (lastGame.cashedAt && crash >= hunt.currentPayout) {
            // WIN
            const profit = Math.floor(lastGame.cashedAt * lastGame.wager) - lastGame.wager;
            balance += profit;
            stats.totalWins++;
            stats.huntWins++;
            stats.currentWinStreak++;
            stats.maxWinStreak = Math.max(stats.maxWinStreak, stats.currentWinStreak);

            pfx('✅ WIN', `HUNT +${(profit/100).toFixed(2)} Bal:${(balance/100).toFixed(2)} Streak:${stats.currentWinStreak}`);

            resetHuntState();

            if (!shouldEnterHunt()) {
                currentMode = MODE.WAIT;
                pfx('MODE', `HUNT → WAIT`);
            }
        } else {
            // LOSS
            balance -= totalBet;
            hunt.totalLossesAmount += totalBet;
            hunt.consecutiveLosses++;
            stats.totalLosses++;
            stats.huntLosses++;
            stats.currentWinStreak = 0;

            // Bonus incrementale (prime 3 perdite)
            if (hunt.consecutiveLosses <= 3) {
                hunt.bonusAccumulated += bonusPerLossAmount;
            }

            pfx('❌ LOSS', `HUNT -${(totalBet/100).toFixed(2)} L:${hunt.consecutiveLosses}/${huntMaxLosses}`);

            if (hunt.consecutiveLosses >= huntMaxLosses) {
                switchToRecoveryHigh();
            } else {
                hunt.currentBet = Math.ceil((hunt.currentBet / 100) * huntMultiplier) * 100;
            }
        }
        return;
    }

    // ═══════ RECOVERY HIGH RESULT ═══════
    if (currentMode === MODE.RECOVERY_HIGH) {
        if (lastGame.cashedAt && crash >= recoveryHighPayout) {
            // WIN
            const profit = Math.floor(lastGame.cashedAt * lastGame.wager) - lastGame.wager;
            balance += profit;
            stats.totalWins++;
            stats.recoveryWins++;

            const remaining = hunt.balanceBeforeSequence - balance;
            pfx('✅ WIN', `RECOVERY +${(profit/100).toFixed(2)} Bal:${(balance/100).toFixed(2)}`);

            if (remaining <= 0) {
                pfx('🎉 RECOVERED', `Tutte le perdite recuperate!`);
                currentMode = MODE.WAIT;
                resetAllState();
            } else {
                recovery.targetRecovery = remaining;
            }
        } else {
            // LOSS
            balance -= recovery.currentBet;
            recovery.attempts++;
            recovery.targetRecovery += recovery.currentBet;
            stats.totalLosses++;
            stats.recoveryLosses++;

            pfx('❌ LOSS', `RECOVERY Attempt:${recovery.attempts}/${recoveryHighMaxAttempts}`);

            if (recovery.attempts >= recoveryHighMaxAttempts) {
                if (fibonacciEnabled) {
                    switchToFibonacci();
                } else {
                    pfx('LIMIT', `Recovery exhausted!`);
                    triggerCooldown();
                }
            }
        }
        return;
    }

    // ═══════ FIBONACCI RESULT ═══════
    if (currentMode === MODE.FIBONACCI) {
        const currentPayout = fib.useHighPayout ? fibonacciHighPayout : fibonacciLowPayout;

        if (lastGame.cashedAt && crash >= currentPayout) {
            // WIN
            const profit = Math.floor(lastGame.cashedAt * lastGame.wager) - lastGame.wager;
            balance += profit;
            stats.totalWins++;
            stats.fibonacciWins++;

            const remaining = hunt.balanceBeforeSequence - balance;
            pfx('✅ WIN', `FIBONACCI +${(profit/100).toFixed(2)} @${currentPayout}x`);

            if (remaining <= 0) {
                pfx('🎉 RECOVERED', `Fibonacci recovery complete!`);
                currentMode = MODE.WAIT;
                resetAllState();
            } else {
                fib.targetRecovery = remaining;
                // Move back in sequence on win
                fib.step = Math.max(0, fib.step - 2);
            }
        } else {
            // LOSS
            balance -= fib.currentBet;
            fib.targetRecovery += fib.currentBet;
            fib.step++;
            stats.totalLosses++;
            stats.fibonacciLosses++;

            // Alternate payout
            fib.useHighPayout = !fib.useHighPayout;

            pfx('❌ LOSS', `FIBONACCI Step:${fib.step}/${fibonacciMaxSteps}`);

            if (fib.step >= fibonacciMaxSteps) {
                pfx('LIMIT', `Fibonacci exhausted!`);
                stats.disasters++;
                triggerCooldown();
            }
        }
        return;
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODE SWITCHING
// ═══════════════════════════════════════════════════════════════════════════════

function switchToRecoveryHigh() {
    currentMode = MODE.RECOVERY_HIGH;
    recovery.attempts = 0;
    recovery.targetRecovery = hunt.totalLossesAmount;

    pfx('MODE', `HUNT → RECOVERY HIGH | ToRecover: ${(recovery.targetRecovery/100).toFixed(2)} @${recoveryHighPayout}x`);
}

function switchToFibonacci() {
    currentMode = MODE.FIBONACCI;
    fib.step = 0;
    fib.useHighPayout = false;
    fib.targetRecovery = recovery.targetRecovery || hunt.totalLossesAmount;

    pfx('MODE', `→ FIBONACCI FALLBACK | ToRecover: ${(fib.targetRecovery/100).toFixed(2)}`);
}

function triggerCooldown() {
    stats.disasters++;
    currentMode = MODE.COOLDOWN;
    stats.cooldownRemaining = cooldownGames;

    pfx('MODE', `→ COOLDOWN (${cooldownGames} games) | Disaster #${stats.disasters}`);
}

function calculateRecoveryBet() {
    const payoutMultiplier = recoveryHighPayout - 1.0;
    recovery.currentBet = Math.ceil(recovery.targetRecovery / payoutMultiplier);
    recovery.currentBet = Math.max(Math.ceil(recovery.currentBet / 100) * 100, 100);
}

function calculateFibonacciBet() {
    const fibMultiplier = FIBONACCI[Math.min(fib.step, FIBONACCI.length - 1)];
    fib.currentBet = huntBaseBet * fibMultiplier;
    fib.currentBet = Math.ceil(fib.currentBet / 100) * 100;
}

function resetHuntState() {
    hunt.consecutiveLosses = 0;
    hunt.currentBet = huntBaseBet;
    hunt.totalLossesAmount = 0;
    hunt.balanceBeforeSequence = balance;
    hunt.bonusAccumulated = 0;
}

function resetAllState() {
    resetHuntState();
    recovery.attempts = 0;
    recovery.currentBet = 0;
    recovery.targetRecovery = 0;
    fib.step = 0;
    fib.currentBet = 0;
    fib.useHighPayout = false;
    fib.targetRecovery = 0;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FINAL STATS
// ═══════════════════════════════════════════════════════════════════════════════

function printFinalStats() {
    const finalProfit = balance - initBalance;
    const profitPct = ((finalProfit / initBalance) * 100).toFixed(2);
    const winRate = stats.totalBets > 0 ? ((stats.totalWins / stats.totalBets) * 100).toFixed(1) : 0;
    const efficiency = currentRound > 0 ? ((stats.totalBets / currentRound) * 100).toFixed(1) : 0;

    log('');
    log('╔═══════════════════════════════════════════════════════════════════════════╗');
    log('║                       SUPER SMART v2.0 - RISULTATI                        ║');
    log('╚═══════════════════════════════════════════════════════════════════════════╝');
    log('');
    log('RISULTATO FINALE:');
    log('────────────────────────────────────────────────────────────────────────────');
    log(`   Initial:        ${(initBalance/100).toLocaleString()} bits`);
    log(`   Final:          ${(balance/100).toLocaleString()} bits`);
    log(`   Profit/Loss:    ${finalProfit >= 0 ? '+' : ''}${(finalProfit/100).toFixed(2)} bits (${profitPct}%)`);
    log('');
    log('EFFICIENZA:');
    log('────────────────────────────────────────────────────────────────────────────');
    log(`   Rounds:         ${currentRound} (${efficiency}% bet efficiency)`);
    log(`   Bets:           ${stats.totalBets}`);
    log(`   Wait Rounds:    ${stats.waitRounds}`);
    log(`   Win Rate:       ${winRate}%`);
    log(`   Max Win Streak: ${stats.maxWinStreak}`);
    log('');
    log('DETTAGLIO MODI:');
    log('────────────────────────────────────────────────────────────────────────────');
    log(`   HUNT:           ${stats.huntWins}W / ${stats.huntLosses}L`);
    log(`   RECOVERY:       ${stats.recoveryWins}W / ${stats.recoveryLosses}L`);
    log(`   FIBONACCI:      ${stats.fibonacciWins}W / ${stats.fibonacciLosses}L`);
    log(`   Disasters:      ${stats.disasters}`);
    log('');
    log('STATISTICHE CRASH:');
    log('────────────────────────────────────────────────────────────────────────────');
    log(`   Mean:           ${stats.mean.toFixed(2)}`);
    log(`   Median:         ${stats.median.toFixed(2)}`);
    log(`   P70 Delay:      ${stats.percentile70Delay.toFixed(1)} games`);
    log('');
    log('════════════════════════════════════════════════════════════════════════════');
}
