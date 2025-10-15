/**
 * MARTIN SIMPLE AI V2 - ANALYSIS
 *
 * Test del tuo algoritmo Martingale modificato su 50.000 seed
 * Confronto con Adaptive Fibonacci
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

// ==================== MARTIN SIMPLE AI V2 ====================
function simulateMartinSimpleAI(seed, startBalance, config) {
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

    // State machine
    const STATE = { WAITING: 'waiting', BETTING: 'betting' };
    let state = waitBeforePlay === 0 ? STATE.BETTING : STATE.WAITING;
    let waitRemaining = waitBeforePlay;

    for (let i = 0; i < seed.length; i++) {
        const bust = seed[i];

        // WAITING state
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

        // BETTING state
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

        // Place bet
        if (bust >= payout) {
            // WIN
            const profit = Math.floor((currentBet * payout) - currentBet);
            balance += profit;
            totalWins++;
            currentLossStreak = 0;

            // Reset
            currentBet = baseBet;
            currentTimes = 0;

            // Go to WAITING if configured
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

            // Check maxTimes
            if (maxTimes > 0 && currentTimes >= maxTimes) {
                // Reset to base bet
                currentBet = baseBet;
                currentTimes = 0;

                if (waitBeforePlay > 0) {
                    state = STATE.WAITING;
                    waitRemaining = waitBeforePlay;
                }
            } else {
                // Increase bet by mult
                currentBet = Math.ceil((currentBet / 100) * mult) * 100;
            }
        }

        // Track extremes
        if (balance > maxBalance) maxBalance = balance;
        if (balance < minBalance) minBalance = balance;

        // Check ruin
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
        winRate: totalWins / Math.max(totalWins + totalLosses, 1) * 100
    };
}

// ==================== ADAPTIVE FIBONACCI (per confronto) ====================
function simulateAdaptiveFibonacci(seed, startBalance, config) {
    const { baseBet, payout, maxT } = config;

    let balance = startBalance;
    const initialBalance = startBalance;
    let k = 0;
    let prevBet = 0;
    let currentBet = baseBet;
    let totalWins = 0;
    let totalLosses = 0;
    let maxBalance = startBalance;
    let minBalance = startBalance;
    let maxLossStreak = 0;
    let currentLossStreak = 0;

    for (let i = 0; i < seed.length; i++) {
        const bust = seed[i];

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
                winRate: totalWins / Math.max(totalWins + totalLosses, 1) * 100
            };
        }

        // Calculate adaptive bet
        const drawdownPercent = ((initialBalance - balance) / initialBalance) * 100;
        let adjustedBaseBet = baseBet;
        if (drawdownPercent > 10) adjustedBaseBet = Math.round(baseBet * 0.8);
        else if (drawdownPercent > 5) adjustedBaseBet = Math.round(baseBet * 0.9);

        // Fibonacci
        if (k === 0) {
            currentBet = adjustedBaseBet;
            prevBet = 0;
        } else if (k === 1) {
            prevBet = adjustedBaseBet;
            currentBet = adjustedBaseBet * 2;
        } else {
            let precBetTemp = currentBet;
            currentBet = Math.round(currentBet + prevBet);
            prevBet = precBetTemp;
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
            balance += Math.floor((currentBet * payout) - currentBet);
            totalWins++;
            k = 0;
            currentLossStreak = 0;
        } else {
            // LOSS
            balance -= currentBet;
            totalLosses++;
            k++;
            currentLossStreak++;
            if (currentLossStreak > maxLossStreak) maxLossStreak = currentLossStreak;
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

// ==================== MAIN ANALYSIS ====================

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║    MARTIN SIMPLE AI V2 - ANALYSIS (50,000 SEEDS)          ║');
console.log('║    Confronto con Adaptive Fibonacci                        ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

const NUM_SEEDS = 50000;
const SESSION_LENGTH = 4000;

// Martin config (dal tuo file)
const martinConfig = {
    baseBet: 100,
    payout: 3.1,
    mult: 1.51,
    maxTimes: 23,
    waitBeforePlay: 0
};

// Adaptive Fibonacci config (per confronto)
const fibonacciConfig = {
    baseBet: 100,
    payout: 2.5,
    maxT: 20
};

console.log('📋 CONFIGURAZIONI:\n');
console.log('Martin Simple AI V2:');
console.log(`   Base Bet: ${martinConfig.baseBet / 100} bit`);
console.log(`   Payout: ${martinConfig.payout}x`);
console.log(`   Multiplier: ${martinConfig.mult}x`);
console.log(`   Max Times: ${martinConfig.maxTimes}`);
console.log(`   Wait Before Play: ${martinConfig.waitBeforePlay}`);
console.log('');
console.log('Adaptive Fibonacci (confronto):');
console.log(`   Base Bet: ${fibonacciConfig.baseBet / 100} bit`);
console.log(`   Payout: ${fibonacciConfig.payout}x`);
console.log(`   Max T: ${fibonacciConfig.maxT}`);
console.log('');

// Test different capital levels
const capitals = [
    1000000,    // 10k bits
    2500000,    // 25k bits
    5000000,    // 50k bits
    10000000,   // 100k bits
    25000000,   // 250k bits
];

console.log(`Capital levels tested: ${capitals.map(c => (c/100).toLocaleString()).join(', ')} bits\n`);
console.log(`Tests per capital: ${NUM_SEEDS} seeds × ${SESSION_LENGTH} games\n`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const startTime = Date.now();
const martinResults = {};
const fibonacciResults = {};

capitals.forEach(capital => {
    martinResults[capital] = [];
    fibonacciResults[capital] = [];
});

let completed = 0;
const total = NUM_SEEDS * capitals.length;

// Run simulations
for (let seedNum = 0; seedNum < NUM_SEEDS; seedNum++) {
    const seedValue = Date.now() + seedNum + Math.floor(Math.random() * 1000000);
    const seed = generateSeed(SESSION_LENGTH, seedValue);

    capitals.forEach(capital => {
        // Test Martin
        const martinResult = simulateMartinSimpleAI(seed, capital, martinConfig);
        martinResults[capital].push(martinResult);

        // Test Fibonacci
        const fibResult = simulateAdaptiveFibonacci(seed, capital, fibonacciConfig);
        fibonacciResults[capital].push(fibResult);

        completed += 2;

        if (completed % 50000 === 0) {
            const progress = Math.floor((completed / (total * 2)) * 100);
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
            process.stdout.write(`\r  Progress: ${progress}% | Time: ${elapsed}s`);
        }
    });
}

console.log('\n\n✓ All simulations completed!\n');

// ==================== ANALYSIS ====================

console.log('═══════════════════════════════════════════════════════════');
console.log('                    RESULTS ANALYSIS                       ');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('┌─────────────────────────────────────────────────────────┐');
console.log('│       MARTIN SIMPLE AI V2 - RESULTS BY CAPITAL          │');
console.log('└─────────────────────────────────────────────────────────┘\n');

capitals.forEach(capital => {
    const data = martinResults[capital];
    const successful = data.filter(r => !r.ruined);

    if (successful.length > 0) {
        const profits = successful.map(r => r.profit).sort((a, b) => a - b);
        const avgProfit = profits.reduce((a, b) => a + b, 0) / profits.length;
        const medianProfit = profits[Math.floor(profits.length / 2)];
        const positiveCount = profits.filter(p => p > 0).length;
        const drawdowns = successful.map(r => r.maxDrawdownPercent);
        const avgDrawdown = drawdowns.reduce((a, b) => a + b, 0) / drawdowns.length;
        const lossStreaks = successful.map(r => r.maxLossStreak);
        const avgLossStreak = lossStreaks.reduce((a, b) => a + b, 0) / lossStreaks.length;

        const successRate = (successful.length / data.length) * 100;
        const positiveRate = (positiveCount / successful.length) * 100;

        console.log(`💰 Capital: ${(capital / 100).toLocaleString()} bits`);
        console.log(`   ✅ Success Rate: ${successRate.toFixed(2)}% (${successful.length}/${data.length})`);
        console.log(`   💚 Positive Rate: ${positiveRate.toFixed(2)}% (${positiveCount}/${successful.length})`);
        console.log(`   💵 Avg Profit: ${(avgProfit / 100).toFixed(0)} bits (${((avgProfit / capital) * 100).toFixed(3)}%)`);
        console.log(`   📊 Median: ${(medianProfit / 100).toFixed(0)} bits`);
        console.log(`   📉 Avg Drawdown: ${avgDrawdown.toFixed(2)}%`);
        console.log(`   📍 Avg Loss Streak: ${avgLossStreak.toFixed(1)}`);
        console.log('');
    } else {
        console.log(`💰 Capital: ${(capital / 100).toLocaleString()} bits`);
        console.log(`   ❌ Success Rate: 0% - Capital insufficiente`);
        console.log('');
    }
});

console.log('┌─────────────────────────────────────────────────────────┐');
console.log('│     ADAPTIVE FIBONACCI - RESULTS BY CAPITAL              │');
console.log('└─────────────────────────────────────────────────────────┘\n');

capitals.forEach(capital => {
    const data = fibonacciResults[capital];
    const successful = data.filter(r => !r.ruined);

    if (successful.length > 0) {
        const profits = successful.map(r => r.profit).sort((a, b) => a - b);
        const avgProfit = profits.reduce((a, b) => a + b, 0) / profits.length;
        const medianProfit = profits[Math.floor(profits.length / 2)];
        const positiveCount = profits.filter(p => p > 0).length;
        const drawdowns = successful.map(r => r.maxDrawdownPercent);
        const avgDrawdown = drawdowns.reduce((a, b) => a + b, 0) / drawdowns.length;
        const lossStreaks = successful.map(r => r.maxLossStreak);
        const avgLossStreak = lossStreaks.reduce((a, b) => a + b, 0) / lossStreaks.length;

        const successRate = (successful.length / data.length) * 100;
        const positiveRate = (positiveCount / successful.length) * 100;

        console.log(`💰 Capital: ${(capital / 100).toLocaleString()} bits`);
        console.log(`   ✅ Success Rate: ${successRate.toFixed(2)}% (${successful.length}/${data.length})`);
        console.log(`   💚 Positive Rate: ${positiveRate.toFixed(2)}% (${positiveCount}/${successful.length})`);
        console.log(`   💵 Avg Profit: ${(avgProfit / 100).toFixed(0)} bits (${((avgProfit / capital) * 100).toFixed(3)}%)`);
        console.log(`   📊 Median: ${(medianProfit / 100).toFixed(0)} bits`);
        console.log(`   📉 Avg Drawdown: ${avgDrawdown.toFixed(2)}%`);
        console.log(`   📍 Avg Loss Streak: ${avgLossStreak.toFixed(1)}`);
        console.log('');
    } else {
        console.log(`💰 Capital: ${(capital / 100).toLocaleString()} bits`);
        console.log(`   ❌ Success Rate: 0%`);
        console.log('');
    }
});

// Find best configurations
console.log('╔═══════════════════════════════════════════════════════════╗');
console.log('║              🏆 CONFRONTO DIRETTO 🏆                      ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

// Find best Martin config
let bestMartin = null;
let bestMartinCapital = 0;

capitals.forEach(capital => {
    const data = martinResults[capital];
    const successful = data.filter(r => !r.ruined);

    if (successful.length > 0) {
        const successRate = (successful.length / data.length) * 100;
        const profits = successful.map(r => r.profit);
        const avgProfit = profits.reduce((a, b) => a + b, 0) / profits.length;
        const positiveRate = (profits.filter(p => p > 0).length / profits.length) * 100;

        if (successRate >= 90 && positiveRate >= 70 && (!bestMartin || successRate > bestMartin.successRate)) {
            bestMartin = {
                capital,
                successRate,
                positiveRate,
                avgProfit,
                avgProfitPercent: (avgProfit / capital) * 100
            };
            bestMartinCapital = capital;
        }
    }
});

// Find best Fibonacci config
let bestFib = null;
let bestFibCapital = 0;

capitals.forEach(capital => {
    const data = fibonacciResults[capital];
    const successful = data.filter(r => !r.ruined);

    if (successful.length > 0) {
        const successRate = (successful.length / data.length) * 100;
        const profits = successful.map(r => r.profit);
        const avgProfit = profits.reduce((a, b) => a + b, 0) / profits.length;
        const positiveRate = (profits.filter(p => p > 0).length / profits.length) * 100;

        if (successRate >= 90 && positiveRate >= 70 && (!bestFib || successRate > bestFib.successRate)) {
            bestFib = {
                capital,
                successRate,
                positiveRate,
                avgProfit,
                avgProfitPercent: (avgProfit / capital) * 100
            };
            bestFibCapital = capital;
        }
    }
});

if (bestMartin) {
    console.log('🥇 MARTIN SIMPLE AI V2 - Best Configuration:\n');
    console.log(`   Capital: ${(bestMartin.capital / 100).toLocaleString()} bits`);
    console.log(`   Success Rate: ${bestMartin.successRate.toFixed(2)}%`);
    console.log(`   Positive Rate: ${bestMartin.positiveRate.toFixed(2)}%`);
    console.log(`   Avg Profit: ${(bestMartin.avgProfit / 100).toFixed(0)} bits (${bestMartin.avgProfitPercent.toFixed(3)}%)`);
    console.log('');
} else {
    console.log('❌ MARTIN SIMPLE AI V2: No configuration met excellence criteria\n');
}

if (bestFib) {
    console.log('🥈 ADAPTIVE FIBONACCI - Best Configuration:\n');
    console.log(`   Capital: ${(bestFib.capital / 100).toLocaleString()} bits`);
    console.log(`   Success Rate: ${bestFib.successRate.toFixed(2)}%`);
    console.log(`   Positive Rate: ${bestFib.positiveRate.toFixed(2)}%`);
    console.log(`   Avg Profit: ${(bestFib.avgProfit / 100).toFixed(0)} bits (${bestFib.avgProfitPercent.toFixed(3)}%)`);
    console.log('');
} else {
    console.log('❌ ADAPTIVE FIBONACCI: No configuration met excellence criteria\n');
}

if (bestMartin && bestFib) {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('                  🏆 WINNER: ');

    const martinScore = bestMartin.successRate * 0.4 + bestMartin.positiveRate * 0.3 + (bestMartin.avgProfitPercent * 10);
    const fibScore = bestFib.successRate * 0.4 + bestFib.positiveRate * 0.3 + (bestFib.avgProfitPercent * 10);

    if (martinScore > fibScore) {
        console.log('                  MARTIN SIMPLE AI V2! 🎉');
        console.log(`                  Score: ${martinScore.toFixed(2)} vs ${fibScore.toFixed(2)}`);
    } else {
        console.log('                  ADAPTIVE FIBONACCI! 🎉');
        console.log(`                  Score: ${fibScore.toFixed(2)} vs ${martinScore.toFixed(2)}`);
    }
    console.log('═══════════════════════════════════════════════════════════\n');
}

const endTime = Date.now();
console.log(`\nAnalysis completed in ${((endTime - startTime) / 1000 / 60).toFixed(2)} minutes`);
console.log(`Total simulations: ${(NUM_SEEDS * capitals.length * 2).toLocaleString()}`);
console.log('═══════════════════════════════════════════════════════════\n');
