# Investigación: Error de Validación On-Chain Ed25519 en Oracle

**Fecha:** 2026-01-08
**Estado:** BLOQUEANTE - Oracle updates fallan con ScriptFailures
**Commit Problema:** c272950

## Resumen Ejecutivo

El sistema **SÍ validó Ed25519 correctamente en el pasado** (commit fd50140), pero las actualizaciones del oracle **FALLAN actualmente** con error de script validation. La firma Ed25519 es **válida en TypeScript** pero el validador Plutus la **rechaza on-chain**.

## Historia: Ed25519 Funcionó Antes ✅

### Commit fd50140 (2026-01-07 18:58)
**Mensaje:** "Migrate oracle system from ECDSA to Ed25519 signatures"

**Éxito reportado:**
```
Tested successfully on-chain: create + consume working
```

**Archivos de test exitosos:**
- `test_ed25519_create.ts` - Crea UTXO con firma Ed25519
- `test_ed25519_consume.ts` - Consume UTXO validando Ed25519 on-chain

**Validador usado:**
- `simple_ed25519_validator.ak` (PlutusV3)

**Test data guardado:**
```json
{
  "txHash": "e91031fe126c27f849ad8b41ed2e76eab3b3d77cbbd2e1e10a69eec66a53964a",
  "publicKey": "6fa3b72581faa32ed33a5794d03c4f5cda8992e1db476a577b190475dd51ae98",
  "message": "48656c6c6f2043617264616e6f2066726f6d20455350333221",
  "signature": "50a580957b5f2df38f34c26d28b3918817c48a98c1364974cc38b235325eedca...",
  "scriptAddress": "addr_test1wqcwg24ptuttt6xttxz7lmr354nmgd6kzyp06nfckn2k2ugv3duqj"
}
```

## Problema Actual: Oracle Update Falla ❌

### Error On-Chain
```
EvaluationFailure: {"ScriptFailures":{}}
```

### Transacción Rechazada
```
Oracle Address: addr_test1wrlpxpuc0mzuh30frm8uharg200p8rrntwtnhkst7c7536c4ktu72
UTXO: 54e243dab7cf26226a11ab242f69f457969f727de224da6e548c91240279bc82#0
Status: FAILED - Tx evaluation failed
```

### Datos de Test
```json
{
  "sensor_id": "ESP32_TEST_001",
  "temperature": 235,
  "humidity": 652,
  "timestamp": 1767830196650,
  "signature": "76c89bf4bd73b07c196d7cf667b6ab85e4c6c75e9ee3fe2228799a502b21653553c3c002fb8f2b27ae41df701be677add3812aadd5cb2fba9e3fc3f7b90f1e0d",
  "publicKey": "75909a4a2e08d67ed68c7f71d4fca001fc9738b70fdc149c2d964250a48af415"
}
```

### Verificación TypeScript ✅
```javascript
// Firma VÁLIDA en TypeScript (tweetnacl)
const message = buildMessage(sensor_id, temperature, humidity, timestamp);
const isValid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
// Result: true
```

## Diferencias Clave: Simple vs Oracle Validator

### `simple_ed25519_validator.ak` (FUNCIONA ✅)
```aiken
pub type Ed25519Data {
  message: ByteArray,        // Mensaje directo
  signature: ByteArray,
  public_key: VerificationKey,
}

validator simple_ed25519 {
  spend(datum: Option<Ed25519Data>, ...) -> Bool {
    expect Some(data) = datum
    
    // Verificación directa
    verify_ed25519_signature(
      data.public_key,
      data.message,
      data.signature,
    )
  }
}
```

**Características:**
- Mensaje: ByteArray crudo (hex string del mensaje)
- Sin construcción de mensaje
- Verificación directa de la firma

### `sensor_oracle_ed25519.ak` (FALLA ❌)
```aiken
pub type SensorData {
  sensor_id: ByteArray,
  temperature: Int,
  humidity: Int,
  timestamp: Int,
  signature: ByteArray,
  public_key: ByteArray,
}

fn build_message(data: SensorData) -> ByteArray {
  // Orden alfabético: humidity || sensor_id || temperature || timestamp
  let msg = int_to_bytes(data.humidity)
  let msg = builtin.append_bytearray(msg, data.sensor_id)
  let msg = builtin.append_bytearray(msg, int_to_bytes(data.temperature))
  let msg = builtin.append_bytearray(msg, int_to_bytes(data.timestamp))
  msg
}

fn verify_signature(data: SensorData) -> Bool {
  let message = build_message(data)  // CONSTRUYE el mensaje
  
  verify_ed25519_signature(
    data.public_key,
    message,
    data.signature,
  )
}
```

**Características:**
- Mensaje: **CONSTRUIDO** desde campos individuales
- Usa `int_to_bytes()` para convertir Int → ByteArray
- Orden alfabético: humidity || sensor_id || temperature || timestamp

