var config = {
    payout: { value: 2, type: 'multiplier' },
};


log('Script is running..');


// Always try to bet when script is started
engine.bet(100, config.payout.value);

engine.on('GAME_STARTING', onGameStarted);
engine.on('GAME_ENDED', onGameEnded);

let max = 0;
let maxEver = 0;

function onGameStarted() {
    engine.bet(100, config.payout.value);
}

function onGameEnded() {
    var lastGame = engine.history.first()

    // If we wagered, it means we played
    if (!lastGame.wager) {
        return;
    }

    // we won..
    if (lastGame.cashedAt) {
        if (max > maxEver)
            maxEver = max;
        log('MAX: ', maxEver)
        max = 0;
    } else {
        max++;
    }
}