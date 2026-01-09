# ESP32 con Ed25519 - Guía de Instalación

## 📋 Requisitos

### Hardware
- ESP32 Dev Board (cualquier modelo)
- Sensor de temperatura y humedad (opcional para pruebas):
  - DHT22
  - BME280
  - O simulación de datos (incluida en el código)

### Software
- Arduino IDE 2.x o superior
- ESP32 Board Support instalado

## 🔧 Instalación de Librerías

### 1. CycloneCRYPTO (Ed25519 + SHA-256)

**IMPORTANTE**: El sketch necesita tanto Ed25519 como SHA-256 de la misma librería.

**Opción A: Desde Arduino IDE (Recomendado)**

1. Abrir Arduino IDE
2. Ir a `Tools` → `Manage Libraries...`
3. Buscar: **"CycloneCRYPTO"**
4. Instalar: **"CycloneCRYPTO by Oryx Embedded"**

Esta librería incluye:
- `Ed25519.h` - Firmas Ed25519
- `Sha256.h` - Hash SHA-256

**Opción B: Manual**

```bash
cd ~/Arduino/libraries/
git clone https://github.com/Oryx-Embedded/CycloneCRYPTO.git
```

### 2. Librería WiFi (Ya incluida en ESP32)

No requiere instalación adicional.

### 3. Librería HTTPClient (Ya incluida en ESP32)

No requiere instalación adicional.

## 📝 Configuración del Sketch

### 1. Editar Credenciales WiFi

```cpp
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
```

### 2. Configurar URL del Servidor

```cpp
const char* serverUrl = "http://YOUR_SERVER_IP:3001/api/ingest";
```

Ejemplo:
```cpp
const char* serverUrl = "http://192.168.1.100:3001/api/ingest";
```

### 3. Configurar Sensor ID

```cpp
const char* sensorId = "ESP32_001";
```

### 4. (Opcional) Configurar Lectura de Sensores

Si tienes un sensor físico (DHT22, BME280, etc.):

```cpp
// Para DHT22:
#include <DHT.h>
#define DHTPIN 4
#define DHTTYPE DHT22
DHT dht(DHTPIN, DHTTYPE);

void readSensors(int* temperature, int* humidity) {
    float temp = dht.readTemperature();
    float hum = dht.readHumidity();

    *temperature = (int)(temp * 10);  // Convertir a formato *10
    *humidity = (int)(hum * 10);
}
```

## 🚀 Compilación y Carga

### 1. Abrir el Sketch

```
File → Open → sign_device_ed25519.ino
```

### 2. Seleccionar Board

```
Tools → Board → ESP32 Arduino → ESP32 Dev Module
```

### 3. Seleccionar Puerto

```
Tools → Port → /dev/ttyUSB0  (o el puerto correspondiente)
```

### 4. Compilar y Cargar

```
Sketch → Upload
```

O presionar `Ctrl+U` (Windows/Linux) / `Cmd+U` (Mac)

## 📊 Monitor Serial

### Abrir Monitor Serial

```
Tools → Serial Monitor
```

O presionar `Ctrl+Shift+M`

### Configurar Velocidad

Seleccionar **115200 baud**

### Salida Esperada

```
============================================================
ESP32 Sensor Oracle con Ed25519
============================================================

🔑 Generando clave pública Ed25519...
✅ Clave pública: 6FA3B72581FAA32ED33A5794D03C4F5CDA8992E1DB476A577B190475DD51AE98

📡 Conectando a WiFi...
✅ WiFi conectado!
IP: 192.168.1.150

✅ Sistema inicializado
Sensor ID: ESP32_001
Server URL: http://192.168.1.100:3001/api/ingest

============================================================
📊 Nueva lectura de sensores
============================================================
Temperatura: 23.5°C
Humedad: 65.2%
Timestamp: 123456789

🔏 Firmando datos con Ed25519...
✅ Firma generada
Signature: 50A580957B5F2DF38F34C26D28B391...
Public Key: 6FA3B72581FAA32ED33A5794D03C4F...

📤 Enviando datos:
{"sensor_id":"ESP32_001","temperature":235,"humidity":652,...}

✅ Respuesta del servidor (200):
{"success":true,"verified":true}

✅ Datos enviados exitosamente
```

## 🔐 Gestión de Claves

