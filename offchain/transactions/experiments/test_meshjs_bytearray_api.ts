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
 * Alternativa 1: Investigar API correcta de MeshJS para ByteArrays
 *
 * Este script prueba diferentes formas de construir datums con ByteArrays
 * para identificar cuál funciona correctamente con MeshJS v4 beta.
 */

const blockchainProvider = new BlockfrostProvider(process.env.BLOCKFROST_API_KEY || "")

const wallet = new MeshWallet({
    networkId: 0,
    fetcher: blockchainProvider,
    submitter: blockchainProvider,
    key: {
        type: "root",
        bech32: process.env.PRIVATE_KEY || ""
    },
});

// Datos de prueba
const testSignature = "98C72ABF5BBA1CF58B561EBF206172A073D7F1D051B8016F06E5EFC0BF9CD760CE2D4E3350678EF1D588A3EFF266D9187CC65249E0CE5C647292B9D2874391EA"
const testPublicKey = "70F655FB1D07117545A53C35763B09123F5885300BBC23EAFFFC5C19E882B578E4D07174066908503E24847F66F5758D01BD903C1A2A3B3AC375BBFAF4A94614"

console.log("=".repeat(70))
console.log("Test 1: byteString() - Current approach")
console.log("=".repeat(70))
try {
    const datum1 = mConStr0([
        "ESP32_001",
        235,
        652,
        1767720964446,
        byteString(testSignature),
        byteString(testPublicKey)
    ]);

    console.log("✅ byteString() construction SUCCESS")
    console.log("   Datum structure:", JSON.stringify(datum1, null, 2))
} catch (err: any) {
    console.log("❌ byteString() FAILED:", err.message)
    console.log("   Stack:", err.stack)
}

console.log("\n" + "=".repeat(70))
console.log("Test 2: Manual {bytes: string} object")
console.log("=".repeat(70))
try {
    const datum2 = mConStr0([
        "ESP32_001",
        235,
        652,
        1767720964446,
        { bytes: testSignature },
        { bytes: testPublicKey }
    ]);

    console.log("✅ Manual {bytes} construction SUCCESS")
    console.log("   Datum structure:", JSON.stringify(datum2, null, 2))
} catch (err: any) {
    console.log("❌ Manual {bytes} FAILED:", err.message)
    console.log("   Stack:", err.stack)
}

console.log("\n" + "=".repeat(70))
console.log("Test 3: byteString() with Buffer.from()")
console.log("=".repeat(70))
try {
    const datum3 = mConStr0([
        "ESP32_001",
        235,
        652,
        1767720964446,
        byteString(Buffer.from(testSignature, 'hex').toString('hex')),
        byteString(Buffer.from(testPublicKey, 'hex').toString('hex'))
    ]);

    console.log("✅ byteString(Buffer.from()) construction SUCCESS")
    console.log("   Datum structure:", JSON.stringify(datum3, null, 2))
} catch (err: any) {
    console.log("❌ byteString(Buffer.from()) FAILED:", err.message)
    console.log("   Stack:", err.stack)
}

console.log("\n" + "=".repeat(70))
console.log("Test 4: Small ByteArray (8 bytes)")
console.log("=".repeat(70))
try {
    const smallHex = "0123456789ABCDEF"
    const datum4 = mConStr0([
        "ESP32_001",
        235,
        652,
        1767720964446,
        byteString(smallHex),
        byteString(smallHex)
    ]);

    console.log("✅ Small ByteArray construction SUCCESS")
    console.log("   Datum structure:", JSON.stringify(datum4, null, 2))
} catch (err: any) {
    console.log("❌ Small ByteArray FAILED:", err.message)
    console.log("   Stack:", err.stack)
}

console.log("\n" + "=".repeat(70))
console.log("Test 5: Empty ByteArray")
console.log("=".repeat(70))
try {
    const datum5 = mConStr0([
        "ESP32_001",
        235,
        652,
        1767720964446,
        byteString(""),
        byteString("")
    ]);

    console.log("✅ Empty ByteArray construction SUCCESS")
    console.log("   Datum structure:", JSON.stringify(datum5, null, 2))
} catch (err: any) {
    console.log("❌ Empty ByteArray FAILED:", err.message)
    console.log("   Stack:", err.stack)
}

console.log("\n" + "=".repeat(70))
console.log("Test 6: Check MeshJS exports for other ByteArray functions")
console.log("=".repeat(70))
// Intentar importar otras funciones posibles
try {
    // Verificar qué funciones están disponibles
    const meshCore = await import("@meshsdk/core")
    const byteArrayFunctions = Object.keys(meshCore).filter(key =>
        key.toLowerCase().includes('byte') ||
        key.toLowerCase().includes('hex') ||
        key.toLowerCase().includes('cbor')
    )

    console.log("📦 Available functions related to bytes/hex/cbor:")
    byteArrayFunctions.forEach(fn => console.log(`   - ${fn}`))
} catch (err: any) {
    console.log("❌ Error listing functions:", err.message)
}

console.log("\n" + "=".repeat(70))
console.log("Summary")
console.log("=".repeat(70))
console.log("Tests completed. Check which approach succeeded above.")
console.log("Next: Try the successful approach in a real transaction.")
