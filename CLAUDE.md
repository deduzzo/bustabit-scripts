# CLAUDE.md - Guida Unica Progetto Bustabit

Questa è l'unica documentazione del progetto. Tutte le istruzioni sono qui.

---

## ⚠️ DEFINIZIONE UNITÀ DI MISURA - LEGGI PRIMA DI TUTTO

**IMPORTANTE: In tutto il progetto, quando parliamo di "bit" intendiamo SEMPRE e SOLO il bit ufficiale di Bustabit.**

### Conversione Bit <-> Satoshi negli Script

```
1 bit (Bustabit) = 100 satoshi

Esempi:
- 1 bit reale      → 100 negli script  (x 100)
- 10 bit reali     → 1000 negli script
- 100 bit reali    → 10000 negli script
- 1000 bit reali   → 100000 negli script
- 10000 bit reali  → 1000000 negli script
```

### Regola Assoluta

**Noi parliamo SEMPRE e SOLO in bit reali di Bustabit.**
- Quando dici "5000 bit" → intendi 5000 bit reali di Bustabit
- Negli script diventa `500000` (moltiplicato x100 per i satoshi)
- **MA TU NON DEVI MAI riferirTI a questa misura interna degli script!**

**Nei file di documentazione, nei log, nei risultati:**
- Scrivere: "Balance: 5000 bit" ✅
- **NON scrivere:** "Balance: 500000" ❌ (questa è la misura interna dello script)

**Quando configuri il simulatore:**
```javascript
// User dice: "testa con balance 5000 bit"
// Nel codice dello script interno:
startingBalance: 500000  // = 5000 bit reali x 100

// Ma nei log mostri:
console.log(`Balance: ${balance/100} bit`);  // Dividi per 100 per mostrare bit reali
```

**RICORDA SEMPRE:**
- **1 bit = quello che vedi su Bustabit = quello di cui parliamo**
- Gli script internamente moltiplicano x100 (satoshi) ma **questo è un dettaglio implementativo**
- **Noi ragioniamo SEMPRE in bit reali**

---

## REGOLE FONDAMENTALI

### 1. File Temporanei di Test
**TUTTI I FILE TEMPORANEI DI TEST VANNO CREATI SOLO IN:**
```
bustabit-script-simulator/test/
```

Questa cartella è gitignored. Puliscila periodicamente con `rm -rf test/*`

**NON creare MAI file di test in altre cartelle!**

### 2. Documentazione Script
**TUTTA LA DOCUMENTAZIONE DEGLI SCRIPT VA IN:**
```
scriptsDocs/
```

**Regole per la documentazione:**
- **Un file .md per ogni script** con nome identico allo script
- Es: `scripts/other/PAOLOBET_HYBRID.js` → `scriptsDocs/PAOLOBET_HYBRID.md`
- Es: `scripts/martin/MARTIN_AI_READY.js` → `scriptsDocs/MARTIN_AI_READY.md`
- Include: configurazione, performance, storico ottimizzazioni, TODO
- **NON creare riepiloghi sparsi** nel repository
- **NON creare file di documentazione temporanei**

### 3. File di Risultati
**TUTTI I FILE DI RISULTATI (.json) VANNO IN:**
```
results/
```

