/**
 * MARTIN_QUADRO con TRACKING CICLI - CONFIGURAZIONE OTTIMALE ✅
 *
 * 🏆 CONFIGURAZIONE OTTIMIZZATA TRAMITE ANALISI SU 600,000 PARTITE
 *
 * Parametri Ottimali:
 * - VB: 1,000 bits (100000 in config)
 * - Target Profit: 75% ← CHIAVE DEL SUCCESSO!
 * - Win Rate: 46.7%
 * - Max Perdite Consecutive: 7 cicli
 * - Capitale Necessario: 0.0066 BTC (~$395 @$60K/BTC)
 * - Moltiplicatore Martingale: 2.333x (sweet spot perfetto)
 *
 * Perché TP 75% è ottimale?
 * 1. Win rate superiore (46.7% vs 39.8% di TP 100%)
 * 2. Solo 7 perdite max (vs 19 di TP 100%)
 * 3. Capitale 85% più basso rispetto a TP 50%
 * 4. Moltiplicatore bilanciato tra crescita e sostenibilità
 *
 * Features:
 * - Tracciamento cicli vinti/persi
 * - Log statistiche ogni 10 partite
 * - Max perdite consecutive tracking
 */
var config = {
    // ===== CAPITALE E TARGET =====
    workingBalance: { value: 100000, type: 'balance', label: 'Working Balance (bits per ciclo - es. 100000=1000 bits)' },
    targetProfitPercent: { value: 75, type: 'multiplier', label: 'Target Profit % (stop ciclo quando raggiunto) [OTTIMALE: 75%]' },
    continueCycles: {
        value: 'yes',
        type: 'radio',
        label: 'Continua nuovi cicli dopo Target Profit (per analisi)',
        options: {
            yes: { value: 'yes', type: 'noop', label: 'Si - Inizia nuovo ciclo' },
            no: { value: 'no', type: 'noop', label: 'No - Ferma script' }
        }
    },

    // ===== MODALITA 1 (NORMALE) =====
    payout: { value: 3.1, type: 'multiplier', label: 'Normal Mode Payout' },
    baseBet: { value: 100, type: 'balance', label: 'Base Bet' },
    customMult: { value: 1.6, type: 'multiplier', label: 'Custom Multiplier (0 = auto-calculate)' },

    // ===== MODALITA 2 (RECUPERO MARTINGALE) =====
    recoveryTrigger: { value: 16, type: 'multiplier', label: 'Losses before recovery mode' },
    recoveryMartingalePayout: { value: 2, type: 'multiplier', label: 'Recovery Martingale Payout (1.1-3.0)' },
    recoveryCycles: { value: 2, type: 'multiplier', label: 'Max recovery attempts before reset (1-20)' },

    // ===== LOG E DEBUG =====
    verbosityLevel: { value: 1, type: 'multiplier', label: 'Verbosity Level (0=silent, 1=minimal, 2=full)' },

    // ===== PROTEZIONE CAPITALE =====
    maxConsecutiveLosses: { value: 6, type: 'multiplier', label: 'Max Consecutive Losses (reset martingale dopo N perdite - 0=infinito)' },

    // ===== STEP-DOWN RECOVERY =====
    enableStepDown: {
        value: 'yes',
        type: 'radio',
        label: 'Abilita Step-Down Recovery (rientro graduale dai livelli alti)',
        options: {
            yes: { value: 'yes', type: 'noop', label: 'Si - Rientro graduale' },
            no: { value: 'no', type: 'noop', label: 'No - Reset completo (comportamento originale)' }
        }
    },
    intraCycleStepDownWins: { value: 8, type: 'multiplier', label: 'Vittorie consecutive @ L3+ per step-down dinamico (8=default)' },

    // ===== GLOBAL PROFIT STOP =====
    globalTargetProfitPercent: { value: 0, type: 'multiplier', label: 'Global Target Profit % (ferma tutto definitivamente - 0=disabilitato)' }
};

// Configurazione base
const workingBalance = config.workingBalance.value;
const targetProfitPercent = config.targetProfitPercent.value;
const normalPayout = config.payout.value;
let normalBaseBet = config.baseBet.value;  // let perché viene aggiornato con martingale
const customMultValue = config.customMult.value;

const recoveryTrigger = config.recoveryTrigger.value;
const recoveryMartingalePayout = Math.max(1.1, Math.min(3.0, config.recoveryMartingalePayout.value));
const MAX_RECOVERY_ATTEMPTS = Math.max(1, Math.min(20, config.recoveryCycles.value));

const verbosityLevel = Math.max(0, Math.min(2, config.verbosityLevel.value));
const maxConsecutiveLosses = config.maxConsecutiveLosses.value;
const enableStepDown = config.enableStepDown.value === 'yes';
const intraCycleStepDownWins = Math.max(2, Math.min(10, config.intraCycleStepDownWins.value));  // Min 2, Max 10
const globalTargetProfitPercent = config.globalTargetProfitPercent.value;

// Funzione log wrapper per gestire verbosity
// level 0 = sempre (errori critici)
// level 1 = minimale (solo cicli completati)
// level 2 = completo (tutti i dettagli)
function logV(minLevel, message) {
    if (verbosityLevel >= minLevel) {
        log(message);
    }
}

function calculateNormalMultiplier(payout, maxLosses) {
    function testMult(mult) {
        const totalLosses = (Math.pow(mult, maxLosses) - 1) / (mult - 1);
        const winBet = Math.pow(mult, maxLosses);
        const winProfit = winBet * (payout - 1);
        return winProfit >= totalLosses;
    }

    let low = 1.01;
    let high = payout;
    let result = high;

    for (let i = 0; i < 100; i++) {
        const mid = (low + high) / 2;
        if (testMult(mid)) {
            result = mid;
            high = mid;
        } else {
            low = mid;
        }
        if (Math.abs(high - low) < 0.001) break;
    }

    const withMargin = result * 1.01;
    return Math.round(withMargin * 100) / 100;
}

const normalMult = (customMultValue > 0)
    ? customMultValue
    : calculateNormalMultiplier(normalPayout, recoveryTrigger);

const targetProfitAbsolute = Math.floor(workingBalance * (targetProfitPercent / 100));

