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
import fs from "fs"
import nacl from "tweetnacl"

dotenv.config()

const blockchainProvider = new BlockfrostProvider(process.env.BLOCKFROST_API_KEY || "")

const txBuilder = new MeshTxBuilder({
    fetcher: blockchainProvider,
    submitter: blockchainProvider,
    evaluator: blockchainProvider,
    verbose: false
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

// Código compilado del validador simple_ed25519
const simple_ed25519_code = "58bb01010029800aba2aba1aab9faab9eaab9dab9a48888896600264653001300700198039804000cc01c0092225980099b8748008c01cdd500144ca60026016003300b300c001acc004cdc3a400060106ea80122b300130093754009149a2c80522c80392225980099b8748000c02cdd500144ca60026eb8c03cc040c040c034dd5000cdd7180798069baa0019bae300f3010300d3754002b95180718061baa0028b201418041baa0028b200c180380098019baa0078a4d1365640041"

const script: PlutusScript = {
    code: applyCborEncoding(simple_ed25519_code),
    version: "V3",
};

const scriptAddr = serializePlutusScript(script).address;

async function main() {
    console.log("=".repeat(60))
    console.log("Crear UTXO con Validador Ed25519")
    console.log("=".repeat(60))

    const walletAddr = await wallet.getChangeAddress();
    const utxos = await wallet.getUtxos()

    console.log("\n📋 Configuración:")
    console.log(`  Wallet: ${walletAddr}`)
    console.log(`  Script Address: ${scriptAddr}`)
    console.log(`  UTXOs disponibles: ${utxos.length}`)

    // Generar par de claves Ed25519 válidas con TweetNaCl
    console.log("\n🔑 Generando par de claves Ed25519 con TweetNaCl...")

    const keyPair = nacl.sign.keyPair();
    const publicKeyBytes = keyPair.publicKey;
    const secretKeyBytes = keyPair.secretKey;

    // Mensaje de prueba
    const message = Buffer.from("Hello Cardano from ESP32!", 'utf8');
    const messageHex = message.toString('hex');

    // Firmar mensaje
    const signature = nacl.sign.detached(message, secretKeyBytes);

    // Convertir a hex
    const publicKeyHex = Buffer.from(publicKeyBytes).toString('hex');
    const signatureHex = Buffer.from(signature).toString('hex');

    console.log(`  Public Key (32 bytes): ${publicKeyHex}`)
    console.log(`  Message: "${message.toString('utf8')}"`)
    console.log(`  Message (hex): ${messageHex}`)
    console.log(`  Signature (64 bytes): ${signatureHex}`)
    console.log(`  ✅ Firma generada y válida`)

    // Verificar localmente que la firma es válida
    const isValid = nacl.sign.detached.verify(message, signature, publicKeyBytes);
    console.log(`  ✅ Verificación local: ${isValid ? 'VÁLIDA' : 'INVÁLIDA'}`)

    // Crear datum con mensaje, firma y clave pública
    // Ed25519Data { message: ByteArray, signature: ByteArray, public_key: VerificationKey }
    const datum = mConStr0([
        messageHex,      // message
        signatureHex,    // signature
        publicKeyHex     // public_key
    ]);

    console.log("\n🔨 Construyendo transacción...")
    console.log("  Depositando 3 ADA en script address")
    console.log("  Datum: { message, signature, public_key }")

    const unsignedTx = await txBuilder
        .txOut(scriptAddr, [{ unit: "lovelace", quantity: "3000000" }])
        .txOutInlineDatumValue(datum)
        .changeAddress(walletAddr)
        .selectUtxosFrom(utxos)
        .complete();

    console.log("  ✅ Transacción construida")
    console.log("  🔄 Firmando...")
    const signedTx = await wallet.signTx(unsignedTx);
    console.log("  🔄 Enviando...")
    const txHash = await wallet.submitTx(signedTx);

    console.log("\n" + "=".repeat(60))
    console.log("✅ UTXO CREADO")
    console.log("=".repeat(60))
    console.log(`\n  Tx Hash: ${txHash}`)
    console.log(`  Explorer: https://preprod.cardanoscan.io/transaction/${txHash}`)
    console.log(`\n  📝 Para consumir este UTXO:`)
    console.log(`  npm run test:ed25519:consume`)
    console.log("\n" + "=".repeat(60))

    // Guardar las claves para el script de consumo
    const testData = {
        txHash,
        publicKey: publicKeyHex,
        message: messageHex,
        signature: signatureHex,
        scriptAddress: scriptAddr
    };

    fs.writeFileSync('test-data/ed25519_test_keys.json', JSON.stringify(testData, null, 2));
    console.log("\n💾 Claves guardadas en: test-data/ed25519_test_keys.json")
}

main().catch(console.error)
