# Plan de Implementación: Base de Datos PostgreSQL + Prisma

**Proyecto:** ESP32 IoT Data Certification System for Cardano
**Fecha:** 2026-01-07
**Fase:** Phase 2 → Phase 3 (Database Integration)

---

## 📋 Objetivos

### Objetivo Principal
Implementar una base de datos PostgreSQL con Prisma ORM para persistir todos los datos del sistema de certificación de sensores IoT en Cardano blockchain.

### Objetivos Específicos

1. **Persistencia de Datos**
   - Guardar TODAS las mediciones del ESP32 (verificadas y no verificadas)
   - Almacenar configuración de sensores (ID, public key, NFT info)
   - Registrar historial completo de transacciones Cardano

2. **Tracking de Estado Offchain**
   - Estado de verificación de firma Ed25519/ECDSA
   - Timestamp de recepción en servidor
   - Errores de verificación si ocurren

3. **Tracking de Estado Onchain**
   - Hash de transacción Cardano (txHash)
   - Estado de confirmación (PENDING, CONFIRMED, FAILED)
   - Información de UTXO (policy_id, asset_name, script_address)
   - Block height y timestamp de confirmación
   - Datos del datum on-chain

4. **Automatización**
   - Auto-envío de mediciones verificadas al oracle de Cardano
   - Monitoreo automático de estado de transacciones vía Blockfrost
   - Sistema de reintentos para transacciones fallidas

5. **Escalabilidad**
   - Reemplazar almacenamiento en memoria (limitado a 1000 items)
   - Persistencia entre reinicios del servidor
   - Base para analytics y dashboards futuros

---

## 🏗️ Arquitectura de Base de Datos

### Esquema Prisma

#### Tabla: **Sensor**
Configuración de cada sensor ESP32 registrado en el sistema.

```prisma
model Sensor {
  id                String   @id @default(cuid())
  sensor_id         String   @unique              // "ESP32_001"
  public_key        String                        // Ed25519 public key (64 chars hex)
  name              String?                       // Nombre descriptivo
  description       String?

  // NFT Identification
  nft_policy_id     String?                       // Policy ID del NFT del sensor
  nft_asset_name    String?                       // Asset name (hex)

  // Oracle Script Address
  script_address    String?                       // Dirección Cardano del oracle UTXO

  // Status
  is_active         Boolean  @default(true)
  created_at        DateTime @default(now())
  updated_at        DateTime @updatedAt

  // Relations
  measurements      Measurement[]
  oracle_transactions OracleTransaction[]

  @@index([sensor_id])
  @@index([nft_policy_id, nft_asset_name])
}
```

**Propósito:**
- Registro centralizado de sensores autorizados
- Almacena credenciales criptográficas (public key)
- Vincula cada sensor con su NFT identificador
- Permite gestión de múltiples sensores

#### Tabla: **Measurement**
Todas las mediciones recibidas del ESP32, verificadas o no.

```prisma
model Measurement {
  id                  String   @id @default(cuid())

  // Sensor relationship
  sensor_id           String
  sensor              Sensor   @relation(fields: [sensor_id], references: [sensor_id])

  // Sensor data (from ESP32)
  temperature         Int?                          // Celsius * 10 (235 = 23.5°C)
  humidity            Int?                          // Percent * 10 (652 = 65.2%)
  timestamp           BigInt?                       // Unix timestamp ESP32 (ms)

  // Cryptographic data
  hash                String                        // SHA-256 (64 chars hex)
  signature           String                        // Ed25519 signature (128 chars hex)
  public_key          String                        // Ed25519 public key (64 chars hex)
  message             String?                       // Binary message reconstructed (hex)

  // Verification status (offchain)
  verified            Boolean                       // Firma válida?
  verification_error  String?                       // Error si falla

  // Server timestamp
  received_at         DateTime @default(now())

  // Link to blockchain
  oracle_transaction_id String?
  oracle_transaction    OracleTransaction? @relation(fields: [oracle_transaction_id], references: [id])

  @@index([sensor_id])
  @@index([received_at])
  @@index([verified])
  @@index([oracle_transaction_id])
}
```

**Propósito:**
- Registro completo de TODAS las mediciones (incluso fallidas)
- Auditabilidad: qué se recibió, cuándo, y si fue válido
- Link a transacción blockchain cuando se certifica
- Base para analytics (temperatura/humedad trends)

#### Tabla: **OracleTransaction**
Historial de todas las transacciones enviadas a Cardano blockchain.

