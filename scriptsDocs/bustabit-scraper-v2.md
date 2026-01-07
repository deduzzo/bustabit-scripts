# Bustabit Scraper v2 - Documentazione

**Script**: `bustabit-scraping/bustabit-scraper-v2.user.js`
**Versione**: 2.1
**Tipo**: Tampermonkey/Userscript
**Utilizzo**: Raccolta dati da Bustabit.com per analisi algoritmi

---

## Panoramica

Scraper Tampermonkey che raccoglie dati delle partite da Bustabit.com tramite interfaccia grafica draggable.

### Features Principali

- ✅ Scraping fino a **100.000 partite**
- ✅ Filtraggio per **player specifico**
- ✅ **Raccolta completa**: include partite dove il player NON ha giocato (essenziale per analisi)
- ✅ Live multiplier monitor con auto-cashout @ 5.xx
- ✅ Hotkey personalizzato (SPACE) per cashout rapido
- ✅ History display ultimi 50 busts
- ✅ Panel draggable e minimizzabile

---

## Installazione

1. Installa [Tampermonkey](https://www.tampermonkey.net/) su Chrome/Firefox
2. Crea nuovo script e incolla il contenuto di `bustabit-scraper-v2.user.js`
3. Salva e visita https://bustabit.com/game/

---

## Utilizzo

### Scraping Base

1. Apri una partita su Bustabit: `https://bustabit.com/game/XXXXXX`
2. Il panel apparirà in alto a destra
3. Configura numero partite (default: 100, max: 100.000)
4. Clicca **START SCRAPING**
5. Download automatico del JSON al termine

### Filtraggio per Player

1. Clicca su **"all players"** nel panel
2. Inserisci lo username esatto del player
3. Avvia lo scraping

**⚠️ IMPORTANTE**: Quando filtri per player, lo scraper raccoglie **TUTTE le partite**, anche quelle dove il player NON ha giocato!

---

## 🎯 Player Detection - Come Funziona

### Player HA GIOCATO

```json
{
  "gameId": 123456,
  "bust": 2.45,
  "player": "username",
  "bet": 10000,           // ← ha valore
  "cashedAt": 2.10,       // ← ha valore (o null se busted)
  "profit": 11000,        // ← ha valore
  "won": true             // ← ha valore
}
```

### Player NON HA GIOCATO

```json
{
  "gameId": 123457,
  "bust": 1.52,
  "player": "username",
  "bet": null,            // ← null = non ha giocato
  "cashedAt": null,       // ← null = non ha giocato
  "profit": null,         // ← null = non ha giocato
  "won": null             // ← null = non ha giocato
}
```

### Identificazione nel Codice

```javascript
// Controlla se il player ha giocato
if (game.bet === null) {
    // Player NON ha giocato questa partita
    console.log(`Skip game #${game.gameId}`);
} else {
    // Player HA giocato
    console.log(`Bet: ${game.bet}, CashedAt: ${game.cashedAt}`);
}
```

### Calcolo Frequenza Reale

```javascript
const totalGames = data.games.length;
const playedGames = data.games.filter(g => g.bet !== null).length;
const frequency = (playedGames / totalGames) * 100;

