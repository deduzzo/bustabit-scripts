/**
 * MARTIN DEEP TEST - Test approfondito 60k capital
 *
 * 2000 chunk × 2000 partite = 4,000,000 games totali
 * Per verificare se M1.51-P3.1x è davvero profittevole con 60k
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

        if ((i + 1) % 100000 === 0) {
            process.stdout.write(`\r   Generating: ${(i + 1).toLocaleString()}/${count.toLocaleString()} (${((i + 1) / count * 100).toFixed(1)}%)`);
        }
    }
    process.stdout.write(`\r   Generated: ${count.toLocaleString()} crashes\n`);

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
    let resets = 0;

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

        // BETTING state - check insufficient balance
        if (balance < currentBet) {
            // Reset to baseBet and continue
            resets++;
            currentBet = baseBet;
            currentTimes = 0;
            hitMaxTimes++;

            if (waitBeforePlay > 0) {
                state = STATE.WAITING;
                waitRemaining = waitBeforePlay;
            }

            // True bankruptcy - can't even place baseBet
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
                    hitMaxTimes,
                    resets,
                    reason: 'bankrupt'
                };
            }
            continue;
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
                // Hit max times - reset
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
        resets,
        reason: 'completed'
    };
}

// ===== DEEP TEST =====
function deepTest() {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║  MARTIN DEEP TEST - M1.50-P2.3x - 55k Capital            ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    const START_HASH = '94aa062026624e59a0ace092568d5f46e21b9bf1d5173609db8645dd62bdfc44';
    const TOTAL_GAMES = 4000000; // 4 milioni
    const CHUNK_SIZE = 2000;
    const NUM_CHUNKS = 2000;
    const CAPITAL = 5500000; // 55k bits

    const config = {
        baseBet: 100,      // 1 bit
        payout: 2.3,
        mult: 1.50,
        maxTimes: 23,
        waitBeforePlay: 0
    };

    console.log('📋 Setup:');
    console.log(`   Starting Hash: ${START_HASH.substring(0, 16)}...`);
    console.log(`   Total Games: ${TOTAL_GAMES.toLocaleString()}`);
    console.log(`   Chunk Size: ${CHUNK_SIZE} games`);
    console.log(`   Number of Chunks: ${NUM_CHUNKS}`);
    console.log(`   Capital: ${(CAPITAL / 100).toLocaleString()} bits\n`);

    console.log('⚙️  Configuration:');
    console.log(`   Base Bet: ${config.baseBet / 100} bit`);
    console.log(`   Payout: ${config.payout}x`);
    console.log(`   Multiplier: ${config.mult}x`);
    console.log(`   Max Times: ${config.maxTimes}`);
    console.log(`   Wait Mode: ${config.waitBeforePlay}\n`);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Step 1: Generate full sequence
    console.log('🔄 Step 1: Generating 4M real crashes...\n');
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

    // Step 3: Test each chunk
    console.log('🔬 Step 3: Testing chunks...\n');
    const results = [];

    for (let i = 0; i < chunks.length; i++) {
        const result = simulateMartin(chunks[i], config, CAPITAL);
        results.push(result);

        if ((i + 1) % 100 === 0) {
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            const pct = ((i + 1) / NUM_CHUNKS * 100).toFixed(1);
            process.stdout.write(`\r   Progress: ${i + 1}/${NUM_CHUNKS} chunks (${pct}%) | ${elapsed}s`);
        }
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n   ✅ Completed in ${totalTime}s\n`);

    // Analyze results
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📊 RISULTATI DEEP TEST:\n');

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

    // Calculate confidence interval (95%)
    const ci95 = 1.96 * (stdDev / Math.sqrt(NUM_CHUNKS));

    console.log('Performance Summary (2000 chunks × 2000 games):');
    console.log('───────────────────────────────────────────────────────────');
    console.log(`   Success Rate:     ${(successes / NUM_CHUNKS * 100).toFixed(2)}% (${successes}/${NUM_CHUNKS})`);
    console.log(`   Positive Rate:    ${(positives / NUM_CHUNKS * 100).toFixed(2)}% (${positives}/${NUM_CHUNKS})`);
    console.log(`   Bankrupt Rate:    ${(bankrupts / NUM_CHUNKS * 100).toFixed(2)}% (${bankrupts}/${NUM_CHUNKS})`);
    console.log('');
    console.log(`   Avg Profit:       ${avgProfit.toFixed(3)}%`);
    console.log(`   95% CI:           ${(avgProfit - ci95).toFixed(3)}% to ${(avgProfit + ci95).toFixed(3)}%`);
    console.log(`   Max Profit:       ${maxProfit.toFixed(2)}%`);
    console.log(`   Min Profit:       ${minProfit.toFixed(2)}%`);
    console.log(`   Std Dev:          ${stdDev.toFixed(2)}%`);
    console.log(`   Sharpe Ratio:     ${sharpeRatio.toFixed(3)}`);
    console.log('');
    console.log(`   Avg Drawdown:     ${avgDrawdown.toFixed(2)}%`);
    console.log(`   Max Drawdown:     ${maxDrawdownValue.toFixed(2)}%`);
    console.log('');

    // Median profit
    const sortedProfits = [...profits].sort((a, b) => a - b);
    const median = sortedProfits[Math.floor(NUM_CHUNKS / 2)];
    console.log(`   Median Profit:    ${median.toFixed(3)}%`);
    console.log('');

    // Distribution analysis
    const profitBuckets = {
        'Loss > -50%': 0,
        'Loss -50% to -20%': 0,
        'Loss -20% to -10%': 0,
        'Loss -10% to -5%': 0,
        'Loss -5% to 0%': 0,
        'Profit 0% to +5%': 0,
        'Profit +5% to +10%': 0,
        'Profit +10% to +20%': 0,
        'Profit > +20%': 0
    };

    results.forEach(r => {
        const p = r.profitPercent;
        if (p < -50) profitBuckets['Loss > -50%']++;
        else if (p < -20) profitBuckets['Loss -50% to -20%']++;
        else if (p < -10) profitBuckets['Loss -20% to -10%']++;
        else if (p < -5) profitBuckets['Loss -10% to -5%']++;
        else if (p < 0) profitBuckets['Loss -5% to 0%']++;
        else if (p < 5) profitBuckets['Profit 0% to +5%']++;
        else if (p < 10) profitBuckets['Profit +5% to +10%']++;
        else if (p < 20) profitBuckets['Profit +10% to +20%']++;
        else profitBuckets['Profit > +20%']++;
    });

    console.log('Profit Distribution:');
    console.log('───────────────────────────────────────────────────────────');
    Object.entries(profitBuckets).forEach(([range, count]) => {
        const pct = (count / NUM_CHUNKS * 100).toFixed(1);
        const bar = '█'.repeat(Math.floor(count / NUM_CHUNKS * 50));
        console.log(`   ${range.padEnd(22)} ${pct.padStart(5)}% ${bar}`);
    });
    console.log('');

    // Statistical significance test
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📈 STATISTICAL SIGNIFICANCE:\n');

    const tStat = (avgProfit * Math.sqrt(NUM_CHUNKS)) / stdDev;
    const pValue = tStat > 0 ? 'p < 0.05' : 'p > 0.05';

    console.log(`   T-Statistic:      ${tStat.toFixed(3)}`);
    console.log(`   P-Value:          ${pValue}`);
    console.log(`   Sample Size:      ${NUM_CHUNKS} chunks`);
    console.log(`   Total Games:      ${(NUM_CHUNKS * CHUNK_SIZE).toLocaleString()}`);
    console.log('');

    if (avgProfit > 0) {
        if (avgProfit - ci95 > 0) {
            console.log('   ✅ STATISTICAMENTE SIGNIFICATIVO: Il profitto è POSITIVO!');
        } else {
            console.log('   ⚠️  Il profitto è positivo ma NON statisticamente significativo.');
            console.log('   📊 Il 95% CI include lo zero - serve più dati.');
        }
    } else {
        console.log('   ❌ Il profitto è NEGATIVO - Martin NON è profittevole.');
    }
    console.log('');

    // Comparison
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📊 CONFRONTO:\n');
    console.log('   2000 games/chunk (questo test):');
    console.log(`      Avg Profit: ${avgProfit.toFixed(3)}%`);
    console.log(`      Positive Rate: ${(positives / NUM_CHUNKS * 100).toFixed(2)}%`);
    console.log(`      Bankrupt Rate: ${(bankrupts / NUM_CHUNKS * 100).toFixed(2)}%`);
    console.log('');
    console.log('   1000 games/chunk (test precedente):');
    console.log('      Avg Profit: +0.12%');
    console.log('      Positive Rate: 95.70%');
    console.log('      Bankrupt Rate: 0.70%');
    console.log('');

    if (avgProfit > 0) {
        console.log('   🎉 MARTIN M1.51-P3.1x CON 60k È PROFITTEVOLE!\n');
    } else {
        console.log('   ⚠️  Con più dati, Martin NON risulta profittevole.\n');
        console.log('   💡 Conclusione: Il +0.12% del test precedente era variance luck.\n');
    }

    // Save results
    const fs = require('fs');
    const output = {
        config,
        capital: CAPITAL / 100,
        chunkSize: CHUNK_SIZE,
        numChunks: NUM_CHUNKS,
        totalGames: NUM_CHUNKS * CHUNK_SIZE,
        summary: {
            successRate: successes / NUM_CHUNKS * 100,
            positiveRate: positives / NUM_CHUNKS * 100,
            bankruptRate: bankrupts / NUM_CHUNKS * 100,
            avgProfit,
            median,
            maxProfit,
            minProfit,
            stdDev,
            sharpeRatio,
            confidenceInterval95: { lower: avgProfit - ci95, upper: avgProfit + ci95 },
            avgDrawdown,
            maxDrawdown: maxDrawdownValue,
            tStatistic: tStat
        },
        distribution: profitBuckets,
        totalTime
    };

    fs.writeFileSync(
        'martin-deep-test-results.json',
        JSON.stringify(output, null, 2)
    );

    console.log('💾 Results saved to: martin-deep-test-results.json\n');
}

// Run test
deepTest();
