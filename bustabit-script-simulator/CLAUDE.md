# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Structure

This is a **dual-branch repository**:

- **`master` branch**: Contains the React application source code
- **`gh-pages` branch**: Contains the built/deployed static site (served at https://mtihc.github.io/bustabit-script-simulator/)

**IMPORTANT**: You are currently on the `gh-pages` branch. To work with source code, you must switch to the `master` branch first:

```bash
git checkout master
# or to check out from upstream
git fetch upstream master && git checkout -b master upstream/master
```

## Development Commands (from master branch)

### Install dependencies
```bash
npm install --package-lock-only
```

### Run development server
```bash
npm start
```
Opens at http://localhost:3000 with hot reload enabled.

### Run tests
```bash
npm test
```
Launches test runner in interactive watch mode.

### Build for production
```bash
npm run build
```
Creates optimized production build in `build/` directory.

### Deploy to GitHub Pages
```bash
npm run deploy
```
Builds and deploys to `gh-pages` branch automatically.

### Update dependencies
```bash
npm audit fix --force
```
Note: May require fixing deprecated code in d3 (line chart) or jszip (script backups).

## Architecture Overview

This is a React application built with **Create React App** that simulates Bustabit gambling scripts using provably fair game generation.

### Core Technologies
- **React 17** with JSX
- **Flux** architecture for state management
- **Bulma** for CSS styling
- **SASS** for component styles
- **D3.js** for line chart visualization
- **CryptoJS** for provably fair game hash calculation
- **JSZip** for script backup/export functionality

### Key Architecture Patterns

#### Flux Data Flow
The app uses Flux pattern with:
- **Dispatcher**: `src/data/AppDispatcher.js` - central event hub
- **Actions**:
  - `src/data/ScriptActions.js` - script CRUD operations
  - `src/data/NotificationActions.js` - notification management
- **Stores**:
  - `src/data/ScriptStore.js` - single script state
  - `src/data/ScriptListStore.js` - list of scripts
  - `src/data/NotificationStore.js` - notification state
- **Views**: `src/views/` - React components that listen to stores

#### Simulation Engine
`src/data/simulate.js` contains:
- **`hashToBust(seed)`**: Converts game hash to bust multiplier using provably fair algorithm
- **`hashToBusts(seed, amount)`**: Generates chain of game results backwards from seed hash
- **`SimulatedBustabitEngine`**: EventEmitter that mimics bustabit.com's engine API
  - Events: `GAME_STARTING`, `GAME_STARTED`, `GAME_ENDED`, `BET_PLACED`, `CASHED_OUT`
  - Methods: `bet(wager, payout)`, exposes `history`, `gameState`, `next`, `_userInfo`
- **`SimulatedBustabitHistory`**: Data structure for game history access

User scripts run in a sandboxed environment with exposed globals:
- `config` - parsed from script's `var config = {...}` declaration
- `engine` - SimulatedBustabitEngine instance
- `userInfo` - user stats (balance, bets, profit, streaks)
- `log(message)`, `stop(reason)`, `notify(message)` - utility functions
- `sim` - simulator-only object with `enableChart`, `enableLog`, `gameAmount`, `gameHash`, `startingBalance`

### Component Structure
- **AppContainer.js**: Root container connecting Flux stores to AppView
- **AppView.jsx**: Main application layout
- **BustabitScript.jsx**: Script editor and execution interface
- **BustabitScriptConfig.jsx**: Parses and renders UI for script's `config` object
- **LineChart.jsx**: D3-based balance visualization over time
- **Notifications.jsx**: Toast-style notification system
- **OptionsMenu.jsx**: Kebab menu for script actions

### Local Storage
Scripts and configurations are persisted in browser's localStorage (mimicking bustabit.com behavior).

### Provably Fair Algorithm
Games use bustabit's actual provably fair system:
1. Start with a known game hash
2. Calculate that game's result using HMAC-SHA256
3. Hash that result with SHA256 to get previous game's hash
4. Repeat to generate chain of historical games in reverse order
5. Simulation runs games in forward order

## Important Notes

- **Disclaimer**: This simulator is NOT affiliated with bustabit.com
- **No guarantees**: Past simulation results don't predict future outcomes
- The simulation engine is a **from-scratch implementation** (not copied from bustabit)
- Scripts work identically to bustabit.com's autobet system
- The `sim` variable only exists in simulator, not on actual bustabit.com

## Upstream Repository
- Original: https://github.com/Mtihc/bustabit-script-simulator
- Fork: https://github.com/deduzzo/bustabit-script-simulator
