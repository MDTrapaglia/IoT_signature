# Guía de Testing End-to-End
**Fecha:** 2026-01-09

## 🎯 Objetivo

Verificar que el flujo completo funciona correctamente después de la integración de Lucid Evolution:

```
ESP32 → API REST → Backend Service → Lucid Evolution → Cardano → Confirmación
```

---

## ⚙️ Pre-requisitos

### 1. Variables de Entorno

Asegúrate de que `.env` contiene:

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/esp32_sign"

# API Security
ACCESS_TOKEN="c90e31d3f88c8851687014fa69a601fb65717449a3d07a50bd84ee75046fb885"

# Cardano Network
BLOCKFROST_API_KEY="preprod..."  # Tu API key de Blockfrost Preprod
PRIVATE_KEY="xprv..."             # Tu Bech32 root key

# Oracle Auto-Submission (CRÍTICO - activar para E2E)
ORACLE_AUTO_SUBMIT=true
ORACLE_SUBMIT_DELAY_MS=5000      # Check cada 5 segundos

# Transaction Monitoring
TX_MONITOR_POLL_INTERVAL_MS=15000  # Check cada 15 segundos
```

### 2. Base de Datos PostgreSQL

```bash
# Iniciar PostgreSQL (Docker)
docker-compose up -d

# Verificar status
npm run db:status
```

### 3. Sensor Registrado con NFT

El sensor debe estar registrado en la DB con su NFT configurado:

```bash
npm run db:register-sensor -- \
  ESP32_001 \
  <public_key_hex_64_chars> \
  <nft_policy_id> \
  <nft_asset_name> \
  <script_address>
```

**IMPORTANTE:** El NFT debe haber sido previamente minteado y el oracle debe existir en Cardano.

Si no tienes un oracle creado:

```bash
# 1. Mint NFT
npm run oracle:mint-nft -- ESP32_001

# 2. Anotar el policy_id y asset_name del output

# 3. Crear oracle
npm run oracle:create -- <policy_id> <asset_name>

# 4. Anotar el script_address del output

# 5. Registrar en DB
npm run db:register-sensor -- ESP32_001 <public_key> <policy_id> <asset_name> <script_address>
```

---

## 🧪 Test 1: Flujo Completo Automático

### Paso 1: Iniciar Backend con Auto-Submission

```bash
# Terminal 1 - Iniciar backend
export ORACLE_AUTO_SUBMIT=true
npm run dev
```

**Espera a ver:**
```
🌐 API Rest activa en http://0.0.0.0:3001
✅ Database connected
🚀 Starting Oracle Auto-Submission Service (5000ms interval)
👁️  Starting Transaction Monitor Service (15000ms interval)
```

### Paso 2: Enviar Medición desde ESP32 (o Simulada)

#### Opción A: Desde ESP32 Real

Si tienes un ESP32 con el firmware `sign_device_ed25519.ino` configurado:

1. Asegúrate de que el ESP32 tenga la URL del backend configurada
2. El ESP32 enviará automáticamente mediciones cada X segundos

#### Opción B: Simulación con curl

```bash
# Generar datos de test (requiere script helper)
# Por ahora, usar datos de una medición existente o construir manualmente

curl -X POST http://localhost:3001/api/ingest?token=c90e31d3f88c8851687014fa69a601fb65717449a3d07a50bd84ee75046fb885 \
  -H "Content-Type: application/json" \
  -d '{
    "sensor_id": "ESP32_001",
    "temperature": 235,
    "humidity": 652,
    "timestamp": 1704844800000,
    "hash": "<sha256_hex>",
    "signature": "<ed25519_signature_128_chars>",
    "publicKey": "<ed25519_public_key_64_chars>"
  }'
```

**NOTA:** Los valores `hash`, `signature` y `publicKey` deben ser generados correctamente. Ver `test-data/` para ejemplos.

### Paso 3: Verificar en Logs del Backend

Deberías ver la siguiente secuencia:

```
📥 Datos recibidos del sensor ESP32_001
✅ Firma Ed25519 válida para sensor ESP32_001
💾 Saved measurement <id> for sensor ESP32_001
📤 Found 1 unsubmitted measurement(s)
🔄 Submitting measurement <id> for sensor ESP32_001
📡 Calling updateOracle (Lucid Evolution) for sensor ESP32_001...
✅ Oracle update submitted: <tx_hash>
```

**SI VES ESTO, EL AUTO-SUBMISSION FUNCIONA! ✅**

### Paso 4: Verificar Confirmación en Blockchain

El `txMonitorService` verificará automáticamente cada 15 segundos:

```
🔍 Checking 1 pending transaction(s)
✅ Transaction <tx_hash> confirmed in block <height>
```

### Paso 5: Verificar en Base de Datos

```bash
npm run db:status
```

**Output esperado:**
```
=== MEASUREMENTS ===
Total: 1
Verified: 1
Unverified: 0

=== ORACLE TRANSACTIONS ===
Total: 1
Status breakdown:
  CONFIRMED: 1
```

### Paso 6: Verificar en Cardano Explorer

Abre el enlace en tu navegador:

```
https://preprod.cardanoscan.io/transaction/<tx_hash>
```

Verifica que:
- ✅ La transacción está confirmada
- ✅ El script address contiene el NFT
- ✅ El datum contiene los datos del sensor actualizados

---

## 🧪 Test 2: Verificar Manejo de Errores

### Test 2.1: Medición con Firma Inválida

```bash
curl -X POST http://localhost:3001/api/ingest?token=<TOKEN> \
  -H "Content-Type: application/json" \
  -d '{
    "sensor_id": "ESP32_001",
    "temperature": 235,
    "humidity": 652,
    "timestamp": 1704844800000,
    "hash": "valid_hash",
    "signature": "0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
    "publicKey": "valid_public_key"
  }'
