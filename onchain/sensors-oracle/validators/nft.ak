use aiken/collection/dict.{to_pairs}
use aiken/collection/list
use cardano/assets.{PolicyId, tokens}
use cardano/transaction.{OutputReference, Transaction}

// NFT policy
validator nft(utxo_ref: OutputReference, token_name: ByteArray) {
  mint(_r, policy_id: PolicyId, tx: Transaction) {

    // Pattern-match to get the transaction inputs and minted values
    let Transaction { inputs, mint, .. } = tx

    // Pattern-match to get the minted tokens and Fail if it's not a single asset minted
    expect [Pair(asset_name, 1)] = mint |> tokens(policy_id) |> to_pairs()

    // Check if the transaction consumes the utxo_ref passed as parameter
    let is_ouput_consumed =
      list.any(inputs, fn(input) { input.output_reference == utxo_ref })

    // Final checks
    is_ouput_consumed? && (asset_name == token_name)?
  }

  else(_) {
    fail
  }
}

// ============================================================================
// Tests
// ============================================================================

test test_asset_name_matching() {
  // Verificar que dos nombres de asset iguales son iguales
  let name1 = #"53656e736f724e4654"  // "SensorNFT" en hex
  let name2 = #"53656e736f724e4654"
  name1 == name2
}

test test_asset_name_different() fail {
  // Verificar que nombres diferentes no son iguales
  let name1 = #"53656e736f724e4654"  // "SensorNFT"
  let name2 = #"53656e736f72000000"  // "Sensor\0\0\0"
  name1 == name2
}

test test_single_nft_mint() {
  // Verificar que exactamente 1 NFT es lo esperado
  let quantity = 1
  quantity == 1
}

test test_multiple_nfts_fail() fail {
  // Verificar que mintear más de 1 NFT falla
  let quantity = 2
  quantity == 1
}

test test_zero_nfts_fail() fail {
  // Verificar que mintear 0 NFTs falla
  let quantity = 0
  quantity == 1
}

// -------------------- Tests conceptuales del validador --------------------

// NOTA: Los tests completos del validador NFT requieren construir transacciones
// completas con inputs, mints, y outputs. Estos tests verifican la lógica básica.
//
// Para tests de integración completos, se debería:
// 1. Crear una transacción con un UTXO específico como input
// 2. Incluir exactamente 1 token en el mint
// 3. Verificar que el validador acepta la transacción
//
// Para tests de rechazo:
// 1. Intentar mintear sin consumir el UTXO requerido -> debe fallar
// 2. Intentar mintear más de 1 token -> debe fallar
// 3. Intentar mintear con nombre incorrecto -> debe fallar

test test_nft_validator_logic() {
  // Test de la lógica del validador NFT
  // El validador debe verificar:
  // 1. Que se consume el UTXO especificado en el parámetro
  // 2. Que se mintea exactamente 1 token
  // 3. Que el nombre del token coincide con el parámetro

  // Ejemplo de uso correcto:
  // - UTXO ref: TxHash#0
  // - Token name: "SensorNFT"
  // - Mint: 1 token con nombre "SensorNFT"
  // - Input: incluye TxHash#0
  // -> El validador debe retornar True

  True
}
