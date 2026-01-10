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
      if (!process.env.BLOCKFROST_API_KEY) {
        console.error('❌ BLOCKFROST_API_KEY not configured');
        return;
      }

      // Query transaction info from Blockfrost API directly
      const response = await globalThis.fetch(`https://cardano-preprod.blockfrost.io/api/v0/txs/${tx_hash}`, {
        headers: {
          'project_id': process.env.BLOCKFROST_API_KEY
        }
      });

      if (response.status === 404) {
        // Transaction not found yet (still in mempool or not submitted)
        console.log(`⏳ Transaction ${tx_hash} still pending...`);

        await prisma.oracleTransaction.update({
          where: { id: transaction_id },
          data: {
            last_checked_at: new Date(),
            status_message: 'Awaiting confirmation'
          }
        });
        return;
      }

      if (!response.ok) {
        throw new Error(`Blockfrost API error: ${response.status} ${response.statusText}`);
      }

      const txInfo = await response.json();

      if (txInfo && txInfo.block) {
        // Transaction confirmed!
        console.log(`✅ Transaction ${tx_hash} confirmed in block ${txInfo.block_height || 'unknown'}`);

        const updateData: Record<string, unknown> = {
          status: OracleTransactionStatus.CONFIRMED,
          confirmed_at: new Date(),
          last_checked_at: new Date(),
          status_message: 'Confirmed on blockchain'
        };

        if (txInfo.block_height !== undefined) {
          updateData.block_height = txInfo.block_height;
        }

        if (txInfo.block_time !== undefined) {
          updateData.block_time = new Date(txInfo.block_time * 1000);
        }

        if (txInfo.slot !== undefined) {
          updateData.slot = parseInt(txInfo.slot);
        }

        await prisma.oracleTransaction.update({
          where: { id: transaction_id },
          data: updateData
        });
      } else {
        // Still pending in mempool
        console.log(`⏳ Transaction ${tx_hash} still pending...`);

        await prisma.oracleTransaction.update({
          where: { id: transaction_id },
          data: {
            last_checked_at: new Date(),
            status_message: 'Awaiting confirmation'
          }
        });
      }

    } catch (error: unknown) {
      console.error(`❌ Error checking transaction ${tx_hash}:`, error);

      // Don't mark as FAILED immediately - might be temporary API issue
      // Just log and continue polling
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await prisma.oracleTransaction.update({
        where: { id: transaction_id },
        data: {
          last_checked_at: new Date(),
          status_message: `Error checking tx: ${errorMessage}`
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
