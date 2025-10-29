/**
 * 🔬 DEEP ANALYSIS - Martin Dual-Mode
 *
 * Test approfondito con grid search per trovare
 * la configurazione ottimale
 */

const BASE_BET = 100;
const INITIAL_BALANCE = 55000 * 100;
const NUM_GAMES = 50000; // Più giochi per maggiore precisione
const NUM_SIMULATIONS = 50; // 50 sim per config

// ===== CRASH GENERATOR =====
function generateCrash() {
    let r = Math.random();
    if (r === 0) r = 0.0001;
    const crashPoint = (99 / (100 * r));
    return Math.min(Math.max(1.00, crashPoint), 10000);
}

// ===== SIMULATORE =====
function simulateStrategy(config) {
    let balance = INITIAL_BALANCE;
    const initBalance = balance;

    let currentBet = BASE_BET;
    let currentTimes = 0;
    let mode = 'NORMAL';

    let stats = {
        totalWins: 0,
        totalLosses: 0,
        modeSwitches: 0,
        recoverySuccess: 0,
        maxDrawdown: 0,
        bankruptcies: 0,
        finalBalance: 0,
        peakBalance: balance,
        totalMode1Games: 0,
        totalMode2Games: 0,
        mode1Wins: 0,
        mode2Wins: 0
    };

    for (let game = 0; game < NUM_GAMES; game++) {
        if (balance < currentBet) {
            if (balance < BASE_BET) {
                stats.bankruptcies++;
                break;
            }
            currentBet = BASE_BET;
            currentTimes = 0;
            mode = 'NORMAL';
        }

        const crash = generateCrash();
        const payout = mode === 'NORMAL' ? config.mainPayout : config.recoveryPayout;

        if (mode === 'NORMAL') {
            stats.totalMode1Games++;

            if (crash >= config.mainPayout) {
                const win = Math.floor(currentBet * config.mainPayout) - currentBet;
                balance += win;
                stats.totalWins++;
                stats.mode1Wins++;

                currentBet = BASE_BET;
                currentTimes = 0;
                mode = 'NORMAL';
            } else {
                balance -= currentBet;
                stats.totalLosses++;
                currentTimes++;

                const drawdown = ((initBalance - balance) / initBalance) * 100;
                if (drawdown > stats.maxDrawdown) stats.maxDrawdown = drawdown;

                if (currentTimes >= config.switchThreshold) {
                    mode = 'RECOVERY';
                    stats.modeSwitches++;
                } else {
                    currentBet = Math.ceil((currentBet / 100) * config.mult) * 100;
                }
            }
        } else if (mode === 'RECOVERY') {
            stats.totalMode2Games++;

            if (crash >= config.recoveryPayout) {
                const win = Math.floor(currentBet * config.recoveryPayout) - currentBet;
                balance += win;
                stats.totalWins++;
                stats.mode2Wins++;
            } else {
                balance -= currentBet;
                stats.totalLosses++;

                const drawdown = ((initBalance - balance) / initBalance) * 100;
                if (drawdown > stats.maxDrawdown) stats.maxDrawdown = drawdown;
            }

            if (crash >= config.mainPayout) {
                stats.recoverySuccess++;
                currentBet = BASE_BET;
                currentTimes = 0;
                mode = 'NORMAL';
            }
        }

        if (balance > stats.peakBalance) stats.peakBalance = balance;
    }

    stats.finalBalance = balance;
    return stats;
}

