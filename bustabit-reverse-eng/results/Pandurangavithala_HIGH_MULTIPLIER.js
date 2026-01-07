// High Multiplier Hunter Strategy
// Reverse-engineered from player: Pandurangavithala
// Data source: 1000 games scraped (925 games played, 85 wins)
//
// STRATEGY ANALYSIS:
// - Fixed bet amount: 14897 bits (no martingale, no progression)
// - Win rate: 9.2% (very low)
// - Average cashout: 13.63x
// - Cashout range: Mostly 12-16x (60% of wins)
//   * 14-16x: 33% (most common)
//   * 12-14x: 21%
//   * 16-18x: 17%
// - Target distribution:
//   * 15x: 21.2%
//   * 14x: 17.6%
//   * 13x: 10.6%
// - Standard deviation: 4.35x (variable targets)
// - Not timing-based (only 17.6% cashout close to bust)
//
// HYPOTHESIS:
// - Random target selection weighted towards 12-16x
// - Preference for integer/half-integer values (13x, 14x, 15x, etc.)
// - Occasional outliers (2x, 4x, 20x+)
//
// REAL PERFORMANCE (from 925 games):
// - ROI: Unknown (need starting/ending balance)
// - Longest loss streak: High (win rate 9.2% = avg 10.9 games between wins)
// - Requires large bankroll (149 bits × 50+ games = 7,500+ bits minimum)

const CONFIG = {
    // Bet settings
    baseBet: 14897,              // 14897 bits (fixed)

    // Cashout strategy - weighted random
    targetWeights: [
        // [min, max, weight]
        [10, 12, 5],   // 5% - Low targets (rare)
        [12, 14, 21],  // 21% - 12-14x range
        [14, 16, 33],  // 33% - 14-16x range (most common)
        [16, 18, 17],  // 17% - 16-18x range
        [18, 20, 5],   // 5% - High targets
        [20, 24, 3],   // 3% - Very high targets (rare)
        [2, 6, 7],     // 7% - Emergency low targets (outliers)
        [6, 10, 9]     // 9% - Mid-low targets
    ],

    // Bankroll management
    minBalance: 750000,          // Stop if balance < 7500 bits (50x base bet)

    // Display settings
    verbose: false,              // Set to true for detailed logs
    statsEvery: 50               // Show stats every N games
};

// State
let totalGames = 0;
let totalWins = 0;
let totalLosses = 0;
let currentStreak = 0;
let longestLossStreak = 0;
let sessionProfit = 0;
let sessionBetTotal = 0;

// Weighted random selection
function getWeightedRandomCashout() {
    const totalWeight = CONFIG.targetWeights.reduce((sum, [, , weight]) => sum + weight, 0);
    let random = Math.random() * totalWeight;

    for (const [min, max, weight] of CONFIG.targetWeights) {
        random -= weight;
        if (random <= 0) {
            // Return random value in this range
            return min + Math.random() * (max - min);
        }
    }

    // Fallback
    return 14.0;
}

// Main game logic
game.on('game_starting', function(info) {
    totalGames++;

    // Check minimum balance
    if (game.balance < CONFIG.minBalance) {
        console.log(`[STOP] Balance too low: ${(game.balance / 100).toFixed(0)} bits`);
        return;
    }

    // Place bet with weighted random target
    const betAmount = CONFIG.baseBet;
    const targetPayout = getWeightedRandomCashout();

    game.bet(betAmount, targetPayout);
    sessionBetTotal += betAmount;

    if (CONFIG.verbose) {
        console.log(`[BET] ${(betAmount / 100).toFixed(0)} bits @ ${targetPayout.toFixed(2)}x | Balance: ${(game.balance / 100).toFixed(0)} bits`);
    }
});

game.on('game_crash', function(data) {
    const crashPoint = data.game_crash / 100;
    const bet = game.bet_amount;
    const won = game.cashed_out;

    if (won) {
        totalWins++;
        currentStreak = 0;
        const profit = (game.cash_out - bet);
        sessionProfit += profit;

        if (CONFIG.verbose) {
            console.log(`[WIN] Cashed @ ${(game.payout / 100).toFixed(2)}x | Profit: +${(profit / 100).toFixed(0)} bits | Session: ${sessionProfit >= 0 ? '+' : ''}${(sessionProfit / 100).toFixed(0)} bits`);
        }
    } else {
        totalLosses++;
        currentStreak++;
        longestLossStreak = Math.max(longestLossStreak, currentStreak);
        sessionProfit -= bet;

        if (CONFIG.verbose) {
            console.log(`[LOSS] Bust @ ${crashPoint.toFixed(2)}x | Loss: -${(bet / 100).toFixed(0)} bits | Streak: ${currentStreak} | Session: ${sessionProfit >= 0 ? '+' : ''}${(sessionProfit / 100).toFixed(0)} bits`);
        }
    }

    // Log stats periodically
    if (totalGames % CONFIG.statsEvery === 0) {
        const winRate = ((totalWins / totalGames) * 100).toFixed(1);
        const roi = ((sessionProfit / sessionBetTotal) * 100).toFixed(2);

        console.log('═'.repeat(80));
        console.log(`STATS @ ${totalGames} games`);
        console.log(`  Win Rate: ${winRate}% (${totalWins}W / ${totalLosses}L)`);
        console.log(`  Session Profit: ${sessionProfit >= 0 ? '+' : ''}${(sessionProfit / 100).toFixed(0)} bits`);
        console.log(`  ROI: ${roi}%`);
        console.log(`  Longest Loss Streak: ${longestLossStreak}`);
        console.log(`  Current Streak: ${currentStreak} losses`);
        console.log(`  Balance: ${(game.balance / 100).toFixed(0)} bits`);
        console.log('═'.repeat(80));
    }
});

// Initial log
console.log('═'.repeat(80));
console.log('HIGH MULTIPLIER HUNTER - Pandurangavithala Strategy');
console.log('═'.repeat(80));
console.log('Strategy: Fixed bet, weighted random targets 12-16x');
console.log(`Base Bet: ${(CONFIG.baseBet / 100).toFixed(0)} bits`);
console.log(`Target Range: 10-20x (weighted towards 12-16x)`);
console.log(`Expected Win Rate: ~9-10%`);
console.log(`Starting Balance: ${(game.balance / 100).toFixed(0)} bits`);
console.log('═'.repeat(80));
