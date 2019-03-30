var config = {
    bet: {
        value: 3000,
        type: 'balance'
    },
};


log('Script is running..');

const min = 111;
const max = 1599;
let currentx = (Math.floor(Math.random() * (max - min)) + min) / 100;
let progression = calculateBets(currentx, config.bet.value,Math.round(currentx * 13), false);
let i = 0;


engine.on('GAME_STARTING', onGameStarted);
engine.on('GAME_ENDED', onGameEnded);



function onGameStarted() {
    log ("T", i , " - Bet ", roundBit(progression[i]) / 100, " on", currentx);
    engine.bet(roundBit(progression[i]), currentx);
}

function onGameEnded(info) {
    var lastGame = engine.history.first()
    // If we wagered, it means we played
    if (!lastGame.wager) {
        return;
    }

    // we won..
    if (lastGame.cashedAt) {
        currentx = (Math.floor(Math.random() * (max - min)) + min) / 100;
        progression = calculateBets(currentx, config.bet.value,Math.round(currentx * 13), false);
        i = 0;
    } else {
        i++;
    }
}

function calculateBets(mult,initBet,desideredT, verbose)
{
    let progression = [];
    progression[0] = initBet;
    let i;
    let gain = (mult * initBet) - initBet;
    let amount = 0;
    let lastBet = initBet;
    for (i=0; i<desideredT; i++)
    {
        amount += lastBet;
        if (verbose) log("T:", i, " - bet: ", printBit(lastBet), " - TOT:", printBit(amount), "G:",printBit((lastBet * mult) - amount));
        let tempBet = (amount) / mult;
        do {
                tempBet+= 100;
        } while (((tempBet * mult) - tempBet - amount) <= gain)
        lastBet = roundBit(tempBet);
        progression[i+1] = lastBet;
    }
    return progression;
}

function roundBit(bet) {
    return Math.round(bet / 100) * 100;
}


function printBit(bet) {
    let suffix = "";
    if (bet > 10000000 && bet <100000000)
        suffix = "k";
    else if (bet >100000000)
        suffix = "M";
    return (bet / (suffix == "" ? 100 : (suffix == "k" ? 100000 : (suffix == "M" ? 100000000 : "")))).toLocaleString('de-DE') + suffix;
}