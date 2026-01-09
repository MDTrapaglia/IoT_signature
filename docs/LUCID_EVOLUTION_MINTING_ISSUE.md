# Lucid Evolution - Plutus V3 Parameterized Minting Policy Issue

**Fecha:** 2026-01-09
**Estado:** EN INVESTIGACIÓN
**Versión Lucid Evolution:** 0.4.29
**Impacto:** NFT minting con one-time policy bloqueado

---

## 📋 Resumen Ejecutivo

### El Problema

Los minting policies Plutus V3 parametrizados fallan en Lucid Evolution cuando intentan **comparar parámetros** con valores de la transacción. El error ocurre durante la ejecución del validador on-chain:

```
failed script execution Mint[0] the validator crashed / exited prematurely
```

### Evidencia

Mediante pruebas progresivas aislamos exactamente dónde falla:

| Validador | Lógica | Resultado |
|-----------|--------|-----------|
| **V1** | Siempre retorna `True` | ✅ FUNCIONA |
| **V2** | Verifica cantidad = 1 | ✅ FUNCIONA |
| **V3** | Verifica UTXO consumption | ❌ FALLA |
| **V4** | Verifica token name match | ❌ FALLA |

**Conclusión:** El problema NO es con el paso de parámetros ni con la configuración de Lucid Evolution. El problema aparece cuando el validador intenta **comparar** un parámetro con datos de la transacción.

---

## 🔍 Descripción Detallada del Problema

### Contexto

Estamos intentando crear un NFT minting policy "one-time use" que:
1. Recibe como parámetros: `utxo_ref: OutputReference` y `token_name: ByteArray`
2. Verifica que se consume el UTXO especificado
3. Verifica que el token minted coincida con el nombre esperado
4. Solo permite mintear exactamente 1 token

Este es el patrón estándar documentado en Aiken para crear NFTs únicos.

### Validador Aiken (Plutus V3)

```aiken
// En: onchain/sensors-oracle/validators/nft.ak

validator nft(utxo_ref: OutputReference, token_name: ByteArray) {
  mint(_r, policy_id: PolicyId, tx: Transaction) {
    let Transaction { inputs, mint, .. } = tx

    // Verificar que se mintea exactamente 1 token
    expect [Pair(asset_name, 1)] = mint |> tokens(policy_id) |> to_pairs()

    // Verificar que se consume el UTXO especificado
    let is_output_consumed =
      list.any(inputs, fn(input) { input.output_reference == utxo_ref })

    // Verificar que el nombre coincide
    is_output_consumed? && (asset_name == token_name)?
  }

  else(_) {
    fail
  }
}
```

**Compilación:** ✅ Compila sin errores con Aiken v1.1.21

### Implementación Lucid Evolution

```typescript
// En: offchain/transactions/mint_sensor_nft_lucid.ts

import { Lucid, Data, applyParamsToScript, Constr, mintingPolicyToId, fromText } from "@lucid-evolution/lucid";

// Obtener UTXO para los parámetros
const utxos = await lucid.wallet().getUtxos();
const ownerUtxo = utxos[0];

// Crear token name
const token_name = "SENSOR_TEST_01";
const tokenNameHex = fromText(token_name);

// Serializar parámetros
const utxoRefData = Data.to(
  new Constr(0, [
    ownerUtxo.txHash,              // String
    BigInt(ownerUtxo.outputIndex)  // BigInt
  ])
);

const tokenNameData = Data.to(tokenNameHex);  // Hex string

// Aplicar parámetros al script
const mintingScript = applyParamsToScript(nft_code, [utxoRefData, tokenNameData]);

// Crear minting policy
const mintingPolicy = {
  type: "PlutusV3" as const,
  script: mintingScript
};

const policyId = mintingPolicyToId(mintingPolicy);
const nftUnit = policyId + tokenNameHex;

// Construir transacción
const redeemer = Data.to(new Constr(0, []));

const tx = await lucid
  .newTx()
  .collectFrom([ownerUtxo])  // CRÍTICO: debe consumir el UTXO de los parámetros
  .attach.MintingPolicy(mintingPolicy)
  .mintAssets({ [nftUnit]: BigInt(1) }, redeemer)
  .complete();

// Firmar y enviar
const signedTx = await tx.sign.withWallet().complete();
const txHash = await signedTx.submit();
```

### Error Durante Ejecución

