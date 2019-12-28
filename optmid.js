var config = {
    bet: { value: 600, type: 'balance', label: 'bet'},
    payout: { value: 2.4, type: 'multiplier', label: 'Payout' },
    maxT: { value: 200, type: 'multiplier', label: 'MaxT' },
    lateByTime: { value: 0, type: 'multiplier', label: 'late by' },
    initBalance: { value: 1000000, type: 'balance', label: 'Iteration Balance (0 for all)' },
    stopDefinitive: { value: 1000, type: 'multiplier', label: 'Script iteration number of times' },
    itOkMultiply: { value: 1, type: 'multiplier', label: 'itOkMultiply' },
    mid10: { value: 2, type: 'multiplier', label: 'mid10 min' },
    mid20: { value: 2, type: 'multiplier', label: 'mid20 min' },
    mid50: { value: 6, type: 'multiplier', label: 'mid50 min' },
    mid10max: { value: 2, type: 'multiplier', label: 'mid10 max' },
    mid20max: { value: 2, type: 'multiplier', label: 'mid20 max' },
    mid50max: { value: 10, type: 'multiplier', label: 'mid50 max' },
    maxT20: { value: 6, type: 'multiplier', label: 'maxT 20' },
    late100: { value: 120, type: 'multiplier', label: 'late 100' },
    debug: { value: 0, type: 'multiplier', label: 'debug' },

};


log('Script is running..');

engine.on('GAME_STARTING', onGameStarted);
engine.on('GAME_ENDED', onGameEnded);
let i = 0;
let k = 0;
const payout = config.payout.value;
let currentBet  = config.bet.value;
let precBet = 0;
let first = true;
let wait = false;



const stopDefinitive = config.stopDefinitive.value;
let balance = config.initBalance.value == 0 ? userInfo.balance : config.initBalance.value;
let initBalance = balance;
let totalGain = 0;
let currentRound = 0;
let disaster = 0;
let itTotal = 1;
const average = (arr) => arr.reduce( ( p, c ) => p + c, 0 ) / arr.length;
const last10 = () => last100.length > 10 ? last100.slice(0,10) : [];
const last20 = () => last100.length > 20 ? last100.slice(0,20) : [];
const last50 = () => last100.length > 50 ? last100.slice(0,50) : [];
const first50 = () => last100.length > 99 ? last100.slice(49) : [];
const first10 = () => last100.length > 99 ? last100.slice(9,19) : [];
const first20 = () => last100.length > 99 ? last100.slice(19,39) : [];
let last100 = [];
let disasterMidString = "";
let itOkMultiply = config.itOkMultiply.value;
let started = false;
let late100 = 0;


showStats(config.bet.value, config.maxT.value);


function onGameStarted() {
    if (!wait) {
        let gainString = "IT" + itTotal + "/" + disaster + "|" + currentRound + '| $T' + ((totalGain + (balance - initBalance)) / 100000).toFixed(2) + 'k| ' + ((balance - initBalance) / 100000).toFixed(2) + 'k| ';
        if (k > config.maxT.value) {
            log("disaster!");
            //showDisasterString();
            resetCycle();
        } else {
            if (i >= config.lateByTime.value) {
                log(gainString, "T", k++, " bet ", roundBit(currentBet) / 100);
                engine.bet(currentBet, payout);
            } else {
                log("wait for other:", config.lateByTime.value - i)
                i++;
            }
        }
    }
}

