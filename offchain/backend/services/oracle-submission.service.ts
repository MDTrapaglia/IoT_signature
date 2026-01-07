import { prisma } from '../config/prisma.js';
import { measurementService } from './measurement.service.js';
import { sensorService } from './sensor.service.js';
import { OracleTransactionStatus, OracleTransactionType } from '@prisma/client';

class OracleSubmissionService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private submitDelayMs: number;

  constructor() {
    this.submitDelayMs = parseInt(process.env.ORACLE_SUBMIT_DELAY_MS || '5000');
  }

  /**
   * Start the auto-submission background process
   */
  start(): void {
    if (this.isRunning) {
      console.log('⚠️  Oracle Auto-Submission already running');
      return;
    }

    console.log(`🚀 Starting Oracle Auto-Submission Service (${this.submitDelayMs}ms interval)`);
    this.isRunning = true;

    // Run immediately, then repeat at interval
    this.processUnsubmittedMeasurements();

    this.intervalId = setInterval(() => {
      this.processUnsubmittedMeasurements();
    }, this.submitDelayMs);
  }

  /**
   * Stop the auto-submission background process
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    console.log('🛑 Stopping Oracle Auto-Submission Service');

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
  }

  /**
   * Process unsubmitted measurements
   * Private method called by interval
   */
  private async processUnsubmittedMeasurements(): Promise<void> {
    try {
      // Get all verified measurements not linked to a transaction
      const measurements = await measurementService.getUnsubmitted();

      if (measurements.length === 0) {
        return; // Nothing to submit
      }

      console.log(`📤 Found ${measurements.length} unsubmitted measurement(s)`);

      // Group by sensor_id to avoid conflicts
      const bySensor = new Map<string, typeof measurements[0]>();

      for (const measurement of measurements) {
        // Only keep the most recent measurement per sensor
        if (!bySensor.has(measurement.sensor_id)) {
          bySensor.set(measurement.sensor_id, measurement);
        }
      }

      // Submit each sensor's most recent measurement
      for (const measurement of bySensor.values()) {
        await this.submitMeasurement(measurement);
      }
    } catch (error) {
      console.error('❌ Error processing unsubmitted measurements:', error);
    }
  }

  /**
   * Submit a single measurement to the oracle
   * Private method called by processUnsubmittedMeasurements
   */
  private async submitMeasurement(measurement: any): Promise<void> {
    try {
      console.log(`🔄 Submitting measurement ${measurement.id} for sensor ${measurement.sensor_id}`);

      // Get sensor info (must have NFT configured)
      const sensor = await sensorService.get(measurement.sensor_id);

      if (!sensor) {
        console.error(`❌ Sensor ${measurement.sensor_id} not found in database`);
        return;
      }

      if (!sensor.nft_policy_id || !sensor.nft_asset_name) {
        console.log(`⏭️  Skipping sensor ${measurement.sensor_id}: NFT not configured`);
        return;
      }

      // Create OracleTransaction record
      const transaction = await prisma.oracleTransaction.create({
        data: {
          sensor_id: measurement.sensor_id,
          type: OracleTransactionType.UPDATE,
          nft_policy_id: sensor.nft_policy_id,
          nft_asset_name: sensor.nft_asset_name,
          script_address: sensor.script_address,
          status: OracleTransactionStatus.PENDING,
          status_message: 'Preparing to submit...'
        }
      });

      // Link measurement to transaction immediately
      await measurementService.linkToTransaction(measurement.id, transaction.id);

      // TODO: Call updateOracle() from update_oracle.ts
      // This will be implemented in Phase 4 after refactoring
      console.log(`⏸️  Transaction ${transaction.id} created, waiting for Phase 4 implementation`);

      // For now, mark as PENDING with a message
      await prisma.oracleTransaction.update({
        where: { id: transaction.id },
        data: {
          status_message: 'Waiting for oracle update implementation (Phase 4)'
        }
      });

    } catch (error) {
      console.error(`❌ Error submitting measurement ${measurement.id}:`, error);
    }
  }

  /**
   * Manually submit a specific measurement
   * Public method for manual invocation
   */
  async submitManually(measurement_id: string): Promise<void> {
    const measurement = await prisma.measurement.findUnique({
      where: { id: measurement_id }
    });

    if (!measurement) {
      throw new Error(`Measurement ${measurement_id} not found`);
    }

    if (!measurement.verified) {
      throw new Error(`Measurement ${measurement_id} is not verified`);
    }

    if (measurement.oracle_transaction_id) {
      throw new Error(`Measurement ${measurement_id} already linked to transaction ${measurement.oracle_transaction_id}`);
    }

    await this.submitMeasurement(measurement);
  }
}

// Export singleton instance
export const oracleSubmissionService = new OracleSubmissionService();
