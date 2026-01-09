#!/usr/bin/env tsx
import { BlockfrostProvider } from "@meshsdk/core";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  const nftPolicyId = process.argv[2];
  const nftAssetName = process.argv[3];

  if (!nftPolicyId || !nftAssetName) {
    console.error("Usage: npx tsx scripts/check_nft_location.ts <policy_id> <asset_name>");
    process.exit(1);
  }

  const blockfrost = new BlockfrostProvider(process.env.BLOCKFROST_API_KEY!);
  const nftUnit = `${nftPolicyId}${nftAssetName}`;

  console.log(`Searching for NFT: ${nftUnit}\n`);

  try {
    // Query asset information
    const assetInfo = await blockfrost.fetchAssetMetadata(nftUnit);
    console.log("✅ NFT EXISTS on blockchain");
    console.log(JSON.stringify(assetInfo, null, 2));

    // Query asset addresses (where it's currently located)
    const assetAddresses = await blockfrost.fetchAssetAddresses(nftUnit);
    console.log("\n📍 Current Location:");
    console.log(JSON.stringify(assetAddresses, null, 2));

  } catch (error: any) {
    if (error.message?.includes('404')) {
      console.log("❌ NFT does not exist on blockchain");
      console.log("\nThis means the NFT was never minted.");
      console.log("\nYou need to:");
      console.log("  1. Mint the NFT first: npm run oracle:mint-nft -- ESP32_TEST_001");
      console.log("  2. Then create the oracle with the minted NFT");
    } else {
      console.error("❌ Error:", error.message);
    }
  }
}

main();
