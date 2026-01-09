# Solución: Transacciones Fallidas en el Frontend

**Fecha:** 2026-01-08
**Problema:** El frontend muestra todas las transacciones como "fallidas"

---

## 🔍 Diagnóstico del Problema

### ¿Por qué hay transacciones fallidas?

El sistema tiene un servicio de **auto-submission** que intenta enviar automáticamente las mediciones verificadas a la blockchain de Cardano. Las transacciones fallan por las siguientes razones:

1. **Sensor sin NFT configurado**
   - Cada sensor necesita un NFT único para identificar su oracle en la blockchain
   - Sin NFT, no se puede crear/actualizar el oracle

2. **Oracle no creado**
   - El oracle debe existir en la blockchain antes de poder actualizarlo
   - Se crea con `npm run oracle:create`

3. **Transacciones de la implementación vieja**
   - Si hay transacciones de cuando usabas ECDSA en lugar de Ed25519
   - Estas nunca se van a confirmar y deben limpiarse

---

## ✅ Solución Paso a Paso

### 1. Verificar Estado Actual

```bash
npm run db:status
```

Este comando te mostrará:
- Cantidad de mediciones (verificadas/no verificadas)
- Sensores registrados y su configuración
- Transacciones por estado (pending/confirmed/failed)
- Errores específicos de las transacciones fallidas

### 2. Limpiar Transacciones Fallidas

```bash
npm run db:clean-failed
```

Este comando:
- Elimina todas las transacciones con estado `FAILED`
- Desvincula las mediciones de esas transacciones
- Las mediciones quedan disponibles para reenvío

**Importante:** Esto NO elimina las mediciones, solo las transacciones fallidas.

### 3. Configurar Sensor Correctamente

Para que el auto-submission funcione, cada sensor necesita:
- ✅ NFT Policy ID
- ✅ NFT Asset Name
- ✅ Script Address (del oracle)

#### Opción A: Sensor Nuevo (Configuración Completa)

```bash
# 1. Registrar sensor en base de datos
npm run db:register-sensor -- ESP32_001 <public_key_hex>

# 2. Mint NFT para el sensor
npm run oracle:mint-nft -- ESP32_001

# Output ejemplo:
# Policy ID: 161e7dade00f4b2434ce3614a7759c0456b5af275bbaf3161039146a
# Asset Name: 53454e534f525f45535033325f303031

# 3. Crear oracle en blockchain
npm run oracle:create -- <policy_id> <asset_name>

# Output ejemplo:
# Oracle Address: addr_test1wp7zw7f5ufve2tn3wvqx3tl48ehx3rvy63ezua287t8w95s7z3gxe

# 4. Actualizar sensor con configuración completa
npm run db:register-sensor -- ESP32_001 <public_key> <policy_id> <asset_name> <oracle_address>
```

#### Opción B: Sensor Existente (Solo Actualizar)

Si ya tienes el NFT y oracle:

```bash
npm run db:register-sensor -- ESP32_001 <public_key> <policy_id> <asset_name> <oracle_address>
```

### 4. Configurar Auto-Submission (Opcional)

Si quieres que las mediciones se envíen automáticamente a la blockchain:

Edita `.env`:
```bash
ORACLE_AUTO_SUBMIT=true
ORACLE_SUBMIT_DELAY_MS=5000  # 5 segundos entre envíos
```

**Importante:** Solo activa esto si tienes sensores configurados con NFTs.

### 5. Verificar Resolución

```bash
npm run db:status
```

Deberías ver:
- ✅ Transacciones FAILED: 0
- ✅ Sensor con NFT configurado
- ✅ Mediciones sin transacciones asociadas (listas para envío)

---

## 📊 Flujo del Sistema

### Arquitectura de Datos

```
ESP32 → POST /api/ingest → Backend API
                              ↓
                         Verificar firma Ed25519
                              ↓
                    Guardar como Measurement
                              ↓
             ┌────────────────┴────────────────┐
             ↓                                  ↓
        verified: false                   verified: true
        (firma inválida)                  (firma válida)
             │                                  │
             └→ Mostrar en dashboard            │
                                                 ↓
                                     ORACLE_AUTO_SUBMIT=true?
                                                 │
                                        ┌────────┴────────┐
                                        ↓                 ↓
                                       NO                YES
                                        │                 │
                                        │                 ↓
                                        │        Crear OracleTransaction
                                        │                 │
                                        │                 ↓
                                        │          updateOracle()
                                        │                 │
                                        │        ┌────────┴────────┐
                                        │        ↓                 ↓
                                        │    Success            Fail
                                        │        │                 │
                                        │        ↓                 ↓
                                        │  status: PENDING   status: FAILED
                                        │        │                 │
                                        │        ↓                 ↓
                                        │  TX Monitor       [Queda en DB]
                                        │        │
                                        │        ↓
                                        │  status: CONFIRMED
                                        │
                                        └→ [Queda en DB sin tx]
```

### Estados de Transacciones

| Estado | Significado | Acción |
|--------|-------------|--------|
| **PENDING** | Enviada a mempool, esperando confirmación | ⏳ Esperar (TX Monitor revisa cada 15s) |
| **CONFIRMED** | Confirmada en blockchain | ✅ Completada |
| **FAILED** | Error al enviar o validar | ❌ Limpiar y reintentar |
| **RETRYING** | Reintentando después de error temporal | 🔄 Sistema lo maneja automáticamente |

