/**
 * DEEP ANALYSIS - Analisi Approfondita con 100 seed da 200.000 partite
 *
 * Obiettivo: Trovare l'algoritmo e configurazione ottimale che:
 * 1. Richiede il minor capitale iniziale possibile
 * 2. Massimizza il profitto finale dopo 200.000 partite
 * 3. Minimizza il rischio di perdita totale
 */

// ==================== SEED GENERATION ====================
function generateSeed(n) {
    let values = [];
    for (let index = 0; index < n; index++) {
        values.push(Math.floor(Math.max(0.99 / (1 - Math.random()), 1) * 100) / 100);
    }
    return values;
}

// ==================== CORE ALGORITHM IMPLEMENTATIONS ====================

/**
 * Fibonacci Classic - Versione ottimizzata
 */
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

        // Check ruin
        if (balance <= 0 || k > maxT) {
            ruined = true;
            ruinedAtGame = i;
            break;
        }

        // Calculate bet
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

        // Check if can place bet
        if (currentBet > balance) {
            ruined = true;
            ruinedAtGame = i;
            break;
        }

        // Place bet
        if (bust >= payout) {
            // Win
            balance += (currentBet * payout) - currentBet;
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

        // Track balance extremes
        if (balance > maxBalance) maxBalance = balance;
        if (balance < minBalance) minBalance = balance;
    }

    return {
        algorithm: 'Fibonacci',
        config,
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
        winRate: (totalWins / (totalWins + totalLosses)) * 100,
        ruined,
        ruinedAtGame,
        survivedGames: ruined ? ruinedAtGame : seed.length
    };
}

/**
 * Adaptive Fibonacci - Con gestione dinamica del bet
 */
function testAdaptiveFibonacci(seed, startBalance, config) {
    const initialBaseBet = config.baseBet;
    const payout = config.payout;
    const maxT = config.maxT;
    const adaptiveBetting = config.adaptive || false;

    let balance = startBalance;
    const initialBalance = startBalance;
    let baseBet = initialBaseBet;
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

        // Check ruin
        if (balance <= 0 || k > maxT) {
            ruined = true;
            ruinedAtGame = i;
            break;
        }

        // Adaptive bet sizing
        if (adaptiveBetting && k === 0) {
            baseBet = Math.max(initialBaseBet, Math.floor(balance * 0.003)); // 0.3% of balance
            baseBet = Math.min(baseBet, balance * 0.01); // Max 1% of balance
        }

        // Calculate bet
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

        // Check if can place bet
        if (currentBet > balance) {
            ruined = true;
            ruinedAtGame = i;
            break;
        }

        // Place bet
        if (bust >= payout) {
            // Win
            balance += (currentBet * payout) - currentBet;
            totalWins++;
            k = 0;
        } else {
            // Loss
            balance -= currentBet;
            totalLosses++;
            k++;
        }

        // Track balance extremes
        if (balance > maxBalance) maxBalance = balance;
        if (balance < minBalance) minBalance = balance;
    }

    return {
        algorithm: adaptiveBetting ? 'Adaptive Fibonacci' : 'Fibonacci',
        config,
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
        winRate: (totalWins / (totalWins + totalLosses)) * 100,
        ruined,
        ruinedAtGame,
        survivedGames: ruined ? ruinedAtGame : seed.length
    };
}

/**
 * Martingale Flat - Sistema dual-game
 */
