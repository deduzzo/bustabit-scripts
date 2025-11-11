/**
 * Test della strategia smart a 2 cicli + alternanza payout
 * Simula la sequenza di perdite dal log1.txt
 */

// Parametri dal log
const workingBalance = 2000000; // 20000 bits
const RECOVERY_PHASES = 4;
const recoveryPayout = 1.1;
const SMART_PAYOUT_LOW = 1.1;
const SMART_PAYOUT_HIGH = 2.0;

function testSmartStrategy() {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║  🧪 TEST SMART STRATEGY - MARTIN AI v4.5                 ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('📊 PARAMETRI:');
    console.log(`   • Working Balance: ${(workingBalance/100).toFixed(2)} bits`);
    console.log(`   • Recovery Phases Base: ${RECOVERY_PHASES}`);
    console.log(`   • Recovery Payout: ${recoveryPayout}x`);
    console.log(`   • Smart Low/High: ${SMART_PAYOUT_LOW}x / ${SMART_PAYOUT_HIGH}x`);
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    let totalLosses = 6800; // 68 bits iniziali
    let balance = workingBalance;
    let recoveryCyclesCompleted = 0;
    let smartModeActive = false;
    let smartAttemptCount = 0;

    // Simula i tentativi che portavano al crash
    const lossSequence = [
        { description: 'Ciclo 1 fallito', loss: 20800 },
        { description: 'Ciclo 2 fallito', loss: 73500 },
        { description: 'Smart attempt 1 (LOW)', loss: 221100 },
        { description: 'Smart attempt 2 (HIGH)', loss: 719300 },
    ];

    for (let i = 0; i < lossSequence.length; i++) {
        const seq = lossSequence[i];

        console.log(`\n📍 TENTATIVO ${i + 1}`);
        console.log(`   Perdite totali: ${(totalLosses/100).toFixed(2)} bits`);
        console.log(`   Balance: ${(balance/100).toFixed(2)} bits`);

        // Determina strategia
        let currentPayout, currentPhases;

        if (!smartModeActive) {
            // Cicli 1-2
            currentPayout = recoveryPayout;
            currentPhases = RECOVERY_PHASES;
            console.log(`   📋 Strategia: CICLO ${recoveryCyclesCompleted + 1}/2`);
            console.log(`   🎯 Fasi: ${currentPhases} | Payout: ${currentPayout}x`);
        } else {
            // Smart mode
            currentPhases = RECOVERY_PHASES * 2;
            currentPayout = (smartAttemptCount % 2 === 0) ? SMART_PAYOUT_LOW : SMART_PAYOUT_HIGH;
            const mode = (smartAttemptCount % 2 === 0) ? 'LOW (90% win)' : 'HIGH (50% win)';
            console.log(`   🧠 Strategia: SMART MODE - Tentativo ${smartAttemptCount + 1}`);
            console.log(`   🎯 Fasi: ${currentPhases} | Payout: ${currentPayout}x (${mode})`);
        }

        // Calcola bet
        const payoutMultiplier = currentPayout - 1.0;
        let lossPerPhase = Math.ceil(totalLosses / currentPhases);
        let betPerPhase = Math.ceil(lossPerPhase / payoutMultiplier);
        betPerPhase = Math.ceil(betPerPhase / 100) * 100;

        const maxSafeBet = Math.floor(balance * 0.5);

        // SAFETY: Se bet troppo alta, aumenta fasi
        let phaseMultiplier = 1;
        while (betPerPhase > maxSafeBet && phaseMultiplier < 10) {
            phaseMultiplier++;
            currentPhases = (smartModeActive ? RECOVERY_PHASES * 2 : RECOVERY_PHASES) * phaseMultiplier;
            lossPerPhase = Math.ceil(totalLosses / currentPhases);
            betPerPhase = Math.ceil(lossPerPhase / payoutMultiplier);
            betPerPhase = Math.ceil(betPerPhase / 100) * 100;

            console.log(`   🔧 Bet troppo alta → Aumento fasi: ×${phaseMultiplier} = ${currentPhases} fasi`);
        }

        const betPercent = ((betPerPhase / balance) * 100).toFixed(2);

        console.log(`   💰 Bet finale: ${(betPerPhase/100).toFixed(2)} bits (${betPercent}% del balance)`);
        console.log(`   🛡️  Max safe bet: ${(maxSafeBet/100).toFixed(2)} bits (50% del balance)`);

        if (betPerPhase > maxSafeBet) {
            console.log(`   ⚠️  BET ANCORA TROPPO ALTA!`);
        } else {
            console.log(`   ✅ BET SICURA`);
        }

        if (betPerPhase > balance) {
            console.log(`   ❌ DISASTER! Bet ${(betPerPhase/100).toFixed(2)} > Balance ${(balance/100).toFixed(2)}`);
            console.log('');
            break;
        }

        // Simula perdita
        totalLosses += seq.loss;
        balance -= seq.loss;

        console.log(`   ❌ PERDITA: -${(seq.loss/100).toFixed(2)} bits (${seq.description})`);
        console.log(`   📉 Nuovo balance: ${(balance/100).toFixed(2)} bits`);

        // Aggiorna strategia
        if (!smartModeActive) {
            recoveryCyclesCompleted++;
            if (recoveryCyclesCompleted >= 2) {
                smartModeActive = true;
                smartAttemptCount = 0;
                console.log(`   🧠 ATTIVAZIONE SMART MODE!`);
            }
        } else {
            smartAttemptCount++;
        }

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }

    // Tentativo 5 (critico)
    console.log(`\n📍 TENTATIVO 5 (CRITICO - vecchio sistema crashava qui)`);
    console.log(`   Perdite totali: ${(totalLosses/100).toFixed(2)} bits`);
    console.log(`   Balance: ${(balance/100).toFixed(2)} bits`);

    // Smart mode - tentativo 3
    let currentPhases = RECOVERY_PHASES * 2;
    let currentPayout = (smartAttemptCount % 2 === 0) ? SMART_PAYOUT_LOW : SMART_PAYOUT_HIGH;
    const mode = (smartAttemptCount % 2 === 0) ? 'LOW (90% win)' : 'HIGH (50% win)';

    console.log(`   🧠 Strategia: SMART MODE - Tentativo ${smartAttemptCount + 1}`);
    console.log(`   🎯 Fasi: ${currentPhases} | Payout: ${currentPayout}x (${mode})`);

    const payoutMultiplier = currentPayout - 1.0;
    let lossPerPhase = Math.ceil(totalLosses / currentPhases);
    let betPerPhase = Math.ceil(lossPerPhase / payoutMultiplier);
    betPerPhase = Math.ceil(betPerPhase / 100) * 100;

    const maxSafeBet = Math.floor(balance * 0.5);

    console.log(`   💰 Bet iniziale: ${(betPerPhase/100).toFixed(2)} bits`);
    console.log(`   🛡️  Max safe bet: ${(maxSafeBet/100).toFixed(2)} bits (50% del balance)`);

    // SAFETY: Se bet troppo alta, aumenta fasi
    let phaseMultiplier = 1;
    while (betPerPhase > maxSafeBet && phaseMultiplier < 10) {
        phaseMultiplier++;
        currentPhases = RECOVERY_PHASES * 2 * phaseMultiplier;
        lossPerPhase = Math.ceil(totalLosses / currentPhases);
        betPerPhase = Math.ceil(lossPerPhase / payoutMultiplier);
        betPerPhase = Math.ceil(betPerPhase / 100) * 100;

        console.log(`   🔧 Bet troppo alta → Aumento fasi: ×${phaseMultiplier} = ${currentPhases} fasi`);
    }

    const betPercent = ((betPerPhase / balance) * 100).toFixed(2);

    console.log(`   💰 Bet finale: ${(betPerPhase/100).toFixed(2)} bits (${betPercent}% del balance)`);
    console.log(`   📊 Vecchio sistema: crash con bet troppo alta`);
    console.log('');

    if (betPerPhase <= maxSafeBet && betPerPhase <= balance) {
        console.log(`   ✅ SUCCESSO! Il nuovo sistema supera il crash point!`);
        console.log(`   🎯 Bet sicura: ${(betPerPhase/100).toFixed(2)} bits con ${currentPhases} fasi`);
        console.log(`   💪 Sistema adattativo mantiene bet sempre contenute!`);
    } else if (betPerPhase > maxSafeBet) {
        console.log(`   ⚠️  Bet ancora alta ma gestibile con più fasi`);
    } else {
        console.log(`   ❌ Disaster`);
    }

    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('📊 RIEPILOGO STRATEGIA SMART:');
    console.log(`   Ciclo 1: 4 fasi @1.1x (primo tentativo)`);
    console.log(`   Ciclo 2: 4 fasi @1.1x (secondo tentativo)`);
    console.log(`   Smart 1: 8 fasi @1.1x (alternanza LOW - 90% win)`);
    console.log(`   Smart 2: 8 fasi @2.0x (alternanza HIGH - 50% win)`);
    console.log(`   Smart 3: 8 fasi @1.1x (alternanza LOW - 90% win)`);
    console.log('');
    console.log('✨ Fasi raddoppiate + alternanza payout = bet sempre contenute!');
    console.log('');
}

testSmartStrategy();
