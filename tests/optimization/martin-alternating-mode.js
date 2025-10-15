/**
 * MARTIN ALTERNATING MODE - Strategia Alternata
 *
 * Alterna tra due modalità ogni N giocate:
 * - MODE1 (N games): Punta al payout principale (es. 3.0x) con progressione martingale
 * - MODE2 (1 game): Punta al payout basso (es. 1.2x) con FIXED BET
 *
 * L'idea: ridurre l'esposizione alternando puntate sicure (MODE2) con puntate profittevoli (MODE1)
 * mantenendo sempre la progressione della puntata
 */

const crypto = require('crypto');

const GAME_SALT = '00000000000000000001e08b7fd44f95e3e950ac65650a8031a6d5e1750e34be';

function crashPointFromHash(serverSeed) {
    const hmac = crypto.createHmac('sha256', GAME_SALT);
    hmac.update(Buffer.from(serverSeed, 'hex'));
    const hmacResult = hmac.digest('hex');
    const h = parseInt(hmacResult.substring(0, 13), 16);
    const e = Math.pow(2, 52);
    if (h % 33 === 0) return 1.00;
    const x = h / e;
    return Math.max(1.00, Math.floor(99 / (1 - x)) / 100);
}

function getPreviousHash(hash) {
    return crypto.createHash('sha256')
        .update(Buffer.from(hash, 'hex'))
        .digest('hex');
}

function generateRealSequence(startHash, count) {
    const crashes = [];
    let currentHash = startHash;
    for (let i = 0; i < count; i++) {
        const crash = crashPointFromHash(currentHash);
        crashes.push(crash);
        currentHash = getPreviousHash(currentHash);
        if ((i + 1) % 100000 === 0) {
            process.stdout.write(`\r   Generating: ${(i + 1).toLocaleString()}/${count.toLocaleString()} (${((i + 1) / count * 100).toFixed(1)}%)`);
        }
    }
    process.stdout.write(`\r   Generated: ${count.toLocaleString()} crashes\n`);
    return crashes;
}

// ===== ALTERNATING MODE SIMULATION =====
function simulateAlternatingMode(crashes, config, capital) {
    let balance = capital;
    const initBalance = balance;

    const { baseBet, mainPayout, mult, alternateEvery, recoveryPayout } = config;

    let currentBet = baseBet;
    let currentTimes = 0;
    let totalWins = 0;
    let totalLosses = 0;
    let maxDrawdown = 0;

    let gamesInCurrentCycle = 0; // Conta i giochi nel ciclo corrente
    let mode1Games = 0;
    let mode2Games = 0;

    for (let i = 0; i < crashes.length; i++) {
        const crash = crashes[i];

        // Check bankruptcy
        if (balance < currentBet) {
            if (balance < baseBet) {
                return {
                    success: false,
                    finalBalance: balance,
                    profit: balance - initBalance,
                    profitPercent: ((balance - initBalance) / initBalance) * 100,
                    maxDrawdown,
                    gamesPlayed: i + 1,
                    wins: totalWins,
                    losses: totalLosses,
                    mode1Games,
                    mode2Games,
                    reason: 'bankrupt'
                };
            }
            // Reset cycle
            currentBet = baseBet;
            currentTimes = 0;
            gamesInCurrentCycle = 0;
            continue;
        }

        // Determine which mode to use based on cycle
        const useMode2 = (gamesInCurrentCycle > 0 && gamesInCurrentCycle % (alternateEvery + 1) === alternateEvery);
        const payout = useMode2 ? recoveryPayout : mainPayout;

        if (useMode2) mode2Games++;
        else mode1Games++;

        // Check win
        if (crash >= payout) {
            const win = Math.floor(currentBet * payout) - currentBet;
            balance += win;
            totalWins++;

            // Reset on main payout win
            if (crash >= mainPayout) {
                currentBet = baseBet;
                currentTimes = 0;
                gamesInCurrentCycle = 0;
            } else {
                // Win on recovery payout but not main - continue progression
                gamesInCurrentCycle++;
            }
        } else {
            // LOSS
            balance -= currentBet;
            totalLosses++;
            currentTimes++;

            const drawdown = ((initBalance - balance) / initBalance) * 100;
            if (drawdown > maxDrawdown) maxDrawdown = drawdown;

            // Increase bet (martingale progression continues regardless of mode)
            currentBet = Math.ceil((currentBet / 100) * mult) * 100;
            gamesInCurrentCycle++;
        }
    }

    return {
        success: balance > initBalance * 0.5,
        finalBalance: balance,
        profit: balance - initBalance,
        profitPercent: ((balance - initBalance) / initBalance) * 100,
        maxDrawdown,
        gamesPlayed: crashes.length,
        wins: totalWins,
        losses: totalLosses,
        mode1Games,
        mode2Games,
        reason: 'completed'
    };
}

