/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                 PAOLOBET HYBRID ADAPTIVE v2.0                             ║
 * ║         ADAPTIVE EXPERT SYSTEM + MULTI-STRATEGY DECISION ENGINE           ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 *
 * ADAPTIVE v2.0 (2026-01-02):
 * ─────────────────────────────────────────────────────────────────────────────
 * NOTA: Questo NON è Machine Learning/AI, ma un ADAPTIVE EXPERT SYSTEM
 *       Rule-based con pattern detection e multi-strategy switching.
 *
 *   1. MULTI-STRATEGY SELECTOR
 *      - Hybrid Progressive (v5.1 baseline)
 *      - Pure Martingale (recovery aggressiva)
 *      - Conservative Flat (bassa varianza)
 *      - Scelta basata su scoring system con regole euristiche
 *
 *   2. ADAPTIVE DECISION ENGINE
 *      - Analizza statistiche ultimi 20 crash (media, std dev, conteggi)
 *      - Decide dinamicamente: strategia, bet size, skip, take profit, targets
 *      - Regole if/else con threshold fissi (non apprendimento)
 *
 *   3. PATTERN DETECTION (Statistiche Descrittive)
 *      - Hot/Cold Streak Detection (conteggio crash alti/bassi)
 *      - Volatility Analysis (standard deviation)
 *      - Mean Reversion Tracking (scostamento da media teorica)
 *      - Strategy Performance Tracking (win rate, ROI)
 *
 *   4. DYNAMIC ADJUSTMENTS (Rule-Based)
 *      - Bet Size: 0.5x - 2x del base (in base a confidence score)
 *      - Targets: ±15% in base a pattern
 *      - Stop Loss: adattato in base a volatilità
 *      - Skip Betting: quando confidence < 0.3 o cold streak > 0.7
 *      - Strategy Switching: in base a condizioni di mercato
 *
 * BASELINE: v5.1 parameters (manualmente ottimizzati)
 * AI LAYER: Adattamento dinamico + strategy selection + session scaling
 *
 * OBIETTIVO: Performance consistenti su sessioni 500-100,000+ games
 */

var config = {
    // ═══════════════════════════════════════════════════════════════════════
    // BASELINE v5.1 (PARAMETRI BASE)
    // ═══════════════════════════════════════════════════════════════════════
    takeProfit: {
        value: 20,
        type: 'multiplier',
        label: 'Take Profit % (20 base, AI può anticipare)'
    },

    sessionStopLoss: {
        value: 20,
        type: 'multiplier',
        label: '[AI] Session Stop Loss % (20 base, dinamico ±30%)'
    },

    partialTP1Target: {
        value: 10,
        type: 'multiplier',
        label: '[AI] Partial TP liv 1 (10 base)'
    },
    partialTP1Lock: {
        value: 40,
        type: 'multiplier',
        label: '[AI] Partial TP lock 1 (40%)'
    },
    partialTP2Target: {
        value: 25,
        type: 'multiplier',
        label: '[AI] Partial TP liv 2 (25 base)'
    },
    partialTP2Lock: {
        value: 50,
        type: 'multiplier',
        label: '[AI] Partial TP lock 2 (50%)'
    },

    cycleLossLimit: {
        value: 100,
        type: 'multiplier',
        label: 'Cycle Loss Limit (100=OFF)'
    },
    baseBetPercent: {
        value: 0.2,
        type: 'multiplier',
        label: '[AI] Base Bet % (0.2, AI moltiplica 0.5x-2x)'
    },

    mode1Step1Mult: {
        value: 3.75,
        type: 'multiplier',
        label: '[AI] Mode1 Step1 (3.75 base, dinamico ±15%)'
    },
    mode1Step2Mult: {
        value: 11.0,
        type: 'multiplier',
        label: '[AI] Mode1 Step2 (11.0 base, dinamico ±15%)'
    },
    mode1MinProfit: {
        value: 30,
        type: 'multiplier',
        label: 'Mode1 Min Profit (30 bits)'
    },

    mode2Target: {
        value: 3.75,
        type: 'multiplier',
        label: '[AI] Mode2 Target (3.75 base, dinamico ±15%)'
    },
    mode2MaxBets: {
        value: 10,
        type: 'multiplier',
        label: 'Mode2 Max Bets'
    },

    // Protezione
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
        label: 'Max delay 10x (100=OFF)'
    },
    maxDelay5x: {
        value: 100,
        type: 'multiplier',
        label: 'Max delay 5x (100=OFF)'
    },
    maxColdStreak: {
        value: 4,
        type: 'multiplier',
        label: 'Max cold streak'
    },
    resumeAt: {
        value: 3.75,
        type: 'multiplier',
        label: 'Resume at Xx'
    },
    resumeAfterGames: {
        value: 12,
        type: 'multiplier',
        label: 'Resume after N games'
    },
    warmupGames: {
        value: 0,
        type: 'multiplier',
        label: 'Warmup games'
    },

    // ═══════════════════════════════════════════════════════════════════════
    // NOVITÀ: AI CONFIGURATION
    // ═══════════════════════════════════════════════════════════════════════
    aiEnabled: {
        value: 'yes',
        type: 'radio',
        label: '[AI] Abilita AI Decision Engine',
        options: {
            yes: { value: 'yes', type: 'noop', label: 'Si' },
            no: { value: 'no', type: 'noop', label: 'No' }
        }
    },
    aiPatternWindow: {
        value: 20,
        type: 'multiplier',
        label: '[AI] Pattern Window (ultimi N crash da analizzare)'
    },
    aiConfidenceThreshold: {
        value: 0.6,
        type: 'multiplier',
        label: '[AI] Confidence Threshold (0.6 = 60%)'
    },

    // ═══════════════════════════════════════════════════════════════════════
    // NOVITÀ: MULTI-STRATEGY AI
    // ═══════════════════════════════════════════════════════════════════════
    aiStrategySwitch: {
        value: 'yes',
        type: 'radio',
        label: '[AI] Abilita Strategy Switching',
        options: {
            yes: { value: 'yes', type: 'noop', label: 'Si' },
            no: { value: 'no', type: 'noop', label: 'No (usa solo Hybrid)' }
        }
    },
    aiMartingaleTarget: {
        value: 2.0,
        type: 'multiplier',
        label: '[AI] Martingale Target (2.0x default)'
    },
    aiMartingaleMaxSteps: {
        value: 6,
        type: 'multiplier',
        label: '[AI] Martingale Max Steps (6 default)'
    },
    aiFlatBetTarget: {
        value: 3.0,
        type: 'multiplier',
        label: '[AI] Flat Bet Target (3.0x default)'
    },

};

