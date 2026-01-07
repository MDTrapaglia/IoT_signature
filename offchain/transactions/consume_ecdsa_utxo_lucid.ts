import { Blockfrost, Lucid, Data, fromText } from "lucid-cardano"
import { readFileSync } from "fs"
import { fileURLToPath } from "url"
import { dirname, join } from "path"
import dotenv from "dotenv"
dotenv.config()

// Get current directory
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * Consume UTXO from script address to test ECDSA verification on-chain
 *
 * Este script:
 * 1. Busca el UTXO en la dirección del script simple_ecdsa_verifier
 * 2. Lo consume con un redeemer vacío (Void)
 * 3. El validador ejecutará verify_ecdsa_secp256k1_signature
 * 4. Si la firma es válida → ✅ Transacción exitosa
 * 5. Si la firma es inválida → ❌ Transacción rechazada
 */

// Código compilado del validador (sin el byte de versión de Plutus)
const simple_verifier_code_raw = "59010f01010029800aba2aba1aab9faab9eaab9dab9a48888896600264653001300700198039804000cc01c0092225980099b8748008c01cdd500144ca60026016003300b300c001acc004cdc3a400060106ea80122b300130093754009149a2c80522c80392225980099b8748000c02cdd500144ca60026eb8c03cc040c040c040c040c040c034dd5000cdc919b8a3371466e2a600294690084dd698079808180818069baa0015e48dd7180798069baa0019800a51a4021375a601e6020601a6ea80057929800a51a4021375a601e602060206020601a6ea80057929bae300f3010301030103010300d3754002bb4180718061baa0028b201418041baa0028b200c180380098019baa0078a4d1365640041"

// Para Plutus V3, Lucid espera el byte de versión: 03 + código CBOR
// Aiken ya incluye esto en el compiledCode, así que lo usamos directamente
const simple_verifier_code = "03" + simple_verifier_code_raw

// Schema del datum (mismo que en el script de creación)
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

