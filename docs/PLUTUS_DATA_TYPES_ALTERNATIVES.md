# Plutus Data Types - Alternativas y Análisis

**Contexto:** Análisis de tipos de datos alternativos para el datum del oráculo, aunque el problema actual NO es con los tipos sino con MeshJS beta.

**Propósito:** Documentación técnica de referencia para futuras optimizaciones.

---

## Tabla de Contenidos

1. [Tipos Plutus Disponibles](#tipos-plutus-disponibles)
2. [Análisis del Datum Actual](#análisis-del-datum-actual)
3. [Alternativas por Campo](#alternativas-por-campo)
4. [Comparación de Rendimiento](#comparación-de-rendimiento)
5. [Recomendaciones](#recomendaciones)

---

## Tipos Plutus Disponibles

### Tipos Primitivos en Plutus Core

| Tipo Plutus | Aiken | Tamaño | Rango | Uso Recomendado |
|-------------|-------|--------|-------|-----------------|
| **Integer** | `Int` | Variable (CBOR) | Ilimitado | Números enteros |
| **ByteString** | `ByteArray` | Variable | Máx 64 bytes típico | Datos binarios, hashes, firmas |
| **String** | N/A (usar ByteArray) | Variable | UTF-8 encoding | Texto (via ByteArray) |
| **Bool** | `Bool` | 1 byte | True/False | Flags |
| **Unit** | `Void` | 0 bytes | () | Redeemers vacíos |
| **List** | `List<T>` | Variable | Ilimitado | Colecciones |
| **Pair** | `Pair<A,B>` | Variable | - | Tuplas de 2 elementos |
| **Data** | `Data` | Variable | - | Tipo genérico (any) |

### Encoding CBOR

Plutus usa CBOR (RFC 8949) para serialización:

```
Integer (positive):
  0-23    → 1 byte  (0x00 - 0x17)
  24-255  → 2 bytes (0x18 + value)
  256-65535 → 3 bytes (0x19 + 2 bytes)
  65536-... → 5 bytes (0x1a + 4 bytes)
  ...       → 9 bytes (0x1b + 8 bytes)

ByteString:
  0x40 + length + data
  Ejemplo: [0x41, 0x42] → 0x42 0x41 0x42 (3 bytes)
```

---

## Análisis del Datum Actual

### Schema Actual

```aiken
pub type SensorData {
  sensor_id: ByteArray,      // "ESP32_001" → 9 bytes UTF-8
  temperature: Int,          // 235 (23.5°C) → 2 bytes CBOR
  humidity: Int,             // 652 (65.2%) → 3 bytes CBOR
  timestamp: Int,            // 1767889882000 (ms) → 9 bytes CBOR
  signature: ByteArray,      // Ed25519 sig → 64 bytes
  public_key: ByteArray,     // Ed25519 pubkey → 32 bytes
}
```

### Tamaño CBOR Real

Datum serializado on-chain: `d8799f4945535033325f30303118eb19028c1b0000019b9e72b29a5840d6ab...` (191 bytes total)

**Breakdown:**
```
d879                   # Constructor tag (2 bytes)
  9f                   # Start array
    49 45535033325f30303 # sensor_id: "ESP32_001" (10 bytes con length)
    18 eb              # temperature: 235 (2 bytes)
    19 028c            # humidity: 652 (3 bytes)
    1b 0000019b9e72b29a # timestamp: 1767889882 (9 bytes)
    58 40 d6ab...      # signature: 64 bytes (66 bytes con header)
    58 20 72ac...      # public_key: 32 bytes (34 bytes con header)
  ff                   # End array
```

**Total:** ~191 bytes

**Min UTxO (2 ADA):** Suficiente para este datum size.

---

## Alternativas por Campo

### Campo 1: sensor_id

#### Opción Actual: ByteArray (String UTF-8) ✅

```aiken
sensor_id: ByteArray  // "ESP32_001"
```

**Offchain (MeshJS):**
```typescript
sensor_id: "ESP32_001"  // MeshJS convierte automáticamente a ByteArray
```

**Tamaño:** 10 bytes (1 byte length + 9 bytes data)

**Ventajas:**
- ✅ Legible on-chain (hex → UTF-8)
- ✅ Simple de construir offchain
- ✅ Fácil de validar (length check)

**Desventajas:**
- ❌ Más grande que alternativas numéricas

---

#### Alternativa 1A: Hash del Sensor ID

```aiken
sensor_id_hash: ByteArray  // SHA-256("ESP32_001")
```

**Offchain:**
```typescript
const sensorIdHash = crypto.createHash('sha256')
  .update(sensorData.sensor_id)
  .digest('hex');
```

**Tamaño:** 33 bytes (1 byte length + 32 bytes hash)

**Ventajas:**
- ✅ Tamaño fijo (siempre 32 bytes)
- ✅ Privacidad (no revela sensor ID directamente)

**Desventajas:**
- ❌ **MÁS GRANDE** que string directo (33 vs 10 bytes)
- ❌ No legible on-chain
- ❌ Necesita lookup table offchain

**Recomendación:** ❌ NO usar - Más grande sin beneficio

---

#### Alternativa 1B: ID Numérico

```aiken
sensor_id: Int  // 1, 2, 3, ...
```

**Offchain:**
```typescript
sensor_id: 1  // Mapeo: 1 → "ESP32_001"
```

**Tamaño:** 1-2 bytes CBOR

**Ventajas:**
- ✅ MÁS PEQUEÑO (1-2 bytes vs 10 bytes)
- ✅ Fácil de comparar on-chain
- ✅ Eficiente para múltiples sensores

**Desventajas:**
- ❌ Necesita mapeo offchain (DB: id → name)
- ❌ Menos legible on-chain

**Recomendación:** ⚠️ Considerar para producción con muchos sensores (ahorra ~8 bytes por datum)

---

### Campo 2 y 3: temperature, humidity

#### Opción Actual: Int (valor * 10) ✅

```aiken
temperature: Int  // 235 = 23.5°C
humidity: Int     // 652 = 65.2%
```

**Offchain:**
```typescript
temperature: 235  // User sees: 23.5°C
humidity: 652     // User sees: 65.2%
```

**Tamaño:** 2-3 bytes CBOR cada uno

**Ventajas:**
- ✅ Precisión de 0.1°C / 0.1%
- ✅ Comparaciones directas on-chain
- ✅ No necesita punto flotante
- ✅ Rango amplio (-50°C a 100°C OK)

**Desventajas:**
- ❌ Ninguno significativo

---

#### Alternativa 2A: ByteArray (8 bytes fixed)

```aiken
temperature: ByteArray  // [0, 0, 0, 0, 0, 0, 0, 235]
humidity: ByteArray     // [0, 0, 0, 0, 0, 0, 2, 140]
```

**Offchain:**
```typescript
const tempBytes = Buffer.alloc(8);
tempBytes.writeBigInt64BE(BigInt(235));
```

**Tamaño:** 9 bytes (1 byte length + 8 bytes data) cada uno

**Ventajas:**
- ✅ Tamaño fijo predecible

**Desventajas:**
- ❌ **MÁS GRANDE** (9 vs 2-3 bytes)
- ❌ No se pueden comparar directamente on-chain
- ❌ Necesita deserialización manual
- ❌ Más gas units para operaciones

**Recomendación:** ❌ NO usar - Mucho más grande sin beneficio

---

#### Alternativa 2B: Int de 8 bits (scaled down)

```aiken
temperature: Int  // 23 (sin decimales)
humidity: Int     // 65 (sin decimales)
```

**Tamaño:** 1-2 bytes cada uno

**Ventajas:**
- ✅ Ligeramente más pequeño (1-2 bytes vs 2-3 bytes)

**Desventajas:**
- ❌ Pérdida de precisión (23°C vs 23.5°C)
- ❌ No aceptable para métricas precisas
- ❌ Ahorra solo 1-2 bytes

**Recomendación:** ❌ NO usar - Pérdida de precisión no justificada

---

### Campo 4: timestamp

#### Opción Actual: Int (Unix timestamp en milisegundos) ✅

```aiken
timestamp: Int  // 1767889882000 (ms desde Unix epoch)
```

**Offchain:**
```typescript
timestamp: Date.now()  // JavaScript nativo
```

**Tamaño:** 9 bytes CBOR (0x1b + 8 bytes)

**Rango:**
- Mínimo: 0 (1970-01-01)
- Máximo: 2^53 (año 287396 - muy futuro)

**Ventajas:**
- ✅ Estándar universal
- ✅ Compatible con Date.now()
- ✅ Precisión de milisegundos
- ✅ Comparaciones directas on-chain

**Desventajas:**
- ❌ Relativamente grande (9 bytes)

---

#### Alternativa 4A: Unix timestamp en segundos

```aiken
timestamp: Int  // 1767889882 (segundos desde Unix epoch)
```

**Offchain:**
```typescript
timestamp: Math.floor(Date.now() / 1000)
```

**Tamaño:** 5 bytes CBOR (0x1a + 4 bytes)

**Rango:**
- Máximo: 2^32 = 4294967296 (año 2106)

**Ventajas:**
- ✅ MÁS PEQUEÑO (5 vs 9 bytes)
- ✅ Suficiente hasta año 2106
- ✅ Estándar Unix

**Desventajas:**
- ❌ Pérdida de precisión (segundos vs milisegundos)
- ❌ No compatible directo con Date.now()

**Recomendación:** ⚠️ Considerar si no necesitas precisión de milisegundos (ahorra 4 bytes)

---

#### Alternativa 4B: Timestamp relativo (desde bloque genesis)

```aiken
timestamp_rel: Int  // Segundos desde un timestamp base
```

**Ejemplo:** Base = 2024-01-01 → timestamp = 31536000 (1 año después)

**Tamaño:** 3-5 bytes CBOR

**Ventajas:**
- ✅ Más pequeño si el rango es limitado

**Desventajas:**
- ❌ Necesita conversión offchain
- ❌ Menos estándar
- ❌ Complejidad adicional

**Recomendación:** ❌ NO usar - Complejidad no justificada

---

#### Alternativa 4C: Slot number (Cardano-specific)

```aiken
slot: Int  // Cardano slot number
```

**Tamaño:** 5 bytes CBOR

**Ventajas:**
- ✅ Nativo a Cardano
- ✅ Más pequeño que timestamp

**Desventajas:**
- ❌ Requiere conversión a fecha legible
- ❌ Menos universal
- ❌ Complicado para offchain

**Recomendación:** ❌ NO usar - Menos universal

---

### Campo 5 y 6: signature, public_key

#### Opción Actual: ByteArray (Ed25519) ✅

```aiken
signature: ByteArray   // 64 bytes
public_key: ByteArray  // 32 bytes
```

**Offchain:**
```typescript
signature: Buffer.from(nacl.sign.detached(...)).toString('hex')
public_key: Buffer.from(keyPair.publicKey).toString('hex')
```

**Tamaño:**
- Signature: 66 bytes (2 bytes header + 64 bytes data)
- Public key: 34 bytes (2 bytes header + 32 bytes data)

**Ventajas:**
- ✅ Tamaño fijo
- ✅ Formato estándar Ed25519
- ✅ Directamente compatible con `verify_ed25519_signature`

**Desventajas:**
- ❌ Ninguno - esto es lo mínimo posible

---

#### Alternativa 5A: Usar hash de public key

```aiken
pub_key_hash: ByteArray  // SHA-256(public_key) = 32 bytes
```

**Tamaño:** Mismos 34 bytes (2 header + 32 data)

**Ventajas:**
- ❌ Ninguno - mismo tamaño

**Desventajas:**
- ❌ No se puede verificar firma directamente
- ❌ Necesita lookup de clave original

**Recomendación:** ❌ NO usar - No funciona para verificación

---

#### Alternativa 5B: Omitir public_key (usar fixed key)

```aiken
// Solo signature, public_key fija en el contrato
signature: ByteArray  // 64 bytes
```

**Tamaño:** Ahorra 34 bytes

**Ventajas:**
- ✅ MÁS PEQUEÑO (ahorra 34 bytes)
- ✅ Funciona si todos los sensores usan misma clave

**Desventajas:**
- ❌ **CRÍTICO:** Un solo sensor comprometido = todos comprometidos
- ❌ No escalable (1 clave = 1 sensor)
- ❌ No permite rotación de claves

**Recomendación:** ❌ NO usar - Riesgo de seguridad inaceptable

---

## Comparación de Rendimiento

### Tamaño Total del Datum

| Configuración | sensor_id | temp | hum | timestamp | sig | pubkey | **Total** | Δ |
|---------------|-----------|------|-----|-----------|-----|--------|-----------|---|
| **Actual** ✅ | 10 B | 2 B | 3 B | 9 B | 66 B | 34 B | **~124 B** | - |
| Optimizado 1 | 2 B (Int) | 2 B | 3 B | 5 B (seg) | 66 B | 34 B | **~112 B** | -12 B |
| Optimizado 2 | 2 B (Int) | 2 B | 3 B | 9 B | 66 B | 34 B | **~116 B** | -8 B |
| ByteArray nums | 10 B | 9 B | 9 B | 9 B | 66 B | 34 B | **~137 B** | +13 B ❌ |
| Sin pubkey | 10 B | 2 B | 3 B | 9 B | 66 B | 0 B | **~90 B** | -34 B ⚠️ |

**Conclusiones:**
- ✅ Configuración actual es eficiente
- ⚠️ Optimización máxima ahorra ~12 bytes (10% reducción)
- ❌ ByteArray para números AUMENTA tamaño
- ⚠️ Omitir pubkey es inseguro

---

### Costo de Execution Units

Validador `sensor_oracle_ed25519` ejecuta:

```aiken
// 1. Construir mensaje
let message = build_message(data)

// 2. Hash SHA-256
let message_hash = builtin.sha2_256(message)

// 3. Verificar firma Ed25519
verify_ed25519_signature(data.public_key, message_hash, data.signature)
```

**Costos aproximados (Plutus V3):**

| Operación | Memory | CPU Steps | Dependencia de tipo |
|-----------|--------|-----------|---------------------|
| `builtin.length_of_bytearray` | 100 | 23000 | N/A |
| `builtin.append_bytearray` | 100 | 1000/byte | N/A |
| `builtin.sha2_256` | 4 | 30000 + 82/byte | Más bytes = más caro |
| `verify_ed25519_signature` | 10 | 53384000 | Fijo (64B sig, 32B key) |
| Comparación Int (`<`, `>`) | 100 | 500 | **Int es más barato** |
| Deserializar ByteArray a Int | 1000 | 5000 | Solo si usas ByteArray |

**Conclusión:**
- ✅ `Int` es más eficiente que `ByteArray` para comparaciones numéricas
- ✅ Validador actual usa Int → operaciones baratas
- ❌ Cambiar a ByteArray aumentaría costos

---

### Min UTxO Requirements

Cardano requiere min ADA en cada UTxO según tamaño:

```
minUTxO = (coinsPerUTxOSize * (160 + |datumBytes|)) + fixedCost
```

**Preprod Testnet:** coinsPerUTxOSize ≈ 4310 lovelace/byte

| Datum Size | Min UTxO (approx) | Actual |
|------------|-------------------|--------|
| 120 bytes | ~1.8 ADA | ✅ |
| 124 bytes (**actual**) | **~1.9 ADA** | **✅ Usamos 2 ADA** |
| 140 bytes | ~2.1 ADA | ⚠️ |

**Conclusión:** Configuración actual está bien dimensionada (2 ADA buffer OK)

---

## Recomendaciones

### Para Producción Actual (MVP)

**Mantener schema actual ✅**

```aiken
pub type SensorData {
  sensor_id: ByteArray,      // String UTF-8
  temperature: Int,          // Valor * 10
  humidity: Int,             // Valor * 10
  timestamp: Int,            // Unix ms
  signature: ByteArray,      // 64 bytes
  public_key: ByteArray,     // 32 bytes
}
```

**Razones:**
1. ✅ Eficiente (124 bytes)
2. ✅ Legible on-chain
3. ✅ Simple de construir offchain
4. ✅ Ya probado y funcional (create_oracle funciona)
5. ✅ Min UTxO OK (2 ADA suficiente)

---

### Optimizaciones Futuras (Post-MVP)

Si se necesita optimizar (múltiples sensores, costos):

#### Optimización 1: Sensor ID numérico

```aiken
sensor_id: Int  // 1, 2, 3, ...
```

**Ahorro:** ~8 bytes por datum
**Trade-off:** Necesita tabla de lookup offchain

#### Optimización 2: Timestamp en segundos

```aiken
timestamp: Int  // Unix segundos (no ms)
```

**Ahorro:** ~4 bytes por datum
**Trade-off:** Pérdida de precisión milisegundos

#### Optimización 3: Temperatura/humedad de 8 bits

```aiken
temperature: Int  // Sin decimales (23 en vez de 235)
humidity: Int
```

**Ahorro:** ~1 byte por campo
**Trade-off:** ❌ Pérdida de precisión - **NO recomendado**

---

### Optimizaciones NO Recomendadas ❌

#### ❌ NO: ByteArray para números

```aiken
temperature: ByteArray  // [0, 0, 0, 235]
```

**Razón:** Más grande (9 bytes vs 2-3 bytes) y más caro on-chain

#### ❌ NO: Omitir public_key

```aiken
// Solo signature, clave fija
```

**Razón:** Riesgo de seguridad crítico

#### ❌ NO: Comprimir signature

```aiken
signature: ByteArray  // 32 bytes (truncado)
```

**Razón:** Ed25519 requiere 64 bytes, no funciona truncado

---

## Ejemplos de Código

### Construcción Offchain - Actual (MeshJS)

```typescript
import { mConStr0, byteString } from "@meshsdk/core";

const sensorData = {
  sensor_id: "ESP32_001",
  temperature: 235,         // 23.5°C
  humidity: 652,            // 65.2%
  timestamp: Date.now(),
  signature: "d6abfbb933...", // 64 bytes hex
  public_key: "72ac4b95a9..." // 32 bytes hex
};

const datum = mConStr0([
  sensorData.sensor_id,
  sensorData.temperature,
  sensorData.humidity,
  sensorData.timestamp,
  byteString(sensorData.signature),
  byteString(sensorData.public_key)
]);
```

---

### Construcción Offchain - Optimizada

```typescript
// Opción: Sensor ID numérico + timestamp en segundos
const sensorData = {
  sensor_id_num: 1,                    // ← Int en vez de string
  temperature: 235,
  humidity: 652,
  timestamp: Math.floor(Date.now() / 1000), // ← Segundos
  signature: "d6abfbb933...",
  public_key: "72ac4b95a9..."
};

const datum = mConStr0([
  sensorData.sensor_id_num,            // ← 1-2 bytes
  sensorData.temperature,
  sensorData.humidity,
  sensorData.timestamp,                // ← 5 bytes
  byteString(sensorData.signature),
  byteString(sensorData.public_key)
]);

// Total: ~116 bytes (ahorro: 8 bytes)
```

---

### Validación On-Chain - Actual

```aiken
validator sensor_oracle_ed25519(params: OracleParams) {
  spend(...) {
    when redeemer is {
      Update -> {
        expect sensor_data: SensorData = output.datum

        // Validar rangos (Int directo)
        expect sensor_data.temperature >= -500   // -50.0°C
        expect sensor_data.temperature <= 1000   //  100.0°C
        expect sensor_data.humidity >= 0
        expect sensor_data.humidity <= 1000      //  100.0%

        // Construir mensaje y verificar firma
        let message = build_message(sensor_data)
        let hash = builtin.sha2_256(message)

        expect verify_ed25519_signature(
          sensor_data.public_key,
          hash,
          sensor_data.signature
        )

        True
      }
    }
  }
}
```

**Operaciones eficientes:**
- ✅ Comparaciones Int directas (`>=`, `<=`)
- ✅ Construcción de mensaje con `append_bytearray`
- ✅ Verificación Ed25519 nativa

---

## Conclusión

### Tipos de Datos Actuales son Óptimos ✅

Los tipos de datos del datum actual son:
1. ✅ **Eficientes:** 124 bytes (10% más pequeño que alternativas ByteArray)
2. ✅ **Seguros:** Incluyen public_key para verificación independiente
3. ✅ **Precisos:** Temperatura/humedad con 0.1 de precisión
4. ✅ **Estándar:** Unix timestamp, Ed25519 nativo
5. ✅ **Legibles:** sensor_id como string UTF-8

### El Problema NO es con los Tipos

Como se documenta en `MESHJS_PLUTUS_V3_ISSUE.md`:
- ✅ Los mismos tipos funcionan en `create_oracle.ts`
- ✅ El datum se serializa correctamente en JSON
- ❌ El problema es interno de MeshJS beta (spending Plutus V3)

### Cambiar Tipos NO Resolvería el Bug

Usar ByteArray para números:
- ❌ Aumentaría tamaño (+13 bytes)
- ❌ Aumentaría costos execution units
- ❌ NO resolvería el bug de MeshJS
- ❌ Complicaría validación on-chain

### Optimizaciones Futuras Opcionales

Si en el futuro necesitas optimizar costos (muchos sensores):
1. ⚠️ Sensor ID numérico: -8 bytes (trade-off: lookup table)
2. ⚠️ Timestamp en segundos: -4 bytes (trade-off: precisión)
3. ❌ Temperatura sin decimales: NO (pérdida de datos)

**Ahorro máximo viable:** ~12 bytes (10% reducción)
**Costo de complejidad:** Medio-Alto
**Recomendación:** No optimizar aún (premature optimization)

---

## Referencias

- **Plutus Core Specification:** https://plutus.cardano.org/
- **CBOR RFC 8949:** https://www.rfc-editor.org/rfc/rfc8949.html
- **Ed25519 Spec:** https://ed25519.cr.yp.to/
- **Cardano Min UTxO:** https://docs.cardano.org/native-tokens/minimum-ada-value-requirement/
- **Aiken Language:** https://aiken-lang.org/language-tour/primitive-types
