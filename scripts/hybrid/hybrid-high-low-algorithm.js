/**
 * HYBRID HIGH-LOW ALGORITHM
 *
 * Strategia ibrida che combina:
 * 1. LOW PAYOUT (1.5x-2.0x): Bet principale per mantenere balance
 * 2. HIGH PAYOUT (10x-100x): Bet secondaria per capitalizzare su big wins
 *
 * Idea: Usa flat bet su low payout per "sopravvivere" e accumula,
 * poi ogni N rounds piazza una "lottery bet" su high payout.
 *
 * Se vinci il jackpot, compensa TUTTE le perdite precedenti!
 */

const { generateTestSeed } = require('./real-bustabit-seed-generator');

/**
 * Hybrid High-Low Strategy
 */
function simulateHybridHighLow(crashes, config, capital) {
    let balance = capital;
    const initBalance = balance;
    let maxDrawdown = 0;
    let totalWins = 0;
    let totalLosses = 0;
    let jackpotsWon = 0;

    const {
        mainBet,           // Bet principale (es. 100 bits)
        mainPayout,        // Payout principale (es. 1.7x)
        jackpotBet,        // Bet jackpot (es. 50-200 bits)
        jackpotPayout,     // Payout jackpot (es. 10x, 50x, 100x)
        jackpotFrequency,  // Ogni N rounds (es. 10, 20, 50)
        sessionGames,
        takeProfitPercent,
        stopLossPercent
    } = config;

    for (let i = 0; i < crashes.length && i < sessionGames; i++) {
        const crash = crashes[i];
        const roundNum = i + 1;

        // Check Take Profit / Stop Loss
        const profitPercent = ((balance - initBalance) / initBalance) * 100;

        if (profitPercent >= takeProfitPercent) {
            return {
                success: true,
                finalBalance: balance,
                profit: balance - initBalance,
                profitPercent,
                maxDrawdown,
                gamesPlayed: roundNum,
                wins: totalWins,
                losses: totalLosses,
                jackpotsWon,
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
                gamesPlayed: roundNum,
                wins: totalWins,
                losses: totalLosses,
                jackpotsWon,
                reason: 'stop_loss'
            };
        }

        // Decide bet type
        const isJackpotRound = (roundNum % jackpotFrequency === 0);
        const currentBet = isJackpotRound ? jackpotBet : mainBet;
        const currentPayout = isJackpotRound ? jackpotPayout : mainPayout;

        if (balance < currentBet) {
            return {
                success: false,
                finalBalance: balance,
                profit: balance - initBalance,
                profitPercent: ((balance - initBalance) / initBalance) * 100,
                maxDrawdown,
                gamesPlayed: roundNum,
                wins: totalWins,
                losses: totalLosses,
                jackpotsWon,
                reason: 'insufficient_balance'
            };
        }

        // Place bet
        if (crash >= currentPayout) {
            // WIN
            const win = Math.floor(currentBet * currentPayout) - currentBet;
            balance += win;
            totalWins++;

            if (isJackpotRound) {
                jackpotsWon++;
            }
        } else {
            // LOSS
            balance -= currentBet;
            totalLosses++;

            const drawdown = ((initBalance - balance) / initBalance) * 100;
            if (drawdown > maxDrawdown) maxDrawdown = drawdown;
        }
    }

    return {
        success: balance > initBalance * 0.9,
        finalBalance: balance,
        profit: balance - initBalance,
        profitPercent: ((balance - initBalance) / initBalance) * 100,
        maxDrawdown,
        gamesPlayed: sessionGames,
        wins: totalWins,
        losses: totalLosses,
        jackpotsWon,
        reason: 'completed'
    };
}

/**
 * Pure High Payout Strategy (no hybrid)
 */
