#!/usr/bin/env tsx
/**
 * Test manual oracle update
 * Simplified version to debug the BigInt serialization issue
 */

import { MeshWallet, BlockfrostProvider, MeshTxBuilder, type PlutusScript, applyParamsToScript, mConStr0, serializePlutusScript, byteString, applyCborEncoding, deserializeAddress } from "@meshsdk/core";
import { readFileSync } from "fs";
import { resolve } from "path";
import dotenv from "dotenv";
import crypto from "crypto";
import nacl from "tweetnacl";

dotenv.config();

// Build message for Ed25519 signature
function buildMessage(data: { humidity: number, sensor_id: string, temperature: number, timestamp: number }): Buffer {
    const humidityBytes = Buffer.alloc(8);
    humidityBytes.writeBigInt64BE(BigInt(data.humidity));

    const sensorIdBytes = Buffer.from(data.sensor_id, 'utf8');

    const temperatureBytes = Buffer.alloc(8);
    temperatureBytes.writeBigInt64BE(BigInt(data.temperature));

    const timestampBytes = Buffer.alloc(8);
    timestampBytes.writeBigInt64BE(BigInt(data.timestamp));

    return Buffer.concat([humidityBytes, sensorIdBytes, temperatureBytes, timestampBytes]);
}

async function main() {
    const nftPolicyId = "a2f69dc8b380bbcf6b79d3e3b26097423c981df0bce0bd44d1e75de9";
    const nftAssetName = "53454e534f525f45535033325f544553545f3030315f5632";

    console.log("=".repeat(70));
    console.log("Test Manual Oracle Update");
    console.log("=".repeat(70));

    const blockchainProvider = new BlockfrostProvider(process.env.BLOCKFROST_API_KEY!);
    const txBuilder = new MeshTxBuilder({
        fetcher: blockchainProvider,
        submitter: blockchainProvider,
        evaluator: blockchainProvider,
        verbose: false
    });

    const wallet = new MeshWallet({
        networkId: 0,
        fetcher: blockchainProvider,
        submitter: blockchainProvider,
        key: {
            type: "root",
            bech32: process.env.PRIVATE_KEY!
        },
    });

    const walletAddr = await wallet.getChangeAddress();
    const allUtxos = await wallet.getUtxos();
    const collateral = await wallet.getCollateral();

    // Filter out collateral from available UTXOs to avoid conflicts
    const utxos = allUtxos.filter(utxo =>
        !(utxo.input.txHash === collateral[0].input.txHash &&
          utxo.input.outputIndex === collateral[0].input.outputIndex)
    );

    // Load and apply script
    const plutusJsonPath = resolve(process.cwd(), "onchain/sensors-oracle/plutus.json");
    const plutusJson = JSON.parse(readFileSync(plutusJsonPath, "utf-8"));
    const oracle_validator_code = plutusJson.validators.find((v: any) => v.title === "sensor_oracle_ed25519.sensor_oracle_ed25519.spend").compiledCode;

    const walletAddrDetails = deserializeAddress(walletAddr);
    const operatorPubKeyHash = walletAddrDetails.pubKeyHash!;

    const codeWithParams = applyParamsToScript(
        applyCborEncoding(oracle_validator_code),
        [mConStr0([nftPolicyId, nftAssetName]), operatorPubKeyHash]
    );

    const oracleScript: PlutusScript = {
        code: codeWithParams,
        version: "V3",
    };

    const oracleScriptAddr = serializePlutusScript(oracleScript).address;

    // Find oracle UTXO
    const scriptUtxos = await blockchainProvider.fetchAddressUTxOs(oracleScriptAddr);
    const nftUnit = `${nftPolicyId}${nftAssetName}`;

    let oracleUtxo;
    for (const utxo of scriptUtxos) {
        for (const asset of utxo.output.amount) {
            if (asset.unit === nftUnit && asset.quantity === "1") {
                oracleUtxo = utxo;
                break;
            }
        }
    }

    if (!oracleUtxo) {
        throw new Error("Oracle UTXO not found");
    }

    console.log(`\n✓ Found oracle UTXO: ${oracleUtxo.input.txHash}#${oracleUtxo.input.outputIndex}`);

    // Generate fresh data and signature
    const sensorData = {
        sensor_id: "ESP32_001",
        temperature: 235,
        humidity: 652,
        timestamp: Date.now()
    };

    const message = buildMessage(sensorData);
    const messageHash = crypto.createHash('sha256').update(message).digest();
    const keyPair = nacl.sign.keyPair();
    const signature = nacl.sign.detached(messageHash, keyPair.secretKey);

    console.log(`\n📊 New sensor data:`);
    console.log(`  Temperature: ${sensorData.temperature}`);
    console.log(`  Humidity: ${sensorData.humidity}`);
    console.log(`  Timestamp: ${sensorData.timestamp}`);

    // Build new datum - CRITICAL: Use explicit Number() conversions
    const newDatum = mConStr0([
        sensorData.sensor_id,
        Number(sensorData.temperature),
        Number(sensorData.humidity),
        Number(sensorData.timestamp),
        byteString(Buffer.from(signature).toString('hex')),
        byteString(Buffer.from(keyPair.publicKey).toString('hex'))
    ] as any);

    const redeemer = mConStr0([]);

    console.log(`\n🔄 Building transaction...`);

    const unsignedTx = await txBuilder
        .spendingPlutusScriptV3()
        .txIn(
            oracleUtxo.input.txHash,
            oracleUtxo.input.outputIndex,
            oracleUtxo.output.amount,
            oracleScriptAddr
        )
        .txInScript(oracleScript.code)
        .txInInlineDatumPresent()
        .txInRedeemerValue(redeemer)
        .txOut(oracleScriptAddr, [
            { unit: "lovelace", quantity: "2000000" },
            { unit: nftUnit, quantity: "1" }
        ])
        .txOutInlineDatumValue(newDatum)
        .txInCollateral(
            collateral[0].input.txHash,
            collateral[0].input.outputIndex,
            collateral[0].output.amount,
            collateral[0].output.address
        )
        .requiredSignerHash(operatorPubKeyHash)
        .changeAddress(walletAddr)
        .selectUtxosFrom(utxos)
        .complete();

    console.log(`  ✅ Transaction built`);
    console.log(`  🔄 Signing...`);
    const signedTx = await wallet.signTx(unsignedTx);
    console.log(`  🔄 Submitting...`);
    const txHash = await wallet.submitTx(signedTx);

    console.log(`\n✅ SUCCESS!`);
    console.log(`  Tx Hash: ${txHash}`);
    console.log(`  Explorer: https://preprod.cardanoscan.io/transaction/${txHash}`);
}

main().catch((error) => {
    console.error("\n❌ Error:", error.message || error);
    if (error.stack) {
        console.error("\nStack:", error.stack);
    }
    process.exit(1);
});
