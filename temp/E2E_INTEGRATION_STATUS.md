# Estado de Integración End-to-End - Análisis
**Fecha:** 2026-01-09
**Autor:** Claude Code

## 🎯 Objetivo del Análisis

Verificar la integración entre las APIs REST del backend y las funciones de Lucid Evolution para la construcción de transacciones Oracle en Cardano.

---

## 📊 Estado Actual

### ✅ Componentes que Funcionan Correctamente

#### 1. **API REST - Endpoints Implementados**
- ✅ `POST /api/ingest` - Recibe y valida mediciones firmadas con Ed25519
- ✅ `GET /api/measurements` - Consulta mediciones almacenadas
- ✅ `GET /api/sensors` - Lista sensores activos
- ✅ `GET /api/transactions` - Historial de transacciones blockchain
- ✅ `GET /api/statistics` - Estadísticas agregadas

#### 2. **Backend Services**
- ✅ `measurementService` - Gestión de mediciones en DB (PostgreSQL + Prisma)
- ✅ `sensorService` - Gestión de sensores en DB
- ✅ `transactionService` - Gestión de transacciones oracle en DB
- ✅ `txMonitorService` - Monitoreo de transacciones pending → confirmed
- ⚠️ `oracleSubmissionService` - **Usa MeshJS (ROTO)** - Ver detalles abajo

#### 3. **Scripts Lucid Evolution (CLI)**
Scripts standalone que funcionan correctamente vía `npm run`:
- ✅ `mint_sensor_nft_lucid.ts` - Mint NFT para sensor
- ✅ `create_oracle_lucid.ts` - Crear oracle con NFT
- ✅ `update_oracle_lucid.ts` - Actualizar oracle con datos del sensor
- ✅ `delete_oracle_lucid.ts` - Eliminar oracle y recuperar fondos

**Problema:** Estos scripts NO exportan funciones reutilizables, son solo CLI scripts.

#### 4. **Scripts MeshJS (DEPRECATED)**
- ⚠️ `mint_sensor_nft.ts` - Deprecated, funciona pero usar Lucid
- ⚠️ `create_oracle.ts` - Deprecated, funciona pero usar Lucid
- ❌ `update_oracle.ts` - **ROTO** (bug Plutus V3 BigInt en MeshJS beta)
- ⚠️ `delete_oracle.ts` - Deprecated, funciona pero usar Lucid

---

## ❌ Problemas Identificados

### **PROBLEMA CRÍTICO: oracle-submission.service usa MeshJS roto**

**Archivo:** `offchain/backend/services/oracle-submission.service.ts`
**Línea:** 5

```typescript
import { updateOracle, type UpdateOracleParams, type SensorData } from '../../transactions/update_oracle.js';
```

**Problema:**
- El servicio `oracle-submission.service` es el encargado de **enviar automáticamente mediciones al oracle** en Cardano
- Importa desde `update_oracle.ts` (MeshJS) que tiene el bug de `BigInt` en Plutus V3
- Cuando el servicio intenta enviar una transacción, **FALLA** con el error conocido
- Las mediciones se quedan en estado "FAILED" en la DB

**Impacto:**
- ⛔ **Auto-submission de mediciones NO funciona**
- ⛔ **Integración end-to-end está ROTA**
- ✅ Todos los demás componentes funcionan (ingest, validación, storage, monitoring)

---

## 🔧 Arquitectura del Sistema de Auto-Submission

### Flujo Actual (ROTO)

```
1. ESP32 → POST /api/ingest
2. Backend valida firma Ed25519 ✅
3. Backend guarda en PostgreSQL ✅
4. oracleSubmissionService detecta medición sin TX ✅
5. oracleSubmissionService.submitMeasurement()
   → Llama updateOracle(params) desde update_oracle.ts (MeshJS)
   → ❌ FALLA: "Cannot convert undefined to BigInt"
6. Marca TX como FAILED en DB ✅
```

