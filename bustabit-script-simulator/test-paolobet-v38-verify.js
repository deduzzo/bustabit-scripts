/**
 * VERIFICA MANUALE PAOLOBET v3.8
 *
 * Genera 10 esempi concreti con hash che puoi testare nel simulatore.
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
        maxColdStreak = 5, resumeWaitGames = 7, maxBetMultiple = 16, maxBetsConfig = 400,
        stopLoss = 30,  // Stop loss percentuale (0 = disabilitato)
        warmupGames = 15  // AGGIUNTO: Partite di osservazione iniziale
    } = config;

    const startBalance = startingBalance;
    const targetProfit = Math.floor(startBalance * (takeProfit / 100));
    const stopLossAmount = stopLoss > 0 ? Math.floor(startBalance * (stopLoss / 100)) : 0;
    let calculatedBet = Math.floor(startBalance * (betPercent / 100));
    calculatedBet = Math.max(100, Math.floor(calculatedBet / 100) * 100);

    let balance = startBalance, currentMult = mult, baseBet = calculatedBet;
    let normalBets = normalBetsConfig, failBets = 0, maxBets = maxBetsConfig;
    const initMult = currentMult, initBet = baseBet;

    let delay10x = 0, delay5x = 0, coldStreak = 0;
    let isSuspended = false, signalReceived = false, waitAfterSignal = 0;
    let recentGames = [];
    let warmupRemaining = warmupGames;  // AGGIUNTO: Contatore warmup

    let gamesPlayed = 0, betsPlaced = 0, wins = 0, losses = 0;
    let outcome = 'incomplete', outcomeGame = 0;
    let x2div2Count = 0, maxBetReached = 0;

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

        // CHECK TARGET PROFIT (sempre, anche in warmup)
        if (balance - startBalance >= targetProfit) {
            outcome = 'target';
            outcomeGame = i + 1;
            break;
        }

        // WARMUP: Solo osservazione iniziale (NO stop-loss check durante warmup!)
        if (warmupRemaining > 0) {
            warmupRemaining--;
            // Quando warmup finisce, controlla se partire sospeso
            if (warmupRemaining === 0) {
                if (enableProtection && (delay10x > maxDelay10x || delay5x > maxDelay5x || coldStreak > maxColdStreak)) {
                    isSuspended = true;
                    signalReceived = false;
                }
            }
            continue;
        }

        // Se sospeso, controlla ripresa (no stop-loss check mentre sospeso!)
        if (isSuspended) {
            if (checkResume(bust)) { isSuspended = false; signalReceived = false; }
            continue;
        }

        // CHECK STOP LOSS (solo quando sta per puntare)
        if (stopLossAmount > 0 && startBalance - balance >= stopLossAmount) {
            outcome = 'stoploss';
            outcomeGame = i + 1;
            break;
        }

        // Controlla se dobbiamo sospendere
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
    }

    return {
        outcome,
        outcomeGame,
        profit: balance - startBalance,
        profitPercent: ((balance - startBalance) / startBalance) * 100,
        finalBalance: balance,
        gamesPlayed,
        betsPlaced,
        wins,
        losses,
        x2div2Count,
        maxBetReached
    };
}

const HASH_CHECKPOINTS_10M = require('./hash-checkpoints-10M.js').HASH_CHECKPOINTS_10M;

async function main() {
    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
    console.log('║           ESEMPI VERIFICABILI - PAOLOBET v3.8 (con Stop Loss 30%)        ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
    console.log('');

    console.log('📋 PARAMETRI DA USARE NEL SIMULATORE:');
    console.log('   ─────────────────────────────────────────────────────────────────');
    console.log('   Balance iniziale:   1000 bits');
    console.log('   Take Profit:        50%');
    console.log('   Bet Percent:        0.6%');
    console.log('   Moltiplicatore:     1.5x');
    console.log('   normalBets:         22');
    console.log('   timesToChange:      8');
    console.log('   Protezione:         SI (15/8/5)');
    console.log('   Stop Loss:          30%');
    console.log('   Warmup/Osservazione: 15 partite');
    console.log('   ─────────────────────────────────────────────────────────────────');
    console.log('');

    // Trova sessioni per ogni esito
    const targetSessions = [];
    const stoplossSessions = [];
    const bustSessions = [];
    let idx = 0;

    console.log('🔍 Cercando sessioni di esempio...');

    while (targetSessions.length < 5 || stoplossSessions.length < 3 || bustSessions.length < 2) {
        const checkpoint = HASH_CHECKPOINTS_10M[idx % HASH_CHECKPOINTS_10M.length];
        const games = generateGameResults(checkpoint.hash, 5000);

        const result = simulate({
            startingBalance: 100000,
            games: games,
            takeProfit: 50,
            betPercent: 0.6,
            mult: 1.5,
            stopLoss: 30,       // Stop loss attivo
            warmupGames: 15     // Fase di osservazione iniziale
        });

        const session = {
            idx: idx,
            hash: checkpoint.hash,
            gameNumber: checkpoint.gameNumber || (idx * 1000),
            ...result
        };

        if (result.outcome === 'target' && targetSessions.length < 5) {
            targetSessions.push(session);
        } else if (result.outcome === 'stoploss' && stoplossSessions.length < 3) {
            stoplossSessions.push(session);
        } else if (result.outcome === 'bust' && bustSessions.length < 2) {
            bustSessions.push(session);
        }

        idx++;
        if (idx > 500) break;  // Safety limit
    }

    console.log('   ✓ Trovati');
    console.log('');

    // Mostra sessioni TARGET
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('                    🎯 SESSIONI CHE RAGGIUNGONO +50%');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('');

    let exampleNum = 1;
    for (const s of targetSessions) {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('ESEMPIO ' + exampleNum++ + ' - TARGET RAGGIUNTO ✅');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('');
        console.log('Hash: ' + s.hash);
        console.log('');
        console.log('RISULTATO ATTESO:');
        console.log('  Partite giocate:  ' + s.outcomeGame);
        console.log('  Bet piazzate:     ' + s.betsPlaced);
        console.log('  Vittorie:         ' + s.wins);
        console.log('  Sconfitte:        ' + s.losses);
        console.log('  x2÷2 usati:       ' + s.x2div2Count);
        console.log('  Profitto:         +' + (s.profit / 100).toFixed(2) + ' bits (+' + s.profitPercent.toFixed(1) + '%)');
        console.log('');
    }

    // Mostra sessioni STOP-LOSS
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('                    🛑 SESSIONI CHE ATTIVANO STOP-LOSS (-30%)');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('');

    for (const s of stoplossSessions) {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('ESEMPIO ' + exampleNum++ + ' - STOP-LOSS 🛑');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('');
        console.log('Hash: ' + s.hash);
        console.log('');
        console.log('RISULTATO ATTESO:');
        console.log('  Partite giocate:  ' + s.outcomeGame);
        console.log('  Bet piazzate:     ' + s.betsPlaced);
        console.log('  Vittorie:         ' + s.wins);
        console.log('  Sconfitte:        ' + s.losses);
        console.log('  x2÷2 usati:       ' + s.x2div2Count);
        console.log('  Perdita:          ' + (s.profit / 100).toFixed(2) + ' bits (' + s.profitPercent.toFixed(1) + '%)');
        console.log('');
    }

    // Mostra sessioni BUST
    if (bustSessions.length > 0) {
        console.log('═══════════════════════════════════════════════════════════════════════════════');
        console.log('                    💀 SESSIONI CHE VANNO IN BUST');
        console.log('═══════════════════════════════════════════════════════════════════════════════');
        console.log('');

        for (const s of bustSessions) {
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('ESEMPIO ' + exampleNum++ + ' - BUST ❌');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('');
            console.log('Hash: ' + s.hash);
            console.log('');
            console.log('RISULTATO ATTESO:');
            console.log('  Partite giocate:  ' + s.outcomeGame);
            console.log('  Bet piazzate:     ' + s.betsPlaced);
            console.log('  Vittorie:         ' + s.wins);
            console.log('  Sconfitte:        ' + s.losses);
            console.log('  x2÷2 usati:       ' + s.x2div2Count);
            console.log('  Perdita:          ' + (s.profit / 100).toFixed(2) + ' bits (' + s.profitPercent.toFixed(1) + '%)');
            console.log('');
        }
    }

    // Istruzioni per la verifica
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('                         📝 COME VERIFICARE');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('');
    console.log('   1. Apri il simulatore bustabit');
    console.log('   2. Inserisci uno degli hash sopra nel campo "Game Hash"');
    console.log('   3. Imposta i parametri:');
    console.log('      - Balance: 1000 bits');
    console.log('      - Take Profit: 50%');
    console.log('      - Bet Percent: 0.6%');
    console.log('      - Multiplier: 1.5x');
    console.log('      - normalBets: 22');
    console.log('      - timesToChange: 8');
    console.log('      - Protezione: SI');
    console.log('      - maxDelay10x: 15, maxDelay5x: 8, maxColdStreak: 5');
    console.log('      - Stop Loss: 30%');
    console.log('   4. Avvia la simulazione');
    console.log('   5. Verifica che il risultato corrisponda a quello indicato');
    console.log('');
    console.log('   NOTA: I numeri possono variare leggermente per arrotondamenti,');
    console.log('         ma l\'esito (target/stoploss/bust) deve essere lo stesso.');
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log('');

    // Riepilogo
    const total = targetSessions.length + stoplossSessions.length + bustSessions.length;
    console.log('📊 RIEPILOGO: ' + targetSessions.length + ' target + ' + stoplossSessions.length + ' stoploss + ' + bustSessions.length + ' bust = ' + total + ' esempi');
    console.log('');
}

main().catch(console.error);
