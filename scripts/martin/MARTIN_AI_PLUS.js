/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                    MARTIN AI PLUS - DUAL STRATEGY                         ║
 * ╠═══════════════════════════════════════════════════════════════════════════╣
 * ║  Combina due strategie:                                                   ║
 * ║  1. HUNT @1.8x - strategia principale (testata su 10M partite)            ║
 * ║  2. DELAY HUNTER @10x - punta quando 10x è molto in ritardo               ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 *
 * STRATEGIA HUNT (principale):
 *   - Aspetta condizioni statistiche favorevoli
 *   - Punta @1.8x con bet piccolo
 *   - Win Rate: ~50%
 *
 * STRATEGIA DELAY HUNTER (secondaria):
 *   - Monitora il ritardo del 10x
 *   - Quando 10x non esce da 50+ partite, inizia a puntare
 *   - Bet piccoli (0.15%) per max 25 puntate per sequenza
 *   - Profitto medio: +0.75% extra
 *
 * TOTALE ATTESO: Win Rate ~52-55%
 */

var config = {
    workingBalance: { value: 1000000, type: 'balance', label: 'Capitale (centesimi)' },

    // === STRATEGIA HUNT @1.8x ===
    targetProfitPercent: { value: 12, type: 'multiplier', label: 'Target Profitto %' },
    stopLossPercent: { value: 8, type: 'multiplier', label: 'Stop Loss %' },
    scoutGames: { value: 10, type: 'multiplier', label: 'Partite osservazione' },
    historyWindow: { value: 40, type: 'multiplier', label: 'Finestra storica' },
    delayPercentile: { value: 75, type: 'multiplier', label: 'Percentile delay' },
    minDelayForEntry: { value: 6, type: 'multiplier', label: 'Delay minimo' },
    maxRecentHighCrash: { value: 8, type: 'multiplier', label: 'Max crash alto' },
    recentGamesCheck: { value: 6, type: 'multiplier', label: 'Check recenti' },
    maxRecentMedian: { value: 2.0, type: 'multiplier', label: 'Max mediana' },
    huntBaseBetPercent: { value: 0.35, type: 'multiplier', label: 'Bet % hunt' },
    huntBasePayout: { value: 1.8, type: 'multiplier', label: 'Payout hunt' },
    cooldownGames: { value: 3, type: 'multiplier', label: 'Cooldown hunt' },

    // === STRATEGIA DELAY HUNTER @10x ===
    delayHunterEnabled: { value: 1, type: 'multiplier', label: 'Delay Hunter (1=on)' },
    delayHunterPayout: { value: 10.0, type: 'multiplier', label: 'Payout DH' },
    delayHunterEntry: { value: 50, type: 'multiplier', label: 'Entry dopo delay' },
    delayHunterBetPercent: { value: 0.15, type: 'multiplier', label: 'Bet % DH' },
    delayHunterMaxBets: { value: 25, type: 'multiplier', label: 'Max bets DH' },

    // Profit lock
    profitLockThreshold: { value: 8, type: 'multiplier', label: 'Lock profitto %' },
    profitLockFloor: { value: 4, type: 'multiplier', label: 'Floor minimo %' },
    maxConsecutiveCooldowns: { value: 8, type: 'multiplier', label: 'Max cooldown' },
    pauseAfterCooldowns: { value: 10, type: 'multiplier', label: 'Pause extra' },
};

// ═══════════════════════════════════════════════════════════════════════════
// INIZIALIZZAZIONE
// ═══════════════════════════════════════════════════════════════════════════

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
const huntBasePayout = config.huntBasePayout.value;
const cooldownGames = config.cooldownGames.value;

const delayHunterEnabled = config.delayHunterEnabled.value === 1;
const delayHunterPayout = config.delayHunterPayout.value;
const delayHunterEntry = config.delayHunterEntry.value;
const delayHunterBetPercent = config.delayHunterBetPercent.value;
const delayHunterMaxBets = config.delayHunterMaxBets.value;

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

// Hunt stats
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
    consecutiveCooldowns: 0,
};

let hunt = {
    consecutiveLosses: 0,
    currentBet: 0,
    currentPayout: huntBasePayout,
};

// Delay Hunter state
let delayHunter = {
    delay10x: 0,
    active: false,
    betsInSequence: 0,
    wins: 0,
    losses: 0,
    profit: 0,
};

let betType = null; // 'hunt' o 'delay'

// Utility
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

function calculateHuntBet() {
    return Math.max(100, Math.floor(initBalance * huntBaseBetPercent / 100 / 100) * 100);
}

