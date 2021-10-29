var config = {
    payout: { value: 1.16, type: 'multiplier', label: 'Mult' },
    baseBet: { value: 1000, type: 'balance', label: 'Base Bet' },
    mult: { value: 7.3, type: 'multiplier', label: 'x after KO' },

    maxTimes: { value: 7, type:'multiplier', label: 'Max Times'},

    initBalance: { value: 2000000, type: 'balance', label: 'Iteration Balance (0 for all)' },
    stopDefinitive: { value: 2000, type: 'multiplier', label: 'Script iteration number of games' },
};


const payout = config.payout.value;
const increaseMult = config.mult.value;
let disaster = 0;
let currentRound = 0;

log('Script is running..');

let currentBet = config.baseBet.value;
let maxBets = 0;

const maxTimes = config.maxTimes.value;

let maxTimesEver = 0;
let currentTimes = 0;


let totalGain = 0;
let itTotal = 0;
const stopDefinitive = config.stopDefinitive.value;
let balance = config.initBalance.value == 0 ? userInfo.balance : config.initBalance.value;
let initBalance = balance;

showStats(currentBet,increaseMult);


engine.on('GAME_STARTING', onGameStarted);
engine.on('GAME_ENDED', onGameEnded);


function onGameStarted() {
    currentRound++;
    if ((balance - currentBet) < 0) {
        disaster++;
        log("Disaster!! :(");
        resetCycle();
    } else {
        log("[",itTotal,",",disaster,"] T:", currentTimes, " - ROUND ", currentRound, ' - DIS: ', disaster, ' - betting', Math.round(currentBet / 100), 'on', payout, 'x');
        showSmallStats();
        engine.bet(currentBet, payout);
    }
}

function onGameEnded() {
    var lastGame = engine.history.first();

        // we won..
        if (lastGame.cashedAt) {
            balance += Math.floor(lastGame.cashedAt * lastGame.wager) - lastGame.wager;
            currentBet = config.baseBet.value;
            currentTimes = 0;
            if (currentRound >= config.stopDefinitive.value) {
                log("CycleWIN!!");
                resetCycle();
            }
        } else {
            balance -= currentBet;
            currentBet = Math.ceil((currentBet / 100) * increaseMult) * 100;
            if (maxTimes > 0 && currentTimes >= maxTimes) {
                log('Was about to bet', currentTimes, '> max bet times, so restart.. :(');
                disaster++;
                currentTimes = 0;
                currentBet = config.baseBet.value;
            }
            else {
                currentTimes++;
                if (currentBet > maxBets) {
                    maxBets = currentBet;
                }
                if (currentTimes > maxTimesEver)
                    maxTimesEver = currentTimes;
            }
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

function resetCycle()
{
    itTotal++;
    totalGain += balance - initBalance;
    balance = config.initBalance.value == 0 ? userInfo.balance : config.initBalance.value;
    currentRound = 0;
    currentBet = config.baseBet.value;
}

function showSmallStats(){
    log("DIS:", disaster, ' WINS: ', itTotal - disaster, 'BALANCE: ', balance / 100, ' - gain ', (balance - initBalance) / 100);
}