```
❌ Error: { Complete: "failed script execution Mint[0] the validator crashed / exited prematurely" }

TxBuilderError: { Complete: "failed script execution Mint[0] the validator crashed / exited prematurely" }
    at completeTxError (.../CompleteTxBuilder.ts:98:3)
    at catch (.../CompleteTxBuilder.ts:663:9)
```

El error ocurre durante `.complete()`, específicamente cuando Lucid Evolution:
1. Construye la transacción completa
2. Evalúa los execution units del script
3. **El validador crashea durante la evaluación**

---

## 🧪 Metodología de Aislamiento del Problema

### Fase 1: Test Native Script ✅

**Objetivo:** Verificar que Lucid Evolution funciona correctamente.

```typescript
// mint_simple_lucid.ts - Minting con native script

const mintingPolicy = scriptFromNative({
  type: "all",
  scripts: [
    {
      type: "sig",
      keyHash: paymentCredentialOf(walletAddr).hash,
    },
  ],
});

// ... mismo flujo de construcción de transacción
```

**Resultado:** ✅ FUNCIONA - El minteo con native script es exitoso.

**Conclusión:** Lucid Evolution, Blockfrost, y la wallet funcionan correctamente.

---

### Fase 2: Test Validador V1 (Always True) ✅

**Objetivo:** Verificar que los parámetros se aplican correctamente.

```aiken
// nft_v1_always_true.ak

validator nft_v1_always_true(utxo_ref: OutputReference, token_name: ByteArray) {
  mint(_r, _policy_id: PolicyId, _tx: Transaction) {
    // Siempre retorna True - no usa los parámetros
    True
  }

  else(_) {
    fail
  }
}
```

**Resultado:** ✅ FUNCIONA

**Tx Hash:** `83ea4cba5b3edd952e356c679c538eae654c79d327c3511c44ace9514f492bd8`
**Explorer:** https://preprod.cardanoscan.io/transaction/83ea4cba5b3edd952e356c679c538eae654c79d327c3511c44ace9514f492bd8

**Conclusión:**
- ✅ Los parámetros se aplican correctamente al script
- ✅ La serialización con `Data.to()` funciona
- ✅ El script Plutus V3 se ejecuta correctamente
- ✅ **El problema NO es con el paso de parámetros**

---

### Fase 3: Test Validador V2 (Check Quantity) ✅

**Objetivo:** Verificar que acceder a datos de la transacción funciona.

```aiken
// nft_v2_check_quantity.ak

validator nft_v2_check_quantity(utxo_ref: OutputReference, token_name: ByteArray) {
  mint(_r, policy_id: PolicyId, tx: Transaction) {
    let Transaction { mint, .. } = tx

    // Verificar exactamente 1 token (cualquier nombre)
    expect [Pair(_asset_name, 1)] = mint |> tokens(policy_id) |> to_pairs()

    True
  }

  else(_) {
    fail
  }
}
```

**Resultado:** ✅ FUNCIONA

**Tx Hash:** `65d26795ddb738f44f21fd0b82823ff4354ba093c6f574c0eab0d9e41b4628c6`

**Conclusión:**
- ✅ Acceder a `tx.mint` funciona
- ✅ Usar `tokens()` y `to_pairs()` funciona
- ✅ Pattern matching con `expect` funciona
- ✅ **El problema NO es con acceso a datos de la transacción**

---

### Fase 4: Test Validador V3 (Check UTXO) ❌

**Objetivo:** Verificar comparación de `OutputReference`.

```aiken
// nft_v3_check_utxo.ak

validator nft_v3_check_utxo(utxo_ref: OutputReference, token_name: ByteArray) {
  mint(_r, _policy_id: PolicyId, tx: Transaction) {
    let Transaction { inputs, .. } = tx

    // Verificar que se consume el UTXO especificado
    list.any(inputs, fn(input) { input.output_reference == utxo_ref })
  }

  else(_) {
    fail
  }
}
```

**Resultado:** ❌ FALLA

```
Error: { Complete: "failed script execution Mint[0] the validator crashed / exited prematurely" }
```

**Conclusión:**
- ❌ La comparación `input.output_reference == utxo_ref` causa el crash
- ❌ **El parámetro `utxo_ref` no está en el formato correcto para comparación**

---

### Fase 5: Test Validador V4 (Check Token Name) ❌

**Objetivo:** Verificar comparación de `ByteArray`.

