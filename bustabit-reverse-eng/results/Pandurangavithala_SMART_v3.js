/**
 * Pandurangavithala - HIGH MULTIPLIER HUNTER v3.0 SMART
 *
 * Reverse-engineered from 72,854 games (Jan 2026)
 * PATTERN REALI identificati tramite deep analysis
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * PATTERN IDENTIFICATI (CRITICI):
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 1. TARGET VARIABILE:
 *    - NON è 14x fisso!
 *    - Distribuito: 14x (18.5%), 14.1-14.3x, 15.4x, 27x...
 *    - Range: 13-16x con outliers fino a 27x
 *
 * 2. BET SIZE DINAMICO (basato su profit):
 *    - Quando in profit (balance alto): 87.6% usa 29,897 bits
 *    - Quando in loss (balance basso): 90.2% usa 24,897 bits
 *    - NON è casuale 72/28!
 *
 * 3. SKIP AGGRESSIVO quando perde:
 *    - Balance alto: skip 26.4%
 *    - Balance basso: skip solo 6.9% (gioca aggressivo!)
 *    - Dopo bust >10x: skip 24.7% (skippa MENO)
 *
 * PERFORMANCE REALE (72,854 games):
 * - Win rate: 7.2%
 * - ROI: -1.57% (house edge)
 * - Max loss streak: 109
 * - Strategia ad alto rischio, ROI negativo lungo termine
 */

var config = {
  baseBetHigh: { value: 2989700, type: 'balance', label: 'Bet quando in profit (29,897 bits)' },
  baseBetLow: { value: 2489700, type: 'balance', label: 'Bet quando in loss (24,897 bits)' },

  targetBase: { value: 14.00, type: 'multiplier', label: 'Target base' },
  targetVariance: { value: 2.0, type: 'multiplier', label: 'Target variance (±2x)' },

  skipWhenAhead: { value: 26, type: 'multiplier', label: 'Skip % quando in profit' },
  skipWhenBehind: { value: 7, type: 'multiplier', label: 'Skip % quando in loss' },
  skipAfterHighBust: { value: 25, type: 'multiplier', label: 'Skip % dopo bust >10x' },

  profitThreshold: { value: 0, type: 'multiplier', label: 'Soglia profit per switch bet (bits)' },

  minBalance: { value: 5000000, type: 'balance', label: 'Min Balance (50k bits)' },
};

log('═══════════════════════════════════════════════════════════');
log('  Pandurangavithala - SMART HIGH MULTIPLIER HUNTER v3.0');
log('═══════════════════════════════════════════════════════════');
log('Strategy: SMART betting con pattern reali identificati');
log('Based on: 72,854 games analyzed (Jan 2026)');
log('');
log('Pattern identificati:');
log('  ✓ Target variabile (13-16x, avg 14.3x)');
log('  ✓ Bet size dinamico basato su profit');
log('  ✓ Skip aggressivo quando in loss');
log('  ✓ Gioca di più dopo bust alti');
log('');
log('Expected Performance:');
log('  Win Rate: ~7.2%');
log('  ROI: ~-1.5% (house edge)');
log('  Max Loss Streak: 109+');
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
  sessionProfit: 0,
};

// Initialize
stats.startBalance = userInfo.balance;
stats.sessionProfit = 0;

log('Starting Balance: ' + (stats.startBalance / 100).toLocaleString() + ' bits');
log('');

// History for pattern detection
var lastBust = 0;