function testMartingaleFlat(seed, startBalance, config) {
    const mult1 = config.mult1;
    const mult2 = config.mult2;
    const multiply2 = config.multiply2;
    const minimumLostTimesToStart = config.minimumLostTimesToStart;
    const startGame2After = config.startGame2After;
    const maxT = config.maxT;
    const initialBuffer = config.initialBuffer || 20;

    let balance = startBalance;
    const initialBalance = startBalance;
    let basebet1 = Math.floor(startBalance * 0.005); // 0.5% of balance
    let currentBet2 = Math.floor(startBalance * 0.02); // 2% of balance
    let game1Losts = -initialBuffer;
    let game2VirtualLosts = 0;
    let currentTimes = 0;
    let currentGameType = 1;
    let totalWins = 0;
    let totalLosses = 0;
    let maxBalance = startBalance;
    let minBalance = startBalance;
    let ruined = false;
    let ruinedAtGame = -1;

    for (let i = 0; i < seed.length; i++) {
        const bust = seed[i];

        const currentMult = currentGameType === 2 ? mult2 : mult1;
        const currentBet = currentGameType === 2 ? currentBet2 : basebet1;

        // Check ruin
        if (balance <= 0 || (currentGameType === 2 && currentTimes >= maxT) || currentBet > balance) {
            ruined = true;
            ruinedAtGame = i;
            break;
        }

        // Virtual loss tracking
        if (bust < mult2) {
            game2VirtualLosts++;
        } else {
            game2VirtualLosts = 0;
        }

        if (bust >= currentMult) {
            // Win
            balance += Math.floor(currentMult * currentBet) - currentBet;
            totalWins++;

            if (currentGameType === 2) {
                game1Losts -= minimumLostTimesToStart;
                currentGameType = 1;
                currentBet2 = Math.floor(balance * 0.02);
                currentTimes = 0;
            }
        } else {
            // Loss
            balance -= currentBet;
            totalLosses++;

            if (currentGameType === 1) {
                game1Losts++;
            } else {
                currentTimes++;
                currentBet2 = Math.ceil((currentBet2 / 100) * multiply2) * 100;
            }
        }

        // Switch to game 2
        if (currentGameType === 1 && game2VirtualLosts > startGame2After && game1Losts >= minimumLostTimesToStart) {
            currentGameType = 2;
        }

        // Track balance extremes
        if (balance > maxBalance) maxBalance = balance;
        if (balance < minBalance) minBalance = balance;
    }

    return {
        algorithm: 'Martingale Flat',
        config,
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
        winRate: (totalWins / (totalWins + totalLosses)) * 100,
        ruined,
        ruinedAtGame,
        survivedGames: ruined ? ruinedAtGame : seed.length
    };
}

/**
 * Conservative Flat - Puntata fissa con moltiplicatore basso
 */
function testConservativeFlat(seed, startBalance, config) {
    const baseBet = config.baseBet;
    const payout = config.payout;

    let balance = startBalance;
    const initialBalance = startBalance;
    let totalWins = 0;
    let totalLosses = 0;
    let maxBalance = startBalance;
    let minBalance = startBalance;
    let ruined = false;
    let ruinedAtGame = -1;

    for (let i = 0; i < seed.length; i++) {
        const bust = seed[i];

        if (balance < baseBet) {
            ruined = true;
            ruinedAtGame = i;
            break;
        }

        if (bust >= payout) {
            balance += (baseBet * payout) - baseBet;
            totalWins++;
        } else {
            balance -= baseBet;
            totalLosses++;
        }

        if (balance > maxBalance) maxBalance = balance;
        if (balance < minBalance) minBalance = balance;
    }

    return {
        algorithm: 'Conservative Flat',
        config,
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
        winRate: (totalWins / (totalWins + totalLosses)) * 100,
        ruined,
        ruinedAtGame,
        survivedGames: ruined ? ruinedAtGame : seed.length
    };
}

// ==================== COMPREHENSIVE TESTING ====================