```prisma
enum OracleTransactionStatus {
  PENDING       // Enviada al mempool, esperando confirmación
  CONFIRMED     // Incluida en un bloque
  FAILED        // Transacción falló
  RETRYING      // Falló, se reintentará
}

enum OracleTransactionType {
  MINT_NFT      // Minteo de NFT del sensor
  CREATE        // Creación inicial del oracle
  UPDATE        // Actualización con nuevos datos
  DELETE        // Eliminación del oracle
}

model OracleTransaction {
  id              String   @id @default(cuid())

  // Sensor relationship
  sensor_id       String
  sensor          Sensor   @relation(fields: [sensor_id], references: [sensor_id])

  // Transaction type
  type            OracleTransactionType

  // Associated measurements
  measurements    Measurement[]

  // Cardano transaction
  tx_hash         String?  @unique               // Cardano tx hash
  tx_cbor         String?                        // CBOR firmado (resubmit)

  // Status tracking
  status          OracleTransactionStatus @default(PENDING)
  status_message  String?                        // Mensaje de error/estado

  // Timestamps
  submitted_at    DateTime @default(now())
  confirmed_at    DateTime?
  last_checked_at DateTime?

  // Blockchain data (after confirmation)
  block_height    Int?
  block_time      DateTime?
  slot            Int?

  // NFT info
  nft_policy_id   String
  nft_asset_name  String

  // Script address
  script_address  String?

  // UTXO info (for next update)
  utxo_tx_hash    String?
  utxo_index      Int?

  // Datum (on-chain data)
  datum_json      Json?

  // Retry logic
  retry_count     Int      @default(0)
  max_retries     Int      @default(3)
  next_retry_at   DateTime?

  @@index([sensor_id])
  @@index([status])
  @@index([submitted_at])
  @@index([tx_hash])
  @@index([nft_policy_id, nft_asset_name])
}
```

**Propósito:**
- Tracking completo del ciclo de vida de transacciones
- Estado en tiempo real (PENDING → CONFIRMED)
- Información de UTXO para siguiente actualización
- Sistema de reintentos automáticos
- Auditabilidad completa de certificaciones on-chain

### Índices para Performance

**Measurement:**
- `sensor_id`: Queries frecuentes por sensor
- `received_at`: Queries temporales (últimas N mediciones)
- `verified`: Filtrar mediciones verificadas/no verificadas
- `oracle_transaction_id`: Join con transacciones

**OracleTransaction:**
- `sensor_id`: Transacciones por sensor
- `status`: Buscar transacciones pendientes/confirmadas
- `tx_hash`: Lookup directo por hash
- `submitted_at`: Queries temporales
- `nft_policy_id + nft_asset_name`: Identificar oracle por NFT

---

## 🔧 Arquitectura de Servicios

### Estructura de Directorios

```
offchain/backend/
├── api_server.ts                      [MODIFICAR]
├── config/
│   └── prisma.ts                      [NUEVO]
├── services/
│   ├── measurement.service.ts         [NUEVO]
│   ├── sensor.service.ts              [NUEVO]
│   ├── oracle-submission.service.ts   [NUEVO]
│   └── tx-monitor.service.ts          [NUEVO]
├── utils/
│   ├── message-builder.ts             [NUEVO]
│   └── signature-verification.ts      [NUEVO]
└── types/
    └── index.ts                       [NUEVO]
```

### Capa de Configuración

**`config/prisma.ts`** - Singleton de Prisma Client

```typescript
import { PrismaClient } from '@prisma/client';

// Singleton pattern (evita múltiples instancias en dev)
declare global {
  var prisma: PrismaClient | undefined;
}

export const prisma = global.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'error', 'warn']
    : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});
```

### Capa de Utilities

**`utils/message-builder.ts`** - Construcción y validación de mensajes

```typescript
export interface MessageData {
  sensor_id: string;
  temperature?: number;
  humidity?: number;
  timestamp?: number;
}

export function buildMessage(data: MessageData): Buffer
export function calculateHash(message: Buffer): string
export function verifyHash(message: Buffer, providedHash: string): boolean
```

**`utils/signature-verification.ts`** - Verificación criptográfica

```typescript
export function verifyECDSASignature(
  hash: string,
  signature: string,
  publicKey: string
): boolean

export function verifyEd25519Signature(
  message: Buffer,
  signature: string,
  publicKey: string
): boolean
```

### Capa de Servicios

**`services/sensor.service.ts`** - Gestión de sensores

```typescript
class SensorService {
  async getOrCreate(sensor_id: string, public_key: string): Promise<Sensor>
  async updateNFTInfo(sensor_id: string, policy_id: string, asset_name: string): Promise<Sensor>
  async updateOracleAddress(sensor_id: string, script_address: string): Promise<Sensor>
  async get(sensor_id: string): Promise<Sensor | null>
  async listActive(): Promise<Sensor[]>
}
```

**`services/measurement.service.ts`** - CRUD de mediciones

```typescript
class MeasurementService {
  async create(payload: ArduinoPayload): Promise<Measurement>
  async getRecent(sensor_id: string, limit: number): Promise<Measurement[]>
  async getAll(page: number, limit: number): Promise<Measurement[]>
  async getUnsubmitted(): Promise<Measurement[]>  // Verificadas sin tx
  async linkToTransaction(measurement_id: string, tx_id: string): Promise<Measurement>
}
```

**`services/oracle-submission.service.ts`** - Auto-envío a Cardano

```typescript
class OracleSubmissionService {
  start()  // Inicia proceso background (cada 5s)
  stop()   // Detiene proceso

  private async processUnsubmittedMeasurements()
  private async submitMeasurement(measurement: Measurement)
  async submitManually(measurement_id: string)
}
```

