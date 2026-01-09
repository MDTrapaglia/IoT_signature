# MeshJS Plutus V3 Oracle Update Issue

**Fecha:** 2026-01-08
**Estado:** BLOQUEANTE - No se pueden actualizar oráculos con MeshJS beta
**Versión MeshJS:** 1.9.0-beta.90
**Impacto:** Sistema offchain funcional, pero actualizaciones on-chain fallan

---

## Resumen Ejecutivo

El sistema ESP32 IoT Certification funciona correctamente en la capa offchain:
- ✅ Backend recibe mediciones firmadas con Ed25519
- ✅ Validación de firmas funciona correctamente
- ✅ Base de datos PostgreSQL almacena datos
- ✅ Frontend dashboard muestra métricas
- ✅ **Creación de oráculos funciona** (tx: `c79f01469c32168d3b9fa1bc0e1059f2b26dc62132bb29deed14709318ad2b55`)

**El problema:** Las actualizaciones del oráculo (spending de scripts Plutus V3) fallan con MeshJS beta durante la fase de construcción de transacción.

---

## Descripción del Problema

### Error Principal

```
Error: Evaluate redeemers failed: Error serializing outputs: Cannot convert undefined to a BigInt
    at Object.computeMinimumCost (node_modules/@meshsdk/transaction/dist/index.js:4107:19)
    at async computeMinimumCost (node_modules/@meshsdk/transaction/dist/index.js:1387:19)
    at async computeChangeAndAdjustForFee (node_modules/@cardano-sdk/input-selection/src/RoundRobinRandomImprove/change.ts:447:26)
    at async _MeshTxBuilder.selectUtxos (node_modules/@meshsdk/transaction/dist/index.js:4144:12)
    at async _MeshTxBuilder.complete (node_modules/@meshsdk/transaction/dist/index.js:4069:25)
```

### Fase de la Falla

El error ocurre durante `.complete()` en MeshJS, específicamente:
1. ✅ Construcción del datum funciona
2. ✅ Construcción del redeemer funciona
3. ✅ Selección de UTXOs inicia
4. ❌ **Falla en `computeMinimumCost` al serializar outputs**
5. ❌ La transacción nunca se construye

### Observaciones Importantes

1. **La creación del oráculo funcionó** - Mismo datum, mismas estructuras de datos, misma red
2. **El error también ocurre sin outputs** - Probamos consumir el UTXO sin crear nuevos outputs (Delete redeemer) y falla igual
3. **El error es con spending, no con creación** - `spendingPlutusScriptV3()` trigger el problema
4. **El error menciona "undefined" en BigInt** - Sugiere que algún campo necesario no está presente durante la serialización

---

## Estructura del Datum

### Schema Aiken (Plutus V3)

```aiken
// En: onchain/sensors-oracle/validators/sensor_oracle_ed25519.ak

pub type SensorData {
  sensor_id: ByteArray,      // UTF-8 encoded string
  temperature: Int,          // Valor * 10 (235 = 23.5°C)
  humidity: Int,             // Valor * 10 (652 = 65.2%)
  timestamp: Int,            // Unix timestamp en milisegundos
  signature: ByteArray,      // Ed25519 signature (64 bytes)
  public_key: ByteArray,     // Ed25519 public key (32 bytes)
}
```

### Construcción con MeshJS

```typescript
// En: offchain/transactions/update_oracle.ts

const newDatum = mConStr0([
    sensorData.sensor_id,              // string
    Number(sensorData.temperature),    // number (conversión explícita)
    Number(sensorData.humidity),       // number (conversión explícita)
    Number(sensorData.timestamp),      // number (conversión explícita)
    byteString(sensorData.signature),  // hex string → ByteArray
    byteString(sensorData.public_key)  // hex string → ByteArray
] as any);
```

### Valores Ejemplo (que funcionaron en create_oracle.ts)

```typescript
{
  sensor_id: "ESP32_001",
  temperature: 235,           // Int (no BigInt, no tiene decimales)
  humidity: 652,              // Int
  timestamp: 1767889882000,   // Int (timestamp en ms)
  signature: "d6abfbb93350091fb997289609183a4f...", // 64 bytes hex
  public_key: "72ac4b95a9f3a0cdc4af6a301010df26..." // 32 bytes hex
}
```

