# Plan de Migración: MeshJS → Lucid Evolution para Oracle Updates

**Fecha:** 2026-01-09
**Branch:** `feature/lucid-evolution-oracle-update`
**Objetivo:** Migrar la funcionalidad de actualización de oráculos de MeshJS a Lucid Evolution para solucionar el bug de Plutus V3 spending.

---

## 📊 Resumen Ejecutivo

### Problema
MeshJS v1.9.0-beta.90 tiene un bug crítico que impide gastar de scripts Plutus V3:
```
Error: Cannot convert undefined to a BigInt
```

### Solución
Migrar SOLAMENTE la funcionalidad de **update** (spending) a Lucid Evolution, manteniendo MeshJS para todo lo demás.

### Alcance
- ✅ **SE MIGRA:** Oracle update (spending de Plutus V3)
- ❌ **NO SE MIGRA:** Oracle create, frontend, backend, otros scripts

---

## 🎯 Estado Actual del Sistema

### ✅ Lo que Funciona (con MeshJS)

1. **Hardware (ESP32)**
   - Generación de firmas Ed25519
   - Envío de datos al backend

2. **Backend (Express)**
   - API REST puerto 3001
   - Validación de firmas Ed25519
   - Almacenamiento en PostgreSQL

3. **Frontend (Next.js)**
   - Dashboard en puerto 3000
   - Visualización de métricas
   - Auto-refresh cada 5 segundos

4. **Smart Contracts (Aiken)**
   - Validador Plutus V3 compilado
   - sensor_oracle_ed25519.ak funcional

5. **Transacciones MeshJS**
   - ✅ **create_oracle.ts:** Crear oráculos (txOut a Plutus V3)
   - ✅ **mint_sensor_nft.ts:** Mintear NFTs
   - ✅ **delete_oracle.ts:** Eliminar oráculos (si funciona)

### ❌ Lo que NO Funciona (con MeshJS)

1. **update_oracle.ts:** Actualizar oráculos (spending de Plutus V3)
   - Error: "Cannot convert undefined to a BigInt"
   - Bloquea toda la funcionalidad de actualización
   - Bug confirmado en MeshJS beta.90

---

## 🔄 Estrategia de Migración: Híbrida

### Por qué NO migrar todo

**Razones para mantener MeshJS:**
1. **Frontend funciona bien:** MeshJS tiene excelente integración con React/Next.js
2. **Create funciona:** No hay razón para cambiar algo que funciona
3. **Menos trabajo:** Solo migrar lo que está roto
4. **Menor riesgo:** Cambios mínimos = menos bugs potenciales

### Arquitectura Híbrida

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (Next.js)                      │
│                   MeshJS (sin cambios)                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    Backend (Express)                        │
│          Recibe y valida mediciones (sin cambios)           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   Transacciones Cardano                     │
│                                                             │
│  MeshJS:                    Lucid Evolution:                │
│  ✅ create_oracle.ts        ✅ update_oracle_lucid.ts       │
│  ✅ mint_sensor_nft.ts         (NUEVO)                      │
│  ✅ delete_oracle.ts                                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 📦 Diferencias: MeshJS vs Lucid Evolution

### API Comparison

| Operación | MeshJS | Lucid Evolution |
|-----------|--------|----------------|
| **Inicialización** | `new BlockfrostProvider()` + `MeshWallet()` | `await Lucid(new Blockfrost(...))` |
| **Cargar wallet** | `MeshWallet({ key: { type: "root", bech32 } })` | `lucid.selectWalletFromPrivateKey(privateKey)` |
| **Datum** | `mConStr0([fields])` | `Data.to({ fields }, Schema)` |
| **Redeemer** | `mConStr0([])` | `Data.to(new Constr(0, []))` |
| **Script** | `{ code: "...", version: "V3" }` | `{ type: "PlutusV3", script: "..." }` |
| **Spending** | `.spendingPlutusScriptV3().txIn()` | `.collectFrom([utxo], redeemer)` |
| **Attach script** | `.txInScript(code)` | `.attach.SpendingValidator(validator)` |
| **Complete** | `.complete()` | `.complete()` |

