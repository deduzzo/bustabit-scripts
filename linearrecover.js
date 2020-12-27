var config = {
    payout: { value: 3.05, type: 'multiplier', label: 'Mult' },
    baseBet: { value: 200, type: 'balance', label: 'Base Bet' },
    perc2xrecover: { value: 0, type: 'multiplier', label: 'Perc2xRecover' },
    perc3xrecover: { value: 50, type: 'multiplier', label: 'Perc3xRecover' },
    percIncrement: { value: 30, type: 'multiplier', label: 'PercIncrement' },
    force2xFrom: { value: 10000, type: 'multiplier', label: 'Force G2>' },
    force2xMinorBalance: { value: 5000, type: 'multiplier', label: 'Force G2 if toRecover < (factor *basebet)' },
    rToStop: { value: 30, type: 'multiplier', label: 'Stop From R' },
    stopTimes: { value: 50, type: 'multiplier', label: 'Number times to stop' },
    maxToRecover: { value: 500000, type: 'balance', label: 'maxToRecoverBeforeReset' },
};


const payout = config.payout.value;
let currentRound = 0;
let n = 0;
let toRecover = 0;
let increment =0;
let gType = "";
const GAME_2X = "GAME_2X";
const GAME_3X = "GAME_3X";
const GAME_4X = "GAME_4X";
const GAME_WIN1T = "GAME_WIN1T";
let stopTimes = config.stopTimes.value;

log('Script is running..');

let currentBet = config.baseBet.value;

engine.on('GAME_STARTING', onGameStarted);
engine.on('GAME_ENDED', onGameEnded);


function onGameStarted() {
    if (currentRound > config.rToStop.value && stopTimes != 0)
    {
        log ("StopTIMES left:", stopTimes--);
    }
    else {
        if (toRecover<config.maxToRecover.value) {
            //log('betting', Math.round(currentBet / 100), 'on', payout, 'x');
            log("R:", currentRound, " toRec:", Math.ceil(toRecover / 100), "bit | INC:", Math.round(increment / 100), "- n:", n, "|Bet ", Math.round(currentBet / 100), 'bit on', payout, 'x', gType != "" ? gType : "");
        }
        else
        {
            resetGame();
        }
        engine.bet(Math.round(currentBet), payout);
    }

}

function onGameEnded() {
    var lastGame = engine.history.first()
    if (lastGame.wager) {
        currentRound++;
        log("bust:", lastGame.bust, lastGame.bust >= payout ? "WIN!!!!" : "LOST :(");
        // If we wagered, it means we played
        if (lastGame.wager && lastGame.cashedAt) {
            var profit = lastGame.cashedAt * lastGame.wager - lastGame.wager;
            toRecover -= profit;
            //increment = 0;
            if (toRecover <= 0) {
                resetGame();
            }
        } else {
            toRecover += currentBet;
        }

        if ((!lastGame.cashedAt && lastGame.wager) || toRecover > 0) {
            if (lastGame.cashedAt) {
                n++;
                let result = 0;
                increment = 0;
                let rand = getRandomInt(0, 100);
                if (currentRound > config.force2xFrom.value || toRecover < (config.force2xMinorBalance.value * config.baseBet.value) || (rand < config.perc2xrecover.value)) {
                    result = Math.ceil((toRecover / 100) / 2) * 100;
                    gType = GAME_2X;
                } else if (rand < config.perc3xrecover.value) {
                    result = Math.ceil((toRecover / 100) / 3) * 100;
                    gType = GAME_3X;
                }
                else {
                    result = Math.ceil((toRecover / 100) / 4) * 100;
                    gType = GAME_4X;
                }
                currentBet = result + 200;
                //log('RESULT=', result)

            } else {
                //if (gType == "" && toRecover <= (config.baseBet.value * config.maxToRecoverToPlay2x.value)) {
                //    //currentBet -= Math.round(increment / 200) * 100;
                //    gType = GAME_WIN1T;
                //    increment = 0;
                //}
                gType = "";
                if (increment == 0) {
                    // linear increment
                    increment = Math.ceil((currentBet / 10000) * config.percIncrement.value) * 100;
                    //log("INCREMETTT=", increment)
                    if (increment < 100)
                        increment = 100;
                }
                //log('INC=', increment / 100)
                let intTemp = increment < 100 ? 100 : increment;
                currentBet += intTemp;
            }
        }
    }

}

function resetGame()
{
    gType = "";
    currentRound = 0;
    stopTimes = config.stopTimes.value;
    n = 0;
    toRecover = 0;
    currentBet = config.baseBet.value;
    increment = 0;
}

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min)) + min; //Il max è escluso e il min è incluso
}