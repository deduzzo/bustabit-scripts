#!/usr/bin/env node
// Analyze GAPS in gameId sequence to find when player SKIPPED games

const fs = require('fs');

const INPUT_FILE = '../bustabit-real-data/1767741909781_Pandurangavithala_10000games.json';
const data = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));
const games = data.games.slice().reverse(); // Chronological order

console.log('═'.repeat(80));
console.log('GAP ANALYSIS - When does Pandurangavithala SKIP games?');
console.log('═'.repeat(80));
console.log('');

// Analyze gaps
let totalGaps = 0;
let totalGamesSkipped = 0;
const gapSizes = [];
const gapsWithContext = [];

for (let i = 1; i < games.length; i++) {
    const prevGameId = games[i - 1].gameId;
    const currGameId = games[i].gameId;
    const gap = currGameId - prevGameId - 1; // -1 because consecutive games have diff of 1

    if (gap > 0) {
        totalGaps++;
        totalGamesSkipped += gap;
        gapSizes.push(gap);

        // Store context: bust before gap, bust after gap
        gapsWithContext.push({
            gap: gap,
            beforeGap: {
                gameId: prevGameId,
                bust: games[i - 1].bust,
                won: games[i - 1].won,
                cashedAt: games[i - 1].cashedAt
            },
            afterGap: {
                gameId: currGameId,
                bust: games[i].bust,
                won: games[i].won,
                cashedAt: games[i].cashedAt
            }
        });
    }
}

console.log('SUMMARY:');
console.log(`  Total gaps found: ${totalGaps}`);
console.log(`  Total games skipped: ${totalGamesSkipped}`);
console.log(`  Games played: ${games.length}`);
console.log(`  Estimated total games: ${games.length + totalGamesSkipped}`);
console.log(`  Participation rate: ${(games.length / (games.length + totalGamesSkipped) * 100).toFixed(2)}%`);
console.log('');

// Gap size distribution
const maxGap = Math.max(...gapSizes);
const avgGap = gapSizes.reduce((s, g) => s + g, 0) / gapSizes.length;

console.log('GAP SIZE DISTRIBUTION:');
console.log(`  Min: 1 game skipped`);
console.log(`  Max: ${maxGap} games skipped`);
console.log(`  Avg: ${avgGap.toFixed(2)} games skipped per gap`);
console.log('');

// Bucket by size
const gapBuckets = {
    '1': 0,
    '2-5': 0,
    '6-10': 0,
    '11-20': 0,
    '21-50': 0,
    '51+': 0
};

gapSizes.forEach(g => {
    if (g === 1) gapBuckets['1']++;
    else if (g <= 5) gapBuckets['2-5']++;
    else if (g <= 10) gapBuckets['6-10']++;
    else if (g <= 20) gapBuckets['11-20']++;
    else if (g <= 50) gapBuckets['21-50']++;
    else gapBuckets['51+']++;
});

console.log('  1 game skipped:', gapBuckets['1']);
console.log('  2-5 games skipped:', gapBuckets['2-5']);
console.log('  6-10 games skipped:', gapBuckets['6-10']);
console.log('  11-20 games skipped:', gapBuckets['11-20']);
console.log('  21-50 games skipped:', gapBuckets['21-50']);
console.log('  51+ games skipped:', gapBuckets['51+']);
console.log('');

// ═══════════════════════════════════════════════════════════════════════════
// PATTERN: What triggers a SKIP?
// ═══════════════════════════════════════════════════════════════════════════

console.log('─'.repeat(80));
console.log('PATTERN: What happened BEFORE the skip?');
console.log('─'.repeat(80));
console.log('');

const beforeGapWins = gapsWithContext.filter(g => g.beforeGap.won).length;
const beforeGapLosses = gapsWithContext.filter(g => !g.beforeGap.won).length;

console.log('Last game before skip:');
console.log(`  Won: ${beforeGapWins} (${(beforeGapWins / gapsWithContext.length * 100).toFixed(1)}%)`);
console.log(`  Lost: ${beforeGapLosses} (${(beforeGapLosses / gapsWithContext.length * 100).toFixed(1)}%)`);
console.log('');

// Bust distribution before skip
const bustBeforeSkip = gapsWithContext.map(g => g.beforeGap.bust);
const avgBustBefore = bustBeforeSkip.reduce((s, b) => s + b, 0) / bustBeforeSkip.length;

