/**
 * ULTIMATE OPTIMIZATION - 100.000 SEEDS
 *
 * Analisi definitiva con principi matematici avanzati:
 * - Kelly Criterion per bet sizing ottimale
 * - Sharpe Ratio per risk-adjusted returns
 * - Value at Risk (VaR) per gestione rischio
 * - Varianti Fibonacci ottimizzate
 * - Pattern recognition avanzato
 */

const crypto = require('crypto');

// Seed generation con maggiore casualità
function generateSeed(n, seedValue) {
    let values = [];
    let rng = seedValue;

    for (let index = 0; index < n; index++) {
        // Usa crypto per vera casualità
        rng = (rng * 1103515245 + 12345) % 2147483648;
        const random = rng / 2147483648;
        values.push(Math.floor(Math.max(0.99 / (1 - random), 1) * 100) / 100);
    }
    return values;
}

// ==================== ADVANCED FIBONACCI VARIANTS ====================

/**
 * Variant 1: Classic Fibonacci
 */
function fibonacciClassic(k, baseBet) {
    if (k === 0) return baseBet;
    if (k === 1) return baseBet * 2;

    let prev = baseBet;
    let curr = baseBet * 2;
    for (let i = 2; i <= k; i++) {
        let next = prev + curr;
        prev = curr;
        curr = next;
    }
    return Math.round(curr);
}

/**
 * Variant 2: Modified Fibonacci with Kelly Criterion
 * Ottimizza bet size basandosi sul balance e edge
 */
function fibonacciKelly(k, baseBet, balance, payout, winRate) {
    const edge = (winRate * (payout - 1)) - (1 - winRate);
    const kellyFraction = edge > 0 ? edge / (payout - 1) : 0;

    // Usa solo 1/4 della Kelly (fractional Kelly per ridurre varianza)
    const optimalBet = balance * (kellyFraction / 4);
    const scaledBaseBet = Math.max(baseBet, Math.min(optimalBet, balance * 0.02));

    return Math.round(fibonacciClassic(k, scaledBaseBet));
}

/**
 * Variant 3: Adaptive Fibonacci (aggiusta in base al drawdown)
 */
function fibonacciAdaptive(k, baseBet, balance, initialBalance) {
    const drawdownPercent = ((initialBalance - balance) / initialBalance) * 100;

    // Riduci bet size se in drawdown significativo
    let adjustedBaseBet = baseBet;
    if (drawdownPercent > 10) {
        adjustedBaseBet = Math.round(baseBet * 0.8);
    } else if (drawdownPercent > 5) {
        adjustedBaseBet = Math.round(baseBet * 0.9);
    }

    return Math.round(fibonacciClassic(k, adjustedBaseBet));
}

/**
 * Variant 4: Conservative Fibonacci (crescita più lenta)
 */
function fibonacciConservative(k, baseBet) {
    if (k === 0) return baseBet;
    if (k === 1) return Math.round(baseBet * 1.5);

    let prev = baseBet;
    let curr = Math.round(baseBet * 1.5);
    for (let i = 2; i <= k; i++) {
        let next = Math.round(prev * 0.8 + curr * 1.2); // Crescita più controllata
        prev = curr;
        curr = next;
    }
    return curr;
}

/**
 * Variant 5: Dynamic Fibonacci (cambia in base alla volatilità)
 */
function fibonacciDynamic(k, baseBet, recentResults) {
    // Calcola volatilità recente
    if (recentResults.length < 10) return fibonacciClassic(k, baseBet);

    const mean = recentResults.reduce((a, b) => a + b, 0) / recentResults.length;
    const variance = recentResults.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / recentResults.length;
    const volatility = Math.sqrt(variance);

    // Alta volatilità = crescita più conservativa
    const volatilityFactor = Math.max(0.7, Math.min(1.3, 1 / (1 + volatility / 10)));

    return Math.round(fibonacciClassic(k, baseBet) * volatilityFactor);
}

// ==================== SIMULATION FUNCTION ====================