function onGameEnded() {
    var lastGame = engine.history.first();
    if (lastGame.bust >= 100)
        late100 = 0;
    else
        late100++;
    if (lastGame.wager) {
        log("bust:", lastGame.bust, lastGame.bust >= payout ? "WIN!!!!" : "");
        if (config.debug.value === 1) log(getDisasterString());
    }
    last100.unshift(lastGame.bust);
    if (last100.length>100)
        last100.pop();
    let max10 = average(last10());
    let max20 = average(last20());
    let max50 = average(last50());
     let maxfirst10 = average(first10());
     let maxfirst20 = average(first20());
     let maxfirst50 = average(first50());
    //log ("bust:", lastGame.bust);

    if (!started && first &&
        (
            (late100 !== 0 && late100 < config.late100.value) ||
            max10 < config.mid10.value ||
            max20 < config.mid20.value ||
            max50 < config.mid50.value ||
            max10 > config.mid10max.value ||
            max20 > config.mid20max.value ||
            max50 > config.mid50max.value ||
            maxT(last20(),config.payout.value)>=config.maxT20.value
        )
    )
    {
        wait = true;
    }
    else {
        started = true;
        // log ("max10:", max10);
        // log ("max100:", max100);
        // log("maxT:",maxT(last50,config.payout.value))
        wait = false;
        if (lastGame.bust >= payout && lastGame.wager) {
            currentRound++;
            balance += Math.floor(lastGame.cashedAt * lastGame.wager) - lastGame.wager;
            if (currentRound > stopDefinitive) {
                log("Iteration END!!");
                showSmallStats();
                resetCycle();
            }
            reset();
        } else if (!lastGame.cashedAt && lastGame.wager) {
            balance -= currentBet;
            i++;
            if (currentBet === config.bet.value) {
                if (!first) {
                    precBet = config.bet.value;
                    currentBet = config.bet.value * 2;
                } else first = false;
            } else {
                let precBetTemp = currentBet;
                currentBet = precBet + currentBet;
                precBet = precBetTemp;
            }
            if ((balance - currentBet) < 0) {
                disaster++;
                log("Disaster!! :(");
                if (config.debug.value === 1) showDisasterString();
                showSmallStats();
                resetCycle();
            }
        }
    }
}


function roundBit(bet) {
    return Math.round(bet / 100) * 100;
}


function showStats(initBet, maxT) {
    let i;
    let count = 0;
    let bet = initBet;
    let first = true;
    let precBet = bet;
    log("------ INFO -----")
    for (i = 0; i < maxT + 2; i++) {
        if (precBet == bet) {
            if (!first) {
                bet = bet * 2;
            } else first = false;
        } else {
            let precBetTemp = bet;
            bet = precBet + bet;
            precBet = precBetTemp;
        }
        count += bet;
        log('T:', i, ' - bet:', (bet / 100).toLocaleString('de-DE'), ' - tot: ', (count / 100).toLocaleString('de-DE'));
    }
}

function reset()
{
    itOkMultiply = config.itOkMultiply.value;
    currentBet  = roundBit(config.bet.value + (currentRound * config.itOkMultiply.value * config.bet.value)) ;
    first = true;
    precBet = 0;
    i = 0;
    k = 0;
}


function resetCycle()
{
    itTotal++;
    totalGain += balance - initBalance;
    balance = config.initBalance.value == 0 ? userInfo.balance : config.initBalance.value;
    currentRound = 0;
    precBet = 0;
    first = true;
    started=false;
    i = 0;
    k = 0;
    currentBet  = roundBit(config.bet.value + (currentRound * config.itOkMultiply.value * config.bet.value)) ;
    reset();
}

function showSmallStats(){
    log("DIS:", disaster, ' WINS: ', itTotal - disaster, 'BALANCE: ', balance / 100, ' - gain ', (balance - initBalance) / 100);
}

function showDisasterString()
{
    disasterMidString += "," + getDisasterString();
    log(disasterMidString);
}

function getDisasterString() {
    return " [M10:" + average(last10()).toFixed(2).toString() + " M20:" + average(last20()).toFixed(2).toString() + " M50:" + average(last50()).toString() + "]" +" [ML10:" + average(first10()).toString() + " ML20:" + average(first20()).toFixed(2).toString() + " ML50:" + average(first50()).toFixed(2).toString() + "]\n";
}

function maxT(arr, val)
{
    let maxT = 0;
    let tempT = 0;
    for(var i=0; i<arr.length; i++)
    {
        if (arr[i] >=val)
            tempT++;
        else
        {
            if (tempT> maxT)
                maxT = tempT;
            tempT = 0;
        }
    }
    return maxT;
}
