use cardano/assets.{PolicyId}
use cardano/transaction.{OutputReference, Transaction}

// TEST VERSION 1: Always succeed (no checks)
// This is the simplest possible minting policy to test if the issue
// is with the validation logic or with parameter passing
validator nft_v1_always_true(utxo_ref: OutputReference, token_name: ByteArray) {
  mint(_r, _policy_id: PolicyId, _tx: Transaction) {
    // Always succeed - no checks at all
    True
  }

  else(_) {
    fail
  }
}
