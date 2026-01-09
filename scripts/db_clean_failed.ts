#!/usr/bin/env tsx
/**
 * Clean Failed Transactions
 * Elimina transacciones fallidas antiguas de la base de datos
 */

import { PrismaClient } from '@prisma/client';
import readline from 'readline';

const prisma = new PrismaClient();

function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => rl.question(query, (answer) => {
    rl.close();
    resolve(answer);
  }));
}

async function main() {
  console.log('='.repeat(70));
  console.log('Clean Failed Transactions');
  console.log('='.repeat(70));

  try {
    // Count failed transactions
    const failedCount = await prisma.oracleTransaction.count({
      where: { status: 'FAILED' }
    });

    if (failedCount === 0) {
      console.log('\n✅ No failed transactions found. Database is clean!');
      return;
    }

    console.log(`\n⚠️  Found ${failedCount} failed transaction(s)`);

    // Show some details
    const failedTxs = await prisma.oracleTransaction.findMany({
      where: { status: 'FAILED' },
      orderBy: { submitted_at: 'desc' },
      take: 10
    });

    console.log('\nRecent failed transactions:');
    for (const tx of failedTxs) {
      console.log(`  • ${tx.id.substring(0, 8)}... - ${tx.sensor_id} - ${tx.type} - ${tx.submitted_at.toISOString()}`);
      console.log(`    Error: ${tx.status_message || 'No error message'}`);
    }

    // Ask for confirmation
    const answer = await askQuestion(`\nDelete all ${failedCount} failed transaction(s)? (yes/no): `);

    if (answer.toLowerCase() !== 'yes') {
      console.log('\n❌ Operation cancelled');
      return;
    }

    // Also unlink measurements from these transactions
    console.log('\n🔄 Unlinking measurements from failed transactions...');
    const updateResult = await prisma.measurement.updateMany({
      where: {
        oracle_transaction: {
          status: 'FAILED'
        }
      },
      data: {
        oracle_transaction_id: null
      }
    });

    console.log(`   ✓ Unlinked ${updateResult.count} measurement(s)`);

    // Delete failed transactions
    console.log('\n🗑️  Deleting failed transactions...');
    const deleteResult = await prisma.oracleTransaction.deleteMany({
      where: { status: 'FAILED' }
    });

    console.log(`   ✓ Deleted ${deleteResult.count} transaction(s)`);

    console.log('\n✅ Cleanup complete!');
    console.log('   Measurements are now available for resubmission.');

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
