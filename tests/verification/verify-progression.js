const mult = 1.50;
let bet = 100;
let total = 0;

console.log("Verifica progressione M1.50:");
for (let i = 0; i <= 35; i++) {
    total += bet;
    const t = `T:${i}`.padEnd(4);
    const b = `${(bet/100).toFixed(0)}`.padStart(6);
    const tot = `${(total/100).toLocaleString('de-DE')}`.padStart(10);
    console.log(`${t} - bet: ${b} - tot: ${tot}`);
    bet = Math.ceil((bet / 100) * mult) * 100;
}
