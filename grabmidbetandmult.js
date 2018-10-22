var config = {
    mult: {
        value: 10, type: 'multiplier', label: 'Mult (none for best)'
    },
    percent: {
        value: 40, type: 'multiplier', label: 'Start %'
    },
    strategy: {
        value: 'perc80x5', type: 'radio', label: 'Strategy:',
        options: {
            perc80x5: { value: 'perc80x5', type: 'noop', label: 'bet for 80% - mult 5x after loss' },
            perc90x10: { value: 'perc90x10', type: 'noop', label: 'bet for 90% - mult 10x after loss' },
        }
    },
    midMethod: {
        value: 'mult', type: 'radio', label: 'Mid method;',
        options: {
            mult: { value: 'mult', type: 'noop', label: 'Use Mult (no online)' },
            multg: { value: 'multg', type: 'noop', label: 'Use Mult (online times check)' },
            grab: { value: 'grab', type: 'noop', label: 'Grab All Online' },
        }
    },
    maxiterations: {
        value: 6, type: 'multiplier', label: 'Max Iterations (disaster recovery)'
    },
    percentinc: {
        value: 10, type: 'multiplier', label: 'Percent inc per iterations'
    },
    baseBet: {
        value: 100, type: 'balance', label: 'Base Bet'
    },
};

var percentToStart = config.percent.value;
var currentTimesFetched = false;
var midFetched = false;
var started = false;
var incremented = false;
var currentTimes = 0;
var mid = 0;
var max = config.strategy.value === 'perc80x5' ? 80 : 90;
var multAfterKo = config.strategy.value === 'perc80x5' ? 5 : 10;
var iteration = 1;

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

fetchData(config.midMethod.value === 'grab');

function onGameStarted() {
    if (!started && midFetched && currentTimesFetched) {
        log("READY TO START! ", config.mult.value, 'x, mid: ', mid, ' start at:', Math.round((mid /100) * percentToStart), '(', percentToStart,'%) - max% =', max,' mult after ko:', multAfterKo);
        started = true;
    }
    else
    if (!started) log('wait for data..');

    if (started)
    {
        if (currentTimes >= Math.round(((mid /100) * percentToStart)))
        {
            if (((realPartialTimesBets  * 100) / config.mult.value) < max)
                makeBet();
            else {
                if (!incremented) {
                    if (iteration < config.maxiterations.value) {
                        iteration++;
                        incremented = true;
                        currentBaseBet *= multAfterKo;
                        percentToStart += config.percentinc.value;
                        stats.push({
                            status: 'lost',
                            bets: currentTimes,
                            realBets: realPartialTimesBets,
                            date: new Date(),
                            balance: ((-realPartialTimesBets * config.baseBet.value) / 100).toFixed(2),
                            mid: mid
                        });
                    }
                    else
                    {
                        log('Max Number of iteration reached, restart!!!');
                        if (config.baseBet.value < currentBaseBet)
                        {
                            incremented = false;
                            currentBaseBet = config.baseBet.value;
                        }
                        totalProfits+= profit - partialBets;
                        percentToStart = config.percent.value;
                        iteration = 0;
                        stats.push({status: 'reset', bets: realPartialTimesBets, date: new Date(), balance: (profit - partialBets) /100 , mid: mid});
                        waitAndGrab(config.midMethod.value === 'mult' || config.midMethod.value === 'multg');
                    }
                }
                log('skipping because % >', max, ' - multipler: ', multAfterKo, ' new base bet: ', currentBaseBet /100, ' bit')
            }
        }
        else
        {
            log('skipping for other ', Math.round((mid /100) * percentToStart) - currentTimes, ' times')
        }
    }
}

function onGameEnded() {
    var lastGame = engine.history.first();
    if(started) currentTimes++;
    if (currentTimes % 50 == 0 && started) showStats();

    if (lastGame.bust >= config.mult.value)
    {
        incremented = false;
        log('bust: ',lastGame.bust, 'x :( resetting count');
        stats.push({status: 'skip', bets: currentTimes, realBets: realPartialTimesBets, date: new Date(), balance: 0, mid: mid});
        skippedBets++;
        waitAndGrab(config.midMethod.value === 'mult' || config.midMethod.value === 'multg');
    }
    else
    {
        log('bust:', lastGame.bust, 'x.. ');
    }
    return;

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
            percentToStart = config.percent.value;
            iteration = 1;
            stats.push({status: 'wins', bets: realPartialTimesBets, date: new Date(), balance: (profit - partialBets) /100 , mid: mid});
            waitAndGrab(config.midMethod.value === 'mult' || config.midMethod.value === 'multg');
        }
        else partialBets -= profit;
    } else {
        partialBets += currentBaseBet;
    }
}

function makeBet() {
    if (!test) engine.bet(currentBaseBet, config.mult.value);
    realPartialTimesBets++;
    log('[', currentTimes  ,'<> BET ',realPartialTimesBets,' IT:',iteration,'] ', currentBaseBet  / 100, ' bit', config.mult.value, 'x (',(currentBaseBet / 100) * config.mult.value, ') - [PARTIAL: ', (partialBets /100).toFixed(2), '] [% ', ((realPartialTimesBets * 100) / config.mult.value).toFixed(2), ']');
}

function fetchData() {
    if (config.midMethod.value === 'grab') {
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
    else
    {
        mid = config.mult.value;
        midFetched = true;
        log('mid = ', mid);
        if (config.midMethod.value === 'mult')
        {
            currentTimes = 0;
            currentTimesFetched = true;
            log('currentTimes = ', currentTimes)
        }
        else
            fetch('https://server2.erainformatica.it:3001/busts/fromLastBust/' + config.mult.value).then(response => response.json())
                .then(json => {
                    currentTimes = json.times;
                    currentTimesFetched = true;
                    log('currentTimes = ', currentTimes)
                });
    }
}

function waitAndGrab(grab)
{
    mid = 0;
    currentTimes = 0;
    realPartialTimesBets = 0;
    partialBets = 0;
    midFetched = false;
    currentTimesFetched = false;
    started = false;
    if (grab) {
        log("10 sec to reload data...");
        setTimeout(fetchData, 10000);
    }
    else
        fetchData();
}

function showStats()
{
    if (stats.length>0) {
        log('*** STATS ***');
        log(stats);
    }
}