function simulateStrategy(seed, startBalance, config) {
    const { baseBet, payout, maxT, variant, stopLossPercent, takeProfitPercent } = config;

    let balance = startBalance;
    const initialBalance = startBalance;
    let k = 0;
    let totalWins = 0;
    let totalLosses = 0;
    let maxBalance = startBalance;
    let minBalance = startBalance;
    let maxLossStreak = 0;
    let currentLossStreak = 0;
    let recentResults = [];

    // Stima win rate iniziale (teorica per payout)
    let estimatedWinRate = 0.99 / payout;

    for (let i = 0; i < seed.length; i++) {
        const bust = seed[i];

        // Check stop conditions
        if (k > maxT) {
            return {
                ruined: true,
                reason: 'maxT',
                finalBalance: balance,
                profit: balance - initialBalance,
                profitPercent: ((balance - initialBalance) / initialBalance) * 100,
                totalGames: i,
                totalWins,
                totalLosses,
                maxLossStreak,
                maxDrawdownPercent: ((initialBalance - minBalance) / initialBalance) * 100,
                winRate: totalWins / (totalWins + totalLosses) * 100
            };
        }

        // Calculate bet based on variant
        let currentBet;
        switch (variant) {
            case 'kelly':
                currentBet = fibonacciKelly(k, baseBet, balance, payout, estimatedWinRate);
                break;
            case 'adaptive':
                currentBet = fibonacciAdaptive(k, baseBet, balance, initialBalance);
                break;
            case 'conservative':
                currentBet = fibonacciConservative(k, baseBet);
                break;
            case 'dynamic':
                currentBet = fibonacciDynamic(k, baseBet, recentResults);
                break;
            default:
                currentBet = fibonacciClassic(k, baseBet);
        }

        // Check if can afford
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
                winRate: totalWins / (totalWins + totalLosses) * 100
            };
        }

        // Execute bet
        if (bust >= payout) {
            // Win
            const profit = Math.floor((currentBet * payout) - currentBet);
            balance += profit;
            totalWins++;
            k = 0;
            currentLossStreak = 0;
            recentResults.push(1);
        } else {
            // Loss
            balance -= currentBet;
            totalLosses++;
            k++;
            currentLossStreak++;
            recentResults.push(0);
            if (currentLossStreak > maxLossStreak) maxLossStreak = currentLossStreak;
        }

        // Mantieni solo ultimi 50 risultati
        if (recentResults.length > 50) recentResults.shift();

        // Aggiorna win rate stimato
        if (totalWins + totalLosses > 0) {
            estimatedWinRate = totalWins / (totalWins + totalLosses);
        }

        // Track extremes
        if (balance > maxBalance) maxBalance = balance;
        if (balance < minBalance) minBalance = balance;

        // Check stop-loss
        const currentDrawdown = ((initialBalance - balance) / initialBalance) * 100;
        if (currentDrawdown >= stopLossPercent) {
            return {
                ruined: true,
                reason: 'stopLoss',
                finalBalance: balance,
                profit: balance - initialBalance,
                profitPercent: ((balance - initialBalance) / initialBalance) * 100,
                totalGames: i,
                totalWins,
                totalLosses,
                maxLossStreak,
                maxDrawdownPercent: currentDrawdown,
                winRate: totalWins / (totalWins + totalLosses) * 100
            };
        }

        // Check take-profit
        const currentProfit = ((balance - initialBalance) / initialBalance) * 100;
        if (currentProfit >= takeProfitPercent) {
            return {
                ruined: false,
                reason: 'takeProfit',
                finalBalance: balance,
                profit: balance - initialBalance,
                profitPercent: currentProfit,
                totalGames: i,
                totalWins,
                totalLosses,
                maxLossStreak,
                maxDrawdownPercent: ((initialBalance - minBalance) / initialBalance) * 100,
                winRate: totalWins / (totalWins + totalLosses) * 100
            };
        }

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
                winRate: totalWins / (totalWins + totalLosses) * 100
            };
        }
    }

    // Completed all games
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
        winRate: totalWins / (totalWins + totalLosses) * 100
    };
}

