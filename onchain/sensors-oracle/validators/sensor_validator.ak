use aiken/builtin
use aiken/primitive/bytearray
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

/// Validador que verifica firmas ECDSA secp256k1 del ESP32
validator sensor_validator {
  spend(
    _datum: Option<Data>,
    redeemer: SensorAction,
    _utxo_ref: OutputReference,
    tx: Transaction,
  ) {
    when redeemer is {
      SubmitReading { reading } -> {
        // Validar longitudes de los datos
        expect bytearray.length(reading.hash) == 32
        expect bytearray.length(reading.signature) == 64
        expect bytearray.length(reading.public_key) == 64

        // Validar timestamp (debe ser positivo)
        expect reading.timestamp > 0

        // Verificar la firma ECDSA secp256k1
        // Esta función retorna True si la firma es válida
        let signature_valid =
          builtin.verify_ecdsa_secp256k1_signature(
            reading.public_key,
            reading.hash,
            reading.signature,
          )

        // Validar que el sensor_id no esté vacío
        expect bytearray.length(reading.sensor_id) > 0

        // La firma debe ser válida para que la transacción sea exitosa
        signature_valid
      }

      Delete -> {
        // Permitir eliminación sin restricciones adicionales
        True
      }
    }
  }

  else(_) {
    fail @"Unsupported action"
  }
}
