/**
 * VALIDAZIONE TP30, SL0
 * Test più approfondito della configurazione ottimale
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

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
        return new Promise((resolve, reject) => {
            this.next = { wager, payout: Math.round(payout * 100) / 100, resolve, reject };
        }).catch(() => {});
    }
}

function modifyScriptConfig(scriptText, overrides) {
    let modified = scriptText;
    if (overrides.takeProfit !== undefined) {
        modified = modified.replace(/takeProfit:\s*\{\s*value:\s*\d+/, `takeProfit: { value: ${overrides.takeProfit}`);
    }
    if (overrides.stopLoss !== undefined) {
        modified = modified.replace(/stopLoss:\s*\{\s*value:\s*\d+/, `stopLoss: { value: ${overrides.stopLoss}`);
    }
    if (overrides.betPercent !== undefined) {
        modified = modified.replace(/betPercent:\s*\{\s*value:\s*[\d.]+/, `betPercent: { value: ${overrides.betPercent}`);
    }
    return modified;
}

function runSession(scriptText, hash, numGames, startBalance, configOverrides) {
    const modifiedScript = modifyScriptConfig(scriptText, configOverrides);
    const configMatch = modifiedScript.match(/var\s+config\s*=\s*\{[\s\S]*?\};/);
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

    const engine = new SimulatedBustabitEngine();
    const userInfo = engine._userInfo;
    userInfo.balance = startBalance;

    let shouldStop = false;
    let stopReason = '';
    let minBalance = startBalance;

    const log = () => {};
    const stop = (reason) => { shouldStop = true; stopReason = reason; };
    const notify = () => {};
    const gameResultFromHash = () => Promise.resolve(1);
    const sim = { startingBalance: startBalance, gameHash: hash, gameAmount: numGames };

    try {
        const fn = new Function('config', 'engine', 'userInfo', 'log', 'stop', 'gameResultFromHash', 'notify', 'sim', modifiedScript);
        fn.call({}, config, engine, userInfo, log, stop, gameResultFromHash, notify, sim);
    } catch (e) {
        return { error: e.message };
    }

    const games = generateGameResults(hash, numGames);
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
                userInfo.balance += game.cashedAt * game.wager;
                wins++;
            } else if (game.wager > 0) {
                losses++;
            }

            userInfo.profit = userInfo.balance - startBalance;
            if (userInfo.balance < minBalance) minBalance = userInfo.balance;
        }

        engine.history.data.unshift(game);
        engine.emit('GAME_ENDED', { hash: game.hash, bust: game.bust });
        gamesPlayed = i + 1;
    }

    return {
        stopReason: stopReason || 'COMPLETED',
        gamesPlayed,
        betsPlaced,
        wins,
        losses,
        finalBalance: userInfo.balance,
        profit: userInfo.balance - startBalance,
        profitPercent: ((userInfo.balance - startBalance) / startBalance) * 100,
        maxDrawdown: ((startBalance - minBalance) / startBalance) * 100
    };
}

async function validate() {
    const scriptPath = '../scripts/other/PAOLOBET_OPTIMIZED.js';
    const absolutePath = path.resolve(__dirname, scriptPath);
    const scriptText = fs.readFileSync(absolutePath, 'utf8');

    let checkpoints;
    try {
        checkpoints = require('./hash-checkpoints-10M.js').HASH_CHECKPOINTS_10M;
    } catch (e) {
        checkpoints = require('./hash-checkpoints.js').HASH_CHECKPOINTS;
    }

    // Configurazioni da validare
    const configs = [
        { name: 'TP30, SL0 (Ottimale)', takeProfit: 30, stopLoss: 0, betPercent: 0.6 },
        { name: 'TP25, SL0', takeProfit: 25, stopLoss: 0, betPercent: 0.6 },
        { name: 'TP35, SL0', takeProfit: 35, stopLoss: 0, betPercent: 0.6 },
        { name: 'TP30, SL0, Bet0.5', takeProfit: 30, stopLoss: 0, betPercent: 0.5 },
        { name: 'TP30, SL0, Bet0.4', takeProfit: 30, stopLoss: 0, betPercent: 0.4 },
    ];

    const NUM_SESSIONS = 200;
    const GAMES_PER_SESSION = 5000;
    const START_BALANCE = 100000;

    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
    console.log('║          VALIDAZIONE CONFIGURAZIONE OTTIMALE - 200 SESSIONI             ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`   Sessioni: ${NUM_SESSIONS}`);
    console.log(`   Partite/sessione: ${GAMES_PER_SESSION}`);
    console.log('');

    for (const cfg of configs) {
        process.stdout.write(`   Testing: ${cfg.name.padEnd(25)}...`);

        let totalProfit = 0;
        let targets = 0;
        let bankrupts = 0;
        let completed = 0;
        let maxDrawdownAll = 0;
        const profits = [];

        for (let i = 0; i < NUM_SESSIONS; i++) {
            const checkpoint = checkpoints[i % checkpoints.length];
            const result = runSession(scriptText, checkpoint.hash, GAMES_PER_SESSION, START_BALANCE, cfg);

            if (result.error) continue;

            totalProfit += result.profit;
            profits.push(result.profitPercent);
            if (result.maxDrawdown > maxDrawdownAll) maxDrawdownAll = result.maxDrawdown;

            if (result.stopReason.includes('TAKE PROFIT') || result.stopReason.includes('TARGET')) {
                targets++;
            } else if (result.stopReason === 'BANKRUPT') {
                bankrupts++;
            } else {
                completed++;
            }
        }

        const avgProfitPercent = (totalProfit / NUM_SESSIONS / START_BALANCE) * 100;
        const targetRate = (targets / NUM_SESSIONS) * 100;

        // Calcola intervallo di confidenza
        profits.sort((a, b) => a - b);
        const p5 = profits[Math.floor(profits.length * 0.05)];
        const p95 = profits[Math.floor(profits.length * 0.95)];

        const icon = avgProfitPercent >= 0 ? '✅' : '❌';
        console.log(` ${icon}`);
        console.log(`      Profitto medio: ${avgProfitPercent >= 0 ? '+' : ''}${avgProfitPercent.toFixed(2)}%`);
        console.log(`      Target Rate: ${targetRate.toFixed(1)}%`);
        console.log(`      Range 90%: [${p5.toFixed(1)}% → ${p95.toFixed(1)}%]`);
        console.log(`      Max Drawdown: -${maxDrawdownAll.toFixed(1)}%`);
        console.log('');
    }

    // Trova un esempio per verifica manuale
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('');
    console.log('   📥 DATI PER VERIFICA MANUALE (TP30, SL0):');
    console.log('   ─────────────────────────────────────────────────────────────────');

    const cfg = { takeProfit: 30, stopLoss: 0, betPercent: 0.6 };
    for (let i = 0; i < checkpoints.length; i++) {
        const result = runSession(scriptText, checkpoints[i].hash, GAMES_PER_SESSION, START_BALANCE, cfg);
        if (result.stopReason.includes('TAKE PROFIT') || result.stopReason.includes('TARGET')) {
            console.log(`   Hash:     ${checkpoints[i].hash}`);
            console.log(`   Games:    ${GAMES_PER_SESSION}`);
            console.log(`   Balance:  ${START_BALANCE / 100} bits`);
            console.log('   ─────────────────────────────────────────────────────────────────');
            console.log(`   Esito:            TARGET (+30%)`);
            console.log(`   Partite giocate:  ${result.gamesPlayed}`);
            console.log(`   Bet piazzate:     ${result.betsPlaced}`);
            console.log(`   Balance finale:   ${(result.finalBalance / 100).toFixed(2)} bits`);
            console.log(`   Profitto:         +${(result.profit / 100).toFixed(2)} bits (+${result.profitPercent.toFixed(1)}%)`);
            break;
        }
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('');
}

validate().catch(console.error);
