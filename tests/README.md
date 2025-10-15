# 🧪 Test & Optimization Suite

Suite completa per testare e ottimizzare le strategie Bustabit.

## 📁 Struttura

```
tests/
├── optimization/     # Script di ottimizzazione parametri
├── analysis/         # Analisi approfondite delle strategie
└── verification/     # Test di verifica correttezza
```

## 🔬 Optimization Scripts

### martin-alternating-mode.js
Ottimizza la strategia alternating mode testando:
- Main payout: [2.5x, 2.8x, 3.0x]
- Recovery payout: [1.1x, 1.15x, 1.2x, 1.25x, 1.3x]
- Multiplier: [1.5x, 1.6x]
- Alternate every: [1, 2, 3, 4, 5]

**Esecuzione:**
```bash
node tests/optimization/martin-alternating-mode.js
```

**Output:** `results/json/martin-alternating-mode-results.json`

---

### martin-dual-mode.js
Ottimizza la strategia dual mode testando:
- Switch threshold: [10, 11, 12, 13, 14]
- Recovery payout: [1.05x, 1.1x, 1.15x, 1.2x]
- Main payout: [3.1x]
- Multiplier: [1.6x]

**Esecuzione:**
```bash
node tests/optimization/martin-dual-mode.js
```

**Output:** `results/json/martin-dual-mode-results.json`

---

### martin-capital-optimizer.js
Testa diverse quantità di capitale per trovare l'ottimale.

**Test:** 100k, 105k, 110k, 1M, 1.5M, 2M bits

**Esecuzione:**
```bash
node tests/optimization/martin-capital-optimizer.js
```

**Output:**
- `results/json/martin-capital-optimizer-results.json`
- `results/csv/martin-detailed-{capital}bits.csv`

---

## 📊 Analysis Scripts

### algorithm-analyzer.js
Analizza in dettaglio una configurazione specifica:
- Distribuzione profitti
- Pattern di win/loss
- Drawdown analysis
- Risk metrics

**Esecuzione:**
```bash
node tests/analysis/algorithm-analyzer.js
```

---

### deep-analysis.js / deep-analysis-v2.js
Analisi approfondita multi-configurazione con:
- Monte Carlo simulation
- Sharpe ratio
- Kelly criterion
- Value at Risk (VaR)

**Esecuzione:**
```bash
node tests/analysis/deep-analysis-v2.js
```

---

### analyze-single-session.js
Analizza una singola sessione di gioco in dettaglio:
- Play-by-play breakdown
- Bet progression tracking
- Balance evolution
- Critical moments identification

---

## ✅ Verification Scripts

### test-direct-hash.js
Verifica il calcolo corretto dei crash point da hash.

### test-real-hashes.js
Testa con hash reali da Bustabit.

### verify-real-data.js
Confronta risultati simulati con dati reali.

### verify-progression.js
Verifica la correttezza della progressione martingale.

**Esecuzione rapida:**
```bash
cd tests/verification
node verify-progression.js
```

---

## 🎯 Workflow Consigliato

### 1. Verifica Base
```bash
# Verifica che il calcolo hash sia corretto
node tests/verification/test-real-hashes.js

# Verifica progressione bet
node tests/verification/verify-progression.js
```

### 2. Ottimizzazione
```bash
# Testa nuova strategia con vari parametri
node tests/optimization/martin-alternating-mode.js

# Risultati in results/json/
```

### 3. Analisi Approfondita
```bash
# Analizza la configurazione migliore
node tests/analysis/algorithm-analyzer.js

# Deep analysis con metriche di rischio
node tests/analysis/deep-analysis-v2.js
```

### 4. Test Reale
```bash
# Simula una sessione reale
node tests/analysis/analyze-single-session.js
```

---

## 📈 Metriche di Output

Tutti gli script di ottimizzazione producono:

### JSON Results
```json
{
  "capital": 55000,
  "totalGames": 4000000,
  "best": {
    "config": {...},
    "totalAbsoluteProfit": -430636,
    "avgProfitPercent": -0.39,
    "successRate": 100,
    "positiveRate": 11.35
  },
  "topConfigurations": [...]
}
```

### CSV Results
```csv
Seed,Config,FinalBalance,Profit,ProfitPercent,GamesPlayed,Wins,Losses,MaxDrawdown,Reason
94aa...,P2.5x-M1.5x,54569364,-430636,-0.78,4000000,1618235,2381765,12.4,completed
```

---

## 🔧 Configurazione Test

Tutti gli script usano:
- **Capital:** 5,500,000 bits (55k bits)
- **Total Games:** 4,000,000
- **Chunk Size:** 2,000
- **Number of Chunks:** 2,000
- **Start Hash:** `94aa062026624e59a0ace092568d5f46e21b9bf1d5173609db8645dd62bdfc44`

---

## ⚙️ Personalizzazione

Per modificare i parametri di test, edita le costanti all'inizio di ogni script:

```javascript
const START_HASH = '94aa062026624e59a0ace092568d5f46e21b9bf1d5173609db8645dd62bdfc44';
const TOTAL_GAMES = 4000000;
const CHUNK_SIZE = 2000;
const NUM_CHUNKS = 2000;
const CAPITAL = 5500000; // 55k bits
```

---

## 💡 Tips

1. **Parallelizzazione:** Usa più core per test più veloci
2. **Cache Results:** Salva i crash generati per riutilizzarli
3. **Incremental Testing:** Parti con pochi parametri, poi espandi
4. **Real Seeds:** Usa sempre seed reali da Bustabit per accuratezza
5. **Statistical Significance:** Testa su almeno 1M+ games per risultati affidabili
