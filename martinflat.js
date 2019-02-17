var config = {
    payout: { value: 1.9, type: 'multiplier', label: 'Mult' },
    baseBet1: { value: 5000, type: 'balance', label: 'Base Bet for Flat Game (Auto calculated for MAXt strategy)' },
    maxT: { value: '20', type: 'multiplier', label: 'T to recover (auto value calculated) ' },
    startGame2After: { value: 3, type: 'multiplier', label: 'XLost to Activate game 2' },
    initialBuffer: { value: 1000, type: 'multiplier', label: 'Initial Buffer' },
    minimumLostTimesToStart: { value: 12, type: 'multiplier', label: 'Minimum buffer to start GAME 2' },
    offsetAlwaysStart: { value: 2, type: 'multiplier', label: 'Force start GAME 2 after Xlost + this offset' },
    updateBetAfter: { value: 100, type: 'multiplier', label: 'Update bets after x times' },
    stop10: { value: 5, type: 'multiplier', label: 'Times to stop after 10 ' },
    stopDefinitive: { value: 12000, type: 'multiplier', label: 'Stop script after this times' },
};

let toRecalibrate = false;

const updateBetAfter = config.updateBetAfter.value;
const mult1 = config.payout.value;
const mult2 = 3;
const minimumLostTimesToStart = config.minimumLostTimesToStart.value;
const startGame2After = config.startGame2After.value;
let currentBet2 = 0;
let basebet1 = 0;
const offsetAlwaysStart = config.offsetAlwaysStart.value;
let currentBet2Default = currentBet2;
let safebets = 0;
const stop10 = config.stop10.value;

log('Script is running..');

let game1Losts = -config.initialBuffer.value;
let game2VirtualLosts = 0;
let currentTimes = 0;
let currentRound = 0;
let currentGameType = 1;
let toStop = stop10;
const stopDefinitive = config.stopDefinitive.value;

//log(showStats(25000,1.5, 0, 23, true));

updateBet(true);

engine.on('GAME_STARTING', onGameStarted);
engine.on('GAME_ENDED', onGameEnded);


function onGameStarted() {
    if (currentRound < stopDefinitive) {
        let played = false;
        if (currentGameType == 2) {
            // game 2
            if (game2VirtualLosts % 10 != 0 || toStop == 0) {
                log('ROUND ', ++currentRound, 'GAME 2 - betting', Math.round(currentBet2 / 100), 'on', mult2, ' - virtualT:', game2VirtualLosts, ' realT:', currentTimes);
                engine.bet(currentBet2, mult2);
                played = true;
                if (toStop == 0) toStop = stop10;
            } else {
                log('STOP for ', toStop--, ' times');
            }
        } else if (currentGameType == 1) {
            // flat game
            log('ROUND ', ++currentRound, 'GAME 1 - betting', Math.round(basebet1 / 100), 'on', mult1, 'x, virtualT:', game2VirtualLosts, ' to recover: ', game1Losts);
            engine.bet(basebet1, mult1);
            played = true;
        }
        if (game1Losts < minimumLostTimesToStart && played) safebets++;
        if (currentRound % 10 == 0) showSmallStats();
        if (currentRound % updateBetAfter == 0) toRecalibrate = true;
    }
    else
    {
        log('Definitive STOP!!! :D');
    }
}

function onGameEnded() {
    var lastGame = engine.history.first();
    if (lastGame.wager) {
        if (lastGame.bust < mult2) {
            // virtual ko
            game2VirtualLosts++;
        }
        else
            game2VirtualLosts = 0;
        // If we wagered, it means we played

        if (lastGame.cashedAt) {
            // we win
            if (currentGameType == 2) {
                game1Losts -= minimumLostTimesToStart;
                currentGameType = 1;
                currentBet2 = currentBet2Default;
                currentTimes = 0;
                game2VirtualLosts = 0;
            }
            if (toRecalibrate)
            {
                updateBet(false);
                toRecalibrate = false;
            }
            log ('WIN!! :D');
        } else {
            // we lost
            if (currentGameType == 1) {
                game1Losts++;
            }
            else if (currentGameType == 2) {
                currentTimes++;
                currentBet2 = Math.round((currentBet2 / 100) * 1.5) * 100;
            }

            if (currentGameType == 2) {
                log('LOST :( GAME 2!! ')
            } else if (currentGameType == 1)
                log('LOST, to recover: ', game1Losts)
        }

        if (currentGameType == 1) {
            if (((game1Losts / minimumLostTimesToStart >= 1) && game2VirtualLosts > startGame2After) || (game2VirtualLosts > (startGame2After + offsetAlwaysStart)) ) {
                currentGameType = 2;
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
    log("BALANCE: ", userInfo.balance / 100, ' bits, safe%= ', ((safebets * 100) / currentRound ).toFixed(2));
}

function calculateMaxGame2Bets(step, currentT, desideredT)
{
    let bet = 0;
    let tempTotal = 0;
    do {
        bet +=step;
        tempTotal = showStats(bet,1.5, currentT ,desideredT, false);
    } while (userInfo.balance > tempTotal)
    return { bet: (Math.round((bet - step) / 100)).toFixed(0) * 100 , nextTotal: tempTotal };
}

function updateBet(showDetail)
{
    let currentBet2Default2 = calculateMaxGame2Bets(1000, startGame2After +1, config.maxT.value);
    currentBet2Default= currentBet2Default2.bet;
    currentBet2 = currentBet2Default2.bet;
    basebet1 = (Math.round((currentBet2 * 2) / (minimumLostTimesToStart +1)) / 100).toFixed(0) * 100;
    log ('BET UPDATED: game2 BET: ', currentBet2 / 100,' - game1 BET:', basebet1 / 100, ' NEXT STEP AT ',currentBet2Default2.nextTotal / 100);
    showStats(currentBet2,1.5, startGame2After+1, -1, showDetail);
}
