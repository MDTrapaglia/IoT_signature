# Guía de Uso del Oracle de Sensores

Esta guía explica cómo usar los scripts TypeScript para validar la implementación del contrato `sensor_oracle_verified.ak` en la blockchain de Cardano.

## Arquitectura

El sistema consta de tres componentes principales:

1. **NFT del Sensor** - Un token único que identifica el oracle
2. **Validador Oracle** - Smart contract que valida firmas ECDSA de los datos del sensor
3. **Scripts de Transacciones** - Herramientas para interactuar con el oracle

## Flujo de Trabajo

```
1. Mintear NFT → 2. Crear Oracle → 3. Actualizar Oracle (múltiples veces)
```

## Requisitos Previos

1. Tener configuradas las variables de entorno:
   ```bash
   BLOCKFROST_API_KEY=preprodXXXXXXXXXXXX
   PRIVATE_KEY=xprv...
   ```

2. Tener ADA en la wallet (mínimo 10 ADA para pruebas)

3. Tener collateral configurado en la wallet

## Scripts Disponibles

### 1. Mintear NFT del Sensor

Crea un NFT único que identifica el oracle de un sensor específico.

```bash
npm run oracle:mint-nft -- ESP32_01
```

**Parámetros:**
- `sensor_id` (opcional): ID del sensor (default: "ESP32_01")

**Output:**
```
🔨 Minting Sensor NFT...
  Sensor ID: ESP32_01
  Token Name: SENSOR_ESP32_01
  Policy ID: e659c328b17c189898d2e763c4982a0787ccb1474c096b482ec78594
  UTXO: abc123...#0

✅ NFT Minted Successfully!
  Tx Hash: def456...
  Asset: e659c328...53454e534f525f45535033325f3031

📋 Summary:
  Sensor ID: ESP32_01
  Policy ID: e659c328b17c189898d2e763c4982a0787ccb1474c096b482ec78594
  Asset Name: 53454e534f525f45535033325f3031
  Tx Hash: def456...

ℹ️  Save these values to use when creating the oracle!
```

**Importante:** Guarda el `Policy ID` y `Asset Name` para los siguientes pasos.

---

### 2. Crear Oracle

Inicializa el oracle enviando el NFT a la dirección del script con datos iniciales del sensor.

```bash
npm run oracle:create -- <policy_id> <asset_name>
```

**Parámetros:**
- `policy_id`: Policy ID del NFT (obtenido del paso 1)
- `asset_name`: Asset Name en hex (obtenido del paso 1)

**Ejemplo:**
```bash
npm run oracle:create -- \
  e659c328b17c189898d2e763c4982a0787ccb1474c096b482ec78594 \
  53454e534f525f45535033325f3031
```

**Output:**
```
🏗️  Creating Oracle...
  NFT Policy: e659c328...
  NFT Asset: 53454e534f525f45535033325f3031
  Operator: a1b2c3d4...
  Oracle Address: addr_test1wz...

📊 Initial Sensor Data:
  Sensor ID: ESP32_001
  Temperature: 23.5 °C
  Humidity: 65.2 %
  Timestamp: 2025-01-05T12:00:00.000Z

✅ Oracle Created Successfully!
  Tx Hash: ghi789...
  Script Address: addr_test1wz...

ℹ️  The oracle is now initialized and ready to receive updates!
```

---

### 3. Actualizar Oracle

Actualiza los datos del sensor en el oracle. El contrato valida:
- Rangos de temperatura (-50°C a 100°C)
- Rangos de humedad (0% a 100%)
- Firma ECDSA secp256k1 válida
- Longitudes correctas de firma y clave pública

```bash
npm run oracle:update -- <policy_id> <asset_name> [num_updates]
```

**Parámetros:**
- `policy_id`: Policy ID del NFT
- `asset_name`: Asset Name en hex
- `num_updates` (opcional): Número de actualizaciones (default: 3)

**Ejemplo:**
```bash
npm run oracle:update -- \
  e659c328b17c189898d2e763c4982a0787ccb1474c096b482ec78594 \
  53454e534f525f45535033325f3031 \
  5
```

**Output:**
```
============================================================
Update Sensor Oracle Script
============================================================
Will perform 5 updates

============================================================
Update 1 of 5
============================================================
🔍 Searching for oracle UTXO...
  Address: addr_test1wz...
  NFT: e659c328...53454e534f525f45535033325f3031
  ✓ Found oracle UTXO: abc123...#0

🔄 Updating Oracle...
  Oracle Address: addr_test1wz...
  UTXO: abc123...#0

📊 New Sensor Data:
  Sensor ID: ESP32_001
  Temperature: 24.3 °C
  Humidity: 58.7 %
  Timestamp: 2025-01-05T12:05:00.000Z

✅ Oracle Updated Successfully!
  Tx Hash: jkl012...
  ✓ Update 1 completed: jkl012...

  ⏳ Waiting 30 seconds for confirmation before next update...

============================================================
Update 2 of 5
============================================================
...

📋 Summary:
  Completed 5 updates successfully!

ℹ️  All sensor readings have been validated on-chain with ECDSA signatures!
```

