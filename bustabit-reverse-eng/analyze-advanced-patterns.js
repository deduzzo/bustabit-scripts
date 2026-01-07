#!/usr/bin/env node
// Advanced Pattern Analysis - Context-Aware Strategy Detection
// Analizza pattern NON RANDOM basati su contesto (perdite, bust recenti, ecc.)

const fs = require('fs');
const path = require('path');

// Parse arguments
const args = process.argv.slice(2);
if (args.length < 1) {
    console.log('Usage: node analyze-advanced-patterns.js <json_file> [player_name]');
    console.log('Example: node analyze-advanced-patterns.js data/player_10k.json Pandurangavithala');
    process.exit(1);
}

const INPUT_FILE = args[0];
const TARGET_PLAYER = args[1] || null;

// Load data
const data = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));
const targetPlayer = TARGET_PLAYER || data.filter;

console.log('═'.repeat(80));
console.log(`ADVANCED PATTERN ANALYSIS: ${targetPlayer}`);
console.log('═'.repeat(80));
console.log('');

// Extract ALL games in chronological order
const allGames = data.games.slice();
allGames.sort((a, b) => a.gameId - b.gameId);

// Filter player games
const playerGames = allGames.filter(g => g.player === targetPlayer);

console.log(`Total games analyzed: ${playerGames.length}`);
console.log('');

// ═══════════════════════════════════════════════════════════════════════════
// ANALYSIS 1: Target Selection After Consecutive Losses
// ═══════════════════════════════════════════════════════════════════════════
console.log('─'.repeat(80));
console.log('ANALYSIS 1: TARGET AFTER CONSECUTIVE LOSSES');
console.log('─'.repeat(80));
console.log('');

const targetAfterLosses = {
    '0-5': [],
    '6-10': [],
    '11-20': [],
    '21-50': [],
    '51+': []
};

let currentLossStreak = 0;
for (let i = 0; i < playerGames.length; i++) {
    const game = playerGames[i];

    if (i > 0 && !playerGames[i - 1].won) {
        currentLossStreak++;
    } else if (i > 0 && playerGames[i - 1].won) {
        currentLossStreak = 0;
    }

    // Only look at wins to see what target was used
    if (game.cashedAt !== null) {
        const target = game.cashedAt;

        if (currentLossStreak <= 5) {
            targetAfterLosses['0-5'].push(target);
        } else if (currentLossStreak <= 10) {
            targetAfterLosses['6-10'].push(target);
        } else if (currentLossStreak <= 20) {
            targetAfterLosses['11-20'].push(target);
        } else if (currentLossStreak <= 50) {
            targetAfterLosses['21-50'].push(target);
        } else {
            targetAfterLosses['51+'].push(target);
        }
    }
}

console.log('Average cashout target by loss streak:');
for (const [range, targets] of Object.entries(targetAfterLosses)) {
    if (targets.length > 0) {
        const avg = targets.reduce((s, t) => s + t, 0) / targets.length;
        const min = Math.min(...targets);
        const max = Math.max(...targets);
        console.log(`  ${range.padEnd(8)} losses: ${avg.toFixed(2)}x avg (${min.toFixed(2)}-${max.toFixed(2)}x range) [${targets.length} samples]`);
    }
}
console.log('');

// ═══════════════════════════════════════════════════════════════════════════
// ANALYSIS 2: Correlation with Recent Busts
// ═══════════════════════════════════════════════════════════════════════════
console.log('─'.repeat(80));
console.log('ANALYSIS 2: TARGET vs RECENT BUST PATTERN');
console.log('─'.repeat(80));
console.log('');

const windowSize = 5; // Look at last 5 games
const targetByRecentBust = {
    'low': [],    // Recent busts < 3x
    'medium': [], // Recent busts 3-10x
    'high': []    // Recent busts > 10x
};

for (let i = windowSize; i < playerGames.length; i++) {
    const game = playerGames[i];

    if (game.cashedAt !== null) {
        // Calculate average bust of previous games
        const recentBusts = [];
        for (let j = i - windowSize; j < i; j++) {
            recentBusts.push(playerGames[j].bust);
        }
        const avgRecentBust = recentBusts.reduce((s, b) => s + b, 0) / recentBusts.length;

        const target = game.cashedAt;

        if (avgRecentBust < 3) {
            targetByRecentBust['low'].push(target);
        } else if (avgRecentBust < 10) {
            targetByRecentBust['medium'].push(target);
        } else {
            targetByRecentBust['high'].push(target);
        }
    }
}

console.log(`Average target when last ${windowSize} busts were:`);
for (const [level, targets] of Object.entries(targetByRecentBust)) {
    if (targets.length > 0) {
        const avg = targets.reduce((s, t) => s + t, 0) / targets.length;
        console.log(`  ${level.padEnd(8)}: ${avg.toFixed(2)}x avg [${targets.length} samples]`);
    }
}
console.log('');

// ═══════════════════════════════════════════════════════════════════════════
// ANALYSIS 3: Target Evolution Over Time
// ═══════════════════════════════════════════════════════════════════════════
console.log('─'.repeat(80));
console.log('ANALYSIS 3: TARGET EVOLUTION OVER SESSION');
console.log('─'.repeat(80));
console.log('');

const wins = playerGames.filter(g => g.cashedAt !== null);
const chunkSize = Math.floor(wins.length / 5);

