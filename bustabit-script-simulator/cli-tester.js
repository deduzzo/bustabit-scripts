/**
 * CLI MASSIVE TESTER - Plugin per testare algoritmi bustabit senza UI
 *
 * Uso: node cli-tester.js <script-path> [options]
 *
 * Esempio:
 *   node cli-tester.js ../scripts/martin/SUPER_SMART_v2.js --seeds=100 --games=500
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

// ═══════════════════════════════════════════════════════════════════════════════
// PROVABLY FAIR - Implementazione esatta di bustabit
// ═══════════════════════════════════════════════════════════════════════════════

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
    let currentHash;
    if (typeof endHash === 'string' && /^[0-9a-fA-F]+$/.test(endHash)) {
        currentHash = hexToBytes(endHash);
    } else {
        currentHash = crypto.randomBytes(32);
    }

    const tempHashes = [];
    tempHashes.push(new Uint8Array(currentHash));

    for (let i = 1; i < amount; i++) {
        currentHash = sha256(currentHash);
        tempHashes.push(new Uint8Array(currentHash));
    }

    return tempHashes.reverse();
}

function generateGameResults(startHash, amount, gameSalt = GAME_SALT) {
    const hashChain = generateHashChain(startHash, amount);
    const results = [];
    const saltBytes = Buffer.from(gameSalt, 'utf8');

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

// ═══════════════════════════════════════════════════════════════════════════════
// SIMULATED ENGINE - Replica esatta dell'engine bustabit
// ═══════════════════════════════════════════════════════════════════════════════

class SimulatedBustabitHistory {
    constructor() {
        this.data = [];
    }

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
            uname: 'Anonymous',
            balance: 0,
            balanceATH: 0,
            balanceATL: 0,
            winStreak: 0,
            loseStreak: 0,
            streakSum: 0,
            sumWagers: 0,
            highBet: 0,
            lowBet: 0,
            bets: 0,
            profit: 0,
            profitATH: 0,
            profitATL: 0,
            profitPerHour: 0,
            duration: 0
        };
        this.history = new SimulatedBustabitHistory();
        this.next = null;
        this.gameState = 'GAME_ENDED';
    }

    getCurrentBet() {
        if (!this.next) return undefined;
        return { wager: this.next.wager, payout: this.next.payout };
    }

    isBetQueued() { return !!this.next; }
    cancelQueuedBet() { this.next = undefined; }

    bet(wager, payout) {
        return new Promise((resolve, reject) => {
            this.next = {
                wager,
                payout: Math.round(payout * 100) / 100,
                isAuto: true,
                resolve,
                reject
            };
        }).catch(error => {});
    }
}

class BetRejected extends Error {}

// ═══════════════════════════════════════════════════════════════════════════════
// SCRIPT PARSER - Estrae config dagli script
// ═══════════════════════════════════════════════════════════════════════════════

function parseScriptConfig(scriptText) {
    const configMatch = scriptText.match(/var\s+config\s*=\s*\{[\s\S]*?\};/);
    if (!configMatch) return {};

    try {
        const configStr = configMatch[0]
            .replace(/var\s+config\s*=\s*/, '')
            .replace(/;$/, '');

        // Parse manuale per estrarre i valori
        const config = {};
        const propRegex = /(\w+)\s*:\s*\{\s*value\s*:\s*([^,}]+)/g;
        let match;

        while ((match = propRegex.exec(configStr)) !== null) {
            const key = match[1];
            let value = match[2].trim();

            // Converti in numero se possibile
            if (!isNaN(value)) {
                value = parseFloat(value);
            }

            config[key] = { value };
        }

        return config;
    } catch (e) {
        console.error('Error parsing config:', e);
        return {};
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SIMULATOR - Simula una sessione completa
// ═══════════════════════════════════════════════════════════════════════════════

function simulate({ scriptText, config, startingBalance, gameHash, gameAmount, enableLog = false }) {
    return new Promise((resolve, reject) => {
        let logMessages = '';
        let shouldStop = false;
        let shouldStopReason = undefined;

        const engine = new SimulatedBustabitEngine();
        const userInfo = engine._userInfo;

        const log = enableLog ? function() {
            let msg = Array.prototype.slice.call(arguments);
            logMessages += msg.join(' ') + '\n';
        } : function() {};

        const stop = function(reason) {
            shouldStopReason = reason;
            shouldStop = true;
        };

        const notify = function(message) {
            log(message.toString());
        };

        const gameResultFromHash = function(hash) {
            return Promise.resolve(gameResult(Buffer.from(GAME_SALT, 'utf8'), hexToBytes(hash)));
        };

        userInfo.balance = startingBalance;
        userInfo.balanceATH = startingBalance;
        userInfo.balanceATL = startingBalance;

        const results = {
            duration: 0,
            startingBalance: startingBalance,
            balance: startingBalance,
            balanceATH: startingBalance,
            balanceATL: startingBalance,
            bets: 0,
            profit: 0,
            lowBet: 0,
            highBet: 0,
            winStreak: 0,
            loseStreak: 0,
            streakSum: 0,
            profitPerHour: 0,
            profitATH: 0,
            profitATL: 0,
            message: '',
            gamesPlayed: 0,
            log: logMessages
        };

        const sim = { startingBalance, gameHash, gameAmount, enableChart: false, enableLog };

        // Crea il contesto per lo script
        const context = {
            config,
            engine,
            userInfo,
            log,
            stop,
            gameResultFromHash,
            notify,
            sim
        };

        // Esegui lo script nel contesto
        try {
            const fn = new Function('config', 'engine', 'userInfo', 'log', 'stop', 'gameResultFromHash', 'notify', 'sim', scriptText);
            fn.call(context, config, engine, userInfo, log, stop, gameResultFromHash, notify, sim);
        } catch (e) {
            reject(e);
            return;
        }

        // Genera i giochi
        const games = generateGameResults(gameHash, gameAmount);

        // Esegui ogni gioco
        for (let id = 0; id < games.length && !shouldStop; id++) {
            try {
                doGame(id);
                results.gamesPlayed = id + 1;
            } catch (e) {
                if (e instanceof BetRejected) {
                    break;
                } else {
                    // Log l'errore ma continua
                    // console.error('Game error:', e.message);
                    break;
                }
            }
        }

        // Fine simulazione
        if (userInfo.streakSum < userInfo.sumWagers) {
            userInfo.streakSum = userInfo.sumWagers;
        }

        results.duration = userInfo.duration;
        results.balance = userInfo.balance;
        results.bets = userInfo.bets;
        results.profit = userInfo.profit;
        results.lowBet = userInfo.lowBet;
        results.highBet = userInfo.highBet;
        results.streakSum = userInfo.streakSum;
        results.loseStreak = userInfo.loseStreak;
        results.winStreak = userInfo.winStreak;
        results.profitATH = userInfo.profitATH;
        results.profitATL = userInfo.profitATL;
        results.balanceATH = userInfo.balanceATH;
        results.balanceATL = userInfo.balanceATL;
        results.profitPerHour = results.profit / (results.duration / (1000 * 60 * 60));
        results.log = logMessages;

        resolve(results);

        function doGame(id) {
            const game = games[id];
            game.id = id;
            game.isSimulation = true;
            game.wager = 0;
            game.cashedAt = 0;

            engine.gameState = 'GAME_STARTING';
            engine.emit('GAME_STARTING', { gameId: id });

            const bet = engine.next;
            engine.next = null;

            if (bet) {
                if (isNaN(bet.wager) || bet.wager < 100 || (bet.wager % 100 !== 0)) {
                    bet.reject('INVALID_BET');
                    throw new BetRejected('INVALID_BET');
                }
                if (isNaN(bet.payout)) {
                    bet.reject('cannot parse JSON');
                    throw new BetRejected('cannot parse JSON');
                }
                if (userInfo.balance - bet.wager < 0) {
                    bet.reject('BET_TOO_BIG');
                    userInfo.sumWagers += bet.wager;
                    throw new BetRejected('BET_TOO_BIG');
                }
                if (bet.payout <= 1) {
                    bet.reject('payout is too low');
                    throw new BetRejected('payout is too low');
                }

                if (bet.wager > 0) {
                    userInfo.balance -= bet.wager;
                    userInfo.bets++;
                    userInfo.sumWagers += bet.wager;
                }
                bet.resolve(null);

                engine.emit('BET_PLACED', {
                    uname: userInfo.uname,
                    wager: bet.wager,
                    payout: bet.payout
                });
            }

            engine.emit('GAME_STARTED', null);
            engine.gameState = 'GAME_IN_PROGRESS';

            game.wager = bet ? bet.wager : 0;
            game.cashedAt = bet && bet.wager > 0 && bet.payout <= game.bust ? bet.payout : 0;

            if (game.wager !== 0) {
                userInfo.balance += game.cashedAt * game.wager;
                if (userInfo.balance < userInfo.balanceATL) { userInfo.balanceATL = userInfo.balance; }
                if (userInfo.balance > userInfo.balanceATH) { userInfo.balanceATH = userInfo.balance; }
                userInfo.profit = userInfo.balance - startingBalance;
                if (!userInfo.lowBet || game.wager < userInfo.lowBet) { userInfo.lowBet = game.wager; }
                if (!userInfo.highBet || game.wager > userInfo.highBet) { userInfo.highBet = game.wager; }
                if (userInfo.profit < userInfo.profitATL) { userInfo.profitATL = userInfo.profit; }
                if (userInfo.profit > userInfo.profitATH) { userInfo.profitATH = userInfo.profit; }
            }

            if (game.cashedAt > 0) {
                userInfo.sinceWin = 0;
                userInfo.sinceLose++;
                if (userInfo.sinceLose > userInfo.winStreak) {
                    userInfo.winStreak = userInfo.sinceLose;
                }
                if (userInfo.streakSum < userInfo.sumWagers) {
                    userInfo.streakSum = userInfo.sumWagers;
                }
                userInfo.sumWagers = 0;
                engine.emit('CASHED_OUT', {
                    uname: userInfo.uname,
                    cashedAt: game.cashedAt,
                    wager: game.wager
                });
            } else {
                if (game.wager !== 0) {
                    userInfo.sinceLose = 0;
                    userInfo.sinceWin++;
                    if (userInfo.sinceWin > userInfo.loseStreak) {
                        userInfo.loseStreak = userInfo.sinceWin;
                    }
                }
            }

            engine.history.data.unshift(game);
            userInfo.duration += Math.log(game.bust) / 0.00006;

            engine.gameState = 'GAME_ENDED';
            engine.emit('GAME_ENDED', { hash: game.hash, bust: game.bust });
        }
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// MASSIVE TESTER - Esegue test multipli
// ═══════════════════════════════════════════════════════════════════════════════

async function massiveTest(scriptPath, options = {}) {
    const {
        numSeeds = 100,
        gamesPerSeed = 500,
        startingBalance = 1000000,
        baseHash = '357bba5cd16d7d9395a0aab681ceefb4415dc2d8a7529493c48e7b57d74a4ed8',
        useCheckpoints = false,
        hashCheckpoints = null,
        enableLog = false
    } = options;

    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
    console.log('║                    CLI MASSIVE TESTER - BUSTABIT                          ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
    console.log('');

    // Carica lo script
    const absolutePath = path.resolve(scriptPath);
    if (!fs.existsSync(absolutePath)) {
        console.error(`❌ Script not found: ${absolutePath}`);
        process.exit(1);
    }

    const scriptText = fs.readFileSync(absolutePath, 'utf8');
    const config = parseScriptConfig(scriptText);
    const scriptName = path.basename(scriptPath, '.js');

    console.log(`📜 Script:       ${scriptName}`);
    console.log(`💰 Balance:      ${(startingBalance / 100).toLocaleString()} bits`);
    console.log(`🎮 Seeds:        ${numSeeds}`);
    console.log(`🎲 Games/seed:   ${gamesPerSeed}`);
    if (useCheckpoints && hashCheckpoints) {
        console.log(`#️⃣  Mode:         CHECKPOINTS (${hashCheckpoints.length} hash diversi, 10k partite ciascuno)`);
    } else {
        console.log(`#️⃣  Base Hash:    ${baseHash.substring(0, 16)}...`);
    }
    console.log('');

    // Override config con balance
    if (config.workingBalance) {
        config.workingBalance.value = startingBalance;
    }

    const results = [];
    const startTime = Date.now();
    let completed = 0;

    console.log('🔄 Testing...');

    for (let i = 0; i < numSeeds; i++) {
        // Genera hash: usa checkpoint se disponibile, altrimenti genera da baseHash
        let seedHash;
        if (useCheckpoints && hashCheckpoints && i < hashCheckpoints.length) {
            seedHash = hashCheckpoints[i].hash;
        } else {
            seedHash = crypto.createHash('sha256')
                .update(baseHash + i.toString())
                .digest('hex');
        }

        try {
            const result = await simulate({
                scriptText,
                config,
                startingBalance,
                gameHash: seedHash,
                gameAmount: gamesPerSeed,
                enableLog
            });

            results.push({
                seed: i,
                profit: result.profit,
                profitPercent: (result.profit / startingBalance) * 100,
                bets: result.bets,
                gamesPlayed: result.gamesPlayed,
                winStreak: result.winStreak,
                loseStreak: result.loseStreak,
                balanceATH: result.balanceATH,
                balanceATL: result.balanceATL,
                profitATH: result.profitATH,
                profitATL: result.profitATL,
                finalBalance: result.balance
            });

        } catch (e) {
            results.push({
                seed: i,
                profit: -startingBalance,
                profitPercent: -100,
                bets: 0,
                gamesPlayed: 0,
                error: e.message
            });
        }

        completed++;
        if (completed % 10 === 0 || completed === numSeeds) {
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            const pct = ((completed / numSeeds) * 100).toFixed(0);
            process.stdout.write(`\r   Progress: ${completed}/${numSeeds} (${pct}%) - ${elapsed}s    `);
        }
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('\n');

    // ═══════ CALCOLA STATISTICHE ═══════
    const profits = results.map(r => r.profitPercent);
    const validResults = results.filter(r => !r.error);

    const positives = validResults.filter(r => r.profit > 0);
    const negatives = validResults.filter(r => r.profit < 0);
    const zeros = validResults.filter(r => r.profit === 0);

    const avgProfit = profits.reduce((a, b) => a + b, 0) / profits.length;
    const medianProfit = profits.sort((a, b) => a - b)[Math.floor(profits.length / 2)];
    const stdDev = Math.sqrt(profits.reduce((sum, p) => sum + Math.pow(p - avgProfit, 2), 0) / profits.length);
    const sharpeRatio = stdDev === 0 ? 0 : avgProfit / stdDev;

    const minProfit = Math.min(...profits);
    const maxProfit = Math.max(...profits);

    const avgBets = validResults.reduce((a, r) => a + r.bets, 0) / validResults.length;
    const avgGames = validResults.reduce((a, r) => a + r.gamesPlayed, 0) / validResults.length;
    const betEfficiency = (avgBets / avgGames * 100).toFixed(1);

    const winRate = (positives.length / validResults.length * 100).toFixed(2);

    // Target check (50%)
    const targetHits = validResults.filter(r => r.profitPercent >= 50);
    const targetRate = (targetHits.length / validResults.length * 100).toFixed(2);

    // ═══════ OUTPUT RISULTATI ═══════
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('                              📊 RISULTATI');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('PROFITTO:');
    console.log('────────────────────────────────────────────────────────────────────────────');
    console.log(`   Media:              ${avgProfit >= 0 ? '+' : ''}${avgProfit.toFixed(2)}%`);
    console.log(`   Mediana:            ${medianProfit >= 0 ? '+' : ''}${medianProfit.toFixed(2)}%`);
    console.log(`   Dev. Standard:      ${stdDev.toFixed(2)}%`);
    console.log(`   Sharpe Ratio:       ${sharpeRatio.toFixed(3)}`);
    console.log(`   Min:                ${minProfit.toFixed(2)}%`);
    console.log(`   Max:                ${maxProfit >= 0 ? '+' : ''}${maxProfit.toFixed(2)}%`);
    console.log('');
    console.log('SUCCESSO:');
    console.log('────────────────────────────────────────────────────────────────────────────');
    console.log(`   Win Rate:           ${winRate}% (${positives.length}/${validResults.length})`);
    console.log(`   Target +50% Rate:   ${targetRate}% (${targetHits.length}/${validResults.length})`);
    console.log(`   Positivi:           ${positives.length}`);
    console.log(`   Negativi:           ${negatives.length}`);
    console.log(`   Pareggi:            ${zeros.length}`);
    if (results.some(r => r.error)) {
        console.log(`   Errori:             ${results.filter(r => r.error).length}`);
    }
    console.log('');
    console.log('EFFICIENZA:');
    console.log('────────────────────────────────────────────────────────────────────────────');
    console.log(`   Avg Games Played:   ${avgGames.toFixed(1)}`);
    console.log(`   Avg Bets:           ${avgBets.toFixed(1)}`);
    console.log(`   Bet Efficiency:     ${betEfficiency}% (bets/games)`);
    console.log(`   Tempo totale:       ${totalTime}s`);
    console.log('');

    // ═══════ DISTRIBUZIONE ═══════
    console.log('DISTRIBUZIONE PROFITTO:');
    console.log('────────────────────────────────────────────────────────────────────────────');

    const brackets = [
        { min: -100, max: -50, label: '  < -50%' },
        { min: -50, max: -25, label: '-50% ~ -25%' },
        { min: -25, max: 0, label: '-25% ~ 0%' },
        { min: 0, max: 25, label: '  0% ~ +25%' },
        { min: 25, max: 50, label: '+25% ~ +50%' },
        { min: 50, max: 100, label: '+50% ~ +100%' },
        { min: 100, max: Infinity, label: '  > +100%' },
    ];

    for (const bracket of brackets) {
        const count = profits.filter(p => p > bracket.min && p <= bracket.max).length;
        const pct = (count / profits.length * 100).toFixed(1);
        const bar = '█'.repeat(Math.round(count / profits.length * 40));
        console.log(`   ${bracket.label.padEnd(14)} │ ${bar.padEnd(40)} │ ${count.toString().padStart(4)} (${pct.padStart(5)}%)`);
    }
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // ═══════ VERDETTO ═══════
    console.log('');
    if (avgProfit >= 0) {
        console.log('🎉 VERDETTO: PROFITTEVOLE! Media positiva.');
    } else if (avgProfit >= -5) {
        console.log('⚠️  VERDETTO: MARGINALE. Perdite accettabili.');
    } else {
        console.log('❌ VERDETTO: PERDITA. Strategia da rivedere.');
    }

    if (parseFloat(targetRate) >= 10) {
        console.log(`🎯 TARGET +50%: Raggiunto nel ${targetRate}% dei casi!`);
    }
    console.log('');

    // Salva risultati
    const outputPath = path.join(path.dirname(absolutePath), `${scriptName}-results.json`);
    fs.writeFileSync(outputPath, JSON.stringify({
        script: scriptName,
        config: {
            numSeeds,
            gamesPerSeed,
            startingBalance,
            baseHash
        },
        summary: {
            avgProfit,
            medianProfit,
            stdDev,
            sharpeRatio,
            winRate: parseFloat(winRate),
            targetRate: parseFloat(targetRate),
            minProfit,
            maxProfit,
            avgBets,
            avgGames,
            betEfficiency: parseFloat(betEfficiency)
        },
        results
    }, null, 2));

    console.log(`💾 Risultati salvati: ${outputPath}`);
    console.log('');

    return { summary: { avgProfit, medianProfit, winRate, targetRate, sharpeRatio }, results };
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOAD HASH CHECKPOINTS (se disponibili)
// ═══════════════════════════════════════════════════════════════════════════════

let HASH_CHECKPOINTS = null;
let HASH_CHECKPOINTS_10M = null;

try {
    const checkpointsModule = require('./hash-checkpoints.js');
    HASH_CHECKPOINTS = checkpointsModule.HASH_CHECKPOINTS;
} catch (e) {
    // Checkpoints 1M non disponibili
}

try {
    const checkpointsModule10M = require('./hash-checkpoints-10M.js');
    HASH_CHECKPOINTS_10M = checkpointsModule10M.HASH_CHECKPOINTS_10M;
} catch (e) {
    // Checkpoints 10M non disponibili
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLI ENTRY POINT
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0 || args.includes('--help')) {
        console.log(`
CLI MASSIVE TESTER - Test algoritmi bustabit senza UI

Uso: node cli-tester.js <script-path> [options]

Options:
  --seeds=N         Numero di seed/sessioni da testare (default: 100)
  --games=N         Numero di giochi per sessione (default: 500)
  --balance=N       Balance iniziale in bits (default: 10000)
  --hash=HASH       Hash base per i test
  --checkpoints     Usa i 101 hash checkpoint (1M partite, ogni 10k)
  --checkpoints10M  Usa i 10,001 hash checkpoint (10M partite, ogni 1k)
  --log             Abilita log degli script (verbose)
  --help            Mostra questo help

Esempi:
  node cli-tester.js ../scripts/martin/SUPER_SMART_v2.js --seeds=100 --games=500
  node cli-tester.js ../scripts/martin/SUPER_SMART_v2.js --checkpoints --games=1000
  node cli-tester.js ../scripts/martin/SUPER_SMART_v6_ULTIMATE.js --checkpoints10M --seeds=1000 --games=5000
        `);
        process.exit(0);
    }

    const scriptPath = args[0];
    const options = {
        numSeeds: 100,
        gamesPerSeed: 500,
        startingBalance: 1000000,
        baseHash: '357bba5cd16d7d9395a0aab681ceefb4415dc2d8a7529493c48e7b57d74a4ed8',
        useCheckpoints: false,
        useCheckpoints10M: false,
        enableLog: false
    };

    for (const arg of args.slice(1)) {
        if (arg.startsWith('--seeds=')) {
            options.numSeeds = parseInt(arg.split('=')[1]);
        } else if (arg.startsWith('--games=')) {
            options.gamesPerSeed = parseInt(arg.split('=')[1]);
        } else if (arg.startsWith('--balance=')) {
            options.startingBalance = parseInt(arg.split('=')[1]) * 100;
        } else if (arg.startsWith('--hash=')) {
            options.baseHash = arg.split('=')[1];
        } else if (arg === '--checkpoints10M') {
            options.useCheckpoints10M = true;
        } else if (arg === '--checkpoints') {
            options.useCheckpoints = true;
        } else if (arg === '--log') {
            options.enableLog = true;
        }
    }

    // Se usa checkpoints 10M (priorità su 1M)
    if (options.useCheckpoints10M && HASH_CHECKPOINTS_10M) {
        // Limita a numSeeds se specificato, altrimenti usa tutti
        const maxSeeds = options.numSeeds || HASH_CHECKPOINTS_10M.length;
        options.numSeeds = Math.min(maxSeeds, HASH_CHECKPOINTS_10M.length);
        options.hashCheckpoints = HASH_CHECKPOINTS_10M.slice(0, options.numSeeds);
        options.useCheckpoints = true;
    }
    // Se usa checkpoints 1M
    else if (options.useCheckpoints && HASH_CHECKPOINTS) {
        options.numSeeds = HASH_CHECKPOINTS.length;
        options.hashCheckpoints = HASH_CHECKPOINTS;
    }

    await massiveTest(scriptPath, options);
}

// Export per uso come modulo
module.exports = { massiveTest, simulate, generateGameResults };

// Esegui se chiamato direttamente
if (require.main === module) {
    main().catch(console.error);
}
