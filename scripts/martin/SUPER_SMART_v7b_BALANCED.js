/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║          SUPER SMART v7b BALANCED - OTTIMIZZATO WIN + PROFITTO            ║
 * ╠═══════════════════════════════════════════════════════════════════════════╣
 * ║  Variante di v7 con target leggermente più alto per maggior profitto     ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 *
 * DIFFERENZE DA v7:
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * - Target: +15% (vs +12%) - più profitto per sessione
 * - Stop: -10% (vs -8%) - leggermente più margine
 * - Bet size: 0.40% (vs 0.35%) - leggermente più aggressivo
 * - Entry delay minimo: 5 (vs 6) - entra un po' più spesso
 *
 * Obiettivo: Mantenere Win Rate > 50% ma aumentare profitto medio
 */

var config = {
    workingBalance: { value: 1000000, type: 'balance', label: 'Working Balance' },

    // Target e Stop - PIÙ BILANCIATO
    targetProfitPercent: { value: 15, type: 'multiplier', label: 'Target +15%' },
    stopLossPercent: { value: 10, type: 'multiplier', label: 'Stop Loss -10%' },

    // Scout e History
    scoutGames: { value: 10, type: 'multiplier', label: 'Scout games' },
    historyWindow: { value: 40, type: 'multiplier', label: 'History window' },

    // Entry conditions - MENO RESTRITTIVE DI v7
    delayPercentile: { value: 75, type: 'multiplier', label: 'Delay percentile' },
    minDelayForEntry: { value: 5, type: 'multiplier', label: 'Min delay for entry' },
    maxRecentHighCrash: { value: 9, type: 'multiplier', label: 'Max high crash' },
    recentGamesCheck: { value: 6, type: 'multiplier', label: 'Recent check' },
    maxRecentMedian: { value: 2.1, type: 'multiplier', label: 'Max recent median' },

    // Hunt - SINGLE BET (no martingala)
    huntBaseBetPercent: { value: 0.40, type: 'multiplier', label: 'Base bet %' },
    huntMaxLosses: { value: 1, type: 'multiplier', label: 'Max losses (1=no martingala)' },
    huntBasePayout: { value: 1.8, type: 'multiplier', label: 'Base payout' },

    // Cooldown
    cooldownGames: { value: 3, type: 'multiplier', label: 'Cooldown games' },

    // Profit lock
    profitLockThreshold: { value: 10, type: 'multiplier', label: 'Lock at +10%' },
    profitLockFloor: { value: 5, type: 'multiplier', label: 'Floor at +5%' },

    // Sicurezza
    maxConsecutiveCooldowns: { value: 8, type: 'multiplier', label: 'Max cooldowns' },
    pauseAfterCooldowns: { value: 10, type: 'multiplier', label: 'Extra pause games' },
};

const workingBalance = config.workingBalance.value;
const targetProfitPercent = config.targetProfitPercent.value;
const stopLossPercent = config.stopLossPercent.value;
const targetProfitAbsolute = Math.floor(workingBalance * (targetProfitPercent / 100));
const stopLossAbsolute = Math.floor(workingBalance * (stopLossPercent / 100));

const scoutGames = config.scoutGames.value;
const historyWindow = config.historyWindow.value;
const delayPercentile = config.delayPercentile.value;
const minDelayForEntry = config.minDelayForEntry.value;
const maxRecentHighCrash = config.maxRecentHighCrash.value;
const recentGamesCheck = config.recentGamesCheck.value;
const maxRecentMedian = config.maxRecentMedian.value;

const huntBaseBetPercent = config.huntBaseBetPercent.value;
const huntMaxLosses = config.huntMaxLosses.value;
const huntBasePayout = config.huntBasePayout.value;

const cooldownGames = config.cooldownGames.value;

const profitLockThreshold = config.profitLockThreshold.value;
const profitLockFloor = config.profitLockFloor.value;

const maxConsecutiveCooldowns = config.maxConsecutiveCooldowns.value;
const pauseAfterCooldowns = config.pauseAfterCooldowns.value;