**Flujo de auto-submission:**
1. Cada 5 segundos busca mediciones verificadas sin `oracle_transaction_id`
2. Agrupa por `sensor_id` (evita conflictos)
3. Toma la más reciente por sensor
4. Crea registro `OracleTransaction` con status PENDING
5. Llama `updateOracle()` de `update_oracle.ts`
6. Guarda `txHash` en base de datos
7. Link measurement → transaction

**`services/tx-monitor.service.ts`** - Monitoreo de transacciones

```typescript
class TransactionMonitorService {
  start()  // Inicia polling (cada 15s)
  stop()   // Detiene polling

  private async checkPendingTransactions()
  private async checkTransaction(tx_id: string, tx_hash: string)
  async checkManually(transaction_id: string)
}
```

**Flujo de monitoring:**
1. Cada 15 segundos busca `OracleTransaction` con status PENDING
2. Para cada una, query Blockfrost API: `fetchTxInfo(tx_hash)`
3. Si confirmada: actualiza status → CONFIRMED, guarda block_height/timestamp
4. Si falla: incrementa retry_count, programa reintento
5. Si max_retries excedido: marca como FAILED

---

## 📦 Implementación Paso a Paso

### Fase 1: Setup de Base de Datos (No Breaking)

#### 1.1 Instalar Dependencias

```bash
npm install @prisma/client
npm install -D prisma
```

**Actualizar `package.json`:**
```json
{
  "dependencies": {
    "@prisma/client": "^6.1.0",
    // ... existing dependencies
  },
  "devDependencies": {
    "prisma": "^6.1.0",
    // ... existing dev dependencies
  }
}
```

#### 1.2 Crear Docker Compose

**Archivo:** `docker-compose.yml` (raíz del proyecto)

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: esp32_oracle_db
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-esp32_oracle}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-changeme_secure_password}
      POSTGRES_DB: ${POSTGRES_DB:-esp32_oracle}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-esp32_oracle}"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
    driver: local
```

**Iniciar PostgreSQL:**
```bash
docker-compose up -d
```

**Verificar:**
```bash
docker ps                          # Debe mostrar esp32_oracle_db running
docker logs esp32_oracle_db        # Verificar "database system is ready"
```

#### 1.3 Configurar Prisma

**Archivo:** `prisma/schema.prisma` (copiar esquema completo de sección anterior)

**Actualizar `.env`:**
```bash
# Existing
CONTEXT7_API_KEY=ctx7sk-57f46e4e-577a-40c3-9076-f517c8828db8
BLOCKFROST_API_KEY=preprodV62MaMWedORuDYcxNDL4qmabmWl4gqzH
PRIVATE_KEY=xprv14rpyq33k2qvj4fmkwdm79f8g2m58de7wju2vfyk4w9sffgzesat5p8u2m5hjz56prphaflx7sp96djtqq9ajj4glrgeccwu8tw5junk8elg5dy6e6ykpzgl222qrcpa4l3gwmmjwgpgd8xpnsd4fptj42u0evdqz
ACCESS_TOKEN=gaelito2025

# NEW: PostgreSQL
DATABASE_URL="postgresql://esp32_oracle:changeme_secure_password@localhost:5432/esp32_oracle?schema=public"

# NEW: Oracle Auto-Submission
ORACLE_AUTO_SUBMIT=true
ORACLE_SUBMIT_DELAY_MS=5000
ORACLE_CONFIRMATION_WAIT_MS=30000

# NEW: Transaction Monitoring
TX_MONITOR_POLL_INTERVAL_MS=15000
TX_MONITOR_MAX_RETRIES=3
TX_MONITOR_RETRY_DELAY_MS=60000
```

**Actualizar `.env.example`:**
```bash
# Backend Configuration
ACCESS_TOKEN=your-strong-random-token-here
FRONTEND_URL=http://localhost:3000

# Cardano Blockchain
BLOCKFROST_API_KEY=preprodXXXXXXXXXXXX
PRIVATE_KEY=xprv...

# PostgreSQL Database
DATABASE_URL="postgresql://esp32_oracle:your_secure_password@localhost:5432/esp32_oracle?schema=public"

# Oracle Auto-Submission
ORACLE_AUTO_SUBMIT=true
ORACLE_SUBMIT_DELAY_MS=5000
ORACLE_CONFIRMATION_WAIT_MS=30000

# Transaction Monitoring
TX_MONITOR_POLL_INTERVAL_MS=15000
TX_MONITOR_MAX_RETRIES=3
TX_MONITOR_RETRY_DELAY_MS=60000
```

**Generar Prisma Client:**
```bash
npx prisma generate
```

**Crear Migración Inicial:**
```bash
npx prisma migrate dev --name init
```

Esto creará:
- `prisma/migrations/XXXXXXX_init/migration.sql`
- Tablas en PostgreSQL: Sensor, Measurement, OracleTransaction

**Verificar con Prisma Studio:**
```bash
npx prisma studio
```
Abrir http://localhost:5555 y verificar que las 3 tablas existen.

---

### Fase 2: Capa de Servicios (Parallel, No Breaking)

Crear todos los archivos de servicios SIN modificar el backend aún.

#### 2.1 Prisma Config

**Archivo:** `offchain/backend/config/prisma.ts`

(Copiar código de sección "Arquitectura de Servicios" arriba)

#### 2.2 Utilities

**Archivo:** `offchain/backend/utils/message-builder.ts`

Extraer funciones de `api_server.ts`:
- `buildMessage()`
- `calculateHash()`
- `verifyHash()`

**Archivo:** `offchain/backend/utils/signature-verification.ts`

Extraer función de `api_server.ts`:
- `verifySignature()` → rename to `verifyECDSASignature()`
- Agregar placeholder `verifyEd25519Signature()` para futuro

#### 2.3 Types

**Archivo:** `offchain/backend/types/index.ts`

```typescript
// Re-export Prisma types
export type {
  Sensor,
  Measurement,
  OracleTransaction,
  OracleTransactionStatus,
  OracleTransactionType
} from '@prisma/client';

