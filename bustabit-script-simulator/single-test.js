/**
 * SINGLE TEST - Test dettagliato con output identico al simulatore UI
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

// ═══════ PROVABLY FAIR ═══════
const GAME_SALT = "00000000000000000001e08b7fd44f95e3e950ac65650a8031a6d5e1750e34be";

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
    const result = Math.floor(X);
    return Math.max(1, result / 100);
}

function generateHashChain(endHash, amount) {
    let currentHash = hexToBytes(endHash);
    const tempHashes = [];
    tempHashes.push(new Uint8Array(currentHash));

    for (let i = 1; i < amount; i++) {
        currentHash = sha256(currentHash);
        tempHashes.push(new Uint8Array(currentHash));
    }

    return tempHashes.reverse();
}

function generateGameResults(startHash, amount) {
    const hashChain = generateHashChain(startHash, amount);
    const results = [];
    const saltBytes = Buffer.from(GAME_SALT, 'utf8');

    for (let i = 0; i < hashChain.length; i++) {
        const gameHash = hashChain[i];
        const bust = gameResult(saltBytes, gameHash);
        results.push({
            hash: bytesToHex(gameHash),
            bust: bust
        });
    }

    return results;
}

// ═══════ SIMULATED ENGINE ═══════
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
            bets: 0,
            profit: 0,
            balanceATH: 0,
            balanceATL: Infinity,
            winStreak: 0,
            loseStreak: 0,
            streakSum: 0,
            sumWagers: 0,
            highBet: 0,
            lowBet: Infinity,
            profitATH: 0,
            profitATL: 0,
            duration: 0,
            sinceWin: 0,
            sinceLose: 0
        };
        this.history = new SimulatedBustabitHistory();
        this.next = null;
        this.gameState = 'GAME_ENDED';
    }
    bet(wager, payout) {
        return new Promise((resolve, reject) => {
            this.next = { wager, payout: Math.round(payout * 100) / 100, resolve, reject };
        }).catch(() => {});
    }
}

// ═══════ PARSE SCRIPT CONFIG ═══════
function parseScriptConfig(scriptText) {
    const config = {};
    const propRegex = /(\w+)\s*:\s*\{\s*value\s*:\s*([^,}]+)/g;
    let match;
    while ((match = propRegex.exec(scriptText)) !== null) {
        let value = match[2].trim();
        if (!isNaN(value)) value = parseFloat(value);
        config[match[1]] = { value };
    }
    return config;
}

// ═══════ FORMAT DURATION ═══════
function formatDuration(ms) {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
}

// ═══════ MAIN TEST ═══════
async function runTest() {
    // PARAMETRI - modifica qui per testare (BALANCE in bits, verrà convertito in satoshi)
    const HASH = 'faf98ff8f88fbca3aef03623d9e535b46684e044a7ad72b9b46e616c5a48cd17';
    const BALANCE_BITS = 1000; // Balance in BITS (come nel simulatore UI)
    const BALANCE = BALANCE_BITS * 100; // Converti in satoshi per lo script
    const GAMES = 100;
    const SCRIPT_PATH = '../scripts/martin/SUPER_SMART_v2.js';

    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
    console.log('║                    SINGLE TEST - VERIFICA DETTAGLIATA                     ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('PARAMETRI DA INSERIRE NEL SIMULATORE UI:');
    console.log('────────────────────────────────────────────────────────────────────────────');
    console.log(`   Hash:              ${HASH}`);
    console.log(`   Starting Balance:  ${(BALANCE/100)} bits`);
    console.log(`   Games:             ${GAMES}`);
    console.log(`   Script:            ${path.basename(SCRIPT_PATH)}`);
    console.log('');

    // Genera crash values
    const games = generateGameResults(HASH, GAMES);

    console.log('PRIMI 15 CRASH VALUES (per verifica):');
    console.log('────────────────────────────────────────────────────────────────────────────');
    for (let i = 0; i < Math.min(15, games.length); i++) {
        console.log(`   Game ${(i+1).toString().padStart(3)}: ${games[i].bust.toFixed(2)}x`);
    }
    console.log('');

    // Carica script
    const scriptText = fs.readFileSync(path.resolve(__dirname, SCRIPT_PATH), 'utf8');
    const config = parseScriptConfig(scriptText);

    // Simula
    const engine = new SimulatedBustabitEngine();
    const userInfo = engine._userInfo;
    const startBalance = BALANCE;
    userInfo.balance = BALANCE;
    userInfo.balanceATH = BALANCE;
    userInfo.balanceATL = BALANCE;

    const chartData = [];
    let shouldStop = false;
    let gamesPlayed = 0;

    const log = function() {};
    const stop = function() { shouldStop = true; };
    const notify = function() {};
    const gameResultFromHash = function(h) { return Promise.resolve(1); };
    const sim = { startingBalance: BALANCE, gameHash: HASH, gameAmount: GAMES };

    // Esegui script
    try {
        const fn = new Function('config', 'engine', 'userInfo', 'log', 'stop', 'gameResultFromHash', 'notify', 'sim', scriptText);
        fn.call({}, config, engine, userInfo, log, stop, gameResultFromHash, notify, sim);
    } catch (e) {
        console.error('Script error:', e.message);
        return;
    }

    // Esegui giochi
    for (let id = 0; id < games.length && !shouldStop; id++) {
        const game = games[id];
        game.id = id;
        game.wager = 0;
        game.cashedAt = 0;

        engine.gameState = 'GAME_STARTING';
        engine.emit('GAME_STARTING', { gameId: id });

        const bet = engine.next;
        engine.next = null;

        if (bet) {
            if (isNaN(bet.wager) || bet.wager < 100 || (bet.wager % 100 !== 0)) {
                if (bet.reject) bet.reject('INVALID_BET');
                break;
            }
            if (userInfo.balance - bet.wager < 0) {
                if (bet.reject) bet.reject('BET_TOO_BIG');
                break;
            }
            if (bet.payout <= 1) {
                if (bet.reject) bet.reject('payout is too low');
                break;
            }

            userInfo.balance -= bet.wager;
            userInfo.bets++;
            userInfo.sumWagers += bet.wager;

            // Track min/max bet
            if (bet.wager < userInfo.lowBet) userInfo.lowBet = bet.wager;
            if (bet.wager > userInfo.highBet) userInfo.highBet = bet.wager;

            bet.resolve(null);
            engine.emit('BET_PLACED', { wager: bet.wager, payout: bet.payout });

            game.wager = bet.wager;
            game.cashedAt = bet.payout <= game.bust ? bet.payout : 0;

            if (game.cashedAt > 0) {
                // WIN
                const winAmount = Math.floor(game.cashedAt * game.wager);
                userInfo.balance += winAmount;

                userInfo.sinceWin = 0;
                userInfo.sinceLose++;
                if (userInfo.sinceLose > userInfo.winStreak) {
                    userInfo.winStreak = userInfo.sinceLose;
                }
                if (userInfo.streakSum < userInfo.sumWagers) {
                    userInfo.streakSum = userInfo.sumWagers;
                }
                userInfo.sumWagers = 0;

                engine.emit('CASHED_OUT', { cashedAt: game.cashedAt, wager: game.wager });
            } else {
                // LOSS
                userInfo.sinceLose = 0;
                userInfo.sinceWin++;
                if (userInfo.sinceWin > userInfo.loseStreak) {
                    userInfo.loseStreak = userInfo.sinceWin;
                }
            }

            // Track balance ATH/ATL
            if (userInfo.balance > userInfo.balanceATH) userInfo.balanceATH = userInfo.balance;
            if (userInfo.balance < userInfo.balanceATL) userInfo.balanceATL = userInfo.balance;

            // Track profit ATH/ATL
            const currentProfit = userInfo.balance - startBalance;
            if (currentProfit > userInfo.profitATH) userInfo.profitATH = currentProfit;
            if (currentProfit < userInfo.profitATL) userInfo.profitATL = currentProfit;
        }

        engine.history.data.unshift(game);
        gamesPlayed = id + 1;

        // Calculate duration (formula from bustabit)
        userInfo.duration += Math.log(game.bust) / 0.00006;

        chartData.push({
            game: id + 1,
            crash: game.bust,
            bet: game.wager,
            payout: game.cashedAt,
            balance: userInfo.balance,
            profit: userInfo.balance - startBalance
        });

        engine.gameState = 'GAME_ENDED';
        engine.emit('GAME_ENDED', { hash: game.hash, bust: game.bust });
    }

    // Check final streak
    if (userInfo.streakSum < userInfo.sumWagers) {
        userInfo.streakSum = userInfo.sumWagers;
    }

    // Fix lowBet if no bets
    if (userInfo.lowBet === Infinity) userInfo.lowBet = 0;

    // Risultati
    const finalProfit = userInfo.balance - startBalance;

    console.log('════════════════════════════════════════════════════════════════════════════');
    console.log('                         RISULTATI SIMULAZIONE');
    console.log('════════════════════════════════════════════════════════════════════════════');
    console.log('');
    console.log(`   Games Played      ${gamesPlayed} games`);
    console.log(`   Duration          ${formatDuration(userInfo.duration)}`);
    console.log(`   Start Balance     ${(startBalance/100).toFixed(2)} bits`);
    console.log(`   Smallest Bet      ${(userInfo.lowBet/100).toFixed(2)} bits`);
    console.log(`   Largest Bet       ${(userInfo.highBet/100).toFixed(2)} bits`);
    console.log(`   Win Streak        ${userInfo.winStreak} games`);
    console.log(`   Lose Streak       ${userInfo.loseStreak} games`);
    console.log(`   Streak Cost       ${(userInfo.streakSum/100).toFixed(2)} bits`);
    console.log(`   Profit ATL        ${(userInfo.profitATL/100).toFixed(2)} bits`);
    console.log(`   Profit ATH        ${(userInfo.profitATH/100).toFixed(2)} bits`);
    console.log(`   Balance ATL       ${(userInfo.balanceATL/100).toFixed(2)} bits`);
    console.log(`   Balance ATH       ${(userInfo.balanceATH/100).toFixed(2)} bits`);
    console.log(`   End Profit        ${(finalProfit/100).toFixed(2)} bits`);
    console.log(`   End Balance       ${(userInfo.balance/100).toFixed(2)} bits`);
    console.log('');
    console.log(`   ${gamesPlayed} Games played. ${finalProfit >= 0 ? 'Won' : 'Lost'} ${(finalProfit/100).toFixed(2)} bits.`);
    console.log('');
    console.log('════════════════════════════════════════════════════════════════════════════');
    console.log('');

    // Grafico ASCII
    console.log('GRAFICO BALANCE:');
    console.log('────────────────────────────────────────────────────────────────────────────');

    const profits = chartData.map(d => d.profit);
    const minP = Math.min(...profits, 0);
    const maxP = Math.max(...profits, 0);

    const height = 10;
    const width = 60;
    const step = Math.max(1, Math.floor(chartData.length / width));

    // Sample data
    const samples = [];
    for (let i = 0; i < chartData.length; i += step) {
        samples.push(chartData[i].profit);
    }

    // Normalize
    const range = maxP - minP || 1;
    const zeroLine = Math.floor((-minP / range) * height);

    for (let row = height; row >= 0; row--) {
        let line = '';
        const threshold = minP + range * (row / height);

        if (row === height) {
            line = `${(maxP/100).toFixed(0).padStart(6)} │`;
        } else if (row === 0) {
            line = `${(minP/100).toFixed(0).padStart(6)} │`;
        } else if (row === zeroLine) {
            line = '     0 │';
        } else {
            line = '       │';
        }

        for (let col = 0; col < Math.min(samples.length, width); col++) {
            const val = samples[col];
            const normalizedRow = Math.floor(((val - minP) / range) * height);

            if (normalizedRow === row) {
                line += val >= 0 ? '█' : '▄';
            } else if (row === zeroLine) {
                line += '─';
            } else {
                line += ' ';
            }
        }

        console.log(line);
    }

    console.log('       └' + '─'.repeat(Math.min(samples.length, width)));
    console.log('');

    // Dettaglio ultime puntate
    console.log('ULTIME 10 OPERAZIONI:');
    console.log('────────────────────────────────────────────────────────────────────────────');
    const bettingGames = chartData.filter(d => d.bet > 0);
    const last10 = bettingGames.slice(-10);
    for (const g of last10) {
        const result = g.payout > 0 ? `WIN @${g.payout}x` : 'LOSS';
        const profit = g.payout > 0 ? Math.floor(g.payout * g.bet) - g.bet : -g.bet;
        console.log(`   Game ${g.game.toString().padStart(3)}: Crash ${g.crash.toFixed(2)}x | Bet ${(g.bet/100).toFixed(2)} | ${result.padEnd(10)} | ${profit >= 0 ? '+' : ''}${(profit/100).toFixed(2)} | Bal: ${(g.balance/100).toFixed(2)}`);
    }
    console.log('');
}

runTest().catch(console.error);
