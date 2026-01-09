# Lucid Evolution - Solución al Problema de Minting Parametrizado

**Fecha:** 2026-01-09
**Estado:** ✅ RESUELTO
**Transacción de prueba:** `12d5d58e6f0aa373f2731997bef62a2c1e75eca1dc6fd970fa11842e0d223e3a`

---

## 🎉 Solución Encontrada

### El Problema

Los minting policies Plutus V3 parametrizados fallaban con el error:
```
failed script execution Mint[0] the validator crashed / exited prematurely
```

### La Causa

**Estábamos usando `Data.to()` incorrectamente para serializar los parámetros del script.**

### La Solución

**NO usar `Data.to()` al pasar parámetros a `applyParamsToScript()`**. Los parámetros deben pasarse como `Constr` directamente.

---

## ✅ Código Correcto

### Antes (❌ INCORRECTO)

```typescript
// ❌ NO HACER ESTO
const utxoRefData = Data.to(
  new Constr(0, [ownerUtxo.txHash, BigInt(ownerUtxo.outputIndex)])
);
const tokenNameData = Data.to(tokenNameHex);

const mintingScript = applyParamsToScript(nft_code, [utxoRefData, tokenNameData]);
```

### Después (✅ CORRECTO)

```typescript
// ✅ HACER ESTO
const oRef = new Constr(0, [String(ownerUtxo.txHash), BigInt(ownerUtxo.outputIndex)]);

const mintingScript = applyParamsToScript(nft_code, [
  oRef,         // OutputReference - sin Data.to()
  tokenNameHex  // ByteArray - sin Data.to()
]);
```

---

## 📋 Formato de Parámetros

### OutputReference

```typescript
// Aiken definition
type OutputReference {
  transaction_id: ByteArray,
  output_index: Int,
}

// Lucid Evolution - Correcto
const oRef = new Constr(0, [
  String(utxo.txHash),      // transaction_id como String
  BigInt(utxo.outputIndex)  // output_index como BigInt
]);
```

**Puntos clave:**
- Constructor index: `0`
- `txHash`: usar `String()` (aunque ya es string, es explícito)
- `outputIndex`: usar `BigInt()`
- **NO** envolver con `Data.to()`

### ByteArray

```typescript
// Aiken definition
token_name: ByteArray

// Lucid Evolution - Correcto
import { fromText } from "@lucid-evolution/lucid";

const tokenNameHex = fromText("SENSOR_TEST_01");
// tokenNameHex = "53454e534f525f544553545f3031"

// Pasar directamente a applyParamsToScript
const mintingScript = applyParamsToScript(code, [oRef, tokenNameHex]);
```

**Puntos clave:**
- Usar `fromText()` para convertir string a hex
- Pasar el hex string directamente
- **NO** envolver con `Data.to()`

---

## 🧪 Prueba de la Solución

### Script Completo

```typescript
import { Blockfrost, Lucid, Data, applyParamsToScript, Constr, mintingPolicyToId, fromText } from "@lucid-evolution/lucid";

async function mintNFT() {
  // 1. Inicializar Lucid
  const lucid = await Lucid(
    new Blockfrost("https://cardano-preprod.blockfrost.io/api/v0", API_KEY),
    "Preprod"
  );

  // 2. Cargar wallet
  lucid.selectWallet.fromPrivateKey(privateKey);

  // 3. Obtener UTXO para parámetros
  const utxos = await lucid.wallet().getUtxos();
  const ownerUtxo = utxos[0];

  // 4. Preparar parámetros CORRECTAMENTE
  const oRef = new Constr(0, [
    String(ownerUtxo.txHash),
    BigInt(ownerUtxo.outputIndex)
  ]);

  const tokenNameHex = fromText("SENSOR_TEST_01");

  // 5. Aplicar parámetros SIN Data.to()
  const mintingScript = applyParamsToScript(nft_code, [oRef, tokenNameHex]);

  // 6. Crear minting policy
  const mintingPolicy = {
    type: "PlutusV3" as const,
    script: mintingScript
  };

  const policyId = mintingPolicyToId(mintingPolicy);
  const nftUnit = policyId + tokenNameHex;

  // 7. Construir transacción
  const redeemer = Data.to(new Constr(0, []));  // Redeemer SÍ usa Data.to()

  const tx = await lucid
    .newTx()
    .collectFrom([ownerUtxo])  // IMPORTANTE: consumir el UTXO de los parámetros
    .attach.MintingPolicy(mintingPolicy)
    .mintAssets({ [nftUnit]: BigInt(1) }, redeemer)
    .complete();

  // 8. Firmar y enviar
  const signedTx = await tx.sign.withWallet().complete();
  const txHash = await signedTx.submit();

  return txHash;
}
```

### Resultado

✅ **Transacción exitosa:** `12d5d58e6f0aa373f2731997bef62a2c1e75eca1dc6fd970fa11842e0d223e3a`

**Explorer:** https://preprod.cardanoscan.io/transaction/12d5d58e6f0aa373f2731997bef62a2c1e75eca1dc6fd970fa11842e0d223e3a

---

## 📚 Documentación Oficial

La solución está basada en la documentación oficial de Lucid Evolution:

**Fuente:** https://github.com/anastasia-labs/lucid-evolution/blob/main/docs/pages/documentation/deep-dives/validator-interactions/advanced/applying-parameters.mdx

**Ejemplo relevante:**
```typescript
const oRef = new Constr(0, [String(utxo.txHash), BigInt(utxo.outputIndex)]);

const yourValidator = {
  type: "PlutusV3",
  script: applyParamsToScript(
    "5907945907910102...", // CBOR
    [oRef] // Parameters - sin Data.to()
  ),
};
```

