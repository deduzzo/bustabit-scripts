var config = {
    p1: { value: 1.16, type: 'multiplier', label: '===> P1' },
    r1: { value: 6, type: 'multiplier', label: 'Late 1' },
    b1: { value: 9900000, type: 'balance', label: 'Bet 1'},
    p2: { value: 1.5, type: 'multiplier', label: '===> P2' },
    r2: { value: 11, type: 'multiplier', label: 'Late 2' },
    b2: { value: 9900000, type: 'balance', label: 'Bet 2'},
    p3: { value: 2, type: 'multiplier', label: '===> P3' },
    r3: { value: 11, type: 'multiplier', label: 'Late 3' },
    b3: { value: 30000, type: 'balance', label: 'Bet 3'},
    p4: { value: 3, type: 'multiplier', label: '===> P4' },
    r4: { value: 20, type: 'multiplier', label: 'Late 4' },
    b4: { value: 12000, type: 'balance', label: 'Bet 4'},
    p5: { value: 5, type: 'multiplier', label: '===> P5' },
    r5: { value: 34, type: 'multiplier', label: 'Late 5' },
    b5: { value: 10000, type: 'balance', label: 'Bet 5'},
    p6: { value: 10, type: 'multiplier', label: '===> P6' },
    r6: { value: 66, type: 'multiplier', label: 'Late 6' },
    b6: { value: 10000, type: 'balance', label: 'Bet 6'},
    p7: { value: 20, type: 'multiplier', label: '===> P7' },
    r7: { value: 166, type: 'multiplier', label: 'Late 7' },
    b7: { value: 10000, type: 'balance', label: 'Bet 7'},
    p8: { value: 40, type: 'multiplier', label: '===> P8' },
    r8: { value: 300, type: 'multiplier', label: 'Late 8' },
    b8: { value: 4000, type: 'balance', label: 'Bet 8'},
    p9: { value: 50, type: 'multiplier', label: '===> P9' },
    r9: { value: 351, type: 'multiplier', label: 'Late 9' },
    b9: { value: 4000, type: 'balance', label: 'Bet 9'},
    p10: { value: 100, type: 'multiplier', label: '===> P10' },
    r10: { value: 800, type: 'multiplier', label: 'Late 10' },
    b10: { value: 2000, type: 'balance', label: 'Bet 10'},
    p11: { value: 200, type: 'multiplier', label: '===> P11' },
    r11: { value: 1400, type: 'multiplier', label: 'Late 11' },
    b11: { value: 1200, type: 'balance', label: 'Bet 11'},
    p12: { value: 300, type: 'multiplier', label: '===> P12' },
    r12: { value: 1850, type: 'multiplier', label: 'Late 12' },
    b12: { value: 1200, type: 'balance', label: 'Bet 12'},
    p13: { value: 500, type: 'multiplier', label: '===> P13' },
    r13: { value: 2450, type: 'multiplier', label: 'Late 13' },
    b13: { value: 1000, type: 'balance', label: 'Bet 13'},
    p14: { value: 600, type: 'multiplier', label: '===> P14' },
    r14: { value: 3200, type: 'multiplier', label: 'Late 14' },
    b14: { value: 1000, type: 'balance', label: 'Bet 14'},
    p15: { value: 800, type: 'multiplier', label: '===> P15' },
    r15: { value: 3900, type: 'multiplier', label: 'Late 15' },
    b15: { value: 1000, type: 'balance', label: 'Bet 15'},
    p16: { value: 1000, type: 'multiplier', label: '===> P16' },
    r16: { value: 4400, type: 'multiplier', label: 'Late 16' },
    b16: { value: 1000, type: 'balance', label: 'Bet 16'},
    p17: { value: 2000, type: 'multiplier', label: '===> P17' },
    r17: { value: 10000, type: 'multiplier', label: 'Late 17' },
    b17: { value: 500, type: 'balance', label: 'Bet 17'},
    p18: { value: 4000, type: 'multiplier', label: '===> P18' },
    r18: { value: 17000, type: 'multiplier', label: 'Late 18' },
    b18: { value: 400, type: 'balance', label: 'Bet 18'},
    p19: { value: 7000, type: 'multiplier', label: '===> P19' },
    r19: { value: 30000, type: 'multiplier', label: 'Late 19' },
    b19: { value: 200, type: 'balance', label: 'Bet 19'},
    p20: { value: 10000, type: 'multiplier', label: '===> P20' },
    r20: { value: 28000, type: 'multiplier', label: 'Late 20' },
    b20: { value: 100, type: 'balance', label: 'Bet 20'},
    multx: { value: 2, type: 'multiplier', label: 'Mult All Bet for x'},
    balance: { value: 10000000, type: 'balance', label: 'Balance to use'},
};


log('Script is running..');


engine.on('GAME_STARTING', onGameStarted);
engine.on('GAME_ENDED', onGameEnded);

let currentValue = -1;
let values = [];
let latesValue = [];
let playedGames = [];
let k =0;
let multFactor = 1;

for (let i =1; i<21; i++) {
    let st = "p" + i.toString();
    values[(config[st].value).toString()] = calculateBets(config[st].value, 100, config[st].value * 10, false);
}

for (let key of Object.keys(values)) {
    if (key != "") {
        latesValue[key] = 0;
        playedGames[key] = 0;
    }
}

showMax();

function onGameStarted() {
    if (currentValue != -1) {
        log("T",k, ": bet ", roundBit((values[currentValue.toString()][k] * multFactor * config.multx.value)) / 100, " on ", currentValue, "x");
        engine.bet(roundBit(values[currentValue.toString()][k] * multFactor * config.multx.value), currentValue);
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
            showGames();
            k = 0;
        }
    }
    else {
        let index = findFirstLateValue(latesValue);
        if (index != -1) {
            currentValue = config["p" + index.toString()].value;
            multFactor = config["b" + index.toString()].value / 100;
            log("CurrentVALUE:", currentValue)
            playedGames[currentValue.toString()] = playedGames[currentValue.toString()]+1;
        }
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
    for (let i=20; i>0; i--)
    {
        if (l[config["p"+ i.toString()].value] > config["r"+ i.toString()].value)
            return i;
    }
    return -1;
}

function showGames()
{
    log("STATS:");
    let str = "";
    for (let i=1; i<21; i++)
    {
        str += config["p"+ i.toString()].value + ": " + playedGames[(config["p"+ i.toString()].value).toString()] +" - ";
    }
    log (str.substr(0,str.length -2));
}

function showMax()
{
    let amount = 0;
    log("max");
    for (let i=1; i<21; i++)
    {
        let k = 0;
        while (config.balance.value> amount) {
            amount += roundBit(values[(config["p" + i.toString()].value).toString()][k++] * (config["b" + i.toString()].value / 100) * config.multx.value);
        }
        k--;
        log (config["p" + i.toString()].value, " ->", config["r" + i.toString()].value, " + ", k, " =", config["r" + i.toString()].value + k);
        amount = 0;
        k=0;
    }

}