var config = {
    bet: {
        value: 3000,
        type: 'balance'
    },
};

log('Script is running..');

const values = {
    "1.30": [], "1.43": [], "1.71": [], "1.90": [],
    "2.12": [], "2.31": [], "2.63": [], "2.78": [],
    "3.16": [], "3.29": [], "3.62": [], "3.80": [],
    "4.11": [], "4.21": [], "4.32": [], "4.78": [],
    "5.23": [], "5.34": [], "5.54": [], "5.89": [],
    "6.12": [], "6.35": [], "6.64": [], "6.80": [],
    "7.14": [], "7.46": [], "7.75": [], "7.84": [],
    "8.12": [], "8.28": [], "8.52": [], "8.75": [],
    "9.02": [], "9.19": [], "9.32": [], "9.69": [],
    "10.19":[], "10.29":[], "10.56":[], "10.90":[],
    "11.09":[], "11.35":[], "11.51":[], "11.82":[],
    "12.29":[], "12.41":[], "12.69":[], "12.99":[],
    "13.02":[], "13.19":[], "13.75":[], "13.82":[],
    "14.08":[], "14.11":[], "14.53":[], "14.68":[],
    "15.12":[], "15.19":[], "15.45":[], "15.82":[],
};
let currentxIndex = "1.30";
for (let key of Object.keys(values))
    values[key] = calculateBets(parseFloat(key) , config.bet.value,parseFloat(key) * 12, false);
let i = 0;
let sequences = [];

engine.on('GAME_STARTING', onGameStarted);
engine.on('GAME_ENDED', onGameEnded);



function onGameStarted() {
    log ("T", i , " - Bet ", roundBit(values[currentxIndex][i]) / 100, " on", currentxIndex);
    engine.bet(roundBit(values[currentxIndex][i]), parseFloat(currentxIndex));
}

function onGameEnded(info) {
    var lastGame = engine.history.first();
    sequences.unshift(lastGame.bust);
    if (sequences.length> 1000)
        sequences.pop();
    // If we wagered, it means we played
    if (!lastGame.wager) {
        return;
    }

    // we won..
    if (lastGame.cashedAt) {
        currentxIndex = getNextBets(sequences,values, currentxIndex);
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
    let gain = mult > 1.12 ? (mult * initBet) - initBet : 10000;
    let amount = 0;
    let lastBet = initBet;
    for (i=0; i<desideredT; i++)
    {
        amount += lastBet;
        if (verbose) log("T:", i, " - bet: ", printBit(lastBet), " - TOT:", printBit(amount), "G:",printBit((lastBet * mult) - amount));
        let tempBet = (amount) / mult;
        do {
            if (mult <2)
                tempBet += 10000;
            else
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

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min)) + min; //Il max è escluso e il min è incluso
}

function getNextBets(sequenc,defValues, lastBet)
{
    let cIndex;
    if (lastBet > 15)
    {

    }
    else {
        let lastIndex = sequenc.findIndex(p => p >= lastBet);
        let last14 = sequenc.findIndex(p => p >= 14);
        cIndex = Object.keys(val)[getRandomInt(0, Object.keys(val).length - 1)];
    }

    return cIndex;
}