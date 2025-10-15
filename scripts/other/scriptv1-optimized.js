/**
 * SCRIPT V1 - OPTIMIZED VERSION
 *
 * Basato su scriptv1.js ma ottimizzato con i risultati dei test con seed REALI:
 *
 * MODIFICHE PRINCIPALI:
 * 1. Normal Mode: Payout ottimale 1.5x-1.8x (invece di random 1.11-1.99x)
 * 2. Recovery Mode: Payout più bassi (2x-5x invece di 8x-20x) per win rate migliore
 * 3. Emergency Mode: Progressione più controllata (x10 invece di x100/x1000)
 * 4. Stop Loss/Take Profit: Limiti per proteggere capitale
 *
 * RISULTATI ATTESI: Perdita < -1% invece di -5% o peggio
 */

var config = {
    baseBet: { value: 100, type: 'balance', label: 'Base Bet (bits * 100)', },

    // Normal Mode - OTTIMIZZATO per massimizzare win rate
    normalPayoutMin: { value: 1.5, type: 'multiplier', label: 'Normal Min Payout' },
    normalPayoutMax: { value: 1.8, type: 'multiplier', label: 'Normal Max Payout' },

    // Recovery Mode - OTTIMIZZATO per bilanciare win rate e recovery
    recoveryPayoutMin: { value: 2.0, type: 'multiplier', label: 'Recovery Min Payout' },
    recoveryPayoutMax: { value: 5.0, type: 'multiplier', label: 'Recovery Max Payout' },
    recoveryBetMultiplier: { value: 2, type: 'multiplier', label: 'Recovery Bet Multiplier' },
    recoveryRounds: { value: 10, type: 'multiplier', label: 'Recovery Rounds' },

    // Emergency Mode - OTTIMIZZATO per evitare disaster
    emergencyMode: {
        value: 'conservative',
        type: 'radio',
        label: 'Emergency Strategy',
        options: {
            conservative: { value: 'conservative', type: 'noop', label: 'x10 Bet / 1.5x Payout (Recommended)' },
            moderate: { value: 'moderate', type: 'noop', label: 'x20 Bet / 1.3x Payout' },
            aggressive: { value: 'aggressive', type: 'noop', label: 'x50 Bet / 1.2x Payout (Risky!)' },
        }
    },
    maxEmergencyRounds: { value: 3, type: 'multiplier', label: 'Max Emergency Rounds' },

    // Protection
    sessionGames: { value: 2000, type: 'multiplier', label: 'Session Max Games' },
    takeProfitPercent: { value: 10, type: 'multiplier', label: 'Take Profit %' },
    stopLossPercent: { value: 20, type: 'multiplier', label: 'Stop Loss %' },
};

// Extract config
const baseBet = config.baseBet.value;
const normalPayoutMin = config.normalPayoutMin.value;
const normalPayoutMax = config.normalPayoutMax.value;
const recoveryPayoutMin = config.recoveryPayoutMin.value;
const recoveryPayoutMax = config.recoveryPayoutMax.value;
const recoveryBetMultiplier = config.recoveryBetMultiplier.value;
const recoveryRounds = config.recoveryRounds.value;
const emergencyMode = config.emergencyMode.value;
const maxEmergencyRounds = config.maxEmergencyRounds.value;
const sessionGames = config.sessionGames.value;
const takeProfitPercent = config.takeProfitPercent.value;
const stopLossPercent = config.stopLossPercent.value;

// Emergency mode settings
const emergencySettings = {
    conservative: { betMult: 10, payout: 1.5 },
    moderate: { betMult: 20, payout: 1.3 },
    aggressive: { betMult: 50, payout: 1.2 }
};

// State
var currentMode = 'NORMAL';  // NORMAL, RECOVERY, EMERGENCY
var recoveryRoundsRemaining = 0;
var emergencyRoundsRemaining = 0;
var recoveryLoss = 0;
var emergencyLoss = 0;

var gamesPlayed = 0;
var initBalance = userInfo.balance;
var totalWins = 0;
var totalLosses = 0;
var recoverySuccesses = 0;
var recoveryFailures = 0;
var emergencySuccesses = 0;
var emergencyFailures = 0;

var startTime = new Date();

