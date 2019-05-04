var config = {
    payout: { value: 3, type: 'multiplier', label: 'Mult Normal' },
    payout2: { value: 1.9, type: 'multiplier', label: 'Mult 2' },
    waitTime: { value: 4, type: 'multiplier', label: 'Wait Time' },
    payout2Every: { value: 1, type: 'multiplier', label: 'Mult 1 Every' },
    baseBet: { value: 100, type: 'balance', label: 'Base Bet' },
    mult: { value: 1.5, type: 'multiplier', label: 'x after KO' },
    start2After: { value: 21, type:'multiplier', label: 'Start 2 after'},
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
let waitTime = 0;

showStats(currentBet,increaseMult);


engine.on('GAME_STARTING', onGameStarted);
engine.on('GAME_ENDED', onGameEnded);


function onGameStarted() {
    if (waitTime == 0) {
        if (currentRound > config.start2After.value) {
            currentBet = calcBaseBet(roundBets);
            payout = (currentRound) % (config.payout2Every.value + 1) == 0 ? config.payout.value : config.payout2.value
        }
        log('R', ++currentRound, ' - D: ', disaster, ' - ', Math.round(currentBet / 100), 'on', payout, 'x');
        if (currentRound == config.start2After.value)
            waitTime = config.waitTime.value;
        engine.bet(currentBet, payout);
    }
    else
        log("Wait for other, ", waitTime--);
}

function onGameEnded() {
    var lastGame = engine.history.first()

    if (lastGame.wager) {
        // we won..
        if (lastGame.cashedAt || roundBets < 0.0) {
            if (roundBets < 0.0 || lastGame.cashedAt >= config.payout.value) {
                currentBet = config.baseBet.value;
                payout = config.payout.value;
                currentTimes = 0;
                roundBets = 0;
                currentRound = 0;
                log('We won, so next bet will be', currentBet / 100, 'bits')
            } else {
                roundBets -= Math.floor(lastGame.wager * lastGame.cashedAt) - lastGame.wager;
                log("WIN: Bust: ", lastGame.bust, " R:",roundBets, " ", (roundBets / 100).toFixed(2))
            }
        } else {
            roundBets += lastGame.wager;
            currentBet = Math.ceil((currentBet / 100) * increaseMult) * 100;
            currentTimes++;
            if (currentBet > maxBets) {
                maxBets = currentBet;
            }
            if (currentTimes > maxTimesEver)
                maxTimesEver = currentTimes;
            log(lastGame.bust, ' LOST, so', currentBet / 100, 'bits, maxbets = ', maxBets / 100, '- T:', currentTimes, ' - MAXT:', maxTimesEver, "R:", (roundBets / 100).toFixed(2))
        }
    }
    else
        log("bust:", lastGame.bust)

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
    return (amount / (config.payout.value -1)) + config.baseBet.value;
}
