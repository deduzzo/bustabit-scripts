/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║          SUPER SMART v7.0 CONSERVATIVE - WIN RATE > 50%                   ║
 * ╠═══════════════════════════════════════════════════════════════════════════╣
 * ║  Ottimizzato per ALTA PROBABILITÀ di vincita, non alto profitto          ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 *
 * FILOSOFIA:
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * - Obiettivo: Win Rate > 50% su 10 milioni di sessioni
 * - Accettiamo guadagni piccoli (+10-15%) con alta probabilità
 * - Stop loss molto basso (-8%) per limitare le perdite
 * - Il vantaggio statistico nasce dal: (wins * avgWin) > (losses * avgLoss)
 *
 * MATEMATICA:
 * - Target: +12% → Guadagno medio per win: +1200 bits (su 10000)
 * - Stop: -8% → Perdita media per loss: -800 bits
 * - Se WinRate = 55%, Expected Value = 0.55*1200 - 0.45*800 = +300 bits/sessione
 *
 * PARAMETRI v7 (vs v6):
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * - Target: +12% (vs +30%) - più facile da raggiungere
 * - Stop: -8% (vs -25%) - uscita rapida se va male
 * - Bet size: 0.35% (vs 0.6%) - meno aggressivo
 * - Max losses: 1 (vs 2) - no martingala
 * - Payout: 1.8x (vs 2.0x) - più frequente
 * - Entry: ancora più selettivo (delay minimo 6)
 * - No cooldown lungo: 3 games (vs 8)
 * - Sessioni corte: target/stop più vicini
 */