## Hipótesis de Error

### 1. ❓ Diferencia en `int_to_bytes()`

**TypeScript (update_oracle.ts):**
```typescript
function buildMessage(tempData) {
    const humidityBytes = Buffer.alloc(8);
    humidityBytes.writeBigInt64BE(BigInt(tempData.humidity));
    
    const temperatureBytes = Buffer.alloc(8);
    temperatureBytes.writeBigInt64BE(BigInt(tempData.temperature));
    
    const timestampBytes = Buffer.alloc(8);
    timestampBytes.writeBigInt64BE(BigInt(tempData.timestamp));
    
    const sensorIdBytes = Buffer.from(tempData.sensor_id, 'utf8');
    
    return Buffer.concat([
        humidityBytes,
        sensorIdBytes,
        temperatureBytes,
        timestampBytes
    ]);
}
```

**Aiken:**
```aiken
fn int_to_bytes(n: Int) -> ByteArray {
  builtin.integer_to_bytearray(True, 8, n)
  // True = big-endian, 8 = bytes, n = valor
}
```

**Verificación:**
```bash
Message hex: 000000000000028c45535033325f544553545f30303100000000000000eb0000019b9ae411aa
Message length: 38 bytes

Humidity bytes: 000000000000028c    (652 en hex = 0x28c)
SensorID bytes: 45535033325f544553545f303031
Temperature bytes: 00000000000000eb  (235 en hex = 0xeb)
Timestamp bytes: 0000019b9ae411aa   (1767830196650 en hex)
```

✅ **Construcción de mensaje idéntica**

### 2. ❓ Datum Encoding Mismatch

**Oracle Datum:**
```typescript
const newDatum = mConStr0([
    sensorData.sensor_id,      // STRING → hex en MeshJS
    sensorData.temperature,    // NUMBER
    sensorData.humidity,       // NUMBER
    sensorData.timestamp,      // NUMBER
    sensorData.signature,      // STRING hex
    sensorData.public_key      // STRING hex
]);
```

**Posible problema:**
- MeshJS convierte `sensor_id: "ESP32_TEST_001"` a hex string
- Aiken espera `ByteArray` pero podría estar recibiendo formato diferente
- Los hex strings (signature, public_key) podrían no estar convirtiéndose correctamente

### 3. ❓ Orden de Validaciones en Oracle

El oracle tiene **múltiples checks** antes de verificar la firma:

```aiken
// 1. Debe estar firmado por el operador
expect list.has(tx.extra_signatories, params.operator)

// 2. Input debe contener el NFT
expect 1 == quantity_of(oracle_input.output.value, params.nft.policy_id, params.nft.name)

// 3. Output debe contener el NFT
expect 1 == quantity_of(oracle_output.value, params.nft.policy_id, params.nft.name)

// 4. Validar rangos del sensor
expect validate_sensor_ranges(sensor_data)

// 5. FINALMENTE: Verificar firma Ed25519
expect verify_signature(sensor_data)
```

El error `ScriptFailures: {}` no indica **dónde** falló.

### 4. ❓ Diferencia Create vs Update

**Create Oracle (Exitoso ✅):**
- Firma generada en TypeScript con `generateSignedSensorData()`
- Usa mismo `buildMessage()` y tweetnacl
- NO fue validada on-chain (solo locked en script)

**Update Oracle (Falla ❌):**
- Firma viene del **backend/database** (medición Ed25519)
- ES validada on-chain al consumir UTXO
- **Primera vez que se valida on-chain la firma del sensor**

## Mensajes de Construcción Comparados

### Test Ed25519 Simple (FUNCIONA)
```
Message: "Hello Cardano from ESP32!"
Hex: 48656c6c6f2043617264616e6f2066726f6d20455350333221
Length: 26 bytes
```

### Oracle Sensor Data (FALLA)
```
Message construido desde:
  - humidity: 652 → 000000000000028c (8 bytes)
  - sensor_id: "ESP32_TEST_001" → 45535033325f544553545f303031 (14 bytes)
  - temperature: 235 → 00000000000000eb (8 bytes)
  - timestamp: 1767830196650 → 0000019b9ae411aa (8 bytes)
Total: 38 bytes
```

**Diferencia:**
- Simple: mensaje LITERAL (string UTF-8)
- Oracle: mensaje CONSTRUIDO (concatenación de bytes)

## Posibles Causas del Error

### A. Encoding del sensor_id en Datum

**Hipótesis:** MeshJS podría estar enviando `sensor_id` como:
- UTF-8 string literal: `"ESP32_TEST_001"`
- Hex string: `"45535033325f544553545f303031"`
- ByteArray CBOR encoding diferente

