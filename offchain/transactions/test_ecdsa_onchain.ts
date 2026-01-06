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

// Código compilado del validador simple_ecdsa_verifier desde plutus.json
const simple_verifier_code = "59010f01010029800aba2aba1aab9faab9eaab9dab9a48888896600264653001300700198039804000cc01c0092225980099b8748008c01cdd500144ca60026016003300b300c001acc004cdc3a400060106ea80122b300130093754009149a2c80522c80392225980099b8748000c02cdd500144ca60026eb8c03cc040c040c040c040c040c034dd5000cdc919b8a3371466e2a600294690084dd698079808180818069baa0015e48dd7180798069baa0019800a51a4021375a601e6020601a6ea80057929800a51a4021375a601e602060206020601a6ea80057929bae300f3010301030103010300d3754002bb4180718061baa0028b201418041baa0028b200c180380098019baa0078a4d1365640041"

// Tipos para los datos del sensor
interface SensorData {
    sensor_id: string;
    temperature: number;  // Temperatura * 10
    humidity: number;     // Humedad * 10
    timestamp: number;    // Unix timestamp en milisegundos
    signature: string;    // Firma ECDSA (hex)
    public_key: string;   // Clave pública (hex)
}

async function testECDSAOnChain(
    wallet: MeshWallet,
    sensorData: SensorData
): Promise<void> {
    console.log("=".repeat(60))
    console.log("Testing ECDSA Signature Verification On-Chain")
    console.log("=".repeat(60))

    const walletAddr = await wallet.getChangeAddress();
    const utxos = await wallet.getUtxos()
    const collateral = await wallet.getCollateral();

    if (!collateral[0]) {
        throw new Error("No collateral available");
    }

    // Script del validador simple
    const script: PlutusScript = {
        code: applyCborEncoding(simple_verifier_code),
        version: "V3",
    };

    const scriptAddr = serializePlutusScript(script).address;

    console.log("\n📋 Test Configuration:")
    console.log("  Wallet Address:", walletAddr)
    console.log("  Script Address:", scriptAddr)
    console.log("\n📊 Sensor Data to Verify:")
    console.log("  Sensor ID:", sensorData.sensor_id)
    console.log("  Temperature:", sensorData.temperature / 10, "°C")
    console.log("  Humidity:", sensorData.humidity / 10, "%")
    console.log("  Timestamp:", new Date(sensorData.timestamp).toISOString())
    console.log("  Signature:", sensorData.signature.substring(0, 32) + "...")
    console.log("  Public Key:", sensorData.public_key.substring(0, 32) + "...")

    // Construir datum con los datos del sensor
    // IMPORTANTE: signature y public_key deben ser ByteArrays, no strings
    const datum = mConStr0([
        sensorData.sensor_id,
        sensorData.temperature,
        sensorData.humidity,
        sensorData.timestamp,
        byteString(sensorData.signature),  // Convertir hex string a ByteArray
        byteString(sensorData.public_key)  // Convertir hex string a ByteArray
    ]);

    console.log("\n🔄 Step 1: Creating UTXO at script address with sensor data...")

    // TX 1: Enviar fondos al script con el datum
    const unsignedTx1 = await txBuilder
        .txOut(scriptAddr, [
            { unit: "lovelace", quantity: "3000000" }
        ])
        .txOutInlineDatumValue(datum)
        .changeAddress(walletAddr)
        .selectUtxosFrom(utxos)
        .complete();

    const signedTx1 = await wallet.signTx(unsignedTx1)
    const txHash1 = await wallet.submitTx(signedTx1)

    console.log("  ✅ UTXO created at script address")
    console.log("  Tx Hash:", txHash1)
    console.log("\n  Script Address:", scriptAddr)
    console.log("\n  ℹ️  Next step: Manually consume this UTXO to test ECDSA verification")
    console.log("  ℹ️  The UTXO contains sensor data with valid ECDSA signature")
}

// Main execution
async function main() {
    // Usar los datos de prueba que ya sabemos que tienen firmas válidas
    const sensorData: SensorData = {
        sensor_id: "ESP32_001",
        temperature: 235,    // 23.5°C
        humidity: 652,       // 65.2%
        timestamp: 1767720964446,
        signature: "98C72ABF5BBA1CF58B561EBF206172A073D7F1D051B8016F06E5EFC0BF9CD760CE2D4E3350678EF1D588A3EFF266D9187CC65249E0CE5C647292B9D2874391EA",
        public_key: "70F655FB1D07117545A53C35763B09123F5885300BBC23EAFFFC5C19E882B578E4D07174066908503E24847F66F5758D01BD903C1A2A3B3AC375BBFAF4A94614"
    };

    try {
        await testECDSAOnChain(wallet, sensorData);
    } catch (err) {
        console.error("\n❌ Test Failed:", err);
        throw err;
    }
}

main()
    .then(() => console.log("\n✨ Done"))
    .catch((err) => {
        console.error("\n❌ Error:", err)
        process.exit(1)
    })
