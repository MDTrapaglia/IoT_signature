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

/**
 * Test de serialización de transacción con ByteArrays
 *
 * Objetivo: Identificar exactamente dónde falla la serialización
 * cuando usamos ByteArrays en el datum.
 */

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

// Validador simple compilado
const simple_verifier_code = "59010f01010029800aba2aba1aab9faab9eaab9dab9a48888896600264653001300700198039804000cc01c0092225980099b8748008c01cdd500144ca60026016003300b300c001acc004cdc3a400060106ea80122b300130093754009149a2c80522c80392225980099b8748000c02cdd500144ca60026eb8c03cc040c040c040c040c040c034dd5000cdc919b8a3371466e2a600294690084dd698079808180818069baa0015e48dd7180798069baa0019800a51a4021375a601e6020601a6ea80057929800a51a4021375a601e602060206020601a6ea80057929bae300f3010301030103010300d3754002bb4180718061baa0028b201418041baa0028b200c180380098019baa0078a4d1365640041"

// Datos de prueba con firmas válidas
const testSignature = "98C72ABF5BBA1CF58B561EBF206172A073D7F1D051B8016F06E5EFC0BF9CD760CE2D4E3350678EF1D588A3EFF266D9187CC65249E0CE5C647292B9D2874391EA"
const testPublicKey = "70F655FB1D07117545A53C35763B09123F5885300BBC23EAFFFC5C19E882B578E4D07174066908503E24847F66F5758D01BD903C1A2A3B3AC375BBFAF4A94614"

async function main() {
    console.log("=".repeat(70))
    console.log("Test: Transaction Serialization with ByteArrays")
    console.log("=".repeat(70))

    const walletAddr = await wallet.getChangeAddress()
    const utxos = await wallet.getUtxos()

    const script: PlutusScript = {
        code: applyCborEncoding(simple_verifier_code),
        version: "V3",
    }

    const scriptAddr = serializePlutusScript(script).address

    console.log("\n📋 Configuration:")
    console.log("  Wallet:", walletAddr)
    console.log("  Script:", scriptAddr)
    console.log("  UTXOs available:", utxos.length)

    // PASO 1: Construir datum (ya sabemos que funciona)
    console.log("\n" + "=".repeat(70))
    console.log("PASO 1: Construir datum con byteString()")
    console.log("=".repeat(70))

    let datum: any
    try {
        datum = mConStr0([
            "ESP32_001",
            235,
            652,
            1767720964446,
            byteString(testSignature),
            byteString(testPublicKey)
        ])
        console.log("✅ Datum construido exitosamente")
        console.log("   Estructura:", JSON.stringify(datum, null, 2).substring(0, 300) + "...")
    } catch (err: any) {
        console.log("❌ Error construyendo datum:", err.message)
        throw err
    }

    // PASO 2: Configurar transacción básica
    console.log("\n" + "=".repeat(70))
    console.log("PASO 2: Configurar txOut con script address")
    console.log("=".repeat(70))

    try {
        txBuilder.txOut(scriptAddr, [
            { unit: "lovelace", quantity: "3000000" }
        ])
        console.log("✅ txOut configurado")
    } catch (err: any) {
        console.log("❌ Error en txOut:", err.message)
        throw err
    }

    // PASO 3: Agregar datum inline
    console.log("\n" + "=".repeat(70))
    console.log("PASO 3: Agregar inline datum con ByteArrays")
    console.log("=".repeat(70))

    try {
        txBuilder.txOutInlineDatumValue(datum)
        console.log("✅ Inline datum agregado")
    } catch (err: any) {
        console.log("❌ Error agregando datum:", err.message)
        console.log("   Stack:", err.stack)
        throw err
    }

    // PASO 4: Configurar change address
    console.log("\n" + "=".repeat(70))
    console.log("PASO 4: Configurar change address")
    console.log("=".repeat(70))

    try {
        txBuilder.changeAddress(walletAddr)
        console.log("✅ Change address configurada")
    } catch (err: any) {
        console.log("❌ Error en changeAddress:", err.message)
        throw err
    }

    // PASO 5: Seleccionar UTXOs
    console.log("\n" + "=".repeat(70))
    console.log("PASO 5: Seleccionar UTXOs")
    console.log("=".repeat(70))

    try {
        txBuilder.selectUtxosFrom(utxos)
        console.log("✅ UTXOs seleccionados")
    } catch (err: any) {
        console.log("❌ Error seleccionando UTXOs:", err.message)
        throw err
    }

    // PASO 6: Complete (aquí es donde normalmente falla)
    console.log("\n" + "=".repeat(70))
    console.log("PASO 6: Complete transaction (serialización)")
    console.log("=".repeat(70))
    console.log("⚠️  Este es el paso donde esperamos el error BigInt...")

    try {
        const unsignedTx = await txBuilder.complete()
        console.log("✅✅✅ TRANSACCIÓN COMPLETADA EXITOSAMENTE!")
        console.log("   Tx hex:", unsignedTx.substring(0, 100) + "...")
        console.log("\n🎉 ¡No hubo error! El problema estaba en otro lado.")
    } catch (err: any) {
        console.log("❌ Error en complete():", err.message)
        console.log("\n📍 Stack trace:")
        console.log(err.stack)

        console.log("\n🔍 Análisis del error:")
        if (err.message.includes("BigInt")) {
            console.log("   → Confirmado: Error relacionado con BigInt")
            console.log("   → El problema está en la serialización de la transacción")
            console.log("   → NO es un problema del datum en sí")
        }

        throw err
    }
}

main()
    .then(() => {
        console.log("\n" + "=".repeat(70))
        console.log("✨ Test completado")
        console.log("=".repeat(70))
    })
    .catch((err) => {
        console.log("\n" + "=".repeat(70))
        console.log("❌ Test falló - Ver análisis arriba")
        console.log("=".repeat(70))
        process.exit(1)
    })
