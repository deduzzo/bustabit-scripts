# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Structure

This is a **dual-branch repository**:

- **`master` branch**: Contains the React application source code
- **`gh-pages` branch**: Contains the built/deployed static site (served at https://mtihc.github.io/bustabit-script-simulator/)

**IMPORTANT**: You are currently on the `gh-pages` branch. To work with source code, you must switch to the `master` branch first:

```bash
git checkout master
# or to check out from upstream
git fetch upstream master && git checkout -b master upstream/master
```

## Development Commands (from master branch)

### Install dependencies
```bash
npm install --package-lock-only
```

### Run development server
```bash
npm start
```
Opens at http://localhost:3000 with hot reload enabled.

### Run tests
```bash
npm test
```
Launches test runner in interactive watch mode.

### Build for production
```bash
npm run build
```
Creates optimized production build in `build/` directory.

### Deploy to GitHub Pages
```bash
npm run deploy
```
Builds and deploys to `gh-pages` branch automatically.

### Update dependencies
```bash
npm audit fix --force
```
Note: May require fixing deprecated code in d3 (line chart) or jszip (script backups).

## Architecture Overview

This is a React application built with **Create React App** that simulates Bustabit gambling scripts using provably fair game generation.

### Core Technologies
- **React 17** with JSX
- **Flux** architecture for state management
- **Bulma** for CSS styling
- **SASS** for component styles
- **D3.js** for line chart visualization
- **CryptoJS** for provably fair game hash calculation
- **JSZip** for script backup/export functionality

### Key Architecture Patterns

#### Flux Data Flow
The app uses Flux pattern with:
- **Dispatcher**: `src/data/AppDispatcher.js` - central event hub
- **Actions**:
  - `src/data/ScriptActions.js` - script CRUD operations
  - `src/data/NotificationActions.js` - notification management
- **Stores**:
  - `src/data/ScriptStore.js` - single script state
  - `src/data/ScriptListStore.js` - list of scripts
  - `src/data/NotificationStore.js` - notification state
- **Views**: `src/views/` - React components that listen to stores

#### Simulation Engine
`src/data/simulate.js` contains:
- **`hashToBust(seed)`**: Converts game hash to bust multiplier using provably fair algorithm
- **`hashToBusts(seed, amount)`**: Generates chain of game results backwards from seed hash
- **`SimulatedBustabitEngine`**: EventEmitter that mimics bustabit.com's engine API
  - Events: `GAME_STARTING`, `GAME_STARTED`, `GAME_ENDED`, `BET_PLACED`, `CASHED_OUT`
  - Methods: `bet(wager, payout)`, exposes `history`, `gameState`, `next`, `_userInfo`
- **`SimulatedBustabitHistory`**: Data structure for game history access

User scripts run in a sandboxed environment with exposed globals:
- `config` - parsed from script's `var config = {...}` declaration
- `engine` - SimulatedBustabitEngine instance
- `userInfo` - user stats (balance, bets, profit, streaks)
- `log(message)`, `stop(reason)`, `notify(message)` - utility functions
- `sim` - simulator-only object with `enableChart`, `enableLog`, `gameAmount`, `gameHash`, `startingBalance`

### Component Structure
- **AppContainer.js**: Root container connecting Flux stores to AppView
- **AppView.jsx**: Main application layout
- **BustabitScript.jsx**: Script editor and execution interface
- **BustabitScriptConfig.jsx**: Parses and renders UI for script's `config` object
- **LineChart.jsx**: D3-based balance visualization over time
- **Notifications.jsx**: Toast-style notification system
- **OptionsMenu.jsx**: Kebab menu for script actions

### Local Storage
Scripts and configurations are persisted in browser's localStorage (mimicking bustabit.com behavior).

### Provably Fair Algorithm
Games use bustabit's actual provably fair system:
1. Start with a known game hash
2. Calculate that game's result using HMAC-SHA256
3. Hash that result with SHA256 to get previous game's hash
4. Repeat to generate chain of historical games in reverse order
5. Simulation runs games in forward order

## Important Notes

- **Disclaimer**: This simulator is NOT affiliated with bustabit.com
- **No guarantees**: Past simulation results don't predict future outcomes
- The simulation engine is a **from-scratch implementation** (not copied from bustabit)
- Scripts work identically to bustabit.com's autobet system
- The `sim` variable only exists in simulator, not on actual bustabit.com

## Upstream Repository
- Original: https://github.com/Mtihc/bustabit-script-simulator
- Fork: https://github.com/deduzzo/bustabit-script-simulator

---

# Sistema di Test Algoritmi Bustabit (CLI)

Sistema per testare algoritmi di betting su milioni di partite con crash values reali.

## File Principali

### Hash Checkpoints
```
hash-checkpoints-10M.js  - 10,000 checkpoint ogni 1000 partite (copre 10M partite)
hash-checkpoints.js      - 100 checkpoint base
```

### Script di Test
```
cli-tester.js            - Tester CLI principale per algoritmi
test-turbo.js            - Test specifico per MARTIN_AI_TURBO
test-turbo-variants.js   - Test varianti configurazioni
analyze-delays.js        - Analisi ritardi per payout
analyze-delays-v2.js     - Strategie delay conservative
analyze-low-payouts.js   - Analisi payout bassi (1.1x-1.5x)
analyze-high-frequency.js - Test strategie alta frequenza
analyze-session-strategy.js - Test strategie sessione breve
```

## Costanti Fondamentali

### GAME_SALT (Bustabit Provably Fair)
```javascript
const GAME_SALT = "00000000000000000001e08b7fd44f95e3e950ac65650a8031a6d5e1750e34be";
```

### Hash di Partenza Principale
```javascript
const START_HASH = '1ba3ae00558a9e96ae2bc1ac1126fb47c46610c0b7735f58bbefcb24eba095dc';
```

## Come Testare un Algoritmo

### 1. Test Rapido con CLI Tester
```bash
bun cli-tester.js
```
Esegue test su 10,001 seeds x 5000 partite = 50M partite totali.

### 2. Test Specifico con Funzione di Simulazione

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
    const result = Math.floor(X);
    return Math.max(1, result / 100);
}

