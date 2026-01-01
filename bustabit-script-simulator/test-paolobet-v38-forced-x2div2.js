/**
 * TEST FORZATO X2÷2 - PAOLOBET v3.8
 *
 * Questo test forza cicli lunghi con x2÷2 per verificare
 * che la formula recuperi correttamente.
 */

console.log('');
console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
console.log('║            TEST FORZATO X2÷2 - PAOLOBET v3.8                             ║');
console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
console.log('');

// Configurazione
const initBet = 1000;   // 10 bits
const initMult = 1.5;
const normalBetsConfig = 15;
const timesToChange = 8;
const multFactor = 2;

const originalProfit = initBet * (initMult - 1);

console.log('📊 CONFIGURAZIONE:');
console.log('   initBet:          ' + (initBet/100) + ' bits');
console.log('   initMult:         ' + initMult + 'x');
console.log('   normalBets:       ' + normalBetsConfig);
console.log('   timesToChange:    ' + timesToChange);
console.log('   Profitto atteso:  ' + (originalProfit/100) + ' bits');
console.log('');

/**
 * Simula N perdite e poi una vincita, verifica il recupero
 */
function testCycleWithLosses(numLosses) {
    let bet = initBet;
    let mult = initMult;
    let normalBets = normalBetsConfig;
    let failBets = 0;
    let totalLost = 0;
    let x2div2Count = 0;

    const trace = [];

    // Simula le perdite
    for (let i = 0; i < numLosses; i++) {
        totalLost += bet;

        let action = '';
        if (normalBets > 0) {
            mult++;
            normalBets--;
            action = 'mult++';
        } else {
            failBets++;
            if (failBets % timesToChange === 0) {
                const oldMult = mult;
                const oldBet = bet;
                mult = mult / multFactor + 1;  // v3.8 formula
                bet = bet * multFactor;
                x2div2Count++;
                action = 'x2÷2: ' + oldMult.toFixed(2) + '→' + mult.toFixed(2) + ', bet×' + multFactor;
            } else {
                mult++;
                action = 'mult++';
            }
        }

        if (i < 5 || i >= numLosses - 3 || (failBets > 0 && failBets % timesToChange === 0)) {
            trace.push({ loss: i + 1, action, bet, mult: mult.toFixed(2), totalLost });
        }
    }

    // Ora vinciamo al mult corrente
    const winAmount = bet * mult;
    const netProfit = winAmount - bet;
    const expected = totalLost + originalProfit;
    const diff = netProfit - expected;
    const isCorrect = Math.abs(diff) < 1;

    return {
        numLosses,
        x2div2Count,
        finalBet: bet,
        finalMult: mult,
        totalLost,
        winAmount,
        netProfit,
        expected,
        diff,
        isCorrect,
        trace
    };
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('                    TEST CICLI CON VARI NUMERI DI PERDITE');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');

// Test casi specifici
const testCases = [
    1, 5, 10, 15,           // Solo normalBets
    16, 20, 22,             // failBets ma prima di x2÷2
    23,                     // Primo x2÷2
    24, 30,                 // Dopo primo x2÷2
    31,                     // Secondo x2÷2
    39,                     // Terzo x2÷2
    47,                     // Quarto x2÷2
    55, 63, 71, 79, 87, 95  // Molti x2÷2
];

console.log('┌──────────┬────────┬──────────┬──────────┬────────────┬────────────┬──────────┬─────────┐');
console.log('│ Perdite  │ x2÷2   │ Bet      │ Mult     │ Tot.Lost   │ Atteso     │ Netto    │ Status  │');
console.log('├──────────┼────────┼──────────┼──────────┼────────────┼────────────┼──────────┼─────────┤');

let allCorrect = true;
const results = [];

for (const numLosses of testCases) {
    const r = testCycleWithLosses(numLosses);
    results.push(r);

    const status = r.isCorrect ? '✓' : '✗';
    if (!r.isCorrect) allCorrect = false;

    console.log(
        '│ ' + String(numLosses).padStart(8) +
        ' │ ' + String(r.x2div2Count).padStart(6) +
        ' │ ' + String(r.finalBet).padStart(8) +
        ' │ ' + r.finalMult.toFixed(2).padStart(8) +
        ' │ ' + String(r.totalLost).padStart(10) +
        ' │ ' + String(r.expected).padStart(10) +
        ' │ ' + r.netProfit.toFixed(0).padStart(8) +
        ' │ ' + status.padStart(7) + ' │'
    );
}

console.log('└──────────┴────────┴──────────┴──────────┴────────────┴────────────┴──────────┴─────────┘');
console.log('');

// Mostra trace dettagliato per un caso specifico (23 perdite = primo x2÷2)
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('           TRACE DETTAGLIATO: 31 PERDITE (2 x2÷2)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');

const case31 = testCycleWithLosses(31);
for (const t of case31.trace) {
    console.log('[' + String(t.loss).padStart(2) + '] ' + t.action.padEnd(40) +
                ' bet=' + String(t.bet).padStart(6) + ', mult=' + t.mult + 'x');
}

console.log('');
console.log('[WIN] @ ' + case31.finalMult.toFixed(2) + 'x con bet ' + case31.finalBet);
console.log('      Vincita lordo: ' + case31.winAmount.toFixed(2));
console.log('      Netto:         ' + case31.netProfit.toFixed(2));
console.log('      Perdite ciclo: ' + case31.totalLost);
console.log('      Atteso:        ' + case31.expected + ' (' + case31.totalLost + ' + ' + originalProfit + ')');
console.log('      Differenza:    ' + case31.diff.toFixed(2));
console.log('      Status:        ' + (case31.isCorrect ? '✓ CORRETTO' : '✗ ERRORE'));

console.log('');

// Risultato finale
if (allCorrect) {
    console.log('✅ ═══════════════════════════════════════════════════════════════════════════');
    console.log('   TUTTI I ' + testCases.length + ' CASI TEST SONO CORRETTI!');
    console.log('');
    console.log('   La formula v3.8 (mult / factor + 1) recupera SEMPRE:');
    console.log('   • Tutte le perdite del ciclo');
    console.log('   • Il profitto originale di ' + (originalProfit/100) + ' bits');
    console.log('═══════════════════════════════════════════════════════════════════════════ ✅');
} else {
    const incorrect = results.filter(r => !r.isCorrect);
    console.log('❌ ═══════════════════════════════════════════════════════════════════════════');
    console.log('   ' + incorrect.length + ' CASI NON CORRETTI!');
    console.log('═══════════════════════════════════════════════════════════════════════════ ❌');

    for (const r of incorrect) {
        console.log('');
        console.log('   Perdite: ' + r.numLosses + ', x2÷2: ' + r.x2div2Count);
        console.log('   Atteso: ' + r.expected + ', Ottenuto: ' + r.netProfit.toFixed(2));
        console.log('   Differenza: ' + r.diff.toFixed(2));
    }
}

console.log('');

// Confronto con formula vecchia
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('              CONFRONTO: FORMULA VECCHIA vs NUOVA');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');

function testCycleOldFormula(numLosses) {
    let bet = initBet;
    let mult = initMult;
    let normalBets = normalBetsConfig;
    let failBets = 0;
    let totalLost = 0;
    let x2div2Count = 0;

    for (let i = 0; i < numLosses; i++) {
        totalLost += bet;

        if (normalBets > 0) {
            mult++;
            normalBets--;
        } else {
            failBets++;
            if (failBets % timesToChange === 0) {
                mult = (mult - 1) / multFactor + 1;  // VECCHIA formula (bug)
                bet = bet * multFactor;
                x2div2Count++;
            } else {
                mult++;
            }
        }
    }

    const winAmount = bet * mult;
    const netProfit = winAmount - bet;
    const expected = totalLost + originalProfit;
    const diff = netProfit - expected;

    return { numLosses, x2div2Count, finalBet: bet, finalMult: mult, totalLost, winAmount, netProfit, expected, diff };
}

console.log('┌──────────┬────────┬─────────────────────────┬─────────────────────────┐');
console.log('│ Perdite  │ x2÷2   │ v3.7 (bug)              │ v3.8 (corretta)         │');
console.log('│          │        │ Netto vs Atteso         │ Netto vs Atteso         │');
console.log('├──────────┼────────┼─────────────────────────┼─────────────────────────┤');

for (const numLosses of [23, 31, 39, 47, 55, 63]) {
    const oldR = testCycleOldFormula(numLosses);
    const newR = testCycleWithLosses(numLosses);

    const oldStatus = Math.abs(oldR.diff) < 1 ? '✓' : '✗ ' + oldR.diff.toFixed(0);
    const newStatus = Math.abs(newR.diff) < 1 ? '✓' : '✗ ' + newR.diff.toFixed(0);

    console.log(
        '│ ' + String(numLosses).padStart(8) +
        ' │ ' + String(oldR.x2div2Count).padStart(6) +
        ' │ ' + (oldR.netProfit.toFixed(0) + ' vs ' + oldR.expected + ' ' + oldStatus).padEnd(23) +
        ' │ ' + (newR.netProfit.toFixed(0) + ' vs ' + newR.expected + ' ' + newStatus).padEnd(23) + ' │'
    );
}

console.log('└──────────┴────────┴─────────────────────────┴─────────────────────────┘');
console.log('');
console.log('   v3.7: Formula (mult-1)/factor+1 → SOTTO-RECUPERA di ' + initBet + ' satoshi per ogni x2÷2');
console.log('   v3.8: Formula mult/factor+1 → Recupera ESATTAMENTE l\'atteso');
console.log('');
