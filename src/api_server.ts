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
const ACCESS_TOKEN = process.env.ACCESS_TOKEN || 'gaelito2025';

// Rate limiting: 100 requests por 15 minutos por IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 requests por ventana
  message: { error: 'Not Found' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
app.use(cors());
app.use(express.json());
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
  if (!payload.signature || !payload.hash || !payload.publicKey) {
    return res.status(400).json({ error: "Faltan datos: hash, signature o publicKey" });
  }

  console.log(`📥 Datos recibidos del sensor ${payload.sensor_id}`);
  console.log(`   Hash: ${payload.hash.substring(0, 16)}...`);
  console.log(`   Signature: ${payload.signature.substring(0, 16)}...`);

  // Verificar firma ECDSA
  const isValid = verifySignature(payload.hash, payload.signature, payload.publicKey);

  if (!isValid) {
    console.log(`❌ Firma inválida para sensor ${payload.sensor_id}`);
    return res.status(401).json({
      status: "error",
      error: "Firma ECDSA inválida"
    });
  }

  console.log(`✅ Firma válida para sensor ${payload.sensor_id}`);
  measurementsHistory.push(payload);

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

app.listen(PORT, () => {
  console.log(`🌐 API Rest activa en http://localhost:${PORT}`);
  console.log(`📡 Esperando datos en POST /api/ingest`);
});