async function consumeECDSAUtxo(): Promise<void> {
    console.log("=".repeat(60))
    console.log("Consume UTXO to Test ECDSA Verification On-Chain")
    console.log("=".repeat(60))

    // Inicializar Lucid
    const lucid = await Lucid.new(
        new Blockfrost(
            "https://cardano-preprod.blockfrost.io/api/v0",
            process.env.BLOCKFROST_API_KEY || ""
        ),
        "Preprod"
    )

    // Cargar wallet
    const meshPrivateKey = process.env.PRIVATE_KEY
    if (!meshPrivateKey) {
        throw new Error("PRIVATE_KEY not found in .env")
    }

    console.log("  Loading wallet from PRIVATE_KEY...")
    const { C } = await import("lucid-cardano")
    const rootKey = C.Bip32PrivateKey.from_bech32(meshPrivateKey)
    const harden = (num: number) => 0x80000000 + num
    const accountKey = rootKey
        .derive(harden(1852))
        .derive(harden(1815))
        .derive(harden(0))
    const paymentKey = accountKey.derive(0).derive(0).to_raw_key()
    const paymentKeyBech32 = paymentKey.to_bech32()
    lucid.selectWalletFromPrivateKey(paymentKeyBech32)

    const walletAddr = await lucid.wallet.address()
    console.log("  ✅ Wallet loaded")
    console.log("  Wallet Address:", walletAddr)

    // Cargar el plutus.json para obtener el validator en el formato correcto
    const plutusJsonPath = join(__dirname, "../../onchain/sensors-oracle/plutus.json")
    const plutusJson = JSON.parse(readFileSync(plutusJsonPath, "utf-8"))

    // Encontrar el validator simple_verifier.spend
    const validatorEntry = plutusJson.validators.find((v: any) =>
        v.title === "simple_ecdsa_verifier.simple_verifier.spend"
    )

    if (!validatorEntry) {
        throw new Error("simple_verifier.spend not found in plutus.json")
    }

    console.log("  Validator hash:", validatorEntry.hash)

    // Crear el validator en el formato que Lucid espera
    // El validador fue compilado como PlutusV3 en Aiken
    const validator = {
        type: "PlutusV3" as const,
        script: validatorEntry.compiledCode
    }

    // Calcular la dirección del script
    const scriptAddr = lucid.utils.validatorToAddress(validator)
    console.log("  Script Address:", scriptAddr)

    // Buscar UTXOs en el script address
    console.log("\n🔍 Step 1: Looking for UTXOs at script address...")
    const scriptUtxos = await lucid.utxosAt(scriptAddr)

    if (scriptUtxos.length === 0) {
        console.log("❌ No UTXOs found at script address")
        console.log("   Create a UTXO first with: npm run test:ecdsa:lucid")
        return
    }

    console.log(`  ✅ Found ${scriptUtxos.length} UTXO(s) at script address`)

    // Usar el primer UTXO
    const utxo = scriptUtxos[0]
    console.log("\n📦 UTXO to consume:")
    console.log("  Tx Hash:", utxo.txHash)
    console.log("  Output Index:", utxo.outputIndex)
    console.log("  Amount:", utxo.assets.lovelace, "lovelace")

    // Intentar parsear el datum
    if (utxo.datum) {
        try {
            const datumData = Data.from(utxo.datum, SimpleSensorData)
            console.log("\n📊 Sensor Data in UTXO:")
            console.log("  Sensor ID:", Buffer.from(datumData.sensor_id).toString())
            console.log("  Temperature:", Number(datumData.temperature) / 10, "°C")
            console.log("  Humidity:", Number(datumData.humidity) / 10, "%")
            console.log("  Timestamp:", new Date(Number(datumData.timestamp)).toISOString())
            console.log("  Signature:", datumData.signature.substring(0, 32) + "...")
            console.log("  Public Key:", datumData.public_key.substring(0, 32) + "...")
        } catch (e) {
            console.log("  ⚠️  Could not parse datum (this is OK, will consume anyway)")
        }
    }

    // Construir redeemer (Unit/Void para este validador)
    const redeemer = Data.void()

    console.log("\n🔄 Step 2: Building transaction to consume UTXO...")
    console.log("  ℹ️  The validator will execute verify_ecdsa_secp256k1_signature")
    console.log("  ℹ️  If signature is valid → ✅ Transaction succeeds")
    console.log("  ℹ️  If signature is invalid → ❌ Transaction fails")

    try {
        // Construir transacción que consume el UTXO
        const tx = await lucid
            .newTx()
            .collectFrom([utxo], redeemer)
            .attachSpendingValidator(validator)
            .complete()

        console.log("  ✅ Transaction built successfully")

        // Firmar transacción
        const signedTx = await tx.sign().complete()
        console.log("  ✅ Transaction signed")

        // Enviar transacción
        console.log("\n⏳ Step 3: Submitting transaction...")
        const txHash = await signedTx.submit()

        console.log("\n" + "=".repeat(60))
        console.log("✅✅✅ SUCCESS! ECDSA VERIFIED ON-CHAIN! ✅✅✅")
        console.log("=".repeat(60))
        console.log("\n  Tx Hash:", txHash)
        console.log("\n  🔗 View on explorer:")
        console.log(`  https://preprod.cardanoscan.io/transaction/${txHash}`)
        console.log("\n  🎉 The ECDSA signature was verified successfully by the Plutus validator!")
        console.log("  🎉 This proves that secp256k1 ECDSA verification works on-chain!")
        console.log("\n" + "=".repeat(60))

    } catch (err: any) {
        console.log("\n" + "=".repeat(60))
        console.log("❌ Transaction Failed")
        console.log("=".repeat(60))

        if (err.message && err.message.includes("signature")) {
            console.log("\n  ❌ ECDSA signature verification FAILED in validator")
            console.log("  The signature in the datum is invalid!")
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
    try {
        await consumeECDSAUtxo()
    } catch (err) {
        console.error("\n❌ Script Failed:", err)
        process.exit(1)
    }
}

main()
    .then(() => console.log("\n✨ Done"))
    .catch((err) => {
        console.error("\n❌ Error:", err)
        process.exit(1)
    })
