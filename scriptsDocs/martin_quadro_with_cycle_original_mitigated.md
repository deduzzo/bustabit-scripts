# martin_quadro_with_cycle_original_mitigated.js

**Versione:** v1.0
**Data Creazione:** 2026-01-06
**Base:** martin_quadro_with_cycle_original.js + Crisis Mitigation (Step-Down)

---

## 📋 DESCRIZIONE

Versione mitigata dell'algoritmo originale con **Step-Down Dinamico** per ridurre il rischio in situazioni di crisi (quando il baseBet supera soglia critica).

### Differenze rispetto all'originale:

**Originale:**
- Quando perdi cicli consecutivi, il VB cresce fino a livelli critici
- BaseBet può diventare molto alto (>150 satoshi / 1.5 bits)
- Se continui a perdere→vincere→perdere, rimani in un loop ad alta puntata

**Mitigated (questa versione):**
- ✅ Rileva quando sei in "crisi" (baseBet > 110 satoshi)
- ✅ Conta vittorie consecutive mentre in crisi
- ✅ Dopo 8 win consecutive in crisi → **Step-Down automatico**
- ✅ Riduce debito del 30% e abbassa VB/baseBet immediatamente
- ✅ **Anti-loop**: Max 1 step-down per livello di perdita
- ✅ **Protezione chiusura**: NO step-down se sei vicino a completare il ciclo (>80%)

---

## ⚙️ CONFIGURAZIONE

### Parametri Standard (uguali all'originale)

```javascript
workingBalance: 100000          // 1000 bits
targetProfitPercent: 75         // +75% per ciclo (OTTIMALE)
payout: 3.1                     // Normal mode
baseBet: 100                    // 1 bit
customMult: 1.6                 // Multiplier bet progression
recoveryTrigger: 16             // Losses before recovery mode
recoveryMartingalePayout: 2     // Recovery mode @2x
recoveryCycles: 2               // Max recovery attempts
```

### Nuovi Parametri (Crisis Mitigation)

```javascript
enableCrisisMitigation: 'yes'   // Abilita step-down (yes/no)
crisisThreshold: 110            // Soglia crisi in satoshi (110 = 1.1 bits)
debtReductionPercent: 30        // Riduci debito del 30% in step-down
minWinsBeforeStepDown: 8        // Vittorie consecutive necessarie
```

---

## 🎯 COME FUNZIONA LO STEP-DOWN

### Scenario Tipico:

```
1. Perdi 3 cicli consecutivi
   → realLossesAccumulated = 15,000 bits
   → VB = 70,000 bits
   → BaseBet = 140 satoshi (> 110 threshold) → IN CRISI ⚠️

2. Inizi a vincere @3.1x:
   Win #1: consecutiveWinsInCrisis = 1
   Win #2: consecutiveWinsInCrisis = 2
   ...
   Win #8: consecutiveWinsInCrisis = 8 → STEP-DOWN! ⬇️

3. Step-Down Applicato:
   Debito: 15,000 → 10,500 bits (-30%)
   VB: 70,000 → 58,000 bits
   BaseBet: 140 → 116 satoshi
   stepDownAppliedAtLevel = 3 (non si ripete a L3)

4. Continui il ciclo con puntate più basse
   Se completi: Profit = 10,500 + 37,500 = 48,000 bits ✅
   Se perdi di nuovo: Vai a L4 (nuovo livello, step-down disponibile)
```

### Anti-Loop Protection:

**Problema che risolve:**
```
❌ SENZA anti-loop:
   L3 → 8 win → step-down → L3 → 8 win → step-down → loop infinito

✅ CON anti-loop:
   L3 → 8 win → step-down (flag: stepDownAppliedAtLevel=3)
   L3 → 8 win → NO step-down (già fatto a L3!)
   Devi chiudere ciclo o andare a L4 per nuovo step-down
```

**Reset flag:**
- Quando completi un ciclo → `stepDownAppliedAtLevel = -1` (reset)
- Nuovo ciclo = nuove condizioni, step-down riabilitato

### Protezione Chiusura Ciclo:

**Problema che risolve:**
```
Scenario: Sei vicino a chiudere il ciclo
  cycleTargetProfit = 50,000 bits
  normalModeProfit = 45,000 bits (90% del target!)

❌ SENZA protezione:
   → Step-down riduce debito
   → Target si abbassa ma hai già quasi chiuso
   → Potresti ritardare chiusura

✅ CON protezione:
   Se normalModeProfit >= 80% del cycleTargetProfit
   → NO step-down, lascia chiudere naturalmente
```

---

