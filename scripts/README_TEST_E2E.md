# End-to-End Testing Script

Script Python para testear el flujo completo desde ESP32 (simulado) hasta Cardano.

## 🎯 Qué hace el script

1. **Verifica** que el backend está corriendo
2. **Consulta** los sensores registrados y su configuración NFT
3. **Envía** mediciones de test con firmas Ed25519 válidas
4. **Monitorea** las transacciones oracle hasta que se confirmen en Cardano
5. **Reporta** el estado final con enlaces al explorer

## 📋 Pre-requisitos

### 1. Python 3.7+

```bash
python3 --version
```

### 2. Dependencias Python

```bash
pip install requests python-dotenv
```

### 3. Backend corriendo

```bash
# En una terminal separada
export ORACLE_AUTO_SUBMIT=true
export ORACLE_SUBMIT_DELAY_MS=5000
npm run dev
```

### 4. Sensor registrado con NFT

El sensor debe estar en la DB con NFT configurado:

```bash
npm run db:status
```

Si no está configurado:

```bash
# 1. Mint NFT para el sensor
npm run oracle:mint-nft -- ESP32_TEST_001

# 2. Anotar policy_id y asset_name del output

# 3. Crear oracle en Cardano
npm run oracle:create -- <policy_id> <asset_name>

# 4. Anotar script_address del output

# 5. Registrar en DB
npm run db:register-sensor -- \
  ESP32_TEST_001 \
  d3a860f3e7bdaad66873dc64e6eab1fb8721177c09971b000e201efaa3e23156 \
  <policy_id> \
  <asset_name> \
  <script_address>
```

### 5. Limpiar transacciones fallidas antiguas

```bash
npm run db:clean-failed
```

## 🚀 Uso

### Modo Básico (Sin monitoreo)

Envía mediciones y muestra el estado inicial:

```bash
python3 scripts/test_e2e.py
```

### Modo Watch (Con monitoreo automático)

Envía mediciones y espera confirmación en Cardano (hasta 5 minutos):

```bash
python3 scripts/test_e2e.py --watch
```

### Opciones Avanzadas

```bash
# Usar host diferente
python3 scripts/test_e2e.py --host http://192.168.1.100:3001

# Usar token custom
python3 scripts/test_e2e.py --token <your_access_token>

# Usar payload custom
python3 scripts/test_e2e.py --payload /path/to/custom_payload.json

# Combinado
python3 scripts/test_e2e.py --host http://192.168.1.100:3001 --watch
```

## 📊 Output Esperado

### Success (Todo OK)

```
======================================================================
ESP32 IoT Oracle - End-to-End Test
======================================================================

🔄 Checking backend status...
✅ Backend is running at http://localhost:3001
ℹ️  Total measurements: 10
ℹ️  Total transactions: 0

======================================================================
Step 1: Verify Sensor Configuration
======================================================================

🔄 Fetching registered sensors...
✅ Found 1 registered sensor(s)
ℹ️    - ESP32_TEST_001
ℹ️      NFT: a2f69dc8b380bbcf...
ℹ️      Script: addr_test1wrlpxpuc...

======================================================================
Step 2: Send Test Measurements
======================================================================

ℹ️  Sending measurement 1/1

🔄 Sending measurement from ESP32_TEST_001...
ℹ️    Temperature: 23.5°C
ℹ️    Humidity: 65.2%
ℹ️    Timestamp: 2026-01-08T10:33:11.703000
ℹ️    Hash: 40537744502a43a3...
ℹ️    Signature: 4111f07533563bc3...
✅ Measurement accepted and verified!
ℹ️    Measurement ID: cmk6abc123...

✅ 1 measurement(s) sent successfully!

======================================================================
Step 3: Oracle Auto-Submission
======================================================================

ℹ️  Waiting 10 seconds for oracle-submission service to process...
🔄 Fetching oracle transactions...
✅ Found 1 transaction(s)
ℹ️    [PENDING] ESP32_TEST_001: 383d31c16b03e861...

======================================================================
Monitoring Transaction Confirmations
======================================================================

ℹ️  Will check every 15 seconds for up to 300 seconds...

🔄 Check #1 - 0s elapsed
🔄 Fetching oracle transactions...
✅ Found 1 transaction(s)
ℹ️    [PENDING] ESP32_TEST_001: 383d31c16b03e861...
ℹ️  Status: 0 confirmed, 1 pending, 0 failed
ℹ️  Waiting 15 seconds before next check...

🔄 Check #2 - 15s elapsed
🔄 Fetching oracle transactions...
✅ Found 1 transaction(s)
✅   [CONFIRMED] ESP32_TEST_001: 383d31c16b03e861...
ℹ️  Status: 1 confirmed, 0 pending, 0 failed

🎉 All transactions confirmed!

ℹ️  Cardano Explorer Links:
ℹ️    https://preprod.cardanoscan.io/transaction/383d31c16b03e8618a01f28f96a1d7aa6c9bd81647612b38e50104ed42d9dab1
```

