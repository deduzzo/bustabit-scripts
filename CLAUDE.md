# CLAUDE.md - Guida Unica Progetto Bustabit

Questa è l'unica documentazione del progetto. Tutte le istruzioni sono qui.

---

## REGOLA FONDAMENTALE

**TUTTI I FILE TEMPORANEI DI TEST VANNO CREATI SOLO IN:**
```
bustabit-script-simulator/test/
```

Questa cartella è gitignored. Puliscila periodicamente con `rm -rf test/*`

**NON creare MAI file di test in altre cartelle!**

---

## Struttura Progetto

```
bustabit-scripts/
├── CLAUDE.md                     # QUESTA GUIDA (unica documentazione)
│
├── scripts/                      # Algoritmi pronti per Bustabit
│   ├── martin/
│   │   ├── MARTIN_AI_READY.js    # Stabile (+0.04%, bassa frequenza)
│   │   ├── MARTIN_AI_PLUS.js     # Dual strategy
│   │   └── MARTIN_AI_TURBO.js    # Alta frequenza
│   └── other/
│       └── PAOLOBET_HYBRID.js    # BEST: EV +19.7%, BR 0%
│
└── bustabit-script-simulator/    # Simulatore e strumenti
    ├── cli-tester.js             # TESTER PRINCIPALE (usa sempre questo!)
    ├── data/                     # Hash checkpoints (NON MODIFICARE)
    │   ├── hash-checkpoints-10M.js   # 10M partite reali
    │   └── hash-checkpoints.js       # 1M partite reali
    └── test/                     # CARTELLA TEMPORANEA (gitignored)
```

---

## Come Testare Algoritmi

### Test Algoritmo Finale
```bash
cd bustabit-script-simulator
bun cli-tester.js ../scripts/other/PAOLOBET_HYBRID.js --checkpoints10M --seeds=1000
```

### Opzioni cli-tester.js
| Opzione | Descrizione | Default |
|---------|-------------|---------|
| `--seeds=N` | Numero sessioni | 100 |
| `--games=N` | Partite per sessione | 500 |
| `--balance=N` | Balance iniziale (bits) | 10000 |
| `--checkpoints10M` | Usa 10M partite reali | - |
| `--log` | Log verbose | false |

### Esempi
```bash
# Test standard
bun cli-tester.js ../scripts/martin/MARTIN_AI_READY.js

# Test estensivo
bun cli-tester.js ../scripts/other/PAOLOBET_HYBRID.js --checkpoints10M --seeds=1000 --games=500

# Test con balance alto
bun cli-tester.js ../scripts/martin/MARTIN_AI_TURBO.js --checkpoints10M --balance=100000
```

---

## Sviluppo Nuovi Algoritmi

### 1. Crea file test nella cartella temporanea
```bash
cd bustabit-script-simulator
touch test/test-nuovo-algoritmo.js
```