function generateCrashValues(startHash, amount) {
    let currentHash = hexToBytes(startHash);
    const saltBytes = Buffer.from(GAME_SALT, 'utf8');
    const crashes = [];
    for (let i = 0; i < amount; i++) {
        crashes.push(gameResult(saltBytes, currentHash));
        currentHash = sha256(currentHash);
    }
    return crashes;
}
```

### 3. Usare i Checkpoint per Test Multipli
```javascript
const checkpoints = require('./hash-checkpoints-10M.js').HASH_CHECKPOINTS_10M;

// Test su 100 sessioni diverse
for (let i = 0; i < 100; i++) {
    const hash = checkpoints[i * 100].hash;  // Ogni 100K partite
    const crashes = generateCrashValues(hash, 10000);
    const result = simulateAlgorithm(crashes, config);
    // ... analizza risultati
}
```

## Prompt per Claude per Testare Algoritmi

### Test Completo di un Algoritmo
```
Testa l'algoritmo [NOME] su 100 sessioni da 10000 partite usando i checkpoint 10M.
Calcola:
- Profitto medio %
- Win Rate %
- Frequenza betting %
- Sessioni positive %
- Max drawdown
```

### Analisi Ritardi Payout
```
Analizza i ritardi massimi per i payout 1.5x, 2x, 3x, 10x su 1 milione di partite.
Mostra P50, P90, P95, P99 e MAX per ciascuno.
```

### Ottimizzazione Parametri
```
Trova la configurazione ottimale per [OBIETTIVO] testando queste variabili:
- payout: [1.5, 1.8, 2.0, 3.0]
- betPercent: [0.1, 0.2, 0.3]
- delay entry: [3, 5, 8, 10]
Testa su 50 sessioni da 10000 partite.
```

## Algoritmi Disponibili

### scripts/martin/
```
MARTIN_AI_READY.js   - Profitto stabile (+0.04%), bassa frequenza (11 bets/10K)
MARTIN_AI_PLUS.js    - Dual strategy Hunt + Delay Hunter (126 bets/10K)
MARTIN_AI_TURBO.js   - Alta frequenza 10% (989 bets/10K), EV -0.68%
```

### Confronto Performance
| Versione | Bets/10K | Profitto | Win Rate | Sessioni+ |
|----------|----------|----------|----------|-----------|
| READY    | 11       | +0.04%   | 50.44%   | ~50%      |
| PLUS     | 126      | +0.11%   | 49.59%   | ~50%      |
| TURBO    | 989      | -0.68%   | 52.2%    | 44%       |

## Limiti Matematici Trovati

### Trade-off Fondamentale
```
PIÙ BETS = PIÙ ESPOSIZIONE AL HOUSE EDGE (1%)
```

- 10% frequenza con profitto positivo è **matematicamente impossibile** a lungo termine
- Strategie "delay inverse" (osserva X, punta Y) **non funzionano** - ogni partita è indipendente
- Massimo ritardo osservato per @10x: 96 partite (su 1M analizzate)

### Statistiche Ritardi (su 1M partite)
| Payout | Prob | Avg | P90 | P95 | P99 | MAX |
|--------|------|-----|-----|-----|-----|-----|
| 1.5x   | 66%  | 1.5 | 3   | 3   | 5   | 12  |
| 2.0x   | 49%  | 2.0 | 4   | 5   | 7   | 19  |
| 3.0x   | 33%  | 3.0 | 6   | 8   | 12  | 32  |
| 10.0x  | 10%  | 10  | 23  | 29  | 45  | 96  |

## Comandi Rapidi

```bash
# Test algoritmo su 1M partite
bun cli-tester.js

# Analizza ritardi
bun analyze-delays.js

# Test TURBO
bun test-turbo.js

# Test varianti configurazione
bun test-turbo-variants.js

# Genera nuovi checkpoint
bun generate-hash-checkpoints-10M.js
```

## Note per lo Sviluppo

1. **Usa `bun` invece di `node`** - più veloce per calcoli intensivi
2. **I checkpoint coprono 10M partite** - sufficienti per test statisticamente significativi
3. **L'ordine di aggiornamento delay è cruciale** - aggiorna DOPO aver valutato la bet
4. **House edge = 1%** - ogni strategia deve compensare questa perdita attesa
