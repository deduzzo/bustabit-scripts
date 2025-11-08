/**
 * ⚙️ MARTIN AI v3 - DUAL MODE STRATEGY with PROFIT TARGET
 *
 * STRATEGIA A DUE MODALITÀ CON LIMITE DI PROFITTO:
 *
 * 🎮 MODALITÀ 1 (NORMALE):
 *    • Payout: 3.0x
 *    • Base Bet: 100 bits
 *    • Multiplier: 1.50x
 *    • Target profit per ciclo: 200 bits (2 bits in display)
 *
 * 🛡️ MODALITÀ 2 (RECUPERO):
 *    • Trigger: Dopo X perdite consecutive in Modalità 1
 *    • Payout: 2.0x (più probabile - 50% win rate)
 *    • Bet calcolata dinamicamente per recuperare tutto + 200 bits
 *    • Max tentativi recupero: 12 (configurabile)
 *    • Ogni perdita ricalcola la bet necessaria
 *
 * 💡 LOGICA RECUPERO:
 *    Se perdi N volte in modalità normale e hai perso totale T bits:
 *    betRecovery = (T + 200) / (payout - 1)
 *    Con payout 2.0x: betRecovery = (T + 200) / 1.0
 *
 * 🎯 AUTO-STOP:
 *    Lo script si ferma automaticamente quando raggiunge il target profit %
 *    Esempio: workingBalance 50.000, targetProfit 10% → stop a +5.000 bits
 *
 * 📊 CAPITALE RACCOMANDATO: 50.000 bits minimo
 */
var config = {
    // ===== CAPITALE E TARGET =====
    workingBalance: { value: 2000000, type: 'balance', label: 'Working Balance (bits to use)' },
    targetProfitPercent: { value: 25, type: 'multiplier', label: 'Target Profit % (stop when reached)' },

    // ===== MODALITÀ 1 (NORMALE) =====
    payout: { value: 3.0, type: 'multiplier', label: 'Normal Mode Payout' },
    baseBet: { value: 100, type: 'balance', label: 'Base Bet' },
    mult: { value: 1.50, type: 'multiplier', label: 'Multiplier after loss' },

    // ===== MODALITÀ 2 (RECUPERO) =====
    recoveryTrigger: { value: 14, type: 'multiplier', label: 'Losses before recovery mode' },
    recoveryPayout: { value: 1.2, type: 'multiplier', label: 'Recovery Mode Payout' },
    recoveryMaxTimes: { value: 20, type: 'multiplier', label: 'Max recovery attempts' },
};

// Configurazione base
const workingBalance = config.workingBalance.value;
const targetProfitPercent = config.targetProfitPercent.value;
const normalPayout = config.payout.value;
const normalBaseBet = config.baseBet.value;
const normalMult = config.mult.value;

const recoveryTrigger = config.recoveryTrigger.value;
const recoveryPayout = config.recoveryPayout.value;
const recoveryMaxTimes = config.recoveryMaxTimes.value;

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
let recoveryAttempts = 0; // Tentativi di recupero
let totalLosses = 0; // Totale perdite da recuperare
let currentBet = normalBaseBet;
let currentPayout = normalPayout;
let betPlacedThisRound = false;

