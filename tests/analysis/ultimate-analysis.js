/**
 * ULTIMATE ANALYSIS - Analisi Definitiva
 *
 * 100 seed × 200,000 partite
 * Focus: Trovare il capitale minimo necessario per ogni configurazione
 *        e massimizzare il profitto finale
 */

// ==================== SEED GENERATION ====================
function generateSeed(n) {
    let values = [];
    for (let index = 0; index < n; index++) {
        values.push(Math.floor(Math.max(0.99 / (1 - Math.random()), 1) * 100) / 100);
    }
    return values;
}

// ==================== FIBONACCI WITH DETAILED TRACKING ====================

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
    let maxConsecutiveLosses = 0;
    let currentConsecutiveLosses = 0;

    let ruined = false;
    let ruinedAtGame = -1;

    for (let i = 0; i < seed.length; i++) {
        const bust = seed[i];

        // Check disaster conditions
        if (k > maxT) {
            ruined = true;
            ruinedAtGame = i;
            break;
        }

        // Calculate Fibonacci sequence bet
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

        // Check if can afford current bet
        if (currentBet > balance) {
            ruined = true;
            ruinedAtGame = i;
            break;
        }

        // Place bet and resolve
        if (bust >= payout) {
            // WIN
            const profit = Math.floor((currentBet * payout) - currentBet);
            balance += profit;
            totalWins++;
            k = 0;
            currentConsecutiveLosses = 0;
        } else {
            // LOSS
            balance -= currentBet;
            totalLosses++;
            k++;
            currentConsecutiveLosses++;
            if (currentConsecutiveLosses > maxConsecutiveLosses) {
                maxConsecutiveLosses = currentConsecutiveLosses;
            }
        }

        // Track balance extremes
        if (balance > maxBalance) maxBalance = balance;
        if (balance < minBalance) minBalance = balance;

        // Check for bankruptcy
        if (balance <= 0) {
            ruined = true;
            ruinedAtGame = i;
            break;
        }
    }

    return {
        config: config.name,
        payout: config.payout,
        maxT: config.maxT,
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
        totalGames: totalWins + totalLosses,
        winRate: (totalWins / Math.max(totalWins + totalLosses, 1)) * 100,
        maxConsecutiveLosses,
        ruined,
        ruinedAtGame,
        survivedGames: ruined ? ruinedAtGame : seed.length,
        completedAllGames: !ruined
    };
}

// ==================== MAIN ANALYSIS ====================

console.log('╔════════════════════════════════════════╗');
console.log('║   ULTIMATE FIBONACCI ANALYSIS          ║');
console.log('║   100 Seeds × 200,000 Games            ║');
console.log('╚════════════════════════════════════════╝\n');

const NUM_SEEDS = 100;
const GAMES_PER_SEED = 200000;

// Configurations to test (Fibonacci only, most proven algorithm)
const configurations = [
    { baseBet: 100, payout: 2.0, maxT: 20, name: 'Fib-2.0x-T20' },
    { baseBet: 100, payout: 2.5, maxT: 22, name: 'Fib-2.5x-T22' },
    { baseBet: 100, payout: 3.0, maxT: 24, name: 'Fib-3.0x-T24' },
    { baseBet: 100, payout: 3.0, maxT: 26, name: 'Fib-3.0x-T26' },
    { baseBet: 100, payout: 3.5, maxT: 26, name: 'Fib-3.5x-T26' },
    { baseBet: 100, payout: 4.0, maxT: 28, name: 'Fib-4.0x-T28' },
];

// Capital levels (molto più alti per 200k partite)
const capitalLevels = [
    1000000,    // 10,000 bits
    2500000,    // 25,000 bits
    5000000,    // 50,000 bits
    10000000,   // 100,000 bits
    25000000,   // 250,000 bits
    50000000,   // 500,000 bits
    100000000,  // 1,000,000 bits
    250000000,  // 2,500,000 bits
];

// Generate all seeds
console.log('Generating seeds...');
const seeds = [];
for (let s = 0; s < NUM_SEEDS; s++) {
    seeds.push(generateSeed(GAMES_PER_SEED));
    if ((s + 1) % 25 === 0) {
        process.stdout.write(`\r  ${s + 1}/100 seeds`);
    }
}
console.log('\r✓ 100 seeds generated\n');

