var config = {
    test: { value: 3, type: 'multiplier', label: 'Mult to ' },
    payout: { value: 2.4, type: 'multiplier', label: 'Mult' },
    baseBet: { value: 5000, type: 'balance', label: 'Base Bet' },
    mult: { value: 1.8, type: 'multiplier', label: 'x after KO' },
    startAfter: { value: 11, type:'multiplier', label: 'Times After Start'},
    maxT: { value: 16, type:'multiplier', label: 'MaxT'},
    playfor: { value: 100, type:'multiplier', label: 'PlayFor'},

};


const payout = config.payout.value;
const increaseMult = config.mult.value;
let disaster = 0;
let currentRound = 0;

log('Script is running..');

let currentBet = config.baseBet.value;
let maxBets = 0;

const startAfter  = config.startAfter.value;
let maxTimesEver = 0;
let currentTimes = 0;
let timeToPlay = config.playfor.value;
let maxTimes = config.maxT.value;
let inCycle = false;
let disasterToStart = 0;
let start = false;


showStats(currentBet,increaseMult);


engine.on('GAME_STARTING', onGameStarted);
engine.on('GAME_ENDED', onGameEnded);


function onGameStarted() {
    if (!start) {
        log("T",currentTimes, " wait for disaster");

    }
    else {
            if (timeToPlay>0 || inCycle) {
                inCycle = true;
                log('ROUND ', ++currentRound, '(-',timeToPlay--,') - DIS: ', disaster, ' - betting', Math.round(currentBet / 100), 'on', payout, 'x');
                engine.bet(currentBet, payout);
            }
            else {
                start = false;
                timeToPlay = config.playfor.value;
            }
    }
}

function onGameEnded() {
    var lastGame = engine.history.first()

        if (lastGame.cashedAt && lastGame.wager) {
            inCycle = false;
            currentBet = config.baseBet.value;
            currentTimes = 0;
            log('We won, so next bet will be', currentBet / 100, 'bits')

        } else if (maxTimes >0 && currentTimes >= maxTimes && lastGame.wager) {
            log('Was about to bet', currentTimes, '> max bet times, so disaster.. :(');
            disaster++;
            currentTimes = 0;
            inCycle = false;
            currentBet = config.baseBet.value;
        }
        else {
                if (start) {
                    currentTimes++;
                    currentBet = Math.ceil((currentBet / 100) * increaseMult) * 100;
                    if (currentBet > maxBets) {
                        maxBets = currentBet;
                    }
                    if (currentTimes > maxTimesEver)
                        maxTimesEver = currentTimes;
                }
                else
                {
                    if (lastGame.bust >=config.test.value)
                        currentTimes =0;
                    else
                        currentTimes++;
                    if (currentTimes >= config.startAfter.value) {
                        start = true;
                        inCycle = true;
                        currentTimes = 0;
                        currentBet = config.baseBet.value;
                    }
                }
        }
    if (start && (timeToPlay < config.playfor.value))
        log('LOST, so', currentBet / 100, 'bits, maxbets = ', maxBets / 100, '- T:', currentTimes, ' - MAXT:' + maxTimesEver);
}

function showStats(initBet, mult)
{
    let i;
    let count = 0;
    let bet = initBet;
    log("------ INFO -----")
    for (i =0; i<10; i++)
    {
        count+=bet;
        log('T:',i,' - bet:', (bet /100).toLocaleString('de-DE'), ' - tot: ', (count /100) .toLocaleString('de-DE'));
        bet = Math.ceil((bet /100) * mult) * 100;
    }
}
