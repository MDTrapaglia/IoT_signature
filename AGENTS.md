# AGENTS.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Reglas de Código (Code Standards)

### Idioma del Código
**IMPORTANTE:** Todo el código fuente DEBE estar en inglés:
- ✅ Nombres de variables: `temperature`, `humidity`, `sensorId`
- ✅ Nombres de funciones: `updateOracle()`, `validateSignature()`
- ✅ Comentarios en código: `// Validate Ed25519 signature`
- ✅ Nombres de archivos: `oracle_lucid_lib.ts`, `sensor_oracle_ed25519.ak`
- ✅ Mensajes de log: `console.log("Oracle update submitted")`
- ✅ Constantes: `MAX_TEMPERATURE`, `MIN_HUMIDITY`
- ✅ Tipos TypeScript: `interface SensorData`, `type OracleParams`

**Excepciones permitidas:**
- ❌ Documentación en español (archivos .md en español están permitidos)
- ❌ Mensajes de commit en español (configuración del usuario)
- ❌ Comunicación con el usuario (respuestas de Claude)

**Razón:** Mantener el código en inglés facilita la colaboración internacional, compatibilidad con librerías, y es el estándar de la industria.

## Project Overview

ESP32 IoT Data Certification System for Cardano blockchain. Captures sensor measurements from Arduino/ESP32 devices, cryptographically signs them with **Ed25519**, and uploads to Cardano. Three-layer architecture: hardware edge (Arduino), Node.js backend, Next.js frontend dashboard.

**Current Phase:** ✅ Phase 3 Complete - Full end-to-end integration with Cardano Preprod validated (PostgreSQL + Prisma integrated, auto-submission working, 3 confirmed transactions)

