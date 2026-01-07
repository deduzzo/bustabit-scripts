// Bustabit Game Data Scraper - Puppeteer Version
// Fully automated browser scraping
// by Claude Code

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

// =============================================================================
// CONFIGURAZIONE
// =============================================================================
const CONFIG = {
    filterPlayer: 'Pandurangavithala',  // null, "all", o nome specifico
    startGameId: 12636793,
    numGames: 10,  // TEST: 10 partite
    delayMs: 1500,  // Delay tra richieste
    outputDir: '../bustabit-real-data',
    headless: false  // Mostra il browser
};

// =============================================================================
// STATE
// =============================================================================
const state = {
    gamesData: [],
    errors: 0,
    startTime: null
};

// =============================================================================
// EXTRACTION FUNCTION
// =============================================================================
async function extractGameData(page) {
    return await page.evaluate(() => {
        const data = {
            gameId: null,
            bust: null,
            players: []
        };

        // Game ID from URL
        const urlMatch = window.location.pathname.match(/\/game\/(\d+)/);
        if (urlMatch) data.gameId = parseInt(urlMatch[1]);

        // Bust value
        const bustElements = Array.from(document.querySelectorAll('*')).filter(el =>
            el.textContent.trim().match(/^\d+\.\d+x$/) &&
            el.previousElementSibling &&
            el.previousElementSibling.textContent.trim() === 'Busted at:'
        );
        if (bustElements.length > 0) {
            const bustMatch = bustElements[0].textContent.trim().match(/([\d.]+)x/);
            if (bustMatch) data.bust = parseFloat(bustMatch[1]);
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

                const playerLink = cells[0].querySelector('a[href^="/user/"]');
                if (!playerLink) continue;
                const playerName = playerLink.textContent.trim();

                const betText = cells[1].textContent.trim().replace(/,/g, '');
                const bet = parseFloat(betText);
                if (isNaN(bet)) continue;

                const cashedOutText = cells[2].textContent.trim();
                let cashedAt = null;
                if (cashedOutText !== '-' && !cashedOutText.includes('Friend')) {
                    const cashMatch = cashedOutText.match(/([\d.]+)x/);
                    if (cashMatch) cashedAt = parseFloat(cashMatch[1]);
                }

                const profitText = cells[3].textContent.trim().replace(/,/g, '');
                const profit = parseFloat(profitText);
                const won = profit > 0;

                data.players.push({
                    player: playerName,
                    bet,
                    cashedAt,
                    profit: isNaN(profit) ? -bet : profit,
                    won
                });
            }
        }

        return data;
    });
}

// =============================================================================
// SCRAPER
// =============================================================================
async function scrape() {
    console.log('═'.repeat(80));
    console.log(' BUSTABIT PUPPETEER SCRAPER');
    console.log('═'.repeat(80));
    console.log(`Filter:       ${CONFIG.filterPlayer || 'ALL PLAYERS'}`);
    console.log(`Start Game:   #${CONFIG.startGameId}`);
    console.log(`Num Games:    ${CONFIG.numGames}`);
    console.log(`Delay:        ${CONFIG.delayMs}ms`);
    console.log('═'.repeat(80));
    console.log('');

    state.startTime = Date.now();

    // Launch browser
    const browser = await puppeteer.launch({ headless: CONFIG.headless });
    const page = await browser.newPage();

    for (let i = 0; i < CONFIG.numGames; i++) {
        const gameId = CONFIG.startGameId - i;
        const url = `https://bustabit.com/game/${gameId}`;

        try {
            console.log(`[${i + 1}/${CONFIG.numGames}] Fetching game #${gameId}...`);

            // Navigate
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 10000 });

            // Wait for content
            await new Promise(resolve => setTimeout(resolve, CONFIG.delayMs));

            // Extract data
            const gameData = await extractGameData(page);

            if (gameData && gameData.players.length > 0) {
                state.gamesData.push(gameData);

                // Log player if filtering
                if (CONFIG.filterPlayer && CONFIG.filterPlayer !== 'all') {
                    const playerData = gameData.players.find(p => p.player === CONFIG.filterPlayer);
                    if (playerData) {
                        const icon = playerData.won ? '✅' : '❌';
                        const sign = playerData.profit >= 0 ? '+' : '';
                        console.log(`  ${icon} Found: ${(playerData.bet/100).toFixed(0)}b → ${sign}${(playerData.profit/100).toFixed(0)}b`);
                    }
                } else {
                    console.log(`  ✅ ${gameData.players.length} players`);
                }
            }

        } catch (error) {
            console.log(`  ❌ Error: ${error.message}`);
            state.errors++;
        }

        // Progress
        if ((i + 1) % 10 === 0) {
            const elapsed = ((Date.now() - state.startTime) / 1000).toFixed(1);
            const rate = (state.gamesData.length / (i + 1) * 100).toFixed(1);
            console.log(`  [${elapsed}s] Progress: ${i + 1}/${CONFIG.numGames} | Found: ${state.gamesData.length} (${rate}%) | Errors: ${state.errors}`);
        }
    }

    await browser.close();

    console.log('');
    console.log('═'.repeat(80));
    console.log(' SCRAPING COMPLETE');
    console.log('═'.repeat(80));

    saveResults();
}