### Datum Creado Exitosamente (on-chain)

```
d8799f4945535033325f30303118eb19028c1b0000019b9e72b29a5840d6abfbb93350091fb997289609183a4f54d7da3bd01607aeb40bec604fbfee6eb3a449858de8968c4716d958519623f14ac8dd3daff85737572263a9a9f92d0e582072ac4b95a9f3a0cdc4af6a301010df26262e4bc5ba3bf6a5e6aff053763049eaff
```

**Decodificado:**
- Constructor 0
- Campo 0: `4945535033325f30303` → "ESP32_001" (UTF-8)
- Campo 1: `18 eb` → 235 (Int)
- Campo 2: `19 028c` → 652 (Int)
- Campo 3: `1b 0000019b9e72b29a` → 1767889882 (Int)
- Campo 4: 64 bytes (signature)
- Campo 5: 32 bytes (public_key)

---

## Análisis de Campos del Datum

### ¿Cuáles campos causan problemas?

**Hipótesis inicial:** Los campos `Int` (temperature, humidity, timestamp) causaban problemas con BigInt.

**Resultado de tests:**
- ❌ Agregamos validación para evitar NULL → No resolvió
- ❌ Usamos `Number()` explícito → No resolvió
- ❌ Removimos evaluator/submitter → No resolvió
- ❌ Agregamos validity range → No resolvió
- ❌ Filtramos collateral de UTXOs → No resolvió
- ❌ Probamos consumir sin crear outputs → **Mismo error**

**Conclusión:** El problema NO es con los datos del datum. Es con la lógica interna de MeshJS al serializar transacciones de spending Plutus V3.

### Evidencia: El JSON de la Transacción

```json
{
  "inputs": [{
    "type": "Script",
    "txIn": { ... },
    "scriptTxIn": {
      "scriptSource": {
        "type": "Provided",
        "script": { "code": "...", "version": "V3" }
      },
      "datumSource": { "type": "Inline", ... },
      "redeemer": {
        "data": { "type": "Mesh", "content": { "alternative": 0, "fields": [] }},
        "exUnits": { "mem": 7000000, "steps": 3000000000 }
      }
    }
  }],
  "outputs": [{
    "address": "addr_test1wz40a7a86rdmk9kcknz5dvq867wp6xt2ws6p32ke3frrqsq9xwxnm",
    "amount": [ ... ],
    "datum": {
      "type": "Inline",
      "data": {
        "type": "Mesh",
        "content": {
          "alternative": 0,
          "fields": [
            "ESP32_001",
            235,           // ← NÚMEROS CORRECTOS
            652,           // ← NÚMEROS CORRECTOS
            1767909728729, // ← NÚMEROS CORRECTOS
            {"bytes": "d383d5a5..."}, // ← BYTES CORRECTOS
            {"bytes": "2f651ade..."}  // ← BYTES CORRECTOS
          ]
        }
      }
    }
  }],
  "fee": "0",
  "network": "mainnet",  // ← INCORRECTO (debería ser preprod)
  ...
}
```

**Problema detectado:** MeshJS dice `"network": "mainnet"` cuando debería ser preprod (networkId: 0).

---

## Tipos de Datos Alternativos

### Opción 1: Usar Bytes para todos los números

**Descripción:** Convertir Int a ByteArray manualmente.

```aiken
pub type SensorData {
  sensor_id: ByteArray,
  temperature: ByteArray,    // [0, 0, 0, 0, 0, 0, 0, 235] (8 bytes)
  humidity: ByteArray,       // [0, 0, 0, 0, 0, 0, 2, 140] (8 bytes)
  timestamp: ByteArray,      // [0, 0, 1, 155, ...] (8 bytes)
  signature: ByteArray,
  public_key: ByteArray,
}
```

**Ventajas:**
- MeshJS maneja ByteArray con `byteString()` sin problemas
- No hay conversión BigInt problemática

**Desventajas:**
- ❌ Más complejo de validar on-chain (no se puede hacer comparaciones numéricas directas)
- ❌ Necesita reescribir el validador completo
- ❌ Más gas units para operaciones
- ❌ **No resuelve el problema raíz** - El error también ocurre sin outputs

