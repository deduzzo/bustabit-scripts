/**
 * TEST PAOLOBET OTTIMIZZATO
 * Obiettivo: Trovare la migliore configurazione per +50% con stop-profit
 */

const crypto = require('crypto');
const fs = require('fs');
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
            this.next = { wager, payout: Math.round(payout) / 100, resolve, reject };
        }).catch(() => {});
    }
}

class BetRejected extends Error {}

function createPaoloBetScript(params) {
    return `
var mult = ${params.mult};
var baseBet = ${params.bet};
var timesToStop = ${params.timesToStop};
var highValue = ${params.highValue};
var timesToChange = ${params.timesToChange};
var multFactor = ${params.multFactor};
var normalBets = ${params.normalBets};
var strategyOnLoss = '${params.strategyOnLoss}';
var strategyOnHigh = '${params.strategyOnHigh}';
var failBets = 0;
var highResult = 0;
var negativeChanges = 0;
var maxBets = ${params.maxBets};
var multRecovered = 0;
var initMult = mult;
var initBet = baseBet;
var initNormalBets = normalBets;

engine.on('GAME_STARTING', function() {
    if (highResult && timesToStop > 0) {
        highResult--;
    } else {
        if (maxBets <= 0) {
            mult = initMult;
            baseBet = initBet;
            failBets = 0;
            normalBets = initNormalBets;
            negativeChanges = 0;
            maxBets = ${params.maxBets};
            multRecovered = 0;
        }
        var targetMult = strategyOnLoss == 'recoveryValue' && multRecovered > 0 ? multFactor : mult;
        engine.bet(baseBet, targetMult * 100);
    }
});

engine.on('GAME_ENDED', function() {
    var lastGame = engine.history.first();
    if (lastGame.bust >= highValue && multRecovered == 0 && strategyOnHigh == 'stop') {
        highResult = timesToStop;
    }
    if (lastGame.wager) {
        if (!lastGame.cashedAt) {
            if (normalBets <= 0) {
                failBets++;
                if (strategyOnLoss == 'x2div2') {
                    if (failBets % timesToChange == 0) {
                        negativeChanges++;
                        mult = (mult / multFactor) + negativeChanges;
                        baseBet *= multFactor;
                    } else {
                        mult++;
                    }
                } else if (strategyOnLoss == 'recoveryValue') {
                    if (multRecovered == 0) multRecovered = mult;
                    multRecovered++;
                }
            } else {
                mult++;
                normalBets--;
            }
            maxBets--;
        } else {
            if (strategyOnLoss == 'x2div2' && lastGame.cashedAt < mult) {
                mult -= parseInt(lastGame.cashedAt, 10) - 1;
            } else {
                if (strategyOnLoss == 'x2div2' || (strategyOnLoss == 'recoveryValue' && multRecovered == 0)) {
                    mult = initMult;
                    baseBet = initBet;
                    failBets = 0;
                    normalBets = initNormalBets;
                    negativeChanges = 0;
                    maxBets = ${params.maxBets};
                    multRecovered = 0;
                } else {
                    multRecovered -= lastGame.cashedAt;
                    if (multRecovered <= 0) {
                        mult = initMult;
                        baseBet = initBet;
                        failBets = 0;
                        normalBets = initNormalBets;
                        negativeChanges = 0;
                        maxBets = ${params.maxBets};
                        multRecovered = 0;
                    }
                }
            }
        }
    }
});
`;
}

// Simula CON stop-profit
function simulateWithStopProfit({ scriptText, startingBalance, gameHash, gameAmount, targetProfit = 0.5 }) {
    return new Promise((resolve, reject) => {
        let shouldStop = false;
        const engine = new SimulatedBustabitEngine();
        const userInfo = engine._userInfo;

        userInfo.balance = startingBalance;
        userInfo.balanceATL = startingBalance;

        try {
            const fn = new Function('engine', 'userInfo', scriptText);
            fn.call({}, engine, userInfo);
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
                game.wager = 0;
                game.cashedAt = 0;

                engine.emit('GAME_STARTING', {});

                const bet = engine.next;
                engine.next = null;

                if (bet) {
                    if (isNaN(bet.wager) || bet.wager < 100) throw new BetRejected('INVALID_BET');
                    if (userInfo.balance - bet.wager < 0) throw new BetRejected('BET_TOO_BIG');

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
                    if (userInfo.profit < userInfo.profitATL) userInfo.profitATL = userInfo.profit;

                    // STOP-PROFIT: Raggiungi target e ti fermi!
                    if (!targetReached && userInfo.profit >= startingBalance * targetProfit) {
                        targetReached = true;
                        targetGame = id + 1;
                        shouldStop = true; // ESCI SUBITO
                    }
                }

                engine.history.data.unshift(game);
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
            targetReached,
            targetGame,
            busted: userInfo.balance < 100,
            maxDrawdown: (userInfo.profitATL / startingBalance) * 100
        });
    });
}

