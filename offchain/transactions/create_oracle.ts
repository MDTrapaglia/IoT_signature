import {
    BlockfrostProvider,
    MeshWallet,
    MeshTxBuilder,
    applyParamsToScript,
    applyCborEncoding,
    resolveScriptHash,
    type PlutusScript,
    mConStr0,
    serializePlutusScript,
    deserializeAddress
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

// Código compilado del validador sensor_oracle_verified desde plutus.json
const oracle_validator_code = "590494010100229800aba2aba1aba0aab9faab9eaab9dab9a488888896600264653001300800198041804800cdc3a400530080024888966002600460106ea800e264664530011325980099199119801001000912cc00400629422b30013371e6eb8c04c00400e2946266004004602800280710111bac301130123012301230123012301230123012300e375400c6eb8c004c034dd5009c566002600460186ea8022264b30013003300d375400313322598009804cc004dd5980218081baa300430103754005375c602660206ea8c04cc040dd500b4dd7180218081baa30133010375402c800a26464b300130160018992cc004c03260026eacc01cc04cdd5000cdd7180b18099baa301630133754033375c600e60266ea8c058c04cdd500ca0088acc004c8c9660026014003168acc004c0380062d132598009805980a9baa00189919191919194c004dd7180f800cdd7180f8034dd6980f802cdd6980f8024dd6980f801cdd7180f8012444444b300130260078cc0048c098c09cc09cc09cc09cc09c0064604c604e604e604e604e00323026302730273027001488966002b30015980099b894839c1cdd6980c98129baa010899b89375a6032604a6ea804120d00f8a50408d159800acc004cdc4a40006eb4c054c094dd500844cdc49bad301530253754020906807c52820468acc004cdc4240006eb4c004c094dd5008456600266e1cdc69bae300230253754020904000c56600266e1cdc69bae300330253754020904000c56600266e212000371a6eb8c0a0c094dd50084528c5902345902345902345902345902345902345660033001375c6006604a6ea80426e48cdc519b8a3371530014a3480426eb4c054c094dd50082f246eb8c0a0c094dd50084c00528d20109bad301930253754020bc94c00528d20109bad300130253754020bc94dd7180118129baa0105da229462c811a2c811916408c301f001301e001301d001301c001301b001301637540031640506030602a6ea8009013202630133754002600660266ea800629462c808a2c8088c0540062c8098c8cc004004dd6180118091baa00a2259800800c52f5c1133225980099baf3018301537540046030602a6ea8c024c054dd5003c4cc05c008cc0100100062660080080028098c058004c05c0050141180a180a980a800c5900e180898071baa001222323322330020020012259800800c00e2646644b30013372200e00515980099b8f0070028800c01901544cc014014c06c0110151bae3014001375a602a002602e00280a8c8c8cc004004018896600200300389919912cc004cdc8804801456600266e3c02400a20030064059133005005301c00440586eb8c054004dd5980b000980c000a02c14bd6f7b6300a400116403064660020026eb0c044c038dd5003112cc0040062980103d87a80008992cc004cdd7980998081baa001006899ba548000cc0480052f5c11330030033014002403860240028082294500b45900b118081808800cc02cdd5003cc03cc04000d2225980098020014566002601e6ea802a00716404115980098040014566002601e6ea802a0071640411640348068601a0026e1d20003009375400716401c300800130033754011149a26cac80081"

// Tipos para los datos del sensor
interface SensorData {
    sensor_id: string;
    temperature: number;  // Temperatura * 10 (ej: 23.5°C = 235)
    humidity: number;     // Humedad * 10 (ej: 65.2% = 652)
    timestamp: number;    // Unix timestamp en milisegundos
    signature: string;    // Firma ECDSA (hex)
    public_key: string;   // Clave pública (hex)
}

async function createOracle(
    wallet: MeshWallet,
    nftPolicyId: string,
    nftAssetName: string,
    sensorData: SensorData
): Promise<string> {
    const walletAddr = await wallet.getChangeAddress();
    const utxos = await wallet.getUtxos()

    // Obtener el payment credential del wallet para usar como operator
    const walletAddrDetails = deserializeAddress(walletAddr);
    const operatorPubKeyHash = walletAddrDetails.pubKeyHash;

    if (!operatorPubKeyHash) {
        throw new Error("Could not extract pubKeyHash from wallet address");
    }

    // Aplicar parámetros al script: OracleParams { nft: AssetClass, operator: VerificationKeyHash }
    const codeWithParams = applyParamsToScript(
        applyCborEncoding(oracle_validator_code),
        [
            // AssetClass { policy_id, name }
            mConStr0([nftPolicyId, nftAssetName]),
            // operator: VerificationKeyHash
            operatorPubKeyHash
        ]
    );

    const oracleScript: PlutusScript = {
        code: codeWithParams,
        version: "V3",
    };

    const oracleScriptAddr = serializePlutusScript(oracleScript).address;

    // Construir el datum con los datos del sensor
    // SensorData { sensor_id, temperature, humidity, timestamp, signature, public_key }
    const datum = mConStr0([
        sensorData.sensor_id,
        sensorData.temperature,
        sensorData.humidity,
        sensorData.timestamp,
        sensorData.signature,
        sensorData.public_key
    ]);

    console.log("🏗️  Creating Oracle...")
    console.log("  NFT Policy:", nftPolicyId)
    console.log("  NFT Asset:", nftAssetName)
    console.log("  Operator:", operatorPubKeyHash)
    console.log("  Oracle Address:", oracleScriptAddr)
    console.log("\n📊 Initial Sensor Data:")
    console.log("  Sensor ID:", sensorData.sensor_id)
    console.log("  Temperature:", sensorData.temperature / 10, "°C")
    console.log("  Humidity:", sensorData.humidity / 10, "%")
    console.log("  Timestamp:", new Date(sensorData.timestamp).toISOString())

    const nftUnit = `${nftPolicyId}${nftAssetName}`;

    const unsignedTx = await txBuilder
        .txOut(oracleScriptAddr, [
            { unit: "lovelace", quantity: "2000000" },  // Min ADA
            { unit: nftUnit, quantity: "1" }             // El NFT del sensor
        ])
        .txOutInlineDatumValue(datum)
        .changeAddress(walletAddr)
        .selectUtxosFrom(utxos)
        .complete();

    const signedTx = await wallet.signTx(unsignedTx)
    const txHash = await wallet.submitTx(signedTx)

    console.log("\n✅ Oracle Created Successfully!")
    console.log("  Tx Hash:", txHash)
    console.log("  Script Address:", oracleScriptAddr)

    return txHash;
}

// Main execution
async function main() {
    // Parámetros del NFT (obtenidos de mint_sensor_nft.ts)
    const nftPolicyId = process.argv[2];
    const nftAssetName = process.argv[3];

    if (!nftPolicyId || !nftAssetName) {
        console.error("❌ Usage: npm run demo -- <nft_policy_id> <nft_asset_name>");
        console.error("   Example: npm run demo -- e659c328b17c189898d2e763c4982a0787ccb1474c096b482ec78594 53454e534f525f45535033325f3031");
        process.exit(1);
    }

    // Datos iniciales del sensor (ejemplo)
    const initialSensorData: SensorData = {
        sensor_id: "ESP32_001",
        temperature: 235,    // 23.5°C
        humidity: 652,       // 65.2%
        timestamp: Date.now(),
        signature: "6FA9ADECE1E8BE3CDD34440964F2CF5AEF460480F7A96C75A7367A4B4D1D360ABE20856DE311EB357337B896A0C137295FB8F5223F65AEEC33275DC9E3AED9D2",
        public_key: "D27CBD596D2272C63502D6A186C09D9D8101DD3448CB367E3B28DDF1A9D66E4140D3C4D11DF201EB1E6E512054414B49B82B13024A1202D0DAC8FB4253E988E8"
    };

    console.log("=".repeat(60))
    console.log("Create Sensor Oracle Script")
    console.log("=".repeat(60))

    const txHash = await createOracle(wallet, nftPolicyId, nftAssetName, initialSensorData);

    console.log("\n📋 Summary:")
    console.log("  Tx Hash:", txHash)
    console.log("\nℹ️  The oracle is now initialized and ready to receive updates!")
}

main()
    .then(() => console.log("\n✨ Done"))
    .catch((err) => {
        console.error("\n❌ Error:", err)
        process.exit(1)
    })