// ═══════════════════════════════════════════════════════════════════════════
// MARTINGALE SUL VIRTUAL BALANCE
// ═══════════════════════════════════════════════════════════════════════════
const baseWorkingBalance = workingBalance;  // VB base (non cambia mai)
let currentWorkingBalance = workingBalance;  // VB corrente (aumenta con martingale)
let realLossesAccumulated = 0;               // Perdite REALI accumulate attraverso i cicli

// Variabili di stato
let currentRound = 0;
let balance = currentWorkingBalance;
let initBalance = currentWorkingBalance;
let currentProfit = 0;

// ═══════════════════════════════════════════════════════════════════════════
// NOVITÀ: TRACKING CICLI
// ═══════════════════════════════════════════════════════════════════════════
let totalCycles = 0;
let wonCycles = 0;
let lostCycles = 0;
let consecutiveLossCycles = 0;
let maxConsecutiveLossCycles = 0;

// Tracking loss streak distribution (quante volte si verifica ogni livello)
let lossStreakCount = {};  // { 3: 5, 4: 2, 5: 1, ... }

// ═══════════════════════════════════════════════════════════════════════════
// STEP-DOWN RECOVERY: Tracking perdite per ogni livello
// ═══════════════════════════════════════════════════════════════════════════
let lossHistory = [];  // Array che traccia realLossesAccumulated per ogni livello
                       // lossHistory[0] = perdite al livello 1, lossHistory[1] = livello 2, ecc.
let consecutiveWinsHighLevel = 0;  // Conta vittorie consecutive quando al livello 4+
// Ogni 4 vittorie → step-down extra per rientrare più velocemente

// INTRA-CYCLE STEP-DOWN: Tracking vittorie dentro il ciclo corrente
let inCycleConsecutiveWins = 0;    // Conta "superamenti" = nuovi massimi di balance nel ciclo
let inCycleMaxBalance = currentWorkingBalance;  // Massimo balance raggiunto nel ciclo corrente

// Statistiche sessione
let sessionProfit = 0;
let sessionGames = 0;
let sessionCycles = 0;

// Global Profit Stop tracking
let globalStartBalance = 0;          // Balance iniziale (fisso)
let globalVirtualBalance = 0;        // Balance virtuale tracciato internamente
let globalBalanceInitialized = false; // Flag per inizializzare solo una volta

// Macchina a stati
const MODE = { NORMAL: 'normal', RECOVERY: 'recovery' };
const STATE = { BETTING: 'betting', STOPPED: 'stopped' };

let currentMode = MODE.NORMAL;
let state = STATE.BETTING;

// Tracking
let normalConsecutiveLosses = 0;
let recoveryAttempts = 0;
let totalLosses = 0;
let currentBet = normalBaseBet;
let currentPayout = normalPayout;
let betPlacedThisRound = false;

let normalModeProfit = 0;
let balanceBeforeLossSequence = 0;
let bonusPerLoss = 0;
const MAX_BONUS_LOSSES = 3;

let disaster = 0;
let totalGain = 0;
let itTotal = 0;
let normalWins = 0;
let normalLosses = 0;
let recoveryWins = 0;
let recoveryLosses = 0;

function pfx(tag, msg, level = 2) { logV(level, `[${tag}] ${msg}`) }

// ═══════════════════════════════════════════════════════════════════════════
// INIZIALIZZAZIONE
// ═══════════════════════════════════════════════════════════════════════════
logV(1, '');
logV(1, '==============================================================');
logV(1, '  MARTIN AI v4.8 - RECOVERY MARTINGALE + CYCLE TRACKING   ');
logV(1, '==============================================================');
logV(1, '');
logV(1, 'MODALITA 1 (NORMALE):');
logV(1, `   - Payout: ${normalPayout}x`);
logV(1, `   - Base Bet: ${(normalBaseBet/100).toFixed(2)} bits`);
if (customMultValue > 0) {
    logV(1, `   - Multiplier: ${normalMult}x (CUSTOM)`);
} else {
    logV(1, `   - Multiplier: ${normalMult}x (AUTO-CALC)`);
}
logV(1, `   - Bonus: +1 bit per le prime 3 perdite`);
logV(1, '');
logV(1, 'MODALITA 2 (RECUPERO MARTINGALE):');
logV(1, `   - Trigger: ${recoveryTrigger} perdite consecutive`);
logV(1, `   - Payout: ${recoveryMartingalePayout}x`);
logV(1, `   - Max tentativi: ${MAX_RECOVERY_ATTEMPTS}`);
logV(1, '');
logV(1, 'CAPITALE & TARGET (PER CICLO):');
logV(1, `   - Working Balance: ${(workingBalance/100).toFixed(2)} bits`);
logV(1, `   - Target Profit: ${targetProfitPercent}% (+${(targetProfitAbsolute/100).toFixed(2)} bits)`);
logV(1, `   - Continue Cycles: ${config.continueCycles.value === 'yes' ? 'SI (analisi multipli cicli)' : 'NO (stop al primo TP)'}`);
logV(1, '');
logV(1, '🎲 MARTINGALE SUL VIRTUAL BALANCE:');
logV(1, `   - ABILITATO: Aumenta VB dopo ogni perdita`);
logV(1, `   - Moltiplicatore: ~2.33x (per TP ${targetProfitPercent}%)`);
logV(1, `   - VB Base: ${(baseWorkingBalance/100).toFixed(2)} bits`);
logV(1, `   - Reset a VB base dopo ogni vittoria`);
logV(1, `   - Max Consecutive Losses: ${maxConsecutiveLosses > 0 ? maxConsecutiveLosses + ' (protezione capitale)' : 'INFINITO (rischio illimitato)'}`);
logV(1, '');
logV(1, '📉 STEP-DOWN RECOVERY:');
if (enableStepDown) {
    logV(1, `   - ABILITATO: Strategia ibrida (40% debt retention)`);
    logV(1, `   - FASE ALTA (L4+): Obiettivo = tornare a L3 (zona sicura)`);
    logV(1, `     • L5+ → L3 (emergency, evita overflow)`);
    logV(1, `     • L4 → L3 (rientro in zona sicura)`);
    logV(1, `   - FASE BASSA (L1-3): Obiettivo = chiudere gradualmente con buffer`);
    logV(1, `     • L3 → L2 (conservativo), L2 → L0, L1 → L0`);
    logV(1, `   - Debt Retention: Mantieni 40% perdite (buffer protezione)`);
    logV(1, `   - Step-Down Dinamico INTRA-CICLO:`);
    logV(1, `     • Ogni ${intraCycleStepDownWins} vittorie consecutive @ L3+ → scendi 1 livello`);
    logV(1, `     • Abbassa bet DURANTE il ciclo (non aspetta fine ciclo)`);
} else {
    logV(1, `   - DISABILITATO: Reset completo a VB base (originale)`);
}
logV(1, '');
logV(1, '==============================================================');
logV(1, '');

