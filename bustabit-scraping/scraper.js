// Bustabit Game Data Scraper - Fetch parallelo con filtro player opzionale
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
    numGames: 100,
    parallelRequests: 10,
    delayMs: 100,
    outputDir: '../bustabit-real-data'
};

// =============================================================================
// STATE
// =============================================================================
const state = {
    gamesData: [],        // Dati completi delle partite
    totalChecked: 0,
    gamesFound: 0,
    totalPlayers: 0,
    startTime: null,
    errors: 0
};

// =============================================================================
// FETCHER CON RETRY
// =============================================================================
async function fetchGamePage(gameId, retries = 2) {
    const url = `https://bustabit.com/game/${gameId}`;

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                if (response.status === 404) return null;
                if (attempt < retries) {
                    await new Promise(r => setTimeout(r, 500));
                    continue;
                }
                return null;
            }
            return await response.text();
        } catch (error) {
            if (attempt < retries) {
                await new Promise(r => setTimeout(r, 500));
                continue;
            }
            state.errors++;
            return null;
        }
    }
    return null;
}

// =============================================================================
// HTML PARSER - ESTRAE TUTTI I GIOCATORI
// =============================================================================
function parseGameData(html, gameId) {
    if (!html) return null;

    // Estrai bust value
    const bustMatch = html.match(/BUSTED AT:.*?(\d+\.\d+)x/is) ||
                      html.match(/busted at.*?<strong>(\d+\.\d+)x/is) ||
                      html.match(/crashed at.*?(\d+\.\d+)x/is);
    const bust = bustMatch ? parseFloat(bustMatch[1]) : null;

    // Trova tutte le righe della tabella players
    const playerRows = [];
    const rowRegex = /<tr[^>]*>(.*?)<\/tr>/gis;
    const rows = html.match(rowRegex) || [];

    for (const row of rows) {
        // Cerca se la riga contiene un link a /user/
        const playerMatch = row.match(/href="\/user\/([^"]+)"[^>]*>([^<]+)<\/a>/i);
        if (!playerMatch) continue;

        const playerName = playerMatch[2].trim();

        // Estrai tutte le celle della riga
        const cells = [];
        const cellRegex = /<td[^>]*>(.*?)<\/td>/gis;
        let cellMatch;
        while ((cellMatch = cellRegex.exec(row)) !== null) {
            cells.push(cellMatch[1].trim());
        }

        // Struttura: Player | Cashed Out | Bet | Profit
        // cells[0] = Player (con <a> tag)
        // cells[1] = Cashed Out (o -)
        // cells[2] = Bet
        // cells[3] = Profit (o -)

        if (cells.length < 4) continue;

        // Pulisci i valori rimuovendo tag HTML
        const cashedOutText = cells[1].replace(/<[^>]*>/g, '').trim();
        const betText = cells[2].replace(/<[^>]*>/g, '').replace(/,/g, '').trim();
        const profitText = cells[3].replace(/<[^>]*>/g, '').replace(/,/g, '').trim();

        const bet = parseFloat(betText);
        if (isNaN(bet) || bet === 0) continue;

        const cashedAt = cashedOutText !== '-' && !cashedOutText.includes('Friend')
            ? parseFloat(cashedOutText.replace('x', ''))
            : null;

        const profit = profitText !== '-' ? parseFloat(profitText) : -bet;
        const won = profit > 0;

        playerRows.push({
            player: playerName,
            bet,
            cashedAt,
            profit,
            won
        });
    }

    if (playerRows.length === 0) return null;

    return {
        gameId,
        bust,
        players: playerRows
    };
}

// =============================================================================
// PARALLEL BATCH PROCESSOR
// =============================================================================
async function processBatch(gameIds) {
    const promises = gameIds.map(async (gameId) => {
        const html = await fetchGamePage(gameId);
        const data = parseGameData(html, gameId);

        state.totalChecked++;

        if (data) {
            state.gamesFound++;
            state.totalPlayers += data.players.length;
            return data;
        }
        return null;
    });

    const results = await Promise.all(promises);
    return results.filter(r => r !== null);
}

