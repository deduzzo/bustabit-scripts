/**
 * SMART FLAT BET ALGORITHM
 *
 * Strategia anti-Martingale basata su analisi statistica dei seed REALI:
 * - Bet FISSO (no progressione)
 * - Payout ottimale (1.5x-1.8x) per massimizzare win rate
 * - Sessioni BREVI (1000-2000 games) per minimizzare house edge
 * - Stop Loss / Take Profit aggressivi
 * - Variance trading: capitalizza sui run positivi
 *
 * Obiettivo: Pareggiare o perdere MENO di -1% invece di -5% a -18%
 */

const { generateTestSeed } = require('./real-bustabit-seed-generator');

/**
 * Smart Flat Bet Algorithm
 */
function simulateSmartFlatBet(crashes, config, capital) {
    let balance = capital;
    const initBalance = balance;
    let maxDrawdown = 0;
    let consecutiveWins = 0;
    let consecutiveLosses = 0;
    let totalWins = 0;
    let totalLosses = 0;

    const {
        baseBet,
        payout,
        sessionGames,
        takeProfitPercent,  // Es. 5% = stop quando +5%
        stopLossPercent,    // Es. 10% = stop quando -10%
        adaptiveMode        // true = aumenta bet dopo win streak
    } = config;

    for (let i = 0; i < crashes.length && i < sessionGames; i++) {
        const crash = crashes[i];

        // Check Take Profit
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
                reason: 'take_profit'
            };
        }

        // Check Stop Loss
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
                reason: 'stop_loss'
            };
        }

        // Calculate bet (adaptive or flat)
        let currentBet = baseBet;

        if (adaptiveMode && consecutiveWins >= 3) {
            // Dopo 3 win consecutive, aumenta bet del 50%
            currentBet = Math.floor(baseBet * 1.5);
        }

        if (balance < currentBet) {
            return {
                success: false,
                finalBalance: balance,
                profit: balance - initBalance,
                profitPercent: ((balance - initBalance) / initBalance) * 100,
                maxDrawdown,
                gamesPlayed: i + 1,
                wins: totalWins,
                losses: totalLosses,
                reason: 'insufficient_balance'
            };
        }

        // Place bet
        if (crash >= payout) {
            // WIN
            const win = Math.floor(currentBet * payout) - currentBet;
            balance += win;
            totalWins++;
            consecutiveWins++;
            consecutiveLosses = 0;
        } else {
            // LOSS
            balance -= currentBet;
            totalLosses++;
            consecutiveLosses++;
            consecutiveWins = 0;

            const drawdown = ((initBalance - balance) / initBalance) * 100;
            if (drawdown > maxDrawdown) maxDrawdown = drawdown;
        }
    }

    return {
        success: balance > initBalance * 0.9, // Success se perde < 10%
        finalBalance: balance,
        profit: balance - initBalance,
        profitPercent: ((balance - initBalance) / initBalance) * 100,
        maxDrawdown,
        gamesPlayed: sessionGames,
        wins: totalWins,
        losses: totalLosses,
        reason: 'completed'
    };
}

/**
 * Test multiple configurations
 */
