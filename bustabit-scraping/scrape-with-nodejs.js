#!/usr/bin/env node
// Bustabit Scraper - Automated con MCP Chrome
// Questo script coordina Claude Code per fare scraping automatico

const fs = require('fs');
const path = require('path');

const CONFIG = {
    filterPlayer: 'Pandurangavithala',
    startGameId: 12636793,
    numGames: 100,
    delayMs: 2500,
    outputDir: path.join(__dirname, '..', 'bustabit-real-data')
};

console.log('═'.repeat(80));
console.log(' BUSTABIT SCRAPER - Node.js Orchestrator');
console.log('═'.repeat(80));
console.log('');
console.log('Questo script guida Claude Code attraverso il processo di scraping.');
console.log('');
console.log('CONFIG:');
console.log('  Filter:        ', CONFIG.filterPlayer || 'ALL');
console.log('  Start Game:    ', CONFIG.startGameId);
console.log('  Num Games:     ', CONFIG.numGames);
console.log('  Delay:         ', CONFIG.delayMs, 'ms');
console.log('  Output:        ', CONFIG.outputDir);
console.log('');
console.log('═'.repeat(80));
console.log('');
console.log('ISTRUZIONI PER CLAUDE CODE:');
console.log('');
console.log('Claude, esegui questi step per ogni game:');
console.log('');
console.log('1. Navigate to URL');
console.log('2. Wait 2-3 seconds');
console.log('3. Use find tool per trovare la tabella "Busted at:"');
console.log('4. Use javascript_tool per estrarre tutti i dati');
console.log('5. Salva in array');
console.log('6. Ripeti');
console.log('');
console.log('Al termine salva tutto in JSON.');
console.log('');
console.log('═'.repeat(80));

module.exports = { CONFIG };
