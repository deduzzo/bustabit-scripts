#!/usr/bin/env node
// Reverse Engineering Player Strategy
// Analizza il pattern di betting di un giocatore specifico

const fs = require('fs');
const path = require('path');

const INPUT_FILE = '../bustabit-real-data/1767736136173_all_200games.json';
const TARGET_PLAYER = 'Pandurangavithala';

// Load data
const rawData = fs.readFileSync(path.join(__dirname, INPUT_FILE), 'utf8');
const data = JSON.parse(rawData);

console.log('═'.repeat(80));
console.log(`ANALYZING PLAYER STRATEGY: ${TARGET_PLAYER}`);
console.log('═'.repeat(80));
console.log('');

// Extract player bets in sequential order
const playerBets = [];
for (const game of data.games) {
    const playerData = game.players.find(p => p.player === TARGET_PLAYER);
    if (playerData) {
        playerBets.push({
            gameId: game.gameId,
            bust: game.bust,
            bet: playerData.bet,
            cashedAt: playerData.cashedAt,
            profit: playerData.profit,
            won: playerData.won
        });
    }
}

// Sort by gameId (ascending - chronological order)
playerBets.sort((a, b) => a.gameId - b.gameId);

console.log(`Total games found: ${data.games.length}`);
console.log(`${TARGET_PLAYER} played in: ${playerBets.length} games`);
console.log(`Participation rate: ${(playerBets.length / data.games.length * 100).toFixed(1)}%`);
console.log('');

if (playerBets.length === 0) {
    console.log('No bets found for this player!');
    process.exit(0);
}

// ANALYSIS 1: Bet Amounts Pattern
console.log('─'.repeat(80));
console.log('ANALYSIS 1: BET AMOUNTS PATTERN');
console.log('─'.repeat(80));

const betAmounts = playerBets.map(b => b.bet);
const uniqueBets = [...new Set(betAmounts)].sort((a, b) => a - b);

console.log('Unique bet amounts:', uniqueBets.map(b => `${(b/100).toFixed(0)} bits`).join(', '));
console.log('Min bet:', (Math.min(...betAmounts)/100).toFixed(0), 'bits');
console.log('Max bet:', (Math.max(...betAmounts)/100).toFixed(0), 'bits');
console.log('Average bet:', (betAmounts.reduce((s, b) => s + b, 0) / betAmounts.length / 100).toFixed(0), 'bits');
console.log('');

// ANALYSIS 2: Cashout Strategy
console.log('─'.repeat(80));
console.log('ANALYSIS 2: CASHOUT STRATEGY');
console.log('─'.repeat(80));

const cashouts = playerBets.filter(b => b.cashedAt !== null).map(b => b.cashedAt);
if (cashouts.length > 0) {
    console.log('Cashout count:', cashouts.length, '/', playerBets.length);
    console.log('Cashout rate:', (cashouts.length / playerBets.length * 100).toFixed(1) + '%');
    console.log('Min cashout:', Math.min(...cashouts).toFixed(2) + 'x');
    console.log('Max cashout:', Math.max(...cashouts).toFixed(2) + 'x');
    console.log('Average cashout:', (cashouts.reduce((s, c) => s + c, 0) / cashouts.length).toFixed(2) + 'x');

    // Cashout distribution
    const cashoutRanges = {
        '1.0-1.5x': cashouts.filter(c => c >= 1.0 && c < 1.5).length,
        '1.5-2.0x': cashouts.filter(c => c >= 1.5 && c < 2.0).length,
        '2.0-3.0x': cashouts.filter(c => c >= 2.0 && c < 3.0).length,
        '3.0-5.0x': cashouts.filter(c => c >= 3.0 && c < 5.0).length,
        '5.0-10.0x': cashouts.filter(c => c >= 5.0 && c < 10.0).length,
        '10.0+x': cashouts.filter(c => c >= 10.0).length,
    };
    console.log('\nCashout distribution:');
    for (const [range, count] of Object.entries(cashoutRanges)) {
        if (count > 0) {
            console.log(`  ${range}: ${count} (${(count/cashouts.length*100).toFixed(1)}%)`);
        }
    }
} else {
    console.log('No cashouts - player always busts!');
}
console.log('');

// ANALYSIS 3: Win/Loss Pattern
console.log('─'.repeat(80));
console.log('ANALYSIS 3: WIN/LOSS PATTERN');
console.log('─'.repeat(80));

const wins = playerBets.filter(b => b.won).length;
const losses = playerBets.length - wins;
const winRate = (wins / playerBets.length * 100).toFixed(1);

console.log('Wins:', wins);
console.log('Losses:', losses);
console.log('Win rate:', winRate + '%');
console.log('');

// Consecutive streaks
let currentStreak = 0;
let longestWinStreak = 0;
let longestLossStreak = 0;
let streakType = null;

for (const bet of playerBets) {
    if (streakType === null) {
        streakType = bet.won ? 'win' : 'loss';
        currentStreak = 1;
    } else if ((bet.won && streakType === 'win') || (!bet.won && streakType === 'loss')) {
        currentStreak++;
    } else {
        if (streakType === 'win') {
            longestWinStreak = Math.max(longestWinStreak, currentStreak);
        } else {
            longestLossStreak = Math.max(longestLossStreak, currentStreak);
        }
        streakType = bet.won ? 'win' : 'loss';
        currentStreak = 1;
    }
}

