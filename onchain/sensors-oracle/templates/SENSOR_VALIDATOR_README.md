# Sensor Validator - Validador ECDSA secp256k1

Este validador verifica firmas criptográficas ECDSA secp256k1 generadas por dispositivos ESP32/Arduino en la blockchain de Cardano.

## Arquitectura

```
ESP32 (sign_device.ino) → Genera ECDSA secp256k1 signature
                           ↓
                     Backend (verifica off-chain)
                           ↓
                     Smart Contract (verifica on-chain)
```

## Datos del ESP32

El ESP32 genera:
- **hash**: SHA-256 del mensaje (32 bytes)
- **signature**: Firma ECDSA secp256k1 (64 bytes)
- **public_key**: Clave pública secp256k1 (64 bytes sin comprimir)

### Ejemplo de datos reales (test-data/signed_msgs.txt)

```
PUB_KEY: D27CBD596D2272C63502D6A186C09D9D8101DD3448CB367E3B28DDF1A9D66E4140D3C4D11DF201EB1E6E512054414B49B82B13024A1202D0DAC8FB4253E988E8
HASH:    ABDD6FCAE1168AAB0278BC7E5D0B86671F720AEC6BB00CBF070C6136BC0ACAC7
SIG:     6FA9ADECE1E8BE3CDD34440964F2CF5AEF460480F7A96C75A7367A4B4D1D360ABE20856DE311EB357337B896A0C137295FB8F5223F65AEEC33275DC9E3AED9D2
```

## Tipos de datos

### SensorReading
```aiken
pub type SensorReading {
  sensor_id: ByteArray,     // ID del sensor
  hash: ByteArray,          // SHA-256 hash (32 bytes)
  signature: ByteArray,     // ECDSA signature (64 bytes)
  public_key: ByteArray,    // Public key (64 bytes)
  timestamp: Int,           // Unix timestamp
}
```

### SensorAction (Redeemer)
```aiken
pub type SensorAction {
  SubmitReading { reading: SensorReading }
  Delete
}
```

## Validaciones

El validador verifica:

1. **Longitudes correctas**:
   - Hash: 32 bytes (SHA-256)
   - Signature: 64 bytes (ECDSA secp256k1)
   - Public key: 64 bytes (uncompressed)

2. **Timestamp válido**: Debe ser > 0

3. **Firma criptográfica**: Usa `crypto.verify_ecdsa_secp256k1_signature()`
   - Verifica que la firma corresponda al hash
   - Verifica que fue firmado con la clave privada correspondiente a public_key

4. **Sensor ID**: No puede estar vacío

## Uso desde MeshJS/TypeScript

```typescript
import { Transaction } from '@meshsdk/core';

// Datos del ESP32
const sensorReading = {
  sensor_id: "ESP32_001",
  hash: "ABDD6FCAE1168AAB0278BC7E5D0B86671F720AEC6BB00CBF070C6136BC0ACAC7",
  signature: "6FA9ADECE1E8BE3CDD34440964F2CF5AEF460480F7A96C75A7367A4B4D1D360ABE20856DE311EB357337B896A0C137295FB8F5223F65AEEC33275DC9E3AED9D2",
  public_key: "D27CBD596D2272C63502D6A186C09D9D8101DD3448CB367E3B28DDF1A9D66E4140D3C4D11DF201EB1E6E512054414B49B82B13024A1202D0DAC8FB4253E988E8",
  timestamp: 1735987200
};

// Construir redeemer
const redeemer = {
  SubmitReading: {
    reading: sensorReading
  }
};

// Construir transacción
const tx = new Transaction({ initiator: wallet })
  .redeemValue({
    value: scriptUtxo,
    script: {
      version: "V3",
      code: validatorScript
    },
    redeemer: redeemer
  })
  .sendLovelace(
    recipientAddress,
    "1500000"
  );

const unsignedTx = await tx.build();
const signedTx = await wallet.signTx(unsignedTx);
const txHash = await wallet.submitTx(signedTx);
```

## Construcción

```bash
cd onchain/sensors-oracle
aiken build
```

El script compilado estará en `plutus.json`.

## Notas de seguridad

- ✅ Usa criptografía de curva elíptica secp256k1 (misma que Bitcoin)
- ✅ Verificación on-chain completa de firmas
- ✅ No requiere confianza en intermediarios
- ⚠️ La clave privada del ESP32 debe mantenerse segura
- ⚠️ Cada ESP32 debería tener su propia clave privada única
