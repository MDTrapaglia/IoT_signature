#!/usr/bin/env tsx
/**
 * NFT Minting with CORRECTED parameter serialization
 * Based on official Lucid Evolution documentation
 */

import { Blockfrost, Lucid, Data, applyParamsToScript, Constr, mintingPolicyToId, fromText } from "@lucid-evolution/lucid";
import dotenv from "dotenv";

dotenv.config();

// NFT V4 validator code (checks token name)
const nft_v4_code = "58d80101002229800aba2aba1aab9faab9eaab9dab9a9bae002488888896600264646644b30013370e900018039baa001899192cc004c034006264b30013370e90011bad300b001899b8f375c6014002011164024601800316402c6464660020026eacc034c038c038c038c038c02cdd51806803912cc00400600713233225980099b910070028acc004cdc78038014400600c806a26600a00a60240088068dd718060009bab300d001300e0014034297adef6c60375c601460106ea80062c8030c020004c020c024004c020004c010dd5004452689b2b200401";

async function main() {
    const sensorId = process.argv[2] || "FIXED_TEST";

    console.log("=".repeat(70));
    console.log("NFT Mint Test - FIXED Parameter Serialization");
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

    // ============================================================
    // ATTEMPT 1: Based on official documentation
    // https://github.com/anastasia-labs/lucid-evolution/blob/main/docs/pages/documentation/deep-dives/validator-interactions/advanced/applying-parameters.mdx
    // ============================================================
    console.log(`\n📝 ATTEMPT 1: Official documentation format`);
    console.log(`   OutputReference: new Constr(0, [String(txHash), BigInt(outputIndex)])`);
    console.log(`   ByteArray: tokenNameHex directly (no wrapping)`);

    try {
        // NO usar Data.to() - pasar Constr directamente
        const oRef = new Constr(0, [String(ownerUtxo.txHash), BigInt(ownerUtxo.outputIndex)]);

        const mintingScript = applyParamsToScript(nft_v4_code, [
            oRef,         // OutputReference - sin Data.to()
            tokenNameHex  // ByteArray - sin Data.to()
        ]);

        const mintingPolicy = {
            type: "PlutusV3" as const,
            script: mintingScript
        };

        const policyId = mintingPolicyToId(mintingPolicy);
        const nftUnit = policyId + tokenNameHex;

        console.log(`  Policy ID: ${policyId}`);

        const redeemer = Data.to(new Constr(0, []));

        const tx = await lucid
            .newTx()
            .collectFrom([ownerUtxo])
            .attach.MintingPolicy(mintingPolicy)
            .mintAssets({ [nftUnit]: BigInt(1) }, redeemer)
            .complete();

        console.log(`  ✅ Transaction built successfully!`);
        const signedTx = await tx.sign.withWallet().complete();
        const txHash = await signedTx.submit();

        console.log(`\n✅ SUCCESS with ATTEMPT 1!`);
        console.log(`  Tx Hash: ${txHash}`);
        console.log(`  Explorer: https://preprod.cardanoscan.io/transaction/${txHash}`);
        console.log(`\n🎉 SOLUTION FOUND: Do NOT use Data.to() for parameters!`);
        console.log(`   - OutputReference: new Constr(0, [String(txHash), BigInt(outputIndex)])`);
        console.log(`   - ByteArray: tokenNameHex directly`);

        process.exit(0);
    } catch (error: any) {
        console.error(`  ❌ ATTEMPT 1 failed: ${error.message}`);
    }

    // ============================================================
    // ATTEMPT 2: Nested Constr (alternative format from docs)
    // ============================================================
    console.log(`\n📝 ATTEMPT 2: Nested Constr format`);
    console.log(`   OutputReference: new Constr(0, [new Constr(0, [txHash]), outputIndex])`);

    try {
        const txID = new Constr(0, [String(ownerUtxo.txHash)]);
        const txIdx = BigInt(ownerUtxo.outputIndex);
        const oRef = new Constr(0, [txID, txIdx]);

        const mintingScript = applyParamsToScript(nft_v4_code, [oRef, tokenNameHex]);

        const mintingPolicy = {
            type: "PlutusV3" as const,
            script: mintingScript
        };

        const policyId = mintingPolicyToId(mintingPolicy);
        const nftUnit = policyId + tokenNameHex;

        const redeemer = Data.to(new Constr(0, []));

        const tx = await lucid
            .newTx()
            .collectFrom([ownerUtxo])
            .attach.MintingPolicy(mintingPolicy)
            .mintAssets({ [nftUnit]: BigInt(1) }, redeemer)
            .complete();

        console.log(`  ✅ Transaction built successfully!`);
        const signedTx = await tx.sign.withWallet().complete();
        const txHash = await signedTx.submit();

        console.log(`\n✅ SUCCESS with ATTEMPT 2!`);
        console.log(`  Tx Hash: ${txHash}`);
        console.log(`  Explorer: https://preprod.cardanoscan.io/transaction/${txHash}`);

        process.exit(0);
    } catch (error: any) {
        console.error(`  ❌ ATTEMPT 2 failed: ${error.message}`);
    }

    // ============================================================
    // ATTEMPT 3: Using Data.to() only on ByteArray
    // ============================================================
    console.log(`\n📝 ATTEMPT 3: Data.to() only on ByteArray`);

    try {
        const oRef = new Constr(0, [String(ownerUtxo.txHash), BigInt(ownerUtxo.outputIndex)]);

        const mintingScript = applyParamsToScript(nft_v4_code, [
            oRef,
            Data.to(tokenNameHex)  // Try wrapping ByteArray
        ]);

        const mintingPolicy = {
            type: "PlutusV3" as const,
            script: mintingScript
        };

        const policyId = mintingPolicyToId(mintingPolicy);
        const nftUnit = policyId + tokenNameHex;

        const redeemer = Data.to(new Constr(0, []));

        const tx = await lucid
            .newTx()
            .collectFrom([ownerUtxo])
            .attach.MintingPolicy(mintingPolicy)
            .mintAssets({ [nftUnit]: BigInt(1) }, redeemer)
            .complete();

        console.log(`  ✅ Transaction built successfully!`);
        const signedTx = await tx.sign.withWallet().complete();
        const txHash = await signedTx.submit();

        console.log(`\n✅ SUCCESS with ATTEMPT 3!`);
        console.log(`  Tx Hash: ${txHash}`);
        console.log(`  Explorer: https://preprod.cardanoscan.io/transaction/${txHash}`);

        process.exit(0);
    } catch (error: any) {
        console.error(`  ❌ ATTEMPT 3 failed: ${error.message}`);
    }

    console.log(`\n❌ ALL ATTEMPTS FAILED`);
    console.log(`   The issue requires further investigation.`);
    process.exit(1);
}

main().catch((error) => {
    console.error("\n❌ Fatal Error:", error.message || error);
    if (error.stack) {
        console.error("\n📚 Stack Trace:");
        console.error(error.stack);
    }
    process.exit(1);
});
