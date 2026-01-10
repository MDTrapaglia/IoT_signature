/**
 * Oracle Lucid Evolution Library
 *
 * Módulo reutilizable con funciones para gestionar oracles en Cardano
 * usando Lucid Evolution (reemplaza MeshJS que tiene bug con Plutus V3)
 *
 * Funciones exportadas:
 * - updateOracle() - Actualizar oracle con nuevos datos del sensor
 * - createOracle() - Crear nuevo oracle con NFT
 * - deleteOracle() - Eliminar oracle y recuperar fondos
 *
 * @date 2026-01-09
 */

import {
    Blockfrost,
    Lucid,
    Data,
    applyParamsToScript,
    Constr,
    validatorToAddress,
    type UTxO
} from "@lucid-evolution/lucid";
import { getAddressDetails } from "@lucid-evolution/utils";
import { C } from "lucid-cardano";
import { readFileSync } from "fs";
import { resolve } from "path";
import crypto from "crypto";

// ============================================================================
// TYPES
// ============================================================================

export interface SensorData {
    sensor_id: string;
    temperature: number;   // Temperatura * 10 (ej: 23.5°C = 235)
    humidity: number;      // Humedad * 10 (ej: 65.2% = 652)
    timestamp: number;     // Unix timestamp en milisegundos
    signature: string;     // Firma Ed25519 (64 bytes hex = 128 chars)
    public_key: string;    // Clave pública Ed25519 (32 bytes hex = 64 chars)
}

export interface OracleUpdateParams {
    blockfrostApiKey: string;
    privateKey: string;        // Bech32 root key (xprv...)
    networkId: number;         // 0 = Preprod, 1 = Mainnet
    nftPolicyId: string;
    nftAssetName: string;
    sensorData: SensorData;
}

export interface OracleCreateParams {
    blockfrostApiKey: string;
    privateKey: string;        // Bech32 root key (xprv...)
    networkId: number;         // 0 = Preprod, 1 = Mainnet
    nftPolicyId: string;
    nftAssetName: string;
    initialSensorData: SensorData;
}

export interface OracleDeleteParams {
    blockfrostApiKey: string;
    privateKey: string;        // Bech32 root key (xprv...)
    networkId: number;         // 0 = Preprod, 1 = Mainnet
    nftPolicyId: string;
    nftAssetName: string;
}

export interface OracleCreateResult {
    txHash: string;
    scriptAddress: string;
}

// ============================================================================
// SCHEMAS
// ============================================================================

const SensorDataSchema = Data.Object({
    sensor_id: Data.Bytes(),
    temperature: Data.Integer(),
    humidity: Data.Integer(),
    timestamp: Data.Integer(),
    signature: Data.Bytes(),
    public_key: Data.Bytes()
});

type SensorDataPlutusType = Data.Static<typeof SensorDataSchema>;
const SensorDataPlutus = SensorDataSchema as unknown as SensorDataPlutusType;

