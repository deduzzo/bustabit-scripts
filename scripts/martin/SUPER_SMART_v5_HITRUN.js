/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║              SUPER SMART v5.0 HIT & RUN - COLPISCI E SCAPPA               ║
 * ╠═══════════════════════════════════════════════════════════════════════════╣
 * ║  OBIETTIVO: Sessioni rapide con target realistico, uscita veloce          ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 *
 * FILOSOFIA:
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * "Non cercare il jackpot, cerca profitti costanti e piccoli"
 *
 * CARATTERISTICHE:
 * 1. Target BASSO (+20%) - più facile da raggiungere, uscita veloce
 * 2. Stop loss STRETTO (-15%) - limita le perdite
 * 3. NO session limit - corre finché non raggiunge target o stop
 * 4. COOLDOWN dopo perdite - pausa di N games dopo sequenza negativa
 * 5. Martingala MICRO - max 2 loss, poi reset (non recovery)
 * 6. Profit lock IMMEDIATO a +10%
 *
 * STRATEGIA:
 * - Scout breve (10 games)
 * - Entry selettivo (AND conditions)
 * - Martingala corta (2 step max)
 * - Se perdi 2 di fila → cooldown 5 games
 * - Nessun recovery aggressivo (accetta piccole perdite)
 * - Esci APPENA raggiungi +20%
 */

var config = {
    workingBalance: { value: 1000000, type: 'balance', label: 'Working Balance' },

    // Target e Stop
    targetProfitPercent: { value: 20, type: 'multiplier', label: 'Target +20%' },
    stopLossPercent: { value: 15, type: 'multiplier', label: 'Stop Loss -15%' },

    // Scout
    scoutGames: { value: 10, type: 'multiplier', label: 'Scout games' },
    historyWindow: { value: 40, type: 'multiplier', label: 'History window' },

    // Entry conditions
    delayPercentile: { value: 70, type: 'multiplier', label: 'Delay percentile' },
    minDelayForEntry: { value: 4, type: 'multiplier', label: 'Min delay for entry' },
    maxRecentHighCrash: { value: 12, type: 'multiplier', label: 'Max high crash' },
    recentGamesCheck: { value: 6, type: 'multiplier', label: 'Recent check' },

    // Hunt (micro-martingala)
    huntBaseBetPercent: { value: 0.5, type: 'multiplier', label: 'Base bet %' },
    huntMultiplier: { value: 1.5, type: 'multiplier', label: 'Hunt multiplier' },
    huntMaxLosses: { value: 2, type: 'multiplier', label: 'Max losses (then cooldown)' },
    huntPayout: { value: 2.0, type: 'multiplier', label: 'Hunt payout' },

    // Cooldown
    cooldownGames: { value: 5, type: 'multiplier', label: 'Cooldown after loss streak' },

    // Profit lock
    profitLockThreshold: { value: 10, type: 'multiplier', label: 'Lock at +10%' },
    profitLockFloor: { value: 5, type: 'multiplier', label: 'Floor at +5%' },
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

const huntBaseBetPercent = config.huntBaseBetPercent.value;
const huntMultiplier = config.huntMultiplier.value;
const huntMaxLosses = config.huntMaxLosses.value;
const huntPayout = config.huntPayout.value;

const cooldownGames = config.cooldownGames.value;

const profitLockThreshold = config.profitLockThreshold.value;
const profitLockFloor = config.profitLockFloor.value;

// State
const MODE = { SCOUT: 'scout', WAIT: 'wait', HUNT: 'hunt', COOLDOWN: 'cooldown', STOPPED: 'stopped' };

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
    huntSequences: 0,
    successfulHunts: 0,
};

// Hunt state
let hunt = {
    consecutiveLosses: 0,
    currentBet: 0,
    totalLossThisSequence: 0,
};

// Utility
function pfx(tag, msg) { log(`[${tag}] ${msg}`); }

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

// Dynamic base bet (0.5% of current balance, rounded)
function calculateBaseBet() {
    return Math.max(100, Math.floor(balance * huntBaseBetPercent / 100 / 100) * 100);
}

