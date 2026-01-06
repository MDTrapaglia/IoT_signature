# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ESP32 IoT Data Certification System for Cardano blockchain. Captures sensor measurements from Arduino/ESP32 devices, cryptographically signs them with Ed25519, and uploads to Cardano. Three-layer architecture: hardware edge (Arduino), Node.js backend, Next.js frontend dashboard.

**Current Phase:** Phase 2 - API signature verification (in-memory storage, no database yet)

## Commands

```bash
# Development
npm install                 # Install dependencies
npm run dev                 # Start dev server with tsx watch (port 3001)
npm run demo                # Run transaction demo
npm run nft                 # Run NFT minting

# Oracle Scripts (Cardano transactions)
npm run oracle:mint-nft -- <sensor_id>           # Mint NFT for sensor
npm run oracle:create -- <policy_id> <asset_name> # Create oracle with NFT
npm run oracle:update -- <policy_id> <asset_name> [num_updates] # Update oracle

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
│   └── sign_device.ino        # ECDSA signing sketch
├── scripts/            # Management scripts
├── docs/               # Documentation
└── test-data/          # Test payloads and signatures
```

### Key Files

- `offchain/backend/api_server.ts` - Main Express server (port 3001)
- `offchain/backend/srial_index.ts` - Alternative serial port listener for Arduino (not active)
- `hardware/sign_device.ino` - ESP32 Arduino sketch with ECDSA signing
- `offchain/frontend/` - Next.js dashboard application
- `offchain/transactions/` - Cardano transaction code (MeshJS)
  - `mint_sensor_nft.ts` - Mint unique NFT for sensor oracle
  - `create_oracle.ts` - Initialize oracle with NFT and initial data
  - `update_oracle.ts` - Update oracle with new sensor readings
  - `types.ts` - TypeScript types for SensorData and OracleParams
- `onchain/sensors-oracle/validators/sensor_oracle_verified.ak` - Smart contract with ECDSA verification
- `onchain/sensors-oracle/validators/nft.ak` - NFT minting policy
- `onchain/sensors-oracle/plutus.json` - Compiled Plutus scripts
- `docs/oracle-usage.md` - Complete guide for using oracle scripts

### Data Model

```typescript
interface ArduinoPayload {
  sensor_id: string;
  hash: string;        // SHA-256 hash of the message
  signature: string;   // ECDSA signature (hex)
  publicKey: string;   // secp256k1 public key (hex)
}

interface StoredMeasurement extends ArduinoPayload {
  verified: boolean;   // Signature verification result
  timestamp: number;   // Unix timestamp
}
```

## Technologies

### Implemented
- **Express 5** - API server
- **elliptic** - ECDSA secp256k1 signature verification
- **Next.js 15** - Frontend dashboard
- **MeshJS** - Cardano transaction building (in development)
- **Aiken** - Smart contract language for Cardano

### Planned (Not Yet Integrated)
- **PostgreSQL + Prisma** - Persistent storage (currently in-memory)
- **Blockfrost** - Cardano API queries (partially implemented in oracle scripts)

## Oracle System

### Overview

The sensor oracle system validates ESP32 sensor data on-chain using ECDSA secp256k1 signatures. Each sensor has a unique NFT that identifies its oracle UTXO.

### Oracle Workflow

1. **Mint NFT**: Create unique NFT for sensor → `npm run oracle:mint-nft`
2. **Create Oracle**: Initialize oracle with NFT and initial data → `npm run oracle:create`
3. **Update Oracle**: Submit new sensor readings → `npm run oracle:update`

### On-Chain Validation

The `sensor_oracle_verified` validator checks:

- Transaction signed by authorized operator
- NFT present in both input and output
- Sensor data within valid ranges:
  - Temperature: -50°C to 100°C
  - Humidity: 0% to 100%
  - Timestamp > 0
- Signature and public key lengths (64 bytes each)
- **ECDSA secp256k1 signature verification**:
  - Message: `humidity || sensor_id || temperature || timestamp` (alphabetical order)
  - Hash: `SHA-256(message)`
  - Verification: `verify_ecdsa_secp256k1_signature(public_key, hash, signature)`

### Datum Structure

```typescript
interface SensorData {
  sensor_id: string;      // "ESP32_001"
  temperature: number;    // 235 = 23.5°C (value * 10)
  humidity: number;       // 652 = 65.2% (value * 10)
  timestamp: number;      // Unix timestamp (milliseconds)
  signature: string;      // ECDSA signature (64 bytes hex)
  public_key: string;     // secp256k1 public key (64 bytes hex)
}
```

### Documentation

See `docs/oracle-usage.md` for complete usage guide with examples.
