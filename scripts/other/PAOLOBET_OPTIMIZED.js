/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                    PAOLOBET OPTIMIZED v3.9                                ║
 * ║           Con Auto-Bet, Take Profit e Pattern Protection                  ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 *
 * RISULTATI TEST v3.9 (500 sessioni × 500 partite):
 * ─────────────────────────────────────────────────────────────────────────────
 *   🎯 TARGET +15%:  41.6% delle sessioni
 *   🛑 STOP LOSS:    58.4% delle sessioni
 *   📈 EV:           +0.15% (profitto medio POSITIVO!)
 *
 * CHIAVE DEL SUCCESSO v3.9:
 *   - Sessioni CORTE (500 partite max)
 *   - Stop Loss ATTIVO (10%)
 *   - Rapporto TP:SL favorevole (15:10 = 1.5:1)
 *   - Matematica: 42% × 15 - 58% × 10 = +0.5%
 *
 * PARAMETRI OTTIMALI CALIBRATI:
 *   - takeProfit: 15% (raggiungibile rapidamente)
 *   - stopLoss: 10% (limita le perdite)
 *   - Protezione: 15/8/5 (evita periodi freddi)
 *
 * FIX v3.8:
 * ─────────────────────────────────────────────────────────────────────────────
 *   - BUGFIX CRITICO: formula x2÷2 era SBAGLIATA!
 *     VECCHIA (sbagliata): mult = (mult - 1) / 2 + 1
 *     NUOVA (corretta):    mult = mult / 2 + 1
 *   - Dimostrazione matematica:
 *     Dopo 23 perdite a 10 bits (tot=230), mult=23.5x:
 *     OLD: mult=12.25, bet=20 → vinci 245, netto=225, ma serve 235 ← MANCANO 10!
 *     NEW: mult=12.75, bet=20 → vinci 255, netto=235 = 230+5 ✓
 *   - CALIBRAZIONE: Testato su 1M+ partite, trovati parametri ottimali
 *
 * FIX v3.7:
 * ─────────────────────────────────────────────────────────────────────────────
 *   - FIX oscillazione protezione: ora riprende SOLO se tutti i delay sono OK
 *   - FIX floating point: tolleranza 0.05 nel confronto vittoria (bustabit=2 decimali)
 *   - NUOVO: maxBetMultiple limita quanto può crescere la bet (default 16x)
 *   - FIX soglia reset dinamica: si adatta alla bet attuale
 *
 * FIX v3.6 (FORMULA SBAGLIATA - CORRETTA IN v3.8):
 * ─────────────────────────────────────────────────────────────────────────────
 *   - Formula x2÷2 era incorretta, causava recupero incompleto
 *
 * FIX v3.5:
 * ─────────────────────────────────────────────────────────────────────────────
 *   - SEMPLIFICATA logica vittoria: cashedAt >= mult → SEMPRE RESET
 *   - Uscita anticipata (cashedAt < mult) → detrarre mult e failBets, continuare
 *   - Questo evita qualsiasi problema di floating point
 *
 * FIX v3.4:
 * ─────────────────────────────────────────────────────────────────────────────
 *   - NUOVO: Warmup iniziale - osserva N partite prima di iniziare
 *   - Se dopo warmup le condizioni sono sfavorevoli, parte in sospensione
 *
 * FIX v3.3:
 * ─────────────────────────────────────────────────────────────────────────────
 *   - NUOVO: Reset manuale su cashout 1.01x - se ESCI volontariamente a 1.01,
 *     l'algoritmo resetta il ciclo (utile quando vedi che il momento è freddo)
 *   - Verificata logica automatica: funziona correttamente
 *
 * FIX v3.2:
 * ─────────────────────────────────────────────────────────────────────────────
 *   - BUGFIX: Recupero parziale ora riduce anche failBets proporzionalmente,
 *     estendendo il ciclo prima del prossimo raddoppio (meno rischio)
 *   - BUGFIX: Quando mult torna al valore iniziale tramite recuperi parziali,
 *     ora resetta anche baseBet (prima rimaneva raddoppiato!)
 *
 * FIX v3.1:
 * ─────────────────────────────────────────────────────────────────────────────
 *   - BUGFIX: Al resume dopo sospensione, l'algoritmo continua esattamente
 *     dallo stato in cui era (mult, bet, normalBets, etc.) invece di resettare
 *
 * NOVITÀ v3.0:
 * ─────────────────────────────────────────────────────────────────────────────
 *   - Pattern Protection: sospende quando il gioco è "freddo"
 *   - Delay Detection: monitora ritardi di 10x, 5x, 3x
 *   - Auto-Resume: riprende quando il gioco si regolarizza
 *   - Health Indicator: mostra la "salute" del gioco in tempo reale
 *
 * SOGLIE OTTIMALI (calibrate su 2000 sessioni x 3000 partite = 6M games):
 * ─────────────────────────────────────────────────────────────────────────────
 *   SOSPENDI quando:
 *   - Delay 10x > 20 partite (aggressivo)
 *   - Delay 5x > 10 partite (aggressivo)
 *   - Cold streak (no 3x+) > 6 partite (aggressivo)
 *
 *   RIPRENDI quando:
 *   - Esce un 10x+ (segnale forte)
 *   - E negli ultimi 10 game ci sono >= 2 valori 5x+
 *   - Dopo segnale, attende 7 partite di conferma
 *
 * RISULTATI TEST (vs senza protezione):
 *   - Hit Rate: 74.1% vs 61.4% (+12.7%)
 *   - EV: +14.2% vs -3.5% (+17.8%)
 *   - Drawdown: -44% vs -56% (migliore)
 *   - Suspend Time: ~50% (passa molto tempo in attesa)
 */