// Existing payload from ESP32
export interface ArduinoPayload {
  sensor_id: string;
  temperature?: number;
  humidity?: number;
  message?: string;
  hash: string;
  signature: string;
  publicKey: string;
  timestamp?: number;
  verified?: boolean;
  received_timestamp?: number;
}
```

#### 2.4 Services

**Archivos:**
- `offchain/backend/services/sensor.service.ts`
- `offchain/backend/services/measurement.service.ts`
- `offchain/backend/services/oracle-submission.service.ts`
- `offchain/backend/services/tx-monitor.service.ts`

(Copiar implementación completa de sección "Arquitectura de Servicios")

**Probar servicios de forma aislada:**
```typescript
// Crear script de prueba: offchain/backend/test-services.ts
import { prisma } from './config/prisma.js';
import { sensorService } from './services/sensor.service.js';
import { measurementService } from './services/measurement.service.js';

async function test() {
  // Test connection
  await prisma.$connect();
  console.log('✅ Connected to database');

  // Test sensor creation
  const sensor = await sensorService.getOrCreate('TEST_001', 'AABBCC...');
  console.log('✅ Created sensor:', sensor);

  // Test measurement creation
  const measurement = await measurementService.create({
    sensor_id: 'TEST_001',
    hash: '00'.repeat(32),
    signature: '00'.repeat(64),
    publicKey: '00'.repeat(64),
    verified: true
  });
  console.log('✅ Created measurement:', measurement);

  await prisma.$disconnect();
}

test();
```

```bash
tsx offchain/backend/test-services.ts
```

---

### Fase 3: Modificar Backend (Breaking Change)

#### 3.1 Backup

```bash
cp offchain/backend/api_server.ts offchain/backend/api_server.ts.backup
```

#### 3.2 Modificaciones en `api_server.ts`

**Importaciones (agregar):**
```typescript
import { prisma } from './config/prisma.js';
import { measurementService } from './services/measurement.service.js';
import { sensorService } from './services/sensor.service.js';
import { oracleSubmissionService } from './services/oracle-submission.service.js';
import { txMonitorService } from './services/tx-monitor.service.js';
import { buildMessage, verifyHash, calculateHash } from './utils/message-builder.js';
import { verifyECDSASignature } from './utils/signature-verification.js';
import type { ArduinoPayload } from './types/index.js';
```

**Remover:**
```typescript
// ELIMINAR esta línea:
let measurementsHistory: ArduinoPayload[] = [];

// ELIMINAR constante MAX_MEASUREMENTS

// ELIMINAR funciones duplicadas (ahora en utils):
// - buildMessage()
// - calculateHash()
// - verifyHash()
// - verifySignature()
```

**Startup (modificar):**
```typescript
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`🌐 API Rest activa en http://0.0.0.0:${PORT}`);
  console.log(`📡 Esperando datos en POST /api/ingest`);

  // Test database connection
  try {
    await prisma.$connect();
    console.log(`✅ Database connected`);
  } catch (error) {
    console.error(`❌ Database connection failed:`, error);
    console.error(`💡 Make sure PostgreSQL is running: docker-compose up -d`);
    process.exit(1);
  }

  // Start services
  if (process.env.ORACLE_AUTO_SUBMIT === 'true') {
    oracleSubmissionService.start();
  }

  txMonitorService.start();
});
```

**Graceful Shutdown (agregar):**
```typescript
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');

  oracleSubmissionService.stop();
  txMonitorService.stop();

  await prisma.$disconnect();
  process.exit(0);
});
```

**POST /api/ingest (modificar):**

Antes (in-memory):
```typescript
// Guardar en memoria
measurementsHistory.unshift({
  ...payload,
  verified: isValid,
  received_timestamp: Date.now()
});

// Limitar tamaño
if (measurementsHistory.length > MAX_MEASUREMENTS) {
  measurementsHistory = measurementsHistory.slice(0, MAX_MEASUREMENTS);
}
```

Después (database):
```typescript
// Guardar en DB
const measurement = await measurementService.create({
  ...payload,
  message: message.toString('hex'),
  verified: isValid,
  received_timestamp: Date.now()
});

console.log(`💾 Saved measurement ${measurement.id} for sensor ${payload.sensor_id}`);

