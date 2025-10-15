# 🎮 Martin AI - Configurazioni Alternative

## Configurazione Attuale (Ottimale per 50k bits)

Il file `martinSimpleAiv2.js` ora usa la **configurazione ottimale**:

```javascript
{
  payout: 3.2,
  mult: 1.45,
  maxTimes: 25,
  waitBeforePlay: 0
}
```

**Risultati**: 94.3% success, +10.67% profit, Sharpe 28.7

---

## 📋 Altre Configurazioni Testate

### 1. 🥇 **OTTIMALE** - M1.45-P3.2x-T25-W0 (ATTUALE)

```javascript
{
  payout: 3.2,
  mult: 1.45,
  maxTimes: 25,
  waitBeforePlay: 0
}
```

| Metrica | Valore |
|---------|--------|
| Success Rate | **94.3%** |
| Profit medio | **+10.67%** (+5.333 bits) |
| Sharpe Ratio | **28.683** ⭐⭐⭐ |
| Positive Rate | 99.99% |
| Drawdown | 14.2% |

**Quando usarla**: Sempre! È la migliore per 50k bits.

---

### 2. 🥈 **MASSIMA AFFIDABILITÀ** - M1.48-P3.1x-T25-W0

```javascript
{
  payout: 3.1,
  mult: 1.48,
  maxTimes: 25,
  waitBeforePlay: 0
}
```

| Metrica | Valore |
|---------|--------|
| Success Rate | **96.2%** ← Più alto! |
| Profit medio | +10.19% (+5.096 bits) |
| Sharpe Ratio | 26.451 |
| Positive Rate | 100% |
| Drawdown | 17.3% |

**Quando usarla**: Vuoi massima probabilità di successo (96%+).

**Come cambiare**:
```javascript
// In martinSimpleAiv2.js, cambia:
payout: { value: 3.1, ... },
mult: { value: 1.48, ... },
```

---

### 3. 💰 **MASSIMO PROFITTO** - M1.48-P3.2x-T25-W0

```javascript
{
  payout: 3.2,
  mult: 1.48,
  maxTimes: 25,
  waitBeforePlay: 0
}
```

| Metrica | Valore |
|---------|--------|
| Success Rate | 94.0% |
| Profit medio | **+14.40%** (+7.200 bits) ← MASSIMO! |
| Sharpe Ratio | 9.805 |
| Positive Rate | 100% |
| Drawdown | 17.4% |

**Quando usarla**: Vuoi massimizzare profitti, tolleri drawdown più alto.

**Come cambiare**:
```javascript
// In martinSimpleAiv2.js, cambia:
payout: { value: 3.2, ... },
mult: { value: 1.48, ... },
```

---

### 4. 🛡️ **MASSIMA SICUREZZA** - M1.51-P3x-T23-W2

```javascript
{
  payout: 3.0,
  mult: 1.51,
  maxTimes: 23,
  waitBeforePlay: 2  // ← Wait Mode attivo!
}
```

| Metrica | Valore |
|---------|--------|
| Success Rate | 96.5% |
| Profit medio | +6.34% (+3.171 bits) |
| Sharpe Ratio | 12.895 |
| Positive Rate | 100% |
| Drawdown | **13.1%** ← Più basso! |

**Quando usarla**: Hai capitale limitato (30-40k bits), preferisci massima sicurezza.

**Come cambiare**:
```javascript
// In martinSimpleAiv2.js, cambia:
payout: { value: 3.0, ... },
mult: { value: 1.51, ... },
maxTimes: { value: 23, ... },
waitBeforePlay: { value: 2, ... },  // ← Attiva wait mode
```

**Nota**: Con wait mode giochi ~3.000 partite invece di 4.000.

---

### 5. ⚖️ **BALANCE** - M1.48-P3x-T25-W0

```javascript
{
  payout: 3.0,
  mult: 1.48,
  maxTimes: 25,
  waitBeforePlay: 0
}
```

| Metrica | Valore |
|---------|--------|
| Success Rate | 96.5% |
| Profit medio | +6.78% (+3.388 bits) |
| Sharpe Ratio | 6.700 |
| Positive Rate | 99.9% |
| Drawdown | 16.2% |

**Quando usarla**: Vuoi un buon compromesso tra profit e sicurezza.

**Come cambiare**:
```javascript
// In martinSimpleAiv2.js, cambia:
payout: { value: 3.0, ... },
mult: { value: 1.48, ... },
```

---

## 🔄 Come Cambiare Configurazione

### Metodo 1: Modifica Diretta

1. Apri `martinSimpleAiv2.js`
2. Trova la sezione `var config = {`
3. Cambia i valori di `payout`, `mult`, `maxTimes`, `waitBeforePlay`
4. Salva il file

### Metodo 2: Tramite UI Bustabit

Se Bustabit permette di modificare i parametri tramite interfaccia:
1. Clicca sull'icona settings dello script
2. Modifica i valori
3. Riavvia lo script

---

## 📊 Guida alla Scelta

### In base al CAPITALE disponibile

