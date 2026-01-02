/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                    PAOLOBET HYBRID v5.1                                   ║
 * ║         PARAMETRI BILANCIATI - BASATO SU ANALISI v5.0                     ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 *
 * MODIFICHE v5.1 (2026-01-02):
 * ─────────────────────────────────────────────────────────────────────────────
 *   1. TARGET BILANCIATI (compromesso tra v4.2 e v5.0)
 *      - Mode1 Step1: 3.75x (26.4% prob) [v4.2: 3.5x, v5.0: 4.0x]
 *      - Mode1 Step2: 11x (9.0% prob) [v4.2: 10x, v5.0: 12x]
 *      - Mode2: 3.75x [v4.2: 3.5x, v5.0: 4.0x]
 *
 *   2. STOP LOSS DINAMICO PERMISSIVO (più spazio per recovery)
 *      - Ferma la sessione se drawdown > 20% dal balance iniziale
 *      - v5.0: -15% (troppo stretto) → v5.1: -20%
 *      - Previene sessioni -80%+ ma permette recovery
 *
 *   3. TAKE PROFIT PARZIALE AGGRESSIVO
 *      - A +10%: blocca 40% del profitto (più veloce)
 *      - A +25%: blocca ulteriore 50% del profitto
 *      - Profitto locked non può essere perso
 *
 * OBIETTIVO: Bilanciare win rate e tail risk protection
 *
 * RISULTATI v5.0 (baseline per v5.1):
 *   EV: -1.13% | WR: 47.5% | Min: -17.95% | Bets: 166
 *   ✅ Tail risk ridotto 78.9% vs v4.2
 *   ❌ Win rate -5.5% vs v4.2
 */

