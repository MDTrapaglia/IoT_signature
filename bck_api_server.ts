import express = require('express');

// 1. Definimos una "Interface" (Puro TypeScript)
// Esto asegura que si el Arduino no envía la firma, el código lo sepa de inmediato.
interface ArduinoPayload {
  sensor_id: string;
  value: number;
  signature: string;
  publicKey: string;
}

const app = express();
const PORT = 3001; // Usamos un puerto distinto al anterior

// Middleware para que Express pueda leer el cuerpo (body) de las peticiones POST
app.use(express.json());

// Base de datos temporal (Array)
let measurementsHistory: ArduinoPayload[] = [];

// 2. RUTA POST: Aquí es donde el Arduino "empuja" los datos
app.post('/api/ingest', (req: express.Request, res: express.Response) => {
  const payload: ArduinoPayload = req.body;

  // Validación básica
  if (!payload.signature || !payload.value) {
    return res.status(400).json({ error: "Faltan datos o firma criptográfica" });
  }

  console.log(`📥 Datos recibidos del sensor ${payload.sensor_id}: ${payload.value}`);
  
  // En el futuro, aquí iría la lógica de:
  // 1. Verificar firma con TweetNaCl
  // 2. Guardar en PostgreSQL con Prisma
  
  measurementsHistory.push(payload);

  // Respondemos al Arduino que todo salió bien
  res.status(201).json({
    status: "success",
    message: "Dato recibido y pendiente de certificación en Cardano"
  });
});

// 3. RUTA GET: Para que el Frontend consulte los datos
app.get('/api/measurements', (req: express.Request, res: express.Response) => {
  res.json(measurementsHistory);
});

app.listen(PORT, () => {
  console.log(`🌐 API Rest activa en http://localhost:${PORT}`);
  console.log(`📡 Esperando datos en POST /api/ingest`);
});

