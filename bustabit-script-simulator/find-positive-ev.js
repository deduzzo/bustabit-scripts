/**
 * TROVA EV POSITIVO
 * Test con stop-loss stretti e sessioni corte per limitare le perdite
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
    for (const [key, value] of Object.entries(overrides)) {
        const regex = new RegExp(`${key}:\\s*\\{\\s*value:\\s*[\\d.]+`);
        modified = modified.replace(regex, `${key}: { value: ${value}`);
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
        profit: userInfo.balance - startBalance,
        profitPercent: ((userInfo.balance - startBalance) / startBalance) * 100
    };
}

async function findPositiveEV() {
    const scriptPath = '../scripts/other/PAOLOBET_OPTIMIZED.js';
    const absolutePath = path.resolve(__dirname, scriptPath);
    const scriptText = fs.readFileSync(absolutePath, 'utf8');

    let checkpoints;
    try {
        checkpoints = require('./hash-checkpoints-10M.js').HASH_CHECKPOINTS_10M;
    } catch (e) {
        checkpoints = require('./hash-checkpoints.js').HASH_CHECKPOINTS;
    }

    const NUM_SESSIONS = 500;
    const START_BALANCE = 100000;

    // Strategia: Target basso + Stop Loss per bilanciare rischio/rendimento
    // Idea: TP:SL ratio deve compensare la probabilità
    const configurations = [
        // Sessioni corte (1000 partite) - meno esposizione
        { name: 'TP20 SL10, 1K games', takeProfit: 20, stopLoss: 10, betPercent: 0.6, games: 1000 },
        { name: 'TP15 SL10, 1K games', takeProfit: 15, stopLoss: 10, betPercent: 0.6, games: 1000 },
        { name: 'TP10 SL5, 1K games', takeProfit: 10, stopLoss: 5, betPercent: 0.6, games: 1000 },
        { name: 'TP10 SL8, 1K games', takeProfit: 10, stopLoss: 8, betPercent: 0.6, games: 1000 },

        // Ultra conservative
        { name: 'TP8 SL5, 1K games', takeProfit: 8, stopLoss: 5, betPercent: 0.5, games: 1000 },
        { name: 'TP5 SL3, 1K games', takeProfit: 5, stopLoss: 3, betPercent: 0.5, games: 1000 },
        { name: 'TP5 SL5, 1K games', takeProfit: 5, stopLoss: 5, betPercent: 0.5, games: 1000 },

        // Sessioni cortissime (500 partite)
        { name: 'TP15 SL10, 500 games', takeProfit: 15, stopLoss: 10, betPercent: 0.6, games: 500 },
        { name: 'TP10 SL5, 500 games', takeProfit: 10, stopLoss: 5, betPercent: 0.6, games: 500 },
        { name: 'TP10 SL8, 500 games', takeProfit: 10, stopLoss: 8, betPercent: 0.6, games: 500 },

        // Bet molto conservativa
        { name: 'TP20 SL10, Bet0.3, 1K', takeProfit: 20, stopLoss: 10, betPercent: 0.3, games: 1000 },
        { name: 'TP15 SL10, Bet0.3, 1K', takeProfit: 15, stopLoss: 10, betPercent: 0.3, games: 1000 },

        // Target bassissimi ma frequenti
        { name: 'TP3 SL3, 500 games', takeProfit: 3, stopLoss: 3, betPercent: 0.5, games: 500 },
        { name: 'TP5 SL3, 500 games', takeProfit: 5, stopLoss: 3, betPercent: 0.5, games: 500 },
    ];

    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
    console.log('║           RICERCA EV POSITIVO - SESSIONI CORTE + STOP LOSS              ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`   Sessioni per config: ${NUM_SESSIONS}`);
    console.log('');

    const results = [];

    for (let c = 0; c < configurations.length; c++) {
        const cfg = configurations[c];
        process.stdout.write(`\r   [${c + 1}/${configurations.length}] ${cfg.name.padEnd(25)}...`);

        let totalProfit = 0;
        let targets = 0;
        let stoplosses = 0;
        let bankrupts = 0;
        let completed = 0;

        for (let i = 0; i < NUM_SESSIONS; i++) {
            const checkpoint = checkpoints[i % checkpoints.length];
            const result = runSession(scriptText, checkpoint.hash, cfg.games, START_BALANCE, cfg);

            if (result.error) continue;

            totalProfit += result.profit;

            if (result.stopReason.includes('TAKE PROFIT') || result.stopReason.includes('TARGET')) {
                targets++;
            } else if (result.stopReason.includes('STOP') || result.stopReason.includes('LOSS')) {
                stoplosses++;
            } else if (result.stopReason === 'BANKRUPT') {
                bankrupts++;
            } else {
                completed++;
            }
        }

        const avgProfitPercent = (totalProfit / NUM_SESSIONS / START_BALANCE) * 100;
        const targetRate = (targets / NUM_SESSIONS) * 100;
        const slRate = (stoplosses / NUM_SESSIONS) * 100;

        results.push({
            name: cfg.name,
            config: cfg,
            avgProfitPercent,
            targetRate,
            slRate,
            bankruptRate: (bankrupts / NUM_SESSIONS) * 100,
            completedRate: (completed / NUM_SESSIONS) * 100
        });
    }

    results.sort((a, b) => b.avgProfitPercent - a.avgProfitPercent);

    console.log('\r   COMPLETATO!                                         ');
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('                              📊 RISULTATI');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('');
    console.log('   #  | Configurazione              | EV %      | Target % | SL %   ');
    console.log('   ───────────────────────────────────────────────────────────────────');

    results.forEach((r, i) => {
        const evStr = (r.avgProfitPercent >= 0 ? '+' : '') + r.avgProfitPercent.toFixed(2) + '%';
        const icon = r.avgProfitPercent >= 0 ? '✅' : '❌';
        console.log(`   ${(i + 1).toString().padStart(2)} | ${r.name.padEnd(27)} | ${evStr.padStart(8)} | ${r.targetRate.toFixed(1).padStart(6)}% | ${r.slRate.toFixed(1).padStart(5)}% ${icon}`);
    });

    console.log('   ───────────────────────────────────────────────────────────────────');
    console.log('');

    const positive = results.filter(r => r.avgProfitPercent > 0);
    if (positive.length > 0) {
        console.log('   🏆 CONFIGURAZIONI CON EV POSITIVO:');
        positive.forEach((r, i) => {
            console.log(`   ${i + 1}. ${r.name}`);
            console.log(`      EV: +${r.avgProfitPercent.toFixed(2)}%, Target: ${r.targetRate.toFixed(1)}%, SL: ${r.slRate.toFixed(1)}%`);

            // Calcolo matematico
            const winGain = r.config.takeProfit;
            const lossGain = -r.config.stopLoss;
            const expectedEV = (r.targetRate/100 * winGain) + (r.slRate/100 * lossGain);
            console.log(`      Check: ${r.targetRate.toFixed(0)}%×${winGain} + ${r.slRate.toFixed(0)}%×${lossGain} = ${expectedEV.toFixed(2)}%`);
            console.log('');
        });
    } else {
        console.log('   ⚠️ NESSUNA CONFIGURAZIONE CON EV POSITIVO');
        console.log('');
        console.log('   ANALISI DEL PROBLEMA:');
        console.log('   Il martingale con raddoppio ha un limite matematico.');
        console.log('   Per avere EV positivo serve: TargetRate × TP > (1-TargetRate) × Loss');
        console.log('');
        console.log('   Le migliori 3 configurazioni:');
        results.slice(0, 3).forEach((r, i) => {
            console.log(`   ${i + 1}. ${r.name}: EV ${r.avgProfitPercent.toFixed(2)}%`);
            console.log(`      Target ${r.targetRate.toFixed(1)}%, SL ${r.slRate.toFixed(1)}%`);
        });
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('');
}

findPositiveEV().catch(console.error);
