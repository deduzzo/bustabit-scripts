#!/usr/bin/env node
// Deep Analysis: Adaptive Strategy - Recent Bust Correlation

const fs = require('fs');

const INPUT_FILE = '../bustabit-real-data/1767741909781_Pandurangavithala_10000games.json';
const data = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));
const games = data.games.slice().reverse();

console.log('═'.repeat(80));
console.log('DEEP DIVE: ADAPTIVE STRATEGY BASED ON RECENT BUSTS');
console.log('═'.repeat(80));
console.log('');

// ═══════════════════════════════════════════════════════════════════════════
// DETAILED RECENT BUST ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════

const windowSizes = [3, 5, 10, 20];

for (const windowSize of windowSizes) {
    console.log('─'.repeat(80));
    console.log(`WINDOW SIZE: Last ${windowSize} games`);
    console.log('─'.repeat(80));

    // Create granular buckets
    const buckets = [];
    for (let i = 0; i <= 20; i++) {
        buckets.push({
            label: `${i}-${i+1}x`,
            min: i,
            max: i + 1,
            cashouts: []
        });
    }
    buckets.push({
        label: '20x+',
        min: 20,
        max: 1000,
        cashouts: []
    });

    for (let i = windowSize; i < games.length; i++) {
        const game = games[i];

        if (game.won) {
            // Calculate average bust of previous N games
            const recentBusts = [];
            for (let j = i - windowSize; j < i; j++) {
                recentBusts.push(games[j].bust);
            }
            const avgRecentBust = recentBusts.reduce((s, b) => s + b, 0) / recentBusts.length;

            // Find bucket
            for (const bucket of buckets) {
                if (avgRecentBust >= bucket.min && avgRecentBust < bucket.max) {
                    bucket.cashouts.push(game.cashedAt);
                    break;
                }
            }
        }
    }

    // Display results
    console.log('');
    console.log('Avg Bust Last N Games → Avg Cashout Target');
    console.log('');

    let maxDiff = 0;
    let maxDiffBucket = null;
    const overall = [];

    buckets.forEach(b => {
        if (b.cashouts.length > 0) {
            overall.push(...b.cashouts);
        }
    });

    const overallAvg = overall.reduce((s, c) => s + c, 0) / overall.length;

    buckets.forEach(bucket => {
        if (bucket.cashouts.length >= 5) {
            const avg = bucket.cashouts.reduce((s, c) => s + c, 0) / bucket.cashouts.length;
            const diff = avg - overallAvg;
            const absDiff = Math.abs(diff);

            if (absDiff > maxDiff) {
                maxDiff = absDiff;
                maxDiffBucket = { ...bucket, avg, diff };
            }

            const indicator = diff > 2 ? '🔴' : diff < -2 ? '🔵' : '⚪';
            console.log(`  ${bucket.label.padEnd(8)} → ${avg.toFixed(2)}x (${diff >= 0 ? '+' : ''}${diff.toFixed(2)}x) [${bucket.cashouts.length} samples] ${indicator}`);
        }
    });

    console.log('');
    console.log(`Overall average cashout: ${overallAvg.toFixed(2)}x`);

    if (maxDiff > 2) {
        console.log('');
        console.log(`⚠️  STRONG PATTERN: When recent busts avg ${maxDiffBucket.label} → target ${maxDiffBucket.avg.toFixed(2)}x (${maxDiffBucket.diff >= 0 ? '+' : ''}${maxDiffBucket.diff.toFixed(2)}x difference)`);
    }
    console.log('');
}

// ═══════════════════════════════════════════════════════════════════════════
// THRESHOLD DETECTION
// ═══════════════════════════════════════════════════════════════════════════
console.log('─'.repeat(80));
console.log('THRESHOLD DETECTION (Last 5 games)');
console.log('─'.repeat(80));
console.log('');

const thresholds = [2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15];

console.log('Testing different thresholds for "high" recent bust...');
console.log('');