**Aiken espera:** `ByteArray` (debe ser bytes puros)

**Verificación necesaria:**
- Inspeccionar datum on-chain del UTXO creado
- Comparar con lo que espera el validador

### B. Signature/PublicKey como Hex String vs ByteArray

**En TypeScript:**
```typescript
sensorData.signature = "76c89bf4bd73b07c196d7cf667b6ab85..." // STRING hex
sensorData.public_key = "75909a4a2e08d67ed68c7f71d4fca001..." // STRING hex
```

**MeshJS mConStr0:**
- Podría estar enviando el STRING literal
- Necesita convertirse a ByteArray antes

**Posible fix:**
```typescript
// En lugar de:
const newDatum = mConStr0([
    sensorData.sensor_id,      // "ESP32_TEST_001"
    sensorData.temperature,
    sensorData.humidity,
    sensorData.timestamp,
    sensorData.signature,      // "76c89bf4..." hex string
    sensorData.public_key      // "75909a4a..." hex string
]);

// Debería ser:
const newDatum = mConStr0([
    Buffer.from(sensorData.sensor_id, 'utf8').toString('hex'),  // ByteArray hex
    sensorData.temperature,
    sensorData.humidity,
    sensorData.timestamp,
    sensorData.signature,      // Ya es hex, OK
    sensorData.public_key      // Ya es hex, OK
]);
```

### C. Fallo en Check Previo (No en Ed25519)

**Posibilidad:** El error no es en `verify_signature()` sino en:
- `validate_sensor_ranges()` - temperatura/humedad fuera de rango
- Longitud de signature/public_key incorrecta
- NFT no presente en input/output

**Ranges esperados:**
```aiken
expect data.temperature >= -500 && data.temperature <= 1000  // -50°C a 100°C
expect data.humidity >= 0 && data.humidity <= 1000           // 0% a 100%
expect data.timestamp > 0
expect builtin.length_of_bytearray(data.signature) == 64     // Ed25519 signature
expect builtin.length_of_bytearray(data.public_key) == 32    // Ed25519 pubkey
```

**Nuestros valores:**
```
temperature: 235 ✅ (dentro de -500 a 1000)
humidity: 652 ✅ (dentro de 0 a 1000)
timestamp: 1767830196650 ✅ (> 0)
signature length: 128 chars hex = 64 bytes ✅
public_key length: 64 chars hex = 32 bytes ✅
```

## Prueba Definitiva Recomendada

### Test 1: Validar Simple Ed25519 con Mensaje Construido

**Modificar `test_ed25519_create.ts`:**
```typescript
// En lugar de mensaje literal:
const message = Buffer.from("Hello Cardano from ESP32!", 'utf8');

// Usar mensaje construido como el oracle:
const sensor_id = "ESP32_TEST_001";
const temperature = 235;
const humidity = 652;
const timestamp = Date.now();

const message = buildMessage({ sensor_id, temperature, humidity, timestamp });
```

**Si esto falla:**
- El problema es `buildMessage()` (int_to_bytes incompatible)

**Si esto funciona:**
- El problema es específico del oracle validator

### Test 2: Inspeccionar Datum On-Chain

**Query Blockfrost:**
```bash
curl -H "project_id: $BLOCKFROST_API_KEY" \
  "https://cardano-preprod.blockfrost.io/api/v0/txs/54e243dab7cf26226a11ab242f69f457969f727de224da6e548c91240279bc82/utxos"
```

**Buscar:**
- Formato exacto del `inline_datum`
- Encoding de `sensor_id`
- Encoding de `signature` y `public_key`

### Test 3: Usar Validador Simple con Datum Oracle

**Crear UTXO con:**
- Validador: `simple_ed25519_validator.ak`
- Datum: Mensaje construido (`buildMessage()`)
- Signature: Del sensor

**Intentar consumir:**
- Si falla: problema en construcción del mensaje
- Si funciona: problema específico del oracle (NFT checks, operator, etc.)

## Conclusión Preliminar

**Ed25519 SÍ funciona en Cardano/Plutus V3** (comprobado con test simple).

**El error está en:**
1. Cómo se construye/encoda el datum del oracle
2. Diferencia entre mensaje literal vs construido
3. Posible encoding incorrecto de ByteArrays en MeshJS

**Próximos pasos:**
1. Ejecutar Test 1 (simple_ed25519 con mensaje construido)
2. Inspeccionar datum on-chain (Test 2)
3. Si es necesario, Test 3 (cruzar validadores)
4. Verificar encoding exacto de sensor_id en datum

**Referencias:**
- Commit exitoso: fd50140
- Test files: `test_ed25519_create.ts`, `test_ed25519_consume.ts`
- Validador simple: `simple_ed25519_validator.ak`
- Oracle validator: `sensor_oracle_ed25519.ak`