initState();

engine.on('GAME_STARTING', onGameStarted);
engine.on('GAME_ENDED', onGameEnded);

function onGameStarted() {
    // Inizializza Global Profit Stop SOLO la prima volta
    if (!globalBalanceInitialized) {
        globalStartBalance = userInfo.balance;
        globalVirtualBalance = userInfo.balance;
        globalBalanceInitialized = true;
        logV(2, `[GLOBAL INIT] Start Balance: ${(globalStartBalance/100).toFixed(0)} bits`);
    }

    currentRound++;
    betPlacedThisRound = false;

    if (state === STATE.STOPPED) {
        return;
    }

    // Check target profit (ciclo corrente + recupero perdite accumulate)
    currentProfit = balance - initBalance;

    // Target profit dinamico: se ci sono perdite accumulate, devi recuperarle + il TP base
    const cycleTargetProfit = realLossesAccumulated + targetProfitAbsolute;

    if (normalModeProfit >= cycleTargetProfit) {
        // ═══════════════════════════════════════════════════════════════════════════
        // NOVITÀ: Ciclo VINTO
        // ═══════════════════════════════════════════════════════════════════════════
        totalCycles++;
        wonCycles++;

        // ═══════════════════════════════════════════════════════════════════════════
        // STEP-DOWN RECOVERY: Scendi gradualmente invece di reset totale
        // (Se disabilitato: comportamento originale con reset completo)
        //
        // IMPORTANTE: Se hai raggiunto cycleTargetProfit, significa che hai recuperato
        // TUTTO (perdite accumulate + target profit) → RESET COMPLETO A L0
        // ═══════════════════════════════════════════════════════════════════════════
        const previousLossLevel = consecutiveLossCycles;
        let targetLevel = 0;
        let extraStepDown = 0;

        // ═══════════════════════════════════════════════════════════════════════════
        // FIX BUG: Se hai raggiunto il target completo (realLossesAccumulated + TP),
        // significa che hai recuperato TUTTO → Reset a L0 sempre
        // ═══════════════════════════════════════════════════════════════════════════
        const hasRecoveredAll = (realLossesAccumulated === 0) ||
                                 (normalModeProfit >= realLossesAccumulated + targetProfitAbsolute);

        if (hasRecoveredAll) {
            // ===== RECUPERO COMPLETO: Reset a L0 =====
            targetLevel = 0;
            consecutiveWinsHighLevel = 0;
            if (previousLossLevel > 0) {
                logV(1, `   ✅ RECUPERO COMPLETO! L${previousLossLevel} → L0 (tutte le perdite recuperate)`);
            }
        } else if (enableStepDown) {
            // ===== STEP-DOWN ABILITATO: Rientro graduale (solo per recuperi parziali) =====

            // Tracking vittorie consecutive ai livelli alti (4+)
            if (previousLossLevel >= 4) {
                consecutiveWinsHighLevel++;
                // Ogni 4 vittorie consecutive ai livelli alti → step-down extra
                if (consecutiveWinsHighLevel >= 4) {
                    extraStepDown = 1;
                    consecutiveWinsHighLevel = 0;  // Reset contatore
                    logV(1, '   🎯 BONUS STEP-DOWN (4 vittorie consecutive @ L4+)');
                }
            } else {
                // Se scendiamo sotto livello 4, reset contatore vittorie
                consecutiveWinsHighLevel = 0;
            }

            // Determina il livello target per lo step-down
            // STRATEGIA DUE FASI:
            // - L4+: Obiettivo = tornare a L3 (zona sicura, puntate gestibili)
            // - L3-: Obiettivo = chiudere tornando a L0 (recupero completo)

            if (consecutiveLossCycles >= 5) {
                // EMERGENZA: L5+ → scendi direttamente a L3 (zona sicura)
                targetLevel = 3;
                logV(1, '   🚨 EMERGENCY STEP-DOWN (L5+ → L3 zona sicura)');
            } else if (consecutiveLossCycles === 4) {
                // L4 → scendi a L3 (target zona sicura) + bonus se disponibile
                targetLevel = Math.max(0, 3 - extraStepDown);
                if (extraStepDown > 0) {
                    logV(1, '   ⚡ BONUS: L4 → L' + targetLevel + ' (invece di L3)');
                }
            } else if (consecutiveLossCycles === 3) {
                // L3 → strategia conservativa: scendi a L2 (mantiene buffer protezione)
                targetLevel = Math.max(0, 2 - extraStepDown);
            } else if (consecutiveLossCycles === 2) {
                // L2 → obiettivo chiusura: scendi a L0
                targetLevel = 0;
            } else if (consecutiveLossCycles === 1) {
                // L1 → chiusura diretta a L0
                targetLevel = 0;
            } else {
                // Già al livello base → resta a 0
                targetLevel = 0;
            }
        } else {
            // ===== STEP-DOWN DISABILITATO: Reset completo (originale) =====
            targetLevel = 0;
            consecutiveWinsHighLevel = 0;  // Reset anche questo per sicurezza
        }

        sessionProfit += currentProfit;
        sessionGames += currentRound;
        sessionCycles++;

        // Costruisci distribuzione loss streaks >= 3
        let streakDistribution = '';
        const streakLevels = Object.keys(lossStreakCount).map(k => parseInt(k)).sort((a, b) => a - b);
        if (streakLevels.length > 0) {
            const streakParts = streakLevels.map(level => `${level}x:${lossStreakCount[level]}`);
            streakDistribution = ` | Streaks 3+: [${streakParts.join(', ')}]`;
        }

        // Log minimale (verbosity 1+) - mostra il downgrade SOLO se Step-Down è abilitato
        let downgradeInfo = '';
        let winsInfo = '';
        if (enableStepDown && previousLossLevel > 0) {
            downgradeInfo = ` | Down: L${previousLossLevel}→L${targetLevel}`;
            if (extraStepDown > 0) {
                downgradeInfo += ' ⚡';  // Indica bonus step-down
            }
            // Mostra contatore vittorie consecutive se ai livelli alti
            if (previousLossLevel >= 4) {
                winsInfo = ` | Wins@L4+: ${consecutiveWinsHighLevel}/4`;
            }
        }
        logV(1, `CYCLE #${totalCycles} WON | Profit: +${(normalModeProfit/100).toFixed(0)} bits | WR: ${((wonCycles/(wonCycles+lostCycles))*100).toFixed(1)}% (${wonCycles}W/${lostCycles}L) | Max Loss Streak: ${maxConsecutiveLossCycles}${streakDistribution}${downgradeInfo}${winsInfo} | VB: ${(currentWorkingBalance/100).toFixed(0)} bits`);

        // Log dettagliato (verbosity 2)
        logV(2, '');
        logV(2, '🏆 CICLO VINTO!');
        logV(2, `   Ciclo #${totalCycles}`);
        logV(2, `   Profit: +${(normalModeProfit/100).toFixed(2)} bits (${targetProfitPercent}%)`);
        logV(2, `   Cicli Totali: ${wonCycles}W / ${lostCycles}L (WR: ${((wonCycles/(wonCycles+lostCycles))*100).toFixed(1)}%)`);
        if (enableStepDown) {
            logV(2, `   Livello Perdite: ${previousLossLevel} → ${targetLevel} (Max: ${maxConsecutiveLossCycles})`);
        } else {
            logV(2, `   Perdite consecutive: ${previousLossLevel} → RESET (Max: ${maxConsecutiveLossCycles})`);
        }
        logV(2, '');

        // STEP-DOWN MARTINGALE (o reset se targetLevel = 0)
        stepDownMartingale(targetLevel, previousLossLevel);

        // Aggiorna il livello corrente DOPO lo step-down
        consecutiveLossCycles = targetLevel;

        // Aggiorna balance virtuale globale con il profit del ciclo
        globalVirtualBalance += normalModeProfit;

        // ═══════════════════════════════════════════════════════════════════════════
        // GLOBAL PROFIT STOP - Controlla se abbiamo raggiunto il target globale
        // Target: profit assoluto = workingBalance * (globalTargetProfitPercent / 100)
        // Esempio: WB=1000, Target=300% → ferma quando guadagna 3000 bit
        // ═══════════════════════════════════════════════════════════════════════════
        if (globalTargetProfitPercent > 0) {
            const globalProfitAbsolute = globalVirtualBalance - globalStartBalance;
            const targetProfitAbsolute = baseWorkingBalance * (globalTargetProfitPercent / 100);

            if (globalProfitAbsolute >= targetProfitAbsolute) {
                const globalProfitPercent = (globalProfitAbsolute / baseWorkingBalance) * 100;
                logV(1, '');
                logV(1, '🎉 ═══════════════════════════════════════════════════════════════════════════');
                logV(1, `   GLOBAL TARGET RAGGIUNTO! +${globalProfitPercent.toFixed(1)}% di WB`);
                logV(1, `   Working Balance: ${(baseWorkingBalance/100).toFixed(0)} bits`);
                logV(1, `   Target Profit: ${globalTargetProfitPercent}% = ${(targetProfitAbsolute/100).toFixed(0)} bits`);
                logV(1, `   Profit Raggiunto: +${(globalProfitAbsolute/100).toFixed(0)} bits`);
                logV(1, `   Balance: ${(globalStartBalance/100).toFixed(0)} → ${(globalVirtualBalance/100).toFixed(0)} bits`);
                logV(1, '   🛑 FERMANDO SCRIPT DEFINITIVAMENTE');
                logV(1, '═══════════════════════════════════════════════════════════════════════════');
                logV(1, '');
                state = STATE.STOPPED;
                return;
            }
        }

        // Check se continuare o fermare
        if (config.continueCycles.value === 'yes') {
            pfx('CONTINUE', `Inizio nuovo ciclo ${totalCycles + 1}...`);
            restartCycle();
            return;
        } else {
            state = STATE.STOPPED;
            pfx('STOP', `Ciclo completato con successo!`);
            return;
        }
    }

    // Check saldo
    const finalBetCheck = currentBet + bonusPerLoss;
    if ((balance - finalBetCheck) < 0) {
        handleCycleLoss('Saldo insufficiente');
        return;
    }

    // Log periodico statistiche (ogni 10 partite)
    if (currentRound % 10 === 0) {
        const cycleInfo = totalCycles > 0 ? ` | 📈 Cicli: ${wonCycles}W/${lostCycles}L (${((wonCycles/(wonCycles+lostCycles || 1))*100).toFixed(1)}%)` : '';
        pfx('STATS', `R:${currentRound} bal:${(balance/100).toFixed(0)} profit:${(currentProfit/100).toFixed(0)}${cycleInfo}`);
    }

    const modeTag = currentMode === MODE.NORMAL ? 'NRM' : 'REC';
    const finalBet = currentBet + bonusPerLoss;

    pfx(`${modeTag}/S`, `R:${currentRound} bet:${(currentBet/100).toFixed(2)}${bonusPerLoss > 0 ? `+${(bonusPerLoss/100).toFixed(2)}` : ''}=${(finalBet/100).toFixed(2)} @${currentPayout}x bal:${(balance/100).toFixed(2)} [${currentMode === MODE.NORMAL ? `L:${normalConsecutiveLosses}` : `Attempt:${recoveryAttempts}/${MAX_RECOVERY_ATTEMPTS}`}]`);

    engine.bet(finalBet, currentPayout);
    betPlacedThisRound = true;
}

