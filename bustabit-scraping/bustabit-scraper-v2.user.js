// ==UserScript==
// @name         Bustabit Game Data Scraper v2
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  Scrape game data from Bustabit - Control Panel Version
// @author       Claude Code
// @match        https://bustabit.com/game/*
// @match        https://bustabit.com/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

/*
 * FEATURES:
 * - Scrape up to 100,000 games
 * - Filter by specific player
 * - When filtering by player: collects ALL games (even when player didn't play)
 *
 * PLAYER DIDN'T PLAY DETECTION:
 * When you filter by a specific player, the scraper includes ALL games in the output.
 * To identify when a player DIDN'T play a game, check the JSON output:
 *
 * Player PLAYED:
 * {
 *   "gameId": 123456,
 *   "bust": 2.45,
 *   "player": "username",
 *   "bet": 10000,           // ← has value
 *   "cashedAt": 2.10,       // ← has value (or null if busted)
 *   "profit": 11000,        // ← has value
 *   "won": true             // ← has value
 * }
 *
 * Player DIDN'T PLAY:
 * {
 *   "gameId": 123457,
 *   "bust": 1.52,
 *   "player": "username",
 *   "bet": null,            // ← null = didn't play
 *   "cashedAt": null,       // ← null = didn't play
 *   "profit": null,         // ← null = didn't play
 *   "won": null             // ← null = didn't play
 * }
 *
 * This is CRITICAL for algorithm analysis because it shows:
 * - When the player chose NOT to bet (skip pattern)
 * - Real betting frequency (games played / total games)
 * - Decision patterns based on previous busts
 */