```aiken
// nft_v4_check_name.ak

validator nft_v4_check_name(utxo_ref: OutputReference, token_name: ByteArray) {
  mint(_r, policy_id: PolicyId, tx: Transaction) {
    let Transaction { mint, .. } = tx

    // Obtener asset name del mint
    expect [Pair(asset_name, 1)] = mint |> tokens(policy_id) |> to_pairs()

    // Comparar con parámetro
    asset_name == token_name
  }

  else(_) {
    fail
  }
}
```

**Resultado:** ❌ FALLA

```
Error: { Complete: "failed script execution Mint[0] the validator crashed / exited prematurely" }
```

**Conclusión:**
- ❌ La comparación `asset_name == token_name` causa el crash
- ❌ **El parámetro `token_name` no está en el formato correcto para comparación**

---

## 🎯 Causa Raíz Identificada

### El Problema Real

Los validadores Plutus V3 **crashean** cuando intentan comparar:
1. Un parámetro `OutputReference` con valores de `tx.inputs`
2. Un parámetro `ByteArray` con valores de `tx.mint`

**Pero NO crashean cuando:**
- Solo acceden a datos de la transacción (V2 funciona)
- No usan los parámetros en comparaciones (V1 funciona)

### Hipótesis: Formato de Serialización Incorrecto

El problema probablemente está en cómo `Data.to()` serializa los parámetros:

```typescript
// ¿Es esto correcto?
const utxoRefData = Data.to(new Constr(0, [txHash, BigInt(outputIndex)]));
const tokenNameData = Data.to(tokenNameHex);
```

**Posibles causas:**

1. **OutputReference mal formado:**
   - Lucid Evolution espera el `txHash` en un formato específico (bytes vs string)
   - El `outputIndex` podría necesitar ser Int en lugar de BigInt
   - La estructura `Constr(0, [...])` podría no coincidir con la definición de Aiken

2. **ByteArray mal formado:**
   - El `tokenNameHex` de `fromText()` podría no ser el formato correcto
   - `Data.to()` podría estar agregando un wrapper extra
   - Podría necesitar `Data.Bytes()` en lugar de `Data.to()`

3. **Double-encoding:**
   - `applyParamsToScript()` podría estar esperando datos ya serializados
   - `Data.to()` podría estar agregando una capa extra de encoding

---

## 📊 Comparación con MeshJS Issue

### Similitudes

Ambos problemas involucran:
- Plutus V3 scripts
- Errores durante evaluación/ejecución
- Lucid Evolution como solución (en el caso de MeshJS)

### Diferencias Clave

| Aspecto | MeshJS Issue | Lucid Evolution Issue (actual) |
|---------|--------------|-------------------------------|
| **Operación** | SPENDING scripts | MINTING scripts |
| **Fase de error** | Durante `computeMinimumCost` | Durante validación on-chain |
| **Causa** | Bug interno de MeshJS | Formato de parámetros incorrecto |
| **Datos involucrados** | Datum de outputs | Parámetros del script |
| **Evidencia de éxito** | Create funciona | Validators sin comparaciones funcionan |

### ¿Es el Mismo Bug?

**NO.** Son problemas diferentes:

- **MeshJS:** Bug interno de serialización durante construcción de transacción
- **Lucid Evolution:** Formato incorrecto de parámetros para comparaciones on-chain

---

## 🔬 Investigación Pendiente

### 1. Formato Correcto de OutputReference

**Pregunta:** ¿Cómo debe ser serializado `OutputReference` para `applyParamsToScript()`?

**Investigar:**
- [ ] Revisar definición de `OutputReference` en plutus.json
- [ ] Comparar con ejemplos de Aiken/Lucid Evolution en GitHub
- [ ] Verificar si `txHash` debe ser ByteArray en lugar de String
- [ ] Probar sin `Constr(0, [...])` wrapper

**Código a probar:**
```typescript
// Opción 1: Sin Constr wrapper
const utxoRefData = Data.to([ownerUtxo.txHash, BigInt(ownerUtxo.outputIndex)]);

// Opción 2: txHash como bytes
const txHashBytes = Buffer.from(ownerUtxo.txHash, 'hex');
const utxoRefData = Data.to(new Constr(0, [txHashBytes.toString('hex'), BigInt(ownerUtxo.outputIndex)]));

// Opción 3: Usar el esquema de plutus.json
const OutputReferenceSchema = Data.Object({
  transaction_id: Data.Bytes(),
  output_index: Data.Integer()
});
const utxoRefData = Data.to(
  { transaction_id: ownerUtxo.txHash, output_index: ownerUtxo.outputIndex },
  OutputReferenceSchema
);
```

---

