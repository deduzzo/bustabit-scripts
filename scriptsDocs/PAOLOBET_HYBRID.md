# PAOLOBET_HYBRID

⚠️ **VERSIONE OBSOLETA** - Usa [PAOLOBET_HYBRID_V5_1](./PAOLOBET_HYBRID_V5_1.md) invece!

**Path:** `scripts/other/PAOLOBET_HYBRID.js`
**Versione Attuale:** v4.2 (DEPRECATA)
**Ultima Modifica:** 2026-01-01
**Status:** Sostituita da v5.1 (2026-01-02)

---

## ⚡ Novità - v5.1 Disponibile!

La **versione 5.1** è ora disponibile con miglioramenti significativi:

| Metrica | v4.2 | v5.1 | Miglioramento |
|---------|------|------|---------------|
| EV | -3.50% | -1.48% | **+57.7%** ✅ |
| Tail Risk | -85.06% | -27.88% | **+67.2%** ✅ |
| Mediana | +4.03% | +7.08% | **+75.7%** ✅ |
| Volatilità | 26.83% | 18.15% | **-32.4%** ✅ |
| Win Rate | 53.0% | 52.4% | -0.6% ⚠️ |

📖 **Documentazione completa:** [PAOLOBET_HYBRID_V5_1.md](./PAOLOBET_HYBRID_V5_1.md)

---

## NOTA IMPORTANTE

Questa documentazione è mantenuta per riferimento storico. **Per uso attuale, vedi v5.1.**



---

## Descrizione

Strategia di betting progressiva a due modalità con protezione cold streak.

### Modalità 1: Progressione "Salti Grandi"
- Step 1: bet @ 3.5x (28% prob)
- Step 2: bet @ 10.0x (10% prob)
- Se perdi entrambi → passa a Modalità 2

### Modalità 2: Recovery
- Target fisso a 3.5x
- Bet calcolato per recuperare perdite + 30 bits profitto
- Max 10 tentativi, poi reset

### Protezione Cold Streak
- Sospende betting dopo 4 partite consecutive senza 3.5x+
- Riprende quando: 3.5x+ arriva OPPURE dopo 12 partite

---

## Configurazione Ottimale (v4.2)

```javascript
{
  baseBetPercent: 0.2,        // % del balance per base bet
  mode1Step1Mult: 3.5,        // Target step 1
  mode1Step2Mult: 10.0,       // Target step 2
  mode1MinProfit: 30,         // Profitto minimo garantito (bits)
  mode2Target: 3.5,           // Target recovery mode
  mode2MaxBets: 10,           // Max tentativi recovery
  maxColdStreak: 4,           // Max partite senza 3.5x+
  resumeAt: 3.5,              // Resume quando arriva Xx
  resumeAfterGames: 12,       // Resume dopo N partite
  takeProfit: 20,             // Take profit % del balance
  cycleLossLimit: 100         // Max perdita % per ciclo (100=OFF)
}
```

---

## Performance (Test: 10,000 sessioni × 500 partite = 5M games)

| Metrica | Valore |
|---------|--------|
| **Expected Value (EV)** | -1.66% |
| **Win Rate** | 58.68% |
| **Mediana** | +12.30% |
| **Deviazione Standard** | 26.77% |
| **Bankruptcy Risk** | ~7-8% |
| **Avg Bets/session** | 315 |
| **Avg Games/session** | 371 |
| **Bet Efficiency** | 84.9% |
| **Min Profit** | -99.74% |
| **Max Profit** | +21.83% |

---

## Storico Ottimizzazioni

### v4.2 (2026-01-01) - OTTIMIZZAZIONE PARAMETRI

**Obiettivo:** Ridurre le perdite minimizzando l'esposizione all'house edge

**Test Effettuati:**
- 8 configurazioni diverse
- 5,000 sessioni per configurazione
- Total: 40,000 sessioni simulate

**Configurazioni Testate:**

| Nome | EV | BR | WR | Bets | Note |
|------|----|----|-----|------|------|
| **higher_targets** | -0.90% | 6.9% | 60.1% | 312 | ✅ **VINCITORE** |
| low_bet_high_mult | -0.97% | 0.2% | 48.9% | 421 | Ottimo BR, basso WR |
| conservative | -1.39% | 21.0% | 77.8% | 270 | Alto BR risk |
| baseline | -1.42% | 11.4% | 69.9% | 275 | Originale v4.1 |
| balanced | -1.57% | 12.4% | 67.3% | 308 | - |
| aggressive_protect | -1.68% | 4.3% | 54.7% | 310 | - |
| ultra_conservative | -1.73% | 18.2% | 78.6% | 351 | - |
| low_risk | -2.08% | 11.5% | 72.0% | 322 | - |

**Parametri Modificati (v4.1 → v4.2):**
```
mode1Step1Mult:   3.0x  → 3.5x   (+16.7%)
mode1Step2Mult:   8.0x  → 10.0x  (+25.0%)
mode1MinProfit:   25    → 30     (+20.0%)
mode2Target:      3.0x  → 3.5x   (+16.7%)
resumeAt:         3.0x  → 3.5x   (+16.7%)
```

