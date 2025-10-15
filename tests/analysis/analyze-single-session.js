/**
 * Analizza una singola sessione in dettaglio
 */

const crypto = require('crypto');

const GAME_SALT = '00000000000000000001e08b7fd44f95e3e950ac65650a8031a6d5e1750e34be';

function crashPointFromHash(serverSeed) {
    const hmac = crypto.createHmac('sha256', GAME_SALT);
    hmac.update(Buffer.from(serverSeed, 'hex'));
    const hmacResult = hmac.digest('hex');
    const h = parseInt(hmacResult.substring(0, 13), 16);
    const e = Math.pow(2, 52);
    if (h % 33 === 0) return 1.00;
    const x = h / e;
    return Math.max(1.00, Math.floor(99 / (1 - x)) / 100);
}

function getPreviousHash(hash) {
    return crypto.createHash('sha256')
        .update(Buffer.from(hash, 'hex'))
        .digest('hex');
}

function generateRealSequence(startHash, count) {
    const crashes = [];
    let currentHash = startHash;
    for (let i = 0; i < count; i++) {
        const crash = crashPointFromHash(currentHash);
        crashes.push(crash);
        currentHash = getPreviousHash(currentHash);
    }
    return crashes;
}

function simulateDetailedSession(crashes, config, capital) {
    let balance = capital;
    const initBalance = balance;
    const { baseBet, payout, mult, maxTimes } = config;

    let currentBet = baseBet;
    let currentTimes = 0;
    let maxReached = 0;
    let totalWins = 0;
    let totalLosses = 0;
    let maxDrawdown = 0;
    let hitMaxTimes = 0;
    let resets = 0;

    const events = [];

    for (let i = 0; i < crashes.length; i++) {
        const crash = crashes[i];

        if (balance < currentBet) {
            events.push({
                game: i + 1,
                crash,
                action: 'INSUFFICIENT_BALANCE',
                bet: currentBet / 100,
                balance: balance / 100,
                currentTimes,
                needed: currentBet / 100
            });

            resets++;
            currentBet = baseBet;
            currentTimes = 0;
            hitMaxTimes++;

            if (balance < baseBet) {
                events.push({
                    game: i + 1,
                    action: 'BANKRUPT',
                    balance: balance / 100
                });
                return { balance, initBalance, events, reason: 'bankrupt', wins: totalWins, losses: totalLosses, maxReached };
            }
            continue;
        }

        if (crash >= payout) {
            // WIN
            const win = Math.floor(currentBet * payout) - currentBet;
            balance += win;
            totalWins++;

            if (currentTimes > 0) {
                events.push({
                    game: i + 1,
                    crash,
                    action: 'WIN_RECOVERY',
                    bet: currentBet / 100,
                    profit: win / 100,
                    balance: balance / 100,
                    afterTimes: currentTimes
                });
            }

            currentBet = baseBet;
            currentTimes = 0;
        } else {
            // LOSS
            balance -= currentBet;
            totalLosses++;
            currentTimes++;

            if (currentTimes > maxReached) maxReached = currentTimes;

            const drawdown = ((initBalance - balance) / initBalance) * 100;
            if (drawdown > maxDrawdown) maxDrawdown = drawdown;

            events.push({
                game: i + 1,
                crash,
                action: 'LOSS',
                bet: currentBet / 100,
                balance: balance / 100,
                times: currentTimes,
                drawdown: drawdown.toFixed(2)
            });

            if (currentTimes >= maxTimes) {
                events.push({
                    game: i + 1,
                    action: 'HIT_MAX_TIMES',
                    times: currentTimes,
                    totalLost: (initBalance - balance) / 100
                });

                hitMaxTimes++;
                currentBet = baseBet;
                currentTimes = 0;
            } else {
                currentBet = Math.ceil((currentBet / 100) * mult) * 100;
            }
        }
    }

    return {
        balance,
        initBalance,
        events,
        wins: totalWins,
        losses: totalLosses,
        maxReached,
        hitMaxTimes,
        resets,
        reason: 'completed'
    };
}

