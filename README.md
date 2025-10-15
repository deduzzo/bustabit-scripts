# 🎲 Bustabit Strategy Scripts

Una collezione completa di strategie ottimizzate per Bustabit, con analisi approfondite basate su seed reali e milioni di simulazioni.

## 📁 Struttura del Progetto

```
bustabit-scripts/
├── scripts/              # Script pronti per Bustabit
│   ├── martin/          # Strategie Martingale
│   ├── fibonacci/       # Strategie Fibonacci
│   ├── hybrid/          # Strategie ibride
│   └── other/           # Altre strategie
├── tests/               # Test e ottimizzazione
│   ├── optimization/    # Script di ottimizzazione parametri
│   ├── analysis/        # Analisi approfondite
│   └── verification/    # Test di verifica
├── tools/               # Utility e strumenti
├── results/             # Risultati delle simulazioni
│   ├── json/           # Risultati in formato JSON
│   └── csv/            # Risultati in formato CSV
├── docs/                # Documentazione e report
└── archive/             # Script sperimentali/deprecati
```

## 🏆 Strategie Raccomandate

### 1. Martin Alternating Mode ⭐️ **BEST**
**Script:** [`scripts/martin/martinAlternatingMode.js`](scripts/martin/martinAlternatingMode.js)

Alterna continuamente tra payout principale e payout sicuro, mantenendo sempre la progressione martingale.

**Configurazione ottimale:**
- Main Payout: `2.5x`
- Recovery Payout: `1.1x`
- Multiplier: `1.5x`
- Alternate Every: `1` (alterna ogni giocata)

**Performance (testata su 4M games):**
- ✅ ROI: `-0.39%` (migliore del 53% vs Martin standard!)
- ✅ Success Rate: `100%`
- ✅ Bankrupt Rate: `0%`
- ✅ MODE2 Ratio: `38.1%`
- 💰 Capitale raccomandato: `55,000 bits`

**Come funziona:**
1. Gioca 1 partita puntando a 2.5x con progressione martingale
2. Gioca 1 partita puntando a 1.1x con la STESSA progressione
3. Ripete il ciclo continuamente
4. Reset quando esce il main payout (2.5x)

---

### 2. Martin Dual Mode
**Script:** [`scripts/martin/martinDualMode.js`](scripts/martin/martinDualMode.js)

Passa da martingale normale a fixed-bet recovery dopo un threshold.

**Configurazione ottimale:**
- Main Payout: `2.5x`
- Switch Threshold: `T:12`
- Recovery Payout: `1.3x`
- Multiplier: `1.5x`

**Performance:**
- ✅ ROI: `-0.71%` (migliore del 15% vs Martin standard)
- ✅ Success Rate: `100%`
- ✅ Recovery Success: `99.9%`
- 💰 Capitale raccomandato: `55,000 bits`

**Come funziona:**
1. **MODE1 (T:0 → T:12):** Martin classico con moltiplicatore 1.5x
2. **MODE2 (T:12+):** Fixed bet, punta a 1.3x fino al reset
3. Quando esce 2.5x in MODE2 → reset completo

---

### 3. Martin Simple AI v2
**Script:** [`scripts/martin/martinSimpleAiv2.js`](scripts/martin/martinSimpleAiv2.js)

Martingale classico ottimizzato con parametri testati su 100k seed.

**Configurazione ottimale:**
- Payout: `3.1x`
- Multiplier: `1.51x`
- Max Times: `25`
- Wait Before Play: `0`

**Performance:**
- ✅ Success Rate: `94.3%`
- ✅ Profit medio: `+10.67%` per sessione
- ✅ Sharpe Ratio: `28.683`
- 💰 Capitale raccomandato: `50,000 bits`

---

## 📊 Confronto Strategie

| Strategia | ROI % | Success Rate | Bankrupt Rate | Capitale Min |
|-----------|-------|--------------|---------------|--------------|
| **Martin Alternating Mode** | **-0.39%** | **100%** | **0%** | 55k bits |
| Martin Dual Mode | -0.71% | 100% | 0% | 55k bits |
| Martin Simple AI v2 | +10.67%* | 94.3% | 5.7% | 50k bits |
| Martin Standard | -0.84% | 94.3% | 5.7% | 50k bits |

*Per sessione di 4000 games

## 🚀 Quick Start

### Installazione
```bash
git clone https://github.com/yourusername/bustabit-scripts.git
cd bustabit-scripts
npm install  # se necessario per i test
```

### Utilizzo su Bustabit

1. Vai su [Bustabit](https://www.bustabit.com)
2. Apri la console degli script
3. Copia il contenuto dello script desiderato
4. Incolla nella console
5. Configura i parametri (opzionale)
6. Avvia lo script

### Test e Ottimizzazione

```bash
# Testare Martin Alternating Mode
node tests/optimization/martin-alternating-mode.js

# Testare Martin Dual Mode
node tests/optimization/martin-dual-mode.js

# Analisi approfondita
node tests/analysis/algorithm-analyzer.js
```

## 🛠️ Strumenti Disponibili

### Verifier
**Script:** [`tools/bustabit-verifier.js`](tools/bustabit-verifier.js)

Verifica la correttezza del calcolo dei crash point usando i seed reali di Bustabit.

### Seed Generator
**Script:** [`tools/real-bustabit-seed-generator.js`](tools/real-bustabit-seed-generator.js)

Genera sequenze di crash point reali usando l'algoritmo provably fair di Bustabit.

## 📈 Risultati delle Simulazioni

Tutti i risultati sono disponibili nella cartella [`results/`](results/):

- **JSON:** Risultati dettagliati con tutte le metriche
- **CSV:** Dati grezzi per analisi custom

### Ultimi risultati:
- [`martin-alternating-mode-results.json`](results/json/martin-alternating-mode-results.json)
- [`martin-dual-mode-results.json`](results/json/martin-dual-mode-results.json)
- [`martin-real-seed-results.json`](results/json/martin-real-seed-results.json)

## 📚 Documentazione

Report dettagliati disponibili in [`docs/`](docs/):

- **Quick Start:** Guida rapida per iniziare
- **Analysis Reports:** Analisi approfondite delle strategie
- **Optimization Reports:** Report delle ottimizzazioni parametri
- **Real Seeds Analysis:** Confronto seed reali vs simulati

## ⚠️ Disclaimer

**IMPORTANTE:** Questi script sono forniti solo a scopo educativo e di ricerca. Il gambling comporta rischi finanziari significativi.

- Nessuna strategia garantisce profitti
- Anche le migliori configurazioni mostrano ROI negativi su grandi campioni
- Il vantaggio della casa è sempre presente
- Gioca responsabilmente e solo con denaro che puoi permetterti di perdere

## 🤝 Contributing

Contributi, issue e feature request sono benvenuti!

1. Fork del progetto
2. Crea un branch per la tua feature (`git checkout -b feature/AmazingFeature`)
3. Commit delle modifiche (`git commit -m 'Add some AmazingFeature'`)
4. Push al branch (`git push origin feature/AmazingFeature`)
5. Apri una Pull Request

## 📝 License

Questo progetto è distribuito sotto licenza MIT. Vedi `LICENSE` per maggiori informazioni.

## 🔗 Link Utili

- [Bustabit](https://www.bustabit.com)
- [Provably Fair Documentation](https://bitcointalk.org/index.php?topic=922898.0)
- [Bustabit API](https://github.com/bustabit)

---

**Made with ❤️ by deduzzo**
