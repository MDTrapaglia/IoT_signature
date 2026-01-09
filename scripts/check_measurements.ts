#!/usr/bin/env tsx
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const measurements = await prisma.measurement.findMany({
    where: {
      oracle_transaction_id: null // Sin transacción asociada
    },
    orderBy: { received_at: 'desc' }
  });

  console.log(`Total measurements without transaction: ${measurements.length}\n`);

  for (const m of measurements) {
    const hasAllFields = m.temperature && m.humidity && m.timestamp;
    const icon = hasAllFields ? '✅' : '❌';

    console.log(`${icon} ${m.id.substring(0, 8)}... (${m.sensor_id})`);
    console.log(`   Temperature: ${m.temperature ?? 'NULL'}`);
    console.log(`   Humidity: ${m.humidity ?? 'NULL'}`);
    console.log(`   Timestamp: ${m.timestamp ?? 'NULL'}`);
    console.log(`   Verified: ${m.verified}`);
    console.log();
  }

  const validMeasurements = measurements.filter(m =>
    m.temperature && m.humidity && m.timestamp
  );

  console.log(`\n✅ Valid measurements (with all fields): ${validMeasurements.length}`);
  console.log(`❌ Invalid measurements (missing fields): ${measurements.length - validMeasurements.length}`);

  await prisma.$disconnect();
}

main();