console.log(`Frequency: ${frequency.toFixed(1)}%`);
```

---

## 📊 Formato Output JSON

### Struttura File Scaricato

```json
{
  "filter": "username",
  "scrapedAt": "2025-01-07T12:34:56.789Z",
  "config": {
    "startGameId": 123456,
    "endGameId": 124456,
    "numGames": 1000,
    "gamesFound": 1000
  },
  "games": [
    {
      "gameId": 123456,
      "bust": 2.45,
      "player": "username",
      "bet": 10000,
      "cashedAt": 2.10,
      "profit": 11000,
      "won": true
    },
    {
      "gameId": 123457,
      "bust": 1.52,
      "player": "username",
      "bet": null,
      "cashedAt": null,
      "profit": null,
      "won": null
    }
  ]
}
```

**Filename**: `{timestamp}_{player}_{numGames}games.json`
Esempio: `1704630896789_paolo_1000games.json`

---

## 🔍 Perché Include Partite "Skip"?

### Motivi Critici per l'Analisi

1. **Skip Pattern Detection**
   - Identificare quando il player sceglie di NON giocare
   - Correlazione tra busts precedenti e decisione di skip

2. **Frequenza Reale**
   - Calcolare `games played / total games`
   - Esempio: 156 giocate su 1000 = 15.6% frequenza

3. **Ricostruzione Algoritmo**
   - Capire la logica di delay/cooldown
   - Identificare trigger conditions (es: skip dopo bust < 1.5x)

4. **Pattern Temporali**
   - Sequenze di skip consecutive
   - Ritorno al betting dopo N skip

### Esempio Analisi

```javascript
// Trova pattern di skip dopo low busts
const skipAfterLowBust = data.games.reduce((count, game, i) => {
    if (i === 0) return count;
    const prevGame = data.games[i - 1];

    // Se il game precedente era < 1.5x e questo è skip
    if (prevGame.bust < 1.5 && game.bet === null) {
        count++;
    }
    return count;
}, 0);

console.log(`Skip after low bust: ${skipAfterLowBust} times`);
```

---

## 🎮 Live Features

### Auto-Cashout @ 5.xx

1. Attiva il toggle **Auto-Cashout**
2. Target randomizzato: 5.00x - 5.99x
3. Cashout automatico con compensazione delay (~200ms)
4. Reset ad ogni nuova partita

### Live Multiplier

- Aggiornamento ogni 100ms
- Colori dinamici:
  - 🟢 Verde: < 2.0x
  - 🟡 Giallo: 2.0x - 5.0x
  - 🔵 Cyan: 5.0x - 10.0x
  - 🟣 Viola: > 10.0x
  - 🔴 Rosso: BUSTED

### SPACE Hotkey

- Press **SPACE** durante la partita per cashout immediato
- Bypassa il button UI di Bustabit
- Non funziona in input/textarea

---

## 📈 Console Output

### Durante lo Scraping

```
[SCRAPER] Starting scrape with config: { filterPlayer: 'paolo', numGames: 1000 }
[SCRAPER] Game #123456: 12 players, bust: 2.45x
[SCRAPER] Clicking Prev Game → #123455
[SCRAPER] Page #123455 loaded successfully
```

### Al Completamento (Player Filtrato)

```
[SCRAPER] Downloaded: 1704630896789_paolo_1000games.json
Player: paolo
Total games scraped: 1000
Games played: 156 (15.6%)
Wins: 92 (59.0%)
Profit: +234 bits
ROI: +12.45%
```

### Se Player Non Ha Giocato Mai

```
Player: paolo
Total games scraped: 1000
Games played: 0 - Player didn't play in any of the scraped games
```

---

## ⚙️ Configurazione

### Via Panel UI

- **Number of Games**: +/- buttons o double-click per edit manuale
- **Filter Player**: Click per aprire prompt
- **Auto-Cashout**: Toggle ON/OFF

### Via Console

```javascript
// Modifica config runtime
window.scraperConfig.numGames = 5000;
window.scraperConfig.filterPlayer = 'paolo';

console.log(window.scraperConfig);
```

---

## 🚀 Use Cases

### 1. Reverse Engineering Algoritmo

```bash
# Raccogli 10.000 partite di un player
1. Set numGames = 10000
2. Set filterPlayer = "target_username"
3. START SCRAPING
4. Analizza il JSON con analyze-player-strategy.js
```

### 2. Analisi Pattern Skip

```javascript
// Identifica sequenze di skip
const games = require('./paolo_10000games.json').games;

let maxSkipStreak = 0;
let currentStreak = 0;

games.forEach(g => {
    if (g.bet === null) {
        currentStreak++;
        maxSkipStreak = Math.max(maxSkipStreak, currentStreak);
    } else {
        currentStreak = 0;
    }
});

