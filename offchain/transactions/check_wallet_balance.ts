import { BlockfrostProvider, MeshWallet } from "@meshsdk/core"
import dotenv from "dotenv"
dotenv.config()

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

async function checkBalance() {
    console.log("=".repeat(60))
    console.log("Checking Wallet Balance")
    console.log("=".repeat(60))

    const address = await wallet.getChangeAddress()
    console.log("\nWallet Address:", address)

    const utxos = await wallet.getUtxos()
    console.log("\nTotal UTXOs:", utxos.length)

    let totalLovelace = 0
    utxos.forEach((utxo, i) => {
        const lovelace = parseInt(utxo.output.amount.find(a => a.unit === "lovelace")?.quantity || "0")
        totalLovelace += lovelace
        console.log(`\nUTXO ${i + 1}:`)
        console.log(`  Tx Hash: ${utxo.input.txHash}`)
        console.log(`  Index: ${utxo.input.outputIndex}`)
        console.log(`  Amount: ${lovelace} lovelace (${(lovelace / 1_000_000).toFixed(2)} ADA)`)
    })

    console.log("\n" + "=".repeat(60))
    console.log(`Total Balance: ${totalLovelace} lovelace (${(totalLovelace / 1_000_000).toFixed(2)} ADA)`)
    console.log("=".repeat(60))

    // Calcular si es suficiente para la transacción
    const requiredForTx = 3_000_000 // 3 ADA para enviar al script
    const estimatedFee = 500_000    // ~0.5 ADA fee estimado
    const requiredTotal = requiredForTx + estimatedFee

    console.log("\n📊 Transaction Requirements:")
    console.log(`  To send to script: ${requiredForTx} lovelace (3 ADA)`)
    console.log(`  Estimated fee: ${estimatedFee} lovelace (~0.5 ADA)`)
    console.log(`  Total required: ${requiredTotal} lovelace (${(requiredTotal / 1_000_000).toFixed(2)} ADA)`)
    console.log(`  Available: ${totalLovelace} lovelace (${(totalLovelace / 1_000_000).toFixed(2)} ADA)`)

    if (totalLovelace >= requiredTotal) {
        console.log("\n✅ Sufficient balance for transaction")
    } else {
        console.log("\n❌ Insufficient balance")
        console.log(`  Need: ${(requiredTotal - totalLovelace) / 1_000_000} more ADA`)
    }
}

checkBalance()
    .then(() => console.log("\n✨ Done"))
    .catch((err) => {
        console.error("\n❌ Error:", err)
        process.exit(1)
    })