// Response
res.status(201).json({
  status: "success",
  message: "Firma verificada. Dato pendiente de certificación en Cardano",
  verified: true,
  measurement_id: measurement.id  // Agregar ID
});
```

**GET /api/measurements (modificar):**

Antes (in-memory):
```typescript
app.get('/api/measurements', validateToken, (req: Request, res: Response) => {
  res.json(measurementsHistory);
});
```

Después (database):
```typescript
app.get('/api/measurements', validateToken, async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 100;
  const sensor_id = req.query.sensor_id as string;

  let measurements;

  if (sensor_id) {
    measurements = await measurementService.getRecent(sensor_id, limit);
  } else {
    measurements = await measurementService.getAll(page, limit);
  }

  // Serializar BigInt a string para JSON
  const serialized = measurements.map(m => ({
    ...m,
    timestamp: m.timestamp ? m.timestamp.toString() : null
  }));

  res.json(serialized);
});
```

**GET /api/sensors (agregar nuevo endpoint):**
```typescript
app.get('/api/sensors', validateToken, async (req: Request, res: Response) => {
  const sensors = await sensorService.listActive();
  res.json(sensors);
});
```

#### 3.3 Verificar

**Test backend startup:**
```bash
npm run dev
```

Debe mostrar:
```
🌐 API Rest activa en http://0.0.0.0:3001
✅ Database connected
🚀 Starting Oracle Auto-Submission Service (5000ms interval)
👁️  Starting Transaction Monitor Service (15000ms interval)
```

**Test ingestion:**
```bash
curl -X POST http://localhost:3001/api/ingest?token=gaelito2025 \
  -H "Content-Type: application/json" \
  -d @test-data/test_payloads.json
```

**Verificar en DB:**
```bash
npx prisma studio
```
Abrir tabla Measurement, debe haber nuevo registro.

---

### Fase 4: Refactorizar Oracle Scripts

#### 4.1 Modificar `update_oracle.ts`

**Extraer función reutilizable:**

Antes (CLI-only):
```typescript
async function main() {
  // ... toda la lógica inline ...
}

main().then(...).catch(...)
```

Después (exportable):
```typescript
export interface UpdateOracleParams {
  nftPolicyId: string;
  nftAssetName: string;
  newSensorData: SensorData;
  wallet: MeshWallet;
  blockfrostProvider: BlockfrostProvider;
}

export interface UpdateOracleResult {
  txHash: string;
  utxoTxHash: string;
  utxoIndex: number;
}

/**
 * Update oracle with new sensor data
 * Exported for use by oracle-submission.service.ts
 */
export async function updateOracle(params: UpdateOracleParams): Promise<UpdateOracleResult> {
  const { wallet, nftPolicyId, nftAssetName, newSensorData, blockfrostProvider } = params;

  // ... toda la lógica existente ...

  return {
    txHash,
    utxoTxHash: oracleUtxo.input.txHash,
    utxoIndex: oracleUtxo.input.outputIndex
  };
}

// CLI wrapper
async function main() {
  // Parse args
  // ...

  const result = await updateOracle({
    nftPolicyId,
    nftAssetName,
    newSensorData,
    wallet,
    blockfrostProvider
  });

  console.log("\n✅ Oracle Updated Successfully!");
  console.log("  Tx Hash:", result.txHash);
}

// Only run main if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .then(() => console.log("\n✨ Done"))
    .catch((err) => {
      console.error("\n❌ Error:", err);
      process.exit(1);
    });
}
```

**Similar refactoring para:**
- `create_oracle.ts` → export `createOracle()`
- `mint_sensor_nft.ts` → export `mintSensorNFT()`

#### 4.2 Integrar con oracle-submission.service.ts

**Modificar `submitMeasurement()` en oracle-submission.service.ts:**

```typescript
import { updateOracle } from '../../transactions/update_oracle.js';
import { BlockfrostProvider, MeshWallet } from '@meshsdk/core';
import dotenv from 'dotenv';

dotenv.config();

// Initialize wallet and provider
const blockfrostProvider = new BlockfrostProvider(
  process.env.BLOCKFROST_API_KEY || ""
);

const wallet = new MeshWallet({
  networkId: 0,
  fetcher: blockfrostProvider,
  submitter: blockfrostProvider,
  key: {
    type: "root",
    bech32: process.env.PRIVATE_KEY || ""
  },
});

