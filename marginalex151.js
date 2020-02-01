var config = {
    payout: { value: 3, type: 'multiplier', label: 'Mult' },
    baseBet: { value: 1000, type: 'balance', label: 'Base Bet' },
    mult: { value: 1.5, type: 'multiplier', label: 'x after KO' },
    totalParallelsGame: { value: 4, type: 'multiplier', label: 'TotalGames' },

};

let currentRound = 0;
let currentGame = 0;
let games = [];

for (var i =0;i<config.totalParallelsGame.value; i++)
{
    games[i] = {currentBet: config.baseBet.value, amount: 0}
}


showStats(currentBet,increaseMult);


engine.on('GAME_STARTING', onGameStarted);
engine.on('GAME_ENDED', onGameEnded);


function onGameStarted() {

                log('R ', ++currentRound, "G", currentGame,' - bet', Math.round(games[currentGame].currentBet / 100), 'on', config.payout.value, 'x', " TOT: ",Math.round(games[currentGame].currentAmount / 100));
                engine.bet(games[currentGame].currentBet, payout);

}

function onGameEnded() {
    var lastGame = engine.history.first();

    // If we wagered, it means we played
    if (!lastGame.wager) {
        if ((lateTimes > 0 || lastGame.bust >= payout) && !freezing) {
            if (lastGame.bust >= payout) {
                timesToStart = lateTimes;
                log('bust ', lastGame.bust, ' resetting late time, wait for other ', timesToStart)
            }
            else if (timesToStart > 0) {
                timesToStart--;
                log('bust ', lastGame.bust, timesToStart == 0 ? ' ready to play!' : (' wait for other ' + timesToStart))
            }
        }
    }
    else if (timesToStart==0) {
        // we play..
        if (lastGame.cashedAt) {
            // we won
            if (game2Count>0)
            {
                log('GAME2 WIN, bust',lastGame.bust);
                currentBet = freezegame.currentBet;
                currentAmount = freezegame.currentAmount;
                freezegame = {currentAmount: null, currentBet: null};
                currentRoundValues = [];
                game2Count = 0;
                payout = config.payout.value;
                currentAmount = 0;
            }
            else
            {
                currentBet = config.baseBet.value;
                currentAmount = 0;
            }
            currentTimes = 0;
            if (disasterWaits >0 && freezing) disasterToStart = disasterWaits;
            freezing = false;
            log('We won, so next bet will be', currentBet / 100, 'bits')
            if (lateTimes >0) timesToStart = lateTimes;
        } else if (maxTimes >0 && currentTimes >= maxTimes) {
            log('Was about to bet', currentTimes, '> max bet times, so restart.. :(');
            if (disasterWaits >0) disasterToStart = disasterWaits;
            disaster++;
            currentTimes = 0;
            currentBet = config.baseBet.value;
            if (lateTimes > 0) timesToStart = lateTimes;
            }
        else {
            // we lost
            if (!(strategy == 'freeze' && currentTimes >= freezeFrom))
                currentBet = Math.ceil((currentBet / 100) * increaseMult) * 100;
            else
                freezing = true;
            if (strategy == 'maxBets' && currentBet >= betLimit) {
                log('Was about to bet', currentBet, '> betlimit ', betLimit / 100, ', so restart.. :(');
                disaster++;
                freezing = false;
                if (disasterWaits >0) disasterToStart = disasterWaits;
                currentTimes = 0;
                currentBet = config.baseBet.value;
                if (lateTimes > 0) timesToStart = lateTimes;
            } else {
                // we lost
                var t = tFromArray(currentRoundValues, config.payout2.value);
                //log('GAME3:', t);
                //log(currentRoundValues);
                if (t> config.late2.value)
                {
                    if (game2Count===0)
                    {
                        game2TotalCount++;
                        freezegame.currentAmount = currentAmount;
                        freezegame.currentBet = currentBet;
                        payout = config.payout2.value;
                        currentBet = currentAmount * (currentAmount / (currentAmount * (config.payout2.value - 1)));
                        payout = config.payout2.value;
                    }
                    else {
                        currentBet = currentBet * config.mult2.value;
                    }
                    game2Count++;
                    log('GAME2: current bet', currentBet / 100, 'bits on ', payout)
                }
                currentAmount += lastGame.wager;
                currentTimes++;
                if (currentBet > maxBets) {
                    maxBets = currentBet;
                }
                if (currentTimes > maxTimesEver)
                    maxTimesEver = currentTimes;
            }
        }
        if (disasterToStart == 0)
            log('bust ', lastGame.bust, ', LOST, so', Math.round(currentBet / 100).toFixed(2), 'bits - T:', currentTimes, ' - MAXT:' + maxTimesEver); //, maxb = ', Math.round(maxBets / 100), '- T:', currentTimes, ' - MAXT:' + maxTimesEver , strategy == 'maxBets' ? (' MAXB: ' + betLimit / 100) : (strategy == 'freeze') ? ('FR.AT: ' + freezeFrom) : (''))
        }
}

function showStats(initBet, mult)
{
    let i;
    let count = 0;
    let bet = initBet;
    log("------ INFO -----")
    for (i =0; i<60; i++)
    {
        count+=bet;
        log('T:',i,' - bet:', (bet /100).toLocaleString('de-DE'), ' - tot: ', (count /100) .toLocaleString('de-DE'));
        bet = Math.ceil((bet /100) * mult) * 100;
    }
}

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min)) + min; //Il max è escluso e il min è incluso
}

function tFromArray(array, val) {
    let i =0;
    for (i = 0; i<array.length && array[i]<=val; i++);
    return i;
}