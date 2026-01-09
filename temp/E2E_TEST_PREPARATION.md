# Preparación para Testing E2E - Resumen
**Fecha:** 2026-01-09
**Status:** En progreso

## 🎯 Objetivo

Preparar el sistema para ejecutar un test E2E completo desde ESP32 (simulado) hasta Cardano usando el nuevo código con Lucid Evolution.

---

## ✅ Trabajo Completado

### 1. Script Python de Testing E2E

**Archivo:** `scripts/test_e2e.py`

Script completo que:
- ✅ Verifica conexión con backend
- ✅ Consulta sensores registrados
- ✅ Envía mediciones con firmas válidas
- ✅ Monitorea transacciones hasta confirmación
- ✅ Muestra enlaces a Cardano explorer

**Uso:**
```bash
python3 scripts/test_e2e.py --watch
```

### 2. Script de Verificación de Direcciones Oracle

**Archivo:** `scripts/verify_oracle_address.ts`

Detecta mismatches entre:
- Dirección registrada en DB
- Dirección calculada por Lucid Evolution

**Uso:**
```bash
npm run db:verify-oracle-address
```

### 3. Documentación Completa

- ✅ `scripts/README_TEST_E2E.md` - Guía de uso del script E2E
- ✅ `temp/E2E_INTEGRATION_STATUS.md` - Análisis de integración
- ✅ `temp/E2E_TESTING_GUIDE.md` - Guía detallada de testing manual

### 4. Limpieza de Datos Antiguos

- ✅ Eliminadas 10 transacciones fallidas con error de MeshJS
- ✅ Mediciones desvinculadas y listas para resubmisión

---

## ❌ Problema Identificado

### Mismatch de Direcciones Oracle

**Problema:**
El script address del oracle cambió entre la versión antigua (MeshJS) y la nueva (Lucid Evolution).

**Detalles:**

| Parámetro | Valor |
|-----------|-------|
| Sensor | ESP32_TEST_001 |
| NFT Policy | `a2f69dc8b380bbcf6b79d3e3b26097423c981df0bce0bd44d1e75de9` |
| NFT Asset | `53454e534f525f45535033325f544553545f3030315f5632` |
| Dirección en DB (vieja) | `addr_test1wrlpxpuc0mzuh30frm8uharg200p8rrntwtnhkst7c7536c4ktu72` |
| Dirección calculada (nueva) | `addr_test1wqn6kt39hmmvau6djsshasdujnmvhvnw525fjcr4fcewrfq3l3wjr` |

**Causa posible:**
- Cambios en cómo se aplican parámetros al script (MeshJS vs Lucid)
- Diferente serialización de datos
- Cambios en el código del smart contract

**Impacto:**
- ❌ Las transacciones oracle fallan con "Oracle UTXO not found"
- ❌ El servicio de auto-submission no puede encontrar el oracle UTXO
- ❌ E2E testing no puede completarse

---

## 🔧 Solución Propuesta

### Opción A: Crear Nuevo Oracle (Recomendado)

1. **Verificar si el oracle viejo tiene fondos importantes**
   - Si tiene muchos ADA o datos importantes, primero recuperarlos

2. **Crear nuevo oracle con parámetros actualizados**
   ```bash
   npm run oracle:create -- \
     a2f69dc8b380bbcf6b79d3e3b26097423c981df0bce0bd44d1e75de9 \
     53454e534f525f45535033325f544553545f3030315f5632
   ```

3. **Actualizar DB con nueva dirección**
   ```bash
   npm run db:register-sensor -- \
     ESP32_TEST_001 \
     38d38154bea26f9b10816d4871e48ee774243d1e0c21f94fd994b5ee1a365afa \
     a2f69dc8b380bbcf6b79d3e3b26097423c981df0bce0bd44d1e75de9 \
     53454e534f525f45535033325f544553545f3030315f5632 \
     addr_test1wqn6kt39hmmvau6djsshasdujnmvhvnw525fjcr4fcewrfq3l3wjr
   ```

4. **Limpiar transacciones fallidas nuevamente**
   ```bash
   npm run db:clean-failed
   ```

5. **Ejecutar test E2E**
   ```bash
   npm run test:e2e:watch
   ```

### Opción B: Investigar Diferencia en Cálculo

Si necesitamos mantener compatibilidad con el oracle viejo:

1. **Analizar cómo MeshJS aplicaba parámetros**
2. **Comparar con implementación actual de Lucid**
3. **Ajustar código para coincidir**

**Nota:** Esto es más complejo y puede no valer la pena si podemos simplemente crear un nuevo oracle en Preprod.

---

## 📋 Próximos Pasos

### Paso 1: Verificar Oracle Viejo en Cardano

