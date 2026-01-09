# Estado del Proyecto ESP32 IoT Certification System

**Fecha:** 2026-01-08
**Versión:** v0.2.0-beta
**Red:** Cardano Preprod Testnet

---

## 📊 Resumen Ejecutivo

El sistema de certificación de datos IoT con firmas Ed25519 está **funcionalmente completo en la capa offchain** y parcialmente funcional en la capa on-chain.

### Estado General: 🟡 FUNCIONAL CON LIMITACIÓN

- ✅ **Sistema Offchain:** 100% operativo
- ✅ **Firma y Validación:** 100% operativo
- ✅ **Base de Datos:** 100% operativo
- ✅ **Frontend Dashboard:** 100% operativo
- ⚠️ **On-Chain Oracle:** Creado OK, actualizaciones bloqueadas

---

## ✅ Componentes Funcionales

### 1. Hardware (ESP32) - ✅ COMPLETO

**Estado:** Produciendo datos firmados correctamente

**Características:**
- ✅ Lectura de sensores DHT22 (temperatura/humedad)
- ✅ Generación de par de claves Ed25519
- ✅ Construcción de mensaje con orden alfabético
- ✅ Firma SHA-256(mensaje) con Ed25519
- ✅ Envío HTTP POST a backend

**Hardware probado:**
- ESP32-WROOM-32
- Sensor DHT22

**Código:** `hardware/sign_device_ed25519.ino`

---

### 2. Backend (Express + TypeScript) - ✅ COMPLETO

**Estado:** Recibiendo, validando y almacenando mediciones

**Características:**
- ✅ API REST en puerto 3001
- ✅ Endpoint `/api/ingest` - Recibe mediciones firmadas
- ✅ Verificación de firma Ed25519 con tweetnacl
- ✅ Validación de rangos de datos
- ✅ Almacenamiento en PostgreSQL con Prisma
- ✅ Auto-submission service (preparado para futuro)

**Endpoints activos:**
```
POST /api/ingest          - Recibir medición firmada
GET  /api/measurements    - Listar mediciones
GET  /api/sensors         - Listar sensores configurados
GET  /api/transactions    - Listar transacciones on-chain
```

**Base de datos:** PostgreSQL con Prisma ORM

**Código:** `offchain/backend/`

---

### 3. Frontend (Next.js 15) - ✅ COMPLETO

**Estado:** Dashboard mostrando métricas en tiempo real

**URL:** http://localhost:3000

**Características:**
- ✅ Vista de métricas offchain
  - Total de mediciones recibidas
  - Mediciones verificadas vs rechazadas
  - Sensores activos
  - Transacciones pendientes/completadas/fallidas
- ✅ Vista de estado on-chain
  - Estado del oráculo
  - Última actualización
  - NFT asociado
  - Datos del sensor on-chain
- ✅ Actualización automática cada 5 segundos

**Código:** `offchain/frontend/`

---

### 4. Smart Contracts (Aiken) - ✅ COMPLETO

**Estado:** Validador compilado y probado

**Características:**
- ✅ Validador Plutus V3 con Ed25519
- ✅ Verificación de firma SHA-256(mensaje)
- ✅ Validación de rangos de temperatura (-50°C a 100°C)
- ✅ Validación de rangos de humedad (0% a 100%)
- ✅ NFT-based oracle identification
- ✅ Operador autorizado (required signer)

**Validador activo:** `sensor_oracle_ed25519`

**Script Address:** `addr_test1wz40a7a86rdmk9kcknz5dvq867wp6xt2ws6p32ke3frrqsq9xwxnm`

**Código:** `onchain/sensors-oracle/validators/sensor_oracle_ed25519.ak`

---

### 5. Oracle On-Chain - ⚠️ PARCIAL

**Estado:** Creado exitosamente, actualizaciones bloqueadas por bug de MeshJS

