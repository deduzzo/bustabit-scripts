/**
 * TEST SCRIPT V1 OPTIMIZED con seed REALI
 */

const { generateTestSeed } = require('./real-bustabit-seed-generator');

function simulateScriptV1Optimized(crashes, config, capital) {
    let balance = capital;
    const initBalance = balance;

    const {
        baseBet,
        normalPayoutMin,
        normalPayoutMax,
        recoveryPayoutMin,
        recoveryPayoutMax,
        recoveryBetMultiplier,
        recoveryRounds,
        emergencyMode,
        maxEmergencyRounds,
        sessionGames,
        takeProfitPercent,
        stopLossPercent
    } = config;

    const emergencySettings = {
        conservative: { betMult: 10, payout: 1.5 },
        moderate: { betMult: 20, payout: 1.3 },
        aggressive: { betMult: 50, payout: 1.2 }
    };

    let currentMode = 'NORMAL';
    let recoveryRoundsRemaining = 0;
    let emergencyRoundsRemaining = 0;
    let recoveryLoss = 0;
    let emergencyLoss = 0;
    let maxDrawdown = 0;
    let totalWins = 0;
    let totalLosses = 0;
    let recoverySuccesses = 0;
    let recoveryFailures = 0;

    for (let i = 0; i < crashes.length && i < sessionGames; i++) {
        const crash = crashes[i];

        // Check Take Profit / Stop Loss
        const profitPercent = ((balance - initBalance) / initBalance) * 100;

        if (profitPercent >= takeProfitPercent) {
            return {
                success: true,
                finalBalance: balance,
                profit: balance - initBalance,
                profitPercent,
                maxDrawdown,
                gamesPlayed: i + 1,
                wins: totalWins,
                losses: totalLosses,
                recoverySuccesses,
                recoveryFailures,
                reason: 'take_profit'
            };
        }

        if (profitPercent <= -stopLossPercent) {
            return {
                success: false,
                finalBalance: balance,
                profit: balance - initBalance,
                profitPercent,
                maxDrawdown,
                gamesPlayed: i + 1,
                wins: totalWins,
                losses: totalLosses,
                recoverySuccesses,
                recoveryFailures,
                reason: 'stop_loss'
            };
        }

        // Determine bet and payout
        let bet, payout;

        if (currentMode === 'EMERGENCY') {
            const settings = emergencySettings[emergencyMode];
            bet = baseBet * settings.betMult;
            payout = settings.payout;
        } else if (currentMode === 'RECOVERY') {
            bet = baseBet * recoveryBetMultiplier;
            payout = recoveryPayoutMin + Math.random() * (recoveryPayoutMax - recoveryPayoutMin);
        } else {
            bet = baseBet;
            payout = normalPayoutMin + Math.random() * (normalPayoutMax - normalPayoutMin);
        }

        if (balance < bet) {
            return {
                success: false,
                finalBalance: balance,
                profit: balance - initBalance,
                profitPercent: ((balance - initBalance) / initBalance) * 100,
                maxDrawdown,
                gamesPlayed: i + 1,
                wins: totalWins,
                losses: totalLosses,
                recoverySuccesses,
                recoveryFailures,
                reason: 'insufficient_balance'
            };
        }

        // Place bet
        if (crash >= payout) {
            // WIN
            const profit = Math.floor(bet * payout) - bet;
            balance += profit;
            totalWins++;

            if (currentMode === 'EMERGENCY') {
                emergencyLoss -= profit;
                if (emergencyLoss <= 0) {
                    currentMode = 'NORMAL';
                    emergencyRoundsRemaining = 0;
                    emergencyLoss = 0;
                } else {
                    emergencyRoundsRemaining--;
                    if (emergencyRoundsRemaining === 0) {
                        currentMode = 'NORMAL';
                        emergencyLoss = 0;
                    }
                }
            } else if (currentMode === 'RECOVERY') {
                recoveryLoss -= profit;
                if (recoveryLoss <= 0) {
                    currentMode = 'NORMAL';
                    recoveryRoundsRemaining = 0;
                    recoveryLoss = 0;
                    recoverySuccesses++;
                } else {
                    recoveryRoundsRemaining--;
                    if (recoveryRoundsRemaining === 0) {
                        currentMode = 'EMERGENCY';
                        emergencyRoundsRemaining = maxEmergencyRounds;
                        emergencyLoss = recoveryLoss;
                        recoveryLoss = 0;
                        recoveryFailures++;
                    }
                }
            }
        } else {
            // LOSS
            balance -= bet;
            totalLosses++;

            const drawdown = ((initBalance - balance) / initBalance) * 100;
            if (drawdown > maxDrawdown) maxDrawdown = drawdown;

            if (currentMode === 'NORMAL') {
                currentMode = 'RECOVERY';
                recoveryRoundsRemaining = recoveryRounds;
                recoveryLoss = bet;
            } else if (currentMode === 'RECOVERY') {
                recoveryLoss += bet;
                recoveryRoundsRemaining--;
                if (recoveryRoundsRemaining === 0) {
                    currentMode = 'EMERGENCY';
                    emergencyRoundsRemaining = maxEmergencyRounds;
                    emergencyLoss = recoveryLoss;
                    recoveryLoss = 0;
                    recoveryFailures++;
                }
            } else if (currentMode === 'EMERGENCY') {
                emergencyLoss += bet;
                emergencyRoundsRemaining--;
                if (emergencyRoundsRemaining === 0) {
                    currentMode = 'NORMAL';
                    emergencyLoss = 0;
                }
            }
        }
    }

    return {
        success: balance > initBalance * 0.8,
        finalBalance: balance,
        profit: balance - initBalance,
        profitPercent: ((balance - initBalance) / initBalance) * 100,
        maxDrawdown,
        gamesPlayed: sessionGames,
        wins: totalWins,
        losses: totalLosses,
        recoverySuccesses,
        recoveryFailures,
        reason: 'completed'
    };
}

