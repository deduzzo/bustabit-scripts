/**
 * MARTIN CYCLE v1.0 - PROGRESSIVE CYCLE + RECOVERY MARTINGALE
 *
 * STRATEGIA A CICLI CON LIMITE PERDITE:
 *
 * 🎮 MODE 1 (CICLO NORMALE):
 *    • Payout fisso configurabile (es. 2.4x)
 *    • N round per ciclo (configurabile)
 *    • Bet sempre crescente: ogni round (win o loss) → bet *= customMult
 *    • Fine ciclo: calcola profitto = (totale vinto - totale puntato)
 *    • Se perdita ≤ X% del puntato → ricomincia Mode 1
 *    • Se perdita > X% del puntato → passa a Mode 2
 *
 * 🛡️ MODE 2 (RECOVERY MARTINGALE):
 *    • Trigger: perdita > soglia% in Mode 1
 *    • Base bet = perdita totale / divisore (es. 3)
 *    • Payout recovery configurabile (es. 3x)
 *    • Martingale classica: moltiplica solo dopo LOSS
 *    • Esce quando:
 *      - Vince (recupera perdite)
 *      - Raggiunge max tentativi
 *      - Supera limite spesa ciclo
 *
 * 💰 LIMITE SPESA:
 *    • Max % del working balance per ciclo (Mode1 + Mode2)
 *    • Se raggiunto → accetta perdita e ricomincia Mode 1
 *
 * 🎯 OBIETTIVO:
 *    • Limitare perdite grandi
 *    • Profitto nel breve periodo basato su statistica
 */

var config = {
    // ===== CAPITALE E TARGET =====
    workingBalance: { value: 1000000, type: 'balance', label: 'Working Balance (bankroll virtuale)' },  // 10000 bits
    targetProfitPercent: { value: 30, type: 'multiplier', label: 'Target Profit % (stop quando raggiunto)' },
    maxCycleSpendPercent: { value: 40, type: 'multiplier', label: 'Max spesa per ciclo (% del Working Balance)' },

    // ===== MODE 1 (CICLO NORMALE) =====
    mode1Payout: { value: 2.5, type: 'multiplier', label: 'Mode 1: Payout' },
    mode1BaseBet: { value: 500, type: 'balance', label: 'Mode 1: Base Bet' },  // 5 bits
    mode1Rounds: { value: 10, type: 'multiplier', label: 'Mode 1: Numero round per ciclo' },
    mode1Mult: { value: 1.6, type: 'multiplier', label: 'Mode 1: Moltiplicatore bet (ogni round)' },
    mode1LossThreshold: { value: 20, type: 'multiplier', label: 'Mode 1: Soglia perdita % per trigger Mode 2' },

    // ===== MODE 2 (RECOVERY) =====
    mode2Payout: { value: 3, type: 'multiplier', label: 'Mode 2: Payout recovery' },
    mode2MaxAttempts: { value: 20, type: 'multiplier', label: 'Mode 2: Max tentativi recovery' },
};

// ===== CONFIGURAZIONE =====
const WORKING_BALANCE = config.workingBalance.value;
const TARGET_PROFIT_PERCENT = config.targetProfitPercent.value;
const MAX_CYCLE_SPEND_PERCENT = config.maxCycleSpendPercent.value;

// Mode 1
const MODE1_PAYOUT = config.mode1Payout.value;
const MODE1_BASE_BET = config.mode1BaseBet.value;
const MODE1_ROUNDS = config.mode1Rounds.value;
const MODE1_MULT = config.mode1Mult.value;
const MODE1_LOSS_THRESHOLD = config.mode1LossThreshold.value;

// Mode 2
const MODE2_PAYOUT = config.mode2Payout.value;
const MODE2_MAX_ATTEMPTS = config.mode2MaxAttempts.value;

// Calcoli derivati
const TARGET_PROFIT_ABSOLUTE = Math.floor(WORKING_BALANCE * (TARGET_PROFIT_PERCENT / 100));
const MAX_CYCLE_SPEND = Math.floor(WORKING_BALANCE * (MAX_CYCLE_SPEND_PERCENT / 100));