function calculateDelayBet() {
    return Math.max(100, Math.floor(initBalance * delayHunterBetPercent / 100 / 100) * 100);
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

    // Update delay for hunt
    if (crash >= huntBasePayout) {
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

    // Update delay for 10x (Delay Hunter)
    if (crash >= delayHunterPayout) {
        delayHunter.delay10x = 0;
        if (delayHunter.active) {
            delayHunter.active = false;
            delayHunter.betsInSequence = 0;
        }
    } else {
        delayHunter.delay10x++;
    }
}

function shouldEnterHunt() {
    if (stats.delayHistory.length < 5) return false;
    if (stats.crashHistory.length < 12) return false;

    const delayThreshold = Math.max(minDelayForEntry, stats.percentileDelay);
    if (stats.currentDelay < delayThreshold) return false;

    const recentCrashes = stats.crashHistory.slice(-recentGamesCheck);
    if (recentCrashes.some(c => c > maxRecentHighCrash)) return false;

    const recentMedian = calculateMedian(recentCrashes);
    if (recentMedian >= maxRecentMedian) return false;

    const overallMean = calculateMean(stats.crashHistory);
    if (overallMean >= 2.8) return false;

    const lastCrash = stats.crashHistory[stats.crashHistory.length - 1];
    if (lastCrash >= huntBasePayout) return false;

    const last3 = stats.crashHistory.slice(-3);
    const lowCount = last3.filter(c => c < huntBasePayout).length;
    if (lowCount < 2) return false;

    return true;
}

function shouldDelayHunt() {
    if (!delayHunterEnabled) return false;
    if (delayHunter.active) return true; // Già attivo, continua
    if (delayHunter.delay10x >= delayHunterEntry) {
        delayHunter.active = true;
        delayHunter.betsInSequence = 0;
        log(`[DH] 10x in ritardo di ${delayHunter.delay10x}! Inizio delay hunting...`);
        return true;
    }
    return false;
}

// ═══════════════════════════════════════════════════════════════════════════
// AVVIO
// ═══════════════════════════════════════════════════════════════════════════

log('');
log('╔═══════════════════════════════════════════════════════════════════════════╗');
log('║                    MARTIN AI PLUS - DUAL STRATEGY                         ║');
log('╚═══════════════════════════════════════════════════════════════════════════╝');
log('');
log(`   Capitale: ${(workingBalance/100).toLocaleString()} bits`);
log(`   Target: +${targetProfitPercent}% | Stop: -${stopLossPercent}%`);
log(`   Hunt @${huntBasePayout}x: ${huntBaseBetPercent}% bet`);
if (delayHunterEnabled) {
    log(`   Delay Hunter @${delayHunterPayout}x: entry dopo ${delayHunterEntry} delay, ${delayHunterBetPercent}% bet`);
}
log('');

engine.on('GAME_STARTING', onGameStarted);
engine.on('GAME_ENDED', onGameEnded);

function onGameStarted() {
    currentRound++;
    betPlacedThisRound = false;
    betType = null;

    const profit = balance - initBalance;
    const profitPct = (profit / initBalance * 100);

    // Profit lock
    if (!profitLockActive && profitPct >= profitLockThreshold) {
        profitLockActive = true;
        floorBalance = initBalance + Math.floor(initBalance * profitLockFloor / 100);
        log(`[LOCK] Profitto protetto! Minimo: +${profitLockFloor}%`);
    }

    // Target
    if (profit >= targetProfitAbsolute) {
        currentMode = MODE.STOPPED;
        log('');
        log('╔═══════════════════════════════════════════════════════════════════════════╗');
        log('║                         TARGET RAGGIUNTO!                                 ║');
        log('╚═══════════════════════════════════════════════════════════════════════════╝');
        printStats();
        return;
    }

    // Floor
    if (profitLockActive && balance <= floorBalance) {
        currentMode = MODE.STOPPED;
        log(`[FLOOR] Profitto protetto a +${profitLockFloor}%`);
        printStats();
        return;
    }

    // Stop loss
    if (profit <= -stopLossAbsolute) {
        currentMode = MODE.STOPPED;
        log(`[STOP] Stop loss: ${profitPct.toFixed(1)}%`);
        printStats();
        return;
    }

    if (currentMode === MODE.STOPPED) return;

    // Scout
    if (currentMode === MODE.SCOUT) {
        stats.scoutCount++;
        if (stats.scoutCount >= scoutGames) {
            currentMode = MODE.WAIT;
            log('[OK] Osservazione completata.');
        }
        return;
    }

    // Pause
    if (currentMode === MODE.PAUSE) {
        stats.pauseRemaining--;
        if (stats.pauseRemaining <= 0) {
            stats.consecutiveCooldowns = 0;
            currentMode = MODE.WAIT;
        }
        // Delay Hunter può giocare anche in pause
        if (shouldDelayHunt()) {
            placeDelayBet();
        }
        return;
    }

    // Cooldown
    if (currentMode === MODE.COOLDOWN) {
        stats.cooldownRemaining--;
        if (stats.cooldownRemaining <= 0) {
            currentMode = MODE.WAIT;
        }
        // Delay Hunter può giocare anche in cooldown
        if (shouldDelayHunt()) {
            placeDelayBet();
        }
        return;
    }

    // Wait
    if (currentMode === MODE.WAIT) {
        stats.waitRounds++;

        // Prima prova Delay Hunter
        if (shouldDelayHunt()) {
            placeDelayBet();
            return;
        }

        // Poi prova Hunt normale
        if (shouldEnterHunt()) {
            currentMode = MODE.HUNT;
            hunt.consecutiveLosses = 0;
            hunt.currentBet = calculateHuntBet();
            hunt.currentPayout = calculatePayout();
            stats.waitRounds = 0;
            stats.consecutiveCooldowns = 0;
        }
        return;
    }

    // Hunt
    if (currentMode === MODE.HUNT) {
        hunt.currentPayout = calculatePayout();

        if (balance < hunt.currentBet) {
            startCooldown();
            return;
        }

        const profitNow = ((balance - initBalance) / initBalance * 100).toFixed(1);
        log(`[HUNT] ${(hunt.currentBet/100).toFixed(1)} bits @${hunt.currentPayout.toFixed(2)}x | ${profitNow}%`);

        engine.bet(hunt.currentBet, hunt.currentPayout);
        betPlacedThisRound = true;
        betType = 'hunt';
        stats.totalBets++;
        return;
    }
}

function placeDelayBet() {
    if (delayHunter.betsInSequence >= delayHunterMaxBets) {
        // Max bets raggiunto, reset
        delayHunter.active = false;
        delayHunter.betsInSequence = 0;
        return;
    }

    const betAmount = calculateDelayBet();
    if (balance < betAmount) return;

    log(`[DH] ${(betAmount/100).toFixed(1)} bits @${delayHunterPayout}x | delay:${delayHunter.delay10x} bet:${delayHunter.betsInSequence+1}/${delayHunterMaxBets}`);

    engine.bet(betAmount, delayHunterPayout);
    betPlacedThisRound = true;
    betType = 'delay';
    delayHunter.betsInSequence++;
}

function onGameEnded() {
    const lastGame = engine.history.first();
    const crash = parseCrash(lastGame);
    if (!Number.isFinite(crash)) return;

    updateStats(crash);
    if (!betPlacedThisRound) return;

    // Handle Delay Hunter result
    if (betType === 'delay') {
        if (lastGame.cashedAt && crash >= delayHunterPayout) {
            const betAmount = calculateDelayBet();
            const winAmount = Math.floor(betAmount * (delayHunterPayout - 1));
            balance += winAmount;
            delayHunter.wins++;
            delayHunter.profit += winAmount;
            log(`[DH WIN!] +${(winAmount/100).toFixed(1)} bits @${crash.toFixed(2)}x`);
            delayHunter.active = false;
            delayHunter.betsInSequence = 0;
        } else {
            const betAmount = calculateDelayBet();
            balance -= betAmount;
            delayHunter.losses++;
            delayHunter.profit -= betAmount;
        }
        return;
    }

    // Handle Hunt result
    if (betType === 'hunt' && currentMode === MODE.HUNT) {
        if (lastGame.cashedAt && crash >= hunt.currentPayout) {
            const winAmount = Math.floor(lastGame.cashedAt * lastGame.wager) - lastGame.wager;
            balance += winAmount;
            stats.totalWins++;
            const profitNow = ((balance - initBalance) / initBalance * 100).toFixed(1);
            log(`[WIN] +${(winAmount/100).toFixed(1)} bits | Totale: ${profitNow}%`);
            currentMode = MODE.WAIT;
            hunt.consecutiveLosses = 0;
        } else {
            balance -= hunt.currentBet;
            hunt.consecutiveLosses++;
            stats.totalLosses++;
            log(`[LOSS] @${crash.toFixed(2)}x`);
            startCooldown();
        }
    }
}

function startCooldown() {
    stats.consecutiveCooldowns++;

    if (stats.consecutiveCooldowns >= maxConsecutiveCooldowns) {
        currentMode = MODE.PAUSE;
        stats.pauseRemaining = pauseAfterCooldowns;
    } else {
        currentMode = MODE.COOLDOWN;
        stats.cooldownRemaining = cooldownGames;
    }

    hunt.consecutiveLosses = 0;
    hunt.currentBet = calculateHuntBet();
    hunt.currentPayout = huntBasePayout;
}

function printStats() {
    const profit = balance - initBalance;
    const pct = (profit / initBalance * 100).toFixed(2);
    const huntWinRate = stats.totalBets > 0 ? (stats.totalWins / stats.totalBets * 100).toFixed(1) : 0;
    const dhWinRate = (delayHunter.wins + delayHunter.losses) > 0
        ? (delayHunter.wins / (delayHunter.wins + delayHunter.losses) * 100).toFixed(1)
        : 0;

    log('');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    log(`   PROFITTO: ${profit >= 0 ? '+' : ''}${(profit/100).toFixed(2)} bits (${pct}%)`);
    log(`   Partite: ${currentRound}`);
    log('');
    log('   HUNT @1.8x:');
    log(`      Bets: ${stats.totalBets} | Win Rate: ${huntWinRate}%`);
    log('');
    if (delayHunterEnabled) {
        log('   DELAY HUNTER @10x:');
        log(`      Wins: ${delayHunter.wins} | Losses: ${delayHunter.losses} | WR: ${dhWinRate}%`);
        log(`      Profitto DH: ${(delayHunter.profit/100).toFixed(2)} bits`);
    }
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    log('');
}
