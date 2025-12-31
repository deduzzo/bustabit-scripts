/**
 * TEST VARIANTI TURBO - Trova la configurazione ottimale per 10% frequenza
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

function simulateTurbo(crashes, cfg) {
    const workingBalance = 1000000;
    const targetProfit = workingBalance * cfg.targetProfitPercent / 100;
    const stopLoss = workingBalance * cfg.stopLossPercent / 100;

    let balance = workingBalance;
    let initBalance = workingBalance;
    let profitLockActive = false;
    let floorBalance = 0;

    const crashHistory = [];
    const historyWindow = 40;

    let hunt = { delay: 0, delayHistory: [], percentileDelay: 0, cooldownRemaining: 0, wins: 0, losses: 0 };
    let dh = { delay: 0, active: false, betsInSeq: 0, wins: 0, losses: 0 };
    let flat = { counter: 0, pauseRemaining: 0, wins: 0, losses: 0 };
    let low = { delay: 0, active: false, betsInSeq: 0, wins: 0, losses: 0 };

    let totalBets = 0, totalWins = 0, gamesPlayed = 0, maxDrawdown = 0, peakBalance = balance;

    function calculatePercentile(arr, p) {
        if (arr.length === 0) return 0;
        const sorted = [...arr].sort((a, b) => a - b);
        const index = Math.ceil((p / 100) * sorted.length) - 1;
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

        const profit = balance - initBalance;
        const profitPct = profit / initBalance * 100;

        if (!profitLockActive && profitPct >= cfg.profitLockThreshold) {
            profitLockActive = true;
            floorBalance = initBalance + initBalance * cfg.profitLockFloor / 100;
        }

        if (profit >= targetProfit) break;
        if (profitLockActive && balance <= floorBalance) break;
        if (profit <= -stopLoss) break;

        if (hunt.cooldownRemaining > 0) hunt.cooldownRemaining--;
        if (flat.pauseRemaining > 0) flat.pauseRemaining--;

        if (i < 10) {
            crashHistory.push(crash);
            if (crashHistory.length > historyWindow) crashHistory.shift();
            if (crash >= cfg.huntBasePayout) { hunt.delay = 0; } else { hunt.delay++; }
            if (crash >= cfg.delayHunterPayout) { dh.delay = 0; } else { dh.delay++; }
            if (crash >= cfg.lowHunterPayout) { low.delay = 0; } else { low.delay++; }
            continue;
        }

        let bet = 0, payout = 0, betType = null;

        // DH @10x
        if (!bet && cfg.delayHunterEnabled) {
            if (dh.active || dh.delay >= cfg.delayHunterEntry) {
                if (!dh.active) { dh.active = true; dh.betsInSeq = 0; }
                if (dh.betsInSeq < cfg.delayHunterMaxBets) {
                    bet = getBet(cfg.delayHunterBetPercent);
                    payout = cfg.delayHunterPayout;
                    betType = 'dh';
                    dh.betsInSeq++;
                }
            }
        }

        // Hunt @1.8x
        if (!bet && cfg.huntEnabled && hunt.cooldownRemaining === 0 && hunt.delayHistory.length >= 5 && crashHistory.length >= 12) {
            const threshold = Math.max(cfg.huntMinDelay, hunt.percentileDelay);
            if (hunt.delay >= threshold) {
                const recent = crashHistory.slice(-6);
                const noHighCrash = !recent.some(c => c > 8);
                const lowMedian = calculateMedian(recent) < 2.0;
                const last3Low = crashHistory.slice(-3).filter(c => c < cfg.huntBasePayout).length >= 2;
                if (noHighCrash && lowMedian && last3Low) {
                    bet = getBet(cfg.huntBaseBetPercent);
                    payout = cfg.huntBasePayout;
                    betType = 'hunt';
                }
            }
        }

        // Low Hunter
        if (!bet && cfg.lowHunterEnabled) {
            if (low.active || low.delay >= cfg.lowHunterEntry) {
                if (!low.active) { low.active = true; low.betsInSeq = 0; }
                if (low.betsInSeq < cfg.lowHunterMaxBets) {
                    bet = getBet(cfg.lowHunterBetPercent);
                    payout = cfg.lowHunterPayout;
                    betType = 'low';
                    low.betsInSeq++;
                }
            }
        }

        // Flat Bet
        if (!bet && cfg.flatBetEnabled && flat.pauseRemaining === 0) {
            flat.counter++;
            if (flat.counter >= cfg.flatBetInterval) {
                flat.counter = 0;
                bet = getBet(cfg.flatBetPercent);
                payout = cfg.flatBetPayout;
                betType = 'flat';
            }
        }

        if (bet > 0 && balance >= bet) {
            totalBets++;
            const won = crash >= payout;

            if (won) {
                balance += Math.floor(bet * (payout - 1));
                totalWins++;
                if (betType === 'hunt') hunt.wins++;
                else if (betType === 'dh') dh.wins++;
                else if (betType === 'low') low.wins++;
                else if (betType === 'flat') { flat.wins++; flat.pauseRemaining = cfg.flatBetPauseWin; }
            } else {
                balance -= bet;
                if (betType === 'hunt') { hunt.losses++; hunt.cooldownRemaining = cfg.huntCooldown; }
                else if (betType === 'dh') dh.losses++;
                else if (betType === 'low') low.losses++;
                else if (betType === 'flat') { flat.losses++; flat.pauseRemaining = cfg.flatBetPauseLoss; }
            }
        }

        crashHistory.push(crash);
        if (crashHistory.length > historyWindow) crashHistory.shift();

        if (crash >= cfg.huntBasePayout) {
            if (hunt.delay > 0) {
                hunt.delayHistory.push(hunt.delay);
                if (hunt.delayHistory.length > 30) hunt.delayHistory.shift();
            }
            hunt.delay = 0;
            if (hunt.delayHistory.length >= 5) {
                hunt.percentileDelay = calculatePercentile(hunt.delayHistory, 75);
            }
        } else { hunt.delay++; }

        if (crash >= cfg.delayHunterPayout) {
            dh.delay = 0; dh.active = false; dh.betsInSeq = 0;
        } else {
            dh.delay++;
            if (dh.active && dh.betsInSeq >= cfg.delayHunterMaxBets) { dh.active = false; dh.betsInSeq = 0; }
        }

        if (crash >= cfg.lowHunterPayout) {
            low.delay = 0; low.active = false; low.betsInSeq = 0;
        } else {
            low.delay++;
            if (low.active && low.betsInSeq >= cfg.lowHunterMaxBets) { low.active = false; low.betsInSeq = 0; }
        }

        if (balance > peakBalance) peakBalance = balance;
        const dd = (peakBalance - balance) / peakBalance * 100;
        if (dd > maxDrawdown) maxDrawdown = dd;
    }

    const finalProfit = (balance - initBalance) / initBalance * 100;
    const winRate = totalBets > 0 ? totalWins / totalBets * 100 : 0;
    const freq = gamesPlayed > 0 ? totalBets / gamesPlayed * 100 : 0;

    return { profit: finalProfit, winRate, totalBets, freq, gamesPlayed };
}

async function main() {
    const checkpoints = require('./hash-checkpoints-10M.js').HASH_CHECKPOINTS_10M;
    const sessionSize = 10000;
    const sampleSize = 100;

    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
    console.log('║         RICERCA CONFIGURAZIONE OTTIMALE PER 10% FREQUENZA                ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
    console.log('');

    // Configurazioni da testare
    const variants = [
        {
            name: 'TURBO v1 (attuale)',
            cfg: {
                targetProfitPercent: 12, stopLossPercent: 8, profitLockThreshold: 6, profitLockFloor: 3,
                huntEnabled: true, huntBasePayout: 1.8, huntBaseBetPercent: 0.3, huntMinDelay: 6, huntCooldown: 3,
                delayHunterEnabled: true, delayHunterPayout: 10.0, delayHunterEntry: 50, delayHunterBetPercent: 0.15, delayHunterMaxBets: 25,
                flatBetEnabled: true, flatBetPayout: 1.8, flatBetPercent: 0.15, flatBetInterval: 25, flatBetPauseWin: 8, flatBetPauseLoss: 3,
                lowHunterEnabled: true, lowHunterPayout: 1.5, lowHunterBetPercent: 0.2, lowHunterEntry: 5, lowHunterMaxBets: 3
            }
        },
        {
            name: 'TURBO v2 (più flat)',
            cfg: {
                targetProfitPercent: 12, stopLossPercent: 8, profitLockThreshold: 6, profitLockFloor: 3,
                huntEnabled: true, huntBasePayout: 1.8, huntBaseBetPercent: 0.25, huntMinDelay: 6, huntCooldown: 3,
                delayHunterEnabled: true, delayHunterPayout: 10.0, delayHunterEntry: 50, delayHunterBetPercent: 0.12, delayHunterMaxBets: 25,
                flatBetEnabled: true, flatBetPayout: 1.8, flatBetPercent: 0.12, flatBetInterval: 15, flatBetPauseWin: 5, flatBetPauseLoss: 2,
                lowHunterEnabled: true, lowHunterPayout: 1.5, lowHunterBetPercent: 0.15, lowHunterEntry: 4, lowHunterMaxBets: 5
            }
        },
        {
            name: 'TURBO v3 (low aggressivo)',
            cfg: {
                targetProfitPercent: 12, stopLossPercent: 8, profitLockThreshold: 6, profitLockFloor: 3,
                huntEnabled: true, huntBasePayout: 1.8, huntBaseBetPercent: 0.25, huntMinDelay: 6, huntCooldown: 3,
                delayHunterEnabled: true, delayHunterPayout: 10.0, delayHunterEntry: 50, delayHunterBetPercent: 0.12, delayHunterMaxBets: 25,
                flatBetEnabled: true, flatBetPayout: 1.8, flatBetPercent: 0.1, flatBetInterval: 20, flatBetPauseWin: 5, flatBetPauseLoss: 2,
                lowHunterEnabled: true, lowHunterPayout: 1.3, lowHunterBetPercent: 0.15, lowHunterEntry: 3, lowHunterMaxBets: 8
            }
        },
        {
            name: 'TURBO v4 (no DH, più flat)',
            cfg: {
                targetProfitPercent: 12, stopLossPercent: 8, profitLockThreshold: 6, profitLockFloor: 3,
                huntEnabled: true, huntBasePayout: 1.8, huntBaseBetPercent: 0.3, huntMinDelay: 6, huntCooldown: 3,
                delayHunterEnabled: false, delayHunterPayout: 10.0, delayHunterEntry: 50, delayHunterBetPercent: 0.15, delayHunterMaxBets: 25,
                flatBetEnabled: true, flatBetPayout: 1.8, flatBetPercent: 0.1, flatBetInterval: 10, flatBetPauseWin: 3, flatBetPauseLoss: 1,
                lowHunterEnabled: true, lowHunterPayout: 1.5, lowHunterBetPercent: 0.15, lowHunterEntry: 4, lowHunterMaxBets: 5
            }
        },
        {
            name: 'TURBO v5 (bilanciato)',
            cfg: {
                targetProfitPercent: 12, stopLossPercent: 8, profitLockThreshold: 6, profitLockFloor: 3,
                huntEnabled: true, huntBasePayout: 1.8, huntBaseBetPercent: 0.2, huntMinDelay: 5, huntCooldown: 2,
                delayHunterEnabled: true, delayHunterPayout: 10.0, delayHunterEntry: 45, delayHunterBetPercent: 0.1, delayHunterMaxBets: 30,
                flatBetEnabled: true, flatBetPayout: 1.8, flatBetPercent: 0.08, flatBetInterval: 12, flatBetPauseWin: 4, flatBetPauseLoss: 1,
                lowHunterEnabled: true, lowHunterPayout: 1.5, lowHunterBetPercent: 0.1, lowHunterEntry: 4, lowHunterMaxBets: 6
            }
        },
        {
            name: 'TURBO v6 (ultra-freq)',
            cfg: {
                targetProfitPercent: 12, stopLossPercent: 8, profitLockThreshold: 6, profitLockFloor: 3,
                huntEnabled: true, huntBasePayout: 1.8, huntBaseBetPercent: 0.15, huntMinDelay: 5, huntCooldown: 2,
                delayHunterEnabled: true, delayHunterPayout: 10.0, delayHunterEntry: 40, delayHunterBetPercent: 0.08, delayHunterMaxBets: 35,
                flatBetEnabled: true, flatBetPayout: 1.8, flatBetPercent: 0.06, flatBetInterval: 8, flatBetPauseWin: 2, flatBetPauseLoss: 0,
                lowHunterEnabled: true, lowHunterPayout: 1.3, lowHunterBetPercent: 0.08, lowHunterEntry: 2, lowHunterMaxBets: 10
            }
        },
    ];

    console.log('Variante                      │ Profitto │ WinRate │  Freq  │ Bets/10K │ Pos%');
    console.log('──────────────────────────────┼──────────┼─────────┼────────┼──────────┼──────');

    let bestVariant = null;
    let bestScore = -Infinity;

    for (const variant of variants) {
        let totalProfit = 0;
        let totalWinRate = 0;
        let totalFreq = 0;
        let totalBets = 0;
        let positives = 0;

        for (let i = 0; i < sampleSize; i++) {
            const hash = checkpoints[i * 100].hash;
            const crashes = generateCrashValues(hash, sessionSize);
            const result = simulateTurbo(crashes, variant.cfg);

            totalProfit += result.profit;
            totalWinRate += result.winRate;
            totalFreq += result.freq;
            totalBets += result.totalBets;
            if (result.profit > 0) positives++;
        }

        const avgProfit = totalProfit / sampleSize;
        const avgWinRate = totalWinRate / sampleSize;
        const avgFreq = totalFreq / sampleSize;
        const avgBets = totalBets / sampleSize;
        const posRate = positives / sampleSize * 100;

        console.log(
            `${variant.name.padEnd(29)} │ ` +
            `${(avgProfit.toFixed(2) + '%').padStart(8)} │ ` +
            `${(avgWinRate.toFixed(1) + '%').padStart(7)} │ ` +
            `${(avgFreq.toFixed(1) + '%').padStart(6)} │ ` +
            `${avgBets.toFixed(0).padStart(8)} │ ` +
            `${(posRate.toFixed(0) + '%').padStart(5)}`
        );

        // Score: freq vicina a 10% + profit positivo
        const freqScore = -Math.abs(avgFreq - 10) * 0.5;
        const profitScore = avgProfit > 0 ? avgProfit * 2 : avgProfit;
        const score = profitScore + freqScore;

        if (score > bestScore) {
            bestScore = score;
            bestVariant = { variant, avgProfit, avgFreq, avgBets, posRate };
        }
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════');

    if (bestVariant) {
        console.log(`   MIGLIORE: ${bestVariant.variant.name}`);
        console.log(`   Profitto: ${bestVariant.avgProfit.toFixed(2)}%`);
        console.log(`   Frequenza: ${bestVariant.avgFreq.toFixed(1)}% (${bestVariant.avgBets.toFixed(0)} bets/10K)`);
        console.log(`   Sessioni positive: ${bestVariant.posRate.toFixed(0)}%`);
    }

    console.log('');
    console.log('   NOTA: Il trade-off fondamentale rimane:');
    console.log('   - Più bets = più esposizione al house edge (1%)');
    console.log('   - Freq 10% con profit > 0 è matematicamente impossibile a lungo termine');
    console.log('');
}

main().catch(console.error);