| Capitale | Configurazione Consigliata | Success | Profit |
|----------|----------------------------|---------|--------|
| **30-40k bits** | M1.51-P3x-T23-W2 (Sicurezza) | 96.5% | +6.3% |
| **50k bits** | **M1.45-P3.2x-T25-W0 (Ottimale)** ✅ | **94.3%** | **+10.7%** |
| **60-80k bits** | M1.48-P3.2x-T25-W0 (Max Profit) | 94.0% | +14.4% |
| **100k+ bits** | Qualsiasi config funziona | 99%+ | Variabile |

---

### In base all'OBIETTIVO

| Obiettivo | Configurazione |
|-----------|----------------|
| **Massimo profit** | M1.48-P3.2x-T25-W0 (+14.4%) |
| **Massima affidabilità** | M1.48-P3.1x-T25-W0 (96.2%) |
| **Minimo rischio** | M1.51-P3x-T23-W2 (13.1% drawdown) |
| **Balance perfetto** | **M1.45-P3.2x-T25-W0** ✅ |

---

### In base al TEMPO disponibile

| Tempo Disponibile | Config | Note |
|-------------------|--------|------|
| **2-3 ore** | Qualsiasi senza wait | 4.000 partite |
| **1.5-2 ore** | Con wait mode (W2) | ~3.000 partite |
| **4+ ore** | Aumenta `stopDefinitive` | Es. 7.500 partite |

---

## 🎯 Matrice Comparativa Completa

| Config | Success | Profit | Sharpe | Drawdown | Positive | Capitale Min |
|--------|---------|--------|--------|----------|----------|--------------|
| **M1.45-P3.2x-T25-W0** ✅ | **94.3%** | **10.7%** | **28.7** | 14.2% | 99.99% | 50k |
| M1.48-P3.1x-T25-W0 | 96.2% | 10.2% | 26.5 | 17.3% | 100% | 50k |
| M1.48-P3.2x-T25-W0 | 94.0% | 14.4% | 9.8 | 17.4% | 100% | 60k |
| M1.51-P3x-T23-W2 | 96.5% | 6.3% | 12.9 | 13.1% | 100% | 30k |
| M1.48-P3x-T25-W0 | 96.5% | 6.8% | 6.7 | 16.2% | 99.9% | 50k |

---

## ⚠️ Configurazioni NON Raccomandate

### ❌ Originale (M1.51-P3.1x-T23-W0)

```javascript
{
  payout: 3.1,
  mult: 1.51,
  maxTimes: 23,
  waitBeforePlay: 0
}
```

**Perché evitarla**:
- Success rate solo 73% (vs 94% ottimale)
- Sharpe ratio 4.1 (vs 28.7 ottimale)
- Drawdown 17.5% (vs 14.2% ottimale)

**È stata superata dalla configurazione ottimizzata!**

---

### ❌ Configurazioni con mult > 1.6x

**Troppo aggressive**:
- Crescita troppo rapida
- Capitale insufficiente per gestire streak negative
- Success rate <80%

---

### ❌ Configurazioni con payout > 3.5x

**Win rate troppo basso**:
- Payout 3.5x = ~28% win rate
- Troppe perdite consecutive
- Richiede capitale enorme (>100k)

---

## 💡 Tips per Ottimizzare Ulteriormente

### 1. Regola in base al Balance Real-Time

Se hai capitale extra durante la sessione:
```javascript
// Dopo una serie di vittorie consecutive:
if (balance > initBalance * 1.3) {
  // Sei +30%, considera di aumentare leggermente mult
  // Es. da 1.45 a 1.48
}
```

### 2. Stop Loss Dinamico

Implementa stop loss basato su drawdown:
```javascript
const currentDrawdown = ((initBalance - balance) / initBalance) * 100;
if (currentDrawdown > 18) {
  // Ferma la sessione se drawdown supera 18%
  pfx('STOP', 'Drawdown limit reached');
}
```

### 3. Take Profit

Ritira profitti regolarmente:
```javascript
if (balance >= initBalance * 1.5) {
  pfx('PROFIT', 'Target +50% reached!');
  // Ritira profitto, riparti con capitale iniziale
}
```

---

## 📞 Quick Reference

### Config Veloce per Copia-Incolla

**Ottimale (attuale)**:
```
payout: 3.2 | mult: 1.45 | maxTimes: 25 | wait: 0
```

**Massima Affidabilità**:
```
payout: 3.1 | mult: 1.48 | maxTimes: 25 | wait: 0
```

**Massimo Profitto**:
```
payout: 3.2 | mult: 1.48 | maxTimes: 25 | wait: 0
```

**Massima Sicurezza**:
```
payout: 3.0 | mult: 1.51 | maxTimes: 23 | wait: 2
```

---

## 🔬 Testing

Se vuoi testare una nuova configurazione prima di usarla in produzione:

1. Modifica `martin-optimization-100k.js`
2. Aggiungi la tua config alla lista
3. Esegui: `bun martin-optimization-100k.js`
4. Confronta i risultati

---

**La configurazione attuale (M1.45-P3.2x-T25-W0) è già ottimale per 50k bits!**

Non c'è bisogno di cambiarla a meno che tu non abbia esigenze specifiche diverse.
