// Re-export Prisma types
export type {
  Sensor,
  Measurement,
  OracleTransaction,
  OracleTransactionStatus,
  OracleTransactionType
} from '@prisma/client';

// Existing payload from ESP32
export interface ArduinoPayload {
  sensor_id: string;
  temperature?: number;
  humidity?: number;
  message?: string;
  hash: string;
  signature: string;
  publicKey: string;
  timestamp?: number;
  verified?: boolean;
  received_timestamp?: number;
}
