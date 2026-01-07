import crypto from 'crypto';
import pkg from 'elliptic';
const { ec: EC } = pkg;

const ec = new EC('secp256k1');

// Función para construir mensaje
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
const hashHex = hash.toString('hex');

// Generar par de claves ECDSA secp256k1
const keyPair = ec.genKeyPair();

// Firmar el hash
const signature = keyPair.sign(hash);

// Obtener r y s de la firma (cada uno es 32 bytes = 64 chars hex)
const r = signature.r.toString('hex').padStart(64, '0');
const s = signature.s.toString('hex').padStart(64, '0');
const signatureHex = r + s;  // 128 caracteres hex total

// Obtener clave pública (64 bytes sin el prefijo)
const publicKeyHex = keyPair.getPublic('hex').substring(2);  // Remover prefijo '04'

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