// ===== GRID SEARCH =====
console.log('🔬 DEEP ANALYSIS - Martin Dual-Mode Strategy');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`Testing ${NUM_SIMULATIONS} sims × ${NUM_GAMES} games per config`);
console.log(`Initial Balance: ${(INITIAL_BALANCE/100).toFixed(2)} bits`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');

// Grid search parameters
const mainPayouts = [1.8, 1.9, 2.0, 2.1, 2.2];
const switchThresholds = [8, 9, 10, 11, 12];
const recoveryPayouts = [1.15, 1.2, 1.25, 1.3];
const multipliers = [1.4, 1.5, 1.6];

const results = [];
let totalTests = mainPayouts.length * switchThresholds.length * recoveryPayouts.length * multipliers.length;
let currentTest = 0;

console.log(`Total configurations to test: ${totalTests}`);
console.log('');

for (const mainPayout of mainPayouts) {
    for (const switchThreshold of switchThresholds) {
        for (const recoveryPayout of recoveryPayouts) {
            for (const mult of multipliers) {
                currentTest++;

                if (currentTest % 10 === 0) {
                    console.log(`Progress: ${currentTest}/${totalTests} (${((currentTest/totalTests)*100).toFixed(1)}%)`);
                }

                const config = { mainPayout, switchThreshold, recoveryPayout, mult };

                const simResults = [];
                let totalProfit = 0;
                let totalBankruptcies = 0;
                let totalWins = 0;
                let totalLosses = 0;
                let totalModeSwitches = 0;
                let totalRecoverySuccess = 0;
                let maxDrawdownTotal = 0;
                let peakBalanceTotal = 0;
                let totalMode1Games = 0;
                let totalMode2Games = 0;
                let mode1WinsTotal = 0;
                let mode2WinsTotal = 0;

                for (let sim = 0; sim < NUM_SIMULATIONS; sim++) {
                    const stats = simulateStrategy(config);
                    const profit = stats.finalBalance - INITIAL_BALANCE;

                    simResults.push(profit);
                    totalProfit += profit;
                    totalBankruptcies += stats.bankruptcies;
                    totalWins += stats.totalWins;
                    totalLosses += stats.totalLosses;
                    totalModeSwitches += stats.modeSwitches;
                    totalRecoverySuccess += stats.recoverySuccess;
                    maxDrawdownTotal += stats.maxDrawdown;
                    peakBalanceTotal += stats.peakBalance;
                    totalMode1Games += stats.totalMode1Games;
                    totalMode2Games += stats.totalMode2Games;
                    mode1WinsTotal += stats.mode1Wins;
                    mode2WinsTotal += stats.mode2Wins;
                }

                const avgProfit = totalProfit / NUM_SIMULATIONS;
                const avgROI = (avgProfit / INITIAL_BALANCE) * 100;
                const bankruptcyRate = (totalBankruptcies / NUM_SIMULATIONS) * 100;
                const avgWinRate = ((totalWins / (totalWins + totalLosses)) * 100);
                const avgModeSwitches = totalModeSwitches / NUM_SIMULATIONS;
                const avgRecoveryRate = totalModeSwitches > 0 ? (totalRecoverySuccess / totalModeSwitches) * 100 : 0;
                const avgMaxDrawdown = maxDrawdownTotal / NUM_SIMULATIONS;

                const variance = simResults.reduce((sum, p) => sum + Math.pow(p - avgProfit, 2), 0) / NUM_SIMULATIONS;
                const stdDev = Math.sqrt(variance);
                const sharpeRatio = avgProfit / stdDev;

                const mode1WinRate = totalMode1Games > 0 ? (mode1WinsTotal / totalMode1Games) * 100 : 0;
                const mode2WinRate = totalMode2Games > 0 ? (mode2WinsTotal / totalMode2Games) * 100 : 0;

                results.push({
                    config,
                    avgProfit: avgProfit / 100,
                    avgROI,
                    bankruptcyRate,
                    avgWinRate,
                    avgModeSwitches,
                    avgRecoveryRate,
                    avgMaxDrawdown,
                    sharpeRatio,
                    stdDev: stdDev / 100,
                    mode1WinRate,
                    mode2WinRate,
                    // Score composito: minimizza perdite + minimizza rischio + massimizza recovery
                    score: -avgROI - (avgMaxDrawdown * 0.5) + (avgRecoveryRate * 0.1) - (bankruptcyRate * 10)
                });
            }
        }
    }
}

console.log('');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 TOP 10 CONFIGURATIONS (by ROI):');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');

