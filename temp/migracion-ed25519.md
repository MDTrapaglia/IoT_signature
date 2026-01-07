# Migración a Ed25519 para Validación On-Chain

**Fecha:** 2026-01-07
**Objetivo:** Cambiar de ECDSA secp256k1 a Ed25519 para mejor compatibilidad con MeshJS y Cardano

---

## 🎯 Motivación

### Problema Identificado
- ✅ ECDSA secp256k1 funciona off-chain (Python, elliptic.js)
- ✅ Validador Aiken compila correctamente
- ✅ Creación de UTXOs on-chain exitosa
- ❌ **MeshJS no puede consumir UTXOs con PlutusV3** (bug de la librería, no del validador)

### Solución: Ed25519

**Razones para cambiar:**
1. ✅ **Firma nativa de Cardano** - Es el algoritmo que usa todo el ecosistema
2. ✅ **Soporte completo en Aiken** - `verify_ed25519_signature()` built-in
3. ✅ **MeshJS/Lucid lo manejan perfectamente** - Es lo que usan las wallets
4. ✅ **Más eficiente on-chain** - Menos ExUnits (costos)
5. ✅ **Disponible en ESP32** - Librerías como `libsodium` o `Ed25519-Arduino`

**Trade-offs:**
- ⚠️ Requiere modificar código ESP32
- ⚠️ Ed25519 es menos común en IoT que secp256k1
- ✅ Pero es perfectamente factible y mejor para Cardano

---

## 📋 Plan de Implementación

### Fase 1: Validador Aiken Simple ⏱️ 15 min
- [ ] Crear `simple_ed25519_validator.ak`
- [ ] Usar solo `verify_ed25519_signature()`
- [ ] Compilar y obtener script address

### Fase 2: Scripts TypeScript ⏱️ 30 min
- [ ] Script de creación de UTXO
- [ ] Script de consumo (con firma Ed25519)
- [ ] Agregar NPM scripts

### Fase 3: Pruebas On-Chain ⏱️ 20 min
- [ ] Crear UTXO en preprod
- [ ] Intentar consumir UTXO
- [ ] Verificar si MeshJS puede consumir con Ed25519

### Fase 4: Código ESP32 ⏱️ 1-2 horas
- [ ] Ejemplo con librería Ed25519
- [ ] Generación de claves
- [ ] Firma de mensajes
- [ ] Integración con código existente

---

## 🔧 Implementación

### Paso 1: Crear Validador Aiken ✅

**Archivo:** `onchain/sensors-oracle/validators/simple_ed25519_validator.ak`

```aiken
use aiken/crypto.{VerificationKey, verify_ed25519_signature}
use cardano/transaction.{OutputReference, Transaction}

pub type Ed25519Data {
  message: ByteArray,
  signature: ByteArray,
  public_key: VerificationKey,
}

validator simple_ed25519 {
  spend(
    datum: Option<Ed25519Data>,
    _redeemer: Void,
    _own_ref: OutputReference,
    _tx: Transaction,
  ) -> Bool {
    expect Some(data) = datum

    verify_ed25519_signature(
      data.public_key,
      data.message,
      data.signature,
    )
  }

  else(_) {
    fail
  }
}
```

**Compilación:**
```bash
cd onchain/sensors-oracle && aiken build
```

**Resultado:** ✅ EXITOSO

**Detalles:**
- **Hash:** `30e42aa15f16b5e8cb5985efec71a567b437561102fd4d38b4d56571`
- **Script Address:** `addr_test1wqcwg24ptuttt6xttxz7lmr354nmgd6kzyp06nfckn2k2ugv3duqj`
- **Versión Plutus:** V3
- **CBOR Code:** `58bb01010029800aba2...` (188 bytes)

**Status:** ✅ Completado

---

## 📊 Comparación ECDSA vs Ed25519

| Característica | ECDSA secp256k1 | Ed25519 |
|----------------|-----------------|---------|
| Nativo en Cardano | ❌ | ✅ |
| Soporte Aiken | ✅ (desde Conway) | ✅ (siempre) |
| Soporte MeshJS | ⚠️ Limitado PlutusV3 | ✅ Completo |
| ExUnits on-chain | ~400k | ~300k |
| Tamaño firma | 64 bytes | 64 bytes |
| Tamaño clave pública | 64 bytes | 32 bytes |
| Común en IoT | ✅ (Bitcoin) | ⚠️ Menos común |
| Librerías ESP32 | Muchas | Disponibles |

---

## 🚀 Progreso

### Completado
- ✅ Archivo de documentación creado
- ✅ TODO list inicializado

### En Progreso
- 🔄 Creando validador Aiken...

### Pendiente
- ⏳ Compilación
- ⏳ Scripts TypeScript
- ⏳ Pruebas on-chain
- ⏳ Código ESP32

---

## 📝 Notas y Decisiones

### Decisión 1: Validador Simple Primero
**Razón:** Probar si el problema es REALMENTE de MeshJS con PlutusV3 o solo con secp256k1

**Enfoque:**
- Validador que solo verifica firma Ed25519 (sin lógica compleja)
- Datum con mensaje y firma
- Si esto funciona → MeshJS puede consumir PlutusV3 con Ed25519
- Si falla → El problema es más profundo de MeshJS

### Decisión 2: Mantener Arquitectura Existente
**Razón:** No reinventar la rueda

**Conservar:**
- Estructura del datum (sensor_id, temperature, humidity, timestamp)
- Scripts de testing (create/consume)
- Sistema de NPM scripts
- Solo cambiar el algoritmo de firma

---

## 🔍 Cadena de Pensamiento

### Análisis Inicial
1. **Problema:** MeshJS no consume UTXOs PlutusV3 (validado con `simple_validator.ak`)
2. **Hipótesis:** ¿Es un problema específico de ECDSA o de PlutusV3 en general?
3. **Estrategia:** Probar con Ed25519 (más nativo en Cardano)
4. **Resultado esperado:** Si funciona → problema es ECDSA en MeshJS; si falla → problema es PlutusV3 en MeshJS

### Ventajas de Ed25519 para este Proyecto
1. **Mejor integración:** Todo Cardano usa Ed25519
2. **Debugging más fácil:** Herramientas y ejemplos abundan
3. **Producción:** Si el ESP32 va a interactuar con Cardano, mejor usar el estándar nativo
4. **Futuro:** Si migramos a cardano-cli, Ed25519 es más straightforward

---

**Última actualización:** 2026-01-07 22:00
**Status:** 🔄 Iniciando implementación
