#!/usr/bin/env python3
"""
Ejemplo de envío de datos de sensor al backend con firma ECDSA
Genera firmas válidas usando secp256k1 y las envía al API
Lee la configuración desde sensor_config.json

IMPORTANTE: Este script usa un formato binario compatible con el validator de Aiken.
El mensaje se construye ordenando los campos alfabéticamente:
  - humidity (8 bytes big-endian)
  - sensor_id (bytes UTF-8)
  - temperature (8 bytes big-endian)
  - timestamp (8 bytes big-endian)
"""

import hashlib
import requests
import time
import json
import struct
from pathlib import Path
from ecdsa import SigningKey, SECP256k1
from ecdsa.util import sigencode_string


def load_config(config_path: str = "sensor_config.json"):
    """Carga la configuración desde un archivo JSON"""
    script_dir = Path(__file__).parent
    config_file = script_dir / config_path

    if not config_file.exists():
        raise FileNotFoundError(f"Archivo de configuración no encontrado: {config_file}")

    with open(config_file, 'r') as f:
        return json.load(f)


def generate_keypair():
    """Genera un par de claves ECDSA secp256k1"""
    private_key = SigningKey.generate(curve=SECP256k1)
    public_key = private_key.get_verifying_key()
    return private_key, public_key


def build_message(sensor_id: str, temperature: int, humidity: int, timestamp: int) -> bytes:
    """
    Construye el mensaje binario ordenando los campos alfabéticamente.
    Compatible con el validator de Aiken sensor_oracle_verified.ak

    Formato: humidity_bytes || sensor_id || temperature_bytes || timestamp_bytes
    Los enteros se codifican como 8 bytes big-endian ('>q' = signed 64-bit)

    Args:
        sensor_id: Identificador del sensor (string UTF-8)
        temperature: Temperatura * 10 (ej: 23.5°C = 235)
        humidity: Humedad * 10 (ej: 65.2% = 652)
        timestamp: Unix timestamp en milisegundos

    Returns:
        bytes: Mensaje binario listo para hashear
    """
    # Orden alfabético: humidity, sensor_id, temperature, timestamp

    message = b''

    # 1. humidity (8 bytes big-endian)
    message += struct.pack('>q', humidity)

    # 2. sensor_id (UTF-8 bytes)
    message += sensor_id.encode('utf-8')

    # 3. temperature (8 bytes big-endian)
    message += struct.pack('>q', temperature)

    # 4. timestamp (8 bytes big-endian)
    message += struct.pack('>q', timestamp)

    return message


def sign_message(message: bytes, private_key: SigningKey):
    """
    Firma un mensaje binario con ECDSA secp256k1

    Args:
        message: Mensaje binario a firmar
        private_key: Clave privada ECDSA

    Returns:
        tuple: (hash_hex, signature_hex, public_key_hex)
    """
    # 1. Calcular hash SHA-256 del mensaje binario
    hash_bytes = hashlib.sha256(message).digest()
    hash_hex = hash_bytes.hex().upper()

    # 2. Firmar el hash con ECDSA
    # sigencode_string genera firma como r||s (64 bytes concatenados)
    signature_bytes = private_key.sign_digest(
        hash_bytes,
        sigencode=sigencode_string
    )
    signature_hex = signature_bytes.hex().upper()

    # 3. Obtener clave pública (coordenadas x,y sin comprimir)
    public_key = private_key.get_verifying_key()
    # to_string() devuelve x||y concatenados (64 bytes)
    public_key_hex = public_key.to_string().hex().upper()

    return hash_hex, signature_hex, public_key_hex


