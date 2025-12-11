/**
 * MARTIN AI v4.9 - HIGH PAYOUT RECOVERY
 *
 * NOVITA v4.9:
 * - ⭐ PAYOUT RECOVERY FINO A 20X: Permette di usare payout molto alti in recovery mode
 * - ⭐ BET PIÙ BASSE: Con payout alto, serve meno capitale per recuperare
 * - ⭐ GIOCO ALLUNGATO: Più tentativi con rischio ridotto per singola bet
 *
 * MODALITA 1 (NORMALE): Progressione geometrica con moltiplicatore configurabile
 * - OPZIONE A (customMult = 0): Moltiplicatore AUTO-CALCOLATO
 *   * Calcolato automaticamente in base a payout e recoveryTrigger
 *   * Usa binary search per trovare il mult ottimale
 *   * Garantisce recupero completo dopo N perdite
 *   * Es: payout=3.1x, trigger=7 → mult auto = 1.45x
 * - OPZIONE B (customMult > 0): Moltiplicatore MANUALE
 *   * Usa il valore specificato nelle impostazioni
 *   * Utile per strategie personalizzate
 *   * Es: customMult=1.5 → usa sempre 1.5x
 * - Ogni perdita: bet *= mult
 *
 * MODALITA 2 (RECOVERY HIGH PAYOUT): Sistema martingale con payout alto
 * - Usa un payout configurabile fino a 20x (diverso dal normal mode)
 * - Ogni perdita: ricalcola bet per recuperare TUTTE le perdite accumulate
 * - Parametro recoveryCycles: numero massimo di tentativi prima di reset
 * - ⭐ VANTAGGIO: Payout alto = bet bassa = più tentativi possibili
 *
 * ESEMPIO COMPARATIVO:
 *
 * SCENARIO: 10,000 bits di perdite accumulate
 *
 * RECOVERY @2x (v4.8 standard):
 * Tentativo 1: bet = 10,000 / (2-1) = 10,000 bits
 *   - Vince @2x → profit = 10,000 → recupera tutto ✅
 *   - Perde → perdite = 20,000 bits → Tentativo 2
 * Tentativo 2: bet = 20,000 bits (MOLTO ALTA!)
 *
 * RECOVERY @10x (v4.9 high payout):
 * Tentativo 1: bet = 10,000 / (10-1) = 1,111 bits (9x PIÙ BASSA!)
 *   - Vince @10x → profit = 10,000 → recupera tutto ✅
 *   - Perde → perdite = 11,111 bits → Tentativo 2
 * Tentativo 2: bet = 11,111 / 9 = 1,234 bits (ancora sostenibile)
 * Tentativo 3: bet = 12,345 / 9 = 1,371 bits
 * ... può fare MOLTI più tentativi prima di esaurire il saldo!
 *
 * RECOVERY @20x (v4.9 extreme):
 * Tentativo 1: bet = 10,000 / (20-1) = 526 bits (19x PIÙ BASSA!)
 *   - Vince @20x → profit = 9,994 → recupera quasi tutto ✅
 *   - Perde → perdite = 10,526 bits → Tentativo 2
 * Tentativo 2: bet = 10,526 / 19 = 554 bits
 * ... può fare MOLTISSIMI tentativi!
 */

var config = {
    // ===== CAPITALE E TARGET =====
    workingBalance: { value: 1500000, type: 'balance', label: 'Working Balance (bits to use)' },
    targetProfitPercent: { value: 7, type: 'multiplier', label: 'Target Profit % (stop when reached)' },

    // ===== MODALITA 1 (NORMALE) =====
    payout: { value: 3.1, type: 'multiplier', label: 'Normal Mode Payout' },
    baseBet: { value: 100, type: 'balance', label: 'Base Bet' },
    customMult: { value: 1.6, type: 'multiplier', label: 'Custom Multiplier (0 = auto-calculate)' },

    // ===== MODALITA 2 (RECUPERO HIGH PAYOUT) =====
    recoveryTrigger: { value: 16, type: 'multiplier', label: 'Losses before recovery mode' },
    recoveryMartingalePayout: { value: 10, type: 'multiplier', label: 'Recovery High Payout (1.1-20.0)' },
    recoveryCycles: { value: 50, type: 'multiplier', label: 'Max recovery attempts before reset (1-100)' },
};