function runDeepAnalysis() {
    console.log('========================================');
    console.log('DEEP ANALYSIS - 100 Seeds x 200,000 Games');
    console.log('========================================\n');

    const NUM_SEEDS = 100;
    const GAMES_PER_SEED = 200000;

    // Test different starting balances
    const startingBalances = [
        10000,    // 100 bits
        25000,    // 250 bits
        50000,    // 500 bits
        100000,   // 1,000 bits
        250000,   // 2,500 bits
        500000,   // 5,000 bits
        1000000,  // 10,000 bits
        2500000,  // 25,000 bits
    ];

    // Algorithm configurations to test
    const configurations = [
        // Fibonacci variations
        { algo: 'fibonacci', config: { baseBet: 100, payout: 2, maxT: 20 } },
        { algo: 'fibonacci', config: { baseBet: 100, payout: 2.5, maxT: 20 } },
        { algo: 'fibonacci', config: { baseBet: 100, payout: 3, maxT: 20 } },
        { algo: 'fibonacci', config: { baseBet: 100, payout: 3.5, maxT: 22 } },
        { algo: 'fibonacci', config: { baseBet: 100, payout: 4, maxT: 24 } },

        // Adaptive Fibonacci
        { algo: 'adaptive', config: { baseBet: 100, payout: 2.5, maxT: 20, adaptive: true } },
        { algo: 'adaptive', config: { baseBet: 100, payout: 3, maxT: 20, adaptive: true } },
        { algo: 'adaptive', config: { baseBet: 100, payout: 3.5, maxT: 22, adaptive: true } },

        // Martingale Flat
        { algo: 'martingale', config: { mult1: 1.9, mult2: 3, multiply2: 1.5, minimumLostTimesToStart: 10, startGame2After: 2, maxT: 20 } },
        { algo: 'martingale', config: { mult1: 2, mult2: 2.5, multiply2: 1.6, minimumLostTimesToStart: 12, startGame2After: 3, maxT: 18 } },

        // Conservative Flat
        { algo: 'conservative', config: { baseBet: 100, payout: 1.5 } },
        { algo: 'conservative', config: { baseBet: 100, payout: 2 } },
    ];

    const allResults = [];

    // Generate all seeds first
    console.log('Generating 100 seeds...');
    const seeds = [];
    for (let s = 0; s < NUM_SEEDS; s++) {
        seeds.push(generateSeed(GAMES_PER_SEED));
        if ((s + 1) % 10 === 0) {
            console.log(`Generated ${s + 1}/${NUM_SEEDS} seeds`);
        }
    }

    console.log('\nRunning tests...\n');

    let testCount = 0;
    const totalTests = configurations.length * startingBalances.length * NUM_SEEDS;

    // Test each configuration
    configurations.forEach((testConfig, configIdx) => {
        startingBalances.forEach((startBalance) => {
            const results = [];

            seeds.forEach((seed, seedIdx) => {
                let result;

                if (testConfig.algo === 'fibonacci') {
                    result = testFibonacci(seed, startBalance, testConfig.config);
                } else if (testConfig.algo === 'adaptive') {
                    result = testAdaptiveFibonacci(seed, startBalance, testConfig.config);
                } else if (testConfig.algo === 'martingale') {
                    result = testMartingaleFlat(seed, startBalance, testConfig.config);
                } else if (testConfig.algo === 'conservative') {
                    result = testConservativeFlat(seed, startBalance, testConfig.config);
                }

                results.push(result);
                testCount++;

                // Progress update every 1000 tests
                if (testCount % 1000 === 0) {
                    console.log(`Progress: ${testCount}/${totalTests} tests (${((testCount / totalTests) * 100).toFixed(1)}%)`);
                }
            });

            // Calculate statistics
            const successfulRuns = results.filter(r => !r.ruined);
            const successRate = (successfulRuns.length / results.length) * 100;

            const profits = results.map(r => r.profit);
            const profitPercents = results.map(r => r.profitPercent);
            const maxDrawdowns = results.map(r => r.maxDrawdownPercent);

            const avgProfit = profits.reduce((a, b) => a + b, 0) / profits.length;
            const medianProfit = profits.sort((a, b) => a - b)[Math.floor(profits.length / 2)];
            const avgProfitPercent = profitPercents.reduce((a, b) => a + b, 0) / profitPercents.length;
            const avgMaxDrawdown = maxDrawdowns.reduce((a, b) => a + b, 0) / maxDrawdowns.length;

            const bestProfit = Math.max(...profits);
            const worstProfit = Math.min(...profits);
            const maxDrawdown = Math.max(...maxDrawdowns);

            // Calculate ROI efficiency (profit / starting balance)
            const roiEfficiency = avgProfit / startBalance;

            // Calculate risk-adjusted return (Sharpe-like ratio)
            const profitStdDev = Math.sqrt(
                profits.reduce((sum, p) => sum + Math.pow(p - avgProfit, 2), 0) / profits.length
            );
            const riskAdjustedReturn = avgProfit / (profitStdDev || 1);

            allResults.push({
                algorithm: results[0].algorithm,
                config: testConfig.config,
                startBalance,
                successRate,
                avgProfit,
                medianProfit,
                avgProfitPercent,
                bestProfit,
                worstProfit,
                avgMaxDrawdown,
                maxDrawdown,
                roiEfficiency,
                riskAdjustedReturn,
                profitStdDev
            });
        });
    });

    console.log('\n========================================');
    console.log('ANALYSIS COMPLETE');
    console.log('========================================\n');

    return allResults;
}

