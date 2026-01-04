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

// Oracle's Datum - Sensor measurement data
pub type SensorData {
  sensor_id: ByteArray,
  temperature: Int,  // Temperature * 10 (e.g., 23.5°C = 235)
  humidity: Int,     // Humidity * 10 (e.g., 65.2% = 652)
  timestamp: Int,    // Unix timestamp (POSIX time)
}

validator oracle(params: OracleParams) {
  spend(
    _datum: Option<SensorData>,
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
              // Fail if the datum is not valid sensor data
              expect sensor_data: SensorData = d
              // Validate sensor data ranges
              expect sensor_data.temperature >= -500 && sensor_data.temperature <= 1000  // -50°C to 100°C
              expect sensor_data.humidity >= 0 && sensor_data.humidity <= 1000  // 0% to 100%
              expect sensor_data.timestamp > 0
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
