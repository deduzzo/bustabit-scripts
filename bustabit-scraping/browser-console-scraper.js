// Bustabit Browser Console Scraper
// ISTRUZIONI:
// 1. Apri Chrome e vai su https://bustabit.com/game/12636793
// 2. Apri la Console DevTools (F12 → Console)
// 3. Copia e incolla TUTTO questo codice nella console
// 4. Premi Enter
// 5. Lo script scaricherà automaticamente 100 partite
// 6. Alla fine ti darà un link per scaricare il JSON

(async function() {
    const CONFIG = {
        filterPlayer: 'Pandurangavithala',  // Cambia qui per filtrare altro player o metti null per tutti
        startGameId: 12636793,
        numGames: 100,
        delayMs: 1500
    };

    const gamesData = [];
    let errors = 0;

    console.log('═'.repeat(80));
    console.log(' BUSTABIT BROWSER CONSOLE SCRAPER');
    console.log('═'.repeat(80));
    console.log('Filter:', CONFIG.filterPlayer || 'ALL PLAYERS');
    console.log('Start:', CONFIG.startGameId);
    console.log('Games:', CONFIG.numGames);
    console.log('═'.repeat(80));
    console.log('');

    for (let i = 0; i < CONFIG.numGames; i++) {
        const gameId = CONFIG.startGameId - i;
        const url = `/game/${gameId}`;

        try {
            console.log(`[${i + 1}/${CONFIG.numGames}] Fetching #${gameId}...`);

            // Navigate
            window.history.pushState({}, '', url);
            window.location.href = url;

            // Wait for page load
            await new Promise(r => setTimeout(r, CONFIG.delayMs));

            // Extract data
            const data = {
                gameId: parseInt(window.location.pathname.match(/\/game\/(\d+)/)[1]),
                bust: null,
                players: []
            };

            // Bust value
            const bustEls = Array.from(document.querySelectorAll('*')).filter(e =>
                e.textContent.trim().match(/^\d+\.\d+x$/) &&
                e.previousElementSibling &&
                e.previousElementSibling.textContent.trim() === 'Busted at:'
            );
            if (bustEls.length > 0) {
                const m = bustEls[0].textContent.trim().match(/([\d.]+)x/);
                data.bust = m ? parseFloat(m[1]) : null;
            }

            // Players table
            const tables = document.querySelectorAll('table');
            let tbl = null;
            for (const t of tables) {
                const fr = t.querySelector('tr');
                if (fr && fr.textContent.includes('Player') && fr.textContent.includes('Bet')) {
                    tbl = t;
                    break;
                }
            }

            if (tbl) {
                const rows = tbl.querySelectorAll('tbody tr, tr');
                for (const row of rows) {
                    const cells = row.querySelectorAll('td');
                    if (cells.length < 4) continue;
                    const pl = cells[0].querySelector('a[href^="/user/"]');
                    if (!pl) continue;
                    const bt = parseFloat(cells[1].textContent.trim().replace(/,/g, ''));
                    if (isNaN(bt)) continue;
                    const cot = cells[2].textContent.trim();
                    let ca = null;
                    if (cot !== '-' && !cot.includes('Friend')) {
                        const cm = cot.match(/([\d.]+)x/);
                        ca = cm ? parseFloat(cm[1]) : null;
                    }
                    const pr = parseFloat(cells[3].textContent.trim().replace(/,/g, ''));
                    data.players.push({
                        player: pl.textContent.trim(),
                        bet: bt,
                        cashedAt: ca,
                        profit: isNaN(pr) ? -bt : pr,
                        won: pr > 0
                    });
                }
            }

            if (data.players.length > 0) {
                gamesData.push(data);

                // Log if player found
                if (CONFIG.filterPlayer) {
                    const pdata = data.players.find(p => p.player === CONFIG.filterPlayer);
                    if (pdata) {
                        const icon = pdata.won ? '✅' : '❌';
                        console.log(`  ${icon} Found: ${(pdata.bet/100).toFixed(0)}b → ${(pdata.profit/100).toFixed(0)}b`);
                    } else {
                        console.log('  ⚪ Not playing');
                    }
                } else {
                    console.log(`  ✅ ${data.players.length} players`);
                }
            }

        } catch (error) {
            console.error(`  ❌ Error:`, error.message);
            errors++;
        }

        // Progress
        if ((i + 1) % 10 === 0) {
            console.log(`  Progress: ${i + 1}/${CONFIG.numGames} | Found: ${gamesData.length} | Errors: ${errors}`);
        }
    }

    console.log('');
    console.log('═'.repeat(80));
    console.log(' SCRAPING COMPLETE');
    console.log('═'.repeat(80));
    console.log('Games found:', gamesData.length);
    console.log('Errors:', errors);

    // Filter data
    let filteredData = gamesData;
    if (CONFIG.filterPlayer) {
        filteredData = gamesData.map(game => {
            const pdata = game.players.find(p => p.player === CONFIG.filterPlayer);
            if (!pdata) return null;
            return {
                gameId: game.gameId,
                bust: game.bust,
                player: pdata.player,
                bet: pdata.bet,
                cashedAt: pdata.cashedAt,
                profit: pdata.profit,
                won: pdata.won
            };
        }).filter(g => g !== null);
    }

    // Create JSON
    const output = {
        filter: CONFIG.filterPlayer || 'all',
        scrapedAt: new Date().toISOString(),
        config: {
            startGameId: CONFIG.startGameId,
            endGameId: CONFIG.startGameId - CONFIG.numGames + 1,
            numGames: CONFIG.numGames,
            gamesFound: gamesData.length
        },
        games: filteredData
    };

    // Download JSON
    const json = JSON.stringify(output, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${Date.now()}_${CONFIG.filterPlayer || 'all'}_from_${CONFIG.startGameId}_to_${CONFIG.startGameId - CONFIG.numGames + 1}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log('✅ JSON downloaded!');
    console.log('');

    // Stats
    if (CONFIG.filterPlayer && filteredData.length > 0) {
        const wins = filteredData.filter(g => g.won).length;
        const totalProfit = filteredData.reduce((sum, g) => sum + g.profit, 0);
        const totalBet = filteredData.reduce((sum, g) => sum + g.bet, 0);
        console.log('═'.repeat(80));
        console.log(`PLAYER: ${CONFIG.filterPlayer}`);
        console.log('═'.repeat(80));
        console.log('Games:', filteredData.length);
        console.log('Wins:', wins, `(${(wins/filteredData.length*100).toFixed(1)}%)`);
        console.log('Total Profit:', `${totalProfit >= 0 ? '+' : ''}${(totalProfit/100).toFixed(0)} bits`);
        console.log('ROI:', `${((totalProfit/totalBet)*100).toFixed(2)}%`);
        console.log('═'.repeat(80));
    }

})();
