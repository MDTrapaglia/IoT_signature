/**
 * ESP32 Sensor Data Signing with Ed25519
 *
 * Este sketch lee datos de sensores (temperatura y humedad), los firma
 * con Ed25519 y los envía al servidor Cardano Oracle.
 *
 * Requisitos:
 * - ESP32 Dev Board
 * - Librería: Ed25519 by Oryx Embedded
 *   Arduino IDE: Tools → Manage Libraries → Search "Ed25519" → Install "Ed25519 by Oryx Embedded"
 *
 * Autor: ESP32 Cardano Oracle Project
 * Fecha: 2026-01-07
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include "Ed25519.h"  // Ed25519 by Oryx Embedded

// ============================================================================
// Configuración WiFi
// ============================================================================
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// ============================================================================
// Configuración del Servidor Oracle
// ============================================================================
const char* serverUrl = "http://YOUR_SERVER_IP:3001/api/ingest";

// ============================================================================
// Configuración del Sensor
// ============================================================================
const char* sensorId = "ESP32_001";  // ID único del sensor

// ============================================================================
// Claves Ed25519
// ============================================================================
// IMPORTANTE: En producción, generar estas claves una sola vez y almacenarlas
// de forma segura (EEPROM, flash, etc.). NO hardcodear en el código.

// Clave privada Ed25519 (32 bytes) - EJEMPLO DE PRUEBA
uint8_t privateKey[32] = {
    0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
    0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f,
    0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17,
    0x18, 0x19, 0x1a, 0x1b, 0x1c, 0x1d, 0x1e, 0x1f
};

// Clave pública Ed25519 (32 bytes) - Se deriva de la privada
uint8_t publicKey[32];

// ============================================================================
// Funciones Auxiliares
// ============================================================================

/**
 * Convierte un número de 64 bits a array de 8 bytes big-endian
 * Coincide con el formato usado en Aiken y TypeScript
 */
void int64ToBytesBigEndian(int64_t value, uint8_t* bytes) {
    bytes[0] = (value >> 56) & 0xFF;
    bytes[1] = (value >> 48) & 0xFF;
    bytes[2] = (value >> 40) & 0xFF;
    bytes[3] = (value >> 32) & 0xFF;
    bytes[4] = (value >> 24) & 0xFF;
    bytes[5] = (value >> 16) & 0xFF;
    bytes[6] = (value >> 8) & 0xFF;
    bytes[7] = value & 0xFF;
}

/**
 * Convierte array de bytes a string hexadecimal
 */
String bytesToHex(const uint8_t* bytes, size_t length) {
    String hexString = "";
    for (size_t i = 0; i < length; i++) {
        if (bytes[i] < 0x10) hexString += "0";
        hexString += String(bytes[i], HEX);
    }
    hexString.toUpperCase();
    return hexString;
}

/**
 * Construye el mensaje para firmar según el formato del oracle
 * Formato: humidity_bytes || sensor_id || temperature_bytes || timestamp_bytes
 * Orden alfabético de los campos
 */
size_t buildMessage(int temperature, int humidity, int64_t timestamp,
                    const char* sensorId, uint8_t* message) {
    size_t offset = 0;

    // 1. Humidity (8 bytes big-endian)
    int64_t humidityInt64 = (int64_t)humidity;
    int64ToBytesBigEndian(humidityInt64, message + offset);
    offset += 8;

    // 2. Sensor ID (longitud variable)
    size_t sensorIdLen = strlen(sensorId);
    memcpy(message + offset, sensorId, sensorIdLen);
    offset += sensorIdLen;

    // 3. Temperature (8 bytes big-endian)
    int64_t temperatureInt64 = (int64_t)temperature;
    int64ToBytesBigEndian(temperatureInt64, message + offset);
    offset += 8;

    // 4. Timestamp (8 bytes big-endian)
    int64ToBytesBigEndian(timestamp, message + offset);
    offset += 8;

    return offset;  // Retorna la longitud total del mensaje
}

/**
 * Lee datos de los sensores
 * NOTA: Reemplazar con lectura real de sensores (DHT22, BME280, etc.)
 */
void readSensors(int* temperature, int* humidity) {
    // EJEMPLO: Valores simulados
    // En producción, reemplazar con:
    // - dht.readTemperature() * 10 para DHT22
    // - bme.readTemperature() * 10 para BME280

    *temperature = 235;  // 23.5°C
    *humidity = 652;     // 65.2%

    // Para simular variación:
    *temperature += random(-5, 5);
    *humidity += random(-10, 10);
}

/**
 * Obtiene el timestamp actual en milisegundos
 */
int64_t getCurrentTimestamp() {
    // En producción, usar NTP para sincronizar tiempo
    // Por ahora, usamos millis() desde el boot
    return (int64_t)millis();
}

/**
 * Firma los datos del sensor con Ed25519
 */
