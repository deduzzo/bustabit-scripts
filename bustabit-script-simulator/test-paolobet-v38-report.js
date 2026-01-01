/**
 * REPORT PROFITTI PAOLOBET v3.8
 *
 * Simula 500 sessioni con 1000 bits ciascuna
 * e calcola il profitto totale.
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
        normalBetsConfig = 22, timesToChange = 8, multFactor = 2,
        enableProtection = true, maxDelay10x = 15, maxDelay5x = 8,
        maxColdStreak = 5, resumeWaitGames = 7, maxBetMultiple = 16, maxBetsConfig = 400
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

    let gamesPlayed = 0, wins = 0;
    let outcome = 'incomplete', outcomeGame = 0;

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

        if (balance - startBalance >= targetProfit) {
            outcome = 'target';
            outcomeGame = i + 1;
            break;
        }

        if (isSuspended) {
            if (checkResume(bust)) { isSuspended = false; signalReceived = false; }
            continue;
        }
        if (enableProtection && (delay10x > maxDelay10x || delay5x > maxDelay5x || coldStreak > maxColdStreak)) {
            isSuspended = true; signalReceived = false; continue;
        }
        if (maxBets <= 0) reset();

        const currentBet = Math.round(baseBet);
        if (currentBet > balance) {
            outcome = 'bust';
            outcomeGame = i + 1;
            break;
        }

        balance -= currentBet;

        if (currentMult <= bust) {
            balance += currentBet * currentMult;
            wins++;
            reset();
        } else {
            if (normalBets > 0) { currentMult++; normalBets--; }
            else {
                failBets++;
                if (failBets % timesToChange === 0) {
                    const newBet = baseBet * multFactor;
                    const maxBet = initBet * maxBetMultiple;
                    if (newBet > maxBet) currentMult++;
                    else { currentMult = currentMult / multFactor + 1; baseBet = newBet; }
                } else currentMult++;
            }
            maxBets--;
        }
    }

    return {
        outcome,
        outcomeGame,
        profit: balance - startBalance,
        profitPercent: ((balance - startBalance) / startBalance) * 100,
        finalBalance: balance,
        gamesPlayed,
        wins
    };
}

const HASH_CHECKPOINTS_10M = require('./hash-checkpoints-10M.js').HASH_CHECKPOINTS_10M;

async function main() {
    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
    console.log('║               REPORT PROFITTI PAOLOBET v3.8                              ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
    console.log('');

    const NUM_SESSIONS = 500;
    const GAMES_PER_SESSION = 5000;  // Abbastanza per completare ogni sessione
    const STARTING_BALANCE = 100000;  // 1000 bits in satoshi

    console.log('📊 CONFIGURAZIONE:');
    console.log('   ─────────────────────────────────────────────────────────────────');
    console.log('   Sessioni:           ' + NUM_SESSIONS);
    console.log('   Balance iniziale:   1000 bits per sessione');
    console.log('   Target:             +50% (+500 bits)');
    console.log('   Investimento tot:   ' + (NUM_SESSIONS * 1000) + ' bits');
    console.log('');
    console.log('   Parametri v3.8:');
    console.log('   - normalBets: 22');
    console.log('   - Protezione: 15/8/5');
    console.log('   - Formula x2÷2: mult/2+1 (corretta)');
    console.log('   ─────────────────────────────────────────────────────────────────');
    console.log('');

    console.log('🔄 Generazione partite e simulazione...');

    const results = [];
    let totalProfit = 0;
    let totalTargets = 0;
    let totalBusts = 0;
    let totalGames = 0;
    let totalWins = 0;

    for (let i = 0; i < NUM_SESSIONS; i++) {
        const games = generateGameResults(
            HASH_CHECKPOINTS_10M[i % HASH_CHECKPOINTS_10M.length].hash,
            GAMES_PER_SESSION
        );

        const result = simulate({
            startingBalance: STARTING_BALANCE,
            games: games,
            takeProfit: 50,
            betPercent: 0.6,
            mult: 1.5
        });

        results.push(result);
        totalProfit += result.profit;
        totalGames += result.gamesPlayed;
        totalWins += result.wins;

        if (result.outcome === 'target') totalTargets++;
        else if (result.outcome === 'bust') totalBusts++;

        // Progress
        if ((i + 1) % 100 === 0) {
            process.stdout.write('   ' + (i + 1) + '/' + NUM_SESSIONS + ' sessioni completate\r');
        }
    }

    console.log('   ✓ Completato                              ');
    console.log('');

    // Calcola statistiche
    const avgProfit = totalProfit / NUM_SESSIONS;
    const investimento = NUM_SESSIONS * STARTING_BALANCE;
    const roi = (totalProfit / investimento) * 100;

    // Converti in bits (dividi per 100)
    const totalProfitBits = totalProfit / 100;
    const avgProfitBits = avgProfit / 100;
    const investimentoBits = investimento / 100;

    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('                              📊 REPORT FINALE');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('');

    console.log('   ┌─────────────────────────────────────────────────────────────────────┐');
    console.log('   │                        ESITI SESSIONI                               │');
    console.log('   ├─────────────────────────────────────────────────────────────────────┤');
    console.log('   │  🎯 TARGET RAGGIUNTO (+50%):  ' + String(totalTargets).padStart(4) + ' sessioni  (' + (totalTargets/NUM_SESSIONS*100).toFixed(1) + '%)          │');
    console.log('   │  💀 BUST (perso tutto):       ' + String(totalBusts).padStart(4) + ' sessioni  (' + (totalBusts/NUM_SESSIONS*100).toFixed(1) + '%)          │');
    console.log('   └─────────────────────────────────────────────────────────────────────┘');
    console.log('');

    console.log('   ┌─────────────────────────────────────────────────────────────────────┐');
    console.log('   │                        PROFITTI IN BITS                             │');
    console.log('   ├─────────────────────────────────────────────────────────────────────┤');
    console.log('   │  💰 Investimento totale:      ' + investimentoBits.toLocaleString().padStart(10) + ' bits                    │');
    console.log('   │  📈 Profitto totale:          ' + (totalProfitBits >= 0 ? '+' : '') + totalProfitBits.toLocaleString().padStart(9) + ' bits                    │');
    console.log('   │  📊 Profitto medio/sessione:  ' + (avgProfitBits >= 0 ? '+' : '') + avgProfitBits.toFixed(1).padStart(9) + ' bits                    │');
    console.log('   │  💹 ROI:                      ' + (roi >= 0 ? '+' : '') + roi.toFixed(2).padStart(9) + '%                     │');
    console.log('   └─────────────────────────────────────────────────────────────────────┘');
    console.log('');

    // Dettaglio per esito
    const targetResults = results.filter(r => r.outcome === 'target');
    const bustResults = results.filter(r => r.outcome === 'bust');

    const targetProfit = targetResults.reduce((a, r) => a + r.profit, 0) / 100;
    const bustLoss = bustResults.reduce((a, r) => a + r.profit, 0) / 100;

    console.log('   ┌─────────────────────────────────────────────────────────────────────┐');
    console.log('   │                     DETTAGLIO PER ESITO                             │');
    console.log('   ├─────────────────────────────────────────────────────────────────────┤');
    console.log('   │  🎯 Vittorie (' + totalTargets + '×):                                                  │');
    console.log('   │     Profitto totale:  +' + targetProfit.toLocaleString().padStart(8) + ' bits  (+500 bits ciascuna)     │');
    console.log('   │                                                                     │');
    console.log('   │  💀 Bust (' + totalBusts + '×):                                                      │');
    console.log('   │     Perdita totale:   ' + bustLoss.toLocaleString().padStart(9) + ' bits  (-1000 bits ciascuna)    │');
    console.log('   │                                                                     │');
    console.log('   │  ═════════════════════════════════════════════════════════════════  │');
    console.log('   │  📊 NETTO:             ' + (totalProfitBits >= 0 ? '+' : '') + totalProfitBits.toLocaleString().padStart(8) + ' bits                          │');
    console.log('   └─────────────────────────────────────────────────────────────────────┘');
    console.log('');

    // Statistiche aggiuntive
    const avgGamesTarget = targetResults.length > 0 ?
        targetResults.reduce((a, r) => a + r.gamesPlayed, 0) / targetResults.length : 0;
    const avgGamesBust = bustResults.length > 0 ?
        bustResults.reduce((a, r) => a + r.gamesPlayed, 0) / bustResults.length : 0;

    console.log('   ┌─────────────────────────────────────────────────────────────────────┐');
    console.log('   │                     STATISTICHE AGGIUNTIVE                          │');
    console.log('   ├─────────────────────────────────────────────────────────────────────┤');
    console.log('   │  Partite medie per TARGET:     ~' + avgGamesTarget.toFixed(0).padStart(5) + ' partite                    │');
    console.log('   │  Partite medie per BUST:       ~' + avgGamesBust.toFixed(0).padStart(5) + ' partite                    │');
    console.log('   │  Rapporto Target/Bust:          ' + (totalTargets/totalBusts).toFixed(1).padStart(5) + ':1                        │');
    console.log('   │  Vincite totali (bet vinte):   ' + totalWins.toLocaleString().padStart(6) + '                            │');
    console.log('   └─────────────────────────────────────────────────────────────────────┘');
    console.log('');

    // Conclusione
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    if (totalProfitBits > 0) {
        console.log('   ✅ RISULTATO: Dopo ' + NUM_SESSIONS + ' sessioni, PROFITTO NETTO di +' + totalProfitBits.toLocaleString() + ' bits');
        console.log('      Equivalente a ' + (totalProfitBits / 1000).toFixed(1) + ' sessioni "gratis" (usando i profitti)');
    } else {
        console.log('   ❌ RISULTATO: Dopo ' + NUM_SESSIONS + ' sessioni, PERDITA NETTA di ' + totalProfitBits.toLocaleString() + ' bits');
    }
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('');
}

main().catch(console.error);
