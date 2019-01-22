var config = {
    payout: { value: 3, type: 'multiplier', label: 'Mult' },
    baseBet: { value: 1000, type: 'balance', label: 'Base Bet' },
    mult: { value: 1.5, type: 'multiplier', label: 'x after KO' },
    strategy: {
        value: 'maxBets', type: 'radio', label: 'Strategy:',
        options: {
            maxBets: { value: '1000000000000', type: 'balance', label: 'Max Bet' },
            freeze: { value: '6', type: 'multiplier', label: 'Last T before flat bet' },
        }
    },
    maxTimes: { value: 0, type:'multiplier', label: 'Max Times'},
    lateTimes: { value: 0, type: 'multiplier', label: 'Late by x times' },
};

const payout = config.payout.value;
const increaseMult = config.mult.value;
let disaster = 0;
let currentRound = 0;

log('Script is running..');

let currentBet = config.baseBet.value;
let maxBets = 0;
const strategy = config.strategy.value;
const betLimit = config.strategy.options.maxBets.value;
const freezeFrom = config.strategy.options.freeze.value;
const lateTimes = config.lateTimes.value;
const maxTimes = config.maxTimes.value;
let maxTimesEver = 0;
let currentTimes = 0;
let timesToStart = lateTimes;

showStats(currentBet,increaseMult);


engine.on('GAME_STARTING', onGameStarted);
engine.on('GAME_ENDED', onGameEnded);


function onGameStarted() {
    if (timesToStart==0) {
        log('ROUND ', ++currentRound, ' - DIS: ', disaster, ' - betting', Math.round(currentBet / 100), 'on', payout, 'x');
        engine.bet(currentBet, payout);
    }
}

function onGameEnded() {
    var lastGame = engine.history.first()

    // If we wagered, it means we played
    if (!lastGame.wager) {
        if (lateTimes > 0 || lastGame.bust >= payout) {
            if (lastGame.bust >= payout) {
                timesToStart = lateTimes;
                log('bust ', lastGame.bust, ' resetting late time, wait for other ', timesToStart)
            }
            else if (timesToStart > 0) {
                timesToStart--;
                log('bust ', lastGame.bust, timesToStart == 0 ? ' ready to play!' : (' wait for other ' + timesToStart))
            }
        }
    }
    else if (timesToStart==0) {
        // we won..
        if (lastGame.cashedAt) {
            currentBet = config.baseBet.value;
            currentTimes = 0;
            log('We won, so next bet will be', currentBet / 100, 'bits')
            if (lateTimes >0) timesToStart = lateTimes;
        } else if (maxTimes >0 && currentTimes >= maxTimes) {
            log('Was about to bet', currentTimes, '> max bet times, so restart.. :(');
            disaster++;
            currentTimes = 0;
            currentBet = config.baseBet.value;
            if (lateTimes > 0) timesToStart = lateTimes;
            }
        else {
            if (!(strategy == 'freeze' && currentTimes >= freezeFrom))
                currentBet = Math.round((currentBet / 100) * increaseMult) * 100;
            if (strategy == 'maxBets' && currentBet >= betLimit) {
                log('Was about to bet', currentBet, '> betlimit ', betLimit / 100, ', so restart.. :(');
                disaster++;
                currentTimes = 0;
                currentBet = config.baseBet.value;
                if (lateTimes > 0) timesToStart = lateTimes;
            } else {
                currentTimes++;
                if (currentBet > maxBets) {
                    maxBets = currentBet;
                }
                if (currentTimes > maxTimesEver)
                    maxTimesEver = currentTimes;
            }
        }
        log('LOST, so', currentBet / 100, 'bits, maxbets = ', maxBets / 100, '- T:', currentTimes, ' - MAXT:' + maxTimesEver , strategy == 'maxBets' ? (' MAXBET: ' + betLimit / 100) : (strategy == 'freeze') ? ('FREEZE AT: ' + freezeFrom) : (''))
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