// Stats updater
function updateStats(crash) {
    stats.crashHistory.push(crash);
    if (stats.crashHistory.length > historyWindow) stats.crashHistory.shift();

    const refPayout = huntPayout;
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

// Entry decision (strict AND conditions)
function shouldEnterHunt() {
    // Must have enough delay data
    if (stats.delayHistory.length < 3) return false;

    // Condition 1: Current delay above threshold
    const delayThreshold = Math.max(minDelayForEntry, stats.percentileDelay);
    const delayOK = stats.currentDelay >= delayThreshold;

    // Condition 2: No super high crashes recently (indicates volatility)
    const recentCrashes = stats.crashHistory.slice(-recentGamesCheck);
    const stableOK = !recentCrashes.some(c => c > maxRecentHighCrash);

    // Condition 3: Recent median is reasonable
    const medianOK = calculateMedian(recentCrashes) < 2.5;

    // ALL conditions must be true
    return delayOK && stableOK && medianOK;
}

// Init
log('');
log('╔═══════════════════════════════════════════════════════════════════════════╗');
log('║              SUPER SMART v5.0 HIT & RUN - COLPISCI E SCAPPA               ║');
log('╚═══════════════════════════════════════════════════════════════════════════╝');
log('');
log(`   Balance: ${(workingBalance/100).toLocaleString()} | Target: +${targetProfitPercent}% | Stop: -${stopLossPercent}%`);
log(`   Hunt: @${huntPayout}x, max ${huntMaxLosses} loss | Cooldown: ${cooldownGames} games`);
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
        pfx('LOCK', `Attivato! Floor: +${profitLockFloor}%`);
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
        pfx('FLOOR', `Profit lock floor! +${profitPct.toFixed(1)}%`);
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

    // SCOUT
    if (currentMode === MODE.SCOUT) {
        stats.scoutCount++;
        if (stats.scoutCount >= scoutGames) {
            currentMode = MODE.WAIT;
            pfx('MODE', 'SCOUT → WAIT');
        }
        return;
    }

    // COOLDOWN
    if (currentMode === MODE.COOLDOWN) {
        stats.cooldownRemaining--;
        if (stats.cooldownRemaining <= 0) {
            currentMode = MODE.WAIT;
            pfx('MODE', 'COOLDOWN → WAIT');
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
            hunt.totalLossThisSequence = 0;
            pfx('MODE', `WAIT → HUNT (delay: ${stats.currentDelay})`);
            stats.waitRounds = 0;
        }
        return;
    }

    // HUNT
    if (currentMode === MODE.HUNT) {
        if (balance < hunt.currentBet) {
            pfx('ERR', 'Saldo insufficiente');
            currentMode = MODE.WAIT;
            resetHunt();
            return;
        }

        pfx('HUNT', `Bet:${(hunt.currentBet/100).toFixed(1)} @${huntPayout}x L:${hunt.consecutiveLosses} [${profitPct.toFixed(1)}%]`);

        engine.bet(hunt.currentBet, huntPayout);
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
        if (lastGame.cashedAt && crash >= huntPayout) {
            // WIN
            const winAmount = Math.floor(lastGame.cashedAt * lastGame.wager) - lastGame.wager;
            balance += winAmount;
            stats.totalWins++;
            stats.successfulHunts++;
            pfx('WIN', `+${(winAmount/100).toFixed(1)} Bal:${(balance/100).toFixed(1)}`);

            // Reset and go back to WAIT
            resetHunt();
            currentMode = MODE.WAIT;
        } else {
            // LOSS
            balance -= hunt.currentBet;
            hunt.totalLossThisSequence += hunt.currentBet;
            hunt.consecutiveLosses++;
            stats.totalLosses++;
            pfx('LOSS', `L:${hunt.consecutiveLosses}/${huntMaxLosses}`);

            if (hunt.consecutiveLosses >= huntMaxLosses) {
                // Max losses reached → COOLDOWN (no aggressive recovery)
                pfx('MODE', `HUNT → COOLDOWN (${cooldownGames} games)`);
                currentMode = MODE.COOLDOWN;
                stats.cooldownRemaining = cooldownGames;
                resetHunt();
            } else {
                // Increase bet for next attempt
                hunt.currentBet = Math.ceil((hunt.currentBet / 100) * huntMultiplier) * 100;
            }
        }
        return;
    }
}

function resetHunt() {
    hunt.consecutiveLosses = 0;
    hunt.currentBet = calculateBaseBet();
    hunt.totalLossThisSequence = 0;
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
    log(`   Win Rate: ${winRate}% | W:${stats.totalWins} L:${stats.totalLosses}`);
    log(`   Hunt Success: ${huntSuccessRate}% (${stats.successfulHunts}/${stats.huntSequences})`);
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}
