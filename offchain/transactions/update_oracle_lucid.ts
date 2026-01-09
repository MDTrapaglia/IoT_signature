#!/usr/bin/env tsx
/**
 * Update Oracle using Lucid (to avoid MeshJS BigInt serialization issues)
 * This script updates the oracle with new sensor data
 */

import { Blockfrost, Lucid, Data, applyParamsToScript, Constr, validatorToAddress } from "@lucid-evolution/lucid";
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

async function performUpdate(
    lucid: any,
    nftPolicyId: string,
    nftAssetName: string,
    operatorPubKeyHash: string,
    oracleScript: string,
    oracleScriptAddr: string,
    updateNumber: number
) {
    console.log(`\n${"=".repeat(70)}`);
    console.log(`Update #${updateNumber}`);
    console.log("=".repeat(70));

    // Find oracle UTXO
    const scriptUtxos = await (lucid as any).utxosAt(oracleScriptAddr);
    const nftUnit = `${nftPolicyId}${nftAssetName}`;

    const oracleUtxo = scriptUtxos.find((utxo: any) =>
        utxo.assets[nftUnit] === BigInt(1)
    );

    if (!oracleUtxo) {
        throw new Error("Oracle UTXO not found");
    }

    console.log(`✓ Found oracle UTXO: ${oracleUtxo.txHash}#${oracleUtxo.outputIndex}`);

    // Generate fresh sensor data and signature
    const sensorData = {
        sensor_id: "ESP32_001",
        temperature: 235 + (updateNumber % 10), // Vary temperature slightly
        humidity: 652 + (updateNumber % 10),
        timestamp: Date.now()
    };

    const message = buildMessage(sensorData);
    const messageHash = crypto.createHash('sha256').update(message).digest();
    const keyPair = nacl.sign.keyPair();
    const signature = nacl.sign.detached(messageHash, keyPair.secretKey);

    console.log(`\n📊 New sensor data:`);
    console.log(`  Temperature: ${sensorData.temperature / 10}°C`);
    console.log(`  Humidity: ${sensorData.humidity / 10}%`);
    console.log(`  Timestamp: ${new Date(sensorData.timestamp).toISOString()}`);

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
    const validator = {
        type: "PlutusV3",
        script: oracleScript
    };

    const tx = await lucid
        .newTx()
        .collectFrom([oracleUtxo], redeemer)
        .attach.SpendingValidator(validator)
        .pay.ToContract(oracleScriptAddr, { kind: "inline", value: newDatum }, {
            lovelace: BigInt(2000000),
            [nftUnit]: BigInt(1)
        })
        .addSignerKey(operatorPubKeyHash)
        .complete();

    console.log(`  ✅ Transaction built`);
    console.log(`  🔄 Signing...`);
    const signedTx = await tx.sign.withWallet().complete();

    console.log(`  🔄 Submitting...`);
    const txHash = await signedTx.submit();

    console.log(`\n✅ SUCCESS!`);
    console.log(`  Tx Hash: ${txHash}`);
    console.log(`  Explorer: https://preprod.cardanoscan.io/transaction/${txHash}`);

    return txHash;
}

async function main() {
    // Parse CLI arguments
    const nftPolicyId = process.argv[2];
    const nftAssetName = process.argv[3];
    const numUpdates = parseInt(process.argv[4] || "1", 10);

    if (!nftPolicyId || !nftAssetName) {
        console.error("Usage: npm run oracle:update:lucid -- <nft_policy_id> <nft_asset_name> [num_updates]");
        console.error("\nExample:");
        console.error("  npm run oracle:update:lucid -- a2f69dc8b380bbcf6b79d3e3b26097423c981df0bce0bd44d1e75de9 SENSOR_ESP32_TEST_001_V2 3");
        process.exit(1);
    }

    console.log("=".repeat(70));
    console.log("Update Oracle with Lucid Evolution");
    console.log("=".repeat(70));
    console.log(`NFT Policy ID: ${nftPolicyId}`);
    console.log(`NFT Asset Name: ${nftAssetName}`);
    console.log(`Number of updates: ${numUpdates}`);

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
    // Import utils from @lucid-evolution/utils for getAddressDetails
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
    const paramsData = Data.to(new Constr(0, [
        new Constr(0, [nftPolicyId, nftAssetName]), // AssetClass
        operatorPubKeyHash
    ]));

    const oracleScript = applyParamsToScript(oracleValidator.compiledCode, [paramsData]);

    // Calculate script address (same as create_oracle_lucid.ts)
    const oracleScriptAddr = validatorToAddress("Preprod", {
        type: "PlutusV3",
        script: oracleScript
    });

    console.log(`\n🔍 Oracle Address: ${oracleScriptAddr}`);

    // Perform updates
    const txHashes: string[] = [];
    for (let i = 1; i <= numUpdates; i++) {
        try {
            const txHash = await performUpdate(
                lucid,
                nftPolicyId,
                nftAssetName,
                operatorPubKeyHash,
                oracleScript,
                oracleScriptAddr,
                i
            );
            txHashes.push(txHash);

            // Wait 30 seconds between updates (if more updates pending)
            if (i < numUpdates) {
                console.log(`\n⏳ Waiting 30 seconds before next update...`);
                await new Promise(resolve => setTimeout(resolve, 30000));
            }
        } catch (error: any) {
            console.error(`\n❌ Error in update #${i}:`, error.message || error);
            if (i === 1) {
                throw error; // Fail fast on first update
            } else {
                console.log(`Continuing with remaining updates...`);
            }
        }
    }

    // Summary
    console.log(`\n${"=".repeat(70)}`);
    console.log("Summary");
    console.log("=".repeat(70));
    console.log(`Total updates: ${txHashes.length}/${numUpdates}`);
    console.log(`\nTransaction hashes:`);
    txHashes.forEach((hash, idx) => {
        console.log(`  ${idx + 1}. ${hash}`);
        console.log(`     https://preprod.cardanoscan.io/transaction/${hash}`);
    });
}

main().catch((error) => {
    console.error("\n❌ Error:", error.message || error);
    if (error.stack) {
        console.error("\nStack:", error.stack);
    }
    process.exit(1);
});
