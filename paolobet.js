
var config = {
    mult: {
        value: 12, type: 'multiplier', label: 'Moltiplicatore'
    },
    bet: {
        value: 1200, type: 'balance', label: 'Puntata iniziale'
    },
    highValue: {
        value: 200, type: 'multiplier', label: 'Punteggio Alto'
    },
    timesToStop: {
        value: 0, type: 'multiplier', label: 'n giocate di stop in caso di punteggio alto'
    },
    normalBets: {
        value: 120, type: 'multiplier', label: 'Quante volte fare una puntata normale'
    },
    timesToChange: {
        value: 200, type: 'multiplier', label: 'Poi dopo x volte in cui non vinci'
    },
    multFactor: {
        value: 20, type: 'multiplier', label: 'fattore di moltiplicazione / divisione o di recupero'
    },
    maxBets: {
        value: 90000, type: 'multiplier', label: 'max volte prima di ricominciare dal principio'
    },
    initBalance: { value: 1000000, type: 'balance', label: 'Iteration Balance (0 for all)' },
    stepBalance: { value: 10000, type: 'balance', label: 'step Balance' },
    stopDefinitive: { value: 1000, type: 'multiplier', label: 'Script iteration number of games' },
};

var mult = config.mult.value;
var baseBet = config.bet.value;
var timesToStop = config.timesToStop.value;
var highValue = config.highValue.value;
var timesToChange = config.timesToChange.value;
var multFactor = config.multFactor.value;
var normalBets = config.normalBets.value;
var failBets = 0;
var highResult = 0;
var negativeChanges = 0;
var maxBets = config.maxBets.value;

const stopDefinitive = config.stopDefinitive.value;
let balance = config.initBalance.value == 0 ? userInfo.balance : config.initBalance.value;
let initBalance = balance;
let totalGain = 0;
let currentRound = 0;
let disaster = 0;
let itTotal = 1;

engine.on('GAME_STARTING', onGameStarted);
engine.on('GAME_ENDED', onGameEnded);

log('PaoloBet start!!!');

function onGameStarted() {
        let gainString = "IT" + itTotal + "/" + disaster + "|" + currentRound + '| $T' + ((totalGain + (balance - initBalance)) / 100000).toFixed(2) + 'k| ' + ((balance - initBalance) / 100000).toFixed(2) + 'k| ';
        if (highResult && timesToStop > 0) {
            log('Aspetto ancora per', highResult, ' turni')
            highResult--;
        } else {
            if ((balance - baseBet) < 0) {
                disaster++;
                log("Disaster!! :(");
                showSmallStats();
                resetCycle();
            }
            if (maxBets == 0) {
                resetCycle();
                log("MAX TENTATIVI ESEGUITI, RESETTO");
            }
            log(gainString, baseBet / 100, " a ", parseFloat(mult).toFixed(2), "x [ -", maxBets, "]");
            engine.bet(baseBet, mult);
        }
}

function onGameEnded() {
    currentRound++;
    var lastGame = engine.history.first();

    if (lastGame.bust >= highValue) {
        log("PUNTEGGIO ALTO, ASPETTO...");
        highResult = timesToStop;
    }
    if (lastGame.wager) {
        //se ho giocato
        if (lastGame.cashedAt === 0) {
            balance -= baseBet;
            //PERSO
            if (normalBets == 0) {
                failBets++;
                if (failBets % timesToChange == 0) {
                    negativeChanges++;
                    mult = (mult / multFactor) +1;
                    baseBet *= multFactor;
                }
                mult++;
            } else {
                mult++;
                normalBets--;
                if (normalBets == 0) {
                    negativeChanges = 1;
                    mult = (mult / multFactor) +1;
                    baseBet *= multFactor;
                }
            }
            maxBets--;
        } else {
            balance += Math.floor(lastGame.cashedAt * lastGame.wager) - lastGame.wager;
            log("Vinto!");
            //VINTO
            if (currentRound > stopDefinitive) {
                log("Iteration END!!");
                showSmallStats();
                resetCycle();
            } else {
                log("Riparto!");
                reset();
            }
        }
    }
}


function showSmallStats(){
    log("DIS:", disaster, ' WINS: ', itTotal - disaster, 'BALANCE: ', balance / 100, ' - gain ', (balance - initBalance) / 100);
}

function reset()
{
    let addedBet = Math.floor((balance - initBalance) / config.stepBalance.value) * 100;
    mult = config.mult.value;
    baseBet = config.bet.value + addedBet;
    failBets = 0;
    normalBets = config.normalBets.value;
    negativeChanges = 0;
    maxBets = config.maxBets.value;
}

function resetCycle()
{
    itTotal++;
    totalGain += balance - initBalance;
    balance = config.initBalance.value == 0 ? userInfo.balance : config.initBalance.value;
    currentRound = 0;
    reset();
}