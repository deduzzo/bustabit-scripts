var config = {
    mult: {
        value: 10, type: 'multiplier', label: 'Moltiplicatore'
    },
    bet: {
        value: 100, type: 'balance', label: 'Puntata iniziale'
    },
    highValue: {
        value: 200, type: 'multiplier', label: 'Punteggio Alto'
    },
    timesToStop: {
        value: 10, type: 'multiplier', label: 'n giocate di stop in caso di punteggio alto'
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
var multRecovered = 0;


engine.on('game_starting', onGameStarted);
engine.on('game_crash', onGameEnded);

console.log('PaoloBet start!!!');

function onGameStarted() {
    if (highResult && timesToStop >0)
    {
        console.log ('Aspetto ancora per', highResult, ' turni')
        highResult--;
    }
    else
    {
        if (maxBets == 0)
        {
            reset();
            console.log("MAX TENTATIVI ESEGUITI, RESETTO");
        }
        console.log ("Punto", baseBet/100, " a ", parseFloat(config.strategyOnLoss.value == 'recoveryValue' && multRecovered>0 ?
            multFactor : mult).toFixed(2), "x [ -", maxBets,"]");
        if (config.strategyOnLoss.value == 'recoveryValue' && multRecovered) console.log("RESTANO ", multRecovered, 'da recuperare')
        engine.placeBet(baseBet, config.strategyOnLoss.value == 'recoveryValue' && multRecovered>0 ? multFactor * 100 : mult * 100, false);
    }
}

function onGameEnded(data) {
    var lastGame = {}
    lastGame.wager = baseBet;
    lastGame.cashedAt = ((data.game_crash / 100) >= (config.strategyOnLoss.value == 'recoveryValue' && multRecovered>0 ? multFactor : mult)) ? (engine.lastGamePlay() !== "NOT_PLAYED" ? (config.strategyOnLoss.value == 'recoveryValue' && multRecovered>0 ? multFactor : mult) : 0) : 0;
    lastGame.bust = data.game_crash / 100;

    if (lastGame.bust >= highValue && multRecovered == 0 && config.strategyOnHigh.value == "stop") {
        console.log("PUNTEGGIO ALTO, ASPETTO...");
        highResult = timesToStop;
    }
    if (engine.lastGamePlay() !== "NOT_PLAYED") {
        if (lastGame.cashedAt === 0) {
            //PERSO
            if (normalBets == 0) {
                failBets++;
                if (config.strategyOnLoss.value == 'x2div2') {
                    if (failBets % timesToChange == 0) {
                        negativeChanges++;
                        mult = (mult / multFactor) + negativeChanges;
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
                        mult = (mult / multFactor) + negativeChanges;
                        baseBet *= multFactor;
                    } else if (config.strategyOnLoss.value == 'recoveryValue') {
                        if (multRecovered == 0 && normalBets == 0) multRecovered = mult;
                        multRecovered++;
                    }
                }
            }
            maxBets--;
        }
        if (lastGame.cashedAt !== 0) {
            console.log("Vinto!");
            if (config.strategyOnLoss.value == 'x2div2' && lastGame.cashedAt < mult.toFixed(2)) {
                mult -= parseInt(lastGame.cashedAt, 10) - 1;
                console.log("Ricalcolo X: ", mult);
            }
            //VINTO
            else {
                if (config.strategyOnLoss.value == 'x2div2' || (config.strategyOnLoss.value == 'recoveryValue' && multRecovered == 0)) {
                    console.log("Riparto!");
                    var profit = lastGame.cashedAt * lastGame.wager - lastGame.wager;
                    reset();
                } else {
                    multRecovered -= lastGame.cashedAt;
                    if (multRecovered > 0)
                        console.log('Vinto, restano ', multRecovered, 'x da recuperare!')
                    else {
                        console.log('Recuperato! Ripartiamo!');
                        reset();
                    }
                }
            }
        }
    }
}

function reset()
{
    mult = config.mult.value;
    baseBet = config.bet.value;
    failBets = 0;
    normalBets = config.normalBets.value;
    negativeChanges = 0;
    maxBets = config.maxBets.value;
    multRecovered = 0;
}