bool signSensorData(int temperature, int humidity, int64_t timestamp,
                    uint8_t* signature) {
    // Construir mensaje
    uint8_t message[256];  // Buffer suficiente para el mensaje
    size_t messageLen = buildMessage(temperature, humidity, timestamp,
                                     sensorId, message);

    // Firmar con Ed25519
    Ed25519Context context;
    error_t error = ed25519GenerateSignature(&context, privateKey, publicKey,
                                             message, messageLen, NULL, 0,
                                             0, signature);

    if (error != NO_ERROR) {
        Serial.println("❌ Error al firmar datos");
        return false;
    }

    return true;
}

/**
 * Envía los datos firmados al servidor
 */
bool sendDataToServer(int temperature, int humidity, int64_t timestamp,
                      const String& signatureHex, const String& publicKeyHex) {
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("❌ WiFi no conectado");
        return false;
    }

    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");

    // Construir JSON payload
    String payload = "{";
    payload += "\"sensor_id\":\"" + String(sensorId) + "\",";
    payload += "\"temperature\":" + String(temperature) + ",";
    payload += "\"humidity\":" + String(humidity) + ",";
    payload += "\"timestamp\":" + String((long long)timestamp) + ",";
    payload += "\"signature\":\"" + signatureHex + "\",";
    payload += "\"publicKey\":\"" + publicKeyHex + "\"";
    payload += "}";

    Serial.println("\n📤 Enviando datos:");
    Serial.println(payload);

    int httpResponseCode = http.POST(payload);

    if (httpResponseCode > 0) {
        String response = http.getString();
        Serial.println("✅ Respuesta del servidor (" + String(httpResponseCode) + "):");
        Serial.println(response);
        http.end();
        return true;
    } else {
        Serial.println("❌ Error al enviar: " + String(httpResponseCode));
        http.end();
        return false;
    }
}

// ============================================================================
// Setup
// ============================================================================
void setup() {
    Serial.begin(115200);
    delay(1000);

    Serial.println("\n" + String('=', 60));
    Serial.println("ESP32 Sensor Oracle con Ed25519");
    Serial.println(String('=', 60));

    // Generar clave pública a partir de la privada
    Serial.println("\n🔑 Generando clave pública Ed25519...");
    Ed25519Context context;
    error_t error = ed25519GeneratePublicKey(&context, privateKey, publicKey);

    if (error != NO_ERROR) {
        Serial.println("❌ Error al generar clave pública");
        while(1);  // Detener ejecución
    }

    String publicKeyHex = bytesToHex(publicKey, 32);
    Serial.println("✅ Clave pública: " + publicKeyHex);

    // Conectar a WiFi
    Serial.println("\n📡 Conectando a WiFi...");
    WiFi.begin(ssid, password);

    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20) {
        delay(500);
        Serial.print(".");
        attempts++;
    }

    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("\n✅ WiFi conectado!");
        Serial.println("IP: " + WiFi.localIP().toString());
    } else {
        Serial.println("\n❌ No se pudo conectar a WiFi");
        while(1);  // Detener ejecución
    }

    Serial.println("\n✅ Sistema inicializado");
    Serial.println("Sensor ID: " + String(sensorId));
    Serial.println("Server URL: " + String(serverUrl));
}

// ============================================================================
// Loop Principal
// ============================================================================
void loop() {
    static unsigned long lastReading = 0;
    const unsigned long READING_INTERVAL = 60000;  // 60 segundos

    if (millis() - lastReading >= READING_INTERVAL) {
        lastReading = millis();

        Serial.println("\n" + String('=', 60));
        Serial.println("📊 Nueva lectura de sensores");
        Serial.println(String('=', 60));

        // 1. Leer sensores
        int temperature, humidity;
        readSensors(&temperature, &humidity);

        Serial.println("Temperatura: " + String(temperature / 10.0, 1) + "°C");
        Serial.println("Humedad: " + String(humidity / 10.0, 1) + "%");

        // 2. Obtener timestamp
        int64_t timestamp = getCurrentTimestamp();
        Serial.println("Timestamp: " + String((long long)timestamp));

        // 3. Firmar datos
        Serial.println("\n🔏 Firmando datos con Ed25519...");
        uint8_t signature[64];  // Ed25519 produce firmas de 64 bytes

        if (!signSensorData(temperature, humidity, timestamp, signature)) {
            Serial.println("❌ Error en la firma");
            return;
        }

        String signatureHex = bytesToHex(signature, 64);
        String publicKeyHex = bytesToHex(publicKey, 32);

        Serial.println("✅ Firma generada");
        Serial.println("Signature: " + signatureHex.substring(0, 32) + "...");
        Serial.println("Public Key: " + publicKeyHex.substring(0, 32) + "...");

        // 4. Enviar al servidor
        if (sendDataToServer(temperature, humidity, timestamp,
                            signatureHex, publicKeyHex)) {
            Serial.println("\n✅ Datos enviados exitosamente");
        } else {
            Serial.println("\n❌ Error al enviar datos");
        }
    }

    delay(100);  // Pequeño delay para no saturar la CPU
}
