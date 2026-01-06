#!/usr/bin/env python3
"""
Verifica que los datos de prueba tengan firmas ECDSA válidas
"""

import hashlib
import json
import struct
from ecdsa import VerifyingKey, SECP256k1
from ecdsa.util import sigdecode_string


def build_message(sensor_id: str, temperature: int, humidity: int, timestamp: int) -> bytes:
    """Construye el mensaje binario ordenando los campos alfabéticamente"""
    message = b''
    message += struct.pack('>q', humidity)      # 8 bytes big-endian
    message += sensor_id.encode('utf-8')        # UTF-8 bytes
    message += struct.pack('>q', temperature)   # 8 bytes big-endian
    message += struct.pack('>q', timestamp)     # 8 bytes big-endian
    return message


def verify_signature(sensor_id: str, temperature: int, humidity: int, timestamp: int,
                    signature_hex: str, public_key_hex: str) -> bool:
    """Verifica que la firma ECDSA sea válida"""
    try:
        # 1. Construir mensaje
        message = build_message(sensor_id, temperature, humidity, timestamp)
        print(f"  Message (hex): {message.hex()}")
        print(f"  Message (len): {len(message)} bytes")

        # 2. Calcular hash SHA-256
        hash_bytes = hashlib.sha256(message).digest()
        hash_hex = hash_bytes.hex().upper()
        print(f"  Hash: {hash_hex}")

        # 3. Convertir hex a bytes
        signature_bytes = bytes.fromhex(signature_hex)
        public_key_bytes = bytes.fromhex(public_key_hex)

        # 4. Crear VerifyingKey desde los bytes de la clave pública
        verifying_key = VerifyingKey.from_string(public_key_bytes, curve=SECP256k1)

        # 5. Verificar firma
        verifying_key.verify_digest(signature_bytes, hash_bytes, sigdecode=sigdecode_string)

        return True
    except Exception as e:
        print(f"  ❌ Error: {e}")
        return False


def main():
    print("=" * 60)
    print("Verificando datos de prueba")
    print("=" * 60)

    # Leer datos de prueba
    with open("test_oracle_data.json", 'r') as f:
        test_data = json.load(f)

    all_valid = True

    for i, data in enumerate(test_data):
        print(f"\n📊 Test Case {i+1}:")
        print(f"  Sensor ID: {data['sensor_id']}")
        print(f"  Temperature: {data['temperature']/10}°C (raw: {data['temperature']})")
        print(f"  Humidity: {data['humidity']/10}% (raw: {data['humidity']})")
        print(f"  Timestamp: {data['timestamp']}")

        is_valid = verify_signature(
            data['sensor_id'],
            data['temperature'],
            data['humidity'],
            data['timestamp'],
            data['signature'],
            data['public_key']
        )

        if is_valid:
            print(f"  ✅ Firma válida")
        else:
            print(f"  ❌ Firma inválida")
            all_valid = False

    print("\n" + "=" * 60)
    if all_valid:
        print("✅ Todas las firmas son válidas")
    else:
        print("❌ Algunas firmas son inválidas")
    print("=" * 60)


if __name__ == "__main__":
    main()
