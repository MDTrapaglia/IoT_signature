#!/usr/bin/env tsx
import { BlockfrostProvider, MeshWallet } from "@meshsdk/core";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  const nftPolicyId = process.argv[2];
  const nftAssetName = process.argv[3];

  if (!nftPolicyId || !nftAssetName) {
    console.error("Usage: tsx scripts/check_nft.ts <policy_id> <asset_name>");
    process.exit(1);
  }

  const blockchainProvider = new BlockfrostProvider(process.env.BLOCKFROST_API_KEY!);
  const wallet = new MeshWallet({
    networkId: 0,
    fetcher: blockchainProvider,
    submitter: blockchainProvider,
    key: {
      type: "root",
      bech32: process.env.PRIVATE_KEY!
    },
  });

  const walletAddr = await wallet.getChangeAddress();
  console.log(`Wallet: ${walletAddr}`);
  console.log(`Looking for NFT: ${nftPolicyId}.${nftAssetName}\n`);

  const utxos = await wallet.getUtxos();
  const nftUnit = `${nftPolicyId}${nftAssetName}`;

  let found = false;
  for (const utxo of utxos) {
    for (const asset of utxo.output.amount) {
      if (asset.unit === nftUnit) {
        console.log("✅ NFT FOUND in wallet!");
        console.log(`  UTXO: ${utxo.input.txHash}#${utxo.input.outputIndex}`);
        console.log(`  Quantity: ${asset.quantity}`);
        found = true;
      }
    }
  }

  if (!found) {
    console.log("❌ NFT NOT FOUND in wallet");
    console.log("\nThis means the oracle was already created OR the NFT was never minted to this wallet.");
    console.log("\nCheck Cardanoscan:");
    console.log(`https://preprod.cardanoscan.io/token/${nftPolicyId}${nftAssetName}`);
  }
}

main();
