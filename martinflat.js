var config = {
    payout: { value: 1.6, type: 'multiplier', label: 'Mult' },
    mult2: { value: 3, type: 'multiplier', label: 'Game 2 Mult' },
    multiply2: { value: 1.5, type: 'multiplier', label: 'Game 2 Iteration Multiply' },
    baseBet1: { value: 5000, type: 'balance', label: 'Base Bet for Flat Game (Auto calculated for MAXt strategy)' },
    maxT: { value: 20, type: 'multiplier', label: 'T to recover (auto value calculated) ' },
    startGame2After: { value: 2, type: 'multiplier', label: 'XLost to Activate game 2' },
    initialBuffer: { value: 20, type: 'multiplier', label: 'Initial Buffer' },
    minimumLostTimesToStart: { value: 10, type: 'multiplier', label: 'Minimum buffer to start GAME 2' },
    offsetAlwaysStart: { value: 3, type: 'multiplier', label: 'Force start GAME 2 after Xlost + this offset' },
    updateBetAfter: { value: 50, type: 'multiplier', label: 'Update bets after x times' },
    stopDefinitive: { value: 60000, type: 'multiplier', label: 'Script iteration number of games' },
    initBalance: { value: 15000000, type: 'balance', label: 'Iteration Balance (0 for all)' },
};

let toRecalibrate = false;

const updateBetAfter = config.updateBetAfter.value;
const mult1 = config.payout.value;
const mult2 = config.mult2.value;
const multiply2 = config.multiply2.value;
const minimumLostTimesToStart = config.minimumLostTimesToStart.value;
const startGame2After = config.startGame2After.value;
let currentBet2 = 0;
let basebet1 = 0;
const offsetAlwaysStart = config.offsetAlwaysStart.value;
let currentBet2Default = currentBet2;
let safebets = 0;

log('Script is running..');

let game1Losts = -config.initialBuffer.value;
let game2VirtualLosts = 0;
let currentTimes = 0;
let currentRound = 0;
let currentGameType = 1;
const stopDefinitive = config.stopDefinitive.value;
let stopped = false;
let balance = config.initBalance.value == 0 ? userInfo.balance : config.initBalance.value;
let initBalance = balance;
let totalGain = 0;
let itTotal = 0;
let disaster = 0;
let g2safe = false;

updateBet(true);

engine.on('GAME_STARTING', onGameStarted);
engine.on('GAME_ENDED', onGameEnded);


function onGameStarted() {
    if (stopped ||
        (currentGameType == 2 && currentBet2 != currentBet2Default && currentTimes >= (config.maxT.value - config.startGame2After.value) &&
            (
                (g2safe && game2VirtualLosts > (config.maxT.value + offsetAlwaysStart)) ||
                (!g2safe && game2VirtualLosts > config.maxT.value)
            )
        )) {
        if (stopped)
        {
            log('Definitive STOP!!!, reboot!!! :D');
            stopped = false;
        }
        else
        {
            log('Disaster!!  :( Reboot');
            disaster++;
        }
        totalGain += balance - initBalance;
        itTotal++;
        safebets = 0;
        game1Losts = -config.initialBuffer.value;
        currentGameType = 1;
        g2safe = false;
        currentBet2 = currentBet2Default;
        currentTimes = 0;
        game2VirtualLosts = 0;
        balance = config.initBalance.value == 0 ? userInfo.balance : config.initBalance.value;
        initBalance = config.initBalance.value == 0 ? balance : config.initBalance.value;
        currentRound = 0;
        updateBet(true);
    }
    else
    {
        let gainString = ' |$' + ((totalGain + (balance - initBalance)) / 100000).toFixed(2) +  'k safe% ' + ((safebets * 100) / currentRound ).toFixed(2);
        if (currentGameType == 2) {
            // game 2
            log('IT', itTotal +1,  '/', disaster,'-R', ++currentRound, ' G2 ', Math.round(currentBet2 / 100), 'on', mult2, ' - vT:', game2VirtualLosts, ' rT:', currentTimes, gainString);
        } else if (currentGameType == 1) {
            // flat game
            log('IT', itTotal +1,  '/', disaster,' -R', ++currentRound, ' G1 ', Math.round(basebet1 / 100), 'on', mult1, 'x - vT:', game2VirtualLosts, ' toR: ', game1Losts, gainString);
        }
        currentGameType == 2 ? engine.bet(currentBet2, mult2) : engine.bet(basebet1, mult1);
        if (game1Losts < minimumLostTimesToStart) safebets++;
        if (currentRound % 100 == 0) showSmallStats();
        if (currentRound % updateBetAfter == 0) toRecalibrate = true;
    }
}

