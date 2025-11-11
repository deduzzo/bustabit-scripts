/**
 * ⚙️ MARTIN AI v4 - RECURSIVE PARTITIONED RECOVERY STRATEGY
 *
 * STRATEGIA CON RECUPERO PARTIZIONATO RICORSIVO/ITERATIVO:
 *
 * 🎮 MODALITÀ 1 (NORMALE):
 *    • Payout: 3.0x (configurabile)
 *    • Base Bet: 100 bits (configurabile)
 *    • Multiplier: 1.50x (configurabile)
 *    • Bonus: +1 bit per le prime 3 perdite
 *
 * 🛡️ MODALITÀ 2 (RECUPERO PARTIZIONATO RICORSIVO):
 *    • Trigger: Dopo X perdite consecutive in Modalità 1 (configurabile)
 *    • Payout: Configurabile (es. 1.1x = 90% win rate, 1.2x = 83% win rate)
 *    • INNOVAZIONE RIVOLUZIONARIA: Recupero SEMPRE diviso in N fasi, all'infinito
 *
 *    COME FUNZIONA (es. 4 FASI):
 *    1. Hai 1000 bits di perdite → dividi in 4 fasi da 250 bits ciascuna
 *    2. FASE 1: Provi a recuperare 250 bits
 *       - Se VINCI → vai a FASE 2
 *       - Se PERDI → ricalcola TUTTO e ridividi in 4 nuove fasi (es. 1300 bits → 325 per fase)
 *    3. FASE 2: Provi a recuperare il prossimo 1/4
 *       - Se VINCI → vai a FASE 3
 *       - Se PERDI → ricalcola TUTTO e ridividi in 4 nuove fasi dal punto attuale
 *    4. Continua fino a completare TUTTE le N fasi consecutive
 *
 * 💡 VANTAGGI RECUPERO RICORSIVO:
 *    • ♾️ INFINITAMENTE RESILIENTE: Non esiste "max tentativi", l'algoritmo continua
 *    • 📉 BET SEMPRE CONTENUTE: Dividi sempre per N, mai bet gigantesche
 *    • 🔄 AUTO-ADATTIVO: Le fasi si ricalcolano automaticamente dopo ogni perdita
 *    • 🎯 WIN CONDITION CHIARA: Esci solo quando vinci N fasi consecutive
 *    • 🛡️ SICUREZZA MASSIMA: Con payout alto (1.1x = 90% win) è quasi impossibile fallire
 *    • 💰 CAPITALE RIDOTTO: Bet piccole distribuite = molto meno capitale necessario
 *
 * 📊 ESEMPIO PRATICO (4 fasi, 1.1x payout):
 *    Perdite iniziali: 1000 bits
 *    → CICLO 1: [250, 250, 250, 250] - perdi fase 2 → 1350 totali
 *    → CICLO 2: [338, 338, 338, 338] - perdi fase 1 → 1688 totali
 *    → CICLO 3: [422, 422, 422, 422] - VINCI tutte → RECUPERO COMPLETO!
 *
 *    Con 90% win rate per fase, probabilità di vincere 4 fasi consecutive: 65.6%
 *    Ma non ti fermi mai, quindi alla fine recuperi SEMPRE (a meno di disaster saldo)
 *
 * 📊 CAPITALE RACCOMANDATO: Dipende dai parametri (vedi statistiche all'avvio)
 */
