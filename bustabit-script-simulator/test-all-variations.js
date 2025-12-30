const crypto = require('crypto');
const CryptoJS = require('crypto-js');

const testHash = '4488d92d89d0ed7fbb2ea23b219d569f63207e32fc44b957858838835c1719f1';
const expectedBust = 1.46;

console.log('Testing hash:', testHash);
console.log('Expected result:', expectedBust, 'x\n');

// Variante 1: Formula bustabit originale
function variant1(seed) {
  const hmac = crypto.createHmac('sha256', '0000000000000000004d6ec16dafe9d8370958664c1dc422f452892264c59526');
  hmac.update(seed);
  const hash = hmac.digest('hex');
  
  const h = parseInt(hash.slice(0,13),16);
  const e = Math.pow(2,52);
  
  return Math.floor((100 * e - h) / (e - h)) / 100;
}

// Variante 2: Usare l'hash direttamente senza HMAC
function variant2(seed) {
  const h = parseInt(seed.slice(0,13),16);
  const e = Math.pow(2,52);
  
  return Math.floor((100 * e - h) / (e - h)) / 100;
}

// Variante 3: Algoritmo nel codice attuale (con inversione)
function variant3(seed) {
  const nBits = 52;
  const hmac = CryptoJS.HmacSHA256(CryptoJS.enc.Hex.parse(seed), '0000000000000000004d6ec16dafe9d8370958664c1dc422f452892264c59526');
  let hash = hmac.toString(CryptoJS.enc.Hex);
  hash = hash.slice(0, nBits / 4);
  const r = parseInt(hash, 16);
  let X = r / Math.pow(2, nBits);
  X = 99 / (1 - X);
  const result = Math.floor(X);
  return Math.max(1, result / 100);
}

// Variante 4: Senza HMAC, usando hash direttamente con formula invertita
function variant4(seed) {
  const nBits = 52;
  const hash = seed.slice(0, nBits / 4);
  const r = parseInt(hash, 16);
  let X = r / Math.pow(2, nBits);
  X = 99 / (1 - X);
  const result = Math.floor(X);
  return Math.max(1, result / 100);
}

// Variante 5: SHA256 del game hash, poi calcolo
function variant5(seed) {
  const hash = crypto.createHash('sha256').update(seed).digest('hex');
  const h = parseInt(hash.slice(0,13),16);
  const e = Math.pow(2,52);
  
  return Math.floor((100 * e - h) / (e - h)) / 100;
}

// Variante 6: Algoritmo più semplice (quello del simulatore originale)
function variant6(seed) {
  const h = parseInt(seed.slice(0,13),16);
  const e = Math.pow(2,52);
  return Math.max(1, Math.floor((100 * e - h) / (e - h))) / 100;
}

console.log('Variant 1 (HMAC + bustabit formula):', variant1(testHash));
console.log('Variant 2 (Direct hash):', variant2(testHash));
console.log('Variant 3 (Current code):', variant3(testHash));
console.log('Variant 4 (Direct hash inverted):', variant4(testHash));
console.log('Variant 5 (SHA256 then calc):', variant5(testHash));
console.log('Variant 6 (Simple):', variant6(testHash));

// Proviamo a calcolare quale dovrebbe essere l'hash per ottenere 1.46
console.log('\n--- Reverse calculation for 1.46x ---');
const e = Math.pow(2,52);
// (100 * e - h) / (e - h) = 146
// 100 * e - h = 146 * (e - h)
// 100 * e - h = 146 * e - 146 * h
// 100 * e - 146 * e = h - 146 * h
// -46 * e = -145 * h
// h = (46 * e) / 145

const targetH = (46 * e) / 145;
console.log('Target h value:', targetH);
console.log('Target h hex:', Math.floor(targetH).toString(16));

// Verifica
const verifyBust = Math.floor((100 * e - targetH) / (e - targetH)) / 100;
console.log('Verification with target h:', verifyBust);
