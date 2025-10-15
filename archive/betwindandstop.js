var config = {
    wager: {
        value: 1000, type: 'balance', label: 'wager'
    },
    payout: {
        value: 2000, type: 'multiplier', label: 'payout' }
};

// Try to bet immediately when script starts
makeBet();

engine.on('GAME_STARTING', onGameStarted);
engine.on('GAME_ENDED', onGameEnded);

function onGameStarted() {
    makeBet();
}

function onGameEnded() {
    var lastGame = engine.history.first();

    // If we wagered, it means we played
    if (!lastGame.wager) {
        return;
    }

    if (lastGame.cashedAt) {
        var profit = Math.round((config.wager.value * config.payout.value - config.wager.value) / 100)
        log('WINSSS', profit, ' bits');
        stop("stop :)")
    } else {
        log('perso, road to wins', Math.round(config.wager.value / 100) * config.payout.value, ' bits');
    }
}

function makeBet() {
    engine.bet(config.wager.value, config.payout.value);
    log('betting', Math.round(config.wager.value / 100), 'on', config.payout.value, 'x');
}