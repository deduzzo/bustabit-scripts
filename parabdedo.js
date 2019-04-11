var config = {
    bet: { value: 100, type: 'balance' },
    percParabolic: { value: 90, type: 'multiplier', label: '%parabolic' },
    initMinBet: { value: 2.5, type: 'multiplier', label: 'Init Min Bets' },
    last3: { value: 3, type: 'multiplier', label: 'Min times for 3 ' },
    last6: { value: 6, type: 'multiplier', label: 'Min times for 6' },
    last11: { value: 12, type: 'multiplier', label: 'Min times for 11' },
    last15: { value: 16, type: 'multiplier', label: 'Min times for 15' },
    late100factor: { value: 8, type: 'multiplier', label: 'Late100 Factor' },
    stop1timesEvery: { value: 400, type: 'multiplier', label: 'Stop 1 Times Every' },
    percNotSignificativeValue: { value: 0, type: 'multiplier', label: '% Not Significative Value' },
    minSentinelTimes: { value: 1, type: 'multiplier', label: 'Min Sentinel Times' },
    maxSentinelTimes: { value: 4, type: 'multiplier', label: 'Max Sentinel Times' },
    maxSentinelValues: { value: 10, type: 'multiplier', label: 'Max Sentinel Values' },
    stopDefinitive: { value: 12000, type: 'multiplier', label: 'Script iteration number of games' },
    increaseAmount: { value: 10, type: 'multiplier', label: 'Increase amount %' },
    increaseEvery: { value: 100000, type: 'multiplier', label: 'Increase every x game' },
    initBalance: { value: 5000000, type: 'balance', label: 'Iteration Balance (0 for all)' },
};

log('Script is running..');

