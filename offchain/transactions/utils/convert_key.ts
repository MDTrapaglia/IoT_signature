import { C } from "lucid-cardano"
import dotenv from "dotenv"
dotenv.config()

/**
 * Utility para convertir private key de formato bech32 (MeshJS) a hex (Lucid)
 */

async function convertKey() {
    const privateKeyBech32 = process.env.PRIVATE_KEY || ""

    console.log("Private Key (bech32):", privateKeyBech32.substring(0, 20) + "...")

    try {
        // Intentar decodificar como bech32
        const decoded = C.PrivateKey.from_bech32(privateKeyBech32)
        const hex = decoded.to_hex()

        console.log("\n✅ Converted to hex:")
        console.log(hex)

        console.log("\n📝 Update your .env file:")
        console.log(`PRIVATE_KEY_HEX=${hex}`)

    } catch (err: any) {
        console.error("❌ Error converting key:", err.message)
        console.log("\nℹ️  Your PRIVATE_KEY might already be in a different format")
        console.log("   Lucid expects either:")
        console.log("   1. Bech32 format starting with 'ed25519_sk' or 'ed25519e_sk'")
        console.log("   2. 64-byte hex string")
    }
}

convertKey()