console.log(`Max skip streak: ${maxSkipStreak}`);
```

### 3. Testing Algorithm Ricostruito

```bash
cd bustabit-reverse-eng
node analyze-player-strategy.js data/paolo_10000games.json paolo
# Output: ricostruisce algoritmo in results/paolo.js
```

---

## 🛠️ Troubleshooting

### Scraping Si Ferma

- **Causa**: "Prev Game" button non trovato
- **Soluzione**: Verifica di essere su una pagina `/game/XXXXX` valida

### Download Non Parte

- **Causa**: Browser blocca download automatici
- **Soluzione**: Autorizza download multipli da bustabit.com

### Player Non Trovato

- **Causa**: Username errato o player non ha giocato nel range
- **Soluzione**: Verifica spelling esatto e aumenta numGames

### Delay Troppo Lungo

- **Causa**: Bustabit rate limiting
- **Soluzione**: Riduci velocità di scraping (wait viene gestito automaticamente)

---

## 📝 Note Tecniche

### Algoritmo di Generazione Partite

Lo scraper usa la stessa chain hash di Bustabit:
```javascript
const saltBytes = Buffer.from(GAME_SALT, 'utf8');
const hash = hmacSha256(saltBytes, gameHash);
// ... calcolo bust multiplier
```

### Rilevamento Caricamento Pagina

```javascript
// Aspetta che:
// 1. URL cambi al gameId atteso
// 2. Tabella players sia presente
// 3. Tabella abbia almeno 1 row di dati
// Timeout: 5000ms
```

### Performance

- **100 games**: ~30 secondi
- **1.000 games**: ~5 minuti
- **10.000 games**: ~50 minuti
- **100.000 games**: ~8 ore (overnight scraping)

---

## 📚 File Correlati

- **Script**: `bustabit-scraping/bustabit-scraper-v2.user.js`
- **Analyzer**: `bustabit-reverse-eng/analyze-player-strategy.js`
- **Output**: `bustabit-reverse-eng/data/*.json`

---

## 🔄 Changelog

### v2.1 (2025-01-07)
- ✅ Aumentato limite a 100.000 partite
- ✅ **FEATURE**: Include partite dove player non ha giocato (bet=null)
- ✅ Statistiche console migliorate (total games vs games played)
- ✅ Documentazione completa detection logic

### v2.0 (2024-XX-XX)
- ✅ Control panel draggable
- ✅ Live multiplier monitor
- ✅ Auto-cashout @ 5.xx
- ✅ SPACE hotkey per cashout
- ✅ History display
- ✅ Player filtering

---

## 💡 Tips per Analisi

### Identificare Strategia "Delay"

```javascript
// Cerca pattern tipo "aspetta 3 busts < 2x prima di giocare"
const games = data.games;
let delayPattern = [];

for (let i = 3; i < games.length; i++) {
    const prev3 = games.slice(i-3, i);
    const current = games[i];

    if (prev3.every(g => g.bust < 2.0) && current.bet !== null) {
        delayPattern.push(i);
    }
}

console.log(`Found ${delayPattern.length} matches for delay pattern`);
```

### Calcolare Average Bet

```javascript
const playedGames = data.games.filter(g => g.bet !== null);
const avgBet = playedGames.reduce((sum, g) => sum + g.bet, 0) / playedGames.length;
console.log(`Average bet: ${(avgBet/100).toFixed(2)} bits`);
```

### Identificare Martingale

```javascript
// Cerca progressioni 2x del bet
let martingaleSequences = 0;

for (let i = 1; i < games.length; i++) {
    const prev = games[i-1];
    const curr = games[i];

    if (prev.bet && curr.bet && curr.bet === prev.bet * 2 && !prev.won) {
        martingaleSequences++;
    }
}

console.log(`Martingale sequences: ${martingaleSequences}`);
```

---

## ⚠️ Limitazioni

1. **Scraping Velocità**: Limitata dal DOM rendering di Bustabit
2. **Rate Limiting**: Bustabit potrebbe bloccare scraping troppo aggressivo
3. **Memory Usage**: 100k partite = ~50MB JSON
4. **Player Must Exist**: Username deve essere esatto (case-sensitive)

---

## 🎯 Roadmap Future

- [ ] Export CSV oltre a JSON
- [ ] Filtering per date range
- [ ] Real-time statistics durante scraping
- [ ] Multi-player tracking simultaneo
- [ ] Backup automatico ogni N games
