/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║              SUPER SMART v4.0 BALANCED - OTTIMIZZATO                      ║
 * ╠═══════════════════════════════════════════════════════════════════════════╣
 * ║  OBIETTIVO: Bilanciare rischio/rendimento per win rate più alto           ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 *
 * MIGLIORAMENTI DA v3.0 AGGRESSIVE:
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 1. huntMaxLosses: 5 → 3 (meno rischio per sequenza)
 * 2. huntMultiplier: 1.8 → 1.5 (progressione più lenta)
 * 3. maxSessionGames: 200 → 500 (più tempo per recuperare)
 * 4. Entry: OR → AND (tutte le condizioni devono essere vere)
 * 5. recoveryPayout: 8x → 5x (20% hit rate invece di 12.5%)
 * 6. profitLockThreshold: 25% → 15% (proteggi prima i guadagni)
 * 7. stopLossPercent: 20% → 30% (più margine per recuperare)
 *
 * STRATEGIA:
 * 1. SCOUT (20 games) - Raccolta dati iniziali
 * 2. WAIT - Attendi TUTTE le condizioni favorevoli
 * 3. HUNT - Martingala controllata (max 3 loss, x1.5)
 * 4. RECOVERY - Payout 5x per recupero più affidabile
 * 5. PROFIT LOCK - Blocca profitti a +15%
 */

var config = {
    workingBalance: { value: 1000000, type: 'balance', label: 'Working Balance' },
    targetProfitPercent: { value: 50, type: 'multiplier', label: 'Target +50%' },
    stopLossPercent: { value: 30, type: 'multiplier', label: 'Stop Loss -30%' },

    scoutGames: { value: 20, type: 'multiplier', label: 'Scout games' },
    historyWindow: { value: 50, type: 'multiplier', label: 'History window' },

    // Entry più selettivo (tutte le condizioni AND)
    delayPercentile: { value: 65, type: 'multiplier', label: 'Delay percentile' },
    maxRecentHighCrash: { value: 15, type: 'multiplier', label: 'Max high crash' },
    recentGamesCheck: { value: 8, type: 'multiplier', label: 'Recent check' },

    // Hunt più conservativo
    huntBaseBetPercent: { value: 0.8, type: 'multiplier', label: 'Base bet % of balance' },
    huntMultiplier: { value: 1.5, type: 'multiplier', label: 'Hunt multiplier' },
    huntMaxLosses: { value: 3, type: 'multiplier', label: 'Max losses' },

    // Recovery più affidabile
    recoveryPayout: { value: 5, type: 'multiplier', label: 'Recovery payout' },
    recoveryMaxAttempts: { value: 12, type: 'multiplier', label: 'Max recovery attempts' },

    // Sessione più lunga
    maxSessionGames: { value: 500, type: 'multiplier', label: 'Max games' },

    // Profit lock anticipato
    profitLockThreshold: { value: 15, type: 'multiplier', label: 'Lock at +15%' },
    profitLockFloor: { value: 10, type: 'multiplier', label: 'Floor at +10%' },
};

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

const huntBaseBetPercent = config.huntBaseBetPercent.value;
const huntMultiplier = config.huntMultiplier.value;
const huntMaxLosses = config.huntMaxLosses.value;

const recoveryPayout = config.recoveryPayout.value;
const recoveryMaxAttempts = config.recoveryMaxAttempts.value;

const maxSessionGames = config.maxSessionGames.value;

const profitLockThreshold = config.profitLockThreshold.value;
const profitLockFloor = config.profitLockFloor.value;

// State
const MODE = { SCOUT: 'scout', WAIT: 'wait', HUNT: 'hunt', RECOVERY: 'recovery', STOPPED: 'stopped' };

let currentMode = MODE.SCOUT;
let balance = workingBalance;
let initBalance = workingBalance;
let currentRound = 0;
let betPlacedThisRound = false;
let profitLockActive = false;
let floorBalance = 0;