(function() {
    'use strict';

    // STATE
    let scraping = false;
    const gamesData = [];
    let CONFIG = {
        filterPlayer: '',
        numGames: 100
    };

    // Auto-cashout state
    let autoCashoutEnabled = false;
    let autoCashoutTarget = 0;
    let hasAutoCashedOut = false;

    // Expose config to console
    window.scraperConfig = CONFIG;

    // Make panel draggable
    function makeDraggable(panel) {
        const header = panel.querySelector('#scraper-header');
        let isDragging = false;
        let currentX;
        let currentY;
        let initialX;
        let initialY;
        let xOffset = 0;
        let yOffset = 0;

        header.addEventListener('mousedown', dragStart);
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', dragEnd);

        function dragStart(e) {
            // Don't drag if clicking the minimize button
            if (e.target.id === 'scraper-minimize') return;

            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;

            if (e.target === header || e.target.parentElement === header) {
                isDragging = true;
                panel.style.transition = 'none';
            }
        }

        function drag(e) {
            if (isDragging) {
                e.preventDefault();

                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;

                xOffset = currentX;
                yOffset = currentY;

                setTranslate(currentX, currentY, panel);
            }
        }

        function dragEnd(e) {
            initialX = currentX;
            initialY = currentY;

            isDragging = false;
        }

        function setTranslate(xPos, yPos, el) {
            el.style.transform = `translate(${xPos}px, ${yPos}px)`;
        }
    }

    // Create control panel
    function createControlPanel() {
        const panel = document.createElement('div');
        panel.id = 'bustabit-scraper-panel';
        panel.style.cssText = `
            position: fixed;
            top: 40px;
            right: 10px;
            width: 280px;
            background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
            border: 2px solid #667eea;
            border-radius: 12px;
            padding: 15px;
            z-index: 999999;
            color: white;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            font-size: 13px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        `;

        panel.innerHTML = `
            <div id="scraper-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; cursor: move; user-select: none;">
                <h3 style="margin: 0; color: #667eea; font-size: 16px;">📥 Bustabit Scraper</h3>
                <button id="scraper-minimize" style="background: transparent; border: none; color: #888; cursor: pointer; font-size: 16px;">−</button>
            </div>

            <!-- Live Multiplier Display -->
            <div id="live-multiplier-container" style="margin-bottom: 15px; padding: 12px; background: #1a1a1a; border: 2px solid #444; border-radius: 10px; text-align: center;">
                <div style="color: #888; font-size: 10px; margin-bottom: 4px;">LIVE MULTIPLIER</div>
                <div id="live-multiplier-value" style="font-size: 32px; font-weight: bold; color: #00ff00; font-family: 'Courier New', monospace; text-shadow: 0 0 10px rgba(0,255,0,0.5);">
                    --
                </div>
                <div id="live-multiplier-state" style="color: #666; font-size: 10px; margin-top: 4px;">Waiting...</div>
            </div>

            <!-- Auto-Cashout Toggle -->
            <div id="auto-cashout-container" style="margin-bottom: 15px; padding: 10px; background: #1a1a1a; border: 2px solid #444; border-radius: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="color: #aaa; font-size: 11px;">Auto-Cashout @ 5.xx</div>
                        <div id="auto-cashout-target" style="color: #666; font-size: 10px; margin-top: 2px;">Target: --</div>
                    </div>
                    <button id="auto-cashout-toggle" style="padding: 8px 16px; background: #333; border: 1px solid #555; border-radius: 6px; color: #888; cursor: pointer; font-size: 12px; font-weight: bold;">
                        OFF
                    </button>
                </div>
            </div>

            <!-- History -->
            <div style="margin-bottom: 15px; padding: 10px; background: #1a1a1a; border: 2px solid #444; border-radius: 10px;">
                <div style="color: #aaa; font-size: 11px; margin-bottom: 8px;">📊 HISTORY (Last 50)</div>
                <div id="history-list" style="max-height: 200px; overflow-y: auto; font-size: 10px; font-family: 'Courier New', monospace;">
                    <div style="color: #666; text-align: center; padding: 10px;">Loading...</div>
                </div>
            </div>

            <div id="scraper-controls">
                <!-- Number of Games -->
                <div style="margin-bottom: 12px;">
                    <div style="color: #aaa; font-size: 11px; margin-bottom: 4px;">Number of Games <span style="color: #555;">(double-click to edit)</span></div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <button id="games-minus" style="width: 32px; height: 32px; background: #333; border: 1px solid #555; border-radius: 6px; color: white; cursor: pointer; font-size: 18px;">−</button>
                        <div id="games-value" style="flex: 1; text-align: center; background: #2a2a2a; padding: 6px; border-radius: 6px; font-weight: bold; color: #667eea; cursor: pointer; user-select: none;">100</div>
                        <button id="games-plus" style="width: 32px; height: 32px; background: #333; border: 1px solid #555; border-radius: 6px; color: white; cursor: pointer; font-size: 18px;">+</button>
                    </div>
                </div>

                <!-- Filter Player -->
                <div style="margin-bottom: 12px;">
                    <div style="color: #aaa; font-size: 11px; margin-bottom: 4px;">Filter Player (click to edit)</div>
                    <div id="player-value" style="background: #2a2a2a; padding: 8px; border-radius: 6px; text-align: center; color: #888; font-style: italic; cursor: pointer; border: 1px solid #555;">all players</div>
                </div>

                <!-- Status -->
                <div id="scraper-status" style="margin-bottom: 12px; padding: 8px; background: #222; border-radius: 6px; font-size: 11px; color: #aaa; min-height: 40px;">
                    Ready to scrape<br>
                    <span style="color: #555; font-size: 10px;">Console: window.scraperConfig</span>
                </div>

                <!-- Progress Bar -->
                <div id="scraper-progress-container" style="display: none; margin-bottom: 12px;">
                    <div style="background: #222; height: 20px; border-radius: 10px; overflow: hidden;">
                        <div id="scraper-progress-bar" style="background: linear-gradient(90deg, #667eea, #764ba2); height: 100%; width: 0%; transition: width 0.3s; display: flex; align-items: center; justify-content: center;">
                            <span id="scraper-progress-text" style="font-size: 11px; font-weight: bold; color: white;">0%</span>
                        </div>
                    </div>
                </div>

                <!-- Start Button -->
                <button id="scraper-start" style="width: 100%; padding: 12px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: none; border-radius: 8px; color: white; font-weight: bold; cursor: pointer; font-size: 14px; transition: all 0.3s;">
                    START SCRAPING
                </button>
            </div>
        `;

        document.body.appendChild(panel);

        // Expose config to console
        window.scraperConfig = CONFIG;
        console.log('[SCRAPER] Control panel loaded. Edit config in console: window.scraperConfig');

        // Make panel draggable
        makeDraggable(panel);

        setupControls();
    }

    // Wait for page to load after navigation
    async function waitForPageLoad(expectedGameId, timeout = 5000) {
        const startTime = Date.now();

        return new Promise((resolve, reject) => {
            const checkInterval = setInterval(() => {
                // Check timeout
                if (Date.now() - startTime > timeout) {
                    clearInterval(checkInterval);
                    reject(new Error('Timeout waiting for page load'));
                    return;
                }

                // Check if URL changed to expected game
                const urlMatch = window.location.pathname.match(/\/game\/(\d+)/);
                const currentGameId = urlMatch ? parseInt(urlMatch[1]) : null;

                if (currentGameId !== expectedGameId) {
                    return; // Keep waiting
                }

                // Check if table exists and has data
                const tables = document.querySelectorAll('table');
                let playersTable = null;
                for (const table of tables) {
                    const firstRow = table.querySelector('tr');
                    if (firstRow && firstRow.textContent.includes('Player') && firstRow.textContent.includes('Bet')) {
                        playersTable = table;
                        break;
                    }
                }

                if (!playersTable) {
                    return; // Keep waiting
                }

                // Check if table has rows
                const rows = playersTable.querySelectorAll('tbody tr, tr');
                let dataRows = 0;
                for (const row of rows) {
                    const cells = row.querySelectorAll('td');
                    if (cells.length >= 4) dataRows++;
                }

                if (dataRows > 0) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 50); // Check every 50ms
        });
    }

    // Setup button controls
    function setupControls() {
        const gamesValue = document.getElementById('games-value');
        const playerValue = document.getElementById('player-value');
        const statusDiv = document.getElementById('scraper-status');
        const progressContainer = document.getElementById('scraper-progress-container');
        const startBtn = document.getElementById('scraper-start');
        const minimizeBtn = document.getElementById('scraper-minimize');
        const controlsDiv = document.getElementById('scraper-controls');

        // Games controls - buttons
        document.getElementById('games-plus').onclick = () => {
            CONFIG.numGames = Math.min(100000, CONFIG.numGames + (CONFIG.numGames >= 100 ? 10 : 1));
            gamesValue.textContent = CONFIG.numGames;
        };

        document.getElementById('games-minus').onclick = () => {
            CONFIG.numGames = Math.max(1, CONFIG.numGames - (CONFIG.numGames > 100 ? 10 : 1));
            gamesValue.textContent = CONFIG.numGames;
        };

        // Games controls - double click to edit
        gamesValue.ondblclick = () => {
            const newValue = prompt('Enter number of games to scrape:', CONFIG.numGames);
            if (newValue !== null) {
                const num = parseInt(newValue);
                if (!isNaN(num) && num >= 1 && num <= 100000) {
                    CONFIG.numGames = num;
                    gamesValue.textContent = num;
                } else {
                    alert('Please enter a number between 1 and 100000');
                }
            }
        };

        // Player filter (via console)
        playerValue.onclick = () => {
            const newPlayer = prompt('Enter player name (leave empty for all players):', CONFIG.filterPlayer);
            if (newPlayer !== null) {
                CONFIG.filterPlayer = newPlayer.trim();
                playerValue.textContent = CONFIG.filterPlayer || 'all players';
                playerValue.style.color = CONFIG.filterPlayer ? '#667eea' : '#888';
                playerValue.style.fontStyle = CONFIG.filterPlayer ? 'normal' : 'italic';
            }
        };

        // Auto-Cashout toggle
        const autoCashoutToggle = document.getElementById('auto-cashout-toggle');
        const autoCashoutTargetDiv = document.getElementById('auto-cashout-target');
        const autoCashoutContainer = document.getElementById('auto-cashout-container');

        autoCashoutToggle.onclick = () => {
            autoCashoutEnabled = !autoCashoutEnabled;

            if (autoCashoutEnabled) {
                // Generate random target between 5.00 and 5.99
                autoCashoutTarget = 5.00 + Math.random() * 0.99;
                hasAutoCashedOut = false;

                autoCashoutToggle.textContent = 'ON';
                autoCashoutToggle.style.background = 'linear-gradient(135deg, #00ff00 0%, #00cc00 100%)';
                autoCashoutToggle.style.color = '#000';
                autoCashoutToggle.style.borderColor = '#00ff00';
                autoCashoutTargetDiv.textContent = `Target: ${autoCashoutTarget.toFixed(2)}x`;
                autoCashoutTargetDiv.style.color = '#00ff00';
                autoCashoutContainer.style.borderColor = '#00ff00';

                console.log(`[AUTO-CASHOUT] Enabled - Target: ${autoCashoutTarget.toFixed(2)}x`);
            } else {
                autoCashoutToggle.textContent = 'OFF';
                autoCashoutToggle.style.background = '#333';
                autoCashoutToggle.style.color = '#888';
                autoCashoutToggle.style.borderColor = '#555';
                autoCashoutTargetDiv.textContent = 'Target: --';
                autoCashoutTargetDiv.style.color = '#666';
                autoCashoutContainer.style.borderColor = '#444';

                console.log('[AUTO-CASHOUT] Disabled');
            }
        };

        // Minimize/maximize
        minimizeBtn.onclick = () => {
            if (controlsDiv.style.display === 'none') {
                controlsDiv.style.display = 'block';
                minimizeBtn.textContent = '−';
            } else {
                controlsDiv.style.display = 'none';
                minimizeBtn.textContent = '+';
            }
        };

        // Start button
        startBtn.onclick = () => {
            if (!scraping) {
                startScraping();
            }
        };

        // Hover effect
        startBtn.onmouseover = () => startBtn.style.transform = 'scale(1.02)';
        startBtn.onmouseout = () => startBtn.style.transform = 'scale(1)';
    }

    // Extract game data from document
    function extractGameDataFromDocument(doc, gameId) {
        const data = { gameId: gameId, bust: null, players: [] };

        // Bust value
        const bustEls = Array.from(doc.querySelectorAll('*')).filter(e =>
            e.textContent.trim().match(/^\d+\.\d+x$/) &&
            e.previousElementSibling &&
            e.previousElementSibling.textContent.trim() === 'Busted at:'
        );
        if (bustEls.length > 0) {
            const m = bustEls[0].textContent.trim().match(/([\d.]+)x/);
            data.bust = m ? parseFloat(m[1]) : null;
        }

        // Players table
        const tables = doc.querySelectorAll('table');
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

        return data;
    }

    // Update status
    function updateStatus(message, progress = null) {
        const statusDiv = document.getElementById('scraper-status');
        const progressContainer = document.getElementById('scraper-progress-container');
        const progressBar = document.getElementById('scraper-progress-bar');
        const progressText = document.getElementById('scraper-progress-text');

        if (statusDiv) statusDiv.innerHTML = message;

        if (progress) {
            progressContainer.style.display = 'block';
            const percentage = ((progress.current / progress.total) * 100).toFixed(1);
            progressBar.style.width = percentage + '%';
            progressText.textContent = percentage + '%';
        } else {
            progressContainer.style.display = 'none';
        }
    }

    // Start scraping
    async function startScraping() {
        if (scraping) return;
        scraping = true;

        const startBtn = document.getElementById('scraper-start');
        startBtn.disabled = true;
        startBtn.style.opacity = '0.6';
        startBtn.textContent = 'SCRAPING...';

        gamesData.length = 0;
        let errors = 0;
        const startTime = Date.now();

        console.log('[SCRAPER] Starting scrape with config:', CONFIG);
        updateStatus(`🚀 Starting scrape...`);
        await new Promise(r => setTimeout(r, 500));

        for (let i = 0; i < CONFIG.numGames; i++) {
            try {
                const urlMatch = window.location.pathname.match(/\/game\/(\d+)/);
                const currentGameId = urlMatch ? parseInt(urlMatch[1]) : null;

                updateStatus(`📥 Scraping game #${currentGameId || '?'}...`, {
                    current: i + 1,
                    total: CONFIG.numGames,
                    startTime: startTime
                });

                const data = extractGameDataFromDocument(document, currentGameId);

                if (data && data.players.length > 0) {
                    gamesData.push(data);
                    console.log(`[SCRAPER] Game #${data.gameId}: ${data.players.length} players, bust: ${data.bust}x`);
                }

                // Click Prev Game
                if (i < CONFIG.numGames - 1) {
                    const allLinks = Array.from(document.querySelectorAll('a[href^="/game/"]'));
                    const prevLink = allLinks.find(a => a.textContent.includes('Prev') || a.textContent.includes('←'));

                    if (prevLink) {
                        // Extract expected next game ID from link
                        const nextGameMatch = prevLink.href.match(/\/game\/(\d+)/);
                        const expectedGameId = nextGameMatch ? parseInt(nextGameMatch[1]) : null;

                        console.log(`[SCRAPER] Clicking Prev Game → #${expectedGameId}`);
                        prevLink.click();

                        // Wait for page to load intelligently
                        if (expectedGameId) {
                            try {
                                await waitForPageLoad(expectedGameId);
                                console.log(`[SCRAPER] Page #${expectedGameId} loaded successfully`);
                            } catch (error) {
                                console.error('[SCRAPER] Timeout waiting for page load:', error);
                                errors++;
                                // Continue anyway with small fallback delay
                                await new Promise(r => setTimeout(r, 1000));
                            }
                        } else {
                            // Fallback if we can't determine game ID
                            await new Promise(r => setTimeout(r, 500));
                        }
                    } else {
                        console.error('[SCRAPER] Prev Game button not found');
                        errors++;
                        break;
                    }
                }

            } catch (error) {
                console.error('[SCRAPER] Error:', error);
                errors++;
            }
        }

        updateStatus(`✅ Scraping complete!<br>Games: ${gamesData.length}/${CONFIG.numGames}<br>Errors: ${errors}`);

        // Download
        setTimeout(() => {
            downloadResults();
            updateStatus(`🎉 Download complete!<br>Check your Downloads folder`);
            startBtn.disabled = false;
            startBtn.style.opacity = '1';
            startBtn.textContent = 'START SCRAPING';
            scraping = false;
        }, 1000);
    }

    // Download results
    function downloadResults() {
        let filteredData = gamesData;
        if (CONFIG.filterPlayer) {
            // Include ALL games, even when player didn't play (important for strategy analysis)
            // HOW TO DETECT IF PLAYER DIDN'T PLAY:
            // - If player is NOT in the game.players array (pdata === undefined)
            // - All betting fields (bet, cashedAt, profit, won) will be null
            // - Only gameId and bust are populated
            // This allows algorithm analysis to identify when the player CHOSE NOT to play
            filteredData = gamesData.map(game => {
                const pdata = game.players.find(p => p.player === CONFIG.filterPlayer);

                // pdata === undefined → player didn't play this game
                // All fields set to null except gameId and bust
                return {
                    gameId: game.gameId,
                    bust: game.bust,
                    player: CONFIG.filterPlayer,
                    bet: pdata ? pdata.bet : null,        // null = didn't play
                    cashedAt: pdata ? pdata.cashedAt : null,  // null = didn't play
                    profit: pdata ? pdata.profit : null,     // null = didn't play
                    won: pdata ? pdata.won : null           // null = didn't play
                };
            });
        }

        const startGameId = gamesData.length > 0 ? gamesData[0].gameId : 0;
        const endGameId = gamesData.length > 0 ? gamesData[gamesData.length - 1].gameId : 0;

        const output = {
            filter: CONFIG.filterPlayer || 'all',
            scrapedAt: new Date().toISOString(),
            config: {
                startGameId,
                endGameId,
                numGames: CONFIG.numGames,
                gamesFound: gamesData.length
            },
            games: filteredData
        };

        const json = JSON.stringify(output, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${Date.now()}_${CONFIG.filterPlayer || 'all'}_${gamesData.length}games.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log('[SCRAPER] Downloaded:', a.download);
        if (CONFIG.filterPlayer && filteredData.length > 0) {
            // Filter only games where player actually played for stats
            const playedGames = filteredData.filter(g => g.bet !== null);
            if (playedGames.length > 0) {
                const wins = playedGames.filter(g => g.won).length;
                const totalProfit = playedGames.reduce((sum, g) => sum + g.profit, 0);
                const totalBet = playedGames.reduce((sum, g) => sum + g.bet, 0);
                console.log(`Player: ${CONFIG.filterPlayer}`);
                console.log(`Total games scraped: ${filteredData.length}`);
                console.log(`Games played: ${playedGames.length} (${((playedGames.length/filteredData.length)*100).toFixed(1)}%)`);
                console.log(`Wins: ${wins} (${(wins/playedGames.length*100).toFixed(1)}%)`);
                console.log(`Profit: ${totalProfit >= 0 ? '+' : ''}${(totalProfit/100).toFixed(0)} bits`);
                console.log(`ROI: ${((totalProfit/totalBet)*100).toFixed(2)}%`);
            } else {
                console.log(`Player: ${CONFIG.filterPlayer}`);
                console.log(`Total games scraped: ${filteredData.length}`);
                console.log(`Games played: 0 - Player didn't play in any of the scraped games`);
            }
        }
    }

    // Live Multiplier Monitor
    function startLiveMultiplierMonitor() {
        const multiplierValue = document.getElementById('live-multiplier-value');
        const multiplierState = document.getElementById('live-multiplier-state');

        if (!multiplierValue || !multiplierState) return;

        let lastMultiplier = 0;

        setInterval(() => {
            try {
                const engine = window._engine;
                if (!engine) {
                    multiplierValue.textContent = '--';
                    multiplierState.textContent = 'Engine not found';
                    return;
                }

                const gameState = engine.gameState;
                const startTime = engine.startTime;

                if (gameState === 'GAME_IN_PROGRESS' && startTime) {
                    // Use Bustabit's official getCurrentPayout() method
                    const multiplier = engine.getCurrentPayout();

                    // Format to 2 decimals
                    const displayMultiplier = multiplier.toFixed(2);
                    multiplierValue.textContent = displayMultiplier + 'x';
                    multiplierState.textContent = 'In Progress';

                    // Color based on value
                    if (multiplier >= 10) {
                        multiplierValue.style.color = '#ff00ff'; // Purple for high
                        multiplierValue.style.textShadow = '0 0 15px rgba(255,0,255,0.8)';
                    } else if (multiplier >= 5) {
                        multiplierValue.style.color = '#00ffff'; // Cyan for medium-high
                        multiplierValue.style.textShadow = '0 0 12px rgba(0,255,255,0.6)';
                    } else if (multiplier >= 2) {
                        multiplierValue.style.color = '#ffff00'; // Yellow for medium
                        multiplierValue.style.textShadow = '0 0 10px rgba(255,255,0,0.5)';
                    } else {
                        multiplierValue.style.color = '#00ff00'; // Green for low
                        multiplierValue.style.textShadow = '0 0 10px rgba(0,255,0,0.5)';
                    }

                    lastMultiplier = multiplier;

                    // Auto-cashout logic (only if enabled)
                    if (autoCashoutEnabled && engine.playing && !hasAutoCashedOut) {
                        // Calculate growth rate based on current multiplier
                        // At 5x, multiplier grows ~0.03x per 100ms
                        // At higher multipliers, it grows faster
                        const growthRate = multiplier * 0.006; // Approximate growth per 100ms

                        // Compensate for network + processing delay (~150-200ms)
                        const delayCompensation = growthRate * 2; // ~200ms compensation
                        const triggerPoint = autoCashoutTarget - delayCompensation;

                        if (multiplier >= triggerPoint) {
                            try {
                                engine.cashOut();
                                hasAutoCashedOut = true;

                                console.log(`[AUTO-CASHOUT] Triggered at ${multiplier.toFixed(2)}x (target: ${autoCashoutTarget.toFixed(2)}x, compensation: -${delayCompensation.toFixed(2)}x)`);

                                // Flash the multiplier display
                                multiplierValue.style.color = '#ffff00';
                                multiplierValue.style.textShadow = '0 0 20px rgba(255,255,0,1)';
                            } catch (error) {
                                console.error('[AUTO-CASHOUT] Error:', error);
                            }
                        }
                    }

                } else if (gameState === 'GAME_STARTING') {
                    multiplierValue.textContent = '1.00x';
                    multiplierState.textContent = 'Starting...';
                    multiplierValue.style.color = '#888';
                    multiplierValue.style.textShadow = 'none';

                    // Reset auto-cashout flag for new game (keep enabled state and target)
                    hasAutoCashedOut = false;

                } else if (gameState === 'GAME_ENDED') {
                    const bust = engine.bust;
                    if (bust) {
                        multiplierValue.textContent = bust.toFixed(2) + 'x';
                        multiplierState.textContent = 'BUSTED!';
                        multiplierValue.style.color = '#ff0000';
                        multiplierValue.style.textShadow = '0 0 15px rgba(255,0,0,0.8)';
                    }

                } else {
                    multiplierValue.textContent = '--';
                    multiplierState.textContent = gameState || 'Waiting...';
                    multiplierValue.style.color = '#666';
                    multiplierValue.style.textShadow = 'none';
                }

            } catch (error) {
                console.error('[MULTIPLIER] Error:', error);
                multiplierValue.textContent = 'ERR';
                multiplierState.textContent = error.message;
            }
        }, 100); // Update every 100ms
    }

    // Update History Display
    function updateHistoryDisplay() {
        const historyListDiv = document.getElementById('history-list');
        if (!historyListDiv) return;

        const engine = window._engine;
        if (!engine || !engine.history) {
            historyListDiv.innerHTML = '<div style="color: #666; text-align: center; padding: 10px;">No history available</div>';
            return;
        }

        // Build history HTML
        let html = '';
        engine.history.forEach((game, index) => {
            const bust = game.bust;
            let color = '#888';

            // Color based on bust value
            if (bust >= 10) {
                color = '#ff00ff'; // Purple
            } else if (bust >= 5) {
                color = '#00ffff'; // Cyan
            } else if (bust >= 2) {
                color = '#ffff00'; // Yellow
            } else if (bust >= 1.5) {
                color = '#00ff00'; // Green
            } else {
                color = '#ff0000'; // Red
            }

            html += `<div style="padding: 3px 5px; border-bottom: 1px solid #2a2a2a; display: flex; justify-content: space-between; align-items: center;">
                <span style="color: #555; font-size: 9px;">#${index + 1}</span>
                <span style="color: ${color}; font-weight: bold;">${bust.toFixed(2)}x</span>
            </div>`;
        });

        historyListDiv.innerHTML = html;

        // Scroll to top to show most recent
        historyListDiv.scrollTop = 0;
    }

    // Start History Monitor
    function startHistoryMonitor() {
        // Update initially
        setTimeout(updateHistoryDisplay, 1000);

        // Update every time game ends
        const engine = window._engine;
        if (engine) {
            engine.on('GAME_ENDED', () => {
                setTimeout(updateHistoryDisplay, 500);
            });
        }

        // Also update every 5 seconds as backup
        setInterval(updateHistoryDisplay, 5000);
    }

    // Custom SPACE hotkey for cashout (bypasses Bustabit's hotkey button)
    function enableCustomHotkeys() {
        console.log('[SCRAPER] Installing custom SPACE hotkey for cashout...');

        document.addEventListener('keydown', (e) => {
            // Only trigger on SPACE key
            if (e.code !== 'Space' && e.key !== ' ') return;

            // Don't trigger if typing in input/textarea
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            const engine = window._engine;
            if (!engine) return;

            // Check if we're currently playing
            if (engine.gameState === 'GAME_IN_PROGRESS' && engine.playing) {
                e.preventDefault(); // Prevent page scroll

                try {
                    // Cash out!
                    engine.cashOut();
                    console.log('[SCRAPER] Cashed out via SPACE key!');
                } catch (error) {
                    console.error('[SCRAPER] Error cashing out:', error);
                }
            }
        });

        console.log('[SCRAPER] Custom hotkeys enabled! Press SPACE to cashout during game.');
    }

    // Init
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            createControlPanel();
            startLiveMultiplierMonitor();
            startHistoryMonitor();
            enableCustomHotkeys();
        });
    } else {
        createControlPanel();
        startLiveMultiplierMonitor();
        startHistoryMonitor();
        enableCustomHotkeys();
    }

})();
