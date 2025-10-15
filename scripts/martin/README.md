# 🎯 Strategie Martingale

Collezione di strategie basate sul sistema Martingale ottimizzate per Bustabit.

## 📋 Script Disponibili

### ⭐️ martinAlternatingMode.js - **RACCOMANDATO**
Alterna continuamente tra payout principale (2.5x) e payout sicuro (1.1x).

**Configurazione:**
```javascript
mainPayout: 2.5x
recoveryPayout: 1.1x
mult: 1.5x
alternateEvery: 1
```

**Performance:**
- ROI: -0.39%
- Success Rate: 100%
- Bankrupt Rate: 0%
- Capitale min: 55k bits

---

### 🔄 martinDualMode.js
Passa da martingale classico a fixed-bet recovery dopo threshold.

**Configurazione:**
```javascript
mainPayout: 2.5x
switchThreshold: 12
recoveryPayout: 1.3x
mult: 1.5x
```

**Performance:**
- ROI: -0.71%
- Success Rate: 100%
- Recovery Success: 99.9%
- Capitale min: 55k bits

---

### 🤖 martinSimpleAiv2.js
Martingale classico ottimizzato con AI su 100k seed.

**Configurazione:**
```javascript
payout: 3.1x
mult: 1.51x
maxTimes: 25
waitBeforePlay: 0
```

**Performance:**
- Success Rate: 94.3%
- Profit: +10.67% per sessione
- Sharpe Ratio: 28.683
- Capitale min: 50k bits

---

### 📊 Script Legacy

Altri script martingale disponibili:
- `martin15confused.js` - Variante confusa (deprecato)
- `martin15optimistic.js` - Variante ottimistica
- `martin15simply.js` - Versione semplificata
- `martinflat.js` - Martingale flat bet
- `martinflatnew.js` - Martingale flat bet v2
- `martinflatnewflat.js` - Martingale flat bet v3
- `marginalex151.js` - Moltiplicatore 1.51x
- `marginale2x3.js` - Payout 2x-3x

## 🎮 Come Usare

1. Copia il contenuto dello script desiderato
2. Vai su Bustabit → Console Script
3. Incolla il codice
4. (Opzionale) Modifica i parametri nel `config`
5. Avvia lo script

## 📈 Progressione Bet

Tutti gli script martingale seguono la formula:
```javascript
nextBet = Math.ceil((currentBet / 100) * multiplier) * 100
```

### Esempio con mult 1.5x:
```
T:0  - bet: 1 bits    - total: 1 bits
T:1  - bet: 2 bits    - total: 3 bits
T:2  - bet: 2 bits    - total: 5 bits
T:3  - bet: 3 bits    - total: 8 bits
T:4  - bet: 5 bits    - total: 13 bits
T:5  - bet: 8 bits    - total: 21 bits
...
T:20 - bet: 3325 bits - total: 11083 bits
T:22 - bet: 7484 bits - total: 24967 bits
```

## ⚠️ Rischi

- Il martingale richiede capitale crescente esponenzialmente
- Sequenze lunghe possono causare bankruptcy
- Anche le migliori config hanno ROI negativo a lungo termine
- Usa sempre stop-loss e capitale adeguato

## 💡 Consigli

1. **Capitale:** Usa almeno 55k bits (550 volte il base bet)
2. **Stop-Loss:** Imposta un limite di perdita massima
3. **Session Length:** 4000 games è una buona durata
4. **Testing:** Testa sempre su carta prima di giocare con denaro reale
5. **Varianti:** Martin Alternating Mode ha le migliori performance

## 🔬 Testing

Per testare una configurazione:
```bash
# Torna alla root del progetto
cd ../..

# Esegui l'optimizer
node tests/optimization/martin-alternating-mode.js
```

Risultati salvati in `results/json/`
