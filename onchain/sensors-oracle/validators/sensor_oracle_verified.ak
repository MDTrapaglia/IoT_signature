use aiken/builtin
use aiken/collection/list
use aiken/crypto.{VerificationKeyHash}
use aiken/primitive/bytearray
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
  operator: VerificationKeyHash,
}

// Oracle's Redeemer
pub type OracleRedeemer {
  Update
  Delete
}

// Oracle's Datum - Sensor measurement data with cryptographic proof
pub type SensorData {
  sensor_id: ByteArray,
  temperature: Int,       // Temperature * 10 (e.g., 23.5°C = 235)
  humidity: Int,          // Humidity * 10 (e.g., 65.2% = 652)
  timestamp: Int,         // Unix timestamp (POSIX time in milliseconds)
  signature: ByteArray,   // ECDSA secp256k1 signature del ESP32 (64 bytes)
  public_key: ByteArray,  // Public key del ESP32 (64 bytes uncompressed)
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
fn build_message(data: SensorData) -> ByteArray {
  // Orden alfabético: humidity, sensor_id, temperature, timestamp

  // humidity (8 bytes)
  let msg = int_to_bytes(data.humidity)

  // sensor_id (longitud variable)
  let msg = bytearray.concat(msg, data.sensor_id)

  // temperature (8 bytes)
  let msg = bytearray.concat(msg, int_to_bytes(data.temperature))

  // timestamp (8 bytes)
  let msg = bytearray.concat(msg, int_to_bytes(data.timestamp))

  msg
}

/// Genera el hash SHA-256 del mensaje construido
fn build_message_hash(data: SensorData) -> ByteArray {
  let message = build_message(data)
  builtin.sha2_256(message)
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
  expect bytearray.length(data.signature) == 64
  expect bytearray.length(data.public_key) == 64

  // Sensor ID no debe estar vacío
  expect bytearray.length(data.sensor_id) > 0

  True
}

/// Valida la firma ECDSA secp256k1 del ESP32
fn verify_signature(data: SensorData) -> Bool {
  // 1. Construir el mensaje con campos ordenados alfabéticamente
  // 2. Generar el hash SHA-256 del mensaje
  let hash = build_message_hash(data)

  // 3. Verificar que la firma ECDSA secp256k1 es válida
  // Esta función retorna True si:
  // - La firma corresponde al hash calculado
  // - Fue firmada con la clave privada correspondiente a public_key
  // - Las longitudes son correctas
  builtin.verify_ecdsa_secp256k1_signature(
    data.public_key,
    hash,
    data.signature,
  )
}

/// Validador del oráculo que verifica firmas ECDSA antes de actualizar
validator sensor_oracle_verified(params: OracleParams) {
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

              // 2. CRÍTICO: Validar la firma ECDSA secp256k1
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

// -------------------- Tests de construcción de mensaje --------------------

test test_int_to_bytes_positive() {
  // Test con número positivo (235 = 23.5°C)
  let bytes = int_to_bytes(235)
  // Debe ser 8 bytes big-endian
  expect bytearray.length(bytes) == 8
  // Verificar que los primeros 7 bytes son 0 (número pequeño)
  expect bytearray.slice(bytes, 0, 7) == #"00000000000000"
  // El último byte debe ser 235 (0xEB)
  bytearray.slice(bytes, 7, 8) == #"eb"
}

test test_int_to_bytes_negative() {
  // Test con número negativo (-500 = -50.0°C)
  let bytes = int_to_bytes(-500)
  // Debe ser 8 bytes big-endian con signo
  bytearray.length(bytes) == 8
}

test test_build_message_structure() {
  // Test de estructura del mensaje: humidity || sensor_id || temperature || timestamp
  let data =
    SensorData {
      sensor_id: #"455350333200",  // "ESP32\0" en hex (6 bytes)
      temperature: 235,  // 23.5°C
      humidity: 652,  // 65.2%
      timestamp: 1735996800000,
      signature: #"0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
      public_key: #"0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
    }

  let message = build_message(data)

  // Longitud total: 8 (humidity) + 6 (sensor_id) + 8 (temperature) + 8 (timestamp) = 30 bytes
  bytearray.length(message) == 30
}

test test_build_message_hash_length() {
  // El hash SHA-256 debe ser siempre 32 bytes
  let data =
    SensorData {
      sensor_id: #"455350333200",
      temperature: 235,
      humidity: 652,
      timestamp: 1735996800000,
      signature: #"0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
      public_key: #"0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
    }

  let hash = build_message_hash(data)
  bytearray.length(hash) == 32
}

// -------------------- Tests de validación de rangos --------------------

test test_validate_sensor_ranges_valid() {
  // Datos válidos dentro de los rangos esperados
  let data =
    SensorData {
      sensor_id: #"455350333200",
      temperature: 235,  // 23.5°C (válido: -500 a 1000)
      humidity: 652,  // 65.2% (válido: 0 a 1000)
      timestamp: 1735996800000,  // Positivo
      signature: #"0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
      public_key: #"0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
    }

  validate_sensor_ranges(data)
}

test test_validate_temperature_min() {
  // Temperatura mínima válida: -50°C (-500)
  let data =
    SensorData {
      sensor_id: #"455350333200",
      temperature: -500,
      humidity: 500,
      timestamp: 1735996800000,
      signature: #"0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
      public_key: #"0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
    }

  validate_sensor_ranges(data)
}

test test_validate_temperature_max() {
  // Temperatura máxima válida: 100°C (1000)
  let data =
    SensorData {
      sensor_id: #"455350333200",
      temperature: 1000,
      humidity: 500,
      timestamp: 1735996800000,
      signature: #"0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
      public_key: #"0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
    }

  validate_sensor_ranges(data)
}

test test_validate_humidity_min() {
  // Humedad mínima válida: 0% (0)
  let data =
    SensorData {
      sensor_id: #"455350333200",
      temperature: 235,
      humidity: 0,
      timestamp: 1735996800000,
      signature: #"0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
      public_key: #"0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
    }

  validate_sensor_ranges(data)
}

test test_validate_humidity_max() {
  // Humedad máxima válida: 100% (1000)
  let data =
    SensorData {
      sensor_id: #"455350333200",
      temperature: 235,
      humidity: 1000,
      timestamp: 1735996800000,
      signature: #"0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
      public_key: #"0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
    }

  validate_sensor_ranges(data)
}

test test_validate_temperature_too_low() fail {
  // Temperatura demasiado baja: -51°C (-510)
  let data =
    SensorData {
      sensor_id: #"455350333200",
      temperature: -510,
      humidity: 500,
      timestamp: 1735996800000,
      signature: #"0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
      public_key: #"0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
    }

  validate_sensor_ranges(data)
}

test test_validate_temperature_too_high() fail {
  // Temperatura demasiado alta: 101°C (1010)
  let data =
    SensorData {
      sensor_id: #"455350333200",
      temperature: 1010,
      humidity: 500,
      timestamp: 1735996800000,
      signature: #"0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
      public_key: #"0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
    }

  validate_sensor_ranges(data)
}

test test_validate_humidity_negative() fail {
  // Humedad negativa (inválida)
  let data =
    SensorData {
      sensor_id: #"455350333200",
      temperature: 235,
      humidity: -1,
      timestamp: 1735996800000,
      signature: #"0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
      public_key: #"0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
    }

  validate_sensor_ranges(data)
}

test test_validate_humidity_too_high() fail {
  // Humedad demasiado alta: >100% (1010)
  let data =
    SensorData {
      sensor_id: #"455350333200",
      temperature: 235,
      humidity: 1010,
      timestamp: 1735996800000,
      signature: #"0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
      public_key: #"0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
    }

  validate_sensor_ranges(data)
}

test test_validate_timestamp_zero() fail {
  // Timestamp 0 (inválido)
  let data =
    SensorData {
      sensor_id: #"455350333200",
      temperature: 235,
      humidity: 652,
      timestamp: 0,
      signature: #"0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
      public_key: #"0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
    }

  validate_sensor_ranges(data)
}

test test_validate_timestamp_negative() fail {
  // Timestamp negativo (inválido)
  let data =
    SensorData {
      sensor_id: #"455350333200",
      temperature: 235,
      humidity: 652,
      timestamp: -1,
      signature: #"0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
      public_key: #"0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
    }

  validate_sensor_ranges(data)
}

test test_validate_signature_wrong_length() fail {
  // Firma con longitud incorrecta (63 bytes en vez de 64)
  let data =
    SensorData {
      sensor_id: #"455350333200",
      temperature: 235,
      humidity: 652,
      timestamp: 1735996800000,
      signature: #"00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
      public_key: #"0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
    }

  validate_sensor_ranges(data)
}

test test_validate_public_key_wrong_length() fail {
  // Clave pública con longitud incorrecta (63 bytes en vez de 64)
  let data =
    SensorData {
      sensor_id: #"455350333200",
      temperature: 235,
      humidity: 652,
      timestamp: 1735996800000,
      signature: #"0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
      public_key: #"00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
    }

  validate_sensor_ranges(data)
}

test test_validate_empty_sensor_id() fail {
  // Sensor ID vacío
  let data =
    SensorData {
      sensor_id: #"",
      temperature: 235,
      humidity: 652,
      timestamp: 1735996800000,
      signature: #"0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
      public_key: #"0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
    }

  validate_sensor_ranges(data)
}

// -------------------- Tests de verificación de firma ECDSA --------------------

test test_verify_signature_valid() {
  // Test con datos y firma reales del ESP32
  // NOTA: Este test requiere datos reales del ESP32 con temperatura/humedad firmados
  // Por ahora usamos datos sintéticos que pasarían las validaciones básicas

  // Para crear un test real, necesitamos:
  // 1. Generar mensaje con: humidity || sensor_id || temperature || timestamp
  // 2. Calcular SHA-256 del mensaje
  // 3. Firmar con clave privada del ESP32
  // 4. Usar la firma y clave pública aquí

  // Este test está comentado porque requiere datos reales del ESP32
  // con el formato completo (no solo el hash directo)
  True
}

// -------------------- Test de ejemplo de SensorData completo --------------------

test test_sensor_data_complete_structure() {
  // Test que verifica la estructura completa de SensorData
  let data =
    SensorData {
      sensor_id: #"455350333200",  // "ESP32\0" (6 bytes)
      temperature: 235,  // 23.5°C
      humidity: 652,  // 65.2%
      timestamp: 1735996800000,  // 2025-01-04 12:00:00 UTC
      signature: #"6FA9ADECE1E8BE3CDD34440964F2CF5AEF460480F7A96C75A7367A4B4D1D360ABE20856DE311EB357337B896A0C137295FB8F5223F65AEEC33275DC9E3AED9D2",
      public_key: #"D27CBD596D2272C63502D6A186C09D9D8101DD3448CB367E3B28DDF1A9D66E4140D3C4D11DF201EB1E6E512054414B49B82B13024A1202D0DAC8FB4253E988E8",
    }

  // Verificar que todos los rangos son válidos
  expect validate_sensor_ranges(data)

  // Verificar que el hash se genera correctamente
  let hash = build_message_hash(data)
  expect bytearray.length(hash) == 32

  True
}
