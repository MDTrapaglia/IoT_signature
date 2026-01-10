#!/usr/bin/env tsx
/**
 * Contract Validation Script
 *
 * Validates that TypeScript contracts correspond to Aiken compiled scripts
 * in plutus.json
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

interface Validator {
    title: string;
    hash: string;
    compiledCode: string;
}

interface PlutusJson {
    validators: Validator[];
}

interface ValidationResult {
    validator: string;
    exists: boolean;
    hash?: string;
    usedBy: string[];
    status: 'OK' | 'NOT_FOUND' | 'UNUSED';
}

// List of validators expected to be used in TypeScript code
const EXPECTED_VALIDATORS = [
    {
        name: 'sensor_oracle_ed25519.sensor_oracle_ed25519.spend',
        description: 'Main oracle validator with Ed25519 signature verification',
        usedBy: [
            'oracle_lucid_lib.ts'
        ]
    }
];

function loadPlutusJson(): PlutusJson {
    const plutusJsonPath = resolve(process.cwd(), 'onchain/sensors-oracle/plutus.json');
    return JSON.parse(readFileSync(plutusJsonPath, 'utf-8'));
}

// Note: Plutus script hashes are calculated using Blake2b-224
// The hashes are already provided in plutus.json

function checkValidatorInCode(validatorName: string, file: string): boolean {
    try {
        const filePath = resolve(process.cwd(), `offchain/transactions/${file}`);
        const content = readFileSync(filePath, 'utf-8');
        return content.includes(validatorName);
    } catch {
        return false;
    }
}

function validateContracts(): void {
    console.log('\n=================================================================');
    console.log('Contract Validation: TypeScript ↔ Aiken');
    console.log('=================================================================\n');

    const plutusJson = loadPlutusJson();
    const results: ValidationResult[] = [];

    // Validate each expected validator
    for (const expected of EXPECTED_VALIDATORS) {
        const validator = plutusJson.validators.find(v => v.title === expected.name);

        if (!validator) {
            results.push({
                validator: expected.name,
                exists: false,
                usedBy: expected.usedBy,
                status: 'NOT_FOUND'
            });
            continue;
        }

        // Check if it's actually used in the code
        const actuallyUsedBy = expected.usedBy.filter(file =>
            checkValidatorInCode(expected.name, file)
        );

        results.push({
            validator: expected.name,
            exists: true,
            hash: validator.hash,
            usedBy: actuallyUsedBy,
            status: actuallyUsedBy.length > 0 ? 'OK' : 'UNUSED'
        });
    }

    // Print results
    let allValid = true;

    for (const result of results) {
        const statusIcon = result.status === 'OK' ? '✅' : result.status === 'NOT_FOUND' ? '❌' : '⚠️';

        console.log(`${statusIcon} ${result.validator}`);
        console.log(`   Status: ${result.status}`);

        if (result.exists && result.hash) {
            console.log(`   Hash: ${result.hash}`);
        }

        if (result.usedBy.length > 0) {
            console.log(`   Used by:`);
            result.usedBy.forEach(file => {
                const used = result.exists && checkValidatorInCode(result.validator, file);
                console.log(`     ${used ? '✓' : '✗'} ${file}`);
            });
        }

        console.log();

        if (result.status !== 'OK') {
            allValid = false;
        }
    }

    // Summary
    console.log('=================================================================');
    console.log('Plutus.json Validators Summary');
    console.log('=================================================================\n');

    const validatorsByType = {
        'Oracle (Ed25519)': plutusJson.validators.filter(v => v.title.includes('sensor_oracle_ed25519')),
        'Oracle (ECDSA - Legacy)': plutusJson.validators.filter(v => v.title.includes('sensor_oracle_verified')),
        'NFT Minting': plutusJson.validators.filter(v => v.title.includes('nft')),
        'Test Validators': plutusJson.validators.filter(v => v.title.includes('simple'))
    };

    for (const [type, validators] of Object.entries(validatorsByType)) {
        if (validators.length > 0) {
            console.log(`${type}: ${validators.length} validator(s)`);
            validators.forEach(v => {
                console.log(`  - ${v.title} (${v.hash.substring(0, 16)}...)`);
            });
            console.log();
        }
    }

    console.log('=================================================================\n');

    if (allValid) {
        console.log('✅ All validators are correctly configured and used\n');
        process.exit(0);
    } else {
        console.log('❌ Some validators have issues. Please review the output above.\n');
        process.exit(1);
    }
}

// Run validation
try {
    validateContracts();
} catch (error) {
    console.error('❌ Validation failed:', error);
    process.exit(1);
}
