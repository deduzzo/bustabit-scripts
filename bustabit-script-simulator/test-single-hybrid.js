/**
 * TEST SINGOLO PAOLOBET HYBRID
 * Per verifica manuale sul simulatore web
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

const GAME_SALT = "00000000000000000001e08b7fd44f95e3e950ac65650a8031a6d5e1750e34be";

function hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
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

function generateHashChain(endHash, amount) {
    let currentHash = hexToBytes(endHash);
    const tempHashes = [new Uint8Array(currentHash)];
    for (let i = 1; i < amount; i++) {
        currentHash = sha256(currentHash);
        tempHashes.push(new Uint8Array(currentHash));
    }
    return tempHashes.reverse();
}

function generateGameResults(startHash, amount) {
    const hashChain = generateHashChain(startHash, amount);
    const saltBytes = Buffer.from(GAME_SALT, 'utf8');
    return hashChain.map(h => ({
        hash: bytesToHex(h),
        bust: gameResult(saltBytes, h)
    }));
}

class SimulatedBustabitHistory {
    constructor() { this.data = []; }
    get size() { return this.data.length; }
    first() { return this.size > 0 ? this.data[0] : null; }
}

class SimulatedBustabitEngine extends EventEmitter {
    constructor() {
        super();
        this._userInfo = { balance: 0, bets: 0, profit: 0, balanceATL: 0, profitATL: 0 };
        this.history = new SimulatedBustabitHistory();
        this.next = null;
    }
    bet(wager, payout) {
        return new Promise((resolve) => {
            this.next = { wager, payout: Math.round(payout * 100) / 100, resolve };
        }).catch(() => {});
    }
}

async function runTest() {
    const scriptPath = '../scripts/other/PAOLOBET_HYBRID.js';
    const absolutePath = path.resolve(__dirname, scriptPath);
    const scriptText = fs.readFileSync(absolutePath, 'utf8');

    const INPUT = {
        hash: '1ba3ae00558a9e96ae2bc1ac1126fb47c46610c0b7735f58bbefcb24eba095dc',
        games: 300,
        balance: 100000  // 1000 bits
    };

    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
    console.log('║             TEST SINGOLO PAOLOBET HYBRID - VERIFICA                      ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('                         📥 DATI DI INPUT');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('');
    console.log('   Copia questi dati nel simulatore web:');
    console.log('   ─────────────────────────────────────────────────────────────────');
    console.log('   Hash:     ' + INPUT.hash);
    console.log('   Games:    ' + INPUT.games);
    console.log('   Balance:  ' + (INPUT.balance / 100) + ' bits');
    console.log('   ─────────────────────────────────────────────────────────────────');
    console.log('');

    // Parse config
    const configMatch = scriptText.match(/var\s+config\s*=\s*\{[\s\S]*?\};/);
    const config = {};
    if (configMatch) {
        const propRegex = /(\w+)\s*:\s*\{\s*value\s*:\s*([^,}]+)/g;
        let match;
        while ((match = propRegex.exec(configMatch[0])) !== null) {
            let value = match[2].trim();
            if (value.startsWith("'") || value.startsWith('"')) value = value.slice(1, -1);
            else if (!isNaN(value)) value = parseFloat(value);
            config[match[1]] = { value };
        }
    }

    console.log('   Parametri HYBRID:');
    console.log('   - Take Profit:     ' + config.takeProfit?.value + '%');
    console.log('   - Stop Loss:       ' + config.stopLoss?.value + '%');
    console.log('   - Base Bet:        ' + config.baseBetPercent?.value + '%');
    console.log('   - Modo1 Target:    ' + config.mode1Target?.value + 'x');
    console.log('   - Modo1 MaxDoubles: ' + config.mode1MaxDoubles?.value);
    console.log('   - Modo2 Target:    ' + config.mode2Target?.value + 'x');
    console.log('   - Modo2 Mult:      ' + config.mode2Multiplier?.value + 'x');
    console.log('');

    const engine = new SimulatedBustabitEngine();
    const userInfo = engine._userInfo;
    userInfo.balance = INPUT.balance;

    let shouldStop = false;
    let stopReason = '';
    const logs = [];

    const log = (...args) => logs.push(args.join(' '));
    const stop = (reason) => { shouldStop = true; stopReason = reason; };
    const notify = () => {};
    const gameResultFromHash = () => Promise.resolve(1);
    const sim = { startingBalance: INPUT.balance, gameHash: INPUT.hash, gameAmount: INPUT.games };

    try {
        const fn = new Function('config', 'engine', 'userInfo', 'log', 'stop', 'gameResultFromHash', 'notify', 'sim', scriptText);
        fn.call({}, config, engine, userInfo, log, stop, gameResultFromHash, notify, sim);
    } catch (e) {
        console.error('Errore script:', e);
        return;
    }

    const games = generateGameResults(INPUT.hash, INPUT.games);
    let gamesPlayed = 0;
    let betsPlaced = 0;
    let wins = 0;
    let losses = 0;

    for (let i = 0; i < games.length && !shouldStop; i++) {
        const game = games[i];
        game.wager = 0;
        game.cashedAt = 0;

        engine.emit('GAME_STARTING', {});
        if (shouldStop) break;

        const bet = engine.next;
        engine.next = null;

        if (bet) {
            if (bet.wager > userInfo.balance) {
                stopReason = 'BANKRUPT';
                break;
            }
            userInfo.balance -= bet.wager;
            userInfo.bets++;
            betsPlaced++;
            bet.resolve(null);

            game.wager = bet.wager;
            game.cashedAt = bet.payout <= game.bust ? bet.payout : 0;

            if (game.cashedAt > 0) {
                userInfo.balance += Math.floor(game.cashedAt * game.wager);
                wins++;
            } else if (game.wager > 0) {
                losses++;
            }

            userInfo.profit = userInfo.balance - INPUT.balance;
        }

        engine.history.data.unshift(game);
        engine.emit('GAME_ENDED', { hash: game.hash, bust: game.bust });
        gamesPlayed = i + 1;
    }

    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('                         📊 RISULTATO ATTESO');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('');
    console.log('   Questi valori devono corrispondere al simulatore:');
    console.log('   ─────────────────────────────────────────────────────────────────');
    console.log('   Esito:           ' + (stopReason || 'COMPLETATO'));
    console.log('   Partite giocate: ' + gamesPlayed);
    console.log('   Bet piazzate:    ' + betsPlaced);
    console.log('   Vittorie:        ' + wins);
    console.log('   Sconfitte:       ' + losses);
    console.log('   Balance finale:  ' + (userInfo.balance / 100).toFixed(2) + ' bits');
    console.log('   Profitto:        ' + (userInfo.profit >= 0 ? '+' : '') + (userInfo.profit / 100).toFixed(2) + ' bits');
    console.log('   Profitto %:      ' + (userInfo.profit >= 0 ? '+' : '') + ((userInfo.profit / INPUT.balance) * 100).toFixed(1) + '%');
    console.log('   ─────────────────────────────────────────────────────────────────');
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('');

    // Mostra log
    if (logs.length > 0) {
        console.log('📝 LOG SCRIPT (ultimi 30):');
        console.log('─────────────────────────────────────────────────────────────────────────────');
        logs.slice(-30).forEach(l => console.log('   ' + l));
        console.log('');
    }
}

runTest().catch(console.error);