// ===== OPTIMIZER =====
function optimizeAlternatingMode() {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║  MARTIN ALTERNATING MODE OPTIMIZER                        ║');
    console.log('║  Alterna MODE1 (main payout) e MODE2 (safe payout)       ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    const START_HASH = '94aa062026624e59a0ace092568d5f46e21b9bf1d5173609db8645dd62bdfc44';
    const TOTAL_GAMES = 4000000;
    const CHUNK_SIZE = 2000;
    const NUM_CHUNKS = 2000;
    const CAPITAL = 5500000; // 55k bits

    console.log('📋 Setup:');
    console.log(`   Starting Hash: ${START_HASH.substring(0, 16)}...`);
    console.log(`   Total Games: ${TOTAL_GAMES.toLocaleString()}`);
    console.log(`   Chunk Size: ${CHUNK_SIZE} games`);
    console.log(`   Number of Chunks: ${NUM_CHUNKS}`);
    console.log(`   Capital: ${(CAPITAL / 100).toLocaleString()} bits\n`);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Generate crashes
    console.log('🔄 Generating 4M real crashes...\n');
    const startTime = Date.now();
    const allCrashes = generateRealSequence(START_HASH, TOTAL_GAMES);
    const genTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`   ✅ Generated in ${genTime}s\n`);

    // Extract chunks
    console.log('🎲 Extracting random chunks...\n');
    const chunks = [];
    const maxStartIndex = TOTAL_GAMES - CHUNK_SIZE;
    const usedIndices = new Set();

    while (chunks.length < NUM_CHUNKS) {
        const startIndex = Math.floor(Math.random() * maxStartIndex);
        if (!usedIndices.has(startIndex)) {
            usedIndices.add(startIndex);
            chunks.push(allCrashes.slice(startIndex, startIndex + CHUNK_SIZE));
        }
    }
    console.log(`   ✅ Extracted ${NUM_CHUNKS} random chunks\n`);

    // Test configurations
    console.log('🔬 Testing configurations...\n');

    const configurations = [];

    // Param ranges
    const alternateEveryOptions = [1, 2, 3, 4, 5]; // Alterna ogni N games di MODE1
    const recoveryPayouts = [1.1, 1.15, 1.2, 1.25, 1.3]; // Safe payout
    const mainPayouts = [2.5, 2.8, 3.0]; // Main payout
    const mults = [1.5, 1.6];
    const baseBet = 100;

    for (const mainPayout of mainPayouts) {
        for (const mult of mults) {
            for (const alternateEvery of alternateEveryOptions) {
                for (const recoveryPayout of recoveryPayouts) {
                    configurations.push({
                        baseBet,
                        mainPayout,
                        mult,
                        alternateEvery,
                        recoveryPayout
                    });
                }
            }
        }
    }

    console.log(`   Total configurations to test: ${configurations.length}\n`);

    const results = [];
    let configIndex = 0;

    for (const config of configurations) {
        configIndex++;

        const configResults = [];
        for (let i = 0; i < chunks.length; i++) {
            const result = simulateAlternatingMode(chunks[i], config, CAPITAL);
            configResults.push(result);
        }

        // Analyze results
        const successes = configResults.filter(r => r.success).length;
        const positives = configResults.filter(r => r.profit > 0).length;
        const bankrupts = configResults.filter(r => r.reason === 'bankrupt').length;

        const profits = configResults.map(r => r.profitPercent);
        const avgProfit = profits.reduce((a, b) => a + b, 0) / profits.length;
        const totalAbsoluteProfit = configResults.reduce((sum, r) => sum + r.profit, 0) / 100;

        const mode1Games = configResults.reduce((sum, r) => sum + r.mode1Games, 0);
        const mode2Games = configResults.reduce((sum, r) => sum + r.mode2Games, 0);
        const mode2Ratio = ((mode2Games / (mode1Games + mode2Games)) * 100);

        results.push({
            config,
            successRate: (successes / NUM_CHUNKS * 100),
            positiveRate: (positives / NUM_CHUNKS * 100),
            bankruptRate: (bankrupts / NUM_CHUNKS * 100),
            avgProfitPercent: avgProfit,
            totalAbsoluteProfit,
            mode2Ratio
        });

        if (configIndex % 20 === 0) {
            process.stdout.write(`\r   Progress: ${configIndex}/${configurations.length} configs (${(configIndex / configurations.length * 100).toFixed(1)}%)`);
        }
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n   ✅ Completed in ${totalTime}s\n`);

    // Sort by total absolute profit
    results.sort((a, b) => b.totalAbsoluteProfit - a.totalAbsoluteProfit);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📊 TOP 15 CONFIGURAZIONI:\n');

    console.log('═══════════════════════════════════════════════════════════════════════════════════════════════════════════════');
    console.log(' Rank │ Main │ Mult │ AltEvery │ Recov │ Avg %  │ Total Profit │ Success │ Positive │ MODE2% │ Bankrupt');
    console.log('──────┼──────┼──────┼──────────┼───────┼────────┼──────────────┼─────────┼──────────┼────────┼─────────');

    for (let i = 0; i < Math.min(15, results.length); i++) {
        const r = results[i];
        const rank = `#${i + 1}`.padStart(4);
        const main = `${r.config.mainPayout}x`.padStart(5);
        const mult = `${r.config.mult}x`.padStart(5);
        const altEvery = `${r.config.alternateEvery}`.padStart(8);
        const recov = `${r.config.recoveryPayout}x`.padStart(6);
        const avgPct = `${r.avgProfitPercent.toFixed(2)}%`.padStart(7);
        const totalProfit = r.totalAbsoluteProfit >= 0
            ? `+${r.totalAbsoluteProfit.toFixed(0)}`.padStart(11)
            : `${r.totalAbsoluteProfit.toFixed(0)}`.padStart(11);
        const success = `${r.successRate.toFixed(1)}%`.padStart(6);
        const positive = `${r.positiveRate.toFixed(1)}%`.padStart(7);
        const mode2 = `${r.mode2Ratio.toFixed(1)}%`.padStart(6);
        const bankrupt = `${r.bankruptRate.toFixed(1)}%`.padStart(7);

        console.log(` ${rank} │ ${main} │ ${mult} │ ${altEvery} │ ${recov} │ ${avgPct} │ ${totalProfit} │ ${success} │ ${positive} │ ${mode2} │ ${bankrupt}`);
    }

    console.log('═══════════════════════════════════════════════════════════════════════════════════════════════════════════════\n');

    // Best configuration
    const best = results[0];
    console.log('🏆 BEST CONFIGURATION:\n');
    console.log(`   Main Payout: ${best.config.mainPayout}x`);
    console.log(`   Multiplier: ${best.config.mult}x`);
    console.log(`   Alternate Every: ${best.config.alternateEvery} games MODE1 → 1 game MODE2`);
    console.log(`   Recovery Payout: ${best.config.recoveryPayout}x`);
    console.log('');
    console.log(`   Total Profit: ${best.totalAbsoluteProfit >= 0 ? '+' : ''}${best.totalAbsoluteProfit.toFixed(2)} bits`);
    console.log(`   Avg Profit: ${best.avgProfitPercent.toFixed(3)}%`);
    console.log(`   Success Rate: ${best.successRate.toFixed(2)}%`);
    console.log(`   Positive Rate: ${best.positiveRate.toFixed(2)}%`);
    console.log(`   Bankrupt Rate: ${best.bankruptRate.toFixed(2)}%`);
    console.log(`   MODE2 Ratio: ${best.mode2Ratio.toFixed(2)}%`);
    console.log('');

    if (best.totalAbsoluteProfit > 0) {
        console.log('   🎉 STRATEGIA PROFITTEVOLE TROVATA!\n');
    } else {
        console.log('   ⚠️  Miglior configurazione ancora negativa.\n');
    }

    // Save results
    const fs = require('fs');
    const output = {
        capital: CAPITAL / 100,
        chunkSize: CHUNK_SIZE,
        numChunks: NUM_CHUNKS,
        totalGames: NUM_CHUNKS * CHUNK_SIZE,
        topConfigurations: results.slice(0, 20).map(r => ({
            config: r.config,
            successRate: r.successRate,
            positiveRate: r.positiveRate,
            bankruptRate: r.bankruptRate,
            avgProfitPercent: r.avgProfitPercent,
            totalAbsoluteProfit: r.totalAbsoluteProfit,
            mode2Ratio: r.mode2Ratio
        })),
        best: {
            config: best.config,
            totalAbsoluteProfit: best.totalAbsoluteProfit,
            avgProfitPercent: best.avgProfitPercent,
            successRate: best.successRate,
            positiveRate: best.positiveRate,
            mode2Ratio: best.mode2Ratio
        },
        isProfitable: best.totalAbsoluteProfit > 0,
        totalTime
    };

    fs.writeFileSync(
        'martin-alternating-mode-results.json',
        JSON.stringify(output, null, 2)
    );

    console.log('💾 Results saved to: martin-alternating-mode-results.json\n');
}

// Run optimizer
optimizeAlternatingMode();
