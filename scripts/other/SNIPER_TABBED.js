/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SNIPER TABBED - Follow & Copy Player Bets
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Copia le puntate di un altro giocatore in tempo reale.
 *
 * CONFIGURAZIONE:
 * - maxBet: Se 0 = nessun limite, altrimenti limita la puntata al valore max
 * - percBet: Se 0 = copia esatta, altrimenti punta X% della bet del target
 *
 * ESEMPI (valori mostrati in bits nell'interfaccia):
 *
 * 1) maxBet = 200, percBet = 0
 *    - Target punta 500 bits → Tu punti 200 bits (cappato!)
 *    - Target punta 100 bits → Tu punti 100 bits
 *
 * 2) maxBet = 0, percBet = 10
 *    - Target punta 500 bits → Tu punti 50 bits (10%)
 *    - Target punta 100 bits → Tu punti 10 bits (10%)
 *
 * 3) maxBet = 200, percBet = 50
 *    - Target punta 500 bits → Tu punti 200 bits (50% = 250, ma cappato a 200)
 *    - Target punta 100 bits → Tu punti 50 bits (50%)
 *
 * 4) maxBet = 0, percBet = 0
 *    - Target punta 500 bits → Tu punti 500 bits (copia esatta, no limiti)
 *    - Target casha a 2.5x → Tu cashi a 2.5x automaticamente
 *
 * IMPORTANTE:
 * - Devi avere balance sufficiente
 * - Il target deve essere online e giocare
 * - Funziona solo durante GAME_STARTING (prima che il game parta)
 */

var config = {
    // Target da seguire
    target: {
        value: "",
        type: "text",
        label: "Username da seguire"
    },

    // Puntata massima
    // Nota: type "balance" mostra i bits all'utente, ma il valore è in satoshi
    // 0 = disabilitato (nessun cap)
    maxBet: {
        value: 0,  // 0 satoshi = 0 bits = nessun limite
        type: "balance",
        label: "Max Bet (0 = no limit)"
    },

    // Percentuale della puntata del target
    // Se 0 = disabilitato (copia esatta 100%)
    // Se 10 = punta il 10% della bet del target
    // Se 50 = punta il 50% della bet del target
    percBet: {
        value: 0,  // 0 = copia esatta
        type: "multiplier",
        label: "% della puntata (0 = copia esatta, 10 = 10%)"
    },

    // Balance minimo per continuare
    minBalance: {
        value: 10000,  // 10000 satoshi = 100 bits
        type: "balance",
        label: "Min Balance to Continue"
    },

    // Stats
    showStats: {
        value: true,
        type: "checkbox",
        label: "Mostra statistiche"
    }
};

// ═══════════════════════════════════════════════════════════════════════════
// State & Stats
// ═══════════════════════════════════════════════════════════════════════════

let stats = {
    totalBets: 0,
    totalWins: 0,
    totalLosses: 0,
    totalWagered: 0,
    totalProfit: 0,
    timesCapped: 0,  // Quante volte la bet è stata cappata a maxBet
    currentStreak: 0,
    longestWinStreak: 0,
    longestLossStreak: 0
};

let initialBalance = 0;
let currentGameBet = null;

// ═══════════════════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════════════════

function formatBits(satoshi) {
    return (satoshi / 100).toFixed(2);
}

