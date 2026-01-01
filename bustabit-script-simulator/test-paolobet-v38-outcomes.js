/**
 * ANALISI ESITI SESSIONI PAOLOBET v3.8
 *
 * Mostra chiaramente:
 * - Quante sessioni raggiungono il target +50%
 * - Quante sessioni vanno in bust
 * - Distribuzione dei risultati
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
    return Math.max(1, Math.floor(X) / 100);
}

function generateGameResults(startHash, amount) {
    let currentHash = hexToBytes(startHash);
    const saltBytes = Buffer.from(GAME_SALT, 'utf8');
    const results = [];
    for (let i = 0; i < amount; i++) {
        results.push(gameResult(saltBytes, currentHash));
        currentHash = sha256(currentHash);
    }
    return results;
}

function simulate(config) {
    const {
        startingBalance, games, takeProfit = 50, betPercent = 0.6, mult = 1.5,
        normalBetsConfig = 15, timesToChange = 8, multFactor = 2,
        enableProtection = true, maxDelay10x = 20, maxDelay5x = 10,
        maxColdStreak = 6, resumeWaitGames = 7, maxBetMultiple = 16, maxBetsConfig = 400
    } = config;

    const startBalance = startingBalance;
    const targetProfit = Math.floor(startBalance * (takeProfit / 100));
    let calculatedBet = Math.floor(startBalance * (betPercent / 100));
    calculatedBet = Math.max(100, Math.floor(calculatedBet / 100) * 100);

    let balance = startBalance, currentMult = mult, baseBet = calculatedBet;
    let normalBets = normalBetsConfig, failBets = 0, maxBets = maxBetsConfig;
    const initMult = currentMult, initBet = baseBet;

    let delay10x = 0, delay5x = 0, coldStreak = 0;
    let isSuspended = false, signalReceived = false, waitAfterSignal = 0;
    let recentGames = [];

    let gamesPlayed = 0, betsPlaced = 0, suspendGames = 0;
    let wins = 0, losses = 0;
    let balanceATL = startBalance, x2div2Count = 0, maxBetReached = 0;

    // Esito
    let outcome = 'incomplete';  // 'target', 'bust', 'incomplete'
    let outcomeGame = 0;

    function reset() {
        currentMult = initMult; baseBet = initBet; failBets = 0;
        normalBets = normalBetsConfig; maxBets = maxBetsConfig;
    }

    function checkResume(lastBust) {
        if (lastBust >= 10) { signalReceived = true; waitAfterSignal = resumeWaitGames; return false; }
        const delaysOk = delay10x <= maxDelay10x && delay5x <= maxDelay5x && coldStreak <= maxColdStreak;
        if (signalReceived) {
            waitAfterSignal--;
            if (waitAfterSignal <= 0) {
                const count5x = recentGames.slice(-10).filter(g => g >= 5).length;
                if (count5x >= 2 && delaysOk) return true;
                if (count5x < 2) signalReceived = false;
            }
        }
        const count5x = recentGames.slice(-10).filter(g => g >= 5).length;
        if (count5x >= 3 && delaysOk) return true;
        return false;
    }

    for (let i = 0; i < games.length; i++) {
        const bust = games[i];
        gamesPlayed++;
        recentGames.push(bust);
        if (recentGames.length > 30) recentGames.shift();
        if (bust >= 10) delay10x = 0; else delay10x++;
        if (bust >= 5) delay5x = 0; else delay5x++;
        if (bust >= 3) coldStreak = 0; else coldStreak++;

        // Check TARGET raggiunto
        if (balance - startBalance >= targetProfit) {
            outcome = 'target';
            outcomeGame = i + 1;
            break;
        }

        if (isSuspended) {
            suspendGames++;
            if (checkResume(bust)) { isSuspended = false; signalReceived = false; }
            continue;
        }
        if (enableProtection && (delay10x > maxDelay10x || delay5x > maxDelay5x || coldStreak > maxColdStreak)) {
            isSuspended = true; signalReceived = false; continue;
        }
        if (maxBets <= 0) reset();

        const currentBet = Math.round(baseBet);

        // Check BUST (non possiamo più puntare)
        if (currentBet > balance) {
            outcome = 'bust';
            outcomeGame = i + 1;
            break;
        }

        if (currentBet > maxBetReached) maxBetReached = currentBet;

        balance -= currentBet;
        betsPlaced++;

        if (currentMult <= bust) {
            balance += currentBet * currentMult;
            wins++;
            reset();
        } else {
            losses++;
            if (normalBets > 0) { currentMult++; normalBets--; }
            else {
                failBets++;
                if (failBets % timesToChange === 0) {
                    const newBet = baseBet * multFactor;
                    const maxBet = initBet * maxBetMultiple;
                    if (newBet > maxBet) currentMult++;
                    else { currentMult = currentMult / multFactor + 1; baseBet = newBet; x2div2Count++; }
                } else currentMult++;
            }
            maxBets--;
        }
        if (balance < balanceATL) balanceATL = balance;
    }

    return {
        outcome,
        outcomeGame,
        profitPercent: ((balance - startBalance) / startBalance) * 100,
        finalBalance: balance,
        betsPlaced,
        wins,
        losses,
        maxDrawdown: ((balanceATL - startBalance) / startBalance) * 100,
        x2div2Count,
        maxBetReached
    };
}

const HASH_CHECKPOINTS_10M = require('./hash-checkpoints-10M.js').HASH_CHECKPOINTS_10M;

async function main() {
    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
    console.log('║          ANALISI ESITI SESSIONI PAOLOBET v3.8                            ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
    console.log('');

    const NUM_SESSIONS = 1000;
    const GAMES_PER_SESSION = 3000;
    const STARTING_BALANCE = 100000;  // 1000 bits

    console.log('📊 CONFIGURAZIONE:');
    console.log('   Sessioni:         ' + NUM_SESSIONS);
    console.log('   Partite/sessione: ' + GAMES_PER_SESSION);
    console.log('   Balance iniziale: ' + (STARTING_BALANCE/100) + ' bits');
    console.log('   Target:           +50% (' + (STARTING_BALANCE * 0.5 / 100) + ' bits profitto)');
    console.log('');

    console.log('🔄 Generazione partite...');
    const allGames = [];
    for (let i = 0; i < NUM_SESSIONS; i++) {
        allGames.push(generateGameResults(HASH_CHECKPOINTS_10M[i % HASH_CHECKPOINTS_10M.length].hash, GAMES_PER_SESSION));
    }
    console.log('   ✓ Pronto');
    console.log('');

    // Configurazioni da testare
    const configs = [
        { name: 'ORIGINALE (n15)', normalBetsConfig: 15, timesToChange: 8, maxDelay10x: 20, maxDelay5x: 10, maxColdStreak: 6 },
        { name: 'OTTIMALE (n22)', normalBetsConfig: 22, timesToChange: 8, maxDelay10x: 20, maxDelay5x: 10, maxColdStreak: 6 },
        { name: 'n22 prot aggr', normalBetsConfig: 22, timesToChange: 8, maxDelay10x: 15, maxDelay5x: 8, maxColdStreak: 5 },
        { name: 'SENZA PROT', normalBetsConfig: 22, timesToChange: 8, enableProtection: false },
    ];

    for (const config of configs) {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('   CONFIG: ' + config.name);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('');

        const sessionResults = [];
        for (let i = 0; i < NUM_SESSIONS; i++) {
            sessionResults.push(simulate({
                startingBalance: STARTING_BALANCE,
                games: allGames[i],
                takeProfit: 50,
                betPercent: 0.6,
                mult: 1.5,
                enableProtection: config.enableProtection !== false,
                ...config
            }));
        }

        // Conta esiti
        const targets = sessionResults.filter(r => r.outcome === 'target');
        const busts = sessionResults.filter(r => r.outcome === 'bust');
        const incomplete = sessionResults.filter(r => r.outcome === 'incomplete');

        console.log('   📊 ESITI SU ' + NUM_SESSIONS + ' SESSIONI:');
        console.log('');
        console.log('   ┌─────────────────────────────────────────────────────────────┐');
        console.log('   │  🎯 TARGET RAGGIUNTO (+50%):  ' + String(targets.length).padStart(4) + ' sessioni (' + (targets.length / NUM_SESSIONS * 100).toFixed(1) + '%)     │');
        console.log('   │  💀 BUST (perso tutto):       ' + String(busts.length).padStart(4) + ' sessioni (' + (busts.length / NUM_SESSIONS * 100).toFixed(1) + '%)     │');
        console.log('   │  ⏳ INCOMPLETE (tempo finito): ' + String(incomplete.length).padStart(4) + ' sessioni (' + (incomplete.length / NUM_SESSIONS * 100).toFixed(1) + '%)     │');
        console.log('   └─────────────────────────────────────────────────────────────┘');
        console.log('');

        // Dettagli target
        if (targets.length > 0) {
            const avgTargetGame = targets.reduce((a, r) => a + r.outcomeGame, 0) / targets.length;
            const minTargetGame = Math.min(...targets.map(r => r.outcomeGame));
            const maxTargetGame = Math.max(...targets.map(r => r.outcomeGame));

            console.log('   🎯 Dettaglio TARGET:');
            console.log('      Partita media per +50%: ' + avgTargetGame.toFixed(0));
            console.log('      Più veloce:             ' + minTargetGame);
            console.log('      Più lento:              ' + maxTargetGame);
        }

        // Dettagli bust
        if (busts.length > 0) {
            const avgBustGame = busts.reduce((a, r) => a + r.outcomeGame, 0) / busts.length;
            const avgBustDrawdown = busts.reduce((a, r) => a + r.maxDrawdown, 0) / busts.length;

            console.log('');
            console.log('   💀 Dettaglio BUST:');
            console.log('      Partita media bust:  ' + avgBustGame.toFixed(0));
            console.log('      Drawdown medio:      ' + avgBustDrawdown.toFixed(0) + '%');
        }

        // Dettaglio incomplete
        if (incomplete.length > 0) {
            const avgIncompleteProfit = incomplete.reduce((a, r) => a + r.profitPercent, 0) / incomplete.length;
            const positiveIncomplete = incomplete.filter(r => r.profitPercent > 0).length;
            const negativeIncomplete = incomplete.filter(r => r.profitPercent < 0).length;

            console.log('');
            console.log('   ⏳ Dettaglio INCOMPLETE:');
            console.log('      Profitto medio:      ' + (avgIncompleteProfit >= 0 ? '+' : '') + avgIncompleteProfit.toFixed(1) + '%');
            console.log('      In positivo:         ' + positiveIncomplete + ' (' + (positiveIncomplete / incomplete.length * 100).toFixed(0) + '%)');
            console.log('      In negativo:         ' + negativeIncomplete + ' (' + (negativeIncomplete / incomplete.length * 100).toFixed(0) + '%)');
        }

        // Statistiche generali
        const avgProfit = sessionResults.reduce((a, r) => a + r.profitPercent, 0) / sessionResults.length;
        const avgX2div2 = sessionResults.reduce((a, r) => a + r.x2div2Count, 0) / sessionResults.length;
        const avgMaxBet = sessionResults.reduce((a, r) => a + r.maxBetReached, 0) / sessionResults.length;

        console.log('');
        console.log('   📈 STATISTICHE GENERALI:');
        console.log('      EV (profitto medio):   ' + (avgProfit >= 0 ? '+' : '') + avgProfit.toFixed(2) + '%');
        console.log('      x2÷2 medio/sessione:   ' + avgX2div2.toFixed(1));
        console.log('      Max bet medio:         ' + (avgMaxBet/100).toFixed(0) + ' bits');

        // Rapporto vittorie/bust
        const ratio = busts.length > 0 ? (targets.length / busts.length).toFixed(1) : '∞';
        console.log('');
        console.log('   ⚖️ RAPPORTO TARGET/BUST: ' + ratio + ':1');
        console.log('      Per ogni bust, ' + ratio + ' sessioni raggiungono il target');

        console.log('');
    }

    // Distribuzione profitti per la config ottimale
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('           DISTRIBUZIONE PROFITTI (config OTTIMALE n22)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    const optimalResults = [];
    for (let i = 0; i < NUM_SESSIONS; i++) {
        optimalResults.push(simulate({
            startingBalance: STARTING_BALANCE,
            games: allGames[i],
            takeProfit: 50,
            betPercent: 0.6,
            mult: 1.5,
            normalBetsConfig: 22,
            timesToChange: 8,
            enableProtection: true,
            maxDelay10x: 20,
            maxDelay5x: 10,
            maxColdStreak: 6
        }));
    }

    // Histogram
    const buckets = {};
    for (const r of optimalResults) {
        const bucket = Math.floor(r.profitPercent / 10) * 10;
        buckets[bucket] = (buckets[bucket] || 0) + 1;
    }

    const sortedBuckets = Object.keys(buckets).map(Number).sort((a, b) => a - b);
    const maxCount = Math.max(...Object.values(buckets));

    console.log('   Profitto %      Count    Histogram');
    console.log('   ──────────────────────────────────────────────────────────');
    for (const bucket of sortedBuckets) {
        const count = buckets[bucket];
        const bar = '█'.repeat(Math.round(count / maxCount * 40));
        const label = bucket >= 0 ? '+' + bucket + '% to +' + (bucket + 10) + '%' : bucket + '% to ' + (bucket + 10) + '%';
        console.log('   ' + label.padEnd(15) + String(count).padStart(5) + '  ' + bar);
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('');
}

main().catch(console.error);
