var config = {
    baseBet: { value: 500, type: 'balance', label: 'base bet' }
};

const payout = 3
const stop = 1e8
const increaseMult = 1.5
let maxBets = config.baseBet.value;


log('Script is running..');

var currentBet = config.baseBet.value;

// Always try to bet when script is started
engine.bet(currentBet, payout);

engine.on('GAME_STARTING', onGameStarted);
engine.on('GAME_ENDED', onGameEnded);

function onGameStarted() {
    log('betting', Math.round(currentBet / 100), 'on', payout, 'x');
    engine.bet(currentBet, payout);
}

function onGameEnded() {
    var lastGame = engine.history.first()

    // If we wagered, it means we played
    if (!lastGame.wager) {
        return;
    }

    // we won..
    if (lastGame.cashedAt) {
        currentBet = config.baseBet.value;
        log('We won, so next bet will be', currentBet/100, 'bits')
    } else {
            currentBet = Math.round((currentBet /100) * increaseMult) * 100;
            if (currentBet > maxBets)
                maxBets = currentBet;
            log('We lost, so next bet will be', currentBet/100, 'bits, maxbets = ', maxBets / 100)
    }

    if (currentBet > stop) {
        log('Was about to bet', currentBet, 'which triggers the stop');
        engine.removeListener('GAME_STARTING', onGameStarted);
        engine.removeListener('GAME_ENDED', onGameEnded);
    }
}