// ===== STATO =====
const MODE = { MODE1: 'mode1', MODE2: 'mode2' };
const STATE = { BETTING: 'betting', STOPPED: 'stopped' };

let currentMode = MODE.MODE1;
let state = STATE.BETTING;

// Balance tracking manuale
let balance = WORKING_BALANCE;
let initBalance = WORKING_BALANCE;

// Ciclo corrente
let cycleNumber = 0;
let cycleStartBalance = WORKING_BALANCE;
let cycleTotalBet = 0;      // Totale puntato nel ciclo (Mode1 + Mode2)
let cycleTotalWon = 0;      // Totale vinto nel ciclo

// Mode 1 tracking
let mode1Round = 0;
let mode1TotalBet = 0;
let mode1TotalWon = 0;
let mode1CurrentBet = MODE1_BASE_BET;

// Mode 2 tracking
let mode2Attempts = 0;
let mode2LossesToRecover = 0;
let mode2CurrentBet = 0;

// Bet corrente
let currentBet = MODE1_BASE_BET;
let currentPayout = MODE1_PAYOUT;
let betPlacedThisRound = false;

// Accantonamento profitti da cashout manuali
// Vengono aggiunti al balance solo a fine ciclo per il target profit
let manualCashoutBuffer = 0;

// Statistiche
let totalCycles = 0;
let mode1Cycles = 0;
let mode2Triggers = 0;
let mode2Recoveries = 0;
let disasters = 0;

// ===== FUNZIONI UTILITY =====
function pfx(tag, msg) { log(`[${tag}] ${msg}`); }

function formatBits(satoshis) {
    return (satoshis / 100).toFixed(2);
}

// Arrotonda a multipli di 100 satoshi (1 bit)
function roundBet(satoshis) {
    return Math.ceil(satoshis / 100) * 100;
}

// ===== INIZIALIZZAZIONE =====
log('');
log('================================================================');
log('   MARTIN CYCLE v1.0 - PROGRESSIVE CYCLE + RECOVERY           ');
log('================================================================');
log('');
log('MODE 1 (CICLO NORMALE):');
log(`   Payout: ${MODE1_PAYOUT}x`);
log(`   Base Bet: ${formatBits(MODE1_BASE_BET)} bits`);
log(`   Round per ciclo: ${MODE1_ROUNDS}`);
log(`   Moltiplicatore: ${MODE1_MULT}x (ogni round)`);
log(`   Soglia perdita per Mode 2: ${MODE1_LOSS_THRESHOLD}%`);
log('');
log('MODE 2 (RECOVERY MARTINGALE):');
log(`   Payout: ${MODE2_PAYOUT}x`);
log(`   Bet: perdite_totali / (payout-1) = recupero completo con 1 vincita`);
log(`   Dopo loss: ricalcola bet per recuperare TUTTE le perdite accumulate`);
log(`   Max tentativi: ${MODE2_MAX_ATTEMPTS}`);
log('');
log('LIMITI:');
log(`   Working Balance: ${formatBits(WORKING_BALANCE)} bits`);
log(`   Target Profit: ${TARGET_PROFIT_PERCENT}% (+${formatBits(TARGET_PROFIT_ABSOLUTE)} bits)`);
log(`   Max spesa ciclo: ${MAX_CYCLE_SPEND_PERCENT}% (${formatBits(MAX_CYCLE_SPEND)} bits)`);
log('');
log('================================================================');
log('');

// Mostra simulazione Mode 1
showMode1Simulation();

// Inizia
startNewCycle();

// Hook engine
engine.on('GAME_STARTING', onGameStarted);
engine.on('GAME_ENDED', onGameEnded);

