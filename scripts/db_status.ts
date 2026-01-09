#!/usr/bin/env tsx
/**
 * Database Status Check
 * Muestra el estado actual de mediciones, sensores y transacciones
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('='.repeat(70));
  console.log('Database Status Report');
  console.log('='.repeat(70));

  try {
    // 1. Measurements
    const measurements = await prisma.measurement.groupBy({
      by: ['verified'],
      _count: true
    });

    const totalMeasurements = measurements.reduce((sum, m) => sum + m._count, 0);
    const verifiedCount = measurements.find(m => m.verified)?._count || 0;
    const unverifiedCount = measurements.find(m => !m.verified)?._count || 0;

    console.log('\n📊 Measurements:');
    console.log(`  Total: ${totalMeasurements}`);
    console.log(`  Verified: ${verifiedCount} ✅`);
    console.log(`  Unverified: ${unverifiedCount} ❌`);

    // 2. Sensors
    const sensors = await prisma.sensor.findMany({
      include: {
        _count: {
          select: {
            measurements: true,
            oracle_transactions: true
          }
        }
      }
    });

    console.log('\n🔧 Sensors:');
    console.log(`  Total: ${sensors.length}`);
    for (const sensor of sensors) {
      console.log(`\n  • ${sensor.sensor_id} (${sensor.is_active ? 'ACTIVE' : 'INACTIVE'})`);
      console.log(`    Public Key: ${sensor.public_key.substring(0, 16)}...`);
      console.log(`    NFT Policy: ${sensor.nft_policy_id || 'NOT CONFIGURED'}`);
      console.log(`    NFT Asset: ${sensor.nft_asset_name || 'NOT CONFIGURED'}`);
      console.log(`    Script Address: ${sensor.script_address || 'NOT CONFIGURED'}`);
      console.log(`    Measurements: ${sensor._count.measurements}`);
      console.log(`    Transactions: ${sensor._count.oracle_transactions}`);
    }

    // 3. Oracle Transactions
    const transactions = await prisma.oracleTransaction.groupBy({
      by: ['status'],
      _count: true
    });

    console.log('\n🔗 Oracle Transactions:');
    const totalTx = transactions.reduce((sum, t) => sum + t._count, 0);
    console.log(`  Total: ${totalTx}`);
    for (const tx of transactions) {
      const icon = tx.status === 'CONFIRMED' ? '✅' : tx.status === 'FAILED' ? '❌' : tx.status === 'PENDING' ? '⏳' : '🔄';
      console.log(`  ${icon} ${tx.status}: ${tx._count}`);
    }

    // 4. Recent Failed Transactions
    const failedTxs = await prisma.oracleTransaction.findMany({
      where: { status: 'FAILED' },
      orderBy: { submitted_at: 'desc' },
      take: 5,
      include: { sensor: true }
    });

    if (failedTxs.length > 0) {
      console.log('\n❌ Recent Failed Transactions:');
      for (const tx of failedTxs) {
        console.log(`\n  • ID: ${tx.id}`);
        console.log(`    Sensor: ${tx.sensor_id}`);
        console.log(`    Type: ${tx.type}`);
        console.log(`    Submitted: ${tx.submitted_at.toISOString()}`);
        console.log(`    Error: ${tx.status_message || 'No error message'}`);
        console.log(`    TX Hash: ${tx.tx_hash || 'None'}`);
      }
    }

    // 5. Recommendations
    console.log('\n' + '='.repeat(70));
    console.log('💡 Recommendations:');
    console.log('='.repeat(70));

    if (unverifiedCount > 0) {
      console.log('\n⚠️  You have unverified measurements (invalid Ed25519 signatures)');
      console.log('   → Check that ESP32 is sending correct signature format');
    }

    const sensorsWithoutNFT = sensors.filter(s => !s.nft_policy_id || !s.nft_asset_name);
    if (sensorsWithoutNFT.length > 0) {
      console.log('\n⚠️  Some sensors are missing NFT configuration:');
      for (const sensor of sensorsWithoutNFT) {
        console.log(`   → ${sensor.sensor_id}: Run "npm run oracle:mint-nft -- ${sensor.sensor_id}"`);
      }
    }

    const failedCount = transactions.find(t => t.status === 'FAILED')?._count || 0;
    if (failedCount > 0) {
      console.log(`\n⚠️  You have ${failedCount} failed transaction(s)`);
      console.log('   → Run "npm run db:clean-failed" to remove old failed transactions');
      console.log('   → Check error messages above for details');
    }

    const pendingCount = transactions.find(t => t.status === 'PENDING')?._count || 0;
    if (pendingCount > 0) {
      console.log(`\n⏳ You have ${pendingCount} pending transaction(s) awaiting confirmation`);
    }

    console.log('\n' + '='.repeat(70));

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
