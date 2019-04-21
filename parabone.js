var config = {
    bet: { value: 1500, type: 'balance' },
    payout: { value: 15, type: 'multiplier' },
};


log('Script is running..');


// Always try to bet when script is started
engine.bet(100, config.payout.value);

engine.on('GAME_STARTING', onGameStarted);
engine.on('GAME_ENDED', onGameEnded);

let k = 0;
const payout = config.payout.value;
const bet = config.bet.value;
let values = calculateBets(parseFloat(payout) , bet,parseFloat(payout) * 10, false);

function onGameStarted() {
        log(k, " bet ", roundBit(values[k]) / 100);
        engine.bet(values[k], payout);
        k++;
}

function onGameEnded() {
    var lastGame = engine.history.first();

    // we won..
    if (lastGame.cashedAt) {
        k=0;
    }
}


function calculateBets(mult,initBet,desideredT, verbose)
{
    let progression = [];
    progression[0] = initBet;
    let k;
    let gain = mult > 1.12 ? (mult * initBet) - initBet : 10000;
    let amount = 0;
    let lastBet = initBet;
    for (k=0; k<desideredT; k++)
    {
        amount += lastBet;
        if (verbose) log("T:", k, " - bet: ", printBit(lastBet), " - TOT:", printBit(amount), "G:",printBit((lastBet * mult) - amount));
        let tempBet = (amount) / mult;
        do {
            if (mult <2)
                tempBet += 10000;
            else
                tempBet+= 100;
        } while (((tempBet * mult) - tempBet - amount) <= gain)
        lastBet = roundBit(tempBet);
        progression[k+1] = lastBet;
    }
    return progression;
}

function roundBit(bet) {
    return Math.round(bet / 100) * 100;
}
