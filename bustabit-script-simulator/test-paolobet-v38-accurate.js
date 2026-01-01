/**
 * TEST ACCURATO PAOLOBET v3.8
 *
 * Questo script usa lo STESSO motore del simulatore web
 * per garantire risultati identici.
 */

const crypto = require('crypto');
const fs = require('fs');
const EventEmitter = require('events');

const GAME_SALT = "00000000000000000001e08b7fd44f95e3e950ac65650a8031a6d5e1750e34be";

// ═══════════════════════════════════════════════════════════════════════════════
// FUNZIONI HASH (identiche al simulatore)
// ═══════════════════════════════════════════════════════════════════════════════

function hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
}

function bytesToHex(bytes) {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function sha256(data) {
    const hash = crypto.createHash('sha256');
    hash.update(Buffer.from(data));
    return new Uint8Array(hash.digest());
}

function hmacSha256(key, data) {
    const hmac = crypto.createHmac('sha256', Buffer.from(key));
    hmac.update(Buffer.from(data));
    return hmac.digest('hex');
}

function gameResult(saltBytes, gameHash) {
    const nBits = 52;
    const hash = hmacSha256(saltBytes, gameHash);
    const seed = hash.slice(0, nBits / 4);
    const r = parseInt(seed, 16);
    let X = r / Math.pow(2, nBits);
    X = 99 / (1 - X);
    return Math.max(1, Math.floor(X) / 100);
}

/**
 * Genera la catena di hash IDENTICA al simulatore web
 * L'hash fornito è l'ULTIMA partita, calcoliamo all'indietro per trovare le precedenti
 * Poi invertiamo per giocare nell'ordine corretto (dalla più vecchia alla più nuova)
 */
function generateHashChain(endHash, amount) {
    let currentHash = typeof endHash === 'string' ? hexToBytes(endHash) : new Uint8Array(endHash);

    // L'hash dell'utente è l'ultima partita
    const tempHashes = [new Uint8Array(currentHash)];

    // Calcola partite più vecchie: SHA256(current) = older
    for (let i = 1; i < amount; i++) {
        currentHash = sha256(currentHash);
        tempHashes.push(new Uint8Array(currentHash));
    }

    // Inverti: [più vecchia, ..., hash utente (più nuova)]
    return tempHashes.reverse();
}

function generateGameResults(endHash, amount) {
    const hashChain = generateHashChain(endHash, amount);
    const saltBytes = Buffer.from(GAME_SALT, 'utf8');

    return hashChain.map(gameHash => ({
        hash: bytesToHex(gameHash),
        bust: gameResult(saltBytes, gameHash)
    }));
}

// ═══════════════════════════════════════════════════════════════════════════════
// SIMULATORE ENGINE (identico al web)
// ═══════════════════════════════════════════════════════════════════════════════

class SimulatedBustabitHistory {
    constructor() { this.data = []; }
    get size() { return this.data.length; }
    get length() { return this.data.length; }
    first() { return this.size > 0 ? this.data[0] : null; }
    last() { return this.size > 0 ? this.data[this.size - 1] : null; }
    toArray() { return this.data; }
}

class SimulatedBustabitEngine extends EventEmitter {
    constructor() {
        super();
        this._userInfo = {
            uname: 'TestUser',
            balance: 0,
            balanceATH: 0,
            balanceATL: 0,
            bets: 0,
            profit: 0,
            profitATH: 0,
            profitATL: 0
        };
        this.history = new SimulatedBustabitHistory();
        this.next = null;
        this.gameState = 'GAME_STARTING';
    }

    getCurrentBet() {
        if (!this.next) return undefined;
        return { wager: this.next.wager, payout: this.next.payout };
    }

    isBetQueued() {
        return !!this.next;
    }

    cancelQueuedBet() {
        this.next = undefined;
    }

    bet(wager, payout) {
        return new Promise((resolve, reject) => {
            this.next = { wager, payout: Math.round(payout * 100) / 100, resolve, reject };
        }).catch(() => {});
    }
}

class BetRejected extends Error {}

// ═══════════════════════════════════════════════════════════════════════════════
// SCRIPT PAOLOBET v3.8 (versione inline per test)
// ═══════════════════════════════════════════════════════════════════════════════

function createPaoloBetV38Script(config) {
    return `
// ═══════════════════════════════════════════════════════════════════════════════
// PAOLOBET OPTIMIZED v3.8 - SCRIPT DI TEST
// ═══════════════════════════════════════════════════════════════════════════════

var startBalance = userInfo.balance;
var targetProfit = Math.floor(startBalance * (${config.takeProfit} / 100));
var calculatedBet = Math.floor(startBalance * (${config.betPercent} / 100));
calculatedBet = Math.max(100, Math.floor(calculatedBet / 100) * 100);

var mult = ${config.mult};
var baseBet = calculatedBet;
var normalBets = ${config.normalBets};
var maxBets = ${config.maxBets};
var failBets = 0;
var negativeChanges = 0;
var multRecovered = 0;

var initMult = mult;
var initBet = baseBet;
var initNormalBets = normalBets;
var initMaxBets = maxBets;

// Pattern Protection
var delay10x = 0;
var delay5x = 0;
var coldStreak = 0;
var isSuspended = false;
var signalReceived = false;
var waitAfterSignal = 0;
var recentGames = [];
var warmupRemaining = ${config.warmupGames};
var isWarmingUp = ${config.warmupGames} > 0;

function reset() {
    mult = initMult;
    baseBet = initBet;
    failBets = 0;
    normalBets = initNormalBets;
    negativeChanges = 0;
    maxBets = initMaxBets;
    multRecovered = 0;
}

function checkSuspension() {
    if (delay10x > ${config.maxDelay10x}) return true;
    if (delay5x > ${config.maxDelay5x}) return true;
    if (coldStreak > ${config.maxColdStreak}) return true;
    return false;
}

function checkResume(lastBust) {
    if (lastBust >= 10) {
        signalReceived = true;
        waitAfterSignal = ${config.resumeWaitGames};
        return false;
    }

    var delaysOk = delay10x <= ${config.maxDelay10x} &&
                   delay5x <= ${config.maxDelay5x} &&
                   coldStreak <= ${config.maxColdStreak};

    if (signalReceived) {
        waitAfterSignal--;
        if (waitAfterSignal <= 0) {
            var last10 = recentGames.slice(-10);
            var count5x = last10.filter(function(g) { return g >= 5; }).length;
            if (count5x >= 2 && delaysOk) return true;
            if (count5x < 2) signalReceived = false;
        }
    }

    var last10 = recentGames.slice(-10);
    var count5x = last10.filter(function(g) { return g >= 5; }).length;
    if (count5x >= 3 && delaysOk) return true;

    return false;
}

engine.on('GAME_STARTING', function() {
    var currentProfit = userInfo.balance - startBalance;

    // Check Take Profit
    if (currentProfit >= targetProfit) {
        stop('TARGET');
        return;
    }

    // Se in warmup
    if (isWarmingUp) {
        return;
    }

    // Se sospeso
    if (isSuspended) {
        return;
    }

    // Check Stop Loss
    var stopLossThreshold = startBalance * (1 - ${config.stopLoss} / 100);
    if (${config.stopLoss} > 0 && userInfo.balance <= stopLossThreshold) {
        stop('STOPLOSS');
        return;
    }

    // Controlla se sospendere
    if (checkSuspension()) {
        isSuspended = true;
        signalReceived = false;
        return;
    }

    // Reset se maxBets esaurito
    if (maxBets <= 0) reset();

    var currentBet = Math.round(baseBet);

    // Limite % balance
    var maxBetByPercent = Math.floor(userInfo.balance * ${config.maxBetPercent} / 100);
    if (currentBet > maxBetByPercent) {
        reset();
        currentBet = Math.round(baseBet);
    }

    if (currentBet > userInfo.balance) {
        stop('BUST');
        return;
    }

    var targetMult = mult;
    engine.bet(currentBet, targetMult);
});

engine.on('GAME_ENDED', function() {
    var lastGame = engine.history.first();
    var lastBust = lastGame.bust;

    // Aggiorna tracking
    recentGames.push(lastBust);
    if (recentGames.length > 30) recentGames.shift();

    if (lastBust >= 10) delay10x = 0; else delay10x++;
    if (lastBust >= 5) delay5x = 0; else delay5x++;
    if (lastBust >= 3) coldStreak = 0; else coldStreak++;

    // Gestione warmup
    if (isWarmingUp) {
        warmupRemaining--;
        if (warmupRemaining <= 0) {
            isWarmingUp = false;
            if (checkSuspension()) {
                isSuspended = true;
                signalReceived = false;
            }
        }
        return;
    }

    // Se sospeso, controlla ripresa
    if (isSuspended) {
        if (checkResume(lastBust)) {
            isSuspended = false;
            signalReceived = false;
        }
        return;
    }

    // Se abbiamo puntato
    if (lastGame.wager) {
        if (!lastGame.cashedAt) {
            // LOSS
            if (normalBets <= 0) {
                failBets++;
                if (failBets % ${config.timesToChange} === 0) {
                    negativeChanges++;
                    var newBet = baseBet * ${config.multFactor};
                    var maxBet = initBet * ${config.maxBetMultiple};

                    if (newBet > maxBet) {
                        mult++;
                    } else {
                        // FORMULA CORRETTA v3.8: mult/factor + 1
                        mult = mult / ${config.multFactor} + 1;
                        baseBet = newBet;
                    }
                } else {
                    mult++;
                }
            } else {
                mult++;
                normalBets--;
            }
            maxBets--;
        } else {
            // WIN - reset
            reset();
        }
    }
});
`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SIMULATORE
// ═══════════════════════════════════════════════════════════════════════════════

function simulate({ config, startingBalance, gameHash, gameAmount }) {
    return new Promise((resolve) => {
        const engine = new SimulatedBustabitEngine();
        const userInfo = engine._userInfo;
        userInfo.balance = startingBalance;
        userInfo.balanceATL = startingBalance;

        let shouldStop = false;
        let stopReason = '';

        const scriptText = createPaoloBetV38Script(config);

        // Funzioni esposte allo script
        const log = () => {};  // Silenzia i log
        const stop = (reason) => {
            shouldStop = true;
            stopReason = reason;
        };

        try {
            const fn = new Function('engine', 'userInfo', 'log', 'stop', scriptText);
            fn.call({}, engine, userInfo, log, stop);
        } catch (e) {
            resolve({ error: e.message });
            return;
        }

        const games = generateGameResults(gameHash, gameAmount);
        let gamesPlayed = 0;
        let betsPlaced = 0;

        for (let id = 0; id < games.length && !shouldStop; id++) {
            try {
                const game = games[id];
                game.wager = 0;
                game.cashedAt = 0;

                engine.emit('GAME_STARTING', {});

                if (shouldStop) break;

                const bet = engine.next;
                engine.next = null;

                if (bet) {
                    if (isNaN(bet.wager) || bet.wager < 100) {
                        throw new BetRejected('INVALID_BET');
                    }
                    if (userInfo.balance - bet.wager < 0) {
                        throw new BetRejected('BET_TOO_BIG');
                    }

                    userInfo.balance -= bet.wager;
                    userInfo.bets++;
                    betsPlaced++;
                    bet.resolve(null);

                    game.wager = bet.wager;
                    game.cashedAt = bet.payout <= game.bust ? bet.payout : 0;

                    if (game.cashedAt > 0) {
                        userInfo.balance += game.cashedAt * game.wager;
                    }

                    userInfo.profit = userInfo.balance - startingBalance;
                    if (userInfo.balance < userInfo.balanceATL) {
                        userInfo.balanceATL = userInfo.balance;
                    }
                }

                engine.history.data.unshift(game);
                engine.emit('GAME_ENDED', { hash: game.hash, bust: game.bust });
                gamesPlayed = id + 1;

            } catch (e) {
                if (e instanceof BetRejected) {
                    stopReason = 'BUST';
                    break;
                }
                break;
            }
        }

        resolve({
            outcome: stopReason.toLowerCase() || 'incomplete',
            outcomeGame: gamesPlayed,
            profit: userInfo.profit,
            profitPercent: (userInfo.profit / startingBalance) * 100,
            finalBalance: userInfo.balance,
            gamesPlayed,
            betsPlaced,
            maxDrawdown: ((userInfo.balanceATL - startingBalance) / startingBalance) * 100
        });
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

const HASH_CHECKPOINTS_10M = require('./hash-checkpoints-10M.js').HASH_CHECKPOINTS_10M;

async function main() {
    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
    console.log('║       TEST ACCURATO PAOLOBET v3.8 (Engine identico al simulatore)        ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
    console.log('');

    const CONFIG = {
        takeProfit: 50,
        betPercent: 0.6,
        mult: 1.5,
        normalBets: 22,
        timesToChange: 8,
        multFactor: 2,
        maxBets: 400,
        maxBetMultiple: 16,
        maxBetPercent: 10,
        stopLoss: 30,
        warmupGames: 15,
        maxDelay10x: 15,
        maxDelay5x: 8,
        maxColdStreak: 5,
        resumeWaitGames: 7
    };

    console.log('📋 CONFIGURAZIONE:');
    console.log('   ─────────────────────────────────────────────────────────────────');
    console.log('   Balance:         1000 bits');
    console.log('   Take Profit:     ' + CONFIG.takeProfit + '%');
    console.log('   Bet Percent:     ' + CONFIG.betPercent + '%');
    console.log('   Mult:            ' + CONFIG.mult + 'x');
    console.log('   normalBets:      ' + CONFIG.normalBets);
    console.log('   timesToChange:   ' + CONFIG.timesToChange);
    console.log('   Stop Loss:       ' + CONFIG.stopLoss + '%');
    console.log('   Warmup:          ' + CONFIG.warmupGames + ' partite');
    console.log('   Protezione:      ' + CONFIG.maxDelay10x + '/' + CONFIG.maxDelay5x + '/' + CONFIG.maxColdStreak);
    console.log('   ─────────────────────────────────────────────────────────────────');
    console.log('');

    // Test hash specifico dell'utente
    const TEST_HASH = 'cfa0f589ec906eba2959bbbf74b853440de9cb64e39d1a3fae02611846814858';

    console.log('🔍 TEST HASH SPECIFICO:');
    console.log('   Hash: ' + TEST_HASH);
    console.log('');

    const result = await simulate({
        config: CONFIG,
        startingBalance: 100000,  // 1000 bits
        gameHash: TEST_HASH,
        gameAmount: 1000
    });

    console.log('   RISULTATO:');
    console.log('   ─────────────────────────────────────────────────────────────────');
    console.log('   Esito:           ' + result.outcome.toUpperCase());
    console.log('   Partite:         ' + result.gamesPlayed);
    console.log('   Bet piazzate:    ' + result.betsPlaced);
    console.log('   Profitto:        ' + (result.profit / 100).toFixed(2) + ' bits (' + result.profitPercent.toFixed(1) + '%)');
    console.log('   Max Drawdown:    ' + result.maxDrawdown.toFixed(1) + '%');
    console.log('');

    // Cerca esempi per ogni esito
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('🔍 Cercando esempi per ogni esito...');
    console.log('');

    const targetSessions = [];
    const stoplossSessions = [];
    const bustSessions = [];

    for (let idx = 0; idx < 300 && (targetSessions.length < 5 || stoplossSessions.length < 3 || bustSessions.length < 2); idx++) {
        const checkpoint = HASH_CHECKPOINTS_10M[idx % HASH_CHECKPOINTS_10M.length];

        const r = await simulate({
            config: CONFIG,
            startingBalance: 100000,
            gameHash: checkpoint.hash,
            gameAmount: 5000
        });

        const session = { hash: checkpoint.hash, ...r };

        if (r.outcome === 'target' && targetSessions.length < 5) {
            targetSessions.push(session);
        } else if (r.outcome === 'stoploss' && stoplossSessions.length < 3) {
            stoplossSessions.push(session);
        } else if (r.outcome === 'bust' && bustSessions.length < 2) {
            bustSessions.push(session);
        }
    }

    // Mostra TARGET
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('                    🎯 SESSIONI TARGET (+50%)');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    for (let i = 0; i < targetSessions.length; i++) {
        const s = targetSessions[i];
        console.log('');
        console.log('ESEMPIO ' + (i + 1) + ' - TARGET ✅');
        console.log('   Hash: ' + s.hash);
        console.log('   Partite: ' + s.gamesPlayed + ' | Bets: ' + s.betsPlaced + ' | Profitto: ' + (s.profit / 100).toFixed(2) + ' bits');
    }

    // Mostra STOPLOSS
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('                    🛑 SESSIONI STOP-LOSS (-30%)');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    for (let i = 0; i < stoplossSessions.length; i++) {
        const s = stoplossSessions[i];
        console.log('');
        console.log('ESEMPIO ' + (targetSessions.length + i + 1) + ' - STOP-LOSS 🛑');
        console.log('   Hash: ' + s.hash);
        console.log('   Partite: ' + s.gamesPlayed + ' | Bets: ' + s.betsPlaced + ' | Perdita: ' + (s.profit / 100).toFixed(2) + ' bits');
    }

    // Mostra BUST
    if (bustSessions.length > 0) {
        console.log('');
        console.log('═══════════════════════════════════════════════════════════════════════════════');
        console.log('                    💀 SESSIONI BUST');
        console.log('═══════════════════════════════════════════════════════════════════════════════');
        for (let i = 0; i < bustSessions.length; i++) {
            const s = bustSessions[i];
            console.log('');
            console.log('ESEMPIO ' + (targetSessions.length + stoplossSessions.length + i + 1) + ' - BUST ❌');
            console.log('   Hash: ' + s.hash);
            console.log('   Partite: ' + s.gamesPlayed + ' | Bets: ' + s.betsPlaced + ' | Perdita: ' + (s.profit / 100).toFixed(2) + ' bits');
        }
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('📊 RIEPILOGO: ' + targetSessions.length + ' target + ' + stoplossSessions.length + ' stoploss + ' + bustSessions.length + ' bust');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('');
}

main().catch(console.error);
