#!/usr/bin/env python3
"""
Genera datos de prueba válidos para el oracle con firmas Ed25519
IMPORTANTE: Firma el HASH SHA-256 del mensaje, no el mensaje directamente
Compatible con el smart contract sensor_oracle_ed25519.ak
"""

import hashlib
import json
import struct
import time
from nacl.signing import SigningKey
from nacl.encoding import HexEncoder


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


def sign_message_ed25519(message: bytes, signing_key: SigningKey):
    """
    Firma un mensaje con Ed25519 sobre el hash SHA-256
    CRÍTICO: Firma el HASH, no el mensaje directamente

    Args:
        message: Mensaje binario a firmar
        signing_key: Clave privada Ed25519

    Returns:
        tuple: (hash_hex, signature_hex, public_key_hex)
    """
    # 1. Calcular hash SHA-256 del mensaje
    hash_bytes = hashlib.sha256(message).digest()
    hash_hex = hash_bytes.hex().upper()

    # 2. Firmar el HASH con Ed25519 (no el mensaje)
    signature_bytes = signing_key.sign(hash_bytes).signature
    signature_hex = signature_bytes.hex().upper()

    # 3. Obtener clave pública
    verify_key = signing_key.verify_key
    public_key_hex = verify_key.encode(encoder=HexEncoder).decode('utf-8').upper()

    return hash_hex, signature_hex, public_key_hex


def generate_test_data():
    """Genera 3 conjuntos de datos de prueba con firmas Ed25519 válidas"""

    print("🔐 Generando par de claves Ed25519...")
    signing_key = SigningKey.generate()

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

        # Firmar mensaje (sobre el hash SHA-256)
        hash_hex, signature_hex, public_key_hex = sign_message_ed25519(message, signing_key)

        data = {
            "sensor_id": sensor_id,
            "temperature": temperature,
            "humidity": humidity,
            "timestamp": timestamp,
            "hash": hash_hex,
            "signature": signature_hex,
            "publicKey": public_key_hex
        }

        results.append(data)

        print(f"\n📊 Test Case {i+1}:")
        print(f"   Temperature: {temperature/10}°C (raw: {temperature})")
        print(f"   Humidity: {humidity/10}% (raw: {humidity})")
        print(f"   Timestamp: {timestamp}")
        print(f"   Hash: {hash_hex[:32]}...")
        print(f"   Signature: {signature_hex[:32]}... (Ed25519)")
        print(f"   Public Key: {public_key_hex[:32]}...")

    return results


if __name__ == "__main__":
    print("=" * 60)
    print("Generando datos de prueba Ed25519 para el oracle")
    print("=" * 60)

    test_data = generate_test_data()

    # Guardar en JSON
    output_file = "test_oracle_data_ed25519.json"
    with open(output_file, 'w') as f:
        json.dump(test_data, f, indent=2)

    print(f"\n✅ Datos guardados en: {output_file}")
    print("\n📋 Para usar en TypeScript:")
    print("   const testData: SensorData[] = require('./test_oracle_data_ed25519.json');")
    print("\n⚠️  IMPORTANTE: Estas firmas usan Ed25519 sobre el HASH SHA-256 del mensaje")
    print("   Compatible con sensor_oracle_ed25519.ak")