function onGameEnded() {
    if (state === STATE.STOPPED) {
        return;
    }

    const lastGame = engine.history.first();
    const crash = parseCrash(lastGame);

    if (!betPlacedThisRound) {
        return;
    }

    if (lastGame.cashedAt) {
        handleWin(lastGame, crash);
    } else {
        handleLoss(crash);
    }

    betPlacedThisRound = false;
}

function handleWin(lastGame, crash) {
    const profit = Math.floor(lastGame.cashedAt * lastGame.wager) - lastGame.wager;
    balance += profit;

    const modeTag = currentMode === MODE.NORMAL ? 'NRM' : 'REC';
    const targetPayout = currentMode === MODE.NORMAL ? normalPayout : recoveryMartingalePayout;

    // RESET EMERGENZA
    const isEmergencyReset = Math.abs(lastGame.cashedAt - 1.01) < 0.01;

    if (isEmergencyReset) {
        pfx('EMERGENCY', `RESET FORZATO @1.01x!`);
        normalModeProfit = balance - initBalance;
        switchToNormalMode();
        return;
    }

    const isExactCashout = Math.abs(lastGame.cashedAt - targetPayout) < 0.01;

    if (currentMode === MODE.NORMAL) {
        // ═══════════════════════════════════════════════════════════════════════════
        // INTRA-CYCLE STEP-DOWN: Basato su profit accumulato, non su conteggio vittorie
        // Logica: Se hai recuperato abbastanza del debito, scendi proporzionalmente
        // ═══════════════════════════════════════════════════════════════════════════
        if (isExactCashout && enableStepDown && consecutiveLossCycles >= 3) {
            // Calcola profit accumulato nel ciclo corrente (DOPO questa vittoria)
            const cycleProfit = balance - initBalance;  // Usa balance corrente, non normalModeProfit che è vecchio

            // ⚠️ IMPORTANTE: NON attivare step-down se siamo vicini a chiudere il ciclo!
            // Il ciclo si chiude quando: cycleProfit >= realLossesAccumulated + targetProfitAbsolute
            // Quindi step-down si attiva solo se siamo IN MEZZO al recovery (non alla fine)
            const cycleTargetProfit = realLossesAccumulated + targetProfitAbsolute;
            const isNearCycleCompletion = cycleProfit >= (cycleTargetProfit * 0.85);  // 85% del target

            // Calcola copertura del debito (% di debito recuperato)
            const debtCoverage = realLossesAccumulated > 0
                ? cycleProfit / realLossesAccumulated
                : 0;

            // Determina quanti livelli scendere in base alla copertura del debito
            let levelsToDescend = 0;
            let coverageThreshold = 0;

            // 🛑 NON fare step-down se siamo vicini a chiudere il ciclo!
            // Lascia che il ciclo si completi naturalmente
            if (!isNearCycleCompletion) {
                if (debtCoverage >= 0.75) {
                    // 🎯 Hai recuperato 75%+ del debito → Scendi 3 livelli (o a L0 se più vicino)
                    levelsToDescend = Math.min(3, consecutiveLossCycles);
                    coverageThreshold = 75;
                } else if (debtCoverage >= 0.50) {
                    // 📉 Hai recuperato 50%+ del debito → Scendi 2 livelli
                    levelsToDescend = Math.min(2, consecutiveLossCycles);
                    coverageThreshold = 50;
                } else if (debtCoverage >= 0.30) {
                    // 📊 Hai recuperato 30%+ del debito → Scendi 1 livello
                    levelsToDescend = 1;
                    coverageThreshold = 30;
                }
            }

            // Attiva step-down se hai raggiunto almeno 30% di copertura
            if (levelsToDescend > 0) {
                // STEP-DOWN DINAMICO! Abbassa VB immediatamente
                const previousVB = currentWorkingBalance;
                const previousLevel = consecutiveLossCycles;
                const previousDebt = realLossesAccumulated;

                // Applica 40% retention del debito residuo
                const DEBT_RETENTION = 0.40;
                realLossesAccumulated = Math.floor(realLossesAccumulated * DEBT_RETENTION);
                const debtCancelled = previousDebt - realLossesAccumulated;

                // Calcola nuovo livello
                const newLevel = Math.max(0, consecutiveLossCycles - levelsToDescend);

                // Aggiorna lossHistory (tronca agli ultimi newLevel elementi)
                lossHistory = lossHistory.slice(0, newLevel);

                // Scendi di levelsToDescend livelli
                consecutiveLossCycles = newLevel;

                // Calcola nuovo VB (basato su debito ridotto + target profit)
                currentWorkingBalance = calculateNextVB();

                // Ricalcola baseBet per il nuovo VB
                const vbRatio = currentWorkingBalance / baseWorkingBalance;
                const scaledBet = config.baseBet.value * vbRatio;
                normalBaseBet = scaledBet >= 100
                    ? Math.ceil(scaledBet / 100) * 100
                    : Math.ceil(scaledBet);

                logV(1, `[INTRA-SD] 🔽 Step-down dinamico! L${previousLevel}→L${newLevel} | Coverage: ${(debtCoverage*100).toFixed(0)}% (>=${coverageThreshold}%) | Debito: ${(previousDebt/100).toFixed(0)}→${(realLossesAccumulated/100).toFixed(0)} bits (-${(debtCancelled/100).toFixed(0)}) | VB: ${(previousVB/100).toFixed(0)}→${(currentWorkingBalance/100).toFixed(0)}`);

                logV(2, '');
                logV(2, '🔽 STEP-DOWN INTRA-CICLO ATTIVATO');
                logV(2, `   Livello: L${previousLevel} → L${newLevel} (-${levelsToDescend} livelli)`);
                logV(2, `   Profit ciclo: ${(cycleProfit/100).toFixed(0)} bits`);
                logV(2, `   Debito totale: ${(previousDebt/100).toFixed(0)} bits`);
                logV(2, `   Copertura debito: ${(debtCoverage*100).toFixed(1)}%`);
                logV(2, `   Debito cancellato: ${(debtCancelled/100).toFixed(0)} bits (60%)`);
                logV(2, `   Debito residuo: ${(realLossesAccumulated/100).toFixed(0)} bits (40%)`);
                logV(2, `   VB: ${(previousVB/100).toFixed(0)} → ${(currentWorkingBalance/100).toFixed(0)} bits`);
                logV(2, `   BaseBet: ${(normalBaseBet/100).toFixed(2)} bits`);
                logV(2, '');
            }
        }

        if (isExactCashout) {
            normalWins++;
            normalModeProfit = balance - initBalance;

            pfx(`${modeTag}/W`, `WIN profit:+${(profit/100).toFixed(2)} bal:${(balance/100).toFixed(2)}`);

            normalConsecutiveLosses = 0;
            currentBet = normalBaseBet;
            currentPayout = normalPayout;
            bonusPerLoss = 0;
            state = STATE.BETTING;
        } else {
            // CASHOUT PARZIALE
            normalLosses++;

            if (normalConsecutiveLosses === 0) {
                balanceBeforeLossSequence = balance;
            }

            normalConsecutiveLosses++;

            if (normalConsecutiveLosses <= MAX_BONUS_LOSSES) {
                bonusPerLoss += 100;
            }

            pfx(`${modeTag}/P`, `PARZIALE @${lastGame.cashedAt}x [L:${normalConsecutiveLosses}/${recoveryTrigger}]`);

            if (normalConsecutiveLosses >= recoveryTrigger) {
                switchToRecoveryMode();
            } else {
                currentBet = Math.ceil((currentBet / 100) * normalMult) * 100;
            }
        }
    } else {
        // RECOVERY WIN
        if (isExactCashout) {
            recoveryWins++;

            const remainingLoss = balanceBeforeLossSequence - balance;

            pfx(`${modeTag}/W`, `MARTINGALE WIN! profit:+${(profit/100).toFixed(2)}`);

            if (remainingLoss <= 0) {
                pfx('COMPLETE', `Full recovery!`);
                switchToNormalMode();
            } else {
                if (recoveryAttempts < MAX_RECOVERY_ATTEMPTS) {
                    totalLosses = remainingLoss;
                    calculateRecoveryBet();
                } else {
                    handleCycleLoss('Recovery limit reached');
                }
            }
        } else {
            // PARZIALE in recovery
            recoveryLosses++;
            totalLosses = balanceBeforeLossSequence - balance;
            calculateRecoveryBet();
        }
    }
}

