import {
    BlockfrostProvider,
    MeshWallet,
    MeshTxBuilder,
    applyCborEncoding,
    type PlutusScript,
    mConStr0,
    serializePlutusScript
} from "@meshsdk/core"
import dotenv from "dotenv"
dotenv.config()

const blockchainProvider = new BlockfrostProvider(process.env.BLOCKFROST_API_KEY || "")

const txBuilder = new MeshTxBuilder({
    fetcher: blockchainProvider,
    submitter: blockchainProvider,
    evaluator: blockchainProvider,
    verbose: false
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

// Código compilado del validador simple_test
const simple_test_code = "58a101010029800aba2aba1aab9faab9eaab9dab9a48888896600264653001300700198039804000cc01c0092225980099b8748008c01cdd500144ca60026016003300b300c001acc004cdc3a400060106ea80122b300130093754009149a2c80522c80392225980099b8748000c02cdd500144cdc4240006eb4c038c030dd5180718061baa0028b201418041baa0028b200c180380098019baa0078a4d13656400401"

const script: PlutusScript = {
    code: applyCborEncoding(simple_test_code),
    version: "V3",
};

const scriptAddr = serializePlutusScript(script).address;

async function main() {
    console.log("=".repeat(60))
    console.log("Crear UTXO con Validador Simple")
    console.log("=".repeat(60))

    const walletAddr = await wallet.getChangeAddress();
    const utxos = await wallet.getUtxos()

    console.log("\n📋 Configuración:")
    console.log("  Wallet:", walletAddr)
    console.log("  Script Address:", scriptAddr)
    console.log("\n📊 Datum: { value: 5 }")

    // Datum: { value: 5 }
    const datum = mConStr0([5]);

    const unsignedTx = await txBuilder
        .txOut(scriptAddr, [
            { unit: "lovelace", quantity: "3000000" }
        ])
        .txOutInlineDatumValue(datum)
        .changeAddress(walletAddr)
        .selectUtxosFrom(utxos)
        .complete();

    const signedTx = await wallet.signTx(unsignedTx)
    const txHash = await wallet.submitTx(signedTx)

    console.log("\n" + "=".repeat(60))
    console.log("✅ UTXO CREADO")
    console.log("=".repeat(60))
    console.log("\n  Tx Hash:", txHash)
    console.log(`  Explorer: https://preprod.cardanoscan.io/transaction/${txHash}`)
    console.log("\n  📝 Para consumir este UTXO:")
    console.log(`  npm run test:simple:consume`)
    console.log("\n" + "=".repeat(60))
}

main()
    .then(() => console.log("\n✨ Done"))
    .catch((err) => {
        console.error("\n❌ Error:", err.message || err)
        process.exit(1)
    })
