var config = {
    baseBet: { label: "Base bet", type: "balance", value: 100 },             // how many satoshis to bet initially
    target: { label: "Target", type: "multiplier", value: 3 },               // target multiplier
    betMultiplier: { label: "Bet multiplier", type: "multiplier", value: 1.5 } // what to multiply the bet size by when we lose a wager
}


let lossCount = 0
let maxT = 0

showStats(config.baseBet.value, config.betMultiplier.value, this)

while (true) {
    // make the bet and wait for the result
    const { multiplier } = await this.bet(betSize(lossCount), config.target.value)

    if (multiplier < config.target.value) { // loss
        lossCount++;
        if (lossCount > maxT) maxT = lossCount;
        this.log(`T= ${lossCount} LOST. New bet size of ${betSize(lossCount)} satoshis. MAXT= ${maxT}`)
    } else { // win
        lossCount = 0
        this.log(`WIN!! Resetting bet to ${config.baseBet.value} satoshis.`)
    }
}

function betSize(lossCount) {
    const bet = config.baseBet.value * Math.pow(config.betMultiplier.value, lossCount)
    return Math.round(bet / 100) * 100
}


function showStats(initBet, mult, self)
{
    let i;
    let count = 0;
    let bet = initBet;
    self.log("------ INFO -----")
    for (i =0; i<30; i++)
    {
        count+=bet;
        self.log('T:',i,' - bet:', (bet /100).toLocaleString('de-DE'), ' - tot: ', (count /100) .toLocaleString('de-DE'));
        bet = Math.round((bet /100) * mult) * 100;
    }
}