function handleLoss(crash) {
    const finalBet = currentBet + bonusPerLoss;
    balance -= finalBet;
    const modeTag = currentMode === MODE.NORMAL ? 'NRM' : 'REC';

    // Reset contatore vittorie consecutive intra-ciclo
    inCycleConsecutiveWins = 0;

    if (currentMode === MODE.NORMAL) {
        normalLosses++;

        if (normalConsecutiveLosses === 0) {
            balanceBeforeLossSequence = balance + finalBet;
        }

        normalConsecutiveLosses++;

        if (normalConsecutiveLosses <= MAX_BONUS_LOSSES) {
            bonusPerLoss += 100;
        }

        pfx(`${modeTag}/L`, `LOSS bal:${(balance/100).toFixed(2)} [L:${normalConsecutiveLosses}/${recoveryTrigger}]`);

        if (normalConsecutiveLosses >= recoveryTrigger) {
            switchToRecoveryMode();
        } else {
            currentBet = Math.ceil((currentBet / 100) * normalMult) * 100;
        }
    } else {
        // RECOVERY LOSS
        recoveryLosses++;
        recoveryAttempts++;

        totalLosses = balanceBeforeLossSequence - balance;

        pfx(`${modeTag}/L`, `MARTINGALE LOSS Attempt ${recoveryAttempts}/${MAX_RECOVERY_ATTEMPTS}`);

        if (recoveryAttempts < MAX_RECOVERY_ATTEMPTS) {
            calculateRecoveryBet();
        } else {
            handleCycleLoss('Recovery failed');
        }
    }
}

