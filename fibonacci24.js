var config = {
    bet: { value: 600, type: 'balance', label: 'bet'},
    payout: { value: 2.4, type: 'multiplier', label: 'Payout' },
    maxT: { value: 200, type: 'multiplier', label: 'MaxT' },
    lateByTime: { value: 0, type: 'multiplier', label: 'late by' },
    initBalance: { value: 1000000, type: 'balance', label: 'Iteration Balance (0 for all)' },
    stopDefinitive: { value: 1000, type: 'multiplier', label: 'Script iteration number of games' },
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


const stopDefinitive = config.stopDefinitive.value;
let balance = config.initBalance.value == 0 ? userInfo.balance : config.initBalance.value;
let initBalance = balance;
let totalGain = 0;
let currentRound = 0;
let disaster = 0;
let itTotal = 1;


showStats(config.bet.value, config.maxT.value);


function onGameStarted() {
    let gainString ="IT" + itTotal + "/"+disaster+"|" + currentRound + '| $T' + ((totalGain + (balance - initBalance)) / 100000).toFixed(2) + 'k| ' + ((balance - initBalance) / 100000).toFixed(2) + 'k| ';
    if (k>config.maxT.value) {
        log("disaster!");
        i = 0;
        k = 0;
        currentBet = config.bet.value;
        precBet = 0;
    }
    else
    {
        if (i>=config.lateByTime.value) {
            log(gainString, "T",k++, " bet ", roundBit(currentBet) / 100);
            engine.bet(currentBet, payout);
        }
        else {
            log("wait for other:", config.lateByTime.value - i)
            i++;
        }
    }

}

function onGameEnded() {
    currentRound++;
    var lastGame = engine.history.first();
    log ("bust:", lastGame.bust)

    if (lastGame.bust >= payout) {
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
    currentBet = config.bet.value;
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
    currentBet  = config.bet.value;
    precBet = 0;
    first = true;
    reset();
}

function showSmallStats(){
    log("DIS:", disaster, ' WINS: ', itTotal - disaster, 'BALANCE: ', balance / 100, ' - gain ', (balance - initBalance) / 100);
}
