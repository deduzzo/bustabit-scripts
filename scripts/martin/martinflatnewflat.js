var config = {
    mult: {value: 3, type: 'multiplier', label: 'Moltiplicatore'},
    bet: {value: 300, type: 'balance', label: 'Puntata iniziale'},
    sentinel3: {value: 31, type: 'multiplier', label: 'Min 3 in 50 per giocare'},
    sentinel2: {value: 6, type: 'multiplier', label: 'Min 2 in 50 per giocare'},
    initBalance: { value: 2000000, type: 'balance', label: 'Iteration Balance (0 for all)' },
    stopDefinitive: { value: 2000, type: 'multiplier', label: 'Script iteration number of games' },
};

let last50 = [];
let currentBet = config.bet.value;
let t = 0;
let inGame = false;

const stopDefinitive = config.stopDefinitive.value;
let balance = config.initBalance.value == 0 ? userInfo.balance : config.initBalance.value;
let initBalance = balance;
let totalGain = 0;
let itTotal = 0;
let currentRound = 0;
let disaster = 0;
let maxT = 0;

const last20 = () => last50.length > 20 ? last50.slice(0,20) : [];
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

log('Script is running..');
//showStats(currentBet,config.itOkMultiply.value);


engine.on('GAME_STARTING', onGameStarted);
engine.on('GAME_ENDED', onGameEnded);


function onGameStarted() {
    currentRound++;
    if ((balance - currentBet) < 0) {
        disaster++;
        log("Disaster!! :(");
        resetCycle();
    }
    if (totalXInLast50(2) < config.sentinel2.value || totalXInLast50(3) < config.sentinel3.value)
    {
        log("no game");
    }
    else
    {
        if (!inGame) inGame = true
        if (t>maxT)
            maxT = t;
        log ("[",itTotal,",",disaster,"]  - R:",currentRound,"-T",t," - Bet ", currentBet / 100 , " on ",config.mult.value);
        engine.bet(currentBet, config.mult.value);
    }
}

function onGameEnded() {
    var lastGame = engine.history.first();
    last50.unshift(lastGame.bust);
    if (last50.length>50)
        last50.pop();
    log("MAX:",maxT,": ", lastGame.bust, "x [:", totalXInLast50(2), "-", totalXInLast50(3),"]");
    if (lastGame.wager) {
        if (lastGame.cashedAt) {
            log("WIN!!");
            balance += Math.floor(lastGame.cashedAt * lastGame.wager) - lastGame.wager;
            if (currentRound >= config.stopDefinitive.value) {
                log("CycleWIN!!");
                resetCycle();
            }
            reset();
        } else {
            balance -= currentBet;
            t++;
            //currentBet = Math.ceil((currentBet / 100) * config.itOkMultiply.value) * 100;
        }
    }
}

function reset()
{
    inGame = false;
    currentBet = config.bet.value;
    t = 0;
}


    function resetCycle()
    {
        itTotal++;
        totalGain += balance - initBalance;
        balance = config.initBalance.value == 0 ? userInfo.balance : config.initBalance.value;
        currentRound = 0;
        reset();
    }

function showStats(initBet, mult)
{
    let i;
    let count = 0;
    let bet = initBet;
    log("------ INFO -----")
    for (i =0; i<60; i++)
    {
        count+=bet;
        log('T:',i,' - bet:', (bet /100).toLocaleString('de-DE'), ' - tot: ', (count /100) .toLocaleString('de-DE'));
        bet = Math.ceil((bet /100) * mult) * 100;
    }
}