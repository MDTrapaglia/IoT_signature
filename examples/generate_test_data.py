#!/usr/bin/env python3
"""
Genera datos de prueba válidos para el oracle con firmas ECDSA
"""

import hashlib
import json
import struct
import time
from ecdsa import SigningKey, SECP256k1
from ecdsa.util import sigencode_string


def build_message(sensor_id: str, temperature: int, humidity: int, timestamp: int) -> bytes:
    """
    Construye el mensaje binario ordenando los campos alfabéticamente.
    Formato: humidity_bytes || sensor_id || temperature_bytes || timestamp_bytes
    """
    message = b''
    message += struct.pack('>q', humidity)      # 8 bytes big-endian
    message += sensor_id.encode('utf-8')        # UTF-8 bytes
    message += struct.pack('>q', temperature)   # 8 bytes big-endian
    message += struct.pack('>q', timestamp)     # 8 bytes big-endian
    return message


def sign_message(message: bytes, private_key: SigningKey):
    """Firma un mensaje binario con ECDSA secp256k1"""
    # 1. Calcular hash SHA-256
    hash_bytes = hashlib.sha256(message).digest()
    hash_hex = hash_bytes.hex().upper()

    # 2. Firmar el hash
    signature_bytes = private_key.sign_digest(hash_bytes, sigencode=sigencode_string)
    signature_hex = signature_bytes.hex().upper()

    # 3. Obtener clave pública
    public_key = private_key.get_verifying_key()
    public_key_hex = public_key.to_string().hex().upper()

    return hash_hex, signature_hex, public_key_hex


def generate_test_data():
    """Genera 3 conjuntos de datos de prueba con firmas válidas"""

    print("🔐 Generando par de claves ECDSA secp256k1...")
    private_key = SigningKey.generate(curve=SECP256k1)

    # Datos de prueba
    sensor_id = "ESP32_001"
    test_cases = [
        {"temperature": 235, "humidity": 652},  # 23.5°C, 65.2%
        {"temperature": 240, "humidity": 680},  # 24.0°C, 68.0%
        {"temperature": 225, "humidity": 620},  # 22.5°C, 62.0%
    ]

    results = []
    base_timestamp = int(time.time() * 1000)

    for i, case in enumerate(test_cases):
        temperature = case["temperature"]
        humidity = case["humidity"]
        timestamp = base_timestamp + (i * 100000)  # +100 segundos entre cada uno

        # Construir mensaje
        message = build_message(sensor_id, temperature, humidity, timestamp)

        # Firmar mensaje
        hash_hex, signature_hex, public_key_hex = sign_message(message, private_key)

        data = {
            "sensor_id": sensor_id,
            "temperature": temperature,
            "humidity": humidity,
            "timestamp": timestamp,
            "signature": signature_hex,
            "public_key": public_key_hex,
            "hash": hash_hex
        }

        results.append(data)

        print(f"\n📊 Test Case {i+1}:")
        print(f"   Temperature: {temperature/10}°C (raw: {temperature})")
        print(f"   Humidity: {humidity/10}% (raw: {humidity})")
        print(f"   Timestamp: {timestamp}")
        print(f"   Signature: {signature_hex[:32]}...")
        print(f"   Public Key: {public_key_hex[:32]}...")

    return results


if __name__ == "__main__":
    print("=" * 60)
    print("Generando datos de prueba para el oracle")
    print("=" * 60)

    test_data = generate_test_data()

    # Guardar en JSON
    output_file = "test_oracle_data.json"
    with open(output_file, 'w') as f:
        json.dump(test_data, f, indent=2)

    print(f"\n✅ Datos guardados en: {output_file}")
    print("\n📋 Para usar en TypeScript:")
    print("   const testData: SensorData[] = require('./test_oracle_data.json');")