### Failure Scenarios

#### Backend no accesible

```
❌ Cannot connect to http://localhost:3001/api/statistics
ℹ️  Make sure the backend is running: npm run dev
```

**Solución:** Iniciar el backend.

#### Sensor sin NFT

```
⚠️  No sensors have NFT configured!
ℹ️  Oracle updates will be skipped.
ℹ️  To enable oracle updates:
ℹ️    1. Mint NFT: npm run oracle:mint-nft -- <sensor_id>
ℹ️    2. Create oracle: npm run oracle:create -- <policy_id> <asset_name>
ℹ️    3. Update sensor: npm run db:register-sensor -- ...
```

**Solución:** Seguir los pasos indicados para configurar NFT.

#### Auto-submission deshabilitado

```
⚠️  No oracle transactions found yet.
ℹ️  Possible reasons:
ℹ️    1. ORACLE_AUTO_SUBMIT is not enabled in .env
ℹ️    2. Sensors don't have NFT configured
ℹ️    3. Oracle submission service encountered an error
```

**Solución:** Verificar `.env` y reiniciar backend con `ORACLE_AUTO_SUBMIT=true`.

#### Transacción fallida

```
❌   [FAILED] ESP32_TEST_001: Evaluate redeemers failed...
```

**Solución:**
- Verificar logs del backend
- Verificar que el oracle existe en Cardano
- Verificar fondos suficientes en la wallet

## 🔍 Troubleshooting

### Ver logs del backend

```bash
# Terminal donde corre npm run dev
# Los logs aparecerán en tiempo real
```

### Verificar estado de la DB

```bash
npm run db:status
```

### Limpiar transacciones fallidas

```bash
npm run db:clean-failed
```

### Verificar oracle en Cardano

```bash
# Via Blockfrost API
curl "https://cardano-preprod.blockfrost.io/api/v0/addresses/<script_address>/utxos" \
  -H "project_id: <BLOCKFROST_API_KEY>"
```

### Verificar transacción en Explorer

```
https://preprod.cardanoscan.io/transaction/<tx_hash>
```

## 📝 Datos de Test

El script usa automáticamente los payloads de:

- `test-data/test_payload_ed25519_e2e.json` - Payload individual
- `examples/test_oracle_data.json` - Array de payloads

Estructura de un payload válido:

```json
{
  "sensor_id": "ESP32_TEST_001",
  "temperature": 235,
  "humidity": 652,
  "timestamp": 1767829991703,
  "hash": "40537744502a43a31c0cbab2afe384267f21a3cb70a34c1a28b2a5b018aa3ccc",
  "signature": "4111f07533563bc3ae0c0532420be052deaa4bcf157ec29d294ac0da11e0ebf92911d6f4d09997ebe35d6d27990703a3cd2e033ab992e4b548c1c33f1e23c004",
  "publicKey": "d3a860f3e7bdaad66873dc64e6eab1fb8721177c09971b000e201efaa3e23156"
}
```

**IMPORTANTE:**
- `hash` debe ser SHA-256 del mensaje construido (orden alfabético)
- `signature` debe ser Ed25519 signature del hash (no del mensaje)
- `publicKey` debe ser Ed25519 public key (32 bytes = 64 chars hex)

## 🎓 Ejemplo Completo

```bash
# Terminal 1: Iniciar PostgreSQL
docker-compose up -d

# Terminal 2: Iniciar Backend con auto-submission
export ORACLE_AUTO_SUBMIT=true
export ORACLE_SUBMIT_DELAY_MS=5000
npm run dev

# Terminal 3: Limpiar y ejecutar test
npm run db:clean-failed
python3 scripts/test_e2e.py --watch

# Esperar confirmación...
# ✅ All transactions confirmed!
```

## 🔗 Ver también

- `temp/E2E_INTEGRATION_STATUS.md` - Estado de integración
- `temp/E2E_TESTING_GUIDE.md` - Guía detallada de testing
- `docs/oracle-usage.md` - Documentación de oracle
- `docs/SIGNATURE_FLOW.md` - Flujo de firma Ed25519
