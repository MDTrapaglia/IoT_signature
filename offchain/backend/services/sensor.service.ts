import { prisma } from '../config/prisma.js';
import type { Sensor } from '../types/index.js';

class SensorService {
  /**
   * Get sensor by sensor_id, or create if doesn't exist
   */
  async getOrCreate(sensor_id: string, public_key: string): Promise<Sensor> {
    // Try to find existing sensor
    let sensor = await prisma.sensor.findUnique({
      where: { sensor_id }
    });

    if (sensor) {
      // Update public_key if it changed
      if (sensor.public_key !== public_key) {
        sensor = await prisma.sensor.update({
          where: { sensor_id },
          data: { public_key }
        });
        console.log(`📝 Updated public_key for sensor ${sensor_id}`);
      }
      return sensor;
    }

    // Create new sensor
    sensor = await prisma.sensor.create({
      data: {
        sensor_id,
        public_key,
        is_active: true
      }
    });

    console.log(`🆕 Created new sensor: ${sensor_id}`);
    return sensor;
  }

  /**
   * Update NFT information for a sensor
   */
  async updateNFTInfo(sensor_id: string, policy_id: string, asset_name: string): Promise<Sensor> {
    const sensor = await prisma.sensor.update({
      where: { sensor_id },
      data: {
        nft_policy_id: policy_id,
        nft_asset_name: asset_name
      }
    });

    console.log(`🏷️  Updated NFT info for sensor ${sensor_id}`);
    return sensor;
  }

  /**
   * Update oracle script address for a sensor
   */
  async updateOracleAddress(sensor_id: string, script_address: string): Promise<Sensor> {
    const sensor = await prisma.sensor.update({
      where: { sensor_id },
      data: { script_address }
    });

    console.log(`📍 Updated oracle address for sensor ${sensor_id}`);
    return sensor;
  }

  /**
   * Get sensor by sensor_id
   */
  async get(sensor_id: string): Promise<Sensor | null> {
    return prisma.sensor.findUnique({
      where: { sensor_id }
    });
  }

  /**
   * List all active sensors
   */
  async listActive(): Promise<Sensor[]> {
    return prisma.sensor.findMany({
      where: { is_active: true },
      orderBy: { created_at: 'desc' }
    });
  }
}

// Export singleton instance
export const sensorService = new SensorService();
