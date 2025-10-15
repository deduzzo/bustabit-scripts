/**
 * MARTIN AI OPTIMIZATION - 100,000 SEEDS
 *
 * Ottimizzazione completa del Martin Simple AI V2
 * Focus: 50.000 bits capital
 * Target: Trovare la migliore combinazione di mult + payout
 */

// Seed generation
function generateSeed(n, seedValue) {
    let values = [];
    let rng = seedValue || Date.now();

    for (let index = 0; index < n; index++) {
        rng = (rng * 1103515245 + 12345) % 2147483648;
        const random = rng / 2147483648;
        values.push(Math.floor(Math.max(0.99 / (1 - random), 1) * 100) / 100);
    }
    return values;
}

// Martin Simple AI simulator
function simulateMartinAI(seed, startBalance, config) {
    const { baseBet, payout, mult, maxTimes, waitBeforePlay } = config;

    let balance = startBalance;
    const initialBalance = startBalance;
    let currentBet = baseBet;
    let currentTimes = 0;
    let totalWins = 0;
    let totalLosses = 0;
    let maxBalance = startBalance;
    let minBalance = startBalance;
    let maxLossStreak = 0;
    let currentLossStreak = 0;

    const STATE = { WAITING: 'waiting', BETTING: 'betting' };
    let state = waitBeforePlay === 0 ? STATE.BETTING : STATE.WAITING;
    let waitRemaining = waitBeforePlay;

    for (let i = 0; i < seed.length; i++) {
        const bust = seed[i];

        if (state === STATE.WAITING) {
            if (waitBeforePlay === 0) {
                state = STATE.BETTING;
                continue;
            }

            if (bust < payout) {
                waitRemaining = Math.max(0, waitRemaining - 1);
                if (waitRemaining === 0) {
                    state = STATE.BETTING;
                    currentBet = baseBet;
                    currentTimes = 0;
                }
            } else {
                waitRemaining = waitBeforePlay;
            }
            continue;
        }

        if (currentBet > balance) {
            return {
                ruined: true,
                reason: 'insufficient',
                finalBalance: balance,
                profit: balance - initialBalance,
                profitPercent: ((balance - initialBalance) / initialBalance) * 100,
                totalGames: i,
                totalWins,
                totalLosses,
                maxLossStreak,
                maxDrawdownPercent: ((initialBalance - minBalance) / initialBalance) * 100,
                winRate: totalWins / Math.max(totalWins + totalLosses, 1) * 100
            };
        }

        if (bust >= payout) {
            // WIN
            const profit = Math.floor((currentBet * payout) - currentBet);
            balance += profit;
            totalWins++;
            currentLossStreak = 0;
            currentBet = baseBet;
            currentTimes = 0;

            if (waitBeforePlay > 0) {
                state = STATE.WAITING;
                waitRemaining = waitBeforePlay;
            }
        } else {
            // LOSS
            balance -= currentBet;
            totalLosses++;
            currentLossStreak++;
            currentTimes++;

            if (currentLossStreak > maxLossStreak) {
                maxLossStreak = currentLossStreak;
            }

            if (maxTimes > 0 && currentTimes >= maxTimes) {
                currentBet = baseBet;
                currentTimes = 0;

                if (waitBeforePlay > 0) {
                    state = STATE.WAITING;
                    waitRemaining = waitBeforePlay;
                }
            } else {
                currentBet = Math.ceil((currentBet / 100) * mult) * 100;
            }
        }

        if (balance > maxBalance) maxBalance = balance;
        if (balance < minBalance) minBalance = balance;

        if (balance <= 0) {
            return {
                ruined: true,
                reason: 'bankrupt',
                finalBalance: 0,
                profit: -initialBalance,
                profitPercent: -100,
                totalGames: i,
                totalWins,
                totalLosses,
                maxLossStreak,
                maxDrawdownPercent: 100,
                winRate: totalWins / Math.max(totalWins + totalLosses, 1) * 100
            };
        }
    }

    return {
        ruined: false,
        reason: 'completed',
        finalBalance: balance,
        profit: balance - initialBalance,
        profitPercent: ((balance - initialBalance) / initialBalance) * 100,
        totalGames: seed.length,
        totalWins,
        totalLosses,
        maxLossStreak,
        maxDrawdownPercent: ((initialBalance - minBalance) / initialBalance) * 100,
        winRate: totalWins / Math.max(totalWins + totalLosses, 1) * 100
    };
}