### 2. Formato Correcto de ByteArray

**Pregunta:** ¿Cómo debe ser serializado `ByteArray` para comparaciones?

**Investigar:**
- [ ] Verificar si `fromText()` es la función correcta
- [ ] Probar con `Data.Bytes()` en lugar de `Data.to()`
- [ ] Comparar con cómo se serializa `asset_name` en la transacción
- [ ] Revisar si necesita conversión UTF-8 explícita

**Código a probar:**
```typescript
// Opción 1: Direct hex (sin Data.to)
const tokenNameData = tokenNameHex;

// Opción 2: Data.Bytes
const tokenNameData = Data.Bytes(tokenNameHex);

// Opción 3: Buffer conversion
const tokenNameData = Data.to(Buffer.from(token_name, 'utf8'));
```

---

### 3. Revisar Ejemplos Exitosos

**Buscar en:**
- [ ] GitHub de Lucid Evolution - test files
- [ ] GitHub de Anastasia Labs - proyectos con minting parametrizado
- [ ] Aiken stdlib - ejemplos de NFT minting
- [ ] Cardano Stack Exchange - preguntas sobre parameter application

**Específicamente buscar:**
- Proyectos que usan `applyParamsToScript` con `OutputReference`
- NFT minting policies con parámetros en Plutus V3
- Comparaciones exitosas de parámetros con datos de transacción

---

### 4. Consultar Esquemas de plutus.json

**Archivo:** `onchain/sensors-oracle/plutus.json`

**Revisar:**
```json
{
  "definitions": {
    "ByteArray": {
      "dataType": "bytes"
    },
    "cardano/transaction/OutputReference": {
      "title": "OutputReference",
      "anyOf": [{
        "title": "OutputReference",
        "dataType": "constructor",
        "index": 0,
        "fields": [
          {
            "title": "transaction_id",
            "$ref": "#/definitions/ByteArray"
          },
          {
            "title": "output_index",
            "$ref": "#/definitions/Int"
          }
        ]
      }]
    }
  }
}
```

**Nota importante:** `transaction_id` es `ByteArray`, NO string. Esto podría ser la causa del problema.

---

### 5. Prueba con Scripts Alternativos

**Plan:**
```typescript
// Test A: Pasar parámetros raw (sin Data.to)
const mintingScript = applyParamsToScript(nft_code, [
  ownerUtxo.txHash,  // String directo
  tokenNameHex       // Hex directo
]);

// Test B: Usar schema de Lucid Evolution
import { OutRef } from "@lucid-evolution/lucid";
const utxoRef: OutRef = {
  txHash: ownerUtxo.txHash,
  outputIndex: ownerUtxo.outputIndex
};
const mintingScript = applyParamsToScript(nft_code, [utxoRef, tokenNameHex]);

// Test C: Manual CBOR encoding
import { encode } from "cbor";
const utxoRefCbor = encode([ownerUtxo.txHash, ownerUtxo.outputIndex]);
const mintingScript = applyParamsToScript(nft_code, [utxoRefCbor, tokenNameHex]);
```

---

## 🛠️ Workarounds Disponibles

### Workaround 1: Native Script para NFT Minting

**Descripción:** Usar native script en lugar de Plutus V3 para mintear NFTs.

```typescript
import { scriptFromNative, paymentCredentialOf } from "@lucid-evolution/lucid";

const mintingPolicy = scriptFromNative({
  type: "all",
  scripts: [
    {
      type: "sig",
      keyHash: paymentCredentialOf(operatorAddress).hash,
    },
  ],
});
```

**Ventajas:**
- ✅ Funciona inmediatamente
- ✅ No requiere investigación adicional
- ✅ Más simple de implementar

**Desventajas:**
- ❌ Menos seguro (no es one-time mint)
- ❌ Policy ID diferente que el diseñado
- ❌ No sigue el patrón estándar de NFT único

**Recomendación:** Solo para desarrollo/testing, NO para producción.

---

### Workaround 2: Hardcodear Parámetros en el Validador

**Descripción:** Compilar el validador con parámetros fijos.

```aiken
// nft_hardcoded.ak

validator nft_hardcoded {
  mint(_r, policy_id: PolicyId, tx: Transaction) {
    let expected_utxo_ref = OutputReference {
      transaction_id: #"012034e1e87db6e356dda5022e61979beabdbe986d6f2b6df0c946422f773288",
      output_index: 0
    }

    let expected_token_name = #"53454e534f525f544553545f3031"  // "SENSOR_TEST_01"

    // ... validación
  }
}
```

