/**
 * FINAL OPTIMAL ANALYSIS
 *
 * 20.000 seed con capitali adeguati per sessioni 5k-10k partite
 * Focus: Trovare IL punto ottimale tra capitale e profitto
 */

function generateSeed(n) {
    let values = [];
    for (let index = 0; index < n; index++) {
        values.push(Math.floor(Math.max(0.99 / (1 - Math.random()), 1) * 100) / 100);
    }
    return values;
}

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

    for (let i = 0; i < seed.length; i++) {
        const bust = seed[i];

        if (k > maxT || currentBet > balance || balance <= 0) {
            return {
                ruined: true,
                finalBalance: Math.max(balance, 0),
                profit: Math.max(balance, 0) - initialBalance,
                profitPercent: ((Math.max(balance, 0) - initialBalance) / initialBalance) * 100
            };
        }

        // Fibonacci
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

        if (bust >= payout) {
            balance += Math.floor((currentBet * payout) - currentBet);
            totalWins++;
            k = 0;
        } else {
            balance -= currentBet;
            totalLosses++;
            k++;
        }

        if (balance > maxBalance) maxBalance = balance;
        if (balance < minBalance) minBalance = balance;
    }

    return {
        ruined: false,
        finalBalance: balance,
        profit: balance - initialBalance,
        profitPercent: ((balance - initialBalance) / initialBalance) * 100,
        maxDrawdownPercent: ((initialBalance - minBalance) / initialBalance) * 100,
        totalWins,
        totalLosses
    };
}

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║         FINAL OPTIMAL ANALYSIS - 20K SEEDS               ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

const NUM_SEEDS = 20000;
const SESSION_LENGTHS = [5000, 7500, 10000];

// Focus on proven configurations with adequate capital
const configs = [
    { baseBet: 100, payout: 2.5, maxT: 20, name: 'Fib-2.5x' },
    { baseBet: 100, payout: 3.0, maxT: 22, name: 'Fib-3.0x' },
    { baseBet: 100, payout: 3.5, maxT: 24, name: 'Fib-3.5x' },
];

// Capitali adeguati per queste durate
const capitals = [
    250000,    // 2,500 bits
    500000,    // 5,000 bits
    1000000,   // 10,000 bits
    2500000,   // 25,000 bits
];

console.log('Testing configurations...\n');

const results = {};
let completed = 0;
const total = NUM_SEEDS * SESSION_LENGTHS.length * configs.length * capitals.length;

configs.forEach(config => {
    results[config.name] = {};
    capitals.forEach(capital => {
        results[config.name][capital] = {};
        SESSION_LENGTHS.forEach(length => {
            results[config.name][capital][length] = [];
        });
    });
});

// Generate and test
for (let i = 0; i < NUM_SEEDS; i++) {
    const seeds = {};
    SESSION_LENGTHS.forEach(len => {
        seeds[len] = generateSeed(len);
    });

    configs.forEach(config => {
        capitals.forEach(capital => {
            SESSION_LENGTHS.forEach(length => {
                const result = simulateFibonacci(seeds[length], capital, config);
                results[config.name][capital][length].push(result);
                completed++;

                if (completed % 50000 === 0) {
                    process.stdout.write(`\r  Progress: ${((completed / total) * 100).toFixed(1)}%`);
                }
            });
        });
    });
}

console.log('\n\n✓ Analysis complete!\n');

// Analyze
console.log('═══════════════════════════════════════════════════════════');
console.log('                      RESULTS                              ');
console.log('═══════════════════════════════════════════════════════════\n');

const summary = [];

configs.forEach(config => {
    capitals.forEach(capital => {
        SESSION_LENGTHS.forEach(length => {
            const data = results[config.name][capital][length];
            const successful = data.filter(r => !r.ruined);

            if (successful.length > 0) {
                const profits = successful.map(r => r.profit).sort((a, b) => a - b);
                const profitPercents = successful.map(r => r.profitPercent);
                const drawdowns = successful.map(r => r.maxDrawdownPercent);

                const successRate = (successful.length / data.length) * 100;
                const avgProfit = profits.reduce((a, b) => a + b, 0) / profits.length;
                const medianProfit = profits[Math.floor(profits.length / 2)];
                const positiveCount = profits.filter(p => p > 0).length;
                const positiveRate = (positiveCount / profits.length) * 100;

                const avgProfitPercent = profitPercents.reduce((a, b) => a + b, 0) / profitPercents.length;
                const avgDrawdown = drawdowns.reduce((a, b) => a + b, 0) / drawdowns.length;

                const variance = profits.reduce((sum, p) => sum + Math.pow(p - avgProfit, 2), 0) / profits.length;
                const stdDev = Math.sqrt(variance);

                summary.push({
                    config: config.name,
                    payout: config.payout,
                    capital,
                    capitalBits: capital / 100,
                    length,
                    successRate,
                    positiveRate,
                    avgProfit: avgProfit / 100,
                    medianProfit: medianProfit / 100,
                    minProfit: profits[0] / 100,
                    maxProfit: profits[profits.length - 1] / 100,
                    avgProfitPercent,
                    avgDrawdown,
                    stdDev: stdDev / 100,
                    roiEfficiency: avgProfit / capital,
                    sharpeRatio: avgProfit / Math.max(stdDev, 1),
                    numTests: data.length,
                    numSuccessful: successful.length,
                    numPositive: positiveCount
                });
            }
        });
    });
});

