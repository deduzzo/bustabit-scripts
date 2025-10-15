/**
 * Algorithm Analyzer - Comprehensive testing framework for betting algorithms
 * Simulates betting strategies against random seeds to find optimal configurations
 */

// ==================== SEED GENERATION ====================
function generateSeed(n) {
    let values = [];
    for (let index = 0; index < n; index++) {
        values.push(Math.floor(Math.max(0.99 / (1 - Math.random()), 1) * 100) / 100);
    }
    return values;
}

// ==================== STATISTICS FUNCTIONS ====================
function calculateStats(values) {
    const average = values.reduce((a, b) => a + b, 0) / values.length;
    const sorted = [...values].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const max = Math.max(...values);
    const min = Math.min(...values);
    return { average, median, max, min };
}

function findMaxSeriesBelow(values, threshold) {
    let maxSeries = 0;
    let currentSeries = 0;
    for (let val of values) {
        if (val < threshold) {
            currentSeries++;
            maxSeries = Math.max(maxSeries, currentSeries);
        } else {
            currentSeries = 0;
        }
    }
    return maxSeries;
}

function findDistancesBetween(values, threshold, operator = '>=') {
    const distances = [];
    let lastIndex = -1;
    values.forEach((val, idx) => {
        const condition = operator === '>=' ? val >= threshold : val < threshold;
        if (condition) {
            if (lastIndex >= 0) {
                distances.push(idx - lastIndex);
            }
            lastIndex = idx;
        }
    });
    return distances;
}

// ==================== ALGORITHM IMPLEMENTATIONS ====================

/**
 * Fibonacci Classic - Uses Fibonacci progression after losses
 */
function testFibonacciClassic(seed, config = {}) {
    const baseBet = config.baseBet || 100;
    const payout = config.payout || 3;
    const maxT = config.maxT || 20;

    let balance = config.initBalance || 1000000;
    const startBalance = balance;
    let currentBet = baseBet;
    let precBet = 0;
    let k = 0;
    let disasters = 0;
    let wins = 0;

    for (let i = 0; i < seed.length; i++) {
        const bust = seed[i];

        if (k > maxT) {
            disasters++;
            balance = config.initBalance || 1000000;
            currentBet = baseBet;
            precBet = 0;
            k = 0;
            continue;
        }

        if (bust >= payout) {
            // Win
            balance += (currentBet * payout) - currentBet;
            currentBet = baseBet;
            precBet = 0;
            k = 0;
            wins++;
        } else {
            // Loss
            balance -= currentBet;
            k++;
            if (k > 1) {
                let precBetTemp = currentBet;
                currentBet = currentBet + precBet;
                precBet = precBetTemp;
            } else if (precBet === 0) {
                precBet = currentBet;
                currentBet = currentBet * 2;
            }
        }

        if (balance <= 0) {
            disasters++;
            balance = config.initBalance || 1000000;
            currentBet = baseBet;
            precBet = 0;
            k = 0;
        }
    }

    return {
        name: 'Fibonacci Classic',
        finalBalance: balance,
        profit: balance - startBalance,
        profitPercent: ((balance - startBalance) / startBalance) * 100,
        disasters,
        wins,
        winRate: (wins / seed.length) * 100,
        config
    };
}

/**
 * Martingale Flat - Two-game strategy with flat betting + recovery mode
 */