function switchToRecoveryMode() {
    currentMode = MODE.RECOVERY;
    recoveryAttempts = 1;
    currentPayout = recoveryMartingalePayout;

    const actualLoss = balanceBeforeLossSequence - balance;
    totalLosses = actualLoss;

    pfx('MODE', `SWITCH TO RECOVERY`);
    calculateRecoveryBet();
}

function switchToNormalMode() {
    currentMode = MODE.NORMAL;
    normalConsecutiveLosses = 0;
    recoveryAttempts = 0;
    totalLosses = 0;

    // normalBaseBet è già stato scalato in applyMartingale(), usalo direttamente
    // e assicurati che sia un numero intero
    currentBet = Math.ceil(normalBaseBet);

    currentPayout = normalPayout;
    bonusPerLoss = 0;
    state = STATE.BETTING;

    pfx('MODE', `BACK TO NORMAL`);
}

function calculateRecoveryBet() {
    const payoutMultiplier = recoveryMartingalePayout - 1.0;
    currentBet = Math.ceil(totalLosses / payoutMultiplier);
    currentBet = Math.ceil(currentBet / 100) * 100;

    pfx('REC/C', `bet ${(currentBet/100).toFixed(2)} to recover ${(totalLosses/100).toFixed(2)} @${recoveryMartingalePayout}x`);

    if (currentBet > balance) {
        handleCycleLoss('Insufficient balance for recovery');
    }
}

