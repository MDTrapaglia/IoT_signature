#!/usr/bin/env tsx
/**
 * Test NFT Minting with V2 Validator (Check Quantity)
 * This validator checks that exactly 1 token is minted
 * Used to test if the issue is with checking mint quantity
 */

import { Blockfrost, Lucid, Data, applyParamsToScript, Constr, mintingPolicyToId, fromText } from "@lucid-evolution/lucid";
import dotenv from "dotenv";

dotenv.config();

// NFT V2 validator (checks quantity = 1)
const nft_v2_code = "58cd0101002229800aba2aba1aab9faab9eaab9dab9a9bae002488888896600264646644b30013370e900018039baa001899192cc004c0340062b30013370e90011bad300a300c0018a518b20108b20163232330010013756601a601c601c601c601c60166ea8c03401c896600200300389919912cc004cdc8803801456600266e3c01c00a20030064035133005005301200440346eb8c030004dd598068009807000a01a14bd6f7b6301bae300a30083754003164018601000260106012002601000260086ea802229344d9590021";

async function main() {
    const sensorId = process.argv[2] || "V2_TEST";

    console.log("=".repeat(70));
    console.log("NFT Mint Test - V2 Validator (Check Quantity)");
    console.log("=".repeat(70));
    console.log(`Sensor ID: ${sensorId}`);
    console.log(`\nℹ️  This validator checks that exactly 1 token is minted`);
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

    const mintingScript = applyParamsToScript(nft_v2_code, [utxoRefData, tokenNameData]);

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

        console.log(`\n✅ SUCCESS! V2 Validator works!`);
        console.log(`  Tx Hash: ${txHash}`);
        console.log(`  Explorer: https://preprod.cardanoscan.io/transaction/${txHash}`);
        console.log(`\n📋 NFT Details:`);
        console.log(`  Policy ID: ${policyId}`);
        console.log(`  Asset Name: ${tokenNameHex}`);
        console.log(`  Full Unit: ${nftUnit}`);
        console.log(`\n✅ CONCLUSION: Checking mint quantity works correctly!`);
        console.log(`   The issue must be with other validations (UTXO check or token name).`);
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
