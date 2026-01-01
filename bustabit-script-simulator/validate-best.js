/**
 * VALIDAZIONE CONFIGURAZIONE MIGLIORE
 * TP15 SL8 Bet0.4 - Test su 2000 sessioni randomizzate
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

async function validate() {
    const scriptPath = '../scripts/other/PAOLOBET_OPTIMIZED.js';
    const scriptText = fs.readFileSync(path.resolve(__dirname, scriptPath), 'utf8');

    let checkpoints;
    try {
        checkpoints = require('./hash-checkpoints-10M.js').HASH_CHECKPOINTS_10M;
    } catch (e) {
        checkpoints = require('./hash-checkpoints.js').HASH_CHECKPOINTS;
    }

    const NUM_SESSIONS = 500000;  // 500K sessioni per statistica definitiva
    const GAMES_PER_SESSION = 500;
    const START_BALANCE = 100000;

    // Configurazione migliore trovata
    const cfg = { takeProfit: 15, stopLoss: 8, betPercent: 0.4 };

    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
    console.log('║         VALIDAZIONE TP15 SL8 Bet0.4 - 2000 SESSIONI                      ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`   Configurazione: TP${cfg.takeProfit}%, SL${cfg.stopLoss}%, Bet${cfg.betPercent}%`);
    console.log(`   Sessioni: ${NUM_SESSIONS}`);
    console.log(`   Partite totali: ${NUM_SESSIONS * GAMES_PER_SESSION}`);
    console.log('');

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
    let targets = 0, stoplosses = 0, completed = 0;
    const profits = [];

    const startTime = Date.now();

    for (let i = 0; i < NUM_SESSIONS; i++) {
        const checkpointIdx = Math.floor(Math.random() * checkpoints.length);
        const skipGames = Math.floor(Math.random() * 1000);
        const games = generateRandomizedGames(checkpoints[checkpointIdx].hash, skipGames, GAMES_PER_SESSION);

        const result = runSession(modifiedScript, config, games, START_BALANCE);
        if (result.error) continue;

        totalProfit += result.profit;
        profits.push(result.profitPercent);

        if (result.stopReason.includes('TAKE PROFIT') || result.stopReason.includes('TARGET')) targets++;
        else if (result.stopReason.includes('STOP') || result.stopReason.includes('LOSS')) stoplosses++;
        else completed++;

        if ((i + 1) % 10000 === 0) {
            const ev = (totalProfit / (i + 1) / START_BALANCE) * 100;
            const pct = ((i + 1) / NUM_SESSIONS * 100).toFixed(1);
            process.stdout.write(`\r   [${pct}%] ${i + 1}/${NUM_SESSIONS} - EV: ${ev >= 0 ? '+' : ''}${ev.toFixed(4)}%`);
        }
    }

    const elapsed = (Date.now() - startTime) / 1000;

    console.log(`\r   COMPLETATO in ${elapsed.toFixed(1)}s                    `);
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('                              📊 RISULTATI FINALI');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('');

    const avgProfitPercent = (totalProfit / NUM_SESSIONS / START_BALANCE) * 100;
    const targetRate = (targets / NUM_SESSIONS) * 100;
    const slRate = (stoplosses / NUM_SESSIONS) * 100;
    const completedRate = (completed / NUM_SESSIONS) * 100;

    // Calcola intervalli di confidenza
    profits.sort((a, b) => a - b);
    const p5 = profits[Math.floor(profits.length * 0.05)];
    const p25 = profits[Math.floor(profits.length * 0.25)];
    const p50 = profits[Math.floor(profits.length * 0.50)];
    const p75 = profits[Math.floor(profits.length * 0.75)];
    const p95 = profits[Math.floor(profits.length * 0.95)];

    console.log('   ESITI:');
    console.log('   ─────────────────────────────────────────────────────────────────');
    console.log(`   🎯 TARGET (+${cfg.takeProfit}%):  ${targets}/${NUM_SESSIONS} (${targetRate.toFixed(1)}%)`);
    console.log(`   🛑 STOP LOSS (-${cfg.stopLoss}%): ${stoplosses}/${NUM_SESSIONS} (${slRate.toFixed(1)}%)`);
    console.log(`   ⏱️ COMPLETATE:       ${completed}/${NUM_SESSIONS} (${completedRate.toFixed(1)}%)`);
    console.log('');

    const icon = avgProfitPercent >= 0 ? '✅' : '❌';
    console.log('   EV:');
    console.log('   ─────────────────────────────────────────────────────────────────');
    console.log(`   📈 PROFITTO MEDIO:   ${avgProfitPercent >= 0 ? '+' : ''}${avgProfitPercent.toFixed(4)}% ${icon}`);
    console.log(`   📊 Per sessione:     ${(totalProfit / NUM_SESSIONS / 100).toFixed(2)} bits`);
    console.log('');

    console.log('   DISTRIBUZIONE PROFITTI:');
    console.log('   ─────────────────────────────────────────────────────────────────');
    console.log(`   5%:  ${p5.toFixed(1)}% | 25%: ${p25.toFixed(1)}% | 50%: ${p50.toFixed(1)}% | 75%: ${p75.toFixed(1)}% | 95%: ${p95.toFixed(1)}%`);
    console.log('');

    console.log('   VERIFICA MATEMATICA:');
    console.log('   ─────────────────────────────────────────────────────────────────');
    const expectedEV = (targetRate/100 * cfg.takeProfit) - (slRate/100 * cfg.stopLoss);
    console.log(`   Target×TP - SL×Loss = ${targetRate.toFixed(1)}%×${cfg.takeProfit} - ${slRate.toFixed(1)}%×${cfg.stopLoss}`);
    console.log(`                       = ${(targetRate/100*cfg.takeProfit).toFixed(2)} - ${(slRate/100*cfg.stopLoss).toFixed(2)} = ${expectedEV.toFixed(2)}%`);
    console.log(`   EV misurato:        = ${avgProfitPercent.toFixed(4)}%`);
    console.log('');

    console.log('═══════════════════════════════════════════════════════════════════════════════');

    if (avgProfitPercent > 0) {
        console.log('');
        console.log('   ✅ CONFERMATO: EV POSITIVO!');
        console.log('');
        console.log('   PARAMETRI OTTIMALI:');
        console.log('   ─────────────────────────────────────────────────────────────────');
        console.log(`   Take Profit:  ${cfg.takeProfit}%`);
        console.log(`   Stop Loss:    ${cfg.stopLoss}%`);
        console.log(`   Bet Percent:  ${cfg.betPercent}%`);
        console.log(`   Max Games:    500`);
        console.log('');
    }
}

validate().catch(console.error);
