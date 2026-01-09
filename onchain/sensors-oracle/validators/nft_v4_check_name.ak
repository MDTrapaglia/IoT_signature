use aiken/collection/dict.{to_pairs}
use cardano/assets.{PolicyId, tokens}
use cardano/transaction.{OutputReference, Transaction}

// TEST VERSION 4: Only check token name matches (no UTXO check)
// This tests if the issue is with checking the token name
validator nft_v4_check_name(utxo_ref: OutputReference, token_name: ByteArray) {
  mint(_r, policy_id: PolicyId, tx: Transaction) {
    let Transaction { mint, .. } = tx

    // Check token name matches
    expect [Pair(asset_name, 1)] = mint |> tokens(policy_id) |> to_pairs()

    asset_name == token_name
  }

  else(_) {
    fail
  }
}