const PARABOLIC = "PARABOLIC";
const SENTINEL = "SENTINEL";
const initMinBet = config.initMinBet.value;
const values = {
    "2.12": [], "2.31": [], "2.63": [], "2.92": [],
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
let stop1Times = false;
let last100 = 0;
let last120 = 0;
let last250 = 0;
let last1000 = 0;
let lastExit = -1;
let lastBustOk = -1;

engine.on('GAME_STARTING', onGameStarted);
engine.on('GAME_ENDED', onGameEnded);



function onGameStarted() {
    if (!stop1Times) {
        //|| (currentRound >config.stopDefinitive.value && stopped)
        if ((gameType != SENTINEL && (gameType == PARABOLIC && values[currentxIndex][i] > balance)) || (currentRound > config.stopDefinitive.value && stopped)) {
            if (stopped) {

                log("Iteration OKK!");
            } else {
                disaster++;
                log("Disaster :( last100:", last100, " last120: ", last120, "last1000", last1000)
            }
            stopped = false;
            bet = config.bet.value;
            totalGain += balance - initBalance;
            itTotal++;
            balance = config.initBalance.value == 0 ? userInfo.balance : config.initBalance.value;
            initBalance = config.initBalance.value == 0 ? balance : config.initBalance.value;
            currentRound = 0;
            last100 = 0;
            last120 = 0;
            lastExit = -1;
            lastBustOk= -1;
            sequences = [];
            gameType = SENTINEL;
            i = getRandomInt(config.minSentinelTimes.value, config.maxSentinelTimes.value+1);
            currentxIndex = "1.30";
            let nextBetTemp = Object.keys(values).filter(p => parseFloat(p) <= initMinBet);
            currentxIndex = nextBetTemp[getRandomInt(0, nextBetTemp.length)];
        }
        let molt = incCounter > 1 ? (1 + ((incCounter * config.increaseAmount.value)) / 100) : 1;
        log("IT:", itTotal, "/", disaster, " | ", " | R:", ++currentRound, " | G:", printBit(totalGain + (balance - initBalance)), "$ | T", i, " - Bet ", gameType == SENTINEL ? roundBit(bet * molt) / 100 : roundBit(values[currentxIndex][i] * molt) / 100, " on", currentxIndex, " ", gameType);
        engine.bet(gameType == SENTINEL ? roundBit(bet * molt) : roundBit(values[currentxIndex][i] * molt), parseFloat(currentxIndex));
        if (config.increaseAmount.value != 0 && currentRound % config.increaseEvery.value == 0) {
            incCounter++;
        }
    }
    else
    {
        log("1 Time stop");
        stop1Times = false;
    }
}

function onGameEnded(info) {
    var lastGame = engine.history.first();
    if (lastGame.bust >= 100)
        last100 = 0;
    else
        last100++;
    if (lastGame.bust >= 120)
        last120 = 0;
    else
        last120++;
    if (lastGame.bust >= 250)
        last250 = 0;
    else
        last250++;
    if (lastGame.bust >= 1000)
        last1000 = 0;
    else
        last1000++;
    sequences.unshift(lastGame.bust);
    if (sequences.length> 1000)
        sequences.pop();
    // If we wagered, it means we played
    if (!lastGame.wager) {
        return;
    }

    if (lastGame.cashedAt)
        balance += Math.floor(lastGame.cashedAt * lastGame.wager) - lastGame.wager;
    else
        balance -= lastGame.wager;


    if (lastGame.bust <15 && gameType == PARABOLIC) {
        lastExit = currentxIndex;
        lastBustOk = lastGame.bust;
    }
    else if (lastGame.bust >=15) {
        lastBustOk = -1;
        lastExit = -1;
    }


    let finishSentinel = false;
    if (gameType == SENTINEL) {
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
            currentxIndex = getNextBets(sequences, values, lastExit, lastBustOk);
        //log ("currentIndex ",currentxIndex)
        //log (finishSentinel)
        roundBets = 0;
        if (currentRound > config.stopDefinitive.value) {
            stopped = true;
        }
        if (gameType == PARABOLIC || finishSentinel) {
            let perc = getRandomInt(0, 101);
            if ((perc < config.percParabolic.value) && currentxIndex != "-1") {
                // PARABOLIC
                gameType = PARABOLIC;
                i = 0;
            } else {
                //SENTINEL
                gameType = SENTINEL;
                let nextBetTemp = Object.keys(values).filter(p => parseFloat(p) <= config.maxSentinelValues.value);
                currentxIndex = nextBetTemp[getRandomInt(0, nextBetTemp.length)];
                i = getRandomInt(config.minSentinelTimes.value, config.maxSentinelTimes.value +1);
            }
        }
        log(lastGame.bust, "x WIN!!");
    } else if (!finishSentinel && gameType == PARABOLIC) {
        roundBets += lastGame.wager;
        if (i % config.stop1timesEvery == 0)
        {
            stop1Times = true;
        }
        else {
            i++;
            log(lastGame.bust, "x Lose :(");
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

function getNextBets(sequenc,defValues, lastExit, lastBustOk)
{
    let last100 = sequenc.findIndex(p => p >= 100);

    let notSignificativeValues = false;
    let nextBet;
    let last15 = sequenc.findIndex(p => p >= 15);
    if (last15 == -1)
        last15 = sequenc.length- 1;
    let last11 = sequenc.findIndex(p => p >= 11);
    if (last11 == -1)
        last11 = sequenc.length- 1;
    let last6 = sequenc.findIndex(p => p >= 6);
    if (last6 == -1)
        last6 = sequenc.length- 1;
    let last3 = sequenc.findIndex(p => p >= 3);
    if (last3 == -1)
        last3 = sequenc.length- 1;
    log("3:",last3," 6:", last6," 11:", last11," 15:",last15);
    if (last15 ==0 && getRandomInt(0,101)<config.percNotSignificativeValue.value && last100 <100)
    {
        // includo tutti i valori
        log("SPECIAL!");
        let nextBetTemp = Object.keys(defValues).filter(p=> parseFloat(p) >= initMinBet)
        nextBet = nextBetTemp[getRandomInt(0, nextBetTemp.length)];
    }
    else
    {
        // TODO: implementare il random per valori alti
        //let sequencCopy = [...sequenc];
        let maxOffset = 0;

        if (last3 >= config.last3.value )
            maxOffset = 3;

        if (last6 >= config.last6.value )
            maxOffset = 6;

        if (lastBustOk<6)
            if (last11 >= config.last11.value)// +last100 > 130 ? (last100 / config.late100factor.value * 2) : 0)
                if (maxOffset != 6)
                    maxOffset = 11;

        if (lastBustOk<11 && lastBustOk > 4)
            if (last15 >= config.last15.value)// + last1000 > 130 ? (last100 / config.late100factor.value): 0)
                    maxOffset = 16;

        if (maxOffset == 0 || (maxOffset - lastBustOk) <0.9) {
            maxOffset = 12;
            notSignificativeValues = true;
        }

        //if ((maxOffset - maxOfSeries) < 0.9)
        //{
        //    maxOfSeries = maxOffset-2;
        //}
        log("maxoffset:", maxOffset, " lastExit", lastExit, " lastBustOk", lastBustOk);
        let min = (maxOffset - lastBustOk) > 8 ? lastBustOk + 6 : lastBustOk;
        let nextBetTemp = Object.keys(defValues).filter(p => parseFloat(p) >= min && parseFloat(p) <= maxOffset);
        nextBet = nextBetTemp[getRandomInt(0, nextBetTemp.length)];
    }
    let ret = notSignificativeValues ?  "-1" : nextBet;
    log("not significative:", notSignificativeValues, " ret:", ret);
    return ret;
}