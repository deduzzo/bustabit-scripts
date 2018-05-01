var config = {
    mult: {
        value: 800, type: 'multiplier', label: 'Mult'
    },
    baseBet: {
        value: 10000, type: 'balance', label: 'Base Bet'
    },
    percStart: {
        value: 50, type: 'multiplier', label: 'Start At: (mult - x%)'
    },
    incEvery: {
        value: 10, type: 'multiplier', label: 'Increment Every (%mult):'
    },
    incAmount: {
        value: 1000, type: 'balance', label: 'Inc amount:'
    }
};


var timesFromDesMult = (config.mult.value / 100) * config.percStart.value;
var totalProfits = 0;
var totalBetFromDesMult = 0;
var currentBaseBet = config.baseBet.value;
var succBets = 0;
var test = false;

engine.on('GAME_STARTING', onGameStarted);
engine.on('GAME_ENDED', onGameEnded);

function onGameStarted() {
    makeBet();
}

function onGameEnded() {
    var lastGame = engine.history.first();

    // If we wagered, it means we played
    if (!lastGame.wager) {
        if (lastGame.bust >= config.mult)
        {
            log('resetting count');
            timesFromDesMult = 0;
        }
        return;
    }
    if (lastGame.cashedAt) {
        succBets++;
        var profit = Math.round((currentBaseBet * config.mult.value - currentBaseBet) / 100);
        log('**** WIN', profit, ' bits after ', timesFromDesMult,' times ****');
        log('ROUND BALANCE: ', Math.round((totalBetFromDesMult - profit) /100));
        totalProfits += profit;
        log('TOTAL PROFIT AFTER ', succBets ,' times: ', Math.round(totalProfits /100))
        timesFromDesMult = 0;
        totalBetFromDesMult = 0;
    } else {
        totalBetFromDesMult+= currentBaseBet;
        log('Lost :( betting from last wins: ', totalBetFromDesMult / 100);
    }
}

function makeBet() {
    timesFromDesMult++;
    if (timesFromDesMult >= ((config.mult.value / 100 ) * config.percStart.value)) {
        if (timesFromDesMult % ((config.mult.value / 100) * config.incEvery.value) === 0) {
            currentBaseBet += config.incAmount.value;
            log('Basebet incremented +', config.incAmount.value / 100);
        }
        if (!test) engine.bet(currentBaseBet, config.mult.value);
        log('[', timesFromDesMult  ,'] Betting', Math.round(currentBaseBet / 100), 'on', config.mult.value, 'x, ', (((config.mult.value / 100) * config.incEvery.value) - (timesFromDesMult % ((config.mult.value / 100) * config.incEvery.value))), ' times to increment');
    }
    else
        log (timesFromDesMult , ' < ' ,((config.mult.value / 100 ) * config.percStart.value), ' skipping')
}