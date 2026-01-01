/**
 * TEST PAOLOBET v2.0 - Con Auto-Bet Sizing e Take Profit
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
            this.next = { wager, payout, resolve, reject };
        }).catch(() => {});
    }
}

class BetRejected extends Error {}

// Simula con la nuova logica v2.0
function simulateV2({ startingBalance, gameHash, gameAmount, takeProfit = 50, betPercent = 0.6, mult = 1.5 }) {
    return new Promise((resolve, reject) => {
        let shouldStop = false;
        const engine = new SimulatedBustabitEngine();
        const userInfo = engine._userInfo;

        userInfo.balance = startingBalance;
        userInfo.balanceATL = startingBalance;

        // Config v2.0
        const config = {
            takeProfit: { value: takeProfit },
            betPercent: { value: betPercent },
            mult: { value: mult },
            normalBets: { value: 15 },
            timesToChange: { value: 8 },
            multFactor: { value: 2 },
            maxBets: { value: 400 },
            highValue: { value: 30 },
            timesToStop: { value: 0 },
            strategyOnHigh: { value: 'none' },
            strategyOnLoss: { value: 'x2div2' }
        };

        // Calcolo automatico come nello script
        const startBalance = userInfo.balance;
        const takeProfitDecimal = config.takeProfit.value / 100;
        const targetProfit = Math.floor(startBalance * takeProfitDecimal);
        const betPercentDecimal = config.betPercent.value / 100;
        let calculatedBet = Math.floor(startBalance * betPercentDecimal);
        calculatedBet = Math.max(100, Math.floor(calculatedBet / 100) * 100);

        // Variabili di stato
        let currentMult = config.mult.value;
        let baseBet = calculatedBet;
        let normalBets = config.normalBets.value;
        let failBets = 0;
        let negativeChanges = 0;
        let maxBets = config.maxBets.value;
        let multRecovered = 0;

        const initMult = currentMult;
        const initBet = baseBet;
        const initNormalBets = normalBets;
        const initMaxBets = maxBets;

        function reset() {
            currentMult = initMult;
            baseBet = initBet;
            failBets = 0;
            normalBets = initNormalBets;
            negativeChanges = 0;
            maxBets = initMaxBets;
            multRecovered = 0;
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

                // Check Take Profit
                const currentProfit = userInfo.balance - startBalance;
                if (currentProfit >= targetProfit) {
                    targetReached = true;
                    targetGame = id;
                    shouldStop = true;
                    break;
                }

                // Reset se max tentativi
                if (maxBets <= 0) {
                    reset();
                }

                // Calcola target mult
                let targetMult = currentMult;
                if (config.strategyOnLoss.value === 'recoveryValue' && multRecovered > 0) {
                    targetMult = config.multFactor.value;
                }

                // Verifica balance
                const currentBet = Math.round(baseBet);
                if (currentBet > userInfo.balance) {
                    shouldStop = true;
                    break;
                }

                // Piazza puntata
                userInfo.balance -= currentBet;
                userInfo.bets++;
                betsPlaced++;

                game.wager = currentBet;
                game.cashedAt = targetMult <= game.bust ? targetMult : 0;

                if (game.cashedAt > 0) {
                    userInfo.balance += game.cashedAt * game.wager;
                }

                userInfo.profit = userInfo.balance - startBalance;
                if (userInfo.balance < userInfo.balanceATL) userInfo.balanceATL = userInfo.balance;
                if (userInfo.profit < userInfo.profitATL) userInfo.profitATL = userInfo.profit;
                if (userInfo.profit > userInfo.profitATH) userInfo.profitATH = userInfo.profit;

                // Handle win/loss
                if (!game.cashedAt) {
                    // Loss
                    if (normalBets <= 0) {
                        failBets++;
                        if (config.strategyOnLoss.value === 'x2div2') {
                            if (failBets % config.timesToChange.value === 0) {
                                negativeChanges++;
                                currentMult = (currentMult / config.multFactor.value) + negativeChanges;
                                baseBet *= config.multFactor.value;
                            } else {
                                currentMult++;
                            }
                        } else if (config.strategyOnLoss.value === 'recoveryValue') {
                            if (multRecovered === 0) multRecovered = currentMult;
                            multRecovered++;
                        }
                    } else {
                        currentMult++;
                        normalBets--;
                    }
                    maxBets--;
                } else {
                    // Win
                    if (config.strategyOnLoss.value === 'x2div2') {
                        if (game.cashedAt < currentMult) {
                            currentMult -= parseInt(game.cashedAt, 10) - 1;
                        } else {
                            reset();
                        }
                    } else if (config.strategyOnLoss.value === 'recoveryValue') {
                        if (multRecovered === 0) {
                            reset();
                        } else {
                            multRecovered -= game.cashedAt;
                            if (multRecovered <= 0) reset();
                        }
                    }
                }

                engine.history.data.unshift(game);
                gamesPlayed = id + 1;

            } catch (e) {
                break;
            }
        }

        resolve({
            profit: userInfo.profit,
            profitPercent: (userInfo.profit / startBalance) * 100,
            balance: userInfo.balance,
            bets: betsPlaced,
            gamesPlayed,
            targetReached,
            targetGame,
            busted: userInfo.balance < 100,
            maxDrawdown: (userInfo.profitATL / startBalance) * 100,
            calculatedBet: calculatedBet / 100
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
    console.log('║              TEST PAOLOBET v2.0 - Auto-Bet + Take Profit                  ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
    console.log('');

    // Test con diversi bankroll
    const BANKROLLS = [50000, 100000, 500000, 1000000]; // 500, 1000, 5000, 10000 bits
    const TAKE_PROFITS = [25, 50, 100]; // +25%, +50%, +100%
    const NUM_SESSIONS = 500;
    const GAMES_PER_SESSION = 3000;

    console.log(`📊 Test Setup:`);
    console.log(`   Sessioni per config: ${NUM_SESSIONS}`);
    console.log(`   Max Partite:         ${GAMES_PER_SESSION}`);
    console.log(`   Bet %:               0.6%`);
    console.log('');

    const allResults = [];

    for (const balance of BANKROLLS) {
        for (const tp of TAKE_PROFITS) {
            const configName = `${balance/100} bits @ +${tp}%`;
            process.stdout.write(`🔄 Testing ${configName}...`);

            const results = [];
            for (let i = 0; i < NUM_SESSIONS; i++) {
                const hash = HASH_CHECKPOINTS_10M[i % HASH_CHECKPOINTS_10M.length].hash;
                const result = await simulateV2({
                    startingBalance: balance,
                    gameHash: hash,
                    gameAmount: GAMES_PER_SESSION,
                    takeProfit: tp,
                    betPercent: 0.6,
                    mult: 1.5
                });
                results.push(result);
            }

            const validResults = results.filter(r => !r.error);
            const targetHits = validResults.filter(r => r.targetReached);
            const busted = results.filter(r => r.busted);
            const avgProfit = results.reduce((a, r) => a + r.profitPercent, 0) / results.length;
            const avgBets = validResults.reduce((a, r) => a + r.bets, 0) / validResults.length;
            const avgTargetGame = targetHits.length > 0 ? targetHits.reduce((a, r) => a + r.targetGame, 0) / targetHits.length : 0;
            const avgDrawdown = validResults.reduce((a, r) => a + r.maxDrawdown, 0) / validResults.length;

            allResults.push({
                balance: balance / 100,
                takeProfit: tp,
                hitRate: (targetHits.length / validResults.length * 100),
                bustRate: (busted.length / results.length * 100),
                avgProfit,
                avgBets,
                avgTargetGame,
                avgDrawdown,
                calculatedBet: results[0].calculatedBet
            });

            console.log(` ✓`);
        }
    }

    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('                              📊 RISULTATI');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    console.log('┌────────────┬──────────┬──────────┬──────────┬──────────┬───────────┬───────────┬───────────┐');
    console.log('│ Balance    │ Target   │ Bet Base │ Hit Rate │ Bust %   │ EV %      │ Avg Bets  │ @Game     │');
    console.log('├────────────┼──────────┼──────────┼──────────┼──────────┼───────────┼───────────┼───────────┤');

    for (const r of allResults) {
        const ev = r.avgProfit >= 0 ? `+${r.avgProfit.toFixed(1)}%` : `${r.avgProfit.toFixed(1)}%`;
        const targetGame = r.avgTargetGame > 0 ? `~${Math.round(r.avgTargetGame)}` : '-';
        console.log(
            `│ ${r.balance.toString().padStart(10)} │ +${r.takeProfit.toString().padStart(6)}% │ ${r.calculatedBet.toFixed(1).padStart(8)} │ ${r.hitRate.toFixed(1).padStart(7)}% │ ${r.bustRate.toFixed(1).padStart(7)}% │ ${ev.padStart(9)} │ ${r.avgBets.toFixed(0).padStart(9)} │ ${targetGame.padStart(9)} │`
        );
    }

    console.log('└────────────┴──────────┴──────────┴──────────┴──────────┴───────────┴───────────┴───────────┘');
    console.log('');

    // Migliori per ogni target
    console.log('🏆 ANALISI PER TARGET:');
    console.log('────────────────────────────────────────────────────────────────────────────');

    for (const tp of TAKE_PROFITS) {
        const filtered = allResults.filter(r => r.takeProfit === tp);
        const best = filtered.sort((a, b) => b.hitRate - a.hitRate)[0];
        console.log(`   +${tp}%: Best hit rate ${best.hitRate.toFixed(1)}% con ${best.balance} bits (bet: ${best.calculatedBet.toFixed(1)} bits)`);
    }

    console.log('');

    // Salva risultati
    fs.writeFileSync('./paolobet-v2-results.json', JSON.stringify({
        config: { sessions: NUM_SESSIONS, games: GAMES_PER_SESSION, betPercent: 0.6 },
        results: allResults
    }, null, 2));
    console.log('💾 Risultati salvati in paolobet-v2-results.json');
    console.log('');
}

main().catch(console.error);
