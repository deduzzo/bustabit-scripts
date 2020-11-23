var config = {
    bet: { value: 5000, type: 'balance', label: 'bet'},
    payout: { value: 3, type: 'multiplier', label: 'Payout' },
    maxT: { value: 20, type: 'multiplier', label: 'MaxT' },
    lateByTime: { value: 0, type: 'multiplier', label: 'late by' },
    itOkMultiply: { value: 1, type: 'multiplier', label: 'itOkMultiply' },
    initBalance: { value: 500000, type: 'balance', label: 'Iteration Balance (0 for all)' },
    stopDefinitive: { value: 2, type: 'multiplier', label: 'Script iteration number of times' },
    disasterMultiply: { value: 1, type: 'multiplier', label: 'Disaster Multiply' },
};


log('Script is running..');

engine.on('GAME_STARTING', onGameStarted);
engine.on('GAME_ENDED', onGameEnded);
let i = 0;
let k = 0;
const payout = config.payout.value;
let currentBet  = config.bet.value;
let precBet = 0;
let precprecBet = 0;


const stopDefinitive = config.stopDefinitive.value;
let balance = config.initBalance.value == 0 ? userInfo.balance : config.initBalance.value;
let initBalance = balance;
let totalGain = 0;
let currentRound = 0;
let disaster = 0;
let itTotal = 1;
let itOkMultiply = config.itOkMultiply.value;


showStats(config.bet.value, config.maxT.value);


function onGameStarted() {
    let gainString ="IT" + itTotal + "/"+disaster+"|cr" + currentRound + '| $T' + ((totalGain + (balance - initBalance)) / 100000).toFixed(2) + 'k| ' + ((balance - initBalance) / 100000).toFixed(2) + 'k| ';
    if (k>config.maxT.value +2) {
        log("disaster!");
        resetCycle();
    }
    else
    {
        if (i>=config.lateByTime.value) {
            let tempPayout;
            if (k==0)
                tempPayout = 1.5;
            else if (k == 1)
                tempPayout = 2;
            else {
                tempPayout = payout;
            }
            log(gainString, "T",k++, " I", i," bet ", roundBit(currentBet) / 100, " on ", tempPayout, "x");
            engine.bet(currentBet,tempPayout);
        }
        else {
            log("wait for other:", config.lateByTime.value - i)
            i++;
        }
    }

}

function onGameEnded() {
    var lastGame = engine.history.first();

    if (lastGame.wager)
        log ("bust:", lastGame.bust, lastGame.bust >= payout ? "WIN!!!!": "");

    if (lastGame.bust >= payout && lastGame.wager) {
        if (k>2) currentRound++;
        balance += Math.floor(lastGame.cashedAt * lastGame.wager) - lastGame.wager;
        if (currentRound> stopDefinitive) {
            log("Iteration END!!");
            showSmallStats();
            resetCycle();
        }
        if (k>2) reset();
    }
    else if (!lastGame.cashedAt && lastGame.wager) {
        balance -= currentBet;
        i++;
        if (k>1) {
            let precBetTemp = currentBet;
            currentBet = currentBet + precBet;
            precBet = precBetTemp;
        }
        if ((balance - currentBet) < 0) {
            disaster++;
            log("Disaster!! :(");
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
    currentBet  = roundBit(config.bet.value + (currentRound * config.itOkMultiply.value * config.bet.value)) ;
    precBet = 0;
    i = 0;
    k = 0;
}


function resetCycle()
{
    currentRound = 0;
    itTotal++;
    totalGain += balance - initBalance;
    balance = config.initBalance.value == 0 ? userInfo.balance : config.initBalance.value;
    //currentBet  = roundBit(config.bet.value + (currentRound * config.itOkMultiply.value * config.bet.value)) ;
    precBet = 0;
    reset();
}

function showSmallStats(){
    log("DIS:", disaster, ' WINS: ', itTotal - disaster, 'BALANCE: ', balance / 100, ' - gain ', (balance - initBalance) / 100);
}