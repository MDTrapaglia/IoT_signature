import crypto from "crypto"
import fs from "fs"

// Construye el mensaje binario que será firmado (IGUAL que en Aiken)
// Orden alfabético: humidity || sensor_id || temperature || timestamp
// Los enteros se codifican como 8 bytes big-endian
function buildMessage(sensor_id: string, temperature: number, humidity: number, timestamp: number): Buffer {
    const humidityBytes = Buffer.alloc(8);
    humidityBytes.writeBigInt64BE(BigInt(humidity));

    const temperatureBytes = Buffer.alloc(8);
    temperatureBytes.writeBigInt64BE(BigInt(temperature));

    const timestampBytes = Buffer.alloc(8);
    timestampBytes.writeBigInt64BE(BigInt(timestamp));

    const sensorIdBytes = Buffer.from(sensor_id, 'utf8');

    return Buffer.concat([
        humidityBytes,
        sensorIdBytes,
        temperatureBytes,
        timestampBytes
    ]);
}

// Leer payload de prueba
const payload = JSON.parse(fs.readFileSync('/tmp/new_payload.json', 'utf-8'));

console.log("=".repeat(70))
console.log("Verificación de Construcción de Mensaje")
console.log("=".repeat(70))

console.log("\n📋 Datos del Payload:")
console.log(`  sensor_id: "${payload.sensor_id}"`)
console.log(`  temperature: ${payload.temperature}`)
console.log(`  humidity: ${payload.humidity}`)
console.log(`  timestamp: ${payload.timestamp}`)
console.log(`  hash (esperado): ${payload.hash}`)

// Construir mensaje
const message = buildMessage(
    payload.sensor_id,
    payload.temperature,
    payload.humidity,
    payload.timestamp
);

console.log("\n🔨 Construcción del Mensaje:")
console.log(`  Message length: ${message.length} bytes`)
console.log(`  Message hex: ${message.toString('hex')}`)

// Calcular hash
const messageHash = crypto.createHash('sha256').update(message).digest();
const hashHex = messageHash.toString('hex');

console.log("\n🔐 Hash SHA-256:")
console.log(`  Calculado: ${hashHex}`)
console.log(`  Esperado:  ${payload.hash}`)

if (hashHex.toLowerCase() === payload.hash.toLowerCase()) {
    console.log("\n✅ SUCCESS: Los hashes coinciden perfectamente!")
    console.log("   La construcción del mensaje en TypeScript es CORRECTA")
} else {
    console.log("\n❌ ERROR: Los hashes NO coinciden!")
    console.log("   Hay un problema en la construcción del mensaje")

    // Debug: mostrar bytes individuales
    console.log("\n🔍 Debug - Componentes del Mensaje:")

    const humidityBytes = Buffer.alloc(8);
    humidityBytes.writeBigInt64BE(BigInt(payload.humidity));
    console.log(`  humidity (${payload.humidity}):`)
    console.log(`    hex: ${humidityBytes.toString('hex')}`)
    console.log(`    bytes: [${Array.from(humidityBytes).join(', ')}]`)

    const sensorIdBytes = Buffer.from(payload.sensor_id, 'utf-8');
    console.log(`  sensor_id ("${payload.sensor_id}"):`)
    console.log(`    hex: ${sensorIdBytes.toString('hex')}`)
    console.log(`    bytes: [${Array.from(sensorIdBytes).join(', ')}]`)

    const temperatureBytes = Buffer.alloc(8);
    temperatureBytes.writeBigInt64BE(BigInt(payload.temperature));
    console.log(`  temperature (${payload.temperature}):`)
    console.log(`    hex: ${temperatureBytes.toString('hex')}`)
    console.log(`    bytes: [${Array.from(temperatureBytes).join(', ')}]`)

    const timestampBytes = Buffer.alloc(8);
    timestampBytes.writeBigInt64BE(BigInt(payload.timestamp));
    console.log(`  timestamp (${payload.timestamp}):`)
    console.log(`    hex: ${timestampBytes.toString('hex')}`)
    console.log(`    bytes: [${Array.from(timestampBytes).join(', ')}]`)

    process.exit(1);
}

console.log("\n" + "=".repeat(70))