**Recomendación:** ❌ NO implementar - No resuelve el problema y añade complejidad innecesaria

---

### Opción 2: Usar listas de bytes en lugar de strings

**Descripción:** Convertir sensor_id a ByteArray numérico.

```aiken
pub type SensorData {
  sensor_id: List<Int>,      // [69, 83, 80, 51, 50, ...] (UTF-8 codes)
  temperature: Int,
  humidity: Int,
  timestamp: Int,
  signature: ByteArray,
  public_key: ByteArray,
}
```

**Ventajas:**
- Evita problemas con strings UTF-8

**Desventajas:**
- ❌ sensor_id ya funciona como ByteArray
- ❌ No resuelve el problema de spending
- ❌ Más complejo sin beneficio

**Recomendación:** ❌ NO implementar

---

### Opción 3: Simplificar a solo datos esenciales

**Descripción:** Remover campos no críticos.

```aiken
pub type SensorData {
  timestamp: Int,
  signature: ByteArray,
  public_key: ByteArray,
}
```

**Ventajas:**
- Menos campos = menos complejidad

**Desventajas:**
- ❌ Perdemos temperatura y humedad (datos principales del proyecto)
- ❌ **El error también ocurre con Delete redeemer (sin datum nuevo)**
- ❌ No resuelve el problema

**Recomendación:** ❌ NO implementar - Los datos son necesarios

---

## Root Cause Analysis

### El Problema Real

**No son los datos del datum.** La evidencia muestra:

1. ✅ Mismo datum funciona en `create_oracle.ts`
2. ✅ Los campos se serializan correctamente en JSON
3. ✅ Los números son válidos (235, 652, timestamp)
4. ❌ **Falla específicamente en spending de scripts Plutus V3**
5. ❌ **Falla incluso sin crear outputs (solo consume)**

### Comparación: Create vs Update

| Aspecto | Create Oracle (✅ Funciona) | Update Oracle (❌ Falla) |
|---------|---------------------------|--------------------------|
| **Acción** | `txOut()` a script address | `spendingPlutusScriptV3()` + `txIn()` |
| **Datum** | Mismo schema | Mismo schema |
| **Números** | 235, 652, timestamp | 235, 652, timestamp |
| **MeshJS config** | `fetcher` only | `fetcher` + `submitter` + `evaluator` |
| **Fase de error** | N/A | `computeMinimumCost` durante `.complete()` |
| **Network detection** | Correcto (preprod) | Incorrecto (mainnet en JSON) |

### Causa Probable

**MeshJS beta 1.9.0-beta.90 tiene un bug en:**
1. Detección de red para spending scripts
2. Serialización de transaction body para evaluación de redeemers
3. Comunicación con Blockfrost evaluator API para Plutus V3

El error `"Cannot convert undefined to a BigInt"` sugiere que MeshJS está intentando serializar un campo que debería existir pero está `undefined` durante la evaluación de execution units.

**Posibles campos `undefined`:**
- Protocol parameters (min fee, execution unit prices)
- Network ID interno
- Collateral return output calculations
- Script ref calculations

---

## Intentos de Solución

### 1. Validación de Datos ❌

```typescript
// oracle-submission.service.ts
if (!measurement.temperature || !measurement.humidity || !measurement.timestamp) {
  // Skip measurement
}
```

**Resultado:** Los datos eran válidos, no resolvió

---

### 2. Conversión Explícita a Number ❌

```typescript
const newDatum = mConStr0([
    sensorData.sensor_id,
    Number(sensorData.temperature),  // Forzar Number
    Number(sensorData.humidity),
    Number(sensorData.timestamp),
    byteString(sensorData.signature),
    byteString(sensorData.public_key)
]);
```

**Resultado:** Los números ya eran válidos, no resolvió

---

### 3. Remover evaluator/submitter ❌

```typescript
// Intentamos configurar como create_oracle.ts
const txBuilder = new MeshTxBuilder({
    fetcher: blockchainProvider,
    // SIN evaluator, SIN submitter
    verbose: true
});
```

**Resultado:** Mismo error

---

### 4. Agregar evaluator explícito ❌

```typescript
const txBuilder = new MeshTxBuilder({
    fetcher: blockchainProvider,
    submitter: blockchainProvider,
    evaluator: blockchainProvider,  // ← Agregar
    verbose: false
});
```

