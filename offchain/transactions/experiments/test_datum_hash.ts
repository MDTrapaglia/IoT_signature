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
 * Test: Usar datum HASH en lugar de inline
 *
 * Hipótesis: El problema podría ser específico de inline datums.
 * Vamos a intentar con datum hash para ver si evita el error de serialización.
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

const simple_verifier_code = "59010f01010029800aba2aba1aab9faab9eaab9dab9a48888896600264653001300700198039804000cc01c0092225980099b8748008c01cdd500144ca60026016003300b300c001acc004cdc3a400060106ea80122b300130093754009149a2c80522c80392225980099b8748000c02cdd500144ca60026eb8c03cc040c040c040c040c040c034dd5000cdc919b8a3371466e2a600294690084dd698079808180818069baa0015e48dd7180798069baa0019800a51a4021375a601e6020601a6ea80057929800a51a4021375a601e602060206020601a6ea80057929bae300f3010301030103010300d3754002bb4180718061baa0028b201418041baa0028b200c180380098019baa0078a4d1365640041"

const testSignature = "98C72ABF5BBA1CF58B561EBF206172A073D7F1D051B8016F06E5EFC0BF9CD760CE2D4E3350678EF1D588A3EFF266D9187CC65249E0CE5C647292B9D2874391EA"
const testPublicKey = "70F655FB1D07117545A53C35763B09123F5885300BBC23EAFFFC5C19E882B578E4D07174066908503E24847F66F5758D01BD903C1A2A3B3AC375BBFAF4A94614"

async function main() {
    console.log("=".repeat(70))
    console.log("Test: Datum HASH vs Inline Datum")
    console.log("=".repeat(70))

    const walletAddr = await wallet.getChangeAddress()
    const utxos = await wallet.getUtxos()

    const script: PlutusScript = {
        code: applyCborEncoding(simple_verifier_code),
        version: "V3",
    }

    const scriptAddr = serializePlutusScript(script).address

    // Construir datum
    const datum = mConStr0([
        "ESP32_001",
        235,
        652,
        1767720964446,
        byteString(testSignature),
        byteString(testPublicKey)
    ])

    console.log("\n📋 Test with Datum HASH (not inline)")
    console.log("   Wallet:", walletAddr)
    console.log("   Script:", scriptAddr)

    try {
        const unsignedTx = await txBuilder
            .txOut(scriptAddr, [
                { unit: "lovelace", quantity: "3000000" }
            ])
            .txOutDatumHashValue(datum)  // ← HASH en lugar de inline
            .changeAddress(walletAddr)
            .selectUtxosFrom(utxos)
            .complete()

        console.log("\n✅✅✅ ÉXITO con datum HASH!")
        console.log("   Tx hex:", unsignedTx.substring(0, 100) + "...")
        console.log("\n🎉 El problema era específico de inline datums!")
        console.log("   Solución: Usar .txOutDatumHashValue() en lugar de .txOutInlineDatumValue()")

    } catch (err: any) {
        console.log("\n❌ También falla con datum hash:", err.message)
        console.log("   → El problema NO es específico de inline datums")
        console.log("   → El problema es más profundo en la serialización")
    }
}

main()
    .then(() => console.log("\n✨ Test completado"))
    .catch(err => {
        console.error("\n❌ Error:", err)
        process.exit(1)
    })
