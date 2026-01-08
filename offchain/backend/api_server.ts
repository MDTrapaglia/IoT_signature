import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { prisma } from './config/prisma.js';
import { measurementService } from './services/measurement.service.js';
import { sensorService } from './services/sensor.service.js';
import { oracleSubmissionService } from './services/oracle-submission.service.js';
import { txMonitorService } from './services/tx-monitor.service.js';
import { buildMessage, verifyHash, calculateHash } from './utils/message-builder.js';
import { verifyEd25519Signature } from './utils/signature-verification.js';
import type { ArduinoPayload } from './types/index.js';

const app = express();
const PORT = 3001;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN || 'c90e31d3f88c8851687014fa69a601fb65717449a3d07a50bd84ee75046fb885';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://192.168.100.200:3000';

// Rate limiting: 100 requests por 15 minutos por IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 requests por ventana
  message: { error: 'Not Found' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
// Permitir múltiples orígenes para desarrollo
app.use(cors({
  origin: function(origin, callback) {
    // Permitir requests sin origin (como Postman, curl, ESP32)
    if (!origin) return callback(null, true);

    // Permitir el frontend configurado y variaciones comunes
    const allowedOrigins = [
      FRONTEND_URL,
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://192.168.100.200:3000',
      'http://186.123.164.151:3000'
    ];

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(null, true); // En desarrollo, permitir todos los orígenes
    }
  },
  credentials: true
}));
app.use(express.json({ limit: '10kb' })); // Limita tamaño de payload
app.use(limiter);

// Middleware de autenticación por token
// Retorna 404 para ocultar la existencia del endpoint
function validateToken(req: Request, res: Response, next: NextFunction) {
  const token = req.query.token || req.headers['x-access-token'];

  if (token !== ACCESS_TOKEN) {
    return res.status(404).json({ error: 'Not Found' });
  }

  next();
}

// 2. RUTA POST: Aquí es donde el Arduino "empuja" los datos
app.post('/api/ingest', validateToken, async (req: Request, res: Response) => {
  const payload: ArduinoPayload = req.body;

  // Validación básica
  if (!payload.signature || !payload.hash || !payload.publicKey || !payload.sensor_id) {
    return res.status(400).json({ error: "Faltan datos requeridos (sensor_id, hash, signature, publicKey)" });
  }

  // Validar formato hexadecimal
  const hexRegex = /^[0-9A-Fa-f]+$/;

  if (!hexRegex.test(payload.hash) || payload.hash.length !== 64) {
    return res.status(400).json({ error: "Hash inválido (debe ser 64 caracteres hex)" });
  }

  if (!hexRegex.test(payload.signature) || payload.signature.length !== 128) {
    return res.status(400).json({ error: "Signature inválida (debe ser 128 caracteres hex para Ed25519)" });
  }

  if (!hexRegex.test(payload.publicKey) || payload.publicKey.length !== 64) {
    return res.status(400).json({ error: "PublicKey inválida (debe ser 64 caracteres hex para Ed25519)" });
  }

  // Construir mensaje a partir de los campos (ordenados alfabéticamente)
  const message = buildMessage(payload);
  const messageHex = message.toString('hex');

  console.log(`📥 Datos recibidos del sensor ${payload.sensor_id}`);
  console.log(`   Mensaje construido: ${messageHex.substring(0, 32)}...`);
  if (payload.temperature !== undefined) console.log(`   Temperatura: ${payload.temperature}°C`);
  if (payload.humidity !== undefined) console.log(`   Humedad: ${payload.humidity}%`);
  if (payload.timestamp) console.log(`   Timestamp medición: ${new Date(payload.timestamp).toISOString()}`);
  console.log(`   Hash provisto: ${payload.hash.substring(0, 16)}...`);
  console.log(`   Signature: ${payload.signature.substring(0, 16)}...`);

  // Verificar que el hash corresponda al mensaje
  if (!verifyHash(message, payload.hash)) {
    const calculatedHash = calculateHash(message);
    console.log(`❌ Hash no corresponde al mensaje para sensor ${payload.sensor_id}`);
    console.log(`   Hash calculado: ${calculatedHash.substring(0, 16)}...`);
    console.log(`   Hash provisto:  ${payload.hash.substring(0, 16)}...`);
    return res.status(400).json({
      status: "error",
      error: "El hash no corresponde al mensaje proporcionado",
      verified: false,
      expected_hash: calculatedHash,
      provided_hash: payload.hash,
      message: messageHex
    });
  }

  // Verificar firma Ed25519
  // IMPORTANTE: Ed25519 firma el HASH SHA-256 del mensaje (no el mensaje completo)
  // Esto evita problemas con mensajes que contienen bytes nulos
  // Debe coincidir con lo que espera el smart contract sensor_oracle_ed25519.ak
  const messageHash = Buffer.from(payload.hash, 'hex');
  const isValid = verifyEd25519Signature(messageHash, payload.signature, payload.publicKey);

  if (!isValid) {
    console.log(`❌ Firma Ed25519 inválida para sensor ${payload.sensor_id}`);

    // Guardar medición con verified: false
    const measurement = await measurementService.create({
      ...payload,
      message: messageHex,
      verified: false,
      received_timestamp: Date.now()
    });

    console.log(`💾 Saved invalid measurement ${measurement.id} for sensor ${payload.sensor_id}`);

    return res.status(401).json({
      status: "error",
      error: "Firma Ed25519 inválida",
      verified: false
    });
  }

  console.log(`✅ Firma Ed25519 válida para sensor ${payload.sensor_id}`);

  // Guardar medición con verified: true
  const measurement = await measurementService.create({
    ...payload,
    message: messageHex,
    verified: true,
    received_timestamp: Date.now()
  });

  console.log(`💾 Saved measurement ${measurement.id} for sensor ${payload.sensor_id}`);

  res.status(201).json({
    status: "success",
    message: "Firma verificada. Dato pendiente de certificación en Cardano",
    verified: true,
    measurement_id: measurement.id
  });
});

// 3. RUTA GET: Para que el Frontend consulte los datos
app.get('/api/measurements', validateToken, async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 100;
  const sensor_id = req.query.sensor_id as string;

  let measurements;

  if (sensor_id) {
    measurements = await measurementService.getRecent(sensor_id, limit);
  } else {
    measurements = await measurementService.getAll(page, limit);
  }

  // Serializar BigInt a string para JSON
  const serialized = measurements.map(m => ({
    ...m,
    timestamp: m.timestamp ? m.timestamp.toString() : null
  }));

  res.json(serialized);
});

// 4. RUTA GET: Lista de sensores activos
app.get('/api/sensors', validateToken, async (req: Request, res: Response) => {
  const sensors = await sensorService.listActive();
  res.json(sensors);
});

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`🌐 API Rest activa en http://0.0.0.0:${PORT}`);
  console.log(`📡 Esperando datos en POST /api/ingest`);
  console.log(`🔗 Accesible desde la red en http://186.123.164.151:${PORT}`);

  // Test database connection
  try {
    await prisma.$connect();
    console.log(`✅ Database connected`);
  } catch (error) {
    console.error(`❌ Database connection failed:`, error);
    console.error(`💡 Make sure PostgreSQL is running: docker-compose up -d`);
    process.exit(1);
  }

  // Start services
  if (process.env.ORACLE_AUTO_SUBMIT === 'true') {
    oracleSubmissionService.start();
  }

  txMonitorService.start();
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');

  oracleSubmissionService.stop();
  txMonitorService.stop();

  await prisma.$disconnect();
  process.exit(0);
});

