import { Lucid } from "lucid-cardano"

/**
 * Utility para generar una nueva wallet para Lucid
 * Guarda la seed phrase y private key para usar en los scripts
 */

async function generateLucidWallet() {
    console.log("=".repeat(60))
    console.log("Generating new Lucid wallet")
    console.log("=".repeat(60))

    // Crear instancia de Lucid (no necesita provider para generar wallet)
    const lucid = await Lucid.new(undefined, "Preprod")

    // Generar seed phrase
    const seedPhrase = lucid.utils.generateSeedPhrase()
    console.log("\n📝 Seed Phrase (24 words):")
    console.log(seedPhrase)

    // Seleccionar wallet desde seed
    lucid.selectWalletFromSeed(seedPhrase)

    // Obtener dirección
    const address = await lucid.wallet.address()
    console.log("\n📍 Wallet Address:")
    console.log(address)

    console.log("\n" + "=".repeat(60))
    console.log("Add to your .env file:")
    console.log("=".repeat(60))
    console.log(`LUCID_SEED="${seedPhrase}"`)

    console.log("\n⚠️  IMPORTANT:")
    console.log("  1. Save these credentials securely")
    console.log("  2. Send test ADA to this address before using")
    console.log("  3. Get test ADA from: https://docs.cardano.org/cardano-testnet/tools/faucet")
    console.log("\n✨ Done")
}

generateLucidWallet()
    .catch((err) => {
        console.error("❌ Error:", err)
        process.exit(1)
    })