### Ventajas de Lucid Evolution

1. **✅ Plutus V3 funciona:** Sin bugs de BigInt
2. **✅ API más limpia:** Menos verbosa
3. **✅ Mejor tipado:** TypeScript más estricto
4. **✅ Activamente mantenido:** Por Anastasia Labs
5. **✅ Documentación clara:** Ejemplos actualizados

### Desventajas

1. **❌ API diferente:** Requiere reescribir código
2. **❌ Curva de aprendizaje:** Nueva sintaxis
3. **❌ Menos ejemplos:** Comunidad más pequeña que MeshJS

---

## 📋 Plan de Implementación

### Fase 1: Preparación (1-2 horas)

#### 1.1 Verificar dependencias

```bash
# Ya instalado
@lucid-evolution/lucid: ^0.4.29

# Verificar versión
npm list @lucid-evolution/lucid
```

#### 1.2 Estudiar API de Lucid Evolution

**Recursos:**
- Documentación oficial: https://anastasia-labs.github.io/lucid-evolution/
- Ejemplos de spending: https://anastasia-labs.github.io/lucid-evolution/documentation/deep-dives/validator-interactions/overview
- GitHub: https://github.com/Anastasia-Labs/lucid-evolution

**Conceptos clave a entender:**
- `Data.to()` y `Data.from()` para serialización
- `Data.Object()` y `Data.Tuple()` para schemas
- `.collectFrom()` para spending
- `.attach.SpendingValidator()` para scripts

#### 1.3 Crear archivo de tipos

**Crear:** `offchain/transactions/types_lucid.ts`

```typescript
// Schemas de datos para Lucid Evolution
import { Data } from "@lucid-evolution/lucid";

// Schema para SensorData
export const SensorDataSchema = Data.Object({
    sensor_id: Data.Bytes(),
    temperature: Data.Integer(),
    humidity: Data.Integer(),
    timestamp: Data.Integer(),
    signature: Data.Bytes(),
    public_key: Data.Bytes()
});

export type SensorData = Data.Static<typeof SensorDataSchema>;

// Schema para OracleParams (AssetClass + operator)
export const OracleParamsSchema = Data.Tuple([
    Data.Object({
        fields: Data.Tuple([Data.Bytes(), Data.Bytes()])
    }),
    Data.Bytes()
]);

// Redeemers
export const OracleRedeemer = {
    Update: () => Data.to(new Data.Constr(0, [])),
    Delete: () => Data.to(new Data.Constr(1, []))
};
```

---

### Fase 2: Implementación del Update (3-4 horas)

#### 2.1 Completar `update_oracle_lucid.ts`

**Archivo:** `offchain/transactions/update_oracle_lucid.ts` (ya existe borrador)

**Estructura del archivo:**

```typescript
#!/usr/bin/env tsx

import { Blockfrost, Lucid, Data, applyParamsToScript, Constr } from "@lucid-evolution/lucid";
import { readFileSync } from "fs";
import { resolve } from "path";
import dotenv from "dotenv";
import crypto from "crypto";
import nacl from "tweetnacl";
import { SensorDataSchema, OracleRedeemer } from "./types_lucid";

dotenv.config();

// Funciones principales:
// 1. buildMessage() - Construir mensaje para firma Ed25519
// 2. generateSignedSensorData() - Generar datos de sensor con firma
// 3. main() - Función principal de actualización
```

**Pasos de implementación:**

1. **Inicializar Lucid**
```typescript
const lucid = await Lucid(
    new Blockfrost(
        "https://cardano-preprod.blockfrost.io/api/v0",
        process.env.BLOCKFROST_API_KEY || ""
    ),
    "Preprod"
);
```

