#!/usr/bin/env tsx
/**
 * Check NFT Location
 * Verifies where the NFT is currently located
 */

import { Blockfrost, Lucid } from "@lucid-evolution/lucid";
import { C } from "lucid-cardano";
import dotenv from "dotenv";

dotenv.config();

async function main() {
    const nftPolicyId = process.argv[2] || "a2f69dc8b380bbcf6b79d3e3b26097423c981df0bce0bd44d1e75de9";
    const nftAssetName = process.argv[3] || "53454e534f525f45535033325f544553545f3030315f5632";
    const nftUnit = `${nftPolicyId}${nftAssetName}`;

    console.log("=".repeat(70));
    console.log("Check NFT Location");
    console.log("=".repeat(70));
    console.log(`NFT Unit: ${nftUnit}\n`);

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

    console.log(`🔍 Checking wallet: ${walletAddr}\n`);

    // Check wallet UTXOs for NFT
    const walletUtxos = await (lucid as any).wallet().getUtxos();
    const nftInWallet = walletUtxos.find((utxo: any) => utxo.assets[nftUnit] === BigInt(1));

    if (nftInWallet) {
        console.log("✅ NFT found in WALLET!");
        console.log(`   TX: ${nftInWallet.txHash}#${nftInWallet.outputIndex}`);
        console.log(`   ADA: ${Number(nftInWallet.assets.lovelace) / 1_000_000}`);
        return;
    }

    console.log("❌ NFT NOT in wallet\n");

    // Check old oracle address
    const oldOracleAddr = "addr_test1wrlpxpuc0mzuh30frm8uharg200p8rrntwtnhkst7c7536c4ktu72";
    console.log(`🔍 Checking old oracle address: ${oldOracleAddr}\n`);

    try {
        const oldUtxos = await (lucid as any).utxosAt(oldOracleAddr);
        const nftInOldOracle = oldUtxos.find((utxo: any) => utxo.assets[nftUnit] === BigInt(1));

        if (nftInOldOracle) {
            console.log("✅ NFT found in OLD oracle address!");
            console.log(`   TX: ${nftInOldOracle.txHash}#${nftInOldOracle.outputIndex}`);
            console.log(`   ADA: ${Number(nftInOldOracle.assets.lovelace) / 1_000_000}`);
            console.log("\n💡 Next steps:");
            console.log("   1. Delete old oracle to recover NFT:");
            console.log(`      npm run oracle:delete:meshjs -- ${nftPolicyId} ${nftAssetName}`);
            console.log("   2. Then create new oracle with Lucid");
            return;
        }

        console.log("❌ NFT NOT in old oracle address\n");
    } catch (error) {
        console.log("❌ Error checking old oracle address\n");
    }

    // Check new oracle address
    const newOracleAddr = "addr_test1wqn6kt39hmmvau6djsshasdujnmvhvnw525fjcr4fcewrfq3l3wjr";
    console.log(`🔍 Checking new oracle address: ${newOracleAddr}\n`);

    try {
        const newUtxos = await (lucid as any).utxosAt(newOracleAddr);
        const nftInNewOracle = newUtxos.find((utxo: any) => utxo.assets[nftUnit] === BigInt(1));

        if (nftInNewOracle) {
            console.log("✅ NFT found in NEW oracle address!");
            console.log(`   TX: ${nftInNewOracle.txHash}#${nftInNewOracle.outputIndex}`);
            console.log(`   ADA: ${Number(nftInNewOracle.assets.lovelace) / 1_000_000}`);
            console.log("\n✅ Oracle already exists with correct parameters!");
            return;
        }

        console.log("❌ NFT NOT in new oracle address\n");
    } catch (error) {
        console.log("❌ Error checking new oracle address\n");
    }

    console.log("=".repeat(70));
    console.log("❌ NFT NOT FOUND in any known location");
    console.log("=".repeat(70));
    console.log("\n💡 Possible reasons:");
    console.log("   1. NFT was never minted");
    console.log("      → Run: npm run oracle:mint-nft -- ESP32_TEST_001");
    console.log("   2. NFT is at a different address");
    console.log("   3. NFT was burned");
}

main().catch((error) => {
    console.error("\n❌ Error:", error.message || error);
    process.exit(1);
});
