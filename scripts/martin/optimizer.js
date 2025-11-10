/**
 * 🔬 MARTIN AI v4 - PARAMETER OPTIMIZER
 *
 * Simula migliaia di sessioni per trovare i parametri ottimali
 * che minimizzano le perdite e massimizzano la probabilità di successo
 */

// ===== CONFIGURAZIONE SIMULAZIONE =====
const SIMULATIONS_PER_CONFIG = 1000;  // Simulazioni per ogni configurazione
const MAX_ROUNDS_PER_SIM = 10000;     // Max round per simulazione (evita loop infiniti)
const WORKING_BALANCE = 2000000;      // 20,000 bits (fisso)

// ===== PARAMETRI FISSI (Non ottimizzabili) =====
const NORMAL_PAYOUT = 3.0;
const NORMAL_BASE_BET = 100;
const NORMAL_MULT = 1.50;
const TARGET_PROFIT_PERCENT = 20;

// ===== PARAMETRI DA OTTIMIZZARE =====
const PARAM_GRID = {
    recoveryTrigger: [8, 9, 10, 11, 12, 13],
    recoveryPayout: [1.2, 1.3, 1.4, 1.5, 1.6],
    recoveryPhases: [2, 3, 4, 5],
    recoveryAttemptsPerPhase: [3, 4, 5, 6, 7]
};

// ===== SIMULATORE =====
class MartinSimulator {
    constructor(config) {
        this.config = config;
        this.reset();
    }

    reset() {
        this.balance = WORKING_BALANCE;
        this.initBalance = WORKING_BALANCE;
        this.currentRound = 0;
        this.currentMode = 'normal';
        this.normalConsecutiveLosses = 0;
        this.currentRecoveryPhase = 0;
        this.phaseAttempts = 0;
        this.recoveryAttempts = 0;
        this.currentBet = NORMAL_BASE_BET;
        this.currentPayout = NORMAL_PAYOUT;
        this.balanceBeforeLossSequence = 0;
        this.bonusPerLoss = 0;
        this.normalModeProfit = 0;
        this.lossesToRecoverPerPhase = 0;
        this.totalLossesAtRecoveryStart = 0;

        // Stats
        this.disasters = 0;
        this.targetReached = false;
        this.finalProfit = 0;
        this.maxRoundsReached = false;
    }

    // Genera crash random basato su distribuzione realistica
    generateCrash() {
        // Distribuzione approssimativa di bustabit:
        // ~50% crash sotto 2x
        // ~33% crash tra 2x-10x
        // ~17% crash sopra 10x
        const rand = Math.random();

        if (rand < 0.50) {
            // 50% sotto 2x
            return 1.0 + Math.random() * 1.0; // 1.0-2.0x
        } else if (rand < 0.83) {
            // 33% tra 2x-10x
            return 2.0 + Math.random() * 8.0; // 2.0-10.0x
        } else {
            // 17% sopra 10x
            return 10.0 + Math.random() * 40.0; // 10.0-50.0x
        }
    }

    simulate() {
        this.reset();
        const targetProfitAbsolute = Math.floor(WORKING_BALANCE * (TARGET_PROFIT_PERCENT / 100));

        while (this.currentRound < MAX_ROUNDS_PER_SIM) {
            this.currentRound++;

            // Check target raggiunto
            const totalProfit = this.normalModeProfit;
            if (totalProfit >= targetProfitAbsolute) {
                this.targetReached = true;
                this.finalProfit = this.balance - this.initBalance;
                return { success: true, rounds: this.currentRound, profit: this.finalProfit };
            }

            // Calcola bet finale
            const finalBet = this.currentBet + this.bonusPerLoss;

            // Check saldo insufficiente
            if (this.balance - finalBet < 0) {
                this.disasters++;
                this.finalProfit = this.balance - this.initBalance;
                return { success: false, rounds: this.currentRound, profit: this.finalProfit, reason: 'insufficient_balance' };
            }

            // Genera crash
            const crash = this.generateCrash();

            // Check win/loss
            if (crash >= this.currentPayout) {
                // WIN
                this.handleWin(finalBet, crash);
            } else {
                // LOSS
                this.handleLoss(finalBet);
            }
        }

        // Max rounds raggiunto senza target
        this.maxRoundsReached = true;
        this.finalProfit = this.balance - this.initBalance;
        return { success: false, rounds: this.currentRound, profit: this.finalProfit, reason: 'max_rounds' };
    }

