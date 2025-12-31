/**
 * Analisi dettagliata risultati test
 */
const fs = require('fs');

const filePath = process.argv[2] || '../scripts/martin/SUPER_SMART_v7_CONSERVATIVE-results.json';
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

// Best wins and worst losses
const sorted = [...data.results].sort((a, b) => b.profitPercent - a.profitPercent);
const top5 = sorted.slice(0, 5);
const bottom5 = sorted.slice(-5).reverse();

console.log('');
console.log('═══════════════════════════════════════════════════════════════════════════');
console.log('                     ANALISI DETTAGLIATA RISULTATI');
console.log('═══════════════════════════════════════════════════════════════════════════');
console.log('');

console.log('🏆 TOP 5 MIGLIORI SESSIONI:');
console.log('───────────────────────────────────────────────────────────────────────────');
top5.forEach((r, i) => {
    console.log(`   ${i+1}. Seed ${r.seed}: +${r.profitPercent.toFixed(2)}% (+${(r.profit/100).toFixed(1)} bits) - ${r.bets} bets`);
});

console.log('');
console.log('💀 TOP 5 PEGGIORI SESSIONI:');
console.log('───────────────────────────────────────────────────────────────────────────');
bottom5.forEach((r, i) => {
    console.log(`   ${i+1}. Seed ${r.seed}: ${r.profitPercent.toFixed(2)}% (${(r.profit/100).toFixed(1)} bits) - ${r.bets} bets`);
});

// Bet distribution
const betCounts = {};
data.results.forEach(r => {
    const bucket = Math.floor(r.bets / 5) * 5;
    betCounts[bucket] = (betCounts[bucket] || 0) + 1;
});

console.log('');
console.log('📊 DISTRIBUZIONE NUMERO DI BET:');
console.log('───────────────────────────────────────────────────────────────────────────');
Object.keys(betCounts).sort((a, b) => Number(a) - Number(b)).forEach(bucket => {
    const count = betCounts[bucket];
    const pct = (count / data.results.length * 100).toFixed(1);
    const bar = '█'.repeat(Math.ceil(count / data.results.length * 50));
    console.log(`   ${bucket.toString().padStart(3)}-${(Number(bucket)+4).toString().padStart(3)} bets: ${bar} ${count} (${pct}%)`);
});

// Win streak analysis
const winStreaks = data.results.map(r => r.winStreak);
const loseStreaks = data.results.map(r => r.loseStreak);
console.log('');
console.log('📈 STATISTICHE STREAK:');
console.log('───────────────────────────────────────────────────────────────────────────');
console.log(`   Max Win Streak: ${Math.max(...winStreaks)}`);
console.log(`   Avg Win Streak: ${(winStreaks.reduce((a,b) => a+b, 0) / winStreaks.length).toFixed(2)}`);
console.log(`   Max Lose Streak: ${Math.max(...loseStreaks)}`);
console.log(`   Avg Lose Streak: ${(loseStreaks.reduce((a,b) => a+b, 0) / loseStreaks.length).toFixed(2)}`);

// Sessions by outcome
const winners = data.results.filter(r => r.profitPercent > 0).length;
const losers = data.results.filter(r => r.profitPercent < 0).length;
const draws = data.results.filter(r => r.profitPercent === 0).length;

console.log('');
console.log('🎯 RIEPILOGO SESSIONI:');
console.log('───────────────────────────────────────────────────────────────────────────');
console.log(`   Totale sessioni: ${data.results.length}`);
console.log(`   Vincenti: ${winners} (${(winners/data.results.length*100).toFixed(2)}%)`);
console.log(`   Perdenti: ${losers} (${(losers/data.results.length*100).toFixed(2)}%)`);
console.log(`   Pareggi: ${draws} (${(draws/data.results.length*100).toFixed(2)}%)`);
console.log(`   Media bets/sessione: ${data.summary.avgBets.toFixed(1)}`);
console.log(`   Media games/sessione: ${data.summary.avgGames}`);
console.log(`   Efficienza bet: ${data.summary.betEfficiency.toFixed(2)}%`);

// Profit when winning vs loss when losing
const winProfits = data.results.filter(r => r.profitPercent > 0).map(r => r.profitPercent);
const lossProfits = data.results.filter(r => r.profitPercent < 0).map(r => r.profitPercent);
const avgWin = winProfits.length > 0 ? winProfits.reduce((a,b) => a+b, 0) / winProfits.length : 0;
const avgLoss = lossProfits.length > 0 ? lossProfits.reduce((a,b) => a+b, 0) / lossProfits.length : 0;

console.log('');
console.log('💰 MATEMATICA DEL VANTAGGIO:');
console.log('───────────────────────────────────────────────────────────────────────────');
console.log(`   Media guadagno quando vinci: +${avgWin.toFixed(3)}%`);
console.log(`   Media perdita quando perdi: ${avgLoss.toFixed(3)}%`);
console.log(`   Rapporto Win/Loss: ${Math.abs(avgWin/avgLoss).toFixed(3)}`);
console.log(`   Expected Value: ${(winners/data.results.length * avgWin + losers/data.results.length * avgLoss).toFixed(4)}%`);

// Capital analysis
console.log('');
console.log('💵 ANALISI CAPITALE:');
console.log('───────────────────────────────────────────────────────────────────────────');
const startBal = data.config.startingBalance / 100;
const betSize = startBal * 0.35 / 100; // 0.35% bet size
console.log(`   Capitale iniziale: ${startBal.toLocaleString()} bits`);
console.log(`   Bet size (0.35%): ${betSize.toFixed(1)} bits`);
console.log(`   Ratio Capitale/Bet: ${(startBal / betSize).toFixed(0)}x`);
console.log(`   Max Drawdown: ${data.summary.minProfit.toFixed(2)}%`);
console.log(`   Capitale necessario per 1 bet: ${(100 / 0.35).toFixed(0)} bits`);
console.log('');
