var config = {
    mult: {
        value: 10, type: 'multiplier', label: 'Moltiplicatore'
    },
    bet: {
        value: 100, type: 'balance', label: 'Puntata iniziale'
    },
    normalBets: {
        value: 100, type: 'multiplier', label: 'Quante volte fare una puntata normale'
    },
    timesToChange: {
        value: 150, type: 'multiplier', label: 'Poi dopo x volte in cui non vinci'
    },
    multFactor: {
        value: 20, type: 'multiplier', label: 'fattore di moltiplicazione / divisione'
    },
    initBalance: { value: 2000000, type: 'balance', label: 'Init Balance' },
    simulation: { value: 1, type: 'multiplier', label: 'Simulate?' },
};

const simulation = config.simulation.value === 1;

var mult = config.mult.value;
var baseBet = config.bet.value;
var multFactor = config.multFactor.value;
var timesToChange = config.timesToChange.value;
var normalBets = config.normalBets.value + timesToChange;
var failBets = 0;
var negativeChanges = 0;
let balance = config.initBalance.value == 0 ? (await this.bet(100, 1.01)).balance : config.initBalance.value;
let initBalance = balance;
let totalGain = 0;

this.log('PaoloBet start!!!');

while (true){
    let gainString = '$ ' + ((balance - initBalance) / 100).toFixed(2);

    const { multiplier } = (simulation ? await this.bet(100, 1.01) : await this.bet(baseBet, mult))

    this.log(gainString, " | BET ", baseBet/100, ": ", parseFloat(mult).toFixed(2), "x , RES:", multiplier);

    if (multiplier <= mult) {
        balance -= baseBet;
            //PERSO
            if (normalBets === 0) {
                failBets++;
                if (failBets % timesToChange == 0) {
                    negativeChanges++;
                    mult = (mult / multFactor) + negativeChanges;
                    baseBet *= multFactor;
                } else {
                    mult++;
                }
            } else {
                mult++;
                normalBets--;
                if (normalBets == 0) {
                    negativeChanges = 1;
                    mult = (mult / multFactor) + negativeChanges;
                    baseBet *= multFactor;
                }
            }
        }
        else {
            balance += (Math.floor(mult * baseBet) - baseBet);
            //VINTO
            this.log("Riparto!");
            reset();
        }
    }

function reset()
{
    mult = config.mult.value;
    baseBet = config.bet.value;
    failBets = 0;
    normalBets = config.normalBets.value + timesToChange;
    negativeChanges = 0;
}