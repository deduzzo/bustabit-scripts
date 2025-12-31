/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║              SUPER SMART v6.0 ULTIMATE - ALGORITMO FINALE                 ║
 * ╠═══════════════════════════════════════════════════════════════════════════╣
 * ║  Combinazione ottimale di v4 (profitto) e v5 (stabilità)                  ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 *
 * PARAMETRI OTTIMIZZATI (basati su analisi di 101 sessioni):
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * DA v4 BALANCED (punti forti: alto profitto quando vince):
 * - Payout dinamico basato su progresso verso target
 * - Entry selettivo con condizioni AND
 * - Profit lock a +15%
 *
 * DA v5 HITRUN (punti forti: bassa volatilità, controllo perdite):
 * - Cooldown dopo sequenza perdente (NO recovery aggressivo)
 * - Martingala corta (max 2 loss)
 * - Target realistico
 *
 * OTTIMIZZAZIONI v6:
 * - Target: +30% (bilanciato tra v4's +50% e v5's +20%)
 * - Stop loss: -25% (più margine per recuperare)
 * - Bet size: 0.6% del balance (ottimizzato)
 * - Payout base: 2.0x (più affidabile del 2.5x)
 * - Cooldown: 8 games (vs 5 di v5)
 * - Profit lock: +15% → floor +8%
 * - NO RECOVERY MODE (causa principale di bust in v4)
 * - Entry delay minimo: 5 (vs 3-4 precedenti)
 *
 * STRATEGIA:
 * 1. SCOUT (15 games) - Raccolta dati statistici
 * 2. WAIT - Attendi TUTTE le condizioni ottimali
 * 3. HUNT - Micro-martingala (max 2 loss, x1.4)
 * 4. COOLDOWN (8 games) - Dopo 2 loss consecutive
 * 5. REPEAT - Nessun recovery, solo cooldown e retry
 */

var config = {
    workingBalance: { value: 1000000, type: 'balance', label: 'Working Balance' },

    // Target e Stop - OTTIMIZZATI
    targetProfitPercent: { value: 30, type: 'multiplier', label: 'Target +30%' },
    stopLossPercent: { value: 25, type: 'multiplier', label: 'Stop Loss -25%' },

    // Scout e History
    scoutGames: { value: 15, type: 'multiplier', label: 'Scout games' },
    historyWindow: { value: 50, type: 'multiplier', label: 'History window' },

    // Entry conditions - PIÙ SELETTIVE
    delayPercentile: { value: 70, type: 'multiplier', label: 'Delay percentile' },
    minDelayForEntry: { value: 5, type: 'multiplier', label: 'Min delay for entry' },
    maxRecentHighCrash: { value: 10, type: 'multiplier', label: 'Max high crash' },
    recentGamesCheck: { value: 8, type: 'multiplier', label: 'Recent check' },
    maxRecentMedian: { value: 2.2, type: 'multiplier', label: 'Max recent median' },

    // Hunt - MICRO-MARTINGALA
    huntBaseBetPercent: { value: 0.6, type: 'multiplier', label: 'Base bet %' },
    huntMultiplier: { value: 1.4, type: 'multiplier', label: 'Hunt multiplier' },
    huntMaxLosses: { value: 2, type: 'multiplier', label: 'Max losses' },
    huntBasePayout: { value: 2.0, type: 'multiplier', label: 'Base payout' },

    // Cooldown - PIÙ LUNGO
    cooldownGames: { value: 8, type: 'multiplier', label: 'Cooldown games' },

    // Profit lock - ANTICIPATO
    profitLockThreshold: { value: 15, type: 'multiplier', label: 'Lock at +15%' },
    profitLockFloor: { value: 8, type: 'multiplier', label: 'Floor at +8%' },

    // Sicurezza
    maxConsecutiveCooldowns: { value: 5, type: 'multiplier', label: 'Max cooldowns before pause' },
    pauseAfterCooldowns: { value: 15, type: 'multiplier', label: 'Extra pause games' },
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
const huntMultiplier = config.huntMultiplier.value;
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
    totalLossThisSequence: 0,
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

// Dynamic base bet (0.6% of current balance)
function calculateBaseBet() {
    return Math.max(100, Math.floor(balance * huntBaseBetPercent / 100 / 100) * 100);
}

// Dynamic payout based on progress (DA v4)
function calculatePayout() {
    const profit = balance - initBalance;
    const progress = profit / targetProfitAbsolute;

    // Vicino al target = payout basso per sicurezza
    if (progress >= 0.8) return 1.5;
    if (progress >= 0.5) return 1.7;
    if (progress >= 0.2) return 1.9;
    // Dopo una loss, riduci rischio
    if (hunt.consecutiveLosses >= 1) return 1.8;
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
            if (stats.delayHistory.length > 40) stats.delayHistory.shift();
        }
        stats.currentDelay = 0;
    } else {
        stats.currentDelay++;
    }

    if (stats.delayHistory.length >= 5) {
        stats.percentileDelay = calculatePercentile(stats.delayHistory, delayPercentile);
    }
}