const OracleRedeemer = {
    Update: () => Data.to(new Constr(0, [])),
    Delete: () => Data.to(new Constr(1, []))
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Build message for Ed25519 signature
 * Order: humidity || sensor_id || temperature || timestamp (alphabetical)
 */
export function buildMessage(data: {
    humidity: number;
    sensor_id: string;
    temperature: number;
    timestamp: number;
}): Buffer {
    const humidityBytes = Buffer.alloc(8);
    humidityBytes.writeBigInt64BE(BigInt(data.humidity));

    const sensorIdBytes = Buffer.from(data.sensor_id, 'utf8');

    const temperatureBytes = Buffer.alloc(8);
    temperatureBytes.writeBigInt64BE(BigInt(data.temperature));

    const timestampBytes = Buffer.alloc(8);
    timestampBytes.writeBigInt64BE(BigInt(data.timestamp));

    return Buffer.concat([humidityBytes, sensorIdBytes, temperatureBytes, timestampBytes]);
}

/**
 * Calculate SHA-256 hash of a message
 */
export function calculateMessageHash(message: Buffer): Buffer {
    return crypto.createHash('sha256').update(message).digest();
}

/**
 * Initialize Lucid with Blockfrost
 */
async function initializeLucid(blockfrostApiKey: string, network: "Preprod" | "Mainnet") {
    return await Lucid(
        new Blockfrost(
            `https://cardano-${network.toLowerCase()}.blockfrost.io/api/v0`,
            blockfrostApiKey
        ),
        network
    );
}

/**
 * Load wallet from Bech32 root key
 */
async function loadWallet(lucid: any, privateKey: string): Promise<string> {
    const rootKey = C.Bip32PrivateKey.from_bech32(privateKey);
    const harden = (num: number) => 0x80000000 + num;
    const accountKey = rootKey
        .derive(harden(1852))
        .derive(harden(1815))
        .derive(harden(0));
    const paymentKey = accountKey.derive(0).derive(0).to_raw_key();
    const paymentKeyBech32 = paymentKey.to_bech32();

    lucid.selectWallet.fromPrivateKey(paymentKeyBech32);

    return await lucid.wallet().address();
}

/**
 * Get operator pub key hash from wallet address
 */
function getOperatorPubKeyHash(walletAddr: string): string {
    const addressDetails = getAddressDetails(walletAddr);
    if (!addressDetails.paymentCredential) {
        throw new Error("Could not extract payment credential from wallet");
    }
    return addressDetails.paymentCredential.hash;
}

/**
 * Load oracle validator from plutus.json
 */
function loadOracleValidator(): string {
    const plutusJsonPath = resolve(process.cwd(), "onchain/sensors-oracle/plutus.json");
    const plutusJson = JSON.parse(readFileSync(plutusJsonPath, "utf-8"));
    const oracleValidator = plutusJson.validators.find((v: any) =>
        v.title === "sensor_oracle_ed25519.sensor_oracle_ed25519.spend"
    );

    if (!oracleValidator) {
        throw new Error("Oracle validator not found in plutus.json");
    }

    return oracleValidator.compiledCode;
}

/**
 * Apply parameters to oracle script
 */
function applyOracleParams(
    compiledCode: string,
    nftPolicyId: string,
    nftAssetName: string,
    operatorPubKeyHash: string
): string {
    // Apply parameters: OracleParams { nft: AssetClass, operator }
    // IMPORTANT: Do NOT use Data.to() for parameters - pass Constr directly
    const paramsData = new Constr(0, [
        new Constr(0, [nftPolicyId, nftAssetName]), // AssetClass
        operatorPubKeyHash
    ]);

    return applyParamsToScript(compiledCode, [paramsData]);
}

/**
 * Calculate oracle script address
 */
function getOracleScriptAddress(oracleScript: string, network: "Preprod" | "Mainnet"): string {
    return validatorToAddress(network, {
        type: "PlutusV3",
        script: oracleScript
    });
}

/**
 * Convert SensorData to Plutus datum format
 */
function sensorDataToDatum(data: SensorData): string {
    return Data.to({
        sensor_id: Buffer.from(data.sensor_id, 'utf8').toString('hex'),
        temperature: BigInt(data.temperature),
        humidity: BigInt(data.humidity),
        timestamp: BigInt(data.timestamp),
        signature: data.signature,
        public_key: data.public_key
    }, SensorDataPlutus);
}

/**
 * Find oracle UTXO by NFT
 */
async function findOracleUtxo(
    lucid: any,
    scriptAddress: string,
    nftPolicyId: string,
    nftAssetName: string
): Promise<UTxO> {
    const scriptUtxos = await lucid.utxosAt(scriptAddress);
    const nftUnit = `${nftPolicyId}${nftAssetName}`;

    const oracleUtxo = scriptUtxos.find((utxo: any) =>
        utxo.assets[nftUnit] === BigInt(1)
    );

    if (!oracleUtxo) {
        throw new Error(`Oracle UTXO not found at ${scriptAddress}`);
    }

    return oracleUtxo;
}

// ============================================================================
// PUBLIC FUNCTIONS
// ============================================================================

/**
 * Update oracle with new sensor data
 *
 * @param params - Oracle update parameters
 * @returns Transaction hash
 * @throws Error if update fails
 */
export async function updateOracle(params: OracleUpdateParams): Promise<string> {
    const {
        blockfrostApiKey,
        privateKey,
        networkId,
        nftPolicyId,
        nftAssetName,
        sensorData
    } = params;

    const network = networkId === 0 ? "Preprod" : "Mainnet";

    // Initialize Lucid
    const lucid = await initializeLucid(blockfrostApiKey, network);

    // Load wallet
    const walletAddr = await loadWallet(lucid, privateKey);
    const operatorPubKeyHash = getOperatorPubKeyHash(walletAddr);

    // Load and parameterize validator
    const validatorCode = loadOracleValidator();
    const oracleScript = applyOracleParams(validatorCode, nftPolicyId, nftAssetName, operatorPubKeyHash);
    const scriptAddress = getOracleScriptAddress(oracleScript, network);

    // Find oracle UTXO
    const oracleUtxo = await findOracleUtxo(lucid, scriptAddress, nftPolicyId, nftAssetName);

    // Build new datum
    const newDatum = sensorDataToDatum(sensorData);
    const redeemer = OracleRedeemer.Update();
    const nftUnit = `${nftPolicyId}${nftAssetName}`;

    // Build transaction
    const validator = {
        type: "PlutusV3" as const,
        script: oracleScript
    };

    const tx = await lucid
        .newTx()
        .collectFrom([oracleUtxo], redeemer)
        .attach.SpendingValidator(validator)
        .pay.ToContract(scriptAddress, { kind: "inline", value: newDatum }, {
            lovelace: BigInt(2000000),
            [nftUnit]: BigInt(1)
        })
        .addSignerKey(operatorPubKeyHash)
        .complete();

    // Sign and submit
    const signedTx = await tx.sign.withWallet().complete();
    const txHash = await signedTx.submit();

    return txHash;
}

/**
 * Create new oracle with initial sensor data
 *
 * @param params - Oracle creation parameters
 * @returns Transaction hash and script address
 * @throws Error if creation fails
 */
export async function createOracle(params: OracleCreateParams): Promise<OracleCreateResult> {
    const {
        blockfrostApiKey,
        privateKey,
        networkId,
        nftPolicyId,
        nftAssetName,
        initialSensorData
    } = params;

    const network = networkId === 0 ? "Preprod" : "Mainnet";

    // Initialize Lucid
    const lucid = await initializeLucid(blockfrostApiKey, network);

    // Load wallet
    const walletAddr = await loadWallet(lucid, privateKey);
    const operatorPubKeyHash = getOperatorPubKeyHash(walletAddr);

    // Load and parameterize validator
    const validatorCode = loadOracleValidator();
    const oracleScript = applyOracleParams(validatorCode, nftPolicyId, nftAssetName, operatorPubKeyHash);
    const scriptAddress = getOracleScriptAddress(oracleScript, network);

    // Build datum
    const datum = sensorDataToDatum(initialSensorData);
    const nftUnit = `${nftPolicyId}${nftAssetName}`;

    // Build transaction
    const tx = await lucid
        .newTx()
        .pay.ToContract(scriptAddress, { kind: "inline", value: datum }, {
            lovelace: BigInt(2000000),
            [nftUnit]: BigInt(1)
        })
        .complete();

    // Sign and submit
    const signedTx = await tx.sign.withWallet().complete();
    const txHash = await signedTx.submit();

    return {
        txHash,
        scriptAddress
    };
}

/**
 * Delete oracle and recover funds
 *
 * @param params - Oracle deletion parameters
 * @returns Transaction hash
 * @throws Error if deletion fails
 */
export async function deleteOracle(params: OracleDeleteParams): Promise<string> {
    const {
        blockfrostApiKey,
        privateKey,
        networkId,
        nftPolicyId,
        nftAssetName
    } = params;

    const network = networkId === 0 ? "Preprod" : "Mainnet";

    // Initialize Lucid
    const lucid = await initializeLucid(blockfrostApiKey, network);

    // Load wallet
    const walletAddr = await loadWallet(lucid, privateKey);
    const operatorPubKeyHash = getOperatorPubKeyHash(walletAddr);

    // Load and parameterize validator
    const validatorCode = loadOracleValidator();
    const oracleScript = applyOracleParams(validatorCode, nftPolicyId, nftAssetName, operatorPubKeyHash);
    const scriptAddress = getOracleScriptAddress(oracleScript, network);

    // Find oracle UTXO
    const oracleUtxo = await findOracleUtxo(lucid, scriptAddress, nftPolicyId, nftAssetName);

    // Build redeemer
    const redeemer = OracleRedeemer.Delete();

    // Build transaction
    const validator = {
        type: "PlutusV3" as const,
        script: oracleScript
    };

    const tx = await lucid
        .newTx()
        .collectFrom([oracleUtxo], redeemer)
        .attach.SpendingValidator(validator)
        .addSignerKey(operatorPubKeyHash)
        .complete();

    // Sign and submit
    const signedTx = await tx.sign.withWallet().complete();
    const txHash = await signedTx.submit();

    return txHash;
}
