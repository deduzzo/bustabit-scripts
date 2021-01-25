var config = {
    baseBet: { value: 1000, type: 'balance', label: 'Bet (MIN 10, none for AUTO):', optional: true, },
    multMax: { value: 1.99, type: 'multiplier', label: 'Max Mult'},
    multMin: { value: 1.11, type: 'multiplier', label: 'Min Mult'},
    numMinRandomRetry: { value: 15, type: 'multiplier', label: 'Min Random Retry'},
    numMaxRandomRetry: { value: 18, type: 'multiplier', label: 'Max Random Retry'},
    maxRandomMultiply: { value: 20, type: 'multiplier', label: 'Max Multiply for random '},
    minRandomMultiply: { value: 8, type: 'multiplier', label: 'Min Multiply for random '},
    strategyOnLoss: {
    value: 'x100', type: 'radio', label: 'Strategy in Recovery LOSS',
    options: {
      x100: { value: 'x100', type: 'noop', label: 'x100 Bet / 1.10 Payout' },
      x1000: { value: 'x1000', type: 'noop', label: 'x1000 Bet / 1.01 Payout (Suggested)' },
      }
    },
    numMaxLostRetry: { value: 2, type: 'multiplier', label: 'Max Lost Retry'},
    recalibrateEveryCicle: { type: 'multiplier', label: 'Recalibrate base bet every x cicle (none to disable calibration)', optional: true,},
    recalibrationCoefficent: { value: 4, type: 'multiplier', label: 'Recalibration Coefficent', optional: true,},
};

const multMax = config.multMax.value;
const multMin = cosnfig.multMin.value;
const strategyOnLoss = config.strategyOnLoss.value;
const multRecover = config.strategyOnLoss.value == 'x100' ? 1.10 : 1.01;
const numMinRandomRetry = config.numMinRandomRetry.value;
const numMaxRandomRetry = config.numMaxRandomRetry.value;
var numMaxLostRetry = undefined ? -1 : config.numMaxLostRetry.value;
const maxRandomMultiply = config.maxRandomMultiply.value;
const minRandomMultiply = config.minRandomMultiply.value;
const recalibrateEveryCicle = config.recalibrateEveryCicle.value;
const recalibrationCoefficent = config.recalibrationCoefficent.value;

var currentBet = config.baseBet.value;
var calibrationEnabled = currentBet == undefined ? false : recalibrateEveryCicle == undefined ? false : true;
var retry = 0;
var losts = 0;
var lostsBalance = 0.0;
var times = 1;
var balance = 0;
var startTime = new Date();
var disasterCases = 0;
var randomRecovers = 0;
var successfullyRandomRecovers=0;
var emergencyRecovers = 0;
var timesLostsCount = 0;
var statsValues = {veryLower: 1.01, midLower: 1.10, highLower: 1.30, lowHigher: 40, midHigher: 100, veryHigher: 1000};
var lowers = { veryLowers: {last: 0, values: []}, midLowers: {last: 0, values: []}, highLowers: {last: 0, values: []} };
var highers = { lowHighers: {last: 0, values: []}, midHighers: {last: 0, values: []}, veryHighers: {last: 0, values: []} };
var totalTimes = 0;

if (numMaxLostRetry == 0)
  numMaxLostRetry = -1;
if (numMaxLostRetry == -1)
  calibrationEnabled = 0;


log('AVVIO ', numMaxLostRetry == -1 ? "NO EMERGENCY" : strategyOnLoss, 'mode calib: ', calibrationEnabled);

//fetch('https://jsonplaceholder.typicode.com/posts/1')
//  .then(response => response.json())
//  .then(json => log(json))
// http://ef9e5571.ngrok.io
  
if (calibrationEnabled)
  calibrateBaseBet();

engine.bet(currentBet, mult());

engine.on('GAME_STARTING', onGameStarted);
engine.on('GAME_ENDED', onGameEnded);


