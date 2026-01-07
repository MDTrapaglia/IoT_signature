import { prisma } from '../config/prisma.js';
import { sensorService } from './sensor.service.js';
import type { Measurement, ArduinoPayload } from '../types/index.js';

class MeasurementService {
  /**
   * Create a new measurement from Arduino payload
   */
  async create(payload: ArduinoPayload): Promise<Measurement> {
    // Ensure sensor exists
    await sensorService.getOrCreate(payload.sensor_id, payload.publicKey);

    // Create measurement
    const measurement = await prisma.measurement.create({
      data: {
        sensor_id: payload.sensor_id,
        temperature: payload.temperature ?? null,
        humidity: payload.humidity ?? null,
        timestamp: payload.timestamp ? BigInt(payload.timestamp) : null,
        hash: payload.hash,
        signature: payload.signature,
        public_key: payload.publicKey,
        message: payload.message ?? null,
        verified: payload.verified ?? false,
        verification_error: null
      }
    });

    return measurement;
  }

  /**
   * Get recent measurements for a sensor
   */
  async getRecent(sensor_id: string, limit: number = 100): Promise<Measurement[]> {
    return prisma.measurement.findMany({
      where: { sensor_id },
      orderBy: { received_at: 'desc' },
      take: limit
    });
  }

  /**
   * Get all measurements with pagination
   */
  async getAll(page: number = 1, limit: number = 100): Promise<Measurement[]> {
    const skip = (page - 1) * limit;

    return prisma.measurement.findMany({
      orderBy: { received_at: 'desc' },
      take: limit,
      skip
    });
  }

  /**
   * Get unsubmitted measurements (verified but not linked to transaction)
   */
  async getUnsubmitted(): Promise<Measurement[]> {
    return prisma.measurement.findMany({
      where: {
        verified: true,
        oracle_transaction_id: null
      },
      orderBy: { received_at: 'asc' }
    });
  }

  /**
   * Link measurement to oracle transaction
   */
  async linkToTransaction(measurement_id: string, transaction_id: string): Promise<Measurement> {
    const measurement = await prisma.measurement.update({
      where: { id: measurement_id },
      data: { oracle_transaction_id: transaction_id }
    });

    console.log(`🔗 Linked measurement ${measurement_id} to transaction ${transaction_id}`);
    return measurement;
  }
}

// Export singleton instance
export const measurementService = new MeasurementService();