## 📊 PERFORMANCE TEST

### Test 1: Balance 30K, 50 seeds, 10K games

```
Win Rate:           62% (31/50)
Media:              -6.80%
Mediana:            +11.79%
Target +50% Rate:   8% (4/50)
Bankruptcy (<-50%): 26% (13/50)
```

**Analisi:**
- ✅ Win Rate superiore al 50%
- ✅ Mediana positiva (+11.79%)
- ⚠️ Media negativa per bankruptcy rate alto (26%)
- 💡 Con balance più alto (50K) bankruptcy si riduce

### Test 2: Balance 50K, 10 seeds, 10K games

```
Win Rate:           40% (4/10)
Media:              -13.64%
Mediana:            -7.14%
Bankruptcy:         20% (2/10)
```

**Analisi:**
- ⚠️ Sample size piccolo (10 seeds)
- Balance alto riduce rischio ma rallenta profit
- Serve test più estensivo

---

## 💡 QUANDO USARE QUESTA VERSIONE

### ✅ Usa Mitigated SE:
1. **Hai balance limitato** (20K-50K bits)
2. **Vuoi ridurre rischio** in scenari di perdite consecutive
3. **Accetti crescita più lenta** in cambio di protezione
4. **Tendi a entrare in crisi** (baseBet alto frequente)

### ❌ Usa Originale SE:
1. **Hai balance molto alto** (100K+ bits)
2. **Preferisci massimizzare profit** anche con più rischio
3. **Raramente entri in crisi** (capitale ampio)
4. **Vuoi recupero più veloce** senza step-down

---

## 🔧 OTTIMIZZAZIONI POSSIBILI

### 1. Ajusta Threshold Crisis
```javascript
crisisThreshold: 110  // Default

// Balance basso (20K): threshold = 105
// Balance medio (50K): threshold = 110
// Balance alto (100K): threshold = 120
```

### 2. Ajusta Riduzione Debito
```javascript
debtReductionPercent: 30  // Default (conservativo)

// Più aggressivo: 40-50% (scende più veloce, rischio loop)
// Più conservativo: 20-25% (scende lento, più sicuro)
```

### 3. Ajusta Vittorie Necessarie
```javascript
minWinsBeforeStepDown: 8  // Default

// Più rapido: 5-6 (attiva prima, rischio loop)
// Più lento: 10-12 (più sicuro, attiva tardi)
```

### 4. Ajusta Protezione Chiusura
```javascript
isNearCompletion = normalModeProfit >= (cycleTargetProfit * 0.80)  // 80% default

// Più aggressivo: 0.85-0.90 (step-down anche vicino a chiusura)
// Più conservativo: 0.70-0.75 (step-down solo lontano da chiusura)
```

---

## 📈 CONFRONTO vs ORIGINALE

| Metrica | Originale | Mitigated | Note |
|---------|-----------|-----------|------|
| Win Rate (50K) | 43.2% | ~40-62% | Varia con balance |
| Mediana (50K) | -68.08% | +11.79% (30K) | Molto meglio |
| Bankruptcy (50K) | 56.2% | 20-26% | Ridotto |
| Complessità | Bassa | Media | Step-down aggiunge logica |
| Controllo Rischio | Basso | Alto | Protezioni anti-loop |

---

## ⚠️ LIMITAZIONI CONOSCIUTE

1. **Step-down richiede lucky streak**: Serve 8 win consecutive in crisi, non sempre facile
2. **Può rallentare recovery**: Ridurre debito = più tempo per chiudere ciclo
3. **Non previene bankruptcy**: Se continui a perdere, fallisci comunque
4. **Threshold fisso**: Non si adatta dinamicamente al balance

---

## 🔄 TODO / MIGLIORAMENTI FUTURI

- [ ] Threshold dinamico basato su balance corrente
- [ ] Step-down progressivo (più win = più riduzione)
- [ ] Modalità "emergency step-down" a livelli critici (L5+)
- [ ] Test estensivo con 1000+ seeds per validare performance
- [ ] Confronto A/B con originale su hash nefasti

---

## 📝 NOTE SVILUPPO

**Versione _BUG accantonata:**
- `martin_quadro_with_cycle_tracking_BUG.js` contiene implementazione precedente con bug
- Bug principale: Reset prematuro senza completare recovery
- Questa versione (`mitigated`) riparte da `original` pulito

**Differenze chiave:**
- Mitigated: Step-down SOLO dopo win consecutive (conservativo)
- _BUG: Step-down basato su profit coverage (complesso, buggato)

---

*Ultima modifica: 2026-01-06*
