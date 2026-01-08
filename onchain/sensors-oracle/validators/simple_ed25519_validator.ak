use aiken/builtin
use aiken/crypto.{VerificationKey, verify_ed25519_signature}
use cardano/transaction.{OutputReference, Transaction}

/// Datum simple para testing de Ed25519
/// Contiene el mensaje y la firma
pub type Ed25519Data {
  message: ByteArray,
  signature: ByteArray,
  public_key: VerificationKey,
}

/// Validador simple: solo verifica firma Ed25519 sobre hash SHA-256
///
/// Este validador es para PROBAR si MeshJS puede consumir UTXOs
/// con Ed25519 en PlutusV3.
///
/// IMPORTANTE: Verifica firma sobre el HASH SHA-256 del mensaje
/// Esto evita problemas con mensajes que contienen bytes nulos
///
/// Verificaciones:
/// - Firma Ed25519 válida sobre hash SHA-256
/// - Sin lógica de negocio compleja
validator simple_ed25519 {
  spend(
    datum: Option<Ed25519Data>,
    _redeemer: Void,
    _own_ref: OutputReference,
    _tx: Transaction,
  ) -> Bool {
    expect Some(data) = datum

    // Calcular hash SHA-256 del mensaje
    let message_hash = builtin.sha2_256(data.message)

    // Verificar que la firma sea válida sobre el HASH
    verify_ed25519_signature(
      data.public_key,
      message_hash,
      data.signature,
    )
  }

  else(_) {
    fail
  }
}
