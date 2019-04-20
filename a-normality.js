var config = {
    bet: { value: 1500, type: 'balance' },
    payout: { value: 15, type: 'multiplier' },
    offset: { value: 10, type: 'multiplier' },
    av: { value: 10, type: 'multiplier' },
};


log('Script is running..');


// Always try to bet when script is started
engine.bet(100, config.payout.value);

engine.on('GAME_STARTING', onGameStarted);
engine.on('GAME_ENDED', onGameEnded);

let i = 0;
let k = 0;
const payout = config.payout.value;
const bet = config.bet.value;
const av = config.av.value;
const offset = config.offset.value;
let values = calculateBets(parseFloat(payout) , bet,parseFloat(payout) * 10, false);

function onGameStarted() {
    if (i>= (av - offset) && i<= (av +offset)) {
        log("bet", values[k]);
        engine.bet(values[k], payout);
        k++;
    }
}

function onGameEnded() {
    var lastGame = engine.history.first();

    // we won..
    if (lastGame.cashedAt) {
        i=0;
        k=0;
    }
    if (lastGame.bust < payout)
        i++;
    else
        i=0;
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