// State
const MODE = { SCOUT: 'scout', WAIT: 'wait', HUNT: 'hunt', COOLDOWN: 'cooldown', PAUSE: 'pause', STOPPED: 'stopped' };

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
    percentileDelay: 0,
    currentDelay: 0,
    scoutCount: 0,
    totalBets: 0,
    totalWins: 0,
    totalLosses: 0,
    waitRounds: 0,
    cooldownRemaining: 0,
    pauseRemaining: 0,
    huntSequences: 0,
    successfulHunts: 0,
    consecutiveCooldowns: 0,
    totalCooldowns: 0,
};

// Hunt state
let hunt = {
    consecutiveLosses: 0,
    currentBet: 0,
    currentPayout: huntBasePayout,
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

function calculateBaseBet() {
    return Math.max(100, Math.floor(initBalance * huntBaseBetPercent / 100 / 100) * 100);
}

function calculatePayout() {
    const profit = balance - initBalance;
    const progress = profit / targetProfitAbsolute;

    if (progress >= 0.7) return 1.5;
    if (progress >= 0.4) return 1.65;
    return huntBasePayout;
}

function updateStats(crash) {
    stats.crashHistory.push(crash);
    if (stats.crashHistory.length > historyWindow) stats.crashHistory.shift();

    const refPayout = huntBasePayout;
    if (crash >= refPayout) {
        if (stats.currentDelay > 0) {
            stats.delayHistory.push(stats.currentDelay);
            if (stats.delayHistory.length > 30) stats.delayHistory.shift();
        }
        stats.currentDelay = 0;
    } else {
        stats.currentDelay++;
    }

    if (stats.delayHistory.length >= 5) {
        stats.percentileDelay = calculatePercentile(stats.delayHistory, delayPercentile);
    }
}

function shouldEnterHunt() {
    if (stats.delayHistory.length < 5) return false;
    if (stats.crashHistory.length < 12) return false;

    const delayThreshold = Math.max(minDelayForEntry, stats.percentileDelay);
    const delayOK = stats.currentDelay >= delayThreshold;
    if (!delayOK) return false;

    const recentCrashes = stats.crashHistory.slice(-recentGamesCheck);
    const stableOK = !recentCrashes.some(c => c > maxRecentHighCrash);
    if (!stableOK) return false;

    const recentMedian = calculateMedian(recentCrashes);
    const medianOK = recentMedian < maxRecentMedian;
    if (!medianOK) return false;

    const overallMean = calculateMean(stats.crashHistory);
    const meanOK = overallMean < 2.8;
    if (!meanOK) return false;

    const lastCrash = stats.crashHistory[stats.crashHistory.length - 1];
    const lastCrashOK = lastCrash < huntBasePayout;
    if (!lastCrashOK) return false;

    // Condizione leggermente allentata: 2 su 4 invece di 2 su 3
    const last4 = stats.crashHistory.slice(-4);
    const lowCount = last4.filter(c => c < huntBasePayout).length;
    if (lowCount < 2) return false;

    return true;
}

// Init
log('');
log('╔═══════════════════════════════════════════════════════════════════════════╗');
log('║          SUPER SMART v7b BALANCED - WIN RATE + PROFITTO                   ║');
log('╚═══════════════════════════════════════════════════════════════════════════╝');
log('');
log(`   Balance: ${(workingBalance/100).toLocaleString()} | Target: +${targetProfitPercent}% | Stop: -${stopLossPercent}%`);
log(`   Hunt: @${huntBasePayout}x, single bet, ${huntBaseBetPercent}% per bet`);
log('');

engine.on('GAME_STARTING', onGameStarted);
engine.on('GAME_ENDED', onGameEnded);

function onGameStarted() {
    currentRound++;
    betPlacedThisRound = false;

    const profit = balance - initBalance;
    const profitPct = (profit / initBalance * 100);

    if (!profitLockActive && profitPct >= profitLockThreshold) {
        profitLockActive = true;
        floorBalance = initBalance + Math.floor(initBalance * profitLockFloor / 100);
        pfx('LOCK', `Attivato! Floor: +${profitLockFloor}%`);
    }

    if (profit >= targetProfitAbsolute) {
        currentMode = MODE.STOPPED;
        pfx('TARGET', `+${profitPct.toFixed(1)}% RAGGIUNTO!`);
        printStats();
        return;
    }

    if (profitLockActive && balance <= floorBalance) {
        currentMode = MODE.STOPPED;
        pfx('FLOOR', `Profit lock! +${profitPct.toFixed(1)}%`);
        printStats();
        return;
    }

    if (profit <= -stopLossAbsolute) {
        currentMode = MODE.STOPPED;
        pfx('STOP', `Stop loss! ${profitPct.toFixed(1)}%`);
        printStats();
        return;
    }

    if (currentMode === MODE.STOPPED) return;

    if (currentMode === MODE.SCOUT) {
        stats.scoutCount++;
        if (stats.scoutCount >= scoutGames) {
            currentMode = MODE.WAIT;
        }
        return;
    }

    if (currentMode === MODE.PAUSE) {
        stats.pauseRemaining--;
        if (stats.pauseRemaining <= 0) {
            stats.consecutiveCooldowns = 0;
            currentMode = MODE.WAIT;
        }
        return;
    }

    if (currentMode === MODE.COOLDOWN) {
        stats.cooldownRemaining--;
        if (stats.cooldownRemaining <= 0) {
            currentMode = MODE.WAIT;
        }
        return;
    }

    if (currentMode === MODE.WAIT) {
        stats.waitRounds++;
        if (shouldEnterHunt()) {
            currentMode = MODE.HUNT;
            stats.huntSequences++;
            hunt.consecutiveLosses = 0;
            hunt.currentBet = calculateBaseBet();
            hunt.currentPayout = calculatePayout();
            stats.waitRounds = 0;
            stats.consecutiveCooldowns = 0;
        }
        return;
    }

    if (currentMode === MODE.HUNT) {
        hunt.currentPayout = calculatePayout();

        if (balance < hunt.currentBet) {
            startCooldown();
            return;
        }

        engine.bet(hunt.currentBet, hunt.currentPayout);
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

    if (currentMode === MODE.HUNT) {
        if (lastGame.cashedAt && crash >= hunt.currentPayout) {
            const winAmount = Math.floor(lastGame.cashedAt * lastGame.wager) - lastGame.wager;
            balance += winAmount;
            stats.totalWins++;
            stats.successfulHunts++;
            currentMode = MODE.WAIT;
            hunt.consecutiveLosses = 0;
        } else {
            balance -= hunt.currentBet;
            hunt.consecutiveLosses++;
            stats.totalLosses++;
            startCooldown();
        }
        return;
    }
}

function startCooldown() {
    stats.consecutiveCooldowns++;
    stats.totalCooldowns++;

    if (stats.consecutiveCooldowns >= maxConsecutiveCooldowns) {
        currentMode = MODE.PAUSE;
        stats.pauseRemaining = pauseAfterCooldowns;
    } else {
        currentMode = MODE.COOLDOWN;
        stats.cooldownRemaining = cooldownGames;
    }

    hunt.consecutiveLosses = 0;
    hunt.currentBet = calculateBaseBet();
    hunt.currentPayout = huntBasePayout;
}

function printStats() {
    const profit = balance - initBalance;
    const pct = (profit / initBalance * 100).toFixed(2);
    const winRate = stats.totalBets > 0 ? (stats.totalWins / stats.totalBets * 100).toFixed(1) : 0;
    const efficiency = currentRound > 0 ? (stats.totalBets / currentRound * 100).toFixed(1) : 0;

    log('');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    log(`   Profit: ${profit >= 0 ? '+' : ''}${(profit/100).toFixed(2)} bits (${pct}%)`);
    log(`   Games: ${currentRound} | Bets: ${stats.totalBets} (${efficiency}%)`);
    log(`   Win Rate: ${winRate}% | W:${stats.totalWins} L:${stats.totalLosses}`);
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}
