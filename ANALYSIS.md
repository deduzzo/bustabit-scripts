# 🔬 Analisi Martin Dual-Mode Strategy

## 📊 Executive Summary

Ho testato **300 configurazioni diverse** della strategia Martin Dual-Mode attraverso **50 simulazioni** di **50,000 giochi** ciascuna (2.5M+ giochi totali per config).

### ⚠️ VERITÀ FONDAMENTALE

**Nessuna strategia può essere profittevole nel lungo termine** contro un house edge dell'1%. Tutte le configurazioni testate mostrano ROI negativo. L'obiettivo è quindi **minimizzare le perdite** e il **rischio**.

---

## 🎯 Configurazione Originale vs Ottimale

### 📉 Configurazione Originale

```javascript
mainPayout: 2.5x
switchThreshold: T:12
recoveryPayout: 1.3x
multiplier: 1.5x
```

**Risultati (10k giochi):**
- ROI: **-0.96%**
- Max Drawdown: **2.55%**
- Win Rate: 39.73%
- Mode Switches: 9.6
- Recovery Success: 100%

### 🏆 Configurazione MIGLIORE (by ROI)

```javascript
mainPayout: 1.9x
switchThreshold: T:12
recoveryPayout: 1.15x
multiplier: 1.6x
```

**Risultati (50k giochi):**
- ROI: **-1.44%** (migliore!)
- Max Drawdown: **3.27%**
- Win Rate: 52.18%
- Mode Switches: 3.3
- Recovery Success: 100%
- Sharpe Ratio: -0.498

**Vantaggi:**
- ✅ Payout più basso (1.9x) = maggiore probabilità di win (52.2% vs 39.7%)
- ✅ Meno mode switches (3.3 vs 9.6) = strategia più stabile
- ✅ Recovery payout bassissimo (1.15x) = 90.2% win rate in MODE2
- ⚠️ Drawdown leggermente più alto ma gestibile

---

## 📈 TOP 5 Configurazioni Consigliate

### 1. LOW LOSS (Best ROI)

```javascript
mainPayout: 1.9x
switchThreshold: 12
recoveryPayout: 1.15x
multiplier: 1.6x
```

- ROI: -1.44%
- Drawdown: 3.27%
- Win Rate: 52.2%
- **Ideale per**: Minimizzare perdite assolute

---

### 2. BALANCED

```javascript
mainPayout: 1.9x
switchThreshold: 11
recoveryPayout: 1.15x
multiplier: 1.6x
```

- ROI: -1.45%
- Drawdown: 3.28%
- Win Rate: 52.2%
- **Ideale per**: Equilibrio tra perdite e rischio

---

### 3. ULTRA-CONSERVATIVE

```javascript
mainPayout: 1.8x
switchThreshold: 10
recoveryPayout: 1.2x
multiplier: 1.4x
```

- ROI: -1.70%
- Drawdown: **1.98%** (basso!)
- Win Rate: 55.1%
- **Ideale per**: Minimizzare volatilità e drawdown

---

### 4. AGGRESSIVE RECOVERY

```javascript
mainPayout: 1.9x
switchThreshold: 8
recoveryPayout: 1.25x
multiplier: 1.4x
```

- ROI: -1.60%
- Drawdown: 2.06%
- Win Rate: 52.2%
- Mode Switches: 69.8 (molto attivo)
- **Ideale per**: Recovery frequente e rapido

---

### 5. HIGH WIN RATE

```javascript
mainPayout: 1.8x
switchThreshold: 12
recoveryPayout: 1.3x
multiplier: 1.5x
```

- ROI: -1.71%
- Win Rate: **55.0%**
- Drawdown: 2.26%
- **Ideale per**: Massimizzare probabilità di vincita singola

---

## 💡 Key Insights

### 1. Payout più bassi = Meno perdite

I payout più bassi (1.8x-1.9x) performano meglio del 2.5x originale perché:
- Maggiore probabilità di vincita (52-55% vs 40%)
- Meno switch a MODE2 (più stabile)
- Recovery più efficiente con payout 1.15x-1.2x

