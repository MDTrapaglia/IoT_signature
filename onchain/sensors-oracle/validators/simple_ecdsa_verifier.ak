use aiken/builtin
use aiken/primitive/bytearray
use cardano/transaction.{OutputReference, Transaction}

/// Datos del sensor simplificados para prueba de ECDSA
pub type SimpleSensorData {
  sensor_id: ByteArray,
  temperature: Int,       // Temperature * 10 (e.g., 23.5°C = 235)
  humidity: Int,          // Humidity * 10 (e.g., 65.2% = 652)
  timestamp: Int,         // Unix timestamp (POSIX time in milliseconds)
  signature: ByteArray,   // ECDSA secp256k1 signature (64 bytes)
  public_key: ByteArray,  // Public key (64 bytes uncompressed)
}

/// Convierte un entero a ByteArray (8 bytes big-endian con signo)
/// Compatible con struct.pack('>q', n) en Python
fn int_to_bytes(n: Int) -> ByteArray {
  builtin.integer_to_bytearray(True, 8, n)
}

/// Construye el mensaje a partir de los campos del sensor ordenados alfabéticamente
/// Formato binario: humidity_bytes || sensor_id || temperature_bytes || timestamp_bytes
fn build_message(data: SimpleSensorData) -> ByteArray {
  // Orden alfabético: humidity, sensor_id, temperature, timestamp
  let msg = int_to_bytes(data.humidity)
  let msg = bytearray.concat(msg, data.sensor_id)
  let msg = bytearray.concat(msg, int_to_bytes(data.temperature))
  let msg = bytearray.concat(msg, int_to_bytes(data.timestamp))
  msg
}

/// Genera el hash SHA-256 del mensaje construido
fn build_message_hash(data: SimpleSensorData) -> ByteArray {
  let message = build_message(data)
  builtin.sha2_256(message)
}

/// Valida la firma ECDSA secp256k1
fn verify_signature(data: SimpleSensorData) -> Bool {
  let hash = build_message_hash(data)

  // Verificar firma ECDSA secp256k1
  builtin.verify_ecdsa_secp256k1_signature(data.public_key, hash, data.signature)
}

/// Validador simple: solo verifica que la firma ECDSA sea válida
/// Sin NFT, sin operador, sin complejidad adicional
/// Propósito: validar que la verificación ECDSA funciona on-chain
validator simple_verifier {
  spend(
    datum: Option<SimpleSensorData>,
    _redeemer: Void,
    _own_ref: OutputReference,
    _tx: Transaction,
  ) -> Bool {
    expect Some(data) = datum

    // Solo verificar la firma ECDSA
    verify_signature(data)
  }

  else(_) {
    fail
  }
}