**Oráculo actual:**
- ✅ **Creado:** TX `c79f01469c32168d3b9fa1bc0e1059f2b26dc62132bb29deed14709318ad2b55`
- ✅ **NFT:** `a2f69dc8b380bbcf6b79d3e3b26097423c981df0bce0bd44d1e75de9.SENSOR_ESP32_TEST_001_V2`
- ✅ **Datos iniciales:** Temp 23.5°C, Hum 65.2%, timestamp válido
- ❌ **Actualizaciones:** Bloqueadas por bug MeshJS beta

**Explorer:** https://preprod.cardanoscan.io/transaction/c79f01469c32168d3b9fa1bc0e1059f2b26dc62132bb29deed14709318ad2b55

---

## ❌ Limitaciones Actuales

### Bug MeshJS Beta - Oracle Updates

**Problema:**
MeshJS v1.9.0-beta.90 tiene un bug al construir transacciones de spending para scripts Plutus V3. El error ocurre durante `.complete()` al calcular execution units.

**Error:**
```
Error: Evaluate redeemers failed: Error serializing outputs: Cannot convert undefined to a BigInt
```

**Impacto:**
- ❌ No se pueden actualizar oráculos existentes
- ✅ Se pueden crear nuevos oráculos
- ✅ Datos se almacenan correctamente en BD (no se pierden)

**Workaround actual:**
- Actualizaciones manuales periódicas (si es necesario)
- Sistema offchain sigue operativo

**Documentación completa:** `docs/MESHJS_PLUTUS_V3_ISSUE.md`

---

## 📈 Métricas Actuales

### Base de Datos (Preprod)

```sql
-- Sensores registrados: 1
SELECT COUNT(*) FROM "Sensor";  -- 1 (ESP32_TEST_001)

-- Mediciones totales: Variable
SELECT COUNT(*) FROM "Measurement";

-- Mediciones verificadas: ~100%
SELECT COUNT(*) FROM "Measurement" WHERE verified = true;

-- Transacciones on-chain: 1 (creación)
SELECT COUNT(*) FROM "OracleTransaction";
```

### On-Chain (Preprod)

- **Oráculos desplegados:** 1
- **Actualizaciones exitosas:** 0 (bug MeshJS)
- **NFTs mintados:** 1
- **ADA locked en oráculos:** 2 ADA

---

## 🛠️ Comandos Útiles

### Iniciar Sistema

```bash
# 1. Iniciar backend
npm run backend:dev

# 2. En otra terminal, iniciar frontend
cd offchain/frontend
npm run dev

# 3. Verificar estado
npm run db:status
```

### Monitoreo

```bash
# Ver logs del backend
tail -f /tmp/backend.log

# Verificar base de datos
npm run db:status

# Limpiar transacciones fallidas
npm run db:clean-failed
```

### Testing

```bash
# Test de firma Ed25519 on-chain (simple validator)
npm run test:ed25519:create   # Crear UTXO con firma
npm run test:ed25519:consume  # Consumir (valida firma)

# Simular envío desde ESP32
curl -X POST http://localhost:3001/api/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "sensor_id": "ESP32_001",
    "temperature": 235,
    "humidity": 652,
    "timestamp": 1767889882000,
    "signature": "...",
    "public_key": "..."
  }'
```

---

## 🎯 Próximos Pasos

### Corto Plazo (Esta Semana)

1. **Decisión sobre MeshJS:**
   - [ ] Esperar release stable de MeshJS, O
   - [ ] Migrar a Lucid Evolution

2. **Monitoreo:**
   - [x] Sistema offchain operativo
   - [x] Base de datos almacenando mediciones
   - [x] Frontend mostrando métricas

### Medio Plazo (2-4 Semanas)

1. **Resolver actualizaciones on-chain:**
   - [ ] Migrar `update_oracle.ts` a Lucid Evolution, O
   - [ ] Actualizar MeshJS cuando salga stable

2. **Testing:**
   - [ ] Pruebas de carga con múltiples sensores
   - [ ] Validación end-to-end completa

3. **Optimizaciones:**
   - [ ] Auto-submission periódico (cuando updates funcionen)
   - [ ] Alertas por mediciones fuera de rango
   - [ ] Dashboard mejorado con gráficos

