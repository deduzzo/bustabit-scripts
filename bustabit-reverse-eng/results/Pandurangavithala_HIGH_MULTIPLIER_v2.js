/**
 * Pandurangavithala - HIGH MULTIPLIER HUNTER v2.0
 *
 * Reverse-engineered from 10,000 games log (Jan 2026)
 * Data accuracy: 7,291 bets analyzed
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * STRATEGIA IDENTIFICATA:
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * BET SIZING:
 * - Base bet: 29,897 bits (72.2% delle volte)
 * - Alternate bet: 24,897 bits (27.7% delle volte)
 * - Scelta NON correlata con risultato precedente
 * - Pattern: Random selection tra i due importi
 *
 * TARGET:
 * - Target FISSO: 14x (non random!)
 * - Media: 14.30x, Mediana: 14.09x
 * - Range: 1.01x - 43.89x (ma 67.6% tra 10-20x)
 * - Distribution:
 *   * 10-20x: 67.6% (principale)
 *   * 20x+: 12.4%
 *   * 5-10x: 12.0%
 *   * <5x: 8.0% (raro)
 *
 * PATTERN DI GIOCO:
 * - Gioca consecutivamente: 94.8% (delay=0)
 * - Skip casuale: 27.1% delle partite
 * - Indipendente dai bust precedenti
 * - NO martingale, NO progression
 *
 * PERFORMANCE REALE (10k games):
 * - Win rate: 7.2%
 * - ROI: +3.06%
 * - Max loss streak: 79 perdite consecutive
 * - Total wagered: 207,673,027 bits
 * - Total profit: +6,364,210 bits
 *
 * TIPO STRATEGIA:
 * "Ultra High Risk - Ultra High Reward"
 * Accetta moltissime perdite consecutive aspettando quella vincita
 * grossa a 14x che recupera tutto.
 */

var config = {
  baseBet: { value: 2989700, type: 'balance', label: 'Base Bet (29,897 bits)' },
  alternateBet: { value: 2489700, type: 'balance', label: 'Alternate Bet (24,897 bits)' },
  target: { value: 14.00, type: 'multiplier', label: 'Target Multiplier' },
  skipProbability: { value: 27, type: 'multiplier', label: 'Skip Probability (%)' },
  alternateProbability: { value: 28, type: 'multiplier', label: 'Use Alternate Bet (%)' },
  minBalance: { value: 5000000, type: 'balance', label: 'Min Balance to Continue (50k bits)' },
};

log('═══════════════════════════════════════════════════════════');
log('  Pandurangavithala - HIGH MULTIPLIER HUNTER v2.0');
log('═══════════════════════════════════════════════════════════');
log('Strategy: Flat bet with fixed high target (14x)');
log('Based on: 10,000 games analyzed (Jan 2026)');
log('');
log('Config:');
log('  Base Bet: ' + (config.baseBet.value / 100) + ' bits (72%)');
log('  Alternate Bet: ' + (config.alternateBet.value / 100) + ' bits (28%)');
log('  Target: ' + config.target.value + 'x (FIXED)');
log('  Skip: ' + config.skipProbability.value + '% of games');
log('');
log('Expected Performance:');
log('  Win Rate: ~7.2%');
log('  ROI: ~+3%');
log('  Max Loss Streak: 79+ losses');
log('═══════════════════════════════════════════════════════════');
log('');

// Stats tracking
var stats = {
  totalGames: 0,
  betsPlaced: 0,
  skipped: 0,
  wins: 0,
  losses: 0,
  totalWagered: 0,
  totalProfit: 0,
  currentStreak: 0,
  maxLossStreak: 0,
  startBalance: 0,
};

// Initialize
stats.startBalance = userInfo.balance;
log('Starting Balance: ' + (stats.startBalance / 100).toLocaleString() + ' bits');
log('');