---

## Estructura del Datum (SensorData)

El datum inline del oracle contiene:

```typescript
{
  sensor_id: string,      // "ESP32_001"
  temperature: number,    // 235 (23.5°C * 10)
  humidity: number,       // 652 (65.2% * 10)
  timestamp: number,      // 1735996800000 (milisegundos)
  signature: string,      // "6FA9ADECE1E8BE3CDD..." (64 bytes hex)
  public_key: string      // "D27CBD596D2272C635..." (64 bytes hex)
}
```

## Validaciones On-Chain

El validador `sensor_oracle_verified` verifica:

1. **Transacción firmada por el operador**
   - `tx.extra_signatories` debe incluir el `operator` del `OracleParams`

2. **NFT presente en input y output**
   - El input del oracle debe contener exactamente 1 NFT
   - El output del oracle debe contener exactamente 1 NFT

3. **Rangos válidos de datos del sensor**
   - Temperatura: -500 a 1000 (-50.0°C a 100.0°C)
   - Humedad: 0 a 1000 (0.0% a 100.0%)
   - Timestamp: > 0
   - Firma: 64 bytes
   - Clave pública: 64 bytes
   - Sensor ID: no vacío

4. **Firma ECDSA válida**
   - Construye mensaje: `humidity || sensor_id || temperature || timestamp`
   - Calcula hash: `SHA-256(mensaje)`
   - Verifica: `verify_ecdsa_secp256k1_signature(public_key, hash, signature)`

## Redeemers

- **Update** (Constructor 0): Actualizar datos del sensor
- **Delete** (Constructor 1): Eliminar el oracle

## Pruebas End-to-End

Para probar el flujo completo:

```bash
# 1. Mintear NFT
npm run oracle:mint-nft -- ESP32_TEST

# Copiar policy_id y asset_name del output

# 2. Crear oracle
npm run oracle:create -- <policy_id> <asset_name>

# 3. Actualizar oracle 3 veces
npm run oracle:update -- <policy_id> <asset_name> 3
```

## Datos de Prueba

Los scripts usan datos de prueba reales del archivo `test-data/test_payloads.json`:

- **Public Key**: `D27CBD596D2272C63502D6A186C09D9D8101DD3448CB367E3B28DDF1A9D66E4140D3C4D11DF201EB1E6E512054414B49B82B13024A1202D0DAC8FB4253E988E8`
- **Firmas válidas**: 4 firmas diferentes del ESP32

## Solución de Problemas

### Error: "Oracle UTXO not found"
- Asegúrate de haber creado el oracle primero con `oracle:create`
- Verifica que el `policy_id` y `asset_name` sean correctos
- Espera a que la transacción de creación se confirme (30-60 segundos)

### Error: "not enough UTXOs or collateral"
- Verifica que tienes suficiente ADA en la wallet
- Configura collateral: usa la wallet de Eternl o Nami para configurarlo
- Asegúrate de tener al menos 5 ADA en un UTXO para collateral

### Error: "Signature verification failed"
- Los datos del sensor deben corresponder a la firma
- La firma debe ser ECDSA secp256k1 de 64 bytes
- El mensaje debe construirse en orden alfabético: `humidity || sensor_id || temperature || timestamp`

### Error: "Temperature/Humidity out of range"
- Temperatura válida: -500 a 1000 (-50.0°C a 100.0°C)
- Humedad válida: 0 a 1000 (0.0% a 100.0%)

## Referencias

- Contrato Aiken: `onchain/sensors-oracle/validators/sensor_oracle_verified.ak`
- Plutus compilado: `onchain/sensors-oracle/plutus.json`
- Tipos TypeScript: `offchain/transactions/types.ts`
- Datos de prueba: `test-data/test_payloads.json`

## Próximos Pasos

1. **Integración con ESP32**
   - Conectar el backend Express para recibir datos firmados del ESP32
   - Automatizar las actualizaciones del oracle cuando llegan nuevos datos

2. **Base de Datos**
   - Guardar histórico de todas las actualizaciones
   - Implementar PostgreSQL + Prisma

3. **Frontend Dashboard**
   - Visualizar datos del oracle en tiempo real
   - Mostrar histórico de actualizaciones con links a Cardano Explorer
