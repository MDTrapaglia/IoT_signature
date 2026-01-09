#!/usr/bin/env tsx
/**
 * Verify Oracle Address
 *
 * Verifica que el script address registrado en DB coincide con el calculado
 * por Lucid Evolution usando los parámetros del sensor.
 *
 * Si no coincide, muestra la dirección correcta para actualizar en DB.
 */

import { prisma } from '../offchain/backend/config/prisma.js';
import { Blockfrost, Lucid, applyParamsToScript, Constr, validatorToAddress } from "@lucid-evolution/lucid";
import { getAddressDetails } from "@lucid-evolution/utils";
import { C } from "lucid-cardano";
import { readFileSync } from "fs";
import { resolve } from "path";
import dotenv from "dotenv";

dotenv.config();

async function main() {
    console.log("=".repeat(70));
    console.log("Verify Oracle Address");
    console.log("=".repeat(70));

    // Get sensor from DB
    const sensors = await prisma.sensor.findMany({
        where: { is_active: true }
    });

    if (sensors.length === 0) {
        console.error("\n❌ No active sensors found in database");
        process.exit(1);
    }

    // Initialize Lucid
    const lucid = await Lucid(
        new Blockfrost(
            "https://cardano-preprod.blockfrost.io/api/v0",
            process.env.BLOCKFROST_API_KEY || ""
        ),
        "Preprod"
    );

    // Load wallet to get operator pub key hash
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
    const addressDetails = getAddressDetails(walletAddr);
    if (!addressDetails.paymentCredential) {
        throw new Error("Could not extract payment credential from wallet");
    }
    const operatorPubKeyHash = addressDetails.paymentCredential.hash;

    // Load oracle validator
    const plutusJsonPath = resolve(process.cwd(), "onchain/sensors-oracle/plutus.json");
    const plutusJson = JSON.parse(readFileSync(plutusJsonPath, "utf-8"));
    const oracleValidator = plutusJson.validators.find((v: any) =>
        v.title === "sensor_oracle_ed25519.sensor_oracle_ed25519.spend"
    );

    if (!oracleValidator) {
        throw new Error("Oracle validator not found in plutus.json");
    }

    // Check each sensor
    for (const sensor of sensors) {
        console.log(`\n${"=".repeat(70)}`);
        console.log(`Sensor: ${sensor.sensor_id}`);
        console.log("=".repeat(70));

        if (!sensor.nft_policy_id || !sensor.nft_asset_name) {
            console.log("⏭️  Skipped: No NFT configured");
            continue;
        }

        console.log(`NFT Policy: ${sensor.nft_policy_id}`);
        console.log(`NFT Asset: ${sensor.nft_asset_name}`);

        // Calculate script address with Lucid
        const paramsData = new Constr(0, [
            new Constr(0, [sensor.nft_policy_id, sensor.nft_asset_name]),
            operatorPubKeyHash
        ]);

        const oracleScript = applyParamsToScript(oracleValidator.compiledCode, [paramsData]);
        const calculatedAddress = validatorToAddress("Preprod", {
            type: "PlutusV3",
            script: oracleScript
        });

        console.log(`\n📍 Addresses:`);
        console.log(`  DB:         ${sensor.script_address || 'NOT SET'}`);
        console.log(`  Calculated: ${calculatedAddress}`);

        if (sensor.script_address === calculatedAddress) {
            console.log(`\n✅ MATCH - Address is correct`);
        } else {
            console.log(`\n❌ MISMATCH - Address needs to be updated`);
            console.log(`\n💡 To fix, run:`);
            console.log(`npm run db:register-sensor -- \\`);
            console.log(`  ${sensor.sensor_id} \\`);
            console.log(`  ${sensor.public_key} \\`);
            console.log(`  ${sensor.nft_policy_id} \\`);
            console.log(`  ${sensor.nft_asset_name} \\`);
            console.log(`  ${calculatedAddress}`);
        }

        // Check if oracle UTXO exists at calculated address
        console.log(`\n🔍 Checking for oracle UTXO...`);
        try {
            const scriptUtxos = await (lucid as any).utxosAt(calculatedAddress);
            const nftUnit = `${sensor.nft_policy_id}${sensor.nft_asset_name}`;
            const oracleUtxo = scriptUtxos.find((utxo: any) =>
                utxo.assets[nftUnit] === BigInt(1)
            );

            if (oracleUtxo) {
                console.log(`✅ Oracle UTXO found!`);
                console.log(`   TX: ${oracleUtxo.txHash}#${oracleUtxo.outputIndex}`);
                console.log(`   ADA: ${Number(oracleUtxo.assets.lovelace) / 1_000_000}`);
            } else {
                console.log(`❌ Oracle UTXO NOT found at calculated address`);
                console.log(`\n💡 Possible reasons:`);
                console.log(`   1. Oracle hasn't been created yet`);
                console.log(`      → Run: npm run oracle:create -- ${sensor.nft_policy_id} ${sensor.nft_asset_name}`);
                console.log(`   2. Oracle was created with different parameters`);
                console.log(`   3. Oracle was already spent/deleted`);
            }
        } catch (error: any) {
            console.error(`❌ Error checking UTXOs: ${error.message}`);
        }
    }

    await prisma.$disconnect();
}

main().catch((error) => {
    console.error("\n❌ Error:", error.message || error);
    process.exit(1);
});
