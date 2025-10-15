/**
 * FIBONACCI ALGORITHMS - TEST CON SEED REALI BUSTABIT
 *
 * Re-test dei principali algoritmi Fibonacci con seed REALI
 * per vedere se anche questi erano sovra-stimati
 */

const { generateTestSeed } = require('./real-bustabit-seed-generator');

const CAPITAL = 10000000;  // 100k bits (come nei test precedenti)
const SESSION_GAMES = 5000;
const NUM_SEEDS = 5000;

/**
 * Classic Fibonacci
 */
function simulateFibonacci(crashes, payout, maxSteps, capital) {
    const fib = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584, 4181, 6765];
    let balance = capital;
    const initBalance = balance;
    let currentStep = 0;
    let maxDrawdown = 0;

    for (let i = 0; i < crashes.length && i < SESSION_GAMES; i++) {
        const crash = crashes[i];
        const bet = fib[Math.min(currentStep, fib.length - 1)] * 100;

        if (balance < bet) {
            return {
                success: false,
                finalBalance: balance,
                profit: balance - initBalance,
                profitPercent: ((balance - initBalance) / initBalance) * 100,
                maxDrawdown: maxDrawdown
            };
        }

        if (crash >= payout) {
            // WIN
            const win = Math.floor(bet * payout) - bet;
            balance += win;
            currentStep = Math.max(0, currentStep - 2); // Scala Fibonacci
        } else {
            // LOSS
            balance -= bet;
            currentStep++;

            const drawdown = ((initBalance - balance) / initBalance) * 100;
            if (drawdown > maxDrawdown) maxDrawdown = drawdown;

            if (currentStep >= maxSteps) {
                currentStep = 0; // Reset
            }
        }
    }

    return {
        success: balance > initBalance * 0.5,
        finalBalance: balance,
        profit: balance - initBalance,
        profitPercent: ((balance - initBalance) / initBalance) * 100,
        maxDrawdown: maxDrawdown
    };
}

/**
 * Adaptive Fibonacci (con drawdown adjustment)
 */
function simulateAdaptiveFibonacci(crashes, payout, maxSteps, capital) {
    const fib = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584, 4181, 6765];
    let balance = capital;
    const initBalance = balance;
    let currentStep = 0;
    let maxDrawdown = 0;

    for (let i = 0; i < crashes.length && i < SESSION_GAMES; i++) {
        const crash = crashes[i];

        // Adaptive: riduci bet se drawdown alto
        const currentDrawdown = ((initBalance - balance) / initBalance) * 100;
        const drawdownFactor = currentDrawdown > 20 ? 0.5 : currentDrawdown > 10 ? 0.75 : 1.0;

        const bet = Math.floor(fib[Math.min(currentStep, fib.length - 1)] * 100 * drawdownFactor);

        if (balance < bet) {
            return {
                success: false,
                finalBalance: balance,
                profit: balance - initBalance,
                profitPercent: ((balance - initBalance) / initBalance) * 100,
                maxDrawdown: maxDrawdown
            };
        }

        if (crash >= payout) {
            const win = Math.floor(bet * payout) - bet;
            balance += win;
            currentStep = Math.max(0, currentStep - 2);
        } else {
            balance -= bet;
            currentStep++;

            const drawdown = ((initBalance - balance) / initBalance) * 100;
            if (drawdown > maxDrawdown) maxDrawdown = drawdown;

            if (currentStep >= maxSteps) {
                currentStep = 0;
            }
        }
    }

    return {
        success: balance > initBalance * 0.5,
        finalBalance: balance,
        profit: balance - initBalance,
        profitPercent: ((balance - initBalance) / initBalance) * 100,
        maxDrawdown: maxDrawdown
    };
}

/**
 * Test una configurazione
 */
