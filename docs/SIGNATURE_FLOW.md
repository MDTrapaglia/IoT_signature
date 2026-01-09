# Flujo de Firmas Ed25519 en el Sistema Oracle

**Fecha:** 2026-01-08
**Versión:** 1.0.0

---

## 🎯 Resumen

Este documento explica **exactamente** cómo funciona el sistema de firmas Ed25519 en el Oracle de sensores ESP32 para Cardano.

### Flujo Completo

```
ESP32 → Construir Mensaje → Hash SHA-256 → Firma Ed25519 → Blockchain
                                                                ↓
                                                          Validador
                                                                ↓
                                      Reconstruir Mensaje → Hash SHA-256 → Verificar Firma ✅
```

---

## 📋 Flujo Detallado

### Paso 1: Construcción del Mensaje (ESP32/TypeScript)

**Orden alfabético de campos** (crítico para consistencia):

```
mensaje = humidity_bytes || sensor_id || temperature_bytes || timestamp_bytes
```

**Codificación:**
- `humidity_bytes`: 8 bytes big-endian signed int64
- `sensor_id`: UTF-8 bytes (longitud variable)
- `temperature_bytes`: 8 bytes big-endian signed int64
- `timestamp_bytes`: 8 bytes big-endian signed int64

**Ejemplo:**
```typescript
// Datos
sensor_id = "ESP32_001"
temperature = 235  // 23.5°C
humidity = 652     // 65.2%
timestamp = 1736358000000

// Construcción
humidity_bytes    = [00 00 00 00 00 00 02 8C]  // 8 bytes
sensor_id_bytes   = [45 53 50 33 32 5F 30 30 31]  // "ESP32_001" en UTF-8
temperature_bytes = [00 00 00 00 00 00 00 EB]  // 8 bytes
timestamp_bytes   = [00 00 01 9B 9A 6E A9 C0]  // 8 bytes

// Mensaje completo (30 bytes)
mensaje = [00 00 00 00 00 00 02 8C 45 53 50 33 32 5F 30 30 31 00 00 00 00 00 00 00 EB 00 00 01 9B 9A 6E A9 C0]
```

### Paso 2: Hash SHA-256 del Mensaje

**CRÍTICO:** Se firma el HASH, no el mensaje directo.

```typescript
messageHash = SHA256(mensaje)  // 32 bytes
```

**¿Por qué firmar el hash?**
1. ✅ Evita problemas con bytes nulos en el mensaje
2. ✅ Estándar para firmar mensajes largos
3. ✅ Consistencia entre ESP32, TypeScript y Aiken

### Paso 3: Firma Ed25519

```typescript
signature = Ed25519.sign(messageHash, privateKey)  // 64 bytes
```

**ESP32:**
```cpp
// Calcular hash
Sha256Context sha256Context;
uint8_t messageHash[32];
sha256Init(&sha256Context);
sha256Update(&sha256Context, message, messageLen);
sha256Final(&sha256Context, messageHash);

// Firmar el HASH
uint8_t signature[64];
ed25519GenerateSignature(&context, privateKey, publicKey,
                         messageHash, 32, NULL, 0, 0, signature);
```

**TypeScript:**
```typescript
import crypto from 'crypto';
import nacl from 'tweetnacl';

// Calcular hash
const messageHash = crypto.createHash('sha256').update(message).digest();

// Firmar el HASH
const signature = nacl.sign.detached(messageHash, keyPair.secretKey);
```

### Paso 4: Validación On-Chain (Aiken)

**Archivo:** `onchain/sensors-oracle/validators/sensor_oracle_ed25519.ak`

```aiken
fn verify_signature(data: SensorData) -> Bool {
  // 1. Reconstruir mensaje (orden alfabético)
  let message = build_message(data)

  // 2. Calcular hash SHA-256
  let message_hash = builtin.sha2_256(message)

  // 3. Verificar firma Ed25519 sobre el HASH
  verify_ed25519_signature(
    data.public_key,   // 32 bytes
    message_hash,      // 32 bytes (hash del mensaje)
    data.signature,    // 64 bytes
  )
}

fn build_message(data: SensorData) -> ByteArray {
  // Orden alfabético: humidity, sensor_id, temperature, timestamp
  let msg = int_to_bytes(data.humidity)                    // 8 bytes
  let msg = builtin.append_bytearray(msg, data.sensor_id)  // variable
  let msg = builtin.append_bytearray(msg, int_to_bytes(data.temperature))  // 8 bytes
  let msg = builtin.append_bytearray(msg, int_to_bytes(data.timestamp))    // 8 bytes
  msg
}
```

---

## 🧪 Validadores de Prueba

### Validador Simple: `simple_ed25519_validator.ak`

**Propósito:** Testing básico de Ed25519 sin lógica de negocio.

**Ubicación:** `onchain/sensors-oracle/validators/simple_ed25519_validator.ak`

**Uso:**
```bash
# 1. Compilar validador
cd onchain/sensors-oracle
aiken build

# 2. El validador compilado estará en plutus.json
# 3. Usar en scripts de prueba (test_ed25519_create.ts, test_ed25519_consume.ts)
```

**Código:**
```aiken
pub type Ed25519Data {
  message: ByteArray,
  signature: ByteArray,
  public_key: VerificationKey,
}

validator simple_ed25519 {
  spend(datum: Option<Ed25519Data>, ...) -> Bool {
    expect Some(data) = datum

    // Calcular hash SHA-256 del mensaje
    let message_hash = builtin.sha2_256(data.message)

    // Verificar firma sobre el HASH
    verify_ed25519_signature(
      data.public_key,
      message_hash,
      data.signature,
    )
  }
}
```

