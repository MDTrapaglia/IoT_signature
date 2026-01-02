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

Edita las siguientes variables en el script según tu entorno:

```python
BACKEND_URL = "http://192.168.100.200:3001"  # URL de tu backend
ACCESS_TOKEN = "c90e31d3f88c8851687014fa69a601fb65717449a3d07a50bd84ee75046fb885"  # Token de acceso
SENSOR_ID = "PYTHON_SENSOR_001"  # ID de tu sensor
```

### Qué hace el script

1. **Genera un par de claves ECDSA** (secp256k1) - misma curva que Bitcoin/Ethereum
2. **Crea un mensaje de sensor** simulado con temperatura y humedad
3. **Calcula el hash SHA-256** del mensaje
4. **Firma el hash** con la clave privada ECDSA
5. **Envía al backend** vía POST `/api/ingest` con el formato:

```json
{
  "sensor_id": "PYTHON_SENSOR_001",
  "hash": "ABDD6FCAE1168AAB0278BC7E5D0B86671F720AEC6BB00CBF070C6136BC0ACAC7",
  "signature": "6FA9ADECE1E8BE3CDD34440964F2CF5AEF460480F7A96C75A7367A4B4D1D360A...",
  "publicKey": "D27CBD596D2272C63502D6A186C09D9D8101DD3448CB367E3B28DDF1A9D66E41..."
}
```

### Salida esperada

```
🔐 Generando par de claves ECDSA secp256k1...

📝 Mensaje original: sensor_id=PYTHON_SENSOR_001,temp=23.5,humidity=65.2

📤 Enviando datos del sensor PYTHON_SENSOR_001:
   Hash: ABDD6FCAE1168AAB... (64 chars)
   Signature: 6FA9ADECE1E8BE3C... (128 chars)
   PublicKey: D27CBD596D2272C6... (128 chars)

📥 Respuesta del servidor (status 201):
   {'status': 'success', 'message': 'Firma verificada. Dato pendiente de certificación en Cardano', 'verified': True}

✅ Firma verificada exitosamente!
```

## Formato de Datos Requerido

El backend espera:

| Campo | Tipo | Longitud | Descripción |
|-------|------|----------|-------------|
| `sensor_id` | string | variable | Identificador único del sensor |
| `hash` | string | 64 chars hex | SHA-256 hash del mensaje |
| `signature` | string | 128 chars hex | Firma ECDSA (r\|\|s, 64 bytes) |
| `publicKey` | string | 128 chars hex | Clave pública (x\|\|y, 64 bytes) |

### Autenticación

El backend requiere autenticación por token:

- **Query param**: `?token=tu_token_aqui`
- **Header**: `x-access-token: tu_token_aqui`

### Validaciones del Backend

Ver `offchain/backend/api_server.ts:104-114`:

- Hash debe ser exactamente 64 caracteres hexadecimales
- Signature debe ser exactamente 128 caracteres hexadecimales
- PublicKey debe ser exactamente 128 caracteres hexadecimales
- Todos los campos son obligatorios
