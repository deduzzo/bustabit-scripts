/**
 * VERIFICA RECUPERO VITTORIE - PAOLOBET v3.8
 *
 * Questo test verifica che OGNI singola vittoria recuperi esattamente:
 * - Tutte le perdite precedenti nel ciclo
 * - Il profitto originale (initBet × (initMult - 1))
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

console.log('');
console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
console.log('║        VERIFICA RECUPERO VITTORIE - PAOLOBET v3.8                        ║');
console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
console.log('');

// Configurazione
const initBet = 1000;   // 10 bits in satoshi
const initMult = 1.5;
const normalBetsConfig = 15;
const timesToChange = 8;
const multFactor = 2;

const originalProfit = initBet * (initMult - 1);

console.log('📊 CONFIGURAZIONE:');
console.log('   initBet:          ' + (initBet/100) + ' bits');
console.log('   initMult:         ' + initMult + 'x');
console.log('   Profitto atteso:  ' + (originalProfit/100) + ' bits per ogni vincita');
console.log('');

// Genera partite reali
const HASH_CHECKPOINTS_10M = require('./hash-checkpoints-10M.js').HASH_CHECKPOINTS_10M;
const games = generateGameResults(HASH_CHECKPOINTS_10M[0].hash, 5000);

console.log('🎲 Partite generate: ' + games.length);
console.log('');

// Simula e traccia ogni ciclo
let balance = 100000;
let bet = initBet;
let mult = initMult;
let normalBets = normalBetsConfig;
let failBets = 0;

let cycleLosses = 0;      // Perdite accumulate nel ciclo corrente
let cycleStart = 0;       // Partita inizio ciclo
let wins = [];            // Log delle vittorie

for (let i = 0; i < games.length && wins.length < 50; i++) {
    const bust = games[i];

    // Punta
    if (bet > balance) break;
    balance -= bet;

    if (mult <= bust) {
        // VITTORIA!
        const winAmount = bet * mult;
        balance += winAmount;

        const netProfit = winAmount - bet;
        const expected = cycleLosses + originalProfit;
        const isCorrect = Math.abs(netProfit - expected) < 1;  // tolleranza 1 satoshi

        wins.push({
            game: i + 1,
            cycleStart: cycleStart + 1,
            cycleLength: i - cycleStart + 1,
            bet,
            mult,
            bust: bust.toFixed(2),
            cycleLosses,
            winAmount,
            netProfit,
            expected,
            diff: netProfit - expected,
            isCorrect
        });

        // Reset
        bet = initBet;
        mult = initMult;
        normalBets = normalBetsConfig;
        failBets = 0;
        cycleLosses = 0;
        cycleStart = i + 1;
    } else {
        // PERDITA
        cycleLosses += bet;

        if (normalBets > 0) {
            mult++;
            normalBets--;
        } else {
            failBets++;
            if (failBets % timesToChange === 0) {
                // x2÷2 v3.8
                mult = mult / multFactor + 1;
                bet = bet * multFactor;
            } else {
                mult++;
            }
        }
    }
}

// Mostra risultati
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('                         DETTAGLIO VITTORIE');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');

console.log('┌───────┬────────┬────────┬────────────┬────────────┬────────────┬─────────┐');
console.log('│ Win # │ Cycle  │ Mult   │ Bet        │ Lost       │ Net Profit │ Status  │');
console.log('│       │ Length │        │            │ in Cycle   │ vs Expect  │         │');
console.log('├───────┼────────┼────────┼────────────┼────────────┼────────────┼─────────┤');

let allCorrect = true;
let shortCycles = 0;   // cicli corti (1-5 perdite)
let mediumCycles = 0;  // cicli medi (6-22 perdite)
let longCycles = 0;    // cicli con x2÷2 (23+ perdite)

for (let i = 0; i < wins.length; i++) {
    const w = wins[i];

    const cycleLen = w.cycleLength;
    if (cycleLen <= 5) shortCycles++;
    else if (cycleLen <= 22) mediumCycles++;
    else longCycles++;

    const status = w.isCorrect ? '✓' : '✗';
    if (!w.isCorrect) allCorrect = false;

    // Mostra solo le prime 20 e le ultime 5 per brevità
    if (i < 20 || i >= wins.length - 5) {
        const diffStr = w.diff === 0 ? '±0' : (w.diff > 0 ? '+' + w.diff.toFixed(0) : w.diff.toFixed(0));
        console.log(
            '│ ' + String(i + 1).padStart(5) +
            ' │ ' + String(cycleLen).padStart(6) +
            ' │ ' + w.mult.toFixed(2).padStart(6) +
            ' │ ' + String(w.bet).padStart(10) +
            ' │ ' + String(w.cycleLosses).padStart(10) +
            ' │ ' + (w.netProfit.toFixed(0) + ' ' + diffStr).padStart(10) +
            ' │ ' + status.padStart(7) + ' │'
        );
    } else if (i === 20) {
        console.log('│  ...  │  ...   │  ...   │    ...     │    ...     │    ...     │   ...   │');
    }
}

console.log('└───────┴────────┴────────┴────────────┴────────────┴────────────┴─────────┘');
console.log('');

// Statistiche
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('                            STATISTICHE');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');

console.log('   Vittorie totali:        ' + wins.length);
console.log('   Cicli corti (1-5):      ' + shortCycles + ' (' + (shortCycles/wins.length*100).toFixed(1) + '%)');
console.log('   Cicli medi (6-22):      ' + mediumCycles + ' (' + (mediumCycles/wins.length*100).toFixed(1) + '%)');
console.log('   Cicli con x2÷2 (23+):   ' + longCycles + ' (' + (longCycles/wins.length*100).toFixed(1) + '%)');
console.log('');

// Verifica cicli con x2÷2
const x2div2Wins = wins.filter(w => w.cycleLength >= 23);
console.log('   📊 CICLI CON X2÷2 (quelli che testano la formula):');
if (x2div2Wins.length === 0) {
    console.log('      Nessun ciclo con x2÷2 in questa sessione');
} else {
    console.log('      Totale: ' + x2div2Wins.length);
    const x2div2Correct = x2div2Wins.filter(w => w.isCorrect).length;
    console.log('      Corretti: ' + x2div2Correct + '/' + x2div2Wins.length);

    // Mostra dettaglio dei cicli x2÷2
    console.log('');
    console.log('      Dettaglio cicli x2÷2:');
    for (const w of x2div2Wins.slice(0, 10)) {
        const status = w.isCorrect ? '✓' : '✗';
        console.log('      - Win #' + (wins.indexOf(w) + 1) + ': ciclo ' + w.cycleLength +
                    ' perdite, bet=' + (w.bet/100) + ', mult=' + w.mult.toFixed(2) +
                    'x, lost=' + (w.cycleLosses/100) + ', net=' + (w.netProfit/100) +
                    ' ' + status);
    }
}

console.log('');

// Risultato finale
if (allCorrect) {
    console.log('✅ ═══════════════════════════════════════════════════════════════════════════');
    console.log('   TUTTE LE ' + wins.length + ' VITTORIE HANNO RECUPERATO L\'IMPORTO CORRETTO!');
    console.log('   Profitto netto per ogni vincita = perdite ciclo + ' + (originalProfit/100) + ' bits');
    console.log('═══════════════════════════════════════════════════════════════════════════ ✅');
} else {
    const incorrect = wins.filter(w => !w.isCorrect).length;
    console.log('❌ ═══════════════════════════════════════════════════════════════════════════');
    console.log('   ' + incorrect + ' VITTORIE NON HANNO RECUPERATO L\'IMPORTO CORRETTO!');
    console.log('═══════════════════════════════════════════════════════════════════════════ ❌');

    // Mostra le vittorie errate
    console.log('');
    console.log('   Vittorie errate:');
    for (const w of wins.filter(w => !w.isCorrect)) {
        console.log('   - Win #' + (wins.indexOf(w) + 1) + ': expected ' + w.expected + ', got ' + w.netProfit + ', diff ' + w.diff);
    }
}

console.log('');
