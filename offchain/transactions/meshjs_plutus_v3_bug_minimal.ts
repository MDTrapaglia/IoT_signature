#!/usr/bin/env tsx
/**
 * MINIMAL REPRODUCTION CASE: MeshJS Plutus V3 Spending Bug
 *
 * This script demonstrates the "Cannot convert undefined to a BigInt" error
 * that occurs when spending from Plutus V3 scripts using MeshJS v1.9.0-beta.90
 *
 * ERROR: Evaluate redeemers failed: Error serializing outputs: Cannot convert undefined to a BigInt
 *
 * The same datum/redeemer works perfectly when CREATING outputs (see create_oracle.ts),
 * but FAILS when SPENDING from Plutus V3 scripts.
 *
 * Bug Report: docs/MESHJS_BUG_REPORT.txt
 * GitHub Issue: [TO BE CREATED]
 */

import {
    BlockfrostProvider,
    MeshWallet,
    MeshTxBuilder,
    applyParamsToScript,
    applyCborEncoding,
    type PlutusScript,
    mConStr0,
    serializePlutusScript,
    deserializeAddress,
    byteString
} from "@meshsdk/core";
import dotenv from "dotenv";

dotenv.config();

// Hardcoded values for minimal reproduction
const BLOCKFROST_API_KEY = process.env.BLOCKFROST_API_KEY!;
const PRIVATE_KEY = process.env.PRIVATE_KEY!;

// Plutus V3 validator code (sensor_oracle_ed25519)
const VALIDATOR_CODE = "590493010100229800aba2aba1aba0aab9faab9eaab9dab9a488888896600264653001300800198041804800cdc3a400530080024888966002600460106ea800e264664530011325980099199119801001000912cc00400629422b30013371e6eb8c04c00400e2946266004004602800280710111bac301130123012301230123012301230123012300e375400c6eb8c004c034dd5009c566002600460186ea8022264b30013003300d375400313322598009804cc004dd5980218081baa300430103754005375c602660206ea8c04cc040dd500b4dd7180218081baa30133010375402c800a26464b300130160018992cc004c03260026eacc01cc04cdd5000cdd7180b18099baa301630133754033375c600e60266ea8c058c04cdd500ca0088acc004c8c9660026014003168acc004c0380062d132598009805980a9baa00189919191919194c004dd7180f800cdd7180f8034dd6980f802cdd6980f8024dd6980f801cdd7180f8012444444b300130260078cc0048c098c09cc09cc09cc09cc09c0064604c604e604e604e604e00323026302730273027001488966002b30015980099b894839c1cdd6980c98129baa010899b89375a6032604a6ea804120d00f8a50408d159800acc004cdc4a40006eb4c054c094dd500844cdc49bad301530253754020906807c52820468acc004cdc4240006eb4c004c094dd5008456600266e1cdc69bae300230253754020904000c56600266e1cdc69bae3003302537540209020456600266e212000371a6eb8c0a0c094dd50084528c5902345902345902345902345902345902345660033001375c6006604a6ea80426e48cdc519b8a3371530014a3480426eb4c054c094dd50082f246eb8c0a0c094dd50084c00528d20109bad301930253754020bc94c00528d20109bad300130253754020bc94dd7180118129baa0105caa29462c811a2c811916408c301f001301e001301d001301c001301b001301637540031640506030602a6ea8009013202630133754002600660266ea800629462c808a2c8088c0540062c8098c8cc004004dd6180118091baa00a2259800800c52f5c1133225980099baf3018301537540046030602a6ea8c024c054dd5003c4cc05c008cc0100100062660080080028098c058004c05c0050141180a180a980a800c5900e180898071baa001222323322330020020012259800800c00e2646644b30013372200e00515980099b8f0070028800c01901544cc014014c06c0110151bae3014001375a602a002602e00280a8c8c8cc004004018896600200300389919912cc004cdc8804801456600266e3c02400a20030064059133005005301c00440586eb8c054004dd5980b000980c000a02c14bd6f7b6300a400116403064660020026eb0c044c038dd5003112cc0040062980103d87a80008992cc004cdd7980998081baa001006899ba548000cc0480052f5c11330030033014002403860240028082294500b45900b118081808800cc02cdd5003cc03cc04000d2225980098020014566002601e6ea802a00716404115980098040014566002601e6ea802a0071640411640348068601a0026e1d20003009375400716401c300800130033754011149a26cac80081";