**Resultado:** Mismo error

---

### 5. Agregar Validity Range ❌

```typescript
const invalidBefore = Date.now() - 60000;
const invalidAfter = Date.now() + 300000;

txBuilder
    // ...
    .invalidBefore(invalidBefore)
    .invalidHereafter(invalidAfter)
    // ...
```

**Resultado:** Mismo error

---

### 6. Filtrar Collateral de UTXOs ❌

```typescript
const utxos = allUtxos.filter(utxo =>
    !(utxo.input.txHash === collateral[0].input.txHash &&
      utxo.input.outputIndex === collateral[0].input.outputIndex)
);
```

**Resultado:** Mismo error

---

### 7. Test con Delete Redeemer (sin outputs) ❌

```typescript
// Consumir sin crear nuevos outputs
const redeemer = { "constructor": 1, "fields": [] }; // Delete

txBuilder
    .spendingPlutusScriptV3()
    .txIn(...)
    .txInScript(oracleScript.code)
    .txInRedeemerValue(redeemer)
    .txInCollateral(...)
    // NO .txOut() - solo consumir
    .changeAddress(walletAddr)
    .selectUtxosFrom(utxos)
    .complete();
```

**Resultado:** Mismo error (`Error serializing inputs` en lugar de outputs)

---

### 8. Intentar con Lucid Evolution ⏸️

```typescript
import { Lucid, Blockfrost } from "@lucid-evolution/lucid";
```

**Resultado:** API completamente diferente, requiere migración completa del código

---

## Workarounds Posibles

### Workaround 1: Actualización Manual con cardano-cli

**Descripción:** Construir transacciones manualmente con cardano-cli.

**Pasos:**
1. Construir transaction body manualmente
2. Calcular execution units con `cardano-cli transaction build --testnet-magic 1`
3. Firmar y enviar

**Ventajas:**
- ✅ Herramienta oficial, estable
- ✅ Control total sobre la transacción

**Desventajas:**
- ❌ Muy manual, no escalable
- ❌ Requiere cardano-node running localmente
- ❌ Difícil de integrar en auto-submission

---

### Workaround 2: Migrar a Lucid Evolution

**Descripción:** Reescribir toda la lógica de transacciones con Lucid Evolution.

**Archivos a migrar:**
- `create_oracle.ts` (funciona con MeshJS, pero migrar para consistencia)
- `update_oracle.ts` ← Crítico
- `mint_sensor_nft.ts`
- `oracle-submission.service.ts` (llamadas a update_oracle)

**Estimación:** 2-3 días de trabajo

**Ventajas:**
- ✅ Lucid es más maduro y estable
- ✅ Mejor soporte para Plutus V3
- ✅ API más limpia

**Desventajas:**
- ❌ Tiempo de desarrollo significativo
- ❌ Necesita testing exhaustivo
- ❌ Dos bibliotecas en paralelo (MeshJS para frontend, Lucid para backend)

---

### Workaround 3: Esperar MeshJS Stable

**Descripción:** Seguir usando MeshJS pero esperar a versión estable (no beta).

**Timeline:** Desconocido (actualmente en v1.9.0-beta.90)

**Ventajas:**
- ✅ El resto del sistema funciona perfectamente
- ✅ No requiere cambios de código
- ✅ Fix oficial del problema

**Desventajas:**
- ❌ Actualizaciones del oráculo bloqueadas temporalmente
- ❌ No hay timeline claro para release stable

---

### Workaround 4: Actualizaciones Manuales Periódicas

**Descripción:** Hacer actualizaciones del oráculo manualmente cuando sea necesario.

**Proceso:**
1. Sistema offchain almacena mediciones en BD
2. Operador ejecuta script manual periódicamente (diario/semanal)
3. Script toma última medición válida y actualiza oráculo

**Ventajas:**
- ✅ Simple de implementar
- ✅ Sistema offchain sigue funcionando
- ✅ Datos no se pierden (están en BD)

**Desventajas:**
- ❌ No es tiempo real
- ❌ Requiere intervención manual

---

## Recomendación Final

### Corto Plazo (Inmediato)

