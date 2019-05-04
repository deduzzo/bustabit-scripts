var config = {
    payout: { value: 3, type: 'multiplier', label: 'Mult' },
    payout2: { value: 1.8, type: 'multiplier', label: 'Mult 2' },
    baseBet: { value: 1000, type: 'balance', label: 'Base Bet' },
    mult: { value: 1.5, type: 'multiplier', label: 'x after KO' },
    start2After: { value: 15, type:'multiplier', label: 'Start 2 after'},
};


let payout = config.payout.value;
const increaseMult = config.mult.value;
let disaster = 0;
let currentRound = 0;

log('Script is running..');

let currentBet = config.baseBet.value;
let maxBets = 0;
let maxTimesEver = 0;
let currentTimes = 0;
let roundBets = 0;

showStats(currentBet,increaseMult);


engine.on('GAME_STARTING', onGameStarted);
engine.on('GAME_ENDED', onGameEnded);


function onGameStarted() {
    if (currentRound > config.start2After.value) {
        currentBet = calcBaseBet(roundBets);
        payout = currentRound % 3 == 0 ? config.payout.value : config.payout2.value
    }
    log('ROUND ', ++currentRound, ' - DIS: ', disaster, ' - betting', Math.round(currentBet / 100), 'on', payout, 'x');
    engine.bet(currentBet, payout);
}

function onGameEnded() {
    var lastGame = engine.history.first()

        // we won..
        if (lastGame.cashedAt || roundBets<0 )
        {
            if (roundBets<0 || lastGame.cashedAt >= 3) {
                currentBet = config.baseBet.value;
                payout = config.payout.value;
                currentTimes = 0;
                roundBets = 0;
                currentRound = 0;
                log('We won, so next bet will be', currentBet / 100, 'bits')
            }
            else {
                roundBets -= Math.floor(lastGame.wager * lastGame.cashedAt) - lastGame.wager;
                log("WIN: Bust: ", lastGame.bust, " R:", (roundBets / 100).toFixed(2))
            }
        }
        else {
                roundBets += lastGame.wager;
                currentBet = Math.ceil((currentBet / 100) * increaseMult) * 100;
                currentTimes++;
                if (currentBet > maxBets) {
                    maxBets = currentBet;
                }
                if (currentTimes > maxTimesEver)
                    maxTimesEver = currentTimes;
                log('LOST, so', currentBet / 100, 'bits, maxbets = ', maxBets / 100, '- T:', currentTimes, ' - MAXT:', maxTimesEver, "R:", (roundBets / 100).toFixed(2))
        }

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

function calcBaseBet(amount)
{
    return (amount / 2) + config.baseBet.value;
}
