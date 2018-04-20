var config = {
};

var totalTimes = 0;
var currentBets = {}

log('AVVIO sentinel');

//engine.bet(currentBet, mult);

engine.on('GAME_STARTED', onGameStarted);
engine.on('GAME_ENDED', onGameEnded);

function onGameStarted() {
currentBets = new Map(engine.playing);
   log('Bets:' , currentBets);
}


function onGameEnded() {
  totalTimes++;
  log("°°°FINE TURNO ",totalTimes,'°°°')
  var lastGame = engine.history.first();
  log('Last:',lastGame);
  if (currentBets.size != 0)
  {
    var toUpload = lastGame;
    toUpload.bets = map_to_object(currentBets);
    toUpload.date = new Date();
    log('Uploading: ',JSON.stringify(toUpload));
    fetch('https://server2.erainformatica.it:3001/busts/add?data=' + JSON.stringify(toUpload));
    currentBets = {};
  }
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