    handleWin(bet, crash) {
        const profit = Math.floor(this.currentPayout * bet) - bet;
        this.balance += profit;

        const isExactCashout = crash >= this.currentPayout;

        if (this.currentMode === 'normal') {
            if (isExactCashout) {
                // WIN normale completo
                this.normalModeProfit = this.balance - this.initBalance;
                this.normalConsecutiveLosses = 0;
                this.currentBet = NORMAL_BASE_BET;
                this.currentPayout = NORMAL_PAYOUT;
                this.bonusPerLoss = 0;
            } else {
                // Cashout parziale (non dovrebbe succedere con questo simulatore)
                this.currentBet = Math.ceil((this.currentBet / 100) * NORMAL_MULT) * 100;
            }
        } else {
            // Recovery mode
            if (isExactCashout) {
                if (this.currentRecoveryPhase < this.config.recoveryPhases) {
                    // Passa alla fase successiva
                    this.currentRecoveryPhase++;
                    this.phaseAttempts = 0;

                    const remainingLosses = this.balanceBeforeLossSequence - this.balance;
                    const remainingPhases = this.config.recoveryPhases - this.currentRecoveryPhase + 1;
                    this.lossesToRecoverPerPhase = Math.ceil(remainingLosses / remainingPhases);

                    this.calculateRecoveryBet();
                } else {
                    // Tutte le fasi completate
                    this.switchToNormalMode();
                }
            }
        }
    }

    handleLoss(bet) {
        this.balance -= bet;

        if (this.currentMode === 'normal') {
            // Prima perdita della sequenza
            if (this.normalConsecutiveLosses === 0) {
                this.balanceBeforeLossSequence = this.balance + bet;
            }

            this.normalConsecutiveLosses++;

            // Bonus solo prime 3 perdite
            if (this.normalConsecutiveLosses <= 3) {
                this.bonusPerLoss += 100;
            }

            // Check switch to recovery
            if (this.normalConsecutiveLosses >= this.config.recoveryTrigger) {
                this.switchToRecoveryMode();
            } else {
                // Continua normale
                this.currentBet = Math.ceil((this.currentBet / 100) * NORMAL_MULT) * 100;
            }
        } else {
            // Recovery mode loss
            this.recoveryAttempts++;
            this.phaseAttempts++;

            const remainingLosses = this.balanceBeforeLossSequence - this.balance;

            // Check se passare alla fase successiva
            if (this.phaseAttempts >= this.config.recoveryAttemptsPerPhase) {
                if (this.currentRecoveryPhase < this.config.recoveryPhases) {
                    // Avanza alla fase successiva
                    this.currentRecoveryPhase++;
                    this.phaseAttempts = 0;

                    const remainingPhases = this.config.recoveryPhases - this.currentRecoveryPhase + 1;
                    this.lossesToRecoverPerPhase = Math.ceil(remainingLosses / remainingPhases);

                    this.calculateRecoveryBet();
                } else {
                    // Tutte le fasi esaurite → DISASTER
                    // Verrà gestito al prossimo round con check saldo
                    this.balance = -1; // Forza disaster
                }
            } else {
                // Continua nella fase corrente
                const remainingPhases = this.config.recoveryPhases - this.currentRecoveryPhase + 1;
                this.lossesToRecoverPerPhase = Math.ceil(remainingLosses / remainingPhases);
                this.calculateRecoveryBet();
            }
        }
    }

    switchToRecoveryMode() {
        this.currentMode = 'recovery';
        this.recoveryAttempts = 0;
        this.phaseAttempts = 0;
        this.currentPayout = this.config.recoveryPayout;

        const actualLoss = this.balanceBeforeLossSequence - this.balance;
        this.totalLossesAtRecoveryStart = actualLoss;

        this.currentRecoveryPhase = 1;
        this.lossesToRecoverPerPhase = Math.ceil(this.totalLossesAtRecoveryStart / this.config.recoveryPhases);

        this.calculateRecoveryBet();
    }

