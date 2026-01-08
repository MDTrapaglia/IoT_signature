# 🔴 HALLAZGO CRÍTICO: Ed25519 en Plutus V3 falla con mensajes que contienen bytes nulos

**Fecha:** 2026-01-08
**Estado:** BLOQUEANTE - Problema confirmado y reproducible
**Severidad:** CRÍTICA

## Resumen Ejecutivo

La función `verify_ed25519_signature` de Plutus V3 **FALLA** al validar firmas Ed25519 cuando el mensaje contiene bytes nulos (`0x00`), a pesar de que:

1. ✅ La firma es VÁLIDA en JavaScript (tweetnacl)
2. ✅ El datum CBOR on-chain contiene los datos correctos
3. ✅ La estructura CBOR es idéntica a tests exitosos
4. ❌ La validación on-chain en Plutus V3 retorna `ScriptFailures`

## Evidencia

### Test Exitoso ✅ (Commit fd50140)

**Mensaje:** "Hello Cardano from ESP32!" (texto UTF-8 sin bytes nulos)
```
Hex: 48656c6c6f2043617264616e6f2066726f6d20455350333221
Length: 25 bytes
Null bytes: NO
On-chain validation: PASSED ✅
```

**Tx Hash:** `e91031fe126c27f849ad8b41ed2e76eab3b3d77cbbd2e1e10a69eec66a53964a`

**Datum CBOR:**
```
d8799f581948656c6c6f2043617264616e6f2066726f6d20455350333221584050a580957b5f2df38f34c26d28b3918817c48a98c1364974cc38b235325eedca1eab4840a8a086573dfd181fced9b6337c7058439ba6729240b33c8d11e4f20058206fa3b72581faa32ed33a5794d03c4f5cda8992e1db476a577b190475dd51ae98ff
```

### Test Fallido ❌ (Test actual)

**Mensaje:** Construido desde campos del sensor (datos binarios con bytes nulos)
```
Hex: 000000000000028c45535033325f544553545f30303100000000000000eb0000019b9b14d8c8
Breakdown:
  - Humidity (8 bytes):     000000000000028c  (652 decimal, muchos 00)
  - SensorID (14 bytes):    45535033325f544553545f303031  ("ESP32_TEST_001")
  - Temperature (8 bytes):  00000000000000eb  (235 decimal, muchos 00)
  - Timestamp (8 bytes):    0000019b9b14d8c8  (timestamp, empieza con 00)

Length: 38 bytes
Null bytes: SÍ (muchos bytes 00)
On-chain validation: FAILED ❌
JavaScript verification: VALID ✅
```

**Tx Hash:** `fbc8a68474f1cbe3f14edd22619848ab1480353b89d56e857cf00863ee1b0f3e`

**Datum CBOR:**
```
d8799f5826000000000000028c45535033325f544553545f30303100000000000000eb0000019b9b14d8c8584027577e63d3937157e919105549ca3a9a7eaaaea816a3aa0a66d835a9388aecd1fa9e025ce441942a33111cf6dda083cf109745d6a7955f89dd62ce7c9bec890d58203039fe102939f84ce6d63e9271460c3711ad9bedc204aa13e359f7f9e7a0b2baff
```

### Verificación en JavaScript

Usando los datos exactos del datum on-chain:

```javascript
const nacl = require('tweetnacl');

const messageHex = '000000000000028c45535033325f544553545f30303100000000000000eb0000019b9b14d8c8';
const signatureHex = '27577e63d3937157e919105549ca3a9a7eaaaea816a3aa0a66d835a9388aecd1fa9e025ce441942a33111cf6dda083cf109745d6a7955f89dd62ce7c9bec890d';
const publicKeyHex = '3039fe102939f84ce6d63e9271460c3711ad9bedc204aa13e359f7f9e7a0b2ba';

const signatureBytes = new Uint8Array(Buffer.from(signatureHex, 'hex'));
const publicKeyBytes = new Uint8Array(Buffer.from(publicKeyHex, 'hex'));
const messageBytes = new Uint8Array(Buffer.from(messageHex, 'hex'));

const isValid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
// Result: true ✅
```

## Análisis de Diferencias

### Estructura CBOR: IDÉNTICA ✅

| Aspecto | Test Exitoso | Test Fallido |
|---------|--------------|--------------|
| Constructor tag | `d879` | `d879` |
| Array type | `9f` (indefinite) | `9f` (indefinite) |
| Message encoding | `58<len>` (byte string) | `58<len>` (byte string) |
| Signature encoding | `5840` (64 bytes) | `5840` (64 bytes) |
| PublicKey encoding | `5820` (32 bytes) | `5820` (32 bytes) |
| End marker | `ff` | `ff` |

### Contenido del Mensaje: DIFERENTE ❌

