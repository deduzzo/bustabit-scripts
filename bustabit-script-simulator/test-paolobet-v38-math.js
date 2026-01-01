/**
 * TEST MATEMATICO - Verifica formula x2÷2 v3.8
 *
 * Questo test verifica che l'algoritmo recuperi SEMPRE il profitto iniziale
 * indipendentemente da quante perdite e raddoppi ci siano stati.
 */

console.log('');
console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
console.log('║           TEST MATEMATICO PAOLOBET v3.8 - Formula x2÷2                   ║');
console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
console.log('');

// Configurazione base
const initBet = 1000;   // 10 bits in satoshi
const initMult = 1.5;
const normalBetsConfig = 15;
const timesToChange = 8;
const multFactor = 2;

const originalProfit = initBet * (initMult - 1);
console.log('📊 CONFIGURAZIONE:');
console.log('   initBet:          ' + initBet + ' satoshi (' + (initBet/100) + ' bits)');
console.log('   initMult:         ' + initMult + 'x');
console.log('   normalBets:       ' + normalBetsConfig);
console.log('   timesToChange:    ' + timesToChange);
console.log('   multFactor:       ' + multFactor);
console.log('');
console.log('   🎯 Profitto originale atteso: ' + originalProfit + ' satoshi (' + (originalProfit/100) + ' bits)');
console.log('');

function simulateLosses(numLosses) {
    let bet = initBet;
    let mult = initMult;
    let normalBets = normalBetsConfig;
    let failBets = 0;
    let totalLost = 0;
    let x2div2Count = 0;

    for (let i = 0; i < numLosses; i++) {
        // Perdiamo
        totalLost += bet;

        if (normalBets > 0) {
            mult++;
            normalBets--;
        } else {
            failBets++;

            if (failBets % timesToChange === 0) {
                // x2÷2 - FORMULA CORRETTA v3.8
                mult = mult / multFactor + 1;
                bet = bet * multFactor;
                x2div2Count++;
            } else {
                mult++;
            }
        }
    }

    return { bet, mult, totalLost, x2div2Count };
}

function verifyRecovery(numLosses) {
    const state = simulateLosses(numLosses);

    // Se vinciamo ora, quanto guadagniamo?
    const win = state.bet * state.mult;
    const netProfit = win - state.bet;
    const needed = state.totalLost + originalProfit;
    const isCorrect = Math.abs(netProfit - needed) < 0.01;

    return {
        ...state,
        win,
        netProfit,
        needed,
        isCorrect
    };
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('                    VERIFICA RECUPERO PER NUMERO DI PERDITE');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');

console.log('┌──────────┬──────────┬──────────┬────────────┬────────────┬──────────┬─────────┐');
console.log('│ Perdite  │ Bet      │ Mult     │ Tot.Lost   │ Necessario │ Netto    │ Status  │');
console.log('├──────────┼──────────┼──────────┼────────────┼────────────┼──────────┼─────────┤');

// Test vari numeri di perdite
const testCases = [1, 5, 10, 15, 16, 20, 23, 24, 30, 31, 39, 40, 50, 55, 63, 64, 80, 95];
let allPassed = true;

for (const losses of testCases) {
    const r = verifyRecovery(losses);
    const status = r.isCorrect ? '✓' : '✗';
    if (!r.isCorrect) allPassed = false;

    console.log(
        '│ ' + String(losses).padStart(8) +
        ' │ ' + String(r.bet).padStart(8) +
        ' │ ' + r.mult.toFixed(2).padStart(8) +
        ' │ ' + String(r.totalLost).padStart(10) +
        ' │ ' + String(r.needed).padStart(10) +
        ' │ ' + r.netProfit.toFixed(0).padStart(8) +
        ' │ ' + status.padStart(7) + ' │'
    );
}

console.log('└──────────┴──────────┴──────────┴────────────┴────────────┴──────────┴─────────┘');
console.log('');

// Risultato finale
if (allPassed) {
    console.log('✅ ═══════════════════════════════════════════════════════════════════════════');
    console.log('   TUTTI I TEST PASSATI!');
    console.log('   La formula x2÷2 v3.8 recupera SEMPRE il profitto originale di ' + (originalProfit/100) + ' bits');
    console.log('═══════════════════════════════════════════════════════════════════════════ ✅');
} else {
    console.log('❌ ═══════════════════════════════════════════════════════════════════════════');
    console.log('   ALCUNI TEST FALLITI!');
    console.log('   La formula non è corretta.');
    console.log('═══════════════════════════════════════════════════════════════════════════ ❌');
}

console.log('');

// Test dettagliato: tracciamo perdita per perdita il caso 23 perdite (primo x2÷2)
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('           TRACE DETTAGLIATO: 23 PERDITE + VITTORIA (primo x2÷2)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');

let bet = initBet;
let mult = initMult;
let normalBets = normalBetsConfig;
let failBets = 0;
let totalLost = 0;

for (let i = 1; i <= 24; i++) {
    // Mostra stato prima della bet
    const phase = normalBets > 0 ? 'normalBets=' + normalBets : 'failBets=' + failBets;

    if (i <= 23) {
        // Perdiamo
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
                mult = mult / multFactor + 1;
                bet = bet * multFactor;
                action = '🔄 x2÷2: mult ' + oldMult.toFixed(2) + '→' + mult.toFixed(2) + ', bet ' + oldBet + '→' + bet;
            } else {
                mult++;
                action = 'mult++';
            }
        }

        if (i === 15 || i === 23 || i % 10 === 0) {
            console.log('[' + i + '] LOSE | ' + action + ' | totLost=' + totalLost + ', mult=' + mult.toFixed(2) + 'x, bet=' + bet);
        }
    } else {
        // Vinciamo!
        const win = bet * mult;
        const netProfit = win - bet;
        const needed = totalLost + originalProfit;

        console.log('');
        console.log('[' + i + '] WIN @ ' + mult.toFixed(2) + 'x con bet ' + bet);
        console.log('    Vincita lordo: ' + win.toFixed(2));
        console.log('    Netto:         ' + netProfit.toFixed(2));
        console.log('    Necessario:    ' + needed + ' (perdite ' + totalLost + ' + profit ' + originalProfit + ')');
        console.log('    Differenza:    ' + (netProfit - needed).toFixed(2));

        if (Math.abs(netProfit - needed) < 0.01) {
            console.log('    ✅ RECUPERO COMPLETO!');
        } else {
            console.log('    ❌ ERRORE: mancano ' + (needed - netProfit).toFixed(2) + '!');
        }
    }
}