// ===== SIMULAZIONE MODE 1 =====
function showMode1Simulation() {
    log('SIMULAZIONE MODE 1 (worst case - tutte perdite):');
    log('');

    let bet = roundBet(MODE1_BASE_BET);
    let totalBet = 0;

    for (let i = 1; i <= MODE1_ROUNDS; i++) {
        totalBet += bet;
        log(`   Round ${i}: bet ${formatBits(bet).padStart(10)} bits | Totale: ${formatBits(totalBet).padStart(12)} bits`);
        bet = roundBet(bet * MODE1_MULT);
    }

    log('');
    log(`   TOTALE MAX MODE 1: ${formatBits(totalBet)} bits`);

    // Soglia per Mode 2
    const threshold = roundBet(totalBet * (MODE1_LOSS_THRESHOLD / 100));
    log(`   Soglia perdita (${MODE1_LOSS_THRESHOLD}%): ${formatBits(threshold)} bits`);
    log(`   Se perdo > ${formatBits(threshold)} bits → Mode 2`);
    log('');

    // Simulazione Mode 2 (se trigger)
    const payoutProfit = MODE2_PAYOUT - 1;
    const mode2BaseBet = roundBet(totalBet / payoutProfit);
    log('SIMULAZIONE MODE 2 (se triggerato):');
    log(`   Perdite da recuperare: ${formatBits(totalBet)} bits`);
    log(`   Base bet recovery: ${formatBits(totalBet)} / ${payoutProfit} = ${formatBits(mode2BaseBet)} bits`);
    log(`   Se vinci @${MODE2_PAYOUT}x: ${formatBits(mode2BaseBet)} × ${payoutProfit} = ${formatBits(mode2BaseBet * payoutProfit)} bits (RECUPERO COMPLETO)`);
    log('');
    log('================================================================');
    log('');
}

// ===== GESTIONE CICLI =====
function startNewCycle() {
    cycleNumber++;
    totalCycles++;

    // LIBERA i profitti accantonati da cashout manuali del ciclo precedente
    // Ora vengono contati per il target profit
    if (manualCashoutBuffer !== 0) {
        pfx('BUFFER', `Profitti cashout manuali liberati: ${manualCashoutBuffer >= 0 ? '+' : ''}${formatBits(manualCashoutBuffer)} bits`);
        manualCashoutBuffer = 0; // Reset buffer (i profitti sono già nel balance)
    }

    // Reset tracking ciclo
    cycleStartBalance = balance;
    cycleTotalBet = 0;
    cycleTotalWon = 0;

    // Reset Mode 1
    currentMode = MODE.MODE1;
    mode1Round = 0;
    mode1TotalBet = 0;
    mode1TotalWon = 0;
    mode1CurrentBet = roundBet(MODE1_BASE_BET);

    // Reset Mode 2
    mode2Attempts = 0;
    mode2LossesToRecover = 0;
    mode2CurrentBet = 0;

    // Imposta bet iniziale (arrotonda a multipli di 100)
    currentBet = roundBet(MODE1_BASE_BET);
    currentPayout = MODE1_PAYOUT;

    pfx('CYCLE', `=== NUOVO CICLO #${cycleNumber} === Balance: ${formatBits(balance)} bits`);
    mode1Cycles++;
}

function evaluateMode1Cycle() {
    // Calcola profitto/perdita del ciclo Mode 1
    const profit = mode1TotalWon - mode1TotalBet;
    const lossPercent = mode1TotalBet > 0 ? Math.abs(profit) / mode1TotalBet * 100 : 0;

    pfx('M1/END', `Fine ciclo Mode 1: Puntato=${formatBits(mode1TotalBet)} Vinto=${formatBits(mode1TotalWon)} P/L=${profit >= 0 ? '+' : ''}${formatBits(profit)} (${lossPercent.toFixed(1)}%)`);

    if (profit >= 0) {
        // In profitto → ricomincia Mode 1
        pfx('M1/OK', `Ciclo in PROFITTO! Ricomincia Mode 1`);
        startNewCycle();
    } else if (lossPercent <= MODE1_LOSS_THRESHOLD) {
        // Perdita contenuta → ricomincia Mode 1
        pfx('M1/OK', `Perdita contenuta (${lossPercent.toFixed(1)}% <= ${MODE1_LOSS_THRESHOLD}%). Ricomincia Mode 1`);
        startNewCycle();
    } else {
        // Perdita eccessiva → Mode 2
        pfx('M1/BAD', `Perdita eccessiva (${lossPercent.toFixed(1)}% > ${MODE1_LOSS_THRESHOLD}%). TRIGGER MODE 2!`);
        switchToMode2(Math.abs(profit));
    }
}