// Sort by ROI
results.sort((a, b) => b.avgROI - a.avgROI);

for (let i = 0; i < Math.min(10, results.length); i++) {
    const r = results[i];
    const emoji = r.avgROI > -0.5 ? '🏆' : r.avgROI > -1 ? '✅' : '⚠️';

    console.log(`${emoji} #${i+1}: Main:${r.config.mainPayout}x T:${r.config.switchThreshold} Rec:${r.config.recoveryPayout}x Mult:${r.config.mult}x`);
    console.log(`   ROI: ${r.avgROI >= 0 ? '+' : ''}${r.avgROI.toFixed(3)}% | Profit: ${r.avgProfit >= 0 ? '+' : ''}${r.avgProfit.toFixed(2)} bits`);
    console.log(`   Win Rate: ${r.avgWinRate.toFixed(2)}% (M1:${r.mode1WinRate.toFixed(1)}% M2:${r.mode2WinRate.toFixed(1)}%)`);
    console.log(`   Drawdown: ${r.avgMaxDrawdown.toFixed(2)}% | Bankruptcy: ${r.bankruptcyRate.toFixed(2)}%`);
    console.log(`   Mode Switches: ${r.avgModeSwitches.toFixed(1)} | Recovery: ${r.avgRecoveryRate.toFixed(1)}%`);
    console.log(`   Risk (σ): ${r.stdDev.toFixed(2)} | Sharpe: ${r.sharpeRatio.toFixed(3)}`);
    console.log('');
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 TOP 10 CONFIGURATIONS (by Composite Score):');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');

// Sort by composite score
results.sort((a, b) => b.score - a.score);

for (let i = 0; i < Math.min(10, results.length); i++) {
    const r = results[i];
    const emoji = r.score > 0 ? '🏆' : r.score > -1 ? '✅' : '⚠️';

    console.log(`${emoji} #${i+1}: Main:${r.config.mainPayout}x T:${r.config.switchThreshold} Rec:${r.config.recoveryPayout}x Mult:${r.config.mult}x`);
    console.log(`   Score: ${r.score.toFixed(3)} | ROI: ${r.avgROI >= 0 ? '+' : ''}${r.avgROI.toFixed(3)}%`);
    console.log(`   Drawdown: ${r.avgMaxDrawdown.toFixed(2)}% | Recovery: ${r.avgRecoveryRate.toFixed(1)}%`);
    console.log(`   Sharpe: ${r.sharpeRatio.toFixed(3)} | Bankruptcy: ${r.bankruptcyRate.toFixed(2)}%`);
    console.log('');
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🏆 RECOMMENDED CONFIGURATION:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
const best = results[0];
console.log(`   Main Payout: ${best.config.mainPayout}x`);
console.log(`   Switch Threshold: T:${best.config.switchThreshold}`);
console.log(`   Recovery Payout: ${best.config.recoveryPayout}x`);
console.log(`   Multiplier: ${best.config.mult}x`);
console.log('');
console.log(`   Expected ROI: ${best.avgROI >= 0 ? '+' : ''}${best.avgROI.toFixed(3)}%`);
console.log(`   Max Drawdown: ${best.avgMaxDrawdown.toFixed(2)}%`);
console.log(`   Recovery Success: ${best.avgRecoveryRate.toFixed(1)}%`);
console.log(`   Bankruptcy Rate: ${best.bankruptcyRate.toFixed(2)}%`);
console.log(`   Risk/Reward (Sharpe): ${best.sharpeRatio.toFixed(3)}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');
console.log('⚠️  IMPORTANTE: Nessuna strategia può superare l\'house edge (1%) nel lungo termine.');
console.log('    Queste configurazioni minimizzano le perdite e il rischio.');
