var config = {
    bet: {
        value: 100,
        type: 'balance'
    },
    parabFactor: {
        value: 1.04,
        type: 'multiplier',
        label: 'parab factor'
    },
    gainFactor: {
        value: 6,
        type: 'multiplier',
        label: 'parab factor'
    },
    basePayout: {
        value: 2,
        type: 'multiplier',
        label: 'base payout'
    },
    late: {
        value: 2,
        type: 'multiplier',
        label: 'late'
    },
};


log('Script is running..');

var currentBaseBet = config.bet.value;
var basePayout = config.basePayout.value;
var totbet = 0;
var late =

// Always try to bet when script is started
engine.bet(currentBaseBet, basePayout);

engine.on('GAME_STARTING', onGameStarted);
engine.on('GAME_ENDED', onGameEnded);

function onGameStarted() {
    log('betting', Math.round(currentBaseBet / 100), 'at payout of', basePayout, 'x')
    engine.bet(currentBaseBet, basePayout);
}

function onGameEnded(info) {
    var lastGame = engine.history.first()
    totbet +=lastGame.wager;
    // If we wagered, it means we played
    if (!lastGame.wager) {
        return;
    }

    // we won..
    if (lastGame.cashedAt) {
        totbet = 0;
        currentBaseBet = config.bet.value;
        basePayout = config.basePayout.value;
    } else {
        currentBaseBet *= config.parabFactor.value;
        basePayout = (totbet / currentBaseBet) + config.gainFactor.value;
    }

}