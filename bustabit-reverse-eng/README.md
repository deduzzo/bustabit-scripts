# Bustabit Reverse Engineering

Questa cartella contiene strumenti per analizzare i dati di betting raccolti tramite scraping e reverse-engineerare gli algoritmi dei giocatori.

## Struttura File

```
bustabit-reverse-eng/
├── README.md                    # Questa guida
├── data/                        # File JSON con dati scraped
│   └── *.json                   # Dati di gioco
├── analyze-player-strategy.js  # Script principale di analisi
└── results/                     # Risultati delle analisi e algoritmi ricostruiti
    └── *.js                     # Algoritmi ricostruiti
```

## Formato File Log

I file JSON con i dati scraped hanno questo formato:

```json
{
  "filter": "NomeGiocatore",
  "scrapedAt": "2026-01-06T21:58:08.890Z",
  "config": {
    "startGameId": 12637715,
    "endGameId": 12636716,
    "numGames": 1000,
    "gamesFound": 1000
  },
  "games": [
    {
      "gameId": 12637715,
      "bust": 1.01,
      "player": "NomeGiocatore",
      "bet": 14897,
      "cashedAt": null,
      "profit": -14897,
      "won": false
    }
  ]
}
```

### ⚠️ IMPORTANTE: Unità di Misura

**I valori nei file JSON sono in BIT (non satoshi):**

- `bet: 14897` = **14897 bit** di Bustabit
- `profit: -14897` = **-14897 bit**
- `cashedAt: 13.41` = **moltiplicatore 13.41x**
- `bust: 1.01` = **moltiplicatore 1.01x**

**Conversione Bit ↔ Satoshi:**
```
1 bit Bustabit = 100 satoshi
14897 bit = 1489700 satoshi
```

**Per gli script Bustabit:**
- Gli script lavorano internamente in satoshi
- `bet: 14897` bit nel JSON → `game.bet(1489700)` nello script
- Ma nei log mostri sempre i bit: `(amount / 100) + ' bits'`

**Per il simulatore:**
- Passa i valori in bit, il simulatore converte automaticamente
- `baseBet: 14897` nel config del simulatore = 14897 bit effettivi

### Ordine dei Dati

**IMPORTANTE:** I dati nel file sono in ordine **INVERSO** (dal più recente al più vecchio).

Per analizzare correttamente la strategia del giocatore:
1. Ordina i dati per `gameId` crescente
2. Analizza le sequenze in ordine cronologico
3. Cerca pattern di progressione (dopo win/loss)

```javascript
// Ordina in ordine cronologico (più vecchio → più recente)
const playerBets = data.games.filter(g => g.player === TARGET_PLAYER);
playerBets.sort((a, b) => a.gameId - b.gameId); // ✅ Ordine corretto
```

## Script di Analisi

### analyze-player-strategy.js

Script principale per analizzare la strategia di un giocatore.

**Uso:**
```bash
cd bustabit-reverse-eng
node analyze-player-strategy.js data/FILENAME.json PLAYER_NAME
```

**Output:**
- Pattern dei bet (fisso, martingale, progressione)
- Strategia di cashout (target, range, distribuzione)
- Win/loss pattern (win rate, streaks)
- Analisi progressione (dopo win/loss)
- Sequenza cronologica dei primi 20 bet
- Profitto/ROI totale
- Ipotesi sul tipo di strategia

### Metriche Chiave

| Metrica | Significato |
|---------|-------------|
| **Win Rate** | % di partite vinte |
| **Average Cashout** | Moltiplicatore medio di cashout |
| **Longest Loss Streak** | Numero massimo di perdite consecutive |
| **ROI** | Return on Investment (profitto/totale puntato) |
| **Bet Ratio After Loss** | Rapporto tra bet dopo perdita (2.0x = martingale) |

## Workflow di Reverse Engineering

1. **Raccolta Dati**
   - Usa lo scraper Tampermonkey in `../bustabit-scraping/`
   - Salva i file JSON in `data/`
   - Raccogli almeno 500-1000 games per player

2. **Analisi Pattern**
   ```bash
   node analyze-player-strategy.js data/FILENAME.json PLAYER_NAME
   ```

3. **Identificazione Strategia**
   - Fixed Bet: Sempre stesso importo
   - Martingale: Raddoppia dopo perdita
   - Progressive: Pattern di incremento custom
   - High Multiplier Hunter: Target alto (10x+), basso win rate

4. **Ricostruzione Algoritmo**
   - Crea nuovo script JS in `results/PLAYER_NAME.js`
   - Implementa la logica identificata
   - Usa il formato degli script Bustabit standard

5. **Test con Simulatore**
   ```bash
   cd ../bustabit-script-simulator
   bun cli-tester.js ../bustabit-reverse-eng/results/PLAYER_NAME.js --checkpoints10M
   ```

## Tipi di Strategie Comuni

### Fixed Bet (Flat Betting)
- Sempre stesso importo
- Target di cashout può variare
- Esempio: 149 bit fissi, target 10-20x random

### Martingale
- Raddoppia dopo perdita
- Reset dopo vincita
- Alto rischio di bankrupt

### High Multiplier Hunter
- Bet fisso basso
- Target molto alto (10x+)
- Win rate basso (~10%)
- Profit da poche vincite alte

### Progressive Custom
- Incremento basato su pattern specifico
- Non raddoppio classico
- Logica custom (es. +10% dopo loss)

## Note Importanti

- **Non modificare i file JSON originali** in `data/`
- **Salva sempre i risultati** in `results/`
- **Documenta le ipotesi** nei commenti dello script ricostruito
- **Confronta le performance** con i dati reali (ROI, win rate)
- **I dati sono in bit effettivi** - non fare conversioni satoshi

## Esempio Completo

```bash
# 1. Analizza il player
node analyze-player-strategy.js data/player_data.json Pandurangavithala

# Output:
# - Fixed bet: 14897 bit
# - Target: 10-20x (avg 13.5x)
# - Win rate: 9.2%
# - ROI: +7.5%

# 2. Crea algoritmo
# → results/Pandurangavithala_HIGH_MULTIPLIER.js

# 3. Testa
cd ../bustabit-script-simulator
bun cli-tester.js ../bustabit-reverse-eng/results/Pandurangavithala_HIGH_MULTIPLIER.js
```

## Cartelle da Usare

| Scopo | Cartella |
|-------|----------|
| Dati scraped | `bustabit-reverse-eng/data/` |
| Script di analisi | `bustabit-reverse-eng/` |
| Algoritmi ricostruiti | `bustabit-reverse-eng/results/` |
| Test simulazioni | `bustabit-script-simulator/` |
| Script finali pronti | `scripts/other/` (dopo verifica) |