function testMartingaleFlat(seed, config = {}) {
    const mult1 = config.mult1 || 1.9;
    const mult2 = config.mult2 || 3;
    const multiply2 = config.multiply2 || 1.5;
    const minimumLostTimesToStart = config.minimumLostTimesToStart || 10;
    const startGame2After = config.startGame2After || 2;
    const maxT = config.maxT || 20;

    let balance = config.initBalance || 1000000;
    const startBalance = balance;
    let basebet1 = Math.floor(balance * 0.01); // 1% of balance
    let currentBet2 = Math.floor(balance * 0.05); // 5% of balance
    let game1Losts = -config.initialBuffer || -20;
    let game2VirtualLosts = 0;
    let currentTimes = 0;
    let currentGameType = 1; // 1 = flat, 2 = recovery
    let disasters = 0;
    let wins = 0;

    for (let i = 0; i < seed.length; i++) {
        const bust = seed[i];
        const currentMult = currentGameType === 2 ? mult2 : mult1;
        const currentBet = currentGameType === 2 ? currentBet2 : basebet1;

        // Virtual loss tracking
        if (bust < mult2) {
            game2VirtualLosts++;
        } else {
            game2VirtualLosts = 0;
        }

        // Check for disaster
        if (currentGameType === 2 && currentTimes >= maxT) {
            disasters++;
            balance = config.initBalance || 1000000;
            basebet1 = Math.floor(balance * 0.01);
            currentBet2 = Math.floor(balance * 0.05);
            game1Losts = -config.initialBuffer || -20;
            currentGameType = 1;
            currentTimes = 0;
            game2VirtualLosts = 0;
            continue;
        }

        if (bust >= currentMult) {
            // Win
            balance += Math.floor(currentMult * currentBet) - currentBet;
            wins++;

            if (currentGameType === 2) {
                game1Losts -= minimumLostTimesToStart;
                currentGameType = 1;
                currentBet2 = Math.floor(balance * 0.05);
                currentTimes = 0;
            }
        } else {
            // Loss
            balance -= currentBet;

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

        if (balance <= 0) {
            disasters++;
            balance = config.initBalance || 1000000;
            basebet1 = Math.floor(balance * 0.01);
            currentBet2 = Math.floor(balance * 0.05);
            game1Losts = -config.initialBuffer || -20;
            currentGameType = 1;
            currentTimes = 0;
            game2VirtualLosts = 0;
        }
    }

    return {
        name: 'Martingale Flat',
        finalBalance: balance,
        profit: balance - startBalance,
        profitPercent: ((balance - startBalance) / startBalance) * 100,
        disasters,
        wins,
        winRate: (wins / seed.length) * 100,
        config
    };
}

/**
 * Linear Recover - Progressive betting with percentage-based recovery
 */
function testLinearRecover(seed, config = {}) {
    const payout = config.payout || 3.05;
    const baseBet = config.baseBet || 200;
    const percIncrement = config.percIncrement || 30;
    const maxToRecover = config.maxToRecover || 500000;

    let balance = config.initBalance || 1000000;
    const startBalance = balance;
    let currentBet = baseBet;
    let toRecover = 0;
    let increment = 0;
    let disasters = 0;
    let wins = 0;

    for (let i = 0; i < seed.length; i++) {
        const bust = seed[i];

        if (toRecover >= maxToRecover) {
            disasters++;
            toRecover = 0;
            currentBet = baseBet;
            increment = 0;
        }

        if (bust >= payout) {
            // Win
            const profit = (payout * currentBet) - currentBet;
            balance += profit;
            toRecover -= profit;
            wins++;

            if (toRecover <= 0) {
                toRecover = 0;
                currentBet = baseBet;
                increment = 0;
            } else {
                // Calculate next bet based on recovery needed
                currentBet = Math.ceil((toRecover / 100) / 3) * 100 + 200;
                increment = 0;
            }
        } else {
            // Loss
            balance -= currentBet;
            toRecover += currentBet;

            if (increment === 0) {
                increment = Math.ceil((currentBet / 10000) * percIncrement) * 100;
                if (increment < 100) increment = 100;
            }
            currentBet += increment;
        }

        if (balance <= 0) {
            disasters++;
            balance = config.initBalance || 1000000;
            toRecover = 0;
            currentBet = baseBet;
            increment = 0;
        }
    }

    return {
        name: 'Linear Recover',
        finalBalance: balance,
        profit: balance - startBalance,
        profitPercent: ((balance - startBalance) / startBalance) * 100,
        disasters,
        wins,
        winRate: (wins / seed.length) * 100,
        config
    };
}

/**
 * Sciacallo (Jackal) - Wait for high bust patterns then bet conservatively
 */
function testSciacallo(seed, config = {}) {
    const payout = config.payout || 2.4;
    const baseBet = config.baseBet || 5000;
    const mult = config.mult || 1.8;
    const startAfter = config.startAfter || 11;
    const maxT = config.maxT || 16;

    let balance = config.initBalance || 1000000;
    const startBalance = balance;
    let currentBet = baseBet;
    let currentTimes = 0;
    let start = false;
    let disasters = 0;
    let wins = 0;

    for (let i = 0; i < seed.length; i++) {
        const bust = seed[i];

        if (!start) {
            // Wait for pattern
            if (bust >= payout) {
                currentTimes = 0;
            } else {
                currentTimes++;
                if (currentTimes >= startAfter) {
                    start = true;
                    currentTimes = 0;
                    currentBet = baseBet;
                }
            }
        } else {
            // Betting phase
            if (bust >= payout) {
                // Win
                balance += (currentBet * payout) - currentBet;
                wins++;
                currentBet = baseBet;
                currentTimes = 0;
                start = false;
            } else {
                // Loss
                balance -= currentBet;
                currentTimes++;
                currentBet = Math.ceil((currentBet / 100) * mult) * 100;

                if (currentTimes >= maxT) {
                    disasters++;
                    currentBet = baseBet;
                    currentTimes = 0;
                    start = false;
                }
            }
        }

        if (balance <= 0) {
            disasters++;
            balance = config.initBalance || 1000000;
            currentBet = baseBet;
            currentTimes = 0;
            start = false;
        }
    }

    return {
        name: 'Sciacallo',
        finalBalance: balance,
        profit: balance - startBalance,
        profitPercent: ((balance - startBalance) / startBalance) * 100,
        disasters,
        wins,
        winRate: (wins / seed.length) * 100,
        config
    };
}

/**
 * PaoloBet - Dynamic multiplier adjustment based on loss streaks
 */
function testPaoloBet(seed, config = {}) {
    let mult = config.mult || 12;
    const initMult = mult;
    let baseBet = config.bet || 1200;
    const initBaseBet = baseBet;
    const timesToChange = config.timesToChange || 200;
    const multFactor = config.multFactor || 20;
    let normalBets = config.normalBets || 120;
    const initNormalBets = normalBets;
    const maxBets = config.maxBets || 90000;

    let balance = config.initBalance || 1000000;
    const startBalance = balance;
    let failBets = 0;
    let currentMaxBets = maxBets;
    let disasters = 0;
    let wins = 0;

    for (let i = 0; i < seed.length; i++) {
        const bust = seed[i];

        if (currentMaxBets === 0 || balance < baseBet) {
            disasters++;
            mult = initMult;
            baseBet = initBaseBet;
            failBets = 0;
            normalBets = initNormalBets;
            currentMaxBets = maxBets;
            balance = Math.max(balance, config.initBalance || 1000000);
            continue;
        }

        if (bust >= mult) {
            // Win
            balance += (baseBet * bust) - baseBet;
            wins++;
            mult = initMult;
            baseBet = initBaseBet;
            failBets = 0;
            normalBets = initNormalBets;
            currentMaxBets = maxBets;
        } else {
            // Loss
            balance -= baseBet;
            currentMaxBets--;

            if (normalBets === 0) {
                failBets++;
                if (failBets % timesToChange === 0) {
                    mult = (mult / multFactor) + 1;
                    baseBet *= multFactor;
                }
                mult++;
            } else {
                mult++;
                normalBets--;
                if (normalBets === 0) {
                    mult = (mult / multFactor) + 1;
                    baseBet *= multFactor;
                }
            }
        }

        if (balance <= 0) {
            disasters++;
            balance = config.initBalance || 1000000;
            mult = initMult;
            baseBet = initBaseBet;
            failBets = 0;
            normalBets = initNormalBets;
            currentMaxBets = maxBets;
        }
    }

    return {
        name: 'PaoloBet',
        finalBalance: balance,
        profit: balance - startBalance,
        profitPercent: ((balance - startBalance) / startBalance) * 100,
        disasters,
        wins,
        winRate: (wins / seed.length) * 100,
        config
    };
}

// ==================== COMPREHENSIVE TESTING ====================

function runComprehensiveTests(numTests = 100, seedLength = 10000) {
    console.log('========================================');
    console.log('COMPREHENSIVE ALGORITHM ANALYSIS');
    console.log(`Running ${numTests} tests with ${seedLength} games each`);
    console.log('========================================\n');

    const algorithms = [
        { func: testFibonacciClassic, configs: [
            { baseBet: 100, payout: 3, maxT: 20 },
            { baseBet: 200, payout: 2.5, maxT: 18 },
            { baseBet: 100, payout: 4, maxT: 22 }
        ]},
        { func: testMartingaleFlat, configs: [
            { mult1: 1.9, mult2: 3, multiply2: 1.5, maxT: 20 },
            { mult1: 2.0, mult2: 2.5, multiply2: 1.6, maxT: 18 }
        ]},
        { func: testLinearRecover, configs: [
            { payout: 3.05, baseBet: 200, percIncrement: 30 },
            { payout: 2.5, baseBet: 300, percIncrement: 25 }
        ]},
        { func: testSciacallo, configs: [
            { payout: 2.4, baseBet: 5000, startAfter: 11, maxT: 16 },
            { payout: 3.0, baseBet: 3000, startAfter: 15, maxT: 18 }
        ]},
        { func: testPaoloBet, configs: [
            { mult: 12, bet: 1200, timesToChange: 200, multFactor: 20, normalBets: 120 },
            { mult: 10, bet: 1000, timesToChange: 150, multFactor: 15, normalBets: 100 }
        ]}
    ];

    const results = [];

    algorithms.forEach(({ func, configs }) => {
        configs.forEach(config => {
            const testResults = [];

            for (let i = 0; i < numTests; i++) {
                const seed = generateSeed(seedLength);
                const result = func(seed, { ...config, initBalance: 1000000 });
                testResults.push(result);
            }

            // Calculate aggregate statistics
            const profits = testResults.map(r => r.profit);
            const profitPercents = testResults.map(r => r.profitPercent);
            const disasters = testResults.map(r => r.disasters);
            const wins = testResults.map(r => r.wins);

            const avgProfit = profits.reduce((a, b) => a + b, 0) / profits.length;
            const avgProfitPercent = profitPercents.reduce((a, b) => a + b, 0) / profitPercents.length;
            const avgDisasters = disasters.reduce((a, b) => a + b, 0) / disasters.length;
            const avgWins = wins.reduce((a, b) => a + b, 0) / wins.length;
            const positiveRuns = testResults.filter(r => r.profit > 0).length;
            const successRate = (positiveRuns / numTests) * 100;

            results.push({
                algorithm: testResults[0].name,
                config,
                avgProfit: avgProfit / 100,
                avgProfitPercent,
                avgDisasters,
                avgWins,
                successRate,
                bestProfit: Math.max(...profits) / 100,
                worstProfit: Math.min(...profits) / 100
            });
        });
    });

    // Sort by success rate and average profit
    results.sort((a, b) => {
        if (Math.abs(b.successRate - a.successRate) > 10) {
            return b.successRate - a.successRate;
        }
        return b.avgProfit - a.avgProfit;
    });

    // Print results
    console.log('\n========================================');
    console.log('RESULTS (Sorted by Performance)');
    console.log('========================================\n');

    results.forEach((r, idx) => {
        console.log(`${idx + 1}. ${r.algorithm}`);
        console.log(`   Config: ${JSON.stringify(r.config)}`);
        console.log(`   Success Rate: ${r.successRate.toFixed(2)}%`);
        console.log(`   Avg Profit: ${r.avgProfit.toFixed(2)} bits (${r.avgProfitPercent.toFixed(2)}%)`);
        console.log(`   Best: ${r.bestProfit.toFixed(2)} bits | Worst: ${r.worstProfit.toFixed(2)} bits`);
        console.log(`   Avg Disasters: ${r.avgDisasters.toFixed(2)} | Avg Wins: ${r.avgWins.toFixed(2)}`);
        console.log('');
    });

    return results;
}

// ==================== OPTIMIZED ALGORITHM ====================

/**
 * Adaptive Hybrid Strategy - Combines best elements from all algorithms
 *
 * Key Features:
 * 1. Pattern Detection - Monitors recent history for betting opportunities
 * 2. Adaptive Betting - Adjusts bet size based on balance and risk
 * 3. Multi-Phase Recovery - Uses different strategies based on loss depth
 * 4. Risk Management - Implements stop-loss and profit-taking
 */
function testAdaptiveHybrid(seed, config = {}) {
    const PRIMARY_MULT = config.primaryMult || 2.5;
    const RECOVERY_MULT = config.recoveryMult || 3.0;
    const BASE_BET_PERCENT = config.baseBetPercent || 0.005; // 0.5% of balance
    const PATTERN_THRESHOLD = config.patternThreshold || 8; // Games below mult to trigger
    const MAX_RECOVERY_T = config.maxRecoveryT || 15;
    const PROFIT_TARGET_PERCENT = config.profitTargetPercent || 50; // Take profit at 50% gain

    let balance = config.initBalance || 1000000;
    const startBalance = balance;
    let baseBet = Math.floor(balance * BASE_BET_PERCENT);

    // State tracking
    let phase = 'NORMAL'; // NORMAL, PATTERN_WAIT, RECOVERY
    let patternCount = 0;
    let recoveryTimes = 0;
    let toRecover = 0;
    let consecutiveLosses = 0;
    let disasters = 0;
    let wins = 0;

    // History tracking
    const recentHistory = [];
    const HISTORY_SIZE = 50;

    for (let i = 0; i < seed.length; i++) {
        const bust = seed[i];
        recentHistory.unshift(bust);
        if (recentHistory.length > HISTORY_SIZE) recentHistory.pop();

        // Update base bet based on current balance (Kelly Criterion inspired)
        baseBet = Math.max(100, Math.floor(balance * BASE_BET_PERCENT));

        // Check for profit target
        if (balance >= startBalance * (1 + PROFIT_TARGET_PERCENT / 100)) {
            // Take profit - reset to conservative mode
            phase = 'NORMAL';
            toRecover = 0;
            recoveryTimes = 0;
            consecutiveLosses = 0;
        }

        let currentBet = baseBet;
        let targetMult = PRIMARY_MULT;

        // Phase-based strategy
        if (phase === 'NORMAL') {
            // Check if we should wait for a pattern
            if (bust < PRIMARY_MULT) {
                patternCount++;
                if (patternCount >= PATTERN_THRESHOLD) {
                    phase = 'PATTERN_WAIT';
                    patternCount = 0;
                }
            } else {
                patternCount = Math.max(0, patternCount - 1);
            }

            // Normal betting
            if (bust >= PRIMARY_MULT) {
                balance += (currentBet * PRIMARY_MULT) - currentBet;
                wins++;
                consecutiveLosses = 0;
                toRecover = Math.max(0, toRecover - ((currentBet * PRIMARY_MULT) - currentBet));
            } else {
                balance -= currentBet;
                toRecover += currentBet;
                consecutiveLosses++;

                // Enter recovery if needed
                if (toRecover >= baseBet * 10) {
                    phase = 'RECOVERY';
                    recoveryTimes = 0;
                }
            }

        } else if (phase === 'PATTERN_WAIT') {
            // Wait for high multiplier then start aggressive betting
            if (bust >= 10) {
                phase = 'NORMAL';
                patternCount = 0;
            }
            // Don't bet during pattern wait
            continue;

        } else if (phase === 'RECOVERY') {
            // Recovery mode - use Fibonacci-like progression
            targetMult = RECOVERY_MULT;

            // Calculate recovery bet
            const recoveryFactor = 1 + Math.min(recoveryTimes * 0.5, 3);
            currentBet = Math.floor(toRecover / RECOVERY_MULT * recoveryFactor);
            currentBet = Math.max(baseBet, Math.min(currentBet, balance * 0.2)); // Max 20% of balance

            if (bust >= targetMult) {
                // Recovery win
                const profit = (currentBet * targetMult) - currentBet;
                balance += profit;
                wins++;
                toRecover = Math.max(0, toRecover - profit);

                if (toRecover <= baseBet) {
                    phase = 'NORMAL';
                    toRecover = 0;
                    recoveryTimes = 0;
                    consecutiveLosses = 0;
                }
            } else {
                // Recovery loss
                balance -= currentBet;
                toRecover += currentBet;
                recoveryTimes++;

                if (recoveryTimes >= MAX_RECOVERY_T) {
                    // Disaster recovery failed
                    disasters++;
                    balance = Math.max(balance, startBalance * 0.5); // Keep 50% as emergency fund
                    phase = 'NORMAL';
                    toRecover = 0;
                    recoveryTimes = 0;
                    consecutiveLosses = 0;
                    patternCount = 0;
                }
            }
        }

        // Emergency reset if balance too low
        if (balance < startBalance * 0.1) {
            disasters++;
            balance = startBalance;
            phase = 'NORMAL';
            toRecover = 0;
            recoveryTimes = 0;
            consecutiveLosses = 0;
            patternCount = 0;
            baseBet = Math.floor(balance * BASE_BET_PERCENT);
        }
    }

    return {
        name: 'Adaptive Hybrid',
        finalBalance: balance,
        profit: balance - startBalance,
        profitPercent: ((balance - startBalance) / startBalance) * 100,
        disasters,
        wins,
        winRate: (wins / seed.length) * 100,
        config
    };
}

// ==================== RUN TESTS ====================

// Test adaptive hybrid against existing algorithms
function runFinalComparison(numTests = 50, seedLength = 20000) {
    console.log('\n========================================');
    console.log('FINAL COMPARISON - ADAPTIVE HYBRID vs BEST EXISTING');
    console.log(`Running ${numTests} tests with ${seedLength} games each`);
    console.log('========================================\n');

    const algorithms = [
        { name: 'Adaptive Hybrid', func: testAdaptiveHybrid, config: {
            primaryMult: 2.5,
            recoveryMult: 3.0,
            baseBetPercent: 0.005,
            patternThreshold: 8,
            maxRecoveryT: 15,
            profitTargetPercent: 50
        }},
        { name: 'Adaptive Hybrid (Conservative)', func: testAdaptiveHybrid, config: {
            primaryMult: 2.0,
            recoveryMult: 2.5,
            baseBetPercent: 0.003,
            patternThreshold: 12,
            maxRecoveryT: 12,
            profitTargetPercent: 30
        }},
        { name: 'Adaptive Hybrid (Aggressive)', func: testAdaptiveHybrid, config: {
            primaryMult: 3.0,
            recoveryMult: 4.0,
            baseBetPercent: 0.008,
            patternThreshold: 6,
            maxRecoveryT: 18,
            profitTargetPercent: 100
        }},
        { name: 'Fibonacci Classic', func: testFibonacciClassic, config: {
            baseBet: 100, payout: 3, maxT: 20
        }},
        { name: 'Martingale Flat', func: testMartingaleFlat, config: {
            mult1: 1.9, mult2: 3, multiply2: 1.5, maxT: 20
        }},
        { name: 'Linear Recover', func: testLinearRecover, config: {
            payout: 3.05, baseBet: 200, percIncrement: 30
        }}
    ];

    const results = [];

    algorithms.forEach(({ name, func, config }) => {
        const testResults = [];

        for (let i = 0; i < numTests; i++) {
            const seed = generateSeed(seedLength);
            const result = func(seed, { ...config, initBalance: 1000000 });
            testResults.push(result);
        }

        const profits = testResults.map(r => r.profit);
        const profitPercents = testResults.map(r => r.profitPercent);
        const disasters = testResults.map(r => r.disasters);

        const avgProfit = profits.reduce((a, b) => a + b, 0) / profits.length;
        const avgProfitPercent = profitPercents.reduce((a, b) => a + b, 0) / profitPercents.length;
        const avgDisasters = disasters.reduce((a, b) => a + b, 0) / disasters.length;
        const positiveRuns = testResults.filter(r => r.profit > 0).length;
        const successRate = (positiveRuns / numTests) * 100;
        const medianProfit = profits.sort((a, b) => a - b)[Math.floor(profits.length / 2)];

        results.push({
            name,
            avgProfit: avgProfit / 100,
            medianProfit: medianProfit / 100,
            avgProfitPercent,
            avgDisasters,
            successRate,
            bestProfit: Math.max(...profits) / 100,
            worstProfit: Math.min(...profits) / 100,
            config
        });
    });

    // Sort by success rate then median profit
    results.sort((a, b) => {
        if (Math.abs(b.successRate - a.successRate) > 5) {
            return b.successRate - a.successRate;
        }
        return b.medianProfit - a.medianProfit;
    });

    console.log('\nFINAL RANKINGS:\n');
    results.forEach((r, idx) => {
        console.log(`${idx + 1}. ${r.name}`);
        console.log(`   Success Rate: ${r.successRate.toFixed(1)}%`);
        console.log(`   Avg Profit: ${r.avgProfit.toFixed(0)} bits (${r.avgProfitPercent.toFixed(2)}%)`);
        console.log(`   Median Profit: ${r.medianProfit.toFixed(0)} bits`);
        console.log(`   Range: ${r.worstProfit.toFixed(0)} to ${r.bestProfit.toFixed(0)} bits`);
        console.log(`   Avg Disasters: ${r.avgDisasters.toFixed(2)}`);
        console.log('');
    });

    return results;
}

// Run all tests
console.log('Starting comprehensive algorithm analysis...\n');

// First run quick tests on all existing algorithms
const quickResults = runComprehensiveTests(20, 5000);

console.log('\n========================================');
console.log('Quick test completed. Starting final comparison...');
console.log('========================================');

// Then run detailed comparison with the new adaptive hybrid
const finalResults = runFinalComparison(50, 20000);

console.log('\n========================================');
console.log('ANALYSIS COMPLETE');
console.log('========================================');
console.log('\nBest performing algorithm:');
console.log(`${finalResults[0].name}`);
console.log(`Success Rate: ${finalResults[0].successRate.toFixed(1)}%`);
console.log(`Average Profit: ${finalResults[0].avgProfit.toFixed(0)} bits`);
console.log(`Median Profit: ${finalResults[0].medianProfit.toFixed(0)} bits`);
