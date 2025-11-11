/**
 * MARTIN AI v4.7 - RECOVERY CYCLES
 *
 * NUOVO PARAMETRO: recoveryCycles
 * - Numero massimo di step recovery da tentare prima di resettare
 * - Ogni step = recoveryPhases tentativi con bet fissa
 * - Se perdi almeno una volta in uno step → ricalcola bet e riprova
 * - Dopo recoveryCycles step falliti → RESET
 *
 * ESEMPIO con recoveryCycles=2, recoveryPhases=4:
 * STEP 1: 4 tentativi @ bet 208 (calcolata all'inizio)
 *   - Vinci tutte e 4 → recupero completo, torna a normale ✅
 *   - Perdi almeno una → vai allo STEP 2
 * STEP 2: 4 tentativi @ bet ricalcolata (con perdite aggiornate)
 *   - Vinci tutte e 4 → recupero completo ✅
 *   - Perdi almeno una → RESET (limite raggiunto)
 */

var config = {
    // ===== CAPITALE E TARGET =====
    workingBalance: { value: 2000000, type: 'balance', label: 'Working Balance (bits to use)' },
    targetProfitPercent: { value: 10, type: 'multiplier', label: 'Target Profit % (stop when reached)' },

    // ===== MODALITA 1 (NORMALE) =====
    payout: { value: 3.1, type: 'multiplier', label: 'Normal Mode Payout' },
    baseBet: { value: 100, type: 'balance', label: 'Base Bet' },
    mult: { value: 1.51, type: 'multiplier', label: 'Multiplier after loss' },

    // ===== MODALITA 2 (RECUPERO) =====
    recoveryTrigger: { value: 7, type: 'multiplier', label: 'Losses before recovery mode' },
    recoveryPayout: { value: 1.1, type: 'multiplier', label: 'Recovery Mode Payout' },
    recoveryPhases: { value: 4, type: 'multiplier', label: 'Number of recovery phases (divide losses)' },

    // NUOVO: Numero massimo di step recovery
    recoveryCycles: { value: 2, type: 'multiplier', label: 'Max recovery cycles before reset (1-10)' },
};

// Configurazione base
const workingBalance = config.workingBalance.value;
const targetProfitPercent = config.targetProfitPercent.value;
const normalPayout = config.payout.value;
const normalBaseBet = config.baseBet.value;
const normalMult = config.mult.value;

const recoveryTrigger = config.recoveryTrigger.value;
const recoveryPayout = config.recoveryPayout.value;
const RECOVERY_PHASES = config.recoveryPhases.value;
const MAX_RECOVERY_CYCLES = Math.max(1, Math.min(10, config.recoveryCycles.value)); // Clamp 1-10

// Calcolo target profit assoluto
const targetProfitAbsolute = Math.floor(workingBalance * (targetProfitPercent / 100));

// Variabili di stato
let currentRound = 0;
let balance = workingBalance;
let initBalance = workingBalance;
let currentProfit = 0;

// Statistiche sessione (somma di tutti i cicli)
let sessionProfit = 0;
let sessionGames = 0;
let sessionCycles = 0;

// Macchina a stati
const MODE = { NORMAL: 'normal', RECOVERY: 'recovery' };
const STATE = { BETTING: 'betting', STOPPED: 'stopped' };

let currentMode = MODE.NORMAL;
let state = STATE.BETTING;

// Tracking perdite e bet
let normalConsecutiveLosses = 0;
let recoveryAttempts = 0;
let totalLosses = 0;
let currentBet = normalBaseBet;
let currentPayout = normalPayout;
let betPlacedThisRound = false;

// Recovery partizionato in N fasi (configurabile)
let currentRecoveryPhase = 0; // Fase corrente (0 = non in recovery, 1-N = fasi attive)
let lossesToRecoverPerPhase = 0; // Perdite da recuperare in questa fase
let totalLossesAtRecoveryStart = 0; // Totale perdite all'inizio del recovery
let currentRecoveryCycle = 0; // NUOVO: Ciclo recovery corrente (1 a MAX_RECOVERY_CYCLES)

// Tracking profit separato per modalita
let normalModeProfit = 0;
let balanceBeforeLossSequence = 0;

