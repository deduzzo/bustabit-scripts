var config = {
};

var client = new WebSocket('wss://035a92f1.ngrok.io/','echo-protocol');

client.onerror = function() {
    console.log('Connection Error');
};

client.onopen = function() {
    console.log('WebSocket Client Connected');
};

client.onclose = function() {
    console.log('echo-protocol Client Closed');
};

client.onmessage = function(e) {
    if (typeof e.data === 'string') {
        console.log("Received: '" + e.data + "'");
    }
};

function sendBust(bust) {
    if (client.readyState === client.OPEN) {
        client.send(String(bust));
    }
    else
        console.log("no");
}

log('Script is running..');


engine.on('GAME_STARTING', onGameStarted);
engine.on('GAME_ENDED', onGameEnded);

function onGameStarted() {

}

function onGameEnded() {
    var lastGame = engine.history.first()

    sendBust(lastGame.bust);
}