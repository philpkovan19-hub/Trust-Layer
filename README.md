# TrustLayer — BOT Chain Reputation System

TrustLayer is an on-chain reputation system for BOT Chain. Any address can
rate any other address (except itself) with a 1-5 star review and an
optional text comment. Ratings are aggregated on-chain into a public,
tamper-proof reputation profile for every address — a lightweight trust
layer any BOT Chain app can read.

## Contract: `ReputationSystem`

- **Solidity**: 0.8.20, optimizer enabled (200 runs)
- **Libraries**: OpenZeppelin `Ownable`, `ReentrancyGuard`, `Pausable`
- **Core rules**:
  - No self-reviews.
  - Rating must be between 1 and 5.
  - One review per reviewer/target pair (no double reviews).
  - Owner can pause/unpause new submissions.

### Key functions

| Function | Description |
|---|---|
| `submitReview(target, rating, comment)` | Submit a new 1-5 star review with a comment. |
| `getProfile(user)` | Returns `(totalScore, reviewCount, averageRating)` — average scaled by 100. |
| `getReviews(user)` | Returns the full list of reviews received by `user`. |
| `pause()` / `unpause()` | Owner-only circuit breaker. |

### Event

`ReviewSubmitted(address indexed reviewer, address indexed target, uint8 rating, string comment)`

## Project layout

```
contracts/ReputationSystem.sol   Main contract
scripts/deploy.js                Deployment script
test/ReputationSystem.test.js    Test suite (Hardhat + Chai + ethers v6)
frontend/index.html              Single-file DApp frontend
hardhat.config.js                Network + compiler config
```

## Getting started

```bash
npm install
npm run compile
npm test
```

## Deploying

1. Copy `.env.example` to `.env` and set `PRIVATE_KEY` to your deployer's
   private key (funded with testnet BOT).
2. Deploy to BOT Chain testnet:

   ```bash
   npm run deploy:testnet
   ```

3. Deploy to BOT Chain mainnet:

   ```bash
   npm run deploy:mainnet
   ```

4. Copy the deployed address into `CONTRACT_ADDRESS` in `frontend/index.html`.

### Networks

| Network | Chain ID | RPC |
|---|---|---|
| `botchain_testnet` | 968 | https://rpc.bohr.life |
| `botchain` (mainnet) | 677 | https://rpc.botchain.ai |

## Frontend

`frontend/index.html` is a single-file DApp: connect a MetaMask wallet
(with automatic BOT Chain testnet network switching), submit reviews with
a clickable star-rating widget, look up any address's reputation profile,
and view your own profile. No build step or external assets beyond
ethers.js v6 (loaded from cdnjs) are required — open the file directly or
deploy it as-is (see `vercel.json`).
