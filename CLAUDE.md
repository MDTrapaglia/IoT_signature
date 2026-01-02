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
│       ├── mint_nft.ts        # NFT minting
│       ├── transaction.ts     # Transaction demo
│       └── self_send.tsm      # Self-send transaction
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
- **Blockfrost** - Cardano API queries
- **Cardano integration** - Transaction submission to blockchain