function testConfig(name, simulateFn, payout, maxSteps, numSeeds) {
    const results = [];

    for (let i = 0; i < numSeeds; i++) {
        const crashes = generateTestSeed(SESSION_GAMES);
        const result = simulateFn(crashes, payout, maxSteps, CAPITAL);
        results.push(result);
    }

    const successes = results.filter(r => r.success).length;
    const positives = results.filter(r => r.profit > 0).length;
    const profits = results.map(r => r.profitPercent);
    const drawdowns = results.map(r => r.maxDrawdown);

    const avgProfit = profits.reduce((a, b) => a + b, 0) / profits.length;
    const avgDrawdown = drawdowns.reduce((a, b) => a + b, 0) / drawdowns.length;

    const stdDev = Math.sqrt(profits.reduce((sum, val) => sum + Math.pow(val - avgProfit, 2), 0) / profits.length);
    const sharpeRatio = stdDev === 0 ? 0 : avgProfit / stdDev;

    return {
        name,
        payout,
        maxSteps,
        successRate: (successes / numSeeds) * 100,
        positiveRate: (positives / numSeeds) * 100,
        avgProfit,
        sharpeRatio,
        avgDrawdown
    };
}

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║  FIBONACCI - TEST CON SEED REALI BUSTABIT                  ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

console.log('📋 Configurazioni:');
console.log(`   Capital: ${(CAPITAL / 100).toLocaleString()} bits`);
console.log(`   Session: ${SESSION_GAMES} games`);
console.log(`   Seeds: ${NUM_SEEDS.toLocaleString()}\n`);

console.log('🔄 Testing Fibonacci algorithms with REAL seeds...\n');

const configs = [
    // Classic Fibonacci
    { name: 'Classic Fib 2.0x-T20', fn: simulateFibonacci, payout: 2.0, maxSteps: 20 },
    { name: 'Classic Fib 2.5x-T20', fn: simulateFibonacci, payout: 2.5, maxSteps: 20 },
    { name: 'Classic Fib 3.0x-T20', fn: simulateFibonacci, payout: 3.0, maxSteps: 20 },

    // Adaptive Fibonacci
    { name: 'Adaptive Fib 2.0x-T20', fn: simulateAdaptiveFibonacci, payout: 2.0, maxSteps: 20 },
    { name: 'Adaptive Fib 2.5x-T20', fn: simulateAdaptiveFibonacci, payout: 2.5, maxSteps: 20 },
    { name: 'Adaptive Fib 3.0x-T20', fn: simulateAdaptiveFibonacci, payout: 3.0, maxSteps: 20 }
];

const results = [];
const startTime = Date.now();

configs.forEach((config, idx) => {
    const result = testConfig(config.name, config.fn, config.payout, config.maxSteps, NUM_SEEDS);
    results.push(result);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`   ✅ ${config.name.padEnd(25)} | ${elapsed}s`);
});

const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

console.log(`\n   Completed in ${totalTime}s\n`);

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

// Best results
results.sort((a, b) => b.sharpeRatio - a.sharpeRatio);

console.log('🏆 BEST FIBONACCI (by Sharpe Ratio):\n');
console.log(`   ${results[0].name}`);
console.log(`   Success: ${results[0].successRate.toFixed(2)}%`);
console.log(`   Profit: ${results[0].avgProfit.toFixed(2)}%`);
console.log(`   Sharpe: ${results[0].sharpeRatio.toFixed(3)}`);
console.log('');

// Confronto con vecchi risultati
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log('🔄 CONFRONTO CON SEED FAKE (vecchia analisi Fib 2.5x):\n');
console.log('   Metrica              | Seed FAKE  | Seed REALI | Diff');
console.log('   ─────────────────────┼────────────┼────────────┼──────');

const fib25Real = results.find(r => r.name.includes('2.5x'));
console.log(`   Success Rate         | 91.90%     | ${fib25Real.successRate.toFixed(2).padStart(10)}% | ${(fib25Real.successRate - 91.9).toFixed(2)}`);
console.log(`   Avg Profit %         | +7.93%     | ${fib25Real.avgProfit.toFixed(2).padStart(9)}% | ${(fib25Real.avgProfit - 7.93).toFixed(2)}`);
console.log(`   Sharpe Ratio         | (unknown)  | ${fib25Real.sharpeRatio.toFixed(3).padStart(10)} | N/A`);
console.log('');

// Save results
const fs = require('fs');
fs.writeFileSync(
    'fibonacci-real-seed-results.json',
    JSON.stringify({ results, totalTime, numSeeds: NUM_SEEDS }, null, 2)
);

console.log('💾 Results saved to: fibonacci-real-seed-results.json\n');