// Run simulations
console.log('Running simulations...\n');
const allResults = {};

let completed = 0;
const total = configurations.length * capitalLevels.length * NUM_SEEDS;

configurations.forEach((config) => {
    allResults[config.name] = {};

    capitalLevels.forEach((capital) => {
        const results = [];

        seeds.forEach((seed) => {
            const result = simulateFibonacci(seed, capital, config);
            results.push(result);
            completed++;

            if (completed % 500 === 0) {
                process.stdout.write(`\r  Progress: ${completed}/${total} (${(completed / total * 100).toFixed(1)}%)`);
            }
        });

        // Calculate aggregate stats
        const successful = results.filter(r => r.completedAllGames);
        const successRate = (successful.length / results.length) * 100;

        if (successful.length > 0) {
            const profits = successful.map(r => r.profit).sort((a, b) => a - b);
            const profitPercents = successful.map(r => r.profitPercent);
            const drawdowns = successful.map(r => r.maxDrawdownPercent);

            const avgProfit = profits.reduce((a, b) => a + b, 0) / profits.length;
            const medianProfit = profits[Math.floor(profits.length / 2)];
            const q1Profit = profits[Math.floor(profits.length * 0.25)];
            const q3Profit = profits[Math.floor(profits.length * 0.75)];

            const avgProfitPercent = profitPercents.reduce((a, b) => a + b, 0) / profitPercents.length;
            const avgDrawdown = drawdowns.reduce((a, b) => a + b, 0) / drawdowns.length;

            const variance = profits.reduce((sum, p) => sum + Math.pow(p - avgProfit, 2), 0) / profits.length;
            const stdDev = Math.sqrt(variance);

            allResults[config.name][capital] = {
                successRate,
                numSuccessful: successful.length,
                numFailed: results.length - successful.length,
                avgProfit,
                medianProfit,
                q1Profit,
                q3Profit,
                minProfit: profits[0],
                maxProfit: profits[profits.length - 1],
                avgProfitPercent,
                avgDrawdown,
                maxDrawdown: Math.max(...drawdowns),
                stdDev,
                roiEfficiency: avgProfit / capital,
                sharpeRatio: avgProfit / Math.max(stdDev, 1)
            };
        } else {
            allResults[config.name][capital] = {
                successRate: 0,
                numSuccessful: 0,
                numFailed: results.length
            };
        }
    });
});

console.log('\n\n✓ Simulations completed!\n');

// ==================== ANALYSIS & REPORTING ====================

console.log('═══════════════════════════════════════════════════════════');
console.log('                    RESULTS ANALYSIS                        ');
console.log('═══════════════════════════════════════════════════════════\n');

// Find best configurations
const summary = [];

configurations.forEach(config => {
    capitalLevels.forEach(capital => {
        const result = allResults[config.name][capital];
        if (result && result.successRate >= 80) {
            summary.push({
                config: config.name,
                payout: config.payout,
                maxT: config.maxT,
                capital,
                capitalBits: capital / 100,
                ...result
            });
        }
    });
});

console.log(`Configurations with ≥80% success rate: ${summary.length}\n`);

