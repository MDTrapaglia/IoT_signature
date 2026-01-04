# Ejemplos de Integración

Scripts de ejemplo para enviar datos al backend desde diferentes lenguajes.

## Python - Envío de Datos con Firma ECDSA

### Instalación de dependencias

```bash
pip install ecdsa requests
```

### Uso

```bash
python send_sensor_data.py
```

### Configuración

Crea un archivo `sensor_config.json` en el directorio `examples/`:

```json
{
  "backend_url": "http://192.168.100.200:3001",
  "access_token": "c90e31d3f88c8851687014fa69a601fb65717449a3d07a50bd84ee75046fb885",
  "sensor_id": "PYTHON_SENSOR_001",
  "sensor_data": {
    "temperature": 23.5,
    "humidity": 65.2
  }
}
```

### Qué hace el script

1. **Carga la configuración** desde `sensor_config.json`
2. **Genera un par de claves ECDSA** (secp256k1) - misma curva que Bitcoin/Ethereum
3. **Construye el mensaje** ordenando campos alfabéticamente: `humidity=65.2,sensor_id=PYTHON_SENSOR_001,temperature=23.5,timestamp=1735843200000`
4. **Calcula el hash SHA-256** del mensaje construido
5. **Firma el hash** con la clave privada ECDSA
6. **Envía al backend** vía POST `/api/ingest` (el backend reconstruye el mensaje para validar):

```json
{
  "sensor_id": "PYTHON_SENSOR_001",
  "temperature": 23.5,
  "humidity": 65.2,
  "timestamp": 1735843200000,
  "hash": "ABDD6FCAE1168AAB0278BC7E5D0B86671F720AEC6BB00CBF070C6136BC0ACAC7",
  "signature": "6FA9ADECE1E8BE3CDD34440964F2CF5AEF460480F7A96C75A7367A4B4D1D360A...",
  "publicKey": "D27CBD596D2272C63502D6A186C09D9D8101DD3448CB367E3B28DDF1A9D66E41..."
}
```

**Nota:** El campo `message` ya NO es necesario. El backend lo construye automáticamente ordenando los campos alfabéticamente.

### Salida esperada

```
📄 Cargando configuración desde sensor_config.json...
🔐 Generando par de claves ECDSA secp256k1...

📝 Mensaje construido: humidity=65.2,sensor_id=PYTHON_SENSOR_001,temperature=23.5,timestamp=1735843845000
⏰ Timestamp de medición: 2026-01-02 10:30:45
🌡️  Temperatura: 23.5°C
💧 Humedad: 65.2%

📤 Enviando datos del sensor PYTHON_SENSOR_001:
   Mensaje construido: humidity=65.2,sensor_id=PYTHON_SENSOR_001,temperature=23.5,timestamp=1735843845000
   Temperatura: 23.5°C
   Humedad: 65.2%
   Timestamp: 1735843845000 (2026-01-02 10:30:45)
   Hash: ABDD6FCAE1168AAB... (64 chars)
   Signature: 6FA9ADECE1E8BE3C... (128 chars)
   PublicKey: D27CBD596D2272C6... (128 chars)

📥 Respuesta del servidor (status 201):
   {'status': 'success', 'message': 'Firma verificada. Dato pendiente de certificación en Cardano', 'verified': True}

✅ Firma verificada exitosamente!
📊 Datos del sensor almacenados en el backend
```

## Formato de Datos Requerido

El backend espera:

| Campo | Tipo | Longitud | Requerido | Descripción |
|-------|------|----------|-----------|-------------|
| `sensor_id` | string | variable | ✅ Sí | Identificador único del sensor |
| `temperature` | number | - | ⚪ Opcional | Temperatura en °C |
| `humidity` | number | - | ⚪ Opcional | Humedad relativa en % |
| `timestamp` | number | - | ⚪ Opcional | Unix timestamp en ms de cuando se tomó la medición |
| `hash` | string | 64 chars hex | ✅ Sí | SHA-256 hash del mensaje construido |
| `signature` | string | 128 chars hex | ✅ Sí | Firma ECDSA (r\|\|s, 64 bytes) |
| `publicKey` | string | 128 chars hex | ✅ Sí | Clave pública (x\|\|y, 64 bytes) |

### Autenticación

El backend requiere autenticación por token:

- **Query param**: `?token=tu_token_aqui`
- **Header**: `x-access-token: tu_token_aqui`

### Validaciones del Backend

Ver `offchain/backend/api_server.ts`:

- **sensor_id**: Campo requerido
- **hash**: Exactamente 64 caracteres hexadecimales (SHA-256)
- **signature**: Exactamente 128 caracteres hexadecimales (r||s, 64 bytes)
- **publicKey**: Exactamente 128 caracteres hexadecimales (x||y, 64 bytes)
- **temperature/humidity/timestamp**: Campos opcionales, se almacenan si se proporcionan
- El backend **construye el mensaje automáticamente** ordenando los campos alfabéticamente
- El formato del mensaje construido es: `campo1=valor1,campo2=valor2,...`
- Valida que el hash corresponda al mensaje construido antes de verificar la firma ECDSA

**Importante:** El cliente debe construir el mensaje con los campos en **orden alfabético** para que el hash coincida con el del backend.
