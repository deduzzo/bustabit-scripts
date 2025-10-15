var config = {
    gameMode: { value: 4, type: 'multiplier', label: 'gamemode'},
    maxProfitMode: { value: 1, type: 'multiplier', label: 'MaxProfitMode'},
    percentOfTotal: { value: 0.1, type: 'multiplier', label: 'PercentOfTotal'},
    baseBet: { value: 1000, type: 'balance', label: 'BaseBet'},
    multiplier: { value: 1.01, type: 'multiplier', label: 'Multiplier'},
    dalembert: { value: 1, type: 'multiplier', label: 'dalembert'},
    maxBet: { value: 100000000, type: 'balance', label: 'MaxBet'},
    maxProfit: { value: 2000000, type: 'balance', label: 'MaxProfit'},
    maxLoss: { value: 3000000, type: 'balance', label: 'MaxLoss'},
    randomBreak: { value: 20, type: 'multiplier', label: 'RandomBreak'},
    
}
//[WARNING] Use this script at your own risk, nobody is responsible if you lose money on bustabit when you use this bot.

//Settings
var GameMode = config.gameMode.value;				    //Default: 5		1 = Martingale, 2 = Paroli, 3 = D’Alembert, 4 = Pluscoup, 5 = Recovery
var MaxProfitMode = config.maxProfitMode.value == 1;	//Default: true		If this setting is true, you will always bet ("PercentOfTotal" * your balance), if this setting is false you will just bet your BaseBet.
var PercentOfTotal = config.percentOfTotal.value;		//Default: 0.1		If MaxProfitMode is true, your BaseBet will always be ("PercentOfTotal" * your balance). Default 0.1% of your total balance.
var BaseBet = config.baseBet.value;				        //Default: 100		This is the value of your first bet (in bits) when MaxProfitMode is set to false.
var Multiplier = config.multiplier.value;			    //Default: 1.05		This is the multiplier where the bot will stop (not on GameMode 2 and 3).
var dalembert = config.dalembert.value;				    //Default: 1		When you play D'alembert you will raise your bet after a loss or lower your bet after a win with this amount.
var MaxBet = config.maxBet.value;			            //Default: 1000000	The bot will never bet more than this amount (in bits).
var MaxProfit = config.maxProfit.value;			        //Default: 100000	The bot will stop when your total balance is higher that this value (in bits).
var MaxLoss = config.maxLoss.value;			            //Default: 25000	You will never lose more than this amount (in bits). If a bet would exceed this amount, the bot stops automatically.
var RandomBreak = config.randomBreak.value;			    //Default: 0		Before the bot places a bet it generates a random number between 0 and 100, if that number is lower than "RandomBreak" the bot will take a break for 1 game. (This will not happen on a loss streak )

// Don't change anything below this if you don't know what you are doing!
var Username = "deduzzo";
var StartBalance = userInfo.balance;
var CurrentGameID = -1;
var FirstGame = true;
var CurrentBet = BaseBet;
var CurrentMultiplier = Multiplier;
var d = new Date();
var StartTime = d.getTime();
var LastResult = "WON";
var Break = false;
// Check previous bet
var LastBet = 0;
var LastProfit = 0;
var NewProfit = 0;
// Paroli variable's
var ParoliRound = 1;
var ParoliGame = 1;
var StartBet = BaseBet;
// Pluscoup variable's
var Unit = 1;
var SessionProfit = 0;
var MaxSessionProfit = Multiplier - 1;
// Recovery variable's
var SessionLost = 0;
var CurrentGameID = 0;

// Paroli Confirm dialog to set Multiplier to X2.0.
if(GameMode == 2){
    if (confirm("[BustaBot] Paroli is currently only available with the multiplier set to X2.0") == true) {
        // Do nothing and continue with the script.
        log('[BustaBot] Multiplier set to X2.0');
    } else {
        // Canceled Paroli mode, bot stopped.
        log('[BustaBot] Canceled paroli mode on multiplier X2.0');
    }
}

// D'alambert Confirm dialog to set Multiplier to X2.0.
if(GameMode == 3){
    if (confirm("[BustaBot] D'alambert is currently only available with the multiplier set to X2.0") == true) {
        // Do nothing and continue with the script.
        log('[BustaBot] Multiplier set to X2.0');
    } else {
        // Canceled Paroli mode, bot stopped.
        log('[BustaBot] Canceled D alambert mode on multiplier X2.0');
    }
}

// Welcome message
log('[BustaBot] Welcome ' + Username);
log('[BustaBot] Your start ballance is: ' + (StartBalance / 100).toFixed(2) + ' bits');

//check if the multiplier is 1 or higher.
if(Multiplier < 1){
    log('[BustaBot] Your multiplier must be 1.0 or higher.');
}

if(GameMode < 1 || GameMode > 5){
    log('[BustaBot] Select a game mode between 1 and 5.');
}