**Latest Release:** [v1.0.0](https://github.com/MDTrapaglia/IoT_signature/releases/tag/v1.0.0)

## ⚠️ Known Issues & Solutions

### MeshJS Beta - Plutus V3 Bug (RESUELTO - Migración Completa a Lucid Evolution)

**Status:** ✅ RESUELTO - Migración completa a Lucid Evolution
**Original Error:** `Cannot convert undefined to a BigInt` during transaction building with MeshJS
**Impact:** Oracle updates fallaban completamente

**Solution:** Migración completa a Lucid Evolution v0.4.29
- ✅ **Lucid Evolution:** ALL oracle operations (mint, create, update, delete)
- ⚠️ **MeshJS (deprecated):** Scripts con sufijo `:meshjs` mantenidos para compatibilidad

**Full documentation:**
- Migration plan: `docs/MIGRATION_PLAN_LUCID_EVOLUTION.md`
- Migration log: `temp/MIGRACION_LUCID_EVOLUTION_LOG.md`
- Original bug analysis: `docs/MESHJS_PLUTUS_V3_ISSUE.md`
- Minting issue analysis: `docs/LUCID_EVOLUTION_MINTING_ISSUE.md`
- Solution documentation: `docs/LUCID_EVOLUTION_SOLUTION.md`

**What works:**
- ✅ Backend receiving and validating measurements (PostgreSQL + Prisma)
- ✅ Database storing signed data with relationships
- ✅ Frontend dashboard showing metrics and transactions
- ✅ **Oracle mint NFT (Lucid Evolution)** ⭐
- ✅ **Oracle creation (Lucid Evolution)** ⭐
- ✅ **Oracle updates (Lucid Evolution)** ⭐
- ✅ **Oracle deletion (Lucid Evolution)** ⭐
- ✅ **Auto-submission service** ⭐ (submits measurements to Cardano automatically)
- ✅ **Transaction monitor service** ⭐ (detects confirmations on blockchain)
- ✅ **End-to-end testing validated** ⭐ (3 confirmed TXs on Cardano Preprod)

**Known Limitations:**
- ⚠️ MeshJS scripts deprecated but available with `:meshjs` suffix for reference
- ⚠️ Do NOT mix MeshJS and Lucid Evolution scripts (they calculate different addresses)
- ⚠️ Collateral UTXO contamination causing 73% TX failures (see E2E_SUCCESS_REPORT.md)

## Commands

```bash
# Development
npm install                 # Install dependencies
npm run dev                 # Start dev server with tsx watch (port 3001)
npm run demo                # Run transaction demo
npm run nft                 # Run NFT minting

# Oracle Scripts (Cardano transactions with Ed25519 - Lucid Evolution)
npm run oracle:mint-nft -- <sensor_id>                              # Mint NFT for sensor
npm run oracle:create -- <policy_id> <asset_name>                   # Create oracle with NFT
npm run oracle:update -- <policy_id> <asset_name> [num_updates]    # Update oracle with sensor data
npm run oracle:delete -- <policy_id> <asset_name>                   # Delete oracle and recover funds

# Oracle Scripts (MeshJS - DEPRECATED, use for reference only)
npm run oracle:mint-nft:meshjs -- <sensor_id>                       # DEPRECATED: Use oracle:mint-nft
npm run oracle:create:meshjs -- <policy_id> <asset_name>            # DEPRECATED: Use oracle:create
npm run oracle:update:meshjs -- <policy_id> <asset_name>            # BROKEN: Plutus V3 bug
npm run oracle:delete:meshjs -- <policy_id> <asset_name>            # DEPRECATED: Use oracle:delete

# Ed25519 Testing
npm run test:ed25519:create    # Create UTXO with Ed25519 signature
npm run test:ed25519:consume   # Consume UTXO (validates on-chain)

# Database Management
npm run db:status              # Check database status (measurements, sensors, transactions)
npm run db:clean-failed        # Clean failed transactions from database
npm run db:register-sensor -- <sensor_id> <public_key> [nft_policy_id] [nft_asset_name] [script_address]
npm run db:verify-oracle-address  # Verify DB oracle address matches Lucid-calculated address

# End-to-End Testing
npm run test:e2e               # Run E2E test (single run)
npm run test:e2e:watch         # Run E2E test with transaction monitoring

# Shell scripts
./scripts/backend_start.sh  # Start server (kills previous, saves PID to /tmp/backend_e2e.pid)
./scripts/backend_stop.sh   # Stop server by PID
./scripts/test.sh           # Test API with curl (POST /api/ingest, GET /api/measurements)
./scripts/test_signatures.sh # Test ECDSA signature verification
```

## Architecture

```
Arduino/ESP32 → POST /api/ingest → Express Backend → PostgreSQL
                                         ↓                ↓
                                   Ed25519 Verify   Save to DB
                                         ↓                ↓
                              Auto-Submission Service → Lucid Evolution
                                         ↓
                              Cardano Preprod (Plutus V3)
                                         ↓
                              Transaction Monitor → Update DB
                                         ↓
                              Frontend ← GET /api/transactions
```

### API Endpoints

- `POST /api/ingest` - Receive signed sensor data: `{ sensor_id, temperature, humidity, timestamp, signature, public_key }`
- `GET /api/measurements` - Return all stored measurements
- `GET /api/transactions` - Return Cardano transaction history (with status filter)
- `GET /api/sensors` - List registered sensors with oracle configuration

### Project Structure

```
/
├── offchain/
│   ├── backend/        # Express API server
│   │   ├── api_server.ts      # Main server (port 3001)
│   │   ├── prisma/            # Database schema (PostgreSQL)
│   │   │   └── schema.prisma  # Measurement, Sensor, OracleTransaction models
│   │   └── services/
│   │       ├── oracle-submission.service.ts    # Auto-submit measurements to Cardano
│   │       └── transaction-monitor.service.ts  # Monitor transaction confirmations
│   ├── frontend/       # Next.js dashboard (port 3000)
│   └── transactions/   # Cardano transaction code
│       ├── oracle_lucid_lib.ts            # ⭐ MAIN: Reusable Lucid functions
│       ├── mint_sensor_nft_lucid.ts       # ⭐ Mint NFT for sensor oracle
│       ├── create_oracle_lucid.ts         # ⭐ Initialize oracle with NFT
│       ├── update_oracle_lucid.ts         # ⭐ Update oracle with sensor data
│       ├── delete_oracle_lucid.ts         # ⭐ Delete oracle and recover ADA
│       ├── types_lucid.ts                 # Schemas and types for Lucid Evolution
│       ├── mint_nft.ts                    # NFT minting (demo)
│       ├── mint_sensor_nft.ts             # ⚠️ DEPRECATED (MeshJS)
│       ├── create_oracle.ts               # ⚠️ DEPRECATED (MeshJS)
│       ├── update_oracle.ts               # ⚠️ BROKEN (MeshJS Plutus V3 bug)
│       ├── delete_oracle.ts               # ⚠️ DEPRECATED (MeshJS)
│       ├── transaction.ts                 # Transaction demo
│       ├── types.ts                       # TypeScript types for SensorData
│       └── self_send.tsm                  # Self-send transaction
├── onchain/
│   └── sensors-oracle/ # Aiken smart contracts
│       ├── validators/
│       │   ├── sensor_oracle_ed25519.ak   # ⭐ MAIN: Plutus V3 with Ed25519 verification
│       │   ├── simple_ed25519_validator.ak # Test validator
│       │   ├── nft.ak                      # NFT minting policy
│       │   └── sensor_oracle_verified.ak   # LEGACY: ECDSA/Ethereum
│       └── plutus.json                     # Compiled Plutus scripts
├── hardware/           # Arduino/ESP32 code
│   ├── sign_device_ed25519.ino    # ⭐ MAIN: Ed25519 signing sketch
│   ├── README_ED25519.md          # Ed25519 setup guide
│   └── sign_device.ino            # LEGACY: ECDSA signing (Ethereum)
├── scripts/            # Management scripts
│   ├── test_e2e.py                 # ⭐ Automated E2E testing with monitoring
│   ├── verify_oracle_address.ts    # Verify oracle address consistency
│   ├── check_nft_location.ts       # Locate NFTs across addresses
│   ├── backend_start.sh            # Start backend with PID tracking
│   ├── backend_stop.sh             # Stop backend by PID
│   ├── test.sh                     # API testing with curl
│   └── test_signatures.sh          # Ed25519 signature verification tests
├── docs/               # Documentation
│   ├── MIGRATION_PLAN_LUCID_EVOLUTION.md
│   ├── MESHJS_PLUTUS_V3_ISSUE.md
│   ├── LUCID_EVOLUTION_MINTING_ISSUE.md
│   ├── LUCID_EVOLUTION_SOLUTION.md
│   ├── SIGNATURE_FLOW.md
│   ├── oracle-usage.md
│   └── ed25519-migration-guide.md
└── test-data/          # Test payloads and signatures
└── temp/               # Testing and migration reports
    ├── E2E_SUCCESS_REPORT.md        # ⭐ Complete E2E test results
    ├── E2E_INTEGRATION_STATUS.md    # Integration analysis
    ├── E2E_TESTING_GUIDE.md         # Testing guide
    ├── E2E_TEST_PREPARATION.md      # Preparation steps
    ├── E2E_TEST_RESULTS.md          # Preparation results
    └── MIGRACION_LUCID_EVOLUTION_LOG.md
```

### Key Files

- `offchain/backend/api_server.ts` - Main Express server (port 3001)
- `offchain/backend/services/oracle-submission.service.ts` - Auto-submission to Cardano
- `offchain/backend/services/transaction-monitor.service.ts` - Transaction confirmation monitoring
- `offchain/backend/prisma/schema.prisma` - Database schema (PostgreSQL)
- `offchain/transactions/oracle_lucid_lib.ts` - ⭐ **MAIN MODULE:** Reusable Lucid functions
- `hardware/sign_device_ed25519.ino` - ESP32 Arduino sketch with **Ed25519** signing (MAIN)
- `hardware/README_ED25519.md` - Ed25519 setup and installation guide
- `offchain/frontend/` - Next.js dashboard application
- `offchain/transactions/` - Cardano transaction code
  - **Lucid Evolution scripts (ACTIVE):**
    - `oracle_lucid_lib.ts` - ⭐ **MAIN:** Reusable library module with exportable functions
    - `mint_sensor_nft_lucid.ts` - ⭐ Mint unique NFT for sensor oracle
    - `create_oracle_lucid.ts` - ⭐ Initialize oracle with NFT and Ed25519 signed data
    - `update_oracle_lucid.ts` - ⭐ Update oracle with new sensor data
    - `delete_oracle_lucid.ts` - ⭐ Delete oracle and recover ADA
    - `types_lucid.ts` - Schemas and types for Lucid Evolution
  - **MeshJS scripts (DEPRECATED):**
    - `mint_sensor_nft.ts` - ⚠️ DEPRECATED - Use `mint_sensor_nft_lucid.ts`
    - `create_oracle.ts` - ⚠️ DEPRECATED - Use `create_oracle_lucid.ts`
    - `update_oracle.ts` - ⚠️ BROKEN (Plutus V3 bug) - Use `update_oracle_lucid.ts`
    - `delete_oracle.ts` - ⚠️ DEPRECATED - Use `delete_oracle_lucid.ts`
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
- `scripts/test_e2e.py` - ⭐ Automated end-to-end testing script (Python)
- `scripts/README_TEST_E2E.md` - E2E testing guide

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

// Database model (Prisma)
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
- **PostgreSQL + Prisma ORM** - Persistent storage (fully integrated)
- **Ed25519 (tweetnacl)** - Ed25519 signature generation and verification (MAIN)
- **elliptic** - ECDSA secp256k1 signature verification (legacy/Ethereum)
- **Next.js 15** - Frontend dashboard
- **Lucid Evolution 0.4.29** - Cardano transaction building (MAIN)
- **Blockfrost API** - Cardano blockchain queries
- **MeshJS 1.9.0-beta.90** - Deprecated (Plutus V3 bug, kept for reference)
- **Aiken** - Smart contract language for Cardano

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

1. **Mint NFT**: Create unique NFT for sensor → `npm run oracle:mint-nft -- <sensor_id>`
2. **Create Oracle**: Initialize oracle with NFT and initial data → `npm run oracle:create -- <policy_id> <asset_name>`
3. **Update Oracle**: Submit new sensor readings → `npm run oracle:update -- <policy_id> <asset_name>`
4. **Auto-Update**: Backend service automatically submits measurements (5-second interval)

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

### Auto-Submission Service

El backend incluye un servicio que automáticamente envía mediciones a Cardano:

- **Archivo:** `offchain/backend/services/oracle-submission.service.ts`
- **Intervalo:** 5000ms (configurable con `ORACLE_SUBMIT_DELAY_MS`)
- **Activación:** `ORACLE_AUTO_SUBMIT=true` en environment variables
- **Funcionamiento:**
  1. Busca mediciones verificadas sin transacción asociada
  2. Llama a `updateOracle()` de `oracle_lucid_lib.ts`
  3. Crea registro de transacción con estado PENDING
  4. Vincula medición con transacción

### Transaction Monitor Service

Servicio que monitorea confirmaciones de transacciones en blockchain:

- **Archivo:** `offchain/backend/services/transaction-monitor.service.ts`
- **Intervalo:** 15000ms (15 segundos)
- **Funcionamiento:**
  1. Busca transacciones PENDING
  2. Consulta Blockfrost API por cada TX hash
  3. Actualiza estado a CONFIRMED si está en blockchain
  4. Registra slot y block height

### End-to-End Testing

**Status:** ✅ Sistema validado end-to-end con 3 transacciones confirmadas en Cardano Preprod

**Transacciones confirmadas:**
1. Oracle Creation: `1fbc44bb0723ea76d91e3a115565c4c43bd46ff74fce4810e7f15708faf5c303`
2. Oracle Update #1: `7688deb3dce4ef9425c9b6586a6fd6267bf159b55a559119a3767e9459018996`
3. Oracle Update #2: `5a33f39415ff303f85ce1a863b4afb44e16c268a20f45c062d5a8893f0d018ed`

**Verificar en Cardano Explorer:**
- https://preprod.cardanoscan.io/transaction/7688deb3dce4ef9425c9b6586a6fd6267bf159b55a559119a3767e9459018996

**Script de testing automatizado:**
```bash
npm run test:e2e:watch
# O directamente:
python3 scripts/test_e2e.py --watch --token <access_token>
```

**Flujo validado:**
- ESP32 (simulado) → API REST → Validación Ed25519 → PostgreSQL
- Auto-Submission Service → Lucid Evolution → Cardano Preprod
- Smart Contract Plutus V3 → Confirmación → Transaction Monitor
- Frontend ← GET /api/transactions

**Documentación completa:**
- `temp/E2E_SUCCESS_REPORT.md` - Reporte completo con resultados
- `temp/E2E_TESTING_GUIDE.md` - Guía detallada de testing
- `scripts/README_TEST_E2E.md` - Guía del script Python

### Documentation

- `docs/oracle-usage.md` - Complete oracle usage guide
- `docs/SIGNATURE_FLOW.md` - Ed25519 signature flow explanation
- `docs/ed25519-migration-guide.md` - Migration guide from ECDSA to Ed25519
- `docs/TROUBLESHOOTING_FAILED_TX.md` - Fix failed transactions in frontend
- `docs/MESHJS_PLUTUS_V3_ISSUE.md` - **CRITICAL:** MeshJS beta bug preventing oracle updates (detailed analysis)
- `docs/PLUTUS_DATA_TYPES_ALTERNATIVES.md` - Analysis of alternative Plutus data types for optimization
- `docs/MIGRATION_PLAN_LUCID_EVOLUTION.md` - Complete migration plan from MeshJS to Lucid Evolution
- `docs/LUCID_EVOLUTION_MINTING_ISSUE.md` - Analysis of NFT minting issues with Lucid Evolution
- `docs/LUCID_EVOLUTION_SOLUTION.md` - Solution documentation for Lucid Evolution integration
- `temp/MIGRACION_LUCID_EVOLUTION_LOG.md` - Complete migration log with all steps
- `temp/E2E_SUCCESS_REPORT.md` - ⭐ Complete E2E test results with confirmed transactions
- `temp/E2E_INTEGRATION_STATUS.md` - Analysis of E2E integration status
- `temp/E2E_TESTING_GUIDE.md` - Complete testing guide
- `temp/E2E_TEST_PREPARATION.md` - Preparation steps for E2E testing
- `temp/E2E_TEST_RESULTS.md` - Results of E2E test preparation
- `scripts/README_TEST_E2E.md` - Automated E2E testing script documentation
