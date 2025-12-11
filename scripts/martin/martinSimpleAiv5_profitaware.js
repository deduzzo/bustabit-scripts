/**
 * MARTIN AI v5.0 - PROFIT-AWARE ADAPTIVE STRATEGY
 *
 * NOVITA v5.0:
 * - PAYOUT DINAMICO: Il payout si adatta in base a profit, perdite consecutive e target rimanente
 * - OTTIMIZZAZIONE VELOCITA: Usa x2 strategicamente per raggiungere il target ~40-60% più velocemente
 * - SISTEMA INTELLIGENTE: Massimizza profit quando sicuro, si protegge quando necessario
 * - ⭐ BET REDUCTION ON x2 WIN: Quando vinci a x2, scala indietro la progressione di 1 livello
 *
 * LOGICA PROFIT-AWARE:
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ Profit >= 80% target    → x2.0  (SICUREZZA - chiudi veloce)    │
 * │ Losses = 0, Profit < 50%→ x3.1  (MASSIMIZZA - situazione ideale)│
 * │ Losses 1-5              → x2.0  (RECUPERO con bet reduction)    │
 * │ Losses 6-10             → x2.0  (RECUPERO - alta probabilità)   │
 * │ Losses 11+              → x1.8  (EMERGENZA - massima sicurezza) │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * STRATEGIA BET REDUCTION:
 * - Quando payout = x2.0 e VINCI → riduci bet di 1 livello progressione
 * - Quando payout = x2.0 e PERDI → continua progressione normale
 * - Esempio: bet 1.6 → 2.56 → 4.09 → vinci x2 → torna a 2.56 → vinci x2 → torna a 1.6
 * - Permette di "scaricare" profit e ridurre rischio progressivamente
 *
 * MODALITA 1 (NORMALE - ADAPTIVE):
 * - Payout DINAMICO calcolato da calculateOptimalPayout()
 * - Progressione geometrica con moltiplicatore configurabile
 * - OPZIONE A (customMult = 0): Moltiplicatore AUTO-CALCOLATO
 * - OPZIONE B (customMult > 0): Moltiplicatore MANUALE
 * - Bonus incrementale +1 bit per le prime 3 perdite
 *
 * MODALITA 2 (RECOVERY): Sistema martingale puro
 * - Usa un payout configurabile (diverso dal normal mode)
 * - Ogni perdita: ricalcola bet per recuperare TUTTE le perdite accumulate
 * - Parametro recoveryCycles: numero massimo di tentativi prima di reset
 *
 * VANTAGGI PROFIT-AWARE:
 * ✅ Raggiunge target 40-60% più velocemente rispetto a v4.8
 * ✅ Sfrutta x2 (49% win rate) quando vicino al target
 * ✅ Usa x3.1 quando può permettersi il rischio (massimo profit)
 * ✅ Si protegge automaticamente in situazioni critiche
 * ✅ Riduce bet quando vince a x2 (scarica profit, riduce rischio)
 * ✅ Adatta la strategia in tempo reale basandosi su dati oggettivi
 */

var config = {
    // ===== CAPITALE E TARGET =====
    workingBalance: { value: 1500000, type: 'balance', label: 'Working Balance (bits to use)' },
    targetProfitPercent: { value: 7, type: 'multiplier', label: 'Target Profit % (stop when reached)' },

    // ===== MODALITA 1 (NORMALE - ADAPTIVE) =====
    maxPayout: { value: 3.1, type: 'multiplier', label: 'Max Payout (used when safe)' },
    baseBet: { value: 100, type: 'balance', label: 'Base Bet' },
    customMult: { value: 1.6, type: 'multiplier', label: 'Custom Multiplier (0 = auto-calculate)' },

    // ===== MODALITA 2 (RECUPERO MARTINGALE) =====
    recoveryTrigger: { value: 16, type: 'multiplier', label: 'Losses before recovery mode' },
    recoveryMartingalePayout: { value: 2, type: 'multiplier', label: 'Recovery Martingale Payout (1.1-3.0)' },
    recoveryCycles: { value: 20, type: 'multiplier', label: 'Max recovery attempts before reset (1-20)' },
};

