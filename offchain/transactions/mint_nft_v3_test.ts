#!/usr/bin/env tsx
/**
 * Test NFT Minting with V3 Validator (Check UTXO Consumption)
 * This validator checks that the specified UTXO is consumed
 * Used to test if the issue is with checking UTXO consumption
 */

import { Blockfrost, Lucid, Data, applyParamsToScript, Constr, mintingPolicyToId, fromText } from "@lucid-evolution/lucid";
import dotenv from "dotenv";

dotenv.config();

// NFT V3 validator (checks UTXO consumption)
const nft_v3_code = "588b0101002229800aba2aba1aab9faab9eaab9dab9a9bae002488888896600264646644b30013370e900018039baa00189991198008009bac300c300a3754601800c6eb8c028c020dd5000912cc00400629422b30013375e601860146ea8c0300040422946266004004601a002804100b459006180400098041804800980400098021baa0088a4d1365640081";

async function main() {
    const sensorId = process.argv[2] || "V3_TEST";

    console.log("=".repeat(70));
    console.log("NFT Mint Test - V3 Validator (Check UTXO Consumption)");
    console.log("=".repeat(70));
    console.log(`Sensor ID: ${sensorId}`);
    console.log(`\nℹ️  This validator checks that the specified UTXO is consumed`);
    console.log(`   Testing if the issue is with parameter passing or logic\n`);

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

    console.log("🔑 Loading wallet...");

    const { C } = await import("lucid-cardano");
    const rootKey = C.Bip32PrivateKey.from_bech32(meshPrivateKey);
    const harden = (num: number) => 0x80000000 + num;
    const accountKey = rootKey
        .derive(harden(1852))
        .derive(harden(1815))
        .derive(harden(0));
    const paymentKey = accountKey.derive(0).derive(0).to_raw_key();
    const paymentKeyBech32 = paymentKey.to_bech32();

    (lucid as any).selectWallet.fromPrivateKey(paymentKeyBech32);

    const walletAddr = await (lucid as any).wallet().address();
    console.log("  ✅ Wallet loaded:", walletAddr.substring(0, 20) + "...");

    // Get UTXOs
    const utxos = await (lucid as any).wallet().getUtxos();

    if (!utxos || utxos.length === 0) {
        throw new Error("No UTXOs available in wallet");
    }

    const ownerUtxo = utxos[0];
    console.log(`\n📦 Selected UTXO: ${ownerUtxo.txHash}#${ownerUtxo.outputIndex}`);

    // Token name
    const token_name = `SENSOR_${sensorId}`;
    const tokenNameHex = fromText(token_name);

    console.log(`\n🏷️  Token Info:`);
    console.log(`  Name: ${token_name}`);
    console.log(`  Hex: ${tokenNameHex}`);

    // Apply parameters
    console.log(`\n🔧 Applying parameters to script...`);

    const utxoRefData = Data.to(
        new Constr(0, [
            ownerUtxo.txHash,
            BigInt(ownerUtxo.outputIndex)
        ])
    );

    const tokenNameData = Data.to(tokenNameHex);

    const mintingScript = applyParamsToScript(nft_v3_code, [utxoRefData, tokenNameData]);

    const mintingPolicy = {
        type: "PlutusV3" as const,
        script: mintingScript
    };

    const policyId = mintingPolicyToId(mintingPolicy);
    const nftUnit = policyId + tokenNameHex;

    console.log(`  ✅ Parameters applied`);
    console.log(`  Policy ID: ${policyId}`);

    // Build transaction
    console.log(`\n🔨 Building transaction...`);

    const redeemer = Data.to(new Constr(0, []));

    try {
        const tx = await lucid
            .newTx()
            .collectFrom([ownerUtxo])
            .attach.MintingPolicy(mintingPolicy)
            .mintAssets({ [nftUnit]: BigInt(1) }, redeemer)
            .complete();

        console.log(`  ✅ Transaction built successfully!`);
        console.log(`  🔄 Signing...`);

        const signedTx = await tx.sign.withWallet().complete();

        console.log(`  🔄 Submitting...`);
        const txHash = await signedTx.submit();

        console.log(`\n✅ SUCCESS! V3 Validator works!`);
        console.log(`  Tx Hash: ${txHash}`);
        console.log(`  Explorer: https://preprod.cardanoscan.io/transaction/${txHash}`);
        console.log(`\n📋 NFT Details:`);
        console.log(`  Policy ID: ${policyId}`);
        console.log(`  Asset Name: ${tokenNameHex}`);
        console.log(`  Full Unit: ${nftUnit}`);
        console.log(`\n✅ CONCLUSION: Checking UTXO consumption works correctly!`);
        console.log(`   The issue must be with token name verification or combining checks.`);
    } catch (error: any) {
        console.error(`\n❌ FAILED: ${error.message}`);
        console.log(`\n❌ CONCLUSION: The issue is with parameter passing or script setup,`);
        console.log(`   not with the validation logic.`);

        if (error.stack) {
            console.error("\n📚 Stack Trace:");
            console.error(error.stack);
        }

        throw error;
    }
}

main().catch((error) => {
    console.error("\n❌ Fatal Error:", error.message || error);
    process.exit(1);
});