2. **Cargar wallet**
```typescript
// Convertir root key de MeshJS a formato Lucid
const { C } = await import("@lucid-evolution/lucid");
const rootKey = C.Bip32PrivateKey.from_bech32(meshPrivateKey);
const harden = (num: number) => 0x80000000 + num;
const accountKey = rootKey
    .derive(harden(1852))
    .derive(harden(1815))
    .derive(harden(0));
const paymentKey = accountKey.derive(0).derive(0).to_raw_key();
const paymentKeyBech32 = paymentKey.to_bech32();

lucid.selectWalletFromPrivateKey(paymentKeyBech32);
```

3. **Cargar y aplicar parámetros al script**
```typescript
const plutusJsonPath = resolve(process.cwd(), "onchain/sensors-oracle/plutus.json");
const plutusJson = JSON.parse(readFileSync(plutusJsonPath, "utf-8"));
const oracleValidator = plutusJson.validators.find((v: any) =>
    v.title === "sensor_oracle_ed25519.sensor_oracle_ed25519.spend"
);

const paramsData = Data.to(new Constr(0, [
    new Constr(0, [nftPolicyId, nftAssetName]),
    operatorPubKeyHash
]));

const oracleScript = applyParamsToScript(oracleValidator.compiledCode, [paramsData]);
```

4. **Encontrar oracle UTXO**
```typescript
const scriptUtxos = await lucid.utxosAt(oracleScriptAddr);
const nftUnit = `${nftPolicyId}${nftAssetName}`;

const oracleUtxo = scriptUtxos.find(utxo =>
    utxo.assets[nftUnit] === BigInt(1)
);
```

5. **Generar datos de sensor con firma Ed25519**
```typescript
const sensorData = {
    sensor_id: "ESP32_001",
    temperature: 235,
    humidity: 652,
    timestamp: Date.now()
};

const message = buildMessage(sensorData);
const messageHash = crypto.createHash('sha256').update(message).digest();
const keyPair = nacl.sign.keyPair();
const signature = nacl.sign.detached(messageHash, keyPair.secretKey);
```

6. **Construir nuevo datum**
```typescript
const newDatum = Data.to({
    sensor_id: Buffer.from(sensorData.sensor_id, 'utf8').toString('hex'),
    temperature: BigInt(sensorData.temperature),
    humidity: BigInt(sensorData.humidity),
    timestamp: BigInt(sensorData.timestamp),
    signature: Buffer.from(signature).toString('hex'),
    public_key: Buffer.from(keyPair.publicKey).toString('hex')
}, SensorDataSchema);
```

7. **Construir redeemer**
```typescript
const redeemer = OracleRedeemer.Update();
```

8. **Construir y enviar transacción**
```typescript
const tx = await lucid
    .newTx()
    .collectFrom([oracleUtxo], redeemer)
    .attachSpendingValidator({
        type: "PlutusV3",
        script: oracleScript
    })
    .payToContract(oracleScriptAddr, { inline: newDatum }, {
        lovelace: BigInt(2000000),
        [nftUnit]: BigInt(1)
    })
    .addSignerKey(operatorPubKeyHash)
    .complete();

const signedTx = await tx.sign().complete();
const txHash = await signedTx.submit();

console.log(`✅ Transaction submitted: ${txHash}`);
console.log(`Explorer: https://preprod.cardanoscan.io/transaction/${txHash}`);
```

#### 2.2 Agregar script al package.json

```json
{
  "scripts": {
    "oracle:update:lucid": "tsx offchain/transactions/update_oracle_lucid.ts"
  }
}
```

---

### Fase 3: Testing (2-3 horas)

#### 3.1 Tests unitarios de funciones auxiliares

**Crear:** `offchain/transactions/__tests__/update_oracle_lucid.test.ts`

```typescript
import { describe, test, expect } from 'vitest';
import { buildMessage, generateSignedSensorData } from '../update_oracle_lucid';

