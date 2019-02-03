var config = {
    payout: { value: 1.20, type: 'multiplier', label: 'Mult' },
    baseBet1: { value: 5000, type: 'balance', label: 'Base Bet for Flat Game' },
    baseBet2: { value: 30000, type: 'balance', label: 'Base Bet for 3x Game' },
    startGame2After: { value: 8, type: 'multiplier', label: 'Play at game 2 after x lost' },
    minimumLostTimesToStart: { value: 10, type: 'multiplier', label: 'Minimum game 1 losts before to start' },
};

const mult1 = config.payout.value;
const mult2 = 3;
const basebet1 = config.baseBet1.value;
const startGame2After = config.startGame2After.value;
const minimumLostTimesToStart = config.minimumLostTimesToStart.value;

log('Script is running..');

let currentBet2 = config.baseBet2.value;
let game1Losts = 0;
let game2VirtualLosts = 0;
let currentTimes = 0;
let currentRound = 0;
let currentGameType = 1;

showStats(currentBet2,1.5);

engine.on('GAME_STARTING', onGameStarted);
engine.on('GAME_ENDED', onGameEnded);


function onGameStarted() {
    if (currentGameType == 2)
    {
        // game 2
        log('ROUND ', ++currentRound, 'GAME 2 - betting', Math.round(currentBet2 / 100), 'on', mult2, 'x T=', currentTimes);
        engine.bet(currentBet2, mult2);
    }
    else if (currentGameType == 1)
    {
        // flat game
        log('ROUND ', ++currentRound, 'GAME 1 - betting', Math.round(basebet1 / 100), 'on', mult1, 'x, virtualT:', game2VirtualLosts, ' to recover: ',game1Losts);
        engine.bet(basebet1, mult1);
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
                currentBet2 = config.baseBet2.value;
                currentTimes = 0;
                game2VirtualLosts = 0;
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
                log('LOST :( GAME 2!! ', currentBet2 / 100, 'bits- virtualT:', game2VirtualLosts, ' realT:', currentTimes)
            } else if (currentGameType == 1)
                log('LOST, to recover: ', game1Losts)
        }

        if (currentGameType == 1) {
            if ((game1Losts / minimumLostTimesToStart >= 1) && game2VirtualLosts > startGame2After) {
                currentGameType = 2;
            }
        }

    }
}

function showStats(initBet, mult)
{
    let i;
    let count = 0;
    let bet = initBet;
    log("------ INFO -----")
    for (i =0; i<30; i++)
    {
        count+=bet;
        log('T:',i,' - bet:', (bet /100).toLocaleString('de-DE'), ' - tot: ', (count /100) .toLocaleString('de-DE'));
        bet = Math.round((bet /100) * mult) * 100;
    }
}
