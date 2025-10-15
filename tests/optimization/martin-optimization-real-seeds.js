/**
 * MARTIN AI - OTTIMIZZAZIONE COMPLETA CON SEED REALI
 *
 * Testa TUTTE le configurazioni candidate con seed REALI di Bustabit
 * per trovare quella VERAMENTE ottimale
 *
 * Testing:
 * - Payouts: 2.5x, 2.7x, 2.8x, 3.0x, 3.1x, 3.2x
 * - Multipliers: 1.40x, 1.45x, 1.48x, 1.51x, 1.55x
 * - MaxTimes: 23, 25, 27
 * - Wait modes: 0, 1, 2
 * - Capital: 50k bits
 * - Session: 4k games
 * - Seeds: 50k (per velocità, poi 100k per top configs)
 */

const { generateTestSeed } = require('./real-bustabit-seed-generator');

const CAPITAL = 5000000;  // 50k bits
const SESSION_GAMES = 4000;
const BASE_BET = 100;
const NUM_SEEDS = 10000;  // 10k per velocità (poi aumenteremo per top configs)

// Configurazioni da testare
const configs = [];

// Generate all combinations (RIDOTTE per velocità)
const payouts = [2.5, 2.7, 3.0, 3.2];  // ridotto da 6 a 4
const mults = [1.40, 1.45, 1.48, 1.51];  // ridotto da 5 a 4
const maxTimes = [23, 25];  // ridotto da 3 a 2
const waitModes = [0, 2];  // ridotto da 3 a 2

payouts.forEach(payout => {
    mults.forEach(mult => {
        maxTimes.forEach(maxT => {
            waitModes.forEach(wait => {
                configs.push({
                    payout,
                    mult,
                    maxTimes: maxT,
                    waitBeforePlay: wait,
                    name: `M${mult}-P${payout}x-T${maxT}-W${wait}`
                });
            });
        });
    });
});

console.log(`\n📋 Total configurations to test: ${configs.length}\n`);

/**
 * Simula Martin AI (stesso codice del file precedente)
 */
