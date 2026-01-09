#!/usr/bin/env tsx
/**
 * Test MeshJS v1.8.4 API - verificar si fetchAddressUTxOs funciona
 */

import { BlockfrostProvider } from "@meshsdk/core";
import dotenv from "dotenv";

dotenv.config();

async function main() {
    console.log("Testing MeshJS v1.8.4 API...\n");

    const blockchainProvider = new BlockfrostProvider(process.env.BLOCKFROST_API_KEY!);
    const oracleAddress = "addr_test1wz40a7a86rdmk9kcknz5dvq867wp6xt2ws6p32ke3frrqsq9xwxnm";

    console.log("Checking BlockfrostProvider methods...");
    console.log("Available methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(blockchainProvider)));

    try {
        console.log("\nTrying to fetch UTXOs for oracle address...");
        console.log("Address:", oracleAddress);

        // Try different method names that might exist in v1.8.4
        if (typeof (blockchainProvider as any).fetchAddressUTxOs === 'function') {
            console.log("\n✓ fetchAddressUTxOs exists");
            const utxos = await blockchainProvider.fetchAddressUTxOs(oracleAddress);
            console.log("UTXOs found:", utxos.length);
            console.log("UTXOs:", JSON.stringify(utxos, null, 2));
        } else {
            console.log("\n✗ fetchAddressUTxOs does NOT exist");
        }

        if (typeof (blockchainProvider as any).fetchAddressUtxos === 'function') {
            console.log("\n✓ fetchAddressUtxos exists (lowercase)");
            const utxos = await (blockchainProvider as any).fetchAddressUtxos(oracleAddress);
            console.log("UTXOs found:", utxos.length);
            console.log("UTXOs:", JSON.stringify(utxos, null, 2));
        }

        if (typeof (blockchainProvider as any).get === 'function') {
            console.log("\n✓ get method exists");
            const result = await (blockchainProvider as any).get(`/addresses/${oracleAddress}/utxos`);
            console.log("Result:", JSON.stringify(result, null, 2));
        }

    } catch (error: any) {
        console.error("\n❌ Error:", error.message);
        console.error("Stack:", error.stack);
    }
}

main().catch(console.error);
