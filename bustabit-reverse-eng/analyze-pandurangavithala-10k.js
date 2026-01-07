#!/usr/bin/env node
// Analisi completa algoritmo Pandurangavithala su 10,000 partite

const fs = require('fs');
const path = require('path');

const INPUT_FILE = '../bustabit-real-data/1767741909781_Pandurangavithala_10000games.json';

// Load data
const data = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));
const games = data.games.slice().reverse(); // Reverse per ordine cronologico

console.log('═'.repeat(80));
console.log(`ANALISI COMPLETA: ${data.filter} (${games.length} partite)`);
console.log('═'.repeat(80));
console.log('');

// ═══════════════════════════════════════════════════════════════════════════
// BASIC STATS
// ═══════════════════════════════════════════════════════════════════════════
console.log('─'.repeat(80));
console.log('1. STATISTICHE GENERALI');
console.log('─'.repeat(80));

const wins = games.filter(g => g.won);
const losses = games.filter(g => !g.won);
const winRate = (wins.length / games.length * 100).toFixed(2);

console.log(`Total Games: ${games.length}`);
console.log(`Wins: ${wins.length} (${winRate}%)`);
console.log(`Losses: ${losses.length} (${(100 - winRate).toFixed(2)}%)`);
console.log('');

// ═══════════════════════════════════════════════════════════════════════════
// CASHOUT DISTRIBUTION
// ═══════════════════════════════════════════════════════════════════════════
console.log('─'.repeat(80));
console.log('2. DISTRIBUZIONE CASHOUT');
console.log('─'.repeat(80));

const cashouts = wins.map(g => g.cashedAt).sort((a, b) => a - b);
const min = Math.min(...cashouts);
const max = Math.max(...cashouts);
const avg = cashouts.reduce((s, c) => s + c, 0) / cashouts.length;
const median = cashouts[Math.floor(cashouts.length / 2)];

// Calculate standard deviation
const variance = cashouts.reduce((s, c) => s + Math.pow(c - avg, 2), 0) / cashouts.length;
const stdDev = Math.sqrt(variance);

console.log(`Cashout Range: ${min.toFixed(2)}x - ${max.toFixed(2)}x`);
console.log(`Average: ${avg.toFixed(2)}x`);
console.log(`Median: ${median.toFixed(2)}x`);
console.log(`Std Dev: ${stdDev.toFixed(2)}x`);
console.log('');

// Distribution by ranges
const ranges = [
    { label: '0-5x', min: 0, max: 5 },
    { label: '5-10x', min: 5, max: 10 },
    { label: '10-12x', min: 10, max: 12 },
    { label: '12-14x', min: 12, max: 14 },
    { label: '14-16x', min: 14, max: 16 },
    { label: '16-18x', min: 16, max: 18 },
    { label: '18-20x', min: 18, max: 20 },
    { label: '20x+', min: 20, max: 1000 }
];

console.log('Distribuzione per range:');
ranges.forEach(r => {
    const count = cashouts.filter(c => c >= r.min && c < r.max).length;
    const pct = (count / cashouts.length * 100).toFixed(1);
    const bar = '█'.repeat(Math.floor(pct / 2));
    console.log(`  ${r.label.padEnd(10)}: ${count.toString().padStart(4)} (${pct.padStart(5)}%) ${bar}`);
});
console.log('');

// Most common cashout values
const cashoutCounts = {};
cashouts.forEach(c => {
    const rounded = Math.floor(c);
    cashoutCounts[rounded] = (cashoutCounts[rounded] || 0) + 1;
});