var config = {
    workingBalance: { value: 1000000, type: 'balance', label: 'Working Balance' },

    // Target e Stop - CONSERVATIVO
    targetProfitPercent: { value: 12, type: 'multiplier', label: 'Target +12%' },
    stopLossPercent: { value: 8, type: 'multiplier', label: 'Stop Loss -8%' },

    // Scout e History - RAPIDO
    scoutGames: { value: 10, type: 'multiplier', label: 'Scout games' },
    historyWindow: { value: 40, type: 'multiplier', label: 'History window' },

    // Entry conditions - MOLTO SELETTIVE
    delayPercentile: { value: 75, type: 'multiplier', label: 'Delay percentile' },
    minDelayForEntry: { value: 6, type: 'multiplier', label: 'Min delay for entry' },
    maxRecentHighCrash: { value: 8, type: 'multiplier', label: 'Max high crash' },
    recentGamesCheck: { value: 6, type: 'multiplier', label: 'Recent check' },
    maxRecentMedian: { value: 2.0, type: 'multiplier', label: 'Max recent median' },

    // Hunt - SINGOLA PUNTATA (no martingala)
    huntBaseBetPercent: { value: 0.35, type: 'multiplier', label: 'Base bet %' },
    huntMaxLosses: { value: 1, type: 'multiplier', label: 'Max losses (1=no martingala)' },
    huntBasePayout: { value: 1.8, type: 'multiplier', label: 'Base payout' },

    // Cooldown - BREVE
    cooldownGames: { value: 3, type: 'multiplier', label: 'Cooldown games' },

    // Profit lock - RAPIDO
    profitLockThreshold: { value: 8, type: 'multiplier', label: 'Lock at +8%' },
    profitLockFloor: { value: 4, type: 'multiplier', label: 'Floor at +4%' },

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

// Hunt state (semplificato - single bet)
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

// Bet fisso (0.35% del balance iniziale per consistenza)
function calculateBaseBet() {
    return Math.max(100, Math.floor(initBalance * huntBaseBetPercent / 100 / 100) * 100);
}

// Payout dinamico più conservativo
function calculatePayout() {
    const profit = balance - initBalance;
    const progress = profit / targetProfitAbsolute;

    // Vicino al target = payout più sicuro
    if (progress >= 0.7) return 1.5;
    if (progress >= 0.4) return 1.65;
    // Default
    return huntBasePayout;
}

// Stats updater
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

// Entry decision - ESTREMAMENTE SELETTIVO
function shouldEnterHunt() {
    if (stats.delayHistory.length < 5) return false;
    if (stats.crashHistory.length < 12) return false;

    // Condizione 1: Delay alto (siamo "in ritardo" per un 1.8x)
    const delayThreshold = Math.max(minDelayForEntry, stats.percentileDelay);
    const delayOK = stats.currentDelay >= delayThreshold;
    if (!delayOK) return false;

    // Condizione 2: Nessun crash alto recente
    const recentCrashes = stats.crashHistory.slice(-recentGamesCheck);
    const stableOK = !recentCrashes.some(c => c > maxRecentHighCrash);
    if (!stableOK) return false;

    // Condizione 3: Mediana recente bassa
    const recentMedian = calculateMedian(recentCrashes);
    const medianOK = recentMedian < maxRecentMedian;
    if (!medianOK) return false;

    // Condizione 4: Media generale ragionevole
    const overallMean = calculateMean(stats.crashHistory);
    const meanOK = overallMean < 2.8;
    if (!meanOK) return false;

    // Condizione 5: Ultimo crash basso (trend ribassista)
    const lastCrash = stats.crashHistory[stats.crashHistory.length - 1];
    const lastCrashOK = lastCrash < huntBasePayout;
    if (!lastCrashOK) return false;

    // Condizione 6: Almeno 2 degli ultimi 3 crash sotto 1.8x
    const last3 = stats.crashHistory.slice(-3);
    const lowCount = last3.filter(c => c < huntBasePayout).length;
    if (lowCount < 2) return false;

    return true;
}

// Init
log('');
log('╔═══════════════════════════════════════════════════════════════════════════╗');
log('║          SUPER SMART v7.0 CONSERVATIVE - WIN RATE > 50%                   ║');
log('╚═══════════════════════════════════════════════════════════════════════════╝');
log('');
log(`   Balance: ${(workingBalance/100).toLocaleString()} | Target: +${targetProfitPercent}% | Stop: -${stopLossPercent}%`);
log(`   Hunt: @${huntBasePayout}x, single bet (no martingala)`);
log(`   Bet size: ${huntBaseBetPercent}% (${(calculateBaseBet()/100).toFixed(1)} bits)`);
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

    // SCOUT
    if (currentMode === MODE.SCOUT) {
        stats.scoutCount++;
        if (stats.scoutCount >= scoutGames) {
            currentMode = MODE.WAIT;
            pfx('MODE', 'SCOUT → WAIT');
        }
        return;
    }

    // PAUSE
    if (currentMode === MODE.PAUSE) {
        stats.pauseRemaining--;
        if (stats.pauseRemaining <= 0) {
            stats.consecutiveCooldowns = 0;
            currentMode = MODE.WAIT;
            pfx('MODE', 'PAUSE → WAIT');
        }
        return;
    }

    // COOLDOWN
    if (currentMode === MODE.COOLDOWN) {
        stats.cooldownRemaining--;
        if (stats.cooldownRemaining <= 0) {
            currentMode = MODE.WAIT;
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
            hunt.currentPayout = calculatePayout();
            stats.waitRounds = 0;
            stats.consecutiveCooldowns = 0;
        }
        return;
    }

    // HUNT
    if (currentMode === MODE.HUNT) {
        hunt.currentPayout = calculatePayout();

        if (balance < hunt.currentBet) {
            pfx('ERR', 'Saldo insufficiente');
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

    // HUNT result
    if (currentMode === MODE.HUNT) {
        if (lastGame.cashedAt && crash >= hunt.currentPayout) {
            // WIN
            const winAmount = Math.floor(lastGame.cashedAt * lastGame.wager) - lastGame.wager;
            balance += winAmount;
            stats.totalWins++;
            stats.successfulHunts++;

            // Torna in WAIT
            currentMode = MODE.WAIT;
            hunt.consecutiveLosses = 0;
        } else {
            // LOSS - singola puntata, vai in cooldown
            balance -= hunt.currentBet;
            hunt.consecutiveLosses++;
            stats.totalLosses++;

            // Max losses raggiunto → cooldown
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
    const huntSuccessRate = stats.huntSequences > 0 ? (stats.successfulHunts / stats.huntSequences * 100).toFixed(1) : 0;

    log('');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    log(`   Profit: ${profit >= 0 ? '+' : ''}${(profit/100).toFixed(2)} bits (${pct}%)`);
    log(`   Games: ${currentRound} | Bets: ${stats.totalBets} (${efficiency}%)`);
    log(`   Win Rate: ${winRate}% | W:${stats.totalWins} L:${stats.totalLosses}`);
    log(`   Hunt Success: ${huntSuccessRate}% (${stats.successfulHunts}/${stats.huntSequences})`);
    log(`   Cooldowns: ${stats.totalCooldowns}`);
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}