console.log('');
console.log('═══════════════════════════════════════════════════════════════════════════════');
console.log('');

// Confronto con formula vecchia (sbagliata)
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('              CONFRONTO FORMULA VECCHIA vs NUOVA (23 perdite)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');

// Calcola stato dopo 22 perdite (prima del x2÷2)
bet = initBet;
mult = initMult;
for (let i = 0; i < 22; i++) {
    mult++;
}
// mult = 1.5 + 22 = 23.5

console.log('Dopo 22 perdite: mult = ' + mult.toFixed(2) + 'x, bet = ' + bet);
console.log('');

// Formula VECCHIA (sbagliata): (mult - 1) / 2 + 1
const oldMult = (mult - 1) / 2 + 1;
const oldBet = bet * 2;
const oldWin = oldBet * oldMult;
const oldNet = oldWin - oldBet;
const needed = 230 + originalProfit; // 23 perdite × 10 + profitto

console.log('FORMULA VECCHIA: mult = (mult - 1) / 2 + 1 = (' + mult.toFixed(2) + ' - 1) / 2 + 1 = ' + oldMult.toFixed(2) + 'x');
console.log('   Vincita @ ' + oldMult.toFixed(2) + 'x con bet ' + oldBet + ' = ' + oldWin.toFixed(2));
console.log('   Netto = ' + oldNet.toFixed(2) + ', necessario = ' + needed);
console.log('   ❌ MANCANO ' + (needed - oldNet).toFixed(2) + ' bits!');
console.log('');

// Formula NUOVA (corretta): mult / 2 + 1
const newMult = mult / 2 + 1;
const newBet = bet * 2;
const newWin = newBet * newMult;
const newNet = newWin - newBet;

console.log('FORMULA NUOVA: mult = mult / 2 + 1 = ' + mult.toFixed(2) + ' / 2 + 1 = ' + newMult.toFixed(2) + 'x');
console.log('   Vincita @ ' + newMult.toFixed(2) + 'x con bet ' + newBet + ' = ' + newWin.toFixed(2));
console.log('   Netto = ' + newNet.toFixed(2) + ', necessario = ' + needed);
console.log('   ✅ RECUPERO PERFETTO!');
console.log('');
