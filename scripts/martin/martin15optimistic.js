var config = {
    payout: { value: 3, type: 'multiplier', label: 'Payout1' },
    baseBet: { value: 500, type: 'balance', label: 'Base Bet1' },
    mult: { value: 1.5, type: 'multiplier', label: 'mult1' },
    totalParallelsGame: { value: 1000, type: 'multiplier', label: 'TotalGames' },
};

let currentRound = 0;
let amount = 0;
let maxT = 0;
let currentBet= config.baseBet.value;
let currentTimes = 0;
let play = true;
let games = [];
let currentGame  = -1;


showStats(config.baseBet.value,config.mult.value);

for (var i =0;i<config.totalParallelsGame.value; i++)
    games[i] = {currentBet: config.baseBet.value, amount: 0, currentTimes: 0}


engine.on('GAME_STARTING', onGameStarted);
engine.on('GAME_ENDED', onGameEnded);


function onGameStarted() {

    currentGame = getRandomInt(0, config.totalParallelsGame.value);
    if (play) {
        log('R ', ++currentRound, " - G", currentGame, " - T", games[currentGame].currentTimes, ' - bet', config.payout.value, 'x - MAXT:', maxT, " TOT: ", Math.round(games[currentGame].amount / 100));
        engine.bet(games[currentGame].currentBet, config.payout.value);
    }
}

function onGameEnded() {
    var lastGame = engine.history.first();

    if (lastGame.wager) {
        if (games[currentGame].currentTimes > maxT)
            maxT = games[currentGame].currentTimes;
        if (lastGame.cashedAt) {
            log("bust ", lastGame.bust, " WIN!");
            games[currentGame].currentBet= config.baseBet.value;
            games[currentGame].amount = 0;
            games[currentGame].currentTimes = 0;
        }
        else
        {
            // we lost
            log("bust ", lastGame.bust, " LOST :(");
            games[currentGame].amount = games[currentGame].amount + lastGame.wager;
            games[currentGame].currentTimes = games[currentGame].currentTimes +1;
            games[currentGame].currentBet = games[currentGame].currentBet * config.mult.value;
        }
    }

    if (play == true)
        play = false;
    else if (lastGame.bust>= config.payout.value)
        play = true;
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