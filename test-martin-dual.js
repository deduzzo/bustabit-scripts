/**
 * 🧪 TEST FRAMEWORK - Martin Dual-Mode Strategy
 *
 * Simula migliaia di giochi per testare diverse configurazioni
 * e trovare parametri profittevoli
 */

// ===== CONFIGURAZIONI DA TESTARE =====
const TEST_CONFIGS = [
    // Config originale (baseline)
    { mainPayout: 2.5, switchThreshold: 12, recoveryPayout: 1.3, mult: 1.5, label: 'Original' },

    // Test con payout più bassi (maggiore probabilità)
    { mainPayout: 2.0, switchThreshold: 10, recoveryPayout: 1.2, mult: 1.5, label: 'Low Risk' },
    { mainPayout: 2.2, switchThreshold: 11, recoveryPayout: 1.25, mult: 1.5, label: 'Medium Risk' },

    // Test con switch più precoce
    { mainPayout: 2.5, switchThreshold: 8, recoveryPayout: 1.3, mult: 1.5, label: 'Early Switch' },
    { mainPayout: 2.5, switchThreshold: 15, recoveryPayout: 1.3, mult: 1.5, label: 'Late Switch' },

    // Test con multiplier diversi
    { mainPayout: 2.5, switchThreshold: 12, recoveryPayout: 1.3, mult: 1.3, label: 'Low Mult' },
    { mainPayout: 2.5, switchThreshold: 12, recoveryPayout: 1.3, mult: 1.7, label: 'High Mult' },

    // Test con recovery payout più bassi
    { mainPayout: 2.5, switchThreshold: 12, recoveryPayout: 1.15, mult: 1.5, label: 'Safe Recovery' },
    { mainPayout: 2.5, switchThreshold: 12, recoveryPayout: 1.5, mult: 1.5, label: 'Risky Recovery' },

    // Configurazioni aggressive
    { mainPayout: 3.0, switchThreshold: 10, recoveryPayout: 1.2, mult: 1.4, label: 'Aggressive 1' },
    { mainPayout: 2.0, switchThreshold: 8, recoveryPayout: 1.15, mult: 1.6, label: 'Aggressive 2' },
];

const BASE_BET = 100; // satoshi
const INITIAL_BALANCE = 55000 * 100; // 55k bits = 5,500,000 satoshi
const NUM_GAMES = 10000; // Giochi per simulazione
const NUM_SIMULATIONS = 100; // Numero di simulazioni per config

// ===== CRASH GENERATOR (House Edge 1%) =====
function generateCrash() {
    // Bustabit usa un provably fair system
    // Formula corretta: crash = 99 / (100 * r) dove r è [0,1)
    // House edge: 1%
    // P(crash >= X) = (99/100) / X

    let r = Math.random();
    // Evita divisione per zero
    if (r === 0) r = 0.0001;

    const crashPoint = (99 / (100 * r));

    // Cap a valori ragionevoli (bustabit ha un cap pratico)
    return Math.min(Math.max(1.00, crashPoint), 10000);
}

// ===== SIMULATORE =====
function simulateStrategy(config) {
    let balance = INITIAL_BALANCE;
    const initBalance = balance;

    let currentBet = BASE_BET;
    let currentTimes = 0;
    let mode = 'NORMAL'; // 'NORMAL' or 'RECOVERY'

    let stats = {
        totalWins: 0,
        totalLosses: 0,
        modeSwitches: 0,
        recoverySuccess: 0,
        maxDrawdown: 0,
        bankruptcies: 0,
        finalBalance: 0,
        peakBalance: balance
    };

    for (let game = 0; game < NUM_GAMES; game++) {
        // Check bankruptcy
        if (balance < currentBet) {
            if (balance < BASE_BET) {
                stats.bankruptcies++;
                break;
            }
            // Reset cycle
            currentBet = BASE_BET;
            currentTimes = 0;
            mode = 'NORMAL';
        }

        const crash = generateCrash();
        const payout = mode === 'NORMAL' ? config.mainPayout : config.recoveryPayout;

        // ===== MODE 1: NORMAL MARTIN =====
        if (mode === 'NORMAL') {
            if (crash >= config.mainPayout) {
                // WIN in MODE1
                const win = Math.floor(currentBet * config.mainPayout) - currentBet;
                balance += win;
                stats.totalWins++;

                // Reset cycle
                currentBet = BASE_BET;
                currentTimes = 0;
                mode = 'NORMAL';
            } else {
                // LOSS in MODE1
                balance -= currentBet;
                stats.totalLosses++;
                currentTimes++;

                // Check drawdown
                const drawdown = ((initBalance - balance) / initBalance) * 100;
                if (drawdown > stats.maxDrawdown) stats.maxDrawdown = drawdown;

                // Check if we should switch to MODE2
                if (currentTimes >= config.switchThreshold) {
                    mode = 'RECOVERY';
                    stats.modeSwitches++;
                    // currentBet stays the same (fixed bet in MODE2)
                } else {
                    // Continue martingale in MODE1
                    currentBet = Math.ceil((currentBet / 100) * config.mult) * 100;
                }
            }
        }
        // ===== MODE 2: RECOVERY =====
        else if (mode === 'RECOVERY') {
            if (crash >= config.recoveryPayout) {
                // Small win in MODE2
                const win = Math.floor(currentBet * config.recoveryPayout) - currentBet;
                balance += win;
                stats.totalWins++;
            } else {
                // Loss in MODE2
                balance -= currentBet;
                stats.totalLosses++;

                const drawdown = ((initBalance - balance) / initBalance) * 100;
                if (drawdown > stats.maxDrawdown) stats.maxDrawdown = drawdown;
            }

            // Check if mainPayout hit (trigger reset!)
            if (crash >= config.mainPayout) {
                stats.recoverySuccess++;

                // Reset to MODE1
                currentBet = BASE_BET;
                currentTimes = 0;
                mode = 'NORMAL';
            }
            // Keep same fixed bet in MODE2
        }

        // Track peak balance
        if (balance > stats.peakBalance) stats.peakBalance = balance;
    }

    stats.finalBalance = balance;
    return stats;
}