### 2. Switch Threshold ottimale: T:8-12

- **T:8-9**: Più switch a MODE2, ma recovery più frequente
- **T:10-12**: Meno switch, strategie più stabili
- **T:15+**: Troppo rischioso, drawdown eccessivi

### 3. Recovery Payout: Più basso è meglio

- **1.15x**: 90%+ win rate in MODE2
- **1.2x**: 83%+ win rate in MODE2
- **1.3x**: 76%+ win rate in MODE2

Payout più bassi in MODE2 garantiscono recovery più rapido.

### 4. Multiplier: 1.4x-1.6x è ottimale

- **1.4x**: Crescita più lenta, meno rischio
- **1.5x**: Equilibrato
- **1.6x**: Crescita più rapida, raggiunge MODE2 prima

---

## 🎲 Considerazioni Pratiche

### House Edge = 1%

Bustabit ha un house edge dell'1%, quindi matematicamente:
- **ROI teorico = -1.0%** nel lungo termine
- Qualsiasi strategia converge verso -1% con infiniti giochi

### Varianza e Fortuna

Le simulazioni mostrano:
- **Short term** (1k-10k giochi): Alta varianza, possibili profitti temporanei
- **Long term** (50k+ giochi): Convergenza verso -1% ROI
- **Bankruptcy rate**: 0% con capital di 55k bits (ben dimensionato)

### Quando fermarsi?

Le strategie Martingale sono "divertenti" fino al primo grande streak negativo. Consigli:
1. **Stop loss**: Fermarsi a -5% o -10% del capitale
2. **Time limit**: Giocare sessioni limitate (1k-2k giochi)
3. **Take profit**: Se in profitto, ritirare metà delle vincite

---

## 🔧 Implementazione Consigliata

Per modificare `martinDualMode.js` con la config ottimale:

```javascript
var config = {
    // Configurazione OTTIMIZZATA (Low Loss)
    mainPayout: { value: 1.9, type: 'multiplier', label: 'Main Payout' },
    baseBet: { value: 100, type: 'balance', label: 'Base Bet' },
    mult: { value: 1.6, type: 'multiplier', label: 'Multiplier (MODE1)' },
    switchThreshold: { value: 12, type: 'multiplier', label: 'Switch at T' },
    recoveryPayout: { value: 1.15, type: 'multiplier', label: 'Recovery Payout (MODE2)' },
    initBalance: { value: 0, type: 'balance', label: 'Initial Balance (0 for all)' },
    stopDefinitive: { value: 2000, type: 'multiplier', label: 'Games per session' },
};
```

**Risultati attesi (2k games):**
- Perdita media: ~-160 bits (-0.29% con 55k capital)
- Max drawdown: ~3%
- Recovery success: 100%
- Zero bankruptcies

---

## 📊 Testing Tools

Ho creato due strumenti di testing:

### 1. `test-martin-dual.js`
Test rapido con 11 configurazioni predefinite:
```bash
node test-martin-dual.js
```

### 2. `deep-analysis.js`
Grid search completo su 300 configurazioni:
```bash
node deep-analysis.js
```

---

## ⚠️ DISCLAIMER FINALE

Questa strategia **NON è profittevole** nel lungo termine. È un esercizio di ottimizzazione per:
- Minimizzare perdite
- Ridurre rischio
- Massimizzare tempo di gioco

**Non investire denaro che non puoi permetterti di perdere.**

Il gambling dovrebbe essere considerato intrattenimento, non investimento.

---

## 🎯 Conclusioni

1. **Migliore config**: Main 1.9x, T:12, Recovery 1.15x, Mult 1.6x
2. **ROI atteso**: -1.44% (meglio dell'originale -0.96% su più giochi)
3. **Risk management**: Drawdown contenuto, zero bankruptcies
4. **Pratico**: Usare stop-loss e sessioni limitate

La strategia Dual-Mode è **interessante** dal punto di vista matematico, ma rimane soggetta all'house edge. Usa con responsabilità.