// Configurazione base
const workingBalance = config.workingBalance.value;
const targetProfitPercent = config.targetProfitPercent.value;
const normalPayout = config.payout.value;
const normalBaseBet = config.baseBet.value;
const customMultValue = config.customMult.value;

const recoveryTrigger = config.recoveryTrigger.value;
const recoveryMartingalePayout = Math.max(1.1, Math.min(20.0, config.recoveryMartingalePayout.value)); // ⭐ Clamp 1.1-20.0
const MAX_RECOVERY_ATTEMPTS = Math.max(1, Math.min(100, config.recoveryCycles.value)); // ⭐ Clamp 1-100

/**
 * CALCOLO AUTOMATICO DEL MOLTIPLICATORE NORMALE
 *
 * Dato:
 * - baseBet iniziale
 * - payout target
 * - N perdite consecutive prima di recovery
 *
 * Obiettivo: trovare mult tale che dopo N perdite, la vincita recuperi tutto
 *
 * Sequenza: bet₁, bet₂=bet₁*mult, bet₃=bet₁*mult², ..., betₙ=bet₁*mult^(N-1)
 * Perdite totali: L = bet₁ * (1 + mult + mult² + ... + mult^(N-1))
 *                   = bet₁ * (mult^N - 1) / (mult - 1)
 *
 * Bet vincente: betₙ₊₁ = bet₁ * mult^N
 * Profit: P = betₙ₊₁ * (payout - 1)
 *
 * Condizione: P >= L
 * bet₁ * mult^N * (payout - 1) >= bet₁ * (mult^N - 1) / (mult - 1)
 *
 * Semplificando (bet₁ si cancella):
 * mult^N * (payout - 1) * (mult - 1) >= mult^N - 1
 * mult^N * (payout - 1) * (mult - 1) - mult^N + 1 >= 0
 * mult^(N+1) * (payout - 1) - mult^N * payout + 1 >= 0
 *
 * Risolviamo con binary search per trovare il mult minimo che soddisfa la condizione.
 */
function calculateNormalMultiplier(payout, maxLosses) {
    // Funzione di test: verifica se mult recupera le perdite
    function testMult(mult) {
        // Calcola perdite totali (serie geometrica)
        const totalLosses = (Math.pow(mult, maxLosses) - 1) / (mult - 1);

        // Calcola profit della vincita
        const winBet = Math.pow(mult, maxLosses);
        const winProfit = winBet * (payout - 1);

        // Verifica recupero
        return winProfit >= totalLosses;
    }

    // Binary search per trovare il mult ottimale
    let low = 1.01;
    let high = payout;
    let result = high;

    for (let i = 0; i < 100; i++) {
        const mid = (low + high) / 2;

        if (testMult(mid)) {
            // Mult troppo alto, prova più basso
            result = mid;
            high = mid;
        } else {
            // Mult troppo basso, prova più alto
            low = mid;
        }

        // Convergenza
        if (Math.abs(high - low) < 0.001) {
            break;
        }
    }

    // Arrotonda a 2 decimali e aggiungi margine di sicurezza (1%)
    const withMargin = result * 1.01;
    return Math.round(withMargin * 100) / 100;
}

// Usa customMult se impostato (> 0), altrimenti calcola automaticamente
const normalMult = (customMultValue > 0)
    ? customMultValue
    : calculateNormalMultiplier(normalPayout, recoveryTrigger);

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
let recoveryAttempts = 0; // Numero di tentativi recovery (1 a MAX_RECOVERY_ATTEMPTS)
let totalLosses = 0;
let currentBet = normalBaseBet;
let currentPayout = normalPayout;
let betPlacedThisRound = false;

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
let maxRecoveryAttemptsReached = 0; // Conta quante volte si raggiunge il limite recovery

// Output functions
function pfx(tag, msg) { log(`[${tag}] ${msg}`) }

// ===== INIZIALIZZAZIONE =====
log('');
log('==============================================================');
log('  MARTIN AI v4.9 - HIGH PAYOUT RECOVERY                    ');
log('==============================================================');
log('');
log('MODALITA 1 (NORMALE):');
log(`   - Payout: ${normalPayout}x`);
log(`   - Base Bet: ${(normalBaseBet/100).toFixed(2)} bits`);
if (customMultValue > 0) {
    log(`   - Multiplier: ${normalMult}x (CUSTOM)`);
} else {
    log(`   - Multiplier: ${normalMult}x (AUTO-CALC)`);
}
log(`   - Bonus: +1 bit per le prime 3 perdite`);
log('');
log('MODALITA 2 (RECUPERO HIGH PAYOUT):');
log(`   - Trigger: ${recoveryTrigger} perdite consecutive`);
log(`   - Payout: ${recoveryMartingalePayout}x ⭐ HIGH PAYOUT`);
log(`   - Max tentativi: ${MAX_RECOVERY_ATTEMPTS}`);
log(`   - Sistema: Martingale con payout alto (bet basse, più tentativi)`);
log('');