---

## ✅ Verificación Local

**Script de prueba:** `test-data/verify_message_construction.ts`

Este script verifica que la construcción del mensaje en TypeScript coincide exactamente con Aiken.

**Uso:**
```bash
# 1. Crear payload de prueba (JSON)
cat > /tmp/test_payload.json << 'EOF'
{
  "sensor_id": "ESP32_001",
  "temperature": 235,
  "humidity": 652,
  "timestamp": 1736358000000,
  "hash": "..."
}
EOF

# 2. Ejecutar verificación
npx tsx test-data/verify_message_construction.ts

# Output esperado:
# ✅ SUCCESS: Los hashes coinciden perfectamente!
```

---

## 📊 Tamaños y Formatos

| Componente | Tamaño | Formato |
|------------|--------|---------|
| **Mensaje** | Variable | Concatenación binaria |
| **Hash SHA-256** | 32 bytes | Binario |
| **Clave Privada** | 32 bytes | Binario |
| **Clave Pública** | 32 bytes | Binario |
| **Firma** | 64 bytes | Binario |

**En hex strings (para transacciones):**
- Hash: 64 caracteres hex
- Clave Pública: 64 caracteres hex
- Firma: 128 caracteres hex

---

## 🔍 Debugging

### Verificar Construcción del Mensaje

```typescript
function debugMessage(data: SensorData) {
  const humidityBytes = Buffer.alloc(8);
  humidityBytes.writeBigInt64BE(BigInt(data.humidity));
  console.log("Humidity bytes:", humidityBytes.toString('hex'));

  const sensorIdBytes = Buffer.from(data.sensor_id, 'utf8');
  console.log("Sensor ID bytes:", sensorIdBytes.toString('hex'));

  const temperatureBytes = Buffer.alloc(8);
  temperatureBytes.writeBigInt64BE(BigInt(data.temperature));
  console.log("Temperature bytes:", temperatureBytes.toString('hex'));

  const timestampBytes = Buffer.alloc(8);
  timestampBytes.writeBigInt64BE(BigInt(data.timestamp));
  console.log("Timestamp bytes:", timestampBytes.toString('hex'));

  const message = Buffer.concat([
    humidityBytes,
    sensorIdBytes,
    temperatureBytes,
    timestampBytes
  ]);
  console.log("Complete message:", message.toString('hex'));
  console.log("Message length:", message.length);
}
```

### Verificar Firma Localmente

```typescript
import nacl from 'tweetnacl';
import crypto from 'crypto';

function verifySignature(data: SensorData): boolean {
  // Reconstruir mensaje
  const message = buildMessage(data);

  // Calcular hash
  const messageHash = crypto.createHash('sha256').update(message).digest();

  // Convertir de hex a bytes
  const signature = Buffer.from(data.signature, 'hex');
  const publicKey = Buffer.from(data.public_key, 'hex');

  // Verificar
  return nacl.sign.detached.verify(messageHash, signature, publicKey);
}
```

---

## ⚠️ Errores Comunes

### 1. Orden Incorrecto de Campos

❌ **INCORRECTO:**
```typescript
// Orden alfabético equivocado
message = sensor_id || temperature || humidity || timestamp
```

✅ **CORRECTO:**
```typescript
// Orden alfabético: humidity, sensor_id, temperature, timestamp
message = humidity || sensor_id || temperature || timestamp
```

### 2. Firmar el Mensaje en Lugar del Hash

❌ **INCORRECTO:**
```typescript
// Firma el mensaje directamente
const signature = nacl.sign.detached(message, privateKey);
```

✅ **CORRECTO:**
```typescript
// Calcula hash y firma el hash
const messageHash = crypto.createHash('sha256').update(message).digest();
const signature = nacl.sign.detached(messageHash, privateKey);
```

### 3. Encoding Incorrecto de Enteros

❌ **INCORRECTO:**
```typescript
// Little-endian o sin signo
buffer.writeBigUInt64LE(BigInt(value));
```

✅ **CORRECTO:**
```typescript
// Big-endian con signo (compatible con Aiken)
buffer.writeBigInt64BE(BigInt(value));
```

---

## 📚 Referencias

- **ESP32 Implementation:** `hardware/sign_device_ed25519.ino:145-180`
- **TypeScript Implementation:** `offchain/transactions/create_oracle.ts:45-109`
- **Aiken Validator:** `onchain/sensors-oracle/validators/sensor_oracle_ed25519.ak:35-109`
- **Simple Validator:** `onchain/sensors-oracle/validators/simple_ed25519_validator.ak:1-48`
- **Verification Script:** `test-data/verify_message_construction.ts`

---

## ✨ Conclusión

**El sistema completo funciona correctamente** siguiendo este flujo:

1. ✅ **Construir mensaje** con campos ordenados alfabéticamente
2. ✅ **Calcular HASH SHA-256** del mensaje
3. ✅ **Firmar el HASH** con Ed25519 (no el mensaje directo)
4. ✅ **Validador on-chain** reconstruye mensaje, calcula hash y verifica firma

Todos los componentes (ESP32, TypeScript, Aiken) implementan este flujo de manera consistente.

---

**Última actualización:** 2026-01-08
