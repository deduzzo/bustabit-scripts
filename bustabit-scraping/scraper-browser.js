// Bustabit Game Data Scraper - Browser Automation Version
// Uses MCP Claude-in-Chrome tools to extract data from rendered pages
// by Claude Code

const fs = require('fs');
const path = require('path');

// =============================================================================
// CONFIGURAZIONE
// =============================================================================
const CONFIG = {
    // Filtro player: null/"all" = tutti i giocatori, "PlayerName" = solo quel player
    filterPlayer: 'Pandurangavithala',  // null, "all", o nome specifico

    startGameId: 12636793,
    numGames: 10,  // Start small for testing
    delayMs: 2000,  // Delay to let pages load
    outputDir: '../bustabit-real-data'
};

// =============================================================================
// ISTRUZIONI PER L'UTENTE
// =============================================================================
console.log('═'.repeat(80));
console.log(' BUSTABIT BROWSER-BASED SCRAPER');
console.log('═'.repeat(80));
console.log('');
console.log('Questo scraper richiede l\'uso degli strumenti MCP claude-in-chrome.');
console.log('');
console.log('Per eseguirlo, chiedi a Claude Code di:');
console.log('');
console.log('1. Aprire un nuovo tab Chrome');
console.log('2. Per ogni game ID:');
console.log('   - Navigare a https://bustabit.com/game/<gameId>');
console.log('   - Attendere il caricamento della pagina (2 secondi)');
console.log('   - Estrarre i dati dal DOM usando read_page tool');
console.log('   - Parsare i dati e aggiungerli alla lista');
console.log('3. Salvare i risultati in JSON');
console.log('');
console.log('Configurazione:');
console.log(`  Filter:       ${CONFIG.filterPlayer || 'ALL PLAYERS'}`);
console.log(`  Start Game:   #${CONFIG.startGameId}`);
console.log(`  Games Back:   ${CONFIG.numGames}`);
console.log(`  Delay:        ${CONFIG.delayMs}ms per page`);
console.log('');
console.log('═'.repeat(80));
console.log('');
console.log('Per ora questo è solo un template.');
console.log('Chiedi a Claude Code di implementare la logica usando gli MCP tools!');
console.log('');