log('╔════════════════════════════════════════════════════════════╗');
log('║  SCRIPT V1 OPTIMIZED - STARTING                            ║');
log('╚════════════════════════════════════════════════════════════╝');
log('');
log('📋 Configuration:');
log(`   Base Bet: ${baseBet / 100} bits`);
log(`   Normal Payout: ${normalPayoutMin}x - ${normalPayoutMax}x`);
log(`   Recovery Payout: ${recoveryPayoutMin}x - ${recoveryPayoutMax}x`);
log(`   Emergency Mode: ${emergencyMode}`);
log(`   Session Limit: ${sessionGames} games`);
log(`   Take Profit: +${takeProfitPercent}%`);
log(`   Stop Loss: -${stopLossPercent}%`);
log('');
log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
log('');

engine.on('GAME_STARTING', onGameStarted);
engine.on('GAME_ENDED', onGameEnded);

function onGameStarted() {
    gamesPlayed++;

    // Check session limit
    if (gamesPlayed > sessionGames) {
        log('');
        log('⏸️  Session limit reached. Stopping...');
        showFinalStats();
        engine.stop();
        return;
    }

    // Check Take Profit / Stop Loss
    const currentBalance = userInfo.balance;
    const profitPercent = ((currentBalance - initBalance) / initBalance) * 100;

    if (profitPercent >= takeProfitPercent) {
        log('');
        log(`🎉 Take Profit reached! +${profitPercent.toFixed(2)}%`);
        showFinalStats();
        engine.stop();
        return;
    }

    if (profitPercent <= -stopLossPercent) {
        log('');
        log(`🛑 Stop Loss reached! ${profitPercent.toFixed(2)}%`);
        showFinalStats();
        engine.stop();
        return;
    }

    // Determine bet and payout based on mode
    let bet, payout;

    if (currentMode === 'EMERGENCY') {
        const settings = emergencySettings[emergencyMode];
        bet = baseBet * settings.betMult;
        payout = settings.payout;
        log(`🚨 [EMERGENCY ${emergencyRoundsRemaining}/${maxEmergencyRounds}] Bet: ${(bet / 100).toFixed(2)} @ ${payout}x`);
    } else if (currentMode === 'RECOVERY') {
        bet = baseBet * recoveryBetMultiplier;
        payout = getRandomFloat(recoveryPayoutMin, recoveryPayoutMax);
        log(`🔄 [RECOVERY ${recoveryRoundsRemaining}/${recoveryRounds}] Bet: ${(bet / 100).toFixed(2)} @ ${payout.toFixed(2)}x`);
    } else {
        // NORMAL
        bet = baseBet;
        payout = getRandomFloat(normalPayoutMin, normalPayoutMax);
        log(`🎯 [${gamesPlayed}] Bet: ${(bet / 100).toFixed(2)} @ ${payout.toFixed(2)}x`);
    }

    // Check balance
    if (userInfo.balance < bet) {
        log('');
        log('💔 Insufficient balance!');
        showFinalStats();
        engine.stop();
        return;
    }

    engine.bet(bet, payout);
}

function onGameEnded() {
    const lastGame = engine.history.first();

    if (!lastGame || !lastGame.wager) {
        return;
    }

    const won = lastGame.cashedAt ? true : false;
    const crash = lastGame.bust / 100;

    if (won) {
        const profit = Math.floor(lastGame.cashedAt * lastGame.wager) - lastGame.wager;
        totalWins++;
        log(`   ✅ WIN! +${(profit / 100).toFixed(2)} bits (crash: ${crash.toFixed(2)}x)`);

        // Handle mode transitions
        if (currentMode === 'EMERGENCY') {
            emergencyLoss -= profit;
            if (emergencyLoss <= 0) {
                log('   🎉 Emergency recovered!');
                currentMode = 'NORMAL';
                emergencyRoundsRemaining = 0;
                emergencyLoss = 0;
                emergencySuccesses++;
            } else {
                emergencyRoundsRemaining--;
                if (emergencyRoundsRemaining === 0) {
                    log('   💔 Emergency failed!');
                    currentMode = 'NORMAL';
                    emergencyLoss = 0;
                    emergencyFailures++;
                }
            }
        } else if (currentMode === 'RECOVERY') {
            recoveryLoss -= profit;
            if (recoveryLoss <= 0) {
                log('   🎉 Recovery successful!');
                currentMode = 'NORMAL';
                recoveryRoundsRemaining = 0;
                recoveryLoss = 0;
                recoverySuccesses++;
            } else {
                recoveryRoundsRemaining--;
                if (recoveryRoundsRemaining === 0) {
                    log('   ⚠️  Recovery failed, entering EMERGENCY mode...');
                    currentMode = 'EMERGENCY';
                    emergencyRoundsRemaining = maxEmergencyRounds;
                    emergencyLoss = recoveryLoss;
                    recoveryLoss = 0;
                    recoveryFailures++;
                }
            }
        }
    } else {
        const loss = lastGame.wager;
        totalLosses++;
        log(`   ❌ LOSS -${(loss / 100).toFixed(2)} bits (crash: ${crash.toFixed(2)}x)`);

        // Handle mode transitions
        if (currentMode === 'NORMAL') {
            log('   🔄 Entering RECOVERY mode...');
            currentMode = 'RECOVERY';
            recoveryRoundsRemaining = recoveryRounds;
            recoveryLoss = loss;
        } else if (currentMode === 'RECOVERY') {
            recoveryLoss += loss;
            recoveryRoundsRemaining--;
            if (recoveryRoundsRemaining === 0) {
                log('   ⚠️  Recovery failed, entering EMERGENCY mode...');
                currentMode = 'EMERGENCY';
                emergencyRoundsRemaining = maxEmergencyRounds;
                emergencyLoss = recoveryLoss;
                recoveryLoss = 0;
                recoveryFailures++;
            }
        } else if (currentMode === 'EMERGENCY') {
            emergencyLoss += loss;
            emergencyRoundsRemaining--;
            if (emergencyRoundsRemaining === 0) {
                log('   💔 Emergency failed! Resetting...');
                currentMode = 'NORMAL';
                emergencyLoss = 0;
                emergencyFailures++;
            }
        }
    }

    // Show stats every 100 games
    if (gamesPlayed % 100 === 0) {
        showStats();
    }
}

