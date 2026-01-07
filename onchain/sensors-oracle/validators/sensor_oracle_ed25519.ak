use aiken/builtin
use aiken/collection/list
use aiken/crypto.{VerificationKey, verify_ed25519_signature}
use cardano/assets.{AssetName, PolicyId, quantity_of}
use cardano/transaction.{
  DatumHash, InlineDatum, Input, NoDatum, Output, OutputReference, Transaction,
}

// Uniquely identify an NFT asset
pub type AssetClass {
  policy_id: PolicyId,
  name: AssetName,
}

// Script parameterized by NFT and operator
pub type OracleParams {
  nft: AssetClass,
  operator: VerificationKey,
}

// Oracle's Redeemer
pub type OracleRedeemer {
  Update
  Delete
}

// Oracle's Datum - Sensor measurement data with Ed25519 cryptographic proof
pub type SensorData {
  sensor_id: ByteArray,
  temperature: Int,       // Temperature * 10 (e.g., 23.5°C = 235)
  humidity: Int,          // Humidity * 10 (e.g., 65.2% = 652)
  timestamp: Int,         // Unix timestamp (POSIX time in milliseconds)
  signature: ByteArray,   // Ed25519 signature from ESP32 (64 bytes)
  public_key: ByteArray,  // Ed25519 public key from ESP32 (32 bytes)
}

/// Convierte un entero a ByteArray (8 bytes big-endian con signo)
/// Compatible con struct.pack('>q', n) en Python
fn int_to_bytes(n: Int) -> ByteArray {
  // Aiken usa representación big-endian de 8 bytes para enteros
  // Esto coincide con struct.pack('>q', n) en Python (signed 64-bit)
  builtin.integer_to_bytearray(True, 8, n)
}

/// Construye el mensaje a partir de los campos del sensor ordenados alfabéticamente
/// Formato binario: humidity_bytes || sensor_id || temperature_bytes || timestamp_bytes
/// Los enteros se codifican como 8 bytes big-endian
///
/// IMPORTANTE: Ed25519 firma el mensaje directamente (no el hash)
fn build_message(data: SensorData) -> ByteArray {
  // Orden alfabético: humidity, sensor_id, temperature, timestamp

  // humidity (8 bytes)
  let msg = int_to_bytes(data.humidity)

  // sensor_id (longitud variable)
  let msg = builtin.append_bytearray(msg, data.sensor_id)

  // temperature (8 bytes)
  let msg = builtin.append_bytearray(msg, int_to_bytes(data.temperature))

  // timestamp (8 bytes)
  let msg = builtin.append_bytearray(msg, int_to_bytes(data.timestamp))

  msg
}

/// Valida que los datos del sensor cumplan con los rangos esperados
fn validate_sensor_ranges(data: SensorData) -> Bool {
  // Temperatura válida: -50°C a 100°C (-500 a 1000 en formato *10)
  expect data.temperature >= -500 && data.temperature <= 1000

  // Humedad válida: 0% a 100% (0 a 1000 en formato *10)
  expect data.humidity >= 0 && data.humidity <= 1000

  // Timestamp debe ser positivo
  expect data.timestamp > 0

  // Validar longitudes de los datos criptográficos
  // Ed25519: signature = 64 bytes, public_key = 32 bytes
  expect builtin.length_of_bytearray(data.signature) == 64
  expect builtin.length_of_bytearray(data.public_key) == 32

  // Sensor ID no debe estar vacío
  expect builtin.length_of_bytearray(data.sensor_id) > 0

  True
}

/// Valida la firma Ed25519 del ESP32
/// Ed25519 firma el mensaje completo, no su hash SHA-256
fn verify_signature(data: SensorData) -> Bool {
  // 1. Construir el mensaje con campos ordenados alfabéticamente
  let message = build_message(data)

  // 2. Verificar que la firma Ed25519 es válida
  // Esta función retorna True si:
  // - La firma corresponde al mensaje
  // - Fue firmada con la clave privada correspondiente a public_key
  // - Las longitudes son correctas (32 bytes public_key, 64 bytes signature)
  verify_ed25519_signature(
    data.public_key,
    message,
    data.signature,
  )
}

