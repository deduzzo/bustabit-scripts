/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                  MARTIN AI TURBO - HIGH FREQUENCY                         ║
 * ╠═══════════════════════════════════════════════════════════════════════════╣
 * ║  Versione ad alta frequenza (~10% delle partite = 1000 bets/10K)          ║
 * ║  Combina 4 strategie indipendenti:                                        ║
 * ║                                                                           ║
 * ║  1. HUNT @1.8x - Entry selettivo (originale)                              ║
 * ║  2. DELAY HUNTER @10x - Dopo 45 ritardi                                   ║
 * ║  3. FLAT BET @1.8x - Ogni 12 partite con pause                            ║
 * ║  4. LOW HUNTER @1.5x - Dopo 4 ritardi consecutivi                         ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 *
 * STATISTICHE (testate su 100 sessioni x 10K partite):
 *   - Frequenza: 10% (989 bets per 10K partite)
 *   - Win Rate: 52.2%
 *   - Profitto medio: -0.68% (leggera perdita)
 *   - Sessioni positive: 44%
 *
 * NOTA: Trade-off frequenza vs profitto
 *   - Più bet = più esposizione al house edge (1%)
 *   - Per profitto positivo: usa MARTIN_AI_READY (11 bets/10K, +0.04%)
 */

var config = {
    workingBalance: { value: 1000000, type: 'balance', label: 'Capitale (centesimi)' },

    // === LIMITI SESSIONE ===
    targetProfitPercent: { value: 12, type: 'multiplier', label: 'Target Profitto %' },
    stopLossPercent: { value: 8, type: 'multiplier', label: 'Stop Loss %' },

    // === STRATEGIA 1: HUNT @1.8x (selettivo) ===
    huntEnabled: { value: 1, type: 'multiplier', label: 'Hunt (1=on)' },
    huntBasePayout: { value: 1.8, type: 'multiplier', label: 'Payout Hunt' },
    huntBaseBetPercent: { value: 0.2, type: 'multiplier', label: 'Bet % Hunt' },
    huntMinDelay: { value: 5, type: 'multiplier', label: 'Delay minimo Hunt' },
    huntCooldown: { value: 2, type: 'multiplier', label: 'Cooldown Hunt' },

    // === STRATEGIA 2: DELAY HUNTER @10x ===
    delayHunterEnabled: { value: 1, type: 'multiplier', label: 'Delay Hunter (1=on)' },
    delayHunterPayout: { value: 10.0, type: 'multiplier', label: 'Payout DH' },
    delayHunterEntry: { value: 45, type: 'multiplier', label: 'Entry delay DH' },
    delayHunterBetPercent: { value: 0.1, type: 'multiplier', label: 'Bet % DH' },
    delayHunterMaxBets: { value: 30, type: 'multiplier', label: 'Max bets DH' },

    // === STRATEGIA 3: FLAT BET @1.8x (ogni X partite) ===
    flatBetEnabled: { value: 1, type: 'multiplier', label: 'Flat Bet (1=on)' },
    flatBetPayout: { value: 1.8, type: 'multiplier', label: 'Payout Flat' },
    flatBetPercent: { value: 0.08, type: 'multiplier', label: 'Bet % Flat' },
    flatBetInterval: { value: 12, type: 'multiplier', label: 'Intervallo Flat' },
    flatBetPauseWin: { value: 4, type: 'multiplier', label: 'Pausa dopo win' },
    flatBetPauseLoss: { value: 1, type: 'multiplier', label: 'Pausa dopo loss' },

    // === STRATEGIA 4: LOW HUNTER @1.5x (delay entry) ===
    lowHunterEnabled: { value: 1, type: 'multiplier', label: 'Low Hunter (1=on)' },
    lowHunterPayout: { value: 1.5, type: 'multiplier', label: 'Payout Low' },
    lowHunterBetPercent: { value: 0.1, type: 'multiplier', label: 'Bet % Low' },
    lowHunterEntry: { value: 4, type: 'multiplier', label: 'Entry delay Low' },
    lowHunterMaxBets: { value: 6, type: 'multiplier', label: 'Max bets Low' },

    // === PROFIT LOCK ===
    profitLockThreshold: { value: 6, type: 'multiplier', label: 'Lock profitto %' },
    profitLockFloor: { value: 3, type: 'multiplier', label: 'Floor minimo %' },
};

