#!/usr/bin/env tsx
/**
 * Update Oracle using Lucid (to avoid MeshJS BigInt serialization issues)
 * This script updates the oracle with new sensor data
 */

import { Blockfrost, Lucid, Data, applyParamsToScript, Constr } from "@lucid-evolution/lucid";
import { readFileSync } from "fs";
import { resolve } from "path";
import dotenv from "dotenv";
import crypto from "crypto";
import nacl from "tweetnacl";

dotenv.config();

// Sensor Data schema
const SensorDataSchema = Data.Object({
    sensor_id: Data.Bytes(),
    temperature: Data.Integer(),
    humidity: Data.Integer(),
    timestamp: Data.Integer(),
    signature: Data.Bytes(),
    public_key: Data.Bytes()
});

type SensorData = Data.Static<typeof SensorDataSchema>;
const SensorData = SensorDataSchema as unknown as SensorData;

// Oracle Params schema
const OracleParamsSchema = Data.Tuple([
    Data.Object({ // AssetClass
        fields: Data.Tuple([Data.Bytes(), Data.Bytes()]) // policy_id, name
    }),
    Data.Bytes() // operator pub key hash
]);

// Oracle Redeemer (Update = 0, Delete = 1)
const OracleRedeemer = {
    Update: () => Data.to(new Constr(0, [])),
    Delete: () => Data.to(new Constr(1, []))
};

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
    console.log("Update Oracle with Lucid");
    console.log("=".repeat(70));

    // Initialize Lucid
    const lucid = await Lucid(
        new Blockfrost(
            "https://cardano-preprod.blockfrost.io/api/v0",
            process.env.BLOCKFROST_API_KEY || ""
        ),
        "Preprod"
    );

    // Load wallet
    const meshPrivateKey = process.env.PRIVATE_KEY;
    if (!meshPrivateKey) {
        throw new Error("PRIVATE_KEY not found in .env");
    }

    console.log("\n Loading wallet...");
    const { C } = await import("@lucid-evolution/lucid");
    const rootKey = C.Bip32PrivateKey.from_bech32(meshPrivateKey);
    const harden = (num: number) => 0x80000000 + num;
    const accountKey = rootKey
        .derive(harden(1852))
        .derive(harden(1815))
        .derive(harden(0));
    const paymentKey = accountKey.derive(0).derive(0).to_raw_key();
    const paymentKeyBech32 = paymentKey.to_bech32();
    lucid.selectWalletFromPrivateKey(paymentKeyBech32);

    const walletAddr = await lucid.wallet.address();
    console.log("  ✅ Wallet loaded");

    // Get operator pub key hash
    const paymentCredential = lucid.utils.getAddressDetails(walletAddr).paymentCredential;
    if (!paymentCredential) {
        throw new Error("Could not extract payment credential from wallet");
    }
    const operatorPubKeyHash = paymentCredential.hash;

    // Load and apply script params
    const plutusJsonPath = resolve(process.cwd(), "onchain/sensors-oracle/plutus.json");
    const plutusJson = JSON.parse(readFileSync(plutusJsonPath, "utf-8"));
    const oracleValidator = plutusJson.validators.find((v: any) =>
        v.title === "sensor_oracle_ed25519.sensor_oracle_ed25519.spend"
    );

    if (!oracleValidator) {
        throw new Error("Oracle validator not found in plutus.json");
    }

    // Apply parameters: OracleParams { nft: AssetClass, operator }
    const paramsData = Data.to(new Constr(0, [
        new Constr(0, [nftPolicyId, nftAssetName]), // AssetClass
        operatorPubKeyHash
    ]));

    const oracleScript = applyParamsToScript(oracleValidator.compiledCode, [paramsData]);
    const oracleScriptAddr = lucid.utils.validatorToAddress({
        type: "PlutusV3",
        script: oracleScript
    });

    console.log(`\n🔍 Oracle Address: ${oracleScriptAddr}`);

    // Find oracle UTXO
    const scriptUtxos = await lucid.utxosAt(oracleScriptAddr);
    const nftUnit = `${nftPolicyId}${nftAssetName}`;

    const oracleUtxo = scriptUtxos.find(utxo =>
        utxo.assets[nftUnit] === BigInt(1)
    );

    if (!oracleUtxo) {
        throw new Error("Oracle UTXO not found");
    }

    console.log(`✓ Found oracle UTXO: ${oracleUtxo.txHash}#${oracleUtxo.outputIndex}`);

    // Generate fresh sensor data and signature
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

    // Build new datum
    const newDatum = Data.to({
        sensor_id: Buffer.from(sensorData.sensor_id, 'utf8').toString('hex'),
        temperature: BigInt(sensorData.temperature),
        humidity: BigInt(sensorData.humidity),
        timestamp: BigInt(sensorData.timestamp),
        signature: Buffer.from(signature).toString('hex'),
        public_key: Buffer.from(keyPair.publicKey).toString('hex')
    }, SensorData);

    // Build redeemer
    const redeemer = OracleRedeemer.Update();

    console.log(`\n🔄 Building transaction...`);

    // Build transaction
    const tx = await lucid
        .newTx()
        .collectFrom([oracleUtxo], redeemer)
        .attachSpendingValidator({
            type: "PlutusV3",
            script: oracleScript
        })
        .payToContract(oracleScriptAddr, { inline: newDatum }, {
            lovelace: BigInt(2000000),
            [nftUnit]: BigInt(1)
        })
        .addSignerKey(operatorPubKeyHash)
        .complete();

    console.log(`  ✅ Transaction built`);
    console.log(`  🔄 Signing...`);
    const signedTx = await tx.sign().complete();

    console.log(`  🔄 Submitting...`);
    const txHash = await signedTx.submit();

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