function testConfigurations(numSeeds, capital, sessionGames) {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║  SMART FLAT BET - TEST CON SEED REALI                     ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    console.log(`📋 Setup:`);
    console.log(`   Capital: ${(capital / 100).toLocaleString()} bits`);
    console.log(`   Session: ${sessionGames} games`);
    console.log(`   Seeds: ${numSeeds.toLocaleString()}\n`);

    const configs = [
        // Payout 1.5x (win rate ~64%)
        { name: 'Flat 1.5x Basic', baseBet: 100, payout: 1.5, sessionGames, takeProfitPercent: 5, stopLossPercent: 10, adaptiveMode: false },
        { name: 'Flat 1.5x Adaptive', baseBet: 100, payout: 1.5, sessionGames, takeProfitPercent: 5, stopLossPercent: 10, adaptiveMode: true },

        // Payout 1.7x (win rate ~55%)
        { name: 'Flat 1.7x Basic', baseBet: 100, payout: 1.7, sessionGames, takeProfitPercent: 5, stopLossPercent: 10, adaptiveMode: false },
        { name: 'Flat 1.7x Adaptive', baseBet: 100, payout: 1.7, sessionGames, takeProfitPercent: 5, stopLossPercent: 10, adaptiveMode: true },

        // Payout 2.0x (win rate ~47%)
        { name: 'Flat 2.0x Basic', baseBet: 100, payout: 2.0, sessionGames, takeProfitPercent: 5, stopLossPercent: 10, adaptiveMode: false },
        { name: 'Flat 2.0x Adaptive', baseBet: 100, payout: 2.0, sessionGames, takeProfitPercent: 5, stopLossPercent: 10, adaptiveMode: true },

        // Aggressive Stop Loss/Take Profit
        { name: 'Flat 1.7x Aggressive', baseBet: 100, payout: 1.7, sessionGames, takeProfitPercent: 3, stopLossPercent: 5, adaptiveMode: false },
        { name: 'Flat 2.0x Aggressive', baseBet: 100, payout: 2.0, sessionGames, takeProfitPercent: 3, stopLossPercent: 5, adaptiveMode: false },
    ];

    console.log('🔄 Testing configurations...\n');

    const results = [];
    const startTime = Date.now();

    configs.forEach((config, idx) => {
        const configResults = [];

        for (let i = 0; i < numSeeds; i++) {
            const crashes = generateTestSeed(sessionGames);
            const result = simulateSmartFlatBet(crashes, config, capital);
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
            payout: config.payout,
            successRate: (successes / numSeeds) * 100,
            positiveRate: (positives / numSeeds) * 100,
            avgProfit,
            sharpeRatio,
            avgDrawdown
        });

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`   ✅ ${config.name.padEnd(25)} | ${elapsed}s`);
    });

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n   Completed in ${totalTime}s\n`);

    // Sort by avg profit (closest to 0 or positive)
    results.sort((a, b) => b.avgProfit - a.avgProfit);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📊 RISULTATI:\n');
    console.log('Algorithm                 | Success | Positive | Profit  | Sharpe  | Drawdown');
    console.log('──────────────────────────┼─────────┼──────────┼─────────┼─────────┼──────────');

    results.forEach(r => {
        console.log(
            `${r.name.padEnd(25)} | ` +
            `${r.successRate.toFixed(2).padStart(6)}% | ` +
            `${r.positiveRate.toFixed(2).padStart(7)}% | ` +
            `${r.avgProfit.toFixed(2).padStart(6)}% | ` +
            `${r.sharpeRatio.toFixed(3).padStart(7)} | ` +
            `${r.avgDrawdown.toFixed(2).padStart(7)}%`
        );
    });

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const best = results[0];
    console.log('🏆 BEST STRATEGY:\n');
    console.log(`   ${best.name}`);
    console.log(`   Success Rate: ${best.successRate.toFixed(2)}%`);
    console.log(`   Positive Rate: ${best.positiveRate.toFixed(2)}%`);
    console.log(`   Avg Profit: ${best.avgProfit.toFixed(2)}%`);
    console.log(`   Sharpe Ratio: ${best.sharpeRatio.toFixed(3)}`);
    console.log(`   Avg Drawdown: ${best.avgDrawdown.toFixed(2)}%`);
    console.log('');

    if (best.avgProfit > -1) {
        console.log('   🎉 PERDE MENO DI -1%! Meglio di Martin e Fibonacci!\n');
    } else {
        console.log('   ⚠️  Perde ancora più di -1%, ma vediamo...\n');
    }

    // Compare with previous results
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📊 CONFRONTO CON ALTRI ALGORITMI:\n');
    console.log('   Algorithm                  | Avg Profit | Sharpe');
    console.log('   ───────────────────────────┼────────────┼─────────');
    console.log(`   Smart Flat Bet (BEST)      | ${best.avgProfit.toFixed(2).padStart(9)}% | ${best.sharpeRatio.toFixed(3).padStart(7)}`);
    console.log('   Martin M1.45-P3.2x         |     -5.53% |  -0.147');
    console.log('   Fibonacci 2.0x             |     -1.60% |  -0.242');
    console.log('   Fibonacci 2.5x             |    -18.74% |  -0.469');
    console.log('');

    // Save results
    const fs = require('fs');
    fs.writeFileSync(
        'smart-flat-bet-results.json',
        JSON.stringify({ results, best, totalTime, numSeeds, capital, sessionGames }, null, 2)
    );

    console.log('💾 Results saved to: smart-flat-bet-results.json\n');

    return results;
}

// Run test
const CAPITAL = 5000000;  // 50k bits (same as Martin)
const SESSION_GAMES = 2000;  // SHORTER sessions (less house edge time!)
const NUM_SEEDS = 5000;

testConfigurations(NUM_SEEDS, CAPITAL, SESSION_GAMES);
