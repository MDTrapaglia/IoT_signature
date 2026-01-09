use aiken/collection/dict.{to_pairs}
use cardano/assets.{PolicyId, tokens}
use cardano/transaction.{OutputReference, Transaction}

// TEST VERSION 2: Only check that exactly 1 token is minted
// This tests if the issue is with accessing the mint field or checking quantity
validator nft_v2_check_quantity(utxo_ref: OutputReference, token_name: ByteArray) {
  mint(_r, policy_id: PolicyId, tx: Transaction) {
    let Transaction { mint, .. } = tx

    // Check exactly 1 token is minted (any name)
    expect [Pair(_asset_name, 1)] = mint |> tokens(policy_id) |> to_pairs()

    True
  }

  else(_) {
    fail
  }
}
