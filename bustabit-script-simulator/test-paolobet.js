/**
 * TEST PAOLOBET - Analisi approfondita dell'algoritmo paolobet1bitprofit
 *
 * Obiettivo: Testare se può raggiungere +50% profit con poche partite
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

// ═══════════════════════════════════════════════════════════════════════════════
// PROVABLY FAIR
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
    let currentHash = typeof endHash === 'string' ? hexToBytes(endHash) : endHash;
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

// ═══════════════════════════════════════════════════════════════════════════════
// SIMULATED ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

class SimulatedBustabitHistory {
    constructor() { this.data = []; }
    get size() { return this.data.length; }
    first() { return this.size > 0 ? this.data[0] : null; }
}

class SimulatedBustabitEngine extends EventEmitter {
    constructor() {
        super();
        this._userInfo = {
            balance: 0, bets: 0, profit: 0,
            balanceATH: 0, balanceATL: 0,
            profitATH: 0, profitATL: 0,
            winStreak: 0, loseStreak: 0,
            sumWagers: 0, streakSum: 0
        };
        this.history = new SimulatedBustabitHistory();
        this.next = null;
        this.gameState = 'GAME_ENDED';
    }
    bet(wager, payout) {
        return new Promise((resolve, reject) => {
            this.next = { wager, payout: Math.round(payout) / 100, resolve, reject };
        }).catch(() => {});
    }
}

class BetRejected extends Error {}

// ═══════════════════════════════════════════════════════════════════════════════
// PAOLOBET ALGORITHM - Estratto e parametrizzato
// ═══════════════════════════════════════════════════════════════════════════════

function createPaoloBetScript(params) {
    return `
var config = {
    mult: { value: ${params.mult}, type: 'multiplier', label: 'Moltiplicatore' },
    bet: { value: ${params.bet}, type: 'balance', label: 'Puntata iniziale' },
    highValue: { value: ${params.highValue}, type: 'multiplier', label: 'Punteggio Alto' },
    timesToStop: { value: ${params.timesToStop}, type: 'multiplier', label: 'n giocate di stop' },
    strategyOnHigh: {
        value: '${params.strategyOnHigh}', type: 'radio', label: 'In caso di punteggio alto:',
        options: {
            stop: { value: 'stop', type: 'noop', label: 'Fermati' },
            none: { value: 'none', type: 'noop', label: 'Non fare niente' },
        }
    },
    normalBets: { value: ${params.normalBets}, type: 'multiplier', label: 'Puntate normali' },
    timesToChange: { value: ${params.timesToChange}, type: 'multiplier', label: 'Volte per cambiare' },
    strategyOnLoss: {
        value: '${params.strategyOnLoss}', type: 'radio', label: 'Strategia perdita:',
        options: {
            x2div2: { value: 'x2div2', type: 'noop', label: 'raddoppia e dimezza' },
            recoveryValue: { value: 'recoveryValue', type: 'noop', label: 'recupera fisso' },
        }
    },
    multFactor: { value: ${params.multFactor}, type: 'multiplier', label: 'Fattore moltiplicazione' },
    maxBets: { value: ${params.maxBets}, type: 'multiplier', label: 'Max tentativi' },
};

var mult = config.mult.value;
var baseBet = config.bet.value;
var timesToStop = config.timesToStop.value;
var highValue = config.highValue.value;
var timesToChange = config.timesToChange.value;
var multFactor = config.multFactor.value;
var normalBets = config.normalBets.value;
var failBets = 0;
var highResult = 0;
var negativeChanges = 0;
var maxBets = config.maxBets.value;
var multRecovered = 0;

engine.on('GAME_STARTING', onGameStarted);
engine.on('GAME_ENDED', onGameEnded);

function onGameStarted() {
    if (highResult && timesToStop > 0) {
        highResult--;
    } else {
        if (maxBets == 0) {
            reset();
        }
        engine.bet(baseBet, config.strategyOnLoss.value == 'recoveryValue' && multRecovered > 0 ? multFactor * 100 : mult * 100, false);
    }
}

function onGameEnded() {
    var lastGame = engine.history.first();
    if (lastGame.bust >= highValue && multRecovered == 0 && config.strategyOnHigh.value == "stop") {
        highResult = timesToStop;
    }
    if (lastGame.wager) {
        if (!lastGame.cashedAt) {
            if (normalBets == 0) {
                failBets++;
                if (config.strategyOnLoss.value == 'x2div2') {
                    if (failBets % timesToChange == 0) {
                        negativeChanges++;
                        mult = (mult / multFactor) + negativeChanges;
                        baseBet *= multFactor;
                    } else {
                        mult++;
                    }
                } else if (config.strategyOnLoss.value == 'recoveryValue') {
                    if (multRecovered == 0 && normalBets == 0) multRecovered = mult;
                    multRecovered++;
                }
            } else {
                mult++;
                normalBets--;
                if (normalBets == 0) {
                    if (config.strategyOnLoss.value == 'x2div') {
                        negativeChanges = 1;
                        mult = (mult / multFactor) + negativeChanges;
                        baseBet *= multFactor;
                    } else if (config.strategyOnLoss.value == 'recoveryValue') {
                        if (multRecovered == 0 && normalBets == 0) multRecovered = mult;
                        multRecovered++;
                    }
                }
            }
            maxBets--;
        }
        if (lastGame.cashedAt !== 0) {
            if (config.strategyOnLoss.value == 'x2div2' && lastGame.cashedAt < mult) {
                mult -= parseInt(lastGame.cashedAt, 10) - 1;
            } else {
                if (config.strategyOnLoss.value == 'x2div2' || (config.strategyOnLoss.value == 'recoveryValue' && multRecovered == 0)) {
                    reset();
                } else {
                    multRecovered -= lastGame.cashedAt;
                    if (multRecovered <= 0) {
                        reset();
                    }
                }
            }
        }
    }
}

function reset() {
    mult = config.mult.value;
    baseBet = config.bet.value;
    failBets = 0;
    normalBets = config.normalBets.value;
    negativeChanges = 0;
    maxBets = config.maxBets.value;
    multRecovered = 0;
}
`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SIMULATOR
// ═══════════════════════════════════════════════════════════════════════════════

function simulate({ scriptText, startingBalance, gameHash, gameAmount }) {
    return new Promise((resolve, reject) => {
        let shouldStop = false;
        const engine = new SimulatedBustabitEngine();
        const userInfo = engine._userInfo;
        const log = () => {};
        const stop = () => { shouldStop = true; };
        const notify = () => {};

        userInfo.balance = startingBalance;
        userInfo.balanceATH = startingBalance;
        userInfo.balanceATL = startingBalance;

        // Parse config
        const configMatch = scriptText.match(/var\s+config\s*=\s*\{[\s\S]*?\};/);
        const config = {};
        if (configMatch) {
            const propRegex = /(\w+)\s*:\s*\{\s*value\s*:\s*([^,}]+)/g;
            let match;
            while ((match = propRegex.exec(configMatch[0])) !== null) {
                let value = match[2].trim().replace(/['"]/g, '');
                config[match[1]] = { value: isNaN(value) ? value : parseFloat(value) };
            }
        }

        try {
            const fn = new Function('config', 'engine', 'userInfo', 'log', 'stop', 'notify', scriptText);
            fn.call({}, config, engine, userInfo, log, stop, notify);
        } catch (e) {
            reject(e);
            return;
        }

        const games = generateGameResults(gameHash, gameAmount);
        let gamesPlayed = 0;
        let betsPlaced = 0;
        let targetReached = false;
        let targetGame = 0;

        for (let id = 0; id < games.length && !shouldStop; id++) {
            try {
                const game = games[id];
                game.id = id;
                game.wager = 0;
                game.cashedAt = 0;

                engine.gameState = 'GAME_STARTING';
                engine.emit('GAME_STARTING', { gameId: id });

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
                    if (userInfo.balance < userInfo.balanceATL) userInfo.balanceATL = userInfo.balance;
                    if (userInfo.balance > userInfo.balanceATH) userInfo.balanceATH = userInfo.balance;
                    if (userInfo.profit < userInfo.profitATL) userInfo.profitATL = userInfo.profit;
                    if (userInfo.profit > userInfo.profitATH) userInfo.profitATH = userInfo.profit;

                    // Check target +50%
                    if (!targetReached && userInfo.profit >= startingBalance * 0.5) {
                        targetReached = true;
                        targetGame = id + 1;
                    }
                }

                engine.history.data.unshift(game);
                engine.gameState = 'GAME_ENDED';
                engine.emit('GAME_ENDED', { hash: game.hash, bust: game.bust });
                gamesPlayed = id + 1;

            } catch (e) {
                if (e instanceof BetRejected) break;
                break;
            }
        }

        resolve({
            profit: userInfo.profit,
            profitPercent: (userInfo.profit / startingBalance) * 100,
            balance: userInfo.balance,
            bets: betsPlaced,
            gamesPlayed,
            balanceATH: userInfo.balanceATH,
            balanceATL: userInfo.balanceATL,
            profitATH: userInfo.profitATH,
            profitATL: userInfo.profitATL,
            targetReached,
            targetGame,
            busted: userInfo.balance < 100
        });
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOAD CHECKPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

let HASH_CHECKPOINTS_10M = null;
try {
    HASH_CHECKPOINTS_10M = require('./hash-checkpoints-10M.js').HASH_CHECKPOINTS_10M;
} catch (e) {
    console.error('Checkpoints 10M non trovati!');
    process.exit(1);
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEST CONFIGURATIONS
// ═══════════════════════════════════════════════════════════════════════════════

// Configurazione default
const DEFAULT_CONFIG = {
    mult: 12,
    bet: 100,
    highValue: 200,
    timesToStop: 0,
    strategyOnHigh: 'stop',
    normalBets: 120,
    timesToChange: 50,
    strategyOnLoss: 'x2div2',
    multFactor: 20,
    maxBets: 90000
};

// Varianti da testare per obiettivo medio termine (+50% in poche partite)
const VARIANTS = [
    { name: 'Default', ...DEFAULT_CONFIG },

    // Più aggressivo con moltiplicatori bassi
    { name: 'Aggressive Low', mult: 2, bet: 500, normalBets: 20, timesToChange: 10, strategyOnLoss: 'x2div2', multFactor: 2, maxBets: 500, highValue: 50, timesToStop: 0, strategyOnHigh: 'none' },

    // Conservativo con recupero fisso
    { name: 'Conservative Recovery', mult: 3, bet: 200, normalBets: 50, timesToChange: 25, strategyOnLoss: 'recoveryValue', multFactor: 5, maxBets: 1000, highValue: 100, timesToStop: 5, strategyOnHigh: 'stop' },

    // Ultra aggressivo
    { name: 'Ultra Aggressive', mult: 1.5, bet: 1000, normalBets: 10, timesToChange: 5, strategyOnLoss: 'x2div2', multFactor: 2, maxBets: 200, highValue: 20, timesToStop: 0, strategyOnHigh: 'none' },

    // Medio con recupero
    { name: 'Medium Recovery', mult: 5, bet: 300, normalBets: 30, timesToChange: 15, strategyOnLoss: 'recoveryValue', multFactor: 10, maxBets: 500, highValue: 80, timesToStop: 3, strategyOnHigh: 'stop' },

    // Puntata alta, moltiplicatore medio
    { name: 'High Bet Medium Mult', mult: 3, bet: 1000, normalBets: 15, timesToChange: 8, strategyOnLoss: 'x2div2', multFactor: 3, maxBets: 300, highValue: 50, timesToStop: 0, strategyOnHigh: 'none' },

    // Moltiplicatore molto basso (1.2x)
    { name: 'Very Low Mult', mult: 1.2, bet: 2000, normalBets: 5, timesToChange: 3, strategyOnLoss: 'x2div2', multFactor: 2, maxBets: 100, highValue: 10, timesToStop: 0, strategyOnHigh: 'none' },

    // 2x standard
    { name: '2x Standard', mult: 2, bet: 500, normalBets: 30, timesToChange: 15, strategyOnLoss: 'x2div2', multFactor: 2, maxBets: 500, highValue: 30, timesToStop: 0, strategyOnHigh: 'none' },

    // 1.5x con recovery
    { name: '1.5x Recovery', mult: 1.5, bet: 800, normalBets: 20, timesToChange: 10, strategyOnLoss: 'recoveryValue', multFactor: 3, maxBets: 300, highValue: 20, timesToStop: 2, strategyOnHigh: 'stop' },

    // Micro bet, molte puntate
    { name: 'Micro Bet Many', mult: 2, bet: 100, normalBets: 100, timesToChange: 50, strategyOnLoss: 'x2div2', multFactor: 2, maxBets: 2000, highValue: 50, timesToStop: 0, strategyOnHigh: 'none' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN TEST
// ═══════════════════════════════════════════════════════════════════════════════

async function testVariant(variant, numSessions, gamesPerSession, startingBalance) {
    const scriptText = createPaoloBetScript(variant);
    const results = [];

    for (let i = 0; i < numSessions; i++) {
        const hash = HASH_CHECKPOINTS_10M[i % HASH_CHECKPOINTS_10M.length].hash;
        try {
            const result = await simulate({
                scriptText,
                startingBalance,
                gameHash: hash,
                gameAmount: gamesPerSession
            });
            results.push(result);
        } catch (e) {
            results.push({ profit: -startingBalance, profitPercent: -100, busted: true, error: e.message });
        }
    }

    const validResults = results.filter(r => !r.error);
    const profits = results.map(r => r.profitPercent);
    const avgProfit = profits.reduce((a, b) => a + b, 0) / profits.length;
    const positives = validResults.filter(r => r.profit > 0);
    const busted = results.filter(r => r.busted);
    const targetHits = validResults.filter(r => r.targetReached);
    const avgBets = validResults.reduce((a, r) => a + r.bets, 0) / validResults.length;
    const avgGames = validResults.reduce((a, r) => a + r.gamesPlayed, 0) / validResults.length;
    const avgTargetGame = targetHits.length > 0 ? targetHits.reduce((a, r) => a + r.targetGame, 0) / targetHits.length : 0;

    // Max drawdown medio
    const avgDrawdown = validResults.reduce((a, r) => a + (r.profitATL / startingBalance * 100), 0) / validResults.length;

    return {
        name: variant.name,
        avgProfit,
        winRate: (positives.length / validResults.length * 100),
        targetRate: (targetHits.length / validResults.length * 100),
        bustRate: (busted.length / results.length * 100),
        avgBets,
        avgGames,
        avgTargetGame,
        avgDrawdown,
        minProfit: Math.min(...profits),
        maxProfit: Math.max(...profits)
    };
}

async function main() {
    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
    console.log('║              TEST PAOLOBET - Obiettivo +50% Medio Termine                 ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
    console.log('');

    const NUM_SESSIONS = 200;       // Sessioni da testare
    const GAMES_PER_SESSION = 1000; // Partite per sessione (medio termine)
    const STARTING_BALANCE = 100000; // 1000 bits

    console.log(`📊 Configurazione test:`);
    console.log(`   Sessioni:    ${NUM_SESSIONS}`);
    console.log(`   Partite:     ${GAMES_PER_SESSION}/sessione`);
    console.log(`   Bankroll:    ${(STARTING_BALANCE / 100).toLocaleString()} bits`);
    console.log(`   Target:      +50% (${(STARTING_BALANCE * 0.5 / 100).toLocaleString()} bits)`);
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    const allResults = [];

    for (let i = 0; i < VARIANTS.length; i++) {
        const variant = VARIANTS[i];
        process.stdout.write(`🔄 Testing "${variant.name}"...`);
        const result = await testVariant(variant, NUM_SESSIONS, GAMES_PER_SESSION, STARTING_BALANCE);
        allResults.push(result);
        console.log(` ✓`);
    }

    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('                              📊 RISULTATI');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    // Ordina per target rate (obiettivo principale)
    allResults.sort((a, b) => b.targetRate - a.targetRate);

    console.log('┌────────────────────────┬──────────┬──────────┬──────────┬──────────┬───────────┬───────────┐');
    console.log('│ Variante               │ Profit % │ Win Rate │ +50% Hit │ Bust %   │ Avg Bets  │ @Game 50% │');
    console.log('├────────────────────────┼──────────┼──────────┼──────────┼──────────┼───────────┼───────────┤');

    for (const r of allResults) {
        const profit = r.avgProfit >= 0 ? `+${r.avgProfit.toFixed(1)}%` : `${r.avgProfit.toFixed(1)}%`;
        const targetGame = r.avgTargetGame > 0 ? `~${Math.round(r.avgTargetGame)}` : '-';
        console.log(
            `│ ${r.name.padEnd(22)} │ ${profit.padStart(8)} │ ${r.winRate.toFixed(1).padStart(7)}% │ ${r.targetRate.toFixed(1).padStart(7)}% │ ${r.bustRate.toFixed(1).padStart(7)}% │ ${r.avgBets.toFixed(0).padStart(9)} │ ${targetGame.padStart(9)} │`
        );
    }

    console.log('└────────────────────────┴──────────┴──────────┴──────────┴──────────┴───────────┴───────────┘');
    console.log('');

    // Migliore per target rate
    const best = allResults[0];
    console.log('🏆 MIGLIORE CONFIGURAZIONE PER +50%:');
    console.log('────────────────────────────────────────────────────────────────────────────');
    console.log(`   Nome:           ${best.name}`);
    console.log(`   Hit Rate +50%:  ${best.targetRate.toFixed(1)}%`);
    console.log(`   Profitto medio: ${best.avgProfit >= 0 ? '+' : ''}${best.avgProfit.toFixed(2)}%`);
    console.log(`   Win Rate:       ${best.winRate.toFixed(1)}%`);
    console.log(`   Bust Rate:      ${best.bustRate.toFixed(1)}%`);
    console.log(`   Bets medi:      ${best.avgBets.toFixed(0)}`);
    if (best.avgTargetGame > 0) {
        console.log(`   Game medio @50%: ${Math.round(best.avgTargetGame)}`);
    }
    console.log(`   Range:          ${best.minProfit.toFixed(1)}% ~ ${best.maxProfit >= 0 ? '+' : ''}${best.maxProfit.toFixed(1)}%`);
    console.log('');

    // Analisi dettagliata drawdown
    console.log('📉 ANALISI DRAWDOWN:');
    console.log('────────────────────────────────────────────────────────────────────────────');
    for (const r of allResults.slice(0, 5)) {
        console.log(`   ${r.name.padEnd(22)} │ Avg Drawdown: ${r.avgDrawdown.toFixed(1)}%`);
    }
    console.log('');

    // Salva risultati
    fs.writeFileSync('./paolobet-results.json', JSON.stringify({
        config: { sessions: NUM_SESSIONS, games: GAMES_PER_SESSION, balance: STARTING_BALANCE },
        variants: VARIANTS,
        results: allResults
    }, null, 2));
    console.log('💾 Risultati salvati in paolobet-results.json');
    console.log('');

    // Verdetto finale
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    if (best.targetRate >= 10 && best.bustRate < 50) {
        console.log('✅ VERDETTO: Configurazione promettente trovata!');
        console.log(`   Raggiunge +50% nel ${best.targetRate.toFixed(1)}% dei casi.`);
    } else if (best.targetRate >= 5) {
        console.log('⚠️  VERDETTO: Risultati marginali.');
        console.log(`   Solo ${best.targetRate.toFixed(1)}% raggiunge +50%.`);
    } else {
        console.log('❌ VERDETTO: Nessuna configurazione raggiunge efficacemente +50%.');
        console.log('   House edge 1% rende difficile profitti consistenti.');
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
}

main().catch(console.error);
