var config = {
    payout: { value: 3.05, type: 'multiplier', label: 'Mult' },
    baseBet: { value: 20000, type: 'balance', label: 'Base Bet' },
    perc2xrecover: { value: 20, type: 'multiplier', label: 'Perc2xRecover' },
    percIncrement: { value: 30, type: 'multiplier', label: 'PercIncrement' },
    maxToRecoverToPlay2x: { value: 1000, type: 'multiplier', label: 'Max lost to Play 2x Recover (mult of bet)' },
};


const payout = config.payout.value;
let currentRound = 0;
let n = 0;
let toRecover = 0;
let increment =0;
let gType = "";
const GAME_2X = "GAME_2X";
const GAME_4X = "GAME_4X";

log('Script is running..');

let currentBet = config.baseBet.value;

engine.on('GAME_STARTING', onGameStarted);
engine.on('GAME_ENDED', onGameEnded);


function onGameStarted() {
    //log('betting', Math.round(currentBet / 100), 'on', payout, 'x');
engine.bet(Math.round(currentBet), payout);

}

function onGameEnded() {
    var lastGame = engine.history.first()
    currentRound++;
    if (lastGame.wager)
        log ("bust:", lastGame.bust, lastGame.bust >= payout ? "WIN!!!!": "LOST :(");
    // If we wagered, it means we played
    if (lastGame.wager && lastGame.cashedAt) {
        var profit = lastGame.cashedAt * lastGame.wager - lastGame.wager;
        toRecover -= profit;
        increment = 0;
        if (toRecover<=0) {
            gType = "";
            currentRound = 0;
            n = 0;
            toRecover = 0;
            currentBet = config.baseBet.value;
        }
    }
    else
    {
        toRecover += currentBet;
    }

    if ((!lastGame.cashedAt && lastGame.wager) || toRecover >0)
    {
        if (lastGame.cashedAt) {
            increment = 0;
            n++;
            let result = 0;
            if (getRandomInt(0, 100) < config.perc2xrecover.value && toRecover <=(config.baseBet.value * config.maxToRecoverToPlay2x.value)) {
                result = Math.ceil((toRecover / 100) / 2) * 100;
                gType = GAME_2X;
            }
            else {
                result = Math.ceil((toRecover / 100) / 4) * 100;
                gType = GAME_4X;
            }
            currentBet = result +200;
            //log('RESULT=', result)
        }
        else {
            if (increment == 0)
            {
                // linear increment
                increment = Math.ceil((currentBet / 10000) * config.percIncrement.value) * 100;
                //log("INCREMETTT=", increment)
                if (increment < 100)
                    increment = 100;
            }
            //log('INC=', increment / 100)
            let intTemp = increment < 100 ? 100 : increment;
            currentBet +=intTemp;
        }

    }

    log ("R:", currentRound," toRec:", toRecover /100, "bit | INC:", increment, "- n:", n, "|Bet ",Math.round(currentBet / 100), 'bit on', payout, 'x', gType != "" ? gType : "");
}

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min)) + min; //Il max è escluso e il min è incluso
}