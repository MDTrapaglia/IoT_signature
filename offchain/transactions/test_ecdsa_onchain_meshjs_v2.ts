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
    console.log("Testing ECDSA with List<Int> Schema (MeshJS v2)")
    console.log("=".repeat(60))

    const walletAddr = await wallet.getChangeAddress();
    const utxos = await wallet.getUtxos()

    // Note: Collateral not needed for simple UTXO creation (only for consuming scripts)
    // const collateral = await wallet.getCollateral();

    // Script del validador simple
    const script: PlutusScript = {
        code: applyCborEncoding(simple_verifier_code),
        version: "V3",
    };

    const scriptAddr = serializePlutusScript(script).address;

    console.log("\n📋 Test Configuration:")
    console.log("  Wallet Address:", walletAddr)
    console.log("  Script Address:", scriptAddr)
    console.log("  Validator Hash: 193601319c8399e2b46cc2b9abed61cdb49650ddea1456837ed5683e")
    console.log("\n📊 Sensor Data to Verify:")
    console.log("  Sensor ID:", sensorData.sensor_id)
    console.log("  Temperature:", sensorData.temperature / 10, "°C")
    console.log("  Humidity:", sensorData.humidity / 10, "%")
    console.log("  Timestamp:", new Date(sensorData.timestamp).toISOString())
    console.log("  Signature:", sensorData.signature.substring(0, 32) + "...")
    console.log("  Public Key:", sensorData.public_key.substring(0, 32) + "...")

    // ✅ CAMBIO CLAVE: Convertir hex strings a Array<number> en lugar de ByteArray
    console.log("\n🔄 Converting signature and public key to Array<number>...")
    const signatureBytes = Array.from(Buffer.from(sensorData.signature, 'hex'))
    const publicKeyBytes = Array.from(Buffer.from(sensorData.public_key, 'hex'))

    console.log("  Signature bytes length:", signatureBytes.length, "bytes")
    console.log("  Public key bytes length:", publicKeyBytes.length, "bytes")
    console.log("  First 4 signature bytes:", signatureBytes.slice(0, 4))
    console.log("  First 4 public key bytes:", publicKeyBytes.slice(0, 4))

    // ✅ Construir datum con Array<number> en lugar de byteString()
    // Esto mapea a List<Int> en el validador Aiken
    const datum = mConStr0([
        sensorData.sensor_id,       // ByteArray (string funciona)
        sensorData.temperature,     // Int
        sensorData.humidity,        // Int
        sensorData.timestamp,       // Int
        signatureBytes,             // ✅ Array<number> → List<Int>
        publicKeyBytes              // ✅ Array<number> → List<Int>
    ]);

    console.log("\n🔄 Step 1: Creating UTXO at script address with sensor data...")
    console.log("  ℹ️  Using List<Int> schema (NOT ByteArray)")
    console.log("  ℹ️  This should work around MeshJS ByteArray serialization bug")

    try {
        // TX 1: Enviar fondos al script con el datum
        const unsignedTx1 = await txBuilder
            .txOut(scriptAddr, [
                { unit: "lovelace", quantity: "3000000" }
            ])
            .txOutInlineDatumValue(datum)
            .changeAddress(walletAddr)
            .selectUtxosFrom(utxos)
            .complete();

        console.log("  ✅ Transaction built successfully!")
        console.log("  ℹ️  This means MeshJS can serialize List<Int> without errors!")

        const signedTx1 = await wallet.signTx(unsignedTx1)
        const txHash1 = await wallet.submitTx(signedTx1)

        console.log("\n" + "=".repeat(60))
        console.log("✅✅✅ SUCCESS! MESHJS BYTEARRAY BUG SOLVED! ✅✅✅")
        console.log("=".repeat(60))
        console.log("\n  ✅ UTXO created at script address")
        console.log("  Tx Hash:", txHash1)
        console.log("\n  🔗 View on explorer:")
        console.log(`  https://preprod.cardanoscan.io/transaction/${txHash1}`)
        console.log("\n  Script Address:", scriptAddr)
        console.log("\n  🎉 MeshJS successfully serialized List<Int> datum!")
        console.log("  🎉 The Aiken validator will convert List<Int> to ByteArray on-chain")
        console.log("\n  ℹ️  Next step: Consume this UTXO to test ECDSA verification")
        console.log("  ℹ️  The validator will convert List<Int> → ByteArray → verify signature")
        console.log("\n" + "=".repeat(60))

    } catch (err: any) {
        console.log("\n" + "=".repeat(60))
        console.log("❌ Transaction Failed")
        console.log("=".repeat(60))

        if (err.message && err.message.includes("BigInt")) {
            console.log("\n  ❌ Still getting ByteArray serialization error")
            console.log("  This means MeshJS is trying to serialize Arrays as ByteArrays")
        } else {
            console.log("\n  Error:", err.message || err)
        }

        console.log("\n  Full error:")
        console.log(err)
        throw err
    }
}

// Main execution
async function main() {
    // Usar los mismos datos de prueba que sabemos que tienen firmas válidas
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
        process.exit(1);
    }
}

main()
    .then(() => console.log("\n✨ Done"))
    .catch((err) => {
        console.error("\n❌ Error:", err)
        process.exit(1)
    })