function simulatePureHighPayout(crashes, config, capital) {
    let balance = capital;
    const initBalance = balance;
    let maxDrawdown = 0;
    let totalWins = 0;
    let totalLosses = 0;

    const {
        bet,
        payout,
        sessionGames,
        takeProfitPercent,
        stopLossPercent
    } = config;

    for (let i = 0; i < crashes.length && i < sessionGames; i++) {
        const crash = crashes[i];

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

        if (profitPercent <= -stopLossPercent || balance < bet) {
            return {
                success: false,
                finalBalance: balance,
                profit: balance - initBalance,
                profitPercent: ((balance - initBalance) / initBalance) * 100,
                maxDrawdown,
                gamesPlayed: i + 1,
                wins: totalWins,
                losses: totalLosses,
                reason: balance < bet ? 'insufficient_balance' : 'stop_loss'
            };
        }

        if (crash >= payout) {
            const win = Math.floor(bet * payout) - bet;
            balance += win;
            totalWins++;
        } else {
            balance -= bet;
            totalLosses++;

            const drawdown = ((initBalance - balance) / initBalance) * 100;
            if (drawdown > maxDrawdown) maxDrawdown = drawdown;
        }
    }

    return {
        success: balance > initBalance * 0.5,
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
 * Test configurations
 */
function testConfigurations(numSeeds, capital, sessionGames) {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║  HYBRID HIGH-LOW ALGORITHM - SEED REALI                    ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    console.log(`📋 Setup:`);
    console.log(`   Capital: ${(capital / 100).toLocaleString()} bits`);
    console.log(`   Session: ${sessionGames} games`);
    console.log(`   Seeds: ${numSeeds.toLocaleString()}\n`);

    const configs = [
        // Pure High Payout strategies
        {
            name: 'Pure 10x',
            type: 'pure',
            bet: 100,
            payout: 10,
            sessionGames,
            takeProfitPercent: 20,
            stopLossPercent: 20
        },
        {
            name: 'Pure 20x',
            type: 'pure',
            bet: 100,
            payout: 20,
            sessionGames,
            takeProfitPercent: 30,
            stopLossPercent: 30
        },
        {
            name: 'Pure 50x',
            type: 'pure',
            bet: 100,
            payout: 50,
            sessionGames,
            takeProfitPercent: 50,
            stopLossPercent: 50
        },

        // Hybrid strategies (low payout main + high payout jackpot)
        {
            name: 'Hybrid 1.7x + 10x (every 10)',
            type: 'hybrid',
            mainBet: 100,
            mainPayout: 1.7,
            jackpotBet: 200,
            jackpotPayout: 10,
            jackpotFrequency: 10,
            sessionGames,
            takeProfitPercent: 10,
            stopLossPercent: 15
        },
        {
            name: 'Hybrid 1.7x + 20x (every 20)',
            type: 'hybrid',
            mainBet: 100,
            mainPayout: 1.7,
            jackpotBet: 300,
            jackpotPayout: 20,
            jackpotFrequency: 20,
            sessionGames,
            takeProfitPercent: 15,
            stopLossPercent: 20
        },
        {
            name: 'Hybrid 1.7x + 50x (every 50)',
            type: 'hybrid',
            mainBet: 100,
            mainPayout: 1.7,
            jackpotBet: 500,
            jackpotPayout: 50,
            jackpotFrequency: 50,
            sessionGames,
            takeProfitPercent: 30,
            stopLossPercent: 30
        },
        {
            name: 'Hybrid 2.0x + 10x (every 10)',
            type: 'hybrid',
            mainBet: 100,
            mainPayout: 2.0,
            jackpotBet: 200,
            jackpotPayout: 10,
            jackpotFrequency: 10,
            sessionGames,
            takeProfitPercent: 10,
            stopLossPercent: 15
        }
    ];

    console.log('🔄 Testing configurations...\n');

    const results = [];
    const startTime = Date.now();

    configs.forEach((config, idx) => {
        const configResults = [];

        for (let i = 0; i < numSeeds; i++) {
            const crashes = generateTestSeed(sessionGames);

            let result;
            if (config.type === 'pure') {
                result = simulatePureHighPayout(crashes, config, capital);
            } else {
                result = simulateHybridHighLow(crashes, config, capital);
            }

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
            type: config.type,
            successRate: (successes / numSeeds) * 100,
            positiveRate: (positives / numSeeds) * 100,
            avgProfit,
            sharpeRatio,
            avgDrawdown
        });

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`   ✅ ${config.name.padEnd(35)} | ${elapsed}s`);
    });

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n   Completed in ${totalTime}s\n`);

    results.sort((a, b) => b.avgProfit - a.avgProfit);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📊 RISULTATI:\n');
    console.log('Algorithm                           | Success | Positive | Profit  | Sharpe  | Drawdown');
    console.log('────────────────────────────────────┼─────────┼──────────┼─────────┼─────────┼──────────');

    results.forEach(r => {
        console.log(
            `${r.name.padEnd(35)} | ` +
            `${r.successRate.toFixed(2).padStart(6)}% | ` +
            `${r.positiveRate.toFixed(2).padStart(7)}% | ` +
            `${r.avgProfit.toFixed(2).padStart(6)}% | ` +
            `${r.sharpeRatio.toFixed(3).padStart(7)} | ` +
            `${r.avgDrawdown.toFixed(2).padStart(7)}%`
        );
    });

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const best = results[0];
    console.log('🏆 BEST HIGH PAYOUT STRATEGY:\n');
    console.log(`   ${best.name}`);
    console.log(`   Type: ${best.type}`);
    console.log(`   Success Rate: ${best.successRate.toFixed(2)}%`);
    console.log(`   Positive Rate: ${best.positiveRate.toFixed(2)}%`);
    console.log(`   Avg Profit: ${best.avgProfit.toFixed(2)}%`);
    console.log(`   Sharpe Ratio: ${best.sharpeRatio.toFixed(3)}`);
    console.log('');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📊 CONFRONTO CON FLAT BET 1.7x:\n');
    console.log(`   Smart Flat Bet 1.7x:    -0.16%`);
    console.log(`   ${best.name.padEnd(23)}: ${best.avgProfit.toFixed(2)}%`);
    console.log('');

    if (best.avgProfit > -0.16) {
        console.log('   🎉 BATTE FLAT BET!\n');
    } else {
        console.log('   ⚠️  Non batte Flat Bet... ma interessante comunque!\n');
    }

    const fs = require('fs');
    fs.writeFileSync(
        'hybrid-high-low-results.json',
        JSON.stringify({ results, best, totalTime, numSeeds }, null, 2)
    );

    console.log('💾 Results saved to: hybrid-high-low-results.json\n');

    return results;
}

// Run test
const CAPITAL = 5000000;  // 50k bits
const SESSION_GAMES = 2000;
const NUM_SEEDS = 5000;

testConfigurations(NUM_SEEDS, CAPITAL, SESSION_GAMES);
