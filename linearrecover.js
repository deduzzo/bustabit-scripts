var config = {
    payout: { value: 3.05, type: 'multiplier', label: 'Mult' },
    baseBet: { value: 20000, type: 'balance', label: 'Base Bet' },
    perc2xrecover: { value: 40, type: 'multiplier', label: 'Perc2xRecover' },
    percIncrement: { value: 10, type: 'multiplier', label: 'PercIncrement' },
    force2xFrom: { value: 50, type: 'multiplier', label: 'Forge G2 From' },
    rToStop: { value: 90, type: 'multiplier', label: 'Stop From R' },
    stopTimes: { value: 100, type: 'multiplier', label: 'Number times to stop' },
};


const payout = config.payout.value;
let currentRound = 0;
let n = 0;
let toRecover = 0;
let increment =0;
let gType = "";
const GAME_2X = "GAME_2X";
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
        //log('betting', Math.round(currentBet / 100), 'on', payout, 'x');
        log("R:", currentRound, " toRec:", Math.ceil(toRecover / 100), "bit | INC:", Math.round(increment / 100), "- n:", n, "|Bet ", Math.round(currentBet / 100), 'bit on', payout, 'x', gType != "" ? gType : "");
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
                gType = "";
                currentRound = 0;
                stopTimes = config.stopTimes.value;
                n = 0;
                toRecover = 0;
                currentBet = config.baseBet.value;
                increment = 0;
            }
        } else {
            toRecover += currentBet;
        }

        if ((!lastGame.cashedAt && lastGame.wager) || toRecover > 0) {
            if (lastGame.cashedAt) {
                n++;
                let result = 0;
                increment = 0;
                if (currentRound > config.force2xFrom.value || (getRandomInt(0, 100) < config.perc2xrecover.value)) {
                    result = Math.ceil((toRecover / 100) / 2) * 100;
                    gType = GAME_2X;
                } else {
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

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min)) + min; //Il max è escluso e il min è incluso
}