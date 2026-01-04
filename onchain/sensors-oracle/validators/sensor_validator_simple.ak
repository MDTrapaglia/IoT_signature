use aiken/builtin
use cardano/transaction.{OutputReference, Transaction}

/// Datos del sensor firmados por el ESP32
pub type SensorReading {
  sensor_id: ByteArray,
  hash: ByteArray,        // SHA-256 hash del mensaje (32 bytes)
  signature: ByteArray,   // ECDSA secp256k1 signature (64 bytes)
  public_key: ByteArray,  // Public key del ESP32 (64 bytes uncompressed)
  timestamp: Int,         // Unix timestamp
}

/// Redeemer para el validador
pub type SensorAction {
  SubmitReading { reading: SensorReading }
  Delete
}

/// Validador simple que solo verifica la firma ECDSA secp256k1
validator sensor_validator_simple {
  spend(
    _datum: Option<Data>,
    redeemer: SensorAction,
    _utxo_ref: OutputReference,
    _tx: Transaction,
  ) {
    when redeemer is {
      SubmitReading { reading } -> {
        // Verificar la firma ECDSA secp256k1
        // La función verify_ecdsa_secp256k1_signature valida:
        // - Que la firma corresponda al hash
        // - Que fue firmada con la clave privada de public_key
        // - Longitudes correctas (hash: 32 bytes, signature: 64 bytes, public_key: 64 bytes)
        builtin.verify_ecdsa_secp256k1_signature(
          reading.public_key,
          reading.hash,
          reading.signature,
        )
      }

      Delete -> {
        // Permitir eliminación
        True
      }
    }
  }

  else(_) {
    fail @"Unsupported action"
  }
}
