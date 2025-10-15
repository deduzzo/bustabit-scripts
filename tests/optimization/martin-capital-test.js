/**
 * MARTIN CAPITAL TEST - Ottimizzazione capitale
 *
 * Test M1.51-P3.1x con diversi livelli di capitale (56k-60k)
 * per trovare il capitale ottimale per chunk di 1000 partite
 */

const crypto = require('crypto');

// ===== BUSTABIT PROVABLY FAIR =====
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

        if ((i + 1) % 50000 === 0) {
            process.stdout.write(`\r   Generating: ${i + 1}/${count} (${((i + 1) / count * 100).toFixed(1)}%)`);
        }
    }
    process.stdout.write(`\r   Generated: ${count} crashes\n`);

    return crashes;
}

// ===== MARTIN SIMULATION =====
function simulateMartin(crashes, config, capital) {
    let balance = capital;
    const initBalance = balance;

    const { baseBet, payout, mult, maxTimes, waitBeforePlay } = config;

    const STATE = { WAITING: 'waiting', BETTING: 'betting' };
    let state = waitBeforePlay === 0 ? STATE.BETTING : STATE.WAITING;
    let waitRemaining = waitBeforePlay;

    let currentBet = baseBet;
    let currentTimes = 0;
    let totalWins = 0;
    let totalLosses = 0;
    let maxDrawdown = 0;
    let hitMaxTimes = 0;

    for (let i = 0; i < crashes.length; i++) {
        const crash = crashes[i];

        // WAITING state
        if (state === STATE.WAITING) {
            if (crash < payout) {
                waitRemaining--;
                if (waitRemaining === 0) {
                    state = STATE.BETTING;
                    currentBet = baseBet;
                    currentTimes = 0;
                }
            } else {
                waitRemaining = waitBeforePlay;
            }
            continue;
        }

        // BETTING state
        if (balance < currentBet) {
            // Bankrupt
            return {
                success: false,
                finalBalance: balance,
                profit: balance - initBalance,
                profitPercent: ((balance - initBalance) / initBalance) * 100,
                maxDrawdown,
                gamesPlayed: i + 1,
                wins: totalWins,
                losses: totalLosses,
                hitMaxTimes,
                reason: 'bankrupt'
            };
        }

        // Place bet
        if (crash >= payout) {
            // WIN
            const win = Math.floor(currentBet * payout) - currentBet;
            balance += win;
            totalWins++;

            currentBet = baseBet;
            currentTimes = 0;

            if (waitBeforePlay > 0) {
                state = STATE.WAITING;
                waitRemaining = waitBeforePlay;
            }
        } else {
            // LOSS
            balance -= currentBet;
            totalLosses++;
            currentTimes++;

            const drawdown = ((initBalance - balance) / initBalance) * 100;
            if (drawdown > maxDrawdown) maxDrawdown = drawdown;

            if (currentTimes >= maxTimes) {
                // Hit max times
                hitMaxTimes++;
                currentBet = baseBet;
                currentTimes = 0;

                if (waitBeforePlay > 0) {
                    state = STATE.WAITING;
                    waitRemaining = waitBeforePlay;
                }
            } else {
                currentBet = Math.ceil((currentBet / 100) * mult) * 100;
            }
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
        hitMaxTimes,
        reason: 'completed'
    };
}

// ===== CAPITAL TEST =====
function testCapitals() {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║  MARTIN CAPITAL OPTIMIZATION TEST                          ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    const START_HASH = '94aa062026624e59a0ace092568d5f46e21b9bf1d5173609db8645dd62bdfc44';
    const TOTAL_GAMES = 300000;
    const CHUNK_SIZE = 1000;
    const NUM_CHUNKS = 1000;

    const CAPITALS = [5600000, 5700000, 5800000, 5900000, 6000000]; // 56k, 57k, 58k, 59k, 60k

    const config = {
        baseBet: 100,      // 1 bit
        payout: 3.1,
        mult: 1.51,
        maxTimes: 23,
        waitBeforePlay: 0
    };

    console.log('📋 Setup:');
    console.log(`   Starting Hash: ${START_HASH.substring(0, 16)}...`);
    console.log(`   Total Games: ${TOTAL_GAMES.toLocaleString()}`);
    console.log(`   Chunk Size: ${CHUNK_SIZE} games`);
    console.log(`   Number of Chunks: ${NUM_CHUNKS}`);
    console.log(`   Capitals to test: ${CAPITALS.map(c => (c/100).toLocaleString()).join(', ')} bits\n`);

    console.log('⚙️  Configuration:');
    console.log(`   Base Bet: ${config.baseBet / 100} bit`);
    console.log(`   Payout: ${config.payout}x`);
    console.log(`   Multiplier: ${config.mult}x`);
    console.log(`   Max Times: ${config.maxTimes}`);
    console.log(`   Wait Mode: ${config.waitBeforePlay}\n`);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Step 1: Generate full sequence
    console.log('🔄 Step 1: Generating 300k real crashes...\n');
    const startTime = Date.now();
    const allCrashes = generateRealSequence(START_HASH, TOTAL_GAMES);
    const genTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`   ✅ Generated in ${genTime}s\n`);

    // Step 2: Extract random chunks
    console.log('🎲 Step 2: Extracting random chunks...\n');
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

    // Step 3: Test each capital
    console.log('🔬 Step 3: Testing different capitals...\n');

    const allResults = [];

    for (let capIdx = 0; capIdx < CAPITALS.length; capIdx++) {
        const capital = CAPITALS[capIdx];
        const capitalBits = capital / 100;

        console.log(`\n   Testing ${capitalBits.toLocaleString()} bits...`);

        const results = [];
        for (let i = 0; i < chunks.length; i++) {
            const result = simulateMartin(chunks[i], config, capital);
            results.push(result);

            if ((i + 1) % 200 === 0) {
                process.stdout.write(`\r      Progress: ${i + 1}/${NUM_CHUNKS} chunks`);
            }
        }
        console.log(`\r      ✅ Completed ${NUM_CHUNKS} chunks`);

        const successes = results.filter(r => r.success).length;
        const positives = results.filter(r => r.profit > 0).length;
        const bankrupts = results.filter(r => r.reason === 'bankrupt').length;

        const profits = results.map(r => r.profitPercent);
        const avgProfit = profits.reduce((a, b) => a + b, 0) / profits.length;
        const maxProfit = Math.max(...profits);
        const minProfit = Math.min(...profits);

        const drawdowns = results.map(r => r.maxDrawdown);
        const avgDrawdown = drawdowns.reduce((a, b) => a + b, 0) / drawdowns.length;
        const maxDrawdownValue = Math.max(...drawdowns);

        const stdDev = Math.sqrt(profits.reduce((sum, val) => sum + Math.pow(val - avgProfit, 2), 0) / profits.length);
        const sharpeRatio = stdDev === 0 ? 0 : avgProfit / stdDev;

        allResults.push({
            capital: capitalBits,
            successRate: successes / NUM_CHUNKS * 100,
            positiveRate: positives / NUM_CHUNKS * 100,
            bankruptRate: bankrupts / NUM_CHUNKS * 100,
            avgProfit,
            maxProfit,
            minProfit,
            stdDev,
            sharpeRatio,
            avgDrawdown,
            maxDrawdown: maxDrawdownValue,
            results
        });
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n   ✅ All tests completed in ${totalTime}s\n`);

    // Display results
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📊 RISULTATI PER CAPITALE:\n');
    console.log('Capital  | Success | Positive | Bankrupt | Avg Profit | Sharpe  | Avg DD');
    console.log('─────────┼─────────┼──────────┼──────────┼────────────┼─────────┼────────');

    allResults.forEach(r => {
        console.log(
            `${r.capital.toLocaleString().padStart(7)}k | ` +
            `${r.successRate.toFixed(2).padStart(6)}% | ` +
            `${r.positiveRate.toFixed(2).padStart(7)}% | ` +
            `${r.bankruptRate.toFixed(2).padStart(7)}% | ` +
            `${r.avgProfit.toFixed(2).padStart(9)}% | ` +
            `${r.sharpeRatio.toFixed(3).padStart(7)} | ` +
            `${r.avgDrawdown.toFixed(2).padStart(5)}%`
        );
    });

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Find best
    const bestByProfit = [...allResults].sort((a, b) => b.avgProfit - a.avgProfit)[0];
    const bestByPositive = [...allResults].sort((a, b) => b.positiveRate - a.positiveRate)[0];
    const lowestBankrupt = [...allResults].sort((a, b) => a.bankruptRate - b.bankruptRate)[0];

    console.log('🏆 BEST RESULTS:\n');
    console.log(`   Best Avg Profit:      ${bestByProfit.capital.toLocaleString()}k bits (${bestByProfit.avgProfit.toFixed(2)}%)`);
    console.log(`   Best Positive Rate:   ${bestByPositive.capital.toLocaleString()}k bits (${bestByPositive.positiveRate.toFixed(2)}%)`);
    console.log(`   Lowest Bankrupt Rate: ${lowestBankrupt.capital.toLocaleString()}k bits (${lowestBankrupt.bankruptRate.toFixed(2)}%)`);
    console.log('');

    // Recommendations
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('💡 RACCOMANDAZIONI:\n');

    const positiveCaps = allResults.filter(r => r.avgProfit > 0);
    if (positiveCaps.length > 0) {
        const minPositiveCap = Math.min(...positiveCaps.map(r => r.capital));
        console.log(`   🎉 CAPITALE MINIMO PROFITTEVOLE: ${minPositiveCap.toLocaleString()}k bits\n`);
        console.log(`   Con questo capitale:`);
        const minCapResult = allResults.find(r => r.capital === minPositiveCap);
        console.log(`      • Avg Profit: ${minCapResult.avgProfit.toFixed(2)}%`);
        console.log(`      • Positive Rate: ${minCapResult.positiveRate.toFixed(2)}%`);
        console.log(`      • Bankrupt Rate: ${minCapResult.bankruptRate.toFixed(2)}%`);
    } else {
        console.log(`   ⚠️  Nessun capitale testato è profittevole in media.\n`);
        console.log(`   Capitale con perdita minima: ${bestByProfit.capital.toLocaleString()}k bits (${bestByProfit.avgProfit.toFixed(2)}%)\n`);
    }

    // Trend analysis
    console.log('\n📈 TREND ANALYSIS:\n');
    console.log('   Capitale → Avg Profit:');
    allResults.forEach(r => {
        const bar = r.avgProfit > 0
            ? '+'.repeat(Math.floor(r.avgProfit * 5))
            : '-'.repeat(Math.floor(Math.abs(r.avgProfit) * 5));
        const sign = r.avgProfit >= 0 ? '+' : '';
        console.log(`      ${r.capital.toLocaleString()}k: ${sign}${r.avgProfit.toFixed(2)}% ${bar}`);
    });

    console.log('\n   Capitale → Bankrupt Rate:');
    allResults.forEach(r => {
        const bar = '█'.repeat(Math.floor(r.bankruptRate / 2));
        console.log(`      ${r.capital.toLocaleString()}k: ${r.bankruptRate.toFixed(2)}% ${bar}`);
    });

    // Save results
    const fs = require('fs');
    const output = {
        config,
        chunkSize: CHUNK_SIZE,
        numChunks: NUM_CHUNKS,
        results: allResults.map(r => ({
            capital: r.capital,
            successRate: r.successRate,
            positiveRate: r.positiveRate,
            bankruptRate: r.bankruptRate,
            avgProfit: r.avgProfit,
            maxProfit: r.maxProfit,
            minProfit: r.minProfit,
            stdDev: r.stdDev,
            sharpeRatio: r.sharpeRatio,
            avgDrawdown: r.avgDrawdown,
            maxDrawdown: r.maxDrawdown
        })),
        best: {
            byProfit: { capital: bestByProfit.capital, avgProfit: bestByProfit.avgProfit },
            byPositiveRate: { capital: bestByPositive.capital, positiveRate: bestByPositive.positiveRate },
            byBankruptRate: { capital: lowestBankrupt.capital, bankruptRate: lowestBankrupt.bankruptRate }
        },
        totalTime
    };

    fs.writeFileSync(
        'martin-capital-test-results.json',
        JSON.stringify(output, null, 2)
    );

    console.log('\n💾 Results saved to: martin-capital-test-results.json\n');
}

// Run test
testCapitals();
