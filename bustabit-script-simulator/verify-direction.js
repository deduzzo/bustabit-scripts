import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';

// Dalla tabella bustabit
const game12424169 = '4488d92d89d0ed7fbb2ea23b219d569f63207e32fc44b957858838835c1719f1';
const game12424168 = '1f497e8ba3a58b87976a9207a4596c2e00c11494237127f22d0f57785fcadd23';

console.log('Verifying hash chain direction...\n');
console.log('Game #12424169 (più recente):', game12424169);
console.log('Game #12424168 (più vecchio):', game12424168);
console.log('');

// Test: SHA256(game12424169) dovrebbe dare game12424168?
const hash1 = hexToBytes(game12424169);
const result1 = bytesToHex(sha256(hash1));
console.log('SHA256(#12424169) =', result1);
console.log('Game #12424168    =', game12424168);
console.log('Match?', result1 === game12424168 ? '✓ YES' : '✗ NO');
console.log('');

// Oppure viceversa?
const hash2 = hexToBytes(game12424168);
const result2 = bytesToHex(sha256(hash2));
console.log('SHA256(#12424168) =', result2);
console.log('Game #12424169    =', game12424169);
console.log('Match?', result2 === game12424169 ? '✓ YES' : '✗ NO');
console.log('');

// Conclusione
if (result1 === game12424168) {
  console.log('✓ CONFERMATO: SHA256(newer) = older');
  console.log('  Quindi: game più recente (#12424169) -> SHA256 -> game più vecchio (#12424168)');
  console.log('  L\'hash dell\'utente (in alto nella tabella) è il più RECENTE');
} else if (result2 === game12424169) {
  console.log('✓ CONFERMATO: SHA256(older) = newer');
  console.log('  Quindi: game più vecchio (#12424168) -> SHA256 -> game più recente (#12424169)');
  console.log('  L\'hash dell\'utente (in alto nella tabella) è il più VECCHIO');
}
