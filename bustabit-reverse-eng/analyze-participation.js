#!/usr/bin/env node
// Analyze WHEN Pandurangavithala decides to SKIP games

const fs = require('fs');

const INPUT_FILE = '../bustabit-real-data/1767741909781_Pandurangavithala_10000games.json';

// Load ALL games data (including when player didn't participate)
const rawData = fs.readFileSync(INPUT_FILE, 'utf8');
const data = JSON.parse(rawData);

console.log('═'.repeat(80));
console.log('PARTICIPATION ANALYSIS');
console.log('═'.repeat(80));
console.log('');

// Check data structure
console.log('Data structure:');
console.log('  Total games in dataset:', data.games.length);
console.log('  Filter:', data.filter);
console.log('');

// Analyze participation
const participated = data.games.filter(g => g.player === data.filter);
const participationRate = (participated.length / data.games.length * 100).toFixed(2);

console.log('Participation:');
console.log('  Played:', participated.length);
console.log('  Total in dataset:', data.games.length);
console.log('  Rate:', participationRate + '%');
console.log('');

if (participated.length === data.games.length) {
    console.log('⚠️  Dataset contains ONLY games where player participated!');
    console.log('   Cannot analyze skip patterns without full game history.');
    console.log('');
    console.log('RECOMMENDATION:');
    console.log('  - Scrape consecutive games (all players, all games)');
    console.log('  - Then filter for this player to see when they skip');
    console.log('');
} else {
    console.log('✓ Dataset contains full game history');
    console.log('  Can analyze when player chooses to skip');
    console.log('');

    // Analyze skip patterns
    const games = data.games.slice().reverse(); // Chronological order

    let recentBusts = [];
    const skipsByRecentAvg = {};
    const playsByRecentAvg = {};

    for (let i = 0; i < games.length; i++) {
        const game = games[i];

        if (i >= 5) {
            // Calculate avg of last 5 busts
            const avgBust = recentBusts.slice(-5).reduce((s, b) => s + b, 0) / 5;
            const bucket = Math.floor(avgBust);

            if (game.player === data.filter) {
                // Player participated
                if (!playsByRecentAvg[bucket]) playsByRecentAvg[bucket] = 0;
                playsByRecentAvg[bucket]++;
            } else {
                // Player skipped
                if (!skipsByRecentAvg[bucket]) skipsByRecentAvg[bucket] = 0;
                skipsByRecentAvg[bucket]++;
            }
        }

        // Add current bust to history
        recentBusts.push(game.bust);
        if (recentBusts.length > 5) recentBusts.shift();
    }

    console.log('Skip pattern by recent bust average:');
    console.log('');

    const allBuckets = new Set([
        ...Object.keys(skipsByRecentAvg),
        ...Object.keys(playsByRecentAvg)
    ]);

    Array.from(allBuckets)
        .map(k => parseInt(k))
        .sort((a, b) => a - b)
        .forEach(bucket => {
            const skips = skipsByRecentAvg[bucket] || 0;
            const plays = playsByRecentAvg[bucket] || 0;
            const total = skips + plays;
            const skipRate = total > 0 ? (skips / total * 100).toFixed(1) : '0.0';

            console.log(`  Avg ${bucket}x: Skip ${skipRate}% (${skips} skips / ${plays} plays)`);
        });
}

console.log('');
console.log('═'.repeat(80));
