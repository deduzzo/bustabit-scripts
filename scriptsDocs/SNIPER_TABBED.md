# SNIPER_TABBED - Follow & Copy Player Bets

Script per copiare automaticamente le puntate di un altro giocatore su Bustabit in tempo reale.

---

## 📋 Caratteristiche

- ✅ **Copia automatica**: Copia bet e cashout del target
- ✅ **Cap sulla puntata**: Limita la puntata massima (se abilitato)
- ✅ **Percentuale ridotta**: Punta solo X% della bet del target (se abilitato)
- ✅ **Statistiche dettagliate**: Tracking completo di wins, losses, profit
- ✅ **Safety checks**: Balance minimo, game state validation

---

## ⚙️ Configurazione

```javascript
var config = {
    target: "",           // Username da seguire
    maxBet: 0,           // 0 = nessun limite (valore mostrato in bits)
    percBet: 0,          // 0 = copia esatta, altrimenti punta X%
    minBalance: 100,     // Balance minimo per continuare (in bits)
    showStats: true      // Mostra stats ogni 10 bets
};
```

### Parametri

| Campo | Tipo | Default | Descrizione |
|-------|------|---------|-------------|
| `target` | text | "" | Username del giocatore da seguire (case-insensitive) |
| `maxBet` | balance | 0 | Puntata massima **in bits**. **0 = disabilitato** |
| `percBet` | multiplier | 0 | Percentuale della bet del target. **0 = copia esatta (100%)** |
| `minBalance` | balance | 100 | Stop se balance < questo valore **in bits** |
| `showStats` | checkbox | true | Mostra statistiche ogni 10 bets |

**NOTA**: I campi di tipo `balance` sono mostrati all'utente in **bits** nell'interfaccia di Bustabit, ma il valore nello script è memorizzato in satoshi (1 bit = 100 satoshi).

---

## 🎯 Esempi di Configurazione

### 1. Copia Esatta (Default)
```javascript
maxBet: 0       // Nessun limite
percBet: 0      // Copia esatta
```
- Target punta 500 bits → Tu punti 500 bits
- Target punta 100 bits → Tu punti 100 bits

### 2. Con Cap Massimo
```javascript
maxBet: 200     // Max 200 bits
percBet: 0      // Copia esatta
```
- Target punta 500 bits → Tu punti **200 bits** (cappato!)
- Target punta 100 bits → Tu punti 100 bits

### 3. Percentuale Ridotta
```javascript
maxBet: 0       // Nessun limite
percBet: 10     // Punta il 10%
```
- Target punta 500 bits → Tu punti **50 bits** (10%)
- Target punta 100 bits → Tu punti **10 bits** (10%)

### 4. Percentuale + Cap
```javascript
maxBet: 200     // Max 200 bits
percBet: 50     // Punta il 50%
```
- Target punta 500 bits → Tu punti **200 bits** (50% = 250, ma cappato!)
- Target punta 400 bits → Tu punti **200 bits** (50% = 200)
- Target punta 100 bits → Tu punti **50 bits** (50%)

---

## 🔄 Logica di Calcolo

```
1. Parti dalla bet del target
   ↓
2. Applica percBet (se > 0)
   targetWager = originalBet × (percBet / 100)
   ↓
3. Applica maxBet cap (se > 0)
   if targetWager > maxBet: targetWager = maxBet
   ↓
4. Limita al balance disponibile
   finalWager = min(targetWager, balance)
   ↓
5. Piazza la bet
```

---

## 📊 Statistiche

Lo script traccia automaticamente:

```
📊 SNIPER STATS - Following: NomeUtente
──────────────────────────────────────────────
  Bets: 50 (30W / 20L) | Win Rate: 60.0%
  Wagered: 5000.00 bits
  Profit: +1250.00 bits (+12.50%)
  Balance: 11250.00 bits
  Times capped: 15x
  Streaks: Win 5 | Loss 3
══════════════════════════════════════════════
```

### Metriche

| Metrica | Descrizione |
|---------|-------------|
| **Bets** | Totale puntate piazzate |
| **Win Rate** | Percentuale di vittorie |
| **Wagered** | Totale bits puntati |
| **Profit** | Profitto/perdita totale |
| **Times capped** | Volte che la bet è stata limitata a maxBet |
| **Streaks** | Longest win/loss streak |

---

## 📝 Log Output Esempio

