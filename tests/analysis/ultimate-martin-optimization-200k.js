/**
 * ULTIMATE MARTIN OPTIMIZATION - 200,000 SEEDS
 *
 * Analisi definitiva per trovare la CONFIGURAZIONE ASSOLUTA ottimale
 * - Diversi capitali (30k, 40k, 50k, 75k, 100k)
 * - Diverse durate (2k, 3k, 4k, 5k, 6k, 8k partite)
 * - Top 5 configurazioni dalla precedente analisi
 * - 200.000 seed per massima precisione
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
console.log('║   ULTIMATE MARTIN OPTIMIZATION - 100,000 SEEDS             ║');
console.log('║   Finding ABSOLUTE OPTIMAL Configuration                   ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

const NUM_SEEDS = 100000;

// Test different session lengths
const SESSION_LENGTHS = [2000, 3000, 4000, 5000, 6000, 8000];

// Test different capital levels
const CAPITAL_LEVELS = [
    3000000,   // 30k bits
    4000000,   // 40k bits
    5000000,   // 50k bits
    7500000,   // 75k bits
    10000000,  // 100k bits
];

// Top configurations from previous analysis
const topConfigs = [
    { baseBet: 100, payout: 3.2, mult: 1.45, maxTimes: 25, waitBeforePlay: 0, name: 'M1.45-P3.2x-T25-W0' },
    { baseBet: 100, payout: 3.1, mult: 1.48, maxTimes: 25, waitBeforePlay: 0, name: 'M1.48-P3.1x-T25-W0' },
    { baseBet: 100, payout: 3.2, mult: 1.48, maxTimes: 25, waitBeforePlay: 0, name: 'M1.48-P3.2x-T25-W0' },
    { baseBet: 100, payout: 3.0, mult: 1.51, maxTimes: 23, waitBeforePlay: 2, name: 'M1.51-P3x-T23-W2' },
    { baseBet: 100, payout: 3.0, mult: 1.48, maxTimes: 25, waitBeforePlay: 0, name: 'M1.48-P3x-T25-W0' },
];

console.log('📋 TEST CONFIGURATION:\n');
console.log(`   Seeds: ${NUM_SEEDS.toLocaleString()}`);
console.log(`   Session lengths: ${SESSION_LENGTHS.map(l => `${(l/1000).toFixed(1)}k`).join(', ')} games`);
console.log(`   Capital levels: ${CAPITAL_LEVELS.map(c => `${(c/100/1000).toFixed(0)}k`).join(', ')} bits`);
console.log(`   Configurations: ${topConfigs.length}`);

const totalTests = NUM_SEEDS * SESSION_LENGTHS.length * CAPITAL_LEVELS.length * topConfigs.length;
console.log(`\n   Total tests: ${totalTests.toLocaleString()}\n`);

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const startTime = Date.now();
const results = {};

// Initialize results structure
topConfigs.forEach(config => {
    results[config.name] = {};
    CAPITAL_LEVELS.forEach(capital => {
        results[config.name][capital] = {};
        SESSION_LENGTHS.forEach(length => {
            results[config.name][capital][length] = [];
        });
    });
});

let completed = 0;
let lastProgress = 0;

// Generate all seeds first for consistency
console.log('Generating seeds...\n');
const allSeeds = {};
SESSION_LENGTHS.forEach(length => {
    allSeeds[length] = [];
});

for (let seedNum = 0; seedNum < NUM_SEEDS; seedNum++) {
    const seedValue = Date.now() + seedNum + Math.floor(Math.random() * 1000000);
    SESSION_LENGTHS.forEach(length => {
        allSeeds[length].push(generateSeed(length, seedValue + length));
    });

    if ((seedNum + 1) % 20000 === 0) {
        process.stdout.write(`\r  Seeds generated: ${seedNum + 1}/${NUM_SEEDS}`);
    }
}

console.log('\n\n✓ Seeds generated! Running simulations...\n');

// Run simulations
for (let seedNum = 0; seedNum < NUM_SEEDS; seedNum++) {
    SESSION_LENGTHS.forEach(length => {
        const seed = allSeeds[length][seedNum];

        CAPITAL_LEVELS.forEach(capital => {
            topConfigs.forEach(config => {
                const result = simulateMartinAI(seed, capital, config);
                results[config.name][capital][length].push(result);

                completed++;
                const progress = Math.floor((completed / totalTests) * 100);
                if (progress !== lastProgress && progress % 1 === 0) {
                    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
                    const eta = ((elapsed / completed) * (totalTests - completed)).toFixed(0);
                    process.stdout.write(`\r  Progress: ${progress}% | Time: ${elapsed}s | ETA: ${eta}s`);
                    lastProgress = progress;
                }
            });
        });
    });
}

console.log('\n\n✓ All simulations completed!\n');

// ==================== ANALYSIS ====================

console.log('═══════════════════════════════════════════════════════════');
console.log('                  COMPREHENSIVE ANALYSIS                    ');
console.log('═══════════════════════════════════════════════════════════\n');

const summary = [];

topConfigs.forEach(config => {
    CAPITAL_LEVELS.forEach(capital => {
        SESSION_LENGTHS.forEach(length => {
            const data = results[config.name][capital][length];
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
                const calmarRatio = avgProfitPercent / Math.max(avgDrawdown, 1);
                const roiEfficiency = avgProfit / capital;

                // Profit per hour estimate (assuming 1 game = 30 seconds)
                const timeHours = (length * 30) / 3600;
                const profitPerHour = (avgProfit / 100) / timeHours;

                summary.push({
                    config: config.name,
                    capital,
                    capitalBits: capital / 100,
                    length,
                    timeHours: timeHours.toFixed(1),
                    successRate,
                    positiveRate,
                    avgProfit: avgProfit / 100,
                    medianProfit: medianProfit / 100,
                    q1Profit: q1 / 100,
                    q3Profit: q3 / 100,
                    avgProfitPercent,
                    avgDrawdown,
                    stdDev: stdDev / 100,
                    sharpeRatio,
                    calmarRatio,
                    roiEfficiency,
                    profitPerHour,
                    score: successRate * 0.3 + positiveRate * 0.2 + sharpeRatio * 12 + (avgProfitPercent * 1.5) - avgDrawdown * 0.4
                });
            }
        });
    });
});

// Filter excellent configurations
const excellent = summary.filter(r =>
    r.successRate >= 92 &&
    r.positiveRate >= 90 &&
    r.avgProfit > 0 &&
    r.sharpeRatio > 0.5
);

console.log(`Excellent configurations found: ${excellent.length}\n`);

if (excellent.length > 0) {
    // 1. BEST OVERALL SCORE
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║         🏆 TOP 10: BEST OVERALL CONFIGURATIONS            ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

    const bestOverall = [...excellent].sort((a, b) => b.score - a.score).slice(0, 10);
    bestOverall.forEach((r, idx) => {
        console.log(`${idx + 1}. ${r.config} | ${(r.capitalBits/1000).toFixed(0)}k bits | ${(r.length/1000).toFixed(1)}k games`);
        console.log(`   ⭐ Score: ${r.score.toFixed(2)}`);
        console.log(`   Success: ${r.successRate.toFixed(1)}% | Positive: ${r.positiveRate.toFixed(1)}%`);
        console.log(`   Profit: ${r.avgProfit.toFixed(0)} bits (${r.avgProfitPercent.toFixed(2)}%)`);
        console.log(`   Time: ${r.timeHours}h | $/h: ${r.profitPerHour.toFixed(0)} bits/h`);
        console.log(`   Sharpe: ${r.sharpeRatio.toFixed(2)} | Drawdown: ${r.avgDrawdown.toFixed(1)}%`);
        console.log('');
    });

    // 2. BEST PROFIT %
    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│  💰 TOP 10: HIGHEST PROFIT PERCENTAGE                   │');
    console.log('└─────────────────────────────────────────────────────────┘\n');

    const bestProfit = [...excellent].sort((a, b) => b.avgProfitPercent - a.avgProfitPercent).slice(0, 10);
    bestProfit.forEach((r, idx) => {
        console.log(`${idx + 1}. ${r.config} | ${(r.capitalBits/1000).toFixed(0)}k bits | ${(r.length/1000).toFixed(1)}k games`);
        console.log(`   💰 Profit: ${r.avgProfitPercent.toFixed(2)}% (${r.avgProfit.toFixed(0)} bits) ⭐`);
        console.log(`   Success: ${r.successRate.toFixed(1)}% | Time: ${r.timeHours}h`);
        console.log('');
    });

    // 3. BEST PROFIT PER HOUR
    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│  ⚡ TOP 10: BEST PROFIT PER HOUR                        │');
    console.log('└─────────────────────────────────────────────────────────┘\n');

    const bestPerHour = [...excellent].sort((a, b) => b.profitPerHour - a.profitPerHour).slice(0, 10);
    bestPerHour.forEach((r, idx) => {
        console.log(`${idx + 1}. ${r.config} | ${(r.capitalBits/1000).toFixed(0)}k bits | ${(r.length/1000).toFixed(1)}k games`);
        console.log(`   ⚡ ${r.profitPerHour.toFixed(0)} bits/hour ⭐`);
        console.log(`   Profit: ${r.avgProfit.toFixed(0)} bits (${r.avgProfitPercent.toFixed(2)}%) | Time: ${r.timeHours}h`);
        console.log(`   Success: ${r.successRate.toFixed(1)}%`);
        console.log('');
    });

    // 4. BEST BY CAPITAL EFFICIENCY
    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│  🎯 TOP 10: MINIMUM CAPITAL REQUIRED                    │');
    console.log('└─────────────────────────────────────────────────────────┘\n');

    const bestCapital = [...excellent]
        .sort((a, b) => {
            if (a.capital !== b.capital) return a.capital - b.capital;
            return b.score - a.score;
        })
        .slice(0, 10);

    bestCapital.forEach((r, idx) => {
        console.log(`${idx + 1}. ${r.config} | ${(r.length/1000).toFixed(1)}k games`);
        console.log(`   💰 Capital: ${(r.capitalBits/1000).toFixed(0)}k bits ⭐`);
        console.log(`   Success: ${r.successRate.toFixed(1)}% | Profit: ${r.avgProfitPercent.toFixed(2)}%`);
        console.log(`   Score: ${r.score.toFixed(2)}`);
        console.log('');
    });

    // 5. ABSOLUTE OPTIMAL
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║      🏆🏆🏆 ABSOLUTE OPTIMAL CONFIGURATION 🏆🏆🏆          ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

    const optimal = bestOverall[0];

    console.log(`Configuration: ${optimal.config}`);
    console.log(`Capital: ${(optimal.capitalBits/1000).toFixed(0)}k bits (${optimal.capitalBits.toLocaleString()} bits)`);
    console.log(`Session Length: ${(optimal.length/1000).toFixed(1)}k games (${optimal.length.toLocaleString()} games)`);
    console.log(`Session Time: ${optimal.timeHours} hours\n`);

    console.log(`📊 PERFORMANCE (${NUM_SEEDS.toLocaleString()} seeds tested):\n`);
    console.log(`   ✅ Success Rate: ${optimal.successRate.toFixed(2)}%`);
    console.log(`   💚 Positive Rate: ${optimal.positiveRate.toFixed(2)}%`);
    console.log(`\n   💵 PROFITABILITY:`);
    console.log(`      Average: ${optimal.avgProfit.toFixed(0)} bits (${optimal.avgProfitPercent.toFixed(2)}%)`);
    console.log(`      Median: ${optimal.medianProfit.toFixed(0)} bits`);
    console.log(`      Per Hour: ${optimal.profitPerHour.toFixed(0)} bits/h`);
    console.log(`      Q1-Q3: ${optimal.q1Profit.toFixed(0)} - ${optimal.q3Profit.toFixed(0)} bits`);
    console.log(`\n   📈 ADVANCED METRICS:`);
    console.log(`      Sharpe Ratio: ${optimal.sharpeRatio.toFixed(3)}`);
    console.log(`      Calmar Ratio: ${optimal.calmarRatio.toFixed(3)}`);
    console.log(`      ROI Efficiency: ${(optimal.roiEfficiency * 100).toFixed(3)}%`);
    console.log(`      Overall Score: ${optimal.score.toFixed(2)}`);
    console.log(`\n   🛡️ RISK METRICS:`);
    console.log(`      Avg Drawdown: ${optimal.avgDrawdown.toFixed(2)}%`);
    console.log(`      Std Deviation: ${optimal.stdDev.toFixed(0)} bits`);

    console.log(`\n🔧 OPTIMAL CONFIGURATION:\n`);
    const optimalConfig = topConfigs.find(c => c.name === optimal.config);
    console.log(`{`);
    console.log(`  payout: ${optimalConfig.payout},`);
    console.log(`  baseBet: ${optimalConfig.baseBet},`);
    console.log(`  mult: ${optimalConfig.mult},`);
    console.log(`  maxTimes: ${optimalConfig.maxTimes},`);
    console.log(`  waitBeforePlay: ${optimalConfig.waitBeforePlay},`);
    console.log(`  `);
    console.log(`  // Optimal Settings`);
    console.log(`  capital: ${optimal.capital},  // ${(optimal.capitalBits/1000).toFixed(0)}k bits`);
    console.log(`  sessionGames: ${optimal.length},  // ${(optimal.length/1000).toFixed(1)}k games (~${optimal.timeHours}h)`);
    console.log(`  `);
    console.log(`  // Expected Performance`);
    console.log(`  expectedProfit: ${optimal.avgProfitPercent.toFixed(2)}%,  // ${optimal.avgProfit.toFixed(0)} bits`);
    console.log(`  successRate: ${optimal.successRate.toFixed(1)}%,`);
    console.log(`  profitPerHour: ${optimal.profitPerHour.toFixed(0)},  // bits/hour`);
    console.log(`  sharpeRatio: ${optimal.sharpeRatio.toFixed(3)}`);
    console.log(`}\n`);

    // Comparison table by session length
    console.log('═══════════════════════════════════════════════════════════');
    console.log('     📊 COMPARISON: SESSION LENGTH IMPACT                  ');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log(`Configuration: ${optimal.config} with ${(optimal.capitalBits/1000).toFixed(0)}k bits\n`);

    const lengthComparison = summary
        .filter(r => r.config === optimal.config && r.capital === optimal.capital && r.successRate >= 90)
        .sort((a, b) => a.length - b.length);

    lengthComparison.forEach(r => {
        console.log(`${(r.length/1000).toFixed(1)}k games (${r.timeHours}h):`);
        console.log(`   Success: ${r.successRate.toFixed(1)}% | Profit: ${r.avgProfitPercent.toFixed(2)}% (${r.avgProfit.toFixed(0)} bits)`);
        console.log(`   $/h: ${r.profitPerHour.toFixed(0)} bits/h | Sharpe: ${r.sharpeRatio.toFixed(2)}`);
        console.log('');
    });

} else {
    console.log('❌ No excellent configurations found with these criteria.\n');
}

const endTime = Date.now();
console.log('\n═══════════════════════════════════════════════════════════');
console.log(`Analysis completed in ${((endTime - startTime) / 1000 / 60).toFixed(2)} minutes`);
console.log(`Total simulations: ${totalTests.toLocaleString()}`);
console.log(`Seeds tested: ${NUM_SEEDS.toLocaleString()}`);
console.log('═══════════════════════════════════════════════════════════\n');
