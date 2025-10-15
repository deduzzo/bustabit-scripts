# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This repository contains experimental betting scripts for Bustabit.com and Bustadice.com, along with supporting infrastructure for monitoring and data collection. The project consists of:

1. **Betting Scripts** - Root-level JavaScript files implementing various betting strategies
2. **Monitor Client** - React-based web application for visualizing game data
3. **Monitor Server** - Express/MongoDB backend for storing bust data
4. **WebSocket Server** - Real-time communication server

## Architecture

### Betting Scripts Structure

All betting scripts follow a common pattern:
- Use a `config` object with `{ value, type, label }` properties for user-configurable parameters
- Implement event handlers for `engine.on('GAME_STARTING')` and `engine.on('GAME_ENDED')`
- Access user information through `userInfo.balance`
- Place bets using `engine.bet(amount, multiplier)`
- Access game history via `engine.history.first()`

Key script categories:
- **Martingale variants**: `martinflat.js`, `martin15*.js` files
- **Fibonacci strategies**: `fibfast*.js`, `fibonacci*.js` files
- **Custom algorithms**: `paolobet*.js`, `parab*.js`, `grabmidbetandmult.js`
- **Utility**: `bustabot.js` (multi-mode bot), `bustabitController.js`

### Monitor System

**bustabit-monitor-client** (React application):
- Fetches bust data from server API endpoint
- Visualizes data using Recharts library with area charts
- Analyzes betting patterns (total bets, wins, losses per game)
- Implements betting simulation algorithms to test strategies
- Key component: `src/App.js` with data transformation and visualization logic

**bustabit-monitor-server** (Express/MongoDB application):
- MongoDB connection to mLab database
- Mongoose model: `models/Busts.js` with schema for game data (id, bust, hash, date, bets)
- REST API routes in `routes/busts.js`
- Controllers in `controllers/stats.js`

**bustabit-ws-server**:
- WebSocket server using `websocket` package
- Supports both HTTP and HTTPS with SSL certificates
- Echo protocol implementation for real-time communication

## Common Development Commands

### Monitor Client
```bash
cd bustabit-monitor-client
npm install                 # Install dependencies
npm start                   # Start dev server (default port 3000)
npm run build              # Build for production
npm test                   # Run tests
```

### Monitor Server
```bash
cd bustabit-monitor-server
npm install                 # Install dependencies
npm start                   # Start server (uses ./bin/www)
```

### WebSocket Server
```bash
cd bustabit-ws-server
npm install                 # Install dependencies
npm start                   # Start WebSocket server (port 8080)
```

## Script Development Guidelines

When creating or modifying betting scripts:

1. **Configuration**: Always use the config object pattern with proper typing (balance/multiplier)
2. **State Management**: Track essential state variables (balance, bet counts, game mode)
3. **Logging**: Use `log()` function for debugging and status updates
4. **Balance Tracking**: Manually track balance changes since scripts simulate iterations
5. **Disaster Recovery**: Implement reset mechanisms when strategies fail (see `resetCycle()` pattern)
6. **Iteration Support**: Many scripts support multiple iterations with `initBalance`, `stopDefinitive` configs

## Key Patterns

### Dual-Game Strategy (martinflat.js example)
- Game 1: Flat betting with progressive loss tracking
- Game 2: Recovery mode with exponential bet increases
- Switching logic based on loss thresholds and virtual loss counters

### Progressive Betting (paolobet.js example)
- Dynamic multiplier adjustment based on loss streaks
- Periodic strategy reset after fixed game counts
- Balance-based bet scaling

### Special Event Detection
- Some scripts monitor for high-value busts or patterns
- Implement temporary pauses after extreme outcomes
- Use moving averages for trend detection

## Database Schema

Busts collection:
- `id`: Unique game identifier (Number)
- `bust`: Game crash multiplier (Number)
- `hash`: Game hash (String)
- `date`: Timestamp (Date)
- `bets`: Object containing player bet information (Mixed type)

## Important Notes

- Scripts are designed to run within Bustabit's scripting environment
- The `engine` global object provides game state and betting interface
- The `userInfo` global object contains user account information
- Many scripts contain Italian comments and variable names
- SSL certificates required for WebSocket server (stored in `./ssl/` directory)
- Monitor server uses MongoDB hosted on mLab (connection string in `bustabit-monitor-server/app.js`)