// ==================== MAIN OPTIMIZATION ====================

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║    MARTIN AI OPTIMIZATION - 100,000 SEEDS                  ║');
console.log('║    Target: 50,000 bits capital                             ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

const NUM_SEEDS = 100000;
const SESSION_LENGTH = 4000;
const TARGET_CAPITAL = 5000000; // 50,000 bits

console.log('📋 TEST CONFIGURATION:\n');
console.log(`   Seeds: ${NUM_SEEDS.toLocaleString()}`);
console.log(`   Games per seed: ${SESSION_LENGTH.toLocaleString()}`);
console.log(`   Capital: ${(TARGET_CAPITAL / 100).toLocaleString()} bits`);
console.log(`   Total simulations: ${(NUM_SEEDS * SESSION_LENGTH).toLocaleString()} games\n`);

// Test configurations
const configurations = [];

// Multipliers to test
const multipliers = [1.40, 1.45, 1.48, 1.51, 1.55, 1.60];

// Payouts to test
const payouts = [2.5, 2.7, 2.8, 3.0, 3.1, 3.2];

// MaxTimes to test
const maxTimesList = [20, 22, 23, 25];

// WaitBeforePlay to test
const waitModes = [0, 2, 3];

console.log('🔬 TESTING COMBINATIONS:\n');
console.log(`   Multipliers: ${multipliers.join(', ')}`);
console.log(`   Payouts: ${payouts.join('x, ')}x`);
console.log(`   MaxTimes: ${maxTimesList.join(', ')}`);
console.log(`   Wait Modes: ${waitModes.join(', ')}`);

// Generate all combinations (simplified for speed)
// Test all multipliers × payouts with best maxTimes and wait
payouts.forEach(payout => {
    multipliers.forEach(mult => {
        // Test with original maxTimes=23, wait=0
        configurations.push({
            baseBet: 100,
            payout,
            mult,
            maxTimes: 23,
            waitBeforePlay: 0,
            name: `M${mult}-P${payout}x-T23-W0`
        });

        // Test with wait mode for promising configs
        if (mult <= 1.51 && payout <= 3.0) {
            configurations.push({
                baseBet: 100,
                payout,
                mult,
                maxTimes: 23,
                waitBeforePlay: 2,
                name: `M${mult}-P${payout}x-T23-W2`
            });
        }

        // Test with higher maxTimes for lower mult
        if (mult <= 1.48) {
            configurations.push({
                baseBet: 100,
                payout,
                mult,
                maxTimes: 25,
                waitBeforePlay: 0,
                name: `M${mult}-P${payout}x-T25-W0`
            });
        }
    });
});

console.log(`\n   Total configurations: ${configurations.length}`);
console.log(`   Total tests: ${(NUM_SEEDS * configurations.length).toLocaleString()}\n`);

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const startTime = Date.now();
const results = {};

// Initialize results
configurations.forEach(config => {
    results[config.name] = [];
});

let completed = 0;
const total = NUM_SEEDS * configurations.length;
let lastProgress = 0;

// Run simulations
for (let seedNum = 0; seedNum < NUM_SEEDS; seedNum++) {
    const seedValue = Date.now() + seedNum + Math.floor(Math.random() * 1000000);
    const seed = generateSeed(SESSION_LENGTH, seedValue);

    configurations.forEach(config => {
        const result = simulateMartinAI(seed, TARGET_CAPITAL, config);
        results[config.name].push(result);

        completed++;
        const progress = Math.floor((completed / total) * 100);
        if (progress !== lastProgress && progress % 2 === 0) {
            process.stdout.write(`\r  Progress: ${progress}% | Time: ${((Date.now() - startTime) / 1000).toFixed(0)}s`);
            lastProgress = progress;
        }
    });
}

console.log('\n\n✓ All simulations completed!\n');

// ==================== ANALYSIS ====================

console.log('═══════════════════════════════════════════════════════════');
console.log('                    ANALYSIS RESULTS                        ');
console.log('═══════════════════════════════════════════════════════════\n');

const summary = [];

configurations.forEach(config => {
    const data = results[config.name];
    const successful = data.filter(r => !r.ruined);

    if (successful.length > 0) {
        const profits = successful.map(r => r.profit).sort((a, b) => a - b);
        const profitPercents = successful.map(r => r.profitPercent);
        const drawdowns = successful.map(r => r.maxDrawdownPercent);

        const avgProfit = profits.reduce((a, b) => a + b, 0) / profits.length;
        const medianProfit = profits[Math.floor(profits.length / 2)];
        const q1 = profits[Math.floor(profits.length * 0.25)];
        const q3 = profits[Math.floor(profits.length * 0.75)];

        const variance = profits.reduce((sum, p) => sum + Math.pow(p - avgProfit, 2), 0) / profits.length;
        const stdDev = Math.sqrt(variance);

        const avgProfitPercent = profitPercents.reduce((a, b) => a + b, 0) / profitPercents.length;
        const avgDrawdown = drawdowns.reduce((a, b) => a + b, 0) / drawdowns.length;

        const successRate = (successful.length / data.length) * 100;
        const positiveCount = profits.filter(p => p > 0).length;
        const positiveRate = (positiveCount / successful.length) * 100;

        // Advanced metrics
        const sharpeRatio = avgProfit / Math.max(stdDev, 1);
        const sortinoRatio = avgProfit / Math.max(Math.sqrt(
            profits.filter(p => p < 0).reduce((sum, p) => sum + Math.pow(p, 2), 0) /
            Math.max(profits.filter(p => p < 0).length, 1)
        ), 1);
        const calmarRatio = avgProfitPercent / Math.max(avgDrawdown, 1);
        const roiEfficiency = avgProfit / TARGET_CAPITAL;

        // Win rates
        const winRates = successful.map(r => r.winRate);
        const avgWinRate = winRates.reduce((a, b) => a + b, 0) / winRates.length;

        summary.push({
            config: config.name,
            mult: config.mult,
            payout: config.payout,
            maxTimes: config.maxTimes,
            wait: config.waitBeforePlay,
            successRate,
            positiveRate,
            avgProfit: avgProfit / 100,
            medianProfit: medianProfit / 100,
            q1Profit: q1 / 100,
            q3Profit: q3 / 100,
            minProfit: profits[0] / 100,
            maxProfit: profits[profits.length - 1] / 100,
            avgProfitPercent,
            avgDrawdown,
            avgWinRate,
            stdDev: stdDev / 100,
            sharpeRatio,
            sortinoRatio,
            calmarRatio,
            roiEfficiency,
            score: successRate * 0.3 + positiveRate * 0.2 + sharpeRatio * 15 + (avgProfitPercent * 2) - avgDrawdown * 0.3
        });
    }
});

// Filter excellent configurations
const excellent = summary.filter(r =>
    r.successRate >= 90 &&
    r.positiveRate >= 85 &&
    r.avgProfit > 0 &&
    r.sharpeRatio > 0
);

console.log(`Excellent configurations (≥90% success, ≥85% positive, Sharpe>0): ${excellent.length}\n`);

if (excellent.length > 0) {
    // 1. BEST BY SUCCESS RATE
    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│  🏆 TOP 10: HIGHEST SUCCESS RATE                        │');
    console.log('└─────────────────────────────────────────────────────────┘\n');

    const bestSuccess = [...excellent].sort((a, b) => b.successRate - a.successRate).slice(0, 10);
    bestSuccess.forEach((r, idx) => {
        console.log(`${idx + 1}. ${r.config}`);
        console.log(`   ✅ Success: ${r.successRate.toFixed(2)}% | Positive: ${r.positiveRate.toFixed(1)}%`);
        console.log(`   💵 Profit: ${r.avgProfit.toFixed(0)} bits (${r.avgProfitPercent.toFixed(2)}%)`);
        console.log(`   📊 Win Rate: ${r.avgWinRate.toFixed(1)}% | Drawdown: ${r.avgDrawdown.toFixed(1)}%`);
        console.log(`   🛡️ Sharpe: ${r.sharpeRatio.toFixed(3)}`);
        console.log('');
    });

    // 2. BEST BY PROFIT %
    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│  💰 TOP 10: HIGHEST PROFIT PERCENTAGE                   │');
    console.log('└─────────────────────────────────────────────────────────┘\n');

    const bestProfit = [...excellent].sort((a, b) => b.avgProfitPercent - a.avgProfitPercent).slice(0, 10);
    bestProfit.forEach((r, idx) => {
        console.log(`${idx + 1}. ${r.config}`);
        console.log(`   💰 Profit: ${r.avgProfitPercent.toFixed(2)}% (${r.avgProfit.toFixed(0)} bits) ⭐`);
        console.log(`   Success: ${r.successRate.toFixed(1)}% | Positive: ${r.positiveRate.toFixed(1)}%`);
        console.log(`   Drawdown: ${r.avgDrawdown.toFixed(1)}% | Sharpe: ${r.sharpeRatio.toFixed(3)}`);
        console.log('');
    });

    // 3. BEST BY SHARPE RATIO
    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│  🛡️  TOP 10: BEST SHARPE RATIO (Risk-Adjusted)         │');
    console.log('└─────────────────────────────────────────────────────────┘\n');

    const bestSharpe = [...excellent].sort((a, b) => b.sharpeRatio - a.sharpeRatio).slice(0, 10);
    bestSharpe.forEach((r, idx) => {
        console.log(`${idx + 1}. ${r.config}`);
        console.log(`   🛡️ Sharpe: ${r.sharpeRatio.toFixed(3)} | Sortino: ${r.sortinoRatio.toFixed(3)} ⭐⭐⭐`);
        console.log(`   Success: ${r.successRate.toFixed(1)}% | Profit: ${r.avgProfitPercent.toFixed(2)}%`);
        console.log(`   Drawdown: ${r.avgDrawdown.toFixed(1)}% | Win Rate: ${r.avgWinRate.toFixed(1)}%`);
        console.log('');
    });

    // 4. BEST BY CALMAR RATIO
    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│  📊 TOP 10: BEST CALMAR RATIO (Return/Drawdown)         │');
    console.log('└─────────────────────────────────────────────────────────┘\n');

    const bestCalmar = [...excellent].sort((a, b) => b.calmarRatio - a.calmarRatio).slice(0, 10);
    bestCalmar.forEach((r, idx) => {
        console.log(`${idx + 1}. ${r.config}`);
        console.log(`   📊 Calmar: ${r.calmarRatio.toFixed(3)} ⭐`);
        console.log(`   Return: ${r.avgProfitPercent.toFixed(2)}% | Drawdown: ${r.avgDrawdown.toFixed(1)}%`);
        console.log(`   Success: ${r.successRate.toFixed(1)}% | Sharpe: ${r.sharpeRatio.toFixed(3)}`);
        console.log('');
    });

    // 5. BEST OVERALL SCORE
    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│  ⭐ TOP 10: BEST OVERALL SCORE                          │');
    console.log('└─────────────────────────────────────────────────────────┘\n');

    const bestOverall = [...excellent].sort((a, b) => b.score - a.score).slice(0, 10);
    bestOverall.forEach((r, idx) => {
        console.log(`${idx + 1}. ${r.config}`);
        console.log(`   ⭐ Score: ${r.score.toFixed(2)}`);
        console.log(`   Success: ${r.successRate.toFixed(1)}% | Positive: ${r.positiveRate.toFixed(1)}%`);
        console.log(`   Profit: ${r.avgProfitPercent.toFixed(2)}% | Drawdown: ${r.avgDrawdown.toFixed(1)}%`);
        console.log(`   Sharpe: ${r.sharpeRatio.toFixed(3)} | Win Rate: ${r.avgWinRate.toFixed(1)}%`);
        console.log('');
    });

    // 6. ABSOLUTE OPTIMAL
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║         🏆 ABSOLUTE OPTIMAL CONFIGURATION 🏆              ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

    const optimal = bestOverall[0];

    console.log(`Configuration: ${optimal.config}`);
    console.log(`Multiplier: ${optimal.mult}x | Payout: ${optimal.payout}x`);
    console.log(`MaxTimes: ${optimal.maxTimes} | Wait: ${optimal.wait}\n`);

    console.log(`📊 PERFORMANCE (${NUM_SEEDS.toLocaleString()} seeds × ${SESSION_LENGTH} games):\n`);
    console.log(`   💰 Capital: 50,000 bits`);
    console.log(`   ✅ Success Rate: ${optimal.successRate.toFixed(2)}%`);
    console.log(`   💚 Positive Rate: ${optimal.positiveRate.toFixed(2)}%`);
    console.log(`\n   💵 PROFITABILITY:`);
    console.log(`      Average: ${optimal.avgProfit.toFixed(0)} bits (${optimal.avgProfitPercent.toFixed(2)}%)`);
    console.log(`      Median: ${optimal.medianProfit.toFixed(0)} bits`);
    console.log(`      Q1-Q3: ${optimal.q1Profit.toFixed(0)} - ${optimal.q3Profit.toFixed(0)} bits`);
    console.log(`      Range: ${optimal.minProfit.toFixed(0)} to ${optimal.maxProfit.toFixed(0)} bits`);
    console.log(`\n   📈 ADVANCED METRICS:`);
    console.log(`      Sharpe Ratio: ${optimal.sharpeRatio.toFixed(3)}`);
    console.log(`      Sortino Ratio: ${optimal.sortinoRatio.toFixed(3)}`);
    console.log(`      Calmar Ratio: ${optimal.calmarRatio.toFixed(3)}`);
    console.log(`      ROI Efficiency: ${(optimal.roiEfficiency * 100).toFixed(3)}%`);
    console.log(`\n   🛡️ RISK METRICS:`);
    console.log(`      Avg Drawdown: ${optimal.avgDrawdown.toFixed(2)}%`);
    console.log(`      Win Rate: ${optimal.avgWinRate.toFixed(2)}%`);
    console.log(`      Std Deviation: ${optimal.stdDev.toFixed(0)} bits`);

    console.log(`\n🔧 OPTIMAL CONFIGURATION FOR martinSimpleAiv2.js:\n`);
    console.log(`{`);
    console.log(`  payout: ${optimal.payout},`);
    console.log(`  baseBet: 100,`);
    console.log(`  mult: ${optimal.mult},`);
    console.log(`  maxTimes: ${optimal.maxTimes},`);
    console.log(`  waitBeforePlay: ${optimal.wait},`);
    console.log(`  `);
    console.log(`  // Expected Performance (50k bits, 4k games)`);
    console.log(`  expectedProfit: ${optimal.avgProfitPercent.toFixed(2)}%,`);
    console.log(`  successRate: ${optimal.successRate.toFixed(1)}%,`);
    console.log(`  sharpeRatio: ${optimal.sharpeRatio.toFixed(3)}`);
    console.log(`}\n`);

    // Comparison with original
    const original = summary.find(r => r.mult === 1.51 && r.payout === 3.1 && r.maxTimes === 23 && r.wait === 0);
    if (original) {
        console.log('═══════════════════════════════════════════════════════════');
        console.log('       📊 COMPARISON: OPTIMAL vs ORIGINAL                  ');
        console.log('═══════════════════════════════════════════════════════════\n');

        console.log('Original (M1.51-P3.1x-T23-W0):');
        console.log(`   Success: ${original.successRate.toFixed(2)}% | Profit: ${original.avgProfitPercent.toFixed(2)}%`);
        console.log(`   Sharpe: ${original.sharpeRatio.toFixed(3)} | Drawdown: ${original.avgDrawdown.toFixed(2)}%\n`);

        console.log(`Optimal (${optimal.config}):`);
        console.log(`   Success: ${optimal.successRate.toFixed(2)}% | Profit: ${optimal.avgProfitPercent.toFixed(2)}%`);
        console.log(`   Sharpe: ${optimal.sharpeRatio.toFixed(3)} | Drawdown: ${optimal.avgDrawdown.toFixed(2)}%\n`);

        console.log('Improvements:');
        console.log(`   Success Rate: ${(optimal.successRate - original.successRate >= 0 ? '+' : '')}${(optimal.successRate - original.successRate).toFixed(2)}%`);
        console.log(`   Profit: ${(optimal.avgProfitPercent - original.avgProfitPercent >= 0 ? '+' : '')}${(optimal.avgProfitPercent - original.avgProfitPercent).toFixed(2)}%`);
        console.log(`   Sharpe: ${(optimal.sharpeRatio - original.sharpeRatio >= 0 ? '+' : '')}${(optimal.sharpeRatio - original.sharpeRatio).toFixed(3)}`);
        console.log(`   Drawdown: ${(original.avgDrawdown - optimal.avgDrawdown >= 0 ? '-' : '+')}${Math.abs(original.avgDrawdown - optimal.avgDrawdown).toFixed(2)}%\n`);
    }

} else {
    console.log('❌ No excellent configurations found with these parameters.\n');
    console.log('Showing best 10 available:\n');

    const best = summary
        .filter(r => r.successRate > 0 && r.avgProfit > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

    best.forEach((r, idx) => {
        console.log(`${idx + 1}. ${r.config}`);
        console.log(`   Success: ${r.successRate.toFixed(1)}% | Profit: ${r.avgProfit.toFixed(0)} bits (${r.avgProfitPercent.toFixed(2)}%)`);
        console.log('');
    });
}

const endTime = Date.now();
console.log('\n═══════════════════════════════════════════════════════════');
console.log(`Analysis completed in ${((endTime - startTime) / 1000 / 60).toFixed(2)} minutes`);
console.log(`Total simulations: ${total.toLocaleString()}`);
console.log(`Configurations tested: ${configurations.length}`);
console.log('═══════════════════════════════════════════════════════════\n');
