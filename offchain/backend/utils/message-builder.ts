import crypto from 'crypto';

export interface MessageData {
  sensor_id: string;
  temperature?: number;
  humidity?: number;
  timestamp?: number;
}

/**
 * Construye el mensaje binario a partir de los campos ordenados alfabéticamente
 * Compatible con el validator de Aiken sensor_oracle_verified.ak
 *
 * Formato: humidity_bytes || sensor_id || temperature_bytes || timestamp_bytes
 * Los enteros se codifican como 8 bytes big-endian (Int64BE)
 */
export function buildMessage(data: MessageData): Buffer {
  const buffers: Buffer[] = [];

  // Orden alfabético: humidity, sensor_id, temperature, timestamp

  // 1. humidity (8 bytes big-endian)
  if (data.humidity !== undefined) {
    const humidityBuffer = Buffer.allocUnsafe(8);
    humidityBuffer.writeBigInt64BE(BigInt(data.humidity));
    buffers.push(humidityBuffer);
  }

  // 2. sensor_id (UTF-8 bytes)
  if (data.sensor_id) {
    buffers.push(Buffer.from(data.sensor_id, 'utf-8'));
  }

  // 3. temperature (8 bytes big-endian)
  if (data.temperature !== undefined) {
    const temperatureBuffer = Buffer.allocUnsafe(8);
    temperatureBuffer.writeBigInt64BE(BigInt(data.temperature));
    buffers.push(temperatureBuffer);
  }

  // 4. timestamp (8 bytes big-endian)
  if (data.timestamp !== undefined) {
    const timestampBuffer = Buffer.allocUnsafe(8);
    timestampBuffer.writeBigInt64BE(BigInt(data.timestamp));
    buffers.push(timestampBuffer);
  }

  return Buffer.concat(buffers);
}

/**
 * Calcula SHA-256 hash de un mensaje binario
 */
export function calculateHash(message: Buffer): string {
  return crypto.createHash('sha256').update(message).digest('hex').toUpperCase();
}

/**
 * Verifica que el hash corresponda al mensaje
 */
export function verifyHash(message: Buffer, providedHash: string): boolean {
  const calculatedHash = calculateHash(message);
  return calculatedHash.toLowerCase() === providedHash.toLowerCase();
}