function testConfigurations(numSeeds, capital) {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║  SCRIPT V1 OPTIMIZED - TEST CON SEED REALI                ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    console.log(`📋 Setup:`);
    console.log(`   Capital: ${(capital / 100).toLocaleString()} bits`);
    console.log(`   Seeds: ${numSeeds.toLocaleString()}\n`);

    const configs = [
        {
            name: 'Conservative (Recommended)',
            baseBet: 100,
            normalPayoutMin: 1.5,
            normalPayoutMax: 1.8,
            recoveryPayoutMin: 2.0,
            recoveryPayoutMax: 4.0,
            recoveryBetMultiplier: 2,
            recoveryRounds: 10,
            emergencyMode: 'conservative',
            maxEmergencyRounds: 3,
            sessionGames: 2000,
            takeProfitPercent: 10,
            stopLossPercent: 20
        },
        {
            name: 'Moderate',
            baseBet: 100,
            normalPayoutMin: 1.6,
            normalPayoutMax: 2.0,
            recoveryPayoutMin: 3.0,
            recoveryPayoutMax: 5.0,
            recoveryBetMultiplier: 3,
            recoveryRounds: 8,
            emergencyMode: 'moderate',
            maxEmergencyRounds: 2,
            sessionGames: 2000,
            takeProfitPercent: 12,
            stopLossPercent: 18
        }
    ];

    console.log('🔄 Testing configurations...\n');

    const results = [];
    const startTime = Date.now();

    configs.forEach((config) => {
        const configResults = [];

        for (let i = 0; i < numSeeds; i++) {
            const crashes = generateTestSeed(config.sessionGames);
            const result = simulateScriptV1Optimized(crashes, config, capital);
            configResults.push(result);
        }

        const successes = configResults.filter(r => r.success).length;
        const positives = configResults.filter(r => r.profit > 0).length;
        const profits = configResults.map(r => r.profitPercent);
        const drawdowns = configResults.map(r => r.maxDrawdown);

        const avgProfit = profits.reduce((a, b) => a + b, 0) / profits.length;
        const avgDrawdown = drawdowns.reduce((a, b) => a + b, 0) / drawdowns.length;

        const stdDev = Math.sqrt(profits.reduce((sum, val) => sum + Math.pow(val - avgProfit, 2), 0) / profits.length);
        const sharpeRatio = stdDev === 0 ? 0 : avgProfit / stdDev;

        results.push({
            name: config.name,
            successRate: (successes / numSeeds) * 100,
            positiveRate: (positives / numSeeds) * 100,
            avgProfit,
            sharpeRatio,
            avgDrawdown
        });

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`   ✅ ${config.name.padEnd(30)} | ${elapsed}s`);
    });

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n   Completed in ${totalTime}s\n`);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📊 RISULTATI:\n');
    console.log('Configuration                  | Success | Positive | Profit  | Sharpe  | Drawdown');
    console.log('───────────────────────────────┼─────────┼──────────┼─────────┼─────────┼──────────');

    results.forEach(r => {
        console.log(
            `${r.name.padEnd(30)} | ` +
            `${r.successRate.toFixed(2).padStart(6)}% | ` +
            `${r.positiveRate.toFixed(2).padStart(7)}% | ` +
            `${r.avgProfit.toFixed(2).padStart(6)}% | ` +
            `${r.sharpeRatio.toFixed(3).padStart(7)} | ` +
            `${r.avgDrawdown.toFixed(2).padStart(7)}%`
        );
    });

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const best = results.sort((a, b) => b.avgProfit - a.avgProfit)[0];

    console.log('🏆 BEST CONFIGURATION:\n');
    console.log(`   ${best.name}`);
    console.log(`   Success Rate: ${best.successRate.toFixed(2)}%`);
    console.log(`   Positive Rate: ${best.positiveRate.toFixed(2)}%`);
    console.log(`   Avg Profit: ${best.avgProfit.toFixed(2)}%`);
    console.log(`   Sharpe Ratio: ${best.sharpeRatio.toFixed(3)}`);
    console.log('');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📊 CONFRONTO CON ALTRI ALGORITMI:\n');
    console.log(`   Script V1 Optimized:       ${best.avgProfit.toFixed(2)}%`);
    console.log(`   Smart Flat Bet 1.7x:      -0.16%`);
    console.log(`   Pure 50x:                 -0.16%`);
    console.log(`   Martin M1.45-P3.2x:       -5.53%`);
    console.log(`   Fibonacci 2.0x:           -1.60%`);
    console.log('');

    if (best.avgProfit > -0.16) {
        console.log('   🎉 BATTE TUTTI GLI ALTRI ALGORITMI!\n');
    } else if (best.avgProfit >= -0.5) {
        console.log('   ✅ Competitivo con i migliori!\n');
    } else {
        console.log('   ⚠️  Non batte i flat bet, ma recovery mode interessante!\n');
    }

    const fs = require('fs');
    fs.writeFileSync(
        'scriptv1-optimized-results.json',
        JSON.stringify({ results, best, totalTime, numSeeds }, null, 2)
    );

    console.log('💾 Results saved to: scriptv1-optimized-results.json\n');
}

const CAPITAL = 5000000;  // 50k bits
const NUM_SEEDS = 5000;

testConfigurations(NUM_SEEDS, CAPITAL);
