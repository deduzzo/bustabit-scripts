/**
 * OTTIMIZZAZIONE FINALE PAOLOBET
 * Test con randomizzazione vera su 1000 sessioni per ogni config
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

function generateRandomizedGames(startHash, skipGames, numGames) {
    const saltBytes = Buffer.from(GAME_SALT, 'utf8');
    let currentHash = hexToBytes(startHash);
    for (let i = 0; i < skipGames; i++) currentHash = sha256(currentHash);
    const tempHashes = [new Uint8Array(currentHash)];
    for (let i = 1; i < numGames; i++) {
        currentHash = sha256(currentHash);
        tempHashes.push(new Uint8Array(currentHash));
    }
    return tempHashes.reverse().map(h => ({
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

function modifyScriptConfig(scriptText, overrides) {
    let modified = scriptText;
    for (const [key, value] of Object.entries(overrides)) {
        const regex = new RegExp(`${key}:\\s*\\{\\s*value:\\s*[\\d.]+`);
        modified = modified.replace(regex, `${key}: { value: ${value}`);
    }
    return modified;
}

function runSession(modifiedScript, config, games, startBalance) {
    const engine = new SimulatedBustabitEngine();
    const userInfo = engine._userInfo;
    userInfo.balance = startBalance;

    let shouldStop = false;
    let stopReason = '';

    const stop = (reason) => { shouldStop = true; stopReason = reason; };
    const sim = { startingBalance: startBalance, gameHash: games[0]?.hash || '', gameAmount: games.length };

    try {
        const fn = new Function('config', 'engine', 'userInfo', 'log', 'stop', 'gameResultFromHash', 'notify', 'sim', modifiedScript);
        fn.call({}, config, engine, userInfo, () => {}, stop, () => Promise.resolve(1), () => {}, sim);
    } catch (e) {
        return { error: e.message };
    }

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
            bet.resolve(null);
            game.wager = bet.wager;
            game.cashedAt = bet.payout <= game.bust ? bet.payout : 0;
            if (game.cashedAt > 0) userInfo.balance += game.cashedAt * game.wager;
            userInfo.profit = userInfo.balance - startBalance;
        }

        engine.history.data.unshift(game);
        engine.emit('GAME_ENDED', { hash: game.hash, bust: game.bust });
    }

    return {
        stopReason: stopReason || 'COMPLETED',
        profit: userInfo.balance - startBalance,
        profitPercent: ((userInfo.balance - startBalance) / startBalance) * 100
    };
}

async function optimize() {
    const scriptPath = '../scripts/other/PAOLOBET_OPTIMIZED.js';
    const scriptText = fs.readFileSync(path.resolve(__dirname, scriptPath), 'utf8');

    let checkpoints;
    try {
        checkpoints = require('./hash-checkpoints-10M.js').HASH_CHECKPOINTS_10M;
    } catch (e) {
        checkpoints = require('./hash-checkpoints.js').HASH_CHECKPOINTS;
    }

    const NUM_SESSIONS = 1000;
    const GAMES_PER_SESSION = 500;
    const START_BALANCE = 100000;

    // Configurazioni con diversi rapporti TP:SL e betPercent
    const configs = [
        // Baseline 0.6%
        { name: 'TP15 SL10 Bet0.6', takeProfit: 15, stopLoss: 10, betPercent: 0.6 },

        // Bet più conservativa 0.4%
        { name: 'TP15 SL10 Bet0.4', takeProfit: 15, stopLoss: 10, betPercent: 0.4 },
        { name: 'TP20 SL10 Bet0.4', takeProfit: 20, stopLoss: 10, betPercent: 0.4 },
        { name: 'TP15 SL8 Bet0.4', takeProfit: 15, stopLoss: 8, betPercent: 0.4 },
        { name: 'TP20 SL8 Bet0.4', takeProfit: 20, stopLoss: 8, betPercent: 0.4 },

        // Bet ancora più conservativa 0.3%
        { name: 'TP15 SL10 Bet0.3', takeProfit: 15, stopLoss: 10, betPercent: 0.3 },
        { name: 'TP20 SL10 Bet0.3', takeProfit: 20, stopLoss: 10, betPercent: 0.3 },
        { name: 'TP15 SL8 Bet0.3', takeProfit: 15, stopLoss: 8, betPercent: 0.3 },
        { name: 'TP20 SL8 Bet0.3', takeProfit: 20, stopLoss: 8, betPercent: 0.3 },
        { name: 'TP25 SL10 Bet0.3', takeProfit: 25, stopLoss: 10, betPercent: 0.3 },

        // Ultra conservativa 0.2%
        { name: 'TP15 SL10 Bet0.2', takeProfit: 15, stopLoss: 10, betPercent: 0.2 },
        { name: 'TP20 SL10 Bet0.2', takeProfit: 20, stopLoss: 10, betPercent: 0.2 },
        { name: 'TP15 SL8 Bet0.2', takeProfit: 15, stopLoss: 8, betPercent: 0.2 },

        // Target bassi con bet bassa
        { name: 'TP10 SL8 Bet0.3', takeProfit: 10, stopLoss: 8, betPercent: 0.3 },
        { name: 'TP10 SL5 Bet0.3', takeProfit: 10, stopLoss: 5, betPercent: 0.3 },
        { name: 'TP8 SL5 Bet0.3', takeProfit: 8, stopLoss: 5, betPercent: 0.3 },
    ];

    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
    console.log('║         OTTIMIZZAZIONE FINALE - 1000 SESSIONI RANDOMIZZATE              ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`   Sessioni/config: ${NUM_SESSIONS}, Partite: ${GAMES_PER_SESSION}`);
    console.log('');

    const results = [];

    for (let c = 0; c < configs.length; c++) {
        const cfg = configs[c];
        process.stdout.write(`\r   [${c + 1}/${configs.length}] ${cfg.name.padEnd(25)}...`);

        const modifiedScript = modifyScriptConfig(scriptText, cfg);
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

        let totalProfit = 0;
        let targets = 0, stoplosses = 0;

        for (let i = 0; i < NUM_SESSIONS; i++) {
            const checkpointIdx = Math.floor(Math.random() * checkpoints.length);
            const skipGames = Math.floor(Math.random() * 1000);
            const games = generateRandomizedGames(checkpoints[checkpointIdx].hash, skipGames, GAMES_PER_SESSION);

            const result = runSession(modifiedScript, config, games, START_BALANCE);
            if (result.error) continue;

            totalProfit += result.profit;
            if (result.stopReason.includes('TAKE PROFIT') || result.stopReason.includes('TARGET')) targets++;
            else if (result.stopReason.includes('STOP') || result.stopReason.includes('LOSS')) stoplosses++;
        }

        const avgProfitPercent = (totalProfit / NUM_SESSIONS / START_BALANCE) * 100;
        const targetRate = (targets / NUM_SESSIONS) * 100;
        const slRate = (stoplosses / NUM_SESSIONS) * 100;

        results.push({ ...cfg, avgProfitPercent, targetRate, slRate });
    }

    results.sort((a, b) => b.avgProfitPercent - a.avgProfitPercent);

    console.log('\r   COMPLETATO!                                    ');
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('                              📊 RISULTATI');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('');
    console.log('   #  | Config                     | EV %      | Target % | SL %   ');
    console.log('   ───────────────────────────────────────────────────────────────────');

    results.forEach((r, i) => {
        const evStr = (r.avgProfitPercent >= 0 ? '+' : '') + r.avgProfitPercent.toFixed(3) + '%';
        const icon = r.avgProfitPercent >= 0 ? '✅' : '❌';
        console.log(`   ${(i + 1).toString().padStart(2)} | ${r.name.padEnd(26)} | ${evStr.padStart(8)} | ${r.targetRate.toFixed(1).padStart(6)}% | ${r.slRate.toFixed(1).padStart(5)}% ${icon}`);
    });

    console.log('   ───────────────────────────────────────────────────────────────────');
    console.log('');

    const positive = results.filter(r => r.avgProfitPercent > 0);
    if (positive.length > 0) {
        console.log('   🏆 CONFIGURAZIONI CON EV POSITIVO:');
        positive.forEach((r, i) => {
            console.log(`   ${i + 1}. ${r.name}: EV ${r.avgProfitPercent.toFixed(3)}%`);
            console.log(`      Matematica: ${r.targetRate.toFixed(1)}%×${r.takeProfit} - ${r.slRate.toFixed(1)}%×${r.stopLoss} = ${(r.targetRate/100*r.takeProfit - r.slRate/100*r.stopLoss).toFixed(2)}%`);
        });
    } else {
        console.log('   ⚠️ Nessuna configurazione ha EV positivo con randomizzazione vera');
        console.log('   Le migliori:');
        results.slice(0, 3).forEach((r, i) => {
            console.log(`   ${i + 1}. ${r.name}: EV ${r.avgProfitPercent.toFixed(3)}%`);
        });
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
}

optimize().catch(console.error);