function simulateMartin(crashes, config) {
    let balance = CAPITAL;
    const initBalance = balance;
    let currentBet = BASE_BET;
    let currentTimes = 0;
    let maxDrawdown = 0;
    let state = config.waitBeforePlay === 0 ? 'BETTING' : 'WAITING';
    let waitRemaining = config.waitBeforePlay;
    let totalWins = 0;
    let totalLosses = 0;

    for (let i = 0; i < crashes.length && i < SESSION_GAMES; i++) {
        const crash = crashes[i];

        if (state === 'WAITING') {
            if (crash < config.payout) {
                waitRemaining = Math.max(0, waitRemaining - 1);
                if (waitRemaining === 0) {
                    state = 'BETTING';
                    currentBet = BASE_BET;
                    currentTimes = 0;
                }
            } else {
                waitRemaining = config.waitBeforePlay;
            }
            continue;
        }

        if (balance < currentBet) {
            return {
                success: false,
                finalBalance: balance,
                profit: balance - initBalance,
                profitPercent: ((balance - initBalance) / initBalance) * 100,
                maxDrawdown: maxDrawdown
            };
        }

        if (crash >= config.payout) {
            const win = Math.floor(currentBet * config.payout) - currentBet;
            balance += win;
            totalWins++;
            currentBet = BASE_BET;
            currentTimes = 0;

            if (config.waitBeforePlay > 0) {
                state = 'WAITING';
                waitRemaining = config.waitBeforePlay;
            }
        } else {
            balance -= currentBet;
            totalLosses++;
            currentTimes++;

            const drawdown = ((initBalance - balance) / initBalance) * 100;
            if (drawdown > maxDrawdown) maxDrawdown = drawdown;

            if (config.maxTimes > 0 && currentTimes >= config.maxTimes) {
                currentBet = BASE_BET;
                currentTimes = 0;

                if (config.waitBeforePlay > 0) {
                    state = 'WAITING';
                    waitRemaining = config.waitBeforePlay;
                }
            } else {
                currentBet = Math.ceil((currentBet / 100) * config.mult) * 100;
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
function testConfig(config, numSeeds) {
    const results = [];

    for (let i = 0; i < numSeeds; i++) {
        const crashes = generateTestSeed(SESSION_GAMES);
        const result = simulateMartin(crashes, config);
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
        config: config.name,
        successRate: (successes / numSeeds) * 100,
        positiveRate: (positives / numSeeds) * 100,
        avgProfit,
        sharpeRatio,
        avgDrawdown,
        payout: config.payout,
        mult: config.mult,
        maxTimes: config.maxTimes,
        wait: config.waitBeforePlay
    };
}

/**
 * Run full optimization
 */
console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║  MARTIN AI - OTTIMIZZAZIONE CON SEED REALI                 ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

console.log(`🔄 Testing ${configs.length} configurations × ${NUM_SEEDS.toLocaleString()} seeds each...\n`);
console.log(`   Capital: ${(CAPITAL/100).toLocaleString()} bits`);
console.log(`   Session: ${SESSION_GAMES} games`);
console.log(`   Total simulations: ${(configs.length * NUM_SEEDS).toLocaleString()}\n`);

const startTime = Date.now();
const allResults = [];

configs.forEach((config, idx) => {
    const result = testConfig(config, NUM_SEEDS);
    allResults.push(result);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const rate = ((idx + 1) / (Date.now() - startTime) * 1000 * NUM_SEEDS).toFixed(0);
    process.stdout.write(`\r   Progress: ${idx + 1}/${configs.length} configs (${rate} sims/s, ${elapsed}s)   `);
});

const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
console.log(`\n\n   ✅ Completed in ${totalTime}s\n`);

// Sort by Sharpe Ratio
allResults.sort((a, b) => b.sharpeRatio - a.sharpeRatio);

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log('🏆 TOP 10 CONFIGURATIONS (by Sharpe Ratio):\n');
console.log('Rank | Config              | Success | Profit  | Sharpe  | Drawdown');
console.log('─────┼─────────────────────┼─────────┼─────────┼─────────┼──────────');

allResults.slice(0, 10).forEach((r, idx) => {
    console.log(
        `${(idx + 1).toString().padStart(4)} | ` +
        `${r.config.padEnd(19)} | ` +
        `${r.successRate.toFixed(2).padStart(6)}% | ` +
        `${r.avgProfit.toFixed(2).padStart(6)}% | ` +
        `${r.sharpeRatio.toFixed(3).padStart(7)} | ` +
        `${r.avgDrawdown.toFixed(2).padStart(7)}%`
    );
});

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Best by different criteria
const bestSharpe = allResults[0];
const bestProfit = allResults.sort((a, b) => b.avgProfit - a.avgProfit)[0];
const bestSuccess = allResults.sort((a, b) => b.successRate - a.successRate)[0];
const bestLowDrawdown = allResults.sort((a, b) => a.avgDrawdown - b.avgDrawdown)[0];

console.log('📊 BEST BY CRITERIA:\n');
console.log(`   🏆 Best Sharpe:      ${bestSharpe.config} (${bestSharpe.sharpeRatio.toFixed(3)})`);
console.log(`   💰 Best Profit:      ${bestProfit.config} (${bestProfit.avgProfit.toFixed(2)}%)`);
console.log(`   ✅ Best Success:     ${bestSuccess.config} (${bestSuccess.successRate.toFixed(2)}%)`);
console.log(`   🛡️  Best Drawdown:    ${bestLowDrawdown.config} (${bestLowDrawdown.avgDrawdown.toFixed(2)}%)`);
console.log('');

// Save results
const fs = require('fs');
fs.writeFileSync(
    'martin-real-seed-results.json',
    JSON.stringify({ allResults, bestSharpe, bestProfit, bestSuccess, bestLowDrawdown, totalTime, numSeeds: NUM_SEEDS }, null, 2)
);

console.log('💾 Results saved to: martin-real-seed-results.json\n');
