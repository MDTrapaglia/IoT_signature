import {
    BlockfrostProvider,
    MeshWallet,
    MeshTxBuilder,
    applyParamsToScript,
    applyCborEncoding,
    resolveScriptHash,
    stringToHex,
    type PlutusScript,
    mConStr0
} from "@meshsdk/core"
import dotenv from "dotenv"
dotenv.config()

const blockchainProvider = new BlockfrostProvider(process.env.BLOCKFROST_API_KEY || "")

const txBuilder = new MeshTxBuilder({
    fetcher: blockchainProvider,
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

// Código compilado del validador NFT desde plutus.json
const nft_code = "5901110101002229800aba2aba1aab9faab9eaab9dab9a9bae002488888896600264646644b30013370e900018039baa00189991192cc004c038006264b30013370e90011bad300c0018acc004c8cc004004dd61807802112cc00400629422b30013375e6020601c6ea8c04000405229462660040046022002806100f44cdc79bae300b0010098a504029164028601a0031640306464660020026eacc038c03cc03cc03cc03c00c896600200300389919912cc004cdc8804001456600266e3c02000a20030064039133005005301300440386eb8c034004dd598070009807800a01c14bd6f7b6301bae300a3008375400260106ea8c0280122c8030c020004c020c024004c020004c010dd5004452689b2b20041"

async function mintSensorNFT(
    wallet: MeshWallet,
    sensor_id: string
): Promise<{txHash: string, policyId: string, assetName: string}> {
    const walletAddr = await wallet.getChangeAddress();
    const utxos = await wallet.getUtxos()
    const collateral = await wallet.getCollateral();

    // Seleccionar el primer UTXO que no sea collateral
    const ownerUtxo = utxos.filter(
        (utxo) => !collateral.includes(utxo)
    )[0];

    if (!ownerUtxo || !collateral[0])
        throw new Error("not enough UTXOs or collateral");

    // Construir el nombre del NFT: "SENSOR_" + sensor_id
    const token_name = `SENSOR_${sensor_id}`;

    // Aplicar parámetros al script: utxo_ref y token_name
    const codeWithParams = applyParamsToScript(
        applyCborEncoding(nft_code),
        [
            mConStr0([ownerUtxo.input.txHash, ownerUtxo.input.outputIndex]),
            token_name
        ]
    );

    const mintingPolicy = resolveScriptHash(codeWithParams, "V3");
    const tokenNameHex = stringToHex(token_name);

    const nftScript: PlutusScript = {
        code: codeWithParams,
        version: "V3",
    };

    console.log("🔨 Minting Sensor NFT...")
    console.log("  Sensor ID:", sensor_id)
    console.log("  Token Name:", token_name)
    console.log("  Policy ID:", mintingPolicy)
    console.log("  UTXO:", `${ownerUtxo.input.txHash}#${ownerUtxo.input.outputIndex}`)

    const unsignedTx = await txBuilder
        .changeAddress(walletAddr)
        .selectUtxosFrom(utxos)
        .mintPlutusScriptV3()
        .mint("1", mintingPolicy, tokenNameHex)
        .mintRedeemerValue(mConStr0([]))
        .mintingScript(nftScript.code)
        .txInCollateral(collateral[0].input.txHash, collateral[0]?.input.outputIndex)
        .txIn(ownerUtxo?.input.txHash, ownerUtxo?.input.outputIndex)
        .complete();

    const signedTx = await wallet.signTx(unsignedTx)
    const txHash = await wallet.submitTx(signedTx)

    console.log("\n✅ NFT Minted Successfully!")
    console.log("  Tx Hash:", txHash)
    console.log("  Asset:", `${mintingPolicy}.${tokenNameHex}`)

    return {
        txHash,
        policyId: mintingPolicy,
        assetName: tokenNameHex
    };
}

// Main execution
async function main() {
    const sensorId = process.argv[2] || "ESP32_01";

    console.log("=".repeat(60))
    console.log("Sensor NFT Minting Script")
    console.log("=".repeat(60))

    const result = await mintSensorNFT(wallet, sensorId);

    console.log("\n📋 Summary:")
    console.log("  Sensor ID:", sensorId)
    console.log("  Policy ID:", result.policyId)
    console.log("  Asset Name:", result.assetName)
    console.log("  Tx Hash:", result.txHash)
    console.log("\nℹ️  Save these values to use when creating the oracle!")
}

main()
    .then(() => console.log("\n✨ Done"))
    .catch((err) => {
        console.error("\n❌ Error:", err)
        process.exit(1)
    })
