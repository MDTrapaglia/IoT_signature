# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ESP32 IoT Data Certification System for Cardano blockchain. Captures sensor measurements from Arduino/ESP32 devices, cryptographically signs them with **Ed25519**, and uploads to Cardano. Three-layer architecture: hardware edge (Arduino), Node.js backend, Next.js frontend dashboard.

**Current Phase:** Phase 2 - Ed25519 signatures validated on-chain (PostgreSQL + Prisma integrated)

## ⚠️ Known Issues & Solutions

### MeshJS Beta - Plutus V3 Spending Bug (RESUELTO con Lucid Evolution)

**Status:** ✅ RESUELTO - Migrado a Lucid Evolution para oracle updates
**Original Error:** `Cannot convert undefined to a BigInt` during transaction building with MeshJS
**Impact:** Oracle updates fallaban completamente

**Solution:** Arquitectura híbrida MeshJS + Lucid Evolution
- MeshJS: create, mint, delete (funcionan correctamente)
- **Lucid Evolution: update** (soluciona el bug)

**Full documentation:**
- Migration plan: `docs/MIGRATION_PLAN_LUCID_EVOLUTION.md`
- Migration log: `temp/MIGRACION_LUCID_EVOLUTION_LOG.md`
- Original bug analysis: `docs/MESHJS_PLUTUS_V3_ISSUE.md`

**What works:**
- ✅ Backend receiving and validating measurements
- ✅ Database storing signed data
- ✅ Frontend dashboard showing metrics
- ✅ Oracle creation (initial deployment - MeshJS)
- ✅ **Oracle updates (Lucid Evolution)** ⭐ NEW

**Known Limitations:**
- ⚠️ MeshJS and Lucid Evolution calculate **different script addresses** for the same code
- ⚠️ Current workaround: Hardcoded script address in update_oracle_lucid.ts
- ⚠️ Requires investigation why addresses differ

## Commands

```bash
# Development
npm install                 # Install dependencies
npm run dev                 # Start dev server with tsx watch (port 3001)
npm run demo                # Run transaction demo
npm run nft                 # Run NFT minting

# Oracle Scripts (Cardano transactions with Ed25519)
npm run oracle:mint-nft -- <sensor_id>           # Mint NFT for sensor
npm run oracle:create -- <policy_id> <asset_name> # Create oracle with NFT (Ed25519 - MeshJS)
npm run oracle:update -- <policy_id> <asset_name> [num_updates] # BROKEN: MeshJS Plutus V3 bug
npm run oracle:update:lucid -- <policy_id> <asset_name> [num_updates] # Update oracle (Lucid Evolution)
npm run oracle:delete -- <policy_id> <asset_name> # Delete oracle

# Ed25519 Testing
npm run test:ed25519:create    # Create UTXO with Ed25519 signature
npm run test:ed25519:consume   # Consume UTXO (validates on-chain)

# Database Management
npm run db:status              # Check database status (measurements, sensors, transactions)
npm run db:clean-failed        # Clean failed transactions from database
npm run db:register-sensor -- <sensor_id> <public_key> [nft_policy_id] [nft_asset_name] [script_address]

# Shell scripts
./scripts/backend_start.sh  # Start server (kills previous, saves PID to .dev.pid)
./scripts/backend_stop.sh   # Stop server by PID
./scripts/test.sh           # Test API with curl (POST /api/ingest, GET /api/measurements)
./scripts/test_signatures.sh # Test ECDSA signature verification
```

## Architecture

```
Arduino/ESP32 → POST /api/ingest → Express Backend → (future: PostgreSQL, Cardano)
                                         ↓
Frontend ← GET /api/measurements ←───────┘
```

### API Endpoints

- `POST /api/ingest` - Receive signed sensor data: `{ sensor_id, hash, signature, publicKey }`
- `GET /api/measurements` - Return all stored measurements

### Project Structure

```
/
├── offchain/
│   ├── backend/        # Express API server
│   │   ├── api_server.ts      # Main server (port 3001)
│   │   └── srial_index.ts     # Serial port listener (not active)
│   ├── frontend/       # Next.js dashboard (port 3000)
│   └── transactions/   # Cardano transaction code
│       ├── mint_nft.ts            # NFT minting (demo)
│       ├── mint_sensor_nft.ts     # Mint NFT for sensor oracle
│       ├── create_oracle.ts       # Initialize oracle with NFT
│       ├── update_oracle.ts       # Update oracle with sensor data
│       ├── transaction.ts         # Transaction demo
│       ├── types.ts               # TypeScript types for SensorData
│       └── self_send.tsm          # Self-send transaction
├── onchain/
│   └── sensors-oracle/ # Aiken smart contracts
├── hardware/           # Arduino/ESP32 code
│   ├── sign_device_ed25519.ino    # Ed25519 signing sketch (MAIN)
│   ├── README_ED25519.md          # Ed25519 setup guide
│   └── sign_device.ino            # ECDSA signing (legacy/Ethereum)
├── scripts/            # Management scripts
├── docs/               # Documentation
└── test-data/          # Test payloads and signatures
```

### Key Files

