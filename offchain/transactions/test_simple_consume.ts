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
    console.log("Consumir UTXO con Validador Simple")
    console.log("=".repeat(60))

    const walletAddr = await wallet.getChangeAddress();
    const walletUtxos = await wallet.getUtxos()
    const collateral = await wallet.getCollateral();

    console.log("\n📋 Configuración:")
    console.log("  Wallet:", walletAddr)
    console.log("  Script Address:", scriptAddr)
    console.log("  Collateral UTXOs:", collateral.length)

    console.log("\n🔍 Buscando UTXOs...")

    const scriptUtxos = await blockchainProvider.fetchAddressUTxOs(scriptAddr);

    if (!scriptUtxos || scriptUtxos.length === 0) {
        console.log("\n❌ No hay UTXOs en el script address")
        console.log("  Primero ejecuta: npm run test:simple:create")
        process.exit(1)
    }

    console.log(`✅ Encontrado ${scriptUtxos.length} UTXO(s)`)

    const utxoToConsume = scriptUtxos[0];

    console.log("\n📦 UTXO a consumir:")
    console.log("  Tx Hash:", utxoToConsume.input.txHash)
    console.log("  Output Index:", utxoToConsume.input.outputIndex)
    console.log("  Amount:", utxoToConsume.output.amount.find(a => a.unit === "lovelace")?.quantity, "lovelace")

    // Redeemer vacío
    const redeemer = mConStr0([]);

    console.log("\n🔄 Construyendo transacción...")
    console.log("  El validador verificará que value > 0")

    const unsignedTx = await txBuilder
        .spendingPlutusScriptV3()
        .txIn(
            utxoToConsume.input.txHash,
            utxoToConsume.input.outputIndex,
            utxoToConsume.output.amount,
            scriptAddr
        )
        .txInScript(script.code)
        .txInInlineDatumPresent()
        .txInRedeemerValue(redeemer)
        .txInCollateral(
            collateral[0].input.txHash,
            collateral[0].input.outputIndex,
            collateral[0].output.amount,
            collateral[0].output.address
        )
        .changeAddress(walletAddr)
        .selectUtxosFrom(walletUtxos)
        .complete();

    console.log("  ✅ Transacción construida")
    console.log("  🔄 Firmando...")

    const signedTx = await wallet.signTx(unsignedTx)

    console.log("  🔄 Enviando...")
    const txHash = await wallet.submitTx(signedTx)

    console.log("\n" + "=".repeat(60))
    console.log("🎉 ¡VALIDACIÓN ON-CHAIN EXITOSA!")
    console.log("=".repeat(60))
    console.log("\n  Tx Hash:", txHash)
    console.log(`  Explorer: https://preprod.cardanoscan.io/transaction/${txHash}`)
    console.log("\n  ✅ El validador se ejecutó correctamente")
    console.log("  ✅ Verificó que value (5) > 0")
    console.log("  ✅ Permitió el consumo del UTXO")
    console.log("\n  🎯 SISTEMA DE VALIDACIÓN ON-CHAIN FUNCIONA")
    console.log("\n" + "=".repeat(60))
}

main()
    .then(() => console.log("\n✨ Done"))
    .catch((err) => {
        console.error("\n❌ Error:", err.message || err)
        console.error(err)
        process.exit(1)
    })
