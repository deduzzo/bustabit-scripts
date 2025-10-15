/**
 * MARTIN AI - TEST CON SEED REALI DI BUSTABIT
 *
 * Ri-testa la configurazione ATTUALE del Martin AI usando seed REALI
 * invece della vecchia generazione random (SBAGLIATA)
 *
 * Config attuale: M1.45-P3.2x-T25-W0 con 50k bits e 4k games
 */

const { generateTestSeed } = require('./real-bustabit-seed-generator');

// Configurazione attuale (quella che abbiamo ottimizzato con seed FAKE)
const config = {
    payout: 3.2,
    baseBet: 100,
    mult: 1.45,
    maxTimes: 25,
    waitBeforePlay: 0,
    capital: 5000000,  // 50k bits
    sessionGames: 4000
};

/**
 * Simula una sessione Martin AI
 */
function simulateMartin(crashes, config) {
    let balance = config.capital;
    const initBalance = balance;
    let currentBet = config.baseBet;
    let currentTimes = 0;
    let maxDrawdown = 0;
    let state = config.waitBeforePlay === 0 ? 'BETTING' : 'WAITING';
    let waitRemaining = config.waitBeforePlay;
    let gamesPlayed = 0;
    let totalWins = 0;
    let totalLosses = 0;

    for (let i = 0; i < crashes.length && i < config.sessionGames; i++) {
        const crash = crashes[i];
        gamesPlayed++;

        if (state === 'WAITING') {
            if (crash < config.payout) {
                waitRemaining = Math.max(0, waitRemaining - 1);
                if (waitRemaining === 0) {
                    state = 'BETTING';
                    currentBet = config.baseBet;
                    currentTimes = 0;
                }
            } else {
                waitRemaining = config.waitBeforePlay;
            }
            continue;
        }

        // BETTING
        if (balance < currentBet) {
            // Saldo insufficiente = DISASTER
            return {
                success: false,
                finalBalance: balance,
                profit: balance - initBalance,
                profitPercent: ((balance - initBalance) / initBalance) * 100,
                maxDrawdown: maxDrawdown,
                gamesPlayed: gamesPlayed,
                wins: totalWins,
                losses: totalLosses,
                reason: 'insufficient_balance'
            };
        }

        // Piazza scommessa
        if (crash >= config.payout) {
            // WIN
            const win = Math.floor(currentBet * config.payout) - currentBet;
            balance += win;
            totalWins++;
            currentBet = config.baseBet;
            currentTimes = 0;

            if (config.waitBeforePlay > 0) {
                state = 'WAITING';
                waitRemaining = config.waitBeforePlay;
            }
        } else {
            // LOSS
            balance -= currentBet;
            totalLosses++;
            currentTimes++;

            const drawdown = ((initBalance - balance) / initBalance) * 100;
            if (drawdown > maxDrawdown) maxDrawdown = drawdown;

            if (config.maxTimes > 0 && currentTimes >= config.maxTimes) {
                // Raggiunto max times, reset
                currentBet = config.baseBet;
                currentTimes = 0;

                if (config.waitBeforePlay > 0) {
                    state = 'WAITING';
                    waitRemaining = config.waitBeforePlay;
                }
            } else {
                // Incrementa bet
                currentBet = Math.ceil((currentBet / 100) * config.mult) * 100;
            }
        }
    }

    return {
        success: balance > initBalance * 0.5, // Success se non ha perso > 50%
        finalBalance: balance,
        profit: balance - initBalance,
        profitPercent: ((balance - initBalance) / initBalance) * 100,
        maxDrawdown: maxDrawdown,
        gamesPlayed: gamesPlayed,
        wins: totalWins,
        losses: totalLosses,
        reason: balance >= initBalance ? 'completed_profit' : 'completed_loss'
    };
}

/**
 * Test su N seeds diversi
 */
