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

// ═══════════════════════════════════════════════════════════════════════════
// COEFFICIENTE DINAMICO DI RIDUZIONE
// ═══════════════════════════════════════════════════════════════════════════
function getDynamicCoefficient(consecutiveLossCycles) {
    if (consecutiveLossCycles <= 3) return 1.00;      // 100% - crescita normale
    if (consecutiveLossCycles <= 5) return 0.90;      // 90%  - riduzione leggera
    if (consecutiveLossCycles <= 7) return 0.80;      // 80%  - riduzione media
    if (consecutiveLossCycles <= 10) return 0.70;     // 70%  - riduzione forte
    return 0.60;                                       // 60%  - riduzione massima
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
// MARTINGALE SUL VIRTUAL BALANCE CON COEFFICIENTE DINAMICO
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
// TRACKING CICLI
// ═══════════════════════════════════════════════════════════════════════════
let totalCycles = 0;
let wonCycles = 0;
let lostCycles = 0;
let consecutiveLossCycles = 0;
let maxConsecutiveLossCycles = 0;

// Tracking loss streak distribution (quante volte si verifica ogni livello)
let lossStreakCount = {};  // { 3: 5, 4: 2, 5: 1, ... }

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
logV(1, '  MARTIN AI v5.0 - DYNAMIC COEFFICIENT MITIGATION   ');
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
logV(1, '🎯 MARTINGALE MITIGATO (COEFFICIENTE DINAMICO):');
logV(1, `   - ABILITATO: Riduce crescita VB sui cicli alti`);
logV(1, `   - Cicli 1-3:  100% (crescita normale)`);
logV(1, `   - Cicli 4-5:  90%  (riduzione leggera)`);
logV(1, `   - Cicli 6-7:  80%  (riduzione media)`);
logV(1, `   - Cicli 8-10: 70%  (riduzione forte)`);
logV(1, `   - Cicli 11+:  60%  (riduzione massima)`);
logV(1, `   - VB Base: ${(baseWorkingBalance/100).toFixed(2)} bits`);
logV(1, `   - Reset a VB base dopo ogni vittoria`);
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
        // Ciclo VINTO
        // ═══════════════════════════════════════════════════════════════════════════
        totalCycles++;
        wonCycles++;
        consecutiveLossCycles = 0;

        sessionProfit += currentProfit;
        sessionGames += currentRound;
        sessionCycles++;

        // Log minimale (verbosity 1+)
        logV(1, `CYCLE #${totalCycles} WON | Profit: +${(normalModeProfit/100).toFixed(0)} bits | WR: ${((wonCycles/(wonCycles+lostCycles))*100).toFixed(1)}% (${wonCycles}W/${lostCycles}L) | Max Loss Streak: ${maxConsecutiveLossCycles} | VB: ${(currentWorkingBalance/100).toFixed(0)} bits`);

        // Log dettagliato (verbosity 2)
        logV(2, '');
        logV(2, '🏆 CICLO VINTO!');
        logV(2, `   Ciclo #${totalCycles}`);
        logV(2, `   Profit: +${(normalModeProfit/100).toFixed(2)} bits (${targetProfitPercent}%)`);
        logV(2, `   Cicli Totali: ${wonCycles}W / ${lostCycles}L (WR: ${((wonCycles/(wonCycles+lostCycles))*100).toFixed(1)}%)`);
        logV(2, `   Perdite consecutive: ${consecutiveLossCycles} (Max: ${maxConsecutiveLossCycles})`);
        logV(2, '');

        // RESET MARTINGALE dopo vittoria
        resetMartingale();

        // Aggiorna balance virtuale globale con il profit del ciclo
        globalVirtualBalance += normalModeProfit;

        // ═══════════════════════════════════════════════════════════════════════════
        // GLOBAL PROFIT STOP - Controlla se abbiamo raggiunto il target globale
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
    // Ciclo PERSO
    // ═══════════════════════════════════════════════════════════════════════════
    totalCycles++;
    lostCycles++;
    consecutiveLossCycles++;

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

    // CALCOLA coefficiente PRIMA di chiamare applyMartingale (serve il valore consecutiveLossCycles corrente)
    const coefficient = getDynamicCoefficient(consecutiveLossCycles);

    // Log minimale (verbosity 1+)
    logV(1, `CYCLE #${totalCycles} LOST | Loss: -${(cycleLoss/100).toFixed(0)} bits | WR: ${lostCycles > 0 ? ((wonCycles/(wonCycles+lostCycles))*100).toFixed(1) : '0.0'}% (${wonCycles}W/${lostCycles}L) | ${streakMsg} | Coeff: ${(coefficient*100).toFixed(0)}% | Next VB: TBD`);

    // Log dettagliato (verbosity 2)
    logV(2, '');
    logV(2, '💔 CICLO PERSO!');
    logV(2, `   Ciclo #${totalCycles}`);
    logV(2, `   Reason: ${reason}`);
    logV(2, `   Loss: -${(cycleLoss/100).toFixed(2)} bits`);
    logV(2, `   Cicli Totali: ${wonCycles}W / ${lostCycles}L (WR: ${lostCycles > 0 ? ((wonCycles/(wonCycles+lostCycles))*100).toFixed(1) : '0.0'}%)`);
    logV(2, `   Perdite consecutive: ${consecutiveLossCycles} (Max: ${maxConsecutiveLossCycles})`);
    logV(2, `   Coefficiente prossimo ciclo: ${(coefficient*100).toFixed(0)}%`);
    logV(2, '');

    // APPLICA MARTINGALE dopo perdita - passa la perdita REALE e il numero di cicli consecutivi persi
    applyMartingale(cycleLoss, consecutiveLossCycles);

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
// CALCOLO MARTINGALE SUL VIRTUAL BALANCE CON COEFFICIENTE DINAMICO
// ═══════════════════════════════════════════════════════════════════════════
function calculateNextVB(consecutiveLossCycles) {
    const targetProfit = baseWorkingBalance * (targetProfitPercent / 100);
    const coefficient = getDynamicCoefficient(consecutiveLossCycles);

    // Formula base: VB(n+1) = (Perdite Reali Accumulate + TargetProfit Base) / (TP% / 100)
    const baseIncrease = (realLossesAccumulated + targetProfit) / (targetProfitPercent / 100);

    // Applica coefficiente per mitigare l'aumento
    const mitigatedIncrease = baseWorkingBalance + ((baseIncrease - baseWorkingBalance) * coefficient);

    return Math.ceil(mitigatedIncrease);
}

function resetMartingale() {
    // Resetta a VB base dopo una vittoria
    currentWorkingBalance = baseWorkingBalance;
    realLossesAccumulated = 0;
    normalBaseBet = config.baseBet.value;  // Reset anche baseBet al valore originale
    log('');
    log('🔄 MARTINGALE RESET → VB Base: ' + (baseWorkingBalance / 100).toFixed(0) + ' bits, BaseBet: ' + (normalBaseBet / 100).toFixed(4) + ' bits');
    log('');
}

function applyMartingale(cycleLoss, consecutiveLossCycles) {
    // Accumula la perdita REALE del ciclo (non il VB!)
    realLossesAccumulated += cycleLoss;
    const previousVB = currentWorkingBalance;

    // Calcola prossimo VB con coefficiente dinamico
    currentWorkingBalance = calculateNextVB(consecutiveLossCycles);
    const multiplier = (currentWorkingBalance / previousVB).toFixed(2);
    const coefficient = getDynamicCoefficient(consecutiveLossCycles);

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

    log('');
    log('📈 MARTINGALE MITIGATO APPLICATO:');
    log(`   Perdita Ciclo:      ${(cycleLoss / 100).toFixed(2)} bits`);
    log(`   Perdite Accumulate: ${(realLossesAccumulated / 100).toFixed(2)} bits`);
    log(`   Perdite Consecutive: ${consecutiveLossCycles}`);
    log(`   Coefficiente:       ${(coefficient * 100).toFixed(0)}% (${coefficient >= 1.0 ? 'normale' : 'ridotto'})`);
    log(`   VB Precedente:      ${(previousVB / 100).toFixed(2)} bits`);
    log(`   VB Successivo:      ${(currentWorkingBalance / 100).toFixed(2)} bits (×${multiplier})`);
    log(`   Base Bet Scalato:   ${(newBaseBet / 100).toFixed(4)} bits (era ${(oldBaseBet / 100).toFixed(4)} bits)`);
    log(`   Target Profit Prossimo Ciclo: ${((realLossesAccumulated + targetProfitAbsolute) / 100).toFixed(2)} bits`);
    log('');
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
