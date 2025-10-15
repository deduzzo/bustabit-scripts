/**
 * Test per verificare l'ordine corretto della sequenza
 */
const crypto = require('crypto');

function crashPointFromHash(serverSeed) {
    const hash = serverSeed;
    if (!/^[0-9a-f]{64}$/i.test(hash)) {
        throw new Error('Hash must be a 64 character hex string');
    }

    const hs = hash.substring(0, 13);
    const h = parseInt(hs, 16);
    const e = Math.pow(2, 52);

    if (h % 33 === 0) {
        return 1.00;
    }

    const crashPoint = Math.floor((100 * e - h) / (e - h)) / 100.0;
    return Math.max(1.00, crashPoint);
}

function getPreviousHash(hash) {
    return crypto
        .createHash('sha256')
        .update(hash)
        .digest('hex');
}

// Hash finale fornito dall'utente
const finalHash = '94aa062026624e59a0ace092568d5f46e21b9bf1d5173609db8645dd62bdfc44';

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║  TEST ORDINE SEQUENZA - BUSTABIT VERIFIER                  ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

console.log('Hash fornito (GAME PIÙ RECENTE):');
console.log(finalHash);
console.log('');

// Generiamo i primi 10 valori mostrando la chain
console.log('Generazione chain (dal più recente al più vecchio):\n');

let currentHash = finalHash;
const valuesWithHashes = [];

for (let i = 0; i < 10; i++) {
    const crash = crashPointFromHash(currentHash);
    valuesWithHashes.push({
        position: i,
        hash: currentHash.substring(0, 16) + '...',
        crash: crash
    });

    console.log(`Step ${i}: ${currentHash.substring(0, 16)}... → ${crash.toFixed(2)}x`);
    currentHash = getPreviousHash(currentHash);
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('🔄 ORDINE CRONOLOGICO (dal più VECCHIO al più RECENTE):\n');
console.log('Se l\'hash fornito è il game #10, allora:\n');

// Invertiamo per mostrare ordine cronologico
for (let i = valuesWithHashes.length - 1; i >= 0; i--) {
    const gameNumber = 10 - i;
    console.log(`Game #${gameNumber.toString().padStart(2)}: ${valuesWithHashes[i].crash.toFixed(2)}x`);
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('❓ QUALE ORDINE VUOI?\n');
console.log('Opzione A) Hash fornito = Game #10 (più recente)');
console.log('           Mostrare: Game #1 → Game #10\n');
console.log('Opzione B) Hash fornito = Game #1 (più vecchio)');
console.log('           Mostrare: Game #1 → Game #10\n');