console.log('Longest win streak:', longestWinStreak);
console.log('Longest loss streak:', longestLossStreak);
console.log('');

// ANALYSIS 4: Martingale Detection
console.log('─'.repeat(80));
console.log('ANALYSIS 4: BETTING PROGRESSION PATTERN');
console.log('─'.repeat(80));

// Check if bet doubles after losses
const progressions = [];
for (let i = 1; i < playerBets.length; i++) {
    const prev = playerBets[i - 1];
    const curr = playerBets[i];

    const ratio = curr.bet / prev.bet;
    const change = curr.bet - prev.bet;

    progressions.push({
        gameId: curr.gameId,
        prevBet: prev.bet,
        currBet: curr.bet,
        ratio: ratio,
        change: change,
        afterWin: prev.won,
        afterLoss: !prev.won
    });
}

// After loss progression
const afterLoss = progressions.filter(p => p.afterLoss);
if (afterLoss.length > 0) {
    const avgRatioAfterLoss = afterLoss.reduce((s, p) => s + p.ratio, 0) / afterLoss.length;
    console.log('After LOSS:');
    console.log(`  Average bet ratio: ${avgRatioAfterLoss.toFixed(2)}x`);
    console.log(`  Doubles (2x): ${afterLoss.filter(p => Math.abs(p.ratio - 2.0) < 0.1).length}`);
    console.log(`  Increases: ${afterLoss.filter(p => p.ratio > 1.1).length}`);
    console.log(`  Decreases: ${afterLoss.filter(p => p.ratio < 0.9).length}`);
    console.log(`  Stays same: ${afterLoss.filter(p => Math.abs(p.ratio - 1.0) < 0.1).length}`);
}

// After win progression
const afterWin = progressions.filter(p => p.afterWin);
if (afterWin.length > 0) {
    const avgRatioAfterWin = afterWin.reduce((s, p) => s + p.ratio, 0) / afterWin.length;
    console.log('\nAfter WIN:');
    console.log(`  Average bet ratio: ${avgRatioAfterWin.toFixed(2)}x`);
    console.log(`  Doubles (2x): ${afterWin.filter(p => Math.abs(p.ratio - 2.0) < 0.1).length}`);
    console.log(`  Increases: ${afterWin.filter(p => p.ratio > 1.1).length}`);
    console.log(`  Decreases: ${afterWin.filter(p => p.ratio < 0.9).length}`);
    console.log(`  Stays same: ${afterWin.filter(p => Math.abs(p.ratio - 1.0) < 0.1).length}`);
}
console.log('');

// ANALYSIS 5: Detailed Sequence (first 20 bets)
console.log('─'.repeat(80));
console.log('ANALYSIS 5: FIRST 20 BETS SEQUENCE');
console.log('─'.repeat(80));
console.log('Game ID | Bet (bits) | Bust    | Cashout | Profit  | Result');
console.log('─'.repeat(80));

for (let i = 0; i < Math.min(20, playerBets.length); i++) {
    const bet = playerBets[i];
    const betBits = (bet.bet / 100).toFixed(0).padStart(10, ' ');
    const bust = bet.bust.toFixed(2).padStart(7, ' ');
    const cashout = bet.cashedAt ? bet.cashedAt.toFixed(2).padStart(7, ' ') : '   BUST';
    const profit = (bet.profit / 100).toFixed(0).padStart(7, ' ');
    const result = bet.won ? '  WIN' : ' LOSS';

    console.log(`${bet.gameId} | ${betBits} | ${bust}x | ${cashout} | ${profit} | ${result}`);
}
console.log('');

// ANALYSIS 6: Profit/Loss
console.log('─'.repeat(80));
console.log('ANALYSIS 6: PROFIT/LOSS ANALYSIS');
console.log('─'.repeat(80));

const totalProfit = playerBets.reduce((s, b) => s + b.profit, 0);
const totalBet = playerBets.reduce((s, b) => s + b.bet, 0);
const roi = (totalProfit / totalBet) * 100;

console.log('Total bet:', (totalBet / 100).toFixed(0), 'bits');
console.log('Total profit:', (totalProfit >= 0 ? '+' : '') + (totalProfit / 100).toFixed(0), 'bits');
console.log('ROI:', roi.toFixed(2) + '%');
console.log('');

console.log('═'.repeat(80));
console.log('HYPOTHESIS:');
console.log('═'.repeat(80));

// Determine strategy type
const martingaleIndicator = afterLoss.length > 0 && afterLoss.filter(p => Math.abs(p.ratio - 2.0) < 0.1).length > afterLoss.length * 0.5;
const fixedBetIndicator = uniqueBets.length === 1;
const progressiveIndicator = uniqueBets.length > 2 && !martingaleIndicator;

if (fixedBetIndicator) {
    console.log('STRATEGY TYPE: Fixed Bet (Flat Betting)');
    console.log(`  - Always bets ${(uniqueBets[0]/100).toFixed(0)} bits`);
} else if (martingaleIndicator) {
    console.log('STRATEGY TYPE: Martingale / Progressive Doubling');
    console.log('  - Doubles bet after losses');
    console.log('  - Resets bet after wins');
} else if (progressiveIndicator) {
    console.log('STRATEGY TYPE: Custom Progressive System');
    console.log('  - Variable bet amounts based on custom logic');
} else {
    console.log('STRATEGY TYPE: Mixed / Complex Strategy');
}

console.log('');
console.log('═'.repeat(80));
