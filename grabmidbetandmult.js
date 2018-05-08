var config = {
    mult: {
        value: 1300, type: 'multiplier', label: 'Des Mult (none for best)'
    },
    baseBet: {
        value: 100, type: 'balance', label: 'Base Bet'
    },
    multAmount: {
         type: 'multiplier', label: 'Mult base bet after mid*2 bets (none to disable)', optional: true,
    }
};

var currentTimesFetched = false;
var midFetched = false;
var started = false;

var currentTimes = 0;
var mid = 0;

var realPartialTimesBets = 0;
var partialBets = 0;
var totalProfits = 0;
var currentBaseBet = config.baseBet.value;
var succBets = 0;
var skippedBets = 0;
var stats = [];
var test = false;


engine.on('GAME_STARTING', onGameStarted);
engine.on('GAME_ENDED', onGameEnded);

fetchData();

function onGameStarted() {
    if (!started && midFetched && currentTimesFetched) {
        log("READY TO START! ", config.mult.value, 'x, mid: ', mid)
        started = true;
    }
    else
    if (!started) log('wait for data..');

    if (started)
    {
        if (currentTimes > mid)
        {
            adjustCurrentBaseBet();
            makeBet();
        }
        else
        {
            log('skipping for other ', mid - currentTimes, ' times')
        }
    }
}

function onGameEnded() {
    var lastGame = engine.history.first();
    if(started) currentTimes++;
    if (currentTimes % 50 == 0 && started) showStats();
    if (!lastGame.wager) {
        if (lastGame.bust >= config.mult.value)
        {
            log('bust: ',lastGame.bust, 'x :( resetting count');
            stats.push({status: 'skip', bets: currentTimes, date: new Date(), balance: 0, mid: mid});
            skippedBets++;
            waitAndGrab();
        }
        else
        {
            log('bust:', lastGame.bust, 'x.. ');
        }
        return;
    }

    if (lastGame.cashedAt) {
        var profit = Math.round((config.wager.value * config.payout.value - config.wager.value) / 100)
        totalProfits+= profit - partialBets;
        stats.push({status: 'wins', bets: realPartialTimesBets, date: new Date(), balance: profit - partialBets , mid: mid});
        log('WINSSS ', profit, ' bits , ROUND BALANCE: ', Math.round(profit - partialBets) /100, ', TOTAL PROFIT: ', Math.round(totalProfits /100));
        succBets++;
        waitAndGrab();
    } else {
        log('LOST, road to wins', Math.round(config.wager.value / 100) * config.payout.value, ' bits - BET TIMES: [',realPartialTimesBets, '] MID: [', mid,'] -  PART BETS: [', Math.round(partialBets /100), ']');
    }
}

function adjustCurrentBaseBet()
{

}

function makeBet() {
    if (!test) engine.bet(currentBaseBet, config.mult.value);
    partialBets += currentBaseBet;
    realPartialTimesBets++;
    log('[', currentTimes  ,'<> BET ',realPartialTimesBets,'] Betting', Math.round(currentBaseBet / 100), 'on', config.mult.value, 'x, ');
}

function fetchData() {

    fetch('https://server2.erainformatica.it:3001/busts/stats').then(response => response.json())
        .then(json => {
            var res = json.results;
            mid = Math.floor(res.filter(p => p.mult == config.mult.value)[0].mid);
            midFetched = true;
            log('mid = ', mid)
            fetch('https://server2.erainformatica.it:3001/busts/fromLastBust/' + config.mult.value).then(response => response.json())
                .then(json => {
                    currentTimes = json.times;
                    currentTimesFetched = true;
                    log('currentTimes = ', currentTimes)
                });
        });
}

function waitAndGrab()
{
    log("10 sec to reload data...");
    mid = 0;
    currentTimes = 0;
    realPartialTimesBets = 0;
    partialBets = 0;
    midFetched = false;
    currentTimesFetched = false;
    started = false;
    setTimeout(fetchData, 10000);
}

function showStats()
{
    log('*** STATS ***');
    log(stats);
}