/// Validador del oráculo que verifica firmas Ed25519 antes de actualizar
validator sensor_oracle_ed25519(params: OracleParams) {
  spend(
    _datum: Option<SensorData>,
    redeemer: OracleRedeemer,
    utxo_ref: OutputReference,
    tx: Transaction,
  ) {
    // Debe estar firmado por el operador
    expect list.has(tx.extra_signatories, params.operator)

    when redeemer is {
      Update -> {
        // Obtener el input del oráculo
        expect Some(oracle_input) =
          tx.inputs
            |> transaction.find_input(utxo_ref)

        // El input debe contener el NFT
        expect
          1 == quantity_of(
            oracle_input.output.value,
            params.nft.policy_id,
            params.nft.name,
          )

        // Obtener el output del oráculo
        expect [oracle_output] =
          list.filter(
            tx.outputs,
            fn(o) { o.address == oracle_input.output.address },
          )

        // El output debe contener el NFT
        expect
          1 == quantity_of(
            oracle_output.value,
            params.nft.policy_id,
            params.nft.name,
          )

        // Obtener y validar el datum del output
        expect
          when oracle_output.datum is {
            NoDatum -> fail @"Datum required"
            DatumHash(_) -> fail @"Datum should be inline"
            InlineDatum(d) -> {
              // Parsear el datum como SensorData
              expect sensor_data: SensorData = d

              // 1. Validar rangos de los datos del sensor
              expect validate_sensor_ranges(sensor_data)

              // 2. CRÍTICO: Validar la firma Ed25519
              // Solo se permite actualizar el oráculo si la firma es válida
              expect verify_signature(sensor_data)

              True
            }
          }
        True
      }

      Delete -> {
        // Permitir eliminación sin validaciones adicionales
        True
      }
    }
  }

  else(_) {
    fail @"Unsupported action"
  }
}

// ============================================================================
// Tests
// ============================================================================

test test_int_to_bytes_positive() {
  let bytes = int_to_bytes(235)
  builtin.length_of_bytearray(bytes) == 8
}

test test_build_message_structure() {
  let data =
    SensorData {
      sensor_id: #"455350333200",  // "ESP32\0" en hex (6 bytes)
      temperature: 235,  // 23.5°C
      humidity: 652,  // 65.2%
      timestamp: 1735996800000,
      signature: #"00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
      public_key: #"0000000000000000000000000000000000000000000000000000000000000000",  // 32 bytes
    }

  let message = build_message(data)

  // Longitud total: 8 (humidity) + 6 (sensor_id) + 8 (temperature) + 8 (timestamp) = 30 bytes
  builtin.length_of_bytearray(message) == 30
}

test test_validate_sensor_ranges_valid() {
  let data =
    SensorData {
      sensor_id: #"455350333200",
      temperature: 235,
      humidity: 652,
      timestamp: 1735996800000,
      signature: #"00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
      public_key: #"0000000000000000000000000000000000000000000000000000000000000000",
    }

  validate_sensor_ranges(data)
}

test test_validate_public_key_wrong_length() fail {
  // Ed25519 public key debe ser 32 bytes (no 64)
  let data =
    SensorData {
      sensor_id: #"455350333200",
      temperature: 235,
      humidity: 652,
      timestamp: 1735996800000,
      signature: #"00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
      public_key: #"00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",  // 64 bytes (incorrecto)
    }

  validate_sensor_ranges(data)
}

test test_validate_signature_wrong_length() fail {
  let data =
    SensorData {
      sensor_id: #"455350333200",
      temperature: 235,
      humidity: 652,
      timestamp: 1735996800000,
      signature: #"000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",  // 63 bytes
      public_key: #"0000000000000000000000000000000000000000000000000000000000000000",
    }

  validate_sensor_ranges(data)
}
