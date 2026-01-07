# Migración de MeshJS a Lucid

**Fecha:** 2026-01-06
**Branch:** `experiment/bytearray-fix`
**Estado:** ✅ Solución implementada, lista para pruebas

---

## Resumen Ejecutivo

### Problema Encontrado

MeshJS v1.9.0-beta.90 tiene un **bug fundamental** al serializar transacciones que contienen ByteArrays en datums:

```
Error: Evaluate redeemers failed: Error serializing outputs: Cannot convert undefined to a BigInt
    at Object.computeMinimumCost
```

Este error bloqueaba completamente el sistema de oracle con verificación ECDSA on-chain.

### Solución Implementada

**Migración a Lucid-Cardano**, que:
- ✅ Maneja ByteArrays correctamente sin errores de serialización
- ✅ Es más maduro y estable que MeshJS beta
- ✅ Tiene mejor documentación y soporte
- ✅ Genera CBOR válido para Plutus V2 y V3

---

## Archivos Creados

### Scripts de Lucid

```
offchain/transactions/
  ├── test_ecdsa_onchain_lucid.ts         # Test ECDSA con Lucid (reemplaza versión MeshJS)
  └── utils/
      ├── generate_lucid_wallet.ts         # Genera wallet compatible con Lucid
      └── convert_key.ts                   # Helper para conversión de keys

offchain/transactions/experiments/         # Tests de investigación
  ├── test_meshjs_bytearray_api.ts
  ├── test_transaction_serialization.ts
  ├── test_datum_hash.ts
  ├── test_plutus_v2.ts
  └── test_lucid_bytearray.ts             # ← Prueba que Lucid funciona

docs/
  ├── bytearray-investigation.md          # Documentación completa de la investigación
  └── LUCID_MIGRATION.md                  # Este archivo
```

### NPM Scripts

```json
{
  "test:ecdsa:lucid": "tsx offchain/transactions/test_ecdsa_onchain_lucid.ts",
  "lucid:generate-wallet": "tsx offchain/transactions/utils/generate_lucid_wallet.ts"
}
```

---

## Cómo Continuar

### Paso 1: Generar Wallet de Lucid

```bash
npm run lucid:generate-wallet
```

Esto generará:
- ✅ Seed phrase de 24 palabras
- ✅ Dirección de wallet en Preprod

**Ejemplo de output:**
```
📝 Seed Phrase (24 words):
swift narrow tent broken winner leave also option beef...

📍 Wallet Address:
addr_test1qzr8yam35n72gldjfmuxfk2220c2lj3xa9z0rdwrdu4qxf...
```

### Paso 2: Configurar .env

Agregar al archivo `.env`:

```bash
LUCID_SEED="swift narrow tent broken winner leave also option beef slogan decline hammer such coast memory mouse broken version sail pupil high huge stage drip"
```

**Nota:** Este es solo un ejemplo, usa tu seed phrase generada.

### Paso 3: Obtener Fondos de Testnet

1. Copiar la dirección generada (`addr_test1...`)
2. Ir al faucet de Cardano Preprod:
   - https://docs.cardano.org/cardano-testnet/tools/faucet
   - O: https://faucet.preprod.world.dev.cardano.org
3. Pegar la dirección y solicitar fondos (10-1000 tADA)
4. Esperar confirmación (~1 minuto)

### Paso 4: Probar Script de ECDSA

```bash
npm run test:ecdsa:lucid
```

**Expected output:**
```
============================================================
Testing ECDSA Signature Verification On-Chain (Lucid)
============================================================
  Loading wallet from LUCID_SEED...

📋 Test Configuration:
  Wallet Address: addr_test1...
  Script Address: addr_test1wz...

📊 Sensor Data to Verify:
  Sensor ID: ESP32_001
  Temperature: 23.5 °C
  Humidity: 65.2 %
  ...

🔄 Step 1: Creating UTXO at script address with sensor data...
  ✅ Transaction built successfully
  ✅ Transaction signed
  ✅ UTXO created at script address
  Tx Hash: a1b2c3d4...

🔗 View on explorer:
  https://preprod.cardanoscan.io/transaction/a1b2c3d4...

✨ Done
```

---

## Próximos Pasos Después del Test

### 1. Migrar Script de Oracle

Crear `update_oracle_lucid.ts` basado en `update_oracle.ts`:

**Cambios principales:**

