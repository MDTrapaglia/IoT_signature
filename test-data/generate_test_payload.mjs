import nacl from 'tweetnacl';
import crypto from 'crypto';

// Función para construir mensaje (igual que en update_oracle.ts y backend)
function buildMessage(sensorId, temperature, humidity, timestamp) {
    const humidityBytes = Buffer.alloc(8);
    humidityBytes.writeBigInt64BE(BigInt(humidity));

    const temperatureBytes = Buffer.alloc(8);
    temperatureBytes.writeBigInt64BE(BigInt(temperature));

    const timestampBytes = Buffer.alloc(8);
    timestampBytes.writeBigInt64BE(BigInt(timestamp));

    const sensorIdBytes = Buffer.from(sensorId, 'utf8');

    // Orden alfabético: humidity || sensor_id || temperature || timestamp
    return Buffer.concat([
        humidityBytes,
        sensorIdBytes,
        temperatureBytes,
        timestampBytes
    ]);
}

// Datos del sensor
const sensor_id = 'ESP32_TEST_001';
const temperature = 235;  // 23.5°C
const humidity = 652;     // 65.2%
const timestamp = Date.now();

// Construir mensaje
const message = buildMessage(sensor_id, temperature, humidity, timestamp);

// Calcular hash SHA-256 del mensaje
const hash = crypto.createHash('sha256').update(message).digest();

// Generar par de claves Ed25519
const keyPair = nacl.sign.keyPair();

// Firmar el HASH (no el mensaje completo)
const signature = nacl.sign.detached(hash, keyPair.secretKey);

// Convertir a hex
const hashHex = hash.toString('hex');
const signatureHex = Buffer.from(signature).toString('hex');
const publicKeyHex = Buffer.from(keyPair.publicKey).toString('hex');

// Crear payload para API
const payload = {
    sensor_id: sensor_id,
    temperature: temperature,
    humidity: humidity,
    timestamp: timestamp,
    hash: hashHex,
    signature: signatureHex,
    publicKey: publicKeyHex
};

// Output JSON
console.log(JSON.stringify(payload, null, 2));