describe('buildMessage', () => {
    test('construye mensaje en orden alfabético', () => {
        const data = {
            sensor_id: "TEST_001",
            temperature: 235,
            humidity: 652,
            timestamp: 1736000000000
        };

        const message = buildMessage(data);

        // Verificar que el mensaje tiene el tamaño correcto
        expect(message.length).toBe(8 + 8 + 8 + 8); // 4 campos de 8 bytes

        // Verificar orden: humidity || sensor_id || temperature || timestamp
        // ... más assertions
    });
});

describe('generateSignedSensorData', () => {
    test('genera firma Ed25519 válida', () => {
        const data = generateSignedSensorData("TEST_001", 235, 652, Date.now());

        expect(data.sensor_id).toBe("TEST_001");
        expect(data.temperature).toBe(235);
        expect(data.humidity).toBe(652);
        expect(data.signature.length).toBe(128); // 64 bytes = 128 hex chars
        expect(data.public_key.length).toBe(64); // 32 bytes = 64 hex chars
    });
});
```

#### 3.2 Test de integración local

**Prueba 1: Update oracle existente**

```bash
# Verificar que el oracle existe
npm run db:status

# Ejecutar update con Lucid
npm run oracle:update:lucid -- \
  a2f69dc8b380bbcf6b79d3e3b26097423c981df0bce0bd44d1e75de9 \
  SENSOR_ESP32_TEST_001_V2 \
  1

# Verificar en explorer
# https://preprod.cardanoscan.io/transaction/[TX_HASH]
```

**Prueba 2: Múltiples updates consecutivos**

```bash
# 3 updates con delay de 30s entre cada uno
npm run oracle:update:lucid -- \
  a2f69dc8b380bbcf6b79d3e3b26097423c981df0bce0bd44d1e75de9 \
  SENSOR_ESP32_TEST_001_V2 \
  3
```

#### 3.3 Verificación on-chain

**Checklist de verificación:**

- [ ] Transacción confirmada en blockchain
- [ ] Oracle UTXO tiene nuevo datum
- [ ] NFT sigue en el oracle UTXO
- [ ] ADA locked sigue siendo 2 ADA
- [ ] Datum contiene datos del sensor correctos
- [ ] Firma Ed25519 es válida
- [ ] Timestamp es reciente
- [ ] Rangos de temperatura/humedad son válidos

**Script de verificación:**

```bash
# Verificar último datum del oracle
npm run db:status

# Ver transacción en explorer
echo "Check: https://preprod.cardanoscan.io/address/addr_test1wz40a7a86rdmk9kcknz5dvq867wp6xt2ws6p32ke3frrqsq9xwxnm"
```

---

### Fase 4: Integración con Auto-Submission (1-2 horas)

#### 4.1 Actualizar servicio de auto-submission

**Archivo:** `offchain/backend/services/oracleSubmissionService.ts`

**Cambios necesarios:**

1. Importar función de Lucid en lugar de MeshJS
```typescript
// ANTES (MeshJS)
import { updateOracle } from '../../transactions/update_oracle';

// DESPUÉS (Lucid)
import { updateOracle } from '../../transactions/update_oracle_lucid';
```

2. La interfaz de parámetros debería ser compatible
```typescript
// Ambas versiones usan el mismo formato
interface UpdateOracleParams {
    blockfrostApiKey: string;
    privateKey: string;
    networkId: number;
    nftPolicyId: string;
    nftAssetName: string;
    sensorData: SensorData;
}
```

3. Verificar que el servicio maneja errores correctamente

#### 4.2 Testing del auto-submission

**Proceso:**
1. Habilitar auto-submission en `.env`
```env
ORACLE_SUBMIT_DELAY_MS=5000  # 5 segundos para testing
```

2. Iniciar backend
```bash
npm run backend:dev
```

3. Enviar mediciones desde ESP32 o script de prueba
```bash
./scripts/test.sh
```

4. Verificar logs del backend
```bash
tail -f /tmp/backend.log
```

5. Verificar que las actualizaciones on-chain funcionan

---

### Fase 5: Documentación (1 hora)

#### 5.1 Actualizar CLAUDE.md

**Sección a agregar:**

```markdown
## Oracle Updates con Lucid Evolution

