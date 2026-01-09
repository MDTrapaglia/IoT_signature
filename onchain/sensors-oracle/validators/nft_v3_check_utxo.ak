use aiken/collection/list
use cardano/assets.{PolicyId}
use cardano/transaction.{OutputReference, Transaction}

// TEST VERSION 3: Only check UTXO consumption (no token name or quantity check)
// This tests if the issue is with checking UTXO consumption
validator nft_v3_check_utxo(utxo_ref: OutputReference, token_name: ByteArray) {
  mint(_r, _policy_id: PolicyId, tx: Transaction) {
    let Transaction { inputs, .. } = tx

    // Only check if the transaction consumes the utxo_ref
    list.any(inputs, fn(input) { input.output_reference == utxo_ref })
  }

  else(_) {
    fail
  }
}
