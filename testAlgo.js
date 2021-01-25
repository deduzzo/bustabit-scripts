

var config = {
    payout: { value: 1.6, type: 'multiplier', label: 'Mult' },
    baseBet: { value: 800, type: 'balance', label: 'Base Bet' },
    mult: { value: 8, type: 'multiplier', label: 'x after KO' },
    startAfter: { value: 4, type:'multiplier', label: 'Times After Start'},
    maxT: { value: 3, type:'multiplier', label: 'MaxT'},
    playfor: { value: 40, type:'multiplier', label: 'PlayFor'},

};

const payout = config.payout.value;
const increaseMult = config.mult.value;
let disaster = 0;
let currentRound = 0;

console.log('Script is running..');

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


function onGameStarted() {
    if (!start) {
        console.log("T",currentTimes, " wait for disaster");
        engine.bet(null,0);
    }
    else {
        if (timeToPlay>0 || inCycle) {
            inCycle = true;
            console.log('ROUND ', ++currentRound, '(-',timeToPlay--,') - DIS: ', disaster, ' - betting', Math.round(currentBet / 100), 'on', payout, 'x');
            engine.bet(currentBet, payout);
        }
        else {
            start = false;
            timeToPlay = config.playfor.value;
        }
    }
}

function onGameEnded(lastGame) {
    //var lastGame = engine.history.first()

    if (lastGame.cashedAt && lastGame.wager) {
        inCycle = false;
        currentBet = config.baseBet.value;
        currentTimes = 0;
        console.log('We won, so next bet will be', currentBet / 100, 'bits')

    } else if (maxTimes >0 && currentTimes >= maxTimes && lastGame.wager) {
        console.log('Was about to bet', currentTimes, '> max bet times, so disaster.. :(');
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
            if (lastGame.bust >=payout)
                currentTimes =0;
            else
                currentTimes++;
            if (currentTimes >= config.startAfter.value) {
                start = true;
                inCycle = true;
                currentTimes = 0;
            }
        }
    }
    if (start && (timeToPlay < config.playfor.value))
        console.log('LOST, so', currentBet / 100, 'bits, maxbets = ', maxBets / 100, '- T:', currentTimes, ' - MAXT:' + maxTimesEver);
    onGameStarted();
}

function showStats(initBet, mult)
{
    let i;
    let count = 0;
    let bet = initBet;
    console.log("------ INFO -----")
    for (i =0; i<10; i++)
    {
        count+=bet;
        console.log('T:',i,' - bet:', (bet /100).toLocaleString('de-DE'), ' - tot: ', (count /100) .toLocaleString('de-DE'));
        bet = Math.ceil((bet /100) * mult) * 100;
    }
}



var howManyGames = 1000000;

var currentGame = 0;

var engine = {}
engine.bet = (bet,payout) =>
{
    currentGame ++;
    if (currentGame <howManyGames) {
        var lastGame = {}
        lastGame.wager = bet;
        lastGame.bust = Math.floor(Math.max(0.99 / (1 - Math.random()), 1) * 100) / 100;
        lastGame.cashedAt = payout >= lastGame.bust ? payout : null;
        onGameEnded(lastGame);
    }
}

onGameStarted();