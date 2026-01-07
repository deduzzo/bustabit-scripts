// High Multiplier Hunter Strategy
// Reverse-engineered from player: Pandurangavithala
//
// STRATEGY:
// - Fixed bet amount (no martingale, no progression)
// - Target high multipliers (10x+)
// - Low win rate (~10%) but high profit when winning
// - Requires bankroll to survive long loss streaks (55+ games)
//
// STATS FROM REAL DATA (169 games):
// - Win Rate: 9.5%
// - ROI: +7.79%
// - Avg Cashout: 11.39x
// - Longest Loss Streak: 55 games
// - Fixed Bet: 149 bits

const CONFIG = {
    // Bet settings
    baseBet: 14900,              // 149 bits (in satoshi: 149 * 100)

    // Cashout strategy
    targetMultiplier: 10.0,      // Target 10x multiplier
    minCashout: 10.0,            // Minimum cashout multiplier
    maxCashout: 20.0,            // Maximum cashout multiplier (randomize within range)

    // Bankroll management
    minBalance: 50000,           // Stop if balance < 500 bits (50000 satoshi)

    // Display settings
    verbose: false               // Set to true for detailed logs
};

// State
let totalGames = 0;
let totalWins = 0;
let totalLosses = 0;
let currentStreak = 0;
let longestLossStreak = 0;
let sessionProfit = 0;

// Random cashout within range
function getRandomCashout() {
    const min = CONFIG.minCashout;
    const max = CONFIG.maxCashout;
    return min + Math.random() * (max - min);
}

// Main game logic
game.on('game_starting', function(info) {
    totalGames++;

    // Check minimum balance
    if (game.balance < CONFIG.minBalance) {
        console.log(`[STOP] Balance too low: ${(game.balance / 100).toFixed(0)} bits`);
        return;
    }

    // Place bet
    const betAmount = CONFIG.baseBet;
    const targetPayout = getRandomCashout();

    game.bet(betAmount, targetPayout);

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

    // Log stats every 50 games
    if (totalGames % 50 === 0) {
        const winRate = ((totalWins / totalGames) * 100).toFixed(1);
        const roi = ((sessionProfit / (CONFIG.baseBet * totalGames)) * 100).toFixed(2);

        console.log('═'.repeat(80));
        console.log(`STATS @ ${totalGames} games`);
        console.log(`  Win Rate: ${winRate}% (${totalWins}W / ${totalLosses}L)`);
        console.log(`  Session Profit: ${sessionProfit >= 0 ? '+' : ''}${(sessionProfit / 100).toFixed(0)} bits`);
        console.log(`  ROI: ${roi}%`);
        console.log(`  Longest Loss Streak: ${longestLossStreak}`);
        console.log(`  Balance: ${(game.balance / 100).toFixed(0)} bits`);
        console.log('═'.repeat(80));
    }
});

// Initial log
console.log('═'.repeat(80));
console.log('HIGH MULTIPLIER HUNTER - Strategy Started');
console.log('═'.repeat(80));
console.log('Strategy: Fixed bet, target 10x+ multipliers');
console.log(`Base Bet: ${(CONFIG.baseBet / 100).toFixed(0)} bits`);
console.log(`Target Range: ${CONFIG.minCashout.toFixed(1)}x - ${CONFIG.maxCashout.toFixed(1)}x`);
console.log(`Starting Balance: ${(game.balance / 100).toFixed(0)} bits`);
console.log('═'.repeat(80));
