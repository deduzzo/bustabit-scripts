/**
 * TEST FINALE PAOLOBET - Validazione configurazione ottimale
 * 1000 sessioni per conferma statistica
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
        this._userInfo = { balance: 0, bets: 0, profit: 0, balanceATL: 0, profitATL: 0, profitATH: 0 };
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

// CONFIGURAZIONE OTTIMALE TROVATA
const OPTIMAL_CONFIG = {
    mult: 1.5,
    bet: 600,           // 6 bits
    normalBets: 15,
    timesToChange: 8,
    strategyOnLoss: 'x2div2',
    multFactor: 2,
    maxBets: 400,
    highValue: 30,
    timesToStop: 0,
    strategyOnHigh: 'none'
};

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

function simulateWithStopProfit({ scriptText, startingBalance, gameHash, gameAmount, targetProfit = 0.5, stopLoss = -0.5 }) {
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
        let stopLossHit = false;
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
                    if (userInfo.profit > userInfo.profitATH) userInfo.profitATH = userInfo.profit;

                    // STOP-PROFIT
                    if (!targetReached && userInfo.profit >= startingBalance * targetProfit) {
                        targetReached = true;
                        targetGame = id + 1;
                        shouldStop = true;
                    }

                    // STOP-LOSS opzionale
                    if (stopLoss && userInfo.profit <= startingBalance * stopLoss) {
                        stopLossHit = true;
                        shouldStop = true;
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
            stopLossHit,
            targetGame,
            busted: userInfo.balance < 100,
            maxDrawdown: (userInfo.profitATL / startingBalance) * 100,
            maxProfit: (userInfo.profitATH / startingBalance) * 100
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

async function main() {
    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
    console.log('║          TEST FINALE PAOLOBET - Validazione Configurazione Ottimale       ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
    console.log('');

    const NUM_SESSIONS = 1000;
    const GAMES_PER_SESSION = 3000;
    const STARTING_BALANCE = 100000; // 1000 bits

    console.log(`📊 Configurazione Ottimale:`);
    console.log(`   Moltiplicatore:  ${OPTIMAL_CONFIG.mult}x`);
    console.log(`   Puntata base:    ${OPTIMAL_CONFIG.bet / 100} bits`);
    console.log(`   Normal bets:     ${OPTIMAL_CONFIG.normalBets}`);
    console.log(`   Times to change: ${OPTIMAL_CONFIG.timesToChange}`);
    console.log(`   Mult factor:     ${OPTIMAL_CONFIG.multFactor}x`);
    console.log(`   Max bets:        ${OPTIMAL_CONFIG.maxBets}`);
    console.log('');
    console.log(`📊 Test Setup:`);
    console.log(`   Sessioni:    ${NUM_SESSIONS}`);
    console.log(`   Max Partite: ${GAMES_PER_SESSION}/sessione`);
    console.log(`   Bankroll:    ${(STARTING_BALANCE / 100).toLocaleString()} bits`);
    console.log(`   Target:      +50% (stop-profit automatico)`);
    console.log('');

    const scriptText = createPaoloBetScript(OPTIMAL_CONFIG);
    const results = [];
    const startTime = Date.now();

    // Test senza stop-loss
    console.log('🔄 Test SENZA stop-loss...');
    for (let i = 0; i < NUM_SESSIONS; i++) {
        const hash = HASH_CHECKPOINTS_10M[i % HASH_CHECKPOINTS_10M.length].hash;
        try {
            const result = await simulateWithStopProfit({
                scriptText,
                startingBalance: STARTING_BALANCE,
                gameHash: hash,
                gameAmount: GAMES_PER_SESSION,
                targetProfit: 0.5,
                stopLoss: null
            });
            results.push(result);
        } catch (e) {
            results.push({ profit: -STARTING_BALANCE, profitPercent: -100, busted: true, error: e.message });
        }

        if ((i + 1) % 100 === 0) {
            process.stdout.write(`\r   Progress: ${i + 1}/${NUM_SESSIONS}`);
        }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\r✓ Completato in ${elapsed}s`.padEnd(50));
    console.log('');

    // Analisi risultati
    const validResults = results.filter(r => !r.error);
    const profits = results.map(r => r.profitPercent);
    const avgProfit = profits.reduce((a, b) => a + b, 0) / profits.length;
    const targetHits = validResults.filter(r => r.targetReached);
    const busted = results.filter(r => r.busted);
    const avgBets = validResults.reduce((a, r) => a + r.bets, 0) / validResults.length;
    const avgTargetGame = targetHits.length > 0 ? targetHits.reduce((a, r) => a + r.targetGame, 0) / targetHits.length : 0;
    const avgDrawdown = validResults.reduce((a, r) => a + r.maxDrawdown, 0) / validResults.length;

    // Percentili partite per +50%
    const targetGames = targetHits.map(r => r.targetGame).sort((a, b) => a - b);
    const p10 = targetGames[Math.floor(targetGames.length * 0.1)];
    const p25 = targetGames[Math.floor(targetGames.length * 0.25)];
    const p50 = targetGames[Math.floor(targetGames.length * 0.5)];
    const p75 = targetGames[Math.floor(targetGames.length * 0.75)];
    const p90 = targetGames[Math.floor(targetGames.length * 0.9)];

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('                              📊 RISULTATI FINALI');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('PERFORMANCE:');
    console.log('────────────────────────────────────────────────────────────────────────────');
    console.log(`   Hit Rate +50%:     ${(targetHits.length / validResults.length * 100).toFixed(1)}% (${targetHits.length}/${validResults.length})`);
    console.log(`   Bust Rate:         ${(busted.length / results.length * 100).toFixed(1)}% (${busted.length}/${results.length})`);
    console.log(`   EV (con stop):     ${avgProfit >= 0 ? '+' : ''}${avgProfit.toFixed(2)}%`);
    console.log(`   Avg Bets:          ${avgBets.toFixed(0)}`);
    console.log(`   Avg Drawdown:      ${avgDrawdown.toFixed(0)}%`);
    console.log('');
    console.log('PARTITE PER RAGGIUNGERE +50% (percentili):');
    console.log('────────────────────────────────────────────────────────────────────────────');
    console.log(`   10% più veloci:    ≤ ${p10} partite`);
    console.log(`   25% più veloci:    ≤ ${p25} partite`);
    console.log(`   50% (mediana):     ≤ ${p50} partite`);
    console.log(`   75%:               ≤ ${p75} partite`);
    console.log(`   90%:               ≤ ${p90} partite`);
    console.log(`   Media:             ~${Math.round(avgTargetGame)} partite`);
    console.log('');

    // Distribuzione profitti
    console.log('DISTRIBUZIONE FINALE:');
    console.log('────────────────────────────────────────────────────────────────────────────');
    const brackets = [
        { min: -100, max: -75, label: 'Bust (-100% a -75%)' },
        { min: -75, max: -50, label: 'Grave (-75% a -50%)' },
        { min: -50, max: -25, label: 'Perdita (-50% a -25%)' },
        { min: -25, max: 0, label: 'Lieve (-25% a 0%)' },
        { min: 0, max: 25, label: 'Piccolo guadagno' },
        { min: 25, max: 50, label: 'Buon guadagno' },
        { min: 50, max: 51, label: '★ TARGET +50%! ★' },
    ];

    for (const bracket of brackets) {
        const count = profits.filter(p => p > bracket.min && p <= bracket.max).length;
        const pct = (count / profits.length * 100).toFixed(1);
        const bar = '█'.repeat(Math.round(count / profits.length * 30));
        console.log(`   ${bracket.label.padEnd(25)} │ ${bar.padEnd(30)} │ ${pct.padStart(5)}%`);
    }
    console.log('');

    // Rischio/Rendimento
    console.log('ANALISI RISCHIO/RENDIMENTO:');
    console.log('────────────────────────────────────────────────────────────────────────────');
    const hitRate = targetHits.length / validResults.length;
    const avgLoss = validResults.filter(r => !r.targetReached).reduce((a, r) => a + r.profitPercent, 0) / (validResults.length - targetHits.length);
    console.log(`   Se vinci (+50%):   Probabilità ${(hitRate * 100).toFixed(1)}%`);
    console.log(`   Se perdi:          Media ${avgLoss.toFixed(1)}%`);
    console.log(`   Risk/Reward:       Rischi ${Math.abs(avgLoss).toFixed(0)}% per guadagnare 50%`);
    console.log('');

    // Conclusioni
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('                              🎯 CONCLUSIONI');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    if (hitRate >= 0.6) {
        console.log('✅ STRATEGIA VALIDA per obiettivo +50%!');
        console.log('');
        console.log(`   Con questa configurazione hai il ${(hitRate * 100).toFixed(1)}% di probabilità`);
        console.log(`   di raggiungere +50% entro ~${Math.round(avgTargetGame)} partite.`);
        console.log('');
        console.log('   ⚠️  ATTENZIONE:');
        console.log('   - EV è comunque leggermente negativo a lungo termine');
        console.log('   - Quando perdi, puoi perdere anche tanto (drawdown ~55%)');
        console.log('   - NON giocare mai più di quanto sei disposto a perdere');
    } else {
        console.log('⚠️  Hit rate sotto il 60%, considera di ottimizzare ulteriormente.');
    }
    console.log('');

    // Salva risultati
    const output = {
        config: OPTIMAL_CONFIG,
        testSetup: { sessions: NUM_SESSIONS, games: GAMES_PER_SESSION, balance: STARTING_BALANCE },
        summary: {
            hitRate: (hitRate * 100).toFixed(1),
            bustRate: ((busted.length / results.length) * 100).toFixed(1),
            avgProfit: avgProfit.toFixed(2),
            avgBets: Math.round(avgBets),
            avgTargetGame: Math.round(avgTargetGame),
            avgDrawdown: avgDrawdown.toFixed(0),
            percentiles: { p10, p25, p50, p75, p90 }
        }
    };

    fs.writeFileSync('./paolobet-final-results.json', JSON.stringify(output, null, 2));
    console.log('💾 Risultati salvati in paolobet-final-results.json');
    console.log('');
}

main().catch(console.error);