// =============================================================================
// FILTER & SAVE
// =============================================================================
function saveResults() {
    if (!fs.existsSync(CONFIG.outputDir)) {
        fs.mkdirSync(CONFIG.outputDir, { recursive: true });
    }

    // Apply filter
    let filteredData = state.gamesData;
    if (CONFIG.filterPlayer && CONFIG.filterPlayer !== 'all') {
        filteredData = state.gamesData.map(game => {
            const playerData = game.players.find(p => p.player === CONFIG.filterPlayer);
            if (!playerData) return null;

            return {
                gameId: game.gameId,
                bust: game.bust,
                player: playerData.player,
                bet: playerData.bet,
                cashedAt: playerData.cashedAt,
                profit: playerData.profit,
                won: playerData.won
            };
        }).filter(g => g !== null);
    }

    const endGameId = CONFIG.startGameId - CONFIG.numGames + 1;
    const timestamp = Date.now();
    const filterSuffix = CONFIG.filterPlayer && CONFIG.filterPlayer !== 'all' ? CONFIG.filterPlayer : 'all';
    const filename = `${timestamp}_${filterSuffix}_from_${CONFIG.startGameId}_to_${endGameId}.json`;
    const filepath = path.join(CONFIG.outputDir, filename);

    const output = {
        filter: CONFIG.filterPlayer || 'all',
        scrapedAt: new Date().toISOString(),
        config: {
            startGameId: CONFIG.startGameId,
            endGameId,
            numGames: CONFIG.numGames,
            gamesChecked: CONFIG.numGames,
            gamesFound: state.gamesData.length,
            errors: state.errors
        },
        games: filteredData
    };

    fs.writeFileSync(filepath, JSON.stringify(output, null, 2));

    console.log(`\n✅ Data saved: ${filepath}`);
    console.log(`   Games found: ${state.gamesData.length}/${CONFIG.numGames}`);
    console.log(`   Records saved: ${filteredData.length}`);
    console.log(`   Errors: ${state.errors}`);

    // Basic stats
    if (CONFIG.filterPlayer && CONFIG.filterPlayer !== 'all' && filteredData.length > 0) {
        const wins = filteredData.filter(g => g.won).length;
        const totalProfit = filteredData.reduce((sum, g) => sum + g.profit, 0);
        const totalBet = filteredData.reduce((sum, g) => sum + g.bet, 0);
        const winRate = (wins / filteredData.length * 100).toFixed(1);
        const roi = ((totalProfit / totalBet) * 100).toFixed(2);

        console.log('');
        console.log('═'.repeat(80));
        console.log(` PLAYER: ${CONFIG.filterPlayer}`);
        console.log('═'.repeat(80));
        console.log(`Games:        ${filteredData.length}`);
        console.log(`Wins:         ${wins} (${winRate}%)`);
        console.log(`Total Profit: ${totalProfit >= 0 ? '+' : ''}${(totalProfit/100).toFixed(0)} bits`);
        console.log(`ROI:          ${roi}%`);
        console.log('═'.repeat(80));
    }
}

// =============================================================================
// RUN
// =============================================================================
scrape().catch(err => {
    console.error('\n❌ Fatal error:', err);
    process.exit(1);
});
