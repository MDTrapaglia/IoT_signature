import {
    BlockfrostProvider,
    MeshWallet,
    MeshTxBuilder,
    applyCborEncoding,
    type PlutusScript,
    type UTxO,
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

// Código compilado del validador simple_ed25519
const simple_ed25519_code = "58bb01010029800aba2aba1aab9faab9eaab9dab9a48888896600264653001300700198039804000cc01c0092225980099b8748008c01cdd500144ca60026016003300b300c001acc004cdc3a400060106ea80122b300130093754009149a2c80522c80392225980099b8748000c02cdd500144ca60026eb8c03cc040c040c034dd5000cdd7180798069baa0019bae300f3010300d3754002b95180718061baa0028b201418041baa0028b200c180380098019baa0078a4d1365640041"

const script: PlutusScript = {
    code: applyCborEncoding(simple_ed25519_code),
    version: "V3",
};

const scriptAddr = serializePlutusScript(script).address;

async function main() {
    console.log("=".repeat(60))
    console.log("Consumir UTXO con Validador Ed25519")
    console.log("=".repeat(60))

    const walletAddr = await wallet.getChangeAddress();

    // Obtener collateral
    const allUtxos = await wallet.getUtxos();
    const collateral = allUtxos.filter((utxo: UTxO) => {
        return utxo.output.amount.find((asset) =>
            asset.unit === 'lovelace' &&
            Number(asset.quantity) >= 5000000
        )
    });

    if (collateral.length === 0) {
        throw new Error("No se encontró collateral (necesitas un UTXO >= 5 ADA)");
    }

    console.log("\n📋 Configuración:")
    console.log(`  Wallet: ${walletAddr}`)
    console.log(`  Script Address: ${scriptAddr}`)
    console.log(`  Collateral UTXOs: ${collateral.length}`)

    // Buscar UTXOs en el script address
    console.log("\n🔍 Buscando UTXOs en script address...")
    const scriptUtxos = await blockchainProvider.fetchAddressUTxOs(scriptAddr);

    if (scriptUtxos.length === 0) {
        throw new Error("No se encontraron UTXOs en el script address");
    }

    console.log(`✅ Encontrado ${scriptUtxos.length} UTXO(s)`)

    // Ordenar por más reciente (mayor outputIndex o más reciente en la lista)
    // Blockfrost devuelve los UTXOs ordenados por defecto
    // Tomar el último UTXO (el más reciente)
    const utxoToConsume = scriptUtxos[scriptUtxos.length - 1];

    console.log("\n📦 UTXO a consumir:")
    console.log(`  Tx Hash: ${utxoToConsume.input.txHash}`)
    console.log(`  Output Index: ${utxoToConsume.input.outputIndex}`)
    console.log(`  Amount: ${utxoToConsume.output.amount[0].quantity} lovelace`)

    // Redeemer vacío (el validador no lo usa)
    const redeemer = mConStr0([]);

    console.log("\n🔄 Construyendo transacción...")
    console.log("  El validador verificará la firma Ed25519")

    // Obtener UTXOs de la wallet para change
    const walletUtxos = await wallet.getUtxos();

    const unsignedTx = await txBuilder
        .spendingPlutusScriptV3()
        .txIn(
            utxoToConsume.input.txHash,
            utxoToConsume.input.outputIndex,
            utxoToConsume.output.amount,
            utxoToConsume.output.address
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
    const signedTx = await wallet.signTx(unsignedTx);
    console.log("  🔄 Enviando...")
    const txHash = await wallet.submitTx(signedTx);

    console.log("\n" + "=".repeat(60))
    console.log("✅ UTXO CONSUMIDO")
    console.log("=".repeat(60))
    console.log(`\n  Tx Hash: ${txHash}`)
    console.log(`  Explorer: https://preprod.cardanoscan.io/transaction/${txHash}`)
    console.log("\n" + "=".repeat(60))
}

main().catch((error) => {
    console.error("\n❌ Error:", error.message || error);
    if (error.response) {
        console.error("\nRespuesta del servidor:", JSON.stringify(error.response, null, 2));
    }
    process.exit(1);
})