let HASH_CHECKPOINTS_10M = null;
try {
    HASH_CHECKPOINTS_10M = require('./hash-checkpoints-10M.js').HASH_CHECKPOINTS_10M;
} catch (e) {
    console.error('Checkpoints 10M non trovati!');
    process.exit(1);
}

// Varianti raffinate basate su "Aggressive Low" che ha funzionato meglio
const VARIANTS = [
    // Baseline - Aggressive Low originale
    { name: 'Aggressive Low (base)', mult: 2, bet: 500, normalBets: 20, timesToChange: 10, strategyOnLoss: 'x2div2', multFactor: 2, maxBets: 500, highValue: 50, timesToStop: 0, strategyOnHigh: 'none' },

    // Varianti moltiplicatore
    { name: '1.5x Aggressive', mult: 1.5, bet: 600, normalBets: 15, timesToChange: 8, strategyOnLoss: 'x2div2', multFactor: 2, maxBets: 400, highValue: 30, timesToStop: 0, strategyOnHigh: 'none' },
    { name: '1.8x Balanced', mult: 1.8, bet: 550, normalBets: 18, timesToChange: 9, strategyOnLoss: 'x2div2', multFactor: 2, maxBets: 450, highValue: 40, timesToStop: 0, strategyOnHigh: 'none' },
    { name: '2.5x Medium', mult: 2.5, bet: 400, normalBets: 25, timesToChange: 12, strategyOnLoss: 'x2div2', multFactor: 2, maxBets: 600, highValue: 60, timesToStop: 0, strategyOnHigh: 'none' },

    // Varianti puntata
    { name: 'High Bet 2x', mult: 2, bet: 800, normalBets: 15, timesToChange: 8, strategyOnLoss: 'x2div2', multFactor: 2, maxBets: 350, highValue: 40, timesToStop: 0, strategyOnHigh: 'none' },
    { name: 'Very High Bet', mult: 2, bet: 1200, normalBets: 10, timesToChange: 5, strategyOnLoss: 'x2div2', multFactor: 2, maxBets: 250, highValue: 30, timesToStop: 0, strategyOnHigh: 'none' },

    // Varianti normalBets (fase conservativa più o meno lunga)
    { name: 'Short Normal (10)', mult: 2, bet: 600, normalBets: 10, timesToChange: 5, strategyOnLoss: 'x2div2', multFactor: 2, maxBets: 400, highValue: 40, timesToStop: 0, strategyOnHigh: 'none' },
    { name: 'Long Normal (40)', mult: 2, bet: 400, normalBets: 40, timesToChange: 20, strategyOnLoss: 'x2div2', multFactor: 2, maxBets: 800, highValue: 60, timesToStop: 0, strategyOnHigh: 'none' },

    // Varianti multFactor (quanto moltiplica la puntata)
    { name: 'MultFactor 3', mult: 2, bet: 500, normalBets: 20, timesToChange: 10, strategyOnLoss: 'x2div2', multFactor: 3, maxBets: 400, highValue: 50, timesToStop: 0, strategyOnHigh: 'none' },
    { name: 'MultFactor 1.5', mult: 2, bet: 500, normalBets: 20, timesToChange: 10, strategyOnLoss: 'x2div2', multFactor: 1.5, maxBets: 600, highValue: 50, timesToStop: 0, strategyOnHigh: 'none' },

    // Con recovery invece di x2div2
    { name: '2x Recovery Mode', mult: 2, bet: 500, normalBets: 20, timesToChange: 10, strategyOnLoss: 'recoveryValue', multFactor: 3, maxBets: 500, highValue: 50, timesToStop: 0, strategyOnHigh: 'none' },
    { name: '1.8x Recovery Mode', mult: 1.8, bet: 600, normalBets: 15, timesToChange: 8, strategyOnLoss: 'recoveryValue', multFactor: 3, maxBets: 400, highValue: 40, timesToStop: 0, strategyOnHigh: 'none' },

    // Configurazioni "safe" con stop su punteggi alti
    { name: '2x Safe High Stop', mult: 2, bet: 500, normalBets: 20, timesToChange: 10, strategyOnLoss: 'x2div2', multFactor: 2, maxBets: 500, highValue: 20, timesToStop: 3, strategyOnHigh: 'stop' },

    // Super aggressivo
    { name: 'Super Aggressive', mult: 1.5, bet: 1000, normalBets: 8, timesToChange: 4, strategyOnLoss: 'x2div2', multFactor: 2, maxBets: 200, highValue: 20, timesToStop: 0, strategyOnHigh: 'none' },

    // Puntata tiny, molte partite
    { name: 'Tiny Bet Marathon', mult: 1.8, bet: 200, normalBets: 50, timesToChange: 25, strategyOnLoss: 'x2div2', multFactor: 2, maxBets: 1500, highValue: 50, timesToStop: 0, strategyOnHigh: 'none' },
];

