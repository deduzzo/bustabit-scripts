var config = {
    payout: { value: 1.07, type: 'multiplier', label: 'Mult' },
    maxT: { value: '25', type: 'multiplier', label: 'T to recover (auto value calculated) ' },
    startGame2After: { value: 5, type: 'multiplier', label: 'XLost to Activate game 2' },
    minimumLostTimesToStart: { value: 10, type: 'multiplier', label: 'Minimum buffer to start GAME 2' },
    offsetAlwaysStart: { value: 6, type: 'multiplier', label: 'Force start GAME 2 after Xlost + this offset' },
    updateBetAfter: { value: 100, type: 'multiplier', label: 'Update bets after x times' },
}

let toRecalibrate = false;

let balanceTot = (await this.bet(100, 1.01)).balance;

this.log('BALANCE: ', balanceTot);

const updateBetAfter = config.updateBetAfter.value;
const mult1 = config.payout.value;
const mult2 = 3;
const minimumLostTimesToStart = config.minimumLostTimesToStart.value;
const startGame2After = config.startGame2After.value;
let currentBet2 = calculateMaxGame2Bets(balanceTot, 1000, startGame2After +1, config.maxT.value, this);
let basebet1 = Math.round((currentBet2 * 2) / (minimumLostTimesToStart +1));
const offsetAlwaysStart = config.offsetAlwaysStart.value;
let currentBet2Default = currentBet2;


let game1Losts = 0;
let game2VirtualLosts = 0;
let currentTimes = 0;
let currentRound = 0;
let currentGameType = 1;

showStats(currentBet2Default,1.5, startGame2After+1, -1, true, this);

this.log ('G2 BET: ', Math.round(currentBet2 / 100), ' - G1 BET:', Math.round(basebet1 / 100));

while (true){
    if (currentGameType == 2)
    {
        // game 2
        this.log('R', ++currentRound, 'G2 -', Math.round(currentBet2 / 100), 'on', mult2, ' - vT:', game2VirtualLosts, ' rT:', currentTimes);
    }
    else if (currentGameType == 1)
    {
        // flat game
        this.log('R', ++currentRound, 'G1 -', Math.round(basebet1 / 100), 'on', mult1, 'x, vT:', game2VirtualLosts, ' rest: ',game1Losts);
    }
    const { multiplier, balance } = currentGameType == 2 ?  await this.bet(Math.round(currentBet2/ 100) * 100, mult2) : await this.bet(Math.round(basebet1 / 100) * 100, mult1);
    balanceTot = balance;

    if (currentRound % updateBetAfter == 0) toRecalibrate = true;

    if (multiplier < mult2) {
        // virtual ko
        game2VirtualLosts++;
    }
    else
        game2VirtualLosts = 0;
    // If we wagered, it means we played

    if ((currentGameType == 2 && multiplier>= mult2) || currentGameType == 1 && multiplier >= mult1) {
        // we win
        if (currentGameType == 2) {
            game1Losts -= minimumLostTimesToStart;
            currentGameType = 1;
            currentBet2 = currentBet2Default;
            currentTimes = 0;
            game2VirtualLosts = 0;
        }
        if (toRecalibrate)
        {
            updateBet(this);
            toRecalibrate = false;
        }
    } else {
        // we lost
        if (currentGameType == 1) {
            game1Losts++;
        }
        else if (currentGameType == 2) {
            currentTimes++;
            currentBet2 = Math.round((currentBet2 / 100) * 1.5) * 100;
        }

        if (currentGameType == 2) {
            this.log('LOST :( GAME 2!! ')
        } else if (currentGameType == 1)
            this.log('LOST, rest: ', game1Losts)
    }

    if (currentGameType == 1) {
        if (((game1Losts / minimumLostTimesToStart >= 1) && game2VirtualLosts > startGame2After) || (game2VirtualLosts > (startGame2After + offsetAlwaysStart)) ) {
            currentGameType = 2;
        }
    }
}

function showStats(initBet, mult, currentT, returnT, verbose, self)
{
    let i;
    let count = 0;
    let bet = initBet;
    let desideredTtotal = 0;
    if (verbose) self.log("------ INFO -----")
    for (i =currentT; i<30; i++)
    {
        count+=bet;
        if (verbose) self.log('T:',i,' - bet:', (bet /100).toLocaleString('de-DE'), ' - tot: ', (count /100) .toLocaleString('de-DE'));
        if (i == returnT) desideredTtotal = count;
        bet = Math.round((bet /100) * mult) * 100;
    }
    return desideredTtotal;
}

function calculateMaxGame2Bets(balance, step, currentT, desideredT, self)
{
    let bet = 0;
    let tempTotal = 0;
    do {
        bet +=step;
        tempTotal = showStats(bet,1.5, currentT ,desideredT, false, self);
    } while (balance > tempTotal)
    return bet - step;
}

function updateBet(self)
{
    currentBet2Default = calculateMaxGame2Bets(balanceTot, 1000, startGame2After +1, config.maxT.value, self);
    currentBet2 = currentBet2Default;
    basebet1 = Math.round((currentBet2 * 2) / (minimumLostTimesToStart +1))
    self.log ('BET UPDATED: g2 BET: ', Math.round(currentBet2 / 100),' - g1 BET:', Math.round(basebet1 / 100));
}