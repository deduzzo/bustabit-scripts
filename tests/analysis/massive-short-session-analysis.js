/**
 * MASSIVE SHORT SESSION ANALYSIS
 *
 * 20.000 seed casuali con sessioni brevi (4.000 - 10.000 partite)
 * Obiettivo: Trovare la configurazione ottimale per profitto reale
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
function simulateFibonacci(seed, startBalance, config) {
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
    let maxLossStreak = 0;
    let currentLossStreak = 0;

    for (let i = 0; i < seed.length; i++) {
        const bust = seed[i];

        // Check disaster
        if (k > maxT || currentBet > balance) {
            return {
                ruined: true,
                ruinedAtGame: i,
                finalBalance: balance,
                profit: balance - initialBalance,
                profitPercent: ((balance - initialBalance) / initialBalance) * 100,
                totalGames: i,
                totalWins,
                totalLosses,
                maxLossStreak,
                maxDrawdownPercent: ((initialBalance - minBalance) / initialBalance) * 100
            };
        }

        // Calculate Fibonacci bet
        if (k === 0) {
            currentBet = baseBet;
            precBet = 0;
        } else if (k === 1) {
            precBet = currentBet;
            currentBet = Math.round(currentBet * 2);
        } else {
            let precBetTemp = currentBet;
            currentBet = Math.round(currentBet + precBet);
            precBet = precBetTemp;
        }

        // Execute bet
        if (bust >= payout) {
            // Win
            const profit = Math.floor((currentBet * payout) - currentBet);
            balance += profit;
            totalWins++;
            k = 0;
            currentLossStreak = 0;
        } else {
            // Loss
            balance -= currentBet;
            totalLosses++;
            k++;
            currentLossStreak++;
            if (currentLossStreak > maxLossStreak) {
                maxLossStreak = currentLossStreak;
            }
        }

        // Track extremes
        if (balance > maxBalance) maxBalance = balance;
        if (balance < minBalance) minBalance = balance;

        if (balance <= 0) {
            return {
                ruined: true,
                ruinedAtGame: i,
                finalBalance: 0,
                profit: -initialBalance,
                profitPercent: -100,
                totalGames: i,
                totalWins,
                totalLosses,
                maxLossStreak,
                maxDrawdownPercent: 100
            };
        }
    }

    return {
        ruined: false,
        finalBalance: balance,
        profit: balance - initialBalance,
        profitPercent: ((balance - initialBalance) / initialBalance) * 100,
        totalGames: seed.length,
        totalWins,
        totalLosses,
        winRate: (totalWins / (totalWins + totalLosses)) * 100,
        maxBalance,
        minBalance,
        maxLossStreak,
        maxDrawdownPercent: ((initialBalance - minBalance) / initialBalance) * 100
    };
}

// ==================== MAIN ANALYSIS ====================

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║  MASSIVE SHORT SESSION ANALYSIS                          ║');
console.log('║  20,000 Seeds × Variable Games (4k-10k)                  ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

const NUM_SEEDS = 20000;

// Session lengths to test
const sessionLengths = [4000, 5000, 6000, 7000, 8000, 10000];

// Configurations - focus on best performers from previous analysis
const configurations = [
    // Fibonacci variations
    { baseBet: 100, payout: 2.5, maxT: 20, name: 'Fib-2.5x-T20' },
    { baseBet: 100, payout: 3.0, maxT: 20, name: 'Fib-3.0x-T20' },
    { baseBet: 100, payout: 3.0, maxT: 22, name: 'Fib-3.0x-T22' },
    { baseBet: 100, payout: 3.5, maxT: 22, name: 'Fib-3.5x-T22' },
    { baseBet: 100, payout: 4.0, maxT: 24, name: 'Fib-4.0x-T24' },
];

// Capital levels to test
const capitalLevels = [
    50000,    // 500 bits
    100000,   // 1,000 bits
    250000,   // 2,500 bits
    500000,   // 5,000 bits
    1000000,  // 10,000 bits
];

const startTime = Date.now();

console.log('Generating and testing seeds...');
console.log(`Total tests: ${NUM_SEEDS * sessionLengths.length * configurations.length * capitalLevels.length}`);
console.log('This will take several minutes...\n');

const results = {};

// Initialize results structure
configurations.forEach(config => {
    results[config.name] = {};
    capitalLevels.forEach(capital => {
        results[config.name][capital] = {};
        sessionLengths.forEach(length => {
            results[config.name][capital][length] = [];
        });
    });
});

let completed = 0;
const totalTests = NUM_SEEDS * sessionLengths.length * configurations.length * capitalLevels.length;
let lastProgress = 0;

// Run tests
for (let seedNum = 0; seedNum < NUM_SEEDS; seedNum++) {
    // Generate seeds for all lengths at once for this iteration
    const seeds = {};
    sessionLengths.forEach(length => {
        seeds[length] = generateSeed(length);
    });

    configurations.forEach(config => {
        capitalLevels.forEach(capital => {
            sessionLengths.forEach(length => {
                const result = simulateFibonacci(seeds[length], capital, config);
                results[config.name][capital][length].push(result);

                completed++;
                const progress = Math.floor((completed / totalTests) * 100);
                if (progress > lastProgress && progress % 5 === 0) {
                    process.stdout.write(`\r  Progress: ${progress}%`);
                    lastProgress = progress;
                }
            });
        });
    });
}

console.log('\n\n✓ All tests completed!\n');

// ==================== ANALYSIS ====================

console.log('═══════════════════════════════════════════════════════════');
console.log('                    RESULTS ANALYSIS                        ');
console.log('═══════════════════════════════════════════════════════════\n');

const summary = [];

configurations.forEach(config => {
    capitalLevels.forEach(capital => {
        sessionLengths.forEach(length => {
            const testResults = results[config.name][capital][length];
            const successful = testResults.filter(r => !r.ruined);

            if (successful.length > 0) {
                const profits = successful.map(r => r.profit).sort((a, b) => a - b);
                const profitPercents = successful.map(r => r.profitPercent);
                const drawdowns = successful.map(r => r.maxDrawdownPercent);
                const maxStreaks = successful.map(r => r.maxLossStreak);

                const avgProfit = profits.reduce((a, b) => a + b, 0) / profits.length;
                const medianProfit = profits[Math.floor(profits.length / 2)];
                const q1Profit = profits[Math.floor(profits.length * 0.25)];
                const q3Profit = profits[Math.floor(profits.length * 0.75)];

                const avgProfitPercent = profitPercents.reduce((a, b) => a + b, 0) / profitPercents.length;
                const avgDrawdown = drawdowns.reduce((a, b) => a + b, 0) / drawdowns.length;
                const avgMaxStreak = maxStreaks.reduce((a, b) => a + b, 0) / maxStreaks.length;

                const variance = profits.reduce((sum, p) => sum + Math.pow(p - avgProfit, 2), 0) / profits.length;
                const stdDev = Math.sqrt(variance);

                const successRate = (successful.length / testResults.length) * 100;
                const positiveRate = (profits.filter(p => p > 0).length / profits.length) * 100;

                summary.push({
                    config: config.name,
                    payout: config.payout,
                    maxT: config.maxT,
                    capital,
                    capitalBits: capital / 100,
                    sessionLength: length,
                    successRate,
                    positiveRate,
                    numSuccessful: successful.length,
                    numFailed: testResults.length - successful.length,
                    avgProfit: avgProfit / 100,
                    medianProfit: medianProfit / 100,
                    q1Profit: q1Profit / 100,
                    q3Profit: q3Profit / 100,
                    minProfit: profits[0] / 100,
                    maxProfit: profits[profits.length - 1] / 100,
                    avgProfitPercent,
                    avgDrawdown,
                    avgMaxStreak,
                    stdDev: stdDev / 100,
                    roiEfficiency: avgProfit / capital,
                    sharpeRatio: avgProfit / Math.max(stdDev, 1),
                    // Combined score: success rate + positive rate + ROI - drawdown
                    score: successRate + positiveRate + (avgProfit / capital * 1000) - avgDrawdown
                });
            }
        });
    });
});

// Filter for good configurations (>90% success rate, positive profit)
const goodConfigs = summary.filter(r => r.successRate >= 90 && r.avgProfit > 0);

console.log(`Configurations with ≥90% success and positive profit: ${goodConfigs.length}\n`);

if (goodConfigs.length === 0) {
    console.log('⚠️ No configurations met the criteria. Showing best available:\n');
    const best = summary
        .filter(r => r.successRate > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

    best.forEach((r, idx) => {
        console.log(`${idx + 1}. ${r.config} | ${r.capitalBits} bits | ${r.sessionLength} games`);
        console.log(`   Success: ${r.successRate.toFixed(1)}% | Profit: ${r.avgProfit.toFixed(0)} bits (${r.avgProfitPercent.toFixed(1)}%)`);
        console.log('');
    });
} else {
    // 1. LOWEST CAPITAL REQUIREMENT
    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│  🏆 TOP 10: LOWEST CAPITAL WITH BEST PROFIT             │');
    console.log('└─────────────────────────────────────────────────────────┘\n');

    const lowestCapital = [...goodConfigs]
        .sort((a, b) => {
            if (a.capital !== b.capital) return a.capital - b.capital;
            return b.avgProfitPercent - a.avgProfitPercent;
        })
        .slice(0, 10);

    lowestCapital.forEach((r, idx) => {
        console.log(`${idx + 1}. ${r.config} | ${r.sessionLength.toLocaleString()} games`);
        console.log(`   💰 Capital: ${r.capitalBits.toLocaleString()} bits ⭐⭐⭐`);
        console.log(`   ✅ Success: ${r.successRate.toFixed(1)}% | Positive: ${r.positiveRate.toFixed(1)}%`);
        console.log(`   💵 Avg Profit: ${r.avgProfit.toFixed(0)} bits (${r.avgProfitPercent.toFixed(1)}%)`);
        console.log(`   📊 Median: ${r.medianProfit.toFixed(0)} | Q1: ${r.q1Profit.toFixed(0)} | Q3: ${r.q3Profit.toFixed(0)}`);
        console.log(`   📈 ROI: ${(r.roiEfficiency * 100).toFixed(2)}%`);
        console.log(`   📉 Drawdown: ${r.avgDrawdown.toFixed(1)}% | Max Streak: ${r.avgMaxStreak.toFixed(1)}`);
        console.log(`   📍 Range: ${r.minProfit.toFixed(0)} to ${r.maxProfit.toFixed(0)} bits`);
        console.log('');
    });

    // 2. HIGHEST PROFIT PERCENTAGE
    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│  📈 TOP 10: HIGHEST PROFIT PERCENTAGE                    │');
    console.log('└─────────────────────────────────────────────────────────┘\n');

    const highestProfit = [...goodConfigs]
        .sort((a, b) => b.avgProfitPercent - a.avgProfitPercent)
        .slice(0, 10);

    highestProfit.forEach((r, idx) => {
        console.log(`${idx + 1}. ${r.config} | ${r.sessionLength.toLocaleString()} games`);
        console.log(`   Capital: ${r.capitalBits.toLocaleString()} bits`);
        console.log(`   ✅ Success: ${r.successRate.toFixed(1)}% | Positive: ${r.positiveRate.toFixed(1)}%`);
        console.log(`   📈 Profit: ${r.avgProfitPercent.toFixed(1)}% ⭐⭐⭐ (${r.avgProfit.toFixed(0)} bits)`);
        console.log(`   📊 Median: ${r.medianProfit.toFixed(0)} bits`);
        console.log(`   ROI: ${(r.roiEfficiency * 100).toFixed(2)}%`);
        console.log('');
    });

    // 3. BEST RISK-ADJUSTED RETURN
    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│  🛡️ TOP 10: BEST RISK-ADJUSTED RETURN                   │');
    console.log('└─────────────────────────────────────────────────────────┘\n');

    const bestRisk = [...goodConfigs]
        .sort((a, b) => b.sharpeRatio - a.sharpeRatio)
        .slice(0, 10);

    bestRisk.forEach((r, idx) => {
        console.log(`${idx + 1}. ${r.config} | ${r.sessionLength.toLocaleString()} games`);
        console.log(`   Capital: ${r.capitalBits.toLocaleString()} bits`);
        console.log(`   🛡️ Sharpe: ${r.sharpeRatio.toFixed(2)} ⭐⭐⭐`);
        console.log(`   Success: ${r.successRate.toFixed(1)}% | Profit: ${r.avgProfitPercent.toFixed(1)}%`);
        console.log(`   Std Dev: ${r.stdDev.toFixed(0)} bits | Drawdown: ${r.avgDrawdown.toFixed(1)}%`);
        console.log('');
    });

    // 4. BEST OVERALL SCORE
    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│  ⭐ TOP 10: BEST OVERALL SCORE                          │');
    console.log('│     (Combined: Success + Positive + ROI - Risk)         │');
    console.log('└─────────────────────────────────────────────────────────┘\n');

    const bestOverall = [...goodConfigs]
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

    bestOverall.forEach((r, idx) => {
        console.log(`${idx + 1}. ${r.config} | ${r.sessionLength.toLocaleString()} games`);
        console.log(`   Capital: ${r.capitalBits.toLocaleString()} bits`);
        console.log(`   ⭐ Score: ${r.score.toFixed(2)}`);
        console.log(`   Success: ${r.successRate.toFixed(1)}% | Positive: ${r.positiveRate.toFixed(1)}%`);
        console.log(`   Profit: ${r.avgProfitPercent.toFixed(1)}% (${r.avgProfit.toFixed(0)} bits)`);
        console.log(`   Median: ${r.medianProfit.toFixed(0)} bits | ROI: ${(r.roiEfficiency * 100).toFixed(2)}%`);
        console.log('');
    });

    // 5. OPTIMAL CONFIGURATION
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║              🏆 OPTIMAL CONFIGURATION 🏆                  ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

    const optimal = bestOverall[0];

    console.log(`╭─────────────────────────────────────────────────────────╮`);
    console.log(`│  Configuration: ${optimal.config}`);
    console.log(`│  Payout: ${optimal.payout}x | Max Recovery: T${optimal.maxT}`);
    console.log(`╰─────────────────────────────────────────────────────────╯\n`);

    console.log(`📊 PERFORMANCE (${NUM_SEEDS.toLocaleString()} seeds × ${optimal.sessionLength.toLocaleString()} games):`);
    console.log(`   💰 Capitale Richiesto: ${optimal.capitalBits.toLocaleString()} bits`);
    console.log(`   ✅ Tasso Successo: ${optimal.successRate.toFixed(1)}% (${optimal.numSuccessful}/${NUM_SEEDS})`);
    console.log(`   💚 Profitto Positivo: ${optimal.positiveRate.toFixed(1)}% delle sessioni`);
    console.log(`   💵 Profitto Medio: ${optimal.avgProfit.toFixed(0)} bits`);
    console.log(`   📊 Profitto Mediano: ${optimal.medianProfit.toFixed(0)} bits`);
    console.log(`   📈 Profitto %: ${optimal.avgProfitPercent.toFixed(2)}%`);
    console.log(`   🎯 ROI Efficiency: ${(optimal.roiEfficiency * 100).toFixed(2)}%`);
    console.log(`   🛡️ Sharpe Ratio: ${optimal.sharpeRatio.toFixed(2)}`);
    console.log(`   📉 Drawdown Medio: ${optimal.avgDrawdown.toFixed(1)}%`);
    console.log(`   🎰 Max Loss Streak: ${optimal.avgMaxStreak.toFixed(1)} games`);
    console.log(`\n   📍 Distribuzione Profitti:`);
    console.log(`      Min:    ${optimal.minProfit.toFixed(0)} bits`);
    console.log(`      Q1:     ${optimal.q1Profit.toFixed(0)} bits (25% sotto)`);
    console.log(`      Median: ${optimal.medianProfit.toFixed(0)} bits (50%)`);
    console.log(`      Q3:     ${optimal.q3Profit.toFixed(0)} bits (75% sotto)`);
    console.log(`      Max:    ${optimal.maxProfit.toFixed(0)} bits`);
    console.log(`\n✨ Questa è la configurazione MIGLIORE per:`);
    console.log(`   • Capitale minimo necessario: ${optimal.capitalBits.toLocaleString()} bits`);
    console.log(`   • Sessioni di ${optimal.sessionLength.toLocaleString()} partite`);
    console.log(`   • ${optimal.positiveRate.toFixed(0)}% probabilità di profitto`);
    console.log(`   • Profitto medio: +${optimal.avgProfitPercent.toFixed(1)}%`);
    console.log(`   • Rischio controllato: ${optimal.avgDrawdown.toFixed(1)}% drawdown`);

    // Compare by session length
    console.log('\n\n┌─────────────────────────────────────────────────────────┐');
    console.log('│  📊 COMPARISON BY SESSION LENGTH                        │');
    console.log('│     (Using optimal config)                               │');
    console.log('└─────────────────────────────────────────────────────────┘\n');

    const optimalConfig = optimal.config;
    const optimalCapital = optimal.capital;

    sessionLengths.forEach(length => {
        const data = goodConfigs.find(r =>
            r.config === optimalConfig &&
            r.capital === optimalCapital &&
            r.sessionLength === length
        );

        if (data) {
            console.log(`${length.toLocaleString().padStart(6)} games: Success ${data.successRate.toFixed(1)}% | Profit ${data.avgProfitPercent.toFixed(1)}% (${data.avgProfit.toFixed(0)} bits) | Positive ${data.positiveRate.toFixed(1)}%`);
        }
    });
}

const endTime = Date.now();
const duration = (endTime - startTime) / 1000;

console.log('\n\n═══════════════════════════════════════════════════════════');
console.log(`Analysis completed in ${duration.toFixed(1)}s (${(duration / 60).toFixed(2)} min)`);
console.log(`Total tests: ${totalTests.toLocaleString()}`);
console.log('═══════════════════════════════════════════════════════════\n');

// Export optimal config for use
console.log('🔧 READY-TO-USE CONFIGURATION:');
console.log('\nCopy this into optimal-strategy.js:\n');
if (goodConfigs.length > 0) {
    const opt = bestOverall[0];
    console.log(`{`);
    console.log(`  baseBet: 100,`);
    console.log(`  payout: ${opt.payout},`);
    console.log(`  maxT: ${opt.maxT},`);
    console.log(`  startingCapital: ${opt.capital},`);
    console.log(`  maxGames: ${opt.sessionLength},`);
    console.log(`  stopLoss: 20,`);
    console.log(`  takeProfit: 50`);
    console.log(`}`);
    console.log(`\nExpected: ${opt.avgProfitPercent.toFixed(1)}% profit | ${opt.positiveRate.toFixed(0)}% win rate`);
}