### Por qué Lucid Evolution para Updates

MeshJS v1.9.0-beta.90 tiene un bug que impide spending de scripts Plutus V3.
Lucid Evolution se usa SOLO para oracle updates (spending). Todo lo demás
sigue usando MeshJS.

### Comandos

```bash
# Update manual con Lucid Evolution
npm run oracle:update:lucid -- <policy_id> <asset_name> [num_updates]

# Update manual con MeshJS (NO FUNCIONA - bug conocido)
npm run oracle:update -- <policy_id> <asset_name> [num_updates]
```

### Arquitectura Híbrida

- MeshJS: create, mint, delete, frontend
- Lucid Evolution: update (spending)
```

#### 5.2 Actualizar PROJECT_STATUS.md

**Cambios:**

```markdown
## ✅ Oracle On-Chain - FUNCIONAL

**Estado:** Completamente operativo con Lucid Evolution

**Oráculo actual:**
- ✅ **Creado:** TX `c79f014...` (MeshJS)
- ✅ **Actualizaciones:** Funcionando con Lucid Evolution
- ✅ **NFT:** Presente y verificado
- ✅ **Auto-submission:** Operativo

### Solución al Bug de MeshJS

**Problema resuelto:** MeshJS beta.90 tenía bug con Plutus V3 spending
**Solución:** Migración a Lucid Evolution para updates
**Estado:** ✅ Producción

**Documentación:**
- Plan de migración: `docs/MIGRATION_PLAN_LUCID_EVOLUTION.md`
- Bug report: `docs/MESHJS_BUG_REPORT.txt`
```

#### 5.3 Crear README para Lucid Evolution

**Crear:** `offchain/transactions/README_LUCID_EVOLUTION.md`

```markdown
# Lucid Evolution - Oracle Updates

Este directorio contiene scripts que usan Lucid Evolution para
transacciones on-chain, específicamente oracle updates.

## ¿Por qué Lucid Evolution?

MeshJS beta.90 tiene un bug crítico con Plutus V3 spending.
Lucid Evolution funciona correctamente.

## Archivos

- `update_oracle_lucid.ts` - Update oracle con Lucid Evolution
- `types_lucid.ts` - Schemas de datos para Lucid

## Uso

```bash
npm run oracle:update:lucid -- <policy_id> <asset_name> [num]
```

## Diferencias con MeshJS

[... tabla comparativa ...]
```

---

### Fase 6: Cleanup y Optimización (1 hora)

#### 6.1 Remover código obsoleto

**Archivos a limpiar:**

1. `update_oracle.ts` (MeshJS)
   - ❌ NO ELIMINAR (mantener para referencia)
   - ✅ Agregar comentario de deprecación en el header
   ```typescript
   /**
    * @deprecated This file uses MeshJS which has a bug with Plutus V3 spending.
    * Use update_oracle_lucid.ts instead.
    * Kept for reference and to document the bug.
    */
   ```

2. `test_update_manual.ts`
   - ❌ NO ELIMINAR (documenta el bug)
   - ✅ Mover a `docs/bug_reproduction/`

3. `test_oracle_consume.ts`
   - ❌ NO ELIMINAR (documenta el bug)
   - ✅ Mover a `docs/bug_reproduction/`

#### 6.2 Actualizar scripts de testing

**Crear:** `scripts/test_oracle_update_lucid.sh`

```bash
#!/bin/bash
# Test oracle update con Lucid Evolution

set -e

echo "Testing Oracle Update with Lucid Evolution"
echo "=========================================="

# Variables
NFT_POLICY="a2f69dc8b380bbcf6b79d3e3b26097423c981df0bce0bd44d1e75de9"
NFT_ASSET="SENSOR_ESP32_TEST_001_V2"

echo "1. Verificando estado actual..."
npm run db:status

echo -e "\n2. Ejecutando update..."
npm run oracle:update:lucid -- $NFT_POLICY $NFT_ASSET 1