    switchToNormalMode() {
        this.currentMode = 'normal';
        this.normalConsecutiveLosses = 0;
        this.recoveryAttempts = 0;
        this.phaseAttempts = 0;
        this.currentRecoveryPhase = 0;
        this.lossesToRecoverPerPhase = 0;
        this.totalLossesAtRecoveryStart = 0;
        this.currentBet = NORMAL_BASE_BET;
        this.currentPayout = NORMAL_PAYOUT;
        this.bonusPerLoss = 0;
    }

    calculateRecoveryBet() {
        const payoutMultiplier = this.config.recoveryPayout - 1.0;
        this.currentBet = Math.ceil(this.lossesToRecoverPerPhase / payoutMultiplier);
        this.currentBet = Math.ceil(this.currentBet / 100) * 100;

        // Se bet troppo alta, forza disaster
        if (this.currentBet > this.balance) {
            this.balance = -1;
        }
    }
}

// ===== OTTIMIZZATORE =====
function optimizeParameters() {
    console.log('🔬 MARTIN AI v4 - PARAMETER OPTIMIZER');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log(`📊 Configurazione:`);
    console.log(`   • Working Balance: ${(WORKING_BALANCE/100).toFixed(2)} bits`);
    console.log(`   • Target Profit: ${TARGET_PROFIT_PERCENT}%`);
    console.log(`   • Simulazioni per config: ${SIMULATIONS_PER_CONFIG}`);
    console.log('');
    console.log('⚙️  Testing parameter combinations...');
    console.log('');

    const results = [];
    let totalConfigs = 0;

    // Calcola totale configurazioni
    Object.values(PARAM_GRID).forEach(values => {
        totalConfigs = totalConfigs === 0 ? values.length : totalConfigs * values.length;
    });

    console.log(`🔢 Totale configurazioni da testare: ${totalConfigs}`);
    console.log('');

    let configCount = 0;

    // Test tutte le combinazioni
    for (const recoveryTrigger of PARAM_GRID.recoveryTrigger) {
        for (const recoveryPayout of PARAM_GRID.recoveryPayout) {
            for (const recoveryPhases of PARAM_GRID.recoveryPhases) {
                for (const recoveryAttemptsPerPhase of PARAM_GRID.recoveryAttemptsPerPhase) {
                    configCount++;

                    const config = {
                        recoveryTrigger,
                        recoveryPayout,
                        recoveryPhases,
                        recoveryAttemptsPerPhase
                    };

                    // Simula N volte
                    let successCount = 0;
                    let totalRounds = 0;
                    let totalProfit = 0;
                    let disasterCount = 0;

                    for (let i = 0; i < SIMULATIONS_PER_CONFIG; i++) {
                        const sim = new MartinSimulator(config);
                        const result = sim.simulate();

                        if (result.success) successCount++;
                        totalRounds += result.rounds;
                        totalProfit += result.profit;
                        disasterCount += sim.disasters;
                    }

                    const successRate = (successCount / SIMULATIONS_PER_CONFIG) * 100;
                    const avgRounds = totalRounds / SIMULATIONS_PER_CONFIG;
                    const avgProfit = totalProfit / SIMULATIONS_PER_CONFIG;
                    const disasterRate = (disasterCount / SIMULATIONS_PER_CONFIG) * 100;

                    results.push({
                        config,
                        successRate,
                        avgRounds,
                        avgProfit,
                        disasterRate,
                        score: calculateScore(successRate, avgProfit, disasterRate)
                    });

                    // Progress
                    if (configCount % 10 === 0) {
                        console.log(`⏳ Progress: ${configCount}/${totalConfigs} (${((configCount/totalConfigs)*100).toFixed(1)}%)`);
                    }
                }
            }
        }
    }

    console.log('');
    console.log('✅ Simulazioni completate!');
    console.log('');

    // Ordina per score
    results.sort((a, b) => b.score - a.score);

    // Mostra top 10
    console.log('🏆 TOP 10 CONFIGURAZIONI:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    for (let i = 0; i < Math.min(10, results.length); i++) {
        const r = results[i];
        console.log(`${i + 1}. SCORE: ${r.score.toFixed(2)}`);
        console.log(`   Config:`);
        console.log(`     • Recovery Trigger: ${r.config.recoveryTrigger} losses`);
        console.log(`     • Recovery Payout: ${r.config.recoveryPayout}x`);
        console.log(`     • Recovery Phases: ${r.config.recoveryPhases}`);
        console.log(`     • Attempts per Phase: ${r.config.recoveryAttemptsPerPhase}`);
        console.log(`   Results:`);
        console.log(`     • Success Rate: ${r.successRate.toFixed(2)}%`);
        console.log(`     • Avg Profit: ${(r.avgProfit/100).toFixed(2)} bits`);
        console.log(`     • Disaster Rate: ${r.disasterRate.toFixed(2)}%`);
        console.log(`     • Avg Rounds: ${r.avgRounds.toFixed(0)}`);
        console.log('');
    }

    // Migliore configurazione
    const best = results[0];
    console.log('');
    console.log('🎯 CONFIGURAZIONE OTTIMALE RACCOMANDATA:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('```javascript');
    console.log('var config = {');
    console.log('    workingBalance: { value: 2000000, type: \'balance\', label: \'Working Balance (bits to use)\' },');
    console.log('    targetProfitPercent: { value: 20, type: \'multiplier\', label: \'Target Profit % (stop when reached)\' },');
    console.log('');
    console.log('    // ===== MODALITÀ 1 (NORMALE) =====');
    console.log('    payout: { value: 3.0, type: \'multiplier\', label: \'Normal Mode Payout\' },');
    console.log('    baseBet: { value: 100, type: \'balance\', label: \'Base Bet\' },');
    console.log('    mult: { value: 1.50, type: \'multiplier\', label: \'Multiplier after loss\' },');
    console.log('');
    console.log('    // ===== MODALITÀ 2 (RECUPERO) - OTTIMIZZATO =====');
    console.log(`    recoveryTrigger: { value: ${best.config.recoveryTrigger}, type: 'multiplier', label: 'Losses before recovery mode' },`);
    console.log(`    recoveryPayout: { value: ${best.config.recoveryPayout}, type: 'multiplier', label: 'Recovery Mode Payout' },`);
    console.log(`    recoveryPhases: { value: ${best.config.recoveryPhases}, type: 'multiplier', label: 'Number of recovery phases (divide losses)' },`);
    console.log(`    recoveryAttemptsPerPhase: { value: ${best.config.recoveryAttemptsPerPhase}, type: 'multiplier', label: 'Max attempts per phase before moving to next' },`);
    console.log('};');
    console.log('```');
    console.log('');
    console.log('📊 Performance Attese:');
    console.log(`   • Probabilità di raggiungere target: ${best.successRate.toFixed(2)}%`);
    console.log(`   • Profitto medio per sessione: ${(best.avgProfit/100).toFixed(2)} bits`);
    console.log(`   • Rischio disaster: ${best.disasterRate.toFixed(2)}%`);
    console.log(`   • Durata media sessione: ${best.avgRounds.toFixed(0)} rounds`);
    console.log('');
}

// Calcola score (più alto = migliore)
function calculateScore(successRate, avgProfit, disasterRate) {
    // Pesi:
    // - Success rate è il più importante (60%)
    // - Disaster rate è molto negativo (30%)
    // - Avg profit è bonus (10%)

    const successWeight = 0.60;
    const disasterWeight = 0.30;
    const profitWeight = 0.10;

    const successScore = successRate; // 0-100
    const disasterScore = 100 - disasterRate; // 0-100 (invertito)
    const profitScore = Math.max(0, Math.min(100, (avgProfit / (WORKING_BALANCE * 0.20)) * 100)); // normalizzato

    return (successScore * successWeight) + (disasterScore * disasterWeight) + (profitScore * profitWeight);
}

// ===== RUN =====
optimizeParameters();