engine.on('GAME_STARTING', function() {
  stats.totalGames++;

  // Safety check
  if (userInfo.balance < config.minBalance.value) {
    log('[STOP] Balance too low');
    return;
  }

  // Calculate current profit
  stats.sessionProfit = userInfo.balance - stats.startBalance;
  var isAhead = stats.sessionProfit > config.profitThreshold.value;

  // PATTERN 1: Skip decision based on profit state
  var skipProb = isAhead ? config.skipWhenAhead.value : config.skipWhenBehind.value;

  // PATTERN 2: Skip less after high bust
  if (lastBust > 10) {
    skipProb = config.skipAfterHighBust.value;
  }

  // Apply skip
  if (Math.random() * 100 < skipProb) {
    stats.skipped++;
    return;
  }

  // PATTERN 3: Bet size based on profit
  var betAmount;
  if (isAhead) {
    // In profit: 87.6% high, 12.4% low
    betAmount = Math.random() < 0.876 ? config.baseBetHigh.value : config.baseBetLow.value;
  } else {
    // In loss: 9.8% high, 90.2% low
    betAmount = Math.random() < 0.098 ? config.baseBetHigh.value : config.baseBetLow.value;
  }

  // Safety check
  if (userInfo.balance < betAmount) {
    log('[BANKRUPT] Insufficient balance');
    return;
  }

  // PATTERN 4: Variable target around 14x
  // Distribution: 18.5% exactly 14x, rest 13-16x with outliers
  var targetRoll = Math.random();
  var target;

  if (targetRoll < 0.185) {
    target = 14.0; // 18.5%
  } else if (targetRoll < 0.35) {
    target = 14.1 + Math.random() * 0.3; // 14.1-14.4x
  } else if (targetRoll < 0.55) {
    target = 15.1 + Math.random() * 0.5; // 15.1-15.6x
  } else if (targetRoll < 0.70) {
    target = 13.5 + Math.random() * 0.5; // 13.5-14x
  } else if (targetRoll < 0.85) {
    target = 16.0 + Math.random() * 0.5; // 16-16.5x
  } else if (targetRoll < 0.93) {
    target = 1.85 + Math.random() * 0.1; // 1.85-1.95x (low outliers)
  } else {
    target = 20 + Math.random() * 10; // 20-30x (high outliers)
  }

  target = Math.round(target * 100) / 100; // Round to 2 decimals

  stats.betsPlaced++;
  stats.totalWagered += betAmount;

  engine.bet(betAmount, target);
});

engine.on('GAME_ENDED', function(data) {
  var last = engine.history.first();
  lastBust = data.bust;

  if (!last || last.wager === 0) return;

  if (last.cashedAt > 0) {
    // WIN
    stats.wins++;
    stats.currentStreak = 0;
    var profit = last.wager * (last.cashedAt - 1);
    stats.totalProfit += profit;

    log('[WIN #' + stats.wins + '] ✓ ' + last.cashedAt.toFixed(2) + 'x - ' +
        'Profit: +' + (profit / 100).toLocaleString() + ' bits ' +
        '(session: ' + (stats.sessionProfit >= 0 ? '+' : '') + (stats.sessionProfit / 100).toFixed(0) + ' bits)');
  } else {
    // LOSS
    stats.losses++;
    stats.currentStreak++;
    stats.totalProfit -= last.wager;

    if (stats.currentStreak > stats.maxLossStreak) {
      stats.maxLossStreak = stats.currentStreak;
    }

    if (stats.currentStreak % 20 === 0) {
      log('[STREAK] ' + stats.currentStreak + ' losses - ' +
          'Session: ' + (stats.sessionProfit >= 0 ? '+' : '') + (stats.sessionProfit / 100).toFixed(0) + ' bits');
    }
  }

  // Periodic stats
  if (stats.betsPlaced > 0 && stats.betsPlaced % 100 === 0) {
    logStats();
  }
});

function logStats() {
  var roi = stats.totalWagered > 0 ? (stats.totalProfit / stats.totalWagered) * 100 : 0;
  var winRate = stats.betsPlaced > 0 ? (stats.wins / stats.betsPlaced) * 100 : 0;
  var currentBalance = userInfo.balance;
  stats.sessionProfit = currentBalance - stats.startBalance;
  var balanceChangePercent = ((stats.sessionProfit / stats.startBalance) * 100);

  log('');
  log('─────────────────────────────────────────────────────────');
  log('  STATS @ ' + stats.betsPlaced + ' bets');
  log('─────────────────────────────────────────────────────────');
  log('Games:           ' + stats.totalGames + ' (' +
      stats.betsPlaced + ' bets, ' + stats.skipped + ' skips)');
  log('Win Rate:        ' + winRate.toFixed(1) + '% (' + stats.wins + 'W / ' + stats.losses + 'L)');
  log('Max Streak:      ' + stats.maxLossStreak + ' losses');
  log('ROI:             ' + (roi >= 0 ? '+' : '') + roi.toFixed(2) + '%');
  log('Session Profit:  ' + (stats.sessionProfit >= 0 ? '+' : '') +
      (stats.sessionProfit / 100).toLocaleString() + ' bits ' +
      '(' + (balanceChangePercent >= 0 ? '+' : '') + balanceChangePercent.toFixed(2) + '%)');
  log('Balance:         ' + (currentBalance / 100).toLocaleString() + ' bits');
  log('─────────────────────────────────────────────────────────');
  log('');
}

function log(msg) {
  console.log(msg);
}