**Opción recomendada:** Workaround 4 - Actualizaciones Manuales Periódicas

**Razones:**
1. El sistema offchain está 100% funcional
2. Las mediciones se almacenan correctamente en BD
3. No perdemos datos
4. Podemos actualizar el oráculo cuando sea necesario (demo, testing)
5. Es el camino de menor riesgo

**Implementación:**
```bash
# Cuando sea necesario actualizar el oráculo:
npm run db:status           # Ver mediciones pendientes
# Usar script manual o cardano-cli para actualización
```

---

### Medio Plazo (1-2 semanas)

**Opción recomendada:** Workaround 2 - Migrar a Lucid Evolution

**Razones:**
1. Lucid es más estable para Plutus V3
2. Inversión de tiempo se justifica para producción
3. Mejor soporte a largo plazo
4. Mayor control sobre transacciones

**Plan de migración:**
1. Semana 1: Migrar `update_oracle.ts` a Lucid
2. Semana 2: Testing exhaustivo + integrar con auto-submission
3. Mantener MeshJS para frontend (dashboard)

---

### Largo Plazo (Producción)

**Opciones:**
1. **Si MeshJS lanza stable antes:** Actualizar a versión stable
2. **Si no:** Mantener Lucid Evolution para backend, MeshJS para frontend

**Arquitectura recomendada:**
```
Frontend (React/Next.js) → MeshJS (queries, wallet connection)
Backend (Express) → Lucid Evolution (transacciones on-chain)
```

---

## Logs de Debug

### Transacción JSON Completa (antes de .complete())

```json
{
  "inputs": [{
    "type": "Script",
    "txIn": {
      "txHash": "c79f01469c32168d3b9fa1bc0e1059f2b26dc62132bb29deed14709318ad2b55",
      "txIndex": 0,
      "amount": [
        {"unit": "lovelace", "quantity": "2000000"},
        {"unit": "a2f69dc8b380bbcf6b79d3e3b26097423c981df0bce0bd44d1e75de953454e534f525f45535033325f544553545f3030315f5632", "quantity": "1"}
      ],
      "address": "addr_test1wz40a7a86rdmk9kcknz5dvq867wp6xt2ws6p32ke3frrqsq9xwxnm"
    },
    "scriptTxIn": {
      "scriptSource": {
        "type": "Provided",
        "script": {
          "code": "5904f95904f6...",
          "version": "V3"
        }
      },
      "datumSource": {
        "type": "Inline",
        "txHash": "c79f01469c32168d3b9fa1bc0e1059f2b26dc62132bb29deed14709318ad2b55",
        "txIndex": 0
      },
      "redeemer": {
        "data": {
          "type": "Mesh",
          "content": {"alternative": 0, "fields": []}
        },
        "exUnits": {"mem": 7000000, "steps": 3000000000}
      }
    }
  }],
  "outputs": [{
    "address": "addr_test1wz40a7a86rdmk9kcknz5dvq867wp6xt2ws6p32ke3frrqsq9xwxnm",
    "amount": [
      {"unit": "lovelace", "quantity": "2000000"},
      {"unit": "a2f69dc8b380bbcf6b79d3e3b26097423c981df0bce0bd44d1e75de953454e534f525f45535033325f544553545f3030315f5632", "quantity": "1"}
    ],
    "datum": {
      "type": "Inline",
      "data": {
        "type": "Mesh",
        "content": {
          "alternative": 0,
          "fields": [
            "ESP32_001",
            235,
            652,
            1767909728729,
            {"bytes": "d383d5a53f9391231cdf65994daf6aaf82aa45fc6f6377fc2427f7503beff0eb5bc3cd5c1affbab72d6bdbfb093b900a2d4ef22017c0abda3c50c820ce21b502"},
            {"bytes": "2f651ade893fa95ea4bfeaa88ad04092e4e54ea08ecf3cbc7abfdb8e8be2ea40"}
          ]
        }
      }
    }
  }],
  "fee": "0",
  "collaterals": [{
    "type": "PubKey",
    "txIn": {
      "txHash": "60ed9dd90113cf997f34c596d193c1235f084879b1553ed2d8823a17ebc6d0d0",
      "txIndex": 0,
      "amount": [{"unit": "lovelace", "quantity": "5000000"}],
      "address": "addr_test1qq593ax2gt8v067lzfv88pyq68ktw8ev6vhms2k6j6tn04gy2uju6d48jgceuwrjnllz8h7kf5tw59dvksj85m99sw9s28kkd7"
    }
  }],
  "requiredSignatures": ["2858f4ca42cec7ebdf1258738480d1ecb71f2cd32fb82ada969737d5"],
  "referenceInputs": [],
  "mints": [],
  "changeAddress": "addr_test1qq593ax2gt8v067lzfv88pyq68ktw8ev6vhms2k6j6tn04gy2uju6d48jgceuwrjnllz8h7kf5tw59dvksj85m99sw9s28kkd7",
  "metadata": {},
  "scriptMetadata": [],
  "validityRange": {},
  "certificates": [],
  "withdrawals": [],
  "votes": [],
  "proposals": [],
  "signingKey": [],
  "chainedTxs": [],
  "inputsForEvaluation": {},
  "network": "mainnet",  // ← PROBLEMA: Debería ser "preprod"
  "expectedNumberKeyWitnesses": 0,
  "expectedByronAddressWitnesses": []
}
```

