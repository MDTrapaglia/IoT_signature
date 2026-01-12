/**
 * Client-side message builder utility
 * Mirrors backend message building logic for hash generation
 */

import CryptoJS from 'crypto-js';

export interface MessageData {
  sensor_id: string;
  temperature: number;  // In °C (e.g., 23.5)
  humidity: number;     // In % (e.g., 65.2)
  timestamp: number;    // Unix timestamp in milliseconds
}

/**
 * Build binary message from sensor data
 * Format: humidity || sensor_id || temperature || timestamp (alphabetical order)
 * Integers are encoded as 8-byte big-endian Int64
 *
 * @param data Sensor measurement data
 * @returns Binary message as Uint8Array
 */
export function buildMessageClient(data: MessageData): Uint8Array {
  // Convert temperature and humidity to integers (*10)
  // E.g., 23.5°C → 235, 65.2% → 652
  const tempInt = Math.round(data.temperature * 10);
  const humidityInt = Math.round(data.humidity * 10);

  // Build message: humidity || sensor_id || temperature || timestamp
  const encoder = new TextEncoder();
  const sensorIdBytes = encoder.encode(data.sensor_id);

  // Allocate buffer: 8 bytes (humidity) + sensor_id length + 8 bytes (temp) + 8 bytes (timestamp)
  const buffer = new Uint8Array(8 + sensorIdBytes.length + 8 + 8);
  const view = new DataView(buffer.buffer);

  let offset = 0;

  // 1. humidity (8 bytes, big-endian Int64)
  view.setBigInt64(offset, BigInt(humidityInt), false); // false = big-endian
  offset += 8;

  // 2. sensor_id (UTF-8 string)
  buffer.set(sensorIdBytes, offset);
  offset += sensorIdBytes.length;

  // 3. temperature (8 bytes, big-endian Int64)
  view.setBigInt64(offset, BigInt(tempInt), false);
  offset += 8;

  // 4. timestamp (8 bytes, big-endian Int64)
  view.setBigInt64(offset, BigInt(data.timestamp), false);

  return buffer;
}

/**
 * Calculate SHA-256 hash of a message using crypto-js
 *
 * @param message Binary message
 * @returns Hex-encoded hash (64 characters)
 */
export function calculateHashClient(message: Uint8Array): string {
  // Convert Uint8Array to WordArray (crypto-js format)
  const wordArray = CryptoJS.lib.WordArray.create(
    Array.from(message).reduce((words: number[], byte, i) => {
      words[i >>> 2] |= byte << (24 - (i % 4) * 8);
      return words;
    }, []),
    message.length
  );

  // Calculate SHA-256 hash
  const hash = CryptoJS.SHA256(wordArray);

  // Convert to uppercase hex string (matches backend format)
  return hash.toString(CryptoJS.enc.Hex).toUpperCase();
}

/**
 * Build message and calculate hash in one step
 *
 * @param data Sensor measurement data
 * @returns Object with message (hex) and hash (hex)
 */
export function buildAndHashMessage(data: MessageData): {
  message: string;
  hash: string;
} {
  const message = buildMessageClient(data);
  const hash = calculateHashClient(message);

  return {
    message: Array.from(message).map(b => b.toString(16).padStart(2, '0')).join(''),
    hash
  };
}