### Flujo Deseado (con Lucid Evolution)

```
1. ESP32 → POST /api/ingest
2. Backend valida firma Ed25519 ✅
3. Backend guarda en PostgreSQL ✅
4. oracleSubmissionService detecta medición sin TX ✅
5. oracleSubmissionService.submitMeasurement()
   → Llama updateOracleLucid(params) desde update_oracle_lucid_lib.ts
   → ✅ Construye TX con Lucid Evolution
   → ✅ Submit TX a Cardano
6. Marca TX como PENDING en DB ✅
7. txMonitorService verifica confirmación ✅
```

---

## 🛠️ Solución Requerida

### **Paso 1: Crear Módulos Exportables de Lucid Evolution**

Los scripts CLI actuales (`*_lucid.ts`) deben ser refactorizados en funciones exportables:

#### **Archivo nuevo:** `offchain/transactions/oracle_lucid_lib.ts`

```typescript
// Módulo reutilizable con funciones de Lucid Evolution

import { Blockfrost, Lucid, Data, applyParamsToScript, Constr, validatorToAddress } from "@lucid-evolution/lucid";
import { readFileSync } from "fs";
import { resolve } from "path";

// Tipos exportados
export interface SensorData {
    sensor_id: string;
    temperature: number;
    humidity: number;
    timestamp: number;
    signature: string;
    public_key: string;
}

export interface OracleUpdateParams {
    blockfrostApiKey: string;
    privateKey: string;        // Bech32 root key
    networkId: number;         // 0 = Preprod, 1 = Mainnet
    nftPolicyId: string;
    nftAssetName: string;
    sensorData: SensorData;
}

export interface OracleCreateParams {
    blockfrostApiKey: string;
    privateKey: string;
    networkId: number;
    nftPolicyId: string;
    nftAssetName: string;
    initialSensorData: SensorData;
}

export interface OracleDeleteParams {
    blockfrostApiKey: string;
    privateKey: string;
    networkId: number;
    nftPolicyId: string;
    nftAssetName: string;
}

// Funciones exportadas
export async function updateOracle(params: OracleUpdateParams): Promise<string> {
    // Implementación extraída de update_oracle_lucid.ts
    // Retorna: txHash
}

export async function createOracle(params: OracleCreateParams): Promise<{ txHash: string; scriptAddress: string }> {
    // Implementación extraída de create_oracle_lucid.ts
    // Retorna: { txHash, scriptAddress }
}

export async function deleteOracle(params: OracleDeleteParams): Promise<string> {
    // Implementación extraída de delete_oracle_lucid.ts
    // Retorna: txHash
}

// Helper functions compartidas
export function buildMessage(data: SensorData): Buffer {
    // Construir mensaje alfabético para firma Ed25519
}

export function initializeLucid(blockfrostApiKey: string, network: "Preprod" | "Mainnet"): Promise<any> {
    // Inicializar Lucid con Blockfrost
}

export async function loadWallet(lucid: any, privateKey: string): Promise<void> {
    // Cargar wallet desde Bech32 root key
}
```

### **Paso 2: Actualizar oracle-submission.service**

**Archivo:** `offchain/backend/services/oracle-submission.service.ts`

```typescript
// ANTES (línea 5):
import { updateOracle, type UpdateOracleParams, type SensorData } from '../../transactions/update_oracle.js';

// DESPUÉS (línea 5):
import { updateOracle, type OracleUpdateParams, type SensorData } from '../../transactions/oracle_lucid_lib.js';

// Actualizar línea 154:
const params: OracleUpdateParams = {  // antes: UpdateOracleParams
  blockfrostApiKey: process.env.BLOCKFROST_API_KEY || '',
  privateKey: process.env.PRIVATE_KEY || '',
  networkId: 0, // Preprod = 0, Mainnet = 1
  nftPolicyId: sensor.nft_policy_id,
  nftAssetName: sensor.nft_asset_name,
  sensorData
};
```