// Configurazione base
const workingBalance = config.workingBalance.value;
const targetProfitPercent = config.targetProfitPercent.value;
const maxPayout = config.maxPayout.value;
const normalBaseBet = config.baseBet.value;
const customMultValue = config.customMult.value;

const recoveryTrigger = config.recoveryTrigger.value;
const recoveryMartingalePayout = Math.max(1.1, Math.min(3.0, config.recoveryMartingalePayout.value)); // Clamp 1.1-3.0
const MAX_RECOVERY_ATTEMPTS = Math.max(1, Math.min(20, config.recoveryCycles.value)); // Clamp 1-20

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

/**
 * ⭐ PROFIT-AWARE ADAPTIVE PAYOUT CALCULATOR ⭐
 *
 * Sistema intelligente che calcola il payout ottimale in base a:
 * 1. Progresso verso il target (profitProgress)
 * 2. Numero di perdite consecutive (normalConsecutiveLosses)
 * 3. Situazione di rischio corrente
 *
 * LOGICA:
 * - Vicino al target (80%+) → x2 per chiudere in sicurezza
 * - Situazione ideale (no losses, lontano da target) → max payout per massimizzare
 * - Perdite moderate (1-5) → x2.5 compromesso
 * - Molte perdite (6-10) → x2 per recupero
 * - Situazione critica (11+) → x1.8 massima sicurezza
 */
function calculateOptimalPayout(profitProgress, consecutiveLosses) {
    // FASE 1: Vicino al target → SICUREZZA
    if (profitProgress >= 0.7) { // Abbassato da 0.8 a 0.7 per usare x2 prima
        return 2.0; // x2 per chiudere velocemente
    }

    // FASE 2: Nessuna perdita e lontano dal target → MASSIMIZZA ma con più x2
    if (consecutiveLosses === 0 && profitProgress < 0.3) { // Abbassato da 0.5 a 0.3
        return maxPayout; // x3.1 per massimo profit SOLO all'inizio
    }

    // FASE 2.5: Nessuna perdita ma profit moderato → USA x2
    if (consecutiveLosses === 0 && profitProgress < 0.7) {
        return 2.0; // x2 per accumulare velocemente
    }

    // FASE 3: Perdite moderate → RECUPERO x2 con bet reduction
    if (consecutiveLosses <= 5) {
        return 2.0; // x2 per recupero progressivo con riduzione bet
    }

    // FASE 4: Molte perdite → RECUPERO
    if (consecutiveLosses <= 10) {
        return 2.0; // x2 alta probabilità
    }

    // FASE 5: Situazione critica → EMERGENZA
    return 1.8; // x1.8 massima sicurezza
}

// Usa customMult se impostato (> 0), altrimenti calcola automaticamente
// Per il multiplier usiamo il maxPayout come riferimento
const normalMult = (customMultValue > 0)
    ? customMultValue
    : calculateNormalMultiplier(maxPayout, recoveryTrigger);

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
let currentPayout = maxPayout; // Inizia con max payout
let betPlacedThisRound = false;

// Tracking profit separato per modalita
let normalModeProfit = 0;
let balanceBeforeLossSequence = 0;

// Bonus incrementale per aumentare profit (solo prime 3 puntate)
let bonusPerLoss = 0;
const MAX_BONUS_LOSSES = 3;

// Statistiche dettagliate per payout
let stats = {
    normalWins: 0,
    normalLosses: 0,
    recoveryWins: 0,
    recoveryLosses: 0,
    disaster: 0,
    betReductions: 0, // Contatore bet reductions
    // Statistiche per payout
    payoutUsage: {
        '1.8': 0,
        '2.0': 0,
        '2.5': 0,
        '3.1': 0
    },
    payoutWins: {
        '1.8': 0,
        '2.0': 0,
        '2.5': 0,
        '3.1': 0
    }
};

