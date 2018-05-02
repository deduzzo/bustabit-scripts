var config = {
    mult: {
        value: 800, type: 'multiplier', label: 'Mult'
    },
    baseBet: {
        value: 200, type: 'balance', label: 'Base Bet'
    },
    percStart: {
        value: 90, type: 'multiplier', label: 'Start At: (mult - x%)'
    },
    incEvery: {
        value: 20, type: 'multiplier', label: 'Increment Every (%mult):'
    },
    incAmount: {
        value: 50, type: 'multiplier', label: 'Inc amount % basebet:'
    }
};

var timesFromDesMult = 0;
fetch('https://server2.erainformatica.it:3001/busts/fromLastBust/' + config.mult.value).then(response => response.json())
    .then(json => timesFromDesMult = json.times);

var totalProfits = 0;
var totalBetFromDesMult = 0;
var currentBaseBet = config.baseBet.value;
var succBets = 0;
var test = false;

log(timesFromDesMult, '   asd');

engine.on('GAME_STARTING', onGameStarted);
engine.on('GAME_ENDED', onGameEnded);

function onGameStarted() {
    makeBet();
}

function onGameEnded() {
    var lastGame = engine.history.first();
    log(lastGame);
    // If we wagered, it means we played
    if (!lastGame.wager) {
        if (lastGame.bust >= config.mult.value)
        {
            log('bust: ',lastGame.bust, 'x wooow! resetting count');
            timesFromDesMult = 0;
        }
        else
        {
            log('bust: ', lastGame.bust, 'x.. ');
        }
        return;
    }
    if (lastGame.cashedAt) {
        succBets++;
        var profit = Math.round((currentBaseBet * config.mult.value) / 100);
        log('**** WIN', profit, ' bits after ', timesFromDesMult,' times ****');
        log('ROUND BALANCE: ', Math.round((profit - totalBetFromDesMult) /100));
        totalProfits += profit - totalBetFromDesMult;
        log('TOTAL PROFIT AFTER ', succBets ,' times: ', Math.round(totalProfits /100))
        timesFromDesMult = 0;
        totalBetFromDesMult = 0;
        currentBaseBet = config.baseBet.value;
    } else {
        totalBetFromDesMult+= currentBaseBet;
        log('Lost :( betting from last wins: ', totalBetFromDesMult / 100);
    }
}

function makeBet() {
    timesFromDesMult++;
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

async function fet(val)
{
    const response = await fetch('https://server2.erainformatica.it:3001/busts/fromLastBust/' + val);
    const json = await response.json();
    return json.times;
}