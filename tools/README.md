# 🛠️ Utility Tools

Strumenti essenziali per lavorare con Bustabit.

## 📋 Tools Disponibili

### bustabit-verifier.js
Verifica la correttezza del calcolo dei crash point usando l'algoritmo Provably Fair di Bustabit.

**Funzionalità:**
- Genera crash point da hash seed
- Verifica catena di hash (chain verification)
- Confronta con dati reali da Bustabit
- Test di correttezza algoritmo HMAC-SHA256

**Utilizzo:**
```javascript
const { crashPointFromHash, getPreviousHash } = require('./bustabit-verifier');

// Calcola crash point da hash
const hash = '94aa062026624e59a0ace092568d5f46e21b9bf1d5173609db8645dd62bdfc44';
const crash = crashPointFromHash(hash);
console.log(`Crash: ${crash}x`);

// Ottieni hash precedente
const prevHash = getPreviousHash(hash);
```

**Come funziona:**
```javascript
// 1. HMAC-SHA256 con game salt
const hmac = crypto.createHmac('sha256', GAME_SALT);
hmac.update(Buffer.from(serverSeed, 'hex'));
const hmacResult = hmac.digest('hex');

// 2. Converti in numero
const h = parseInt(hmacResult.substring(0, 13), 16);

// 3. Calcola crash point
const e = Math.pow(2, 52);
if (h % 33 === 0) return 1.00; // Instant bust
const x = h / e;
return Math.max(1.00, Math.floor(99 / (1 - x)) / 100);
```

---

### real-bustabit-seed-generator.js
Genera sequenze di crash point reali usando seed autentici da Bustabit.

**Funzionalità:**
- Genera sequenze da hash iniziale
- Chain verification (catena SHA256)
- Export risultati in vari formati
- Statistiche distribuzione crash

**Utilizzo:**
```javascript
const { generateRealSequence } = require('./real-bustabit-seed-generator');

// Genera 10,000 crash reali
const startHash = '94aa062026624e59a0ace092568d5f46e21b9bf1d5173609db8645dd62bdfc44';
const crashes = generateRealSequence(startHash, 10000);

// Usa nei test
console.log(`First crash: ${crashes[0]}x`);
console.log(`Last crash: ${crashes[9999]}x`);
```

**Output:**
```
Generating: 1,000 / 10,000 (10.0%)
Generating: 2,000 / 10,000 (20.0%)
...
Generated: 10,000 crashes

Statistics:
  Min: 1.00x
  Max: 487.23x
  Average: 1.98x
  Median: 1.52x
```

---

## 🔑 Costanti Importanti

### Game Salt
```javascript
const GAME_SALT = '00000000000000000001e08b7fd44f95e3e950ac65650a8031a6d5e1750e34be';
```
Questo è il salt ufficiale di Bustabit usato per l'HMAC-SHA256.

### Hash Iniziali Verificati
Questi hash sono stati verificati con i dati reali di Bustabit:

```javascript
// Hash più recente (usato nei test)
'94aa062026624e59a0ace092568d5f46e21b9bf1d5173609db8645dd62bdfc44'

// Hash alternativi per testing
'5330657782417e0e542883bd5dc9e1b554776b689325b77ce61ddd34f87af127'
'c1cfd927d9b44dc7f5ae3d5da168c597207133074cf6905e9379cbe1fae1c3c1'
```

---

## 📊 Formato Output

### Crash Point Format
I crash point sono sempre:
- Formato: `X.XX` (es. `2.50`, `1.00`, `387.45`)
- Min: `1.00x`
- Max: teoricamente illimitato (in pratica ~10,000x)
- Probabilità: decresce esponenzialmente

### Distribuzione Teorica
```
1.00x - 1.10x:  ~9%   (instant bust)
1.10x - 2.00x:  ~45%
2.00x - 3.00x:  ~17%
3.00x - 5.00x:  ~11%
5.00x - 10.0x:  ~6%
10.0x+:         ~3%
100x+:          ~0.1%
```

---

## 🧮 Algoritmo Provably Fair

### Step 1: Hash Chain
```
Hash[n] = SHA256(Hash[n-1])
```

### Step 2: HMAC
```
HMAC = HMAC-SHA256(GAME_SALT, serverSeed)
```

### Step 3: Calcolo Crash
```
h = parseInt(HMAC[0:13], 16)
if h % 33 === 0:
    crash = 1.00
else:
    x = h / 2^52
    crash = floor(99 / (1 - x)) / 100
```

---

## ✅ Verifica Correttezza

Test per verificare che i tool funzionino correttamente:

```bash
# Test 1: Verifica hash chain
node -e "
const { getPreviousHash } = require('./tools/bustabit-verifier');
const h1 = '94aa062026624e59a0ace092568d5f46e21b9bf1d5173609db8645dd62bdfc44';
const h2 = getPreviousHash(h1);
console.log('Previous hash:', h2);
"

# Test 2: Verifica crash calculation
node -e "
const { crashPointFromHash } = require('./tools/bustabit-verifier');
const crash = crashPointFromHash('94aa062026624e59a0ace092568d5f46e21b9bf1d5173609db8645dd62bdfc44');
console.log('Crash point:', crash + 'x');
"

# Test 3: Genera sequenza
node -e "
const { generateRealSequence } = require('./tools/real-bustabit-seed-generator');
const crashes = generateRealSequence('94aa062026624e59a0ace092568d5f46e21b9bf1d5173609db8645dd62bdfc44', 100);
console.log('First 10 crashes:', crashes.slice(0, 10));
"
```

---

## 📚 Riferimenti

- [Bustabit Provably Fair](https://bitcointalk.org/index.php?topic=922898.0)
- [Game Hash Verification](https://www.bustabit.com/provably-fair)
- [HMAC-SHA256 Specification](https://tools.ietf.org/html/rfc2104)

---

## 💡 Tips per Sviluppatori

1. **Cache i crashes:** Genera una volta, riutilizza più volte
2. **Parallelizza:** Usa worker threads per generazioni massive
3. **Verifica sempre:** Confronta con dati reali prima di fidarti
4. **Usa TypeScript:** Aggiungi type safety per evitare errori
5. **Test Unit:** Scrivi test per ogni funzione critica

---

## 🐛 Troubleshooting

### "Hash non valido"
- Controlla che sia una stringa hex di 64 caratteri
- Verifica che non ci siano spazi o caratteri speciali

### "Crash point non corretto"
- Verifica di usare il GAME_SALT corretto
- Controlla la conversione hex → int
- Assicurati di usare floor() nel calcolo finale

### "Catena hash non coincide"
- Ricorda: la catena va all'indietro (SHA256 inverso)
- Ogni hash è il SHA256 del successivo