if (summary.length === 0) {
    console.log('⚠️ Nessuna configurazione ha raggiunto 80% di successo');
    console.log('Mostrando le migliori disponibili:\n');

    const allConfigs = [];
    configurations.forEach(config => {
        capitalLevels.forEach(capital => {
            const result = allResults[config.name][capital];
            if (result && result.successRate > 0) {
                allConfigs.push({
                    config: config.name,
                    payout: config.payout,
                    capital,
                    capitalBits: capital / 100,
                    ...result
                });
            }
        });
    });

    allConfigs.sort((a, b) => b.successRate - a.successRate);
    allConfigs.slice(0, 10).forEach((r, idx) => {
        console.log(`${idx + 1}. ${r.config} | Capital: ${r.capitalBits.toLocaleString()} bits`);
        console.log(`   Success: ${r.successRate.toFixed(1)}% (${r.numSuccessful}/100)`);
        if (r.numSuccessful > 0) {
            console.log(`   Avg Profit: ${(r.avgProfit / 100).toFixed(0)} bits (${r.avgProfitPercent.toFixed(1)}%)`);
            console.log(`   Median: ${(r.medianProfit / 100).toFixed(0)} bits`);
        }
        console.log('');
    });
} else {
    // 1. MINIMUM CAPITAL REQUIRED
    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│  🏆 TOP 5: CAPITALE MINIMO RICHIESTO                    │');
    console.log('│     (≥80% successo, ≥50% profitto)                      │');
    console.log('└─────────────────────────────────────────────────────────┘\n');

    const minCapital = summary
        .filter(r => r.avgProfitPercent >= 50)
        .sort((a, b) => a.capital - b.capital)
        .slice(0, 5);

    minCapital.forEach((r, idx) => {
        console.log(`${idx + 1}. ${r.config}`);
        console.log(`   💰 Capitale: ${r.capitalBits.toLocaleString()} bits ⭐⭐⭐`);
        console.log(`   ✅ Successo: ${r.successRate.toFixed(1)}% (${r.numSuccessful}/100 seed)`);
        console.log(`   💵 Profitto Medio: ${(r.avgProfit / 100).toLocaleString()} bits`);
        console.log(`   📊 Profitto %: ${r.avgProfitPercent.toFixed(1)}%`);
        console.log(`   📈 ROI: ${(r.roiEfficiency * 100).toFixed(2)}%`);
        console.log(`   📉 Drawdown: ${r.avgDrawdown.toFixed(1)}%`);
        console.log(`   📍 Range: ${(r.minProfit / 100).toLocaleString()} ~ ${(r.maxProfit / 100).toLocaleString()} bits`);
        console.log('');
    });

    // 2. BEST ROI EFFICIENCY
    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│  📈 TOP 5: MIGLIOR EFFICIENZA ROI                       │');
    console.log('│     (Profitto per unità di capitale)                    │');
    console.log('└─────────────────────────────────────────────────────────┘\n');

    const bestROI = [...summary]
        .sort((a, b) => b.roiEfficiency - a.roiEfficiency)
        .slice(0, 5);

    bestROI.forEach((r, idx) => {
        console.log(`${idx + 1}. ${r.config}`);
        console.log(`   Capitale: ${r.capitalBits.toLocaleString()} bits`);
        console.log(`   Successo: ${r.successRate.toFixed(1)}%`);
        console.log(`   📊 ROI: ${(r.roiEfficiency * 100).toFixed(2)}% ⭐⭐⭐`);
        console.log(`   Profitto Medio: ${(r.avgProfit / 100).toLocaleString()} bits (${r.avgProfitPercent.toFixed(1)}%)`);
        console.log(`   Sharpe Ratio: ${r.sharpeRatio.toFixed(2)}`);
        console.log('');
    });

    // 3. HIGHEST ABSOLUTE PROFIT
    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│  💰 TOP 5: MASSIMO PROFITTO ASSOLUTO                    │');
    console.log('└─────────────────────────────────────────────────────────┘\n');

    const maxProfit = [...summary]
        .sort((a, b) => b.avgProfit - a.avgProfit)
        .slice(0, 5);

    maxProfit.forEach((r, idx) => {
        console.log(`${idx + 1}. ${r.config}`);
        console.log(`   Capitale: ${r.capitalBits.toLocaleString()} bits`);
        console.log(`   Successo: ${r.successRate.toFixed(1)}%`);
        console.log(`   💵 Profitto: ${(r.avgProfit / 100).toLocaleString()} bits ⭐⭐⭐`);
        console.log(`   Profitto %: ${r.avgProfitPercent.toFixed(1)}%`);
        console.log(`   Mediana: ${(r.medianProfit / 100).toLocaleString()} bits`);
        console.log(`   ROI: ${(r.roiEfficiency * 100).toFixed(2)}%`);
        console.log('');
    });

    // 4. BEST RISK-ADJUSTED
    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│  🛡️ TOP 5: MIGLIOR RAPPORTO RISCHIO/RENDIMENTO         │');
    console.log('│     (Sharpe Ratio più alto)                             │');
    console.log('└─────────────────────────────────────────────────────────┘\n');

    const bestSharpe = [...summary]
        .sort((a, b) => b.sharpeRatio - a.sharpeRatio)
        .slice(0, 5);

    bestSharpe.forEach((r, idx) => {
        console.log(`${idx + 1}. ${r.config}`);
        console.log(`   Capitale: ${r.capitalBits.toLocaleString()} bits`);
        console.log(`   Successo: ${r.successRate.toFixed(1)}%`);
        console.log(`   🛡️ Sharpe: ${r.sharpeRatio.toFixed(2)} ⭐⭐⭐`);
        console.log(`   Profitto: ${(r.avgProfit / 100).toLocaleString()} bits (${r.avgProfitPercent.toFixed(1)}%)`);
        console.log(`   Std Dev: ${(r.stdDev / 100).toLocaleString()} bits`);
        console.log(`   Drawdown: ${r.avgDrawdown.toFixed(1)}%`);
        console.log('');
    });

    // 5. OPTIMAL OVERALL
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║              🏆 CONFIGURAZIONE OTTIMALE 🏆                ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

    // Score: 40% ROI + 30% success + 20% sharpe - 10% drawdown
    const optimal = [...summary].sort((a, b) => {
        const scoreA = (a.roiEfficiency * 40) + (a.successRate * 0.3) + (a.sharpeRatio * 0.2) - (a.avgDrawdown * 0.1);
        const scoreB = (b.roiEfficiency * 40) + (b.successRate * 0.3) + (b.sharpeRatio * 0.2) - (b.avgDrawdown * 0.1);
        return scoreB - scoreA;
    })[0];

    console.log(`╭─────────────────────────────────────────────────────────╮`);
    console.log(`│  Algoritmo: Fibonacci`);
    console.log(`│  Configurazione: ${optimal.config}`);
    console.log(`│  Moltiplicatore: ${optimal.payout}x`);
    console.log(`│  Max Recovery: ${optimal.maxT} tentativi`);
    console.log(`╰─────────────────────────────────────────────────────────╯`);
    console.log(``);
    console.log(`📊 PERFORMANCE (100 seed × 200,000 partite):`);
    console.log(`   💰 Capitale Richiesto: ${optimal.capitalBits.toLocaleString()} bits`);
    console.log(`   ✅ Tasso Successo: ${optimal.successRate.toFixed(1)}% (${optimal.numSuccessful}/100)`);
    console.log(`   💵 Profitto Medio: ${(optimal.avgProfit / 100).toLocaleString()} bits`);
    console.log(`   📊 Profitto Mediano: ${(optimal.medianProfit / 100).toLocaleString()} bits`);
    console.log(`   📈 Profitto %: ${optimal.avgProfitPercent.toFixed(1)}%`);
    console.log(`   🎯 ROI Efficiency: ${(optimal.roiEfficiency * 100).toFixed(2)}%`);
    console.log(`   🛡️ Sharpe Ratio: ${optimal.sharpeRatio.toFixed(2)}`);
    console.log(`   📉 Drawdown Medio: ${optimal.avgDrawdown.toFixed(1)}%`);
    console.log(`   📍 Intervallo Profitto:`);
    console.log(`      Min: ${(optimal.minProfit / 100).toLocaleString()} bits`);
    console.log(`      Q1:  ${(optimal.q1Profit / 100).toLocaleString()} bits`);
    console.log(`      Median: ${(optimal.medianProfit / 100).toLocaleString()} bits`);
    console.log(`      Q3:  ${(optimal.q3Profit / 100).toLocaleString()} bits`);
    console.log(`      Max: ${(optimal.maxProfit / 100).toLocaleString()} bits`);
    console.log(``);
    console.log(`✨ Questa configurazione offre:`);
    console.log(`   • ${optimal.capital <= 5000000 ? 'BASSO' : optimal.capital <= 25000000 ? 'MODERATO' : 'ALTO'} requisito di capitale`);
    console.log(`   • ${optimal.successRate >= 95 ? 'ECCELLENTE' : optimal.successRate >= 85 ? 'OTTIMO' : 'BUONO'} tasso di successo`);
    console.log(`   • ${optimal.avgProfitPercent >= 200 ? 'ECCELLENTE' : optimal.avgProfitPercent >= 100 ? 'OTTIMO' : 'BUONO'} ritorno percentuale`);
    console.log(`   • ${optimal.avgDrawdown <= 25 ? 'BASSO' : optimal.avgDrawdown <= 40 ? 'MODERATO' : 'ALTO'} rischio`);
    console.log(``);
}

console.log('═══════════════════════════════════════════════════════════');
console.log('                   ANALISI COMPLETATA                       ');
console.log('═══════════════════════════════════════════════════════════\n');