// ═══════════════════════════════════════════════════════════════════════════════
// STATO GLOBALE
// ═══════════════════════════════════════════════════════════════════════════════

var startBalance = userInfo.balance;
var currentMode = 1;

// Lock-in profit
var lockedProfit = 0;
var partialTP1Reached = false;
var partialTP2Reached = false;

// Cycle state
var cycleStartBalance = userInfo.balance;
var cycleLoss = 0;
var cycleResets = 0;

// Mode state
var mode1Step = 0;
var mode1TotalLoss = 0;
var mode2Bets = 0;
var mode2LossToRecover = 0;

// Protection
var delay10x = 0;
var delay5x = 0;
var coldStreak = 0;
var isSuspended = false;
var suspendReason = '';
var suspendedGames = 0;
var gameCount = 0;
var warmupComplete = false;

// ═══════════════════════════════════════════════════════════════════════════════
// NOVITÀ: AI STATE
// ═══════════════════════════════════════════════════════════════════════════════

var crashHistory = [];          // Ultimi N crash
var aiDecisions = [];            // Storico decisioni AI
var aiMetrics = {
    hotStreak: 0,                // Counter crash alti recenti
    coldStreak: 0,               // Counter crash bassi recenti
    volatility: 0,               // Volatilità locale
    meanDeviation: 0,            // Scostamento dalla media teorica
    confidence: 1.0,             // Confidence level (0-1)
};

// ═══════════════════════════════════════════════════════════════════════════════
// NOVITÀ: MULTI-STRATEGY STATE
// ═══════════════════════════════════════════════════════════════════════════════

var STRATEGIES = {
    HYBRID: 'hybrid',           // v5.1 progressive strategy
    MARTINGALE: 'martingale',   // Pure martingale (double after loss)
    FLAT: 'flat'                // Conservative flat betting
};

var currentStrategy = STRATEGIES.HYBRID;  // Strategia attiva
var strategyStartBalance = userInfo.balance;
var strategySwitchCount = 0;

// Performance tracking per strategia
var strategyPerformance = {
    hybrid: { wins: 0, losses: 0, totalProfit: 0, gamesPlayed: 0 },
    martingale: { wins: 0, losses: 0, totalProfit: 0, gamesPlayed: 0 },
    flat: { wins: 0, losses: 0, totalProfit: 0, gamesPlayed: 0 }
};

// Martingale state
var martingaleStep = 0;
var martingaleBaseBet = 0;
var martingaleTotalLoss = 0;

// Flat betting state
var flatBetConsecutiveLosses = 0;

// ═══════════════════════════════════════════════════════════════════════════════
// AI DECISION ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Analizza pattern recenti e aggiorna metriche AI
 */