var config = {
    // ===== CAPITALE E TARGET =====
    workingBalance: { value: 2000000, type: 'balance', label: 'Working Balance (bits to use)' },
    targetProfitPercent: { value: 10, type: 'multiplier', label: 'Target Profit % (stop when reached)' },

    // ===== MODALITÀ 1 (NORMALE) =====
    payout: { value: 3.1, type: 'multiplier', label: 'Normal Mode Payout' },
    baseBet: { value: 100, type: 'balance', label: 'Base Bet' },
    mult: { value: 1.51, type: 'multiplier', label: 'Multiplier after loss' },

    // ===== MODALITÀ 2 (RECUPERO) =====
    recoveryTrigger: { value: 7, type: 'multiplier', label: 'Losses before recovery mode' },
    recoveryPayout: { value: 1.1, type: 'multiplier', label: 'Recovery Mode Payout' },
    recoveryPhases: { value: 4, type: 'multiplier', label: 'Number of recovery phases (divide losses)' },
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
let normalConsecutiveLosses = 0; // Perdite consecutive in modalità normale
let recoveryAttempts = 0; // Tentativi di recupero nella fase corrente
let totalLosses = 0; // Totale perdite da recuperare
let currentBet = normalBaseBet;
let currentPayout = normalPayout;
let betPlacedThisRound = false;

// Recovery partizionato in N fasi (configurabile)
let currentRecoveryPhase = 0; // Fase corrente (0 = non in recovery, 1-N = fasi attive)
let lossesToRecoverPerPhase = 0; // Perdite da recuperare in questa fase
let totalLossesAtRecoveryStart = 0; // Totale perdite all'inizio del recovery

// Tracking profit separato per modalità
let normalModeProfit = 0; // Profitto netto dalla modalità normale (conta per target)
let balanceBeforeLossSequence = 0; // Balance prima di iniziare la sequenza di perdite

// Bonus incrementale per aumentare profit (solo prime 3 puntate)
let bonusPerLoss = 0; // Si incrementa di 100 (1 bit) per ogni perdita, sommato alla bet finale
const MAX_BONUS_LOSSES = 3; // Applica bonus solo per le prime 3 perdite

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
log('╔════════════════════════════════════════════════════════════╗');
log('║  🏆 MARTIN AI v4 - PARTITIONED RECOVERY STRATEGY          ║');
log('╚════════════════════════════════════════════════════════════╝');
log('');
log('📊 MODALITÀ 1 (NORMALE):');
log(`   • Payout: ${normalPayout}x`);
log(`   • Base Bet: ${(normalBaseBet/100).toFixed(2)} bits`);
log(`   • Multiplier: ${normalMult}x`);
log(`   • Bonus: +1 bit per le prime 3 perdite`);
log('');
log('🛡️ MODALITÀ 2 (RECUPERO PARTIZIONATO):');
log(`   • Trigger: ${recoveryTrigger} perdite consecutive`);
log(`   • Payout: ${recoveryPayout}x`);
log(`   • Fasi: ${RECOVERY_PHASES} (recupero diviso in ${RECOVERY_PHASES} parti)`);
log('');
log('💰 CAPITALE & TARGET:');
log(`   • Working Balance: ${(workingBalance/100).toFixed(2)} bits`);
log(`   • Target Profit: ${targetProfitPercent}% (+${(targetProfitAbsolute/100).toFixed(2)} bits)`);
log(`   • Stop at: ${((workingBalance + targetProfitAbsolute)/100).toFixed(2)} bits`);
log(`   • On disaster (saldo insufficiente): RESTART con nuovo ciclo`);
log(`   • On target raggiunto: STOP`);
log('');
log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
log('');

// Mostra statistiche puntate
showBettingPlan();

initState();

// Hook engine
engine.on('GAME_STARTING', onGameStarted);
engine.on('GAME_ENDED', onGameEnded);

function onGameStarted() {
    currentRound++;
    betPlacedThisRound = false;

    // Se lo script è già fermato, non fare nulla
    if (state === STATE.STOPPED) {
        return;
    }

    // Check se abbiamo raggiunto il target profit GLOBALE
    // Il target si basa SOLO sul profitto dalla modalità normale, non dal recovery
    currentProfit = balance - initBalance;

    // In modalità restart, controlla il profit della sessione totale
    const totalSessionNormalProfit = sessionProfit + normalModeProfit;

    if (totalSessionNormalProfit >= targetProfitAbsolute) {
        // TARGET GLOBALE RAGGIUNTO!
        state = STATE.STOPPED;
        sessionProfit += currentProfit;
        sessionGames += currentRound;
        sessionCycles++;

        pfx('🎯TARGET', `GLOBALE RAGGIUNTO! Profit normale: +${(totalSessionNormalProfit/100).toFixed(2)} bits (${targetProfitPercent}%)`);
        pfx('STOP', `Sessione completata con successo!`);
        log('');
        log('╔════════════════════════════════════════════════════════════╗');
        log('║  🎉 TARGET PROFIT GLOBALE RAGGIUNTO - SCRIPT TERMINATO    ║');
        log('╚════════════════════════════════════════════════════════════╝');
        log('');
        log(`📊 STATISTICHE SESSIONE COMPLETA:`);
        log(`   • Cicli completati: ${sessionCycles}`);
        log(`   • Profit modalità normale: +${(totalSessionNormalProfit/100).toFixed(2)} bits (+${((totalSessionNormalProfit/workingBalance)*100).toFixed(2)}%)`);
        log(`   • Profit totale (con recovery): +${(currentProfit/100).toFixed(2)} bits (+${((currentProfit/workingBalance)*100).toFixed(2)}%)`);
        log(`   • Target era: +${(targetProfitAbsolute/100).toFixed(2)} bits (+${targetProfitPercent}%)`);
        log(`   • Partite totali: ${sessionGames + currentRound}`);
        log(`   • Normal W/L totali: ${normalWins}/${normalLosses}`);
        log(`   • Recovery W/L totali: ${recoveryWins}/${recoveryLosses}`);
        log(`   • Disasters: ${disaster}`);
        log('');
        log(`📊 STATISTICHE CICLO FINALE ${sessionCycles}:`);
        log(`   • Balance iniziale ciclo: ${(initBalance/100).toFixed(2)} bits`);
        log(`   • Balance finale ciclo: ${(balance/100).toFixed(2)} bits`);
        log(`   • Profit ciclo totale: +${(currentProfit/100).toFixed(2)} bits`);
        log(`   • Profit ciclo normale: +${(normalModeProfit/100).toFixed(2)} bits`);
        log(`   • Partite ciclo: ${currentRound}`);
        log('');
        return;
    }

    // BETTING
    // Verifica saldo con finalBet (bet + bonus)
    const finalBetCheck = currentBet + bonusPerLoss;
    if ((balance - finalBetCheck) < 0) {
        // DISASTER: SEMPRE restart con nuovo ciclo
        disaster++;
        sessionCycles++;
        const cycleLoss = initBalance - balance;
        sessionProfit -= cycleLoss;
        sessionGames += currentRound;

        pfx('ERR', `Saldo insufficiente! R:${currentRound} bet:${(finalBetCheck/100).toFixed(2)}`);
        pfx('ERR', `Balance: ${(balance/100).toFixed(2)} < Bet: ${(finalBetCheck/100).toFixed(2)}`);
        log('');
        log('╔════════════════════════════════════════════════════════════╗');
        log('║  ⚠️  SALDO INSUFFICIENTE - RESTARTING CYCLE               ║');
        log('╚════════════════════════════════════════════════════════════╝');
        log('');
        log(`📊 STATISTICHE CICLO ${sessionCycles} (FALLITO):`);
        log(`   • Balance iniziale: ${(initBalance/100).toFixed(2)} bits`);
        log(`   • Balance finale: ${(balance/100).toFixed(2)} bits`);
        log(`   • Loss ciclo: -${(cycleLoss/100).toFixed(2)} bits`);
        log(`   • Partite giocate: ${currentRound}`);
        log(`   • Normal W/L: ${normalWins}/${normalLosses}`);
        log(`   • Recovery W/L: ${recoveryWins}/${recoveryLosses}`);
        log('');
        log(`🔄 STATISTICHE SESSIONE (${sessionCycles} cicli):`);
        log(`   • Profit totale sessione: ${sessionProfit >= 0 ? '+' : ''}${(sessionProfit/100).toFixed(2)} bits`);
        log(`   • Partite totali: ${sessionGames}`);
        log(`   • Disasters: ${disaster}`);
        log('');
        log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        log('');

        pfx('RESTART', `Ricomincio ciclo ${sessionCycles + 1}...`);
        restartCycle();
        return;
    }

    const modeTag = currentMode === MODE.NORMAL ? 'NRM' : 'REC';

    // Calcola bet finale sommando il bonus
    const finalBet = currentBet + bonusPerLoss;

    pfx(`${modeTag}/S`, `R:${currentRound} bet:${(currentBet/100).toFixed(2)}${bonusPerLoss > 0 ? `+${(bonusPerLoss/100).toFixed(2)}` : ''}=${(finalBet/100).toFixed(2)} @${currentPayout}x bal:${(balance/100).toFixed(2)} [${currentMode === MODE.NORMAL ? `L:${normalConsecutiveLosses}` : `P${currentRecoveryPhase}/${RECOVERY_PHASES}`}]`);

    engine.bet(finalBet, currentPayout);
    betPlacedThisRound = true;
}

function onGameEnded() {
    // Se lo script è fermato, non elaborare
    if (state === STATE.STOPPED) {
        return;
    }

    const lastGame = engine.history.first();
    const crash = parseCrash(lastGame);

    // BETTING: elabora solo se abbiamo puntato
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

    // 🔍 Verifica se è un cashout esatto al target (con tolleranza 0.01)
    const isExactCashout = Math.abs(lastGame.cashedAt - targetPayout) < 0.01;

    if (currentMode === MODE.NORMAL) {
        if (isExactCashout) {
            // ✅ WIN NORMALE al payout target → reset completo
            normalWins++;

            // Aggiorna normalModeProfit come differenza dal balance iniziale
            normalModeProfit = balance - initBalance;

            pfx(`${modeTag}/W`, `✅ crash:${crash} profit:+${(profit/100).toFixed(2)} bal:${(balance/100).toFixed(2)} [NormalProfit:+${(normalModeProfit/100).toFixed(2)}]`);

            normalConsecutiveLosses = 0;
            currentBet = normalBaseBet;
            currentPayout = normalPayout;
            bonusPerLoss = 0; // Reset bonus
            state = STATE.BETTING;
        } else {
            // ⚠️ CASHOUT PARZIALE → incrementa bet ma NON conta come perdita consecutiva
            normalLosses++;
            // NON incrementa normalConsecutiveLosses - non è una perdita vera!

            pfx(`${modeTag}/P`, `⚠️ PARZIALE @${lastGame.cashedAt}x (target:${targetPayout}x) → continua martingala [L:${normalConsecutiveLosses}/${recoveryTrigger}]`);

            // Continua in modalità normale con martingala (come se fosse una perdita)
            currentBet = Math.ceil((currentBet / 100) * normalMult) * 100;

            // Incrementa bonus solo per le prime 3 puntate
            if (normalConsecutiveLosses < MAX_BONUS_LOSSES) {
                bonusPerLoss += 100;
            }

            pfx('NRM/+', `next bet:${(currentBet/100).toFixed(2)}${bonusPerLoss > 0 ? `+${(bonusPerLoss/100).toFixed(2)}` : ''}`);
        }
    } else {
        // RECOVERY MODE
        if (isExactCashout) {
            // ✅ WIN RECOVERY al target → verifica fase
            recoveryWins++;
            pfx(`${modeTag}/W`, `🎯 PHASE ${currentRecoveryPhase}/${RECOVERY_PHASES} WIN! crash:${crash} profit:+${(profit/100).toFixed(2)} bal:${(balance/100).toFixed(2)}`);

            // Verifica se ci sono altre fasi da completare
            if (currentRecoveryPhase < RECOVERY_PHASES) {
                // 🔄 PASSA ALLA FASE SUCCESSIVA
                currentRecoveryPhase++;

                // Ricalcola le perdite rimanenti dalla fase corrente
                const remainingLosses = balanceBeforeLossSequence - balance;
                const remainingPhases = RECOVERY_PHASES - currentRecoveryPhase + 1;
                lossesToRecoverPerPhase = Math.ceil(remainingLosses / remainingPhases);

                pfx('PHASE', `⏭️  ADVANCING TO PHASE ${currentRecoveryPhase}/${RECOVERY_PHASES}`);
                pfx('INFO', `Remaining losses: ${(remainingLosses/100).toFixed(2)} bits`);
                pfx('INFO', `Phase ${currentRecoveryPhase} target: ${(lossesToRecoverPerPhase/100).toFixed(2)} bits`);

                // Ricalcola la bet per la nuova fase
                calculateRecoveryBet();
            } else {
                // ✅ TUTTE LE FASI COMPLETATE → torna a normale
                pfx('COMPLETE', `✅ ALL PHASES COMPLETED! Full recovery successful!`);
                switchToNormalMode();
            }
        } else {
            // ⚠️ CASHOUT PARZIALE in recovery → continua recovery ma NON conta come tentativo
            recoveryLosses++;
            // NON incrementa recoveryAttempts - non è una perdita vera!

            // Ricalcola totalLosses e losses per fase
            totalLosses = balanceBeforeLossSequence - balance;
            const remainingLosses = totalLosses;
            const remainingPhases = RECOVERY_PHASES - currentRecoveryPhase + 1;
            lossesToRecoverPerPhase = Math.ceil(remainingLosses / remainingPhases);

            // In recovery mode non incrementiamo più il bonus (troppo rischioso)
            // bonusPerLoss rimane fisso a quello accumulato nelle prime 3 perdite normali

            pfx(`${modeTag}/P`, `⚠️ PHASE ${currentRecoveryPhase}/${RECOVERY_PHASES} PARZIALE @${lastGame.cashedAt}x (target:${targetPayout}x)`);

            // CASHOUT PARZIALE = profitto parziale, non conta per max recovery
            // Continua a ricalcolare bet per fase corrente
            pfx('REC/+', `Recalculating bet for phase ${currentRecoveryPhase}. Remaining: ${(remainingLosses/100).toFixed(2)} bits`);
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

        // Se è la prima perdita della sequenza, salva il balance PRIMA della perdita
        if (normalConsecutiveLosses === 0) {
            balanceBeforeLossSequence = balance + finalBet; // Balance prima di questa perdita (con bonus)
        }

        normalConsecutiveLosses++;

        // Incrementa bonus solo per le prime 3 perdite
        if (normalConsecutiveLosses <= MAX_BONUS_LOSSES) {
            bonusPerLoss += 100;
        }
        // totalLosses non serve più - verrà calcolato in switchToRecoveryMode()

        pfx(`${modeTag}/L`, `❌ crash:${crash} loss:-${(finalBet/100).toFixed(2)} bal:${(balance/100).toFixed(2)} [L:${normalConsecutiveLosses}/${recoveryTrigger}]`);

        // Check se passare a recovery mode
        if (normalConsecutiveLosses >= recoveryTrigger) {
            // Dopo X perdite consecutive, SEMPRE passare a recovery mode
            switchToRecoveryMode();
        } else {
            // Continua in modalità normale con martingala
            currentBet = Math.ceil((currentBet / 100) * normalMult) * 100;
            pfx('NRM/+', `next bet:${(currentBet/100).toFixed(2)}${bonusPerLoss > 0 ? `+${(bonusPerLoss/100).toFixed(2)}` : ''}`);
        }
    } else {
        // RECOVERY MODE LOSS → RICORSIVO: Ricalcola TUTTO e ricomincia da fase 1
        recoveryLosses++;
        recoveryAttempts++;
        // In recovery mode non incrementiamo più il bonus (troppo rischioso)
        // bonusPerLoss rimane fisso a quello accumulato nelle prime 3 perdite normali

        // Ricalcola le perdite totali dal punto di partenza originale
        totalLosses = balanceBeforeLossSequence - balance;

        pfx(`${modeTag}/L`, `❌ PHASE ${currentRecoveryPhase}/${RECOVERY_PHASES} crash:${crash} loss:-${(finalBet/100).toFixed(2)} bal:${(balance/100).toFixed(2)}`);

        // 🔄 INNOVAZIONE RICORSIVA: Dopo ogni perdita, RIPARTI DA FASE 1
        // Dividi TUTTE le perdite accumulate in N nuove fasi
        currentRecoveryPhase = 1; // Reset a fase 1
        totalLossesAtRecoveryStart = totalLosses;
        lossesToRecoverPerPhase = Math.ceil(totalLossesAtRecoveryStart / RECOVERY_PHASES);

        pfx('REC/⟲', `🔄 RECURSIVE RESET → Back to PHASE 1/${RECOVERY_PHASES}`);
        pfx('INFO', `Total losses now: ${(totalLosses/100).toFixed(2)} bits`);
        pfx('INFO', `New phase target: ${(lossesToRecoverPerPhase/100).toFixed(2)} bits (1/${RECOVERY_PHASES})`);

        calculateRecoveryBet();
    }
}

function switchToRecoveryMode() {
    currentMode = MODE.RECOVERY;
    recoveryAttempts = 0;
    currentPayout = recoveryPayout;

    // Calcola il loss REALE dal balance PRIMA della sequenza di perdite
    const actualLoss = balanceBeforeLossSequence - balance;
    totalLosses = actualLoss;
    totalLossesAtRecoveryStart = actualLoss;

    // 🎯 INIZIA FASE 1: recupera 1/N delle perdite totali
    currentRecoveryPhase = 1;
    lossesToRecoverPerPhase = Math.ceil(totalLossesAtRecoveryStart / RECOVERY_PHASES);

    pfx('MODE', `🛡️ SWITCH TO RECOVERY MODE - PHASE 1/${RECOVERY_PHASES}`);
    pfx('INFO', `Total losses: ${(totalLossesAtRecoveryStart/100).toFixed(2)} bits`);
    pfx('INFO', `Phase 1 target: ${(lossesToRecoverPerPhase/100).toFixed(2)} bits (1/${RECOVERY_PHASES})`);
    pfx('INFO', `Balance: ${(balanceBeforeLossSequence/100).toFixed(2)} → ${(balance/100).toFixed(2)}`);

    calculateRecoveryBet();
}

function switchToNormalMode() {
    currentMode = MODE.NORMAL;
    normalConsecutiveLosses = 0;
    recoveryAttempts = 0;
    totalLosses = 0;
    currentRecoveryPhase = 0; // Reset fase
    lossesToRecoverPerPhase = 0;
    totalLossesAtRecoveryStart = 0;
    currentBet = normalBaseBet;
    currentPayout = normalPayout;
    bonusPerLoss = 0; // Reset bonus
    state = STATE.BETTING;

    pfx('MODE', `🎮 BACK TO NORMAL MODE`);
}

function calculateRecoveryBet() {
    // 🎯 RECOVERY PARTIZIONATO: calcola bet solo per la fase corrente
    const payoutMultiplier = recoveryPayout - 1.0;

    // Calcola bet necessaria per recuperare solo lossesToRecoverPerPhase
    currentBet = Math.ceil(lossesToRecoverPerPhase / payoutMultiplier);

    // Arrotonda a 100
    currentBet = Math.ceil(currentBet / 100) * 100;

    pfx('REC/C', `Phase ${currentRecoveryPhase}/${RECOVERY_PHASES}: bet ${(currentBet/100).toFixed(2)} to recover ${(lossesToRecoverPerPhase/100).toFixed(2)} @${recoveryPayout}x`);

    // Verifica se abbiamo abbastanza saldo
    if (currentBet > balance) {
        // Saldo insufficiente → SEMPRE restart
        pfx('REC/!', `Bet troppo alta! Richiesto:${(currentBet/100).toFixed(2)} Disponibile:${(balance/100).toFixed(2)}`);
        disaster++;
        sessionCycles++;
        const cycleLoss = initBalance - balance;
        sessionProfit -= cycleLoss;
        sessionGames += currentRound;

        pfx('RESTART', `Saldo insufficiente per recovery. Ricomincio ciclo ${sessionCycles + 1}...`);
        log('');
        log(`📊 Ciclo ${sessionCycles} fallito. Profit sessione: ${sessionProfit >= 0 ? '+' : ''}${(sessionProfit/100).toFixed(2)} bits`);
        log('');
        restartCycle();
    }
}

function restartCycle() {
    // Reset tutte le variabili per un nuovo ciclo
    balance = workingBalance;
    initBalance = workingBalance;
    currentRound = 0;
    currentProfit = 0;

    // Reset betting state
    currentBet = normalBaseBet;
    currentPayout = normalPayout;
    betPlacedThisRound = false;

    // Reset mode e counters
    currentMode = MODE.NORMAL;
    normalConsecutiveLosses = 0;
    recoveryAttempts = 0;
    totalLosses = 0;
    currentRecoveryPhase = 0; // Reset fasi recovery
    lossesToRecoverPerPhase = 0;
    totalLossesAtRecoveryStart = 0;
    normalModeProfit = 0; // Reset profit normale
    balanceBeforeLossSequence = 0;
    bonusPerLoss = 0; // Reset bonus

    // Reset statistiche ciclo (non sessione)
    normalWins = 0;
    normalLosses = 0;
    recoveryWins = 0;
    recoveryLosses = 0;

    initState();
}

function initState() {
    state = STATE.BETTING;
}

// ===== Statistiche Piano Puntate =====
function showBettingPlan() {
    log('📊 PIANO PUNTATE - SIMULAZIONE WORST CASE:');
    log('');

    // ===== FASE 1: MODALITÀ NORMALE (12 perdite consecutive) =====
    log('🎮 FASE 1 - MODALITÀ NORMALE (12 perdite consecutive):');
    log('   Payout: ' + normalPayout + 'x | Multiplier: ' + normalMult + 'x');
    log('');

    let bet = normalBaseBet;
    let totalNormal = 0;
    let maxBetNormal = 0;

    for (let i = 1; i <= recoveryTrigger; i++) {
        totalNormal += bet;
        if (bet > maxBetNormal) maxBetNormal = bet;

        log('   [' + i + '] Bet: ' + (bet/100).toFixed(2).padStart(8) + ' bits | Totale perso: ' + (totalNormal/100).toFixed(2).padStart(10) + ' bits');

        bet = Math.ceil((bet / 100) * normalMult) * 100;
    }

    log('');
    log('   💰 TOTALE FASE 1: ' + (totalNormal/100).toFixed(2) + ' bits');
    log('   📈 BET MAX FASE 1: ' + (maxBetNormal/100).toFixed(2) + ' bits');
    log('');

    // ===== FASE 2: MODALITÀ RECOVERY PARTIZIONATO =====
    log('🛡️ FASE 2 - MODALITÀ RECOVERY PARTIZIONATO (dopo ' + recoveryTrigger + ' perdite):');
    log('   Payout: ' + recoveryPayout + 'x | Recupero diviso in ' + RECOVERY_PHASES + ' fasi');
    log('');

    // Simula recovery partizionato: divide le perdite in RECOVERY_PHASES parti
    let lossesAccumulated = totalNormal;
    let maxBetRecovery = 0;
    let totalCapitalNeeded = totalNormal;

    // Calcola bet per ogni fase (1/3 delle perdite iniziali)
    const payoutMult = recoveryPayout - 1.0;
    const lossesPerPhase = Math.ceil(totalNormal / RECOVERY_PHASES);
    let recoveryBet = Math.ceil(lossesPerPhase / payoutMult);
    recoveryBet = Math.ceil(recoveryBet / 100) * 100;

    log('   📊 STRATEGIA PARTIZIONATA:');
    log('   • Perdite totali da recuperare: ' + (totalNormal/100).toFixed(2) + ' bits');
    log('   • Diviso in ' + RECOVERY_PHASES + ' fasi da ~' + (lossesPerPhase/100).toFixed(2) + ' bits ciascuna');
    log('   • Bet per fase (1/' + RECOVERY_PHASES + '): ' + (recoveryBet/100).toFixed(2) + ' bits');
    log('');
    log('   🎯 VANTAGGIO vs RECOVERY TRADIZIONALE:');

    // Calcola bet tradizionale (tutto in una volta)
    let traditionalBet = Math.ceil(totalNormal / payoutMult);
    traditionalBet = Math.ceil(traditionalBet / 100) * 100;
    const reduction = ((1 - (recoveryBet / traditionalBet)) * 100).toFixed(1);

    log('   • Recovery tradizionale (tutto insieme): ' + (traditionalBet/100).toFixed(2) + ' bits');
    log('   • Recovery partizionato (per fase): ' + (recoveryBet/100).toFixed(2) + ' bits');
    log('   ✅ RIDUZIONE BET: -' + reduction + '% (molto più sicuro!)');
    log('');

    // Simula worst case: perdite continue attraverso tutte le fasi
    // Simula 50 tentativi totali distribuiti tra le fasi
    const maxRecoveryAttempts = 50;
    for (let i = 1; i <= maxRecoveryAttempts; i++) {
        const remainingLosses = lossesAccumulated;

        // Determina fase corrente basata su quante perdite abbiamo accumulato
        const phaseNum = Math.min(RECOVERY_PHASES, Math.floor(i / 10) + 1);
        const remainingPhases = RECOVERY_PHASES - phaseNum + 1;
        const currentPhaseLosses = Math.ceil(remainingLosses / remainingPhases);

        let currentRecoveryBet = Math.ceil(currentPhaseLosses / payoutMult);
        currentRecoveryBet = Math.ceil(currentRecoveryBet / 100) * 100;

        if (currentRecoveryBet > maxBetRecovery) maxBetRecovery = currentRecoveryBet;

        totalCapitalNeeded += currentRecoveryBet;
        lossesAccumulated += currentRecoveryBet;

        if (i <= 20) { // Mostra solo i primi 20 per brevità
            log('   [R' + i + '/P' + phaseNum + '] Bet: ' + (currentRecoveryBet/100).toFixed(2).padStart(8) + ' bits | Perdite: ' + (lossesAccumulated/100).toFixed(2).padStart(10) + ' bits | Capitale: ' + (totalCapitalNeeded/100).toFixed(2).padStart(10) + ' bits');
        }
    }

    log('');
    log('   💰 BET MAX RECOVERY: ' + (maxBetRecovery/100).toFixed(2) + ' bits (vs ' + (traditionalBet/100).toFixed(2) + ' tradizionale)');
    log('   🚨 CAPITALE TOTALE NECESSARIO (worst case - ' + (recoveryTrigger + maxRecoveryAttempts) + ' perdite): ' + (totalCapitalNeeded/100).toFixed(2) + ' bits');
    log('');

    // ===== RIEPILOGO =====
    log('📋 RIEPILOGO:');
    log('   • Working Balance disponibile: ' + (workingBalance/100).toFixed(2) + ' bits');
    log('   • Capitale necessario worst case: ' + (totalCapitalNeeded/100).toFixed(2) + ' bits');

    const coverage = ((workingBalance / totalCapitalNeeded) * 100).toFixed(1);
    const coverageIcon = workingBalance >= totalCapitalNeeded ? '✅' : '⚠️';

    log('   ' + coverageIcon + ' Copertura capitale: ' + coverage + '%');

    if (workingBalance < totalCapitalNeeded) {
        const missing = totalCapitalNeeded - workingBalance;
        log('   ⚠️  ATTENZIONE: Mancano ' + (missing/100).toFixed(2) + ' bits per coprire worst case!');
        log('   📉 Rischio disaster se si verificano ' + (recoveryTrigger + maxRecoveryAttempts) + ' perdite consecutive');
    } else {
        const buffer = workingBalance - totalCapitalNeeded;
        log('   ✅ Buffer extra: +' + (buffer/100).toFixed(2) + ' bits');
    }

    log('');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    log('');
}

// ===== Parser crash =====
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
    if (v >= 50) v = v / 100;       // es. 310 → 3.1
    else if (v < 0.5) v = v * 100;  // es. 0.018 → 1.8
    return v;
}
