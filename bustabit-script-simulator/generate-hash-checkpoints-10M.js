/**
 * GENERATORE HASH CHECKPOINTS - 10 MILIONI DI PARTITE
 *
 * Genera un array di hash a ritroso nella catena bustabit
 * per permettere test massivi su diverse sezioni della catena.
 *
 * La catena funziona così: SHA256(hash_nuovo) = hash_vecchio
 * Quindi andando "indietro" di N partite, applichiamo SHA256 N volte.
 */

const crypto = require('crypto');
const fs = require('fs');

// Hash di partenza (il più recente)
const START_HASH = '1ba3ae00558a9e96ae2bc1ac1126fb47c46610c0b7735f58bbefcb24eba095dc';

// Configurazione
const TOTAL_GAMES = 10_000_000;     // 10 milioni di partite
const CHECKPOINT_INTERVAL = 1_000;  // Un hash ogni 1k partite
const NUM_CHECKPOINTS = TOTAL_GAMES / CHECKPOINT_INTERVAL; // 10,000 checkpoint

console.log('');
console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
console.log('║           GENERATORE HASH CHECKPOINTS - 10 MILIONI PARTITE               ║');
console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
console.log('');
console.log(`   Hash di partenza: ${START_HASH}`);
console.log(`   Partite totali:   ${TOTAL_GAMES.toLocaleString()}`);
console.log(`   Intervallo:       ${CHECKPOINT_INTERVAL.toLocaleString()} partite`);
console.log(`   Checkpoint:       ${NUM_CHECKPOINTS.toLocaleString()}`);
console.log('');
console.log('   Generazione in corso (potrebbe richiedere qualche minuto)...');
console.log('');

function sha256(hexString) {
    const buffer = Buffer.from(hexString, 'hex');
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

const startTime = Date.now();
const checkpoints = [];

// Il primo checkpoint è l'hash di partenza (game 0)
checkpoints.push({
    index: 0,
    gameOffset: 0,
    hash: START_HASH,
    description: 'Hash di partenza (più recente)'
});

let currentHash = START_HASH;
let lastProgress = 0;

for (let game = 1; game <= TOTAL_GAMES; game++) {
    // Calcola il prossimo hash nella catena (andando indietro)
    currentHash = sha256(currentHash);

    // Salva checkpoint ogni CHECKPOINT_INTERVAL partite
    if (game % CHECKPOINT_INTERVAL === 0) {
        const checkpointNum = game / CHECKPOINT_INTERVAL;
        checkpoints.push({
            index: checkpointNum,
            gameOffset: game,
            hash: currentHash,
            description: `Checkpoint ${checkpointNum} - ${game.toLocaleString()} partite indietro`
        });

        // Progress update ogni 1%
        const progress = Math.floor((game / TOTAL_GAMES) * 100);
        if (progress !== lastProgress && progress % 5 === 0) {
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            const eta = ((elapsed / progress) * (100 - progress)).toFixed(0);
            console.log(`   ${progress}% completato (${elapsed}s) - ETA: ${eta}s - Hash: ${currentHash.substring(0, 16)}...`);
            lastProgress = progress;
        }
    }
}

const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);

console.log('');
console.log(`   ✅ Completato in ${totalTime}s`);
console.log('');

// Salva i checkpoint in un file JSON
const outputData = {
    metadata: {
        startHash: START_HASH,
        totalGames: TOTAL_GAMES,
        checkpointInterval: CHECKPOINT_INTERVAL,
        numCheckpoints: checkpoints.length,
        generatedAt: new Date().toISOString(),
        generationTime: `${totalTime}s`
    },
    checkpoints: checkpoints
};

fs.writeFileSync('hash-checkpoints-10M.json', JSON.stringify(outputData, null, 2));

// Crea anche un file JS esportabile
const jsContent = `/**
 * HASH CHECKPOINTS - 10 Milioni di Partite
 *
 * Generato da: ${START_HASH}
 * Checkpoint ogni: ${CHECKPOINT_INTERVAL.toLocaleString()} partite
 * Totale checkpoint: ${checkpoints.length.toLocaleString()}
 *
 * Uso:
 *   const { HASH_CHECKPOINTS_10M } = require('./hash-checkpoints-10M');
 *   const hash = HASH_CHECKPOINTS_10M[500].hash; // Hash a 500k partite indietro
 */

const HASH_CHECKPOINTS_10M = ${JSON.stringify(checkpoints, null, 2)};

// Export per uso come modulo
module.exports = { HASH_CHECKPOINTS_10M };

// Export anche come array semplice di soli hash
const HASH_ARRAY_10M = HASH_CHECKPOINTS_10M.map(c => c.hash);
module.exports.HASH_ARRAY_10M = HASH_ARRAY_10M;
`;

fs.writeFileSync('hash-checkpoints-10M.js', jsContent);

// Output riepilogo
console.log('════════════════════════════════════════════════════════════════════════════');
console.log('                         HASH CHECKPOINTS GENERATI');
console.log('════════════════════════════════════════════════════════════════════════════');
console.log('');
console.log('   Index │  Game Offset │ Hash');
console.log('   ──────┼──────────────┼─────────────────────────────────────────────────────');

// Mostra primi 10 e ultimi 5
for (let i = 0; i < Math.min(10, checkpoints.length); i++) {
    const cp = checkpoints[i];
    console.log(`   ${cp.index.toString().padStart(5)} │ ${cp.gameOffset.toLocaleString().padStart(12)} │ ${cp.hash}`);
}

if (checkpoints.length > 15) {
    console.log('   ...   │      ...     │ ...');
}

for (let i = Math.max(10, checkpoints.length - 5); i < checkpoints.length; i++) {
    const cp = checkpoints[i];
    console.log(`   ${cp.index.toString().padStart(5)} │ ${cp.gameOffset.toLocaleString().padStart(12)} │ ${cp.hash}`);
}

console.log('');
console.log('════════════════════════════════════════════════════════════════════════════');
console.log('');
console.log('   📁 File salvati:');
console.log('      • hash-checkpoints-10M.json (dati completi)');
console.log('      • hash-checkpoints-10M.js   (modulo esportabile)');
console.log('');
console.log('   📋 Come usare:');
console.log('      const { HASH_CHECKPOINTS_10M } = require("./hash-checkpoints-10M");');
console.log('      ');
console.log('      // Testa con hash a 5M partite indietro');
console.log('      const hash = HASH_CHECKPOINTS_10M[5000].hash;');
console.log('');
