#!/usr/bin/env tsx
/**
 * Mint Sensor NFT using Lucid Evolution - Version 2 with Enhanced Debugging
 * Creates a unique NFT for identifying a sensor oracle
 */

import { Blockfrost, Lucid, Data, applyParamsToScript, Constr, mintingPolicyToId, fromText } from "@lucid-evolution/lucid";
import { readFileSync } from "fs";
import { resolve } from "path";
import dotenv from "dotenv";

dotenv.config();

// NFT minting policy code from plutus.json
const nft_code = "5901110101002229800aba2aba1aab9faab9eaab9dab9a9bae002488888896600264646644b30013370e900018039baa00189991192cc004c038006264b30013370e90011bad300c0018acc004c8cc004004dd61807802112cc00400629422b30013375e6020601c6ea8c04000405229462660040046022002806100f44cdc79bae300b0010098a504029164028601a0031640306464660020026eacc038c03cc03cc03cc03c00c896600200300389919912cc004cdc8804001456600266e3c02000a20030064039133005005301300440386eb8c034004dd598070009807800a01c14bd6f7b6301bae300a3008375400260106ea8c0280122c8030c020004c020c024004c020004c010dd5004452689b2b20041";

async function main() {
    const sensorId = process.argv[2] || "ESP32_01";

    console.log("=".repeat(70));
    console.log("Mint Sensor NFT with Lucid Evolution - V2 Debug");
    console.log("=".repeat(70));
    console.log(`Sensor ID: ${sensorId}`);

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

    // Get UTXOs and collateral
    const utxos = await (lucid as any).wallet().getUtxos();

    if (!utxos || utxos.length === 0) {
        throw new Error("No UTXOs available in wallet");
    }

    // Select the first UTXO for minting params
    const ownerUtxo = utxos[0];
    console.log(`\n📦 Selected UTXO:`);
    console.log(`  TxHash: ${ownerUtxo.txHash}`);
    console.log(`  Output Index: ${ownerUtxo.outputIndex}`);
    console.log(`  Full Ref: ${ownerUtxo.txHash}#${ownerUtxo.outputIndex}`);

    // Construct token name - try using fromText like in the tests
    const token_name = `SENSOR_${sensorId}`;
    const tokenNameHex = fromText(token_name);

    console.log(`\n🏷️  Token Name:`);
    console.log(`  String: ${token_name}`);
    console.log(`  Hex: ${tokenNameHex}`);

    // Apply parameters to script: utxo_ref and token_name
    console.log(`\n🔧 Applying parameters to script...`);

    // OutputReference: Constr(0, [txHash, outputIndex])
    const utxoRefData = Data.to(
        new Constr(0, [
            ownerUtxo.txHash,
            BigInt(ownerUtxo.outputIndex)
        ])
    );
    console.log(`  ✅ OutputReference serialized`);

    // ByteArray: just the hex string
    const tokenNameData = Data.to(tokenNameHex);
    console.log(`  ✅ Token name serialized`);

    const mintingScript = applyParamsToScript(nft_code, [utxoRefData, tokenNameData]);
    console.log(`  ✅ Script parameterized`);

    // Create minting policy object
    const mintingPolicy = {
        type: "PlutusV3" as const,
        script: mintingScript
    };

    // Calculate policy ID
    const policyId = mintingPolicyToId(mintingPolicy);

    console.log(`\n🔨 Minting NFT...`);
    console.log(`  Policy ID: ${policyId}`);

    const nftUnit = policyId + tokenNameHex;
    console.log(`  NFT Unit: ${nftUnit}`);

    // Build minting transaction with redeemer
    // Redeemer is empty for this validator
    const redeemer = Data.to(new Constr(0, []));

    console.log(`\n🏗️  Building transaction...`);
    console.log(`  - Collecting UTXO: ${ownerUtxo.txHash}#${ownerUtxo.outputIndex}`);
    console.log(`  - Attaching minting policy`);
    console.log(`  - Minting 1x ${token_name}`);

    try {
        const tx = await lucid
            .newTx()
            .collectFrom([ownerUtxo]) // Must spend the UTXO used in parameters
            .attach.MintingPolicy(mintingPolicy)
            .mintAssets({ [nftUnit]: BigInt(1) }, redeemer)
            .complete();

        console.log(`  ✅ Transaction built successfully`);
        console.log(`  🔄 Signing...`);

        const signedTx = await tx.sign.withWallet().complete();

        console.log(`  🔄 Submitting...`);
        const txHash = await signedTx.submit();

        console.log(`\n✅ SUCCESS!`);
        console.log(`  Tx Hash: ${txHash}`);
        console.log(`  Explorer: https://preprod.cardanoscan.io/transaction/${txHash}`);
        console.log(`\n📋 NFT Details:`);
        console.log(`  Policy ID: ${policyId}`);
        console.log(`  Asset Name: ${tokenNameHex}`);
        console.log(`  Full Unit: ${nftUnit}`);
        console.log(`\nℹ️  Save these values to use when creating the oracle!`);
    } catch (error: any) {
        console.error(`\n❌ Transaction building/submission failed:`);
        console.error(error);

        if (error.message) {
            console.error(`\n📝 Error message: ${error.message}`);
        }

        // Try to extract more detailed error info
        if (typeof error === 'object') {
            console.error(`\n🔍 Full error object:`);
            console.error(JSON.stringify(error, null, 2));
        }

        throw error;
    }
}

main().catch((error) => {
    console.error("\n❌ Fatal Error:", error.message || error);
    if (error.stack) {
        console.error("\n📚 Stack Trace:");
        console.error(error.stack);
    }
    process.exit(1);
});
