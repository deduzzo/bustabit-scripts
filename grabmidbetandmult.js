var config = {
    mult: {
        value: 600, type: 'multiplier', label: 'Mult (none for best)'
    },
    antPercent: {
        value: 20, type: 'multiplier', label: 'Start % before'
    },
    strategy: {
        value: 'perc80x5', type: 'radio', label: 'Strategy',
        options: {
            perc80x5: { value: 'perc80x5', type: 'noop', label: 'bet for 80% - mult 5x after loss' },
            perc90x10: { value: 'perc90x10', type: 'noop', label: 'bet for 90% - mult 10x after loss' },
        }
    },
    baseBet: {
        value: 100, type: 'balance', label: 'Base Bet'
    },
};

var timesBefore = (config.mult.value /100) * config.antPercent.value;
var currentTimesFetched = false;
var midFetched = false;
var started = false;
var incremented = false;
var currentTimes = 0;
var mid = 0;
var max = config.strategy.value === 'perc80x5' ? 80 : 90;
var multAfterKo = config.strategy.value === 'perc80x5' ? 5 : 10;

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
        log("READY TO START! ", config.mult.value, 'x, mid: ', mid, ' ant:', timesBefore, ' max% =', max,' mult after ko:', multAfterKo);
        started = true;
    }
    else
    if (!started) log('wait for data..');

    if (started)
    {
        if (currentTimes > (mid - timesBefore))
        {
            if (((realPartialTimesBets  * 100) / config.mult.value) < max)
                makeBet();
            else {
                if (!incremented) {
                    incremented = true;
                    currentBaseBet *= multAfterKo;
                    stats.push({
                        status: 'lost',
                        bets: currentTimes,
                        realBets: realPartialTimesBets,
                        date: new Date(),
                        balance: ((-realPartialTimesBets * config.baseBet.value) / 100).toFixed(2),
                        mid: mid
                    });
                }
                log('skipping because % >', max, ' - multipler: ', multAfterKo, ' new base bet: ', currentBaseBet, ' bit')
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
            incremented = false;
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
        if (lastGame.cashedAt >= config.mult.value) {
            if (config.baseBet.value < currentBaseBet)
            {
                incremented = false;
                currentBaseBet = config.baseBet.value;
            }
            totalProfits+= profit - partialBets;
            succBets++;
            stats.push({status: 'wins', bets: realPartialTimesBets, date: new Date(), balance: (profit - partialBets) /100 , mid: mid});
            waitAndGrab();
        }
        else partialBets -= profit;
    } else {
        partialBets += currentBaseBet;
    }
}

function makeBet() {
    if (!test) engine.bet(currentBaseBet, config.mult.value);
    realPartialTimesBets++;
    log('[', currentTimes  ,'<> BET ',realPartialTimesBets,'] ', currentBaseBet  / 100, ' bit', config.mult.value, 'x (',(currentBaseBet / 100) * config.mult.value, ') - [PARTIAL: ', (partialBets /100).toFixed(2), '] [% ', ((realPartialTimesBets * 100) / config.mult.value).toFixed(2), ']');
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