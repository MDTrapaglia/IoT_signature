# Ejemplos de Ed25519 para Oracle de Sensores

Este directorio contiene scripts de ejemplo para trabajar con firmas Ed25519 en el sistema de oracle de sensores.

## 🔐 Importante: Firmas sobre Hash SHA-256

**CRÍTICO**: Todos los scripts firman el **HASH SHA-256 del mensaje**, no el mensaje directamente.

```
Mensaje → SHA-256 → Hash (32 bytes) → Ed25519 Signature
```

Esto es compatible con el smart contract `sensor_oracle_ed25519.ak` que verifica:

```aiken
let message = build_message(data)
let message_hash = builtin.sha2_256(message)  // ← Hash SHA-256
verify_ed25519_signature(
    data.public_key,
    message_hash,  // ← Verifica sobre el HASH
    data.signature,
)
```

## 📋 Scripts Disponibles

### 1. Generar Datos de Prueba (`generate_test_data_ed25519.py`)

Genera 3 conjuntos de datos de prueba con firmas Ed25519 válidas.

**Instalación:**
```bash
pip install pynacl
```

**Uso:**
```bash
python generate_test_data_ed25519.py
```

**Salida:**
- Archivo: `test_oracle_data_ed25519.json`
- 3 mediciones de prueba con firmas válidas

### 2. Verificar Datos de Prueba (`verify_test_data_ed25519.py`)

Verifica que las firmas Ed25519 sean válidas.

**Uso:**
```bash
python verify_test_data_ed25519.py
```

**Valida:**
- Construcción correcta del mensaje
- Hash SHA-256 del mensaje
- Firma Ed25519 sobre el hash

### 3. Enviar Datos al Backend (`send_sensor_data_ed25519.py`)

Envía datos de sensor firmados al API backend.

**Instalación:**
```bash
pip install pynacl requests
```

**Configuración:**

Crear `sensor_config.json`:
```json
{
  "sensor_id": "ESP32_001",
  "backend_url": "http://192.168.100.200:3001",
  "access_token": "c90e31d3f88c8851687014fa69a601fb65717449a3d07a50bd84ee75046fb885",
  "sensor_data": {
    "temperature": 23.5,
    "humidity": 65.2
  }
}
```

**Uso:**
```bash
python send_sensor_data_ed25519.py
```

## 📊 Formato de Mensaje

El mensaje se construye ordenando los campos **alfabéticamente**:

```
humidity (8 bytes big-endian) ||
sensor_id (UTF-8 bytes) ||
temperature (8 bytes big-endian) ||
timestamp (8 bytes big-endian)
```

### Ejemplo:

```python
sensor_id = "ESP32_TEST_001"
temperature = 235  # 23.5°C * 10
humidity = 652     # 65.2% * 10
timestamp = 1767834733615

# Construir mensaje
message = build_message(sensor_id, temperature, humidity, timestamp)

# Calcular hash SHA-256
message_hash = hashlib.sha256(message).digest()

# Firmar el HASH (no el mensaje)
signature = signing_key.sign(message_hash).signature
```

## 🔑 Formato de Datos

### Payload JSON:

```json
{
  "sensor_id": "ESP32_TEST_001",
  "temperature": 235,
  "humidity": 652,
  "timestamp": 1767834733615,
  "hash": "5dd32940cc2cb9f6934e6b06d1a0be027c3a7559a3050df8f9cd02ecac66bf98",
  "signature": "507f7accc0a26503d2281dd63276541e77fd7f4f81db3716a4cb0c544b1948100c4abb64105aa6b32e37456d058b138b0f98ec14968c3429929c49da6626a401",
  "publicKey": "ccad2ed5ab9571799182ef3cb60079eea7269f79f1563f17300ce742b6584115"
}
```

### Longitudes:

- **hash**: 64 caracteres hex (32 bytes)
- **signature**: 128 caracteres hex (64 bytes)
- **publicKey**: 64 caracteres hex (32 bytes)

## ⚠️  Diferencias con ECDSA

| Aspecto | ECDSA (secp256k1) | Ed25519 |
|---------|-------------------|---------|
| Algoritmo | `ecdsa` library | `pynacl` library |
| Clave Pública | 128 chars (64 bytes) | 64 chars (32 bytes) |
| Firma | 128 chars (64 bytes) | 128 chars (64 bytes) |
| Curva | secp256k1 | Curve25519 |
| Qué firma | Hash SHA-256 | Hash SHA-256 |
| Smart Contract | `sensor_oracle_verified.ak` | `sensor_oracle_ed25519.ak` |

## 🐛 Troubleshooting

### Error: "Firma inválida"

**Causa**: El ESP32 o script está firmando el mensaje directamente en lugar del hash.

**Solución**:
```python
# ❌ INCORRECTO
signature = signing_key.sign(message).signature

# ✅ CORRECTO
message_hash = hashlib.sha256(message).digest()
signature = signing_key.sign(message_hash).signature
```

### Error: "Hash no corresponde"

**Causa**: Orden incorrecto de los campos en el mensaje.

**Solución**: Siempre usar orden alfabético:
1. humidity
2. sensor_id
3. temperature
4. timestamp

## 📚 Referencias

- [PyNaCl Documentation](https://pynacl.readthedocs.io/)
- [Ed25519 Specification](https://ed25519.cr.yp.to/)
- [Aiken Crypto Module](https://aiken-lang.github.io/stdlib/aiken/crypto.html)