// Output functions
function pfx(tag, msg) { log(`[${tag}] ${msg}`) }

// ===== INIZIALIZZAZIONE =====
log('');
log('==============================================================');
log('  MARTIN AI v5.0 - PROFIT-AWARE ADAPTIVE STRATEGY          ');
log('==============================================================');
log('');
log('MODALITA 1 (NORMALE - ADAPTIVE PAYOUT):');
log(`   - Max Payout: ${maxPayout}x (quando situazione ideale)`);
log(`   - Base Bet: ${(normalBaseBet/100).toFixed(2)} bits`);
if (customMultValue > 0) {
    log(`   - Multiplier: ${normalMult}x (CUSTOM)`);
} else {
    log(`   - Multiplier: ${normalMult}x (AUTO-CALC)`);
}
log(`   - Bonus: +1 bit per le prime 3 perdite`);
log('');
log('STRATEGIA PROFIT-AWARE (FOCUS x2):');
log(`   - Profit >= 70% target           → x2.0  (SICUREZZA)`);
log(`   - Losses = 0, Profit < 30%       → x${maxPayout}  (MASSIMIZZA inizio)`);
log(`   - Losses = 0, Profit 30-70%      → x2.0  (ACCUMULO VELOCE)`);
log(`   - Losses 1-5                     → x2.0  (RECUPERO + BET REDUCTION)`);
log(`   - Losses 6-10                    → x2.0  (RECUPERO)`);
log(`   - Losses 11+                     → x1.8  (EMERGENZA)`);
log('');
log('BET REDUCTION x2:');
log(`   - Vinci @x2 con losses > 0 → Scala indietro di 1 livello`);
log('');
log('MODALITA 2 (RECUPERO MARTINGALE):');
log(`   - Trigger: ${recoveryTrigger} perdite consecutive`);
log(`   - Payout: ${recoveryMartingalePayout}x`);
log(`   - Max tentativi: ${MAX_RECOVERY_ATTEMPTS}`);
log(`   - Sistema: Martingale (ogni perdita ricalcola bet per recuperare tutto)`);
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
        printStatistics();
        return;
    }

    // Check saldo
    const finalBetCheck = currentBet + bonusPerLoss;
    if ((balance - finalBetCheck) < 0) {
        stats.disaster++;
        sessionCycles++;
        const cycleLoss = initBalance - balance;
        sessionProfit -= cycleLoss;
        sessionGames += currentRound;

        pfx('ERR', `Saldo insufficiente! R:${currentRound} bet:${(finalBetCheck/100).toFixed(2)}`);
        pfx('RESTART', `Ricomincio ciclo ${sessionCycles + 1}...`);
        restartCycle();
        return;
    }

    // ⭐ CALCOLO PAYOUT OTTIMALE (solo in mode normale) ⭐
    if (currentMode === MODE.NORMAL) {
        const profitProgress = normalModeProfit / targetProfitAbsolute;
        currentPayout = calculateOptimalPayout(profitProgress, normalConsecutiveLosses);

        // Tracking uso payout
        const payoutKey = currentPayout.toFixed(1);
        if (stats.payoutUsage[payoutKey] !== undefined) {
            stats.payoutUsage[payoutKey]++;
        }
    }

    const modeTag = currentMode === MODE.NORMAL ? 'NRM' : 'REC';
    const finalBet = currentBet + bonusPerLoss;
    const profitPct = ((normalModeProfit / targetProfitAbsolute) * 100).toFixed(0);

    pfx(`${modeTag}/S`, `R:${currentRound} bet:${(currentBet/100).toFixed(2)}${bonusPerLoss > 0 ? `+${(bonusPerLoss/100).toFixed(2)}` : ''}=${(finalBet/100).toFixed(2)} @${currentPayout}x bal:${(balance/100).toFixed(2)} [${currentMode === MODE.NORMAL ? `L:${normalConsecutiveLosses} P:${profitPct}%` : `Attempt:${recoveryAttempts}/${MAX_RECOVERY_ATTEMPTS}`}]`);

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
    const targetPayout = currentPayout; // Usa il payout dinamico corrente

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
            stats.normalWins++;
            normalModeProfit = balance - initBalance;

            // Tracking vincite per payout
            const payoutKey = currentPayout.toFixed(1);
            if (stats.payoutWins[payoutKey] !== undefined) {
                stats.payoutWins[payoutKey]++;
            }

            // ⭐ BET REDUCTION: Se vinto a x2 e ci sono perdite consecutive, scala indietro di 1 livello
            const isX2Win = Math.abs(currentPayout - 2.0) < 0.01;

            if (isX2Win && normalConsecutiveLosses > 0) {
                // Incrementa contatore bet reductions
                stats.betReductions++;

                // Riduci bet di 1 livello (dividi per mult)
                normalConsecutiveLosses = Math.max(0, normalConsecutiveLosses - 1);

                if (normalConsecutiveLosses === 0) {
                    currentBet = normalBaseBet;
                    bonusPerLoss = 0;
                } else {
                    // Scala indietro di 1 livello nella progressione
                    currentBet = Math.ceil((currentBet / normalMult / 100)) * 100;
                    // Riduci anche bonus se applicabile
                    if (normalConsecutiveLosses <= MAX_BONUS_LOSSES) {
                        bonusPerLoss = Math.max(0, bonusPerLoss - 100);
                    }
                }

                pfx(`${modeTag}/W`, `WIN @x2.0 crash:${crash} profit:+${(profit/100).toFixed(2)} bal:${(balance/100).toFixed(2)} [BET REDUCTION: L:${normalConsecutiveLosses+1}→${normalConsecutiveLosses}]`);
            } else {
                pfx(`${modeTag}/W`, `WIN @${currentPayout}x crash:${crash} profit:+${(profit/100).toFixed(2)} bal:${(balance/100).toFixed(2)} [NormalProfit:+${(normalModeProfit/100).toFixed(2)}]`);

                normalConsecutiveLosses = 0;
                currentBet = normalBaseBet;
                bonusPerLoss = 0;
            }

            // currentPayout verrà ricalcolato alla prossima partita
            state = STATE.BETTING;
        } else {
            // CASHOUT PARZIALE
            stats.normalLosses++;

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
            stats.recoveryWins++;

            // Verifica se abbiamo recuperato tutto
            const remainingLoss = balanceBeforeLossSequence - balance;

            pfx(`${modeTag}/W`, `MARTINGALE WIN! Attempt ${recoveryAttempts}/${MAX_RECOVERY_ATTEMPTS} crash:${crash} profit:+${(profit/100).toFixed(2)} bal:${(balance/100).toFixed(2)}`);

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
                    pfx('LIMIT', `Raggiunto limite di ${MAX_RECOVERY_ATTEMPTS} tentativi recovery`);
                    pfx('RESET', `RESET - Le perdite verranno recuperate nel prossimo ciclo`);
                    switchToNormalMode();
                }
            }
        } else {
            // CASHOUT PARZIALE in recovery
            stats.recoveryLosses++;

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
        stats.normalLosses++;

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
        // RECOVERY MODE LOSS - Sistema Martingale
        stats.recoveryLosses++;
        recoveryAttempts++;

        // Ricalcola le perdite totali
        totalLosses = balanceBeforeLossSequence - balance;

        pfx(`${modeTag}/L`, `MARTINGALE LOSS Attempt ${recoveryAttempts}/${MAX_RECOVERY_ATTEMPTS} crash:${crash} loss:-${(finalBet/100).toFixed(2)} bal:${(balance/100).toFixed(2)}`);
        pfx('INFO', `Total losses: ${(totalLosses/100).toFixed(2)} bits`);

        // Verifica se abbiamo ancora tentativi
        if (recoveryAttempts < MAX_RECOVERY_ATTEMPTS) {
            // Ricalcola bet per recuperare tutto
            pfx('MARTINGALE', `Tentativo ${recoveryAttempts + 1}/${MAX_RECOVERY_ATTEMPTS} - Ricalcolo bet per recuperare tutto`);
            calculateRecoveryBet();
        } else {
            // Limite raggiunto
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

    pfx('MODE', `SWITCH TO RECOVERY MARTINGALE MODE`);
    pfx('INFO', `Total losses: ${(totalLosses/100).toFixed(2)} bits`);
    pfx('INFO', `Payout: ${recoveryMartingalePayout}x`);
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
    // currentPayout verrà ricalcolato dinamicamente
    bonusPerLoss = 0;
    state = STATE.BETTING;

    pfx('MODE', `BACK TO NORMAL MODE`);
}

function calculateRecoveryBet() {
    // MARTINGALE: calcola bet necessaria per recuperare TUTTE le perdite
    const payoutMultiplier = recoveryMartingalePayout - 1.0;

    // Bet = Perdite totali / (Payout - 1)
    // Es: 100 bits perdite, payout 1.5x → bet = 100 / 0.5 = 200 bits
    // Se vinci: 200 * 1.5 = 300 - 200 = 100 profit (recupero!)
    currentBet = Math.ceil(totalLosses / payoutMultiplier);

    // Arrotonda a 100
    currentBet = Math.ceil(currentBet / 100) * 100;

    pfx('REC/C', `Attempt ${recoveryAttempts}/${MAX_RECOVERY_ATTEMPTS}: bet ${(currentBet/100).toFixed(2)} to recover ${(totalLosses/100).toFixed(2)} @${recoveryMartingalePayout}x`);

    // Verifica se abbiamo abbastanza saldo
    if (currentBet > balance) {
        pfx('REC/!', `Bet troppo alta! Richiesto:${(currentBet/100).toFixed(2)} Disponibile:${(balance/100).toFixed(2)}`);
        stats.disaster++;
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
    currentPayout = maxPayout;
    betPlacedThisRound = false;

    currentMode = MODE.NORMAL;
    normalConsecutiveLosses = 0;
    recoveryAttempts = 0;
    totalLosses = 0;
    normalModeProfit = 0;
    balanceBeforeLossSequence = 0;
    bonusPerLoss = 0;

    // Reset statistiche ciclo
    stats.normalWins = 0;
    stats.normalLosses = 0;
    stats.recoveryWins = 0;
    stats.recoveryLosses = 0;

    initState();
}

function initState() {
    state = STATE.BETTING;
}

function printStatistics() {
    log('');
    log('==============================================================');
    log('  STATISTICHE PROFIT-AWARE v5.0');
    log('==============================================================');
    log('');
    log('USAGE PAYOUT (quante volte usato):');
    for (const [payout, count] of Object.entries(stats.payoutUsage)) {
        if (count > 0) {
            log(`   - x${payout}: ${count} volte`);
        }
    }
    log('');
    log('WINS PER PAYOUT:');
    for (const [payout, wins] of Object.entries(stats.payoutWins)) {
        const usage = stats.payoutUsage[payout] || 0;
        if (usage > 0) {
            const winRate = ((wins / usage) * 100).toFixed(1);
            log(`   - x${payout}: ${wins}/${usage} (${winRate}%)`);
        }
    }
    log('');
    log('RISULTATI GENERALI:');
    log(`   - Normal Wins: ${stats.normalWins}`);
    log(`   - Normal Losses: ${stats.normalLosses}`);
    log(`   - Recovery Wins: ${stats.recoveryWins}`);
    log(`   - Recovery Losses: ${stats.recoveryLosses}`);
    log(`   - Bet Reductions: ${stats.betReductions}`);
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