async function testVariant(variant, numSessions, gamesPerSession, startingBalance, targetProfit) {
    const scriptText = createPaoloBetScript(variant);
    const results = [];

    for (let i = 0; i < numSessions; i++) {
        const hash = HASH_CHECKPOINTS_10M[i % HASH_CHECKPOINTS_10M.length].hash;
        try {
            const result = await simulateWithStopProfit({
                scriptText,
                startingBalance,
                gameHash: hash,
                gameAmount: gamesPerSession,
                targetProfit
            });
            results.push(result);
        } catch (e) {
            results.push({ profit: -startingBalance, profitPercent: -100, busted: true, error: e.message });
        }
    }

    const validResults = results.filter(r => !r.error);
    const profits = results.map(r => r.profitPercent);
    const avgProfit = profits.reduce((a, b) => a + b, 0) / profits.length;
    const targetHits = validResults.filter(r => r.targetReached);
    const busted = results.filter(r => r.busted);
    const avgBets = validResults.reduce((a, r) => a + r.bets, 0) / validResults.length;
    const avgTargetGame = targetHits.length > 0 ? targetHits.reduce((a, r) => a + r.targetGame, 0) / targetHits.length : 0;
    const avgDrawdown = validResults.reduce((a, r) => a + r.maxDrawdown, 0) / validResults.length;

    // Expected value (tenendo conto dello stop-profit)
    const EV = avgProfit;

    return {
        name: variant.name,
        avgProfit,
        targetRate: (targetHits.length / validResults.length * 100),
        bustRate: (busted.length / results.length * 100),
        avgBets,
        avgTargetGame,
        avgDrawdown,
        EV,
        minProfit: Math.min(...profits),
        maxProfit: Math.max(...profits)
    };
}

