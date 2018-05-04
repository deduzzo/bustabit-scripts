var config = {
    mult: {
        value: 1300, type: 'multiplier', label: 'Mult'
    },
    baseBet: {
        value: 100, type: 'balance', label: 'Base Bet'
    },
    multAmount: {
        value: 3, type: 'multiplier', label: 'Mult base bet after mid*2 bets'
    }
};

var currentTimesFetched = false;
var midFetched = false;
var started = false;
var currentTimes = 0;
var mid = 0;

var totalProfits = 0;
var currentBaseBet = config.baseBet.value;
var succBets = 0;
var skippedBets = 0;


fetch('https://server2.erainformatica.it:3001/busts/fromLastBust/' + config.mult.value).then(response => response.json())
    .then(json =>
    {
        currentTimes = json.times;
        currentTimesFetched = true;
        log('currentTimes = ', currentTimes)
    });

fetch('https://server2.erainformatica.it:3001/busts/stats').then(response => response.json())
    .then(json =>
    {
        var res = json.results;
        mid = Math.floor(res.filter(p=> p.mult == config.mult.value)[0].mid);
        midFetched = true;
        log('mid = ', mid)
    });



engine.on('GAME_STARTING', onGameStarted);
engine.on('GAME_ENDED', onGameEnded);

function onGameStarted() {
    makeBet();
}

function onGameEnded() {
    var lastGame = engine.history.first();

    if (!started && midFetched && currentTimesFetched) {
        log("READY TO START! ", config.mult.value, 'x, mid: ', mid, ' after mid base bet x ', config.multAmount.value)
        started = true;
    }
    else
        if (!started) log('wait for data..')

}

function makeBet() {
    currentTimes++;

    if (timesFromDesMult >= ((config.mult.value / 100 ) * config.percStart.value)) {
        if (timesFromDesMult % ((config.mult.value / 100) * config.incEvery.value) === 0) {
            currentBaseBet += (config.baseBet.value /100) * config.incAmount.value;
            log('Basebet incremented +', config.incAmount.value / 100);
        }
        if (!test) engine.bet(currentBaseBet, config.mult.value);
        log('[', timesFromDesMult  ,'] Betting', Math.round(currentBaseBet / 100), 'on', config.mult.value, 'x, ', (((config.mult.value / 100) * config.incEvery.value) - (timesFromDesMult % ((config.mult.value / 100) * config.incEvery.value))), ' times to increment');
    }
    else
        log (timesFromDesMult , ' < ' ,((config.mult.value / 100 ) * config.percStart.value), ' skipping')
}