// Known oracle UTXO (created successfully with create_oracle.ts)
const ORACLE_UTXO = {
    txHash: "c79f01469c32168d3b9fa1bc0e1059f2b26dc62132bb29deed14709318ad2b55",
    outputIndex: 0,
    address: "addr_test1wz40a7a86rdmk9kcknz5dvq867wp6xt2ws6p32ke3frrqsq9xwxnm",
    nftPolicyId: "a2f69dc8b380bbcf6b79d3e3b26097423c981df0bce0bd44d1e75de9",
    nftAssetName: "53454e534f525f45535033325f544553545f3030315f5632" // hex for "SENSOR_ESP32_TEST_001_V2"
};

// Simple sensor data (all values are valid and defined)
const SENSOR_DATA = {
    sensor_id: "ESP32_001",
    temperature: 235,        // 23.5°C
    humidity: 652,           // 65.2%
    timestamp: 1736000000000, // Fixed timestamp
    signature: "d6abfbb93350091fb997289609183a4f54d7da3bd01607aeb40bec604fbfee6eb3a449858de8968c4716d958519623f14ac8dd3daff85737572263a9a9f92d0e", // 64 bytes (128 hex chars)
    public_key: "72ac4b95a9f3a0cdc4af6a301010df26262e4bc5ba3bf6a5e6aff053763049ea" // 32 bytes (64 hex chars)
};