// En submitMeasurement():
try {
  const sensorData = {
    sensor_id: measurement.sensor_id,
    temperature: measurement.temperature!,
    humidity: measurement.humidity!,
    timestamp: Number(measurement.timestamp!),
    signature: measurement.signature,
    public_key: measurement.public_key
  };

  const result = await updateOracle({
    nftPolicyId: sensor.nft_policy_id!,
    nftAssetName: sensor.nft_asset_name!,
    newSensorData: sensorData,
    wallet,
    blockfrostProvider
  });

  await prisma.oracleTransaction.update({
    where: { id: transaction.id },
    data: {
      tx_hash: result.txHash,
      utxo_tx_hash: result.utxoTxHash,
      utxo_index: result.utxoIndex,
      status: OracleTransactionStatus.PENDING,
      status_message: 'Submitted to mempool'
    }
  });

  console.log(`✅ Submitted measurement ${measurement.id} (tx: ${result.txHash})`);

} catch (error) {
  // ... error handling ...
}
```

---

### Fase 5: Testing End-to-End

#### 5.1 Pre-requisitos

**Verificar servicios:**
```bash
docker ps                    # PostgreSQL running
npx prisma studio           # DB tables exist
npm run dev                 # Backend running with services
```

#### 5.2 Setup Inicial (Una vez por sensor)

**1. Mint NFT para sensor:**
```bash
npm run oracle:mint-nft -- ESP32_TEST
```
Guardar: `policy_id` y `asset_name`

**2. Crear oracle:**
```bash
npm run oracle:create -- <policy_id> <asset_name>
```
Guardar: `script_address`

**3. Registrar en DB:**
```bash
npx prisma studio
```
- Ir a tabla Sensor
- Buscar sensor_id "ESP32_TEST"
- Actualizar campos:
  - nft_policy_id: `<policy_id>`
  - nft_asset_name: `<asset_name>`
  - script_address: `<script_address>`

#### 5.3 Test Ingestion

**Enviar medición verificada:**
```bash
curl -X POST http://localhost:3001/api/ingest?token=gaelito2025 \
  -H "Content-Type: application/json" \
  -d '{
    "sensor_id": "ESP32_TEST",
    "temperature": 235,
    "humidity": 652,
    "timestamp": 1704758400000,
    "hash": "VALID_HASH_HERE",
    "signature": "VALID_SIGNATURE_HERE",
    "publicKey": "VALID_PUBKEY_HERE"
  }'
```

**Verificar logs backend:**
```
📥 Datos recibidos del sensor ESP32_TEST
✅ Firma válida para sensor ESP32_TEST
💾 Saved measurement cljw... for sensor ESP32_TEST
```

**Verificar DB:**
```bash
npx prisma studio
```
- Tabla Measurement: debe haber nuevo registro con verified=true

#### 5.4 Test Auto-Submission

**Esperar 5 segundos** (interval de ORACLE_SUBMIT_DELAY_MS)

**Verificar logs:**
```
📤 Found 1 unsubmitted measurement(s)
🔄 Submitting measurement cljw... for sensor ESP32_TEST
✅ Submitted measurement cljw... (tx: abcd1234...)
```

**Verificar DB:**
```bash
npx prisma studio
```
- Tabla OracleTransaction:
  - Nuevo registro con status PENDING
  - tx_hash populated
- Tabla Measurement:
  - oracle_transaction_id ahora tiene valor (no null)

#### 5.5 Test Transaction Monitoring

**Esperar 15 segundos** (interval de TX_MONITOR_POLL_INTERVAL_MS)

**Verificar logs (cada 15s):**
```
🔍 Checking 1 pending transaction(s)
```

**Esperar ~60 segundos** (tiempo de confirmación en blockchain)

**Verificar logs:**
```
✅ Transaction abcd1234... confirmed in block 12345
```

**Verificar DB:**
```bash
npx prisma studio
```
- Tabla OracleTransaction:
  - status: CONFIRMED
  - confirmed_at: timestamp
  - block_height: número de bloque
  - block_time: timestamp del bloque

#### 5.6 Test Query Endpoints

**Get measurements:**
```bash
curl http://localhost:3001/api/measurements?token=gaelito2025
```

**Get measurements por sensor:**
```bash
curl "http://localhost:3001/api/measurements?token=gaelito2025&sensor_id=ESP32_TEST"
```

**Get sensors:**
```bash
curl http://localhost:3001/api/sensors?token=gaelito2025
```

#### 5.7 Test con ESP32 Real

**Configurar hardware:**
- Cargar sketch `hardware/sign_device_ed25519.ino`
- Configurar WiFi y endpoint API
- Registrar public key en DB

**Enviar medición desde ESP32:**
- El dispositivo automáticamente enviará POST /api/ingest
- Backend verificará, guardará, y auto-enviará al oracle
- Verificar todo el flujo end-to-end

---

## 🔄 Flujo de Datos Completo

```
┌────────────────┐
│   ESP32 Device │
│   (Ed25519)    │
└───────┬────────┘
        │ POST /api/ingest
        ▼
┌────────────────────────────┐
│   Express Backend          │
│   api_server.ts            │
├────────────────────────────┤
│ 1. Verify signature        │
│ 2. measurementService      │
│    .create()               │
└───────┬────────────────────┘
        │
        ▼
┌────────────────────────────┐
│   PostgreSQL               │
│   Measurement table        │
│   verified = true          │
└───────┬────────────────────┘
        │
        │ (cada 5s)
        ▼
┌────────────────────────────┐
│ Oracle Submission Service  │
├────────────────────────────┤
│ 1. getUnsubmitted()        │
│ 2. updateOracle()          │
│ 3. Create OracleTransaction│
│    status = PENDING        │
└───────┬────────────────────┘
        │
        ▼
┌────────────────────────────┐
│   Cardano Blockchain       │
│   (via Blockfrost API)     │
│   tx submitted to mempool  │
└───────┬────────────────────┘
        │
        │ (cada 15s)
        ▼
┌────────────────────────────┐
│ Transaction Monitor Service│
├────────────────────────────┤
│ 1. Poll Blockfrost         │
│ 2. fetchTxInfo(txHash)     │
│ 3. Update status           │
│    → CONFIRMED             │
│ 4. Save block_height       │
└───────┬────────────────────┘
        │
        ▼