// Stats
let stats = {
    crashHistory: [],
    delayHistory: [],
    mean: 0,
    median: 0,
    percentileDelay: 0,
    currentDelay: 0,
    scoutCount: 0,
    totalBets: 0,
    totalWins: 0,
    totalLosses: 0,
    waitRounds: 0,
    huntSequences: 0,
    successfulHunts: 0,
};

// Hunt state
let hunt = {
    consecutiveLosses: 0,
    currentBet: 0,
    currentPayout: 2.0,
    totalLossesAmount: 0,
    balanceBeforeSequence: 0,
};

// Recovery state
let recovery = {
    attempts: 0,
    currentBet: 0,
    targetRecovery: 0,
};

// Utility
function pfx(tag, msg) { log(`[${tag}] ${msg}`); }

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

// Profit-aware payout (più conservativo)
function calculatePayout() {
    const profit = balance - initBalance;
    const progress = profit / targetProfitAbsolute;

    if (progress >= 0.8) return 1.3;  // Quasi al target, chiudi sicuro
    if (progress >= 0.5) return 1.5;  // Buon progresso
    if (progress >= 0.2) return 1.8;  // Moderato
    if (hunt.consecutiveLosses >= 2) return 1.8;  // Dopo 2 loss, riduci rischio
    return 2.0;  // Base
}

// Dynamic base bet (0.8% of current balance)
function calculateBaseBet() {
    return Math.max(100, Math.floor(balance * huntBaseBetPercent / 100 / 100) * 100);
}

// Stats updater
function updateStats(crash) {
    stats.crashHistory.push(crash);
    if (stats.crashHistory.length > historyWindow) stats.crashHistory.shift();

    const refPayout = 2.0;
    if (crash >= refPayout) {
        if (stats.currentDelay > 0) {
            stats.delayHistory.push(stats.currentDelay);
            if (stats.delayHistory.length > 40) stats.delayHistory.shift();
        }
        stats.currentDelay = 0;
    } else {
        stats.currentDelay++;
    }

    if (stats.crashHistory.length >= 15) {
        stats.mean = calculateMean(stats.crashHistory);
        stats.median = calculateMedian(stats.crashHistory);
    }
    if (stats.delayHistory.length >= 5) {
        stats.percentileDelay = calculatePercentile(stats.delayHistory, delayPercentile);
    }
}

// Entry decision (TUTTE le condizioni devono essere vere - AND)
function shouldEnterHunt() {
    // Condizione 1: Delay sufficiente (siamo "in ritardo" per un 2x)
    const delayOK = stats.currentDelay >= Math.max(3, stats.percentileDelay);

    // Condizione 2: Nessun crash alto recente (stabilità)
    const recentCrashes = stats.crashHistory.slice(-recentGamesCheck);
    const stableOK = !recentCrashes.some(c => c > maxRecentHighCrash);

    // Condizione 3: Mediana recente ragionevole
    const medianOK = calculateMedian(recentCrashes) < 3.0;

    // Condizione 4: Almeno qualche delay registrato
    const hasDelayData = stats.delayHistory.length >= 3;

    // TUTTE le condizioni devono essere vere (AND)
    return delayOK && stableOK && medianOK && hasDelayData;
}

// Init
log('');
log('╔═══════════════════════════════════════════════════════════════════════════╗');
log('║              SUPER SMART v4.0 BALANCED - OTTIMIZZATO                      ║');
log('╚═══════════════════════════════════════════════════════════════════════════╝');
log('');
log(`   Balance: ${(workingBalance/100).toLocaleString()} | Target: +${targetProfitPercent}% | Stop: -${stopLossPercent}%`);
log(`   Hunt: max ${huntMaxLosses} loss, x${huntMultiplier} | Recovery: @${recoveryPayout}x`);
log(`   Profit Lock: +${profitLockThreshold}% → floor +${profitLockFloor}%`);
log('');

engine.on('GAME_STARTING', onGameStarted);
engine.on('GAME_ENDED', onGameEnded);

