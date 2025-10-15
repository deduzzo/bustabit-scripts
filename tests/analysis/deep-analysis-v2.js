/**
 * DEEP ANALYSIS V2 - Analisi Migliorata con focus su configurazioni robuste
 *
 * 100 seed da 200.000 partite ciascuno
 * Focus: trovare configurazione con minor capitale + massimo profitto
 */

// ==================== SEED GENERATION ====================
function generateSeed(n) {
    let values = [];
    for (let index = 0; index < n; index++) {
        values.push(Math.floor(Math.max(0.99 / (1 - Math.random()), 1) * 100) / 100);
    }
    return values;
}

// ==================== FIBONACCI ALGORITHM ====================

function testFibonacci(seed, startBalance, config) {
    const baseBet = config.baseBet;
    const payout = config.payout;
    const maxT = config.maxT;

    let balance = startBalance;
    const initialBalance = startBalance;
    let currentBet = baseBet;
    let precBet = 0;
    let k = 0;
    let totalWins = 0;
    let totalLosses = 0;
    let maxBalance = startBalance;
    let minBalance = startBalance;
    let ruined = false;
    let ruinedAtGame = -1;

    for (let i = 0; i < seed.length; i++) {
        const bust = seed[i];

        // Check ruin conditions
        if (k > maxT) {
            ruined = true;
            ruinedAtGame = i;
            break;
        }

        // Calculate Fibonacci bet
        if (k === 0) {
            currentBet = baseBet;
            precBet = 0;
        } else if (k === 1) {
            precBet = currentBet;
            currentBet = currentBet * 2;
        } else {
            let precBetTemp = currentBet;
            currentBet = currentBet + precBet;
            precBet = precBetTemp;
        }

        // Check if can afford bet
        if (currentBet > balance) {
            ruined = true;
            ruinedAtGame = i;
            break;
        }

        // Execute bet
        if (bust >= payout) {
            // Win
            const profit = (currentBet * payout) - currentBet;
            balance += profit;
            totalWins++;
            k = 0;
            currentBet = baseBet;
            precBet = 0;
        } else {
            // Loss
            balance -= currentBet;
            totalLosses++;
            k++;
        }

        // Track extremes
        if (balance > maxBalance) maxBalance = balance;
        if (balance < minBalance) minBalance = balance;

        if (balance <= 0) {
            ruined = true;
            ruinedAtGame = i;
            break;
        }
    }

    return {
        startBalance,
        finalBalance: balance,
        profit: balance - initialBalance,
        profitPercent: ((balance - initialBalance) / initialBalance) * 100,
        maxBalance,
        minBalance,
        maxDrawdown: initialBalance - minBalance,
        maxDrawdownPercent: ((initialBalance - minBalance) / initialBalance) * 100,
        totalWins,
        totalLosses,
        totalGames: totalWins + totalLosses,
        winRate: totalWins / (totalWins + totalLosses) * 100,
        ruined,
        ruinedAtGame,
        survivedGames: ruined ? ruinedAtGame : seed.length
    };
}

// ==================== MAIN ANALYSIS ====================