### 2. Template base per test
```javascript
const crypto = require('crypto');
const GAME_SALT = "00000000000000000001e08b7fd44f95e3e950ac65650a8031a6d5e1750e34be";

function hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
}

function sha256(data) {
    const hash = crypto.createHash('sha256');
    hash.update(Buffer.from(data));
    return new Uint8Array(hash.digest());
}

function hmacSha256(key, data) {
    const hmac = crypto.createHmac('sha256', Buffer.from(key));
    hmac.update(Buffer.from(data));
    return hmac.digest('hex');
}

function gameResult(saltBytes, gameHash) {
    const nBits = 52;
    const hash = hmacSha256(saltBytes, gameHash);
    const seed = hash.slice(0, nBits / 4);
    const r = parseInt(seed, 16);
    let X = r / Math.pow(2, nBits);
    X = 99 / (1 - X);
    return Math.max(1, Math.floor(X) / 100);
}

function bytesToHex(bytes) {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateGames(startHash, numGames) {
    const saltBytes = Buffer.from(GAME_SALT, 'utf8');
    let currentHash = hexToBytes(startHash);
    const hashes = [new Uint8Array(currentHash)];
    for (let i = 1; i < numGames; i++) {
        currentHash = sha256(currentHash);
        hashes.push(new Uint8Array(currentHash));
    }
    return hashes.reverse().map(h => gameResult(saltBytes, h));
}

// Carica checkpoint (path relativo da test/)
const checkpoints = require('../data/hash-checkpoints-10M.js').HASH_CHECKPOINTS_10M;

// La tua funzione simulate
function simulate(crashes, config, startBalance) {
    let balance = startBalance;
    // ... logica betting ...
    return {
        profit: balance - startBalance,
        profitPercent: ((balance - startBalance) / startBalance) * 100,
        bankrupt: balance < 1
    };
}

// Main
async function runTest() {
    const SESSIONS = 1000;
    const GAMES = 500;
    const BALANCE = 100000;

    let totalProfit = 0;
    let bankrupts = 0;
    const profits = [];

    for (let i = 0; i < SESSIONS; i++) {
        const idx = Math.floor(Math.random() * checkpoints.length);
        let hash = hexToBytes(checkpoints[idx].hash);
        for (let j = 0; j < Math.floor(Math.random() * 1000); j++) {
            hash = sha256(hash);
        }

        const crashes = generateGames(bytesToHex(hash), GAMES);
        const result = simulate(crashes, {}, BALANCE);

        totalProfit += result.profitPercent;
        profits.push(result.profitPercent);
        if (result.bankrupt) bankrupts++;
    }

    profits.sort((a, b) => a - b);
    const ev = totalProfit / SESSIONS;
    const br = (bankrupts / SESSIONS) * 100;

    console.log(`EV: ${ev >= 0 ? '+' : ''}${ev.toFixed(2)}%`);
    console.log(`BR: ${br.toFixed(1)}%`);
    console.log(`P5/P50/P95: ${profits[Math.floor(SESSIONS*0.05)].toFixed(0)}% / ${profits[Math.floor(SESSIONS*0.5)].toFixed(0)}% / ${profits[Math.floor(SESSIONS*0.95)].toFixed(0)}%`);
}

runTest();
```

### 3. Esegui test
```bash
bun test/test-nuovo-algoritmo.js
```

### 4. Dopo ottimizzazione
1. Aggiorna l'algoritmo in `scripts/`
2. Testa con `cli-tester.js` per conferma
3. Elimina file temporanei: `rm -rf test/*`

---

## Metriche di Valutazione

| Metrica | Significato | Target |
|---------|-------------|--------|
| **EV** | Expected Value (profitto medio %) | > 0% |
| **BR** | Bankrupt Rate (% sessioni fallite) | < 2% |
| **P5** | Worst 5% dei casi | > -50% |
| **P50** | Caso tipico (mediana) | > 0% |
| **P95** | Best 5% dei casi | informativo |

### Score composito per ottimizzazione
```javascript
score = EV - (BR * 3) - (abs(min(0, P5 + 50)) * 0.3)
```

---

## Limiti Matematici

- **House Edge = 1%** - Ogni bet ha EV negativo
- **Alta frequenza = Più perdite** - 10%+ frequenza con EV positivo è impossibile
- **Partite indipendenti** - Strategie "delay" non funzionano

### Statistiche Ritardi (su 1M partite)
| Payout | Prob | Avg | P95 | MAX |
|--------|------|-----|-----|-----|
| 2.0x   | 49%  | 2   | 5   | 19  |
| 3.0x   | 33%  | 3   | 8   | 32  |
| 10.0x  | 10%  | 10  | 29  | 96  |

---

## Comandi Rapidi

```bash
cd ~/dev/test/bustabit-scripts/bustabit-script-simulator

# Test algoritmo
bun cli-tester.js ../scripts/other/PAOLOBET_HYBRID.js --checkpoints10M --seeds=1000

# Script temporaneo
bun test/mio-test.js

# Pulisci test
rm -rf test/*
```

---

## Note per Claude

1. **USA SEMPRE cli-tester.js** per test finali
2. **USA SEMPRE --checkpoints10M** per risultati affidabili
3. **CREA file temporanei SOLO in test/** - mai altrove
4. **ELIMINA file temporanei** dopo ottimizzazione
5. **I dati hash sono in data/** - non modificare
6. **Questa è l'unica documentazione** - non crearne altre