### Stack Trace Completo

```
Error: Evaluate redeemers failed: Error serializing outputs: Cannot convert undefined to a BigInt
    at Object.computeMinimumCost (file:///home/mtrapaglia/projects/esp32_sign/full_stack/node_modules/@meshsdk/transaction/dist/index.js:4107:19)
    at process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    at async computeMinimumCost (file:///home/mtrapaglia/projects/esp32_sign/full_stack/node_modules/@meshsdk/transaction/dist/index.js:1387:19)
    at async computeChangeAndAdjustForFee (/home/mtrapaglia/projects/esp32_sign/full_stack/node_modules/@cardano-sdk/input-selection/src/RoundRobinRandomImprove/change.ts:447:26)
    at async Object.select (/home/mtrapaglia/projects/esp32_sign/full_stack/node_modules/@cardano-sdk/input-selection/src/RoundRobinRandomImprove/index.ts:49:20)
    at async CardanoSdkInputSelector.select (file:///home/mtrapaglia/projects/esp32_sign/full_stack/node_modules/@meshsdk/transaction/dist/index.js:1459:26)
    at async _MeshTxBuilder.selectUtxos (file:///home/mtrapaglia/projects/esp32_sign/full_stack/node_modules/@meshsdk/transaction/dist/index.js:4144:12)
    at async _MeshTxBuilder.complete (file:///home/mtrapaglia/projects/esp32_sign/full_stack/node_modules/@meshsdk/transaction/dist/index.js:4069:25)
    at async updateOracle (/home/mtrapaglia/projects/esp32_sign/full_stack/offchain/transactions/update_oracle.ts:233:24)
    at async OracleSubmissionService.submitMeasurement (/home/mtrapaglia/projects/esp32_sign/full_stack/offchain/backend/services/oracle-submission.service.ts:163:24)
```

---

## Referencias

- **Oráculo creado exitosamente:** `c79f01469c32168d3b9fa1bc0e1059f2b26dc62132bb29deed14709318ad2b55`
- **Explorer:** https://preprod.cardanoscan.io/transaction/c79f01469c32168d3b9fa1bc0e1059f2b26dc62132bb29deed14709318ad2b55
- **Script Address:** `addr_test1wz40a7a86rdmk9kcknz5dvq867wp6xt2ws6p32ke3frrqsq9xwxnm`
- **MeshJS Version:** 1.9.0-beta.90
- **Network:** Cardano Preprod Testnet

---

## Conclusión

**El problema NO es con los tipos de datos del datum.** Los mismos tipos funcionan perfectamente en `create_oracle.ts`. El problema es específico de MeshJS beta al hacer spending de scripts Plutus V3.

**Tipos de datos alternativos NO resolverían el problema** porque:
1. Los datos actuales son correctos (evidencia: create funciona)
2. El error persiste incluso sin crear outputs
3. Es un bug interno de serialización en MeshJS

**Solución inmediata:** Actualizaciones manuales periódicas (sistema offchain sigue funcionando).

**Solución definitiva:** Migrar a Lucid Evolution para transacciones on-chain o esperar MeshJS stable.
