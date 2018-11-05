var config = {
    baseBet: { value: 1000, type: 'balance', label: 'base bet' },
    maxBets: { value: 500000, type: 'balance', label: 'max bets' }
};

const payout = 3;
const increaseMult = 1.5;
let disaster = 0;
let currentRound = 0;

log('Script is running..');

let currentBet = config.baseBet.value;
let maxBets = 0;
const betLimit = config.maxBets.value;

// Always try to bet when script is started
engine.bet(currentBet, payout);

engine.on('GAME_STARTING', onGameStarted);
engine.on('GAME_ENDED', onGameEnded);

function onGameStarted() {
    log('ROUND , ', ++currentRound , ' - DIS: ', disaster, ' - betting', Math.round(currentBet / 100), 'on', payout, 'x');
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
        if (currentBet > betLimit) {
            log('Was about to bet', currentBet, '> betlimit ', betLimit /100,', so restart.. :(');
            disaster++;
            currentBet = config.baseBet.value;
        }
        else if (currentBet > maxBets) {
            maxBets = currentBet;
        }
        log('We lost, so next bet will be', currentBet / 100, 'bits, maxbets = ', maxBets / 100)
    }

}