def send_to_backend(config: dict, sensor_id: str, message: bytes, temperature: int, humidity: int,
                    hash_hex: str, signature_hex: str, public_key_hex: str, timestamp: int):
    """
    Envía los datos firmados al backend

    Args:
        config: Configuración cargada desde JSON (backend_url, access_token)
        sensor_id: Identificador del sensor
        message: Mensaje binario construido para debug
        temperature: Temperatura * 10 (ej: 23.5°C = 235)
        humidity: Humedad * 10 (ej: 65.2% = 652)
        hash_hex: Hash SHA-256 en hexadecimal (64 caracteres)
        signature_hex: Firma ECDSA en hexadecimal (128 caracteres)
        public_key_hex: Clave pública en hexadecimal (128 caracteres)
        timestamp: Unix timestamp de cuando se tomó la medición (milisegundos)

    Returns:
        dict: Respuesta del servidor
    """
    payload = {
        "sensor_id": sensor_id,
        "temperature": temperature,
        "humidity": humidity,
        "timestamp": timestamp,
        "hash": hash_hex,
        "signature": signature_hex,
        "publicKey": public_key_hex
    }

    # Mostrar información de debug
    print(f"📤 Enviando datos del sensor {sensor_id}:")
    print(f"   Mensaje binario: {message.hex()[:32]}... ({len(message)} bytes)")
    print(f"   Temperatura: {temperature/10}°C (raw: {temperature})")
    print(f"   Humedad: {humidity/10}% (raw: {humidity})")
    print(f"   Timestamp: {timestamp} ({time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(timestamp/1000))})")
    print(f"   Hash: {hash_hex[:16]}... ({len(hash_hex)} chars)")
    print(f"   Signature: {signature_hex[:16]}... ({len(signature_hex)} chars)")
    print(f"   PublicKey: {public_key_hex[:16]}... ({len(public_key_hex)} chars)")

    # Enviar petición POST
    url = f"{config['backend_url']}/api/ingest"
    headers = {
        "Content-Type": "application/json",
        "x-access-token": config['access_token']
    }

    try:
        response = requests.post(url, json=payload, headers=headers)

        print(f"\n📥 Respuesta del servidor (status {response.status_code}):")
        print(f"   {response.json()}")

        return response.json()

    except requests.exceptions.RequestException as e:
        print(f"❌ Error de conexión: {e}")
        return None


def main():
    """Ejemplo completo: generar firma y enviar al backend"""

    # Cargar configuración desde JSON
    print("📄 Cargando configuración desde sensor_config.json...")
    try:
        config = load_config()
    except FileNotFoundError as e:
        print(f"❌ {e}")
        print("   Crea el archivo 'sensor_config.json' en el directorio examples/")
        return

    print("🔐 Generando par de claves ECDSA secp256k1...")
    private_key, public_key = generate_keypair()

    # Obtener datos del sensor desde la configuración
    sensor_id = config['sensor_id']
    temperature_raw = config['sensor_data'].get('temperature')  # Ej: 23.5
    humidity_raw = config['sensor_data'].get('humidity')  # Ej: 65.2

    # Convertir a enteros multiplicados por 10 (formato compatible con Aiken)
    temperature = int(temperature_raw * 10)  # 23.5 -> 235
    humidity = int(humidity_raw * 10)  # 65.2 -> 652

    # Timestamp de cuando se toma la medición (en milisegundos)
    timestamp = int(time.time() * 1000)

    # Construir mensaje binario con campos ordenados alfabéticamente
    message = build_message(sensor_id, temperature, humidity, timestamp)

    print(f"\n📝 Mensaje binario construido ({len(message)} bytes):")
    print(f"   Hex: {message.hex()}")
    print(f"⏰ Timestamp de medición: {time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(timestamp/1000))}")
    print(f"🌡️  Temperatura: {temperature_raw}°C (raw: {temperature})")
    print(f"💧 Humedad: {humidity_raw}% (raw: {humidity})")

    # Firmar el mensaje
    hash_hex, signature_hex, public_key_hex = sign_message(message, private_key)

    # Enviar al backend con todos los datos
    result = send_to_backend(config, sensor_id, message, temperature, humidity,
                            hash_hex, signature_hex, public_key_hex, timestamp)

    if result and result.get("verified"):
        print("\n✅ Firma verificada exitosamente!")
        print("📊 Datos del sensor almacenados en el backend")
    else:
        print("\n❌ Error: firma no verificada")


if __name__ == "__main__":
    # Verificar dependencias
    try:
        import ecdsa
        import requests
    except ImportError as e:
        print("❌ Falta instalar dependencias:")
        print("   pip install ecdsa requests")
        exit(1)

    main()