```typescript
// ANTES (MeshJS)
import { MeshWallet, MeshTxBuilder, mConStr0, byteString } from "@meshsdk/core"

const datum = mConStr0([
    sensorData.sensor_id,
    sensorData.temperature,
    sensorData.humidity,
    sensorData.timestamp,
    byteString(sensorData.signature),    // ❌ Falla
    byteString(sensorData.public_key)
])

// DESPUÉS (Lucid)
import { Lucid, Data, fromText } from "lucid-cardano"

const SensorDataSchema = Data.Object({
    sensor_id: Data.Bytes(),
    temperature: Data.Integer(),
    humidity: Data.Integer(),
    timestamp: Data.Integer(),
    signature: Data.Bytes(),              // ✅ Funciona
    public_key: Data.Bytes()
})

const datumData = {
    sensor_id: fromText(sensorData.sensor_id),
    temperature: BigInt(sensorData.temperature),
    humidity: BigInt(sensorData.humidity),
    timestamp: BigInt(sensorData.timestamp),
    signature: sensorData.signature,
    public_key: sensorData.public_key
}

const datum = Data.to(datumData, SensorDataSchema)  // ✅ Funciona
```

### 2. Probar Flujo Completo del Oracle

1. Mint NFT del sensor
2. Crear oracle con NFT y datos iniciales
3. Actualizar oracle con nuevos datos firmados
4. Consumir UTXO para verificar ECDSA on-chain

### 3. Actualizar Documentación

- Actualizar `docs/oracle-usage.md` con ejemplos de Lucid
- Crear guía de migración para otros usuarios
- Documentar diferencias entre MeshJS y Lucid

---

## Comparación Técnica: MeshJS vs Lucid

| Característica | MeshJS v1.9.0-beta.90 | Lucid v0.10.11 |
|----------------|----------------------|----------------|
| **Estabilidad** | Beta | Estable |
| **ByteArrays en Datums** | ❌ Bug de serialización | ✅ Funciona |
| **Formato de Wallet** | bech32 (xprv...) | Seed phrase / hex |
| **API de Datum** | `mConStr0([...])` | `Data.Object({...})` |
| **Type Safety** | Parcial | Completo con `Data.Static` |
| **Documentación** | Limitada | Excelente |
| **Comunidad** | Pequeña | Activa |
| **Plutus V3** | ⚠️ Buggy | ✅ Full support |

---

## Decisión: ¿Mantener MeshJS o Migrar Completamente?

### Opción 1: Migración Completa a Lucid ✅ RECOMENDADO

**Pros:**
- Un solo framework, código más consistente
- Sin bugs conocidos de serialización
- Mejor mantenibilidad a largo plazo
- API más moderna y type-safe

**Cons:**
- Requiere reescribir todos los scripts existentes (~5 archivos)
- Cambio de formato de wallet (una sola vez)

**Estimación:** 2-4 horas de trabajo

### Opción 2: Híbrido (MeshJS + Lucid)

**Pros:**
- No requiere reescribir scripts que funcionan
- Migración gradual

**Cons:**
- Dos dependencias en lugar de una
- Dos formatos de wallet
- Código inconsistente
- Mayor complejidad

### Recomendación: **Opción 1 - Migración Completa**

---

## Checklist de Migración

- [x] Investigar problema de ByteArrays
- [x] Identificar solución (Lucid)
- [x] Crear script de generación de wallet
- [x] Crear test ECDSA con Lucid
- [ ] Generar y fondear wallet de Lucid
- [ ] Probar test ECDSA end-to-end
- [ ] Migrar `mint_sensor_nft.ts` → `mint_sensor_nft_lucid.ts`
- [ ] Migrar `create_oracle.ts` → `create_oracle_lucid.ts`
- [ ] Migrar `update_oracle.ts` → `update_oracle_lucid.ts`
- [ ] Probar flujo completo del oracle
- [ ] Actualizar documentación
- [ ] Merge a main branch

---

## Soporte y Recursos

### Documentación de Lucid

- GitHub: https://github.com/spacebudz/lucid
- Examples: https://github.com/spacebudz/lucid/tree/main/examples
- API Docs: https://lucid.spacebudz.io

### Faucets de Testnet

- Oficial: https://docs.cardano.org/cardano-testnet/tools/faucet
- Preprod: https://faucet.preprod.world.dev.cardano.org
- Preview: https://faucet.preview.world.dev.cardano.org

### Explorers

- Preprod: https://preprod.cardanoscan.io
- Preview: https://preview.cardanoscan.io

---

## Contacto

Para preguntas sobre esta migración, referirse a:
- Documentación completa: `docs/bytearray-investigation.md`
- Branch de trabajo: `experiment/bytearray-fix`
- Commits relevantes: `git log --oneline --graph`
