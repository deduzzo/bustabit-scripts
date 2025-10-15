/**
 * MARTIN CAPITAL OPTIMIZER
 *
 * Testa diversi livelli di capitale e calcola il PROFITTO TOTALE ASSOLUTO
 * sommando tutti i risultati delle 2000 prove.
 *
 * Questo è cruciale perché:
 * - Un capitale più basso può avere % migliore ma profitto totale minore
 * - Dobbiamo massimizzare il profitto ASSOLUTO, non solo la %
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

        // Place bet if we have enough balance
        if (balance < currentBet) {
            // Insufficient balance - reset cycle and start fresh
            resets++;
            currentBet = baseBet;
            currentTimes = 0;

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
            continue; // Skip this game, restart fresh next round
        }

        // Place the bet
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

            // Calculate next bet
            const nextBet = Math.ceil((currentBet / 100) * mult) * 100;

            // Check if we should stop because of maxTimes limit (if set)
            if (maxTimes > 0 && currentTimes >= maxTimes) {
                // Hit optional max times limit - reset
                hitMaxTimes++;
                currentBet = baseBet;
                currentTimes = 0;

                if (waitBeforePlay > 0) {
                    state = STATE.WAITING;
                    waitRemaining = waitBeforePlay;
                }
            } else {
                // Continue martingale progression
                currentBet = nextBet;
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

// ===== CAPITAL OPTIMIZER =====
function optimizeCapital() {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║  MARTIN CAPITAL OPTIMIZER - M1.50-P3.0x                   ║');
    console.log('║  maxTimes=0 (no limit, only capital)                     ║');
    console.log('║  Calcolo PROFITTO TOTALE ASSOLUTO per ogni capitale      ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    const START_HASH = '94aa062026624e59a0ace092568d5f46e21b9bf1d5173609db8645dd62bdfc44';
    const TOTAL_GAMES = 4000000;
    const CHUNK_SIZE = 2000;
    const NUM_CHUNKS = 2000;

    const config = {
        baseBet: 100,      // 1 bit
        payout: 3.0,
        mult: 1.50,
        maxTimes: 0,       // 0 = no limit, only capital is the limit
        waitBeforePlay: 0
    };

    // Test questi capitali (in bits)
    // VERY HIGH capital test: 1M+ can reach T:30+
    const CAPITALS = [1000000, 1500000, 2000000];

    console.log('📋 Setup:');
    console.log(`   Starting Hash: ${START_HASH.substring(0, 16)}...`);
    console.log(`   Total Games: ${TOTAL_GAMES.toLocaleString()}`);
    console.log(`   Chunk Size: ${CHUNK_SIZE} games`);
    console.log(`   Number of Chunks: ${NUM_CHUNKS}`);
    console.log(`   Capitals to test: ${CAPITALS.map(c => `${(c/1000).toFixed(0)}k`).join(', ')} bits\n`);

    console.log('⚙️  Configuration:');
    console.log(`   Base Bet: ${config.baseBet / 100} bit`);
    console.log(`   Payout: ${config.payout}x`);
    console.log(`   Multiplier: ${config.mult}x`);
    console.log(`   Max Times: ${config.maxTimes === 0 ? 'UNLIMITED (capital only)' : config.maxTimes}\n`);

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

    // Step 3: Test each capital
    console.log('🔬 Step 3: Testing each capital level...\n');
    const allResults = [];

    for (const capital of CAPITALS) {
        console.log(`\n   Testing ${(capital/1000).toFixed(0)}k bits capital...`);
        const results = [];

        for (let i = 0; i < chunks.length; i++) {
            const result = simulateMartin(chunks[i], config, capital * 100); // Convert to satoshis
            results.push(result);

            if ((i + 1) % 500 === 0) {
                process.stdout.write(`\r      Progress: ${i + 1}/${NUM_CHUNKS} chunks (${((i + 1) / NUM_CHUNKS * 100).toFixed(1)}%)`);
            }
        }
        console.log(`\r      ✅ Completed ${NUM_CHUNKS} chunks`);

        // Calculate metrics
        const successes = results.filter(r => r.success).length;
        const positives = results.filter(r => r.profit > 0).length;
        const bankrupts = results.filter(r => r.reason === 'bankrupt').length;

        const profits = results.map(r => r.profitPercent);
        const avgProfit = profits.reduce((a, b) => a + b, 0) / profits.length;

        // CRUCIALE: Somma totale assoluta dei profitti in bits
        const totalAbsoluteProfit = results.reduce((sum, r) => sum + r.profit, 0) / 100; // Convert from satoshis to bits
        const avgAbsoluteProfit = totalAbsoluteProfit / NUM_CHUNKS;

        // Capitale totale investito
        const totalCapitalInvested = capital * NUM_CHUNKS;
        const returnOnInvestment = (totalAbsoluteProfit / totalCapitalInvested) * 100;

        allResults.push({
            capital,
            capitalBits: capital,
            successRate: (successes / NUM_CHUNKS * 100),
            positiveRate: (positives / NUM_CHUNKS * 100),
            bankruptRate: (bankrupts / NUM_CHUNKS * 100),
            avgProfitPercent: avgProfit,
            totalAbsoluteProfit,
            avgAbsoluteProfit,
            totalCapitalInvested,
            returnOnInvestment,
            results
        });
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n   ✅ All tests completed in ${totalTime}s\n`);

    // Display results
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📊 RISULTATI CONFRONTO CAPITALE:\n');

    console.log('═══════════════════════════════════════════════════════════════════════════════════════════');
    console.log(' Capital │ Success │ Bankrupt │ Avg % │ Total Profit │ Avg Profit │ Total Invested │ ROI %');
    console.log('─────────┼─────────┼──────────┼───────┼──────────────┼────────────┼────────────────┼──────');

    allResults.forEach(r => {
        const cap = `${(r.capitalBits/1000).toFixed(0)}k`.padStart(6);
        const success = `${r.successRate.toFixed(1)}%`.padStart(6);
        const bankrupt = `${r.bankruptRate.toFixed(1)}%`.padStart(7);
        const avgPct = `${r.avgProfitPercent.toFixed(3)}%`.padStart(6);
        const totalProfit = r.totalAbsoluteProfit >= 0
            ? `+${r.totalAbsoluteProfit.toFixed(0)}`.padStart(10)
            : `${r.totalAbsoluteProfit.toFixed(0)}`.padStart(10);
        const avgProfit = r.avgAbsoluteProfit >= 0
            ? `+${r.avgAbsoluteProfit.toFixed(2)}`.padStart(9)
            : `${r.avgAbsoluteProfit.toFixed(2)}`.padStart(9);
        const invested = `${r.totalCapitalInvested.toLocaleString()}`.padStart(13);
        const roi = `${r.returnOnInvestment.toFixed(3)}%`.padStart(6);

        console.log(` ${cap} │ ${success} │ ${bankrupt} │ ${avgPct} │ ${totalProfit} │ ${avgProfit} │ ${invested} │ ${roi}`);
    });

    console.log('═══════════════════════════════════════════════════════════════════════════════════════════\n');

    // Find best by total absolute profit
    const bestByTotal = allResults.reduce((best, curr) =>
        curr.totalAbsoluteProfit > best.totalAbsoluteProfit ? curr : best
    );

    // Find best by ROI
    const bestByROI = allResults.reduce((best, curr) =>
        curr.returnOnInvestment > best.returnOnInvestment ? curr : best
    );

    console.log('🏆 BEST CONFIGURATIONS:\n');
    console.log(`   By Total Absolute Profit: ${(bestByTotal.capitalBits/1000).toFixed(0)}k bits`);
    console.log(`      Total Profit: ${bestByTotal.totalAbsoluteProfit >= 0 ? '+' : ''}${bestByTotal.totalAbsoluteProfit.toFixed(2)} bits`);
    console.log(`      Avg Profit per session: ${bestByTotal.avgAbsoluteProfit >= 0 ? '+' : ''}${bestByTotal.avgAbsoluteProfit.toFixed(2)} bits`);
    console.log(`      ROI: ${bestByROI.returnOnInvestment.toFixed(3)}%\n`);

    console.log(`   By Return on Investment: ${(bestByROI.capitalBits/1000).toFixed(0)}k bits`);
    console.log(`      ROI: ${bestByROI.returnOnInvestment.toFixed(3)}%`);
    console.log(`      Total Profit: ${bestByROI.totalAbsoluteProfit >= 0 ? '+' : ''}${bestByROI.totalAbsoluteProfit.toFixed(2)} bits`);
    console.log(`      Avg Profit per session: ${bestByROI.avgAbsoluteProfit >= 0 ? '+' : ''}${bestByROI.avgAbsoluteProfit.toFixed(2)} bits\n`);

    // Determine if profitable
    const isProfitable = bestByTotal.totalAbsoluteProfit > 0;
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (isProfitable) {
        console.log('   🎉 STRATEGIA PROFITTEVOLE TROVATA!');
        console.log(`   💰 Con ${(bestByTotal.capitalBits/1000).toFixed(0)}k bits, profitto totale: +${bestByTotal.totalAbsoluteProfit.toFixed(2)} bits\n`);
    } else {
        console.log('   ❌ Nessuna configurazione è profittevole.');
        console.log(`   📉 Miglior risultato: ${bestByTotal.totalAbsoluteProfit.toFixed(2)} bits con ${(bestByTotal.capitalBits/1000).toFixed(0)}k capital\n`);
    }

    // Create detailed CSV report for each capital
    const fs = require('fs');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📝 Creating detailed CSV reports...\n');

    allResults.forEach(capResult => {
        const capital = capResult.capitalBits;
        const filename = `martin-detailed-${capital}bits.csv`;

        let csv = 'Session,Capital_Start,Capital_End,Profit_Bits,Profit_Percent,Status,Games_Played,Wins,Losses\n';

        capResult.results.forEach((r, idx) => {
            const session = idx + 1;
            const capitalStart = capital;
            const capitalEnd = (capital + (r.profit / 100)).toFixed(2);
            const profitBits = (r.profit / 100).toFixed(2);
            const profitPercent = r.profitPercent.toFixed(3);
            const status = r.reason === 'bankrupt' ? 'BANKRUPT' : 'COMPLETED';

            csv += `${session},${capitalStart},${capitalEnd},${profitBits},${profitPercent},${status},${r.gamesPlayed},${r.wins},${r.losses}\n`;
        });

        // Add summary row
        csv += `\nSUMMARY,${capital * NUM_CHUNKS},${(capital * NUM_CHUNKS + capResult.totalAbsoluteProfit).toFixed(2)},${capResult.totalAbsoluteProfit.toFixed(2)},${capResult.returnOnInvestment.toFixed(3)},,,${capResult.results.reduce((s,r) => s + r.wins, 0)},${capResult.results.reduce((s,r) => s + r.losses, 0)}\n`;

        fs.writeFileSync(filename, csv);
        console.log(`   ✅ ${filename}`);
    });

    // Save JSON results
    const output = {
        config,
        chunkSize: CHUNK_SIZE,
        numChunks: NUM_CHUNKS,
        totalGames: NUM_CHUNKS * CHUNK_SIZE,
        results: allResults.map(r => ({
            capital: r.capitalBits,
            successRate: r.successRate,
            positiveRate: r.positiveRate,
            bankruptRate: r.bankruptRate,
            avgProfitPercent: r.avgProfitPercent,
            totalAbsoluteProfit: r.totalAbsoluteProfit,
            avgAbsoluteProfit: r.avgAbsoluteProfit,
            totalCapitalInvested: r.totalCapitalInvested,
            returnOnInvestment: r.returnOnInvestment
        })),
        best: {
            byTotalProfit: {
                capital: bestByTotal.capitalBits,
                totalAbsoluteProfit: bestByTotal.totalAbsoluteProfit,
                avgAbsoluteProfit: bestByTotal.avgAbsoluteProfit,
                roi: bestByTotal.returnOnInvestment
            },
            byROI: {
                capital: bestByROI.capitalBits,
                totalAbsoluteProfit: bestByROI.totalAbsoluteProfit,
                roi: bestByROI.returnOnInvestment
            }
        },
        isProfitable,
        totalTime
    };

    fs.writeFileSync(
        'martin-capital-optimizer-results.json',
        JSON.stringify(output, null, 2)
    );

    console.log('\n💾 Results saved to:');
    console.log('   - martin-capital-optimizer-results.json (summary)');
    console.log(`   - martin-detailed-*bits.csv (${CAPITALS.length} detailed reports)\n`);
}

// Run optimizer
optimizeCapital();