**Regole per i risultati:**
- **Un file -results.json per ogni script** testato
- Es: `PAOLOBET_HYBRID.js` → `results/PAOLOBET_HYBRID-results.json`
- Es: `MARTIN_AI_READY.js` → `results/MARTIN_AI_READY-results.json`
- **NON salvare MAI risultati nella cartella scripts/** o altrove
- Formato: `NOME_SCRIPT-results.json`
- Questi file contengono l'output completo dei test (config, summary, results)

### 4. Script per Bustabit - UNA SOLA VERSIONE

**⚠️ REGOLA CRITICA: GLI SCRIPT VANNO SCRITTI SOLO PER BUSTABIT**

**NON creare MAI due versioni dello stesso script (una per Bustabit e una per il simulatore).**

**Procedura corretta:**
1. Sviluppa e testa SEMPRE nella cartella `bustabit-script-simulator/test/` usando file temporanei
2. Una volta ottimizzato, crea LA VERSIONE FINALE in `scripts/` **SOLO per Bustabit**
3. Gli script in `scripts/` devono essere pronti per essere copiati direttamente su Bustabit.com
4. **NON creare versioni "_simulator.js"** - esiste solo la versione Bustabit

**Esempio corretto:**
```
✅ scripts/other/PAOLOBET_HYBRID.js           # SOLO questa versione
✅ bustabit-script-simulator/test/test-paolobet.js  # File temporaneo per sviluppo
❌ scripts/other/PAOLOBET_HYBRID_simulator.js # MAI creare questa versione
```

**Per testare:**
- Usa `cli-tester.js` che può eseguire DIRETTAMENTE gli script Bustabit
- Non serve una versione separata per il simulatore

### 5. Reverse Engineering di Algoritmi
**CARTELLA DEDICATA AL REVERSE ENGINEERING:**
```
bustabit-reverse-eng/
```

**Scopo:**
- Analizzare dati di betting raccolti tramite scraping
- Identificare pattern e strategie di altri giocatori
- Ricostruire algoritmi basati sui dati reali

**Struttura:**
```
bustabit-reverse-eng/
├── README.md                    # Guida completa al reverse engineering
├── data/                        # File JSON con dati scraped (*.json)
├── analyze-player-strategy.js  # Script principale di analisi
└── results/                     # Algoritmi ricostruiti (*.js)
```

**Come usare:**
1. Raccogli dati con lo scraper in `bustabit-scraping/`
2. Sposta i file JSON in `bustabit-reverse-eng/data/`
3. Analizza: `node analyze-player-strategy.js data/FILE.json PLAYER_NAME`
4. Ricostruisci l'algoritmo in `results/PLAYER_NAME.js`
5. Testa con il simulatore

**Documentazione completa:** Vedi `bustabit-reverse-eng/README.md`

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
│       └── PAOLOBET_HYBRID.js    # v4.2: EV -1.66%, WR 58.7%
│
├── scriptsDocs/                  # DOCUMENTAZIONE SCRIPT (organizzata)
│   ├── PAOLOBET_HYBRID.md        # Docs per PAOLOBET_HYBRID.js
│   ├── MARTIN_AI_READY.md        # (da creare quando necessario)
│   └── ...                       # Un file .md per ogni script
│
├── results/                      # FILE RISULTATI TEST (organizzati)
│   ├── PAOLOBET_HYBRID-results.json
│   ├── MARTIN_AI_READY-results.json
│   └── ...                       # Un file -results.json per script testato
│
├── bustabit-reverse-eng/         # REVERSE ENGINEERING (vedi README.md)
│   ├── README.md                 # Guida completa
│   ├── data/                     # File JSON scraped
│   ├── analyze-player-strategy.js  # Script di analisi
│   └── results/                  # Algoritmi ricostruiti
│
├── bustabit-scraping/            # Tampermonkey scraper
│   └── bustabit-scraper-v2.user.js  # Script per Chrome
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

### ⚠️ IMPORTANTE: Conversione Balance nel Simulatore

**IL SIMULATORE MOLTIPLICA AUTOMATICAMENTE I BALANCE PER 100!**

```javascript
// Quando passi al simulatore:
startingBalance: 1000    // → diventa 100000 internamente
workingBalance: 1000     // → diventa 100000 internamente
baseBet: 1               // → diventa 100 internamente

// Quindi:
// 1000 bits nel simulatore = 1000 bits effettivi
// NON moltiplicare manualmente per 100!
```

**Su Bustabit:**
- 1000 bits in config = 1000 bits effettivi ✅
- 100 bits baseBet = 1 bit effettivo ✅

**Nel Simulatore:**
- `startingBalance: 1000` = 1000 bits effettivi ✅
- `workingBalance: 1000` = 1000 bits effettivi ✅
- `baseBet: 1` = 1 bit effettivo ✅

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
| `--balance=N` | Balance iniziale (bits EFFETTIVI, simulatore converte) | 10000 |
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

## API Bustabit - Config Types

**IMPORTANTE: Gestione corretta dei tipi di configurazione**

### Type: 'balance' (Satoshi)
```javascript
baseBet: { value: 10000, type: 'balance', label: 'Base Bet' }
// 10000 satoshi = 100 bits
// config.baseBet.value → 10000 (già in satoshi)
```

### Type: 'multiplier' (Double)
```javascript
targetHigh: { value: 15.00, type: 'multiplier', label: 'Target High' }
// config.targetHigh.value → 15.00 (double, NON centesimi!)
// ❌ NON moltiplicare per 100!
```

### engine.bet(wager, target)
```javascript
// ✅ CORRETTO
var wager = config.baseBet.value;      // 10000 satoshi
var target = config.targetHigh.value;  // 15.00 (double)
engine.bet(wager, target);

// ❌ SBAGLIATO
engine.bet(wager, target * 100);  // NO! creerebbe 1500x invece di 15x
```

### Regola Fondamentale
**NON moltiplicare MAI i multiplier per 100 quando usi `engine.bet()`**
- Bustabit accetta direttamente il valore double
- Solo `type: 'balance'` usa satoshi (già moltiplicato per 100)
- Solo `type: 'multiplier'` usa double (15.00 resta 15.00)

---

## Note per Claude

1. **⚠️ CREA SCRIPT SOLO PER BUSTABIT** - MAI creare versioni "_simulator.js"
2. **⚠️ MULTIPLIER = DOUBLE** - NON moltiplicare per 100 quando usi engine.bet()
3. **USA SEMPRE cli-tester.js** per test finali
4. **USA SEMPRE --checkpoints10M** per risultati affidabili
5. **CREA file temporanei SOLO in test/** - mai altrove
6. **ELIMINA file temporanei** dopo ottimizzazione
7. **I dati hash sono in data/** - non modificare
8. **DOCUMENTAZIONE script va in scriptsDocs/** - un file .md per script
9. **FILE RISULTATI (.json) vanno in results/** - mai in scripts/
10. **NON creare riepiloghi sparsi** - usa scriptsDocs/NOME_SCRIPT.md
11. **Aggiorna sempre il file .md dello script** dopo ottimizzazioni/modifiche
