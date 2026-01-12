# ESP32 IoT Data Certification System on Cardano

**Live dashboard:** https://matiastrapaglia.space:3000/?token=gaelito2025

[![CI/CD Pipeline](https://github.com/MDTrapaglia/IoT_signature/actions/workflows/ci.yml/badge.svg)](https://github.com/MDTrapaglia/IoT_signature/actions/workflows/ci.yml)

## Overview

Production-ready IoT data certification system that captures sensor measurements from ESP32 devices, cryptographically signs them with **Ed25519**, and validates them on the Cardano blockchain. Three-layer architecture: hardware edge (ESP32), Node.js backend with auto-submission, and Next.js dashboard.

**Current Status:** ✅ Phase 3 Complete - Full end-to-end integration with Cardano Preprod validated with confirmed transactions.

**Latest Release:** [v1.0.0](https://github.com/MDTrapaglia/IoT_signature/releases/tag/v1.0.0) - Lucid Evolution migration complete

## System Architecture

### Hardware Layer (ESP32 Edge Device)

- **Technology:** ESP32 with Ed25519 cryptographic signing
- **Responsibilities:**
  - Sensor data capture (temperature, humidity, etc.)
  - Ed25519 signature generation over SHA-256 hash
  - HTTP POST to backend API with JSON payload
- **Main Sketch:** `hardware/sign_device_ed25519.ino`
- **Setup Guide:** `hardware/README_ED25519.md`

### Backend Layer (Node.js + PostgreSQL)

- **Technology:** Express 5, TypeScript, PostgreSQL, Prisma ORM, Lucid Evolution
- **Security:**
  - **Token Authentication:** All endpoints protected with `ACCESS_TOKEN`
  - **Rate Limiting:** 100 requests per 15 minutes per IP
  - **Ed25519 Signature Validation:** Cryptographic verification on every measurement
  - **CORS:** Configured for cross-origin requests
- **Features:**
  - ✅ **API REST:** Receive and validate signed sensor data
  - ✅ **PostgreSQL + Prisma:** Persistent storage of measurements, sensors, and transactions
  - ✅ **Auto-Submission Service:** Automatic oracle updates to Cardano blockchain
  - ✅ **Transaction Monitor:** Detects and updates transaction confirmations
  - ✅ **Lucid Evolution Integration:** Builds and submits Plutus V3 transactions
- **Main File:** `offchain/backend/api_server.ts`
- **Port:** 3001
- **Services:**
  - `oracle-submission.service.ts` - Auto-submit measurements to Cardano
  - `transaction-monitor.service.ts` - Monitor transaction confirmations

### Frontend Layer (Next.js Dashboard)

- **Technology:** Next.js 15, React, TypeScript, Tailwind CSS, Lucide React
- **Features:**
  - Real-time sensor data visualization (5-second polling)
  - Transaction history with Cardano Explorer links
  - Ed25519 signature verification status
  - Visual indicators: green (verified), yellow (pending), red (failed)
  - Dark theme (zinc palette)
- **Directory:** `offchain/frontend/`
- **Port:** 3000
- **Config:** `offchain/frontend/.env.local` (API URL and access token)

## Data Flow

### Current Flow (End-to-End Validated)

```
ESP32 → POST /api/ingest → Express Backend → PostgreSQL
                              ↓                   ↓
                        Ed25519 Verify    Save Measurement
                              ↓                   ↓
                    Auto-Submission Service → Lucid Evolution
                              ↓
                    Cardano Preprod (Plutus V3 Script)
                              ↓
                    Transaction Monitor → Update DB Status
                              ↓
                    Frontend ← GET /api/transactions
```

### Successful Validation

The system has been validated end-to-end with **3 confirmed transactions** on Cardano Preprod testnet:

1. **Oracle Creation:** [1fbc44bb...](https://preprod.cardanoscan.io/transaction/1fbc44bb0723ea76d91e3a115565c4c43bd46ff74fce4810e7f15708faf5c303)
2. **Oracle Update #1:** [7688deb3...](https://preprod.cardanoscan.io/transaction/7688deb3dce4ef9425c9b6586a6fd6267bf159b55a559119a3767e9459018996)
3. **Oracle Update #2:** [5a33f39...](https://preprod.cardanoscan.io/transaction/5a33f39415ff303f85ce1a863b4afb44e16c268a20f45c062d5a8893f0d018ed)

See `temp/E2E_SUCCESS_REPORT.md` for complete test results.

## Data Models

### Sensor Data (Ed25519 - Current)

```typescript
interface SensorData {
  sensor_id: string;
  temperature: number;   // Temperature * 10 (e.g., 23.5°C = 235)
  humidity: number;      // Humidity * 10 (e.g., 65.2% = 652)
  timestamp: number;     // Unix timestamp (milliseconds)
  signature: string;     // Ed25519 signature (64 bytes hex = 128 chars)
  public_key: string;    // Ed25519 public key (32 bytes hex = 64 chars)
}
```

### Database Schema (Prisma)

```prisma
model Measurement {
  id           String    @id @default(cuid())
  sensorId     String
  temperature  Int
  humidity     Int
  timestamp    BigInt
  hash         String
  signature    String
  publicKey    String
  verified     Boolean
  createdAt    DateTime  @default(now())
  sensor       Sensor    @relation(fields: [sensorId], references: [id])
  transaction  OracleTransaction?
}

model Sensor {
  id              String    @id
  publicKey       String
  nftPolicyId     String?
  nftAssetName    String?
  scriptAddress   String?
  status          String    @default("ACTIVE")
  measurements    Measurement[]
}

model OracleTransaction {
  id              String    @id @default(cuid())
  txHash          String    @unique
  sensorId        String
  measurementId   String    @unique
  status          String    // PENDING, CONFIRMED, FAILED
  slot            BigInt?
  blockHeight     BigInt?
  createdAt       DateTime  @default(now())
  confirmedAt     DateTime?
  measurement     Measurement @relation(fields: [measurementId], references: [id])
}
```

## API Endpoints

- `POST /api/ingest` - Receive signed sensor data
  - Requires: `?token=XXX` or header `x-access-token`
  - Validates Ed25519 signature
  - Returns 401 if invalid, 201 if valid
  - Saves to PostgreSQL

- `GET /api/measurements` - Return measurement history
  - Requires authentication token
  - Returns array with verification status

- `GET /api/transactions` - Return Cardano transaction history
  - Optional query: `?status=CONFIRMED|PENDING|FAILED`
  - Returns transactions with Cardano Explorer links

- `GET /api/sensors` - List registered sensors
  - Returns sensors with NFT and oracle configuration

## Oracle System

### Overview

The oracle system validates ESP32 sensor data **on-chain** using Ed25519 signatures over SHA-256 hashes. Each sensor has a unique NFT that identifies its oracle UTXO on Cardano.

### Signature Flow

1. Construct message (alphabetical field order): `humidity || sensor_id || temperature || timestamp`
2. Calculate SHA-256 hash of the message
3. Sign the **HASH** with Ed25519 (not the message directly)
4. On-chain Plutus V3 validator reconstructs message, calculates hash, verifies signature

See `docs/SIGNATURE_FLOW.md` for details.

### Oracle Workflow

1. **Mint NFT:** `npm run oracle:mint-nft -- <sensor_id>`
2. **Create Oracle:** `npm run oracle:create -- <policy_id> <asset_name>`
3. **Update Oracle:** `npm run oracle:update -- <policy_id> <asset_name>`
4. **Auto-Update:** Backend service automatically submits measurements every 5 seconds

### On-Chain Validation (Plutus V3)

The `sensor_oracle_ed25519.ak` validator verifies:

- ✅ Transaction signed by authorized operator
- ✅ NFT present in both input and output
- ✅ Sensor data within valid ranges (temp: -50°C to 100°C, humidity: 0-100%)
- ✅ Ed25519 signature verification over SHA-256 hash

### Confirmed Oracle Address

**Preprod Testnet:**
- Address: `addr_test1wrnvvflfufl8jt0fcqx66lwd5tj9lrvhszk3yd6jcdanrmg36xvjw`
- NFT Policy: `023813595f7055e76eeedec679ce811634b3e7fd4ba03c6ff61f84b5`
- View on explorer: [CardanoScan](https://preprod.cardanoscan.io/address/addr_test1wrnvvflfufl8jt0fcqx66lwd5tj9lrvhszk3yd6jcdanrmg36xvjw)

## Available Commands

### Development

```bash
npm install                 # Install dependencies
npm run dev                 # Start dev server with tsx watch (port 3001)
```

### Oracle Scripts (Lucid Evolution - Active)

```bash
npm run oracle:mint-nft -- <sensor_id>                              # Mint NFT for sensor
npm run oracle:create -- <policy_id> <asset_name>                   # Create oracle with NFT
npm run oracle:update -- <policy_id> <asset_name> [num_updates]    # Update oracle
npm run oracle:delete -- <policy_id> <asset_name>                   # Delete oracle
```

### Database Management

```bash
npm run db:status              # Check database status
npm run db:clean-failed        # Clean failed transactions
npm run db:register-sensor -- <sensor_id> <public_key> [nft_policy] [asset_name] [script_address]
npm run db:verify-oracle-address  # Verify oracle address matches DB
```

### End-to-End Testing

```bash
npm run test:e2e               # Run E2E test (single run)
npm run test:e2e:watch         # Run E2E test with monitoring
```

See `scripts/README_TEST_E2E.md` for detailed testing guide.

### Shell Scripts

```bash
./scripts/backend_start.sh     # Start backend (saves PID to /tmp/backend_e2e.pid)
./scripts/backend_stop.sh      # Stop backend by PID
./scripts/test.sh              # Test API with curl
./scripts/test_signatures.sh   # Test Ed25519 signature verification
```

## Technology Stack

### Implemented

- **Express 5** - REST API server
- **PostgreSQL + Prisma ORM** - Persistent storage
- **Ed25519 (tweetnacl)** - Cryptographic signatures (ESP32 + Backend)
- **Lucid Evolution 0.4.29** - Cardano transaction builder (Plutus V3)
- **Blockfrost API** - Cardano blockchain queries
- **Next.js 15** - Frontend dashboard with App Router
- **Aiken** - Plutus V3 smart contract language

### Deprecated

- **MeshJS 1.9.0-beta.90** - DEPRECATED due to Plutus V3 bug (`Cannot convert undefined to BigInt`)
  - Legacy scripts available with `:meshjs` suffix for reference only
  - See `docs/MESHJS_PLUTUS_V3_ISSUE.md` for bug analysis

## Project Structure

```
/
├── offchain/
│   ├── backend/            # Express API + Services
│   │   ├── api_server.ts              # Main server (port 3001)
│   │   ├── prisma/                    # Database schema
│   │   └── services/
│   │       ├── oracle-submission.service.ts    # Auto-submit to Cardano
│   │       └── transaction-monitor.service.ts  # Monitor confirmations
│   ├── frontend/           # Next.js dashboard (port 3000)
│   └── transactions/       # Cardano transaction code
│       ├── oracle_lucid_lib.ts        # Reusable Lucid functions (MAIN)
│       ├── mint_sensor_nft_lucid.ts   # Mint NFT
│       ├── create_oracle_lucid.ts     # Create oracle
│       ├── update_oracle_lucid.ts     # Update oracle
│       ├── delete_oracle_lucid.ts     # Delete oracle
│       └── types_lucid.ts             # TypeScript types
├── onchain/
│   └── sensors-oracle/
│       ├── validators/
│       │   └── sensor_oracle_ed25519.ak  # Plutus V3 validator (MAIN)
│       └── plutus.json                   # Compiled Plutus scripts
├── hardware/
│   ├── sign_device_ed25519.ino   # ESP32 Ed25519 signing (MAIN)
│   └── README_ED25519.md         # ESP32 setup guide
├── scripts/
│   ├── test_e2e.py                    # Automated E2E testing
│   ├── verify_oracle_address.ts       # Verify oracle addresses
│   └── check_nft_location.ts          # Locate NFTs
├── docs/                   # Documentation
└── temp/                   # Testing and migration reports
```

## Key Documentation

- `docs/MIGRATION_PLAN_LUCID_EVOLUTION.md` - Migration plan from MeshJS to Lucid
- `temp/MIGRACION_LUCID_EVOLUTION_LOG.md` - Complete migration log
- `temp/E2E_SUCCESS_REPORT.md` - E2E test results with confirmed transactions
- `temp/E2E_TESTING_GUIDE.md` - Complete testing guide
- `scripts/README_TEST_E2E.md` - Automated testing documentation
- `docs/SIGNATURE_FLOW.md` - Ed25519 signature flow explanation
- `docs/MESHJS_PLUTUS_V3_ISSUE.md` - MeshJS bug analysis

## Implementation Roadmap

- [x] **Phase 1:** ESP32 generates Ed25519 signatures
- [x] **Phase 2:** Backend validates Ed25519 signatures + Next.js dashboard
- [x] **Phase 3:** Cardano Preprod integration with Lucid Evolution
  - [x] Oracle NFT minting
  - [x] Oracle creation with Plutus V3
  - [x] Oracle updates with Ed25519 validation on-chain
  - [x] Auto-submission service
  - [x] Transaction monitoring
  - [x] PostgreSQL + Prisma integration
  - [x] End-to-end testing validated
- [ ] **Phase 4:** Production deployment
  - [ ] Mainnet deployment (when ready)
  - [ ] Multi-sensor support
  - [ ] Frontend improvements
  - [ ] Collateral UTXO management optimization

## CI/CD Pipeline

Complete automation with GitHub Actions:

### Continuous Integration

Triggered on every push or pull request to `main` or `develop`:

- ✅ **Build:** Backend (TypeScript) + Frontend (Next.js)
- ✅ **Linting:** ESLint code quality checks
- ✅ **Tests:** API tests + Ed25519 signature validation
- ✅ **Security:** npm audit for vulnerabilities
- ✅ **Artifacts:** Build artifacts for deployment

### Continuous Deployment

Two deployment options:

1. **Automatic:** Runs on every push to `main` (artifact preparation)
2. **Manual:** GitHub Actions workflow with options:
   - Environment selection (staging/production)
   - Selective deployment (backend/frontend)
   - Full deployment control

See [`.github/workflows/README.md`](.github/workflows/README.md) for:
- Secret configuration
- Deployment customization
- Troubleshooting
- Platform-specific examples

## Development Setup

### Reproducible Environment with Nix (Recommended)

This project uses [Nix](https://nixos.org/) for a reproducible development environment.

#### Prerequisites

- Install Nix with flakes: https://nixos.org/download.html
- (Optional) Install [direnv](https://direnv.net/) for automatic activation

#### Quick Start

```bash
# Validate Nix installation and flake configuration
./scripts/validate_nix.sh

# Enter Nix development environment
nix develop

# Or with direnv:
direnv allow  # Auto-loads environment on cd
```

The Nix environment includes:
- Node.js 20 LTS
- npm, TypeScript, tsx
- Arduino CLI (for ESP32 development)
- PostgreSQL client tools
- Git, curl, jq, and other utilities

#### Benefits
- **Reproducible:** Same environment across all machines
- **Isolated:** No conflicts with system packages
- **Declarative:** All dependencies in `flake.nix`
- **Version-pinned:** Exact tool versions guaranteed

📖 **Complete guide:** See [docs/NIX_SETUP.md](docs/NIX_SETUP.md)

### Traditional Setup

1. Clone the repository
2. Copy `.env.example` to `.env` and configure:
   - `ACCESS_TOKEN` - API authentication token
   - `BLOCKFROST_API_KEY` - Cardano API key (get from [blockfrost.io](https://blockfrost.io))
   - `PRIVATE_KEY` - Cardano wallet private key (Bech32 format)
   - `DATABASE_URL` - PostgreSQL connection string
3. Install dependencies: `npm install`
4. In `offchain/frontend/`, copy `.env.example` to `.env.local`
5. Configure frontend environment variables
6. Initialize database: `npx prisma migrate dev`

### Start Complete System

```bash
# Terminal 1: Backend + Auto-submission + Transaction Monitor
export ORACLE_AUTO_SUBMIT=true
export ORACLE_SUBMIT_DELAY_MS=5000
npm run dev

# Terminal 2: Frontend Dashboard
cd offchain/frontend
npm run dev
```

Access:
- Backend API: http://localhost:3001
- Frontend Dashboard: http://localhost:3000

## Testing

### Manual Testing

```bash
# Test Ed25519 signature verification
./scripts/test_signatures.sh

# Test API endpoints
./scripts/test.sh

# Check database status
npm run db:status
```

### Automated End-to-End Testing

```bash
# Run complete E2E test with monitoring
npm run test:e2e:watch

# Or directly with Python:
python3 scripts/test_e2e.py --watch --token <your_token>
```

The E2E test validates:
1. Backend health check
2. Sensor configuration in database
3. Measurement submission with Ed25519 signature
4. Auto-submission to Cardano
5. Transaction confirmation on blockchain
6. Frontend data availability

See `scripts/README_TEST_E2E.md` for complete testing documentation.

## Known Issues and Limitations

### Resolved

- ✅ **MeshJS Plutus V3 Bug:** Completely resolved by migration to Lucid Evolution
  - Original error: `Cannot convert undefined to a BigInt`
  - Solution: 100% Lucid Evolution for all oracle operations
  - Documentation: `docs/MESHJS_PLUTUS_V3_ISSUE.md`

### Active

- ⚠️ **Collateral UTXO Contamination:** 27% transaction success rate due to NFT contamination in collateral UTXOs
  - Impact: 8 of 11 test transactions failed (73%)
  - Workaround: Create clean collateral UTXOs with only ADA
  - Solution planned: Manual UTXO selection in Lucid transaction builder
  - See `temp/E2E_SUCCESS_REPORT.md` for details

## Contributing

This is an educational/research project. Contributions are welcome via pull requests.

## License

MIT License - See LICENSE file for details

## Support

- **Issues:** https://github.com/MDTrapaglia/IoT_signature/issues
- **Documentation:** See `docs/` directory
- **E2E Testing:** See `temp/E2E_SUCCESS_REPORT.md`

---

**Production Status:** System validated end-to-end with 3 confirmed transactions on Cardano Preprod testnet. Ready for further testing and optimization before mainnet deployment.
