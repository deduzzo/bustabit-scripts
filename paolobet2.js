var config = {
    multmin: {
        value: 12, type: 'multiplier', label: 'min'
    },
    multmax: {
        value: 350, type: 'multiplier', label: 'max'
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
    strategyOnHigh: {
        value: 'stop', type: 'radio', label: 'In caso di punteggio superiore a quello alto:',
        options: {
            stop: { value: 'stop', type: 'noop', label: 'Fermati n volte, poi riprendi' },
            none: { value: 'none', type: 'noop', label: 'Non fare niente di particolare' },
        }
    },
    normalBets: {
        value: 120, type: 'multiplier', label: 'Quante volte fare una puntata normale'
    },
    timesToChange: {
        value: 200, type: 'multiplier', label: 'Poi dopo x volte in cui non vinci'
    },
    strategyOnLoss: {
        value: 'x2div2', type: 'radio', label: 'cosa fai in caso non vinci x volte?',
        options: {
            x2div2: { value: 'x2div2', type: 'noop', label: 'raddoppia e dimezza' },
            recoveryValue: { value: 'recoveryValue', type: 'noop', label: 'recupera puntando ad un valore fisso' },
        }
    },
    multFactor: {
        value: 20, type: 'multiplier', label: 'fattore di moltiplicazione / divisione o di recupero'
    },
    maxBets: {
        value: 90000, type: 'multiplier', label: 'max volte prima di ricominciare dal principio'
    },
    lastTimeDiv: {
        value: 1.4, type: 'multiplier', label: 'lastTimeDiv'
    },
    minMultDiv: {
        value: 400, type: 'multiplier', label: 'minMultDiv'
    },
    initBalance: { value: 1000000, type: 'balance', label: 'Iteration Balance (0 for all)' },
    stepBalance: { value: 10000, type: 'balance', label: 'step Balance' },
    stopDefinitive: { value: 1000, type: 'multiplier', label: 'Script iteration number of games' },
};

var mult = config.multmin.value;
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
var multRecovered = 0;
var lastTimeDiv = config.lastTimeDiv.value;
var minMultDiv = config.minMultDiv.value;
var helper = 0;

const stopDefinitive = config.stopDefinitive.value;
let balance = config.initBalance.value == 0 ? userInfo.balance : config.initBalance.value;
let initBalance = balance;
let totalGain = 0;
let currentRound = 0;
let disaster = 0;
let itTotal = 1;
let up = true;


engine.on('GAME_STARTING', onGameStarted);
engine.on('GAME_ENDED', onGameEnded);

log('PaoloBet start!!!');

function onGameStarted() {
    let gainString ="IT" + itTotal + "/"+disaster+"|" + currentRound + '| $T' + ((totalGain + (balance - initBalance)) / 100000).toFixed(2) + 'k| ' + ((balance - initBalance) / 100000).toFixed(2) + 'k| ';
    if (highResult && timesToStop >0)
    {
        log ('Aspetto ancora per', highResult, ' turni')
        highResult--;
    }
    else
    {
        if (maxBets == 0)
        {
            reset();
            log("MAX TENTATIVI ESEGUITI, RESETTO");
        }
        log(gainString ,baseBet  /100, " a ", parseFloat(config.strategyOnLoss.value == 'recoveryValue' && multRecovered>0 ? multFactor : (helper >1 && mult > minMultDiv ? (mult /lastTimeDiv) : mult)).toFixed(2), "x [ -", maxBets,"]");
        if (config.strategyOnLoss.value == 'recoveryValue' && multRecovered) log("RESTANO ", multRecovered, 'da recuperare')
        engine.bet(baseBet, config.strategyOnLoss.value == 'recoveryValue' && multRecovered>0 ? multFactor : (helper >1 && mult > minMultDiv ? (mult / lastTimeDiv) : mult));
    }
}

function onGameEnded() {
    currentRound++;
    var lastGame = engine.history.first();
    //log(lastGame.bust, "x");
    if (lastGame.bust >= highValue && multRecovered == 0 && config.strategyOnHigh.value == "stop") {
        log("PUNTEGGIO ALTO, ASPETTO...");
        highResult = timesToStop;
    }
    if (lastGame.wager) {
        //se ho giocato
        if (lastGame.cashedAt === 0) {
            balance -= baseBet;
            if ((balance - baseBet) < 0) {
                disaster++;
                log("Disaster!! :(");
                showSmallStats();
                resetCycle();
            } else
            {
                if (mult ===config.multmax.value)
                    up = false;
                else if (mult === config.multmin.value)
                    up = true;
                if (up)
                    mult++;
                else
                    mult--;
            }
            /*{
                //PERSO
                if (normalBets == 0) {
                    failBets++;
                    if (config.strategyOnLoss.value == 'x2div2') {
                        if (failBets % timesToChange == 0) {
                            negativeChanges++;
                            helper = negativeChanges;
                            mult = (mult / multFactor) + negativeChanges - 1;
                            baseBet *= multFactor;
                        } else {
                            mult++;
                        }
                    } else if (config.strategyOnLoss.value == 'recoveryValue') {
                        if (multRecovered == 0 && normalBets == 0) multRecovered = mult;
                        multRecovered++;
                    }
                } else {
                    mult++;
                    normalBets--;
                    if (normalBets == 0) {
                        if (config.strategyOnLoss.value == 'x2div') {
                            negativeChanges = 1;
                            helper = negativeChanges;
                            mult = (mult / multFactor) + negativeChanges - 1;
                            baseBet *= multFactor;
                        } else if (config.strategyOnLoss.value == 'recoveryValue') {
                            if (multRecovered == 0 && normalBets == 0) multRecovered = mult;
                            multRecovered++;
                        }
                    }
                }
                maxBets--;
            }*/
        }
        if (lastGame.cashedAt !== 0) {
            balance += Math.floor(lastGame.cashedAt * lastGame.wager) - lastGame.wager;
            log("Vinto!");
                if (currentRound > stopDefinitive) {
                    log("Iteration END!!");
                    showSmallStats();
                    resetCycle();
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
    mult = config.multmin.value;
    baseBet = config.bet.value + addedBet;
    failBets = 0;
    normalBets = config.normalBets.value;
    negativeChanges = 0;
    maxBets = config.maxBets.value;
    multRecovered = 0;
    helper = 0;
    up = true;
}

function resetCycle()
{
    itTotal++;
    totalGain += balance - initBalance;
    balance = config.initBalance.value == 0 ? userInfo.balance : config.initBalance.value;
    currentRound = 0;
    reset();
}