function updateAIMetrics() {
    if (config.aiEnabled.value !== 'yes' || crashHistory.length < 5) return;

    const window = Math.min(config.aiPatternWindow.value, crashHistory.length);
    const recent = crashHistory.slice(-window);

    // 1. Hot/Cold Streak Detection
    const lowCrashes = recent.filter(c => c < 2.0).length;
    const highCrashes = recent.filter(c => c >= 3.0).length;

    aiMetrics.coldStreak = lowCrashes / window;   // 0-1
    aiMetrics.hotStreak = highCrashes / window;    // 0-1

    // 2. Volatility (std dev)
    const mean = recent.reduce((sum, c) => sum + c, 0) / window;
    const variance = recent.reduce((sum, c) => sum + Math.pow(c - mean, 2), 0) / window;
    aiMetrics.volatility = Math.sqrt(variance);

    // 3. Mean Deviation (vs theoretical mean = 1.99)
    const theoreticalMean = 1.99; // (99/1) - 1% house edge
    aiMetrics.meanDeviation = mean - theoreticalMean;

    // 4. Confidence Score
    // Alta confidence = pattern favorevole
    // Bassa confidence = pattern sfavorevole o incerto

    let confidence = 0.5; // Baseline neutro

    // Se molti crash bassi → bassa confidence (aspettati recovery)
    if (aiMetrics.coldStreak > 0.6) {
        confidence -= 0.2;
    }

    // Se volatilità alta → bassa confidence (incertezza)
    if (aiMetrics.volatility > 3.0) {
        confidence -= 0.15;
    }

    // Se sotto media → alta confidence (aspettati crash alti)
    if (aiMetrics.meanDeviation < -0.3) {
        confidence += 0.2;
    }

    // Se sopra media → bassa confidence
    if (aiMetrics.meanDeviation > 0.3) {
        confidence -= 0.1;
    }

    // Clamp 0-1
    aiMetrics.confidence = Math.max(0, Math.min(1, confidence));
}

/**
 * AI decide se skippare il bet corrente
 */
function aiShouldSkipBet() {
    if (config.aiEnabled.value !== 'yes') return false;

    // Skip se confidence molto bassa
    if (aiMetrics.confidence < 0.3) {
        log('🤖 ADAPTIVE: Skip bet (low confidence ' + (aiMetrics.confidence * 100).toFixed(0) + '%)');
        return true;
    }

    // Skip se in cold streak molto pesante
    if (aiMetrics.coldStreak > 0.7 && crashHistory.length >= 15) {
        log('🤖 ADAPTIVE: Skip bet (heavy cold streak)');
        return true;
    }

    return false;
}

/**
 * AI decide il moltiplicatore del bet size
 * Return: 0.5 - 2.0
 */
function aiGetBetMultiplier() {
    if (config.aiEnabled.value !== 'yes') return 1.0;

    let multiplier = 1.0;

    // Alta confidence → bet più grande
    if (aiMetrics.confidence > 0.7) {
        multiplier = 1.0 + (aiMetrics.confidence - 0.7) * 2; // Max 1.6x
    }

    // Bassa confidence → bet più piccolo
    if (aiMetrics.confidence < 0.5) {
        multiplier = 0.5 + aiMetrics.confidence; // Min 0.5x
    }

    // In cold streak → bet conservativo
    if (aiMetrics.coldStreak > 0.6) {
        multiplier *= 0.7;
    }

    return Math.max(0.5, Math.min(2.0, multiplier));
}

/**
 * AI adatta dinamicamente il target
 */
function aiGetAdjustedTarget(baseTarget) {
    if (config.aiEnabled.value !== 'yes') return baseTarget;

    let adjusted = baseTarget;

    // Se in cold streak → aumenta target (evita crash bassi)
    if (aiMetrics.coldStreak > 0.6) {
        adjusted *= 1.15; // +15%
    }

    // Se sotto media teorica → abbassa target (aspettati recovery)
    if (aiMetrics.meanDeviation < -0.3) {
        adjusted *= 0.90; // -10%
    }

    // Se volatilità alta → target conservativo
    if (aiMetrics.volatility > 3.5) {
        adjusted *= 1.10;
    }

    return adjusted;
}

/**
 * AI decide se fare take profit anticipato
 */
function aiShouldTakeProfit() {
    if (config.aiEnabled.value !== 'yes') return false;

    const currentProfit = userInfo.balance + lockedProfit - startBalance;
    const profitPercent = (currentProfit / startBalance) * 100;

    // Se profit >= 15% E confidence bassa → take profit anticipato
    if (profitPercent >= 15 && aiMetrics.confidence < 0.4) {
        log('🤖 ADAPTIVE: Early take profit (low confidence, lock ' + profitPercent.toFixed(1) + '%)');
        return true;
    }

    // Se volatilità improvvisa alta E profit > 10% → secure
    if (profitPercent >= 10 && aiMetrics.volatility > 4.0) {
        log('🤖 ADAPTIVE: Early take profit (high volatility)');
        return true;
    }

    return false;
}