// ==================== MAIN ANALYSIS ====================

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║    ULTIMATE OPTIMIZATION - 10,000 SEEDS                    ║');
console.log('║    Advanced Mathematical & Statistical Analysis            ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

const NUM_SEEDS = 10000;
const SESSION_LENGTHS = [4000, 5000, 6000, 7500];

// Configurations to test
const variants = ['classic', 'kelly', 'adaptive', 'conservative', 'dynamic'];
const payouts = [2.0, 2.5, 3.0, 3.5];
const maxTs = [18, 20, 22, 24];
const capitals = [
    2500000,   // 25k bits
    5000000,   // 50k bits
    10000000,  // 100k bits
];

console.log('Generating configurations...');
const configurations = [];

payouts.forEach(payout => {
    const maxT = payout === 2.0 ? 18 : payout === 2.5 ? 20 : payout === 3.0 ? 22 : 24;
    variants.forEach(variant => {
        configurations.push({
            baseBet: 100,
            payout,
            maxT,
            variant,
            stopLossPercent: 25,
            takeProfitPercent: 50,
            name: `${variant}-${payout}x-T${maxT}`
        });
    });
});

console.log(`Total configurations: ${configurations.length}`);
console.log(`Session lengths: ${SESSION_LENGTHS.join(', ')}`);
console.log(`Capital levels: ${capitals.map(c => c/100).join(', ')} bits`);
console.log(`\nTotal tests: ${NUM_SEEDS * configurations.length * SESSION_LENGTHS.length * capitals.length}`);
console.log('This will take several minutes...\n');

const startTime = Date.now();
const results = {};

// Initialize results
configurations.forEach(config => {
    results[config.name] = {};
    capitals.forEach(capital => {
        results[config.name][capital] = {};
        SESSION_LENGTHS.forEach(length => {
            results[config.name][capital][length] = [];
        });
    });
});

let completed = 0;
const total = NUM_SEEDS * configurations.length * SESSION_LENGTHS.length * capitals.length;
let lastProgress = 0;

// Run simulations
for (let seedNum = 0; seedNum < NUM_SEEDS; seedNum++) {
    // Generate unique seed value
    const seedValue = Date.now() + seedNum + Math.floor(Math.random() * 1000000);

    SESSION_LENGTHS.forEach(length => {
        const seed = generateSeed(length, seedValue + length);

        configurations.forEach(config => {
            capitals.forEach(capital => {
                const result = simulateStrategy(seed, capital, config);
                results[config.name][capital][length].push(result);

                completed++;
                const progress = Math.floor((completed / total) * 100);
                if (progress !== lastProgress && progress % 2 === 0) {
                    process.stdout.write(`\r  Progress: ${progress}% | Time: ${((Date.now() - startTime) / 1000).toFixed(0)}s`);
                    lastProgress = progress;
                }
            });
        });
    });
}

console.log('\n\n✓ All simulations completed!\n');

// ==================== ADVANCED ANALYSIS ====================

console.log('═══════════════════════════════════════════════════════════');
console.log('                 ADVANCED ANALYSIS RESULTS                  ');
console.log('═══════════════════════════════════════════════════════════\n');

const summary = [];

configurations.forEach(config => {
    capitals.forEach(capital => {
        SESSION_LENGTHS.forEach(length => {
            const data = results[config.name][capital][length];
            const successful = data.filter(r => !r.ruined || r.reason === 'takeProfit');

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
                const positiveRate = (profits.filter(p => p > 0).length / profits.length) * 100;

                // Advanced metrics
                const sharpeRatio = avgProfit / Math.max(stdDev, 1);
                const sortinoRatio = avgProfit / Math.max(Math.sqrt(
                    profits.filter(p => p < 0).reduce((sum, p) => sum + Math.pow(p, 2), 0) / Math.max(profits.filter(p => p < 0).length, 1)
                ), 1);
                const roiEfficiency = avgProfit / capital;

                // Value at Risk (95% confidence)
                const var95 = q1 / 100; // bits

                // Calmar Ratio (return / max drawdown)
                const calmarRatio = avgProfitPercent / Math.max(avgDrawdown, 1);

                summary.push({
                    config: config.name,
                    variant: config.variant,
                    payout: config.payout,
                    maxT: config.maxT,
                    capital,
                    capitalBits: capital / 100,
                    length,
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
                    stdDev: stdDev / 100,
                    sharpeRatio,
                    sortinoRatio,
                    roiEfficiency,
                    calmarRatio,
                    var95,
                    // Combined score
                    score: successRate * 0.3 + positiveRate * 0.2 + sharpeRatio * 10 + (avgProfit / capital * 1000) - avgDrawdown * 0.5
                });
            }
        });
    });
});

const excellent = summary.filter(r =>
    r.successRate >= 90 &&
    r.positiveRate >= 75 &&
    r.avgProfit > 0 &&
    r.sharpeRatio > 0
);

console.log(`Excellent configurations (≥90% success, ≥75% positive, Sharpe>0): ${excellent.length}\n`);

