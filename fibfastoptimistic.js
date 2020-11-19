var config = {
    bet: { value: 10000, type: 'balance', label: 'bet'},
    payout: { value: 3, type: 'multiplier', label: 'Payout' },
    maxT: { value: 200, type: 'multiplier', label: 'MaxT' },
    lateByTime: { value: 0, type: 'multiplier', label: 'late by' },
    itOkMultiply: { value: 1.5, type: 'multiplier', label: 'itOkMultiply' },
    initBalance: { value: 1000000, type: 'balance', label: 'Iteration Balance (0 for all)' },
    stopDefinitive: { value: 3, type: 'multiplier', label: 'Script iteration number of times' },
    disasterMultiply: { value: 1, type: 'multiplier', label: 'Disaster Multiply' },
    sentinel3: {value: 31, type: 'multiplier', label: 'Min 3 in 50 per giocare'},
    sentinel2: {value: 6, type: 'multiplier', label: 'Min 2 in 50 per giocare'},
};


log('Script is running..');

let last50 = [];
engine.on('GAME_STARTING', onGameStarted);
engine.on('GAME_ENDED', onGameEnded);
let i = 0;
let k = 0;
const payout = config.payout.value;
let currentBet  = config.bet.value;
let precBet = 0;
let first = true;
let stopped = true;


const stopDefinitive = config.stopDefinitive.value;
let balance = config.initBalance.value == 0 ? userInfo.balance : config.initBalance.value;
let initBalance = balance;
let totalGain = 0;
let currentRound = 0;
let disaster = 0;
let itTotal = 1;
let itOkMultiply = config.itOkMultiply.value;
let looseTimes = 1;

const totalXInLast50 = (x) =>
{
    let total = 0;
    for (var v = 0; v<last50.length; v++)
    {
        if (last50[v]>=x)
            total++;
    }
    return total;
}

showStats(config.bet.value, config.maxT.value);


function onGameStarted() {
    if (totalXInLast50(2) < config.sentinel2.value || totalXInLast50(3) < config.sentinel3.value && stopped)
    {
        log("no game");
    }
    else {
        stopped = false;
        let gainString = "IT" + itTotal + "/" + disaster + "|" + currentRound + '| $T' + ((totalGain + (balance - initBalance)) / 100000).toFixed(2) + 'k| ' + ((balance - initBalance) / 100000).toFixed(2) + 'k| ';
        if (k > config.maxT.value) {
            log("disaster!");
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
    last50.unshift(lastGame.bust);
    if (last50.length>50)
        last50.pop();
    log(lastGame.bust, "x [:", totalXInLast50(2), "-", totalXInLast50(3),"]");

    if (lastGame.wager)
        log ("bust:", lastGame.bust, lastGame.bust >= payout ? "WIN!!!!": "");

    if (lastGame.bust >= payout && lastGame.wager) {
        currentRound++;
        balance += Math.floor(lastGame.cashedAt * lastGame.wager) - lastGame.wager;
        if (currentRound > stopDefinitive) {
            log("Iteration END!!");
            showSmallStats();
            resetCycle();
        }
        reset();
    }
    else if (!lastGame.cashedAt && lastGame.wager) {
        balance -= currentBet;
        i++;
        if (currentBet === config.bet.value) {
            if (!first) {
                precBet = currentBet;
                currentBet = currentBet * 1.5;
            } else
            {
                first = false;
            }
        } else {
            let precBetTemp = currentBet;
            currentBet = precBet + currentBet;
            precBet = precBetTemp;
        }
        if ((balance - currentBet) < 0) {
            disaster++;
            log("Disaster!! :(");
            if (config.disasterMultiply.value === 1) looseTimes*=2;
            showSmallStats();
            resetCycle();
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
    log()
    currentBet  = roundBit((config.bet.value + (currentRound * config.itOkMultiply.value * config.bet.value)) * looseTimes) ;
    first = true;
    precBet = 0;
    i = 0;
    k = 0;
}


function resetCycle()
{
    stopped = true;
    looseTimes = 1;
    currentRound = 0;
    i = 0;
    k = 0;
    itTotal++;
    totalGain += balance - initBalance;
    balance = config.initBalance.value == 0 ? userInfo.balance : (config.initBalance.value * looseTimes);
    //currentBet  = config.bet.value;
    precBet = 0;
    reset();
}

function showSmallStats(){
    log("DIS:", disaster, ' WINS: ', itTotal - disaster, 'BALANCE: ', balance / 100, ' - gain ', (balance - initBalance) / 100);
}