use aiken/collection/list
use aiken/crypto.{VerificationKeyHash}
use cardano/assets.{AssetName, PolicyId, quantity_of}
use cardano/transaction.{
  DatumHash, InlineDatum, Input, NoDatum, Output, OutputReference, Transaction,
}

// Uniquely identify an asset
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

// Oracle's Datum
type Rate =
  Int

validator oracle(params: OracleParams) {
  spend(
    _datum: Option<Rate>,
    redeemer: OracleRedeemer,
    utxo_ref: OutputReference,
    tx: Transaction,
  ) {
    // Should always be signed by the operator
    expect list.has(tx.extra_signatories, params.operator)

    when redeemer is {
      Update -> {
        // Get the oracle's input
        expect Some(oracle_input) =
          tx.inputs
            |> transaction.find_input(utxo_ref)

        // Fail if oracle's input doesn't contain NFT
        expect
          1 == quantity_of(
            oracle_input.output.value,
            params.nft.policy_id,
            params.nft.name,
          )

        // Get the oracle's output
        expect [oracle_output] =
          list.filter(
            tx.outputs,
            fn(o) { o.address == oracle_input.output.address },
          )

        // Fail if oracle's output doesn't contain NFT
        expect
          1 == quantity_of(
            oracle_output.value,
            params.nft.policy_id,
            params.nft.name,
          )

        // Get and parse the oracle's output datum
        expect
          when oracle_output.datum is {
            NoDatum -> fail @"Datum required"
            DatumHash(_) -> fail @"Datum should be inline"
            InlineDatum(d) -> {
              // Fail if the datum is not an integer
              expect _rate: Rate = d
              True
            }
          }
        True
      }

      Delete -> True
    }
  }

  else(_) {
    fail
  }
}