engine.on('GAME_STARTING', function() {
  stats.totalGames++;

  // Safety check: minimum balance
  if (userInfo.balance < config.minBalance.value) {
    log('');
    log('[STOP] Balance below minimum threshold.');
    log('Current: ' + (userInfo.balance / 100).toLocaleString() + ' bits');
    log('Minimum: ' + (config.minBalance.value / 100).toLocaleString() + ' bits');
    return;
  }

  // Random skip logic (27% probability)
  var skipRoll = Math.random() * 100;
  if (skipRoll < config.skipProbability.value) {
    stats.skipped++;
    return;
  }

  // Choose bet size (72% base, 28% alternate)
  var betRoll = Math.random() * 100;
  var betAmount = betRoll < config.alternateProbability.value
    ? config.alternateBet.value
    : config.baseBet.value;

  var target = config.target.value;

  // Safety check: ensure we have enough balance
  if (userInfo.balance < betAmount) {
    log('');
    log('[BANKRUPT] Insufficient balance for bet.');
    log('Balance: ' + (userInfo.balance / 100) + ' bits');
    log('Required: ' + (betAmount / 100) + ' bits');
    logFinalStats();
    return;
  }

  stats.betsPlaced++;
  stats.totalWagered += betAmount;

  engine.bet(betAmount, target);
});

engine.on('GAME_ENDED', function(data) {
  var last = engine.history.first();

  if (!last || last.wager === 0) return; // Skipped game

  if (last.cashedAt > 0) {
    // WIN
    stats.wins++;
    stats.currentStreak = 0;
    var profit = last.wager * (last.cashedAt - 1);
    stats.totalProfit += profit;

    log('[WIN #' + stats.wins + '] ✓ ' + last.cashedAt.toFixed(2) + 'x - ' +
        'Profit: +' + (profit / 100).toLocaleString() + ' bits ' +
        '(balance: ' + (userInfo.balance / 100).toLocaleString() + ' bits)');
  } else {
    // LOSS
    stats.losses++;
    stats.currentStreak++;
    stats.totalProfit -= last.wager;

    if (stats.currentStreak > stats.maxLossStreak) {
      stats.maxLossStreak = stats.currentStreak;
    }

    // Log only significant streaks or every 10th loss
    if (stats.currentStreak % 10 === 0 || stats.currentStreak > 20) {
      log('[STREAK] ' + stats.currentStreak + ' losses - ' +
          'Balance: ' + (userInfo.balance / 100).toLocaleString() + ' bits');
    }
  }

  // Periodic stats (every 100 bets)
  if (stats.betsPlaced > 0 && stats.betsPlaced % 100 === 0) {
    logStats();
  }
});

function logStats() {
  var roi = stats.totalWagered > 0 ? (stats.totalProfit / stats.totalWagered) * 100 : 0;
  var winRate = stats.betsPlaced > 0 ? (stats.wins / stats.betsPlaced) * 100 : 0;
  var currentBalance = userInfo.balance;
  var balanceChange = currentBalance - stats.startBalance;
  var balanceChangePercent = stats.startBalance > 0 ? ((balanceChange / stats.startBalance) * 100) : 0;

  log('');
  log('─────────────────────────────────────────────────────────');
  log('  STATS @ ' + stats.betsPlaced + ' bets');
  log('─────────────────────────────────────────────────────────');
  log('Games:           ' + stats.totalGames + ' (' +
      stats.betsPlaced + ' bets, ' + stats.skipped + ' skips)');
  log('Win Rate:        ' + stats.wins + 'W / ' + stats.losses + 'L ' +
      '(' + winRate.toFixed(1) + '%)');
  log('Max Streak:      ' + stats.maxLossStreak + ' losses');
  log('Current Streak:  ' + stats.currentStreak + ' losses');
  log('Total Wagered:   ' + (stats.totalWagered / 100).toLocaleString() + ' bits');
  log('Total Profit:    ' + (stats.totalProfit >= 0 ? '+' : '') +
      (stats.totalProfit / 100).toLocaleString() + ' bits');
  log('ROI:             ' + (roi >= 0 ? '+' : '') + roi.toFixed(2) + '%');
  log('Balance:         ' + (currentBalance / 100).toLocaleString() + ' bits ' +
      '(' + (balanceChangePercent >= 0 ? '+' : '') + balanceChangePercent.toFixed(2) + '%)');
  log('─────────────────────────────────────────────────────────');
  log('');
}

function logFinalStats() {
  log('');
  log('═══════════════════════════════════════════════════════════');
  log('  FINAL STATISTICS');
  log('═══════════════════════════════════════════════════════════');
  logStats();
  log('Session Complete!');
  log('═══════════════════════════════════════════════════════════');
}

function log(msg) {
  console.log(msg);
}
