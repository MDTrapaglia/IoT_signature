import { C } from "lucid-cardano"

/**
 * Convierte una extended private key (xprv) de MeshJS al formato que Lucid necesita
 *
 * MeshJS usa: xprv... (extended private key bech32)
 * Lucid usa: payment signing key hex
 */
export function deriveLucidKeyFromXprv(xprvBech32: string): string {
    try {
        // Decodificar la extended private key
        const rootKey = C.Bip32PrivateKey.from_bech32(xprvBech32)

        // Derivar la payment key siguiendo el path estándar de Cardano
        // m/1852'/1815'/0'/0/0 (para address index 0)
        const harden = (num: number) => 0x80000000 + num

        const accountKey = rootKey
            .derive(harden(1852))  // purpose: Shelley
            .derive(harden(1815))  // coin_type: ADA
            .derive(harden(0))     // account

        const paymentKey = accountKey
            .derive(0)             // external chain
            .derive(0)             // address index

        // Extraer la signing key
        const privateKey = paymentKey.to_raw_key()
        const privateKeyBytes = privateKey.as_bytes()
        const privateKeyHex = Buffer.from(privateKeyBytes).toString('hex')

        return privateKeyHex
    } catch (err: any) {
        console.error("Error details:", err)
        throw new Error(`Failed to derive Lucid key from xprv: ${err.message || err}`)
    }
}

/**
 * Obtiene la signing key en formato hex desde el .env
 */
export function getLucidPrivateKey(): string {
    const xprv = process.env.PRIVATE_KEY

    if (!xprv) {
        throw new Error("PRIVATE_KEY not found in .env")
    }

    if (xprv.startsWith('xprv')) {
        console.log("  Converting MeshJS xprv to Lucid format...")
        return deriveLucidKeyFromXprv(xprv)
    }

    // Si ya está en formato hex, devolverlo directamente
    if (/^[0-9a-fA-F]{128}$/.test(xprv)) {
        console.log("  Using hex private key...")
        return xprv
    }

    throw new Error("PRIVATE_KEY format not recognized. Expected xprv... or 128-char hex string")
}
