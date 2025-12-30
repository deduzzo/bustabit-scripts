# New Provably Fair Seeding Algorithm

This document describes the implementation of the new provably fair seeding algorithm for the Bustabit Script Simulator, based on the official Bustabit seeding system.

## Overview

The new algorithm uses:
- **SHA-256 hash chains** for game generation
- **BLS signatures** (BLS12-381 curve) for verifiable randomness
- **HMAC-SHA256** for calculating game results
- **Bitcoin block hashes** as game salt for additional fairness

## Key Components

### Constants

```javascript
TERMINATING_HASH = "567a98370fb7545137ddb53687723cf0b8a1f5e93b1f76f4a1da29416930fa59"
VX_PUBKEY = "b40c94495f6e6e73619aeb54ec2fc84c5333f7a88ace82923946fc5b6c8635b08f9130888dd96e1749a1d5aab00020e4"
TOTAL_GAMES = 100,000,000
```

### Hash Chain Verification

The system generates a chain of 100 million SHA-256 hashes by recursively hashing the previous value:

```javascript
hash_n = SHA256(hash_n+1)
```

You can verify if a hash is part of the chain using the `verifyInChain()` function:

```javascript
import { verifyInChain, hexToBytes } from './newProvablyFair';

const gameHash = hexToBytes("70eed5c29bde5132f4e41ec8b117a31533e5b055c6c21174d932b377a1855a04");
const gameId = verifyInChain(gameHash);
// Returns the game ID if valid, null otherwise
```

### Signature Validation

VX provides BLS signatures for each game by signing the concatenation of the previous game hash and the game salt:

```javascript
message = prevGameHash || gameSalt
signature = BLS_SIGN(message, VX_PRIVATE_KEY)
```

Validation is done using:

```javascript
import { validateSignature } from './newProvablyFair';

const isValid = validateSignature(gameSalt, prevGameHash, vxSignature);
```

### Game Result Calculation

The crash point (bust multiplier) is calculated from the VX signature and game hash:

```javascript
import { gameResult } from './newProvablyFair';

const bust = gameResult(vxSignature, gameHash);
// Returns crash point as a number (e.g., 1.98 for 1.98x)
```

**Algorithm steps:**
1. Calculate `HMAC_SHA256(key=vxSignature, message=gameHash)`
2. Extract 52 most significant bits as integer `r`
3. Normalize: `X = r / 2^52` (uniform distribution in [0, 1))
4. Transform: `X = 99 / (1 - X)`
5. Return: `max(1, floor(X) / 100)`

## Simulation Implementation

For simulation purposes (without access to VX's private key), the system generates deterministic mock signatures based on the game hash and salt:

```javascript
import { generateMockSignature, generateGameResults } from './newProvablyFair';

// Generate mock signature for a game
const mockSignature = generateMockSignature(gameHash, gameSalt);

// Generate multiple game results
const results = generateGameResults(100, "my_simulation_salt");
// Returns array of { hash, bust, signature }
```

## Usage in Simulator

The simulator can toggle between the old and new algorithm using the `USE_NEW_ALGORITHM` flag in `src/data/simulate.js`:

```javascript
const USE_NEW_ALGORITHM = true; // Set to false for legacy algorithm
```

When enabled, the simulator:
1. Generates a hash chain for the requested number of games
2. Creates mock BLS signatures for each game
3. Calculates crash points using the new algorithm
4. Runs the simulation with these results

## Files

- **src/data/newProvablyFair.js** - Core implementation of the new algorithm
- **src/data/simulate.js** - Updated simulator engine with algorithm toggle
- **NEW_SEEDING_ALGORITHM.md** - This documentation file

## Dependencies

```json
{
  "@noble/hashes": "^latest",
  "@noble/curves": "^latest"
}
```

These libraries provide:
- Secure SHA-256 and HMAC implementations
- BLS12-381 curve operations for signature verification
- Utility functions for byte/hex conversions

## Differences from Production

**Important:** The simulator uses **mock signatures** for testing purposes. In production on bustabit.com:

1. VX generates real BLS signatures using its private key
2. The game salt comes from actual Bitcoin block #831500
3. The hash chain starts from a pre-committed secret
4. All signatures are verifiable using VX's public key

## Security Considerations

The new algorithm provides:
- **Provable fairness**: All game results are deterministic from verifiable inputs
- **Unpredictability**: Bitcoin block hash as salt ensures no pre-computation
- **Verifiability**: BLS signatures prove VX generated results correctly
- **Transparency**: Hash chain allows verification of game sequence

## Testing

To test the implementation:

1. Start the development server:
   ```bash
   npm start
   ```

2. Load the simulator in your browser:
   ```
   http://localhost:3000/bustabit-script-simulator
   ```

3. Run a script to verify results are generated correctly

4. Check console for any errors in hash chain or signature validation

## References

- [Bustabit Official Documentation](https://www.bustabit.com/)
- [@noble/hashes Documentation](https://github.com/paulmillr/noble-hashes)
- [@noble/curves Documentation](https://github.com/paulmillr/noble-curves)
- [BLS Signatures Specification](https://datatracker.ietf.org/doc/html/draft-irtf-cfrg-bls-signature-04)

## Legacy Algorithm

The old algorithm is still available for comparison and backward compatibility. It uses:
- CryptoJS for HMAC-SHA256
- A fixed HMAC key: `0000000000000000004d6ec16dafe9d8370958664c1dc422f452892264c59526`
- SHA-256 for hash chain generation

To use the legacy algorithm, set `USE_NEW_ALGORITHM = false` in simulate.js.