function runAnalysis() {
    console.log('========================================');
    console.log('DEEP ANALYSIS V2');
    console.log('100 Seeds × 200,000 Games');
    console.log('========================================\n');

    const NUM_SEEDS = 100;
    const GAMES_PER_SEED = 200000;

    // Capital levels to test (in bits)
    const capitalLevels = [
        50000,     // 500 bits
        100000,    // 1,000 bits
        250000,    // 2,500 bits
        500000,    // 5,000 bits
        1000000,   // 10,000 bits
        2500000,   // 25,000 bits
        5000000,   // 50,000 bits
        10000000,  // 100,000 bits
    ];

    // Fibonacci configurations
    const fibConfigs = [
        { baseBet: 100, payout: 2.0, maxT: 18, name: '2.0x-T18' },
        { baseBet: 100, payout: 2.5, maxT: 20, name: '2.5x-T20' },
        { baseBet: 100, payout: 3.0, maxT: 20, name: '3.0x-T20' },
        { baseBet: 100, payout: 3.0, maxT: 22, name: '3.0x-T22' },
        { baseBet: 100, payout: 3.5, maxT: 22, name: '3.5x-T22' },
        { baseBet: 100, payout: 4.0, maxT: 24, name: '4.0x-T24' },
        { baseBet: 100, payout: 4.0, maxT: 26, name: '4.0x-T26' },
    ];

    // Generate seeds
    console.log('Generating 100 seeds of 200,000 games each...');
    const seeds = [];
    for (let s = 0; s < NUM_SEEDS; s++) {
        seeds.push(generateSeed(GAMES_PER_SEED));
        if ((s + 1) % 20 === 0) {
            console.log(`  ${s + 1}/100 seeds generated`);
        }
    }
    console.log('✓ All seeds generated\n');

    const allResults = [];
    let testNum = 0;
    const totalTests = fibConfigs.length * capitalLevels.length * NUM_SEEDS;

    console.log(`Running ${totalTests.toLocaleString()} tests...\n`);

    // Run tests
    fibConfigs.forEach((config, cfgIdx) => {
        capitalLevels.forEach((capital, capIdx) => {
            const results = [];

            seeds.forEach((seed, seedIdx) => {
                const result = testFibonacci(seed, capital, config);
                results.push(result);
                testNum++;

                if (testNum % 5000 === 0) {
                    console.log(`Progress: ${testNum.toLocaleString()}/${totalTests.toLocaleString()} (${(testNum / totalTests * 100).toFixed(1)}%)`);
                }
            });

            // Calculate statistics
            const successful = results.filter(r => !r.ruined);
            const successRate = (successful.length / results.length) * 100;

            if (successful.length > 0) {
                const profits = successful.map(r => r.profit);
                const profitPercents = successful.map(r => r.profitPercent);
                const drawdowns = successful.map(r => r.maxDrawdownPercent);

                profits.sort((a, b) => a - b);

                const avgProfit = profits.reduce((a, b) => a + b, 0) / profits.length;
                const medianProfit = profits[Math.floor(profits.length / 2)];
                const minProfit = profits[0];
                const maxProfit = profits[profits.length - 1];

                const avgProfitPercent = profitPercents.reduce((a, b) => a + b, 0) / profitPercents.length;
                const avgDrawdown = drawdowns.reduce((a, b) => a + b, 0) / drawdowns.length;
                const maxDrawdown = Math.max(...drawdowns);

                // Calculate profit variance/stddev
                const profitVariance = profits.reduce((sum, p) => sum + Math.pow(p - avgProfit, 2), 0) / profits.length;
                const profitStdDev = Math.sqrt(profitVariance);

                // ROI and risk metrics
                const roiEfficiency = avgProfit / capital;
                const sharpeRatio = avgProfit / (profitStdDev || 1);

                // Score: Balance between low capital, high ROI, low risk
                const score = (roiEfficiency * 1000) + (successRate / 100) - (avgDrawdown / 100) - (capital / 1000000);

                allResults.push({
                    config: config.name,
                    payout: config.payout,
                    maxT: config.maxT,
                    capital,
                    capitalBits: capital / 100,
                    successRate,
                    avgProfit,
                    medianProfit,
                    minProfit,
                    maxProfit,
                    avgProfitPercent,
                    avgDrawdown,
                    maxDrawdown,
                    profitStdDev,
                    roiEfficiency,
                    sharpeRatio,
                    score,
                    numSuccessful: successful.length,
                    numFailed: results.length - successful.length
                });
            }
        });
    });

    console.log('\n✓ All tests completed!\n');
    return allResults;
}

// ==================== RESULTS ANALYSIS ====================

