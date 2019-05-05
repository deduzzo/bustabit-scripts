var config = {
    bet: { value: 1000, type: 'balance', label: 'bet'},
    p1: { value: 2, type: 'multiplier', label: 'Payout 1' },
    r1: { value: 6, type: 'multiplier', label: 'Late 1' },
    p2: { value: 3, type: 'multiplier', label: 'Payout 2' },
    r2: { value: 15, type: 'multiplier', label: 'Late 2' },
    p3: { value: 5, type: 'multiplier', label: 'Payout 3' },
    r3: { value: 20, type: 'multiplier', label: 'Late 3' },
    p4: { value: 8, type: 'multiplier', label: 'Payout 4' },
    r4: { value: 40, type: 'multiplier', label: 'Late 4' },
    p5: { value: 10, type: 'multiplier', label: 'Payout 5' },
    r5: { value: 50, type: 'multiplier', label: 'Late 5' },
    p6: { value: 15, type: 'multiplier', label: 'Payout 6' },
    r6: { value: 75, type: 'multiplier', label: 'Late 6' },
    p7: { value: 20, type: 'multiplier', label: 'Payout 7' },
    r7: { value: 100, type: 'multiplier', label: 'Late 7' },
    p8: { value: 30, type: 'multiplier', label: 'Payout 8' },
    r8: { value: 120, type: 'multiplier', label: 'Late 8' },
    p9: { value: 50, type: 'multiplier', label: 'Payout 9' },
    r9: { value: 150, type: 'multiplier', label: 'Late 9' },
    p10: { value: 100, type: 'multiplier', label: 'Payout 10' },
    r10: { value: 300, type: 'multiplier', label: 'Late 10' },
};


log('Script is running..');


// Always try to bet when script is started
engine.bet(100, 100);

engine.on('GAME_STARTING', onGameStarted);
engine.on('GAME_ENDED', onGameEnded);

let currentValue = -1;
const bet = config.bet.value;
let values = [];
let latesValue = [];
let k =0;

for (let i =1; i<11; i++) {
    let st = "p" + i.toString();
    values[(config[st].value).toString()] = calculateBets(config[st].value, 100, config[st].value * 15, false);
}

for (let key of Object.keys(values)) {
    if (key != "")
        latesValue[key] = 0;
}

function onGameStarted() {
    if (currentValue != -1) {
        log("T",k, ": bet ", roundBit(values[currentValue.toString()][k] * (config.bet.value / 100)) / 100, " on ", currentValue, "x");
        engine.bet(roundBit(values[currentValue.toString()][k] * (config.bet.value / 100)), currentValue);
        k++;
    }
}

function onGameEnded() {
    var lastGame = engine.history.first();
    latesValue = updateLates(lastGame.bust, latesValue);

    if (lastGame.wager) {
        log("Bust:", lastGame.bust);
        if (lastGame.cashedAt)
        {
            currentValue = -1;
            log(lastGame.bust, " WIN!!");
            k = 0;
        }
    }
    else {
        let val = findFirstLateValue(latesValue);
        currentValue = val;
        if (currentValue != -1)
            log("CurrentVALUE:", currentValue)
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


function updateLates(lastBust, lv)
{
    for (let key of Object.keys(lv)) {
        if (lastBust >= parseFloat(key))
            lv[key] = 0;
        else
            lv[key] = lv[key] +1;
    }
    return lv;
}

function findFirstLateValue(l)
{
    for (let i=10; i>0; i--)
    {
        if (l[config["p"+ i.toString()].value] > config["r"+ i.toString()].value)
            return config["p" + i.toString()].value;
    }
    return -1;
}