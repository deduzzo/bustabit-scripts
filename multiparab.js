var config = {
    p1: { value: 1.16, type: 'multiplier', label: '===> P1' },
    r1: { value: 4, type: 'multiplier', label: 'Late 1' },
    b1: { value: 0, type: 'balance', label: 'Bet 1'},
    m1: { value: 7, type: 'multiplier', label: 'Max 1 (for Auto)'},
    p2: { value: 1.5, type: 'multiplier', label: '===> P2' },
    r2: { value: 7, type: 'multiplier', label: 'Late 2' },
    b2: { value: 0, type: 'balance', label: 'Bet 2'},
    m2: { value: 12, type: 'multiplier', label: 'Max 2 (for Auto)'},
    p3: { value: 2, type: 'multiplier', label: '===> P3' },
    r3: { value: 10, type: 'multiplier', label: 'Late 3' },
    b3: { value: 0, type: 'balance', label: 'Bet 3'},
    m3: { value: 18, type: 'multiplier', label: 'Max 3 (for Auto)'},
    p4: { value: 2.50, type: 'multiplier', label: '===> P4' },
    r4: { value: 13, type: 'multiplier', label: 'Late 4' },
    b4: { value: 0, type: 'balance', label: 'Bet 4'},
    m4: { value: 23, type: 'multiplier', label: 'Max 4 (for Auto)'},
    p5: { value: 3, type: 'multiplier', label: '===> P5' },
    r5: { value: 17, type: 'multiplier', label: 'Late 5' },
    b5: { value: 0, type: 'balance', label: 'Bet 5'},
    m5: { value: 34, type: 'multiplier', label: 'Max 5 (for Auto)'},
    p6: { value: 4, type: 'multiplier', label: '===> P6' },
    r6: { value: 25, type: 'multiplier', label: 'Late 6' },
    b6: { value: 0, type: 'balance', label: 'Bet 6'},
    m6: { value: 44, type: 'multiplier', label: 'Max 6 (for Auto)'},
    p7: { value: 5, type: 'multiplier', label: '===> P7' },
    r7: { value: 40, type: 'multiplier', label: 'Late 7' },
    b7: { value: 0, type: 'balance', label: 'Bet 7'},
    m7: { value: 56, type: 'multiplier', label: 'Max 7 (for Auto)'},
    p8: { value: 8, type: 'multiplier', label: '===> P8' },
    r8: { value: 60, type: 'multiplier', label: 'Late 8' },
    b8: { value: 0, type: 'balance', label: 'Bet 8'},
    m8: { value: 86, type: 'multiplier', label: 'Max 8 (for Auto)'},
    p9: { value: 10, type: 'multiplier', label: '===> P9' },
    r9: { value: 70, type: 'multiplier', label: 'Late 9' },
    b9: { value: 0, type: 'balance', label: 'Bet 9'},
    m9: { value: 105, type: 'multiplier', label: 'Max 9 (for Auto)'},
    p10: { value: 12, type: 'multiplier', label: '===> P10' },
    r10: { value: 90, type: 'multiplier', label: 'Late 10' },
    b10: { value: 0, type: 'balance', label: 'Bet 10'},
    m10: { value: 122, type: 'multiplier', label: 'Max 10 (for Auto)'},
    p11: { value: 20, type: 'multiplier', label: '===> P11' },
    r11: { value: 150, type: 'multiplier', label: 'Late 11' },
    b11: { value: 0, type: 'balance', label: 'Bet 11'},
    m11: { value: 232, type: 'multiplier', label: 'Max 11 (for Auto)'},
    p12: { value: 30, type: 'multiplier', label: '===> P12' },
    r12: { value: 200, type: 'multiplier', label: 'Late 12' },
    b12: { value: 0, type: 'balance', label: 'Bet 12'},
    m12: { value: 283, type: 'multiplier', label: 'Max 12 (for Auto)'},
    p13: { value: 50, type: 'multiplier', label: '===> P13' },
    r13: { value: 350, type: 'multiplier', label: 'Late 13' },
    b13: { value: 0, type: 'balance', label: 'Bet 13'},
    m13: { value: 516, type: 'multiplier', label: 'Max 13 (for Auto)'},
    p14: { value: 100, type: 'multiplier', label: '===> P14' },
    r14: { value: 700, type: 'multiplier', label: 'Late 14' },
    b14: { value: 0, type: 'balance', label: 'Bet 14'},
    m14: { value: 1118, type: 'multiplier', label: 'Max 14 (for Auto)'},
    p15: { value: 300, type: 'multiplier', label: '===> P15' },
    r15: { value: 1500, type: 'multiplier', label: 'Late 15' },
    b15: { value: 0, type: 'balance', label: 'Bet 15'},
    m15: { value: 2642, type: 'multiplier', label: 'Max 15 (for Auto)'},
    p16: { value: 600, type: 'multiplier', label: '===> P16' },
    r16: { value: 2500, type: 'multiplier', label: 'Late 16' },
    b16: { value: 0, type: 'balance', label: 'Bet 16'},
    m16: { value: 4530, type: 'multiplier', label: 'Max 16 (for Auto)'},
    p17: { value: 1000, type: 'multiplier', label: '===> P17' },
    r17: { value: 4000, type: 'multiplier', label: 'Late 17' },
    b17: { value: 0, type: 'balance', label: 'Bet 17'},
    m17: { value: 6168, type: 'multiplier', label: 'Max 17 (for Auto)'},
    p18: { value: 4000, type: 'multiplier', label: '===> P18' },
    r18: { value: 17000, type: 'multiplier', label: 'Late 18' },
    b18: { value: 0, type: 'balance', label: 'Bet 18'},
    m18: { value: 22196, type: 'multiplier', label: 'Max 18 (for Auto)'},
    p19: { value: 10000, type: 'multiplier', label: '===> P19' },
    r19: { value: 30000, type: 'multiplier', label: 'Late 19' },
    b19: { value: 200, type: 'balance', label: 'Bet 19'},
    m19: { value: 45885, type: 'multiplier', label: 'Max 19 (for Auto)'},
    p20: { value: 30000, type: 'multiplier', label: '===> P20' },
    r20: { value: 60000, type: 'multiplier', label: 'Late 20' },
    b20: { value: 0, type: 'balance', label: 'Bet 20'},
    m20: { value: 82394, type: 'multiplier', label: 'Max 20 (for Auto)'},
    autoValue: { value: 1, type: 'multiplier', label: '1 for Auto'},
    multx: { value: 1, type: 'multiplier', label: 'Mult All Bet for x'},
    low: { value: 1, type: 'multiplier', label: '0: High Before, 1 Low Before'},
    balance: { value: 10000000, type: 'balance', label: 'Balance to use'},
    useGameCycle: { value: 0, type: 'multiplier', label: '1 Use Game Cycle'},
    cycleGames: { value: 20000, type: 'multiplier', label: 'GamesCycle'},
};