function analyzeResults(results) {
    console.log('\n========================================');
    console.log('RESULTS ANALYSIS');
    console.log('========================================\n');

    // Filter configurations with good success rate
    const goodResults = results.filter(r => r.successRate >= 90);

    console.log(`Configurations with ≥90% success rate: ${goodResults.length}/${results.length}\n`);

    if (goodResults.length === 0) {
        console.log('⚠️ No configurations achieved 90%+ success rate');
        console.log('Showing best available results:\n');

        const bestAvailable = results
            .filter(r => r.successRate > 0)
            .sort((a, b) => b.successRate - a.successRate)
            .slice(0, 10);

        bestAvailable.forEach((r, idx) => {
            console.log(`${idx + 1}. Config: ${r.config} | Capital: ${r.capitalBits.toLocaleString()} bits`);
            console.log(`   Success: ${r.successRate.toFixed(1)}% | Avg Profit: ${(r.avgProfit / 100).toFixed(0)} bits (${r.avgProfitPercent.toFixed(1)}%)`);
            console.log('');
        });
        return;
    }

    // 1. BEST BY LOWEST CAPITAL (with good returns)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🏆 TOP 10: LOWEST CAPITAL REQUIREMENT');
    console.log('(≥90% success, ≥50% profit)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const lowCapital = goodResults
        .filter(r => r.avgProfitPercent >= 50)
        .sort((a, b) => a.capital - b.capital)
        .slice(0, 10);

    if (lowCapital.length > 0) {
        lowCapital.forEach((r, idx) => {
            console.log(`${idx + 1}. Config: ${r.config} | Payout: ${r.payout}x`);
            console.log(`   💰 Capital: ${r.capitalBits.toLocaleString()} bits ⭐`);
            console.log(`   Success: ${r.successRate.toFixed(1)}% (${r.numSuccessful}/100 seeds)`);
            console.log(`   Avg Profit: ${(r.avgProfit / 100).toFixed(0)} bits (${r.avgProfitPercent.toFixed(1)}%)`);
            console.log(`   Median: ${(r.medianProfit / 100).toFixed(0)} bits`);
            console.log(`   Range: ${(r.minProfit / 100).toFixed(0)} to ${(r.maxProfit / 100).toFixed(0)} bits`);
            console.log(`   ROI Efficiency: ${(r.roiEfficiency * 100).toFixed(2)}%`);
            console.log(`   Avg Drawdown: ${r.avgDrawdown.toFixed(1)}%`);
            console.log('');
        });
    } else {
        console.log('No configurations met criteria\n');
    }

    // 2. BEST ROI EFFICIENCY
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📈 TOP 10: BEST ROI EFFICIENCY');
    console.log('(Profit per unit of capital)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const bestROI = [...goodResults]
        .sort((a, b) => b.roiEfficiency - a.roiEfficiency)
        .slice(0, 10);

    bestROI.forEach((r, idx) => {
        console.log(`${idx + 1}. Config: ${r.config} | Payout: ${r.payout}x`);
        console.log(`   Capital: ${r.capitalBits.toLocaleString()} bits`);
        console.log(`   Success: ${r.successRate.toFixed(1)}%`);
        console.log(`   📊 ROI Efficiency: ${(r.roiEfficiency * 100).toFixed(2)}% ⭐`);
        console.log(`   Avg Profit: ${(r.avgProfit / 100).toFixed(0)} bits (${r.avgProfitPercent.toFixed(1)}%)`);
        console.log(`   Sharpe Ratio: ${r.sharpeRatio.toFixed(2)}`);
        console.log(`   Drawdown: ${r.avgDrawdown.toFixed(1)}%`);
        console.log('');
    });

    // 3. HIGHEST ABSOLUTE PROFIT
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💵 TOP 10: HIGHEST ABSOLUTE PROFIT');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const highestProfit = [...goodResults]
        .sort((a, b) => b.avgProfit - a.avgProfit)
        .slice(0, 10);

    highestProfit.forEach((r, idx) => {
        console.log(`${idx + 1}. Config: ${r.config} | Payout: ${r.payout}x`);
        console.log(`   Capital: ${r.capitalBits.toLocaleString()} bits`);
        console.log(`   Success: ${r.successRate.toFixed(1)}%`);
        console.log(`   💰 Avg Profit: ${(r.avgProfit / 100).toFixed(0)} bits ⭐`);
        console.log(`   Profit %: ${r.avgProfitPercent.toFixed(1)}%`);
        console.log(`   Median: ${(r.medianProfit / 100).toFixed(0)} bits`);
        console.log(`   ROI: ${(r.roiEfficiency * 100).toFixed(2)}%`);
        console.log('');
    });

    // 4. BEST RISK-ADJUSTED RETURN
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🛡️ TOP 10: BEST RISK-ADJUSTED RETURN');
    console.log('(Sharpe Ratio - profit vs volatility)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const bestSharpe = [...goodResults]
        .sort((a, b) => b.sharpeRatio - a.sharpeRatio)
        .slice(0, 10);

    bestSharpe.forEach((r, idx) => {
        console.log(`${idx + 1}. Config: ${r.config} | Payout: ${r.payout}x`);
        console.log(`   Capital: ${r.capitalBits.toLocaleString()} bits`);
        console.log(`   Success: ${r.successRate.toFixed(1)}%`);
        console.log(`   🛡️ Sharpe Ratio: ${r.sharpeRatio.toFixed(2)} ⭐`);
        console.log(`   Avg Profit: ${(r.avgProfit / 100).toFixed(0)} bits (${r.avgProfitPercent.toFixed(1)}%)`);
        console.log(`   Std Dev: ${(r.profitStdDev / 100).toFixed(0)} bits`);
        console.log(`   Drawdown: ${r.avgDrawdown.toFixed(1)}%`);
        console.log('');
    });

    // 5. OPTIMAL OVERALL (Best Score)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🏆 OPTIMAL CONFIGURATION');
    console.log('(Best overall score: ROI + Success - Risk)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const optimal = [...goodResults].sort((a, b) => b.score - a.score)[0];

    if (optimal) {
        console.log(`Configuration: ${optimal.config}`);
        console.log(`Payout: ${optimal.payout}x`);
        console.log(`Max Recovery Attempts: ${optimal.maxT}`);
        console.log(`\n📊 PERFORMANCE (100 seeds × 200,000 games):`);
        console.log(`   💰 Starting Capital: ${optimal.capitalBits.toLocaleString()} bits`);
        console.log(`   ✅ Success Rate: ${optimal.successRate.toFixed(1)}% (${optimal.numSuccessful}/100)`);
        console.log(`   💵 Average Profit: ${(optimal.avgProfit / 100).toFixed(0)} bits`);
        console.log(`   📊 Median Profit: ${(optimal.medianProfit / 100).toFixed(0)} bits`);
        console.log(`   📈 Profit Percentage: ${optimal.avgProfitPercent.toFixed(1)}%`);
        console.log(`   🎯 ROI Efficiency: ${(optimal.roiEfficiency * 100).toFixed(2)}%`);
        console.log(`   📉 Avg Max Drawdown: ${optimal.avgDrawdown.toFixed(1)}%`);
        console.log(`   🛡️ Sharpe Ratio: ${optimal.sharpeRatio.toFixed(2)}`);
        console.log(`   📍 Profit Range: ${(optimal.minProfit / 100).toFixed(0)} to ${(optimal.maxProfit / 100).toFixed(0)} bits`);
        console.log(`\n✨ This configuration offers:`);
        console.log(`   • ${optimal.capital <= 500000 ? 'Low' : optimal.capital <= 1000000 ? 'Moderate' : 'High'} capital requirement`);
        console.log(`   • ${optimal.successRate >= 95 ? 'Excellent' : 'Good'} success rate`);
        console.log(`   • ${optimal.roiEfficiency >= 1 ? 'Excellent' : optimal.roiEfficiency >= 0.5 ? 'Good' : 'Moderate'} return on investment`);
        console.log(`   • ${optimal.avgDrawdown <= 30 ? 'Low' : optimal.avgDrawdown <= 50 ? 'Moderate' : 'High'} risk profile`);
    }

    return { lowCapital, bestROI, highestProfit, bestSharpe, optimal };
}

// ==================== EXECUTE ====================

console.log('Starting comprehensive analysis...\n');
const startTime = Date.now();

const results = runAnalysis();
const analysis = analyzeResults(results);

const endTime = Date.now();
const duration = (endTime - startTime) / 1000;

console.log(`\n========================================`);
console.log(`Analysis completed in ${duration.toFixed(1)} seconds (${(duration / 60).toFixed(2)} minutes)`);
console.log(`========================================\n`);