---

## 🛠️ Scripts de Utilidad

### `npm run db:status`
Muestra el estado completo de la base de datos:
- Mediciones totales (verificadas/no verificadas)
- Sensores y su configuración
- Transacciones por estado
- Detalles de errores

### `npm run db:clean-failed`
Limpia transacciones fallidas:
- Elimina transacciones con status FAILED
- Desvincula mediciones (quedan listas para reenvío)
- Pide confirmación antes de ejecutar

### `npm run db:register-sensor`
Registra o actualiza un sensor:
```bash
npm run db:register-sensor -- <sensor_id> <public_key> [nft_policy_id] [nft_asset_name] [script_address]
```

**Ejemplos:**
```bash
# Registrar sensor nuevo
npm run db:register-sensor -- ESP32_001 744ce5bf4b605e8b...

# Actualizar sensor con NFT
npm run db:register-sensor -- ESP32_001 744ce5bf4b605e8b... 161e7dade00f4b... 53454e534f525f...

# Actualizar sensor con todo
npm run db:register-sensor -- ESP32_001 744ce5bf4b605e8b... 161e7dade00f4b... 53454e534f525f... addr_test1...
```

---

## 🔐 Verificación de Firmas

### ¿Cómo saber si las firmas son válidas?

El backend verifica automáticamente las firmas Ed25519. Si encuentras mediciones con `verified: false`:

**1. Verifica formato del ESP32**

El ESP32 debe enviar:
```json
{
  "sensor_id": "ESP32_001",
  "temperature": 235,     // Temperatura * 10
  "humidity": 652,        // Humedad * 10
  "timestamp": 1736358000000,
  "hash": "026bd29e07d4...",       // SHA-256 del mensaje (64 chars hex)
  "signature": "f3347f0fef...",    // Firma Ed25519 (128 chars hex)
  "publicKey": "f1fa102220..."     // Clave pública Ed25519 (64 chars hex)
}
```

**2. Construcción del Mensaje**

Orden alfabético:
```
mensaje = humidity_bytes || sensor_id || temperature_bytes || timestamp_bytes
```

**3. Proceso de Firma**

```cpp
// 1. Construir mensaje
uint8_t message[256];
size_t messageLen = buildMessage(...);

// 2. Calcular HASH SHA-256
Sha256Context sha256Context;
uint8_t messageHash[32];
sha256Init(&sha256Context);
sha256Update(&sha256Context, message, messageLen);
sha256Final(&sha256Context, messageHash);

// 3. Firmar el HASH (no el mensaje completo)
uint8_t signature[64];
ed25519GenerateSignature(&context, privateKey, publicKey,
                         messageHash, 32, NULL, 0, 0, signature);
```

Ver `docs/SIGNATURE_FLOW.md` para detalles completos.

---

## ⚠️ Problemas Comunes

### 1. "Sensor not found in database"

**Solución:**
```bash
npm run db:register-sensor -- ESP32_001 <public_key>
```

### 2. "NFT not configured"

El sensor existe pero no tiene NFT asignado.

**Solución:**
```bash
npm run oracle:mint-nft -- ESP32_001
# Luego actualizar sensor con policy_id y asset_name
```

### 3. "Oracle UTXO not found"

El NFT existe pero el oracle no se ha creado en blockchain.

**Solución:**
```bash
npm run oracle:create -- <policy_id> <asset_name>
```

### 4. Todas las mediciones tienen "verified: false"

Las firmas Ed25519 son inválidas.

**Causas:**
- ESP32 firmando con algoritmo incorrecto
- ESP32 usando implementación vieja (ECDSA)
- Mensaje construido con orden incorrecto de campos
- Hash calculado incorrectamente

**Solución:**
- Verificar que ESP32 use `hardware/sign_device_ed25519.ino`
- Verificar orden alfabético: humidity, sensor_id, temperature, timestamp
- Verificar que firme el HASH SHA-256, no el mensaje directo

### 5. Backend rechaza mediciones

Error: "Signature inválida (debe ser 128 caracteres hex para Ed25519)"

**Causa:** Formato incorrecto de datos enviados por ESP32.

**Solución:**
- Signature debe ser 128 caracteres hex (64 bytes)
- PublicKey debe ser 64 caracteres hex (32 bytes)
- Hash debe ser 64 caracteres hex (32 bytes)

---

## 📝 Resumen

**Para resolver transacciones fallidas:**

1. ✅ Ejecutar `npm run db:status` para diagnóstico
2. ✅ Ejecutar `npm run db:clean-failed` para limpiar
3. ✅ Configurar sensores con NFT y oracle
4. ✅ Verificar que mediciones tengan `verified: true`
5. ✅ Opcionalmente activar `ORACLE_AUTO_SUBMIT=true`

**Documentación relacionada:**
- `docs/SIGNATURE_FLOW.md` - Flujo completo de firmas Ed25519
- `docs/ed25519-migration-guide.md` - Guía de migración a Ed25519
- `docs/oracle-usage.md` - Uso del sistema de oracle
- `CLAUDE.md` - Arquitectura general del proyecto

---

**Última actualización:** 2026-01-08