// Entry decision - MOLTO SELETTIVO (AND di tutte le condizioni)
function shouldEnterHunt() {
    // Deve avere abbastanza dati
    if (stats.delayHistory.length < 5) return false;
    if (stats.crashHistory.length < 15) return false;

    // Condizione 1: Delay sufficiente (siamo "in ritardo" per un 2x)
    const delayThreshold = Math.max(minDelayForEntry, stats.percentileDelay);
    const delayOK = stats.currentDelay >= delayThreshold;
    if (!delayOK) return false;

    // Condizione 2: Nessun crash alto recente (indica volatilità)
    const recentCrashes = stats.crashHistory.slice(-recentGamesCheck);
    const stableOK = !recentCrashes.some(c => c > maxRecentHighCrash);
    if (!stableOK) return false;

    // Condizione 3: Mediana recente ragionevole (no streak di alti)
    const recentMedian = calculateMedian(recentCrashes);
    const medianOK = recentMedian < maxRecentMedian;
    if (!medianOK) return false;

    // Condizione 4: Media generale non troppo alta
    const overallMean = calculateMean(stats.crashHistory);
    const meanOK = overallMean < 3.0;
    if (!meanOK) return false;

    // Condizione 5: Ultimo crash non era già un 2x+ (evita entry dopo win)
    const lastCrash = stats.crashHistory[stats.crashHistory.length - 1];
    const lastCrashOK = lastCrash < huntBasePayout;
    if (!lastCrashOK) return false;

    // TUTTE le condizioni soddisfatte
    return true;
}

// Init
log('');
log('╔═══════════════════════════════════════════════════════════════════════════╗');
log('║              SUPER SMART v6.0 ULTIMATE - ALGORITMO FINALE                 ║');
log('╚═══════════════════════════════════════════════════════════════════════════╝');
log('');
log(`   Balance: ${(workingBalance/100).toLocaleString()} | Target: +${targetProfitPercent}% | Stop: -${stopLossPercent}%`);
log(`   Hunt: @${huntBasePayout}x base, max ${huntMaxLosses} loss, x${huntMultiplier}`);
log(`   Cooldown: ${cooldownGames} games | Profit Lock: +${profitLockThreshold}%`);
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

    // PAUSE (dopo troppi cooldown consecutivi)
    if (currentMode === MODE.PAUSE) {
        stats.pauseRemaining--;
        if (stats.pauseRemaining <= 0) {
            stats.consecutiveCooldowns = 0;
            currentMode = MODE.WAIT;
            pfx('MODE', 'PAUSE → WAIT (reset)');
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
            hunt.currentPayout = calculatePayout();
            hunt.totalLossThisSequence = 0;
            pfx('MODE', `WAIT → HUNT (delay: ${stats.currentDelay}, waited: ${stats.waitRounds})`);
            stats.waitRounds = 0;
            stats.consecutiveCooldowns = 0; // Reset se entriamo in hunt
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

        const profitPctNow = ((balance - initBalance) / initBalance * 100).toFixed(1);
        pfx('HUNT', `Bet:${(hunt.currentBet/100).toFixed(1)} @${hunt.currentPayout.toFixed(1)}x L:${hunt.consecutiveLosses} [${profitPctNow}%]`);

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
            pfx('WIN', `+${(winAmount/100).toFixed(1)} Bal:${(balance/100).toFixed(1)}`);

            // Reset e torna in WAIT
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
                // Max losses → COOLDOWN (NO RECOVERY!)
                startCooldown();
            } else {
                // Increase bet per prossimo tentativo
                hunt.currentBet = Math.ceil((hunt.currentBet / 100) * huntMultiplier) * 100;
            }
        }
        return;
    }
}

function startCooldown() {
    stats.consecutiveCooldowns++;
    stats.totalCooldowns++;

    if (stats.consecutiveCooldowns >= maxConsecutiveCooldowns) {
        // Troppi cooldown consecutivi → PAUSE extra
        currentMode = MODE.PAUSE;
        stats.pauseRemaining = pauseAfterCooldowns;
        pfx('MODE', `HUNT → PAUSE (${pauseAfterCooldowns} games, troppi cooldown)`);
    } else {
        currentMode = MODE.COOLDOWN;
        stats.cooldownRemaining = cooldownGames;
        pfx('MODE', `HUNT → COOLDOWN (${cooldownGames} games)`);
    }

    resetHunt();
}

function resetHunt() {
    hunt.consecutiveLosses = 0;
    hunt.currentBet = calculateBaseBet();
    hunt.currentPayout = huntBasePayout;
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
    log(`   Cooldowns: ${stats.totalCooldowns}`);
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}