function onGameStarted() {
    currentRound++;
    betPlacedThisRound = false;

    const profit = balance - initBalance;
    const profitPct = (profit / initBalance * 100);

    // Profit lock check
    if (!profitLockActive && profitPct >= profitLockThreshold) {
        profitLockActive = true;
        floorBalance = initBalance + Math.floor(initBalance * profitLockFloor / 100);
        pfx('LOCK', `Profit lock attivato! Floor: ${(floorBalance/100).toFixed(2)} bits (+${profitLockFloor}%)`);
    }

    // Check stop conditions
    if (profit >= targetProfitAbsolute) {
        currentMode = MODE.STOPPED;
        pfx('TARGET', `+${profitPct.toFixed(1)}% RAGGIUNTO!`);
        printStats();
        return;
    }

    if (profitLockActive && balance <= floorBalance) {
        currentMode = MODE.STOPPED;
        pfx('LOCK', `Floor raggiunto! Profit: +${profitPct.toFixed(1)}%`);
        printStats();
        return;
    }

    if (profit <= -stopLossAbsolute) {
        currentMode = MODE.STOPPED;
        pfx('STOP', `Stop loss! ${profitPct.toFixed(1)}%`);
        printStats();
        return;
    }

    if (currentRound > maxSessionGames) {
        currentMode = MODE.STOPPED;
        pfx('TIME', `Max games! Profit: ${profitPct.toFixed(1)}%`);
        printStats();
        return;
    }

    if (currentMode === MODE.STOPPED) return;

    // SCOUT
    if (currentMode === MODE.SCOUT) {
        stats.scoutCount++;
        if (stats.scoutCount >= scoutGames) {
            currentMode = MODE.WAIT;
            pfx('MODE', `SCOUT → WAIT (delay data: ${stats.delayHistory.length})`);
        }
        return;
    }

    // WAIT
    if (currentMode === MODE.WAIT) {
        stats.waitRounds++;
        if (shouldEnterHunt()) {
            currentMode = MODE.HUNT;
            stats.huntSequences++;
            hunt.consecutiveLosses = 0;
            hunt.currentBet = calculateBaseBet();
            hunt.totalLossesAmount = 0;
            hunt.balanceBeforeSequence = balance;
            hunt.currentPayout = calculatePayout();
            pfx('MODE', `WAIT → HUNT (waited ${stats.waitRounds} rounds)`);
            stats.waitRounds = 0;
        }
        return;
    }

    // HUNT
    if (currentMode === MODE.HUNT) {
        hunt.currentPayout = calculatePayout();

        if (balance < hunt.currentBet) {
            pfx('ERR', 'Saldo insufficiente');
            currentMode = MODE.WAIT;
            resetHunt();
            return;
        }

        pfx('HUNT', `R:${currentRound} Bet:${(hunt.currentBet/100).toFixed(1)} @${hunt.currentPayout}x L:${hunt.consecutiveLosses} [${profitPct.toFixed(1)}%]`);

        engine.bet(hunt.currentBet, hunt.currentPayout);
        betPlacedThisRound = true;
        stats.totalBets++;
        return;
    }

    // RECOVERY
    if (currentMode === MODE.RECOVERY) {
        calcRecoveryBet();

        if (balance < recovery.currentBet) {
            pfx('ERR', 'Saldo insufficiente recovery');
            currentMode = MODE.WAIT;
            resetAll();
            return;
        }

        pfx('REC', `Attempt:${recovery.attempts}/${recoveryMaxAttempts} Bet:${(recovery.currentBet/100).toFixed(1)} @${recoveryPayout}x`);

        engine.bet(recovery.currentBet, recoveryPayout);
        betPlacedThisRound = true;
        stats.totalBets++;
        return;
    }
}

