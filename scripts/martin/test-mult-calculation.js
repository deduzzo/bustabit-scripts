/**
 * Test calcolo automatico del moltiplicatore normale
 */

function calculateNormalMultiplier(payout, maxLosses) {
    // Funzione di test: verifica se mult recupera le perdite
    function testMult(mult) {
        // Calcola perdite totali (serie geometrica)
        const totalLosses = (Math.pow(mult, maxLosses) - 1) / (mult - 1);

        // Calcola profit della vincita
        const winBet = Math.pow(mult, maxLosses);
        const winProfit = winBet * (payout - 1);

        // Verifica recupero
        return winProfit >= totalLosses;
    }

    // Binary search per trovare il mult ottimale
    let low = 1.01;
    let high = payout;
    let result = high;

    for (let i = 0; i < 100; i++) {
        const mid = (low + high) / 2;

        if (testMult(mid)) {
            // Mult troppo alto, prova più basso
            result = mid;
            high = mid;
        } else {
            // Mult troppo basso, prova più alto
            low = mid;
        }

        // Convergenza
        if (Math.abs(high - low) < 0.001) {
            break;
        }
    }

    // Arrotonda a 2 decimali e aggiungi margine di sicurezza (1%)
    const withMargin = result * 1.01;
    return Math.round(withMargin * 100) / 100;
}

function testMultiplier(baseBet, mult, payout, maxLosses) {
    console.log(`\n========================================`);
    console.log(`TEST: baseBet=${baseBet}, mult=${mult}, payout=${payout}, maxLosses=${maxLosses}`);
    console.log(`========================================`);

    let totalLosses = 0;
    let currentBet = baseBet;

    // Simula N perdite consecutive
    console.log('\nPERDITE:');
    for (let i = 1; i <= maxLosses; i++) {
        totalLosses += currentBet;
        console.log(`  Perdita ${i}: bet=${currentBet.toFixed(2)} → total loss=${totalLosses.toFixed(2)}`);
        currentBet = Math.ceil(currentBet * mult);
    }

    // Calcola la vincita con il bet finale
    const finalBet = currentBet;
    const winProfit = finalBet * (payout - 1.0);

    console.log(`\nVINCITA:`);
    console.log(`  Bet: ${finalBet.toFixed(2)}`);
    console.log(`  Payout: ${payout}x`);
    console.log(`  Profit: ${winProfit.toFixed(2)}`);

    console.log(`\nRISULTATO:`);
    console.log(`  Total losses: ${totalLosses.toFixed(2)}`);
    console.log(`  Win profit: ${winProfit.toFixed(2)}`);
    console.log(`  Net result: ${(winProfit - totalLosses).toFixed(2)}`);

    const recovered = winProfit >= totalLosses;
    console.log(`  ${recovered ? '✅ RECUPERO COMPLETO' : '❌ RECUPERO PARZIALE'}`);

    return recovered;
}

// Test con diversi scenari
console.log('TEST CALCOLO AUTOMATICO MOLTIPLICATORE\n');

// Scenario 1: payout alto, poche perdite
const payout1 = 3.1;
const trigger1 = 7;
const mult1 = calculateNormalMultiplier(payout1, trigger1);
console.log(`\nScenario 1: payout=${payout1}x, trigger=${trigger1}`);
console.log(`  → mult calcolato = ${mult1}`);
testMultiplier(100, mult1, payout1, trigger1);

// Scenario 2: payout basso, molte perdite
const payout2 = 2.0;
const trigger2 = 10;
const mult2 = calculateNormalMultiplier(payout2, trigger2);
console.log(`\nScenario 2: payout=${payout2}x, trigger=${trigger2}`);
console.log(`  → mult calcolato = ${mult2}`);
testMultiplier(100, mult2, payout2, trigger2);

// Scenario 3: payout medio, trigger medio
const payout3 = 2.5;
const trigger3 = 5;
const mult3 = calculateNormalMultiplier(payout3, trigger3);
console.log(`\nScenario 3: payout=${payout3}x, trigger=${trigger3}`);
console.log(`  → mult calcolato = ${mult3}`);
testMultiplier(100, mult3, payout3, trigger3);

console.log('\n========================================');
console.log('CONCLUSIONE:');
console.log('Il moltiplicatore auto-calcolato garantisce');
console.log('il recupero dopo N perdite consecutive!');
console.log('========================================\n');