function onGameStarted() {
  if (times % recalibrateEveryCicle == 0 && calibrationEnabled)
    calibrateBaseBet();
  if (losts > numMaxLostRetry && numMaxLostRetry >=0)
  {
    timesLostsCount+=losts;
    disasterCases++;
    if (calibrationEnabled)
      calibrateBaseBet();
    incTimer();
    log('Pazienza :( Ricominciamo!)');
    losts = 0;
  }
  if (retry >0)
  {;
    var recover = currentBet == 100 ? currentBet : currentBet / 10;
    lostsBalance+= recover;
    var tempMult = lostsBalance >= (currentBet / 1.3) ? (((getRandomInt(minRandomMultiply,maxRandomMultiply)* 100) + getRandomInt(1,99)) / 100) : (lostsBalance / recover) + 0.01;
      log('Ancora ', retry, ' gir', retry == 1 ? 'o' : 'i', ' di RANDOM MODE: punto', recover/100, ' BIT a ', tempMult > 1.01 ? tempMult.toFixed(2) : 1.1, 'x');
      engine.bet(recover, parseFloat(tempMult > 1.01 ? tempMult : 1.01));
  }
  else if (losts >0)
  {
    if (losts == 1)
    {
      emergencyRecovers++;
    }
    var multiply = strategyOnLoss == 'x100' ? 10 : 100;
    var q = (currentBet * multiply + (((numMaxRandomRetry +1) * currentBet) * (multiply / 10)));
      log('EMERGENCY MODE: Punto ', q/100, ' BIT a ', losts == 1 ? multRecover : losts, 'x');
      engine.bet(q, Math.floor(losts) == 1 ? parseFloat(multRecover) : Math.floor(parseFloat(losts)));
  }
  else
  {
    var tm = mult();
    log('[',times,'] ','Punto ', currentBet/100, ' BIT a ', tm, 'x');
    engine.bet(currentBet, tm);
  }
}

function onGameEnded() {
  totalTimes++;
  log("°°°FINE TURNO ",totalTimes,'°°°')
  var lastGame = engine.history.first();

  var l = {n: totalTimes, bust: lastGame.bust};
  if (lastGame.bust >= statsValues.lowHigher)
  {
    highers.lowHighers.last = totalTimes;
    highers.lowHighers.values.push(l);
    if (lastGame.bust >= statsValues.midHigher)
    {
      highers.lowHighers.last = totalTimes;
      highers.lowHighers.values.push(l);
    }
    if (lastGame.bust >= statsValues.veryHigher)
    {
      highers.veryHighers.last = totalTimes;
      highers.veryHighers.values.push(l);
    }
  }
  else if (lastGame.bust <= statsValues.highLower)
  {
    lowers.highLowers.values.push(l);
    lowers.highLowers.last = totalTimes;
    if (lastGame.bust <= statsValues.midLower)
    {
      lowers.midLowers.last = totalTimes;
      lowers.midLowers.values.push(l);
    }
    if (lastGame.bust <= statsValues.veryLower)
    {
      lowers.veryLowers.last = totalTimes;
      lowers.veryLowers.values.push(l);
    }
  }

  if (totalTimes % 50 == 0)
    showStats();

  if (!lastGame.wager) {
      return;
  }
  if (lastGame.cashedAt)
    balance+= Math.floor(lastGame.cashedAt * lastGame.wager) - lastGame.wager;
  else
  {
    balance-= lastGame.wager;
  }

  if (retry > 0)
  {
    if (lastGame.cashedAt)
      lostsBalance -= (lastGame.cashedAt * lastGame.wager);
    log('_______ RND BALANCE: ', (lostsBalance/100).toFixed(2), ' BIT _______');
  }

  if (lostsBalance < 0 && retry >0)
  {
    losts = 0;
    retry = 0;
    lostsBalance = 0;
    incTimer();
    log('RANDOM MODE WORKS!! ripartiamo!');
    successfullyRandomRecovers++;
  }
  else {
    if (lastGame.cashedAt) {
        log('[' , times, '] *°*°*°*°*° WIN ', Math.floor((lastGame.cashedAt * lastGame.wager) - lastGame.wager).toFixed(2)/100, ' BIT! *°*°*°*°*°');
        if (retry == 0)
        {
          timesLostsCount+=losts;
          losts = 0;
          incTimer();
        }
        if (retry > 0)
        {
            retry--;
            if (retry == 0)
                losts=1;
        }
    }
    else
    {
        if (losts == 0 && retry == 0 ) {
            retry = getRandomInt(numMinRandomRetry,numMaxRandomRetry);
            log('Perso :( RANDOM MODE per', retry, retry == 1 ? 'turno' : 'turni');
            randomRecovers++;
            lostsBalance = parseFloat(currentBet);
        }
        else
        {
          if (retry > 0)
              retry--;
          if (losts == 0 && retry == 0 && numMaxLostRetry != -1)
              losts = 1;
          else if (retry==0 && numMaxLostRetry != -1) {
              losts+=1;
          }
        }
    }
  }
}