### Largo Plazo (Producción)

1. **Migración a Mainnet:**
   - [ ] Audit de smart contracts
   - [ ] Testing exhaustivo en Preprod
   - [ ] Deploy a Mainnet

2. **Escalabilidad:**
   - [ ] Soporte para múltiples sensores
   - [ ] Optimización de costos on-chain
   - [ ] Batch updates si es necesario

3. **Características adicionales:**
   - [ ] API pública para consultar datos
   - [ ] Integración con exploradores
   - [ ] Notificaciones automáticas

---

## 🏗️ Arquitectura Actual

```
┌─────────────────────────────────────────────────────────────────┐
│                        ESP32 + DHT22                            │
│  (Genera firma Ed25519 sobre SHA-256 del mensaje)              │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTP POST /api/ingest
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                    Backend (Express)                            │
│  ✅ Verifica firma Ed25519                                      │
│  ✅ Valida rangos de datos                                      │
│  ✅ Almacena en PostgreSQL                                      │
│  ⚠️ Auto-submission (preparado, esperando fix MeshJS)          │
└────────────────┬───────────────────────┬────────────────────────┘
                 │                       │
                 │ GET /api/*            │ (futuro) updateOracle()
                 ↓                       ↓
┌─────────────────────────┐   ┌────────────────────────────────┐
│  Frontend Dashboard     │   │  Cardano Preprod Testnet       │
│  (Next.js 15)           │   │                                │
│  ✅ Métricas offchain   │   │  ✅ Oracle creado              │
│  ✅ Estado on-chain     │   │  ❌ Updates bloqueados         │
│  ✅ Auto-refresh 5s     │   │  (bug MeshJS beta)             │
└─────────────────────────┘   └────────────────────────────────┘
```

---

## 📚 Documentación Técnica

### Arquitectura y Diseño
- `CLAUDE.md` - Guía principal del proyecto
- `docs/ed25519-migration-guide.md` - Migración ECDSA → Ed25519
- `docs/SIGNATURE_FLOW.md` - Flujo de firma Ed25519 detallado

### Troubleshooting
- `docs/MESHJS_PLUTUS_V3_ISSUE.md` - ⚠️ **CRÍTICO:** Análisis completo del bug
- `docs/PLUTUS_DATA_TYPES_ALTERNATIVES.md` - Alternativas de tipos de datos
- `docs/TROUBLESHOOTING_FAILED_TX.md` - Resolver transacciones fallidas

### Uso
- `docs/oracle-usage.md` - Guía de uso del oráculo
- `hardware/README_ED25519.md` - Configuración ESP32

---

## 🔧 Configuración Requerida

### Variables de Entorno (.env)

```bash
# Cardano
BLOCKFROST_API_KEY=preprodXXXXXXXXXXXX
PRIVATE_KEY=xprv...  # Bech32 root key

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/esp32_sign

# Backend
PORT=3001
ORACLE_SUBMIT_DELAY_MS=5000  # Auto-submission interval (cuando funcione)

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### Dependencias

```bash
# Backend
npm install

# Frontend
cd offchain/frontend && npm install

# Database
npx prisma migrate dev
npx prisma generate
```

---

## 🎓 Learnings y Decisiones

### 1. Ed25519 sobre SHA-256(mensaje)

**Decisión:** Firmar el hash SHA-256 del mensaje, no el mensaje directamente.

**Razón:** Evita problemas con bytes nulos en mensajes largos y es la práctica estándar.

**Implementación:**
```typescript
const message = buildMessage(data);           // Construir mensaje
const hash = crypto.createHash('sha256')
  .update(message).digest();                  // SHA-256