// =============================================================================
// FILTER PLAYER DATA
// =============================================================================
function filterPlayerData(gamesData) {
    const filter = CONFIG.filterPlayer;

    // No filter or "all" - return all data
    if (!filter || filter.toLowerCase() === 'all') {
        return gamesData;
    }

    // Filter by specific player
    return gamesData.map(game => {
        const playerData = game.players.find(p => p.player === filter);
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

// =============================================================================
// PROGRESS
// =============================================================================
function logProgress() {
    const elapsed = ((Date.now() - state.startTime) / 1000).toFixed(1);
    const gamesPerSec = (state.totalChecked / parseFloat(elapsed)).toFixed(1);

    console.log(
        `  [${elapsed}s] ` +
        `Checked: ${state.totalChecked}/${CONFIG.numGames} | ` +
        `Games: ${state.gamesFound} | ` +
        `Players: ${state.totalPlayers} | ` +
        `Speed: ${gamesPerSec} g/s | ` +
        `Errors: ${state.errors}`
    );
}

// =============================================================================
// MAIN SCRAPER
// =============================================================================
async function scrape() {
    const filterText = !CONFIG.filterPlayer || CONFIG.filterPlayer.toLowerCase() === 'all'
        ? 'ALL PLAYERS'
        : CONFIG.filterPlayer;

    console.log('═'.repeat(80));
    console.log(' BUSTABIT GAME DATA SCRAPER');
    console.log('═'.repeat(80));
    console.log(`Filter:       ${filterText}`);
    console.log(`Start Game:   #${CONFIG.startGameId}`);
    console.log(`Games Back:   ${CONFIG.numGames}`);
    console.log(`Parallel:     ${CONFIG.parallelRequests} requests`);
    console.log(`Delay:        ${CONFIG.delayMs}ms`);
    console.log('═'.repeat(80));
    console.log('');

    state.startTime = Date.now();

    // Crea batches di gameIds
    const allGameIds = [];
    for (let i = 0; i < CONFIG.numGames; i++) {
        allGameIds.push(CONFIG.startGameId - i);
    }

    // Processa in batches paralleli
    const batches = [];
    for (let i = 0; i < allGameIds.length; i += CONFIG.parallelRequests) {
        batches.push(allGameIds.slice(i, i + CONFIG.parallelRequests));
    }

    for (let i = 0; i < batches.length; i++) {
        const batchResults = await processBatch(batches[i]);

        // Aggiungi risultati
        state.gamesData.push(...batchResults);

        // Progress ogni 5 batches o all'ultimo
        if ((i + 1) % 5 === 0 || i === batches.length - 1) {
            logProgress();
        }

        // Delay tra batches
        if (i < batches.length - 1) {
            await new Promise(r => setTimeout(r, CONFIG.delayMs));
        }
    }

    console.log('');
    console.log('═'.repeat(80));
    console.log(' SCRAPING COMPLETE');
    console.log('═'.repeat(80));
    console.log(`Games found:    ${state.gamesFound}`);
    console.log(`Total players:  ${state.totalPlayers}`);
    console.log(`Avg per game:   ${(state.totalPlayers / state.gamesFound).toFixed(1)}`);

    saveResults();
    analyzeResults();
}

// =============================================================================
// SAVE
// =============================================================================
function saveResults() {
    if (!fs.existsSync(CONFIG.outputDir)) {
        fs.mkdirSync(CONFIG.outputDir, { recursive: true });
    }

    const endGameId = CONFIG.startGameId - CONFIG.numGames + 1;
    const timestamp = Date.now();

    // Apply filter
    const filteredData = filterPlayerData(state.gamesData);
    const filterSuffix = !CONFIG.filterPlayer || CONFIG.filterPlayer.toLowerCase() === 'all'
        ? 'all'
        : CONFIG.filterPlayer;

    const filename = `${timestamp}_${filterSuffix}_from_${CONFIG.startGameId}_to_${endGameId}.json`;
    const filepath = path.join(CONFIG.outputDir, filename);

    const output = {
        filter: CONFIG.filterPlayer || 'all',
        scrapedAt: new Date().toISOString(),
        config: {
            startGameId: CONFIG.startGameId,
            endGameId,
            numGames: CONFIG.numGames,
            gamesChecked: state.totalChecked,
            gamesFound: state.gamesFound,
            totalPlayers: state.totalPlayers
        },
        games: filteredData
    };

    fs.writeFileSync(filepath, JSON.stringify(output, null, 2));
    console.log(`\n✅ Data saved: ${filepath}`);
    console.log(`   ${filteredData.length} records saved`);
}

// =============================================================================
// ANALYSIS
// =============================================================================
function analyzeResults() {
    const filteredData = filterPlayerData(state.gamesData);

    if (filteredData.length === 0) {
        console.log('\n❌ No data found for analysis');
        return;
    }

    console.log('');
    console.log('═'.repeat(80));
    console.log(' DATA ANALYSIS');
    console.log('═'.repeat(80));

    // Se è filtrato per player, mostra statistiche player
    if (CONFIG.filterPlayer && CONFIG.filterPlayer.toLowerCase() !== 'all') {
        const games = filteredData;
        const wins = games.filter(g => g.won).length;
        const losses = games.filter(g => !g.won).length;
        const winRate = (wins / games.length * 100).toFixed(1);

        const totalBet = games.reduce((sum, g) => sum + g.bet, 0);
        const totalProfit = games.reduce((sum, g) => sum + g.profit, 0);
        const avgBet = totalBet / games.length;

        const avgCashout = wins > 0
            ? games.filter(g => g.cashedAt).reduce((sum, g) => sum + g.cashedAt, 0) / wins
            : 0;

        const minBet = Math.min(...games.map(g => g.bet));
        const maxBet = Math.max(...games.map(g => g.bet));

        console.log(`\n📊 PLAYER: ${CONFIG.filterPlayer}`);
        console.log(`   Games:        ${games.length}`);
        console.log(`   Wins:         ${wins} (${winRate}%)`);
        console.log(`   Losses:       ${losses}`);
        console.log(`   Total Profit: ${totalProfit >= 0 ? '+' : ''}${(totalProfit/100).toFixed(0)} bits`);
        console.log(`   ROI:          ${((totalProfit / totalBet) * 100).toFixed(2)}%`);

        console.log(`\n💰 BETTING`);
        console.log(`   Total Wagered: ${(totalBet/100).toFixed(0)} bits`);
        console.log(`   Avg Bet:       ${(avgBet/100).toFixed(2)} bits`);
        console.log(`   Min Bet:       ${(minBet/100).toFixed(2)} bits`);
        console.log(`   Max Bet:       ${(maxBet/100).toFixed(2)} bits`);
        console.log(`   Avg Cashout:   ${avgCashout.toFixed(2)}x`);

        // Bet distribution
        console.log(`\n📈 TOP 10 BETS`);
        const betCounts = {};
        games.forEach(g => {
            const bet = g.bet;
            betCounts[bet] = (betCounts[bet] || 0) + 1;
        });

        const sortedBets = Object.entries(betCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        sortedBets.forEach(([bet, count]) => {
            const pct = (count / games.length * 100).toFixed(1);
            console.log(`   ${(parseInt(bet)/100).toFixed(0).padStart(6)} bits: ${count.toString().padStart(4)}x (${pct}%)`);
        });

        // Cashout distribution
        if (wins > 0) {
            console.log(`\n🎯 TOP 10 CASHOUTS`);
            const cashoutCounts = {};
            games.filter(g => g.cashedAt).forEach(g => {
                const co = g.cashedAt.toFixed(2);
                cashoutCounts[co] = (cashoutCounts[co] || 0) + 1;
            });

            const sortedCashouts = Object.entries(cashoutCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10);

            sortedCashouts.forEach(([cashout, count]) => {
                const pct = (count / wins * 100).toFixed(1);
                console.log(`   ${parseFloat(cashout).toFixed(2)}x: ${count.toString().padStart(4)}x (${pct}%)`);
            });
        }
    } else {
        // Mostra statistiche generali per tutti i player
        console.log(`\n📊 OVERALL STATS`);
        console.log(`   Total games:   ${state.gamesFound}`);
        console.log(`   Total players: ${state.totalPlayers}`);
        console.log(`   Avg per game:  ${(state.totalPlayers / state.gamesFound).toFixed(1)}`);

        // Top 10 players by number of games
        const playerCounts = {};
        filteredData.forEach(game => {
            game.players.forEach(p => {
                playerCounts[p.player] = (playerCounts[p.player] || 0) + 1;
            });
        });

        const sortedPlayers = Object.entries(playerCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        console.log(`\n👥 TOP 10 MOST ACTIVE PLAYERS`);
        sortedPlayers.forEach(([player, count]) => {
            const pct = (count / state.gamesFound * 100).toFixed(1);
            console.log(`   ${player.padEnd(25)}: ${count.toString().padStart(4)} games (${pct}%)`);
        });
    }

    console.log('═'.repeat(80));
}

// =============================================================================
// RUN
// =============================================================================
scrape().catch(err => {
    console.error('\n❌ Fatal error:', err);
    process.exit(1);
});