// ==================== RESULTS ANALYSIS ====================

function analyzeResults(results) {
    console.log('\n========================================');
    console.log('OPTIMAL CONFIGURATION ANALYSIS');
    console.log('========================================\n');

    // Filter only successful configurations (>95% success rate)
    const successfulConfigs = results.filter(r => r.successRate >= 95);

    console.log(`Configurations with >95% success rate: ${successfulConfigs.length}/${results.length}\n`);

    // Sort by different criteria

    // 1. Best ROI Efficiency (profit per unit of capital)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('TOP 10: BEST ROI EFFICIENCY (Profit/Capital)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const byROI = [...successfulConfigs].sort((a, b) => b.roiEfficiency - a.roiEfficiency).slice(0, 10);
    byROI.forEach((r, idx) => {
        console.log(`${idx + 1}. ${r.algorithm} | Payout: ${r.config.payout}x`);
        console.log(`   Capital: ${(r.startBalance / 100).toLocaleString()} bits`);
        console.log(`   Success Rate: ${r.successRate.toFixed(1)}%`);
        console.log(`   Avg Profit: ${(r.avgProfit / 100).toFixed(0)} bits (${r.avgProfitPercent.toFixed(1)}%)`);
        console.log(`   Median Profit: ${(r.medianProfit / 100).toFixed(0)} bits`);
        console.log(`   ROI Efficiency: ${r.roiEfficiency.toFixed(4)}`);
        console.log(`   Max Drawdown: ${r.avgMaxDrawdown.toFixed(1)}%`);
        console.log(`   Range: ${(r.worstProfit / 100).toFixed(0)} to ${(r.bestProfit / 100).toFixed(0)} bits`);
        console.log('');
    });

    // 2. Best Risk-Adjusted Return
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('TOP 10: BEST RISK-ADJUSTED RETURN');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const byRisk = [...successfulConfigs].sort((a, b) => b.riskAdjustedReturn - a.riskAdjustedReturn).slice(0, 10);
    byRisk.forEach((r, idx) => {
        console.log(`${idx + 1}. ${r.algorithm} | Payout: ${r.config.payout}x`);
        console.log(`   Capital: ${(r.startBalance / 100).toLocaleString()} bits`);
        console.log(`   Success Rate: ${r.successRate.toFixed(1)}%`);
        console.log(`   Avg Profit: ${(r.avgProfit / 100).toFixed(0)} bits (${r.avgProfitPercent.toFixed(1)}%)`);
        console.log(`   Risk-Adjusted Return: ${r.riskAdjustedReturn.toFixed(2)}`);
        console.log(`   Profit StdDev: ${(r.profitStdDev / 100).toFixed(0)} bits`);
        console.log('');
    });

    // 3. Lowest Starting Capital with Good Returns
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('TOP 10: LOWEST CAPITAL REQUIREMENT');
    console.log('(Min 95% success, min 100% profit)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const goodReturns = successfulConfigs.filter(r => r.avgProfitPercent >= 100);
    const byCapital = [...goodReturns].sort((a, b) => a.startBalance - b.startBalance).slice(0, 10);
    byCapital.forEach((r, idx) => {
        console.log(`${idx + 1}. ${r.algorithm} | Payout: ${r.config.payout}x`);
        console.log(`   Capital: ${(r.startBalance / 100).toLocaleString()} bits ⭐`);
        console.log(`   Success Rate: ${r.successRate.toFixed(1)}%`);
        console.log(`   Avg Profit: ${(r.avgProfit / 100).toFixed(0)} bits (${r.avgProfitPercent.toFixed(1)}%)`);
        console.log(`   Median Profit: ${(r.medianProfit / 100).toFixed(0)} bits`);
        console.log(`   Max Drawdown: ${r.avgMaxDrawdown.toFixed(1)}%`);
        console.log('');
    });

    // 4. Highest Absolute Profit
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('TOP 10: HIGHEST ABSOLUTE PROFIT');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const byAbsoluteProfit = [...successfulConfigs].sort((a, b) => b.avgProfit - a.avgProfit).slice(0, 10);
    byAbsoluteProfit.forEach((r, idx) => {
        console.log(`${idx + 1}. ${r.algorithm} | Payout: ${r.config.payout}x`);
        console.log(`   Capital: ${(r.startBalance / 100).toLocaleString()} bits`);
        console.log(`   Success Rate: ${r.successRate.toFixed(1)}%`);
        console.log(`   Avg Profit: ${(r.avgProfit / 100).toFixed(0)} bits (${r.avgProfitPercent.toFixed(1)}%) ⭐`);
        console.log(`   Median Profit: ${(r.medianProfit / 100).toFixed(0)} bits`);
        console.log(`   ROI: ${r.roiEfficiency.toFixed(4)}`);
        console.log('');
    });

    // 5. FINAL RECOMMENDATION
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🏆 FINAL RECOMMENDATION');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Find the optimal balance
    const optimal = successfulConfigs
        .filter(r => r.avgProfitPercent >= 100 && r.avgMaxDrawdown < 50)
        .sort((a, b) => {
            // Score based on: 40% ROI efficiency, 30% profit percent, 20% success rate, 10% low drawdown
            const scoreA = (a.roiEfficiency * 40) + (a.avgProfitPercent * 0.3) + (a.successRate * 0.2) - (a.avgMaxDrawdown * 0.1);
            const scoreB = (b.roiEfficiency * 40) + (b.avgProfitPercent * 0.3) + (b.successRate * 0.2) - (b.avgMaxDrawdown * 0.1);
            return scoreB - scoreA;
        })[0];

    if (optimal) {
        console.log('BEST OVERALL CONFIGURATION:');
        console.log(`\nAlgorithm: ${optimal.algorithm}`);
        console.log(`Payout: ${optimal.config.payout}x`);
        console.log(`Base Bet: ${optimal.config.baseBet} bits`);
        if (optimal.config.maxT) console.log(`Max Recovery: ${optimal.config.maxT}`);
        console.log(`\n📊 PERFORMANCE (over 100 seeds, 200k games each):`);
        console.log(`   Starting Capital: ${(optimal.startBalance / 100).toLocaleString()} bits`);
        console.log(`   Success Rate: ${optimal.successRate.toFixed(1)}%`);
        console.log(`   Average Profit: ${(optimal.avgProfit / 100).toFixed(0)} bits`);
        console.log(`   Median Profit: ${(optimal.medianProfit / 100).toFixed(0)} bits`);
        console.log(`   Profit %: ${optimal.avgProfitPercent.toFixed(1)}%`);
        console.log(`   ROI Efficiency: ${optimal.roiEfficiency.toFixed(4)}`);
        console.log(`   Avg Max Drawdown: ${optimal.avgMaxDrawdown.toFixed(1)}%`);
        console.log(`   Risk-Adjusted Return: ${optimal.riskAdjustedReturn.toFixed(2)}`);
        console.log(`   Profit Range: ${(optimal.worstProfit / 100).toFixed(0)} to ${(optimal.bestProfit / 100).toFixed(0)} bits`);
        console.log('\n✅ This configuration offers the best balance of:');
        console.log('   • Low starting capital requirement');
        console.log('   • High profitability');
        console.log('   • Excellent success rate');
        console.log('   • Manageable risk (drawdown)');
    }

    return { byROI, byRisk, byCapital, byAbsoluteProfit, optimal };
}

// ==================== RUN ANALYSIS ====================

console.log('Starting deep analysis...');
console.log('This will take several minutes...\n');

const startTime = Date.now();
const results = runDeepAnalysis();
const endTime = Date.now();

console.log(`\nAnalysis completed in ${((endTime - startTime) / 1000 / 60).toFixed(2)} minutes\n`);

analyzeResults(results);

console.log('\n========================================');
console.log('Analysis saved. Check results above.');
console.log('========================================');