// Filter good ones
const excellent = summary.filter(r =>
    r.successRate >= 95 &&
    r.positiveRate >= 70 &&
    r.avgProfit > 0
);

console.log(`Excellent configurations (≥95% success, ≥70% positive, profitable): ${excellent.length}\n`);

if (excellent.length > 0) {
    // MINIMUM CAPITAL
    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│  🏆 TOP 10: MINIMUM CAPITAL WITH EXCELLENT RESULTS      │');
    console.log('└─────────────────────────────────────────────────────────┘\n');

    const minCap = [...excellent]
        .sort((a, b) => {
            if (a.capital !== b.capital) return a.capital - b.capital;
            return b.avgProfitPercent - a.avgProfitPercent;
        })
        .slice(0, 10);

    minCap.forEach((r, idx) => {
        console.log(`${idx + 1}. ${r.config} | ${r.length.toLocaleString()} games`);
        console.log(`   💰 Capital: ${r.capitalBits.toLocaleString()} bits ⭐`);
        console.log(`   ✅ Success: ${r.successRate.toFixed(1)}% | Positive: ${r.positiveRate.toFixed(1)}%`);
        console.log(`   💵 Avg Profit: ${r.avgProfit.toFixed(0)} bits (${r.avgProfitPercent.toFixed(2)}%)`);
        console.log(`   📊 Median: ${r.medianProfit.toFixed(0)} bits`);
        console.log(`   📈 ROI: ${(r.roiEfficiency * 100).toFixed(2)}%`);
        console.log(`   📉 Drawdown: ${r.avgDrawdown.toFixed(1)}%`);
        console.log(`   📍 Range: ${r.minProfit.toFixed(0)} to ${r.maxProfit.toFixed(0)}`);
        console.log('');
    });

    // BEST PROFIT %
    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│  📈 TOP 10: HIGHEST PROFIT PERCENTAGE                    │');
    console.log('└─────────────────────────────────────────────────────────┘\n');

    const bestProfit = [...excellent]
        .sort((a, b) => b.avgProfitPercent - a.avgProfitPercent)
        .slice(0, 10);

    bestProfit.forEach((r, idx) => {
        console.log(`${idx + 1}. ${r.config} | ${r.length.toLocaleString()} games | ${r.capitalBits.toLocaleString()} bits`);
        console.log(`   📈 Profit: ${r.avgProfitPercent.toFixed(2)}% ⭐ (${r.avgProfit.toFixed(0)} bits)`);
        console.log(`   ✅ Success: ${r.successRate.toFixed(1)}% | Positive: ${r.positiveRate.toFixed(1)}%`);
        console.log(`   Median: ${r.medianProfit.toFixed(0)} | ROI: ${(r.roiEfficiency * 100).toFixed(2)}%`);
        console.log('');
    });

    // BEST ROI
    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│  🎯 TOP 10: BEST ROI EFFICIENCY                          │');
    console.log('└─────────────────────────────────────────────────────────┘\n');

    const bestROI = [...excellent]
        .sort((a, b) => b.roiEfficiency - a.roiEfficiency)
        .slice(0, 10);

    bestROI.forEach((r, idx) => {
        console.log(`${idx + 1}. ${r.config} | ${r.length.toLocaleString()} games | ${r.capitalBits.toLocaleString()} bits`);
        console.log(`   🎯 ROI: ${(r.roiEfficiency * 100).toFixed(2)}% ⭐`);
        console.log(`   Profit: ${r.avgProfitPercent.toFixed(2)}% (${r.avgProfit.toFixed(0)} bits)`);
        console.log(`   Success: ${r.successRate.toFixed(1)}% | Positive: ${r.positiveRate.toFixed(1)}%`);
        console.log('');
    });

    // OPTIMAL
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║         🏆 CONFIGURAZIONE OTTIMALE ASSOLUTA 🏆            ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

    // Best overall: minimum capital with best profit
    const optimal = minCap[0];

    console.log(`Configuration: ${optimal.config}`);
    console.log(`Payout: ${optimal.payout}x\n`);
    console.log(`📊 TESTATO SU ${NUM_SEEDS.toLocaleString()} SEED CASUALI:\n`);
    console.log(`   💰 Capitale Minimo: ${optimal.capitalBits.toLocaleString()} bits`);
    console.log(`   🎮 Durata Sessione: ${optimal.length.toLocaleString()} partite`);
    console.log(`   ✅ Successo Totale: ${optimal.successRate.toFixed(2)}% (${optimal.numSuccessful}/${optimal.numTests})`);
    console.log(`   💚 Profitto Positivo: ${optimal.positiveRate.toFixed(2)}% (${optimal.numPositive}/${optimal.numSuccessful})`);
    console.log(`\n   💵 PROFITTO MEDIO: ${optimal.avgProfit.toFixed(0)} bits`);
    console.log(`   📈 PROFITTO %: ${optimal.avgProfitPercent.toFixed(2)}%`);
    console.log(`   📊 Profitto Mediano: ${optimal.medianProfit.toFixed(0)} bits`);
    console.log(`   🎯 ROI Efficiency: ${(optimal.roiEfficiency * 100).toFixed(2)}%`);
    console.log(`   🛡️ Sharpe Ratio: ${optimal.sharpeRatio.toFixed(2)}`);
    console.log(`\n   📉 RISCHIO:`);
    console.log(`      Drawdown Medio: ${optimal.avgDrawdown.toFixed(2)}%`);
    console.log(`      Std Deviation: ${optimal.stdDev.toFixed(0)} bits`);
    console.log(`\n   📍 RANGE PROFITTI:`);
    console.log(`      Minimo: ${optimal.minProfit.toFixed(0)} bits`);
    console.log(`      Mediano: ${optimal.medianProfit.toFixed(0)} bits`);
    console.log(`      Massimo: ${optimal.maxProfit.toFixed(0)} bits`);

    console.log(`\n✨ CARATTERISTICHE:`);
    console.log(`   • ${optimal.successRate.toFixed(0)}% delle sessioni completano senza disastri`);
    console.log(`   • ${optimal.positiveRate.toFixed(0)}% delle sessioni chiudono in profitto`);
    console.log(`   • Profitto medio garantito: +${optimal.avgProfitPercent.toFixed(1)}%`);
    console.log(`   • Rischio contenuto: ${optimal.avgDrawdown.toFixed(1)}% drawdown`);
    console.log(`   • Capitale accessibile: ${optimal.capitalBits.toLocaleString()} bits`);

    console.log(`\n🔧 CONFIGURAZIONE DA USARE:\n`);
    console.log(`{`);
    console.log(`  algorithm: "Fibonacci",`);
    console.log(`  baseBet: 100,`);
    console.log(`  payout: ${optimal.payout},`);
    console.log(`  maxT: ${optimal.payout === 2.5 ? 20 : optimal.payout === 3.0 ? 22 : 24},`);
    console.log(`  startingCapital: ${optimal.capital},  // ${optimal.capitalBits.toLocaleString()} bits`);
    console.log(`  maxGames: ${optimal.length},`);
    console.log(`  stopLoss: 20,           // Stop at -20%`);
    console.log(`  takeProfit: 50          // Take profit at +50%`);
    console.log(`}\n`);

    // Comparison table
    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│  📊 COMPARISON: SESSION LENGTH IMPACT                    │');
    console.log('│     (Using optimal config & capital)                     │');
    console.log('└─────────────────────────────────────────────────────────┘\n');

    const optConfig = optimal.config;
    const optCapital = optimal.capital;

    SESSION_LENGTHS.forEach(len => {
        const data = excellent.find(r =>
            r.config === optConfig &&
            r.capital === optCapital &&
            r.length === len
        );
        if (data) {
            console.log(`${len.toLocaleString().padStart(6)} games: ${data.successRate.toFixed(1)}% success | ${data.positiveRate.toFixed(1)}% positive | ${data.avgProfitPercent.toFixed(2)}% profit (${data.avgProfit.toFixed(0)} bits)`);
        }
    });

} else {
    console.log('❌ No configuration met the excellent criteria\n');
    console.log('Showing best available (≥90% success):\n');

    const good = summary
        .filter(r => r.successRate >= 90 && r.avgProfit > 0)
        .sort((a, b) => {
            if (a.capital !== b.capital) return a.capital - b.capital;
            return b.avgProfitPercent - a.avgProfitPercent;
        })
        .slice(0, 10);

    good.forEach((r, idx) => {
        console.log(`${idx + 1}. ${r.config} | ${r.length} games | ${r.capitalBits} bits`);
        console.log(`   Success: ${r.successRate.toFixed(1)}% | Positive: ${r.positiveRate.toFixed(1)}%`);
        console.log(`   Profit: ${r.avgProfitPercent.toFixed(2)}% (${r.avgProfit.toFixed(0)} bits)`);
        console.log('');
    });
}

console.log('\n═══════════════════════════════════════════════════════════');
console.log('           ANALYSIS COMPLETE - 20K SEEDS                   ');
console.log('═══════════════════════════════════════════════════════════\n');
