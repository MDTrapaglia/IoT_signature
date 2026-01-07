import { Blockfrost, Lucid, Data, fromText } from "lucid-cardano"
import dotenv from "dotenv"
dotenv.config()

/**
 * Test ECDSA Signature Verification On-Chain usando Lucid
 *
 * Este script:
 * 1. Crea un UTXO en la dirección del validador simple_ecdsa_verifier
 * 2. El datum contiene datos del sensor con firma ECDSA válida
 * 3. El validador verificará la firma cuando se consuma el UTXO
 */

// Código compilado del validador simple_ecdsa_verifier desde plutus.json
const simple_verifier_code = "59010f01010029800aba2aba1aab9faab9eaab9dab9a48888896600264653001300700198039804000cc01c0092225980099b8748008c01cdd500144ca60026016003300b300c001acc004cdc3a400060106ea80122b300130093754009149a2c80522c80392225980099b8748000c02cdd500144ca60026eb8c03cc040c040c040c040c040c034dd5000cdc919b8a3371466e2a600294690084dd698079808180818069baa0015e48dd7180798069baa0019800a51a4021375a601e6020601a6ea80057929800a51a4021375a601e602060206020601a6ea80057929bae300f3010301030103010300d3754002bb4180718061baa0028b201418041baa0028b200c180380098019baa0078a4d1365640041"

// Schema del datum para Lucid
// Debe coincidir exactamente con SimpleSensorData en Aiken
const SimpleSensorDataSchema = Data.Object({
    sensor_id: Data.Bytes(),
    temperature: Data.Integer(),
    humidity: Data.Integer(),
    timestamp: Data.Integer(),
    signature: Data.Bytes(),
    public_key: Data.Bytes()
})

type SimpleSensorData = Data.Static<typeof SimpleSensorDataSchema>
const SimpleSensorData = SimpleSensorDataSchema as unknown as SimpleSensorData

// Datos de prueba con firma ECDSA válida
interface SensorDataInput {
    sensor_id: string;
    temperature: number;
    humidity: number;
    timestamp: number;
    signature: string;
    public_key: string;
}

async function testECDSAOnChain(sensorData: SensorDataInput): Promise<void> {
    console.log("=".repeat(60))
    console.log("Testing ECDSA Signature Verification On-Chain (Lucid)")
    console.log("=".repeat(60))

    // Inicializar Lucid con Blockfrost
    const lucid = await Lucid.new(
        new Blockfrost(
            "https://cardano-preprod.blockfrost.io/api/v0",
            process.env.BLOCKFROST_API_KEY || ""
        ),
        "Preprod"
    )

    // Cargar wallet
    // Opciones (en orden de prioridad):
    // 1. LUCID_SEED (seed phrase de 24 palabras)
    // 2. LUCID_PRIVATE_KEY (hex format)
    // 3. PRIVATE_KEY (intentar con formato de MeshJS)

    const lucidSeed = process.env.LUCID_SEED
    const lucidPrivateKey = process.env.LUCID_PRIVATE_KEY
    const meshPrivateKey = process.env.PRIVATE_KEY

    if (lucidSeed) {
        console.log("  Loading wallet from LUCID_SEED...")
        lucid.selectWalletFromSeed(lucidSeed)
    } else if (lucidPrivateKey) {
        console.log("  Loading wallet from LUCID_PRIVATE_KEY...")
        lucid.selectWalletFromPrivateKey(lucidPrivateKey)
    } else if (meshPrivateKey) {
        console.log("  Attempting to load wallet from PRIVATE_KEY...")
        try {
            lucid.selectWalletFromPrivateKey(meshPrivateKey)
        } catch (keyError: any) {
            console.error("\n❌ Error: PRIVATE_KEY format not compatible with Lucid")
            console.error("   MeshJS and Lucid use different key formats")
            console.log("\n💡 Solution: Generate a Lucid wallet:")
            console.log("   npm run lucid:generate-wallet")
            console.log("\n   Then add LUCID_SEED to your .env file")
            throw keyError
        }
    } else {
        throw new Error("No wallet credentials found in .env. Set LUCID_SEED, LUCID_PRIVATE_KEY, or PRIVATE_KEY")
    }

    const walletAddr = await lucid.wallet.address()
    console.log("\n📋 Test Configuration:")
    console.log("  Wallet Address:", walletAddr)

    // Definir script del validador
    const script = {
        type: "PlutusV3" as const,
        script: simple_verifier_code
    }

    const scriptAddr = lucid.utils.validatorToAddress(script)
    console.log("  Script Address:", scriptAddr)

    console.log("\n📊 Sensor Data to Verify:")
    console.log("  Sensor ID:", sensorData.sensor_id)
    console.log("  Temperature:", sensorData.temperature / 10, "°C")
    console.log("  Humidity:", sensorData.humidity / 10, "%")
    console.log("  Timestamp:", new Date(sensorData.timestamp).toISOString())
    console.log("  Signature:", sensorData.signature.substring(0, 32) + "...")
    console.log("  Public Key:", sensorData.public_key.substring(0, 32) + "...")

    // Construir datum con Lucid
    console.log("\n🔄 Step 1: Creating UTXO at script address with sensor data...")

    const datumData: SimpleSensorData = {
        sensor_id: fromText(sensorData.sensor_id),
        temperature: BigInt(sensorData.temperature),
        humidity: BigInt(sensorData.humidity),
        timestamp: BigInt(sensorData.timestamp),
        signature: sensorData.signature,
        public_key: sensorData.public_key
    }

    const datum = Data.to(datumData, SimpleSensorData)

    console.log("  Datum CBOR:", datum.substring(0, 60) + "...")

    // Construir y enviar transacción
    const tx = await lucid
        .newTx()
        .payToContract(scriptAddr, { inline: datum }, { lovelace: 3000000n })
        .complete()

    console.log("  ✅ Transaction built successfully")

    const signedTx = await tx.sign().complete()
    console.log("  ✅ Transaction signed")

    const txHash = await signedTx.submit()
    console.log("  ✅ UTXO created at script address")
    console.log("  Tx Hash:", txHash)
    console.log("\n  Script Address:", scriptAddr)
    console.log("\n  🔗 View on explorer:")
    console.log(`  https://preprod.cardanoscan.io/transaction/${txHash}`)
    console.log("\n  ℹ️  Next step: Manually consume this UTXO to test ECDSA verification")
    console.log("  ℹ️  The UTXO contains sensor data with valid ECDSA signature")
}

// Main execution
async function main() {
    // Usar los datos de prueba que ya sabemos que tienen firmas válidas
    const sensorData: SensorDataInput = {
        sensor_id: "ESP32_001",
        temperature: 235,    // 23.5°C
        humidity: 652,       // 65.2%
        timestamp: 1767720964446,
        signature: "98C72ABF5BBA1CF58B561EBF206172A073D7F1D051B8016F06E5EFC0BF9CD760CE2D4E3350678EF1D588A3EFF266D9187CC65249E0CE5C647292B9D2874391EA",
        public_key: "70F655FB1D07117545A53C35763B09123F5885300BBC23EAFFFC5C19E882B578E4D07174066908503E24847F66F5758D01BD903C1A2A3B3AC375BBFAF4A94614"
    };

    try {
        await testECDSAOnChain(sensorData);
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
