/**
 * ANALISI COMPLETA PAOLOBET v3.8
 * Test su multiple sessioni da 10.000 partite per statistiche accurate
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

function runSession(scriptText, hash, numGames, startBalance) {
    const configMatch = scriptText.match(/var\s+config\s*=\s*\{[\s\S]*?\};/);
    const config = {};
    if (configMatch) {
        const propRegex = /(\w+)\s*:\s*\{\s*value\s*:\s*([^,}]+)/g;
        let match;
        while ((match = propRegex.exec(configMatch[0])) !== null) {
            let value = match[2].trim();
            if (value.startsWith("'") || value.startsWith('"')) {
                value = value.slice(1, -1);
            } else if (!isNaN(value)) {
                value = parseFloat(value);
            }
            config[match[1]] = { value };
        }
    }

    const engine = new SimulatedBustabitEngine();
    const userInfo = engine._userInfo;
    userInfo.balance = startBalance;

    let shouldStop = false;
    let stopReason = '';
    let minBalance = startBalance;
    let maxBalance = startBalance;

    const log = () => {};
    const stop = (reason) => { shouldStop = true; stopReason = reason; };
    const notify = () => {};
    const gameResultFromHash = () => Promise.resolve(1);
    const sim = { startingBalance: startBalance, gameHash: hash, gameAmount: numGames };

    try {
        const fn = new Function('config', 'engine', 'userInfo', 'log', 'stop', 'gameResultFromHash', 'notify', 'sim', scriptText);
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
            if (userInfo.balance > maxBalance) maxBalance = userInfo.balance;
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
        minBalance,
        maxBalance,
        maxDrawdown: ((startBalance - minBalance) / startBalance) * 100
    };
}

async function runAnalysis() {
    const scriptPath = '../scripts/other/PAOLOBET_OPTIMIZED.js';
    const absolutePath = path.resolve(__dirname, scriptPath);
    const scriptText = fs.readFileSync(absolutePath, 'utf8');

    // Carica checkpoint
    let checkpoints;
    try {
        checkpoints = require('./hash-checkpoints-10M.js').HASH_CHECKPOINTS_10M;
    } catch (e) {
        checkpoints = require('./hash-checkpoints.js').HASH_CHECKPOINTS;
    }

    const CONFIG = {
        numSessions: 100,
        gamesPerSession: 10000,
        startBalance: 100000  // 1000 bits
    };

    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
    console.log('║           ANALISI COMPLETA PAOLOBET v3.8 - 10K PARTITE                   ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`   Sessioni:        ${CONFIG.numSessions}`);
    console.log(`   Partite/sessione: ${CONFIG.gamesPerSession}`);
    console.log(`   Balance iniziale: ${CONFIG.startBalance / 100} bits`);
    console.log('');
    console.log('   Esecuzione in corso...');
    console.log('');

    const results = {
        target: [],
        stoploss: [],
        completed: [],
        bankrupt: []
    };

    let totalProfit = 0;
    let totalBets = 0;
    let totalWins = 0;
    let totalLosses = 0;
    let totalGames = 0;
    let maxDrawdownAll = 0;

    for (let i = 0; i < CONFIG.numSessions; i++) {
        const checkpoint = checkpoints[i % checkpoints.length];
        const hash = checkpoint.hash;

        const result = runSession(scriptText, hash, CONFIG.gamesPerSession, CONFIG.startBalance);

        if (result.error) {
            console.log(`   Sessione ${i + 1}: ERRORE - ${result.error}`);
            continue;
        }

        totalProfit += result.profit;
        totalBets += result.betsPlaced;
        totalWins += result.wins;
        totalLosses += result.losses;
        totalGames += result.gamesPlayed;
        if (result.maxDrawdown > maxDrawdownAll) maxDrawdownAll = result.maxDrawdown;

        if (result.stopReason.includes('TAKE PROFIT') || result.stopReason.includes('TARGET')) {
            results.target.push(result);
        } else if (result.stopReason.includes('STOP') || result.stopReason.includes('LOSS')) {
            results.stoploss.push(result);
        } else if (result.stopReason === 'BANKRUPT') {
            results.bankrupt.push(result);
        } else {
            results.completed.push(result);
        }

        // Progress
        if ((i + 1) % 10 === 0) {
            process.stdout.write(`\r   Progresso: ${i + 1}/${CONFIG.numSessions} sessioni...`);
        }
    }

    console.log('\r   Progresso: COMPLETATO!                    ');
    console.log('');

    // Calcola statistiche
    const totalSessions = CONFIG.numSessions;
    const targetRate = (results.target.length / totalSessions) * 100;
    const stoplossRate = (results.stoploss.length / totalSessions) * 100;
    const bankruptRate = (results.bankrupt.length / totalSessions) * 100;
    const completedRate = (results.completed.length / totalSessions) * 100;
    const avgProfit = totalProfit / totalSessions;
    const avgProfitPercent = (avgProfit / CONFIG.startBalance) * 100;
    const winRate = totalBets > 0 ? (totalWins / (totalWins + totalLosses)) * 100 : 0;
    const betFrequency = (totalBets / totalGames) * 100;

    // Stampa risultati
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('                              📊 RISULTATI');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('');
    console.log('   ESITI SESSIONI:');
    console.log('   ─────────────────────────────────────────────────────────────────');
    console.log(`   🎯 TARGET (+50%):     ${results.target.length}/${totalSessions} (${targetRate.toFixed(1)}%)`);
    console.log(`   🛑 STOP-LOSS:         ${results.stoploss.length}/${totalSessions} (${stoplossRate.toFixed(1)}%)`);
    console.log(`   💀 BANKRUPT:          ${results.bankrupt.length}/${totalSessions} (${bankruptRate.toFixed(1)}%)`);
    console.log(`   ⏱️ COMPLETATE:        ${results.completed.length}/${totalSessions} (${completedRate.toFixed(1)}%)`);
    console.log('');
    console.log('   STATISTICHE GLOBALI:');
    console.log('   ─────────────────────────────────────────────────────────────────');
    console.log(`   📈 Profitto medio:    ${avgProfit >= 0 ? '+' : ''}${(avgProfit / 100).toFixed(2)} bits (${avgProfitPercent >= 0 ? '+' : ''}${avgProfitPercent.toFixed(2)}%)`);
    console.log(`   🎲 Win Rate:          ${winRate.toFixed(1)}%`);
    console.log(`   📊 Bet Frequency:     ${betFrequency.toFixed(1)}%`);
    console.log(`   📉 Max Drawdown:      -${maxDrawdownAll.toFixed(1)}%`);
    console.log(`   🎰 Totale Partite:    ${totalGames.toLocaleString()}`);
    console.log(`   💰 Totale Bet:        ${totalBets.toLocaleString()}`);
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════════');

    // Dettaglio sessioni TARGET
    if (results.target.length > 0) {
        console.log('');
        console.log('   DETTAGLIO SESSIONI TARGET (prime 5):');
        console.log('   ─────────────────────────────────────────────────────────────────');
        results.target.slice(0, 5).forEach((r, i) => {
            console.log(`   ${i + 1}. Partite: ${r.gamesPlayed}, Bets: ${r.betsPlaced}, Profit: +${(r.profit / 100).toFixed(2)} bits`);
        });
    }

    // Dettaglio sessioni BUST
    if (results.bankrupt.length > 0 || results.stoploss.length > 0) {
        console.log('');
        console.log('   DETTAGLIO SESSIONI NEGATIVE (prime 5):');
        console.log('   ─────────────────────────────────────────────────────────────────');
        [...results.bankrupt, ...results.stoploss].slice(0, 5).forEach((r, i) => {
            console.log(`   ${i + 1}. ${r.stopReason}: Partite: ${r.gamesPlayed}, Bets: ${r.betsPlaced}, Loss: ${(r.profit / 100).toFixed(2)} bits`);
        });
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('');

    // Dati per verifica manuale (prima sessione TARGET)
    if (results.target.length > 0) {
        const firstTargetIdx = checkpoints.findIndex((cp, idx) => {
            const r = runSession(scriptText, cp.hash, CONFIG.gamesPerSession, CONFIG.startBalance);
            return r.stopReason.includes('TAKE PROFIT') || r.stopReason.includes('TARGET');
        });

        if (firstTargetIdx >= 0) {
            const cp = checkpoints[firstTargetIdx];
            const r = runSession(scriptText, cp.hash, CONFIG.gamesPerSession, CONFIG.startBalance);
            console.log('   📥 DATI PER VERIFICA MANUALE (prima sessione TARGET):');
            console.log('   ─────────────────────────────────────────────────────────────────');
            console.log(`   Hash:     ${cp.hash}`);
            console.log(`   Games:    ${CONFIG.gamesPerSession}`);
            console.log(`   Balance:  ${CONFIG.startBalance / 100} bits`);
            console.log('   ─────────────────────────────────────────────────────────────────');
            console.log(`   Esito atteso:      TARGET`);
            console.log(`   Partite giocate:   ${r.gamesPlayed}`);
            console.log(`   Bet piazzate:      ${r.betsPlaced}`);
            console.log(`   Balance finale:    ${(r.finalBalance / 100).toFixed(2)} bits`);
            console.log('');
        }
    }
}

runAnalysis().catch(console.error);