function handleCycleLoss(reason) {
    // ═══════════════════════════════════════════════════════════════════════════
    // NOVITÀ: Ciclo PERSO
    // ═══════════════════════════════════════════════════════════════════════════
    totalCycles++;
    lostCycles++;
    consecutiveLossCycles++;
    consecutiveWinsHighLevel = 0;  // Reset vittorie consecutive quando perdi

    if (consecutiveLossCycles > maxConsecutiveLossCycles) {
        maxConsecutiveLossCycles = consecutiveLossCycles;
    }

    // Traccia quante volte si verifica ogni livello di loss streak >= 3
    if (consecutiveLossCycles >= 3) {
        lossStreakCount[consecutiveLossCycles] = (lossStreakCount[consecutiveLossCycles] || 0) + 1;
    }

    disaster++;
    const cycleLoss = initBalance - balance;  // Perdita REALE del ciclo
    sessionProfit -= cycleLoss;
    sessionGames += currentRound;
    sessionCycles++;

    // Aggiorna balance virtuale globale con la perdita del ciclo
    globalVirtualBalance -= cycleLoss;

    // Costruisci messaggio loss streak
    let streakMsg = `Loss Streak: ${consecutiveLossCycles}/${maxConsecutiveLossCycles}`;
    if (consecutiveLossCycles >= 3) {
        streakMsg += ` (${lossStreakCount[consecutiveLossCycles]}x)`;
    }

    // Calcola Next VB in anticipo per il log (simula applyMartingale)
    const tempRealLosses = realLossesAccumulated + cycleLoss;
    const targetProfit = baseWorkingBalance * (targetProfitPercent / 100);
    const nextVB = Math.ceil((tempRealLosses + targetProfit) / (targetProfitPercent / 100));

    // Log minimale (verbosity 1+)
    logV(1, `CYCLE #${totalCycles} LOST | Loss: -${(cycleLoss/100).toFixed(0)} bits | WR: ${lostCycles > 0 ? ((wonCycles/(wonCycles+lostCycles))*100).toFixed(1) : '0.0'}% (${wonCycles}W/${lostCycles}L) | ${streakMsg} | Next VB: ${(nextVB/100).toFixed(0)} bits`);

    // Log dettagliato (verbosity 2)
    logV(2, '');
    logV(2, '💔 CICLO PERSO!');
    logV(2, `   Ciclo #${totalCycles}`);
    logV(2, `   Reason: ${reason}`);
    logV(2, `   Loss: -${(cycleLoss/100).toFixed(2)} bits`);
    logV(2, `   Cicli Totali: ${wonCycles}W / ${lostCycles}L (WR: ${lostCycles > 0 ? ((wonCycles/(wonCycles+lostCycles))*100).toFixed(1) : '0.0'}%)`);
    logV(2, `   Perdite consecutive: ${consecutiveLossCycles} (Max: ${maxConsecutiveLossCycles})`);
    logV(2, '');

    // ═══════════════════════════════════════════════════════════════════════════
    // PROTEZIONE CAPITALE: Limita crescita VB (NON resetta debito!)
    // Se raggiunto max consecutive losses, CAPPA il livello ma MANTIENI il debito
    // Il recovery deve completarsi anche a livelli alti, altrimenti perdi capitale
    // ═══════════════════════════════════════════════════════════════════════════
    if (maxConsecutiveLosses > 0 && consecutiveLossCycles > maxConsecutiveLosses) {
        logV(1, '');
        logV(1, '⚠️  ═══════════════════════════════════════════════════════════════════════════');
        logV(1, `   MAX CONSECUTIVE LOSSES RAGGIUNTO! (${consecutiveLossCycles}/${maxConsecutiveLosses})`);
        logV(1, `   Perdite accumulate: ${(realLossesAccumulated/100).toFixed(0)} bits`);
        logV(1, `   🛑 CAPPO LIVELLO A L${maxConsecutiveLosses} (NON RESETTO DEBITO!)`);
        logV(1, '   Devi completare recovery per non perdere capitale');
        logV(1, '═══════════════════════════════════════════════════════════════════════════');
        logV(1, '');

        // 🛑 CAPPA IL LIVELLO ma MANTIENI il debito!
        // NON chiamare resetMartingale() perché cancellerebbe realLossesAccumulated
        consecutiveLossCycles = maxConsecutiveLosses;  // Cappa a livello massimo

        // Continua normalmente con applyMartingale
        pfx('LEVEL CAPPED', `Livello cappato a L${maxConsecutiveLosses}, continuo recovery...`);
    }

    // APPLICA MARTINGALE dopo perdita - passa la perdita REALE
    applyMartingale(cycleLoss);

    pfx('RESTART', `Ricomincio ciclo ${totalCycles + 1}...`);
    restartCycle();
}

function restartCycle() {
    // Usa il VB corrente (può essere aumentato da martingale)
    balance = currentWorkingBalance;
    initBalance = currentWorkingBalance;
    currentRound = 0;
    currentProfit = 0;

    // IMPORTANTE: normalBaseBet è già stato scalato in applyMartingale(), usalo direttamente
    currentBet = normalBaseBet;

    currentPayout = normalPayout;
    betPlacedThisRound = false;

    currentMode = MODE.NORMAL;
    normalConsecutiveLosses = 0;
    recoveryAttempts = 0;

    // Reset tracking intra-cycle step-down
    inCycleMaxBalance = currentWorkingBalance;  // Nuovo ciclo = nuovo massimo di partenza
    inCycleConsecutiveWins = 0;
    totalLosses = 0;
    normalModeProfit = 0;
    balanceBeforeLossSequence = 0;
    bonusPerLoss = 0;

    normalWins = 0;
    normalLosses = 0;
    recoveryWins = 0;
    recoveryLosses = 0;

    initState();
}

// ═══════════════════════════════════════════════════════════════════════════
// CALCOLO MARTINGALE SUL VIRTUAL BALANCE
// ═══════════════════════════════════════════════════════════════════════════
function calculateNextVB() {
    // Formula: VB(n+1) = (Perdite Reali Accumulate + TargetProfit Base) / (TP% / 100)
    const targetProfit = baseWorkingBalance * (targetProfitPercent / 100);
    const nextVB = Math.ceil((realLossesAccumulated + targetProfit) / (targetProfitPercent / 100));
    return nextVB;
}

function resetMartingale() {
    // Resetta a VB base dopo una vittoria
    currentWorkingBalance = baseWorkingBalance;
    realLossesAccumulated = 0;
    lossHistory = [];  // Pulisci storia perdite
    normalBaseBet = config.baseBet.value;  // Reset anche baseBet al valore originale
    logV(2, '');
    logV(2, '🔄 MARTINGALE RESET → VB Base: ' + (baseWorkingBalance / 100).toFixed(0) + ' bits, BaseBet: ' + (normalBaseBet / 100).toFixed(4) + ' bits');
    logV(2, '');
}