log('Script is running..');


engine.on('GAME_STARTING', onGameStarted);
engine.on('GAME_ENDED', onGameEnded);

let currentValue = { value: -1, lates: 0};
let values = [];
let latesValue = [];
let playedGames = [];
let k =0;
let gains = [];
let multfactors = [];
let disaster = 0;
let balance = config.useGameCycle == 1 ? config.balance.value : userInfo.balance;
let singleParabBalance = 0;

for (let i =1; i<21; i++) {
    let st = "p" + i.toString();
    if (!isNaN(config[st].value) && config[st].value != null)
        values[(config[st].value).toString()] = calculateBets(config[st].value, 100, config[st].value * 10, false);
    if (config.autoValue.value == 1)
        multfactors[config["p" + i.toString()].value] = calculateAutoBet(config.balance.value, config["r" + i.toString()].value, config["m" + i.toString()].value, values[(config[st].value).toString()])
    else
        multfactors[config["p" + i.toString()].value] = config["b" + i.toString()].value / 100;
}

for (let key of Object.keys(values)) {
    latesValue[key] = 0;
    playedGames[key] = 0;
    gains[key] = 0;
}

showMax();

function onGameStarted() {
    if (currentValue.value != -1) {
        if (balance < roundBit((values[currentValue.value.toString()][k] * multfactors[currentValue.value] * config.multx.value)))
        {
            disaster++;
            for (let key of Object.keys(values)) {
                playedGames[key] = 0;
                gains[key] = 0;
            }
            singleParabBalance = 0;
            balance = config.useGameCycle == 1 ? config.balance.value : userInfo.balance;
            currentValue = -1;
        }
        else {
            log("T", k, "[RT", currentValue.lates + k + 1, "] - bet ", roundBit((values[currentValue.value.toString()][k] * multfactors[currentValue.value] * config.multx.value)) / 100, " on ", currentValue.value, "x", "ROUND[", printBit(singleParabBalance), "]");
            engine.bet(roundBit(values[currentValue.value.toString()][k] * multfactors[currentValue.value] * config.multx.value), currentValue.value);
            k++;
        }
    }
}

