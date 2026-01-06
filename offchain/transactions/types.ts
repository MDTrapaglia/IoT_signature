/**
 * Tipos TypeScript para el sistema de Oracle de Sensores
 *
 * Estos tipos corresponden a las estructuras definidas en el contrato Aiken
 * sensor_oracle_verified.ak
 */

/**
 * Datos del sensor con firma ECDSA
 *
 * Corresponde al tipo SensorData en Aiken
 */
export interface SensorData {
    sensor_id: string;     // ID del sensor (ej: "ESP32_001")
    temperature: number;   // Temperatura * 10 (ej: 23.5°C = 235)
    humidity: number;      // Humedad * 10 (ej: 65.2% = 652)
    timestamp: number;     // Unix timestamp en milisegundos
    signature: string;     // Firma ECDSA secp256k1 (64 bytes en hex)
    public_key: string;    // Clave pública secp256k1 (64 bytes en hex, sin comprimir)
}

/**
 * Identificación única de un asset NFT
 *
 * Corresponde al tipo AssetClass en Aiken
 */
export interface AssetClass {
    policy_id: string;     // Policy ID del NFT (hex)
    name: string;          // Nombre del asset (hex)
}

/**
 * Parámetros del validador del Oracle
 *
 * Corresponde al tipo OracleParams en Aiken
 */
export interface OracleParams {
    nft: AssetClass;              // NFT que identifica el oracle
    operator: string;             // VerificationKeyHash del operador (hex)
}

/**
 * Redeemers del Oracle
 *
 * Corresponde al tipo OracleRedeemer en Aiken
 */
export enum OracleRedeemer {
    Update = 0,  // Actualizar datos del sensor
    Delete = 1   // Eliminar el oracle
}

/**
 * Validación de datos del sensor
 */
export function validateSensorData(data: SensorData): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validar temperatura: -50°C a 100°C (-500 a 1000 en formato *10)
    if (data.temperature < -500 || data.temperature > 1000) {
        errors.push(`Temperature out of range: ${data.temperature} (valid: -500 to 1000)`);
    }

    // Validar humedad: 0% a 100% (0 a 1000 en formato *10)
    if (data.humidity < 0 || data.humidity > 1000) {
        errors.push(`Humidity out of range: ${data.humidity} (valid: 0 to 1000)`);
    }

    // Validar timestamp
    if (data.timestamp <= 0) {
        errors.push(`Invalid timestamp: ${data.timestamp} (must be positive)`);
    }

    // Validar longitud de firma (64 bytes = 128 caracteres hex)
    if (data.signature.length !== 128) {
        errors.push(`Invalid signature length: ${data.signature.length} (expected: 128)`);
    }

    // Validar longitud de clave pública (64 bytes = 128 caracteres hex)
    if (data.public_key.length !== 128) {
        errors.push(`Invalid public_key length: ${data.public_key.length} (expected: 128)`);
    }

    // Validar que sensor_id no esté vacío
    if (!data.sensor_id || data.sensor_id.length === 0) {
        errors.push("Sensor ID cannot be empty");
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Formatea temperatura para display
 */
export function formatTemperature(temp: number): string {
    return `${(temp / 10).toFixed(1)}°C`;
}

/**
 * Formatea humedad para display
 */
export function formatHumidity(humidity: number): string {
    return `${(humidity / 10).toFixed(1)}%`;
}

/**
 * Formatea timestamp para display
 */
export function formatTimestamp(timestamp: number): string {
    return new Date(timestamp).toISOString();
}