function runTests(numSeeds) {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║  MARTIN AI - TEST CON SEED REALI BUSTABIT                  ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    console.log('📋 Configurazione:');
    console.log(`   Payout: ${config.payout}x`);
    console.log(`   Multiplier: ${config.mult}x`);
    console.log(`   Max Times: ${config.maxTimes}`);
    console.log(`   Wait Mode: ${config.waitBeforePlay}`);
    console.log(`   Capital: ${(config.capital / 100).toLocaleString()} bits`);
    console.log(`   Session: ${config.sessionGames} games`);
    console.log('');

    console.log(`🔄 Running ${numSeeds.toLocaleString()} simulations with REAL Bustabit seeds...\n`);

    const results = [];
    const startTime = Date.now();

    for (let i = 0; i < numSeeds; i++) {
        // Genera seed REALE
        const crashes = generateTestSeed(config.sessionGames);

        // Simula
        const result = simulateMartin(crashes, config);
        results.push(result);

        // Progress
        if ((i + 1) % 1000 === 0) {
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            const rate = ((i + 1) / (Date.now() - startTime) * 1000).toFixed(0);
            process.stdout.write(`\r   Progress: ${i + 1}/${numSeeds} (${rate}/s, ${elapsed}s)   `);
        }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\r   ✅ Completed ${numSeeds} simulations in ${elapsed}s              \n`);

    // Analisi risultati
    const successes = results.filter(r => r.success).length;
    const positives = results.filter(r => r.profit > 0).length;
    const profits = results.map(r => r.profit);
    const profitPercents = results.map(r => r.profitPercent);
    const drawdowns = results.map(r => r.maxDrawdown);

    const avgProfit = profits.reduce((a, b) => a + b, 0) / profits.length;
    const avgProfitPercent = profitPercents.reduce((a, b) => a + b, 0) / profitPercents.length;
    const avgDrawdown = drawdowns.reduce((a, b) => a + b, 0) / drawdowns.length;
    const maxDrawdown = Math.max(...drawdowns);

    // Sharpe Ratio
    const stdDev = Math.sqrt(profitPercents.reduce((sum, val) => sum + Math.pow(val - avgProfitPercent, 2), 0) / profitPercents.length);
    const sharpeRatio = avgProfitPercent / stdDev;

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📊 RISULTATI:\n');
    console.log(`   ✅ Success Rate: ${((successes / numSeeds) * 100).toFixed(2)}%`);
    console.log(`   💚 Positive Rate: ${((positives / numSeeds) * 100).toFixed(2)}%`);
    console.log(`   💰 Avg Profit: ${(avgProfit / 100).toFixed(2)} bits (${avgProfitPercent.toFixed(2)}%)`);
    console.log(`   📈 Sharpe Ratio: ${sharpeRatio.toFixed(3)}`);
    console.log(`   📉 Avg Drawdown: ${avgDrawdown.toFixed(2)}%`);
    console.log(`   🔻 Max Drawdown: ${maxDrawdown.toFixed(2)}%`);
    console.log('');

    // Confronto con risultati VECCHI (seed FAKE)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('🔄 CONFRONTO CON SEED FAKE (vecchia analisi):\n');
    console.log('   Metrica              | Seed FAKE  | Seed REALI | Diff');
    console.log('   ─────────────────────┼────────────┼────────────┼──────');
    console.log(`   Success Rate         | 94.30%     | ${((successes / numSeeds) * 100).toFixed(2).padStart(10)}% | ${(((successes / numSeeds) * 100) - 94.3).toFixed(2)}`);
    console.log(`   Positive Rate        | 99.99%     | ${((positives / numSeeds) * 100).toFixed(2).padStart(10)}% | ${(((positives / numSeeds) * 100) - 99.99).toFixed(2)}`);
    console.log(`   Avg Profit %         | +10.67%    | ${avgProfitPercent.toFixed(2).padStart(9)}% | ${(avgProfitPercent - 10.67).toFixed(2)}`);
    console.log(`   Sharpe Ratio         | 28.683     | ${sharpeRatio.toFixed(3).padStart(10)} | ${(sharpeRatio - 28.683).toFixed(2)}`);
    console.log(`   Avg Drawdown         | 14.20%     | ${avgDrawdown.toFixed(2).padStart(9)}% | ${(avgDrawdown - 14.2).toFixed(2)}`);
    console.log('');

    return {
        config,
        numSeeds,
        successRate: (successes / numSeeds) * 100,
        positiveRate: (positives / numSeeds) * 100,
        avgProfit: avgProfit / 100,
        avgProfitPercent,
        sharpeRatio,
        avgDrawdown,
        maxDrawdown,
        results
    };
}

// Esegui test
const NUM_SEEDS = 10000; // Start con 10k, poi aumenteremo
runTests(NUM_SEEDS);