```bash
# Consultar UTXOs en dirección vieja
curl "https://cardano-preprod.blockfrost.io/api/v0/addresses/addr_test1wrlpxpuc0mzuh30frm8uharg200p8rrntwtnhkst7c7536c4ktu72/utxos" \
  -H "project_id: $BLOCKFROST_API_KEY"
```

Si el UTXO existe:
- ✅ Tiene el NFT
- ✅ Tiene ~2 ADA
- → Considerar recuperarlo primero con `oracle:delete`

Si el UTXO NO existe o ya fue gastado:
- → Proceder directamente a crear nuevo oracle

### Paso 2: Crear Nuevo Oracle

```bash
# Asegurar que tenemos fondos en wallet
npm run wallet:balance

# Crear oracle
npm run oracle:create -- \
  a2f69dc8b380bbcf6b79d3e3b26097423c981df0bce0bd44d1e75de9 \
  53454e534f525f45535033325f544553545f3030315f5632

# Esperar confirmación en Preprod (~30-60 segundos)
# Anotar el script_address del output
```

### Paso 3: Actualizar Sensor en DB

```bash
npm run db:register-sensor -- \
  ESP32_TEST_001 \
  38d38154bea26f9b10816d4871e48ee774243d1e0c21f94fd994b5ee1a365afa \
  a2f69dc8b380bbcf6b79d3e3b26097423c981df0bce0bd44d1e75de9 \
  53454e534f525f45535033325f544553545f3030315f5632 \
  <script_address_del_output>
```

### Paso 4: Verificar Setup

```bash
# Verificar direcciones coinciden
npm run db:verify-oracle-address

# Verificar estado DB
npm run db:status

# Limpiar transacciones fallidas
npm run db:clean-failed
```

### Paso 5: Ejecutar Test E2E

```bash
# Terminal 1: Backend con auto-submission
export ORACLE_AUTO_SUBMIT=true
export ORACLE_SUBMIT_DELAY_MS=5000
npm run dev

# Terminal 2: Test E2E con monitoreo
npm run test:e2e:watch
```

**Output esperado:**
```
✅ Measurement accepted and verified!
✅ Found 1 transaction(s)
ℹ️  [PENDING] ESP32_TEST_001: <tx_hash>...
[Esperar ~30-60 segundos]
✅  [CONFIRMED] ESP32_TEST_001: <tx_hash>...
🎉 All transactions confirmed!
```

---

## 🎓 Lecciones Aprendidas

### 1. Parametrización de Scripts es Sensible

Pequeños cambios en cómo se serializan parámetros pueden cambiar completamente el script address.

**Ejemplo:**
```typescript
// MeshJS (viejo)
applyParamsToScript(script, [Data.to(params)])

// Lucid Evolution (nuevo)
applyParamsToScript(script, [params])  // Sin Data.to()
```

Esto puede resultar en direcciones diferentes para el mismo script.

### 2. Testing en Preprod es Crítico

Problemas como este se detectan rápidamente en Preprod sin costo. En Mainnet sería mucho más caro equivocarse.

### 3. Versionado de Oracles

Considerar agregar versionado a los nombres de assets:
- `SENSOR_ESP32_TEST_001_V1` (MeshJS)
- `SENSOR_ESP32_TEST_001_V2` (Lucid) ✅ Ya lo tenemos!

Esto permite migración gradual sin romper oracles existentes.

### 4. Documentación de Migraciones

Documentar claramente qué cambió entre versiones para facilitar troubleshooting.

---

## 📊 Estado Actual

| Componente | Estado | Notas |
|------------|--------|-------|
| Backend API | ✅ OK | Usando Lucid Evolution |
| oracle-submission.service | ✅ OK | Actualizado a Lucid |
| Script Python E2E | ✅ OK | Listo para usar |
| Sensor en DB | ⚠️ OUTDATED | Dirección vieja |
| Oracle en Cardano | ❓ UNKNOWN | Verificar si existe en dir vieja |
| Mediciones | ✅ OK | 10 mediciones listas |
| Transacciones | 🔴 FAILED | 12 failed, necesitan limpieza |

---

## ✅ Checklist Pre-Testing

- [ ] Verificar oracle viejo en Blockfrost
- [ ] Decidir: recuperar oracle viejo o crear nuevo
- [ ] Crear nuevo oracle con Lucid
- [ ] Actualizar sensor en DB con nueva dirección
- [ ] Verificar con `npm run db:verify-oracle-address`
- [ ] Limpiar transacciones fallidas
- [ ] Iniciar backend con ORACLE_AUTO_SUBMIT=true
- [ ] Ejecutar `npm run test:e2e:watch`
- [ ] Verificar confirmación en Cardano Explorer
- [ ] Documentar resultados

---

**🎯 Una vez completado este checklist, el sistema estará listo para E2E testing completo!**