function onGameEnded() {
    var lastGame = engine.history.first();
    latesValue = updateLates(lastGame.bust, latesValue);


    if (lastGame.wager) {
        log("Bust:", lastGame.bust);
        if (lastGame.cashedAt)
        {
            singleParabBalance = 0;
            balance += gains[currentValue.value] + ((lastGame.cashedAt * lastGame.wager) - lastGame.wager);
            gains[currentValue.value] = gains[currentValue.value] + ((lastGame.cashedAt * lastGame.wager) - lastGame.wager);
            currentValue = {value: -1, lates: 0}
            log("[DIS:", disaster, "] ", lastGame.bust, " WIN!!", " BAL: ", printBit(balance));

            showGames();
            k = 0;
        }
        else {
            singleParabBalance += lastGame.wager;
            balance -= lastGame.wager;
        }
    }
    if (k == 0) {
        let index = findFirstLateValue(latesValue);
        if (index != -1) {
            currentValue = {value: config["p" + index.toString()].value, lates: config["r" + index.toString()].value};
            log("CurrentVALUE:", currentValue.value);
            playedGames[currentValue.value.toString()] = playedGames[currentValue.value.toString()]+1;
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
                tempBet += 1000;
            else
                tempBet+= 100;
        } while (((tempBet * mult) - tempBet - amount) <= gain)
        lastBet = roundBit(tempBet);
        progression[k+1] = lastBet;
    }
    return progression;
}

function roundBit(bet) {
    if (bet<90)
        return 100;
    else
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

function printBit(bet) {
    let suffix = "";
    if (bet > 10000000 && bet <100000000)
        suffix = "k";
    else if (bet >100000000)
        suffix = "M";
    return (bet / (suffix == "" ? 100 : (suffix == "k" ? 100000 : (suffix == "M" ? 100000000 : "")))).toLocaleString('de-DE') + suffix;
}

function findFirstLateValue(l)
{
    if(config.low.value)
    {
        for (let i=1; i<21; i++)
        {
            if (!isNaN(config["p"+ i.toString()].value) && config["p"+ i.toString()].value != null && multfactors[config["p" + i.toString()].value] != -1)
                if (l[config["p"+ i.toString()].value] > config["r"+ i.toString()].value)
                    return i;
        }
    }
    else {
        for (let i = 20; i>0; i--) {
            if (!isNaN(config["p"+ i.toString()].value) && config["p"+ i.toString()].value != null && multfactors[config["p" + i.toString()].value] != -1)
                if (l[config["p" + i.toString()].value] > config["r" + i.toString()].value)
                    return i;
        }
    }
    return -1;
}

function showGames()
{
    log("STATS:");
    for (let i=1; i<21; i++)
    {
        if (!isNaN(config["p"+ i.toString()].value) && config["p"+ i.toString()].value != null)
            log(config["p"+ i.toString()].value + ": " + playedGames[(config["p"+ i.toString()].value).toString()] +" game -> ", printBit(gains[config["p"+ i.toString()].value]));
    }
}

function showMax()
{
    let amount = 0;
    log("max");
    for (let i=1; i<21; i++)
    {
        if (!isNaN(config["p"+ i.toString()].value) && config["p"+ i.toString()].value != null) {
            let k = 0;
            while (config.balance.value > amount) {
                amount += roundBit(values[(config["p" + i.toString()].value).toString()][k++] * (config["b" + i.toString()].value / 100) * config.multx.value);
            }
            k--;
            log(config["p" + i.toString()].value, " ->", config["r" + i.toString()].value, " + ", k, " = T", config["r" + i.toString()].value + k, " bet ", config.autoValue.value == 1 ? "[A] ": " ", printBit(multfactors[config["p" + i.toString()].value] * 100));
            amount = 0;
            k = 0;
        }
    }

}

function calculateAutoBet(amount, late, maxT, values)
{
    let tot =0;
    let bet = 0;

    do
    {
        bet += 100;
        for (let i =0; i<(maxT - late); i++)
        {
            tot += values[i];
        }
    } while (tot<amount)
    return bet != 100 ? (bet - 100) / 100 : -1;

}