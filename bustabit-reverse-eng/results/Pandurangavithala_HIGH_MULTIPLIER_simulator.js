/**
 * ═══════════════════════════════════════════════════════════════════════════
 * HIGH MULTIPLIER HUNTER - Pandurangavithala Strategy (SIMULATOR VERSION)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Reverse-engineered from player: Pandurangavithala
 * Data source: 1000 games scraped (925 games played, 85 wins)
 *
 * STRATEGY:
 * - Fixed bet: 14897 bits per game
 * - Win rate: 9.2% (very low, high risk)
 * - Average cashout: 13.63x
 * - Cashout distribution:
 *   * 14-16x: 33% (most common)
 *   * 12-14x: 21%
 *   * 16-18x: 17%
 * - Weighted random target selection (not timing-based)
 *
 * REAL PERFORMANCE (925 games):
 * - Win rate: 9.2%
 * - ROI: Unknown (need full session data)
 * - Requires large bankroll (50+ losses possible)
 */

var config = {
    // Capitale
    workingBalance: {
        value: 10000000,  // 100,000 bits (in centesimi)
        type: 'balance',
        label: 'Capitale (in centesimi)'
    },

    // Bet fisso
    baseBet: {
        value: 14897,  // 14897 bits fixed
        type: 'multiplier',
        label: 'Bet fisso (bits)'
    },

    // Stats
    statsEvery: {
        value: 50,
        type: 'multiplier',
        label: 'Show stats every N games'
    }
};

// Extract config values
const workingBalance = config.workingBalance.value;
const baseBet = config.baseBet.value * 100; // Convert to satoshi
const statsEvery = config.statsEvery.value;

// State
let totalGames = 0;
let totalWins = 0;
let totalLosses = 0;
let currentLossStreak = 0;
let longestLossStreak = 0;
let sessionProfit = 0;
let sessionBetTotal = 0;
let initialBalance = 0;

// Weighted random cashout target
// Based on real data distribution
const targetWeights = [
    // [min, max, weight %]
    [2, 6, 7],     // 7% - Emergency low targets (outliers)
    [6, 10, 9],    // 9% - Mid-low targets
    [10, 12, 5],   // 5% - Low targets
    [12, 14, 21],  // 21% - Common range
    [14, 16, 33],  // 33% - MOST COMMON (peak)
    [16, 18, 17],  // 17% - Upper common
    [18, 20, 5],   // 5% - High targets
    [20, 24, 3]    // 3% - Very high targets (rare)
];

function getWeightedRandomCashout() {
    const totalWeight = targetWeights.reduce((sum, [, , weight]) => sum + weight, 0);
    let random = Math.random() * totalWeight;

    for (const [min, max, weight] of targetWeights) {
        random -= weight;
        if (random <= 0) {
            // Return random value in this range
            return min + Math.random() * (max - min);
        }
    }

    // Fallback
    return 14.0;
}

// Initialize
engine.on('GAME_STARTING', function() {
    if (initialBalance === 0) {
        initialBalance = userInfo.balance;
        log('═'.repeat(80));
        log('HIGH MULTIPLIER HUNTER - Pandurangavithala Strategy');
        log('═'.repeat(80));
        log(`Starting Balance: ${(initialBalance / 100).toFixed(0)} bits`);
        log(`Base Bet: ${(baseBet / 100).toFixed(0)} bits (fixed)`);
        log(`Target Range: 10-20x (weighted 12-16x)`);
        log(`Expected Win Rate: ~9-10%`);
        log('═'.repeat(80));
    }

    totalGames++;

    // Check minimum balance
    if (userInfo.balance < baseBet) {
        log(`[STOP] Balance too low: ${(userInfo.balance / 100).toFixed(0)} bits`);
        stop('Insufficient balance');
        return;
    }

    // Place bet with weighted random target
    const targetPayout = getWeightedRandomCashout();

    engine.bet(baseBet, Math.floor(targetPayout * 100)); // Convert to x100 format
    sessionBetTotal += baseBet;
});

engine.on('GAME_ENDED', function(data) {
    const bust = data.bust / 100;
    const won = engine.lastBet && engine.lastBet.cashedAt;

    if (won) {
        totalWins++;
        currentLossStreak = 0;
        const profit = (engine.lastBet.wager * (engine.lastBet.cashedAt / 100)) - engine.lastBet.wager;
        sessionProfit += profit;
    } else if (engine.lastBet) {
        totalLosses++;
        currentLossStreak++;
        longestLossStreak = Math.max(longestLossStreak, currentLossStreak);
        sessionProfit -= baseBet;
    }

    // Periodic stats
    if (totalGames % statsEvery === 0) {
        const winRate = ((totalWins / totalGames) * 100).toFixed(1);
        const roi = sessionBetTotal > 0 ? ((sessionProfit / sessionBetTotal) * 100).toFixed(2) : '0.00';
        const balanceChange = ((userInfo.balance - initialBalance) / initialBalance * 100).toFixed(2);

        log('═'.repeat(80));
        log(`STATS @ ${totalGames} games`);
        log(`  Win Rate: ${winRate}% (${totalWins}W / ${totalLosses}L)`);
        log(`  Session Profit: ${sessionProfit >= 0 ? '+' : ''}${(sessionProfit / 100).toFixed(0)} bits`);
        log(`  ROI: ${roi}%`);
        log(`  Balance Change: ${balanceChange}%`);
        log(`  Longest Loss Streak: ${longestLossStreak}`);
        log(`  Current Streak: ${currentLossStreak} losses`);
        log(`  Balance: ${(userInfo.balance / 100).toFixed(0)} bits`);
        log('═'.repeat(80));
    }
});