var config = {
    // ═══════════════════════════════════════════════════════════════════════
    // IMPOSTAZIONI PRINCIPALI
    // ═══════════════════════════════════════════════════════════════════════
    takeProfit: {
        value: 20,
        type: 'multiplier',
        label: 'Take Profit % (20 consigliato)'
    },

    // ═══════════════════════════════════════════════════════════════════════
    // v5.1: STOP LOSS DINAMICO (più permissivo)
    // ═══════════════════════════════════════════════════════════════════════
    sessionStopLoss: {
        value: 20,  // v5.0: 15% → v5.1: 20% (più spazio per recovery)
        type: 'multiplier',
        label: '[v5.1] Session Stop Loss % (20 bilanciato, 0=OFF)'
    },

    // ═══════════════════════════════════════════════════════════════════════
    // v5.1: TAKE PROFIT PARZIALE (più aggressivo)
    // ═══════════════════════════════════════════════════════════════════════
    partialTP1Target: {
        value: 10,  // v5.0: 15% → v5.1: 10% (lock più veloce)
        type: 'multiplier',
        label: '[v5.1] Partial TP livello 1: % profitto (10 aggressivo)'
    },
    partialTP1Lock: {
        value: 40,  // v5.0: 50% → v5.1: 40% (meno conservativo)
        type: 'multiplier',
        label: '[v5.1] Partial TP livello 1: % da bloccare (40 bilanciato)'
    },
    partialTP2Target: {
        value: 25,  // v5.0: 30% → v5.1: 25%
        type: 'multiplier',
        label: '[v5.1] Partial TP livello 2: % profitto (25 bilanciato, 0=OFF)'
    },
    partialTP2Lock: {
        value: 50,  // v5.0: 30% → v5.1: 50% (più aggressivo)
        type: 'multiplier',
        label: '[v5.1] Partial TP livello 2: % da bloccare (50 aggressivo)'
    },

    cycleLossLimit: {
        value: 100,
        type: 'multiplier',
        label: 'Max perdita % per ciclo (100 = disabilitato)'
    },
    baseBetPercent: {
        value: 0.2,
        type: 'multiplier',
        label: 'Puntata base % del balance (0.2 ottimale)'
    },

    // ═══════════════════════════════════════════════════════════════════════
    // MODO 1 - PROGRESSIONE SALTI GRANDI (v5.1: TARGET BILANCIATI)
    // ═══════════════════════════════════════════════════════════════════════
    mode1Step1Mult: {
        value: 3.75,  // v4.2: 3.5x | v5.0: 4.0x | v5.1: 3.75x (compromesso)
        type: 'multiplier',
        label: '[Modo1] Step 1 moltiplicatore (3.75x v5.1)'
    },
    mode1Step2Mult: {
        value: 11.0,  // v4.2: 10.0x | v5.0: 12.0x | v5.1: 11.0x (compromesso)
        type: 'multiplier',
        label: '[Modo1] Step 2 moltiplicatore (11.0x v5.1)'
    },
    mode1MinProfit: {
        value: 30,
        type: 'multiplier',
        label: '[Modo1] Profitto minimo garantito (30 bits ottimale)'
    },

    // ═══════════════════════════════════════════════════════════════════════
    // MODO 2 - RECOVERY (v5.1: TARGET BILANCIATO)
    // ═══════════════════════════════════════════════════════════════════════
    mode2Target: {
        value: 3.75,  // v4.2: 3.5x | v5.0: 4.0x | v5.1: 3.75x (compromesso)
        type: 'multiplier',
        label: '[Modo2] Target recovery (3.75x v5.1)'
    },
    mode2MaxBets: {
        value: 10,
        type: 'multiplier',
        label: '[Modo2] Max tentativi recovery (10 ottimale)'
    },

    // ═══════════════════════════════════════════════════════════════════════
    // PROTEZIONE PATTERN
    // ═══════════════════════════════════════════════════════════════════════
    enableProtection: {
        value: 'yes',
        type: 'radio',
        label: 'Abilita Pattern Protection',
        options: {
            yes: { value: 'yes', type: 'noop', label: 'Si' },
            no: { value: 'no', type: 'noop', label: 'No' }
        }
    },
    maxDelay10x: {
        value: 100,
        type: 'multiplier',
        label: '[Protezione] Max delay senza 10x (100=OFF)'
    },
    maxDelay5x: {
        value: 100,
        type: 'multiplier',
        label: '[Protezione] Max delay senza 5x (100=OFF)'
    },
    maxColdStreak: {
        value: 4,
        type: 'multiplier',
        label: '[Protezione] Max partite senza 3.75x+ (4 ottimale)'
    },
    resumeAt: {
        value: 3.75,  // v4.2: 3.5x | v5.0: 4.0x | v5.1: 3.75x
        type: 'multiplier',
        label: '[Protezione] Riprendi quando arriva Xx (3.75x v5.1)'
    },
    resumeAfterGames: {
        value: 12,
        type: 'multiplier',
        label: '[Protezione] Riprendi dopo N partite (12 ottimale, 0=OFF)'
    },
    warmupGames: {
        value: 0,
        type: 'multiplier',
        label: '[Protezione] Partite warmup iniziale (0 ottimale)'
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// STATO GLOBALE
// ═══════════════════════════════════════════════════════════════════════════════

var startBalance = userInfo.balance;
var currentMode = 1;  // 1 = PROGRESSIONE, 2 = RECOVERY

// ═══════════════════════════════════════════════════════════════════════════════
// NOVITÀ v5.0: LOCK-IN PROFIT
// ═══════════════════════════════════════════════════════════════════════════════
var lockedProfit = 0;           // Profitto "locked" che non può essere perso
var partialTP1Reached = false;  // Flag per livello 1
var partialTP2Reached = false;  // Flag per livello 2

// Cycle state (un ciclo = Mode1 + eventuale Mode2 fino a vittoria o reset)
var cycleStartBalance = userInfo.balance;  // Balance all'inizio del ciclo
var cycleLoss = 0;                         // Perdite accumulate nel ciclo corrente
var cycleResets = 0;                       // Contatore reset per cycle loss

// Modo 1 state
var mode1Step = 0;           // Step corrente (0 = primo bet)
var mode1TotalLoss = 0;      // Perdite accumulate

// Modo 2 state
var mode2Bets = 0;
var mode2LossToRecover = 0;

// Pattern protection
var delay10x = 0;
var delay5x = 0;
var coldStreak = 0;
var isSuspended = false;
var suspendReason = '';
var suspendedGames = 0;  // Contatore partite sospese per multi-resume
var gameCount = 0;
var warmupComplete = false;

// ═══════════════════════════════════════════════════════════════════════════════
// FUNZIONI UTILITÀ
// ═══════════════════════════════════════════════════════════════════════════════

function getBaseBet() {
    return Math.floor(userInfo.balance * config.baseBetPercent.value / 100 / 100) * 100;
}

/**
 * Calcola il moltiplicatore per lo step corrente
 */
function getMode1Multiplier(step) {
    if (step === 0) {
        return config.mode1Step1Mult.value;
    } else {
        return config.mode1Step2Mult.value;
    }
}

// Numero di step nella progressione
var MODE1_MAX_STEPS = 2;

/**
 * Calcola la puntata per lo step corrente
 */
function getMode1Bet(step) {
    var baseBet = getBaseBet();

    if (step === 0) {
        return baseBet;
    }

    // Calcola bet necessario per recuperare perdite + garantire profitto minimo
    var mult = getMode1Multiplier(step);
    var profitMult = mult - 1;
    var requiredBet = Math.ceil((mode1TotalLoss + config.mode1MinProfit.value * 100) / profitMult);

    return Math.max(requiredBet, baseBet);
}

function resetMode1() {
    mode1Step = 0;
    mode1TotalLoss = 0;
}

function resetMode2() {
    mode2Bets = 0;
    mode2LossToRecover = 0;
}

function resetCycle() {
    // Reset completo del ciclo - inizia un nuovo ciclo
    cycleStartBalance = userInfo.balance;
    cycleLoss = 0;
    currentMode = 1;
    resetMode1();
    resetMode2();
}

function resetAll() {
    currentMode = 1;
    resetMode1();
    resetMode2();
    // Quando vinci, il ciclo è completato con successo - reset cycle loss
    cycleLoss = 0;
    cycleStartBalance = userInfo.balance;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * NOVITÀ v5.0: LOCK-IN PARTIAL TAKE PROFIT
 * ═══════════════════════════════════════════════════════════════════════════════
 */
function checkPartialTakeProfit() {
    var currentProfit = userInfo.balance - startBalance;
    var currentProfitPercent = (currentProfit / startBalance) * 100;

    // Livello 1: es. +15%
    if (!partialTP1Reached && currentProfitPercent >= config.partialTP1Target.value) {
        partialTP1Reached = true;
        var lockAmount = Math.floor(currentProfit * config.partialTP1Lock.value / 100);
        lockedProfit += lockAmount;

        log('🔒 PARTIAL TP LIVELLO 1: +' + currentProfitPercent.toFixed(1) + '%');
        log('   Lock ' + config.partialTP1Lock.value + '% = ' + (lockAmount / 100).toFixed(0) + ' bits');
        log('   Locked totale: ' + (lockedProfit / 100).toFixed(0) + ' bits');
    }

    // Livello 2: es. +30%
    if (config.partialTP2Target.value > 0 && !partialTP2Reached && currentProfitPercent >= config.partialTP2Target.value) {
        partialTP2Reached = true;
        var lockAmount2 = Math.floor(currentProfit * config.partialTP2Lock.value / 100);
        lockedProfit += lockAmount2;

        log('🔒 PARTIAL TP LIVELLO 2: +' + currentProfitPercent.toFixed(1) + '%');
        log('   Lock ' + config.partialTP2Lock.value + '% = ' + (lockAmount2 / 100).toFixed(0) + ' bits');
        log('   Locked totale: ' + (lockedProfit / 100).toFixed(0) + ' bits');
    }
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * NOVITÀ v5.0: SESSION STOP LOSS (protezione da tail risk)
 * ═══════════════════════════════════════════════════════════════════════════════
 */
function checkSessionStopLoss() {
    if (config.sessionStopLoss.value === 0) return false;

    // Calcola drawdown dal balance iniziale (considerando locked profit)
    var effectiveBalance = userInfo.balance + lockedProfit;
    var drawdownPercent = ((effectiveBalance - startBalance) / startBalance) * 100;

    if (drawdownPercent <= -config.sessionStopLoss.value) {
        log('');
        log('🛑 SESSION STOP LOSS: ' + drawdownPercent.toFixed(1) + '% (limite: -' + config.sessionStopLoss.value + '%)');
        log('   Balance: ' + (userInfo.balance / 100).toFixed(0) + ' bits');
        log('   Locked: ' + (lockedProfit / 100).toFixed(0) + ' bits');
        log('   Totale: ' + (effectiveBalance / 100).toFixed(0) + ' bits');
        log('');

        stop('SESSION STOP LOSS -' + config.sessionStopLoss.value + '%');
        return true;
    }

    return false;
}

/**
 * Controlla se il ciclo ha superato il limite di perdita
 */
function checkCycleLossLimit() {
    var maxLoss = userInfo.balance * config.cycleLossLimit.value / 100;
    if (cycleLoss >= maxLoss) {
        log('');
        log('⚠️ CYCLE LOSS LIMIT: -' + (cycleLoss / 100).toFixed(0) + ' bits (>' + config.cycleLossLimit.value + '% del bankroll)');
        log('🔄 RESET CICLO - Ricomincio da Mode 1');
        log('');
        cycleResets++;
        resetCycle();
        return true;
    }
    return false;
}

function checkProtection(bust) {
    if (config.enableProtection.value !== 'yes') return;

    if (bust >= 10) {
        delay10x = 0;
        delay5x = 0;
        coldStreak = 0;
    } else if (bust >= 5) {
        delay10x++;
        delay5x = 0;
        coldStreak = 0;
    } else if (bust >= config.resumeAt.value) {
        delay10x++;
        delay5x++;
        coldStreak = 0;
    } else {
        delay10x++;
        delay5x++;
        coldStreak++;
    }

    if (!isSuspended) {
        if (delay10x > config.maxDelay10x.value) {
            isSuspended = true;
            suspendReason = 'delay10x';
            suspendedGames = 0;
        } else if (delay5x > config.maxDelay5x.value) {
            isSuspended = true;
            suspendReason = 'delay5x';
            suspendedGames = 0;
        } else if (coldStreak > config.maxColdStreak.value) {
            isSuspended = true;
            suspendReason = 'coldStreak';
            suspendedGames = 0;
        }

        if (isSuspended) {
            var resumeMsg = config.resumeAt.value + 'x+';
            if (config.resumeAfterGames.value > 0) {
                resumeMsg += ' OR ' + config.resumeAfterGames.value + ' games';
            }
            log('⚠️ SOSPESO: ' + suspendReason + ' - Attendo ' + resumeMsg);
        }
    }

    if (isSuspended) {
        suspendedGames++;

        // Multi-condizione resume: mult >= resumeAt OR games >= resumeAfterGames
        var resumeByMult = bust >= config.resumeAt.value;
        var resumeByGames = config.resumeAfterGames.value > 0 && suspendedGames >= config.resumeAfterGames.value;

        if (resumeByMult || resumeByGames) {
            isSuspended = false;
            coldStreak = 0;
            suspendedGames = 0;
            if (resumeByMult) {
                log('✅ RIPRESO: ' + bust.toFixed(2) + 'x arrivato');
            } else {
                log('✅ RIPRESO: dopo ' + config.resumeAfterGames.value + ' partite');
            }
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GAME STARTING - PIAZZA BET
// ═══════════════════════════════════════════════════════════════════════════════

engine.on('GAME_STARTING', function() {
    gameCount++;

    // Warmup
    if (!warmupComplete && gameCount <= config.warmupGames.value) {
        return;
    }
    warmupComplete = true;

    // ═══════════════════════════════════════════════════════════════════════
    // NOVITÀ v5.0: CHECK PARTIAL TAKE PROFIT
    // ═══════════════════════════════════════════════════════════════════════
    checkPartialTakeProfit();

    // ═══════════════════════════════════════════════════════════════════════
    // NOVITÀ v5.0: CHECK SESSION STOP LOSS
    // ═══════════════════════════════════════════════════════════════════════
    if (checkSessionStopLoss()) {
        return;
    }

    // Check take profit finale (include locked profit)
    var effectiveBalance = userInfo.balance + lockedProfit;
    var profitPercent = ((effectiveBalance - startBalance) / startBalance) * 100;
    if (profitPercent >= config.takeProfit.value) {
        log('');
        log('🎯 TAKE PROFIT FINALE: +' + profitPercent.toFixed(1) + '%');
        log('   Balance: ' + (userInfo.balance / 100).toFixed(0) + ' bits');
        log('   Locked: ' + (lockedProfit / 100).toFixed(0) + ' bits');
        log('   Totale: ' + (effectiveBalance / 100).toFixed(0) + ' bits');
        log('');
        stop('TAKE PROFIT');
        return;
    }

    // Se sospeso, non puntare
    if (isSuspended) {
        return;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // MODO 1: PROGRESSIONE
    // ═══════════════════════════════════════════════════════════════════════
    if (currentMode === 1) {
        var mult = getMode1Multiplier(mode1Step);
        var bet = Math.floor(getMode1Bet(mode1Step) / 100) * 100;
        if (bet < 100) bet = 100;

        if (bet > userInfo.balance) {
            log('⚠️ Modo1: balance insufficiente, switch a Mode 2');
            currentMode = 2;
            mode2LossToRecover = mode1TotalLoss;
            mode2Bets = 0;
            resetMode1();
            return;
        }

        engine.bet(bet, mult);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // MODO 2: RECOVERY
    // ═══════════════════════════════════════════════════════════════════════
    else if (currentMode === 2) {
        var target = config.mode2Target.value;
        var profitMult = target - 1;

        // Bet per recuperare tutto + profitto minimo
        var requiredBet = Math.ceil((mode2LossToRecover + config.mode1MinProfit.value * 100) / profitMult / 100) * 100;
        requiredBet = Math.max(requiredBet, getBaseBet());

        var bet = Math.floor(requiredBet / 100) * 100;
        if (bet < 100) bet = 100;

        if (mode2Bets === 0) {
            log('📐 Recovery: bet=' + (bet/100).toFixed(0) + ' bits per recuperare ' + (mode2LossToRecover/100).toFixed(0) + ' bits');
        }

        if (bet > userInfo.balance) {
            log('⚠️ RECOVERY IMPOSSIBILE: serve ' + (bet/100).toFixed(0) + ' bits');
            log('🔄 Reset forzato → MODO 1');
            resetAll();
            return;
        }

        engine.bet(bet, target);
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// GAME ENDED - GESTISCI RISULTATO
// ═══════════════════════════════════════════════════════════════════════════════

engine.on('GAME_ENDED', function(data) {
    var bust = data.bust;
    var last = engine.history.first();

    checkProtection(bust);

    if (!warmupComplete) return;
    if (!last || last.wager === 0) return;

    var wager = last.wager;
    var cashedAt = last.cashedAt;

    // Exit emergenza 1.01x
    if (cashedAt > 0 && cashedAt <= 1.02) {
        log('🔄 Exit 1.01x - Reset');
        resetAll();
        return;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // MODO 1: PROGRESSIONE
    // ═══════════════════════════════════════════════════════════════════════
    if (currentMode === 1) {
        var targetMult = getMode1Multiplier(mode1Step);

        if (cashedAt >= targetMult) {
            // VINTO!
            var grossProfit = Math.floor(wager * (cashedAt - 1));
            var netProfit = grossProfit - mode1TotalLoss;

            if (mode1Step === 0) {
                log('✅ WIN +' + (grossProfit / 100).toFixed(0) + ' bits @ ' + cashedAt.toFixed(2) + 'x');
            } else {
                log('🎉 RECOVERY WIN Step ' + (mode1Step + 1) + ' @ ' + cashedAt.toFixed(2) + 'x | Netto: ' + (netProfit >= 0 ? '+' : '') + (netProfit / 100).toFixed(0) + ' bits');
            }
            resetMode1();
        } else {
            // PERSO
            mode1TotalLoss += wager;
            cycleLoss += wager;  // Track cycle loss

            log('❌ Step ' + (mode1Step + 1) + ' LOSS -' + (wager / 100).toFixed(0) + ' @ ' + targetMult.toFixed(2) + 'x (tot: -' + (mode1TotalLoss / 100).toFixed(0) + ')');

            // Check cycle loss limit
            if (checkCycleLossLimit()) {
                return;  // Ciclo resettato, esci
            }

            mode1Step++;

            if (mode1Step >= MODE1_MAX_STEPS) {
                // Passa a Mode 2
                log('');
                log('🔄 SWITCH → MODO 2 | Perdita: ' + (mode1TotalLoss / 100).toFixed(0) + ' bits');

                currentMode = 2;
                mode2LossToRecover = mode1TotalLoss;
                mode2Bets = 0;
                resetMode1();
            } else {
                // Mostra prossimo step
                var nextMult = getMode1Multiplier(mode1Step);
                var nextBet = getMode1Bet(mode1Step);
                log('   → Next: ' + (nextBet/100).toFixed(0) + ' bits @ ' + nextMult.toFixed(2) + 'x');
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // MODO 2: RECOVERY
    // ═══════════════════════════════════════════════════════════════════════
    else if (currentMode === 2) {
        mode2Bets++;

        if (cashedAt >= config.mode2Target.value) {
            // VINTO!
            var profit = Math.floor(wager * (cashedAt - 1));
            var netProfit = profit - mode2LossToRecover;

            log('');
            log('🎉 RECOVERY COMPLETATO @ ' + cashedAt.toFixed(2) + 'x');
            log('   Netto: ' + (netProfit >= 0 ? '+' : '') + (netProfit / 100).toFixed(0) + ' bits');
            log('');

            resetAll();
        } else {
            // PERSO
            mode2LossToRecover += wager;
            cycleLoss += wager;  // Track cycle loss

            // Check cycle loss limit
            if (checkCycleLossLimit()) {
                return;  // Ciclo resettato, esci
            }

            if (mode2Bets >= config.mode2MaxBets.value) {
                log('⚠️ Max tentativi Recovery | Perdita: ' + (mode2LossToRecover / 100).toFixed(0) + ' bits');
                log('🔄 Reset → MODO 1');
                resetCycle();  // Usa resetCycle invece di resetAll per tracciare
            } else {
                log('❌ Recovery #' + mode2Bets + ' LOSS -' + (wager/100).toFixed(0) + ' (tot: -' + (mode2LossToRecover/100).toFixed(0) + ')');
            }
        }
    }

    // Log periodico (include locked profit)
    var effectiveBalance = userInfo.balance + lockedProfit;
    var profitPercent = ((effectiveBalance - startBalance) / startBalance) * 100;
    if (gameCount % 100 === 0) {
        var lockInfo = lockedProfit > 0 ? ' | 🔒' + (lockedProfit/100).toFixed(0) : '';
        log('📊 #' + gameCount + ' | Mode: ' + currentMode + ' | ' + (profitPercent >= 0 ? '+' : '') + profitPercent.toFixed(1) + '%' + lockInfo);
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// LOG INIZIALE
// ═══════════════════════════════════════════════════════════════════════════════

log('');
log('╔═══════════════════════════════════════════════════════════════════════════╗');
log('║                    PAOLOBET HYBRID v5.1                                   ║');
log('║        PARAMETRI BILANCIATI - WIN RATE + TAIL RISK PROTECTION             ║');
log('╚═══════════════════════════════════════════════════════════════════════════╝');
log('');
log('🆕 NOVITÀ v5.1 (bilanciamento v5.0):');
log('   • Target bilanciati: 3.75x/11x (compromesso tra v4.2 e v5.0)');
log('   • Session SL più permissivo: -' + config.sessionStopLoss.value + '% (v5.0: -15%)');
log('   • Partial TP aggressivo: +' + config.partialTP1Target.value + '% (lock ' + config.partialTP1Lock.value + '%), +' + config.partialTP2Target.value + '% (lock ' + config.partialTP2Lock.value + '%)');
log('');
var resumeInfo = config.resumeAt.value + 'x';
if (config.resumeAfterGames.value > 0) {
    resumeInfo += ' OR ' + config.resumeAfterGames.value + 'g';
}
log('📊 TP +' + config.takeProfit.value + '% | Base ' + config.baseBetPercent.value + '% | Cold ' + config.maxColdStreak.value + ' | Resume ' + resumeInfo);
log('');
log('🎮 MODO 1 (Salti Grandi):');
var baseBet = Math.floor(userInfo.balance * config.baseBetPercent.value / 100 / 100);
var mult1 = config.mode1Step1Mult.value;
var mult2 = config.mode1Step2Mult.value;
var prob1 = Math.floor((1 / mult1) * 99);
var prob2 = Math.floor((1 / mult2) * 99);
log('   Step 1: ' + baseBet + ' bits @ ' + mult1.toFixed(1) + 'x (~' + prob1 + '%)');
log('   Step 2: ' + baseBet + ' bits @ ' + mult2.toFixed(1) + 'x (~' + prob2 + '%)');
log('');
log('🔄 MODO 2: ' + config.mode2Target.value.toFixed(1) + 'x | Max ' + config.mode2MaxBets.value + ' bet | +' + config.mode1MinProfit.value + ' bits');
log('');
log('🛡️ Cold=' + config.maxColdStreak.value + ' | Resume=' + resumeInfo + ' | SL=' + config.sessionStopLoss.value + '%');
log('');