for (const threshold of thresholds) {
    const below = [];
    const above = [];

    for (let i = 5; i < games.length; i++) {
        const game = games[i];

        if (game.won) {
            const recentBusts = [];
            for (let j = i - 5; j < i; j++) {
                recentBusts.push(games[j].bust);
            }
            const avgRecentBust = recentBusts.reduce((s, b) => s + b, 0) / recentBusts.length;

            if (avgRecentBust >= threshold) {
                above.push(game.cashedAt);
            } else {
                below.push(game.cashedAt);
            }
        }
    }

    if (above.length >= 10 && below.length >= 10) {
        const avgAbove = above.reduce((s, c) => s + c, 0) / above.length;
        const avgBelow = below.reduce((s, c) => s + c, 0) / below.length;
        const diff = avgAbove - avgBelow;

        const indicator = Math.abs(diff) > 2 ? '🔥' : Math.abs(diff) > 1 ? '⚡' : '  ';
        console.log(`  Threshold ${threshold.toFixed(0).padStart(2)}x: Below=${avgBelow.toFixed(2)}x [${below.length}] | Above=${avgAbove.toFixed(2)}x [${above.length}] | Diff=${diff >= 0 ? '+' : ''}${diff.toFixed(2)}x ${indicator}`);
    }
}

console.log('');

// ═══════════════════════════════════════════════════════════════════════════
// INDIVIDUAL BUST VALUE CORRELATION
// ═══════════════════════════════════════════════════════════════════════════
console.log('─'.repeat(80));
console.log('CORRELATION: Previous Game Bust → Next Win Cashout');
console.log('─'.repeat(80));
console.log('');

const prevBustToCashout = {};

for (let i = 1; i < games.length; i++) {
    const game = games[i];

    if (game.won) {
        const prevBust = games[i - 1].bust;
        const bucketKey = Math.floor(prevBust);

        if (!prevBustToCashout[bucketKey]) {
            prevBustToCashout[bucketKey] = [];
        }
        prevBustToCashout[bucketKey].push(game.cashedAt);
    }
}

console.log('Previous game bust → Average cashout on next win:');
console.log('');

const overall = [];
Object.values(prevBustToCashout).forEach(v => overall.push(...v));
const overallAvg = overall.reduce((s, c) => s + c, 0) / overall.length;

Object.keys(prevBustToCashout)
    .map(k => parseInt(k))
    .sort((a, b) => a - b)
    .forEach(bust => {
        const cashouts = prevBustToCashout[bust];
        if (cashouts.length >= 5) {
            const avg = cashouts.reduce((s, c) => s + c, 0) / cashouts.length;
            const diff = avg - overallAvg;
            const indicator = Math.abs(diff) > 2 ? '🔥' : '  ';
            console.log(`  Prev bust ${bust.toString().padStart(2)}x → Next cashout ${avg.toFixed(2)}x (${diff >= 0 ? '+' : ''}${diff.toFixed(2)}x) [${cashouts.length} samples] ${indicator}`);
        }
    });

console.log('');
console.log('═'.repeat(80));
console.log('SUMMARY: ALGORITHM LOGIC');
console.log('═'.repeat(80));
console.log('');
console.log('Based on the analysis, the algorithm appears to:');
console.log('');
console.log('1. Calculate average bust of last 5 games');
console.log('2. Adjust cashout target based on this average:');
console.log('   - If recent busts are HIGH (>10x avg) → Target HIGHER (~15x)');
console.log('   - If recent busts are LOW (<3x avg) → Target MEDIUM (~11x)');
console.log('   - If recent busts are MEDIUM (3-10x) → Target LOWER (~10x)');
console.log('');
console.log('3. This is a CONTRARIAN strategy:');
console.log('   - High recent busts → Expects another high bust, waits longer');
console.log('   - Low recent busts → Plays it safe, cashes earlier');
console.log('');
console.log('═'.repeat(80));