// ===== RUN TESTS =====
console.log('🧪 MARTIN DUAL-MODE - TEST FRAMEWORK');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`Testing ${TEST_CONFIGS.length} configurations`);
console.log(`${NUM_SIMULATIONS} simulations per config × ${NUM_GAMES} games`);
console.log(`Initial Balance: ${(INITIAL_BALANCE/100).toFixed(2)} bits`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');

const results = [];

for (const config of TEST_CONFIGS) {
    console.log(`Testing: ${config.label}...`);

    const simResults = [];
    let totalProfit = 0;
    let totalBankruptcies = 0;
    let totalWins = 0;
    let totalLosses = 0;
    let totalModeSwitches = 0;
    let totalRecoverySuccess = 0;
    let maxDrawdownTotal = 0;
    let peakBalanceTotal = 0;

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
    }

    const avgProfit = totalProfit / NUM_SIMULATIONS;
    const avgROI = (avgProfit / INITIAL_BALANCE) * 100;
    const bankruptcyRate = (totalBankruptcies / NUM_SIMULATIONS) * 100;
    const avgWinRate = ((totalWins / (totalWins + totalLosses)) * 100);
    const avgModeSwitches = totalModeSwitches / NUM_SIMULATIONS;
    const avgRecoveryRate = totalModeSwitches > 0 ? (totalRecoverySuccess / totalModeSwitches) * 100 : 0;
    const avgMaxDrawdown = maxDrawdownTotal / NUM_SIMULATIONS;
    const avgPeakBalance = peakBalanceTotal / NUM_SIMULATIONS;

    // Calculate variance and risk metrics
    const variance = simResults.reduce((sum, p) => sum + Math.pow(p - avgProfit, 2), 0) / NUM_SIMULATIONS;
    const stdDev = Math.sqrt(variance);
    const sharpeRatio = avgProfit / stdDev; // Simplified Sharpe ratio

    results.push({
        config,
        avgProfit: avgProfit / 100, // Convert to bits
        avgROI,
        bankruptcyRate,
        avgWinRate,
        avgModeSwitches,
        avgRecoveryRate,
        avgMaxDrawdown,
        avgPeakBalance: avgPeakBalance / 100,
        sharpeRatio,
        stdDev: stdDev / 100
    });
}

// ===== DISPLAY RESULTS =====
console.log('');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 RESULTS SUMMARY (sorted by ROI):');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');

// Sort by ROI
results.sort((a, b) => b.avgROI - a.avgROI);

for (const result of results) {
    const { config, avgProfit, avgROI, bankruptcyRate, avgWinRate, avgModeSwitches,
            avgRecoveryRate, avgMaxDrawdown, avgPeakBalance, sharpeRatio, stdDev } = result;

    const profitEmoji = avgROI > 0 ? '✅' : avgROI > -1 ? '⚠️' : '❌';

    console.log(`${profitEmoji} ${config.label.padEnd(20)} (Main:${config.mainPayout}x T:${config.switchThreshold} Rec:${config.recoveryPayout}x Mult:${config.mult}x)`);
    console.log(`   ROI: ${avgROI >= 0 ? '+' : ''}${avgROI.toFixed(2)}% | Profit: ${avgProfit >= 0 ? '+' : ''}${avgProfit.toFixed(2)} bits`);
    console.log(`   Win Rate: ${avgWinRate.toFixed(2)}% | Bankruptcy: ${bankruptcyRate.toFixed(2)}%`);
    console.log(`   Mode Switches: ${avgModeSwitches.toFixed(1)} | Recovery: ${avgRecoveryRate.toFixed(1)}%`);
    console.log(`   Max Drawdown: ${avgMaxDrawdown.toFixed(2)}% | Peak: ${avgPeakBalance.toFixed(2)} bits`);
    console.log(`   Risk (StdDev): ${stdDev.toFixed(2)} bits | Sharpe: ${sharpeRatio.toFixed(3)}`);
    console.log('');
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🏆 BEST CONFIGURATION:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
const best = results[0];
console.log(`   ${best.config.label}`);
console.log(`   Main Payout: ${best.config.mainPayout}x`);
console.log(`   Switch Threshold: T:${best.config.switchThreshold}`);
console.log(`   Recovery Payout: ${best.config.recoveryPayout}x`);
console.log(`   Multiplier: ${best.config.mult}x`);
console.log(`   Expected ROI: ${best.avgROI >= 0 ? '+' : ''}${best.avgROI.toFixed(2)}%`);
console.log(`   Bankruptcy Rate: ${best.bankruptcyRate.toFixed(2)}%`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');
console.log('💡 Note: House edge is 1%, so any positive ROI is unlikely in long term.');
console.log('   Focus on configurations with lowest losses and best risk/reward ratio.');
