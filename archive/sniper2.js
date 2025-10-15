var config = {
    target: { value: 'dirt56664', type: 'text', label: 'User to follow' },
    maxBet: { value: 1e8, type: 'balance', label: 'Max Bet' },
    coefficent: { value: 1.10, type: 'multiplier', label: 'Edit Coefficent'},
};


log('Script is running..');
engine.on('GAME_ENDED', onGameEnded);

function onGameEnded() {
    var out;
    var lastGame = engine.history.first();
    if (!lastGame.wager) {
        log("NOT PLAYED");
    }
    // we won..
    else if (lastGame.cashedAt) {
        log("OK ", lastGame.wager / 100, " at " + lastGame.cashedAt, " bust ", lastGame.bust, " gain:" ,(Math.floor((lastGame.wager * lastGame.cashedAt) - lastGame.wager) / 100).toFixed(2));
    } else
    {
        log("KO ", lastGame.wager / 100 , " bust ", lastGame.bust);
    }
}

engine.on('BET_PLACED', (bet) => {
    if (bet.uname == config.target.value) {

        if (userInfo.balance < 100) {
            log('You have a balance under 1 bit, you can not bet');
            return;
        }

        var wager = Math.min(userInfo.balance, Math.round((bet.wager/ 100) * config.coefficent.value) * 100, config.maxBet.value);
        engine.bet(wager, Number.MAX_VALUE); // aim at max profit...
    }
});

engine.on('CASHED_OUT', (cashOut) => {
    if (cashOut.uname === config.target.value) {
        log(cashOut.uname , ' CASH OUT' , cashOut.wager/ 100, ' at ', cashOut.cashedAt, 'x');

        if (engine.currentlyPlaying()) {
            engine.cashOut();
        }

    }
})