// Bonus incrementale per aumentare profit (solo prime 3 puntate)
let bonusPerLoss = 0;
const MAX_BONUS_LOSSES = 3;

// Statistiche
let disaster = 0;
let totalGain = 0;
let itTotal = 0;
let normalWins = 0;
let normalLosses = 0;
let recoveryWins = 0;
let recoveryLosses = 0;

// Output functions
function pfx(tag, msg) { log(`[${tag}] ${msg}`) }

// ===== INIZIALIZZAZIONE =====
log('');
log('==============================================================');
log('  MARTIN AI v4.7 - RECOVERY CYCLES                         ');
log('==============================================================');
log('');
log('MODALITA 1 (NORMALE):');
log(`   - Payout: ${normalPayout}x`);
log(`   - Base Bet: ${(normalBaseBet/100).toFixed(2)} bits`);
log(`   - Multiplier: ${normalMult}x`);
log(`   - Bonus: +1 bit per le prime 3 perdite`);
log('');
log('MODALITA 2 (RECUPERO PARTIZIONATO CON CICLI):');
log(`   - Trigger: ${recoveryTrigger} perdite consecutive`);
log(`   - Payout: ${recoveryPayout}x`);
log(`   - Fasi per ciclo: ${RECOVERY_PHASES}`);
log(`   - Cicli massimi: ${MAX_RECOVERY_CYCLES}`);
log('');
log('CAPITALE & TARGET:');
log(`   - Working Balance: ${(workingBalance/100).toFixed(2)} bits`);
log(`   - Target Profit: ${targetProfitPercent}% (+${(targetProfitAbsolute/100).toFixed(2)} bits)`);
log(`   - Stop at: ${((workingBalance + targetProfitAbsolute)/100).toFixed(2)} bits`);
log('');
log('FUNZIONE EMERGENZA:');
log('   - Cashout @1.01x = RESET FORZATO del ciclo');
log('');
log('==============================================================');
log('');

initState();

// Hook engine
engine.on('GAME_STARTING', onGameStarted);
engine.on('GAME_ENDED', onGameEnded);

