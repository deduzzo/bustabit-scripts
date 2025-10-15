var config = {
};

var totalTimes = 0;
var currentOtherBets = {}

log('AVVIO sentinel');

//engine.bet(currentBet, mult);

engine.on('GAME_STARTED', onGameStarted);
engine.on('GAME_ENDED', onGameEnded);

function onGameStarted() {
currentOtherBets = new Map(engine.playing);
}


function onGameEnded() {
  totalTimes++;
  log("°°°FINE TURNO ",totalTimes,'°°°')
  var lastGame = engine.history.first();
  if (currentOtherBets.size != 0)
  {
    var toUpload = lastGame;
    //toUpload.bets = map_to_object(currentOtherBets);
    toUpload.date = new Date();
    setTimeout(fetchData, getRandomInt(1000,3000),toUpload);
    currentOtherBets = {};
  }
}

function fetchData(toUpload)
{
    fetch('https://server2.erainformatica.it:3001/busts/add?data=' + JSON.stringify(toUpload)).
    then(function() {
        console.log("fetch ok");
    }).catch(function() {
        console.log("error");
    });
}

function map_to_object(map) {
  const out = Object.create(null)
  map.forEach((value, key) => {
    if (value instanceof Map) {
      out[key] = map_to_object(value)
    }
    else {
      out[key] = value
    }
  })
  return out
}

//The maximum is inclusive and the minimum is inclusive
function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}