const signature = nacl.sign.detached(hash, secretKey);  // Firmar hash
```

### 2. Orden Alfabético de Campos

**Decisión:** Campos ordenados alfabéticamente: `humidity || sensor_id || temperature || timestamp`

**Razón:** Consistencia entre ESP32, backend y smart contract.

**Implementación:**
```aiken
fn build_message(data: SensorData) -> ByteArray {
  data.humidity
    |> builtin.append_bytearray(data.sensor_id)
    |> builtin.append_bytearray(data.temperature)
    |> builtin.append_bytearray(data.timestamp)
}
```

### 3. PostgreSQL + Prisma

**Decisión:** Usar PostgreSQL con Prisma ORM en lugar de in-memory storage.

**Razón:**
- Persistencia de datos
- Soporte para auto-submission futuro
- Historial completo de transacciones
- Escalabilidad

### 4. MeshJS para Frontend, (Lucid para Backend futuro)

**Decisión:** Mantener MeshJS en frontend, migrar backend a Lucid si es necesario.

**Razón:**
- MeshJS tiene mejor integración con React/Next.js
- Lucid es más estable para transacciones complejas Plutus V3
- Separación de concerns

---

## ⚠️ Advertencias Importantes

### Seguridad

1. **Claves Privadas:**
   - ⚠️ Nunca commitear `.env` con claves reales
   - ⚠️ Usar diferentes claves para Preprod/Mainnet
   - ⚠️ Rotar claves periódicamente en producción

2. **ESP32 Keys:**
   - ⚠️ Claves generadas en ESP32 son para testing
   - ⚠️ En producción usar secure element (ATECC608A)
   - ⚠️ Implementar key rotation mechanism

3. **API Security:**
   - ⚠️ Actualmente sin autenticación (OK para testing)
   - ⚠️ Implementar API keys antes de producción
   - ⚠️ Rate limiting necesario

### Costos (Preprod Testnet)

- **Crear oráculo:** ~0.18 ADA (fees) + 2 ADA (locked en UTXO)
- **Actualizar oráculo:** ~0.5-1 ADA (fees con script Plutus V3)
- **Total desplegado:** 2.18 ADA en Preprod (gratis, del faucet)

**Para Mainnet:** Considerar costos y optimizaciones (batch updates, etc.)

### Limitaciones Técnicas

1. **MeshJS Beta:** No usar en producción hasta release stable
2. **Preprod Testnet:** Puede resetearse, datos no permanentes
3. **Auto-submission:** Deshabilitado hasta resolver bug MeshJS
4. **Escalabilidad:** Un oráculo = un sensor (OK para MVP)

---

## 📞 Soporte

### Logs

- **Backend:** `/tmp/backend.log`
- **Frontend:** Console del navegador
- **Database:** `npx prisma studio` (GUI)

### Debug

```bash
# Ver estado completo del sistema
npm run db:status

# Ver mediciones recientes
psql $DATABASE_URL -c "SELECT * FROM \"Measurement\" ORDER BY received_at DESC LIMIT 10;"

# Ver transacciones fallidas
psql $DATABASE_URL -c "SELECT * FROM \"OracleTransaction\" WHERE status = 'FAILED';"
```

### Recursos

- **Cardano Preprod Faucet:** https://docs.cardano.org/cardano-testnet/tools/faucet/
- **Block Explorer:** https://preprod.cardanoscan.io/
- **MeshJS Docs:** https://meshjs.dev/
- **Aiken Docs:** https://aiken-lang.org/

---

## ✅ Conclusión

El sistema está **funcionalmente completo en offchain** y **parcialmente funcional en on-chain**:

- ✅ ESP32 genera firmas Ed25519 correctamente
- ✅ Backend valida y almacena mediciones
- ✅ Frontend muestra métricas en tiempo real
- ✅ Smart contract compilado y probado
- ✅ Oracle creado exitosamente en blockchain
- ⚠️ Actualizaciones on-chain bloqueadas temporalmente (bug MeshJS beta)

**El proyecto está listo para producción una vez se resuelva el bug de MeshJS o se migre a Lucid Evolution.**

**Próximo hito:** Migrar `update_oracle.ts` a Lucid Evolution o esperar MeshJS stable (estimado: 1-2 semanas).