**Ventajas:**
- ✅ Evita el problema de parámetros
- ✅ Funcionaría con Lucid Evolution

**Desventajas:**
- ❌ Requiere recompilar para cada NFT
- ❌ No escalable
- ❌ Impractical para producción

**Recomendación:** NO usar - solo para confirmar que la lógica del validador es correcta.

---

### Workaround 3: Usar MeshJS para Minting

**Descripción:** Volver a MeshJS solo para minting (no spending).

**Razón:** El bug de MeshJS es con SPENDING de Plutus V3, no con MINTING.

**Investigar:**
- [ ] ¿MeshJS puede mintear con Plutus V3 parametrizado?
- [ ] ¿El error "Cannot convert undefined to BigInt" ocurre también en minting?
- [ ] Probar `mint_sensor_nft.ts` con MeshJS

**Si funciona:**
- ✅ Arquitectura híbrida: MeshJS para mint/create, Lucid para update/spend
- ✅ Mantiene el diseño de one-time policy
- ✅ No requiere cambios en el validador

---

## 📚 Referencias y Recursos

### Documentación Oficial

- **Lucid Evolution:** https://github.com/Anastasia-Labs/lucid-evolution
- **Lucid Evolution Docs:** https://anastasia-labs.github.io/lucid-evolution/
- **Aiken Language:** https://aiken-lang.org/
- **Aiken Stdlib:** https://aiken-lang.github.io/stdlib/

### Issues Relacionados

- GitHub Issue: *[Buscar en Lucid Evolution issues sobre parameter application]*
- Cardano Stack Exchange: *[Buscar preguntas sobre applyParamsToScript]*

### Archivos del Proyecto

- **Validador Aiken:** `onchain/sensors-oracle/validators/nft.ak`
- **Scripts de prueba:** `offchain/transactions/mint_nft_v{1,2,3,4}_test.ts`
- **Plutus.json:** `onchain/sensors-oracle/plutus.json`
- **Documentación MeshJS issue:** `docs/MESHJS_PLUTUS_V3_ISSUE.md`

---

## ✅ Próximos Pasos

### Inmediato (Hoy)

1. [ ] Investigar formato correcto de `OutputReference` en Lucid Evolution
2. [ ] Buscar ejemplos exitosos de minting parametrizado en GitHub
3. [ ] Probar variaciones de serialización de parámetros
4. [ ] Comparar con definiciones de plutus.json

### Corto Plazo (1-2 días)

5. [ ] Si encontramos el formato correcto → Actualizar scripts y probar
6. [ ] Si no → Contactar equipo de Lucid Evolution con evidencia
7. [ ] Si no hay respuesta → Evaluar usar MeshJS para minting

### Medio Plazo (1 semana)

8. [ ] Decidir arquitectura final (Lucid vs MeshJS vs híbrido)
9. [ ] Implementar solución permanente
10. [ ] Documentar formato correcto de parámetros para futuros proyectos

---

## 🎓 Lecciones Aprendidas

### Metodología de Debug

1. **Aislar progresivamente:** Crear validadores cada vez más complejos
2. **Probar con datos conocidos:** Native script primero confirma la infraestructura
3. **Evitar cambios múltiples:** Cambiar una cosa a la vez
4. **Documentar todo:** Cada experimento debe ser reproducible

### Sobre Plutus V3 y Lucid Evolution

1. **Los parámetros son complejos:** No basta con `Data.to()`, hay que entender el formato esperado
2. **Los tipos importan:** `ByteArray`, `Int`, `OutputReference` tienen formatos específicos
3. **Las comparaciones son críticas:** Un parámetro mal formado crashea durante comparación
4. **La documentación puede ser incompleta:** A veces hay que leer el código fuente

---

## 📝 Conclusión Actual

**Estado:** El problema está **claramente identificado** pero **no resuelto**.

**Sabemos:**
- ✅ Lucid Evolution funciona correctamente
- ✅ Los parámetros se aplican al script
- ✅ El validador puede acceder a datos de transacción
- ❌ **Los parámetros no están en el formato correcto para comparaciones**

**Necesitamos:**
- Entender el formato exacto esperado por `applyParamsToScript()`
- Encontrar ejemplos exitosos de uso
- O confirmar que hay un bug en Lucid Evolution/Aiken/Plutus V3

**Siguiente acción:** Investigar formato correcto de parámetros (ver sección "Investigación Pendiente").
