var config = {
    payout1: { value: 3, type: 'multiplier', label: 'Payout1' },
    baseBet1: { value: 500, type: 'balance', label: 'Base Bet1' },
    mult1: { value: 1.5, type: 'multiplier', label: 'mult1' },
    payout2: { value: 5, type: 'multiplier', label: 'payout2' },
    baseBet2: { value: 300, type: 'balance', label: 'Base Bet' },
    mult2: { value: 3, type: 'multiplier', label: 'mult2' },
    gameToPlayMax: { value: 2, type: 'multiplier', label: 'gameto play max' },
    percGame1: { value: 60, type: 'multiplier', label: '%game1' },
    percPause: { value: 5, type: 'multiplier', label: '%pause' },
    totalParallelsGame: { value: 1000, type: 'multiplier', label: 'TotalGames' },
};

let currentRound = 0;
let currentGame = 0;
let games = [];
let maxT = 0;
let pause = false;
let gameToPlay = 0;

for (var i =0;i<config.totalParallelsGame.value; i++)
{
    if (getRandomInt(0,100) <config.percGame1.value)
        games[i] = {currentBet: config.baseBet1.value, amount: 0, currentTimes: 0, payout: config.payout1.value, mult: config.mult1.value}
    else
        games[i] = {currentBet: config.baseBet2.value, amount: 0, currentTimes: 0, payout: config.payout2.value, mult: config.mult2.value}
}


showStats(config.baseBet1.value,config.mult1.value);
showStats(config.baseBet2.value,config.mult2.value);



engine.on('GAME_STARTING', onGameStarted);
engine.on('GAME_ENDED', onGameEnded);


function onGameStarted() {
    if (!pause) {
        log('R ', ++currentRound, "GAME", (currentGame + 1).toString(), " T", games[currentGame].currentTimes, ' - bet', Math.round(games[currentGame].currentBet / 100), 'on', games[currentGame].payout, 'x - MAXT:', maxT, " TOT: ", Math.round(games[currentGame].amount / 100));
        engine.bet(games[currentGame].currentBet, games[currentGame].payout);
    }
    else
    {
        log("PAUSE!");
        pause = false;
    }

}

function onGameEnded() {
    var lastGame = engine.history.first();

    if (lastGame.wager) {
        if (games[currentGame].currentTimes > maxT)
            maxT = games[currentGame].currentTimes;

        if (lastGame.cashedAt) {
            log("bust ", lastGame.bust, " WIN!");
            gameToPlay =0;
            // we won
            if (getRandomInt(0,100) <config.percGame1.value)
                games[currentGame] = {currentBet: config.baseBet1.value, amount: 0, currentTimes: 0, payout: config.payout1.value, mult: config.mult1.value}
            else
                games[currentGame] = {currentBet: config.baseBet2.value, amount: 0, currentTimes: 0, payout: config.payout2.value, mult: config.mult2.value}
        } else {
            gameToPlay--;
            // we lost
            log("bust ", lastGame.bust, " LOST :(");
            games[currentGame].amount = games[currentGame].amount + lastGame.wager;
            games[currentGame].currentTimes = games[currentGame].currentTimes + 1;
            games[currentGame].currentBet = games[currentGame].currentBet * games[currentGame].mult;
        }

        if (gameToPlay === 0) {
            gameToPlay = getRandomInt(0, config.gameToPlayMax.value) + 1;
            if (getRandomInt(0, 100) > config.percPause.value)
                currentGame = getRandomInt(0, config.totalParallelsGame.value);
            else
                pause = true;
        }
    }

}

function showStats(initBet, mult)
{
    let i;
    let count = 0;
    let bet = initBet;
    log("------ INFO -----")
    for (i =0; i<40; i++)
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