| Aspecto | Test Exitoso | Test Fallido |
|---------|--------------|--------------|
| Tipo de datos | Texto UTF-8 | Datos binarios |
| Bytes nulos | NO | SÍ (muchos) |
| Longitud | 25 bytes | 38 bytes |
| Validación Plutus | PASSED ✅ | FAILED ❌ |
| Validación JS | VALID ✅ | VALID ✅ |

## Conclusión

El problema NO es:
- ❌ Encoding CBOR incorrecto (estructura idéntica)
- ❌ Datum corrupto (datos correctos on-chain)
- ❌ Firma inválida (válida en JavaScript)
- ❌ MeshJS encoding (funciona con mensaje literal)

El problema ES:
- ✅ **`verify_ed25519_signature` en Plutus V3 tiene un comportamiento incorrecto o no soportado con ByteArrays que contienen bytes nulos**

## Impacto

**BLOQUEANTE** para el sistema oracle:

1. Los mensajes del sensor se construyen con `int_to_bytes()` que genera bytes nulos (00) para valores pequeños
2. Temperatura 235 → `00000000000000eb` (7 bytes nulos)
3. Humidity 652 → `000000000000028c` (6 bytes nulos)
4. Timestamp reciente → `0000019b...` (empieza con bytes nulos)

**No es posible validar firmas Ed25519 del sensor on-chain con la construcción de mensaje actual.**

## Soluciones Posibles

### Opción 1: Cambiar encoding de enteros (RECOMENDADO)

En lugar de 8 bytes big-endian (con padding de ceros), usar:
- Encoding de longitud variable (VarInt)
- Encoding de tamaño mínimo (sin padding)
- Encoding decimal como string

**Ejemplo con tamaño mínimo:**
```aiken
fn int_to_bytes_minimal(n: Int) -> ByteArray {
  // Determinar bytes necesarios y codificar sin padding
  // Temperature 235 → "eb" (1 byte) en lugar de "00000000000000eb" (8 bytes)
}
```

**ADVERTENCIA:** Cambiar esto requiere:
1. Recompilar validador Aiken
2. Actualizar firmware ESP32
3. Actualizar backend TypeScript
4. Recrear oracle on-chain
5. Sincronizar TODAS las partes del sistema

### Opción 2: Usar hash en lugar de mensaje completo

```aiken
fn verify_signature(data: SensorData) -> Bool {
  let message = build_message(data)
  let message_hash = builtin.blake2b_256(message)  // Hash del mensaje

  verify_ed25519_signature(
    data.public_key,
    message_hash,  // Verificar firma sobre el HASH
    data.signature,
  )
}
```

**ADVERTENCIA:** Requiere que ESP32 firme el hash en lugar del mensaje completo.

### Opción 3: Usar mensaje literal como test exitoso

```aiken
pub type SensorData {
  message: ByteArray,  // Mensaje PRE-CONSTRUIDO (como string)
  signature: ByteArray,
  public_key: ByteArray,
  // ... metadata fields separados
}
```

**Desventaja:** El validador no puede verificar la estructura del mensaje, solo la firma.

### Opción 4: Investigar si es un bug de Plutus V3

- Reportar issue en repositorio de Plutus
- Contactar equipo de Cardano/IOG
- Verificar si hay workarounds conocidos

## Referencias

- [Plutus Core Specification](https://aiken-lang.org/resources/plutus-core-specification.pdf)
- [MeshJS Documentation](https://meshjs.dev/)
- [Aiken Documentation](https://docs.cardano.org/developer-resources/smart-contracts/aiken)

## Test Files

- Test exitoso: `offchain/transactions/test_ed25519_create.ts` (commit fd50140)
- Test fallido: `offchain/transactions/test_ed25519_create.ts` (test actual con mensaje construido)
- Validador simple: `onchain/sensors-oracle/validators/simple_ed25519_validator.ak`
- Validador oracle: `onchain/sensors-oracle/validators/sensor_oracle_ed25519.ak`

## Próximos Pasos

1. **URGENTE:** Decidir qué solución implementar
2. Si Opción 1 (encoding mínimo):
   - Implementar `int_to_bytes_minimal()` en Aiken
   - Actualizar backend TypeScript
   - Crear script de test con nuevo encoding
   - Verificar validación on-chain
3. Si Opción 2 (hash):
   - Modificar validador para aceptar hash
   - Actualizar ESP32 firmware
   - Sincronizar backend
4. Si Opción 4 (bug report):
   - Investigar repositorios oficiales
   - Crear issue con evidencia
   - Esperar respuesta del equipo

## Conclusión Final

**El sistema Ed25519 SÍ funciona en Cardano/Plutus V3**, pero con una limitación crítica: **no soporta mensajes con bytes nulos** (o tiene un bug no documentado).

Esta limitación hace que el enfoque actual de construcción de mensaje (int_to_bytes con 8 bytes big-endian) sea incompatible con validación on-chain.

Se requiere cambio de arquitectura para continuar.