function logStats() {
    if (!config.showStats.value) return;

    const winRate = stats.totalBets > 0 ? (stats.totalWins / stats.totalBets * 100).toFixed(1) : '0.0';
    const profitPercent = initialBalance > 0 ? ((userInfo.balance - initialBalance) / initialBalance * 100).toFixed(2) : '0.00';

    log('═'.repeat(70));
    log(`📊 SNIPER STATS - Following: ${config.target.value}`);
    log('─'.repeat(70));
    log(`  Bets: ${stats.totalBets} (${stats.totalWins}W / ${stats.totalLosses}L) | Win Rate: ${winRate}%`);
    log(`  Wagered: ${formatBits(stats.totalWagered)} bits`);
    log(`  Profit: ${stats.totalProfit >= 0 ? '+' : ''}${formatBits(stats.totalProfit)} bits (${profitPercent}%)`);
    log(`  Balance: ${formatBits(userInfo.balance)} bits`);
    log(`  Times capped: ${stats.timesCapped}x`);
    log(`  Streaks: Win ${stats.longestWinStreak} | Loss ${stats.longestLossStreak}`);
    log('═'.repeat(70));
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Logic
// ═══════════════════════════════════════════════════════════════════════════

// Initialize
if (initialBalance === 0) {
    initialBalance = userInfo.balance;
    log('═'.repeat(70));
    log('🎯 SNIPER TABBED - Started');
    log('═'.repeat(70));
    log(`Following: ${config.target.value}`);
    log(`Max Bet: ${config.maxBet.value === 0 ? 'Disabled (no limit)' : formatBits(config.maxBet.value) + ' bits'}`);
    log(`Perc Bet: ${config.percBet.value === 0 ? 'Disabled (copy exact)' : config.percBet.value + '%'}`);
    log(`Starting Balance: ${formatBits(initialBalance)} bits`);
    log('═'.repeat(70));
}

// Quando il target piazza una bet
engine.on("BET_PLACED", (bet) => {
    // Controlla se è il target
    if (bet.uname.toLowerCase() !== config.target.value.toLowerCase()) {
        return;
    }

    // Controlla balance minimo
    if (userInfo.balance < config.minBalance.value) {
        log(`❌ Balance troppo basso: ${formatBits(userInfo.balance)} bits`);
        stop("Balance insufficiente per continuare.");
        return;
    }

    // Controlla se il game è ancora in fase di betting
    if (engine.gameState !== "GAME_STARTING") {
        log(`⚠️  Game già partito, non posso piazzare bet`);
        return;
    }

    // Calcola la puntata
    let targetWager = bet.wager;

    // Step 1: Applica percentuale (se abilitata)
    if (config.percBet.value > 0) {
        targetWager = Math.floor(targetWager * (config.percBet.value / 100));
    }

    // Step 2: Calcola balance disponibile (arrotondato a 100 satoshi)
    const bettableBalance = Math.floor(userInfo.balance / 100) * 100;

    // Step 3: Applica maxBet cap (se abilitato)
    let finalWager = targetWager;
    let wasCapped = false;

    if (config.maxBet.value > 0 && targetWager > config.maxBet.value) {
        finalWager = config.maxBet.value;
        wasCapped = true;
        stats.timesCapped++;
    }

    // Step 4: Limita al balance disponibile
    finalWager = Math.min(bettableBalance, finalWager);

    // Assicurati che sia almeno 100 satoshi (1 bit)
    if (finalWager < 100) {
        log(`❌ Puntata troppo piccola: ${finalWager} satoshi`);
        return;
    }

    // Log dettagliato
    log(`🎯 Target bet: ${formatBits(bet.wager)} bits @ ${(bet.payout / 100).toFixed(2)}x`);

    if (config.percBet.value > 0) {
        log(`   → Applying ${config.percBet.value}% reduction: ${formatBits(targetWager)} bits`);
    }

    if (wasCapped) {
        log(`   → ⚠️  CAPPED to maxBet: ${formatBits(config.maxBet.value)} bits`);
    }

    log(`   → Your bet: ${formatBits(finalWager)} bits @ ${(bet.payout / 100).toFixed(2)}x`);

    // Piazza la bet
    engine.bet(finalWager, bet.payout);

    // Salva info per stats
    currentGameBet = {
        wager: finalWager,
        payout: bet.payout,
        targetName: bet.uname
    };

    stats.totalBets++;
    stats.totalWagered += finalWager;
});

// Quando il target casha
engine.on("CASHED_OUT", (cashOut) => {
    // Controlla se è il target
    if (cashOut.uname.toLowerCase() !== config.target.value.toLowerCase()) {
        return;
    }

    log(`💰 ${cashOut.uname} cashed @ ${(cashOut.cashedAt / 100).toFixed(2)}x`);

    // Se anche noi stiamo giocando, casha
    if (engine.currentlyPlaying()) {
        engine.cashOut();
        log(`   → You cashed @ ${(cashOut.cashedAt / 100).toFixed(2)}x`);
    }
});

// Quando il game finisce
engine.on("GAME_ENDED", (data) => {
    if (!currentGameBet) return;

    const bust = data.bust / 100;
    const won = engine.lastBet && engine.lastBet.cashedAt;

    if (won) {
        const profit = Math.floor((currentGameBet.wager * (engine.lastBet.cashedAt / 100)) - currentGameBet.wager);
        stats.totalProfit += profit;
        stats.totalWins++;
        stats.currentStreak = stats.currentStreak > 0 ? stats.currentStreak + 1 : 1;
        stats.longestWinStreak = Math.max(stats.longestWinStreak, stats.currentStreak);

        log(`✅ WIN: +${formatBits(profit)} bits | Balance: ${formatBits(userInfo.balance)} bits`);
    } else if (engine.lastBet) {
        stats.totalProfit -= currentGameBet.wager;
        stats.totalLosses++;
        stats.currentStreak = stats.currentStreak < 0 ? stats.currentStreak - 1 : -1;
        stats.longestLossStreak = Math.max(stats.longestLossStreak, Math.abs(stats.currentStreak));

        log(`❌ LOSS: -${formatBits(currentGameBet.wager)} bits | Balance: ${formatBits(userInfo.balance)} bits`);
    }

    // Log stats ogni 10 bets
    if (stats.totalBets % 10 === 0) {
        logStats();
    }

    currentGameBet = null;
});
