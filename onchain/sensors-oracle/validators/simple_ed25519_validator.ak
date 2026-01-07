use aiken/crypto.{VerificationKey, verify_ed25519_signature}
use cardano/transaction.{OutputReference, Transaction}

/// Datum simple para testing de Ed25519
/// Contiene el mensaje y la firma
pub type Ed25519Data {
  message: ByteArray,
  signature: ByteArray,
  public_key: VerificationKey,
}

/// Validador simple: solo verifica firma Ed25519
///
/// Este validador es para PROBAR si MeshJS puede consumir UTXOs
/// con Ed25519 en PlutusV3.
///
/// Verificaciones:
/// - Firma Ed25519 válida
/// - Sin lógica de negocio compleja
validator simple_ed25519 {
  spend(
    datum: Option<Ed25519Data>,
    _redeemer: Void,
    _own_ref: OutputReference,
    _tx: Transaction,
  ) -> Bool {
    expect Some(data) = datum

    // Verificar que la firma sea válida
    verify_ed25519_signature(
      data.public_key,
      data.message,
      data.signature,
    )
  }

  else(_) {
    fail
  }
}
