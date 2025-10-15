var config = {
    bet: {value: 100, type: 'balance', label: 'bet'},
    payout: {value: 4, type: 'multiplier', label: 'Payout'},
    strategyPadding: {
        value: 'gioca', type: 'radio', label: 'Strategia Padding',
        options: {
            no: {value: 'no', type: 'noop', label: 'Non fare niente'},
            gioca: {value: 'gioca', type: 'noop', label: 'Gioca al tempPayout'},
        }
    },
    continueStrategy: {
        value: 'gioca', type: 'radio', label: 'Strategia Se mancano i bit',
        options: {
            fermati: {value: 'fermati', type: 'noop', label: 'Fermati'},
            gioca: {value: 'gioca', type: 'noop', label: 'Gioca'},
        }
    },
    tempPayout: {value: 50, type: 'multiplier', label: 'Padding Payout'},
    specialPaddingPayout: {value: 500000, type: 'multiplier', label: 'Special Padding Payout'},
    paddingPayoutBelowValue: {value: 3, type: 'multiplier', label: 'Valore sopra il quale giocare lo special'},
    initBalance: {value: 1100000, type: 'balance', label: 'Iteration Balance (0 for all)'},
    paddingbets: {value: 6, type: 'multiplier', label: 'Padding Bets'},
    itcycle: {value: 6000, type: 'multiplier', label: 'Iteration Cycle'},
};

// conservativo: payout: 3, padding 2000, specialpadding: 2000, balance: 47000, padding bets 1 it cycle 10000


log('Script is running..');


engine.on('GAME_STARTING', onGameStarted);
engine.on('GAME_ENDED', onGameEnded);

let k = 0;
const payout = config.payout.value;
const paddingPayout = config.tempPayout.value;
let currentBet = config.bet.value;
let paddingbets = config.paddingbets.value;
let precBet = 0;

let balance = config.initBalance.value == 0 ? userInfo.balance : config.initBalance.value;
let initBalance = balance;
let totalGain = 0;
let currentRound = 0;
let disaster = 0;
let itTotal = 1;
let special = true;
const specialPayoutValue = config.paddingPayoutBelowValue.value;
const continueStrategy = config.continueStrategy.value;


showStats(config.bet.value, 22);


function onGameStarted() {
    var temppayout = payout;
    if (special)
        temppayout = config.specialPaddingPayout.value;
    else if (k < paddingbets)
        temppayout = paddingPayout;
    if ((k < paddingbets && config.strategyPadding.value === "gioca") || k >= paddingbets) {
        let gainString = "IT" + itTotal + "/" + disaster + "|cr" + currentRound + '| $T' + ((totalGain + (balance - initBalance)) / 100000).toFixed(2) + 'k| ' + ((balance - initBalance) / 100000).toFixed(2) + 'k| ';
        log(gainString, "T", k, " bet ", roundBit(currentBet) / 100, " on ", temppayout, "x");
        engine.bet(currentBet, temppayout);
    }
}

function onGameEnded() {
    currentRound++;

    var lastGame = engine.history.first();

    if (lastGame.bust < payout)
        k++;
    else
        k = 0;

    if (lastGame.bust >= specialPayoutValue && (k < paddingbets && config.strategyPadding.value === "gioca"))
        special = true;
    else
        special = false;

    if (lastGame.wager) {
        log("bust:", lastGame.bust, lastGame.cashedAt ? "WIN!!!!" : "");
        if (lastGame.bust >= payout)
            k = 0;
    }

    if (lastGame.cashedAt && lastGame.wager) {
        balance += Math.floor(lastGame.cashedAt * lastGame.wager) - lastGame.wager;
        if (currentRound > config.itcycle.value) {
            log("Iteration END!!");
            showSmallStats();
            resetCycle();
        }
        reset();
    } else if (lastGame.wager) {
        balance -= currentBet;
        if (k > paddingbets) {
            let precBetTemp = currentBet;
            currentBet = currentBet + precBet;
            precBet = precBetTemp;
        }
        if (((balance - currentBet) < 0) || (((userInfo.balance - currentBet) < 0) && continueStrategy === "gioca")) {
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

function reset() {
    currentBet = config.bet.value;
    precBet = 0;
    k = 0;
}


function resetCycle() {
    currentRound = 0;
    itTotal++;
    totalGain += balance - initBalance;
    balance = config.initBalance.value == 0 ? userInfo.balance : config.initBalance.value;
    precBet = 0;
    reset();
}

function showSmallStats() {
    log("DIS:", disaster, ' WINS: ', itTotal - disaster, 'BALANCE: ', balance / 100, ' - gain ', (balance - initBalance) / 100);
}