var config = {
    payout: { value: 2, type: 'multiplier' },
    num: { value: 10000, type: 'multiplier' },
    offset: { value: 10, type: 'multiplier' },
    av: { value: 10, type: 'multiplier' },
};


log('Script is running..');


// Always try to bet when script is started
engine.bet(100, config.payout.value);

engine.on('GAME_STARTING', onGameStarted);
engine.on('GAME_ENDED', onGameEnded);

let max = 0;
let i = 0;
let maxEver = 0;
let maxInMed = 0;
let values = [];
let inMedSeq = [];
let allValues = [];
const average = arr => arr.reduce( ( p, c ) => p + c, 0 ) / arr.length;
const av = config.av.value;
function onGameStarted() {
    engine.bet(100, config.payout.value);
}

function onGameEnded() {
    var lastGame = engine.history.first()

    // If we wagered, it means we played
    if (!lastGame.wager) {
        return;
    }
    i++;
    // we won..
    if (lastGame.cashedAt) {
        if (max > maxEver)
            maxEver = max;
        values.push(max);
        max = 0;
    } else {
        max++;
    }

    if (i >= config.num.value)
    {
        //let av = average(values);
        const offset = config.offset.value;
        //let tempOutOfMed = 0;
        let tempInMed = 1;
        values.forEach(p =>
            {
                if (p>= (av - offset) && p<= (av +offset))
                {
                    inMedSeq.push(tempInMed);
                    if (tempInMed > maxInMed) {
                        maxInMed = tempInMed;
                    }
                    tempInMed = 0;
                    //outMedSeq.push(tempOutOfMed);
                    //if (tempOutOfMed > maxOutOfMed) {
                    //    maxOutOfMed = tempOutOfMed;
                    //    tempOutOfMed = 0;
                    //}
                }
                else {
                    if (p>= (av + offset))
                        tempInMed++;
                    else
                        tempInMed--;
                }
            });
        log("MaxEver:", maxEver, " Av:", average(values), "maxInMEd:", maxInMed);
        for (i=maxEver; i>maxEver-20; i--)
            log("MAXCOUNT(",i + "):" + [...values].filter(p=> p === i).length);
        log("OUTMED:", inMedSeq);
        return;
    }
}