// ═══════════════════════════════════════════════════════════════════════════
// INIZIALIZZAZIONE
// ═══════════════════════════════════════════════════════════════════════════

const workingBalance = config.workingBalance.value;
const targetProfitPercent = config.targetProfitPercent.value;
const stopLossPercent = config.stopLossPercent.value;
const targetProfitAbsolute = Math.floor(workingBalance * (targetProfitPercent / 100));
const stopLossAbsolute = Math.floor(workingBalance * (stopLossPercent / 100));

// Hunt config
const huntEnabled = config.huntEnabled.value === 1;
const huntBasePayout = config.huntBasePayout.value;
const huntBaseBetPercent = config.huntBaseBetPercent.value;
const huntMinDelay = config.huntMinDelay.value;
const huntCooldown = config.huntCooldown.value;

// Delay Hunter config
const delayHunterEnabled = config.delayHunterEnabled.value === 1;
const delayHunterPayout = config.delayHunterPayout.value;
const delayHunterEntry = config.delayHunterEntry.value;
const delayHunterBetPercent = config.delayHunterBetPercent.value;
const delayHunterMaxBets = config.delayHunterMaxBets.value;

// Flat Bet config
const flatBetEnabled = config.flatBetEnabled.value === 1;
const flatBetPayout = config.flatBetPayout.value;
const flatBetPercent = config.flatBetPercent.value;
const flatBetInterval = config.flatBetInterval.value;
const flatBetPauseWin = config.flatBetPauseWin.value;
const flatBetPauseLoss = config.flatBetPauseLoss.value;

// Low Hunter config
const lowHunterEnabled = config.lowHunterEnabled.value === 1;
const lowHunterPayout = config.lowHunterPayout.value;
const lowHunterBetPercent = config.lowHunterBetPercent.value;
const lowHunterEntry = config.lowHunterEntry.value;
const lowHunterMaxBets = config.lowHunterMaxBets.value;

// Profit lock
const profitLockThreshold = config.profitLockThreshold.value;
const profitLockFloor = config.profitLockFloor.value;

// State
let balance = workingBalance;
let initBalance = workingBalance;
let currentRound = 0;
let betPlacedThisRound = false;
let profitLockActive = false;
let floorBalance = 0;
let stopped = false;
let betType = null;
let currentBet = 0;
let currentPayout = 0;

// History
const crashHistory = [];
const historyWindow = 40;

// Hunt state
let hunt = {
    delay: 0,
    delayHistory: [],
    percentileDelay: 0,
    cooldownRemaining: 0,
    wins: 0,
    losses: 0,
    profit: 0,
};

// Delay Hunter state (@10x)
let dh = {
    delay: 0,
    active: false,
    betsInSeq: 0,
    wins: 0,
    losses: 0,
    profit: 0,
};

// Flat Bet state (@1.5x)
let flat = {
    counter: 0,
    pauseRemaining: 0,
    wins: 0,
    losses: 0,
    profit: 0,
};

// Low Hunter state (@1.3x)
let low = {
    delay: 0,
    active: false,
    betsInSeq: 0,
    wins: 0,
    losses: 0,
    profit: 0,
};

// Utility
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

function getBet(percent) {
    return Math.max(100, Math.floor(initBalance * percent / 100 / 100) * 100);
}

