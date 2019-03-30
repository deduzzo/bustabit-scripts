var config = {
    bet: {
        value: 100,
        type: 'balance'
    },
    mult: { value: 10, type: 'multiplier', label: 'Max Mult'},
};


log('Script is running..');


// Always try to bet when script is started
engine.bet(1, 1.01);

engine.on('GAME_STARTING', onGameStarted);
engine.on('GAME_ENDED', onGameEnded);

calculateBets(config.mult.value, config.bet.value,Math.round(config.mult.value * 12.22));


function onGameStarted() {

}

function onGameEnded(info) {

}

function calculateBets(mult,initBet,desideredT)
{
    let i;
    let gain = (mult * initBet) - mult;
    let amount = initBet;
    let lastBet = 0;
    let nextBet = 0;
    log("T:", 0, " - bet: ", printBit(initBet, 0), " - TOT:", printBit(initBet, 1));
    for (i=1; i<desideredT; i++)
    {
        lastBet = nextBet;
        amount += lastBet;
        nextBet = roundBit((amount + gain) / mult);
        log("T:", i, " - bet: ", printBit(nextBet, 0), " - TOT:", printBit(amount, 1));
    }
}

function roundBit(bet) {
    return Math.round(bet / 100) * 100;
}


function printBit(bet, fixed) {
    let suffix = "";
    if (bet > 10000000 && bet <100000000)
        suffix = "k";
    else if (bet >100000000)
        suffix = "M";
    return (bet / (suffix == "" ? 100 : (suffix == "k" ? 100000 : (suffix == "M" ? 100000000 : "")))).toFixed(fixed).toLocaleString('de-DE') + suffix;
}