/**
 * MARTIN CHUNK TEST - 1000 partite per chunk
 *
 * Test della configurazione originale M1.51-P3.1x su chunk di 1000 partite
 * per verificare se con sessioni più corte può essere profittevole
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
            // Insufficient balance - reset to baseBet and continue
            currentBet = baseBet;
            currentTimes = 0;
            hitMaxTimes++;

            if (waitBeforePlay > 0) {
                state = STATE.WAITING;
                waitRemaining = waitBeforePlay;
            }

            // Check if balance is too low even for baseBet
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
                    reason: 'bankrupt'
                };
            }
            continue; // Skip this round, restart next round
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

// ===== CHUNK TEST =====
function testChunks() {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║  MARTIN CHUNK TEST - 1000 partite per chunk               ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    const START_HASH = '94aa062026624e59a0ace092568d5f46e21b9bf1d5173609db8645dd62bdfc44';
    const TOTAL_GAMES = 300000;
    const CHUNK_SIZE = 1000;
    const NUM_CHUNKS = 1000;
    const CAPITAL = 5700000; // 57k bits

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
    console.log(`   Capital: ${(CAPITAL / 100).toLocaleString()} bits\n`);

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

    // Step 3: Test each chunk
    console.log('🔬 Step 3: Testing chunks...\n');
    const results = [];

    for (let i = 0; i < chunks.length; i++) {
        const result = simulateMartin(chunks[i], config, CAPITAL);
        results.push(result);

        if ((i + 1) % 100 === 0) {
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            process.stdout.write(`\r   Progress: ${i + 1}/${NUM_CHUNKS} chunks (${((i + 1) / NUM_CHUNKS * 100).toFixed(1)}%) | ${elapsed}s`);
        }
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n   ✅ Completed in ${totalTime}s\n`);

    // Analyze results
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📊 RISULTATI:\n');

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

    console.log('Performance Summary:');
    console.log('───────────────────────────────────────────────────────────');
    console.log(`   Success Rate:     ${(successes / NUM_CHUNKS * 100).toFixed(2)}% (${successes}/${NUM_CHUNKS})`);
    console.log(`   Positive Rate:    ${(positives / NUM_CHUNKS * 100).toFixed(2)}% (${positives}/${NUM_CHUNKS})`);
    console.log(`   Bankrupt Rate:    ${(bankrupts / NUM_CHUNKS * 100).toFixed(2)}% (${bankrupts}/${NUM_CHUNKS})`);
    console.log('');
    console.log(`   Avg Profit:       ${avgProfit.toFixed(2)}%`);
    console.log(`   Max Profit:       ${maxProfit.toFixed(2)}%`);
    console.log(`   Min Profit:       ${minProfit.toFixed(2)}%`);
    console.log(`   Std Dev:          ${stdDev.toFixed(2)}%`);
    console.log(`   Sharpe Ratio:     ${sharpeRatio.toFixed(3)}`);
    console.log('');
    console.log(`   Avg Drawdown:     ${avgDrawdown.toFixed(2)}%`);
    console.log(`   Max Drawdown:     ${maxDrawdownValue.toFixed(2)}%`);
    console.log('');

    // Distribution analysis
    const profitBuckets = {
        'Loss > -20%': 0,
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
        if (p < -20) profitBuckets['Loss > -20%']++;
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
        console.log(`   ${range.padEnd(20)} ${pct.padStart(5)}% ${bar}`);
    });
    console.log('');

    // Comparison with long sessions
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📊 CONFRONTO CON SESSIONI LUNGHE:\n');
    console.log('   1000 games/chunk (questo test):');
    console.log(`      Avg Profit: ${avgProfit.toFixed(2)}%`);
    console.log(`      Positive Rate: ${(positives / NUM_CHUNKS * 100).toFixed(2)}%`);
    console.log(`      Bankrupt Rate: ${(bankrupts / NUM_CHUNKS * 100).toFixed(2)}%`);
    console.log('');
    console.log('   4000 games/session (test precedente M1.45-P3.2x):');
    console.log('      Avg Profit: -5.53%');
    console.log('      Positive Rate: 72.25%');
    console.log('      Bankrupt Rate: 15.41%');
    console.log('');

    if (avgProfit > 0) {
        console.log('   🎉 CON SESSIONI BREVI (1000 games) IL MARTIN È PROFITTEVOLE!\n');
    } else if (avgProfit > -1) {
        console.log('   ✅ Sessioni brevi riducono significativamente le perdite!\n');
    } else {
        console.log('   ⚠️  Anche con sessioni brevi, Martin resta unprofitable.\n');
    }

    // Save results
    const fs = require('fs');
    const output = {
        config,
        capital: CAPITAL,
        chunkSize: CHUNK_SIZE,
        numChunks: NUM_CHUNKS,
        summary: {
            successRate: successes / NUM_CHUNKS * 100,
            positiveRate: positives / NUM_CHUNKS * 100,
            bankruptRate: bankrupts / NUM_CHUNKS * 100,
            avgProfit,
            maxProfit,
            minProfit,
            stdDev,
            sharpeRatio,
            avgDrawdown,
            maxDrawdown: maxDrawdownValue
        },
        distribution: profitBuckets,
        totalTime,
        allResults: results
    };

    fs.writeFileSync(
        'martin-chunk-test-results.json',
        JSON.stringify(output, null, 2)
    );

    console.log('💾 Results saved to: martin-chunk-test-results.json\n');
}

// Run test
testChunks();
