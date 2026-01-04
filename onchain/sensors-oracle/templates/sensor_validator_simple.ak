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

// ============================================================================
// Tests
// ============================================================================

test test_valid_signature() {
  // Datos de prueba reales del ESP32
  let public_key =
    #"D27CBD596D2272C63502D6A186C09D9D8101DD3448CB367E3B28DDF1A9D66E4140D3C4D11DF201EB1E6E512054414B49B82B13024A1202D0DAC8FB4253E988E8"
  let hash =
    #"ABDD6FCAE1168AAB0278BC7E5D0B86671F720AEC6BB00CBF070C6136BC0ACAC7"
  let signature =
    #"6FA9ADECE1E8BE3CDD34440964F2CF5AEF460480F7A96C75A7367A4B4D1D360ABE20856DE311EB357337B896A0C137295FB8F5223F65AEEC33275DC9E3AED9D2"

  // Verificar que la firma es válida
  builtin.verify_ecdsa_secp256k1_signature(public_key, hash, signature)
}

test test_valid_signature_2() {
  // Segunda firma válida del ESP32
  let public_key =
    #"D27CBD596D2272C63502D6A186C09D9D8101DD3448CB367E3B28DDF1A9D66E4140D3C4D11DF201EB1E6E512054414B49B82B13024A1202D0DAC8FB4253E988E8"
  let hash =
    #"ABDD6FCAE1168AAB0278BC7E5D0B86671F720AEC6BB00CBF070C6136BC0ACAC7"
  let signature =
    #"A4B333E09816BFD4AF040C1245BC61DF335A109A23EDF760D22641DCC06554A17BD74CC5DA223CEA1693931E7624462268DB0466B11D9461FD4BA3B98703BC61"

  builtin.verify_ecdsa_secp256k1_signature(public_key, hash, signature)
}

test test_invalid_signature() fail {
  // Firma inválida (último dígito modificado)
  let public_key =
    #"D27CBD596D2272C63502D6A186C09D9D8101DD3448CB367E3B28DDF1A9D66E4140D3C4D11DF201EB1E6E512054414B49B82B13024A1202D0DAC8FB4253E988E8"
  let hash =
    #"ABDD6FCAE1168AAB0278BC7E5D0B86671F720AEC6BB00CBF070C6136BC0ACAC7"
  let signature =
    #"6FA9ADECE1E8BE3CDD34440964F2CF5AEF460480F7A96C75A7367A4B4D1D360ABE20856DE311EB357337B896A0C137295FB8F5223F65AEEC33275DC9E3AED9D3"

  // Esta firma debe fallar porque está modificada
  builtin.verify_ecdsa_secp256k1_signature(public_key, hash, signature)
}

test test_wrong_public_key() fail {
  // Clave pública incorrecta
  let wrong_public_key =
    #"0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
  let hash =
    #"ABDD6FCAE1168AAB0278BC7E5D0B86671F720AEC6BB00CBF070C6136BC0ACAC7"
  let signature =
    #"6FA9ADECE1E8BE3CDD34440964F2CF5AEF460480F7A96C75A7367A4B4D1D360ABE20856DE311EB357337B896A0C137295FB8F5223F65AEEC33275DC9E3AED9D2"

  // Debe fallar porque la clave pública no corresponde a la firma
  builtin.verify_ecdsa_secp256k1_signature(wrong_public_key, hash, signature)
}

test test_wrong_hash() fail {
  // Hash incorrecto
  let public_key =
    #"D27CBD596D2272C63502D6A186C09D9D8101DD3448CB367E3B28DDF1A9D66E4140D3C4D11DF201EB1E6E512054414B49B82B13024A1202D0DAC8FB4253E988E8"
  let wrong_hash =
    #"0000000000000000000000000000000000000000000000000000000000000000"
  let signature =
    #"6FA9ADECE1E8BE3CDD34440964F2CF5AEF460480F7A96C75A7367A4B4D1D360ABE20856DE311EB357337B896A0C137295FB8F5223F65AEEC33275DC9E3AED9D2"

  // Debe fallar porque el hash no corresponde a la firma
  builtin.verify_ecdsa_secp256k1_signature(public_key, wrong_hash, signature)
}