### Bet Normale
```
🎯 Target bet: 100.00 bits @ 2.50x
   → Your bet: 100.00 bits @ 2.50x
💰 TargetUser cashed @ 2.50x
   → You cashed @ 2.50x
✅ WIN: +100.00 bits | Balance: 10100.00 bits
```

### Bet Cappata (maxBet)
```
🎯 Target bet: 500.00 bits @ 2.50x
   → ⚠️ CAPPED to maxBet: 200.00 bits
   → Your bet: 200.00 bits @ 2.50x
💰 TargetUser cashed @ 2.50x
   → You cashed @ 2.50x
✅ WIN: +200.00 bits | Balance: 10200.00 bits
```

### Bet con Percentuale (percBet = 10%)
```
🎯 Target bet: 500.00 bits @ 2.50x
   → Applying 10% reduction: 50.00 bits
   → Your bet: 50.00 bits @ 2.50x
💰 TargetUser cashed @ 2.50x
   → You cashed @ 2.50x
✅ WIN: +50.00 bits | Balance: 10050.00 bits
```

### Bet con Percentuale + Cap
```
🎯 Target bet: 500.00 bits @ 2.50x
   → Applying 50% reduction: 250.00 bits
   → ⚠️ CAPPED to maxBet: 200.00 bits
   → Your bet: 200.00 bits @ 2.50x
💰 TargetUser cashed @ 2.50x
   → You cashed @ 2.50x
✅ WIN: +200.00 bits | Balance: 10200.00 bits
```

---

## ⚠️ Limitazioni

1. **Game State**: Funziona solo durante `GAME_STARTING`
   - Se il game è già partito, non può piazzare la bet

2. **Balance Requirement**: Devi avere balance sufficiente
   - Se balance < minBalance, lo script si ferma

3. **Target Online**: Il target deve essere online e giocare
   - Non puoi copiare se non sta giocando

4. **Timing**: Leggero delay inevitabile
   - C'è qualche millisecondo di ritardo tra la bet del target e la tua

---

## 🚨 Rischi

- ❌ **Seguire giocatori losers**: Se il target perde, perdi anche tu
- ❌ **Capitale insufficiente**: Rischi di non poter copiare tutte le bets
- ❌ **Variance alta**: La strategia del target potrebbe essere volatile
- ⚠️ **House edge**: Paghi sempre l'1% di house edge

---

## 💡 Consigli d'Uso

### ✅ BUONE PRATICHE

1. **Scegli target con track record positivo**
   - Guarda lo storico prima di copiare

2. **Usa percBet per ridurre il rischio**
   - Es: percBet = 10% → Solo il 10% dell'esposizione

3. **Imposta maxBet per limitare le perdite**
   - Es: maxBet = 20000 (200 bits max)

4. **Monitora le statistiche**
   - Se il target sta perdendo, fermati!

5. **Usa minBalance come safety**
   - Es: minBalance = 50000 (500 bits) → Stop automatico

### ❌ ERRORI COMUNI

1. ❌ Seguire qualsiasi giocatore senza verificare
2. ❌ Non impostare maxBet (rischi troppo)
3. ❌ Balance troppo piccolo per la bet size del target
4. ❌ Non monitorare i risultati
5. ❌ Copiare giocatori con strategia troppo aggressiva

---

## 🎓 Case Study

### Scenario: Seguire un "High Roller"

**Target**: Giocatore che punta 1000-5000 bits

**Problema**: Non hai 50,000+ bits di capitale

**Soluzione**:
```javascript
maxBet: 200,     // Max 200 bits per bet
percBet: 0       // Copia il target payout
```

**Risultato**:
- Target punta 5000 bits @ 2.0x → Tu punti 200 bits @ 2.0x
- Target vince +5000 bits → Tu vinci +200 bits (proporzionale)
- Limiti l'esposizione mantenendo la stessa strategia

---

## 📁 File Correlati

- **Script**: `/scripts/other/SNIPER_TABBED.js`
- **Documentazione**: `/scriptsDocs/SNIPER_TABBED.md`

---

## 🔄 Version History

### v1.0 - 2026-01-06
- ✅ Release iniziale
- ✅ Support per maxBet e percBet
- ✅ Statistiche dettagliate
- ✅ Safety checks (balance, game state)

---

## 📞 Support

Per domande o problemi:
1. Verifica la configurazione
2. Controlla i log per errori
3. Assicurati che il target sia online

---

**⚠️ DISCLAIMER**: Questo script non garantisce profitti. Il gambling comporta rischi. Usa solo capitale che puoi permetterti di perdere.