function switchToMode2(lossesToRecover) {
    currentMode = MODE.MODE2;
    mode2Triggers++;
    mode2Attempts = 0;
    mode2LossesToRecover = lossesToRecover;

    // Calcola base bet per recovery COMPLETO con 1 vincita:
    // Per recuperare L con payout P, serve: bet × (P-1) = L
    // Quindi: bet = L / (P-1)
    const payoutProfit = MODE2_PAYOUT - 1;
    mode2CurrentBet = roundBet(lossesToRecover / payoutProfit);

    currentBet = mode2CurrentBet;
    currentPayout = MODE2_PAYOUT;

    pfx('MODE2', `=== RECOVERY MODE ===`);
    pfx('MODE2', `Perdite da recuperare: ${formatBits(mode2LossesToRecover)} bits`);
    pfx('MODE2', `Bet: ${formatBits(mode2CurrentBet)} bits (1 vincita @${MODE2_PAYOUT}x = recupero completo)`);
    pfx('MODE2', `Payout: ${MODE2_PAYOUT}x | Max tentativi: ${MODE2_MAX_ATTEMPTS}`);
}

function checkCycleLimit() {
    // Verifica se abbiamo superato il limite di spesa del ciclo
    if (cycleTotalBet >= MAX_CYCLE_SPEND) {
        pfx('LIMIT', `Raggiunto limite spesa ciclo: ${formatBits(cycleTotalBet)} >= ${formatBits(MAX_CYCLE_SPEND)}`);
        pfx('LIMIT', `Accetto perdita e ricomincia nuovo ciclo`);

        const cycleLoss = cycleStartBalance - balance;
        if (cycleLoss > 0) {
            disasters++;
            pfx('LOSS', `Perdita ciclo: -${formatBits(cycleLoss)} bits`);
        }

        startNewCycle();
        return true;
    }
    return false;
}

// ===== GAME HANDLERS =====
function onGameStarted() {
    betPlacedThisRound = false;

    if (state === STATE.STOPPED) {
        return;
    }

    // Check target profit (ESCLUDI i profitti accantonati da cashout manuali)
    // I profitti da cashout manuali vengono contati solo a fine ciclo
    const currentProfit = balance - initBalance - manualCashoutBuffer;
    if (currentProfit >= TARGET_PROFIT_ABSOLUTE) {
        // Libera il buffer prima di fermarsi
        if (manualCashoutBuffer !== 0) {
            pfx('BUFFER', `Profitti cashout manuali liberati: ${manualCashoutBuffer >= 0 ? '+' : ''}${formatBits(manualCashoutBuffer)} bits`);
        }
        const totalProfit = balance - initBalance;
        state = STATE.STOPPED;
        pfx('TARGET', `RAGGIUNTO! Profit: +${formatBits(totalProfit)} bits (${TARGET_PROFIT_PERCENT}%)`);
        showFinalStats();
        return;
    }

    // Check limite spesa ciclo PRIMA di piazzare la bet
    if (cycleTotalBet + currentBet > MAX_CYCLE_SPEND) {
        pfx('LIMIT', `Prossima bet supererebbe limite ciclo. Reset.`);
        if (currentMode === MODE.MODE2) {
            // Se in Mode 2, accetta perdita
            const cycleLoss = cycleStartBalance - balance;
            if (cycleLoss > 0) {
                disasters++;
                pfx('LOSS', `Perdita ciclo Mode 2: -${formatBits(cycleLoss)} bits`);
            }
        }
        startNewCycle();
        return;
    }

    // Check saldo sufficiente
    if (currentBet > balance) {
        pfx('ERR', `Saldo insufficiente! Bet: ${formatBits(currentBet)} > Balance: ${formatBits(balance)}`);
        disasters++;

        // Reset balance e ricomincia
        balance = WORKING_BALANCE;
        initBalance = WORKING_BALANCE;
        startNewCycle();
        return;
    }

    // Piazza bet
    const modeTag = currentMode === MODE.MODE1 ? 'M1' : 'M2';
    const roundInfo = currentMode === MODE.MODE1
        ? `R:${mode1Round + 1}/${MODE1_ROUNDS}`
        : `Att:${mode2Attempts + 1}/${MODE2_MAX_ATTEMPTS}`;

    pfx(`${modeTag}/BET`, `${roundInfo} bet:${formatBits(currentBet)} @${currentPayout}x bal:${formatBits(balance)} [spent:${formatBits(cycleTotalBet)}/${formatBits(MAX_CYCLE_SPEND)}]`);

    engine.bet(currentBet, currentPayout);
    betPlacedThisRound = true;
}