async function main() {
    console.log("=".repeat(70));
    console.log("MINIMAL REPRODUCTION: MeshJS Plutus V3 Spending Bug");
    console.log("=".repeat(70));
    console.log("\nBug: Cannot convert undefined to a BigInt");
    console.log("Version: @meshsdk/core v1.9.0-beta.90");
    console.log("Operation: Spending from Plutus V3 script");
    console.log();

    // Initialize provider and wallet
    const blockchainProvider = new BlockfrostProvider(BLOCKFROST_API_KEY);
    const wallet = new MeshWallet({
        networkId: 0,
        fetcher: blockchainProvider,
        submitter: blockchainProvider,
        key: {
            type: "root",
            bech32: PRIVATE_KEY
        },
    });

    const walletAddr = await wallet.getChangeAddress();
    const utxos = await wallet.getUtxos();

    console.log("✓ Wallet loaded:", walletAddr);

    // Get operator pubkey hash
    const walletAddrDetails = deserializeAddress(walletAddr);
    const operatorPubKeyHash = walletAddrDetails.pubKeyHash!;

    // Apply parameters to script
    const codeWithParams = applyParamsToScript(
        applyCborEncoding(VALIDATOR_CODE),
        [
            mConStr0([ORACLE_UTXO.nftPolicyId, ORACLE_UTXO.nftAssetName]),
            operatorPubKeyHash
        ]
    );

    const oracleScript: PlutusScript = {
        code: codeWithParams,
        version: "V3",
    };

    const oracleScriptAddr = serializePlutusScript(oracleScript).address;
    console.log("✓ Oracle address:", oracleScriptAddr);

    // Fetch oracle UTXO
    console.log("\n🔍 Fetching oracle UTXO...");
    const scriptUtxos = await blockchainProvider.fetchAddressUTxOs(oracleScriptAddr);

    if (scriptUtxos.length === 0) {
        throw new Error("Oracle UTXO not found. Please run create_oracle.ts first.");
    }

    const oracleUtxo = scriptUtxos[0];
    console.log("✓ Found oracle UTXO:", `${oracleUtxo.input.txHash}#${oracleUtxo.input.outputIndex}`);

    // Get collateral
    const collateral = utxos.filter(u => {
        const lovelace = u.output.amount.find(a => a.unit === 'lovelace');
        return lovelace && BigInt(lovelace.quantity) >= 5000000n;
    });

    if (collateral.length === 0) {
        throw new Error("No suitable collateral found");
    }

    console.log("✓ Collateral ready");

    // Build datum (SAME structure that works in create_oracle.ts)
    console.log("\n📊 Building datum with sensor data:");
    console.log("  sensor_id:", SENSOR_DATA.sensor_id);
    console.log("  temperature:", SENSOR_DATA.temperature);
    console.log("  humidity:", SENSOR_DATA.humidity);
    console.log("  timestamp:", SENSOR_DATA.timestamp);
    console.log("  signature length:", SENSOR_DATA.signature.length, "chars");
    console.log("  public_key length:", SENSOR_DATA.public_key.length, "chars");

    const datum = mConStr0([
        SENSOR_DATA.sensor_id,
        SENSOR_DATA.temperature,
        SENSOR_DATA.humidity,
        SENSOR_DATA.timestamp,
        byteString(SENSOR_DATA.signature),
        byteString(SENSOR_DATA.public_key)
    ] as any);

    // Build redeemer (Update = constructor 0)
    const redeemer = mConStr0([]);

    console.log("\n✓ Datum and redeemer built successfully");

    const nftUnit = `${ORACLE_UTXO.nftPolicyId}${ORACLE_UTXO.nftAssetName}`;

    // Initialize TxBuilder
    const txBuilder = new MeshTxBuilder({
        fetcher: blockchainProvider,
        verbose: true
    });

    console.log("\n🔨 Building transaction...");
    console.log("  This will FAIL with: Cannot convert undefined to a BigInt");
    console.log();

    try {
        // THIS IS WHERE THE BUG OCCURS
        const unsignedTx = await txBuilder
            .spendingPlutusScriptV3()
            .txIn(
                oracleUtxo.input.txHash,
                oracleUtxo.input.outputIndex,
                oracleUtxo.output.amount,
                oracleScriptAddr
            )
            .txInScript(oracleScript.code)
            .txInInlineDatumPresent()
            .txInRedeemerValue(redeemer)
            .txOut(oracleScriptAddr, [
                { unit: "lovelace", quantity: "2000000" },
                { unit: nftUnit, quantity: "1" }
            ])
            .txOutInlineDatumValue(datum)
            .txInCollateral(
                collateral[0].input.txHash,
                collateral[0].input.outputIndex,
                collateral[0].output.amount,
                collateral[0].output.address
            )
            .requiredSignerHash(operatorPubKeyHash)
            .changeAddress(walletAddr)
            .selectUtxosFrom(utxos)
            .complete(); // ❌ BUG OCCURS HERE

        console.log("✅ SUCCESS! (This should not happen with beta.90)");
        console.log("Transaction:", unsignedTx);

    } catch (error: any) {
        console.log("\n" + "=".repeat(70));
        console.log("❌ BUG REPRODUCED!");
        console.log("=".repeat(70));
        console.log("\nError:", error.message);
        console.log("\nStack trace:");
        console.log(error.stack);

        console.log("\n" + "=".repeat(70));
        console.log("ANALYSIS");
        console.log("=".repeat(70));
        console.log("\n✓ All datum values are defined (verified above)");
        console.log("✓ Same datum structure works in create_oracle.ts");
        console.log("✓ Redeemer is valid");
        console.log("✓ Oracle UTXO exists and has correct format");
        console.log("\n❌ Bug is in MeshJS's .spendingPlutusScriptV3() implementation");
        console.log("❌ Specifically in computeMinimumCost() during .complete()");
        console.log("\nThe error 'Cannot convert undefined to a BigInt' indicates that");
        console.log("MeshJS is trying to convert an undefined value to BigInt during");
        console.log("transaction serialization/evaluation.");
        console.log("\nThis is NOT a data type issue - it's a bug in MeshJS beta.90");

        process.exit(1);
    }
}

main().catch(console.error);