- `offchain/backend/api_server.ts` - Main Express server (port 3001)
- `offchain/backend/srial_index.ts` - Alternative serial port listener for Arduino (not active)
- `hardware/sign_device_ed25519.ino` - ESP32 Arduino sketch with **Ed25519** signing (MAIN)
- `hardware/sign_device.ino` - ESP32 Arduino sketch with ECDSA signing (legacy/Ethereum)
- `hardware/README_ED25519.md` - Ed25519 setup and installation guide
- `offchain/frontend/` - Next.js dashboard application
- `offchain/transactions/` - Cardano transaction code
  - **MeshJS scripts:**
    - `mint_sensor_nft.ts` - Mint unique NFT for sensor oracle
    - `create_oracle.ts` - Initialize oracle with NFT and Ed25519 signed data
    - `delete_oracle.ts` - Delete oracle and recover ADA
    - `update_oracle.ts` - ⚠️ DEPRECATED (MeshJS bug) - Use `update_oracle_lucid.ts`
  - **Lucid Evolution scripts:**
    - `update_oracle_lucid.ts` - ⭐ Update oracle with Lucid Evolution (ACTIVE)
    - `types_lucid.ts` - Schemas and types for Lucid Evolution
  - **Common/Testing:**
    - `types.ts` - TypeScript types for SensorData and OracleParams (Ed25519)
    - `test_ed25519_create.ts` - Test Ed25519 UTXO creation
    - `test_ed25519_consume.ts` - Test Ed25519 UTXO consumption (validates on-chain)
- `onchain/sensors-oracle/validators/` - Aiken smart contracts
  - `sensor_oracle_ed25519.ak` - Smart contract with **Ed25519** verification (MAIN)
  - `sensor_oracle_verified.ak` - Smart contract with ECDSA verification (legacy/Ethereum)
  - `simple_ed25519_validator.ak` - Simple Ed25519 test validator
  - `nft.ak` - NFT minting policy
- `onchain/sensors-oracle/plutus.json` - Compiled Plutus scripts
- `docs/ed25519-migration-guide.md` - Complete Ed25519 migration guide

### Data Model

```typescript
// Current model (Ed25519)
interface SensorData {
  sensor_id: string;
  temperature: number;   // Temperatura * 10 (ej: 23.5°C = 235)
  humidity: number;      // Humedad * 10 (ej: 65.2% = 652)
  timestamp: number;     // Unix timestamp en milisegundos
  signature: string;     // Ed25519 signature (64 bytes hex = 128 chars)
  public_key: string;    // Ed25519 public key (32 bytes hex = 64 chars)
}

// Legacy model (ECDSA - for reference/Ethereum)
interface ArduinoPayload {
  sensor_id: string;
  hash: string;          // SHA-256 hash of the message
  signature: string;     // ECDSA signature (hex)
  publicKey: string;     // secp256k1 public key (hex)
}
```

## Technologies

### Implemented
- **Express 5** - API server
- **Ed25519 (tweetnacl)** - Ed25519 signature generation and verification (MAIN)
- **elliptic** - ECDSA secp256k1 signature verification (legacy/Ethereum)
- **Next.js 15** - Frontend dashboard
- **MeshJS** - Cardano transaction building
- **Aiken** - Smart contract language for Cardano

### Planned (Not Yet Integrated)
- **PostgreSQL + Prisma** - Persistent storage (currently in-memory)
- **Blockfrost** - Cardano API queries (partially implemented in oracle scripts)

## Oracle System

### Overview

The sensor oracle system validates ESP32 sensor data on-chain using **Ed25519 signatures over SHA-256 hashes**. Each sensor has a unique NFT that identifies its oracle UTXO.

**Signature Flow:**
1. Construct message with fields in alphabetical order: `humidity || sensor_id || temperature || timestamp`
2. Calculate SHA-256 hash of the message
3. Sign the HASH with Ed25519 (not the message directly)
4. On-chain validator reconstructs message, calculates hash, and verifies signature

See `docs/SIGNATURE_FLOW.md` for complete details.

### Oracle Workflow

1. **Mint NFT**: Create unique NFT for sensor → `npm run oracle:mint-nft`
2. **Create Oracle**: Initialize oracle with NFT and initial data → `npm run oracle:create`
3. **Update Oracle**: Submit new sensor readings → `npm run oracle:update`

### On-Chain Validation

The `sensor_oracle_ed25519` validator checks:

- Transaction signed by authorized operator
- NFT present in both input and output
- Sensor data within valid ranges:
  - Temperature: -50°C to 100°C
  - Humidity: 0% to 100%
  - Timestamp > 0
- Signature and public key lengths (64 bytes signature, 32 bytes public key)
- **Ed25519 signature verification**:
  - Message: `humidity || sensor_id || temperature || timestamp` (alphabetical order)
  - Hash: `SHA-256(message)` (CRITICAL: signs the hash, not the message)
  - Verification: `verify_ed25519_signature(public_key, message_hash, signature)`

### Datum Structure

```typescript
interface SensorData {
  sensor_id: string;      // "ESP32_001"
  temperature: number;    // 235 = 23.5°C (value * 10)
  humidity: number;       // 652 = 65.2% (value * 10)
  timestamp: number;      // Unix timestamp (milliseconds)
  signature: string;      // Ed25519 signature (64 bytes hex = 128 chars)
  public_key: string;     // Ed25519 public key (32 bytes hex = 64 chars)
}
```

**IMPORTANT:** The system signs the SHA-256 hash of the message, not the message directly.
This avoids issues with null bytes in messages and follows the standard for signing long messages.

### Documentation

- `docs/oracle-usage.md` - Complete oracle usage guide
- `docs/SIGNATURE_FLOW.md` - Ed25519 signature flow explanation
- `docs/ed25519-migration-guide.md` - Migration guide from ECDSA to Ed25519
- `docs/TROUBLESHOOTING_FAILED_TX.md` - Fix failed transactions in frontend
- `docs/MESHJS_PLUTUS_V3_ISSUE.md` - **CRITICAL:** MeshJS beta bug preventing oracle updates (detailed analysis)
- `docs/PLUTUS_DATA_TYPES_ALTERNATIVES.md` - Analysis of alternative Plutus data types for optimization