┌────────────────────────────┐
│   PostgreSQL               │
│   OracleTransaction        │
│   status = CONFIRMED       │
│   block_height = 12345     │
└────────────────────────────┘
```

---

## ⚠️ Manejo de Errores

### Database Connection Failures

**Síntoma:** Backend no arranca, error "Cannot connect to database"

**Solución:**
1. Verificar PostgreSQL: `docker ps`
2. Si no está corriendo: `docker-compose up -d`
3. Verificar DATABASE_URL en .env
4. Test manual: `psql -h localhost -U esp32_oracle -d esp32_oracle`

**Código en api_server.ts:**
```typescript
try {
  await prisma.$connect();
  console.log(`✅ Database connected`);
} catch (error) {
  console.error(`❌ Database connection failed:`, error);
  console.error(`💡 Make sure PostgreSQL is running: docker-compose up -d`);
  process.exit(1);  // Fail-fast
}
```

### Oracle Submission Failures

**Síntoma:** Measurement guardada pero OracleTransaction en FAILED

**Causas posibles:**
1. Blockfrost API down → Retry automático
2. Wallet sin fondos → Agregar ADA
3. UTXO ya consumido → Verificar estado del oracle
4. Script validation failed → Verificar firma Ed25519

**Retry Logic:**
```typescript
if (currentRetries < maxRetries) {
  // Schedule retry
  const nextRetryAt = new Date(Date.now() + 60000);  // 60s

  await prisma.oracleTransaction.update({
    where: { id: transaction_id },
    data: {
      status: OracleTransactionStatus.RETRYING,
      retry_count: currentRetries + 1,
      next_retry_at: nextRetryAt
    }
  });
} else {
  // Max retries exceeded
  await prisma.oracleTransaction.update({
    where: { id: transaction_id },
    data: {
      status: OracleTransactionStatus.FAILED,
      status_message: 'Max retries exceeded'
    }
  });
}
```

### Blockfrost API Failures

**Síntoma:** TX Monitor logs "Error checking transaction"

**Manejo:**
1. No marcar tx como FAILED inmediatamente
2. Continuar polling en siguiente ciclo
3. Log error pero no crash
4. Si persiste >5 min: notificar admin

**Código en tx-monitor.service.ts:**
```typescript
try {
  const txInfo = await this.blockfrost.fetchTxInfo(tx_hash);
  // ...
} catch (error) {
  console.error(`❌ Error checking transaction ${tx_hash}:`, error);
  // NO marcar como FAILED, continuar polling
  await prisma.oracleTransaction.update({
    where: { id: transaction_id },
    data: { last_checked_at: new Date() }
  });
}
```

### Transaction Confirmation Timeout

**Síntoma:** Transaction PENDING por más de 5 minutos

**Investigación manual:**
1. Buscar tx en CardanoScan: https://preprod.cardanoscan.io/transaction/{txHash}
2. Verificar si está en mempool o fue rechazada
3. Si rechazada: ver error de script execution

**Futuro enhancement:**
- Timeout automático después de 5 minutos
- Marcar como FAILED y permitir resubmit manual

---

## 🔙 Plan de Rollback

### Opción 1: Rollback Completo (Emergencia)

**Si la implementación falla completamente:**

```bash
# 1. Checkout commit anterior
git checkout <commit-hash-antes-de-db>

# 2. Stop database
docker-compose down

# 3. Reinstall dependencies
npm install

# 4. Restart backend (in-memory mode)
npm run dev
```

El sistema volverá a funcionar con almacenamiento en memoria (1000 items max).

### Opción 2: Rollback Parcial (Deshabilitar Auto-Submission)

**Si la DB funciona pero auto-submission tiene problemas:**

```bash
# 1. Edit .env
ORACLE_AUTO_SUBMIT=false

# 2. Restart backend
npm run dev
```

El backend seguirá guardando en DB, pero sin enviar automáticamente al oracle.
Puedes correr `npm run oracle:update` manualmente.

### Opción 3: Database Migration Rollback

**Si la migración de Prisma falló:**

```bash
# Rollback última migración
npx prisma migrate resolve --rolled-back XXXXXXX_init