// Tracking profit separato per modalità
let normalModeProfit = 0; // Profitto netto dalla modalità normale (conta per target)
let balanceBeforeLossSequence = 0; // Balance prima di iniziare la sequenza di perdite

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
log('║  🏆 MARTIN AI v3 - DUAL MODE STRATEGY                     ║');
log('╚════════════════════════════════════════════════════════════╝');
log('');
log('📊 MODALITÀ 1 (NORMALE):');
log(`   • Payout: ${normalPayout}x`);
log(`   • Base Bet: ${(normalBaseBet/100).toFixed(2)} bits`);
log(`   • Multiplier: ${normalMult}x`);
log('');
log('🛡️ MODALITÀ 2 (RECUPERO):');
log(`   • Trigger: ${recoveryTrigger} perdite consecutive`);
log(`   • Payout: ${recoveryPayout}x`);
log(`   • Max tentativi: ${recoveryMaxTimes}`);
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
    if ((balance - currentBet) < 0) {
        // DISASTER: SEMPRE restart con nuovo ciclo
        disaster++;
        sessionCycles++;
        const cycleLoss = initBalance - balance;
        sessionProfit -= cycleLoss;
        sessionGames += currentRound;

        pfx('ERR', `Saldo insufficiente! R:${currentRound} bet:${(currentBet/100).toFixed(2)}`);
        pfx('ERR', `Balance: ${(balance/100).toFixed(2)} < Bet: ${(currentBet/100).toFixed(2)}`);
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
    pfx(`${modeTag}/S`, `R:${currentRound} bet:${(currentBet/100).toFixed(2)} @${currentPayout}x bal:${(balance/100).toFixed(2)} [${currentMode === MODE.NORMAL ? `L:${normalConsecutiveLosses}` : `A:${recoveryAttempts}/${recoveryMaxTimes}`}]`);

    engine.bet(currentBet, currentPayout);
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
            state = STATE.BETTING;
        } else {
            // ⚠️ CASHOUT PARZIALE → incrementa bet ma NON conta come perdita consecutiva
            normalLosses++;
            // NON incrementa normalConsecutiveLosses - non è una perdita vera!

            pfx(`${modeTag}/P`, `⚠️ PARZIALE @${lastGame.cashedAt}x (target:${targetPayout}x) → continua martingala [L:${normalConsecutiveLosses}/${recoveryTrigger}]`);

            // Continua in modalità normale con martingala (come se fosse una perdita)
            currentBet = Math.ceil((currentBet / 100) * normalMult) * 100;
            pfx('NRM/+', `next bet:${(currentBet/100).toFixed(2)}`);
        }
    } else {
        // RECOVERY MODE
        if (isExactCashout) {
            // ✅ WIN RECOVERY al target → torna a normale
            recoveryWins++;
            pfx(`${modeTag}/W`, `🎯 RECUPERO! crash:${crash} profit:+${(profit/100).toFixed(2)} bal:${(balance/100).toFixed(2)}`);
            switchToNormalMode();
        } else {
            // ⚠️ CASHOUT PARZIALE in recovery → continua recovery ma NON conta come tentativo
            recoveryLosses++;
            // NON incrementa recoveryAttempts - non è una perdita vera!

            // Ricalcola totalLosses come differenza reale dal balance PRIMA della sequenza
            totalLosses = balanceBeforeLossSequence - balance;

            pfx(`${modeTag}/P`, `⚠️ PARZIALE @${lastGame.cashedAt}x (target:${targetPayout}x) → continua RECOVERY [A:${recoveryAttempts}/${recoveryMaxTimes}]`);

            if (recoveryAttempts >= recoveryMaxTimes) {
                // Max tentativi raggiunto → SEMPRE restart
                pfx('REC/X', `Max tentativi recupero raggiunto.`);
                disaster++;
                sessionCycles++;
                const cycleLoss = initBalance - balance;
                sessionProfit -= cycleLoss;
                sessionGames += currentRound;

                pfx('RESTART', `Max recovery raggiunto. Ricomincio ciclo ${sessionCycles + 1}...`);
                log('');
                log(`📊 Ciclo ${sessionCycles} fallito (max recovery). Profit sessione: ${sessionProfit >= 0 ? '+' : ''}${(sessionProfit/100).toFixed(2)} bits`);
                log('');
                restartCycle();
            } else {
                // Ricalcola bet per recupero considerando le perdite accumulate
                calculateRecoveryBet();
            }
        }
    }
}

function handleLoss(crash) {
    balance -= currentBet;
    const modeTag = currentMode === MODE.NORMAL ? 'NRM' : 'REC';

    if (currentMode === MODE.NORMAL) {
        normalLosses++;

        // Se è la prima perdita della sequenza, salva il balance PRIMA della perdita
        if (normalConsecutiveLosses === 0) {
            balanceBeforeLossSequence = balance + currentBet; // Balance prima di questa perdita
        }

        normalConsecutiveLosses++;
        // totalLosses non serve più - verrà calcolato in switchToRecoveryMode()

        pfx(`${modeTag}/L`, `❌ crash:${crash} loss:-${(currentBet/100).toFixed(2)} bal:${(balance/100).toFixed(2)} [L:${normalConsecutiveLosses}/${recoveryTrigger}]`);

        // Check se passare a recovery mode
        if (normalConsecutiveLosses >= recoveryTrigger) {
            // Dopo 12 perdite consecutive, SEMPRE passare a recovery mode
            switchToRecoveryMode();
        } else {
            // Continua in modalità normale con martingala
            currentBet = Math.ceil((currentBet / 100) * normalMult) * 100;
            pfx('NRM/+', `next bet:${(currentBet/100).toFixed(2)}`);
        }
    } else {
        // RECOVERY MODE LOSS
        recoveryLosses++;
        recoveryAttempts++;
        // Ricalcola totalLosses dal balance PRIMA della sequenza
        totalLosses = balanceBeforeLossSequence - balance;

        pfx(`${modeTag}/L`, `❌ crash:${crash} loss:-${(currentBet/100).toFixed(2)} bal:${(balance/100).toFixed(2)} [A:${recoveryAttempts}/${recoveryMaxTimes}]`);

        if (recoveryAttempts >= recoveryMaxTimes) {
            // Troppi tentativi di recupero falliti → SEMPRE restart
            pfx('REC/X', `Max tentativi recupero raggiunto.`);
            disaster++;
            sessionCycles++;
            const cycleLoss = initBalance - balance;
            sessionProfit -= cycleLoss;
            sessionGames += currentRound;

            pfx('RESTART', `Max recovery raggiunto. Ricomincio ciclo ${sessionCycles + 1}...`);
            log('');
            log(`📊 Ciclo ${sessionCycles} fallito (max recovery). Profit sessione: ${sessionProfit >= 0 ? '+' : ''}${(sessionProfit/100).toFixed(2)} bits`);
            log('');
            restartCycle();
        } else {
            // Ricalcola bet per recupero
            calculateRecoveryBet();
        }
    }
}

