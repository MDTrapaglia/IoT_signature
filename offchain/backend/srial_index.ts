import express, { Request, Response } from 'express';
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';

// 1. Inicialización de Express (El Servidor)
const app = express();
const PORT = 3000;

// Middleware para entender JSON (necesario para el Frontend)
app.use(express.json());

// 2. Configuración del Puerto Serie (El enlace con Arduino)
// NOTA: Cambia 'COM3' por el puerto donde esté tu Arduino (ej. /dev/ttyUSB0 en Linux)
const arduinoPath = 'COM3'; 
const port = new SerialPort({ path: arduinoPath, baudRate: 9600 });
const parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

// Variable temporal para guardar la última medición (luego usaremos la DB)
let lastMeasurement: any = null;

// 3. Evento: Escuchando al Arduino
parser.on('data', (data: string) => {
    try {
        const parsedData = JSON.parse(data);
        console.log("Dato recibido y firmado:", parsedData);
        lastMeasurement = {
            ...parsedData,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error("Error al parsear dato del Arduino:", data);
    }
});

// 4. Ruta de Express (La API para el Frontend)
app.get('/api/status', (req: Request, res: Response) => {
    res.json({
        msg: "Servidor activo",
        arduinoConnected: port.isOpen,
        latestData: lastMeasurement
    });
});

// 5. Encender el servidor
app.listen(PORT, () => {
    console.log(`🚀 Backend corriendo en http://localhost:${PORT}`);
    console.log(`🔌 Escuchando Arduino en el puerto ${arduinoPath}`);
});