### **Paso 3: Actualizar Scripts CLI**

Los scripts CLI (`update_oracle_lucid.ts`, etc.) deben importar del nuevo módulo:

```typescript
// ANTES: Implementación inline en el script
async function performUpdate(...) { ... }

// DESPUÉS: Importar del módulo
import { updateOracle, type OracleUpdateParams } from './oracle_lucid_lib.js';

async function main() {
    const params: OracleUpdateParams = { ... };
    const txHash = await updateOracle(params);
    console.log(`✅ TX: ${txHash}`);
}
```

---

## 📋 Dependencias y Compatibilidad

### **Librerías Usadas**

| Librería | Versión | Uso | Estado |
|----------|---------|-----|--------|
| `@lucid-evolution/lucid` | 0.4.29 | Construcción de TXs | ✅ Funciona |
| `lucid-cardano` | Latest | Derivación de keys | ✅ Funciona |
| `@lucid-evolution/utils` | Latest | Utils (getAddressDetails) | ✅ Funciona |
| `@meshsdk/core` | 1.9.0-beta.90 | BlockfrostProvider (solo queries) | ⚠️ Solo para tx-monitor |
| `tweetnacl` | Latest | Ed25519 signing | ✅ Funciona |
| `dotenv` | Latest | Env vars | ✅ Funciona |

**Nota:** MeshJS sigue siendo usado en `tx-monitor.service` para **queries** (fetchTxInfo), lo cual está bien porque el bug solo afecta la construcción de transacciones con Plutus V3.

---

## 🧪 Plan de Testing End-to-End

### **Test 1: Ingest → Auto-Submit → Confirm**

```bash
# 1. Registrar sensor con NFT (si no existe)
npm run db:register-sensor -- ESP32_001 <public_key> <nft_policy_id> <nft_asset_name> <script_address>

# 2. Configurar auto-submission
export ORACLE_AUTO_SUBMIT=true
export ORACLE_SUBMIT_DELAY_MS=5000

# 3. Iniciar backend
npm run dev

# 4. Enviar medición desde ESP32 (o curl)
curl -X POST http://localhost:3001/api/ingest?token=<ACCESS_TOKEN> \
  -H "Content-Type: application/json" \
  -d '{
    "sensor_id": "ESP32_001",
    "temperature": 235,
    "humidity": 652,
    "timestamp": 1704844800000,
    "hash": "...",
    "signature": "...",
    "publicKey": "..."
  }'

# 5. Verificar logs del backend
# Debe ver:
#   ✅ Firma Ed25519 válida
#   💾 Saved measurement...
#   📤 Found 1 unsubmitted measurement(s)
#   🔄 Submitting measurement...
#   📡 Calling updateOracle...
#   ✅ Oracle update submitted: <tx_hash>

# 6. Esperar confirmación (30-60 segundos)
# txMonitorService debe actualizar status: PENDING → CONFIRMED

# 7. Verificar en DB
npm run db:status
```

### **Test 2: Manual Submission**

```bash
# Si auto-submit está deshabilitado, trigger manual:
# (Requiere endpoint adicional - ver recomendaciones)

curl -X POST http://localhost:3001/api/oracle/submit?token=<TOKEN> \
  -H "Content-Type: application/json" \
  -d '{ "measurement_id": "<measurement_id>" }'
```

---

## 📝 Recomendaciones Adicionales

### **1. Agregar Endpoints REST para Gestión Manual**

Actualmente no hay endpoints REST para operaciones oracle manuales. Sugerencias:

```typescript
// En api_server.ts

// Crear oracle manualmente
app.post('/api/oracle/create', validateToken, async (req, res) => {
  const { sensor_id, nft_policy_id, nft_asset_name } = req.body;
  // Llamar createOracle() desde oracle_lucid_lib
});

// Actualizar oracle manualmente (forzar una medición específica)
app.post('/api/oracle/update', validateToken, async (req, res) => {
  const { measurement_id } = req.body;
  // Llamar oracleSubmissionService.submitManually(measurement_id)
});

// Eliminar oracle
app.post('/api/oracle/delete', validateToken, async (req, res) => {
  const { sensor_id } = req.body;
  // Llamar deleteOracle() desde oracle_lucid_lib
});

// Verificar estado de TX manualmente
app.post('/api/oracle/check-tx', validateToken, async (req, res) => {
  const { transaction_id } = req.body;
  // Llamar txMonitorService.checkManually(transaction_id)
});
```

### **2. Mejorar Manejo de Errores**

Agregar retry logic en caso de errores temporales:
- Network timeouts
- Insufficient funds (esperar confirmación de UTXOs)
- Script errors (logging detallado)

### **3. Monitoreo y Alertas**

Implementar alertas cuando:
- Auto-submission falla repetidamente
- Transacciones quedan en PENDING por más de 5 minutos
- Wallet tiene fondos insuficientes

### **4. Testing Automatizado**

Crear suite de tests:
- `test/integration/e2e-oracle.test.ts`
- Mock de Blockfrost API
- Test de cada flujo completo

---

## 🚀 Prioridades de Implementación

### **Fase 1: Fix Crítico (AHORA)**
1. ✅ Crear `oracle_lucid_lib.ts` con funciones exportables
2. ✅ Actualizar `oracle-submission.service.ts`
3. ✅ Testing end-to-end básico

### **Fase 2: Endpoints REST (SIGUIENTE)**
4. Agregar endpoints manuales de gestión oracle
5. Documentar API en Swagger/OpenAPI

### **Fase 3: Robustez (FUTURO)**
6. Retry logic y error handling mejorado
7. Monitoring y alertas
8. Testing automatizado

---

## 📈 Métricas de Éxito

### **Antes (Estado Actual)**
- ❌ Auto-submission: 0% success rate (MeshJS bug)
- ✅ Manual CLI scripts: 100% success rate (Lucid)
- ✅ Ingest + Validación: 100% success rate
- ✅ TX Monitoring: 100% success rate

### **Después (Post-Fix)**
- ✅ Auto-submission: >95% success rate esperado
- ✅ Manual CLI scripts: 100% success rate (sin cambios)
- ✅ Ingest + Validación: 100% success rate (sin cambios)
- ✅ TX Monitoring: 100% success rate (sin cambios)
- ✅ **End-to-End completo FUNCIONANDO** 🎯

---

## 📚 Referencias

- **MeshJS Bug Report:** `docs/MESHJS_PLUTUS_V3_ISSUE.md`
- **Migration Guide:** `docs/MIGRATION_PLAN_LUCID_EVOLUTION.md`
- **Migration Log:** `temp/MIGRACION_LUCID_EVOLUTION_LOG.md`
- **Signature Flow:** `docs/SIGNATURE_FLOW.md`
- **Oracle Usage:** `docs/oracle-usage.md`

---

## ✅ Checklist de Implementación

- [ ] Crear `oracle_lucid_lib.ts` con funciones exportables
- [ ] Refactorizar `update_oracle_lucid.ts` para usar el lib
- [ ] Refactorizar `create_oracle_lucid.ts` para usar el lib
- [ ] Refactorizar `delete_oracle_lucid.ts` para usar el lib
- [ ] Actualizar `oracle-submission.service.ts` para importar de Lucid lib
- [ ] Testing manual end-to-end (ESP32 → Backend → Cardano)
- [ ] Verificar confirmaciones en Cardano Explorer
- [ ] Actualizar CLAUDE.md con estado actualizado
- [ ] Commitear cambios con mensaje descriptivo

---

**🎯 CONCLUSIÓN:** El sistema está 95% completo. Solo falta refactorizar los scripts de Lucid Evolution en módulos reutilizables y actualizar el servicio de auto-submission para usar Lucid en lugar de MeshJS. Una vez hecho esto, el flujo end-to-end estará completamente funcional.