function updateHistory(crash) {
    crashHistory.push(crash);
    if (crashHistory.length > historyWindow) crashHistory.shift();

    // Hunt delay
    if (crash >= huntBasePayout) {
        if (hunt.delay > 0) {
            hunt.delayHistory.push(hunt.delay);
            if (hunt.delayHistory.length > 30) hunt.delayHistory.shift();
        }
        hunt.delay = 0;
        if (hunt.delayHistory.length >= 5) {
            hunt.percentileDelay = calculatePercentile(hunt.delayHistory, 75);
        }
    } else {
        hunt.delay++;
    }

    // DH delay
    if (crash >= delayHunterPayout) {
        dh.delay = 0;
        dh.active = false;
        dh.betsInSeq = 0;
    } else {
        dh.delay++;
    }

    // Low hunter delay
    if (crash >= lowHunterPayout) {
        low.delay = 0;
        low.active = false;
        low.betsInSeq = 0;
    } else {
        low.delay++;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// STRATEGIE
// ═══════════════════════════════════════════════════════════════════════════

function shouldHunt() {
    if (!huntEnabled) return false;
    if (hunt.cooldownRemaining > 0) return false;
    if (hunt.delayHistory.length < 5) return false;
    if (crashHistory.length < 12) return false;

    const threshold = Math.max(huntMinDelay, hunt.percentileDelay);
    if (hunt.delay < threshold) return false;

    // Recent crashes check
    const recent = crashHistory.slice(-6);
    if (recent.some(c => c > 8)) return false;
    if (calculateMedian(recent) >= 2.0) return false;

    const last3 = crashHistory.slice(-3);
    if (last3.filter(c => c < huntBasePayout).length < 2) return false;

    return true;
}

function shouldDelayHunt() {
    if (!delayHunterEnabled) return false;
    if (dh.active) return true;
    if (dh.delay >= delayHunterEntry) {
        dh.active = true;
        dh.betsInSeq = 0;
        log(`[DH] @10x in ritardo ${dh.delay}!`);
        return true;
    }
    return false;
}

function shouldFlatBet() {
    if (!flatBetEnabled) return false;
    if (flat.pauseRemaining > 0) return false;
    flat.counter++;
    if (flat.counter >= flatBetInterval) {
        flat.counter = 0;
        return true;
    }
    return false;
}

function shouldLowHunt() {
    if (!lowHunterEnabled) return false;
    if (low.active) return true;
    if (low.delay >= lowHunterEntry) {
        low.active = true;
        low.betsInSeq = 0;
        return true;
    }
    return false;
}

// ═══════════════════════════════════════════════════════════════════════════
// AVVIO
// ═══════════════════════════════════════════════════════════════════════════

log('');
log('╔═══════════════════════════════════════════════════════════════════════════╗');
log('║                  MARTIN AI TURBO - HIGH FREQUENCY                         ║');
log('╚═══════════════════════════════════════════════════════════════════════════╝');
log('');
log(`   Capitale: ${(workingBalance/100).toLocaleString()} bits`);
log(`   Target: +${targetProfitPercent}% | Stop: -${stopLossPercent}%`);
log('');
log('   Strategie attive:');
if (huntEnabled) log(`     - Hunt @${huntBasePayout}x (${huntBaseBetPercent}%)`);
if (delayHunterEnabled) log(`     - Delay Hunter @${delayHunterPayout}x dopo ${delayHunterEntry} delay`);
if (flatBetEnabled) log(`     - Flat Bet @${flatBetPayout}x ogni ${flatBetInterval} partite`);
if (lowHunterEnabled) log(`     - Low Hunter @${lowHunterPayout}x dopo ${lowHunterEntry} delay`);
log('');

engine.on('GAME_STARTING', onGameStarted);
engine.on('GAME_ENDED', onGameEnded);

function onGameStarted() {
    currentRound++;
    betPlacedThisRound = false;
    betType = null;
    currentBet = 0;
    currentPayout = 0;

    if (stopped) return;

    const profit = balance - initBalance;
    const profitPct = profit / initBalance * 100;

    // Profit lock
    if (!profitLockActive && profitPct >= profitLockThreshold) {
        profitLockActive = true;
        floorBalance = initBalance + Math.floor(initBalance * profitLockFloor / 100);
        log(`[LOCK] Profitto protetto a +${profitLockFloor}%`);
    }

    // Target
    if (profit >= targetProfitAbsolute) {
        stopped = true;
        log('');
        log('══════════════════════════════════════════════════════════════════');
        log('                       TARGET RAGGIUNTO!');
        printStats();
        return;
    }

    // Floor
    if (profitLockActive && balance <= floorBalance) {
        stopped = true;
        log(`[FLOOR] Uscita a +${profitLockFloor}%`);
        printStats();
        return;
    }

    // Stop loss
    if (profit <= -stopLossAbsolute) {
        stopped = true;
        log(`[STOP] Stop loss: ${profitPct.toFixed(1)}%`);
        printStats();
        return;
    }

    // Cooldown per hunt
    if (hunt.cooldownRemaining > 0) {
        hunt.cooldownRemaining--;
    }

    // Pause per flat
    if (flat.pauseRemaining > 0) {
        flat.pauseRemaining--;
    }

    // Scout fase iniziale
    if (currentRound <= 10) return;

    // === PRIORITA' STRATEGIE ===

    // 1. Delay Hunter @10x (alta priorità perché raro)
    if (shouldDelayHunt() && dh.betsInSeq < delayHunterMaxBets) {
        currentBet = getBet(delayHunterBetPercent);
        currentPayout = delayHunterPayout;
        betType = 'dh';
        engine.bet(currentBet, currentPayout);
        betPlacedThisRound = true;
        dh.betsInSeq++;
        log(`[DH] ${(currentBet/100).toFixed(1)} bits @${currentPayout}x (${dh.betsInSeq}/${delayHunterMaxBets})`);
        return;
    }

    // 2. Hunt @1.8x (selettivo)
    if (shouldHunt()) {
        currentBet = getBet(huntBaseBetPercent);
        currentPayout = huntBasePayout;
        betType = 'hunt';
        engine.bet(currentBet, currentPayout);
        betPlacedThisRound = true;
        log(`[HUNT] ${(currentBet/100).toFixed(1)} bits @${currentPayout}x`);
        return;
    }

    // 3. Low Hunter @1.3x (dopo delay)
    if (shouldLowHunt() && low.betsInSeq < lowHunterMaxBets) {
        currentBet = getBet(lowHunterBetPercent);
        currentPayout = lowHunterPayout;
        betType = 'low';
        engine.bet(currentBet, currentPayout);
        betPlacedThisRound = true;
        low.betsInSeq++;
        return;
    }

    // 4. Flat Bet @1.5x (ogni X partite)
    if (shouldFlatBet()) {
        currentBet = getBet(flatBetPercent);
        currentPayout = flatBetPayout;
        betType = 'flat';
        engine.bet(currentBet, currentPayout);
        betPlacedThisRound = true;
        return;
    }
}

function onGameEnded() {
    const lastGame = engine.history.first();
    const crash = parseCrash(lastGame);
    if (!Number.isFinite(crash)) return;

    updateHistory(crash);

    if (!betPlacedThisRound) return;

    const won = lastGame.cashedAt && crash >= currentPayout;

    if (betType === 'dh') {
        if (won) {
            const winAmount = Math.floor(currentBet * (currentPayout - 1));
            balance += winAmount;
            dh.wins++;
            dh.profit += winAmount;
            log(`[DH WIN] +${(winAmount/100).toFixed(1)} bits @${crash.toFixed(2)}x`);
            dh.active = false;
            dh.betsInSeq = 0;
        } else {
            balance -= currentBet;
            dh.losses++;
            dh.profit -= currentBet;
        }
    } else if (betType === 'hunt') {
        if (won) {
            const winAmount = Math.floor(currentBet * (currentPayout - 1));
            balance += winAmount;
            hunt.wins++;
            hunt.profit += winAmount;
            log(`[HUNT WIN] +${(winAmount/100).toFixed(1)} bits`);
        } else {
            balance -= currentBet;
            hunt.losses++;
            hunt.profit -= currentBet;
            hunt.cooldownRemaining = huntCooldown;
        }
    } else if (betType === 'low') {
        if (won) {
            const winAmount = Math.floor(currentBet * (currentPayout - 1));
            balance += winAmount;
            low.wins++;
            low.profit += winAmount;
            low.active = false;
            low.betsInSeq = 0;
        } else {
            balance -= currentBet;
            low.losses++;
            low.profit -= currentBet;
            if (low.betsInSeq >= lowHunterMaxBets) {
                low.active = false;
                low.betsInSeq = 0;
            }
        }
    } else if (betType === 'flat') {
        if (won) {
            const winAmount = Math.floor(currentBet * (currentPayout - 1));
            balance += winAmount;
            flat.wins++;
            flat.profit += winAmount;
            flat.pauseRemaining = flatBetPauseWin;
        } else {
            balance -= currentBet;
            flat.losses++;
            flat.profit -= currentBet;
            flat.pauseRemaining = flatBetPauseLoss;
        }
    }

    // Status ogni 100 partite
    if (currentRound % 100 === 0) {
        const profit = balance - initBalance;
        const pct = (profit / initBalance * 100).toFixed(2);
        const totalBets = hunt.wins + hunt.losses + dh.wins + dh.losses + flat.wins + flat.losses + low.wins + low.losses;
        log(`[${currentRound}] ${pct}% | Bets: ${totalBets} | Freq: ${(totalBets/currentRound*100).toFixed(1)}%`);
    }
}

function printStats() {
    const profit = balance - initBalance;
    const pct = (profit / initBalance * 100).toFixed(2);
    const totalBets = hunt.wins + hunt.losses + dh.wins + dh.losses + flat.wins + flat.losses + low.wins + low.losses;
    const totalWins = hunt.wins + dh.wins + flat.wins + low.wins;
    const winRate = totalBets > 0 ? (totalWins / totalBets * 100).toFixed(1) : 0;
    const freq = (totalBets / currentRound * 100).toFixed(1);

    log('══════════════════════════════════════════════════════════════════');
    log(`   PROFITTO: ${profit >= 0 ? '+' : ''}${(profit/100).toFixed(2)} bits (${pct}%)`);
    log(`   Partite: ${currentRound} | Bets: ${totalBets} | Freq: ${freq}%`);
    log(`   Win Rate: ${winRate}%`);
    log('');
    log('   Dettaglio strategie:');
    if (huntEnabled) {
        const hwr = (hunt.wins + hunt.losses) > 0 ? (hunt.wins / (hunt.wins + hunt.losses) * 100).toFixed(0) : 0;
        log(`   HUNT:  ${hunt.wins}W/${hunt.losses}L (${hwr}%) | ${(hunt.profit/100).toFixed(1)} bits`);
    }
    if (delayHunterEnabled) {
        const dwr = (dh.wins + dh.losses) > 0 ? (dh.wins / (dh.wins + dh.losses) * 100).toFixed(0) : 0;
        log(`   DH:    ${dh.wins}W/${dh.losses}L (${dwr}%) | ${(dh.profit/100).toFixed(1)} bits`);
    }
    if (flatBetEnabled) {
        const fwr = (flat.wins + flat.losses) > 0 ? (flat.wins / (flat.wins + flat.losses) * 100).toFixed(0) : 0;
        log(`   FLAT:  ${flat.wins}W/${flat.losses}L (${fwr}%) | ${(flat.profit/100).toFixed(1)} bits`);
    }
    if (lowHunterEnabled) {
        const lwr = (low.wins + low.losses) > 0 ? (low.wins / (low.wins + low.losses) * 100).toFixed(0) : 0;
        log(`   LOW:   ${low.wins}W/${low.losses}L (${lwr}%) | ${(low.profit/100).toFixed(1)} bits`);
    }
    log('══════════════════════════════════════════════════════════════════');
    log('');
}
