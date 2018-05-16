var config = {
    mult: {
        value: 600, type: 'multiplier', label: 'Mult (none for best)'
    },
    antPercent: {
        value: 20, type: 'multiplier', label: 'Start % before'
    },
    max: {
        value: 100, type: 'multiplier', label: 'Max bet % (none for unlimited)'
    },
    multAfterKo: {
        value: 2, type: 'multiplier', label: 'Multiply bet for x after ko max bets'
    },
    baseBet: {
        value: 100, type: 'balance', label: 'Base Bet'
    },
    multAmount: {
         value: 2, type: 'multiplier', label: 'Mult base bet after mid*2 bets (none to disable)', optional: true,
    }
};

var timesBefore = (config.mult.value /100) * config.antPercent.value;
var multipler = 1;
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
        log("READY TO START! ", config.mult.value, 'x, mid: ', mid, ' ant:', timesBefore)
        started = true;
    }
    else
    if (!started) log('wait for data..');

    if (started)
    {
        if (currentTimes > (mid - timesBefore))
        {
            adjustCurrentBaseBet();
            if (((realPartialTimesBets  * 100) / config.mult.value) < config.mult.value)
                makeBet();
            else {
                multipler *= config.multAmount.value;
                log('skipping because ', ((realPartialTimesBets * 100) / config.mult.value).toFixed(2), '% >', config.multAmount.value, '% selected, multipler: ', multipler, ' new base bet: ', config.baseBet.value * multipler, ' bit')
                stats.push({status: 'skip', bets: currentTimes, realBets: realPartialTimesBets, date: new Date(), balance: - realPartialTimesBets * config.baseBet.value, mid: mid});
            }
        }
        else
        {
            log('skipping for other ', mid - currentTimes - timesBefore, ' times')
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
            stats.push({status: 'skip', bets: currentTimes, realBets: realPartialTimesBets, date: new Date(), balance: 0, mid: mid});
            skippedBets++;
            waitAndGrab();
        }
        else
        {
            log('bust:', lastGame.bust, 'x.. ');
        }
        return;
    }

    if (lastGame.cashedAt !== 0) {
        var profit = lastGame.cashedAt * lastGame.wager - lastGame.wager;
        log('WINSSS ', profit /100, ' bits , ROUND BALANCE: ', (profit - partialBets) /100, ', TOTAL PROFIT: ', totalProfits /100);
        if (lastGame.bust >= config.mult.value) {
            multipler = 1;
            totalProfits+= profit - partialBets;
            succBets++;
            stats.push({status: 'wins', bets: realPartialTimesBets, date: new Date(), balance: profit - partialBets , mid: mid});
            waitAndGrab();
        }
        else partialBets -= profit;
    } else {
        partialBets += currentBaseBet;
    }
}

function adjustCurrentBaseBet()
{

}

function makeBet() {
    if (!test) engine.bet(currentBaseBet * multipler, config.mult.value);
    realPartialTimesBets++;
    log('[', currentTimes  ,'<> BET ',realPartialTimesBets,'] ', (currentBaseBet * multipler) / 100, ' bit', config.mult.value, 'x (',(currentBaseBet / 100) * config.mult.value, ') - [PARTIAL: ', (partialBets /100).toFixed(2), '] [% ', ((realPartialTimesBets * 100) / config.mult.value).toFixed(2), ']');
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
    if (stats.length>0) {
        log('*** STATS ***');
        log(stats);
    }
}