function onGameEnded() {
    const lastGame = engine.history.first();
    const crash = parseCrash(lastGame);
    if (!Number.isFinite(crash)) return;

    updateStats(crash);
    if (!betPlacedThisRound) return;

    // HUNT result
    if (currentMode === MODE.HUNT) {
        if (lastGame.cashedAt && crash >= hunt.currentPayout) {
            const profit = Math.floor(lastGame.cashedAt * lastGame.wager) - lastGame.wager;
            balance += profit;
            stats.totalWins++;
            stats.successfulHunts++;
            pfx('WIN', `+${(profit/100).toFixed(1)} Bal:${(balance/100).toFixed(1)}`);
            resetHunt();

            // Dopo una win, torna in WAIT per cercare nuovo entry
            currentMode = MODE.WAIT;
        } else {
            balance -= hunt.currentBet;
            hunt.totalLossesAmount += hunt.currentBet;
            hunt.consecutiveLosses++;
            stats.totalLosses++;
            pfx('LOSS', `L:${hunt.consecutiveLosses}/${huntMaxLosses}`);

            if (hunt.consecutiveLosses >= huntMaxLosses) {
                switchToRecovery();
            } else {
                hunt.currentBet = Math.ceil((hunt.currentBet / 100) * huntMultiplier) * 100;
            }
        }
        return;
    }

    // RECOVERY result
    if (currentMode === MODE.RECOVERY) {
        if (lastGame.cashedAt && crash >= recoveryPayout) {
            const profit = Math.floor(lastGame.cashedAt * lastGame.wager) - lastGame.wager;
            balance += profit;
            stats.totalWins++;
            const remaining = hunt.balanceBeforeSequence - balance;
            pfx('WIN', `Recovery +${(profit/100).toFixed(1)}`);

            if (remaining <= 0) {
                pfx('RECOVERED', 'Tutto recuperato!');
                stats.successfulHunts++;
                currentMode = MODE.WAIT;
                resetAll();
            } else {
                recovery.targetRecovery = remaining;
            }
        } else {
            balance -= recovery.currentBet;
            recovery.attempts++;
            recovery.targetRecovery += recovery.currentBet;
            stats.totalLosses++;
            pfx('LOSS', `Recovery ${recovery.attempts}/${recoveryMaxAttempts}`);

            if (recovery.attempts >= recoveryMaxAttempts) {
                pfx('LIMIT', 'Recovery esaurito');
                currentMode = MODE.WAIT;
                resetAll();
            }
        }
        return;
    }
}

function switchToRecovery() {
    currentMode = MODE.RECOVERY;
    recovery.attempts = 0;
    recovery.targetRecovery = hunt.totalLossesAmount;
    pfx('MODE', `HUNT → RECOVERY | ToRecover: ${(recovery.targetRecovery/100).toFixed(1)}`);
}

function calcRecoveryBet() {
    recovery.currentBet = Math.ceil(recovery.targetRecovery / (recoveryPayout - 1) / 100) * 100;
    recovery.currentBet = Math.max(100, recovery.currentBet);
}

function resetHunt() {
    hunt.consecutiveLosses = 0;
    hunt.currentBet = calculateBaseBet();
    hunt.totalLossesAmount = 0;
    hunt.balanceBeforeSequence = balance;
}

function resetAll() {
    resetHunt();
    recovery.attempts = 0;
    recovery.currentBet = 0;
    recovery.targetRecovery = 0;
}

function printStats() {
    const profit = balance - initBalance;
    const pct = (profit / initBalance * 100).toFixed(2);
    const winRate = stats.totalBets > 0 ? (stats.totalWins / stats.totalBets * 100).toFixed(1) : 0;
    const efficiency = currentRound > 0 ? (stats.totalBets / currentRound * 100).toFixed(1) : 0;
    const huntSuccessRate = stats.huntSequences > 0 ? (stats.successfulHunts / stats.huntSequences * 100).toFixed(1) : 0;

    log('');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    log(`   Profit: ${profit >= 0 ? '+' : ''}${(profit/100).toFixed(2)} bits (${pct}%)`);
    log(`   Games: ${currentRound} | Bets: ${stats.totalBets} (${efficiency}%)`);
    log(`   Win Rate: ${winRate}% | Wins: ${stats.totalWins} Losses: ${stats.totalLosses}`);
    log(`   Hunt Sequences: ${stats.huntSequences} | Success: ${huntSuccessRate}%`);
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}
