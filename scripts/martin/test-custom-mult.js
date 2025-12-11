/**
 * Test configurazione custom multiplier vs auto-calc
 */

// Simulazione config
const config1 = {
    payout: 3.1,
    customMult: 0,  // AUTO-CALC
    recoveryTrigger: 7
};

const config2 = {
    payout: 3.1,
    customMult: 1.5,  // CUSTOM
    recoveryTrigger: 7
};

function calculateNormalMultiplier(payout, maxLosses) {
    function testMult(mult) {
        const totalLosses = (Math.pow(mult, maxLosses) - 1) / (mult - 1);
        const winBet = Math.pow(mult, maxLosses);
        const winProfit = winBet * (payout - 1);
        return winProfit >= totalLosses;
    }

    let low = 1.01;
    let high = payout;
    let result = high;

    for (let i = 0; i < 100; i++) {
        const mid = (low + high) / 2;
        if (testMult(mid)) {
            result = mid;
            high = mid;
        } else {
            low = mid;
        }
        if (Math.abs(high - low) < 0.001) break;
    }

    const withMargin = result * 1.01;
    return Math.round(withMargin * 100) / 100;
}

function getMult(config) {
    return (config.customMult > 0)
        ? config.customMult
        : calculateNormalMultiplier(config.payout, config.recoveryTrigger);
}

console.log('TEST CUSTOM MULTIPLIER vs AUTO-CALC\n');
console.log('========================================');

console.log('\nCONFIG 1: customMult = 0 (AUTO-CALC)');
console.log(`  payout: ${config1.payout}x`);
console.log(`  recoveryTrigger: ${config1.recoveryTrigger}`);
const mult1 = getMult(config1);
console.log(`  → Multiplier: ${mult1}x (AUTO-CALC)`);

console.log('\nCONFIG 2: customMult = 1.5 (CUSTOM)');
console.log(`  payout: ${config2.payout}x`);
console.log(`  customMult: ${config2.customMult}x`);
const mult2 = getMult(config2);
console.log(`  → Multiplier: ${mult2}x (CUSTOM)`);

console.log('\n========================================');
console.log('RISULTATO:');
console.log(`  AUTO-CALC: ${mult1}x (ottimizzato per recupero)`);
console.log(`  CUSTOM:    ${mult2}x (valore manuale)`);
console.log('========================================\n');