const topCashouts = Object.entries(cashoutCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

console.log('Top 10 cashout values:');
topCashouts.forEach(([value, count]) => {
    const pct = (count / cashouts.length * 100).toFixed(1);
    console.log(`  ${value}x: ${count} volte (${pct}%)`);
});
console.log('');

// ═══════════════════════════════════════════════════════════════════════════
// CASHOUT vs BUST RELATIONSHIP
// ═══════════════════════════════════════════════════════════════════════════
console.log('─'.repeat(80));
console.log('3. RELAZIONE CASHOUT vs BUST (Timing-based?)');
console.log('─'.repeat(80));

// Check if cashout is close to bust (timing strategy)
let nearBust = 0;
let farFromBust = 0;

wins.forEach(g => {
    const ratio = g.cashedAt / g.bust;
    if (ratio > 0.9) {
        nearBust++; // Cashed out very close to bust
    } else {
        farFromBust++;
    }
});

const nearBustPct = (nearBust / wins.length * 100).toFixed(1);
console.log(`Cashout vicino al bust (>90%): ${nearBust} (${nearBustPct}%)`);
console.log(`Cashout lontano dal bust: ${farFromBust} (${(100 - nearBustPct).toFixed(1)}%)`);

if (nearBustPct < 25) {
    console.log('');
    console.log('✓ NON è timing-based! Usa target predeterminati.');
} else {
    console.log('');
    console.log('⚠️  Potrebbe essere timing-based!');
}
console.log('');

// ═══════════════════════════════════════════════════════════════════════════
// LOSS STREAK ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════
console.log('─'.repeat(80));
console.log('4. ANALISI LOSS STREAKS');
console.log('─'.repeat(80));

const lossStreaks = [];
let currentStreak = 0;

games.forEach((g, i) => {
    if (!g.won) {
        currentStreak++;
    } else {
        if (currentStreak > 0) {
            lossStreaks.push(currentStreak);
        }
        currentStreak = 0;
    }
});

if (lossStreaks.length > 0) {
    const maxStreak = Math.max(...lossStreaks);
    const avgStreak = lossStreaks.reduce((s, l) => s + l, 0) / lossStreaks.length;

    console.log(`Max loss streak: ${maxStreak} perdite consecutive`);
    console.log(`Avg loss streak: ${avgStreak.toFixed(1)} perdite`);
    console.log(`Total loss streaks: ${lossStreaks.length}`);
    console.log('');
}

// ═══════════════════════════════════════════════════════════════════════════
// CASHOUT AFTER LOSS STREAKS
// ═══════════════════════════════════════════════════════════════════════════
console.log('─'.repeat(80));
console.log('5. CASHOUT DOPO LOSS STREAKS');
console.log('─'.repeat(80));

const cashoutAfterStreak = {
    '0-5': [],
    '6-10': [],
    '11-20': [],
    '21-50': [],
    '51+': []
};

let lossCount = 0;
games.forEach((g, i) => {
    if (g.won) {
        const cashout = g.cashedAt;

        if (lossCount <= 5) {
            cashoutAfterStreak['0-5'].push(cashout);
        } else if (lossCount <= 10) {
            cashoutAfterStreak['6-10'].push(cashout);
        } else if (lossCount <= 20) {
            cashoutAfterStreak['11-20'].push(cashout);
        } else if (lossCount <= 50) {
            cashoutAfterStreak['21-50'].push(cashout);
        } else {
            cashoutAfterStreak['51+'].push(cashout);
        }

        lossCount = 0;
    } else {
        lossCount++;
    }
});

console.log('Cashout medio dopo N perdite consecutive:');
for (const [range, cashouts] of Object.entries(cashoutAfterStreak)) {
    if (cashouts.length > 0) {
        const avg = cashouts.reduce((s, c) => s + c, 0) / cashouts.length;
        const min = Math.min(...cashouts);
        const max = Math.max(...cashouts);
        console.log(`  ${range.padEnd(8)} losses: ${avg.toFixed(2)}x avg (${min.toFixed(2)}-${max.toFixed(2)}x) [${cashouts.length} samples]`);
    }
}
console.log('');

// Check for pattern
const avgOverall = cashouts.reduce((s, c) => s + c, 0) / cashouts.length;
let hasStreakPattern = false;
for (const [range, vals] of Object.entries(cashoutAfterStreak)) {
    if (vals.length > 10) {
        const avg = vals.reduce((s, c) => s + c, 0) / vals.length;
        const diff = Math.abs(avg - avgOverall);
        if (diff > 2.0) {
            hasStreakPattern = true;
            console.log(`⚠️  PATTERN DETECTED: ${range} losses → target ${avg.toFixed(2)}x (diff: ${diff.toFixed(2)}x)`);
        }
    }
}

if (!hasStreakPattern) {
    console.log('✓ Nessun pattern significativo basato su loss streaks');
}
console.log('');

// ═══════════════════════════════════════════════════════════════════════════
// RECENT BUST ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════
console.log('─'.repeat(80));
console.log('6. ANALISI BUST RECENTI (ultimi 5 games)');
console.log('─'.repeat(80));

const cashoutByRecentBust = {
    'low': [],    // Recent avg bust < 3x
    'medium': [], // Recent avg bust 3-10x
    'high': []    // Recent avg bust > 10x
};

for (let i = 5; i < games.length; i++) {
    const game = games[i];

    if (game.won) {
        // Calculate average bust of previous 5 games
        const recentBusts = [];
        for (let j = i - 5; j < i; j++) {
            recentBusts.push(games[j].bust);
        }
        const avgRecentBust = recentBusts.reduce((s, b) => s + b, 0) / recentBusts.length;

        const cashout = game.cashedAt;

        if (avgRecentBust < 3) {
            cashoutByRecentBust['low'].push(cashout);
        } else if (avgRecentBust < 10) {
            cashoutByRecentBust['medium'].push(cashout);
        } else {
            cashoutByRecentBust['high'].push(cashout);
        }
    }
}

console.log('Cashout medio quando ultimi 5 busts erano:');
for (const [level, vals] of Object.entries(cashoutByRecentBust)) {
    if (vals.length > 0) {
        const avg = vals.reduce((s, c) => s + c, 0) / vals.length;
        console.log(`  ${level.padEnd(8)}: ${avg.toFixed(2)}x avg [${vals.length} samples]`);
    }
}

let hasBustPattern = false;
for (const [level, vals] of Object.entries(cashoutByRecentBust)) {
    if (vals.length > 10) {
        const avg = vals.reduce((s, c) => s + c, 0) / vals.length;
        const diff = Math.abs(avg - avgOverall);
        if (diff > 2.0) {
            hasBustPattern = true;
            console.log(`⚠️  PATTERN DETECTED: Recent busts ${level} → target ${avg.toFixed(2)}x (diff: ${diff.toFixed(2)}x)`);
        }
    }
}

if (!hasBustPattern) {
    console.log('');
    console.log('✓ Nessun pattern significativo basato su bust recenti');
}
console.log('');

// ═══════════════════════════════════════════════════════════════════════════
// DELAY ANALYSIS (Games since last win)
// ═══════════════════════════════════════════════════════════════════════════
console.log('─'.repeat(80));
console.log('7. ANALISI DELAY (Partite dall\'ultimo win)');
console.log('─'.repeat(80));

const cashoutByDelay = {};
let gamesSinceWin = 0;

for (let i = 0; i < games.length; i++) {
    const game = games[i];

    if (game.won) {
        const delayBucket = Math.floor(gamesSinceWin / 10) * 10;
        const key = `${delayBucket}-${delayBucket + 9}`;

        if (!cashoutByDelay[key]) {
            cashoutByDelay[key] = [];
        }
        cashoutByDelay[key].push(game.cashedAt);

        gamesSinceWin = 0;
    } else {
        gamesSinceWin++;
    }
}

console.log('Cashout medio per delay dall\'ultimo win:');
Object.keys(cashoutByDelay)
    .sort((a, b) => parseInt(a) - parseInt(b))
    .forEach(delay => {
        const vals = cashoutByDelay[delay];
        const avg = vals.reduce((s, c) => s + c, 0) / vals.length;
        console.log(`  ${delay.padEnd(8)} games: ${avg.toFixed(2)}x avg [${vals.length} samples]`);
    });
console.log('');

// ═══════════════════════════════════════════════════════════════════════════
// CONCLUSION
// ═══════════════════════════════════════════════════════════════════════════
console.log('─'.repeat(80));
console.log('8. CONCLUSIONI');
console.log('─'.repeat(80));
console.log('');

console.log('ALGORITMO IDENTIFICATO:');
if (!hasStreakPattern && !hasBustPattern && nearBustPct < 25) {
    console.log('✓ Weighted Random Target Hunter');
    console.log('  - Target predeterminati (NON timing-based)');
    console.log('  - Range preferito: 12-16x');
    console.log('  - NON adattivo (non reagisce a loss streaks o bust recenti)');
    console.log('  - Strategia semplice: punta alto e spera');
} else {
    console.log('⚠️  Adaptive Strategy Detected');
    console.log('  - Reagisce al contesto (loss streaks, bust recenti, delay)');
    console.log('  - Target dinamici basati su condizioni');
}

console.log('');
console.log('═'.repeat(80));