function onGameEnded() {
    var lastGame = engine.history.first();
    let currentMult = lastGame.cashedAt;
    if (lastGame.wager) {
        let currentB = currentGameType == 2 ? currentBet2 : basebet1;
        let currentM = currentGameType == 2 ? mult2 : mult1;
        if (lastGame.bust < mult2) {
            // virtual ko
            game2VirtualLosts++;
        } else
            game2VirtualLosts = 0;

        if ((currentGameType == 2 && currentMult >= mult2) || currentGameType == 1 && currentMult >= mult1) {
            // we win
            // balance update
            balance += Math.floor(currentM * currentB) - currentB;
            if (currentGameType == 2) {
                game1Losts -= minimumLostTimesToStart;
                currentGameType = 1;
                currentBet2 = currentBet2Default;
                currentTimes = 0;
                g2safe = false;
                game2VirtualLosts = 0;
            }
            if (toRecalibrate) {
                updateBet(false);
                toRecalibrate = false;
            }
            if (currentRound > stopDefinitive) stopped = true;
        } else {
            //balance update
            balance -= currentB;
            // we lost
            if (currentGameType == 1) {
                game1Losts++;
            } else if (currentGameType == 2) {
                currentTimes++;
                currentBet2 = Math.round((currentBet2 / 100) * multiply2) * 100;
            }

        }

        if (currentGameType == 1) {
            if (((game1Losts / minimumLostTimesToStart > 1) && game2VirtualLosts > startGame2After) || (game2VirtualLosts > (startGame2After + offsetAlwaysStart))) {
                currentGameType = 2;
                g2safe = (game1Losts / minimumLostTimesToStart) < 1;
            }
        }
    }
}



function showStats(initBet, mult, currentT, returnT, verbose)
{
    let i;
    let count = 0;
    let bet = initBet;
    let desideredTtotal = 0;
    if (verbose) log("------ INFO -----")
    for (i =currentT; i<30; i++)
    {
        count+=bet;
        if (verbose) log('T:',i,' - bet:', (bet /100).toLocaleString('de-DE'), ' - tot: ', (count /100) .toLocaleString('de-DE'));
        if (i == returnT) desideredTtotal = count;
        bet = Math.round((bet /100) * mult) * 100;
    }
    return desideredTtotal;
}

function showSmallStats(){
    log("DIS:", disaster, ' WINS: ', itTotal - disaster, 'BALANCE: ', balance / 100, ' - gain ', (balance - initBalance) / 100,  ' safe%= ', ((safebets * 100) / currentRound ).toFixed(2));
}

function calculateMaxGame2Bets(step, currentT, desideredT)
{
    let bet = 0;
    let tempTotal = 0;
    do {
        bet +=step;
        tempTotal = showStats(bet,multiply2, currentT ,desideredT, false);
    } while (balance > tempTotal)
    return { bet: (Math.round((bet - step) / 100)).toFixed(0) * 100 , nextTotal: tempTotal };
}

function updateBet(showDetail)
{
    let currentBet2Default2 = calculateMaxGame2Bets(1000, startGame2After +1, config.maxT.value);
    currentBet2Default= currentBet2Default2.bet;
    currentBet2 = currentBet2Default2.bet;
    basebet1 = (Math.round((currentBet2 * (mult2 -1)) / (minimumLostTimesToStart +1)) / 100).toFixed(0) * 100;
    log ('BET UPDATED: game2 BET: ', currentBet2 / 100,' - game1 BET:', basebet1 / 100, ' NEXT STEP AT ',currentBet2Default2.nextTotal / 100);
    showStats(currentBet2,multiply2, startGame2After+1, -1, showDetail);
}

