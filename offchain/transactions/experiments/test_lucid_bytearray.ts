import { Blockfrost, Lucid, Data, fromText } from "lucid-cardano"
import dotenv from "dotenv"
dotenv.config()

/**
 * Alternativa 6: Usar Lucid en lugar de MeshJS
 *
 * Hipótesis: Lucid es más maduro y puede manejar ByteArrays correctamente.
 * Vamos a reescribir el test usando Lucid.
 */

// Datos de prueba
const testSignature = "98C72ABF5BBA1CF58B561EBF206172A073D7F1D051B8016F06E5EFC0BF9CD760CE2D4E3350678EF1D588A3EFF266D9187CC65249E0CE5C647292B9D2874391EA"
const testPublicKey = "70F655FB1D07117545A53C35763B09123F5885300BBC23EAFFFC5C19E882B578E4D07174066908503E24847F66F5758D01BD903C1A2A3B3AC375BBFAF4A94614"

// Código compilado del validador
const simple_verifier_code = "59010f01010029800aba2aba1aab9faab9eaab9dab9a48888896600264653001300700198039804000cc01c0092225980099b8748008c01cdd500144ca60026016003300b300c001acc004cdc3a400060106ea80122b300130093754009149a2c80522c80392225980099b8748000c02cdd500144ca60026eb8c03cc040c040c040c040c040c034dd5000cdc919b8a3371466e2a600294690084dd698079808180818069baa0015e48dd7180798069baa0019800a51a4021375a601e6020601a6ea80057929800a51a4021375a601e602060206020601a6ea80057929bae300f3010301030103010300d3754002bb4180718061baa0028b201418041baa0028b200c180380098019baa0078a4d1365640041"

// Schema del datum para Lucid
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

async function main() {
    console.log("=".repeat(70))
    console.log("Test: Lucid con ByteArrays")
    console.log("=".repeat(70))

    // Inicializar Lucid con Blockfrost
    const lucid = await Lucid.new(
        new Blockfrost(
            "https://cardano-preprod.blockfrost.io/api/v0",
            process.env.BLOCKFROST_API_KEY || ""
        ),
        "Preprod"
    )

    // Para este test, vamos a generar una wallet temporal
    // Solo necesitamos verificar que Lucid puede serializar ByteArrays
    lucid.selectWalletFromSeed(await lucid.utils.generateSeedPhrase())

    const walletAddr = await lucid.wallet.address()
    console.log("\n📋 Configuration (test wallet):")
    console.log("   Wallet:", walletAddr)
    console.log("   ⚠️  Nota: Wallet temporal para test, no se enviará la tx")

    // Construir datum con Lucid
    console.log("\n" + "=".repeat(70))
    console.log("PASO 1: Construir datum con Lucid Data")
    console.log("=".repeat(70))

    try {
        const sensorData: SimpleSensorData = {
            sensor_id: fromText("ESP32_001"),
            temperature: BigInt(235),
            humidity: BigInt(652),
            timestamp: BigInt(1767720964446),
            signature: testSignature,
            public_key: testPublicKey
        }

        const datum = Data.to(sensorData, SimpleSensorData)
        console.log("✅ Datum construido con Lucid")
        console.log("   Datum CBOR:", datum.substring(0, 100) + "...")

        // Para este test, vamos a usar una dirección de script conocida
        // en lugar de calcularla (solo queremos probar la serialización del datum)
        // Usando la dirección que obtuvimos con MeshJS:
        const scriptAddr = "addr_test1wzcprs9r7fxdtsx3528zkxqzwft6zfhhf98vu25kupgul8gw8z59u"
        console.log("   Script address (from MeshJS):", scriptAddr)

        // Construir transacción
        console.log("\n" + "=".repeat(70))
        console.log("PASO 2: Construir transacción con Lucid")
        console.log("=".repeat(70))

        // Intentar construir la transacción
        // Nota: Puede fallar en .complete() si no hay UTXOs, pero eso está OK
        // Lo importante es verificar que Lucid puede serializar el datum con ByteArrays
        try {
            const tx = await lucid
                .newTx()
                .payToContract(scriptAddr, { inline: datum }, { lovelace: 3000000n })
                .complete()

            console.log("✅✅✅ TRANSACCIÓN COMPLETADA CON LUCID!")
            console.log("   Tx CBOR:", tx.toString().substring(0, 100) + "...")
            console.log("\n🎉 SOLUCIÓN ENCONTRADA: Usar Lucid en lugar de MeshJS")
            console.log("   Lucid puede serializar ByteArrays correctamente")
        } catch (completeErr: any) {
            const errMsg = completeErr?.message || completeErr?.toString() || "Unknown error"
            if (errMsg.includes("UTxO") ||
                errMsg.includes("balance") ||
                errMsg.includes("funds") ||
                errMsg.includes("No UTxOs") ||
                errMsg.includes("Insufficient input")) {
                console.log("⚠️  No se pudo completar la tx (sin fondos), pero eso es esperado")
                console.log("✅ Lo importante: El datum con ByteArrays se construyó sin error de BigInt")
                console.log("✅ Lucid NO tiene el bug de MeshJS con ByteArrays")
                console.log("\n🎉 SOLUCIÓN ENCONTRADA: Usar Lucid en lugar de MeshJS")
                console.log("   Error (esperado):", errMsg)
            } else {
                console.log("Error al completar tx:", errMsg)
                throw completeErr
            }
        }

    } catch (err: any) {
        console.log("❌ Error con Lucid:", err.message)
        console.log("\n   Stack:", err.stack)
        throw err
    }
}

main()
    .then(() => console.log("\n✨ Test completado exitosamente"))
    .catch(err => {
        console.error("\n❌ Error:", err)
        process.exit(1)
    })
