#!/usr/bin/env tsx
/**
 * Simple NFT Minting Test with Lucid Evolution
 * Using a native script (no Plutus) to test basic minting functionality
 */

import { Blockfrost, Lucid, scriptFromNative, paymentCredentialOf, mintingPolicyToId } from "@lucid-evolution/lucid";
import dotenv from "dotenv";

dotenv.config();

async function main() {
    console.log("=".repeat(70));
    console.log("Simple NFT Mint Test with Lucid Evolution (Native Script)");
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

    // Create a simple native minting policy (requires our signature)
    console.log("\n🔨 Creating native minting policy...");

    const mintingPolicy = scriptFromNative({
        type: "all",
        scripts: [
            {
                type: "sig",
                keyHash: paymentCredentialOf(walletAddr).hash,
            },
        ],
    });

    // Calculate policy ID
    const policyId = mintingPolicyToId(mintingPolicy);
    console.log(`  Policy ID: ${policyId}`);

    // Create token name
    const token_name = "TestToken";
    const tokenNameHex = Buffer.from(token_name, 'utf8').toString('hex');
    const nftUnit = policyId + tokenNameHex;

    console.log(`  Token Name: ${token_name}`);
    console.log(`  Token Name (hex): ${tokenNameHex}`);
    console.log(`  Full Unit: ${nftUnit}`);

    // Build minting transaction
    console.log(`\n🔨 Building transaction...`);

    const tx = await lucid
        .newTx()
        .attach.MintingPolicy(mintingPolicy)
        .mintAssets({ [nftUnit]: BigInt(1) })  // No redeemer needed for native scripts
        .complete();

    console.log(`  ✅ Transaction built`);
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
}

main().catch((error) => {
    console.error("\n❌ Error:", error.message || error);
    if (error.stack) {
        console.error("\nStack:", error.stack);
    }
    process.exit(1);
});
