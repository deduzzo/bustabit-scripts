// Bustabit Game Data Scraper - Automated Browser Version
// Requires manual execution of browser automation steps
// by Claude Code

const fs = require('fs');
const path = require('path');

// =============================================================================
// CONFIGURAZIONE
// =============================================================================
const CONFIG = {
    filterPlayer: 'Pandurangavithala',  // null, "all", o nome specifico
    startGameId: 12636793,
    numGames: 100,
    outputDir: '../bustabit-real-data'
};

// =============================================================================
// DATA STORAGE
// =============================================================================
const gamesData = [];

// =============================================================================
// EXTRACTION SCRIPT (to be executed in browser console)
// =============================================================================
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

  // Extract bust from dialog content
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

// =============================================================================
// INSTRUCTIONS
// =============================================================================
console.log('═'.repeat(80));
console.log(' BUSTABIT AUTOMATED SCRAPER - BROWSER AUTOMATION');
console.log('═'.repeat(80));
console.log('');
console.log('Questo scraper deve essere eseguito manualmente con Claude Code.');
console.log('');
console.log('ISTRUZIONI:');
console.log('');
console.log(`1. Apri Chrome e naviga a: https://bustabit.com/game/${CONFIG.startGameId}`);
console.log('');
console.log(`2. Per ogni partita da ${CONFIG.startGameId} a ${CONFIG.startGameId - CONFIG.numGames + 1}:`);
console.log('   a) Aspetta il caricamento completo (2 secondi)');
console.log('   b) Esegui lo script di estrazione usando mcp__claude-in-chrome__javascript_tool');
console.log('   c) Salva i risultati');
console.log('   d) Naviga alla partita precedente (game ID - 1)');
console.log('');
console.log('3. Salva tutti i dati in JSON');
console.log('');
console.log('SCRIPT DI ESTRAZIONE DA USARE:');
console.log('─'.repeat(80));
console.log(EXTRACTION_SCRIPT);
console.log('─'.repeat(80));
console.log('');
console.log('Configurazione:');
console.log(`  Filter:       ${CONFIG.filterPlayer || 'ALL PLAYERS'}`);
console.log(`  Start Game:   #${CONFIG.startGameId}`);
console.log(`  Num Games:    ${CONFIG.numGames}`);
console.log(`  Output Dir:   ${CONFIG.outputDir}`);
console.log('');
console.log('═'.repeat(80));
