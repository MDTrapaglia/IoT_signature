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

// Código compilado del validador NFT desde plutus.json
export const nft_code = "5901110101002229800aba2aba1aab9faab9eaab9dab9a9bae002488888896600264646644b30013370e900018039baa00189991192cc004c038006264b30013370e90011bad300c0018acc004c8cc004004dd61807802112cc00400629422b30013375e6020601c6ea8c04000405229462660040046022002806100f44cdc79bae300b0010098a504029164028601a0031640306464660020026eacc038c03cc03cc03cc03c00c896600200300389919912cc004cdc8804001456600266e3c02000a20030064039133005005301300440386eb8c034004dd598070009807800a01c14bd6f7b6301bae300a3008375400260106ea8c0280122c8030c020004c020c024004c020004c010dd5004452689b2b20041"

// Parámetros para mintSensorNFT
export interface MintSensorNFTParams {
    blockfrostApiKey: string;
    privateKey: string;
    networkId: number;
    sensorId: string;
}

/**
 * Minta un NFT único para identificar un sensor
 * @param params Parámetros de configuración y sensor ID
 * @returns Transaction hash, policy ID y asset name del NFT
 */
export async function mintSensorNFT(params: MintSensorNFTParams): Promise<{txHash: string, policyId: string, assetName: string}> {
    const { blockfrostApiKey, privateKey, networkId, sensorId } = params;

    // Inicializar provider, wallet y txBuilder con los parámetros proporcionados
    const blockchainProvider = new BlockfrostProvider(blockfrostApiKey);

    const txBuilder = new MeshTxBuilder({
        fetcher: blockchainProvider,
        verbose: true
    });

    const wallet = new MeshWallet({
        networkId,
        fetcher: blockchainProvider,
        submitter: blockchainProvider,
        key: {
            type: "root",
            bech32: privateKey
        },
    });
    const walletAddr = await wallet.getChangeAddress();
    const utxos = await wallet.getUtxos()
    const collateral = await wallet.getCollateral();

    // Seleccionar el primer UTXO que no sea collateral
    const ownerUtxo = utxos.filter(
        (utxo) => !collateral.includes(utxo)
    )[0];

    if (!ownerUtxo || !collateral[0])
        throw new Error("not enough UTXOs or collateral");

    // Construir el nombre del NFT: "SENSOR_" + sensorId
    const token_name = `SENSOR_${sensorId}`;

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
    console.log("  Sensor ID:", sensorId)
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

// ============================================================================
// CLI Wrapper - Solo se ejecuta cuando el script se llama directamente
// ============================================================================

async function main() {
    const sensorId = process.argv[2] || "ESP32_01";

    if (!process.env.BLOCKFROST_API_KEY || !process.env.PRIVATE_KEY) {
        console.error("❌ Error: BLOCKFROST_API_KEY and PRIVATE_KEY must be set in .env");
        process.exit(1);
    }

    console.log("=".repeat(60))
    console.log("Sensor NFT Minting Script")
    console.log("=".repeat(60))

    const result = await mintSensorNFT({
        blockfrostApiKey: process.env.BLOCKFROST_API_KEY!,
        privateKey: process.env.PRIVATE_KEY!,
        networkId: 0,
        sensorId
    });

    console.log("\n📋 Summary:")
    console.log("  Sensor ID:", sensorId)
    console.log("  Policy ID:", result.policyId)
    console.log("  Asset Name:", result.assetName)
    console.log("  Tx Hash:", result.txHash)
    console.log("\nℹ️  Save these values to use when creating the oracle!")
}

// Solo ejecutar si este archivo se llama directamente (no cuando se importa)
// ESM: usar import.meta.url en lugar de require.main
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
    main()
        .then(() => console.log("\n✨ Done"))
        .catch((err) => {
            console.error("\n❌ Error:", err)
            process.exit(1)
        });
}