echo -e "\n3. Verificando estado después del update..."
sleep 5
npm run db:status

echo -e "\n✅ Test completado"
```

#### 6.3 Optimizar imports

**Verificar que no hay imports duplicados:**

```bash
# Buscar imports de ambas librerías en el mismo archivo
grep -r "from \"@meshsdk/core\"" offchain/transactions/update_oracle_lucid.ts
# No debería haber resultados

grep -r "from \"@lucid-evolution/lucid\"" offchain/transactions/update_oracle.ts
# No debería haber resultados
```

---

## 🧪 Plan de Testing Completo

### Test Suite 1: Funcionalidad Básica

```bash
# T1.1: Update simple (1 actualización)
npm run oracle:update:lucid -- [policy] [asset] 1

# T1.2: Updates múltiples (3 actualizaciones)
npm run oracle:update:lucid -- [policy] [asset] 3

# T1.3: Verificar datos on-chain
npm run db:status
```

### Test Suite 2: Validación de Datos

**Casos de prueba:**

1. **Firma Ed25519 válida**
   - Generar datos con firma
   - Verificar que la transacción se confirma
   - Verificar datum on-chain

2. **Rangos de temperatura**
   - Temp = -50°C (mínimo)
   - Temp = 100°C (máximo)
   - Temp = 23.5°C (normal)

3. **Rangos de humedad**
   - Hum = 0% (mínimo)
   - Hum = 100% (máximo)
   - Hum = 65.2% (normal)

4. **Timestamps**
   - Timestamp actual
   - Timestamp futuro (debería funcionar)
   - Timestamp pasado antiguo

### Test Suite 3: Casos de Error

**Errores esperados:**

1. **Oracle no existe**
   - Intentar actualizar oracle inexistente
   - Esperar: Error claro

2. **NFT incorrecto**
   - Policy ID incorrecto
   - Esperar: Oracle UTXO not found

3. **Sin fondos**
   - Wallet sin ADA
   - Esperar: Insufficient funds

4. **Sin collateral**
   - Sin UTXOs adecuados para collateral
   - Esperar: No suitable collateral

### Test Suite 4: Auto-Submission

```bash
# T4.1: Auto-submission habilitado
# 1. Configurar ORACLE_SUBMIT_DELAY_MS=5000
# 2. Iniciar backend
# 3. Enviar mediciones
# 4. Verificar que se crean transacciones automáticamente

# T4.2: Auto-submission con errores
# 1. Provocar error en transacción
# 2. Verificar que el error se loguea
# 3. Verificar que el servicio sigue funcionando
```

### Test Suite 5: Integración End-to-End

```bash
# T5.1: Flujo completo
# 1. ESP32 envía medición
# 2. Backend valida y almacena
# 3. Auto-submission crea transacción Lucid
# 4. Transacción se confirma on-chain
# 5. Frontend muestra nueva medición

