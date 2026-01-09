#!/usr/bin/env tsx
/**
 * Setup Collateral UTXO
 * Creates a 5 ADA UTXO to use as collateral for script transactions
 */

import { MeshWallet, BlockfrostProvider, Transaction } from "@meshsdk/core";
import dotenv from "dotenv";
dotenv.config();

async function main() {
  console.log("=".repeat(70));
  console.log("Setup Collateral UTXO");
  console.log("=".repeat(70));

  const blockchainProvider = new BlockfrostProvider(process.env.BLOCKFROST_API_KEY!);

  const wallet = new MeshWallet({
    networkId: 0, // Preprod
    fetcher: blockchainProvider,
    submitter: blockchainProvider,
    key: {
      type: "root",
      bech32: process.env.PRIVATE_KEY!
    },
  });

  const walletAddr = await wallet.getChangeAddress();
  console.log(`\nWallet: ${walletAddr}`);

  // Get current UTXOs
  const utxos = await wallet.getUtxos();
  console.log(`Current UTXOs: ${utxos.length}`);

  // Check if we already have a 5 ADA UTXO (typical collateral)
  const collateralUtxo = utxos.find(utxo => {
    const lovelace = utxo.output.amount.find(a => a.unit === 'lovelace');
    return lovelace && parseInt(lovelace.quantity) === 5000000;
  });

  if (collateralUtxo) {
    console.log("\n✅ Collateral UTXO already exists!");
    console.log(`   Tx Hash: ${collateralUtxo.input.txHash}`);
    console.log(`   Index: ${collateralUtxo.input.outputIndex}`);
    console.log(`   Amount: 5 ADA`);
    console.log("\n💡 No action needed.");
    return;
  }

  console.log("\n🔄 Creating 5 ADA collateral UTXO...");

  // Create transaction to send 5 ADA to ourselves
  const tx = new Transaction({ initiator: wallet });

  tx.sendLovelace(walletAddr, "5000000"); // 5 ADA

  const unsignedTx = await tx.build();
  const signedTx = await wallet.signTx(unsignedTx);
  const txHash = await wallet.submitTx(signedTx);

  console.log(`\n✅ Collateral UTXO created!`);
  console.log(`   Tx Hash: ${txHash}`);
  console.log(`   Explorer: https://preprod.cardanoscan.io/transaction/${txHash}`);
  console.log(`\n⏳ Waiting for confirmation (~20 seconds)...`);

  // Wait for confirmation
  await new Promise(resolve => setTimeout(resolve, 25000));

  console.log(`\n✅ Done! Restart the backend to use the new collateral:`);
  console.log(`   npm run dev`);
}

main().catch(console.error);
