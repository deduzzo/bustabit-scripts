// Verifica con l'implementazione esatta di bustabit
const crypto = require('crypto');

function divisible(hash, mod) {
  // We will read in 4 hex at a time, but the first chunk might be a bit smaller
  // So ABCDEFGHIJ should be chunked like AB CDEF GHIJ
  var val = 0;
  
  var o = hash.length % 4;
  for (var i = o > 0 ? o - 4 : 0; i < hash.length; i += 4) {
    val = ((val << 16) + parseInt(hash.substring(i, i+4), 16)) % mod;
  }
  
  return val === 0;
}

function gameResult(seed) {
  // Si calcola l'HMAC-SHA256 del seed usando la chiave
  const hmac = crypto.createHmac('sha256', '0000000000000000004d6ec16dafe9d8370958664c1dc422f452892264c59526');
  hmac.update(seed);
  const hash = hmac.digest('hex');
  
  const hs = parseInt(hash.slice(0,52/4),16);
  const e = Math.pow(2,52);

  return Math.floor((100 * e - hs) / (e - hs));
}

// Test
const testHash = '4488d92d89d0ed7fbb2ea23b219d569f63207e32fc44b957858838835c1719f1';
console.log('Hash:', testHash);
console.log('Result (v1):', gameResult(testHash) / 100);

// Provo anche la formula alternativa
function gameResult2(seed) {
  const hmac = crypto.createHmac('sha256', '0000000000000000004d6ec16dafe9d8370958664c1dc422f452892264c59526');
  hmac.update(seed);
  const hash = hmac.digest('hex');
  
  const h = parseInt(hash.slice(0,52/4),16);
  const e = Math.pow(2,52);
  
  return Math.max(100, Math.floor((100 * e - h) / (e - h))) / 100;
}

console.log('Result (v2):', gameResult2(testHash));

// Debug step by step
const hmac = crypto.createHmac('sha256', '0000000000000000004d6ec16dafe9d8370958664c1dc422f452892264c59526');
hmac.update(testHash);
const hash = hmac.digest('hex');
console.log('\nDebug:');
console.log('HMAC:', hash);
const h = parseInt(hash.slice(0,13),16);
console.log('h (first 52 bits):', h);
const e = Math.pow(2,52);
console.log('e (2^52):', e);
console.log('(100 * e - h):', (100 * e - h));
console.log('(e - h):', (e - h));
console.log('Result:', Math.floor((100 * e - h) / (e - h)));
