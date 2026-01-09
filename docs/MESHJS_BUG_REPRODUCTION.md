# MeshJS Plutus V3 Spending Bug - Reproduction Guide

## Bug Summary

MeshJS v1.9.0-beta.90 fails when building transactions that **spend from Plutus V3 script addresses** with the error:

```
Error: Evaluate redeemers failed: Error serializing outputs: Cannot convert undefined to a BigInt
```

**What works:** Creating outputs to Plutus V3 scripts (✅ `create_oracle.ts`)
**What fails:** Spending from Plutus V3 scripts (❌ `update_oracle.ts`)

## Reproduction

### Prerequisites

1. Node.js 18+ installed
2. Cardano Preprod testnet account with tADA
3. Blockfrost API key for Preprod
4. An existing oracle UTXO (created with `create_oracle.ts`)

### Setup

```bash
# Install dependencies
npm install

# Configure environment
cp offchain/frontend/.env.example .env

# Edit .env with your credentials:
# BLOCKFROST_API_KEY=preprodXXXXXXXX
# PRIVATE_KEY=xprv...
```

### Run Minimal Reproduction

```bash
npm run bug:meshjs
```

### Expected Output

```
======================================================================
MINIMAL REPRODUCTION: MeshJS Plutus V3 Spending Bug
======================================================================

Bug: Cannot convert undefined to a BigInt
Version: @meshsdk/core v1.9.0-beta.90
Operation: Spending from Plutus V3 script

✓ Wallet loaded: addr_test1...
✓ Oracle address: addr_test1wz40a7a86rdmk9kcknz5dvq867wp6xt2ws6p32ke3frrqsq9xwxnm
✓ Found oracle UTXO: c79f01469c32168d3b9fa1bc0e1059f2b26dc62132bb29deed14709318ad2b55#0
✓ Collateral ready

📊 Building datum with sensor data:
  sensor_id: ESP32_001
  temperature: 235
  humidity: 652
  timestamp: 1736000000000
  signature length: 128 chars
  public_key length: 64 chars

✓ Datum and redeemer built successfully

🔨 Building transaction...
  This will FAIL with: Cannot convert undefined to a BigInt

======================================================================
❌ BUG REPRODUCED!
======================================================================

Error: Evaluate redeemers failed: Error serializing outputs: Cannot convert undefined to a BigInt

Stack trace:
    at Object.computeMinimumCost (node_modules/@meshsdk/transaction/dist/index.js:4107:19)
    at async computeMinimumCost (node_modules/@meshsdk/transaction/dist/index.js:1387:19)
    at async computeChangeAndAdjustForFee (.../change.ts:447:26)
    at async _MeshTxBuilder.selectUtxos (node_modules/@meshsdk/transaction/dist/index.js:4144:12)
    at async _MeshTxBuilder.complete (node_modules/@meshsdk/transaction/dist/index.js:4069:25)

======================================================================
ANALYSIS
======================================================================

✓ All datum values are defined (verified above)
✓ Same datum structure works in create_oracle.ts
✓ Redeemer is valid
✓ Oracle UTXO exists and has correct format

❌ Bug is in MeshJS's .spendingPlutusScriptV3() implementation
❌ Specifically in computeMinimumCost() during .complete()

The error 'Cannot convert undefined to a BigInt' indicates that
MeshJS is trying to convert an undefined value to BigInt during
transaction serialization/evaluation.

This is NOT a data type issue - it's a bug in MeshJS beta.90
```

## Code Location

**Minimal reproduction:** `offchain/transactions/meshjs_plutus_v3_bug_minimal.ts`

**Full context:**
- Working example: `offchain/transactions/create_oracle.ts` (creates Plutus V3 outputs - works ✅)
- Failing example: `offchain/transactions/update_oracle.ts` (spends Plutus V3 inputs - fails ❌)

## Key Findings

### Evidence This is a MeshJS Bug

1. **Same datum works in create, fails in spend**
   - `create_oracle.ts` uses identical datum structure → ✅ Works
   - `update_oracle.ts` uses identical datum structure → ❌ Fails

2. **All data values are verified**
   - Debug logging confirms no `undefined` values in user data
   - All fields have correct types and values

3. **Bug is in MeshJS internals**
   - Error occurs in `@meshsdk/transaction/dist/index.js:4107`
   - During `computeMinimumCost()` when evaluating Plutus script
   - MeshJS's code tries `BigInt(undefined)` which is illegal

4. **Version-specific**
   - Beta v1.9.0-beta.90: This error (BigInt)
   - Stable v1.8.4: Different error (toPlutusData)
   - Stable v1.7.33: Same toPlutusData error
   - Conclusion: Older versions don't support Plutus V3 spending

### What the Bug Affects

❌ **Blocked:**
- Spending from Plutus V3 script addresses
- Oracle updates
- Any `.spendingPlutusScriptV3()` transaction

✅ **Still Works:**
- Creating Plutus V3 script outputs
- Minting with Plutus V3
- Regular transactions
- Backend/database operations

## Workaround

**Migrate to Lucid Evolution** which has full Plutus V3 support:
- Package: `@lucid-evolution/lucid`
- Already installed in this project
- Implementation branch: `feature/lucid-evolution-migration`

## Related Issues

- [MeshJS Issue #763](https://github.com/MeshJS/mesh/issues/763) - PlutusV3 Script Hash Mismatch
- [MeshJS Issues #712, #713](https://github.com/MeshJS/mesh/issues/713) - BigInt Type Mixing (different bug)

## Documentation

- **Detailed bug report:** `docs/MESHJS_BUG_REPORT.txt`
- **Full analysis:** `docs/MESHJS_PLUTUS_V3_ISSUE.md`
- **Data types analysis:** `docs/PLUTUS_DATA_TYPES_ALTERNATIVES.md`
- **Project status:** `docs/PROJECT_STATUS.md`

## Version Info

```json
{
  "@meshsdk/core": "1.9.0-beta.90",
  "@lucid-evolution/lucid": "0.4.29",
  "node": "23.x",
  "typescript": "5.9.3"
}
```

## Contact

For questions or additional testing, see project repository or create an issue on [MeshJS GitHub](https://github.com/MeshJS/mesh/issues).
