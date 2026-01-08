import {
    BlockfrostProvider,
    MeshWallet,
    MeshTxBuilder,
    applyCborEncoding,
    type PlutusScript,
    type UTxO,
    mConStr0,
    serializePlutusScript,
    deserializeAddress
} from "@meshsdk/core"
import dotenv from "dotenv"
dotenv.config()

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

// NUEVO código compilado del validador con List<Int> schema
// Hash: 193601319c8399e2b46cc2b9abed61cdb49650ddea1456837ed5683e
const simple_verifier_code = "59013d01010029800aba2aba1aab9faab9eaab9dab9a48888896600264653001300700198039804000cc01c0092225980099b8748008c01cdd500144ca60026016003300b300c001acc004cdc3a400060106ea80122b300130093754009149a2c80522c80392225980099b8748000c02cdd500144cc8a600260046eb0c040c044c044c044c044c044c038dd5000cdc919b8a3371466e2a600294690084dd698081808980898071baa0015e48dd7180818071baa0019800a51a4021375a60206022601c6ea80057929800a51a4021375a6020602260226022601c6ea800579298011bac30103011301130113011300e3754002bb41194c0040060054881004004444b30010028800c66002007301300299b8b375a60240040028019011180718061baa0028b201418041baa0028b200c180380098019baa0078a4d13656400401"

// Script del validador simple
const script: PlutusScript = {
    code: applyCborEncoding(simple_verifier_code),
    version: "V3",
};

const scriptAddr = serializePlutusScript(script).address;

async function consumeECDSAUtxo(wallet: MeshWallet): Promise<void> {
    console.log("=".repeat(60))
    console.log("Consuming ECDSA UTXO - Testing On-Chain Verification")
    console.log("=".repeat(60))

    const walletAddr = await wallet.getChangeAddress();
    const walletUtxos = await wallet.getUtxos()
    const collateral = await wallet.getCollateral();

    console.log("\n📋 Configuration:")
    console.log("  Wallet Address:", walletAddr)
    console.log("  Script Address:", scriptAddr)
    console.log("  Validator Hash: 193601319c8399e2b46cc2b9abed61cdb49650ddea1456837ed5683e")
    console.log("  Collateral UTxOs:", collateral.length)

    // Buscar UTXOs en el script address
    console.log("\n🔍 Searching for UTXOs at script address...")

    const scriptUtxos = await blockchainProvider.fetchAddressUTxOs(scriptAddr);

    if (!scriptUtxos || scriptUtxos.length === 0) {
        console.log("\n❌ No UTXOs found at script address")
        console.log("  Make sure you ran test_ecdsa_onchain_meshjs_v2.ts first")
        console.log("  Script Address:", scriptAddr)
        return;
    }

    console.log(`\n✅ Found ${scriptUtxos.length} UTXO(s) at script address`)

    // Usar el primer UTXO
    const utxoToConsume = scriptUtxos[0];

    console.log("\n📦 UTXO to consume:")
    console.log("  Tx Hash:", utxoToConsume.input.txHash)
    console.log("  Output Index:", utxoToConsume.input.outputIndex)
    console.log("  Amount:", utxoToConsume.output.amount.find(a => a.unit === "lovelace")?.quantity, "lovelace")

    // Verificar que tiene datum
    if (!utxoToConsume.output.plutusData) {
        console.log("\n❌ UTXO has no datum!")
        return;
    }

    console.log("  Datum found: ✅")

    // Redeemer vacío (el validador solo necesita verificar la firma del datum)
    const redeemer = mConStr0([]);

    console.log("\n🔄 Building consumption transaction...")
    console.log("  ℹ️  The validator will:")
    console.log("     1. Convert List<Int> to ByteArray for signature and public_key")
    console.log("     2. Build message hash from sensor data")
    console.log("     3. Verify ECDSA secp256k1 signature on-chain")

    try {
        const unsignedTx = await txBuilder
            // Spending Plutus V3 script - debe ir PRIMERO
            .spendingPlutusScriptV3()
            // Input: consume ECDSA UTXO
            .txIn(
                utxoToConsume.input.txHash,
                utxoToConsume.input.outputIndex,
                utxoToConsume.output.amount,
                scriptAddr
            )
            .txInScript(script.code)
            .txInInlineDatumPresent()  // Indica que el datum está inline en el UTXO
            .txInRedeemerValue(redeemer)
            // Collateral para script execution
            .txInCollateral(
                collateral[0].input.txHash,
                collateral[0].input.outputIndex,
                collateral[0].output.amount,
                collateral[0].output.address
            )
            .changeAddress(walletAddr)
            .selectUtxosFrom(walletUtxos)
            .complete();

        console.log("\n  ✅ Transaction built successfully!")
        console.log("  ℹ️  Signing transaction...")

        const signedTx = await wallet.signTx(unsignedTx)

        console.log("  ℹ️  Submitting transaction...")
        const txHash = await wallet.submitTx(signedTx)

        console.log("\n" + "=".repeat(60))
        console.log("✅✅✅ SUCCESS! ECDSA VERIFIED ON-CHAIN! ✅✅✅")
        console.log("=".repeat(60))
        console.log("\n  ✅ UTXO consumed successfully")
        console.log("  Tx Hash:", txHash)
        console.log("\n  🔗 View on explorer:")
        console.log(`  https://preprod.cardanoscan.io/transaction/${txHash}`)
        console.log("\n  🎉 The validator executed successfully!")
        console.log("  🎉 List<Int> → ByteArray conversion worked!")
        console.log("  🎉 ECDSA signature verified on-chain!")
        console.log("\n  ✅ Solution confirmed: List<Int> schema solves MeshJS bug")
        console.log("\n" + "=".repeat(60))

    } catch (err: any) {
        console.log("\n" + "=".repeat(60))
        console.log("❌ Transaction Failed")
        console.log("=".repeat(60))

        // Analizar el tipo de error
        const errorMsg = err.message || err.toString();

        if (errorMsg.includes("signature") || errorMsg.includes("ECDSA")) {
            console.log("\n  ❌ ECDSA Verification Failed")
            console.log("  This means:")
            console.log("    - The validator executed")
            console.log("    - List<Int> conversion worked")
            console.log("    - BUT the signature is invalid")
            console.log("\n  Possible causes:")
            console.log("    - Signature doesn't match the data")
            console.log("    - Public key doesn't match signature")
            console.log("    - Message hash built incorrectly")
        } else if (errorMsg.includes("conversion") || errorMsg.includes("ByteArray")) {
            console.log("\n  ❌ Data Conversion Error")
            console.log("  The list_to_bytearray function may have failed")
        } else if (errorMsg.includes("collateral") || errorMsg.includes("budget")) {
            console.log("\n  ❌ Execution Budget Error")
            console.log("  The validator consumed too many resources")
        } else {
            console.log("\n  ❌ Unknown Error")
            console.log("  Error:", errorMsg)
        }

        console.log("\n  Full error details:")
        console.log(err)
        throw err
    }
}

// Main execution
async function main() {
    try {
        await consumeECDSAUtxo(wallet);
    } catch (err) {
        console.error("\n❌ Consumption Failed:", err);
        process.exit(1);
    }
}

main()
    .then(() => console.log("\n✨ Done"))
    .catch((err) => {
        console.error("\n❌ Error:", err)
        process.exit(1)
    })