function getRandomFloat(min, max) {
    return parseFloat((Math.random() * (max - min) + min).toFixed(2));
}

function showStats() {
    const currentBalance = userInfo.balance;
    const profit = currentBalance - initBalance;
    const profitPercent = (profit / initBalance) * 100;
    const uptime = new Date() - startTime;
    const minutes = Math.floor(uptime / 60000);

    log('');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    log(`📊 Stats [Game ${gamesPlayed}]`);
    log(`   Balance: ${(currentBalance / 100).toFixed(2)} bits (${profitPercent >= 0 ? '+' : ''}${profitPercent.toFixed(2)}%)`);
    log(`   Wins/Losses: ${totalWins}/${totalLosses} (${((totalWins / (totalWins + totalLosses)) * 100).toFixed(1)}% win rate)`);
    log(`   Recovery: ${recoverySuccesses}/${recoverySuccesses + recoveryFailures} successful`);
    log(`   Emergency: ${emergencySuccesses}/${emergencySuccesses + emergencyFailures} successful`);
    log(`   Uptime: ${minutes} min`);
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    log('');
}

function showFinalStats() {
    const currentBalance = userInfo.balance;
    const profit = currentBalance - initBalance;
    const profitPercent = (profit / initBalance) * 100;
    const uptime = new Date() - startTime;
    const minutes = Math.floor(uptime / 60000);

    log('');
    log('╔════════════════════════════════════════════════════════════╗');
    log('║  FINAL STATS                                               ║');
    log('╚════════════════════════════════════════════════════════════╝');
    log('');
    log(`   Games Played: ${gamesPlayed}`);
    log(`   Uptime: ${minutes} minutes`);
    log('');
    log(`   Initial Balance: ${(initBalance / 100).toFixed(2)} bits`);
    log(`   Final Balance: ${(currentBalance / 100).toFixed(2)} bits`);
    log(`   Profit: ${(profit / 100).toFixed(2)} bits (${profitPercent >= 0 ? '+' : ''}${profitPercent.toFixed(2)}%)`);
    log('');
    log(`   Total Wins: ${totalWins}`);
    log(`   Total Losses: ${totalLosses}`);
    log(`   Win Rate: ${((totalWins / (totalWins + totalLosses)) * 100).toFixed(1)}%`);
    log('');
    log(`   Recovery Success: ${recoverySuccesses}/${recoverySuccesses + recoveryFailures} (${recoverySuccesses + recoveryFailures === 0 ? 'N/A' : ((recoverySuccesses / (recoverySuccesses + recoveryFailures)) * 100).toFixed(1)}%)`);
    log(`   Emergency Success: ${emergencySuccesses}/${emergencySuccesses + emergencyFailures} (${emergencySuccesses + emergencyFailures === 0 ? 'N/A' : ((emergencySuccesses / (emergencySuccesses + emergencyFailures)) * 100).toFixed(1)}%)`);
    log('');
    log('════════════════════════════════════════════════════════════');
}