# O reset completo (CUIDADO: borra todos los datos)
npx prisma migrate reset
```

---

## 📊 Archivos a Crear/Modificar

### Crear (14 archivos nuevos)

| Archivo | Propósito |
|---------|-----------|
| `docker-compose.yml` | PostgreSQL service |
| `prisma/schema.prisma` | Database schema |
| `offchain/backend/config/prisma.ts` | Prisma client singleton |
| `offchain/backend/types/index.ts` | TypeScript types |
| `offchain/backend/utils/message-builder.ts` | Message utils |
| `offchain/backend/utils/signature-verification.ts` | Signature utils |
| `offchain/backend/services/sensor.service.ts` | Sensor CRUD |
| `offchain/backend/services/measurement.service.ts` | Measurement CRUD |
| `offchain/backend/services/oracle-submission.service.ts` | Auto-submit |
| `offchain/backend/services/tx-monitor.service.ts` | TX monitoring |
| `.env` (actualizar) | DATABASE_URL + variables |
| `.env.example` (actualizar) | Template vars |
| `prisma/migrations/XXXXXXX_init/migration.sql` | (auto-generado) |
| `offchain/backend/test-services.ts` | Test script (opcional) |

### Modificar (3 archivos existentes)

| Archivo | Cambios |
|---------|---------|
| `offchain/backend/api_server.ts` | Migrar de in-memory a DB |
| `offchain/transactions/update_oracle.ts` | Export función reutilizable |
| `package.json` | Agregar Prisma dependencies |

---

## ✅ Checklist de Verificación Final

### Setup
- [ ] PostgreSQL corriendo: `docker ps`
- [ ] Prisma migrations aplicadas: `npx prisma migrate status`
- [ ] Prisma client generado: `node_modules/.prisma/client` existe
- [ ] .env tiene DATABASE_URL configurado

### Backend
- [ ] Backend arranca sin errores: `npm run dev`
- [ ] Logs muestran "✅ Database connected"
- [ ] Logs muestran "🚀 Starting Oracle Auto-Submission Service"
- [ ] Logs muestran "👁️  Starting Transaction Monitor Service"

### Database
- [ ] Tablas creadas: Sensor, Measurement, OracleTransaction
- [ ] Índices creados correctamente
- [ ] Prisma Studio funciona: `npx prisma studio`

### API Endpoints
- [ ] POST /api/ingest guarda en DB
- [ ] GET /api/measurements retorna desde DB
- [ ] GET /api/sensors funciona
- [ ] BigInt timestamp serializa correctamente

### Auto-Submission
- [ ] Service detecta mediciones no enviadas
- [ ] Crea OracleTransaction con status PENDING
- [ ] Llama updateOracle() correctamente
- [ ] Guarda txHash en DB
- [ ] Link measurement → transaction

### Transaction Monitoring
- [ ] Service poll cada 15s
- [ ] Detecta transacciones confirmadas
- [ ] Actualiza status → CONFIRMED
- [ ] Guarda block_height y timestamp
- [ ] Retry logic funciona para FAILED

### Integration
- [ ] ESP32 → Backend → DB funciona
- [ ] Backend → Oracle → Cardano funciona
- [ ] Oracle → Monitor → DB funciona
- [ ] Queries funcionan con oracle_transaction_id

---

## 🚀 Próximos Pasos (Post-Implementación)

### Phase 3 Enhancements

**1. Frontend Dashboard**
- Mostrar estado onchain en UI
- Badge: PENDING / CONFIRMED / FAILED
- Link a CardanoScan explorer
- Timeline de confirmación

**2. Alertas y Notificaciones**
- Email/Slack cuando transacción falla
- Webhook cuando se confirma
- Dashboard de salud del sistema

**3. Analytics**
- Gráficos de temperatura/humedad (Grafana)
- Métricas de uptime del oracle
- Tiempo promedio de confirmación
- Rate de éxito de transacciones

**4. Multi-Sensor Management**
- UI para registrar nuevos sensores
- Batch processing de mediciones
- Priorización de sensores críticos

**5. Performance Optimization**
- Redis cache para queries frecuentes
- Background jobs con Bull/BullMQ
- Connection pooling tuning
- Database read replicas

**6. Security Hardening**
- Vault para private keys
- Rate limiting por sensor
- Signature validation cache
- Audit logging

**7. Monitoring & Observability**
- Prometheus metrics
- Grafana dashboards
- Error tracking (Sentry)
- Uptime monitoring (UptimeRobot)

---

## 📚 Recursos y Documentación

### Prisma
- Docs: https://www.prisma.io/docs
- Schema Reference: https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference
- Migrations: https://www.prisma.io/docs/concepts/components/prisma-migrate

### PostgreSQL
- Docs: https://www.postgresql.org/docs/
- Docker Image: https://hub.docker.com/_/postgres

### MeshJS
- Docs: https://meshjs.dev/
- API Reference: https://meshjs.dev/apis

### Blockfrost
- Docs: https://docs.blockfrost.io/
- API Explorer: https://blockfrost.io/docs/api

### Cardano
- Developer Portal: https://developers.cardano.org/
- Preprod Explorer: https://preprod.cardanoscan.io/

---

## 📝 Notas Finales

Este plan implementa una arquitectura robusta y escalable para el sistema de certificación de datos IoT en Cardano. La separación en servicios permite:

1. **Mantenibilidad**: Código modular y testeable
2. **Escalabilidad**: Cada servicio puede optimizarse independientemente
3. **Observabilidad**: Logs claros en cada capa
4. **Confiabilidad**: Retry logic y error handling
5. **Auditabilidad**: Registro completo de todo el ciclo de vida

La implementación fase por fase minimiza riesgo y permite validación incremental. Cada fase puede probarse antes de continuar con la siguiente.

**Tiempo estimado de implementación:**
- Fase 1 (Setup DB): 30 minutos
- Fase 2 (Services): 2-3 horas
- Fase 3 (Backend): 1-2 horas
- Fase 4 (Refactor): 1 hora
- Fase 5 (Testing): 1-2 horas

**Total: ~1 día de desarrollo**

---

**Autor:** Claude Sonnet 4.5
**Fecha:** 2026-01-07
**Versión:** 1.0