function onGameEnded() {
    if (state === STATE.STOPPED || !betPlacedThisRound) {
        return;
    }

    const lastGame = engine.history.first();
    const crash = parseCrash(lastGame);

    // VERIFICA che ho effettivamente partecipato a questo gioco
    if (!lastGame.wager || lastGame.wager <= 0) {
        pfx('SKIP', `Non ho partecipato a questo gioco`);
        betPlacedThisRound = false;
        return;
    }

    const cashedAt = lastGame.cashedAt;

    // 1. EMERGENCY RESET: cashout a 1.01x → reset immediato al Mode 1
    //    (tolleranza 1.00-1.02 per evitare problemi di precisione)
    if (cashedAt && cashedAt >= 1.00 && cashedAt <= 1.02) {
        handleEmergencyReset(lastGame, crash);
        betPlacedThisRound = false;
        return;
    }

    // 2. CASHOUT MANUALE: cashedAt esiste ma < target payout → PERDITA LOGICA
    //    L'utente ha fatto cashout prima del target, considerato come sconfitta
    if (cashedAt && cashedAt < currentPayout) {
        handleManualCashout(lastGame, crash);
        betPlacedThisRound = false;
        return;
    }

    // 3. VINCITA NORMALE: crash >= payout (e cashedAt >= payout o automatico)
    if (crash >= currentPayout) {
        handleWin(lastGame, crash);
    } else {
        // 4. PERDITA: crash < payout (il gioco è crashato prima del target)
        handleLoss(lastGame, crash);
    }

    betPlacedThisRound = false;
}

function handleWin(lastGame, crash) {
    // USA I VALORI REALI DEL GIOCO per calcolare il profitto effettivo
    const wager = lastGame.wager;
    const payout = lastGame.cashedAt;
    const won = Math.floor(wager * payout);
    const profit = won - wager;

    balance += profit;
    cycleTotalBet += wager;
    cycleTotalWon += won;

    const modeTag = currentMode === MODE.MODE1 ? 'M1' : 'M2';

    if (currentMode === MODE.MODE1) {
        mode1Round++;
        mode1TotalBet += wager;
        mode1TotalWon += won;

        pfx(`${modeTag}/WIN`, `R:${mode1Round}/${MODE1_ROUNDS} @${crash}x +${formatBits(profit)} bal:${formatBits(balance)}`);

        // Mode 1: dopo win, moltiplica comunque e continua
        if (mode1Round >= MODE1_ROUNDS) {
            // Fine ciclo Mode 1
            evaluateMode1Cycle();
        } else {
            // Prossimo round con bet aumentata (arrotonda a multipli di 100)
            mode1CurrentBet = roundBet(mode1CurrentBet * MODE1_MULT);
            currentBet = mode1CurrentBet;
            pfx('M1/NEXT', `Prossima bet: ${formatBits(currentBet)} bits`);
        }
    } else {
        // Mode 2: WIN = recovery completato (o parziale)
        mode2Attempts++;

        pfx(`${modeTag}/WIN`, `Att:${mode2Attempts}/${MODE2_MAX_ATTEMPTS} @${crash}x +${formatBits(profit)} bal:${formatBits(balance)}`);

        // Verifica se abbiamo recuperato
        const cycleProfit = balance - cycleStartBalance;

        if (cycleProfit >= 0) {
            // Recovery completo!
            mode2Recoveries++;
            pfx('M2/OK', `RECOVERY COMPLETO! Profit ciclo: +${formatBits(cycleProfit)} bits`);
            startNewCycle();
        } else {
            // Ancora in perdita, ma questa vincita ha aiutato
            const remaining = Math.abs(cycleProfit);
            pfx('M2/PARTIAL', `Vincita parziale. Ancora da recuperare: ${formatBits(remaining)} bits`);

            // Ricalcola bet per recuperare il resto
            mode2LossesToRecover = remaining;
            const payoutProfit = MODE2_PAYOUT - 1;
            mode2CurrentBet = roundBet(remaining / payoutProfit);
            currentBet = mode2CurrentBet;

            // Verifica limite tentativi
            if (mode2Attempts >= MODE2_MAX_ATTEMPTS) {
                pfx('M2/MAX', `Raggiunto max tentativi (${MODE2_MAX_ATTEMPTS}). Accetto perdita.`);
                disasters++;
                startNewCycle();
            }
        }
    }
}

