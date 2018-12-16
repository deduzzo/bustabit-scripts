var config = {
    mult: {
        value: 1.10, type: 'multiplier', label: 'Moltiplicatore'
    },
    bet: {
        value: 20000, type: 'balance', label: 'Puntata iniziale'
    },
    highValue: {
        value: 60, type: 'multiplier', label: 'Punteggio Alto'
    },
    timesToStop: {
        value: 3, type: 'multiplier', label: 'n giocate di stop in caso di punteggio alto'
    },
    strategyOnHigh: {
        value: 'stop', type: 'radio', label: 'In caso di punteggio superiore a quello alto:',
        options: {
            stop: { value: 'stop', type: 'noop', label: 'Fermati n volte, poi riprendi' },
            none: { value: 'none', type: 'noop', label: 'Non fare niente di particolare' },
        }
    },
    normalBets: {
        value: 3, type: 'multiplier', label: 'Quante volte fare una puntata normale'
    },
    timesToChange: {
        value: 16, type: 'multiplier', label: 'Poi dopo x volte in cui non vinci'
    },
    multFactor: {
        value: 2, type: 'multiplier', label: 'fattore di moltiplicazione / divisione'
    },
};

var mult = config.mult.value;
var baseBet = config.bet.value;
var strategyOnHigh = config.strategyOnHigh.value;
var timesToStop = config.timesToStop.value;
var highValue = config.highValue.value;
var timesToChange = config.timesToChange.value;
var multFactor = config.multFactor.value;
var normalBets = config.normalBets.value;
var failBets = 0;
var highResult = 0;


engine.on('GAME_STARTING', onGameStarted);
engine.on('GAME_ENDED', onGameEnded);

log('PaoloBet start!!!');

function onGameStarted() {
    if (highResult && timesToStop >0)
    {
        log ('Aspetto ancora per', highResult, ' turni')
        highResult--;
    }
    else
    {
        log ("Punto", baseBet/100, " a ", mult, "x");
        engine.bet(baseBet, mult);
    }
}

function onGameEnded() {
    var lastGame = engine.history.first();
    if (lastGame.wager) {
        if (lastGame.cashedAt === 0) {
            //PERSO
            if (normalBets == 0) {
                failBets++;
                if (failBets % timesToChange == 0) {
                    mult /= multFactor;
                    baseBet *= multFactor;
                } else {
                    mult++;
                }
            } else {
                mult++;
                normalBets--;
                if (normalBets == 0) {
                    mult /= multFactor;
                    baseBet *= multFactor;
                }
            }

        }
    }

    if (lastGame.cashedAt !== 0) {
        //VINTO
        log ("vinto!!, riparto!");
        var profit = lastGame.cashedAt * lastGame.wager - lastGame.wager;

        if (lastGame.bust >= highValue && strategyOnHigh == "stop") {
            log("PUNTEGGIO ALTO, ASPETTO...");
            highResult = timesToStop;
        }
        mult = config.mult.value;
        baseBet = config.bet.value;
        failBets = 0;
        normalBets = config.normalBets.value;
    }


}