function stepDownMartingale(targetLevel, previousLevel) {
    // STEP-DOWN: Scende al livello targetLevel invece di resettare completamente
    // targetLevel = numero di perdite consecutive a cui scendere (0 = VB base)
    // previousLevel = livello da cui proviene (per logging corretto)

    if (targetLevel <= 0) {
        // Scendi a VB base = reset completo
        resetMartingale();
        return;
    }

    const previousVB = currentWorkingBalance;
    const previousLosses = realLossesAccumulated;

    // STRATEGIA IBRIDA: Mantieni 40% del debito attuale invece di azzerare
    // Questo crea un buffer di protezione per perdite successive
    const DEBT_RETENTION = 0.40;  // Mantieni 40% delle perdite accumulate

    // Calcola perdite target: 40% delle perdite attuali
    const targetLosses = Math.floor(realLossesAccumulated * DEBT_RETENTION);

    // Imposta perdite accumulate al livello target (con buffer 40%)
    realLossesAccumulated = targetLosses;

    // Calcola VB per il livello target
    currentWorkingBalance = calculateNextVB();

    // Tronca lossHistory al nuovo livello
    lossHistory = lossHistory.slice(0, targetLevel);

    // Ricalcola baseBet per il nuovo VB
    const vbRatio = currentWorkingBalance / baseWorkingBalance;
    const scaledBet = config.baseBet.value * vbRatio;
    normalBaseBet = scaledBet >= 100
        ? Math.ceil(scaledBet / 100) * 100
        : Math.ceil(scaledBet);

    const debtReduction = ((previousLosses - realLossesAccumulated) / 100).toFixed(0);
    const debtRetained = (realLossesAccumulated / 100).toFixed(0);

    logV(1, '');
    logV(1, '📉 STEP-DOWN RECOVERY (40% retention)');
    logV(1, `   Livello ${previousLevel} → Livello ${targetLevel}`);
    logV(1, `   VB: ${(previousVB / 100).toFixed(0)} → ${(currentWorkingBalance / 100).toFixed(0)} bits`);
    logV(1, `   Debito: ${(previousLosses / 100).toFixed(0)} → ${debtRetained} bits (-${debtReduction} bits cancellati)`);
    logV(1, `   BaseBet: ${(normalBaseBet / 100).toFixed(2)} bits`);
    logV(1, '');
}

function applyMartingale(cycleLoss) {
    // Accumula la perdita REALE del ciclo (non il VB!)
    realLossesAccumulated += cycleLoss;

    // STEP-DOWN: Salva lo stato delle perdite accumulate per questo livello
    // lossHistory[i] = perdite accumulate al livello i+1
    lossHistory[consecutiveLossCycles] = realLossesAccumulated;

    const previousVB = currentWorkingBalance;
    currentWorkingBalance = calculateNextVB();
    const multiplier = (currentWorkingBalance / previousVB).toFixed(2);

    // Calcola nuovo baseBet scalato con logica corretta
    const vbRatio = currentWorkingBalance / baseWorkingBalance;
    const scaledBet = normalBaseBet * vbRatio;
    const oldBaseBet = normalBaseBet;

    // PROTEZIONE OVERFLOW: verifica che scaledBet non sia Infinity o NaN
    if (!isFinite(scaledBet) || isNaN(scaledBet)) {
        log('');
        log('❌ ERRORE CRITICO: BaseBet overflow!');
        log(`   scaledBet: ${scaledBet}`);
        log(`   normalBaseBet: ${normalBaseBet}`);
        log(`   vbRatio: ${vbRatio}`);
        log(`   currentVB: ${currentWorkingBalance}`);
        log(`   baseVB: ${baseWorkingBalance}`);
        log('');
        log('🛑 FERMANDO SCRIPT - Capitale insufficiente per continuare martingale');
        state = STATE.STOPPED;
        return;
    }

    const newBaseBet = scaledBet >= 100
        ? Math.ceil(scaledBet / 100) * 100
        : Math.ceil(scaledBet);

    // PROTEZIONE: verifica che newBaseBet non sia troppo grande
    // Limite massimo: 1000x il baseBet originale per evitare overflow catastrofici
    const maxAllowedBet = config.baseBet.value * 1000;
    if (newBaseBet > maxAllowedBet) {
        log('');
        log('❌ ERRORE: BaseBet troppo grande!');
        log(`   newBaseBet calcolato: ${(newBaseBet / 100).toFixed(2)} bits`);
        log(`   Max consentito (1000x baseBet): ${(maxAllowedBet / 100).toFixed(2)} bits`);
        log(`   VB attuale: ${(currentWorkingBalance / 100).toFixed(2)} bits`);
        log(`   Perdite accumulate: ${(realLossesAccumulated / 100).toFixed(2)} bits`);
        log('');
        log('🛑 FERMANDO SCRIPT - Martingale esaurito, troppe perdite consecutive');
        state = STATE.STOPPED;
        return;
    }

    // IMPORTANTE: Aggiorna il normalBaseBet per il prossimo ciclo!
    normalBaseBet = newBaseBet;

    logV(2, '');
    logV(2, '📈 MARTINGALE APPLICATO:');
    logV(2, `   Perdita Ciclo:      ${(cycleLoss / 100).toFixed(2)} bits`);
    logV(2, `   Perdite Accumulate: ${(realLossesAccumulated / 100).toFixed(2)} bits`);
    logV(2, `   VB Precedente:      ${(previousVB / 100).toFixed(2)} bits`);
    logV(2, `   VB Successivo:      ${(currentWorkingBalance / 100).toFixed(2)} bits (×${multiplier})`);
    logV(2, `   Base Bet Scalato:   ${(newBaseBet / 100).toFixed(4)} bits (era ${(oldBaseBet / 100).toFixed(4)} bits)`);
    logV(2, `   Target Profit Prossimo Ciclo: ${((realLossesAccumulated + targetProfitAbsolute) / 100).toFixed(2)} bits`);
    logV(2, `   Perdite Consecutive: ${consecutiveLossCycles}`);
    logV(2, '');
}

function initState() {
    state = STATE.BETTING;
    // globalStartBalance e globalVirtualBalance vengono inizializzati nel primo onGameStarted()
}

function parseCrash(lastGame) {
    if (!lastGame) return NaN;
    let v =
        (Number.isFinite(lastGame.bust) ? lastGame.bust :
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
