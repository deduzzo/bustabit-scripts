// Bustabit MCP Chrome Scraper
// Script di coordinamento per Claude Code con MCP Chrome tools
//
// Questo script viene eseguito da Node.js e genera i comandi per Claude Code
// Claude Code userà poi gli strumenti MCP Chrome per fare lo scraping

const fs = require('fs');
const path = require('path');

const CONFIG = {
    filterPlayer: 'Pandurangavithala',  // null per tutti i giocatori
    startGameId: 12636793,
    numGames: 100,
    delayMs: 2000,  // Delay tra richieste
    outputDir: path.join(__dirname, '..', 'bustabit-real-data')
};

console.log('═'.repeat(80));
console.log(' BUSTABIT MCP CHROME SCRAPER - CONFIGURATION');
console.log('═'.repeat(80));
console.log('');
console.log('Filter Player:  ', CONFIG.filterPlayer || 'ALL PLAYERS');
console.log('Start Game ID:  ', CONFIG.startGameId);
console.log('Num Games:      ', CONFIG.numGames);
console.log('Delay:          ', CONFIG.delayMs, 'ms');
console.log('Output Dir:     ', CONFIG.outputDir);
console.log('');
console.log('═'.repeat(80));
console.log('');
console.log('ISTRUZIONI PER CLAUDE CODE:');
console.log('');
console.log('Per ogni game da', CONFIG.startGameId, 'a', CONFIG.startGameId - CONFIG.numGames + 1, ':');
console.log('');
console.log('1. Navigate to: https://bustabit.com/game/{gameId}');
console.log('2. Wait 2-3 seconds for JavaScript to load data');
console.log('3. Use javascript_tool to extract data with this script:');
console.log('');
console.log('─'.repeat(80));
console.log(EXTRACTION_SCRIPT);
console.log('─'.repeat(80));
console.log('');
console.log('4. Save extracted data to array');
console.log('5. Repeat for next game');
console.log('');
console.log('6. After all games, save to JSON file in:', CONFIG.outputDir);
console.log('');
console.log('═'.repeat(80));

const EXTRACTION_SCRIPT = `
(function() {
  const gameData = {
    gameId: null,
    bust: null,
    players: []
  };

  // Extract Game ID from URL
  const urlMatch = window.location.pathname.match(/\\/game\\/(\\d+)/);
  if (urlMatch) gameData.gameId = parseInt(urlMatch[1]);

  // Extract bust value
  const bustTexts = Array.from(document.querySelectorAll('*')).filter(el =>
    el.textContent.trim().match(/^\\d+\\.\\d+x$/) &&
    el.previousElementSibling &&
    el.previousElementSibling.textContent.trim() === 'Busted at:'
  );
  if (bustTexts.length > 0) {
    const bustMatch = bustTexts[0].textContent.trim().match(/([\\d.]+)x/);
    if (bustMatch) gameData.bust = parseFloat(bustMatch[1]);
  }

  // Find players table
  const tables = document.querySelectorAll('table');
  let playersTable = null;
  for (const table of tables) {
    const firstRow = table.querySelector('tr');
    if (firstRow && firstRow.textContent.includes('Player') && firstRow.textContent.includes('Bet')) {
      playersTable = table;
      break;
    }
  }

  if (playersTable) {
    const rows = playersTable.querySelectorAll('tbody tr, tr');

    for (const row of rows) {
      const cells = row.querySelectorAll('td');
      if (cells.length < 4) continue;

      // Player name
      const playerLink = cells[0].querySelector('a[href^="/user/"]');
      if (!playerLink) continue;
      const playerName = playerLink.textContent.trim();

      // Bet
      const betText = cells[1].textContent.trim().replace(/,/g, '');
      const bet = parseFloat(betText);
      if (isNaN(bet)) continue;

      // Cashed Out
      const cashedOutText = cells[2].textContent.trim();
      let cashedAt = null;
      if (cashedOutText !== '-' && !cashedOutText.includes('Friend')) {
        const cashMatch = cashedOutText.match(/([\\d.]+)x/);
        if (cashMatch) cashedAt = parseFloat(cashMatch[1]);
      }

      // Profit
      const profitText = cells[3].textContent.trim().replace(/,/g, '');
      const profit = parseFloat(profitText);
      const won = profit > 0;

      gameData.players.push({
        player: playerName,
        bet,
        cashedAt,
        profit: isNaN(profit) ? -bet : profit,
        won
      });
    }
  }

  return gameData;
})();
`;

// Export config for external use
module.exports = { CONFIG, EXTRACTION_SCRIPT };