/**
 * AI adatta session stop loss
 */
function aiGetAdjustedStopLoss() {
    if (config.aiEnabled.value !== 'yes') return config.sessionStopLoss.value;

    let adjusted = config.sessionStopLoss.value;

    // Se volatilità alta → stop loss più permissivo
    if (aiMetrics.volatility > 3.5) {
        adjusted *= 1.3; // +30%
    }

    // Se confidence alta → stop loss più stretto
    if (aiMetrics.confidence > 0.7) {
        adjusted *= 0.85; // -15%
    }

    return Math.floor(adjusted);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MULTI-STRATEGY AI
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calcola win rate di una strategia
 */
function getStrategyWinRate(strategyName) {
    const perf = strategyPerformance[strategyName];
    if (perf.gamesPlayed === 0) return 0;
    return (perf.wins / perf.gamesPlayed) * 100;
}

/**
 * Calcola ROI di una strategia (%)
 */
function getStrategyROI(strategyName) {
    const perf = strategyPerformance[strategyName];
    if (perf.gamesPlayed === 0) return 0;
    // Assume avg bet size = 1% balance
    const avgBet = strategyStartBalance * 0.01;
    const totalRisked = avgBet * perf.gamesPlayed;
    if (totalRisked === 0) return 0;
    return (perf.totalProfit / totalRisked) * 100;
}

/**
 * AI seleziona la migliore strategia in base a pattern e performance
 */
function aiSelectStrategy() {
    if (config.aiEnabled.value !== 'yes' || config.aiStrategySwitch.value !== 'yes') {
        return STRATEGIES.HYBRID;
    }

    // Minimo 10 crash in history per decisione
    if (crashHistory.length < 10) {
        return STRATEGIES.HYBRID;
    }

    let scores = {
        hybrid: 0,
        martingale: 0,
        flat: 0
    };

    // 1. PATTERN SCORING

    // Volatilità alta → favorisce Flat (bassa varianza)
    if (aiMetrics.volatility > 3.5) {
        scores.flat += 30;
        scores.hybrid -= 10;
        scores.martingale -= 20;
    }

    // Volatilità bassa → favorisce Martingale (più aggressivo)
    if (aiMetrics.volatility < 1.5) {
        scores.martingale += 25;
        scores.flat -= 15;
    }

    // Cold streak pesante → favorisce Martingale (recovery veloce)
    if (aiMetrics.coldStreak > 0.65) {
        scores.martingale += 20;
        scores.hybrid += 10;
        scores.flat -= 10;
    }

    // Hot streak → favorisce Hybrid (target alti)
    if (aiMetrics.hotStreak > 0.5) {
        scores.hybrid += 25;
        scores.flat += 10;
    }

    // Confidence alta → favorisce Hybrid (sfrutta pattern)
    if (aiMetrics.confidence > 0.7) {
        scores.hybrid += 20;
    }

    // Confidence bassa → favorisce Flat (minimizza rischio)
    if (aiMetrics.confidence < 0.4) {
        scores.flat += 25;
        scores.martingale -= 15;
    }

    // Sotto media → favorisce Martingale (aspetta recovery)
    if (aiMetrics.meanDeviation < -0.3) {
        scores.martingale += 15;
    }

    // 2. PERFORMANCE SCORING (se abbiamo dati)

    if (strategyPerformance.hybrid.gamesPlayed > 20) {
        const hybridROI = getStrategyROI('hybrid');
        if (hybridROI > 0) scores.hybrid += 15;
        if (hybridROI < -5) scores.hybrid -= 20;
    }

    if (strategyPerformance.martingale.gamesPlayed > 20) {
        const martROI = getStrategyROI('martingale');
        if (martROI > 0) scores.martingale += 15;
        if (martROI < -5) scores.martingale -= 20;
    }

    if (strategyPerformance.flat.gamesPlayed > 20) {
        const flatROI = getStrategyROI('flat');
        if (flatROI > 0) scores.flat += 15;
        if (flatROI < -5) scores.flat -= 20;
    }

    // 3. DRAWDOWN PROTECTION

    const currentDrawdown = ((userInfo.balance - startBalance) / startBalance) * 100;

    // Drawdown > 15% → favorisce Conservative (Flat)
    if (currentDrawdown < -15) {
        scores.flat += 30;
        scores.martingale -= 25;
    }

    // Drawdown < 5% → può permettersi Martingale
    if (currentDrawdown > -5) {
        scores.martingale += 10;
    }

    // 4. SELEZIONE FINALE

    let bestStrategy = STRATEGIES.HYBRID;
    let bestScore = scores.hybrid;

    if (scores.martingale > bestScore) {
        bestStrategy = STRATEGIES.MARTINGALE;
        bestScore = scores.martingale;
    }

    if (scores.flat > bestScore) {
        bestStrategy = STRATEGIES.FLAT;
        bestScore = scores.flat;
    }

    // Log se cambia strategia
    if (bestStrategy !== currentStrategy) {
        log('🔄 AI STRATEGY SWITCH: ' + currentStrategy + ' → ' + bestStrategy +
            ' (score: ' + bestScore.toFixed(0) + ')');
        log('   Confidence: ' + (aiMetrics.confidence * 100).toFixed(0) + '% | ' +
            'Volatility: ' + aiMetrics.volatility.toFixed(1) + ' | ' +
            'Cold: ' + (aiMetrics.coldStreak * 100).toFixed(0) + '%');
        strategySwitchCount++;
    }

    return bestStrategy;
}

/**
 * Reset martingale state
 */
function resetMartingale() {
    martingaleStep = 0;
    martingaleBaseBet = 0;
    martingaleTotalLoss = 0;
}

/**
 * Reset flat betting state
 */
function resetFlat() {
    flatBetConsecutiveLosses = 0;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FUNZIONI UTILITÀ (DA v5.1)
// ═══════════════════════════════════════════════════════════════════════════════

function getBaseBet() {
    const baseBet = Math.floor(userInfo.balance * config.baseBetPercent.value / 100 / 100) * 100;

    // AI multiplier
    const aiMult = aiGetBetMultiplier();

    return Math.floor(baseBet * aiMult / 100) * 100;
}

function getMode1Multiplier(step) {
    const base = step === 0 ? config.mode1Step1Mult.value : config.mode1Step2Mult.value;
    return aiGetAdjustedTarget(base);
}

var MODE1_MAX_STEPS = 2;

function getMode1Bet(step) {
    var baseBet = getBaseBet();

    if (step === 0) {
        return baseBet;
    }

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
    cycleLoss = 0;
    cycleStartBalance = userInfo.balance;
}

function checkPartialTakeProfit() {
    var currentProfit = userInfo.balance - startBalance;
    var currentProfitPercent = (currentProfit / startBalance) * 100;

    if (!partialTP1Reached && currentProfitPercent >= config.partialTP1Target.value) {
        partialTP1Reached = true;
        var lockAmount = Math.floor(currentProfit * config.partialTP1Lock.value / 100);
        lockedProfit += lockAmount;

        log('🔒 PARTIAL TP 1: +' + currentProfitPercent.toFixed(1) + '% (lock ' + (lockAmount/100).toFixed(0) + ' bits)');
    }

    if (config.partialTP2Target.value > 0 && !partialTP2Reached && currentProfitPercent >= config.partialTP2Target.value) {
        partialTP2Reached = true;
        var lockAmount2 = Math.floor(currentProfit * config.partialTP2Lock.value / 100);
        lockedProfit += lockAmount2;

        log('🔒 PARTIAL TP 2: +' + currentProfitPercent.toFixed(1) + '% (lock ' + (lockAmount2/100).toFixed(0) + ' bits)');
    }
}

function checkSessionStopLoss() {
    const adjustedSL = aiGetAdjustedStopLoss();

    if (adjustedSL === 0) return false;

    var effectiveBalance = userInfo.balance + lockedProfit;
    var drawdownPercent = ((effectiveBalance - startBalance) / startBalance) * 100;

    if (drawdownPercent <= -adjustedSL) {
        log('');
        log('🛑 SESSION STOP LOSS: ' + drawdownPercent.toFixed(1) + '% (limit: -' + adjustedSL + '%)');
        stop('SESSION STOP LOSS');
        return true;
    }

    return false;
}

function checkCycleLossLimit() {
    var maxLoss = userInfo.balance * config.cycleLossLimit.value / 100;
    if (cycleLoss >= maxLoss) {
        log('⚠️ CYCLE LOSS LIMIT');
        cycleResets++;
        resetCycle();
        return true;
    }
    return false;
}

function checkProtection(bust) {
    // Aggiungi alla storia
    crashHistory.push(bust);
    if (crashHistory.length > 50) {
        crashHistory.shift();
    }

    // Aggiorna AI metrics
    updateAIMetrics();

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

        var resumeByMult = bust >= config.resumeAt.value;
        var resumeByGames = config.resumeAfterGames.value > 0 && suspendedGames >= config.resumeAfterGames.value;

        if (resumeByMult || resumeByGames) {
            isSuspended = false;
            coldStreak = 0;
            suspendedGames = 0;
            log('✅ RIPRESO');
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GAME STARTING
// ═══════════════════════════════════════════════════════════════════════════════

engine.on('GAME_STARTING', function() {
    gameCount++;

    if (!warmupComplete && gameCount <= config.warmupGames.value) {
        return;
    }
    warmupComplete = true;

    // AI early take profit
    if (aiShouldTakeProfit()) {
        stop('AI EARLY TAKE PROFIT');
        return;
    }

    checkPartialTakeProfit();

    if (checkSessionStopLoss()) {
        return;
    }

    var effectiveBalance = userInfo.balance + lockedProfit;
    var profitPercent = ((effectiveBalance - startBalance) / startBalance) * 100;

    if (profitPercent >= config.takeProfit.value) {
        log('🎯 TAKE PROFIT: +' + profitPercent.toFixed(1) + '%');
        stop('TAKE PROFIT');
        return;
    }

    if (isSuspended) {
        return;
    }

    // AI skip bet
    if (aiShouldSkipBet()) {
        return;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // AI STRATEGY SELECTION
    // ═══════════════════════════════════════════════════════════════════════

    currentStrategy = aiSelectStrategy();

    // ═══════════════════════════════════════════════════════════════════════
    // STRATEGY EXECUTION
    // ═══════════════════════════════════════════════════════════════════════

    if (currentStrategy === STRATEGIES.HYBRID) {
        // ─────────────────────────────────────────────────────────────────
        // HYBRID PROGRESSIVE (v5.1 baseline)
        // ─────────────────────────────────────────────────────────────────
        if (currentMode === 1) {
            var mult = getMode1Multiplier(mode1Step);
            var bet = Math.floor(getMode1Bet(mode1Step) / 100) * 100;
            if (bet < 100) bet = 100;

            if (bet > userInfo.balance) {
                log('⚠️ Insufficient balance, switch Mode 2');
                currentMode = 2;
                mode2LossToRecover = mode1TotalLoss;
                mode2Bets = 0;
                resetMode1();
                return;
            }

            engine.bet(bet, mult);
        }
        else if (currentMode === 2) {
            var target = aiGetAdjustedTarget(config.mode2Target.value);
            var profitMult = target - 1;

            var requiredBet = Math.ceil((mode2LossToRecover + config.mode1MinProfit.value * 100) / profitMult / 100) * 100;
            requiredBet = Math.max(requiredBet, getBaseBet());

            var bet = Math.floor(requiredBet / 100) * 100;
            if (bet < 100) bet = 100;

            if (mode2Bets === 0) {
                log('📐 [HYBRID] Recovery: bet=' + (bet/100).toFixed(0) + ' @ ' + target.toFixed(2) + 'x');
            }

            if (bet > userInfo.balance) {
                log('⚠️ Recovery impossible');
                resetAll();
                return;
            }

            engine.bet(bet, target);
        }
    }
    else if (currentStrategy === STRATEGIES.MARTINGALE) {
        // ─────────────────────────────────────────────────────────────────
        // PURE MARTINGALE (double after loss)
        // ─────────────────────────────────────────────────────────────────
        var target = aiGetAdjustedTarget(config.aiMartingaleTarget.value);

        if (martingaleStep === 0) {
            // First bet or after win
            martingaleBaseBet = getBaseBet();
            var bet = martingaleBaseBet;
        } else {
            // Double after loss
            var bet = martingaleBaseBet * Math.pow(2, martingaleStep);
        }

        bet = Math.floor(bet / 100) * 100;
        if (bet < 100) bet = 100;

        // Safety check
        if (bet > userInfo.balance) {
            log('⚠️ [MARTINGALE] Insufficient balance, reset');
            resetMartingale();
            return;
        }

        if (martingaleStep >= config.aiMartingaleMaxSteps.value) {
            log('⚠️ [MARTINGALE] Max steps reached, reset');
            resetMartingale();
            return;
        }

        if (martingaleStep === 0) {
            log('💰 [MARTINGALE] Step ' + martingaleStep + ': bet=' + (bet/100) + ' @ ' + target.toFixed(2) + 'x');
        }

        engine.bet(bet, target);
    }
    else if (currentStrategy === STRATEGIES.FLAT) {
        // ─────────────────────────────────────────────────────────────────
        // CONSERVATIVE FLAT BETTING (constant bet size)
        // ─────────────────────────────────────────────────────────────────
        var baseBet = getBaseBet();
        var target = aiGetAdjustedTarget(config.aiFlatBetTarget.value);

        // Slightly reduce bet after consecutive losses (risk management)
        if (flatBetConsecutiveLosses >= 3) {
            baseBet = Math.floor(baseBet * 0.75);
        }

        var bet = Math.floor(baseBet / 100) * 100;
        if (bet < 100) bet = 100;

        if (bet > userInfo.balance) {
            log('⚠️ [FLAT] Insufficient balance');
            return;
        }

        if (flatBetConsecutiveLosses === 0 || flatBetConsecutiveLosses === 3) {
            log('📊 [FLAT] Bet=' + (bet/100) + ' @ ' + target.toFixed(2) + 'x (losses: ' + flatBetConsecutiveLosses + ')');
        }

        engine.bet(bet, target);
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// GAME ENDED
// ═══════════════════════════════════════════════════════════════════════════════

engine.on('GAME_ENDED', function(data) {
    var bust = data.bust;
    var last = engine.history.first();

    checkProtection(bust);

    if (!warmupComplete) return;
    if (!last || last.wager === 0) return;

    var wager = last.wager;
    var cashedAt = last.cashedAt;
    var profit = cashedAt > 0 ? Math.floor(wager * (cashedAt - 1)) : -wager;
    var isWin = cashedAt > 0;

    // ═══════════════════════════════════════════════════════════════════════
    // STRATEGY PERFORMANCE TRACKING
    // ═══════════════════════════════════════════════════════════════════════

    if (currentStrategy === STRATEGIES.HYBRID) {
        strategyPerformance.hybrid.gamesPlayed++;
        strategyPerformance.hybrid.totalProfit += profit;
        if (isWin) strategyPerformance.hybrid.wins++;
        else strategyPerformance.hybrid.losses++;
    } else if (currentStrategy === STRATEGIES.MARTINGALE) {
        strategyPerformance.martingale.gamesPlayed++;
        strategyPerformance.martingale.totalProfit += profit;
        if (isWin) strategyPerformance.martingale.wins++;
        else strategyPerformance.martingale.losses++;
    } else if (currentStrategy === STRATEGIES.FLAT) {
        strategyPerformance.flat.gamesPlayed++;
        strategyPerformance.flat.totalProfit += profit;
        if (isWin) strategyPerformance.flat.wins++;
        else strategyPerformance.flat.losses++;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // EDGE CASE: 1.01x exit
    // ═══════════════════════════════════════════════════════════════════════

    if (cashedAt > 0 && cashedAt <= 1.02) {
        log('🔄 Exit 1.01x');
        resetAll();
        resetMartingale();
        resetFlat();
        return;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // STRATEGY-SPECIFIC WIN/LOSS LOGIC
    // ═══════════════════════════════════════════════════════════════════════

    if (currentStrategy === STRATEGIES.HYBRID) {
        // ─────────────────────────────────────────────────────────────────
        // HYBRID PROGRESSIVE
        // ─────────────────────────────────────────────────────────────────
        if (currentMode === 1) {
            var targetMult = getMode1Multiplier(mode1Step);

            if (cashedAt >= targetMult) {
                var grossProfit = Math.floor(wager * (cashedAt - 1));
                var netProfit = grossProfit - mode1TotalLoss;

                log('✅ [HYBRID] WIN +' + (grossProfit/100).toFixed(0) + ' @ ' + cashedAt.toFixed(2) + 'x');
                resetMode1();
            } else {
                mode1TotalLoss += wager;
                cycleLoss += wager;

                log('❌ [HYBRID] LOSS -' + (wager/100).toFixed(0) + ' (tot: -' + (mode1TotalLoss/100).toFixed(0) + ')');

                if (checkCycleLossLimit()) {
                    return;
                }

                mode1Step++;

                if (mode1Step >= MODE1_MAX_STEPS) {
                    log('🔄 SWITCH → MODE 2');
                    currentMode = 2;
                    mode2LossToRecover = mode1TotalLoss;
                    mode2Bets = 0;
                    resetMode1();
                }
            }
        }
        else if (currentMode === 2) {
            mode2Bets++;

            var target = aiGetAdjustedTarget(config.mode2Target.value);

            if (cashedAt >= target) {
                log('🎉 [HYBRID] RECOVERY @ ' + cashedAt.toFixed(2) + 'x');
                resetAll();
            } else {
                mode2LossToRecover += wager;
                cycleLoss += wager;

                if (checkCycleLossLimit()) {
                    return;
                }

                if (mode2Bets >= config.mode2MaxBets.value) {
                    log('⚠️ Max recovery attempts');
                    resetCycle();
                }
            }
        }
    }
    else if (currentStrategy === STRATEGIES.MARTINGALE) {
        // ─────────────────────────────────────────────────────────────────
        // PURE MARTINGALE
        // ─────────────────────────────────────────────────────────────────
        var target = aiGetAdjustedTarget(config.aiMartingaleTarget.value);

        if (cashedAt >= target) {
            var grossProfit = Math.floor(wager * (cashedAt - 1));
            var netProfit = grossProfit - martingaleTotalLoss;

            log('✅ [MARTINGALE] WIN +' + (grossProfit/100).toFixed(0) + ' @ ' + cashedAt.toFixed(2) + 'x (net: +' + (netProfit/100).toFixed(0) + ')');
            resetMartingale();
        } else {
            martingaleTotalLoss += wager;
            martingaleStep++;

            log('❌ [MARTINGALE] LOSS -' + (wager/100).toFixed(0) + ' (step ' + martingaleStep + ', tot: -' + (martingaleTotalLoss/100).toFixed(0) + ')');

            if (martingaleStep >= config.aiMartingaleMaxSteps.value) {
                log('⚠️ [MARTINGALE] Max steps, reset');
                resetMartingale();
            }
        }
    }
    else if (currentStrategy === STRATEGIES.FLAT) {
        // ─────────────────────────────────────────────────────────────────
        // CONSERVATIVE FLAT
        // ─────────────────────────────────────────────────────────────────
        var target = aiGetAdjustedTarget(config.aiFlatBetTarget.value);

        if (cashedAt >= target) {
            var grossProfit = Math.floor(wager * (cashedAt - 1));

            log('✅ [FLAT] WIN +' + (grossProfit/100).toFixed(0) + ' @ ' + cashedAt.toFixed(2) + 'x');
            flatBetConsecutiveLosses = 0;
        } else {
            flatBetConsecutiveLosses++;

            log('❌ [FLAT] LOSS -' + (wager/100).toFixed(0) + ' (streak: ' + flatBetConsecutiveLosses + ')');

            // Reset streak after 5 consecutive losses
            if (flatBetConsecutiveLosses >= 5) {
                log('⚠️ [FLAT] 5 losses, reset streak');
                flatBetConsecutiveLosses = 0;
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // AI METRICS LOGGING
    // ═══════════════════════════════════════════════════════════════════════

    if (gameCount % 50 === 0 && config.aiEnabled.value === 'yes') {
        log('🤖 ADAPTIVE: strategy=' + currentStrategy + ' conf=' + (aiMetrics.confidence*100).toFixed(0) + '% vol=' + aiMetrics.volatility.toFixed(1) + ' cold=' + (aiMetrics.coldStreak*100).toFixed(0) + '%');

        if (config.aiStrategySwitch.value === 'yes') {
            log('   Switches: ' + strategySwitchCount + ' | H:' + strategyPerformance.hybrid.gamesPlayed + ' M:' + strategyPerformance.martingale.gamesPlayed + ' F:' + strategyPerformance.flat.gamesPlayed);
        }
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// LOG INIZIALE
// ═══════════════════════════════════════════════════════════════════════════════

log('');
log('╔═══════════════════════════════════════════════════════════════════════════╗');
log('║                    PAOLOBET HYBRID AI v2.0                                ║');
log('║      PATTERN-BASED ADAPTIVE + MULTI-STRATEGY AI DECISION ENGINE           ║');
log('╚═══════════════════════════════════════════════════════════════════════════╝');
log('');
log('🤖 AI DECISION ENGINE:');
log('   • Pattern Detection (ultimi ' + config.aiPatternWindow.value + ' crash)');
log('   • Dynamic Bet Size (0.5x-2x)');
log('   • Adaptive Targets (±15%)');
log('   • Auto Skip (low confidence)');
log('   • Early Take Profit');
log('   • Dynamic Stop Loss');
log('');
log('🎯 MULTI-STRATEGY AI:');
if (config.aiStrategySwitch.value === 'yes') {
    log('   ✅ ENABLED - AI seleziona automaticamente tra:');
    log('      1. HYBRID PROGRESSIVE (v5.1 baseline)');
    log('      2. PURE MARTINGALE (@' + config.aiMartingaleTarget.value + 'x, max ' + config.aiMartingaleMaxSteps.value + ' steps)');
    log('      3. CONSERVATIVE FLAT (@' + config.aiFlatBetTarget.value + 'x)');
} else {
    log('   ❌ DISABLED - Usa solo HYBRID PROGRESSIVE');
}
log('');
log('📊 BASELINE: v5.1 parameters');
log('   TP: +' + config.takeProfit.value + '% | SL: -' + config.sessionStopLoss.value + '%');
log('   Targets: ' + config.mode1Step1Mult.value + 'x/' + config.mode1Step2Mult.value + 'x');
log('');
log('🎮 AI Status: ' + config.aiEnabled.value.toUpperCase());
log('🔄 Strategy Switch: ' + config.aiStrategySwitch.value.toUpperCase());
log('');
