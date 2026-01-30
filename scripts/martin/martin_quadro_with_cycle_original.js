/* ═══════════════════════════════════════════════════════════════════════════
   MARTIN AI v5.2 - MARTINGALE VB + AGGRESSIVE + TOLERANCE + FLAT BET
   ═══════════════════════════════════════════════════════════════════════════

   DESCRIZIONE:
   Sistema di betting a due modalità con martingala sul Virtual Balance (VB).
   Combina una strategia normale a payout alto con un sistema di recupero
   martingala quando si verificano perdite consecutive.

   MODALITÀ 1 - NORMALE:
   - Punta a payout alto (default 3.1x)
   - OPZIONALE: N puntate flat prima della progressione (Flat Bet)
   - Aumenta la bet con moltiplicatore fisso dopo ogni perdita (default 1.6x)
   - Bonus: +baseBet per le prime 3 perdite consecutive (proporzionale)
   - Switch a modalità Recovery dopo N perdite (default 16)

   MODALITÀ 2 - RECOVERY (Martingala):
   - Payout basso (default 2x)
   - Calcola bet per recuperare tutte le perdite accumulate
   - Max N tentativi (default 2) prima di dichiarare ciclo perso

   SISTEMA CICLI:
   - Ogni ciclo inizia con un Working Balance (VB)
   - Target: guadagnare X% del VB (default 75%)
   - Ciclo VINTO: resetta VB al valore base, inizia nuovo ciclo
   - Ciclo PERSO: applica MARTINGALA SUL VB, aumenta capitale per prossimo ciclo

   MARTINGALA SUL VIRTUAL BALANCE:
   - Accumula perdite reali attraverso i cicli
   - Formula: VB(n+1) = (Perdite Accumulate + Target Base) / (Target% / 100)
   - Effetto: VB aumenta ~2.33x dopo ogni ciclo perso (con TP 75%)
   - BaseBet scala proporzionalmente al nuovo VB
   - Reset a VB base dopo ogni ciclo vinto

   AGGRESSIVE FACTOR (NUOVO):
   - Parametro intero (0-10) che aumenta il moltiplicatore nei primi cicli persi
   - Formula: pow(value, 0.6) / 100 * 1.5 (escalation morbida +50% boost)
   - 0 = OFF: comportamento standard (moltiplicatore costante)
   - 4 = CONSIGLIATO: incremento bilanciato (es. 1.60 → 1.69 al ciclo 3)
   - 10 = MAX: incremento massimo controllato (es. 1.60 → 1.78 al ciclo 3)
   - Efficace nei cicli 1-3, poi riduce gradualmente (ciclo 4: -50%, ciclo 5: annullato)
   - Scopo: recuperare più velocemente dopo le prime perdite di ciclo

   CYCLE TOLERANCE (SAFETY):
   - Percentuale (0-50%) che permette reset anche senza recupero completo
   - 0 = OFF: deve recuperare 100% delle perdite accumulate + target profit
   - 15% = CONSIGLIATO: può resettare se ha recuperato almeno 85% del target (bilanciato)
   - 50% = MAX: può resettare se ha recuperato almeno 50% del target (molto conservativo)
   - Attivo solo dal ciclo 1 in poi (al ciclo 0 non ha senso)
   - Scopo: evitare bancarotta su streak lunghe, funziona come "stop loss"

   FLAT BET (NUOVO):
   - Numero di puntate flat (stesso importo baseBet) prima della progressione
   - 0 = OFF: inizia subito con la progressione martingala
   - N > 0: esegue N puntate flat, poi inizia progressione se tutte perse
   - Se VINCI durante le flat bet: reset, ricomincia con altre N flat bet
   - Se PERDI tutte le N flat bet: inizia progressione (1, 1.6x, 2.56x, ecc.)
   - Scopo: ridurre il rischio accettando profitti più bassi per vincita
   - Esempio con flatBetCount=2: Flat1(loss) → Flat2(loss) → Progressione
   - Esempio con win: Flat1(loss) → Flat2(WIN) → Flat1(reset) → ...

   SCALE FACTOR (NUOVO):
   - Fattore di moltiplicazione per scalare baseBet e workingBalance insieme
   - 1 = DEFAULT: usa i valori configurati normalmente
   - 2 = RADDOPPIA: baseBet e workingBalance vengono moltiplicati per 2
   - 0.5 = DIMEZZA: baseBet e workingBalance vengono dimezzati
   - Mantiene sempre le proporzioni corrette tra tutti i parametri
   - Scopo: cambiare facilmente la "size" del sistema senza modificare i singoli valori

   PARAMETRI PRINCIPALI:
   - scaleFactor: Fattore di scala (1=default, 2=raddoppia baseBet+WB, 0.5=dimezza)
   - workingBalance: Capitale per singolo ciclo (in satoshi: 100000 = 1000 bits)
   - targetProfitPercent: % di profit per considerare ciclo vinto
   - cycleTolerance: % tolleranza reset (0=off, 15=consigliato, max 50)
   - payout: Moltiplicatore target in modalità normale
   - baseBet: Puntata base iniziale
   - flatBetCount: Puntate flat prima della progressione (0=off)
   - customMult: Moltiplicatore personalizzato (0 = auto-calcolo)
   - aggressiveFactor: Intensità escalation (0=off, 4=consigliato, 10=max)
   - recoveryTrigger: Perdite consecutive prima di recovery mode
   - recoveryMartingalePayout: Payout in modalità recovery
   - recoveryCycles: Max tentativi recovery prima di dichiarare ciclo perso

   LIMITI DI SICUREZZA:
   - BaseBet max = 1000x il valore iniziale (protezione overflow)
   - Recovery payout: 1.1x - 3.0x
   - Recovery cycles: 1-20
   - Global profit stop opzionale

   ═══════════════════════════════════════════════════════════════════════════ */

