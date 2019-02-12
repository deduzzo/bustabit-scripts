var config = {
    payout: { value: 1.50, type: 'multiplier', label: 'Mult' },
    baseBet1: { value: 5000, type: 'balance', label: 'Base Bet for Flat Game (Auto calculated for MAXt strategy)' },
    strategy: {
        value: 'maxT', type: 'radio', label: 'Strategy:',
        options: {
            manual: { value: '25000', type: 'balance', label: 'Manual base bet for Game 2 (3x)' },
            maxT: { value: '23', type: 'multiplier', label: 'T to recover (auto value calculated) ' },
        }
    },
    startGame2After: { value: 4, type: 'multiplier', label: 'XLost to Activate game 2' },
    minimumLostTimesToStart: { value: 10, type: 'multiplier', label: 'Minimum buffer to start GAME 2' },
    offsetAlwaysStart: { value: 2, type: 'multiplier', label: 'Force start GAME 2 after Xlost + this offset' },
    updateBetAfter: { value: 100, type: 'multiplier', label: 'Update bets after x times' },
};

let toRecalibrate = false;

const updateBetAfter = config.updateBetAfter.value;
const mult1 = config.payout.value;
const mult2 = 3;
const minimumLostTimesToStart = config.minimumLostTimesToStart.value;
const startGame2After = config.startGame2After.value;
let currentBet2 = config.strategy.value == 'manual' ? config.strategy.options.manual.value :
    calculateMaxGame2Bets(1000, startGame2After +1, config.strategy.options.maxT.value);
if (config.strategy.value == 'maxT') log("Next STEP at ", currentBet2.nextTotal / 100, ' bit');
if (config.strategy.value == 'maxT') currentBet2 = currentBet2.bet;
let basebet1 = config.strategy.value == 'manual' ? config.baseBet1.value : Math.round((currentBet2 * 2) / (minimumLostTimesToStart +1));
const offsetAlwaysStart = config.offsetAlwaysStart.value;
let currentBet2Default = currentBet2;
let safebets = 0;

log('Script is running..');

let game1Losts = 0;
let game2VirtualLosts = 0;
let currentTimes = 0;
let currentRound = 0;
let currentGameType = 1;


//log(showStats(25000,1.5, 0, 23, true));

showStats(currentBet2Default,1.5, startGame2After+1, -1, true);

log ('GAME 2 BET: ', Math.round(currentBet2 / 100), ' - GAME 1 BET:', Math.round(basebet1 / 100));

engine.on('GAME_STARTING', onGameStarted);
engine.on('GAME_ENDED', onGameEnded);


function onGameStarted() {
    if (currentGameType == 2)
    {
        // game 2
        log('ROUND ', ++currentRound, 'GAME 2 - betting', Math.round(currentBet2 / 100), 'on', mult2, ' - virtualT:', game2VirtualLosts, ' realT:', currentTimes);
        engine.bet(Math.round(currentBet2 / 100) * 100 , mult2);
    }
    else if (currentGameType == 1)
    {
        // flat game
        log('ROUND ', ++currentRound, 'GAME 1 - betting', Math.round(basebet1 /100), 'on', mult1, 'x, virtualT:', game2VirtualLosts, ' to recover: ',game1Losts);
        engine.bet(Math.round(basebet1 / 100) * 100, mult1);
    }
    if (game1Losts < minimumLostTimesToStart) safebets++;
    if (currentRound % 10 == 0) showSmallStats();
    if (currentRound % updateBetAfter == 0) toRecalibrate = true;
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
                updateBet();
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
    return { bet: bet - step, nextTotal: tempTotal };
}

function updateBet()
{
    currentBet2Default = calculateMaxGame2Bets(1000, startGame2After +1, config.strategy.options.maxT.value);
    currentBet2 = Math.round(currentBet2Default.bet / 100) * 100;
    basebet1 = Math.round((currentBet2 * 2) / (minimumLostTimesToStart +1))
    log ('BET UPDATED: game2 BET: ', Math.round(currentBet2 / 100),' - game1 BET:', Math.round(basebet1 / 100), ' NEXT STEP AT ',currentBet2Default.nextTotal / 100);
    showStats(currentBet2,1.5, startGame2After+1, -1, true);
}