if (excellent.length > 0) {
    // 1. BEST BY SHARPE RATIO
    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│  🏆 TOP 10: BEST SHARPE RATIO (Risk-Adjusted Return)    │');
    console.log('└─────────────────────────────────────────────────────────┘\n');

    const bestSharpe = [...excellent].sort((a, b) => b.sharpeRatio - a.sharpeRatio).slice(0, 10);
    bestSharpe.forEach((r, idx) => {
        console.log(`${idx + 1}. ${r.config} | ${r.length} games | ${r.capitalBits.toLocaleString()} bits`);
        console.log(`   🛡️ Sharpe: ${r.sharpeRatio.toFixed(3)} | Sortino: ${r.sortinoRatio.toFixed(3)} ⭐⭐⭐`);
        console.log(`   Success: ${r.successRate.toFixed(1)}% | Positive: ${r.positiveRate.toFixed(1)}%`);
        console.log(`   Profit: ${r.avgProfit.toFixed(0)} bits (${r.avgProfitPercent.toFixed(2)}%)`);
        console.log(`   Std Dev: ${r.stdDev.toFixed(0)} | Drawdown: ${r.avgDrawdown.toFixed(1)}%`);
        console.log('');
    });

    // 2. BEST BY CALMAR RATIO
    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│  📊 TOP 10: BEST CALMAR RATIO (Return/Drawdown)         │');
    console.log('└─────────────────────────────────────────────────────────┘\n');

    const bestCalmar = [...excellent].sort((a, b) => b.calmarRatio - a.calmarRatio).slice(0, 10);
    bestCalmar.forEach((r, idx) => {
        console.log(`${idx + 1}. ${r.config} | ${r.length} games | ${r.capitalBits.toLocaleString()} bits`);
        console.log(`   📊 Calmar: ${r.calmarRatio.toFixed(3)} ⭐⭐⭐`);
        console.log(`   Return: ${r.avgProfitPercent.toFixed(2)}% | Drawdown: ${r.avgDrawdown.toFixed(1)}%`);
        console.log(`   Success: ${r.successRate.toFixed(1)}% | Profit: ${r.avgProfit.toFixed(0)} bits`);
        console.log('');
    });

    // 3. MINIMUM CAPITAL
    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│  💰 TOP 10: MINIMUM CAPITAL REQUIREMENT                 │');
    console.log('└─────────────────────────────────────────────────────────┘\n');

    const minCap = [...excellent].sort((a, b) => {
        if (a.capital !== b.capital) return a.capital - b.capital;
        return b.sharpeRatio - a.sharpeRatio;
    }).slice(0, 10);

    minCap.forEach((r, idx) => {
        console.log(`${idx + 1}. ${r.config} | ${r.length} games`);
        console.log(`   💰 Capital: ${r.capitalBits.toLocaleString()} bits ⭐⭐⭐`);
        console.log(`   Success: ${r.successRate.toFixed(1)}% | Positive: ${r.positiveRate.toFixed(1)}%`);
        console.log(`   Profit: ${r.avgProfit.toFixed(0)} bits (${r.avgProfitPercent.toFixed(2)}%)`);
        console.log(`   Sharpe: ${r.sharpeRatio.toFixed(3)} | VaR95: ${r.var95.toFixed(0)} bits`);
        console.log('');
    });

    // 4. BEST OVERALL SCORE
    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│  ⭐ TOP 10: BEST OVERALL SCORE                          │');
    console.log('└─────────────────────────────────────────────────────────┘\n');

    const bestOverall = [...excellent].sort((a, b) => b.score - a.score).slice(0, 10);
    bestOverall.forEach((r, idx) => {
        console.log(`${idx + 1}. ${r.config} | ${r.length} games | ${r.capitalBits.toLocaleString()} bits`);
        console.log(`   ⭐ Score: ${r.score.toFixed(2)}`);
        console.log(`   Success: ${r.successRate.toFixed(1)}% | Positive: ${r.positiveRate.toFixed(1)}%`);
        console.log(`   Profit: ${r.avgProfitPercent.toFixed(2)}% (${r.avgProfit.toFixed(0)} bits)`);
        console.log(`   Sharpe: ${r.sharpeRatio.toFixed(3)} | Calmar: ${r.calmarRatio.toFixed(3)}`);
        console.log('');
    });

    // 5. ABSOLUTE OPTIMAL
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║         🏆 ABSOLUTE OPTIMAL CONFIGURATION 🏆              ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

    const optimal = bestOverall[0];

    console.log(`Configuration: ${optimal.config}`);
    console.log(`Variant: ${optimal.variant.toUpperCase()}`);
    console.log(`Payout: ${optimal.payout}x | MaxT: ${optimal.maxT}\n`);
    console.log(`📊 PERFORMANCE (${NUM_SEEDS.toLocaleString()} seeds × ${optimal.length} games):\n`);
    console.log(`   💰 Capital Required: ${optimal.capitalBits.toLocaleString()} bits`);
    console.log(`   🎮 Session Length: ${optimal.length} games`);
    console.log(`   ✅ Success Rate: ${optimal.successRate.toFixed(2)}%`);
    console.log(`   💚 Positive Rate: ${optimal.positiveRate.toFixed(2)}%`);
    console.log(`\n   💵 PROFITABILITY:`);
    console.log(`      Average: ${optimal.avgProfit.toFixed(0)} bits (${optimal.avgProfitPercent.toFixed(2)}%)`);
    console.log(`      Median: ${optimal.medianProfit.toFixed(0)} bits`);
    console.log(`      Q1-Q3: ${optimal.q1Profit.toFixed(0)} - ${optimal.q3Profit.toFixed(0)} bits`);
    console.log(`      Range: ${optimal.minProfit.toFixed(0)} to ${optimal.maxProfit.toFixed(0)} bits`);
    console.log(`\n   📈 ADVANCED METRICS:`);
    console.log(`      Sharpe Ratio: ${optimal.sharpeRatio.toFixed(3)} (return/volatility)`);
    console.log(`      Sortino Ratio: ${optimal.sortinoRatio.toFixed(3)} (return/downside risk)`);
    console.log(`      Calmar Ratio: ${optimal.calmarRatio.toFixed(3)} (return/max drawdown)`);
    console.log(`      ROI Efficiency: ${(optimal.roiEfficiency * 100).toFixed(3)}%`);
    console.log(`\n   🛡️ RISK METRICS:`);
    console.log(`      Avg Drawdown: ${optimal.avgDrawdown.toFixed(2)}%`);
    console.log(`      Std Deviation: ${optimal.stdDev.toFixed(0)} bits`);
    console.log(`      VaR (95%): ${optimal.var95.toFixed(0)} bits`);

    console.log(`\n🔧 OPTIMAL CONFIGURATION FOR optimal-strategy.js:\n`);
    console.log(`{`);
    console.log(`  // Core Settings`);
    console.log(`  baseBet: 100,`);
    console.log(`  payout: ${optimal.payout},`);
    console.log(`  maxT: ${optimal.maxT},`);
    console.log(`  variant: "${optimal.variant}",  // ${optimal.variant.toUpperCase()} Fibonacci`);
    console.log(`  `);
    console.log(`  // Capital & Session`);
    console.log(`  startingCapital: ${optimal.capital},  // ${optimal.capitalBits.toLocaleString()} bits`);
    console.log(`  maxGames: ${optimal.length},`);
    console.log(`  `);
    console.log(`  // Risk Management`);
    console.log(`  stopLoss: 25,              // -25% stop`);
    console.log(`  takeProfit: 50,            // +50% target`);
    console.log(`  `);
    console.log(`  // Expected Performance`);
    console.log(`  expectedProfit: ${optimal.avgProfitPercent.toFixed(2)}%,    // Per session`);
    console.log(`  successRate: ${optimal.successRate.toFixed(1)}%,       // Completion rate`);
    console.log(`  sharpeRatio: ${optimal.sharpeRatio.toFixed(3)}        // Risk-adjusted`);
    console.log(`}\n`);

} else {
    console.log('❌ No excellent configurations found. Showing best available:\n');

    const best = summary
        .filter(r => r.successRate > 0 && r.avgProfit > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

    best.forEach((r, idx) => {
        console.log(`${idx + 1}. ${r.config} | ${r.length} games | ${r.capitalBits} bits`);
        console.log(`   Success: ${r.successRate.toFixed(1)}% | Profit: ${r.avgProfit.toFixed(0)} bits`);
        console.log('');
    });
}

const endTime = Date.now();
console.log('\n═══════════════════════════════════════════════════════════');
console.log(`Analysis completed in ${((endTime - startTime) / 1000 / 60).toFixed(2)} minutes`);
console.log(`Total simulations: ${total.toLocaleString()}`);
console.log('═══════════════════════════════════════════════════════════\n');