function handleLoss(lastGame, crash) {
    // USA I VALORI REALI DEL GIOCO
    const wager = lastGame.wager;
    balance -= wager;
    cycleTotalBet += wager;

    const modeTag = currentMode === MODE.MODE1 ? 'M1' : 'M2';

    if (currentMode === MODE.MODE1) {
        mode1Round++;
        mode1TotalBet += wager;

        pfx(`${modeTag}/LOSS`, `R:${mode1Round}/${MODE1_ROUNDS} @${crash}x -${formatBits(wager)} bal:${formatBits(balance)}`);

        // Mode 1: dopo loss, moltiplica comunque e continua
        if (mode1Round >= MODE1_ROUNDS) {
            // Fine ciclo Mode 1
            evaluateMode1Cycle();
        } else {
            // Prossimo round con bet aumentata (arrotonda a multipli di 100)
            mode1CurrentBet = roundBet(mode1CurrentBet * MODE1_MULT);
            currentBet = mode1CurrentBet;
            pfx('M1/NEXT', `Prossima bet: ${formatBits(currentBet)} bits`);
        }
    } else {
        // Mode 2: LOSS = ricalcola bet per recuperare TUTTE le perdite accumulate
        mode2Attempts++;

        // Aggiorna perdite totali (aggiungi la bet appena persa)
        mode2LossesToRecover += wager;

        pfx(`${modeTag}/LOSS`, `Att:${mode2Attempts}/${MODE2_MAX_ATTEMPTS} @${crash}x -${formatBits(wager)} bal:${formatBits(balance)} [Perdite totali: ${formatBits(mode2LossesToRecover)}]`);

        // Verifica limite tentativi
        if (mode2Attempts >= MODE2_MAX_ATTEMPTS) {
            pfx('M2/MAX', `Raggiunto max tentativi (${MODE2_MAX_ATTEMPTS}). Accetto perdita.`);
            disasters++;
            startNewCycle();
            return;
        }

        // Verifica limite spesa
        if (checkCycleLimit()) {
            return;
        }

        // Martingale: ricalcola bet per recuperare TUTTE le perdite
        const payoutProfit = MODE2_PAYOUT - 1;
        mode2CurrentBet = roundBet(mode2LossesToRecover / payoutProfit);
        currentBet = mode2CurrentBet;

        pfx('M2/RECALC', `Nuova bet: ${formatBits(currentBet)} bits (per recuperare ${formatBits(mode2LossesToRecover)} bits)`);
    }
}

// ===== EMERGENCY RESET (cashout a 1.01x) =====
function handleEmergencyReset(lastGame, crash) {
    const wager = lastGame.wager;
    const cashedAt = lastGame.cashedAt;
    const won = Math.floor(wager * cashedAt);
    const profit = won - wager;

    // Aggiorna balance con il piccolo profitto del cashout 1.01x
    balance += profit;

    pfx('EMERGENCY', `🚨 EMERGENCY RESET! Cashout @${cashedAt}x rilevato`);
    pfx('EMERGENCY', `Profit: ${profit >= 0 ? '+' : ''}${formatBits(profit)} bits | Balance: ${formatBits(balance)} bits`);
    pfx('EMERGENCY', `Reset immediato al Mode 1`);

    // Reset al Mode 1 (i profitti accantonati vengono liberati)
    startNewCycle();
}

