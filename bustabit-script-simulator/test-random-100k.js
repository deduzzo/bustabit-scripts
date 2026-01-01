/**
 * TEST RANDOMIZZATO PAOLOBET v3.9
 * 100.000+ partite con sessioni randomizzate
 * Ottimizzato per bun
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

// Genera hash chain saltando N partite per randomizzare
function generateRandomizedGames(startHash, skipGames, numGames) {
    const saltBytes = Buffer.from(GAME_SALT, 'utf8');
    let currentHash = hexToBytes(startHash);

    // Salta le prime N partite
    for (let i = 0; i < skipGames; i++) {
        currentHash = sha256(currentHash);
    }

    // Genera la catena delle partite effettive (in ordine inverso come il simulatore web)
    const tempHashes = [new Uint8Array(currentHash)];
    for (let i = 1; i < numGames; i++) {
        currentHash = sha256(currentHash);
        tempHashes.push(new Uint8Array(currentHash));
    }

    // Inverti per avere ordine cronologico
    const games = tempHashes.reverse().map(h => ({
        hash: bytesToHex(h),
        bust: gameResult(saltBytes, h)
    }));

    return games;
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

function runSession(scriptText, config, games, startBalance) {
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
    const sim = { startingBalance: startBalance, gameHash: games[0]?.hash || '', gameAmount: games.length };

    try {
        const fn = new Function('config', 'engine', 'userInfo', 'log', 'stop', 'gameResultFromHash', 'notify', 'sim', scriptText);
        fn.call({}, config, engine, userInfo, log, stop, gameResultFromHash, notify, sim);
    } catch (e) {
        return { error: e.message };
    }

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

async function runRandomizedTest() {
    const scriptPath = '../scripts/other/PAOLOBET_OPTIMIZED.js';
    const absolutePath = path.resolve(__dirname, scriptPath);
    const scriptText = fs.readFileSync(absolutePath, 'utf8');

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

    // Carica checkpoint
    let checkpoints;
    try {
        checkpoints = require('./hash-checkpoints-10M.js').HASH_CHECKPOINTS_10M;
    } catch (e) {
        checkpoints = require('./hash-checkpoints.js').HASH_CHECKPOINTS;
    }

    const GAMES_PER_SESSION = 500;
    const START_BALANCE = 100000;
    const TARGET_TOTAL_GAMES = 500000;  // 500K partite per statistica migliore
    const NUM_SESSIONS = Math.ceil(TARGET_TOTAL_GAMES / GAMES_PER_SESSION);

    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
    console.log('║        TEST RANDOMIZZATO PAOLOBET v3.9 - 100K+ PARTITE                   ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`   Configurazione: TP${config.takeProfit?.value || 15}%, SL${config.stopLoss?.value || 10}%`);
    console.log(`   Sessioni: ${NUM_SESSIONS}`);
    console.log(`   Partite/sessione: ${GAMES_PER_SESSION}`);
    console.log(`   Partite totali: ${NUM_SESSIONS * GAMES_PER_SESSION}`);
    console.log('');
    console.log('   Randomizzazione: ogni sessione parte da punto casuale nella catena hash');
    console.log('');

    let totalProfit = 0;
    let targets = 0;
    let stoplosses = 0;
    let bankrupts = 0;
    let completed = 0;
    let totalGames = 0;
    let totalBets = 0;

    const startTime = Date.now();

    for (let i = 0; i < NUM_SESSIONS; i++) {
        // Scegli checkpoint casuale
        const checkpointIdx = Math.floor(Math.random() * checkpoints.length);
        const checkpoint = checkpoints[checkpointIdx];

        // Salta un numero casuale di partite (0-999) per randomizzare
        const skipGames = Math.floor(Math.random() * 1000);

        // Genera partite randomizzate
        const games = generateRandomizedGames(checkpoint.hash, skipGames, GAMES_PER_SESSION);

        // Esegui sessione
        const result = runSession(scriptText, config, games, START_BALANCE);

        if (result.error) continue;

        totalProfit += result.profit;
        totalGames += result.gamesPlayed;
        totalBets += result.betsPlaced;

        if (result.stopReason.includes('TAKE PROFIT') || result.stopReason.includes('TARGET')) {
            targets++;
        } else if (result.stopReason.includes('STOP') || result.stopReason.includes('LOSS')) {
            stoplosses++;
        } else if (result.stopReason === 'BANKRUPT') {
            bankrupts++;
        } else {
            completed++;
        }

        // Progress ogni 50 sessioni
        if ((i + 1) % 50 === 0) {
            const elapsed = (Date.now() - startTime) / 1000;
            const rate = (i + 1) / elapsed;
            process.stdout.write(`\r   [${i + 1}/${NUM_SESSIONS}] ${rate.toFixed(0)} sess/sec, EV attuale: ${((totalProfit / (i+1) / START_BALANCE) * 100).toFixed(3)}%`);
        }
    }

    const elapsed = (Date.now() - startTime) / 1000;

    console.log('\r                                                                              ');
    console.log(`   COMPLETATO in ${elapsed.toFixed(1)}s (${(NUM_SESSIONS/elapsed).toFixed(0)} sess/sec)`);
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('                              📊 RISULTATI FINALI');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('');

    const avgProfitPercent = (totalProfit / NUM_SESSIONS / START_BALANCE) * 100;
    const targetRate = (targets / NUM_SESSIONS) * 100;
    const slRate = (stoplosses / NUM_SESSIONS) * 100;
    const betFreq = totalGames > 0 ? (totalBets / totalGames) * 100 : 0;

    console.log('   ESITI:');
    console.log('   ─────────────────────────────────────────────────────────────────');
    console.log(`   🎯 TARGET (+15%):     ${targets}/${NUM_SESSIONS} (${targetRate.toFixed(1)}%)`);
    console.log(`   🛑 STOP LOSS (-10%):  ${stoplosses}/${NUM_SESSIONS} (${slRate.toFixed(1)}%)`);
    console.log(`   💀 BANKRUPT:          ${bankrupts}/${NUM_SESSIONS} (${(bankrupts/NUM_SESSIONS*100).toFixed(1)}%)`);
    console.log(`   ⏱️ COMPLETATE:        ${completed}/${NUM_SESSIONS} (${(completed/NUM_SESSIONS*100).toFixed(1)}%)`);
    console.log('');
    console.log('   STATISTICHE:');
    console.log('   ─────────────────────────────────────────────────────────────────');

    const icon = avgProfitPercent >= 0 ? '✅' : '❌';
    console.log(`   📈 EV MEDIO:          ${avgProfitPercent >= 0 ? '+' : ''}${avgProfitPercent.toFixed(4)}% ${icon}`);
    console.log(`   📊 Bet Frequency:     ${betFreq.toFixed(1)}%`);
    console.log(`   🎰 Partite totali:    ${totalGames.toLocaleString()}`);
    console.log(`   💰 Bet totali:        ${totalBets.toLocaleString()}`);
    console.log('');

    // Calcolo matematico atteso
    const expectedEV = (targetRate/100 * config.takeProfit.value) + (slRate/100 * (-config.stopLoss.value));
    console.log('   VERIFICA MATEMATICA:');
    console.log('   ─────────────────────────────────────────────────────────────────');
    console.log(`   Target×TP + SL×Loss = ${targetRate.toFixed(1)}%×${config.takeProfit.value} + ${slRate.toFixed(1)}%×(-${config.stopLoss.value})`);
    console.log(`                       = ${(targetRate/100 * config.takeProfit.value).toFixed(2)} - ${(slRate/100 * config.stopLoss.value).toFixed(2)}`);
    console.log(`                       = ${expectedEV.toFixed(2)}% (teorico)`);
    console.log(`   EV misurato:        = ${avgProfitPercent.toFixed(4)}%`);
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('');

    // Conclusione
    if (avgProfitPercent > 0) {
        console.log('   ✅ SUCCESSO: L\'algoritmo ha EV POSITIVO su 100K+ partite randomizzate!');
        console.log(`   Con ${NUM_SESSIONS} sessioni da 500 partite, profitto medio: ${(totalProfit / NUM_SESSIONS / 100).toFixed(2)} bits/sessione`);
    } else {
        console.log('   ❌ ATTENZIONE: EV negativo su questo campione');
        console.log('   La varianza naturale può causare risultati negativi anche con EV teorico positivo');
    }
    console.log('');
}

runRandomizedTest().catch(console.error);