//The maximum is inclusive and the minimum is inclusive
function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function mult() {
  return parseFloat((getRandomInt(multMin * 100, multMax * 100) / 100).toFixed(2));
}

function calibrateBaseBet()
{
  var userBalance = userInfo.balance;
  var multiply = strategyOnLoss == 'x100' ? 10 : 100;
  var currentBetTemp = 1000; // minimum
  var step = 1000;
  var findBaseBet = false;
  while (!findBaseBet)
  {
    var q = (currentBetTemp * multiply + (((numMaxRandomRetry +1 ) * currentBetTemp) * (multiply / 10)));
    if (q * (numMaxLostRetry * recalibrationCoefficent) > userBalance)
      findBaseBet = true;
    else
      currentBetTemp += step;
  }
  log('@@@@@ q=', q / 100," - Bet consigliato: ", currentBetTemp /100, " BIT @@@@@ ");
  currentBet = currentBetTemp;
}

function showInfo()
{
  var uptime =  Math.abs(new Date() - startTime);
  var total_seconds = parseInt(Math.floor(uptime / 1000));
  var total_minutes = parseInt(Math.floor(total_seconds / 60));

  var gfb = (balance / total_minutes) / currentBet;
  log('=======================================');
  log('BALANCE: ****[', userInfo.balance / 100, 'BIT ]****');
  log ('UP:', showTime(uptime));
  log('N:',times, ' - Dis:', disasterCases, ' - Emrg:', emergencyRecovers- disasterCases, '/', emergencyRecovers, ' - Rnd:', successfullyRandomRecovers, '/', randomRecovers, ' - Emrg.Av:', emergencyRecovers == 0 ? 'N/A' : (timesLostsCount / emergencyRecovers).toFixed(2));
  var gm = total_minutes == 0 ? -1 : ((balance / 100) / total_minutes).toFixed(2);
  log('GAIN:', balance/100, ' - Gain/m:', gm == -1 ? 'N/A' : gm, ' - Bet/GainM:', gm == -1 ? 'NA': ( (gm / (currentBet/100)) *100).toFixed(2) , '%');
  log('=======================================');
}

function incTimer()
{
  showInfo();
  times++;
}

function showTime(time)
{
  var total_seconds = parseInt(Math.floor(time / 1000));
  var total_minutes = parseInt(Math.floor(total_seconds / 60));
  var total_hours = parseInt(Math.floor(total_minutes / 60));
  var days = parseInt(Math.floor(total_hours / 24));

  return days + 'd ' + total_hours % 24 + 'h ' + total_minutes % 60 + 'm ' + total_seconds % 60 + 's';
}

function showStats()
{
  log("");
  log("/////////////////////////////////");
  log("MINIMI: (<", statsValues.highLower,')');
  log(lowers);
  log("°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°°")
  log("MASSIMI: (>", statsValues.lowHigher,')')
  log(highers);
  log("/////////////////////////////////");
  log("");
}
