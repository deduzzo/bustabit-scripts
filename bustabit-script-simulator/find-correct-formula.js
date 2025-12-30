const testHash = '4488d92d89d0ed7fbb2ea23b219d569f63207e32fc44b957858838835c1719f1';
const expectedBust = 1.46;

console.log('Finding correct formula for:', testHash);
console.log('Expected:', expectedBust, 'x\n');

// Formula base di bustabit
function testFormula(h) {
  const e = Math.pow(2,52);
  const result = Math.floor((100 * e - h) / (e - h));
  return result / 100;
}

// Test diretto con hash
const h1 = parseInt(testHash.slice(0,13), 16);
console.log('h from hash (first 13 chars):', h1);
console.log('hex:', testHash.slice(0,13));
console.log('Result:', testFormula(h1));

// Forse devo usare più caratteri?
console.log('\n--- Testing with different slice lengths ---');
for (let len = 10; len <= 16; len++) {
  const h = parseInt(testHash.slice(0,len), 16);
  const result = testFormula(h);
  console.log(`Length ${len} (${testHash.slice(0,len)}):`, result, 'x');
}

// O forse la formula è leggermente diversa?
console.log('\n--- Testing formula variations ---');

// Variazione 1: senza floor prima della divisione
function formula1(h) {
  const e = Math.pow(2,52);
  return (100 * e - h) / (e - h) / 100;
}

// Variazione 2: con floor sul risultato finale
function formula2(h) {
  const e = Math.pow(2,52);
  const result = (100 * e - h) / (e - h);
  return Math.floor(result) / 100;
}

// Variazione 3: floor prima, poi round
function formula3(h) {
  const e = Math.pow(2,52);
  const result = Math.round((100 * e - h) / (e - h));
  return result / 100;
}

const h = parseInt(testHash.slice(0,13), 16);
console.log('Formula 1 (no floor before div):', formula1(h));
console.log('Formula 2 (floor final):', formula2(h));
console.log('Formula 3 (round):', formula3(h));

// Cerchiamo il valore esatto di h che dà 1.46
console.log('\n--- Finding exact h for 1.46x ---');
const e = Math.pow(2,52);

const h_exact = (100 * e - 146 * e) / (1 - 146);
console.log('Exact h for 146:', h_exact);
console.log('Hex:', Math.floor(h_exact).toString(16));

const h_for_147 = (100 * e - 147 * e) / (1 - 147);
const h_for_146 = (100 * e - 146 * e) / (1 - 146);

console.log('h range for 1.46x:');
console.log('  Min h (for < 147):', h_for_147, '=', Math.ceil(h_for_147).toString(16));
console.log('  Max h (for >= 146):', h_for_146, '=', Math.floor(h_for_146).toString(16));

console.log('\nOur h:', h);
console.log('In range?', h >= h_for_147 && h <= h_for_146);
