import {
    BlockfrostProvider,
    MeshWallet,
    MeshTxBuilder,
    applyCborEncoding,
    type PlutusScript,
    mConStr0,
    serializePlutusScript
} from "@meshsdk/core"
import dotenv from "dotenv"
dotenv.config()

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

// Código compilado del validador simple_test
// Hash: 7c277934e259952e71730068aff53e6e688d84d4722e7547f2cee2d2
const simple_test_code = "58a101010029800aba2aba1aab9faab9eaab9dab9a48888896600264653001300700198039804000cc01c0092225980099b8748008c01cdd500144ca60026016003300b300c001acc004cdc3a400060106ea80122b300130093754009149a2c80522c80392225980099b8748000c02cdd500144cdc4240006eb4c038c030dd5180718061baa0028b201418041baa0028b200c180380098019baa0078a4d13656400401"

const script: PlutusScript = {
    code: applyCborEncoding(simple_test_code),
    version: "V3",
};

const scriptAddr = serializePlutusScript(script).address;

async function testSimpleValidator() {
    console.log("=" .repeat(60))
    console.log("Test 1: Crear UTXO con datum simple")
    console.log("=".repeat(60))

    const walletAddr = await wallet.getChangeAddress();
    const utxos = await wallet.getUtxos()

    console.log("\n📋 Configuración:")
    console.log("  Wallet:", walletAddr)
    console.log("  Script Address:", scriptAddr)
    console.log("  Validator Hash: 7c277934e259952e71730068aff53e6e688d84d4722e7547f2cee2d2")

    // Datum super simple: { value: 5 }
    // Constructor 0, un solo campo Int
    const datum = mConStr0([5]);

    console.log("\n📊 Datum:")
    console.log("  { value: 5 }")
    console.log("  El validador solo verifica que value > 0")

    try {
        console.log("\n🔄 Creando UTXO...")

        const unsignedTx = await txBuilder
            .txOut(scriptAddr, [
                { unit: "lovelace", quantity: "3000000" }
            ])
            .txOutInlineDatumValue(datum)
            .changeAddress(walletAddr)
            .selectUtxosFrom(utxos)
            .complete();

        const signedTx = await wallet.signTx(unsignedTx)
        const txHash = await wallet.submitTx(signedTx)

        console.log("\n" + "=".repeat(60))
        console.log("✅ UTXO CREADO EXITOSAMENTE")
        console.log("=".repeat(60))
        console.log("\n  Tx Hash:", txHash)
        console.log(`  Explorer: https://preprod.cardanoscan.io/transaction/${txHash}`)
        console.log("\n  Ahora esperamos 30 segundos y consumimos el UTXO...")

        // Esperar a que se confirme
        await new Promise(resolve => setTimeout(resolve, 30000));

        // Consumir el UTXO
        await consumeSimpleUtxo(txHash);

    } catch (err: any) {
        console.log("\n❌ Error:", err.message || err)
        throw err
    }
}

async function consumeSimpleUtxo(txHashToConsume: string) {
    console.log("\n" + "=".repeat(60))
    console.log("Test 2: Consumir UTXO con validación simple")
    console.log("=".repeat(60))

    const walletAddr = await wallet.getChangeAddress();
    const walletUtxos = await wallet.getUtxos()
    const collateral = await wallet.getCollateral();

    console.log("\n🔍 Buscando UTXO creado...")
    console.log("  Buscando tx:", txHashToConsume)

    const scriptUtxos = await blockchainProvider.fetchAddressUTxOs(scriptAddr);

    if (!scriptUtxos || scriptUtxos.length === 0) {
        console.log("\n❌ No se encontró ningún UTXO en la dirección del script")
        return;
    }

    console.log(`✅ Encontrado ${scriptUtxos.length} UTXO(s) en el script address`)

    // Buscar el UTXO específico que acabamos de crear
    const utxoToConsume = scriptUtxos.find(u => u.input.txHash === txHashToConsume);

    if (!utxoToConsume) {
        console.log("\n❌ No se encontró el UTXO específico creado:", txHashToConsume)
        console.log("  UTXOs disponibles:")
        scriptUtxos.forEach(u => console.log("    -", u.input.txHash, "#", u.input.outputIndex))
        return;
    }

    console.log("\n📦 UTXO a consumir:")
    console.log("  Tx Hash:", utxoToConsume.input.txHash)
    console.log("  Output Index:", utxoToConsume.input.outputIndex)

    // Redeemer vacío
    const redeemer = mConStr0([]);

    console.log("\n🔄 Construyendo transacción de consumo...")
    console.log("  El validador verificará que value > 0")
    console.log("  Esperamos que pase ✅")

    try {
        const unsignedTx = await txBuilder
            .spendingPlutusScriptV3()
            .txIn(
                utxoToConsume.input.txHash,
                utxoToConsume.input.outputIndex,
                utxoToConsume.output.amount,
                scriptAddr
            )
            .txInScript(script.code)
            .txInInlineDatumPresent()
            .txInRedeemerValue(redeemer)
            .txInCollateral(
                collateral[0].input.txHash,
                collateral[0].input.outputIndex,
                collateral[0].output.amount,
                collateral[0].output.address
            )
            .changeAddress(walletAddr)
            // NO usar selectUtxosFrom con el script input - dejamos que solo use wallet UTXOs para fees
            .selectUtxosFrom(walletUtxos.filter(u => u.input.txHash !== utxoToConsume.input.txHash))
            .complete();

        console.log("\n  ✅ Transacción construida")
        console.log("  🔄 Firmando...")

        const signedTx = await wallet.signTx(unsignedTx)

        console.log("  🔄 Enviando...")
        const txHash = await wallet.submitTx(signedTx)

        console.log("\n" + "=".repeat(60))
        console.log("🎉 ¡VALIDACIÓN ON-CHAIN EXITOSA!")
        console.log("=".repeat(60))
        console.log("\n  Tx Hash:", txHash)
        console.log(`  Explorer: https://preprod.cardanoscan.io/transaction/${txHash}`)
        console.log("\n  ✅ El validador se ejecutó correctamente")
        console.log("  ✅ Verificó que value (5) > 0")
        console.log("  ✅ Permitió el consumo del UTXO")
        console.log("\n  🎯 Sistema de validación on-chain FUNCIONA")
        console.log("\n" + "=".repeat(60))

    } catch (err: any) {
        console.log("\n" + "=".repeat(60))
        console.log("❌ FALLO EN VALIDACIÓN")
        console.log("=".repeat(60))

        const errorMsg = err.message || err.toString();
        console.log("\n  Error:", errorMsg)

        if (errorMsg.includes("ScriptFailures")) {
            console.log("\n  ❌ El validador rechazó la transacción")
            console.log("  Esto NO debería pasar porque value (5) > 0")
        }

        console.log("\n  Detalles completos:")
        console.log(err)
        throw err
    }
}

// Main
async function main() {
    try {
        await testSimpleValidator();
    } catch (err) {
        console.error("\n❌ Test falló:", err);
        process.exit(1);
    }
}

main()
    .then(() => console.log("\n✨ Test completado"))
    .catch((err) => {
        console.error("\n❌ Error:", err)
        process.exit(1)
    })
