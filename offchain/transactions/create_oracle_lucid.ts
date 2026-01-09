#!/usr/bin/env tsx
/**
 * Create Oracle using Lucid Evolution
 * Initializes a new oracle with NFT and initial sensor data
 */

import { Blockfrost, Lucid, Data, applyParamsToScript, Constr, validatorToAddress } from "@lucid-evolution/lucid";
import { readFileSync } from "fs";
import { resolve } from "path";
import dotenv from "dotenv";
import crypto from "crypto";
import nacl from "tweetnacl";

dotenv.config();

// Sensor Data schema (same as update_oracle_lucid.ts)
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

// Build message for Ed25519 signature (alphabetical order)
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

// Generate signed sensor data with Ed25519
function generateSignedSensorData(
    sensor_id: string,
    temperature: number,
    humidity: number,
    timestamp: number
): {
    sensor_id: string;
    temperature: number;
    humidity: number;
    timestamp: number;
    signature: string;
    public_key: string;
} {
    const tempData = { sensor_id, temperature, humidity, timestamp };
    const message = buildMessage(tempData);
    const messageHash = crypto.createHash('sha256').update(message).digest();

    const keyPair = nacl.sign.keyPair();
    const signature = nacl.sign.detached(messageHash, keyPair.secretKey);

    return {
        sensor_id,
        temperature,
        humidity,
        timestamp,
        signature: Buffer.from(signature).toString('hex'),
        public_key: Buffer.from(keyPair.publicKey).toString('hex')
    };
}

async function main() {
    // Parse CLI arguments
    const nftPolicyId = process.argv[2];
    const nftAssetName = process.argv[3];

    if (!nftPolicyId || !nftAssetName) {
        console.error("Usage: npm run oracle:create:lucid -- <nft_policy_id> <nft_asset_name>");
        console.error("\nExample:");
        console.error("  npm run oracle:create:lucid -- a50d845a7e455b2a410f9d8df40d388b568160f487105af10545e7f8 53454e534f525f45535033325f544553545f303031");
        process.exit(1);
    }

    console.log("=".repeat(70));
    console.log("Create Oracle with Lucid Evolution");
    console.log("=".repeat(70));
    console.log(`NFT Policy ID: ${nftPolicyId}`);
    console.log(`NFT Asset Name: ${nftAssetName}`);

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

    console.log("\n🔑 Loading wallet...");

    // Import lucid-cardano C module for key derivation
    const { C } = await import("lucid-cardano");
    const rootKey = C.Bip32PrivateKey.from_bech32(meshPrivateKey);
    const harden = (num: number) => 0x80000000 + num;
    const accountKey = rootKey
        .derive(harden(1852))
        .derive(harden(1815))
        .derive(harden(0));
    const paymentKey = accountKey.derive(0).derive(0).to_raw_key();
    const paymentKeyBech32 = paymentKey.to_bech32();

    // Select wallet using Lucid Evolution API
    (lucid as any).selectWallet.fromPrivateKey(paymentKeyBech32);

    const walletAddr = await (lucid as any).wallet().address();
    console.log("  ✅ Wallet loaded:", walletAddr.substring(0, 20) + "...");

    // Get operator pub key hash from address
    const { getAddressDetails } = await import("@lucid-evolution/utils");
    const addressDetails = getAddressDetails(walletAddr);
    if (!addressDetails.paymentCredential) {
        throw new Error("Could not extract payment credential from wallet");
    }
    const operatorPubKeyHash = addressDetails.paymentCredential.hash;

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
    // IMPORTANT: Do NOT use Data.to() for parameters - pass Constr directly
    const paramsData = new Constr(0, [
        new Constr(0, [nftPolicyId, nftAssetName]), // AssetClass
        operatorPubKeyHash
    ]);

    const oracleScript = applyParamsToScript(oracleValidator.compiledCode, [paramsData]);

    // Calculate script address
    const scriptAddress = validatorToAddress("Preprod", {
        type: "PlutusV3",
        script: oracleScript
    });

    console.log(`\n🔍 Oracle Address: ${scriptAddress}`);

    // Generate initial sensor data
    console.log("\n🔑 Generating Ed25519 signature for initial data...");
    const initialSensorData = generateSignedSensorData(
        "ESP32_001",
        235,  // 23.5°C
        652,  // 65.2%
        Date.now()
    );

    console.log("  ✅ Signature generated successfully");
    console.log(`\n📊 Initial sensor data:`);
    console.log(`  Temperature: ${initialSensorData.temperature / 10}°C`);
    console.log(`  Humidity: ${initialSensorData.humidity / 10}%`);
    console.log(`  Timestamp: ${new Date(initialSensorData.timestamp).toISOString()}`);

    // Build datum
    const datum = Data.to({
        sensor_id: Buffer.from(initialSensorData.sensor_id, 'utf8').toString('hex'),
        temperature: BigInt(initialSensorData.temperature),
        humidity: BigInt(initialSensorData.humidity),
        timestamp: BigInt(initialSensorData.timestamp),
        signature: initialSensorData.signature,
        public_key: initialSensorData.public_key
    }, SensorData);

    console.log(`\n🔄 Building transaction...`);

    const nftUnit = `${nftPolicyId}${nftAssetName}`;

    // Build transaction
    const tx = await lucid
        .newTx()
        .pay.ToContract(scriptAddress, { kind: "inline", value: datum }, {
            lovelace: BigInt(2000000),
            [nftUnit]: BigInt(1)
        })
        .complete();

    console.log(`  ✅ Transaction built`);
    console.log(`  🔄 Signing...`);
    const signedTx = await tx.sign.withWallet().complete();

    console.log(`  🔄 Submitting...`);
    const txHash = await signedTx.submit();

    console.log(`\n✅ SUCCESS!`);
    console.log(`  Tx Hash: ${txHash}`);
    console.log(`  Explorer: https://preprod.cardanoscan.io/transaction/${txHash}`);
    console.log(`  Script Address: ${scriptAddress}`);
    console.log(`\nℹ️  The oracle is now initialized and ready to receive updates!`);
}

main().catch((error) => {
    console.error("\n❌ Error:", error.message || error);
    if (error.stack) {
        console.error("\nStack:", error.stack);
    }
    process.exit(1);
});
