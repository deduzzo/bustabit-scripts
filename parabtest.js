var config = {
    bet: {
        value: 3000,
        type: 'balance'
    },
};


log('Script is running..');

const values=[2.12, 2.78, 3.5, 4.32, 5.23, 6.82, 7.54, 8.12, 9.1, 10.23, 11.32, 12.34, 13.51, 14.82, 15.3, 15.92];
const progressions = []
let currentxIndex = 0;
for (var n =0; n< values.length; n++)
    progressions[n] = calculateBets(values[n], config.bet.value,Math.round(values[currentxIndex] * 13), false);
let i = 0;


engine.on('GAME_STARTING', onGameStarted);
engine.on('GAME_ENDED', onGameEnded);



function onGameStarted() {
    log ("T", i , " - Bet ", roundBit(progressions[currentxIndex][i]) / 100, " on", values[currentxIndex]);
    engine.bet(roundBit(progressions[currentxIndex][i]), values[currentxIndex]);
}

function onGameEnded(info) {
    var lastGame = engine.history.first()
    // If we wagered, it means we played
    if (!lastGame.wager) {
        return;
    }

    // we won..
    if (lastGame.cashedAt) {
        currentxIndex = (Math.floor(Math.random() * (values.length -1))) / 100;
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