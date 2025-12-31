/**
 * TEST MARTIN AI TURBO
 * Verifica prestazioni su 200 sessioni da 10000 partite
 */

const crypto = require('crypto');

const GAME_SALT = "00000000000000000001e08b7fd44f95e3e950ac65650a8031a6d5e1750e34be";

function hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
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

function generateCrashValues(startHash, amount) {
    let currentHash = hexToBytes(startHash);
    const saltBytes = Buffer.from(GAME_SALT, 'utf8');
    const crashes = [];

    for (let i = 0; i < amount; i++) {
        const crash = gameResult(saltBytes, currentHash);
        crashes.push(crash);
        currentHash = sha256(currentHash);
    }
    return crashes;
}

// Simula MARTIN AI TURBO
function simulateTurbo(crashes, config) {
    const {
        targetProfitPercent = 12,
        stopLossPercent = 8,
        huntBasePayout = 1.8,
        huntBaseBetPercent = 0.3,
        huntMinDelay = 6,
        huntCooldown = 3,
        delayHunterPayout = 10.0,
        delayHunterEntry = 50,
        delayHunterBetPercent = 0.15,
        delayHunterMaxBets = 25,
        flatBetPayout = 1.8,
        flatBetPercent = 0.15,
        flatBetInterval = 25,
        flatBetPauseWin = 8,
        flatBetPauseLoss = 3,
        lowHunterPayout = 1.5,
        lowHunterBetPercent = 0.2,
        lowHunterEntry = 5,
        lowHunterMaxBets = 3,
        profitLockThreshold = 6,
        profitLockFloor = 3
    } = config;

    const workingBalance = 1000000;
    const targetProfit = workingBalance * targetProfitPercent / 100;
    const stopLoss = workingBalance * stopLossPercent / 100;

    let balance = workingBalance;
    let initBalance = workingBalance;
    let profitLockActive = false;
    let floorBalance = 0;

    // History
    const crashHistory = [];
    const historyWindow = 40;

    // Hunt state
    let hunt = {
        delay: 0,
        delayHistory: [],
        percentileDelay: 0,
        cooldownRemaining: 0,
        wins: 0,
        losses: 0,
    };

    // DH state
    let dh = {
        delay: 0,
        active: false,
        betsInSeq: 0,
        wins: 0,
        losses: 0,
    };

    // Flat state
    let flat = {
        counter: 0,
        pauseRemaining: 0,
        wins: 0,
        losses: 0,
    };

    // Low state
    let low = {
        delay: 0,
        active: false,
        betsInSeq: 0,
        wins: 0,
        losses: 0,
    };

    let totalBets = 0;
    let totalWins = 0;
    let maxDrawdown = 0;
    let peakBalance = balance;
    let gamesPlayed = 0;

    function calculatePercentile(arr, percentile) {
        if (arr.length === 0) return 0;
        const sorted = [...arr].sort((a, b) => a - b);
        const index = Math.ceil((percentile / 100) * sorted.length) - 1;
        return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
    }

    function calculateMedian(arr) {
        if (arr.length === 0) return 0;
        const sorted = [...arr].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    }

    function getBet(percent) {
        return Math.max(100, Math.floor(initBalance * percent / 100 / 100) * 100);
    }

    for (let i = 0; i < crashes.length; i++) {
        const crash = crashes[i];
        gamesPlayed++;

        // Check stop conditions
        const profit = balance - initBalance;
        const profitPct = profit / initBalance * 100;

        if (!profitLockActive && profitPct >= profitLockThreshold) {
            profitLockActive = true;
            floorBalance = initBalance + initBalance * profitLockFloor / 100;
        }

        if (profit >= targetProfit) break;
        if (profitLockActive && balance <= floorBalance) break;
        if (profit <= -stopLoss) break;

        // Cooldowns
        if (hunt.cooldownRemaining > 0) hunt.cooldownRemaining--;
        if (flat.pauseRemaining > 0) flat.pauseRemaining--;

        // Skip scout phase
        if (i < 10) {
            // Still update history
            crashHistory.push(crash);
            if (crashHistory.length > historyWindow) crashHistory.shift();
            if (crash >= huntBasePayout) { hunt.delay = 0; } else { hunt.delay++; }
            if (crash >= delayHunterPayout) { dh.delay = 0; } else { dh.delay++; }
            if (crash >= lowHunterPayout) { low.delay = 0; } else { low.delay++; }
            continue;
        }

        let bet = 0;
        let payout = 0;
        let betType = null;

        // 1. Delay Hunter @10x (check BEFORE updating delay)
        if (!bet) {
            if (dh.active || dh.delay >= delayHunterEntry) {
                if (!dh.active) {
                    dh.active = true;
                    dh.betsInSeq = 0;
                }
                if (dh.betsInSeq < delayHunterMaxBets) {
                    bet = getBet(delayHunterBetPercent);
                    payout = delayHunterPayout;
                    betType = 'dh';
                    dh.betsInSeq++;
                }
            }
        }

        // 2. Hunt @1.8x
        if (!bet && hunt.cooldownRemaining === 0 && hunt.delayHistory.length >= 5 && crashHistory.length >= 12) {
            const threshold = Math.max(huntMinDelay, hunt.percentileDelay);
            if (hunt.delay >= threshold) {
                const recent = crashHistory.slice(-6);
                const noHighCrash = !recent.some(c => c > 8);
                const lowMedian = calculateMedian(recent) < 2.0;
                const last3Low = crashHistory.slice(-3).filter(c => c < huntBasePayout).length >= 2;

                if (noHighCrash && lowMedian && last3Low) {
                    bet = getBet(huntBaseBetPercent);
                    payout = huntBasePayout;
                    betType = 'hunt';
                }
            }
        }

        // 3. Low Hunter @1.5x
        if (!bet) {
            if (low.active || low.delay >= lowHunterEntry) {
                if (!low.active) {
                    low.active = true;
                    low.betsInSeq = 0;
                }
                if (low.betsInSeq < lowHunterMaxBets) {
                    bet = getBet(lowHunterBetPercent);
                    payout = lowHunterPayout;
                    betType = 'low';
                    low.betsInSeq++;
                }
            }
        }

        // 4. Flat Bet @1.8x
        if (!bet && flat.pauseRemaining === 0) {
            flat.counter++;
            if (flat.counter >= flatBetInterval) {
                flat.counter = 0;
                bet = getBet(flatBetPercent);
                payout = flatBetPayout;
                betType = 'flat';
            }
        }

        // Execute bet and check result
        if (bet > 0 && balance >= bet) {
            totalBets++;
            const won = crash >= payout;

            if (won) {
                const winAmount = Math.floor(bet * (payout - 1));
                balance += winAmount;
                totalWins++;

                if (betType === 'hunt') { hunt.wins++; }
                else if (betType === 'dh') { dh.wins++; }
                else if (betType === 'low') { low.wins++; }
                else if (betType === 'flat') { flat.wins++; flat.pauseRemaining = flatBetPauseWin; }
            } else {
                balance -= bet;

                if (betType === 'hunt') { hunt.losses++; hunt.cooldownRemaining = huntCooldown; }
                else if (betType === 'dh') { dh.losses++; }
                else if (betType === 'low') { low.losses++; }
                else if (betType === 'flat') { flat.losses++; flat.pauseRemaining = flatBetPauseLoss; }
            }
        }

        // NOW update delays and history AFTER bet resolution
        crashHistory.push(crash);
        if (crashHistory.length > historyWindow) crashHistory.shift();

        // Update Hunt delay
        if (crash >= huntBasePayout) {
            if (hunt.delay > 0) {
                hunt.delayHistory.push(hunt.delay);
                if (hunt.delayHistory.length > 30) hunt.delayHistory.shift();
            }
            hunt.delay = 0;
            if (hunt.delayHistory.length >= 5) {
                hunt.percentileDelay = calculatePercentile(hunt.delayHistory, 75);
            }
        } else {
            hunt.delay++;
        }

        // Update DH delay - reset active ONLY after processing bet
        if (crash >= delayHunterPayout) {
            dh.delay = 0;
            dh.active = false;
            dh.betsInSeq = 0;
        } else {
            dh.delay++;
            // Check max bets
            if (dh.active && dh.betsInSeq >= delayHunterMaxBets) {
                dh.active = false;
                dh.betsInSeq = 0;
            }
        }

        // Update Low delay
        if (crash >= lowHunterPayout) {
            low.delay = 0;
            low.active = false;
            low.betsInSeq = 0;
        } else {
            low.delay++;
            if (low.active && low.betsInSeq >= lowHunterMaxBets) {
                low.active = false;
                low.betsInSeq = 0;
            }
        }

        if (balance > peakBalance) peakBalance = balance;
        const dd = (peakBalance - balance) / peakBalance * 100;
        if (dd > maxDrawdown) maxDrawdown = dd;
    }

    const finalProfit = (balance - initBalance) / initBalance * 100;
    const winRate = totalBets > 0 ? totalWins / totalBets * 100 : 0;
    const freq = gamesPlayed > 0 ? totalBets / gamesPlayed * 100 : 0;

    return {
        profit: finalProfit.toFixed(2),
        wins: totalWins,
        losses: totalBets - totalWins,
        winRate: winRate.toFixed(1),
        totalBets,
        freq: freq.toFixed(2),
        maxDrawdown: maxDrawdown.toFixed(2),
        gamesPlayed,
        hunt: { wins: hunt.wins, losses: hunt.losses },
        dh: { wins: dh.wins, losses: dh.losses },
        flat: { wins: flat.wins, losses: flat.losses },
        low: { wins: low.wins, losses: low.losses },
    };
}