// Test session 46 che ha perso -34,369 bits con 60k
const START_HASH = '94aa062026624e59a0ace092568d5f46e21b9bf1d5173609db8645dd62bdfc44';
const TOTAL_GAMES = 4000000;
const CHUNK_SIZE = 2000;

console.log('Generating 4M crashes...');
const allCrashes = generateRealSequence(START_HASH, TOTAL_GAMES);

// Extract chunks
const chunks = [];
const maxStartIndex = TOTAL_GAMES - CHUNK_SIZE;
const usedIndices = new Set();

while (chunks.length < 2000) {
    const startIndex = Math.floor(Math.random() * maxStartIndex);
    if (!usedIndices.has(startIndex)) {
        usedIndices.add(startIndex);
        chunks.push({ startIndex, crashes: allCrashes.slice(startIndex, startIndex + CHUNK_SIZE) });
    }
}

// Simulate session 46 (index 45)
const session46 = chunks[45];
console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`SESSION 46 DETAILED ANALYSIS`);
console.log(`Start Index: ${session46.startIndex}`);
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

const config = {
    baseBet: 100,
    payout: 3.0,
    mult: 1.50,
    maxTimes: 23,
    waitBeforePlay: 0
};

const capital = 6000000; // 60k bits

console.log('Config: M1.50-P3.0x');
console.log(`Capital: ${capital / 100} bits`);
console.log(`Max Times: ${config.maxTimes}\n`);

const result = simulateDetailedSession(session46.crashes, config, capital);

console.log('EVENTS (showing losses and critical moments):');
console.log('─────────────────────────────────────────────────────────\n');

let consecutiveLosses = 0;
result.events.forEach(e => {
    if (e.action === 'LOSS') {
        consecutiveLosses++;
        if (e.times >= 15) { // Show only deep losses
            console.log(`Game ${e.game}: LOSS #${e.times} - Crash: ${e.crash.toFixed(2)}x - Bet: ${e.bet.toFixed(2)} bits - Balance: ${e.balance.toFixed(2)} bits - DD: ${e.drawdown}%`);
        }
    } else if (e.action === 'HIT_MAX_TIMES') {
        console.log(`Game ${e.game}: ⚠️  HIT MAX TIMES (T:${e.times}) - Total Lost: ${e.totalLost.toFixed(2)} bits`);
        consecutiveLosses = 0;
    } else if (e.action === 'WIN_RECOVERY') {
        if (e.afterTimes >= 15) {
            console.log(`Game ${e.game}: ✅ WIN after T:${e.afterTimes} - Crash: ${e.crash.toFixed(2)}x - Recovered with +${e.profit.toFixed(2)} bits`);
        }
        consecutiveLosses = 0;
    } else if (e.action === 'INSUFFICIENT_BALANCE') {
        console.log(`Game ${e.game}: ⛔ INSUFFICIENT BALANCE - Needed: ${e.needed} bits, Have: ${e.balance} bits - Times: ${e.currentTimes}`);
    } else if (e.action === 'BANKRUPT') {
        console.log(`Game ${e.game}: 💀 BANKRUPT - Final Balance: ${e.balance} bits`);
    }
});

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('SUMMARY:');
console.log('─────────────────────────────────────────────────────────');
console.log(`Initial Balance: ${result.initBalance / 100} bits`);
console.log(`Final Balance: ${result.balance / 100} bits`);
console.log(`Profit: ${((result.balance - result.initBalance) / 100).toFixed(2)} bits`);
console.log(`Profit %: ${(((result.balance - result.initBalance) / result.initBalance) * 100).toFixed(3)}%`);
console.log(`Max Reached: T:${result.maxReached}`);
console.log(`Hit Max Times: ${result.hitMaxTimes} times`);
console.log(`Resets: ${result.resets}`);
console.log(`Wins: ${result.wins}`);
console.log(`Losses: ${result.losses}`);
console.log(`Reason: ${result.reason}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
