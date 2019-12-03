var config = {
    bet: { value: 600, type: 'balance', label: 'bet'},
    payout: { value: 2.4, type: 'multiplier', label: 'Payout' },
    maxT: { value: 200, type: 'multiplier', label: 'MaxT' },
    lateByTime: { value: 0, type: 'multiplier', label: 'late by' },
};


log('Script is running..');


// Always try to bet when script is started
engine.bet(100, config.payout.value);

engine.on('GAME_STARTING', onGameStarted);
engine.on('GAME_ENDED', onGameEnded);
let i = 0;
let k = 0;
const payout = config.payout.value;
const bet = config.bet.value;
let currentBet  = bet;
let precBet = 0;
let first = true;


showStats(bet, config.maxT.value);


function onGameStarted() {
    if (k>config.maxT.value) {
        log("disaster!");
        i = 0;
        k = 0;
        currentBet = bet;
        precBet = 0;
    }
    else
    {
        if (i>=config.lateByTime.value) {
            log("T",k++, " bet ", roundBit(currentBet) / 100);
            engine.bet(currentBet, payout);
        }
        else {
            log("wait for other:", config.lateByTime.value - i)
            i++;
        }
    }

}

function onGameEnded() {
    var lastGame = engine.history.first();
    log ("bust:", lastGame.bust)

    if (lastGame.bust >= payout) {
        currentBet = bet;
        first = true;
        precBet = 0;
        i = 0;
        k = 0;
    }
    else if (!lastGame.cashedAt && lastGame.wager) {
        i++;
        if(currentBet == bet) {
            if (!first) {
                precBet = bet;
                currentBet = bet * 2;
            }
            else first = false;
        }
        else {
            let precBetTemp = currentBet;
            currentBet = precBet + currentBet;
            precBet = precBetTemp;
        }
    }
}


function roundBit(bet) {
    return Math.round(bet / 100) * 100;
}


function showStats(initBet, maxT) {
    let i;
    let count = 0;
    let bet = initBet;
    let first = true;
    let precBet = bet;
    log("------ INFO -----")
    for (i = 0; i < maxT + 2; i++) {
        if (precBet == bet) {
            if (!first) {
                bet = bet * 2;
            } else first = false;
        } else {
            let precBetTemp = bet;
            bet = precBet + bet;
            precBet = precBetTemp;
        }
        count += bet;
        log('T:', i, ' - bet:', (bet / 100).toLocaleString('de-DE'), ' - tot: ', (count / 100).toLocaleString('de-DE'));
    }
}
