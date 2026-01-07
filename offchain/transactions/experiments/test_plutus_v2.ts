import {
    BlockfrostProvider,
    MeshWallet,
    MeshTxBuilder,
    applyCborEncoding,
    type PlutusScript,
    mConStr0,
    serializePlutusScript,
    byteString
} from "@meshsdk/core"
import dotenv from "dotenv"
dotenv.config()

/**
 * Alternativa 5: Probar con Plutus V2 en lugar de V3
 *
 * Hipótesis: MeshJS v4 beta podría tener bugs con Plutus V3.
 * Vamos a probar el mismo código pero con Plutus V2.
 */

const blockchainProvider = new BlockfrostProvider(process.env.BLOCKFROST_API_KEY || "")

const txBuilder = new MeshTxBuilder({
    fetcher: blockchainProvider,
    submitter: blockchainProvider,
    evaluator: blockchainProvider,
    verbose: true
})

const wallet = new MeshWallet({
    networkId: 0,
    fetcher: blockchainProvider,
    submitter: blockchainProvider,
    key: {
        type: "root",
        bech32: process.env.PRIVATE_KEY || ""
    },
});

// Mismo validador compilado
const simple_verifier_code = "59010f01010029800aba2aba1aab9faab9eaab9dab9a48888896600264653001300700198039804000cc01c0092225980099b8748008c01cdd500144ca60026016003300b300c001acc004cdc3a400060106ea80122b300130093754009149a2c80522c80392225980099b8748000c02cdd500144ca60026eb8c03cc040c040c040c040c040c034dd5000cdc919b8a3371466e2a600294690084dd698079808180818069baa0015e48dd7180798069baa0019800a51a4021375a601e6020601a6ea80057929800a51a4021375a601e602060206020601a6ea80057929bae300f3010301030103010300d3754002bb4180718061baa0028b201418041baa0028b200c180380098019baa0078a4d1365640041"

const testSignature = "98C72ABF5BBA1CF58B561EBF206172A073D7F1D051B8016F06E5EFC0BF9CD760CE2D4E3350678EF1D588A3EFF266D9187CC65249E0CE5C647292B9D2874391EA"
const testPublicKey = "70F655FB1D07117545A53C35763B09123F5885300BBC23EAFFFC5C19E882B578E4D07174066908503E24847F66F5758D01BD903C1A2A3B3AC375BBFAF4A94614"

async function main() {
    console.log("=".repeat(70))
    console.log("Test: Plutus V2 vs V3")
    console.log("=".repeat(70))

    const walletAddr = await wallet.getChangeAddress()
    const utxos = await wallet.getUtxos()

    const datum = mConStr0([
        "ESP32_001",
        235,
        652,
        1767720964446,
        byteString(testSignature),
        byteString(testPublicKey)
    ])

    // Test 1: Plutus V3 (sabemos que falla)
    console.log("\n📋 Test 1: Plutus V3 (esperamos que falle)")
    const scriptV3: PlutusScript = {
        code: applyCborEncoding(simple_verifier_code),
        version: "V3",
    }
    const scriptAddrV3 = serializePlutusScript(scriptV3).address

    try {
        const unsignedTxV3 = await txBuilder
            .txOut(scriptAddrV3, [
                { unit: "lovelace", quantity: "3000000" }
            ])
            .txOutInlineDatumValue(datum)
            .changeAddress(walletAddr)
            .selectUtxosFrom(utxos)
            .complete()

        console.log("✅ Plutus V3 FUNCIONÓ!")
        console.log("   Tx hex:", unsignedTxV3.substring(0, 100) + "...")
    } catch (err: any) {
        console.log("❌ Plutus V3 falló (esperado):", err.message.substring(0, 100))
    }

    // Test 2: Plutus V2
    console.log("\n📋 Test 2: Plutus V2")
    const txBuilderV2 = new MeshTxBuilder({
        fetcher: blockchainProvider,
        submitter: blockchainProvider,
        evaluator: blockchainProvider,
        verbose: true
    })

    const scriptV2: PlutusScript = {
        code: applyCborEncoding(simple_verifier_code),
        version: "V2",  // ← Cambio a V2
    }
    const scriptAddrV2 = serializePlutusScript(scriptV2).address

    console.log("   Script V2 address:", scriptAddrV2)
    console.log("   Script V3 address:", scriptAddrV3)
    console.log("   ¿Son iguales?", scriptAddrV2 === scriptAddrV3)

    try {
        const unsignedTxV2 = await txBuilderV2
            .txOut(scriptAddrV2, [
                { unit: "lovelace", quantity: "3000000" }
            ])
            .txOutInlineDatumValue(datum)
            .changeAddress(walletAddr)
            .selectUtxosFrom(utxos)
            .complete()

        console.log("\n✅✅✅ PLUTUS V2 FUNCIONÓ!")
        console.log("   Tx hex:", unsignedTxV2.substring(0, 100) + "...")
        console.log("\n🎉 Solución encontrada: Usar Plutus V2 en lugar de V3")
        console.log("   El problema es un bug en MeshJS v4 beta con Plutus V3")

    } catch (err: any) {
        console.log("\n❌ Plutus V2 también falló:", err.message)
        console.log("   → El problema NO es específico de Plutus V3")
        console.log("   → El bug es más fundamental en MeshJS")
    }
}

main()
    .then(() => console.log("\n✨ Test completado"))
    .catch(err => {
        console.error("\n❌ Error:", err)
        process.exit(1)
    })
