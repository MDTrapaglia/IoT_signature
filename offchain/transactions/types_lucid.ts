/**
 * Types and Schemas for Lucid Evolution
 *
 * This file contains all data schemas and type definitions used
 * for interacting with Plutus V3 smart contracts using Lucid Evolution.
 */

import { Data, Constr } from "@lucid-evolution/lucid";

// ============================================================================
// Sensor Data Schema
// ============================================================================

/**
 * Schema for sensor data stored in oracle datum
 *
 * Structure (alphabetical order):
 * - sensor_id: ByteArray (UTF-8 encoded string)
 * - temperature: Integer (temp * 10, e.g., 23.5°C = 235)
 * - humidity: Integer (humidity * 10, e.g., 65.2% = 652)
 * - timestamp: Integer (Unix timestamp in milliseconds)
 * - signature: ByteArray (64 bytes Ed25519 signature)
 * - public_key: ByteArray (32 bytes Ed25519 public key)
 */
export const SensorDataSchema = Data.Object({
    sensor_id: Data.Bytes(),
    temperature: Data.Integer(),
    humidity: Data.Integer(),
    timestamp: Data.Integer(),
    signature: Data.Bytes(),
    public_key: Data.Bytes()
});

/**
 * TypeScript type inferred from SensorDataSchema
 */
export type SensorData = Data.Static<typeof SensorDataSchema>;

// Cast for easier usage (required for Data.to() second parameter)
export const SensorDataCast = SensorDataSchema as unknown as SensorData;

// ============================================================================
// Oracle Parameters Schema
// ============================================================================

/**
 * Schema for oracle validator parameters
 *
 * Structure:
 * - AssetClass { policy_id: ByteArray, name: ByteArray }
 * - operator: ByteArray (pub key hash)
 */
export const OracleParamsSchema = Data.Tuple([
    Data.Object({ // AssetClass
        fields: Data.Tuple([
            Data.Bytes(), // policy_id
            Data.Bytes()  // asset_name
        ])
    }),
    Data.Bytes() // operator pub key hash
]);

/**
 * TypeScript type for oracle parameters
 */
export type OracleParams = Data.Static<typeof OracleParamsSchema>;

// ============================================================================
// Redeemers
// ============================================================================

/**
 * Oracle redeemer constructors
 *
 * Update (0): Update oracle with new sensor data
 * Delete (1): Delete oracle and recover locked ADA
 */
export const OracleRedeemer = {
    /**
     * Update redeemer (constructor 0)
     * Used when updating oracle with new sensor readings
     */
    Update: () => Data.to(new Constr(0, [])),

    /**
     * Delete redeemer (constructor 1)
     * Used when deleting oracle and recovering funds
     */
    Delete: () => Data.to(new Constr(1, []))
};

// ============================================================================
// Helper Types
// ============================================================================

/**
 * Sensor data in TypeScript format (before conversion to Plutus)
 */
export interface SensorDataInput {
    sensor_id: string;
    temperature: number;  // Already multiplied by 10
    humidity: number;     // Already multiplied by 10
    timestamp: number;    // Unix timestamp in milliseconds
    signature: string;    // Hex string (128 chars = 64 bytes)
    public_key: string;   // Hex string (64 chars = 32 bytes)
}

/**
 * Oracle update parameters
 */
export interface UpdateOracleParams {
    blockfrostApiKey: string;
    privateKey: string;           // Root key in bech32 format
    networkId: 0 | 1;            // 0 = Testnet, 1 = Mainnet
    nftPolicyId: string;         // Hex string
    nftAssetName: string;        // Hex string
    sensorData: SensorDataInput;
}

// ============================================================================
// Datum Conversion Helpers
// ============================================================================

/**
 * Convert SensorDataInput (TypeScript) to Plutus datum format
 *
 * @param data - Sensor data in TypeScript format
 * @returns Encoded datum ready for Plutus
 */
export function sensorDataToDatum(data: SensorDataInput): string {
    return Data.to({
        sensor_id: Buffer.from(data.sensor_id, 'utf8').toString('hex'),
        temperature: BigInt(data.temperature),
        humidity: BigInt(data.humidity),
        timestamp: BigInt(data.timestamp),
        signature: data.signature, // Already hex string
        public_key: data.public_key // Already hex string
    }, SensorDataCast);
}

/**
 * Parse datum from oracle UTXO back to TypeScript format
 *
 * @param datumCbor - CBOR-encoded datum from UTXO
 * @returns Parsed sensor data
 */
export function datumToSensorData(datumCbor: string): SensorDataInput {
    const parsed = Data.from(datumCbor, SensorDataCast);

    return {
        sensor_id: Buffer.from(parsed.sensor_id, 'hex').toString('utf8'),
        temperature: Number(parsed.temperature),
        humidity: Number(parsed.humidity),
        timestamp: Number(parsed.timestamp),
        signature: parsed.signature,
        public_key: parsed.public_key
    };
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate sensor data ranges according to smart contract rules
 *
 * @param data - Sensor data to validate
 * @throws Error if data is out of range
 */
export function validateSensorData(data: SensorDataInput): void {
    // Temperature range: -50°C to 100°C (stored as * 10)
    const MIN_TEMP = -500;
    const MAX_TEMP = 1000;

    // Humidity range: 0% to 100% (stored as * 10)
    const MIN_HUM = 0;
    const MAX_HUM = 1000;

    if (data.temperature < MIN_TEMP || data.temperature > MAX_TEMP) {
        throw new Error(
            `Temperature ${data.temperature / 10}°C out of range. ` +
            `Must be between ${MIN_TEMP / 10}°C and ${MAX_TEMP / 10}°C`
        );
    }

    if (data.humidity < MIN_HUM || data.humidity > MAX_HUM) {
        throw new Error(
            `Humidity ${data.humidity / 10}% out of range. ` +
            `Must be between ${MIN_HUM / 10}% and ${MAX_HUM / 10}%`
        );
    }

    if (data.timestamp <= 0) {
        throw new Error(`Timestamp must be positive, got ${data.timestamp}`);
    }

    // Validate signature length (64 bytes = 128 hex chars)
    if (data.signature.length !== 128) {
        throw new Error(
            `Invalid signature length: ${data.signature.length}. ` +
            `Expected 128 hex characters (64 bytes)`
        );
    }

    // Validate public key length (32 bytes = 64 hex chars)
    if (data.public_key.length !== 64) {
        throw new Error(
            `Invalid public key length: ${data.public_key.length}. ` +
            `Expected 64 hex characters (32 bytes)`
        );
    }

    // Validate hex strings
    const hexRegex = /^[0-9a-fA-F]+$/;
    if (!hexRegex.test(data.signature)) {
        throw new Error("Signature must be a valid hex string");
    }
    if (!hexRegex.test(data.public_key)) {
        throw new Error("Public key must be a valid hex string");
    }
}
