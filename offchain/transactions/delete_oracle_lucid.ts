#!/usr/bin/env tsx
/**
 * Delete Oracle using Lucid Evolution
 * Spends the oracle UTXO and returns funds to wallet
 */

import { Blockfrost, Lucid, Data, applyParamsToScript, Constr } from "@lucid-evolution/lucid";
import { readFileSync } from "fs";
import { resolve } from "path";
import dotenv from "dotenv";

dotenv.config();

// Oracle Redeemer (Update = 0, Delete = 1)
const OracleRedeemer = {
    Update: () => Data.to(new Constr(0, [])),
    Delete: () => Data.to(new Constr(1, []))
};

async function main() {
    // Parse CLI arguments
    const nftPolicyId = process.argv[2];
    const nftAssetName = process.argv[3];

    if (!nftPolicyId || !nftAssetName) {
        console.error("Usage: npm run oracle:delete:lucid -- <nft_policy_id> <nft_asset_name>");
        console.error("\nExample:");
        console.error("  npm run oracle:delete:lucid -- a50d845a7e455b2a410f9d8df40d388b568160f487105af10545e7f8 53454e534f525f45535033325f544553545f303031");
        process.exit(1);
    }

    console.log("=".repeat(70));
    console.log("Delete Oracle with Lucid Evolution");
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
    const paramsData = Data.to(new Constr(0, [
        new Constr(0, [nftPolicyId, nftAssetName]), // AssetClass
        operatorPubKeyHash
    ]));

    const oracleScript = applyParamsToScript(oracleValidator.compiledCode, [paramsData]);

    // Calculate script address (same as create_oracle_lucid.ts and update_oracle_lucid.ts)
    const oracleScriptAddr = (lucid as any).utils.validatorToAddress({
        type: "PlutusV3",
        script: oracleScript
    });

    console.log(`\n🔍 Oracle Address: ${oracleScriptAddr}`);

    // Find oracle UTXO
    console.log(`\n🔍 Searching for oracle UTXO...`);
    const scriptUtxos = await (lucid as any).utxosAt(oracleScriptAddr);
    const nftUnit = `${nftPolicyId}${nftAssetName}`;

    const oracleUtxo = scriptUtxos.find((utxo: any) =>
        utxo.assets[nftUnit] === BigInt(1)
    );

    if (!oracleUtxo) {
        throw new Error("Oracle UTXO not found");
    }

    console.log(`✓ Found oracle UTXO: ${oracleUtxo.txHash}#${oracleUtxo.outputIndex}`);

    // Build redeemer
    const redeemer = OracleRedeemer.Delete();

    console.log(`\n🗑️  Building delete transaction...`);

    // Build transaction
    const validator = {
        type: "PlutusV3",
        script: oracleScript
    };

    const tx = await lucid
        .newTx()
        .collectFrom([oracleUtxo], redeemer)
        .attach.SpendingValidator(validator)
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
    console.log(`\nℹ️  El NFT y los ADA han sido devueltos a tu wallet`);
}

main().catch((error) => {
    console.error("\n❌ Error:", error.message || error);
    if (error.stack) {
        console.error("\nStack:", error.stack);
    }
    process.exit(1);
});
