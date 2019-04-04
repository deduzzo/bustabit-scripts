var config = {
    bet: { value: 100, type: 'balance' },
    percParabolic: { value: 80, type: 'multiplier', label: '%parabolic' },
    initMaxBet: { value: 4, type: 'multiplier', label: 'Init Max Bets' },
    last2: { value: 5, type: 'multiplier', label: 'Min times for bet <2' },
    last5: { value: 8, type: 'multiplier', label: 'Min times for bet <5' },
    last10: { value: 20, type: 'multiplier', label: 'Min times for bet <10' },
    last15: { value: 40, type: 'multiplier', label: 'Min times for bet <15' },
    percNotSignificativeValue: { value: 10, type: 'multiplier', label: '% Not Significative Value' },
    minSentinelTimes: { value: 2, type: 'multiplier', label: 'Min Sentinel Times' },
    maxSentinelTimes: { value: 6, type: 'multiplier', label: 'Max Sentinel Times' },
    maxSentinelValues: { value: 3, type: 'multiplier', label: 'Max Sentinel Values' },
    stopDefinitive: { value: 4000, type: 'multiplier', label: 'Script iteration number of games' },
    increaseAmount: { value: 10, type: 'multiplier', label: 'Increase amount %' },
    increaseEvery: { value: 300, type: 'multiplier', label: 'Increase every x game' },
    initBalance: { value: 10000000, type: 'balance', label: 'Iteration Balance (0 for all)' },
};

log('Script is running..');

const PARABOLIC = "PARABOLIC";
const SENTINEL = "SENTINEL";
const initMaxBet = config.initMaxBet.value;
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
let bet = config.bet.value;
for (let key of Object.keys(values))
    values[key] = calculateBets(parseFloat(key) , bet,parseFloat(key) * 12, false);
let sequences = [];
let gameType = SENTINEL;
let i = getRandomInt(2,8);

let balance = config.initBalance.value == 0 ? userInfo.balance : config.initBalance.value;
let initBalance = balance;
let totalGain = 0;
let itTotal = 0;
let disaster = 0;
let stopped = false;
let roundBets = 0;
let currentRound = 0;
let incCounter = 0;

engine.on('GAME_STARTING', onGameStarted);
engine.on('GAME_ENDED', onGameEnded);



