var config = {
    bet: { value: 5000, type: 'balance', label: 'bet'},
    payout: { value: 3, type: 'multiplier', label: 'Payout' },
    maxT: { value: 20, type: 'multiplier', label: 'MaxT' },
    itOkMultiply: { value: 1, type: 'multiplier', label: 'itOkMultiply' },
    initBalance: { value: 500000, type: 'balance', label: 'Iteration Balance (0 for all)' },
    stopDefinitive: { value: 2, type: 'multiplier', label: 'Script iteration number of times' },
    disasterMultiply: { value: 1, type: 'multiplier', label: 'Disaster Multiply' },
    simulation: { value: 1, type: 'multiplier', label: 'Simulate?' },
};

const simulation = config.simulation.value === 1;

let i = 0;
let k = 0;
const payout = config.payout.value;
let currentBet  = config.bet.value;
let precBet = 0;
let precprecBet = 0;


const stopDefinitive = config.stopDefinitive.value;
let balance = config.initBalance.value == 0 ? this.balance : config.initBalance.value;
let initBalance = balance;
let totalGain = 0;
let currentRound = 0;
let disaster = 0;
let itTotal = 1;
let itOkMultiply = config.itOkMultiply.value;
let tempPayout;
let gainString;

this.log('PaoloBet start!!!');

while (true) {

    gainString = "IT" + itTotal + "/" + disaster + "|cr" + currentRound + '| $T' + ((totalGain + (balance - initBalance)) / 100000).toFixed(2) + 'k| ' + ((balance - initBalance) / 100000).toFixed(2) + 'k| ';
    if (k > config.maxT.value + 2) {
        this.log("disaster!");
        resetCycle(this);
    }
    if (k == 0)
        tempPayout = 1.5;
    else if (k == 1)
        tempPayout = 2;
    else {
        tempPayout = payout;
    }
    this.log(gainString, "T", k++, " I", i, " bet ", roundBit(currentBet) / 100, " on ", tempPayout, "x");
    const {multiplier} = (simulation ? await this.bet(100, 1.01) : await this.bet(currentBet, tempPayout))

    if (multiplier >= tempPayout) {
        this.log("bust:", multiplier, multiplier >= tempPayout ? "WIN!!!!": "");
        if (k>2) currentRound++;
        balance += (Math.floor(tempPayout * currentBet) - currentBet);
        if (currentRound> stopDefinitive) {
           this.log("Iteration END!!");
            showSmallStats(this);
            resetCycle(this);
        }
        if (k>2) reset();
    }
    else {
        balance -= currentBet;
        i++;
        if (k>1) {
            let precBetTemp = currentBet;
            currentBet = currentBet + precBet;
            precBet = precBetTemp;
        }
        if ((balance - currentBet) < 0) {
            disaster++;
            this.log("Disaster!! :(");
            showSmallStats(this);
            resetCycle(this);
        }
    }

}

function reset()
{
    itOkMultiply = config.itOkMultiply.value;
    currentBet  = roundBit(config.bet.value + (currentRound * config.itOkMultiply.value * config.bet.value)) ;
    precBet = 0;
    i = 0;
    k = 0;
}


function resetCycle(self)
{
    currentRound = 0;
    itTotal++;
    totalGain += balance - initBalance;
    balance = config.initBalance.value == 0 ? this.balance : config.initBalance.value;
    //currentBet  = roundBit(config.bet.value + (currentRound * config.itOkMultiply.value * config.bet.value)) ;
    precBet = 0;
    reset();
}

function showSmallStats(self){
    self.log("DIS:", disaster, ' WINS: ', itTotal - disaster, 'BALANCE: ', balance / 100, ' - gain ', (balance - initBalance) / 100);
}

function roundBit(bet) {
    return Math.round(bet / 100) * 100;
}