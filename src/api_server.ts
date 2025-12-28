import express, { type Request, type Response } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import elliptic from 'elliptic';

const EC = elliptic.ec;
const ec = new EC('secp256k1'); // Curva secp256k1 (Bitcoin/Ethereum)

interface ArduinoPayload {
  sensor_id: string;
  hash: string;        // SHA-256 hash del mensaje (hex)
  signature: string;   // Firma ECDSA (r+s, 64 bytes hex)
  publicKey: string;   // Clave pública (x+y, 64 bytes hex)
  verified?: boolean;  // Si la firma fue verificada exitosamente
}

// Verifica firma ECDSA
function verifySignature(hash: string, signature: string, publicKey: string): boolean {
  try {
    // Agregar prefijo 04 para indicar clave pública sin comprimir
    const pubKeyWithPrefix = '04' + publicKey.toLowerCase();
    const key = ec.keyFromPublic(pubKeyWithPrefix, 'hex');

    // Dividir firma en r y s (cada uno 32 bytes = 64 hex chars)
    const r = signature.substring(0, 64).toLowerCase();
    const s = signature.substring(64, 128).toLowerCase();

    return key.verify(hash.toLowerCase(), { r, s });
  } catch (error) {
    console.error('Error verificando firma:', error);
    return false;
  }
}

const app = express();
const PORT = 3001;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN || 'c90e31d3f88c8851687014fa69a601fb65717449a3d07a50bd84ee75046fb885';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://192.168.100.200:3000';
const MAX_MEASUREMENTS = 1000; // Máximo de mediciones en memoria

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
function validateToken(req: Request, res: Response, next: any) {
  const token = req.query.token || req.headers['x-access-token'];

  if (token !== ACCESS_TOKEN) {
    return res.status(404).json({ error: 'Not Found' });
  }

  next();
}

// Base de datos temporal (Array)
let measurementsHistory: ArduinoPayload[] = [];

// 2. RUTA POST: Aquí es donde el Arduino "empuja" los datos
app.post('/api/ingest', validateToken, (req: Request, res: Response) => {
  const payload: ArduinoPayload = req.body;

  // Validación básica
  if (!payload.signature || !payload.hash || !payload.publicKey || !payload.sensor_id) {
    return res.status(400).json({ error: "Faltan datos requeridos" });
  }

  // Validar formato hexadecimal
  const hexRegex = /^[0-9A-Fa-f]+$/;

  if (!hexRegex.test(payload.hash) || payload.hash.length !== 64) {
    return res.status(400).json({ error: "Hash inválido (debe ser 64 caracteres hex)" });
  }

  if (!hexRegex.test(payload.signature) || payload.signature.length !== 128) {
    return res.status(400).json({ error: "Signature inválida (debe ser 128 caracteres hex)" });
  }

  if (!hexRegex.test(payload.publicKey) || payload.publicKey.length !== 128) {
    return res.status(400).json({ error: "PublicKey inválida (debe ser 128 caracteres hex)" });
  }

  console.log(`📥 Datos recibidos del sensor ${payload.sensor_id}`);
  console.log(`   Hash: ${payload.hash.substring(0, 16)}...`);
  console.log(`   Signature: ${payload.signature.substring(0, 16)}...`);

  // Verificar firma ECDSA
  const isValid = verifySignature(payload.hash, payload.signature, payload.publicKey);

  if (!isValid) {
    console.log(`❌ Firma inválida para sensor ${payload.sensor_id}`);

    // Guardar medición con verified: false
    measurementsHistory.push({
      ...payload,
      verified: false
    });

    // Mantener solo las últimas MAX_MEASUREMENTS mediciones
    if (measurementsHistory.length > MAX_MEASUREMENTS) {
      measurementsHistory = measurementsHistory.slice(-MAX_MEASUREMENTS);
    }

    return res.status(401).json({
      status: "error",
      error: "Firma ECDSA inválida",
      verified: false
    });
  }

  console.log(`✅ Firma válida para sensor ${payload.sensor_id}`);

  // Agregar nueva medición con verified: true
  measurementsHistory.push({
    ...payload,
    verified: true
  });

  // Mantener solo las últimas MAX_MEASUREMENTS mediciones
  if (measurementsHistory.length > MAX_MEASUREMENTS) {
    measurementsHistory = measurementsHistory.slice(-MAX_MEASUREMENTS);
  }

  res.status(201).json({
    status: "success",
    message: "Firma verificada. Dato pendiente de certificación en Cardano",
    verified: true
  });
});

// 3. RUTA GET: Para que el Frontend consulte los datos
app.get('/api/measurements', validateToken, (req: Request, res: Response) => {
  res.json(measurementsHistory);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 API Rest activa en http://0.0.0.0:${PORT}`);
  console.log(`📡 Esperando datos en POST /api/ingest`);
  console.log(`🔗 Accesible desde la red en http://186.123.164.151:${PORT}`);
});