// Calcola e mostra esempio di bet recovery
const exampleLoss = 10000;
const exampleBet = Math.ceil(exampleLoss / (recoveryMartingalePayout - 1));
const exampleProfit = Math.floor(exampleBet * recoveryMartingalePayout) - exampleBet;
log('ESEMPIO RECOVERY:');
log(`   - Perdite accumulate: ${(exampleLoss/100).toFixed(2)} bits`);
log(`   - Bet necessaria @${recoveryMartingalePayout}x: ${(exampleBet/100).toFixed(2)} bits (${((exampleBet/exampleLoss)*100).toFixed(1)}% delle perdite)`);
log(`   - Profit se vince: ${(exampleProfit/100).toFixed(2)} bits`);
log(`   - Tentativi stimati con saldo: ~${Math.floor(workingBalance / exampleBet)} tentativi`);
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
        printStats();
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
    const targetPayout = currentMode === MODE.NORMAL ? normalPayout : recoveryMartingalePayout;

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

            // Verifica se abbiamo recuperato tutto
            const remainingLoss = balanceBeforeLossSequence - balance;

            pfx(`${modeTag}/W`, `HIGH PAYOUT WIN! Attempt ${recoveryAttempts}/${MAX_RECOVERY_ATTEMPTS} crash:${crash} @${recoveryMartingalePayout}x profit:+${(profit/100).toFixed(2)} bal:${(balance/100).toFixed(2)}`);

            if (remainingLoss <= 0) {
                // Recupero completo!
                pfx('COMPLETE', `Full recovery successful! Recovered all losses.`);
                switchToNormalMode();
            } else {
                // Ancora perdite, ma questa vincita ha aiutato
                pfx('INFO', `Remaining losses: ${(remainingLoss/100).toFixed(2)} bits`);

                if (recoveryAttempts < MAX_RECOVERY_ATTEMPTS) {
                    // Continua recovery con nuovo calcolo
                    totalLosses = remainingLoss;
                    calculateRecoveryBet();
                } else {
                    // Limite raggiunto
                    maxRecoveryAttemptsReached++;
                    pfx('LIMIT', `Raggiunto limite di ${MAX_RECOVERY_ATTEMPTS} tentativi recovery`);
                    pfx('RESET', `RESET - Le perdite verranno recuperate nel prossimo ciclo`);
                    switchToNormalMode();
                }
            }
        } else {
            // CASHOUT PARZIALE in recovery
            recoveryLosses++;

            totalLosses = balanceBeforeLossSequence - balance;

            pfx(`${modeTag}/P`, `PARZIALE @${lastGame.cashedAt}x (target:${targetPayout}x)`);
            pfx('REC/+', `Continuing recovery. Remaining: ${(totalLosses/100).toFixed(2)} bits`);

            // NON incrementa recoveryAttempts - cashout parziale non conta come tentativo
            // Ricalcola bet
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

        pfx(`${modeTag}/L`, `LOSS crash:${crash} loss:-${(finalBet/100).toFixed(2)} bal:${(balance/100).toFixed(2)} [L:${normalConsecutiveLosses}/${recoveryTrigger}]`);

        if (normalConsecutiveLosses >= recoveryTrigger) {
            switchToRecoveryMode();
        } else {
            currentBet = Math.ceil((currentBet / 100) * normalMult) * 100;
            pfx('NRM/+', `next bet:${(currentBet/100).toFixed(2)}${bonusPerLoss > 0 ? `+${(bonusPerLoss/100).toFixed(2)}` : ''}`);
        }
    } else {
        // RECOVERY MODE LOSS - Sistema Martingale HIGH PAYOUT
        recoveryLosses++;
        recoveryAttempts++;

        // Ricalcola le perdite totali
        totalLosses = balanceBeforeLossSequence - balance;

        pfx(`${modeTag}/L`, `HIGH PAYOUT LOSS Attempt ${recoveryAttempts}/${MAX_RECOVERY_ATTEMPTS} crash:${crash} @${recoveryMartingalePayout}x loss:-${(finalBet/100).toFixed(2)} bal:${(balance/100).toFixed(2)}`);
        pfx('INFO', `Total losses: ${(totalLosses/100).toFixed(2)} bits`);

        // Verifica se abbiamo ancora tentativi
        if (recoveryAttempts < MAX_RECOVERY_ATTEMPTS) {
            // Ricalcola bet per recuperare tutto
            pfx('MARTINGALE', `Tentativo ${recoveryAttempts + 1}/${MAX_RECOVERY_ATTEMPTS} - Ricalcolo bet @${recoveryMartingalePayout}x`);
            calculateRecoveryBet();
        } else {
            // Limite raggiunto
            maxRecoveryAttemptsReached++;
            pfx('LIMIT', `Raggiunto limite di ${MAX_RECOVERY_ATTEMPTS} tentativi recovery`);
            pfx('RESET', `RESET - Le perdite verranno recuperate nel prossimo ciclo`);
            switchToNormalMode();
        }
    }
}