function onGameStarted() {
    //|| (currentRound >config.stopDefinitive.value && stopped)
    log(gameType);
    if ((gameType != SENTINEL && (gameType == PARABOLIC && values[currentxIndex][i] >balance)) || (currentRound >config.stopDefinitive.value && stopped))
    {
        if (stopped) {

            log("Iteration OKK!");
        }
        else
        {
            disaster++;
            log("Disaster :(")
        }
        stopped = false;
        bet = config.bet.value;
        incCounter = 0;
        roundBets = 0;
        totalGain += balance - initBalance;
        itTotal++;
        balance = config.initBalance.value == 0 ? userInfo.balance : config.initBalance.value;
        initBalance = config.initBalance.value == 0 ? balance : config.initBalance.value;
        currentRound = 0;
        sequences = [];
        gameType = SENTINEL;
        i = getRandomInt(2,8);
        currentxIndex = "1.30";
        let nextBetTemp = Object.keys(values).filter(p => parseFloat(p) <= initMaxBet);
        currentxIndex = nextBetTemp[getRandomInt(0, nextBetTemp.length - 1)];
    }
    let molt =  incCounter>1 ? (1 + ((incCounter * config.increaseAmount.value)) / 100) : 1;
    log("IT:", itTotal, "/",disaster, " | " , " | R:",++currentRound," | G:",  printBit(totalGain + (balance - initBalance)),"$ | T", i, " - Bet ", gameType == SENTINEL ? roundBit(bet * molt) / 100 : roundBit(values[currentxIndex][i] * molt) / 100, " on", currentxIndex, " ", gameType);
    engine.bet(gameType == SENTINEL ? roundBit(bet * molt) : roundBit(values[currentxIndex][i] * molt), parseFloat(currentxIndex));
    if (config.increaseAmount.value != 0 && currentRound % config.increaseEvery.value == 0) {
        incCounter++;
    }
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
    let finishSentinel = false;
    if (gameType == SENTINEL) {
        if (lastGame.cashedAt)
            balance += Math.floor(lastGame.cashedAt * lastGame.wager) - lastGame.wager;
        else
            balance -= lastGame.wager;
        log("last: ", lastGame.bust, "x");
        i--;
        if (i == 0) {
            gameType = PARABOLIC;
            finishSentinel = true;
        }
    }
    // we won..
    if ((lastGame.cashedAt && !finishSentinel) || finishSentinel) {
        if (gameType == PARABOLIC || finishSentinel)
            currentxIndex = getNextBets(sequences, values);
        log ("currentIndex ",currentxIndex)
        log (finishSentinel)
        roundBets = 0;
        if (currentRound > config.stopDefinitive.value) {
            stopped = true;
        }
        if (lastGame.cashedAt)
            balance += Math.floor(lastGame.cashedAt * lastGame.wager) - lastGame.wager;
        if (gameType == PARABOLIC || finishSentinel) {
            let perc = getRandomInt(0, 100);
            if ((perc < config.percParabolic.value) && currentxIndex != "-1") {
                // PARABOLIC
                gameType = PARABOLIC;
                i = 0;
            } else {
                //SENTINEL
                gameType = SENTINEL;
                let nextBetTemp = Object.keys(values).filter(p => parseFloat(p) <= config.maxSentinelValues.value);
                currentxIndex = nextBetTemp[getRandomInt(0, nextBetTemp.length - 1)];
                i = getRandomInt(config.minSentinelTimes.value, config.maxSentinelTimes.value);
            }
        }
        log(lastGame.bust, "x WIN!!");
    } else if (!finishSentinel && gameType == PARABOLIC) {
        balance -= lastGame.wager;
        roundBets += lastGame.wager;
        i++;
        log(lastGame.bust, "x Lose :(");
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

function getNextBets(sequenc,defValues)
{
    let notSignificativeValues = false;
    let nextBet;
    let last15 = sequenc.findIndex(p => p >= 15);
    if (last15 == -1)
        last15 = sequenc.length- 1;
    let last10 = sequenc.findIndex(p => p >= 10);
    if (last10 == -1)
        last10 = sequenc.length- 1;
    let last5 = sequenc.findIndex(p => p >= 5);
    if (last5 == -1)
        last5 = sequenc.length- 1;
    let last2 = sequenc.findIndex(p => p >= 2);
    if (last2 == -1)
        last2 = sequenc.length- 1;
    if (last15 ==0)
    {
        if (getRandomInt(0,100)>config.percNotSignificativeValue.value)
        {   // includo tutti i valori
            log("SPECIAL!");
            nextBet = Object.keys(defValues)[getRandomInt(0, Object.keys(defValues).length - 1)];
        }
        else
        {
            //TODO: implementare l'attesa a 1.11 o altro valore

            let nextBetTemp = Object.keys(defValues).filter(p=> parseFloat(p) <= initMaxBet)
            nextBet = nextBetTemp[getRandomInt(0, nextBetTemp.length - 1)];
        }
    }
    else
    {
        // TODO: implementare il random per valori alti
        let maxOfSeries;
        //let sequencCopy = [...sequenc];
        let maxOffset;
        if (last15 > config.last15.value) {
            maxOffset = 16;
            maxOfSeries = Math.max(...sequenc.slice(0,last15));
        }
        else if (last10 >config.last10.value) {
            maxOffset = 11;
            maxOfSeries = Math.max(...sequenc.slice(0,last10));
        }
        else if (last5 > config.last5.value) {
            maxOffset = 6;
            maxOfSeries = Math.max(...sequenc.slice(0,last5));
        }
        else if (last2 > config.last2.value) {
            maxOffset = 2;
            maxOfSeries = Math.max(...sequenc.slice(0,last2));
        }
        else {
            maxOffset = initMaxBet;
            maxOfSeries = initMaxBet -2;
            notSignificativeValues = true;
        }
        if ((maxOffset - maxOfSeries) < 0.9)
        {
            maxOfSeries = maxOfSeries-1;
        }
        console.log("maxoffset:", maxOffset, " maxseries:", maxOfSeries)
        let nextBetTemp = Object.keys(defValues).filter(p => parseFloat(p) >= maxOfSeries && parseFloat(p) <= maxOffset);
        nextBet = nextBetTemp[getRandomInt(0, nextBetTemp.length - 1)];
    }
    return notSignificativeValues ? (getRandomInt(0, 100)>config.percNotSignificativeValue.value ? "-1" : nextBet) : nextBet;
}