**Risultati:**
- EV: -2.95% → **-1.66%** (miglioramento +43.7%)
- BR: ~12.4% → **~7-8%** (riduzione ~35%)
- WR: 68.0% → **58.68%** (trade-off accettabile)

**Validazione Finale (10,000 sessioni):**
- EV confermato: -1.66%
- Sharpe Ratio: -0.062
- Distribuzione profitti normale
- Nessun outlier anomalo

**Conclusioni:**
- ✅ Migliore configurazione trovata tra 8 varianti
- ✅ Ridotte perdite al minimo possibile
- ❌ NON batte l'house edge (1%)
- ⚠️ Perde comunque nel lungo termine

**Matematica:**
- House edge teorico: 1% per bet
- 315 bet/session × 85% efficiency = 268 bet effettivi
- Perdita teorica attesa: -2.68%
- Perdita effettiva: -1.66%
- **Battuto il teorico di 1.02 punti!** (grazie a protezioni)

---

## Analisi Stop Loss/Take Profit (2026-01-02)

### Domanda Analizzata
È possibile usare stop loss (-20%) e take profit (+50%) con strategia di buffer accumulation per rendere profittevole l'algoritmo?

### Risposta
❌ **NO** - Anche con target ottimizzati, la strategia perde nel lungo termine.

### Risultati Chiave

**Test 1: Target Originale (-20% SL / +50% TP)**
- 0/100 sessioni raggiungono +50%
- 53/100 sessioni toccano -20%
- Conclusione: Target +50% irraggiungibile (max sessione: +21.83%)

**Test 2: Target Ottimizzati**

Migliore combinazione trovata: **-10% SL / +20% TP**
```
TP Hit:       47/100 (47.0%)
SL Hit:       53/100 (53.0%)
Avg ROI:      -6.20%
EV Teorico:   +4.10%
Mediana:      -10.99%
```

**Test 3: Buffer Accumulation Strategy**
- Tutte le configurazioni falliscono (100% bankruptcy)
- 0 cicli completati
- Problema: Impossibile accumulare buffer se primo evento è stop loss

### Conclusione Matematica

**Win Rate Necessario per Profitto:**
- Con payoff ratio 2:1 (guadagni 20%, perdi 10%)
- Serve win rate > 66.7%
- Attuale: 47%
- **Gap: -19.7 punti percentuali**

**Discrepanza EV vs ROI:**
- EV teorico lineare: +4.10%
- ROI reale composto: -6.20%
- Differenza: -10.3 punti
- Causa: Compounding delle perdite

### Raccomandazioni

❌ **NON usare strategia SL/TP** con questo algoritmo
- Win rate insufficiente (47% vs 66%+ necessario)
- Alta varianza (P5: -54%, P95: +33%)
- ROI medio negativo (-6.2%) anche con best scenario

✅ **Per migliorare:**
1. Aumentare win rate base da 53% a >67%
2. Ridurre tail risk (sessioni -80%+)
3. Aumentare max profit per sessione (>22%)

---

## TODO / Miglioramenti Futuri

- [ ] Testare con balance più alto (100,000 bits) per vedere se cambia l'EV
- [ ] Sperimentare con cycle loss limit attivo (50%, 75%)
- [ ] Valutare target dinamici basati su pattern recenti
- [ ] Test A/B su sessioni più lunghe (1000+ partite)
- [ ] Analizzare correlazione tra cold streak e bankruptcy
- [ ] Ottimizzare resumeAfterGames (testare 10, 15, 20)
- [x] ~~Analisi Stop Loss/Take Profit strategy~~ ✅ Completata (2026-01-02) - Non profittevole

---

## Note Sviluppo

**File Correlati:**
- Script: `scripts/other/PAOLOBET_HYBRID.js`
- Risultati: `results/PAOLOBET_HYBRID-results.json`
- CLI tester: `bustabit-script-simulator/cli-tester.js`
- Analisi SL/TP:
  - `test/analyze-stop-loss.js`
  - `test/analyze-optimal-targets.js`
  - `test/analyze-buffer-strategy.js`
  - `test/analyze-simple-strategy.js`
  - `test/STOP-LOSS-ANALYSIS-SUMMARY.md` (report completo)

**Comandi Test:**
```bash
# Test rapido (100 sessioni)
bun cli-tester.js ../scripts/other/PAOLOBET_HYBRID.js --checkpoints10M --seeds=100

# Test completo (10,000 sessioni)
bun cli-tester.js ../scripts/other/PAOLOBET_HYBRID.js --checkpoints10M --seeds=10000

# Ottimizzazione parametri
bun test/optimize-params.js
```

**Limitazioni Note:**
1. House edge 1% imbattibile con questa strategia
2. Bankruptcy risk non azzerabile (~7-8%)
3. Alta varianza (σ=26.77%) richiede bankroll robusto
4. Performance decade con sessioni molto lunghe (>1000 partite)

---

## Versioni Precedenti

### v4.1 (Data Sconosciuta)
- mode1: 3.0x → 8.0x
- mode2: 3.0x × 10 tentativi
- EV dichiarato: +19.39% (NON confermato)
- Bankruptcy: 0.0% (NON confermato)

**Note:** Risultati non verificabili, probabilmente test limitato o parametri diversi.