```

**Resultado esperado:**
```json
{
  "status": "error",
  "error": "Firma Ed25519 inválida",
  "verified": false
}
```

**En DB:**
- Medición guardada con `verified: false`
- **NO se intenta enviar a Cardano** (auto-submission solo procesa mediciones verificadas)

### Test 2.2: Sensor sin NFT Configurado

1. Registrar un sensor SIN NFT:

```bash
npm run db:register-sensor -- TEST_SENSOR <public_key>
# (omitir policy_id, asset_name, script_address)
```

2. Enviar medición válida de ese sensor

**Resultado esperado en logs:**
```
⏭️  Skipping sensor TEST_SENSOR: NFT not configured
```

---

## 🧪 Test 3: Verificar Múltiples Actualizaciones

### Paso 1: Enviar 3 Mediciones Consecutivas

Envía 3 mediciones con timestamps incrementales:

```bash
# Medición 1 (temperatura 23.5°C)
curl -X POST http://localhost:3001/api/ingest?token=<TOKEN> -d '...'

# Espera 2 segundos

# Medición 2 (temperatura 24.0°C)
curl -X POST http://localhost:3001/api/ingest?token=<TOKEN> -d '...'

# Espera 2 segundos

# Medición 3 (temperatura 24.5°C)
curl -X POST http://localhost:3001/api/ingest?token=<TOKEN> -d '...'
```

### Paso 2: Verificar en Logs

Deberías ver que el servicio procesa las 3 mediciones **secuencialmente**:

```
📤 Found 1 unsubmitted measurement(s)
🔄 Submitting measurement <id1>...
✅ Oracle update submitted: <tx_hash_1>

[5 segundos después]

📤 Found 1 unsubmitted measurement(s)
🔄 Submitting measurement <id2>...
✅ Oracle update submitted: <tx_hash_2>

[5 segundos después]

📤 Found 1 unsubmitted measurement(s)
🔄 Submitting measurement <id3>...
✅ Oracle update submitted: <tx_hash_3>
```

### Paso 3: Verificar en Cardano Explorer

Los 3 TXs deben estar confirmados secuencialmente, actualizando el datum del oracle cada vez.

---

## 📊 Métricas de Éxito

### ✅ Test Exitoso

| Métrica | Valor Esperado |
|---------|----------------|
| Mediciones recibidas | 100% |
| Mediciones con firma válida | 100% |
| Auto-submission exitoso | >95% |
| TXs confirmadas en <2 min | >95% |
| Datos correctos en Cardano | 100% |

### ❌ Problemas Comunes

| Síntoma | Causa Probable | Solución |
|---------|----------------|----------|
| `Oracle UTXO not found` | Oracle no existe en Cardano | Ejecutar `oracle:create` |
| `Insufficient funds` | Wallet sin ADA | Enviar tADA a la wallet |
| `Cannot convert undefined to BigInt` | **ESTO NO DEBE PASAR** (era el bug de MeshJS) | Si aparece, el fix no funcionó - reportar |
| TX queda en PENDING por >5 min | Congestion de red / Fees bajos | Esperar o reintentar con fees más altos |
| `Signature verification failed` (on-chain) | Datos mal formateados | Verificar orden alfabético del mensaje |

---

## 🔧 Debugging

### Ver Logs Detallados

```bash
# Backend logs
npm run dev

# En otra terminal, seguir logs en tiempo real
tail -f logs/backend.log  # (si se implementa logging a archivo)
```

### Consultar Estado de Base de Datos

```bash
# Ver todas las mediciones
npm run db:status

# Ver transacciones fallidas
npm run db:clean-failed  # Elimina TXs fallidas (opcional)
```

### Verificar UTXO del Oracle

```bash
# Con Cardano CLI (si está instalado)
cardano-cli query utxo --address <script_address> --testnet-magic 1

# O con Blockfrost API
curl https://cardano-preprod.blockfrost.io/api/v0/addresses/<script_address>/utxos \
  -H "project_id: <your_api_key>"
```

---

## 🚀 Próximos Pasos

Una vez que el E2E funcione correctamente:

1. **Testing Automatizado:** Crear suite de tests con Jest/Mocha
2. **Monitoring:** Implementar alertas para failures
3. **Frontend Dashboard:** Mostrar status de TXs en tiempo real
4. **API REST para Gestión Manual:** Endpoints para create/delete oracle

---

## 📝 Notas Importantes

1. **Lucid Evolution vs MeshJS:** El sistema ahora usa **100% Lucid Evolution** para construcción de TXs. MeshJS solo se usa en `txMonitorService` para queries (no tiene el bug ahí).

2. **Auto-Submission:** Solo procesa mediciones con `verified: true`. Mediciones con firma inválida se guardan pero NO se envían a Cardano.

3. **Concurrencia:** El sistema procesa mediciones de un sensor a la vez para evitar conflictos de UTXOs (double-spending).

4. **Network:** Por defecto usa **Preprod** (testnet). Para Mainnet, cambiar `networkId: 0` a `networkId: 1` en el código.

5. **Fees:** Las TXs incluyen fees automáticos calculados por Lucid. En caso de insuficiencia, ajustar manualmente.

---

**✅ LISTO! El sistema está completamente integrado end-to-end con Lucid Evolution.**