---

## 🔍 Por Qué Funcionó

### Análisis del Problema

1. **V1 (Always True):** ✅ Funcionaba porque no usaba los parámetros en comparaciones
2. **V2 (Check Quantity):** ✅ Funcionaba porque solo accedía a `tx.mint`
3. **V3 (Check UTXO):** ❌ Fallaba al comparar `input.output_reference == utxo_ref`
4. **V4 (Check Token Name):** ❌ Fallaba al comparar `asset_name == token_name`

### La Diferencia Clave

```typescript
// ❌ INCORRECTO - Double encoding
const param = Data.to(new Constr(0, [...]));  // Serializa a Plutus Data
applyParamsToScript(code, [param]);           // Serializa de nuevo → error

// ✅ CORRECTO - Single encoding
const param = new Constr(0, [...]);           // Solo construye la estructura
applyParamsToScript(code, [param]);           // Serializa una vez
```

**`applyParamsToScript()` YA hace la serialización internamente.** Si pasamos datos ya serializados con `Data.to()`, se produce un "double encoding" que resulta en un formato incorrecto para las comparaciones on-chain.

---

## ⚠️ Cuándo Usar Data.to()

### ❌ NO usar Data.to() para:

1. **Parámetros de `applyParamsToScript()`**
   ```typescript
   // ❌ NO
   applyParamsToScript(code, [Data.to(param)]);

   // ✅ SÍ
   applyParamsToScript(code, [param]);
   ```

2. **Datums inline (en algunos casos)**
   - Depende del contexto, revisar documentación

### ✅ SÍ usar Data.to() para:

1. **Redeemers**
   ```typescript
   const redeemer = Data.to(new Constr(0, []));
   .mintAssets({ ... }, redeemer)  // ✅ Correcto
   ```

2. **Datums cuando se pasan a transaction builders**
   ```typescript
   const datum = Data.to(new Constr(0, [...]));
   .pay.ToAddressWithData(addr, datum, ...)  // ✅ Correcto
   ```

---

## 🎓 Lecciones Aprendidas

### 1. Leer la Documentación Oficial

La solución estaba en la documentación oficial de Lucid Evolution. Siempre:
- Buscar ejemplos oficiales primero
- Comparar con código propio
- Verificar cada paso

### 2. Metodología de Debug Progresivo

Crear validadores incrementalmente más complejos fue clave para aislar el problema:
1. V1: Always True → Confirma infraestructura
2. V2: Check quantity → Confirma acceso a datos de tx
3. V3/V4: Check comparisons → **Identifica el problema**

### 3. Entender Serialización de Plutus Data

`Data.to()` NO es una función mágica que "arregla" los datos. Es una función de serialización específica que:
- Convierte estructuras de TypeScript a Plutus Data CBOR
- Debe usarse en contextos específicos
- **NO debe usarse cuando `applyParamsToScript()` ya hace la serialización**

---

## 📝 Checklist para Minting Parametrizado

Cuando implementes minting policies Plutus V3 parametrizados:

- [ ] Compilar el validador Aiken correctamente
- [ ] Obtener UTXO para parámetros
- [ ] Crear OutputReference con `new Constr(0, [String(txHash), BigInt(outputIndex)])`
- [ ] Crear ByteArray con `fromText()` para strings
- [ ] **NO usar `Data.to()` en parámetros**
- [ ] Aplicar parámetros con `applyParamsToScript(code, [oRef, tokenName])`
- [ ] Crear minting policy con tipo "PlutusV3"
- [ ] Construir asset unit como `policyId + assetNameHex`
- [ ] **SÍ usar `Data.to()` en redeemer**
- [ ] **IMPORTANTE:** Consumir el UTXO de los parámetros con `.collectFrom([ownerUtxo])`
- [ ] Completar, firmar y enviar transacción

---

## 🔗 Referencias

### Documentación
- **Lucid Evolution Parameter Application:** https://github.com/anastasia-labs/lucid-evolution/blob/main/docs/pages/documentation/deep-dives/validator-interactions/advanced/applying-parameters.mdx
- **Lucid Evolution Minting:** https://github.com/anastasia-labs/lucid-evolution/blob/main/docs/pages/documentation/deep-dives/mint-burn-assets.mdx
- **Aiken Language:** https://aiken-lang.org/

### Archivos del Proyecto
- **Validador correcto:** `onchain/sensors-oracle/validators/nft.ak`
- **Script correcto:** `offchain/transactions/mint_nft_fixed.ts`
- **Tests progresivos:** `offchain/transactions/mint_nft_v{1,2,3,4}_test.ts`
- **Documentación del problema:** `docs/LUCID_EVOLUTION_MINTING_ISSUE.md`

### Transacciones de Prueba
- **V1 (Always True):** `83ea4cba5b3edd952e356c679c538eae654c79d327c3511c44ace9514f492bd8`
- **V2 (Check Quantity):** `65d26795ddb738f44f21fd0b82823ff4354ba093c6f574c0eab0d9e41b4628c6`
- **Fixed (Token Name Check):** `12d5d58e6f0aa373f2731997bef62a2c1e75eca1dc6fd970fa11842e0d223e3a` ⭐

---

## ✅ Conclusión

**Problema identificado y resuelto:**
- El error era usar `Data.to()` en parámetros de `applyParamsToScript()`
- La solución es pasar `Constr` directamente sin serialización extra
- El validador Aiken era correcto desde el principio
- Lucid Evolution funciona perfectamente cuando se usa correctamente

**Próximo paso:** Actualizar todos los scripts de oracle (mint, create, update, delete) con el formato correcto de parámetros.
