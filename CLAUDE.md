# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ESP32 IoT Data Certification System for Cardano blockchain. Captures sensor measurements from Arduino/ESP32 devices, cryptographically signs them with Ed25519, and uploads to Cardano. Three-layer architecture: hardware edge (Arduino), Node.js backend, Next.js frontend dashboard.

**Current Phase:** Phase 2 - API signature verification (in-memory storage, no database yet)

## Commands

```bash
# Development
npm install          # Install dependencies
npm run dev          # Start dev server with tsx watch (port 3001)

# Shell scripts
./start.sh           # Start server (kills previous, saves PID to .dev.pid)
./stop.sh            # Stop server by PID
./test.sh            # Test API with curl (POST /api/ingest, GET /api/measurements)
```

## Architecture

```
Arduino/ESP32 → POST /api/ingest → Express Backend → (future: PostgreSQL, Cardano)
                                         ↓
Frontend ← GET /api/measurements ←───────┘
```

### API Endpoints

- `POST /api/ingest` - Receive signed sensor data: `{ sensor_id, value, signature, publicKey }`
- `GET /api/measurements` - Return all stored measurements

### Key Files

- `src/api_server.ts` - Main Express server (port 3001)
- `src/srial_index.ts` - Alternative serial port listener for Arduino (not active)

### Data Model

```typescript
interface ArduinoPayload {
  sensor_id: string;
  value: number;
  signature: string;
  publicKey: string;
}
```

## Planned Technologies (Not Yet Implemented)

- **TweetNaCl.js** - Ed25519 signature verification
- **PostgreSQL + Prisma** - Persistent storage
- **MeshJS or Lucid** - Cardano transaction building
- **Blockfrost** - Cardano API queries
- **Next.js** - Frontend dashboard