async function main() {
    const checkpoints = require('./hash-checkpoints-10M.js').HASH_CHECKPOINTS_10M;
    const sessionSize = 10000;
    const sampleSize = 200;

    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
    console.log('║           TEST MARTIN AI TURBO - 200 SESSIONI x 10K                       ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
    console.log('');

    const config = {
        // Default TURBO config
    };

    let totalProfit = 0;
    let totalWinRate = 0;
    let totalFreq = 0;
    let totalBets = 0;
    let positives = 0;
    let maxProfit = -Infinity;
    let minProfit = Infinity;

    let huntWins = 0, huntLosses = 0;
    let dhWins = 0, dhLosses = 0;
    let flatWins = 0, flatLosses = 0;
    let lowWins = 0, lowLosses = 0;

    console.log('   Elaborazione in corso...');
    console.log('');

    for (let i = 0; i < sampleSize; i++) {
        const hash = checkpoints[i * 50].hash;
        const crashes = generateCrashValues(hash, sessionSize);
        const result = simulateTurbo(crashes, config);

        const profit = parseFloat(result.profit);
        totalProfit += profit;
        totalWinRate += parseFloat(result.winRate);
        totalFreq += parseFloat(result.freq);
        totalBets += result.totalBets;

        if (profit > 0) positives++;
        if (profit > maxProfit) maxProfit = profit;
        if (profit < minProfit) minProfit = profit;

        huntWins += result.hunt.wins;
        huntLosses += result.hunt.losses;
        dhWins += result.dh.wins;
        dhLosses += result.dh.losses;
        flatWins += result.flat.wins;
        flatLosses += result.flat.losses;
        lowWins += result.low.wins;
        lowLosses += result.low.losses;

        if ((i + 1) % 50 === 0) {
            console.log(`   Processati ${i + 1}/${sampleSize} campioni...`);
        }
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('                            RISULTATI');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('');
    console.log(`   Sessioni testate: ${sampleSize} x ${sessionSize} partite`);
    console.log('');
    console.log(`   PROFITTO MEDIO:  ${(totalProfit/sampleSize).toFixed(3)}%`);
    console.log(`   WIN RATE MEDIO:  ${(totalWinRate/sampleSize).toFixed(1)}%`);
    console.log(`   FREQUENZA MEDIA: ${(totalFreq/sampleSize).toFixed(2)}%`);
    console.log(`   BETS MEDI:       ${(totalBets/sampleSize).toFixed(0)} per sessione`);
    console.log('');
    console.log(`   Sessioni positive: ${positives}/${sampleSize} (${(positives/sampleSize*100).toFixed(1)}%)`);
    console.log(`   Miglior sessione: +${maxProfit.toFixed(2)}%`);
    console.log(`   Peggior sessione: ${minProfit.toFixed(2)}%`);
    console.log('');
    console.log('   Dettaglio per strategia:');

    const huntTotal = huntWins + huntLosses;
    const dhTotal = dhWins + dhLosses;
    const flatTotal = flatWins + flatLosses;
    const lowTotal = lowWins + lowLosses;

    console.log(`   HUNT @1.8x:  ${huntTotal} bets | ${huntTotal > 0 ? (huntWins/huntTotal*100).toFixed(1) : 0}% WR | ${(huntTotal/sampleSize).toFixed(0)} avg/sess`);
    console.log(`   DH @10x:     ${dhTotal} bets | ${dhTotal > 0 ? (dhWins/dhTotal*100).toFixed(1) : 0}% WR | ${(dhTotal/sampleSize).toFixed(0)} avg/sess`);
    console.log(`   FLAT @1.5x:  ${flatTotal} bets | ${flatTotal > 0 ? (flatWins/flatTotal*100).toFixed(1) : 0}% WR | ${(flatTotal/sampleSize).toFixed(0)} avg/sess`);
    console.log(`   LOW @1.3x:   ${lowTotal} bets | ${lowTotal > 0 ? (lowWins/lowTotal*100).toFixed(1) : 0}% WR | ${(lowTotal/sampleSize).toFixed(0)} avg/sess`);

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════');

    // Confronto con versioni precedenti
    console.log('');
    console.log('   CONFRONTO VERSIONI:');
    console.log('   ─────────────────────────────────────────────────────────────');
    console.log('   READY:    11 bet/10K  | +0.04% profit | 50.44% WR');
    console.log('   PLUS:    126 bet/10K  | +0.11% profit | 49.59% WR');
    console.log(`   TURBO:   ${(totalBets/sampleSize).toFixed(0)} bet/10K  | ${(totalProfit/sampleSize).toFixed(3)}% profit | ${(totalWinRate/sampleSize).toFixed(1)}% WR`);
    console.log('');
}

main().catch(console.error);
