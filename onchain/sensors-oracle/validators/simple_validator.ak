use cardano/transaction.{OutputReference, Transaction}

/// Dato super simple: solo un número
pub type SimpleData {
  value: Int,
}

/// Validador ultra simple: solo verifica que value > 0
validator simple_test {
  spend(
    datum: Option<SimpleData>,
    _redeemer: Void,
    _own_ref: OutputReference,
    _tx: Transaction,
  ) -> Bool {
    expect Some(data) = datum

    // Solo verificar que el valor sea positivo
    data.value > 0
  }

  else(_) {
    fail
  }
}