// Start of a game.
engine.on('GAME_STARTING',() => {
    log('---------------------');
    log('[BustaBot] Game #' + CurrentGameID++ + ' started.');

    var random = randomNumber(1,100);

    if(random < RandomBreak){
        log("Taking a break this round.");
        Break = true;
    }

    if(Break == false){

        if(MaxProfitMode == true){
            BaseBet = Math.round((PercentOfTotal / 100) * (userInfo.balance / 100).toFixed(2));
        }

        if (LastResult == 'LOST' && !FirstGame) { // Check if you lost the last game
            if(GameMode == 1){// Martingale
                NewProfit = LastBet + LastProfit;
                CurrentBet = Math.round((NewProfit / LastProfit) * LastBet);
                CurrentMultiplier = Multiplier;
            }

            if(GameMode == 2){// Paroli
                CurrentMultiplier = 2;
                CurrentBet = StartBet;
                log('[BustaBot] Paroli Round: ' + ParoliRound + ' Game: ' + ParoliGame);
                ParoliGame++;
            }

            if(GameMode == 3){// D’Alembert
                CurrentMultiplier = 2;
                CurrentBet = LastBet + dalembert;
            }

            if(GameMode == 4){// Pluscoup
                SessionProfit = SessionProfit - Unit;
                CurrentBet = LastBet;
                CurrentMultiplier = Multiplier;
            }

            if(GameMode == 5){// Recovery
                SessionLost = SessionLost + CurrentBet;
                CurrentBet = LastBet * 2;
                CurrentMultiplier = (SessionLost + CurrentBet) / CurrentBet;
            }
        }
        else { // If won last game or first game

            if(GameMode == 1){// Martingale
                CurrentBet = BaseBet;
                CurrentMultiplier = Multiplier;
            }

            if(GameMode == 2){// Paroli
                CurrentMultiplier = 2;
                if(ParoliGame == 1){
                    StartBet = BaseBet;
                    CurrentBet = StartBet;
                }
                if(ParoliGame == 2){
                    CurrentBet = LastBet * 2;
                }
                if(ParoliGame == 3){
                    CurrentBet = LastBet * 2;
                }
                log('[BustaBot] Paroli Round: ' + ParoliRound + ' Game: ' + ParoliGame);
                ParoliGame++;
            }

            if(GameMode == 3){// D'alambert
                CurrentMultiplier = 2;
                if(!FirstGame)
                {
                    CurrentBet = LastBet - dalembert;
                }
            }

            if(GameMode == 4){// Pluscoup
                CurrentMultiplier = Multiplier;
                if(SessionProfit >= MaxSessionProfit)
                {
                    StartBet = BaseBet;
                    SessionProfit = 0;
                    Unit = 1;
                }
                else
                {
                    Unit ++;
                    while((((Unit * Multiplier) - Unit) + SessionProfit) > MaxSessionProfit){
                        Unit = Unit - 1;
                    }
                }
                if(FirstGame){ Unit = 1; StartBet = BaseBet;}
                if(Unit < 1){
                    Unit = 1;
                    StartBet = BaseBet;
                }
                CurrentBet = Unit * StartBet;
            }

            if(GameMode == 5){// Recovery
                SessionLost = 0;
                CurrentBet = BaseBet;
                CurrentMultiplier = Multiplier;
            }

        }

        //check if current bet is 0 or negative
        if(CurrentBet < 1){
            CurrentBet = 1;
        }

        //Check if a Paroli round is finished and start new round for the next bet.
        if(ParoliGame == 4){
            ParoliGame = 1;
            ParoliRound++;
        }

        // First game is set to false.
        FirstGame = false;
        // Changing last result
        LastResult = "LOST";
        if(((userInfo.balance) - CurrentBet) < ((StartBalance) - MaxLoss)){
            log('[BustaBot] This bet would Exceed Your maximum loss, the bot will stop now... ');
            return;
        }else{
            if (CurrentBet <= userInfo.balance) { // Check if the balance is high enough to place the bet.
                if (CurrentBet > (MaxBet)) { // Check if the bet is higher than the given maximum bet by the user.
                    log('[BustaBot] Current bet exceeds your maximum bet. Your bet is changed to: ' + (MaxBet) + ' bits');
                    CurrentBet = MaxBet;
                }
                log('[BustaBot] Betting ' + (CurrentBet) + ' bits, cashing out at ' + CurrentMultiplier + 'x');
                engine.bet(roundBit(CurrentBet), CurrentMultiplier);
                LastBet = CurrentBet;
                LastProfit = (CurrentBet * CurrentMultiplier) - CurrentBet;
            }
            else { // Not enough balance to place the bet.
                if (userInfo.balance < 10000) { // Stop the bot if balance is less then 100 bits.
                    log('[BustaBot] Your account balance is to low to place a bet.... BustaBot will close now.');
                    return;
                }
                else { // Changes basebet to 1 if balance is to low to make the current bet.
                    log('[BustaBot] Your balance is to low to bet: ' + (CurrentBet / 100) + ' bits.');
                    BaseBet = 1;
                }
            }
        }
    }
});

engine.on('GAME_ENDED', () => {
    var lastGame = engine.history.first();

    if (lastGame.cashedAt) {
        log('[BustaBot] Successfully cashed out at ' + (lastGame.cashedAt) + 'x');
        SessionProfit = SessionProfit + (Unit * MaxSessionProfit);
        if (((userInfo.balance - StartBalance) / 100).toFixed(2) > MaxProfit) {
            log('[BustaBot] Maximum profit reached, bot is shutting down...');
            log('[BustaBot] You have made ' + ((userInfo.balance - StartBalance) / 100).toFixed(2) + ' profit this session.');
            return;
        }
        LastResult = "WON";
    }
    else {
        var newdate = new Date();
        var timeplaying = ((newdate.getTime() - StartTime) / 1000) / 60;
        if (Break == false) {
            log('[BustaBot] Game crashed at ' + (lastGame.bust) + 'x');
            log('[BustaBot] Session profit: ' + ((userInfo.balance - StartBalance) / 100).toFixed(2) + ' bits in ' + Math.round(timeplaying) + ' minutes.');
        } else {
            Break = false;
        }
    }
});

function randomNumber(min,max)
{
    return Math.floor(Math.random()*(max-min+1)+min);
}

function roundBit(bet) {
    return Math.round(bet / 100) * 100;
}