import { hexToBytes, byteString, mConStr0 } from "@meshsdk/core"

const testSignature = "b7dd94eb4ad09b8ee49cd04bed69cadf233088c36a419bac03077fcc1ec4dda67ae7ae0524db0ac5007145e8b90e7f213f2c58f030907331d68a6326a4ae0a07"
const testPublicKey = "744ce5bf4b605e8b93573f7dac6cbeec921b76b9708eeed05c39174d424860d5"

console.log("=".repeat(70))
console.log("Test MeshJS Hex Conversion Functions")
console.log("=".repeat(70))

console.log("\n1. Testing hexToBytes():")
try {
    const sigBytes = hexToBytes(testSignature)
    const pkBytes = hexToBytes(testPublicKey)

    console.log("  ✅ hexToBytes() works")
    console.log(`  signature type: ${typeof sigBytes}`)
    console.log(`  signature: ${JSON.stringify(sigBytes)}`)
    console.log(`  public_key type: ${typeof pkBytes}`)
    console.log(`  public_key: ${JSON.stringify(pkBytes)}`)

    // Try in datum
    console.log("\n2. Testing in mConStr0 datum:")
    const datum = mConStr0([
        "ESP32_001",
        235,
        652,
        Date.now(),
        sigBytes,
        pkBytes
    ])

    console.log("  ✅ Datum construction with hexToBytes() SUCCESS")
    console.log(`  Datum: ${JSON.stringify(datum, null, 2)}`)

} catch (err: any) {
    console.log("  ❌ Error:", err.message)
}

console.log("\n3. Testing byteString():")
try {
    const sigBS = byteString(testSignature)
    const pkBS = byteString(testPublicKey)

    console.log("  ✅ byteString() works")
    console.log(`  signature type: ${typeof sigBS}`)
    console.log(`  signature: ${JSON.stringify(sigBS)}`)
    console.log(`  public_key type: ${typeof pkBS}`)
    console.log(`  public_key: ${JSON.stringify(pkBS)}`)

} catch (err: any) {
    console.log("  ❌ Error:", err.message)
}

console.log("\n" + "=".repeat(70))