// ===== CASHOUT MANUALE (cashedAt < target) =====
function handleManualCashout(lastGame, crash) {
    const wager = lastGame.wager;
    const cashedAt = lastGame.cashedAt;
    const won = Math.floor(wager * cashedAt);
    const realProfit = won - wager;

    // Aggiorna balance con il profitto REALE
    balance += realProfit;

    // MA accantona il profitto: verrà contato per il target profit solo a fine ciclo
    manualCashoutBuffer += realProfit;

    // Per la logica del ciclo, NON aggiungo a cycleTotalWon (è perdita logica)
    cycleTotalBet += wager;
    // cycleTotalWon += 0; // Considerato perdita

    pfx('MANUAL', `⚠️ CASHOUT MANUALE @${cashedAt}x (target: ${currentPayout}x)`);
    pfx('MANUAL', `Ricevuto: ${formatBits(won)} bits - Accantonato: ${realProfit >= 0 ? '+' : ''}${formatBits(realProfit)} bits`);
    pfx('MANUAL', `Considerato come PERDITA nel ciclo (profitto contato a fine ciclo)`);

    const modeTag = currentMode === MODE.MODE1 ? 'M1' : 'M2';

    if (currentMode === MODE.MODE1) {
        mode1Round++;
        mode1TotalBet += wager;
        // NON aggiungo a mode1TotalWon (è perdita logica)

        pfx(`${modeTag}/MANUAL`, `R:${mode1Round}/${MODE1_ROUNDS} - Perdita logica bal:${formatBits(balance)}`);

        if (mode1Round >= MODE1_ROUNDS) {
            evaluateMode1Cycle();
        } else {
            mode1CurrentBet = roundBet(mode1CurrentBet * MODE1_MULT);
            currentBet = mode1CurrentBet;
            pfx('M1/NEXT', `Prossima bet: ${formatBits(currentBet)} bits`);
        }
    } else {
        mode2Attempts++;

        // Per Mode 2, la "perdita logica" è la bet (anche se ho ricevuto qualcosa)
        // Aggiungo la bet persa alle perdite da recuperare
        mode2LossesToRecover += wager;

        pfx(`${modeTag}/MANUAL`, `Att:${mode2Attempts}/${MODE2_MAX_ATTEMPTS} - Perdita logica [Tot: ${formatBits(mode2LossesToRecover)}]`);

        if (mode2Attempts >= MODE2_MAX_ATTEMPTS) {
            pfx('M2/MAX', `Raggiunto max tentativi. Accetto perdita.`);
            disasters++;
            startNewCycle();
            return;
        }

        if (checkCycleLimit()) {
            return;
        }

        // Ricalcola bet per recovery
        const payoutProfit = MODE2_PAYOUT - 1;
        mode2CurrentBet = roundBet(mode2LossesToRecover / payoutProfit);
        currentBet = mode2CurrentBet;
        pfx('M2/RECALC', `Nuova bet: ${formatBits(currentBet)} bits`);
    }
}

// ===== STATISTICHE FINALI =====
function showFinalStats() {
    log('');
    log('================================================================');
    log('   STATISTICHE FINALI                                         ');
    log('================================================================');
    log('');
    log(`   Balance iniziale: ${formatBits(initBalance)} bits`);
    log(`   Balance finale: ${formatBits(balance)} bits`);
    log(`   Profit: +${formatBits(balance - initBalance)} bits`);
    log('');
    log(`   Cicli totali: ${totalCycles}`);
    log(`   Mode 2 triggers: ${mode2Triggers}`);
    log(`   Mode 2 recoveries: ${mode2Recoveries}`);
    log(`   Disasters (perdite accettate): ${disasters}`);
    log('');
    log('================================================================');
}

// ===== PARSER CRASH =====
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

    // Il crash minimo è sempre 1.00x (= 100 in formato intero)
    // Se v >= 100, assumiamo che è in formato intero (es. 172 = 1.72x)
    // Altrimenti è già in formato decimale (es. 1.72)
    if (v >= 100) v = v / 100;

    // Sanity check: il crash non può essere < 1.00x
    if (v < 1.00) {
        pfx('WARN', `Crash anomalo rilevato: ${v}x - possibile errore di parsing`);
    }

    return v;
}