async function main() {
    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
    console.log('║       TEST PAOLOBET OTTIMIZZATO - Con Stop-Profit al +50%                 ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
    console.log('');

    const NUM_SESSIONS = 500;        // Più sessioni per risultati più affidabili
    const GAMES_PER_SESSION = 2000;  // Max partite (con stop-profit si ferma prima)
    const STARTING_BALANCE = 100000; // 1000 bits
    const TARGET_PROFIT = 0.5;       // +50%

    console.log(`📊 Configurazione test:`);
    console.log(`   Sessioni:    ${NUM_SESSIONS}`);
    console.log(`   Max Partite: ${GAMES_PER_SESSION}/sessione`);
    console.log(`   Bankroll:    ${(STARTING_BALANCE / 100).toLocaleString()} bits`);
    console.log(`   Target:      +50% (stop-profit automatico)`);
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const allResults = [];
    const startTime = Date.now();

    for (let i = 0; i < VARIANTS.length; i++) {
        const variant = VARIANTS[i];
        process.stdout.write(`\r🔄 Testing ${i + 1}/${VARIANTS.length}: "${variant.name}"...`.padEnd(70));
        const result = await testVariant(variant, NUM_SESSIONS, GAMES_PER_SESSION, STARTING_BALANCE, TARGET_PROFIT);
        allResults.push(result);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\r✓ Completato in ${elapsed}s`.padEnd(70));
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('                              📊 RISULTATI');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    // Ordina per EV (expected value con stop-profit)
    allResults.sort((a, b) => b.EV - a.EV);

    console.log('┌────────────────────────┬──────────┬──────────┬──────────┬───────────┬───────────┬───────────┐');
    console.log('│ Variante               │ EV %     │ +50% Hit │ Bust %   │ Avg Bets  │ @Game 50% │ Drawdown  │');
    console.log('├────────────────────────┼──────────┼──────────┼──────────┼───────────┼───────────┼───────────┤');

    for (const r of allResults) {
        const ev = r.EV >= 0 ? `+${r.EV.toFixed(1)}%` : `${r.EV.toFixed(1)}%`;
        const targetGame = r.avgTargetGame > 0 ? `~${Math.round(r.avgTargetGame)}` : '-';
        const drawdown = `${r.avgDrawdown.toFixed(0)}%`;
        console.log(
            `│ ${r.name.padEnd(22)} │ ${ev.padStart(8)} │ ${r.targetRate.toFixed(1).padStart(7)}% │ ${r.bustRate.toFixed(1).padStart(7)}% │ ${r.avgBets.toFixed(0).padStart(9)} │ ${targetGame.padStart(9)} │ ${drawdown.padStart(9)} │`
        );
    }

    console.log('└────────────────────────┴──────────┴──────────┴──────────┴───────────┴───────────┴───────────┘');
    console.log('');

    // Top 3
    console.log('🏆 TOP 3 CONFIGURAZIONI (per Expected Value con Stop-Profit):');
    console.log('────────────────────────────────────────────────────────────────────────────');

    for (let i = 0; i < 3 && i < allResults.length; i++) {
        const r = allResults[i];
        const medal = ['🥇', '🥈', '🥉'][i];
        console.log(`${medal} ${r.name}`);
        console.log(`   EV: ${r.EV >= 0 ? '+' : ''}${r.EV.toFixed(2)}%  |  Hit Rate: ${r.targetRate.toFixed(1)}%  |  Bust: ${r.bustRate.toFixed(1)}%`);
        console.log(`   Bets medi: ${r.avgBets.toFixed(0)}  |  Game @50%: ${Math.round(r.avgTargetGame) || '-'}  |  Drawdown: ${r.avgDrawdown.toFixed(0)}%`);
        console.log('');
    }

    // Analisi speciale: configurazioni con EV positivo
    const positiveEV = allResults.filter(r => r.EV > 0);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    if (positiveEV.length > 0) {
        console.log(`✅ TROVATE ${positiveEV.length} CONFIGURAZIONI CON EV POSITIVO!`);
        console.log('');
        for (const r of positiveEV) {
            console.log(`   ✓ ${r.name}: EV +${r.EV.toFixed(2)}%, Hit ${r.targetRate.toFixed(1)}%`);
        }
    } else {
        console.log('⚠️  Nessuna configurazione con EV positivo trovata.');
        console.log('   Questo è atteso: house edge 1% rende profitti stabili molto difficili.');
    }

    console.log('');

    // Configurazione migliore per chi vuole giocare
    const bestForPlayer = allResults.find(r => r.targetRate >= 50 && r.bustRate < 10);
    if (bestForPlayer) {
        console.log('🎯 MIGLIORE PER GIOCARE (>50% hit, <10% bust):');
        console.log(`   ${bestForPlayer.name}`);
        console.log(`   Hit Rate: ${bestForPlayer.targetRate.toFixed(1)}%`);
        console.log(`   Bust Rate: ${bestForPlayer.bustRate.toFixed(1)}%`);
        console.log(`   Partite medie per +50%: ${Math.round(bestForPlayer.avgTargetGame)}`);
    }

    console.log('');

    // Salva risultati
    fs.writeFileSync('./paolobet-optimized-results.json', JSON.stringify({
        config: { sessions: NUM_SESSIONS, games: GAMES_PER_SESSION, balance: STARTING_BALANCE, target: TARGET_PROFIT },
        variants: VARIANTS,
        results: allResults
    }, null, 2));
    console.log('💾 Risultati salvati in paolobet-optimized-results.json');
    console.log('');
}

main().catch(console.error);
