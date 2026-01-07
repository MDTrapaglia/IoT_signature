import { prisma } from '../config/prisma.js';
import { OracleTransactionStatus } from '@prisma/client';

class TransactionMonitorService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private pollIntervalMs: number;
  private maxRetries: number;
  private retryDelayMs: number;

  constructor() {
    this.pollIntervalMs = parseInt(process.env.TX_MONITOR_POLL_INTERVAL_MS || '15000');
    this.maxRetries = parseInt(process.env.TX_MONITOR_MAX_RETRIES || '3');
    this.retryDelayMs = parseInt(process.env.TX_MONITOR_RETRY_DELAY_MS || '60000');
  }

  /**
   * Start the transaction monitoring background process
   */
  start(): void {
    if (this.isRunning) {
      console.log('⚠️  Transaction Monitor already running');
      return;
    }

    console.log(`👁️  Starting Transaction Monitor Service (${this.pollIntervalMs}ms interval)`);
    this.isRunning = true;

    // Run immediately, then repeat at interval
    this.checkPendingTransactions();

    this.intervalId = setInterval(() => {
      this.checkPendingTransactions();
    }, this.pollIntervalMs);
  }

  /**
   * Stop the transaction monitoring background process
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    console.log('🛑 Stopping Transaction Monitor Service');

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
  }

  /**
   * Check all pending transactions
   * Private method called by interval
   */
  private async checkPendingTransactions(): Promise<void> {
    try {
      // Get all PENDING or RETRYING transactions
      const pendingTxs = await prisma.oracleTransaction.findMany({
        where: {
          status: {
            in: [OracleTransactionStatus.PENDING, OracleTransactionStatus.RETRYING]
          },
          tx_hash: {
            not: null
          }
        },
        orderBy: { submitted_at: 'asc' }
      });

      if (pendingTxs.length === 0) {
        return; // Nothing to check
      }

      console.log(`🔍 Checking ${pendingTxs.length} pending transaction(s)`);

      for (const tx of pendingTxs) {
        await this.checkTransaction(tx.id, tx.tx_hash!);
      }
    } catch (error) {
      console.error('❌ Error checking pending transactions:', error);
    }
  }

  /**
   * Check a single transaction on Blockfrost
   * Private method called by checkPendingTransactions
   */
  private async checkTransaction(transaction_id: string, tx_hash: string): Promise<void> {
    try {
      // TODO: Query Blockfrost API for transaction status
      // This will be implemented in Phase 4/5 after testing
      // For now, just update last_checked_at

      await prisma.oracleTransaction.update({
        where: { id: transaction_id },
        data: {
          last_checked_at: new Date(),
          status_message: 'Waiting for Blockfrost integration (Phase 4/5)'
        }
      });

      // PLACEHOLDER: Simulated Blockfrost response
      /*
      const blockfrost = new BlockfrostProvider(process.env.BLOCKFROST_API_KEY);
      const txInfo = await blockfrost.fetchTxInfo(tx_hash);

      if (txInfo && txInfo.block) {
        // Transaction confirmed!
        console.log(`✅ Transaction ${tx_hash} confirmed in block ${txInfo.block_height}`);

        await prisma.oracleTransaction.update({
          where: { id: transaction_id },
          data: {
            status: OracleTransactionStatus.CONFIRMED,
            confirmed_at: new Date(),
            block_height: txInfo.block_height,
            block_time: new Date(txInfo.block_time * 1000),
            slot: txInfo.slot,
            status_message: 'Confirmed on blockchain'
          }
        });
      } else {
        // Still pending
        await prisma.oracleTransaction.update({
          where: { id: transaction_id },
          data: { last_checked_at: new Date() }
        });
      }
      */

    } catch (error: any) {
      console.error(`❌ Error checking transaction ${tx_hash}:`, error);

      // Don't mark as FAILED immediately - might be temporary API issue
      // Just log and continue polling
      await prisma.oracleTransaction.update({
        where: { id: transaction_id },
        data: {
          last_checked_at: new Date(),
          status_message: `Error: ${error.message}`
        }
      });
    }
  }

  /**
   * Manually check a specific transaction
   * Public method for manual invocation
   */
  async checkManually(transaction_id: string): Promise<void> {
    const transaction = await prisma.oracleTransaction.findUnique({
      where: { id: transaction_id }
    });

    if (!transaction) {
      throw new Error(`Transaction ${transaction_id} not found`);
    }

    if (!transaction.tx_hash) {
      throw new Error(`Transaction ${transaction_id} has no tx_hash`);
    }

    await this.checkTransaction(transaction.id, transaction.tx_hash);
  }
}

// Export singleton instance
export const txMonitorService = new TransactionMonitorService();