console.log(`Average bust before skip: ${avgBustBefore.toFixed(2)}x`);
console.log('');

// Categorize busts
const bustCategories = {
    'instant': 0,  // < 1.5x
    'low': 0,      // 1.5-3x
    'medium': 0,   // 3-10x
    'high': 0      // 10x+
};

bustBeforeSkip.forEach(b => {
    if (b < 1.5) bustCategories['instant']++;
    else if (b < 3) bustCategories['low']++;
    else if (b < 10) bustCategories['medium']++;
    else bustCategories['high']++;
});

console.log('Bust categories before skip:');
console.log(`  Instant (< 1.5x): ${bustCategories['instant']} (${(bustCategories['instant'] / bustBeforeSkip.length * 100).toFixed(1)}%)`);
console.log(`  Low (1.5-3x): ${bustCategories['low']} (${(bustCategories['low'] / bustBeforeSkip.length * 100).toFixed(1)}%)`);
console.log(`  Medium (3-10x): ${bustCategories['medium']} (${(bustCategories['medium'] / bustBeforeSkip.length * 100).toFixed(1)}%)`);
console.log(`  High (10x+): ${bustCategories['high']} (${(bustCategories['high'] / bustBeforeSkip.length * 100).toFixed(1)}%)`);
console.log('');

// ═══════════════════════════════════════════════════════════════════════════
// PATTERN: Win/Loss streaks before skip
// ═══════════════════════════════════════════════════════════════════════════

console.log('─'.repeat(80));
console.log('PATTERN: Win/Loss streaks before skip');
console.log('─'.repeat(80));
console.log('');

// Calculate loss streaks
const streaksBeforeSkip = {
    '1-2 losses': 0,
    '3-5 losses': 0,
    '6-10 losses': 0,
    '11-20 losses': 0,
    '21+ losses': 0,
    'after win': 0
};

gapsWithContext.forEach((gap, index) => {
    // Count consecutive losses before this gap
    let lossStreak = 0;
    for (let j = index - 1; j >= 0 && gapsWithContext[j]; j--) {
        const gameIdx = games.findIndex(g => g.gameId === gapsWithContext[j].beforeGap.gameId);
        if (gameIdx >= 0 && !games[gameIdx].won) {
            lossStreak++;
        } else {
            break;
        }
    }

    if (gap.beforeGap.won) {
        streaksBeforeSkip['after win']++;
    } else if (lossStreak <= 2) {
        streaksBeforeSkip['1-2 losses']++;
    } else if (lossStreak <= 5) {
        streaksBeforeSkip['3-5 losses']++;
    } else if (lossStreak <= 10) {
        streaksBeforeSkip['6-10 losses']++;
    } else if (lossStreak <= 20) {
        streaksBeforeSkip['11-20 losses']++;
    } else {
        streaksBeforeSkip['21+ losses']++;
    }
});

console.log('Skip pattern after:');
Object.entries(streaksBeforeSkip).forEach(([streak, count]) => {
    const pct = (count / gapsWithContext.length * 100).toFixed(1);
    console.log(`  ${streak.padEnd(15)}: ${count.toString().padStart(4)} (${pct}%)`);
});

console.log('');

// ═══════════════════════════════════════════════════════════════════════════
// CONCLUSION
// ═══════════════════════════════════════════════════════════════════════════

console.log('─'.repeat(80));
console.log('CONCLUSION');
console.log('─'.repeat(80));
console.log('');

if (totalGaps < 10) {
    console.log('✓ Player plays ALMOST EVERY GAME');
    console.log(`  Only ${totalGaps} gaps in ${games.length} games`);
    console.log('  No significant skip pattern');
} else {
    const skipRate = (totalGamesSkipped / (games.length + totalGamesSkipped) * 100).toFixed(1);
    console.log(`⚠️  Player skips ~${skipRate}% of games`);
    console.log('');

    // Check if there's a pattern
    if (beforeGapWins / gapsWithContext.length > 0.6) {
        console.log('🔍 PATTERN: Tends to skip after WINS');
    } else if (beforeGapLosses / gapsWithContext.length > 0.8) {
        console.log('🔍 PATTERN: Tends to skip after LOSSES');
    }

    if (bustCategories['instant'] / bustBeforeSkip.length > 0.4) {
        console.log('🔍 PATTERN: Tends to skip after INSTANT BUSTS');
    }
}

console.log('');
console.log('═'.repeat(80));
