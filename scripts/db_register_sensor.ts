#!/usr/bin/env tsx
/**
 * Register/Update Sensor Configuration
 * Registra un sensor en la base de datos con su NFT y script address
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('❌ Usage: npm run db:register-sensor -- <sensor_id> <public_key> [nft_policy_id] [nft_asset_name] [script_address]');
    console.error('   Example: npm run db:register-sensor -- ESP32_001 abcd1234... e659c328... 53454e534f52...addr_test1...');
    process.exit(1);
  }

  const [sensor_id, public_key, nft_policy_id, nft_asset_name, script_address] = args;

  console.log('='.repeat(70));
  console.log('Register/Update Sensor');
  console.log('='.repeat(70));

  console.log('\n📝 Configuration:');
  console.log(`  Sensor ID: ${sensor_id}`);
  console.log(`  Public Key: ${public_key.substring(0, 16)}...`);
  console.log(`  NFT Policy: ${nft_policy_id || 'NOT SET'}`);
  console.log(`  NFT Asset: ${nft_asset_name || 'NOT SET'}`);
  console.log(`  Script Address: ${script_address || 'NOT SET'}`);

  try {
    // Validate public key format (64 chars hex for Ed25519)
    if (!/^[0-9A-Fa-f]{64}$/.test(public_key)) {
      console.error('\n❌ Invalid public key format (must be 64 hex characters for Ed25519)');
      process.exit(1);
    }

    // Check if sensor exists
    const existing = await prisma.sensor.findUnique({
      where: { sensor_id }
    });

    if (existing) {
      console.log('\n🔄 Sensor exists, updating configuration...');

      const updated = await prisma.sensor.update({
        where: { sensor_id },
        data: {
          public_key,
          nft_policy_id: nft_policy_id || existing.nft_policy_id,
          nft_asset_name: nft_asset_name || existing.nft_asset_name,
          script_address: script_address || existing.script_address,
          updated_at: new Date()
        }
      });

      console.log('\n✅ Sensor updated successfully!');
      console.log(`   ID: ${updated.id}`);
    } else {
      console.log('\n✨ Creating new sensor...');

      const created = await prisma.sensor.create({
        data: {
          sensor_id,
          public_key,
          nft_policy_id: nft_policy_id || null,
          nft_asset_name: nft_asset_name || null,
          script_address: script_address || null,
          name: `Sensor ${sensor_id}`,
          is_active: true
        }
      });

      console.log('\n✅ Sensor created successfully!');
      console.log(`   ID: ${created.id}`);
    }

    console.log('\n💡 Next steps:');
    if (!nft_policy_id || !nft_asset_name) {
      console.log(`   1. Mint NFT: npm run oracle:mint-nft -- ${sensor_id}`);
      console.log(`   2. Update sensor with NFT info: npm run db:register-sensor -- ${sensor_id} ${public_key} <policy_id> <asset_name>`);
    }
    if (!script_address) {
      console.log(`   3. Create oracle: npm run oracle:create -- <nft_policy_id> <nft_asset_name>`);
      console.log(`   4. Update sensor with script address`);
    }
    console.log('   5. Enable auto-submission in .env: ORACLE_AUTO_SUBMIT=true');

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