### Generar Nuevas Claves

**IMPORTANTE:** Las claves en el código son de ejemplo. En producción:

1. **Generar claves una sola vez:**

```cpp
// En setup(), una sola vez:
Ed25519Context context;
uint8_t privateKey[32];
uint8_t publicKey[32];

// Generar clave privada aleatoria
for (int i = 0; i < 32; i++) {
    privateKey[i] = random(0, 256);
}

// Derivar clave pública
ed25519GeneratePublicKey(&context, privateKey, publicKey);

// Guardar en EEPROM/Flash
EEPROM.write(0, privateKey, 32);
```

2. **Almacenar de forma segura:**

- EEPROM del ESP32
- Flash NVS (Non-Volatile Storage)
- Chip de seguridad externo (ATECC608A)

3. **Nunca hardcodear en el código** (excepto para testing)

## 🧪 Testing

### Modo de Prueba con Datos Simulados

El código incluye simulación de datos por defecto:

```cpp
void readSensors(int* temperature, int* humidity) {
    *temperature = 235;  // 23.5°C
    *humidity = 652;     // 65.2%

    // Variación aleatoria para simular cambios
    *temperature += random(-5, 5);
    *humidity += random(-10, 10);
}
```

### Verificar Firma Localmente

Puedes verificar la firma usando Node.js:

```javascript
const nacl = require('tweetnacl');

const message = Buffer.from(/* mensaje construido */);
const signature = Buffer.from('firma_hex', 'hex');
const publicKey = Buffer.from('public_key_hex', 'hex');

const isValid = nacl.sign.detached.verify(message, signature, publicKey);
console.log('Firma válida:', isValid);
```

## 📐 Formato de Datos

### Estructura del Mensaje para Firma

```
mensaje = humidity_bytes || sensor_id || temperature_bytes || timestamp_bytes
```

**Orden alfabético de campos**

### Codificación

- **Enteros:** 8 bytes big-endian signed
- **Sensor ID:** UTF-8 bytes
- **Signature:** 64 bytes
- **Public Key:** 32 bytes (Ed25519)

### Ejemplo de Construcción

```
Humidity: 652 (65.2%)
  → Bytes: 00 00 00 00 00 00 02 8C

Sensor ID: "ESP32_001"
  → Bytes: 45 53 50 33 32 5F 30 30 31

Temperature: 235 (23.5°C)
  → Bytes: 00 00 00 00 00 00 00 EB

Timestamp: 123456789
  → Bytes: 00 00 00 00 07 5B CD 15

Mensaje completo: 30 bytes
00 00 00 00 00 00 02 8C 45 53 50 33 32 5F 30 30 31 00 00 00 00 00 00 00 EB 00 00 00 00 07 5B CD 15
```

## 🐛 Troubleshooting

### Error: Cannot find Ed25519.h

**Solución:** Instalar librería Ed25519 by Oryx Embedded

```
Tools → Manage Libraries → Search "Ed25519" → Install
```

### Error: WiFi no conecta

**Verificar:**
- SSID y password correctos
- Router accesible
- ESP32 dentro del rango WiFi

### Error: Servidor no responde

**Verificar:**
- Servidor backend corriendo (`npm run dev`)
- IP y puerto correctos en `serverUrl`
- Firewall no bloqueando puerto 3001

### Error: Firma inválida en servidor

**Verificar:**
- Construcción del mensaje coincide con TypeScript/Aiken
- Orden alfabético de campos
- Codificación big-endian correcta
- Public key coincide con la firma

## 📚 Referencias

- [Ed25519 Library](https://www.oryx-embedded.com/doc/crypto.html)
- [ESP32 Arduino Core](https://github.com/espressif/arduino-esp32)
- [TweetNaCl (JavaScript)](https://github.com/dchest/tweetnacl-js)
- [Aiken Documentation](https://aiken-lang.org/)

## 💡 Mejoras Futuras

- [ ] Sincronización de tiempo con NTP
- [ ] Almacenamiento seguro de claves en NVS
- [ ] Deep sleep entre lecturas para ahorrar energía
- [ ] Buffer de mensajes cuando no hay conexión
- [ ] OTA (Over-The-Air) updates
- [ ] Múltiples sensores
- [ ] Display OLED para mostrar status

---

**Última actualización:** 2026-01-07