if (chunkSize > 0) {
    console.log('Target evolution (session divided in 5 parts):');
    for (let i = 0; i < 5; i++) {
        const start = i * chunkSize;
        const end = i === 4 ? wins.length : (i + 1) * chunkSize;
        const chunk = wins.slice(start, end);

        if (chunk.length > 0) {
            const avg = chunk.reduce((s, g) => s + g.cashedAt, 0) / chunk.length;
            const min = Math.min(...chunk.map(g => g.cashedAt));
            const max = Math.max(...chunk.map(g => g.cashedAt));
            console.log(`  Part ${i + 1}/5: ${avg.toFixed(2)}x avg (${min.toFixed(2)}-${max.toFixed(2)}x range) [${chunk.length} wins]`);
        }
    }
    console.log('');
}

// ═══════════════════════════════════════════════════════════════════════════
// ANALYSIS 4: Pattern After Specific Bust Values
// ═══════════════════════════════════════════════════════════════════════════
console.log('─'.repeat(80));
console.log('ANALYSIS 4: TARGET AFTER SPECIFIC BUST EVENTS');
console.log('─'.repeat(80));
console.log('');

const targetAfterBustType = {
    'instant_bust': [], // After bust < 1.5x
    'low_bust': [],     // After bust 1.5-3x
    'medium_bust': [],  // After bust 3-10x
    'high_bust': []     // After bust > 10x
};

for (let i = 1; i < playerGames.length; i++) {
    const prevGame = playerGames[i - 1];
    const game = playerGames[i];

    if (game.cashedAt !== null) {
        const target = game.cashedAt;
        const prevBust = prevGame.bust;

        if (prevBust < 1.5) {
            targetAfterBustType['instant_bust'].push(target);
        } else if (prevBust < 3) {
            targetAfterBustType['low_bust'].push(target);
        } else if (prevBust < 10) {
            targetAfterBustType['medium_bust'].push(target);
        } else {
            targetAfterBustType['high_bust'].push(target);
        }
    }
}

console.log('Target selection after previous game bust:');
for (const [type, targets] of Object.entries(targetAfterBustType)) {
    if (targets.length > 0) {
        const avg = targets.reduce((s, t) => s + t, 0) / targets.length;
        console.log(`  ${type.padEnd(15)}: ${avg.toFixed(2)}x avg [${targets.length} samples]`);
    }
}
console.log('');

// ═══════════════════════════════════════════════════════════════════════════
// ANALYSIS 5: Delay-Based Pattern (Games Since Last Win)
// ═══════════════════════════════════════════════════════════════════════════
console.log('─'.repeat(80));
console.log('ANALYSIS 5: DELAY SINCE LAST WIN');
console.log('─'.repeat(80));
console.log('');

const targetByDelay = {};
let gamesSinceWin = 0;

for (let i = 0; i < playerGames.length; i++) {
    const game = playerGames[i];

    if (game.cashedAt !== null) {
        // This is a win, record the target and delay
        const target = game.cashedAt;
        const delayBucket = Math.floor(gamesSinceWin / 10) * 10; // Group by 10s
        const key = `${delayBucket}-${delayBucket + 9}`;

        if (!targetByDelay[key]) {
            targetByDelay[key] = [];
        }
        targetByDelay[key].push(target);

        gamesSinceWin = 0;
    } else {
        gamesSinceWin++;
    }
}

console.log('Target by games since last win:');
Object.keys(targetByDelay)
    .sort((a, b) => parseInt(a) - parseInt(b))
    .forEach(delay => {
        const targets = targetByDelay[delay];
        const avg = targets.reduce((s, t) => s + t, 0) / targets.length;
        console.log(`  ${delay.padEnd(8)} games: ${avg.toFixed(2)}x avg [${targets.length} samples]`);
    });
console.log('');

// ═══════════════════════════════════════════════════════════════════════════
// ANALYSIS 6: Statistical Significance Testing
// ═══════════════════════════════════════════════════════════════════════════
console.log('─'.repeat(80));
console.log('CONCLUSION: PATTERN DETECTION');
console.log('─'.repeat(80));
console.log('');

// Calculate variance between different contexts
const allTargets = wins.map(g => g.cashedAt);
const overallAvg = allTargets.reduce((s, t) => s + t, 0) / allTargets.length;

console.log(`Overall average target: ${overallAvg.toFixed(2)}x`);
console.log('');

// Check if there's significant variation
let hasPattern = false;
const variations = [];

// Check loss streak variation
for (const targets of Object.values(targetAfterLosses)) {
    if (targets.length > 5) {
        const avg = targets.reduce((s, t) => s + t, 0) / targets.length;
        const diff = Math.abs(avg - overallAvg);
        variations.push(diff);
        if (diff > 2.0) {
            hasPattern = true;
            console.log(`⚠️  PATTERN DETECTED: Significant variation (${diff.toFixed(2)}x) in target based on loss streak`);
        }
    }
}

// Check recent bust variation
for (const targets of Object.values(targetByRecentBust)) {
    if (targets.length > 5) {
        const avg = targets.reduce((s, t) => s + t, 0) / targets.length;
        const diff = Math.abs(avg - overallAvg);
        variations.push(diff);
        if (diff > 2.0) {
            hasPattern = true;
            console.log(`⚠️  PATTERN DETECTED: Significant variation (${diff.toFixed(2)}x) in target based on recent busts`);
        }
    }
}

if (!hasPattern) {
    console.log('✓ NO SIGNIFICANT PATTERN: Targets appear to be random/fixed');
    console.log(`  All variations < 2.0x from overall average`);
} else {
    console.log('');
    console.log('✓ ADAPTIVE STRATEGY DETECTED!');
    console.log('  The player adjusts targets based on game context');
}

console.log('');
console.log('═'.repeat(80));