function switchToRecoveryMode() {
    currentMode = MODE.RECOVERY;
    recoveryAttempts = 1; // Inizia dal tentativo 1
    currentPayout = recoveryMartingalePayout;

    const actualLoss = balanceBeforeLossSequence - balance;
    totalLosses = actualLoss;

    pfx('MODE', `SWITCH TO RECOVERY HIGH PAYOUT MODE`);
    pfx('INFO', `Total losses: ${(totalLosses/100).toFixed(2)} bits`);
    pfx('INFO', `Payout: ${recoveryMartingalePayout}x ⭐ HIGH PAYOUT`);
    pfx('INFO', `Max attempts: ${MAX_RECOVERY_ATTEMPTS}`);
    pfx('INFO', `Balance: ${(balanceBeforeLossSequence/100).toFixed(2)} -> ${(balance/100).toFixed(2)}`);

    calculateRecoveryBet();
}

function switchToNormalMode() {
    currentMode = MODE.NORMAL;
    normalConsecutiveLosses = 0;
    recoveryAttempts = 0;
    totalLosses = 0;
    currentBet = normalBaseBet;
    currentPayout = normalPayout;
    bonusPerLoss = 0;
    state = STATE.BETTING;

    pfx('MODE', `BACK TO NORMAL MODE`);
}

function calculateRecoveryBet() {
    // MARTINGALE HIGH PAYOUT: calcola bet necessaria per recuperare TUTTE le perdite
    const payoutMultiplier = recoveryMartingalePayout - 1.0;

    // Bet = Perdite totali / (Payout - 1)
    // Es: 10,000 bits perdite, payout 10x → bet = 10,000 / 9 = 1,111 bits
    // Se vinci: 1,111 * 10 = 11,110 - 1,111 = 10,000 profit (recupero!)
    currentBet = Math.ceil(totalLosses / payoutMultiplier);

    // Arrotonda a 100
    currentBet = Math.ceil(currentBet / 100) * 100;

    const betPercentage = ((currentBet / totalLosses) * 100).toFixed(1);

    pfx('REC/C', `Attempt ${recoveryAttempts}/${MAX_RECOVERY_ATTEMPTS}: bet ${(currentBet/100).toFixed(2)} (${betPercentage}% of losses) to recover ${(totalLosses/100).toFixed(2)} @${recoveryMartingalePayout}x`);

    // Verifica se abbiamo abbastanza saldo
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

function printStats() {
    log('');
    log('==============================================================');
    log('  STATISTICHE HIGH PAYOUT RECOVERY v4.9');
    log('==============================================================');
    log('');
    log('RISULTATI:');
    log(`   - Normal Wins: ${normalWins}`);
    log(`   - Normal Losses: ${normalLosses}`);
    log(`   - Recovery Wins: ${recoveryWins} @${recoveryMartingalePayout}x`);
    log(`   - Recovery Losses: ${recoveryLosses}`);
    log(`   - Max Recovery Attempts Reached: ${maxRecoveryAttemptsReached} times`);
    log(`   - Disasters (reset): ${disaster}`);
    log(`   - Total Games: ${currentRound}`);
    log('');
    log('==============================================================');
    log('');
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