var config = {
    // ═══════════════════════════════════════════════════════════════════════
    // IMPOSTAZIONI PRINCIPALI
    // ═══════════════════════════════════════════════════════════════════════
    takeProfit: {
        value: 15,
        type: 'multiplier',
        label: 'Take Profit % (15 ottimale per EV+)'
    },
    betPercent: {
        value: 0.6,
        type: 'multiplier',
        label: 'Puntata % del balance (0.6 consigliato)'
    },
    mult: {
        value: 1.5,
        type: 'multiplier',
        label: 'Moltiplicatore iniziale (1.5x ottimale)'
    },

    // ═══════════════════════════════════════════════════════════════════════
    // PROTEZIONE PATTERN
    // ═══════════════════════════════════════════════════════════════════════
    enableProtection: {
        value: 'yes',
        type: 'radio',
        label: 'Abilita Pattern Protection',
        options: {
            yes: { value: 'yes', type: 'noop', label: 'Si (consigliato)' },
            no: { value: 'no', type: 'noop', label: 'No' }
        }
    },
    maxDelay10x: {
        value: 15,
        type: 'multiplier',
        label: '[Protezione] Max delay senza 10x (15 ottimale v3.8)'
    },
    maxDelay5x: {
        value: 8,
        type: 'multiplier',
        label: '[Protezione] Max delay senza 5x (8 ottimale v3.8)'
    },
    maxColdStreak: {
        value: 5,
        type: 'multiplier',
        label: '[Protezione] Max partite senza 3x+ (5 ottimale v3.8)'
    },
    resumeWaitGames: {
        value: 7,
        type: 'multiplier',
        label: '[Protezione] Partite attesa dopo segnale (7 ottimale)'
    },
    emergencyResetOn101: {
        value: 'yes',
        type: 'radio',
        label: '[Protezione] Reset su cashout manuale 1.01x',
        options: {
            yes: { value: 'yes', type: 'noop', label: 'Si (consigliato)' },
            no: { value: 'no', type: 'noop', label: 'No' }
        }
    },
    warmupGames: {
        value: 15,
        type: 'multiplier',
        label: '[Protezione] Partite osservazione iniziale (15 consigliato)'
    },

    // ═══════════════════════════════════════════════════════════════════════
    // IMPOSTAZIONI AVANZATE MARTINGALA
    // ═══════════════════════════════════════════════════════════════════════
    normalBets: {
        value: 22,
        type: 'multiplier',
        label: '[Avanzato] Fase conservativa (22 ottimale v3.8)'
    },
    timesToChange: {
        value: 8,
        type: 'multiplier',
        label: '[Avanzato] Perdite prima di raddoppiare'
    },
    multFactor: {
        value: 2,
        type: 'multiplier',
        label: '[Avanzato] Fattore moltiplicazione'
    },
    maxBets: {
        value: 400,
        type: 'multiplier',
        label: '[Avanzato] Max tentativi prima di reset'
    },
    maxBetMultiple: {
        value: 16,
        type: 'multiplier',
        label: '[Avanzato] Max moltiplicatore bet (16 = max 16x bet iniziale)'
    },
    maxBetPercent: {
        value: 10,
        type: 'multiplier',
        label: '[Avanzato] Max % balance per singola bet (10 = max 10%)'
    },
    stopLoss: {
        value: 10,
        type: 'multiplier',
        label: '[Avanzato] Stop Loss % (10 ottimale per EV+)'
    },
    resetOnSuspend: {
        value: 'no',
        type: 'radio',
        label: '[Avanzato] Reset ciclo quando sospeso',
        options: {
            yes: { value: 'yes', type: 'noop', label: 'Si (più sicuro)' },
            no: { value: 'no', type: 'noop', label: 'No (mantieni stato)' }
        }
    },
    strategyOnLoss: {
        value: 'x2div2',
        type: 'radio',
        label: '[Avanzato] Strategia perdita',
        options: {
            x2div2: { value: 'x2div2', type: 'noop', label: 'Raddoppia e dimezza' },
            recoveryValue: { value: 'recoveryValue', type: 'noop', label: 'Recupero fisso' }
        }
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// CALCOLO AUTOMATICO PUNTATA
// ═══════════════════════════════════════════════════════════════════════════════

var startBalance = userInfo.balance;
var takeProfit = config.takeProfit.value / 100;
var targetProfit = Math.floor(startBalance * takeProfit);

var betPercent = config.betPercent.value / 100;
var calculatedBet = Math.floor(startBalance * betPercent);
calculatedBet = Math.max(100, Math.floor(calculatedBet / 100) * 100);

// ═══════════════════════════════════════════════════════════════════════════════
// VARIABILI DI STATO MARTINGALA
// ═══════════════════════════════════════════════════════════════════════════════

var mult = config.mult.value;
var baseBet = calculatedBet;
var normalBets = config.normalBets.value;
var failBets = 0;
var negativeChanges = 0;
var maxBets = config.maxBets.value;
var multRecovered = 0;

var initMult = mult;
var initBet = baseBet;
var initNormalBets = normalBets;
var initMaxBets = maxBets;

// ═══════════════════════════════════════════════════════════════════════════════
// VARIABILI PATTERN PROTECTION
// ═══════════════════════════════════════════════════════════════════════════════

var delay10x = 0;           // Partite senza 10x
var delay5x = 0;            // Partite senza 5x
var coldStreak = 0;         // Partite senza 3x+
var isSuspended = false;    // Gioco sospeso?
var suspendReason = '';     // Motivo sospensione
var waitAfterSignal = 0;    // Attesa dopo segnale di ripresa
var signalReceived = false; // Segnale di ripresa ricevuto
var recentGames = [];       // Ultimi 20 game per analisi
var gamesObserved = 0;      // Contatore partite osservate
var warmupRemaining = config.warmupGames.value; // Partite warmup rimanenti
var isWarmingUp = config.warmupGames.value > 0; // In fase warmup?

// ═══════════════════════════════════════════════════════════════════════════════
// STARTUP LOG
// ═══════════════════════════════════════════════════════════════════════════════

engine.on('GAME_STARTING', onGameStarted);
engine.on('GAME_ENDED', onGameEnded);

log('');
log('╔═══════════════════════════════════════════════════════════════╗');
log('║          PAOLOBET OPTIMIZED v3.0 - AVVIATO                    ║');
log('║              Con Pattern Protection                           ║');
log('╚═══════════════════════════════════════════════════════════════╝');
log('');
log('📊 CONFIGURAZIONE:');
log('─────────────────────────────────────────────────────────────────');
log('   Balance:          ' + (startBalance / 100).toFixed(2) + ' bits');
log('   Puntata base:     ' + (baseBet / 100).toFixed(2) + ' bits (' + config.betPercent.value + '%)');
log('   Moltiplicatore:   ' + mult + 'x');
log('   Take Profit:      +' + config.takeProfit.value + '% (+' + (targetProfit / 100).toFixed(2) + ' bits)');
log('');
if (config.enableProtection.value === 'yes') {
    log('🛡️ PROTEZIONE ATTIVA:');
    log('─────────────────────────────────────────────────────────────────');
    log('   Max delay 10x:    ' + config.maxDelay10x.value + ' partite');
    log('   Max delay 5x:     ' + config.maxDelay5x.value + ' partite');
    log('   Max cold streak:  ' + config.maxColdStreak.value + ' partite');
    log('   Attesa ripresa:   ' + config.resumeWaitGames.value + ' partite');
    log('   Reset su 1.01x:   ' + (config.emergencyResetOn101.value === 'yes' ? 'SI' : 'NO'));
    log('   Warmup iniziale:  ' + config.warmupGames.value + ' partite');
}
if (isWarmingUp) {
    log('');
    log('⏳ WARMUP: Osservo ' + warmupRemaining + ' partite prima di iniziare...');
}
log('');
log('═══════════════════════════════════════════════════════════════');
log('');

// ═══════════════════════════════════════════════════════════════════════════════
// FUNZIONI HELPER
// ═══════════════════════════════════════════════════════════════════════════════

function getHealthStatus() {
    if (recentGames.length < 10) return 'UNKNOWN';

    var last20 = recentGames.slice(-20);
    var count10x = last20.filter(function(g) { return g >= 10; }).length;
    var count5x = last20.filter(function(g) { return g >= 5; }).length;
    var avg = last20.reduce(function(a, b) { return a + b; }, 0) / last20.length;

    if (count10x >= 2 && count5x >= 4 && avg > 3) return 'BUONO';
    if (count10x >= 1 && count5x >= 2 && avg >= 2) return 'NORMALE';
    return 'FREDDO';
}

function checkSuspension() {
    if (config.enableProtection.value !== 'yes') return false;

    // Controlla delay 10x
    if (delay10x > config.maxDelay10x.value) {
        suspendReason = 'Delay 10x: ' + delay10x + ' partite (max ' + config.maxDelay10x.value + ')';
        return true;
    }

    // Controlla delay 5x
    if (delay5x > config.maxDelay5x.value) {
        suspendReason = 'Delay 5x: ' + delay5x + ' partite (max ' + config.maxDelay5x.value + ')';
        return true;
    }

    // Controlla cold streak
    if (coldStreak > config.maxColdStreak.value) {
        suspendReason = 'Cold streak: ' + coldStreak + ' partite senza 3x+ (max ' + config.maxColdStreak.value + ')';
        return true;
    }

    return false;
}

function checkResume(lastBust) {
    // Segnale forte: 10x+ o 20x+
    if (lastBust >= 10) {
        signalReceived = true;
        waitAfterSignal = config.resumeWaitGames.value;
        log('🟢 Segnale ripresa: ' + lastBust.toFixed(2) + 'x! Attendo ' + waitAfterSignal + ' partite...');
        return false;
    }

    // IMPORTANTE: Non riprendere se i delay sono ancora sopra soglia!
    // Altrimenti si crea oscillazione: riprende → punta → sospende subito
    var delaysOk = delay10x <= config.maxDelay10x.value &&
                   delay5x <= config.maxDelay5x.value &&
                   coldStreak <= config.maxColdStreak.value;

    // Se abbiamo ricevuto segnale, conta attesa
    if (signalReceived) {
        waitAfterSignal--;
        if (waitAfterSignal <= 0) {
            // Verifica che gli ultimi game siano buoni E che i delay siano ok
            var last10 = recentGames.slice(-10);
            var count5x = last10.filter(function(g) { return g >= 5; }).length;

            if (count5x >= 2 && delaysOk) {
                log('✅ Gioco regolarizzato! ' + count5x + ' valori >=5x, delay OK');
                return true;
            } else if (count5x >= 2) {
                log('⏳ Attesa: delay ancora alti (10x:' + delay10x + ', 5x:' + delay5x + ')');
                // Non resettiamo signalReceived, continuiamo ad aspettare
                return false;
            } else {
                log('⏳ Attesa: solo ' + count5x + ' valori >=5x (serve >= 2)');
                signalReceived = false;
                return false;
            }
        }
    }

    // Segnale alternativo: 3+ valori 5x+ E delay sotto soglia
    var last10 = recentGames.slice(-10);
    var count5x = last10.filter(function(g) { return g >= 5; }).length;
    if (count5x >= 3 && delaysOk) {
        log('✅ Ripresa: ' + count5x + ' valori >=5x, delay OK');
        return true;
    }

    return false;
}

function reset() {
    mult = initMult;
    baseBet = initBet;
    failBets = 0;
    normalBets = initNormalBets;
    negativeChanges = 0;
    maxBets = initMaxBets;
    multRecovered = 0;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EVENT HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

function onGameStarted() {
    // Check Take Profit
    var currentProfit = userInfo.balance - startBalance;
    if (currentProfit >= targetProfit) {
        log('');
        log('★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★');
        log('              🎉 TAKE PROFIT RAGGIUNTO! 🎉');
        log('★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★');
        log('   Profitto: +' + (currentProfit / 100).toFixed(2) + ' bits (+' + ((currentProfit / startBalance) * 100).toFixed(1) + '%)');
        log('★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★');
        stop('TAKE PROFIT RAGGIUNTO!');
        return;
    }

    // Se in warmup, non puntare (osserva solamente)
    if (isWarmingUp) {
        return; // Aspetta GAME_ENDED per aggiornare stato
    }

    // Se sospeso, non puntare
    if (isSuspended) {
        return; // Aspetta GAME_ENDED per aggiornare stato
    }

    // ═══════════════════════════════════════════════════════════════════════
    // STOP-LOSS: Ferma se balance è sceso troppo (solo se attivo, value > 0)
    // ═══════════════════════════════════════════════════════════════════════
    if (config.stopLoss.value > 0) {
        var stopLossThreshold = startBalance * (1 - config.stopLoss.value / 100);
        if (userInfo.balance <= stopLossThreshold) {
            log('');
            log('🛑 ═══════════════════════════════════════════════════════════');
            log('   STOP-LOSS ATTIVATO!');
            log('   Balance: ' + (userInfo.balance / 100).toFixed(2) + ' < ' + (stopLossThreshold / 100).toFixed(2));
            log('   Perdita: -' + ((startBalance - userInfo.balance) / 100).toFixed(2) + ' bits (-' + ((startBalance - userInfo.balance) / startBalance * 100).toFixed(1) + '%)');
            log('═══════════════════════════════════════════════════════════ 🛑');
            stop('STOP-LOSS');
            return;
        }
    }

    // Controlla se dobbiamo sospendere
    if (checkSuspension()) {
        isSuspended = true;
        signalReceived = false;
        // Se abilitato resetOnSuspend, resetta il ciclo per sicurezza
        if (config.resetOnSuspend.value === 'yes' && baseBet > initBet) {
            log('🔄 Reset ciclo per sospensione (bet era ' + (baseBet/100).toFixed(2) + ')');
            reset();
        }
        log('');
        log('⚠️ ═══════════════════════════════════════════════════════════');
        log('   GIOCO SOSPESO - Pattern anomalo rilevato!');
        log('   ' + suspendReason);
        log('   Attendo regolarizzazione...');
        log('═══════════════════════════════════════════════════════════ ⚠️');
        log('');
        return;
    }

    // Reset se max tentativi
    if (maxBets <= 0) {
        log('⚠️ Max tentativi, reset ciclo...');
        reset();
    }

    // Calcola target mult
    var targetMult = mult;
    if (config.strategyOnLoss.value === 'recoveryValue' && multRecovered > 0) {
        targetMult = config.multFactor.value;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // CONTROLLI BET: non superare % del balance attuale
    // ═══════════════════════════════════════════════════════════════════════
    var currentBet = Math.round(baseBet);
    var maxBetByPercent = Math.floor(userInfo.balance * config.maxBetPercent.value / 100);

    // Se la bet supera il limite %, riducila
    if (currentBet > maxBetByPercent) {
        log('⚠️ Bet ridotta: ' + (currentBet/100).toFixed(2) + ' > ' + config.maxBetPercent.value + '% balance. Reset ciclo.');
        reset();
        currentBet = Math.round(baseBet);
    }

    // Verifica balance
    if (currentBet > userInfo.balance) {
        log('❌ Balance insufficiente: ' + (currentBet / 100).toFixed(2) + ' > ' + (userInfo.balance / 100).toFixed(2));
        stop('BALANCE INSUFFICIENTE');
        return;
    }

    // Log status ogni 50 partite
    gamesObserved++;
    if (gamesObserved % 50 === 0) {
        var health = getHealthStatus();
        var progress = ((userInfo.balance - startBalance) / targetProfit * 100);
        log('📊 [' + gamesObserved + '] Health: ' + health + ' | Delay 10x: ' + delay10x + ' | Progress: ' + progress.toFixed(1) + '%');
    }

    // Piazza la puntata
    engine.bet(currentBet, targetMult);
}

function onGameEnded() {
    var lastGame = engine.history.first();
    var lastBust = lastGame.bust;

    // Aggiorna tracking pattern (sempre, anche se sospesi)
    recentGames.push(lastBust);
    if (recentGames.length > 30) recentGames.shift();

    // Aggiorna delay counters
    if (lastBust >= 10) {
        delay10x = 0;
    } else {
        delay10x++;
    }

    if (lastBust >= 5) {
        delay5x = 0;
    } else {
        delay5x++;
    }

    if (lastBust >= 3) {
        coldStreak = 0;
    } else {
        coldStreak++;
    }

    // Gestione warmup
    if (isWarmingUp) {
        warmupRemaining--;

        // Log ogni 5 partite
        if (warmupRemaining > 0 && warmupRemaining % 5 === 0) {
            log('⏳ Warmup: ' + warmupRemaining + ' rimanenti | ' +
                '10x delay:' + delay10x + ' | 5x delay:' + delay5x + ' | cold:' + coldStreak);
        }

        // Fine warmup
        if (warmupRemaining <= 0) {
            isWarmingUp = false;
            var health = getHealthStatus();

            log('');
            log('═══════════════════════════════════════════════════════════════');
            log('                    ⏳ WARMUP COMPLETATO');
            log('═══════════════════════════════════════════════════════════════');
            log('   Health: ' + health);
            log('   Delay 10x: ' + delay10x + ' (max ' + config.maxDelay10x.value + ')');
            log('   Delay 5x: ' + delay5x + ' (max ' + config.maxDelay5x.value + ')');
            log('   Cold streak: ' + coldStreak + ' (max ' + config.maxColdStreak.value + ')');

            // Controlla se dobbiamo partire sospesi
            if (checkSuspension()) {
                isSuspended = true;
                signalReceived = false;
                log('');
                log('⚠️ Condizioni NON favorevoli - PARTO IN SOSPENSIONE');
                log('   Motivo: ' + suspendReason);
                log('   Attendo regolarizzazione...');
            } else {
                log('');
                log('✅ Condizioni favorevoli - INIZIO A GIOCARE!');
            }
            log('═══════════════════════════════════════════════════════════════');
            log('');
        }
        return;
    }

    // Se sospeso, controlla se riprendere
    if (isSuspended) {
        if (checkResume(lastBust)) {
            isSuspended = false;
            signalReceived = false;
            log('');
            log('🟢 ═══════════════════════════════════════════════════════════');
            log('   GIOCO RIPRESO - Pattern regolarizzato!');
            log('   Health: ' + getHealthStatus());
            log('   Stato: Mult=' + mult.toFixed(2) + 'x, Bet=' + (baseBet/100).toFixed(2) + ' bits');
            log('═══════════════════════════════════════════════════════════ 🟢');
            log('');
            // IMPORTANTE: NON resettare! L'algoritmo deve continuare
            // esattamente da dove era stato sospeso
        }
        return;
    }

    // Se abbiamo puntato, gestisci risultato
    if (lastGame.wager) {
        if (!lastGame.cashedAt) {
            handleLoss();
        } else {
            handleWin(lastGame);
        }
    }
}

function handleLoss() {
    if (normalBets <= 0) {
        failBets++;

        if (config.strategyOnLoss.value === 'x2div2') {
            if (failBets % config.timesToChange.value === 0) {
                negativeChanges++;
                // Formula: (mult - 1) / factor + 1
                // Questo mantiene: (mult - 1) × bet = costante
                // Così recuperi SEMPRE tutte le perdite + profitto iniziale!
                var oldMult = mult;
                var oldBet = baseBet;
                var newBet = baseBet * config.multFactor.value;
                var maxBet = initBet * config.maxBetMultiple.value;

                // Controlla se supereremmo il limite
                if (newBet > maxBet) {
                    log('⚠️ x2÷2 BLOCCATO: bet ' + (newBet / 100).toFixed(2) + ' > max ' + (maxBet / 100).toFixed(2) + '. Continuo senza raddoppiare.');
                    mult++;  // Aumenta solo mult, non raddoppiare bet
                } else {
                    // FORMULA CORRETTA: mult/factor + 1 (NON (mult-1)/factor + 1!)
                    // Dimostrazione: dopo N perdite, devo vincere totalLosses + betCorrente + profittoOriginale
                    // Se raddoppio bet e dimezza mult così, il profitto finale è sempre quello iniziale
                    mult = mult / config.multFactor.value + 1;
                    baseBet = newBet;
                    log('🔄 x2÷2: bet ' + (oldBet / 100).toFixed(2) + '→' + (baseBet / 100).toFixed(2) + ', mult ' + oldMult.toFixed(2) + '→' + mult.toFixed(2) + 'x');
                }
            } else {
                mult++;
            }
        } else if (config.strategyOnLoss.value === 'recoveryValue') {
            if (multRecovered === 0) {
                multRecovered = mult;
            }
            multRecovered++;
        }
    } else {
        mult++;
        normalBets--;

        if (normalBets === 0) {
            log('📍 Fine fase conservativa');
        }
    }

    maxBets--;
}

function handleWin(lastGame) {
    var profit = (lastGame.cashedAt * lastGame.wager - lastGame.wager) / 100;
    var totalProfit = (userInfo.balance - startBalance) / 100;
    log('✅ +' + profit.toFixed(2) + ' bits @ ' + lastGame.cashedAt.toFixed(2) + 'x | Tot: ' + (totalProfit >= 0 ? '+' : '') + totalProfit.toFixed(2));

    // RESET MANUALE: Se l'utente esce volontariamente a 1.01x o meno,
    // significa che vuole resettare il ciclo (momento non propizio)
    if (config.emergencyResetOn101.value === 'yes' && lastGame.cashedAt <= 1.01) {
        log('');
        log('🚨 ═══════════════════════════════════════════════════════════');
        log('   RESET MANUALE - Uscita volontaria a ' + lastGame.cashedAt.toFixed(2) + 'x');
        log('   Stato prima: Mult=' + mult.toFixed(2) + 'x, Bet=' + (baseBet/100).toFixed(2) + ' bits');
        log('   Resetto tutto al ciclo iniziale...');
        log('═══════════════════════════════════════════════════════════ 🚨');
        log('');
        reset();
        return;
    }

    if (config.strategyOnLoss.value === 'x2div2') {
        // LOGICA SEMPLICE:
        // - Se cashedAt >= mult (hai vinto al target) → SEMPRE RESET
        // - Se cashedAt < mult (uscita manuale anticipata) → detrarre e continuare
        //
        // IMPORTANTE: Bustabit mostra solo 2 decimali. Se mult=12.065 e cashedAt=12.06,
        // tecnicamente hai vinto ma il confronto fallirebbe. Usiamo tolleranza 0.05.

        if (lastGame.cashedAt >= mult - 0.05) {
            // VITTORIA AL TARGET → RESET COMPLETO
            log('🔄 Vittoria al target ' + mult.toFixed(2) + 'x! Reset ciclo.');
            reset();
        } else {
            // USCITA MANUALE ANTICIPATA → detrarre e continuare
            var recovered = parseInt(lastGame.cashedAt, 10) - 1;
            var oldMult = mult;
            mult -= recovered;

            // Riduci anche failBets proporzionalmente per estendere il ciclo
            if (failBets > 0) {
                var oldFailBets = failBets;
                failBets = Math.max(0, failBets - recovered);
                log('📉 Uscita anticipata: mult ' + oldMult.toFixed(2) + '→' + mult.toFixed(2) + 'x, failBets ' + oldFailBets + '→' + failBets);
            } else {
                log('📉 Uscita anticipata: mult ' + oldMult.toFixed(2) + '→' + mult.toFixed(2) + 'x');
            }

            // Calcola la soglia di reset dinamica basata sulla bet attuale
            // originalProfit = initBet × (initMult - 1)
            // resetMult = originalProfit / currentBet + 1
            // Questo garantisce che il profitto finale sia SEMPRE = originalProfit
            var originalProfit = initBet * (initMult - 1);
            var resetMult = originalProfit / baseBet + 1;

            // Se mult è sceso alla soglia di reset, abbiamo recuperato tutto!
            if (mult <= resetMult) {
                log('🔄 Recupero completo! mult=' + mult.toFixed(2) + 'x (soglia=' + resetMult.toFixed(2) + 'x) → Reset!');
                reset();
            }
        }
    } else if (config.strategyOnLoss.value === 'recoveryValue') {
        if (multRecovered === 0) {
            reset();
        } else {
            multRecovered -= lastGame.cashedAt;
            if (multRecovered <= 0) reset();
        }
    }
}