var config = {
    // ===== FATTORE DI SCALA =====
    scaleFactor: { value: 1, type: 'multiplier', label: 'Fattore di Moltiplicazione (1=default, 2=raddoppia baseBet e workingBalance, ecc.)' },

    // ===== CAPITALE E TARGET =====
    workingBalance: { value: 100000, type: 'balance', label: 'Working Balance (bits per ciclo - es. 100000=1000 bits)' },
    targetProfitPercent: { value: 75, type: 'multiplier', label: 'Target Profit % (stop ciclo quando raggiunto) [OTTIMALE: 75%]' },
    cycleTolerance: { value: 0, type: 'multiplier', label: 'Cycle Tolerance % (0=off, 15=consigliato, max 50) - permette reset anche senza recupero totale (safety)' },
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
    flatBetCount: { value: 1, type: 'multiplier', label: 'Flat Bet Count (0=off, N=numero puntate flat prima della progressione)' },
    customMult: { value: 1.6, type: 'multiplier', label: 'Custom Multiplier (0 = auto-calculate)' },
    aggressiveFactor: { value: 0, type: 'multiplier', label: 'Aggressive Factor (0=off, 4=consigliato, 10=max) - incremento mult nei primi 3 cicli' },

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
const scaleFactor = Math.max(0.1, config.scaleFactor.value);  // Minimo 0.1 per evitare valori nulli
const workingBalance = Math.floor(config.workingBalance.value * scaleFactor);  // Scalato
const targetProfitPercent = config.targetProfitPercent.value;
const cycleTolerance = Math.max(0, Math.min(50, config.cycleTolerance.value));  // Limita 0-50%
const normalPayout = config.payout.value;
let normalBaseBet = Math.floor(config.baseBet.value * scaleFactor);  // Scalato (let perché viene aggiornato con martingale)
const originalBaseBet = normalBaseBet;  // Salva il valore scalato originale per il bonus
const customMultValue = config.customMult.value;
// Converte aggressiveFactor da intero (0-10) con formula MORBIDA (+50% boost)
// Usa potenza 0.6 per rendere l'escalation più conservativa, poi applica boost 1.5x
// 0 = off, 5 = moderato, 7 = consigliato, 10 = max
const aggressiveFactorRaw = Math.max(0, Math.min(10, config.aggressiveFactor.value));  // Limita 0-10
const aggressiveFactor = Math.pow(aggressiveFactorRaw, 0.6) / 100 * 1.5;  // Formula morbida +50%
// Esempi: 1 → 0.015, 5 → 0.041, 7 → 0.050, 10 → 0.060

const recoveryTrigger = config.recoveryTrigger.value;
const recoveryMartingalePayout = Math.max(1.1, Math.min(3.0, config.recoveryMartingalePayout.value));
const MAX_RECOVERY_ATTEMPTS = Math.max(1, Math.min(20, config.recoveryCycles.value));

// Flat Bet - numero di puntate flat prima della progressione (0 = disabilitato)
const flatBetCount = Math.max(0, Math.floor(config.flatBetCount.value));

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

// ═══════════════════════════════════════════════════════════════════════════
// CALCOLO MOLTIPLICATORE EFFETTIVO CON AGGRESSIVE FACTOR
// ═══════════════════════════════════════════════════════════════════════════
// Questa funzione calcola il moltiplicatore da usare basato sul numero di
// cicli persi consecutivi, applicando l'aggressive factor.
//
// Logica:
// - aggressiveFactor = 0: usa sempre baseMult (comportamento standard)
// - aggressiveFactor > 0 e cicli <= 3: aumenta progressivamente (ADDITIVO)
//   Formula: baseMult + (aggressiveFactor * cicli)
// - cicli > 3: riduce gradualmente l'effetto per evitare escalation eccessiva
//
// Esempi con baseMult=1.6, escalation MORBIDA (+50% boost):
// - Ciclo 0 (nessuna perdita): 1.60x
//
// aggressiveFactor = 1 (incremento 0.015 per ciclo):
// - Ciclo 1: 1.615x, Ciclo 2: 1.63x, Ciclo 3: 1.645x
//
// aggressiveFactor = 4 (incremento 0.036 per ciclo) [CONSIGLIATO]:
// - Ciclo 1: 1.636x, Ciclo 2: 1.672x, Ciclo 3: 1.708x
//
// aggressiveFactor = 10 (incremento 0.060 per ciclo):
// - Ciclo 1: 1.66x, Ciclo 2: 1.72x, Ciclo 3: 1.78x
//
// - Ciclo 4+: riduce gradualmente (ciclo 4: -50%, ciclo 5: annullato)
//
// Valori consigliati (0-10):
// - 0: OFF (sempre 1.60x)
// - 4: CONSIGLIATO (bilanciato, 1.71 al ciclo 3)
// - 10: MAX (aggressivo ma controllato, 1.78 al ciclo 3)
function getEffectiveMultiplier(baseMult, lostCycles) {
    // Se aggressive factor disabilitato, usa sempre il moltiplicatore base
    if (aggressiveFactor <= 0) {
        return baseMult;
    }

    // Nei primi 3 cicli persi, applica l'escalation additiva
    if (lostCycles >= 1 && lostCycles <= 3) {
        return baseMult + (aggressiveFactor * lostCycles);
    }

    // Dal ciclo 4 in poi, riduce gradualmente l'effetto
    // Per evitare escalation infinita che renderebbe vano ogni tentativo
    if (lostCycles >= 4) {
        // Riduce l'effetto del 50% al ciclo 4, 75% al ciclo 5, poi torna a baseMult
        const decayFactor = Math.max(0, 1 - ((lostCycles - 3) * 0.5));
        const increment = aggressiveFactor * 3 * decayFactor;  // 3 = massimo boost
        return baseMult + increment;
    }

    // Ciclo 0 (nessuna perdita): usa baseMult standard
    return baseMult;
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

// Flat Bet tracking
let flatBetRemaining = flatBetCount;  // Contatore flat bet rimanenti

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
logV(1, '  MARTIN AI v5.2 - MARTINGALE VB + AGGRESSIVE + FLAT BET   ');
logV(1, '==============================================================');
logV(1, '');
if (scaleFactor !== 1) {
    logV(1, `⚡ SCALE FACTOR: ${scaleFactor}x (baseBet e workingBalance scalati)`);
    logV(1, `   - Base Config: baseBet=${(config.baseBet.value/100).toFixed(2)}, WB=${(config.workingBalance.value/100).toFixed(0)}`);
    logV(1, `   - Scalato:     baseBet=${(normalBaseBet/100).toFixed(2)}, WB=${(workingBalance/100).toFixed(0)}`);
    logV(1, '');
}
logV(1, 'MODALITA 1 (NORMALE):');
logV(1, `   - Payout: ${normalPayout}x`);
logV(1, `   - Base Bet: ${(normalBaseBet/100).toFixed(2)} bits`);
if (customMultValue > 0) {
    logV(1, `   - Multiplier: ${normalMult}x (CUSTOM)`);
} else {
    logV(1, `   - Multiplier: ${normalMult}x (AUTO-CALC)`);
}
if (aggressiveFactor > 0) {
    logV(1, `   - Aggressive Factor: ${aggressiveFactorRaw}/10 (attivo cicli 1-3)`);
    logV(1, `     → Ciclo 1: ${getEffectiveMultiplier(normalMult, 1).toFixed(2)}x`);
    logV(1, `     → Ciclo 2: ${getEffectiveMultiplier(normalMult, 2).toFixed(2)}x`);
    logV(1, `     → Ciclo 3: ${getEffectiveMultiplier(normalMult, 3).toFixed(2)}x`);
} else {
    logV(1, `   - Aggressive Factor: 0/10 (OFF - mult costante)`);
}
if (flatBetCount > 0) {
    logV(1, `   - Flat Bet: ${flatBetCount} puntate flat prima della progressione`);
} else {
    logV(1, `   - Flat Bet: 0 (OFF - inizia subito progressione)`);
}
logV(1, `   - Bonus: +${(originalBaseBet/100).toFixed(2)} bits per le prime 3 perdite`);
logV(1, '');
logV(1, 'MODALITA 2 (RECUPERO MARTINGALE):');
logV(1, `   - Trigger: ${recoveryTrigger} perdite consecutive`);
logV(1, `   - Payout: ${recoveryMartingalePayout}x`);
logV(1, `   - Max tentativi: ${MAX_RECOVERY_ATTEMPTS}`);
logV(1, '');
logV(1, 'CAPITALE & TARGET (PER CICLO):');
logV(1, `   - Working Balance: ${(workingBalance/100).toFixed(2)} bits`);
logV(1, `   - Target Profit: ${targetProfitPercent}% (+${(targetProfitAbsolute/100).toFixed(2)} bits)`);
if (cycleTolerance > 0) {
    logV(1, `   - Cycle Tolerance: ${cycleTolerance}% (reset se recupera ${100-cycleTolerance}%+ del target)`);
} else {
    logV(1, `   - Cycle Tolerance: 0% (OFF - deve recuperare 100% del target)`);
}
logV(1, `   - Continue Cycles: ${config.continueCycles.value === 'yes' ? 'SI (analisi multipli cicli)' : 'NO (stop al primo TP)'}`);
logV(1, '');
logV(1, '🎲 MARTINGALE SUL VIRTUAL BALANCE:');
logV(1, `   - ABILITATO: Aumenta VB dopo ogni perdita`);
logV(1, `   - Moltiplicatore: ~2.33x (per TP ${targetProfitPercent}%)`);
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

    // Applica cycle tolerance (solo se > 0 e dal ciclo 1 in poi)
    let adjustedTargetProfit = cycleTargetProfit;
    if (cycleTolerance > 0 && consecutiveLossCycles > 0) {
        // Con tolleranza 40%: se target è 1000, accetta anche 600 (60% del target)
        adjustedTargetProfit = cycleTargetProfit * (1 - cycleTolerance / 100);
    }

    if (normalModeProfit >= adjustedTargetProfit) {
        // ═══════════════════════════════════════════════════════════════════════════
        // NOVITÀ: Ciclo VINTO
        // ═══════════════════════════════════════════════════════════════════════════
        totalCycles++;
        wonCycles++;
        consecutiveLossCycles = 0;

        sessionProfit += currentProfit;
        sessionGames += currentRound;
        sessionCycles++;

        // Check se ha usato la tolleranza per resettare prima del target completo
        const usedTolerance = cycleTolerance > 0 && consecutiveLossCycles > 0 && normalModeProfit < cycleTargetProfit;
        const toleranceInfo = usedTolerance ? ` [TOL: ${cycleTolerance}%]` : '';

        // Log minimale (verbosity 1+)
        logV(1, `CYCLE #${totalCycles} WON${toleranceInfo} | Profit: +${(normalModeProfit/100).toFixed(0)} bits | WR: ${((wonCycles/(wonCycles+lostCycles))*100).toFixed(1)}% (${wonCycles}W/${lostCycles}L) | Max Loss Streak: ${maxConsecutiveLossCycles} | VB: ${(currentWorkingBalance/100).toFixed(0)} bits`);

        // Log dettagliato (verbosity 2)
        logV(2, '');
        logV(2, '🏆 CICLO VINTO!');
        logV(2, `   Ciclo #${totalCycles}`);
        logV(2, `   Profit: +${(normalModeProfit/100).toFixed(2)} bits (${targetProfitPercent}%)`);
        if (usedTolerance) {
            logV(2, `   ⚠️  RESET CON TOLLERANZA ${cycleTolerance}%`);
            logV(2, `   Target Completo: ${(cycleTargetProfit/100).toFixed(2)} bits`);
            logV(2, `   Target Adjustato: ${(adjustedTargetProfit/100).toFixed(2)} bits (${(100-cycleTolerance)}% del target)`);
            logV(2, `   Perdite NON recuperate: ${((cycleTargetProfit - normalModeProfit)/100).toFixed(2)} bits`);
        }
        logV(2, `   Cicli Totali: ${wonCycles}W / ${lostCycles}L (WR: ${((wonCycles/(wonCycles+lostCycles))*100).toFixed(1)}%)`);
        logV(2, `   Perdite consecutive: ${consecutiveLossCycles} (Max: ${maxConsecutiveLossCycles})`);
        logV(2, '');

        // RESET MARTINGALE dopo vittoria
        resetMartingale();

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
        if (isExactCashout) {
            normalWins++;
            normalModeProfit = balance - initBalance;

            // Log diverso se eravamo in flat bet
            if (flatBetRemaining < flatBetCount) {
                pfx(`${modeTag}/W`, `WIN (flat) profit:+${(profit/100).toFixed(2)} bal:${(balance/100).toFixed(2)}`);
            } else {
                pfx(`${modeTag}/W`, `WIN profit:+${(profit/100).toFixed(2)} bal:${(balance/100).toFixed(2)}`);
            }

            normalConsecutiveLosses = 0;
            currentBet = normalBaseBet;
            currentPayout = normalPayout;
            bonusPerLoss = 0;
            flatBetRemaining = flatBetCount;  // RESET flat bet
            state = STATE.BETTING;
        } else {
            // CASHOUT PARZIALE
            normalLosses++;

            // ═══════════════════════════════════════════════════════════════════════════
            // FLAT BET: Se siamo ancora nelle puntate flat, non aumentiamo
            // ═══════════════════════════════════════════════════════════════════════════
            if (flatBetRemaining > 0) {
                flatBetRemaining--;
                pfx(`${modeTag}/F`, `FLAT PARTIAL @${lastGame.cashedAt}x bal:${(balance/100).toFixed(2)} [Flat:${flatBetRemaining}/${flatBetCount}]`);
                // NON aumentiamo la bet, resta baseBet
                return;
            }

            // Da qui in poi: progressione normale (flat bet esaurite)
            if (normalConsecutiveLosses === 0) {
                balanceBeforeLossSequence = balance;
            }

            normalConsecutiveLosses++;

            if (normalConsecutiveLosses <= MAX_BONUS_LOSSES) {
                bonusPerLoss += originalBaseBet;  // Proporzionale al baseBet (scalato)
            }

            pfx(`${modeTag}/P`, `PARZIALE @${lastGame.cashedAt}x [L:${normalConsecutiveLosses}/${recoveryTrigger}]`);

            if (normalConsecutiveLosses >= recoveryTrigger) {
                switchToRecoveryMode();
            } else {
                // Usa moltiplicatore effettivo basato sui cicli persi consecutivi
                const effectiveMult = getEffectiveMultiplier(normalMult, consecutiveLossCycles);
                // Arrotonda a multipli di originalBaseBet per mantenere proporzioni con scaleFactor
                currentBet = Math.ceil((currentBet / originalBaseBet) * effectiveMult) * originalBaseBet;
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

        // ═══════════════════════════════════════════════════════════════════════════
        // FLAT BET: Se siamo ancora nelle puntate flat, non aumentiamo
        // ═══════════════════════════════════════════════════════════════════════════
        if (flatBetRemaining > 0) {
            flatBetRemaining--;
            pfx(`${modeTag}/F`, `FLAT LOSS bal:${(balance/100).toFixed(2)} [Flat:${flatBetRemaining}/${flatBetCount}]`);
            // NON aumentiamo la bet, resta baseBet
            // NON incrementiamo normalConsecutiveLosses perché non siamo in progressione
            return;
        }

        // Da qui in poi: progressione normale (flat bet esaurite)
        if (normalConsecutiveLosses === 0) {
            balanceBeforeLossSequence = balance + finalBet;
        }

        normalConsecutiveLosses++;

        if (normalConsecutiveLosses <= MAX_BONUS_LOSSES) {
            bonusPerLoss += originalBaseBet;  // Proporzionale al baseBet (scalato)
        }

        pfx(`${modeTag}/L`, `LOSS bal:${(balance/100).toFixed(2)} [L:${normalConsecutiveLosses}/${recoveryTrigger}]`);

        if (normalConsecutiveLosses >= recoveryTrigger) {
            switchToRecoveryMode();
        } else {
            // Usa moltiplicatore effettivo basato sui cicli persi consecutivi
            const effectiveMult = getEffectiveMultiplier(normalMult, consecutiveLossCycles);
            // Arrotonda a multipli di originalBaseBet per mantenere proporzioni con scaleFactor
            currentBet = Math.ceil((currentBet / originalBaseBet) * effectiveMult) * originalBaseBet;
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
    flatBetRemaining = flatBetCount;  // RESET flat bet
    state = STATE.BETTING;

    pfx('MODE', `BACK TO NORMAL`);
}

function calculateRecoveryBet() {
    const payoutMultiplier = recoveryMartingalePayout - 1.0;
    currentBet = Math.ceil(totalLosses / payoutMultiplier);
    // Arrotonda a multipli di originalBaseBet per mantenere proporzioni con scaleFactor
    currentBet = Math.ceil(currentBet / originalBaseBet) * originalBaseBet;

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

    // Log minimale (verbosity 1+)
    logV(1, `CYCLE #${totalCycles} LOST | Loss: -${(cycleLoss/100).toFixed(0)} bits | WR: ${lostCycles > 0 ? ((wonCycles/(wonCycles+lostCycles))*100).toFixed(1) : '0.0'}% (${wonCycles}W/${lostCycles}L) | ${streakMsg} | Next VB: ${(currentWorkingBalance/100).toFixed(0)} bits`);

    // Log dettagliato (verbosity 2)
    logV(2, '');
    logV(2, '💔 CICLO PERSO!');
    logV(2, `   Ciclo #${totalCycles}`);
    logV(2, `   Reason: ${reason}`);
    logV(2, `   Loss: -${(cycleLoss/100).toFixed(2)} bits`);
    logV(2, `   Cicli Totali: ${wonCycles}W / ${lostCycles}L (WR: ${lostCycles > 0 ? ((wonCycles/(wonCycles+lostCycles))*100).toFixed(1) : '0.0'}%)`);
    logV(2, `   Perdite consecutive: ${consecutiveLossCycles} (Max: ${maxConsecutiveLossCycles})`);
    logV(2, '');

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
    totalLosses = 0;
    normalModeProfit = 0;
    balanceBeforeLossSequence = 0;
    bonusPerLoss = 0;
    flatBetRemaining = flatBetCount;  // RESET flat bet

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
    normalBaseBet = originalBaseBet;  // Reset anche baseBet al valore originale (scalato)
    log('');
    log('🔄 MARTINGALE RESET → VB Base: ' + (baseWorkingBalance / 100).toFixed(0) + ' bits, BaseBet: ' + (normalBaseBet / 100).toFixed(4) + ' bits');
    log('');
}

function applyMartingale(cycleLoss) {
    // Accumula la perdita REALE del ciclo (non il VB!)
    realLossesAccumulated += cycleLoss;
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

    // Arrotonda a multipli di originalBaseBet per mantenere proporzioni con scaleFactor
    const newBaseBet = Math.ceil(scaledBet / originalBaseBet) * originalBaseBet;

    // PROTEZIONE: verifica che newBaseBet non sia troppo grande
    // Limite massimo: 1000x il baseBet originale per evitare overflow catastrofici
    const maxAllowedBet = originalBaseBet * 1000;  // Limite scalato
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
    log('📈 MARTINGALE APPLICATO:');
    log(`   Perdita Ciclo:      ${(cycleLoss / 100).toFixed(2)} bits`);
    log(`   Perdite Accumulate: ${(realLossesAccumulated / 100).toFixed(2)} bits`);
    log(`   VB Precedente:      ${(previousVB / 100).toFixed(2)} bits`);
    log(`   VB Successivo:      ${(currentWorkingBalance / 100).toFixed(2)} bits (×${multiplier})`);
    log(`   Base Bet Scalato:   ${(newBaseBet / 100).toFixed(4)} bits (era ${(oldBaseBet / 100).toFixed(4)} bits)`);
    log(`   Target Profit Prossimo Ciclo: ${((realLossesAccumulated + targetProfitAbsolute) / 100).toFixed(2)} bits`);
    log(`   Perdite Consecutive: ${consecutiveLossCycles}`);
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