function onGameStarted() {
    currentRound++;
    betPlacedThisRound = false;

    if (state === STATE.STOPPED) {
        return;
    }

    // Check target profit
    currentProfit = balance - initBalance;
    const totalSessionNormalProfit = sessionProfit + normalModeProfit;

    if (totalSessionNormalProfit >= targetProfitAbsolute) {
        state = STATE.STOPPED;
        sessionProfit += currentProfit;
        sessionGames += currentRound;
        sessionCycles++;

        pfx('TARGET', `GLOBALE RAGGIUNTO! Profit normale: +${(totalSessionNormalProfit/100).toFixed(2)} bits (${targetProfitPercent}%)`);
        pfx('STOP', `Sessione completata con successo!`);
        return;
    }

    // Check saldo
    const finalBetCheck = currentBet + bonusPerLoss;
    if ((balance - finalBetCheck) < 0) {
        disaster++;
        sessionCycles++;
        const cycleLoss = initBalance - balance;
        sessionProfit -= cycleLoss;
        sessionGames += currentRound;

        pfx('ERR', `Saldo insufficiente! R:${currentRound} bet:${(finalBetCheck/100).toFixed(2)}`);
        pfx('RESTART', `Ricomincio ciclo ${sessionCycles + 1}...`);
        restartCycle();
        return;
    }

    const modeTag = currentMode === MODE.NORMAL ? 'NRM' : 'REC';
    const finalBet = currentBet + bonusPerLoss;

    pfx(`${modeTag}/S`, `R:${currentRound} bet:${(currentBet/100).toFixed(2)}${bonusPerLoss > 0 ? `+${(bonusPerLoss/100).toFixed(2)}` : ''}=${(finalBet/100).toFixed(2)} @${currentPayout}x bal:${(balance/100).toFixed(2)} [${currentMode === MODE.NORMAL ? `L:${normalConsecutiveLosses}` : `C${currentRecoveryCycle}/${MAX_RECOVERY_CYCLES} P${currentRecoveryPhase}/${RECOVERY_PHASES}`}]`);

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
        pfx('B/E', `skip (no bet)`);
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
    const targetPayout = currentMode === MODE.NORMAL ? normalPayout : recoveryPayout;

    // RESET EMERGENZA: Cashout @1.01x
    const isEmergencyReset = Math.abs(lastGame.cashedAt - 1.01) < 0.01;

    if (isEmergencyReset) {
        pfx('EMERGENCY', `RESET FORZATO @1.01x! profit:+${(profit/100).toFixed(2)} bal:${(balance/100).toFixed(2)}`);
        normalModeProfit = balance - initBalance;
        switchToNormalMode();
        return;
    }

    const isExactCashout = Math.abs(lastGame.cashedAt - targetPayout) < 0.01;

    if (currentMode === MODE.NORMAL) {
        if (isExactCashout) {
            normalWins++;
            normalModeProfit = balance - initBalance;

            pfx(`${modeTag}/W`, `WIN crash:${crash} profit:+${(profit/100).toFixed(2)} bal:${(balance/100).toFixed(2)} [NormalProfit:+${(normalModeProfit/100).toFixed(2)}]`);

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

            pfx(`${modeTag}/P`, `PARZIALE @${lastGame.cashedAt}x (target:${targetPayout}x) - conta come perdita [L:${normalConsecutiveLosses}/${recoveryTrigger}]`);

            if (normalConsecutiveLosses >= recoveryTrigger) {
                pfx('TRIGGER', `${recoveryTrigger} tentativi raggiunti - RECOVERY MODE`);
                switchToRecoveryMode();
            } else {
                currentBet = Math.ceil((currentBet / 100) * normalMult) * 100;
                pfx('NRM/+', `next bet:${(currentBet/100).toFixed(2)}${bonusPerLoss > 0 ? `+${(bonusPerLoss/100).toFixed(2)}` : ''}`);
            }
        }
    } else {
        // RECOVERY MODE WIN
        if (isExactCashout) {
            recoveryWins++;
            pfx(`${modeTag}/W`, `PHASE ${currentRecoveryPhase}/${RECOVERY_PHASES} WIN! crash:${crash} profit:+${(profit/100).toFixed(2)} bal:${(balance/100).toFixed(2)}`);

            if (currentRecoveryPhase < RECOVERY_PHASES) {
                // Passa alla fase successiva (bet rimane fissa)
                currentRecoveryPhase++;

                const remainingLosses = balanceBeforeLossSequence - balance;

                pfx('PHASE', `ADVANCING TO PHASE ${currentRecoveryPhase}/${RECOVERY_PHASES}`);
                pfx('INFO', `Remaining losses: ${(remainingLosses/100).toFixed(2)} bits`);
                pfx('INFO', `Bet fissa: ${(currentBet/100).toFixed(2)} bits`);
            } else {
                // TUTTE LE FASI COMPLETATE - verifica se abbiamo recuperato tutto
                const remainingLoss = balanceBeforeLossSequence - balance;

                if (remainingLoss <= 0) {
                    // Recupero completo!
                    pfx('COMPLETE', `ALL PHASES COMPLETED! Full recovery successful!`);
                    switchToNormalMode();
                } else {
                    // Fasi completate ma ancora perdite da recuperare
                    pfx('CYCLE-END', `Ciclo ${currentRecoveryCycle}/${MAX_RECOVERY_CYCLES} completato (tutte le ${RECOVERY_PHASES} fasi)`);
                    pfx('INFO', `Remaining losses: ${(remainingLoss/100).toFixed(2)} bits`);

                    if (currentRecoveryCycle < MAX_RECOVERY_CYCLES) {
                        // Nuovo ciclo
                        currentRecoveryCycle++;
                        currentRecoveryPhase = 1;
                        totalLosses = remainingLoss;
                        totalLossesAtRecoveryStart = remainingLoss;
                        lossesToRecoverPerPhase = Math.ceil(totalLossesAtRecoveryStart / RECOVERY_PHASES);

                        pfx('CYCLE', `NUOVO CICLO ${currentRecoveryCycle}/${MAX_RECOVERY_CYCLES} - Riprovo recovery`);
                        pfx('INFO', `Perdite da recuperare: ${(totalLosses/100).toFixed(2)} bits`);
                        pfx('INFO', `Target per fase: ${(lossesToRecoverPerPhase/100).toFixed(2)} bits (1/${RECOVERY_PHASES})`);

                        calculateRecoveryBet();
                    } else {
                        // Limite raggiunto
                        pfx('LIMIT', `Raggiunto limite di ${MAX_RECOVERY_CYCLES} cicli recovery`);
                        pfx('RESET', `RESET - Le perdite verranno recuperate nel prossimo ciclo`);
                        switchToNormalMode();
                    }
                }
            }
        } else {
            // CASHOUT PARZIALE in recovery
            recoveryLosses++;

            totalLosses = balanceBeforeLossSequence - balance;
            const remainingLosses = totalLosses;

            pfx(`${modeTag}/P`, `PHASE ${currentRecoveryPhase}/${RECOVERY_PHASES} PARZIALE @${lastGame.cashedAt}x (target:${targetPayout}x)`);
            pfx('REC/+', `Continuo con bet fissa: ${(currentBet/100).toFixed(2)} bits. Remaining: ${(remainingLosses/100).toFixed(2)} bits`);
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

        pfx(`${modeTag}/L`, `LOSS crash:${crash} loss:-${(finalBet/100).toFixed(2)} bal:${(balance/100).toFixed(2)} [L:${normalConsecutiveLosses}/${recoveryTrigger}]`);

        if (normalConsecutiveLosses >= recoveryTrigger) {
            switchToRecoveryMode();
        } else {
            currentBet = Math.ceil((currentBet / 100) * normalMult) * 100;
            pfx('NRM/+', `next bet:${(currentBet/100).toFixed(2)}${bonusPerLoss > 0 ? `+${(bonusPerLoss/100).toFixed(2)}` : ''}`);
        }
    } else {
        // RECOVERY MODE LOSS
        recoveryLosses++;
        recoveryAttempts++;

        totalLosses = balanceBeforeLossSequence - balance;

        pfx(`${modeTag}/L`, `LOSS PHASE ${currentRecoveryPhase}/${RECOVERY_PHASES} crash:${crash} loss:-${(finalBet/100).toFixed(2)} bal:${(balance/100).toFixed(2)}`);
        pfx('INFO', `Total losses: ${(totalLosses/100).toFixed(2)} bits | Ciclo: ${currentRecoveryCycle}/${MAX_RECOVERY_CYCLES}`);

        // Verifica se ci sono altre fasi in questo ciclo
        if (currentRecoveryPhase < RECOVERY_PHASES) {
            // Continua con la fase successiva (bet rimane fissa)
            currentRecoveryPhase++;

            pfx('PHASE', `Continuo a PHASE ${currentRecoveryPhase}/${RECOVERY_PHASES} (stesso ciclo ${currentRecoveryCycle}/${MAX_RECOVERY_CYCLES})`);
            pfx('INFO', `Bet fissa: ${(currentBet/100).toFixed(2)} bits`);
        } else {
            // CICLO COMPLETATO (tutte le fasi)
            pfx('CYCLE-END', `Ciclo ${currentRecoveryCycle}/${MAX_RECOVERY_CYCLES} completato (tutte le ${RECOVERY_PHASES} fasi)`);

            const remainingLoss = balanceBeforeLossSequence - balance;

            if (remainingLoss > 0 && currentRecoveryCycle < MAX_RECOVERY_CYCLES) {
                // Nuovo ciclo
                currentRecoveryCycle++;
                currentRecoveryPhase = 1;
                totalLossesAtRecoveryStart = totalLosses;
                lossesToRecoverPerPhase = Math.ceil(totalLossesAtRecoveryStart / RECOVERY_PHASES);

                pfx('CYCLE', `NUOVO CICLO ${currentRecoveryCycle}/${MAX_RECOVERY_CYCLES} - Riprovo recovery`);
                pfx('INFO', `Perdite da recuperare: ${(totalLosses/100).toFixed(2)} bits`);
                pfx('INFO', `Target per fase: ${(lossesToRecoverPerPhase/100).toFixed(2)} bits (1/${RECOVERY_PHASES})`);

                calculateRecoveryBet();
            } else {
                // Limite raggiunto
                if (remainingLoss > 0) {
                    pfx('LIMIT', `Raggiunto limite di ${MAX_RECOVERY_CYCLES} cicli recovery`);
                    pfx('RESET', `RESET - Le perdite verranno recuperate nel prossimo ciclo`);
                } else {
                    pfx('SUCCESS', `Perdite recuperate dopo ${currentRecoveryCycle} cicli!`);
                }

                switchToNormalMode();
            }
        }
    }
}

function switchToRecoveryMode() {
    currentMode = MODE.RECOVERY;
    recoveryAttempts = 0;
    currentPayout = recoveryPayout;

    const actualLoss = balanceBeforeLossSequence - balance;
    totalLosses = actualLoss;
    totalLossesAtRecoveryStart = actualLoss;

    // Inizia CICLO 1, FASE 1
    currentRecoveryCycle = 1;
    currentRecoveryPhase = 1;
    lossesToRecoverPerPhase = Math.ceil(totalLossesAtRecoveryStart / RECOVERY_PHASES);

    pfx('MODE', `SWITCH TO RECOVERY MODE - CICLO 1/${MAX_RECOVERY_CYCLES} PHASE 1/${RECOVERY_PHASES}`);
    pfx('INFO', `Total losses: ${(totalLossesAtRecoveryStart/100).toFixed(2)} bits`);
    pfx('INFO', `Phase target: ${(lossesToRecoverPerPhase/100).toFixed(2)} bits (1/${RECOVERY_PHASES})`);
    pfx('INFO', `Balance: ${(balanceBeforeLossSequence/100).toFixed(2)} -> ${(balance/100).toFixed(2)}`);

    calculateRecoveryBet();
}

function switchToNormalMode() {
    currentMode = MODE.NORMAL;
    normalConsecutiveLosses = 0;
    recoveryAttempts = 0;
    totalLosses = 0;
    currentRecoveryPhase = 0;
    currentRecoveryCycle = 0;
    lossesToRecoverPerPhase = 0;
    totalLossesAtRecoveryStart = 0;
    currentBet = normalBaseBet;
    currentPayout = normalPayout;
    bonusPerLoss = 0;
    state = STATE.BETTING;

    pfx('MODE', `BACK TO NORMAL MODE`);
}

function calculateRecoveryBet() {
    const payoutMultiplier = recoveryPayout - 1.0;

    // Calcola bet necessaria per recuperare lossesToRecoverPerPhase
    currentBet = Math.ceil(lossesToRecoverPerPhase / payoutMultiplier);
    currentBet = Math.ceil(currentBet / 100) * 100;

    pfx('REC/C', `Ciclo ${currentRecoveryCycle}/${MAX_RECOVERY_CYCLES} Phase ${currentRecoveryPhase}/${RECOVERY_PHASES}: bet ${(currentBet/100).toFixed(2)} to recover ${(lossesToRecoverPerPhase/100).toFixed(2)} @${recoveryPayout}x`);

    if (currentBet > balance) {
        pfx('REC/!', `Bet troppo alta! Richiesto:${(currentBet/100).toFixed(2)} Disponibile:${(balance/100).toFixed(2)}`);
        disaster++;
        sessionCycles++;
        const cycleLoss = initBalance - balance;
        sessionProfit -= cycleLoss;
        sessionGames += currentRound;

        pfx('RESTART', `Saldo insufficiente per recovery. Ricomincio ciclo ${sessionCycles + 1}...`);
        restartCycle();
    }
}

function restartCycle() {
    balance = workingBalance;
    initBalance = workingBalance;
    currentRound = 0;
    currentProfit = 0;

    currentBet = normalBaseBet;
    currentPayout = normalPayout;
    betPlacedThisRound = false;

    currentMode = MODE.NORMAL;
    normalConsecutiveLosses = 0;
    recoveryAttempts = 0;
    totalLosses = 0;
    currentRecoveryPhase = 0;
    currentRecoveryCycle = 0;
    lossesToRecoverPerPhase = 0;
    totalLossesAtRecoveryStart = 0;
    normalModeProfit = 0;
    balanceBeforeLossSequence = 0;
    bonusPerLoss = 0;

    normalWins = 0;
    normalLosses = 0;
    recoveryWins = 0;
    recoveryLosses = 0;

    initState();
}

function initState() {
    state = STATE.BETTING;
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