function switchToRecoveryMode() {
    currentMode = MODE.RECOVERY;
    recoveryAttempts = 0;
    currentPayout = recoveryPayout;

    // Calcola il loss REALE dal balance PRIMA della sequenza di perdite (non dal initBalance)
    const actualLoss = balanceBeforeLossSequence - balance;
    totalLosses = actualLoss; // Sovrascrive con il loss effettivo

    pfx('MODE', `🛡️ SWITCH TO RECOVERY MODE`);
    pfx('INFO', `Actual balance loss to recover: ${(actualLoss/100).toFixed(2)} bits (from ${(balanceBeforeLossSequence/100).toFixed(2)} to ${(balance/100).toFixed(2)})`);

    calculateRecoveryBet();
}

function switchToNormalMode() {
    currentMode = MODE.NORMAL;
    normalConsecutiveLosses = 0;
    recoveryAttempts = 0;
    totalLosses = 0;
    currentBet = normalBaseBet;
    currentPayout = normalPayout;
    state = STATE.BETTING;

    pfx('MODE', `🎮 BACK TO NORMAL MODE`);
}

function calculateRecoveryBet() {
    // Formula: per vincere X con payout P, devo puntare X / (P - 1)
    // Vogliamo solo recuperare totalLosses (non aggiungere targetProfit)
    const payoutMultiplier = recoveryPayout - 1.0;

    currentBet = Math.ceil(totalLosses / payoutMultiplier);

    // Arrotonda a 100
    currentBet = Math.ceil(currentBet / 100) * 100;

    pfx('REC/C', `Calculated bet:${(currentBet/100).toFixed(2)} to recover:${(totalLosses/100).toFixed(2)} @${recoveryPayout}x`);

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
    normalModeProfit = 0; // Reset profit normale
    balanceBeforeLossSequence = 0;

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

    // ===== FASE 2: MODALITÀ RECOVERY =====
    log('🛡️ FASE 2 - MODALITÀ RECOVERY (dopo ' + recoveryTrigger + ' perdite):');
    log('   Payout: ' + recoveryPayout + 'x | Bet dinamica per recuperare tutto');
    log('');

    // Simula recovery: ogni perdita ricalcola la bet necessaria
    let lossesAccumulated = totalNormal;
    let maxBetRecovery = 0;
    let totalCapitalNeeded = totalNormal;

    for (let i = 1; i <= recoveryMaxTimes; i++) {
        // Calcola bet necessaria per recuperare tutte le perdite accumulate
        const payoutMult = recoveryPayout - 1.0;
        let recoveryBet = Math.ceil(lossesAccumulated / payoutMult);
        recoveryBet = Math.ceil(recoveryBet / 100) * 100;

        if (recoveryBet > maxBetRecovery) maxBetRecovery = recoveryBet;

        // Aggiungi questa bet al capitale necessario
        totalCapitalNeeded += recoveryBet;
        lossesAccumulated += recoveryBet;

        log('   [R' + i + '] Bet: ' + (recoveryBet/100).toFixed(2).padStart(8) + ' bits | Perdite accumulate: ' + (lossesAccumulated/100).toFixed(2).padStart(10) + ' bits | Capitale totale: ' + (totalCapitalNeeded/100).toFixed(2).padStart(10) + ' bits');
    }

    log('');
    log('   💰 BET MAX RECOVERY: ' + (maxBetRecovery/100).toFixed(2) + ' bits');
    log('   🚨 CAPITALE TOTALE NECESSARIO (worst case - ' + (recoveryTrigger + recoveryMaxTimes) + ' perdite): ' + (totalCapitalNeeded/100).toFixed(2) + ' bits');
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
        log('   📉 Rischio disaster se si verificano ' + (recoveryTrigger + recoveryMaxTimes) + ' perdite consecutive');
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