# Verificar:
- Medición en DB
- Transacción en blockchain
- Dashboard actualizado
```

---

## 📊 Métricas de Éxito

### Criterios de Aceptación

1. **Funcionalidad**
   - [ ] Oracle update funciona con Lucid Evolution
   - [ ] Auto-submission funciona correctamente
   - [ ] No hay regresiones en otras funcionalidades

2. **Performance**
   - [ ] Tiempo de construcción de TX < 5 segundos
   - [ ] Tiempo de confirmación < 60 segundos
   - [ ] Fees < 1 ADA por update

3. **Confiabilidad**
   - [ ] 100% de éxito en 10 updates consecutivos
   - [ ] Recovery automático de errores transitorios
   - [ ] Logs claros de errores

4. **Documentación**
   - [ ] README actualizado
   - [ ] CLAUDE.md actualizado
   - [ ] Plan de migración documentado
   - [ ] Ejemplos de uso claros

---

## 🚨 Riesgos y Mitigaciones

### Riesgo 1: API de Lucid Evolution cambia

**Probabilidad:** Media
**Impacto:** Alto

**Mitigación:**
- Fijar versión exacta en package.json: `"@lucid-evolution/lucid": "0.4.29"`
- No usar `^` (caret) que permitiría updates automáticos
- Documentar versión usada

### Riesgo 2: Incompatibilidad con scripts existentes

**Probabilidad:** Baja
**Impacto:** Alto

**Mitigación:**
- Mantener MeshJS para create/mint/delete
- Solo migrar update
- Testing exhaustivo antes de merge

### Riesgo 3: Fees más altos con Lucid

**Probabilidad:** Baja
**Impacto:** Medio

**Mitigación:**
- Medir fees antes y después
- Optimizar collateral si es necesario
- Documentar diferencias

### Riesgo 4: Wallet incompatibilidad

**Probabilidad:** Media
**Impacto:** Medio

**Mitigación:**
- Usar conversión estándar de root key
- Testear derivation path (1852'/1815'/0')
- Verificar que genera mismas addresses

---

## 🔄 Plan de Rollback

Si la migración falla, tenemos estas opciones:

### Opción 1: Revertir a branch main

```bash
git checkout main
npm install
npm run backend:dev
```

**Consecuencia:** Oracle updates siguen sin funcionar (bug MeshJS)

### Opción 2: Updates manuales temporales

```bash
# Ejecutar updates manualmente cuando sea necesario
# (Tedioso pero funcional)
```

### Opción 3: Esperar fix de MeshJS

```bash
# Monitorear releases de MeshJS
# Actualizar cuando salga versión stable con fix
npm install @meshsdk/core@latest
```

---

## 📅 Timeline Estimado

| Fase | Tiempo | Acumulado |
|------|--------|-----------|
| 1. Preparación | 1-2h | 2h |
| 2. Implementación | 3-4h | 6h |
| 3. Testing | 2-3h | 9h |
| 4. Integración | 1-2h | 11h |
| 5. Documentación | 1h | 12h |
| 6. Cleanup | 1h | 13h |

**Total estimado:** 12-13 horas de trabajo

**Distribución recomendada:**
- Día 1 (4h): Fases 1-2 (preparación + implementación)
- Día 2 (4h): Fase 3 (testing exhaustivo)
- Día 3 (4h): Fases 4-6 (integración + docs + cleanup)

---

## ✅ Checklist Pre-Merge

Antes de hacer merge a `main`, verificar:

### Código
- [ ] `update_oracle_lucid.ts` funciona correctamente
- [ ] Todos los tests pasan
- [ ] No hay console.logs olvidados
- [ ] Tipos TypeScript correctos
- [ ] Manejo de errores implementado

### Testing
- [ ] 10 updates consecutivos exitosos
- [ ] Auto-submission funciona
- [ ] Casos de error manejados
- [ ] End-to-end test completado

### Documentación
- [ ] README actualizado
- [ ] CLAUDE.md actualizado
- [ ] PROJECT_STATUS.md actualizado
- [ ] Ejemplos de uso documentados

### Limpieza
- [ ] Código comentado removido
- [ ] Imports optimizados
- [ ] Archivos de bug movidos a docs/
- [ ] package.json actualizado

### Git
- [ ] Commits atómicos y descriptivos
- [ ] Branch actualizado con main
- [ ] Sin conflictos
- [ ] PR creado con descripción clara

---

## 🎯 Conclusión

Esta migración es **quirúrgica y de bajo riesgo**:

**✅ Ventajas:**
- Solo tocamos lo que está roto
- Mantenemos lo que funciona
- Solución probada (Lucid Evolution)
- Documentación completa

**✅ Resultado esperado:**
- Oracle updates funcionando al 100%
- Sistema completo operativo
- Sin regresiones
- Listo para producción

**🚀 Próximos pasos:**
1. Revisar este plan
2. Comenzar Fase 1 (preparación)
3. Implementar paso a paso
4. Testing exhaustivo
5. Merge a main

---

**¿Todo claro? ¿Procedemos con la implementación?**
