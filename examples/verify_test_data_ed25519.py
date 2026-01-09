#!/usr/bin/env python3
"""
Verifica que los datos de prueba tengan firmas Ed25519 válidas
IMPORTANTE: Verifica firmas sobre el HASH SHA-256 del mensaje
Compatible con sensor_oracle_ed25519.ak
"""

import hashlib
import json
import struct
from nacl.signing import VerifyKey
from nacl.encoding import HexEncoder
from nacl.exceptions import BadSignatureError


def build_message(sensor_id: str, temperature: int, humidity: int, timestamp: int) -> bytes:
    """Construye el mensaje binario ordenando los campos alfabéticamente"""
    message = b''
    message += struct.pack('>q', humidity)      # 8 bytes big-endian
    message += sensor_id.encode('utf-8')        # UTF-8 bytes
    message += struct.pack('>q', temperature)   # 8 bytes big-endian
    message += struct.pack('>q', timestamp)     # 8 bytes big-endian
    return message


def verify_signature_ed25519(sensor_id: str, temperature: int, humidity: int, timestamp: int,
                             signature_hex: str, public_key_hex: str) -> bool:
    """
    Verifica que la firma Ed25519 sea válida sobre el HASH SHA-256 del mensaje

    Args:
        sensor_id: ID del sensor
        temperature: Temperatura * 10
        humidity: Humedad * 10
        timestamp: Unix timestamp en milisegundos
        signature_hex: Firma en hexadecimal (128 chars = 64 bytes)
        public_key_hex: Clave pública en hexadecimal (64 chars = 32 bytes)

    Returns:
        bool: True si la firma es válida
    """
    try:
        # 1. Construir mensaje
        message = build_message(sensor_id, temperature, humidity, timestamp)
        print(f"  Message (hex): {message.hex()}")
        print(f"  Message (len): {len(message)} bytes")

        # 2. Calcular hash SHA-256 del mensaje
        # CRÍTICO: El smart contract verifica la firma sobre el HASH, no sobre el mensaje
        hash_bytes = hashlib.sha256(message).digest()
        hash_hex = hash_bytes.hex().upper()
        print(f"  Hash (SHA-256): {hash_hex}")

        # 3. Convertir hex a bytes
        signature_bytes = bytes.fromhex(signature_hex)
        public_key_bytes = bytes.fromhex(public_key_hex)

        # 4. Crear VerifyKey desde los bytes de la clave pública
        verify_key = VerifyKey(public_key_bytes)

        # 5. Verificar firma Ed25519 sobre el HASH
        # verify() lanza BadSignatureError si la firma es inválida
        verify_key.verify(hash_bytes, signature_bytes)

        return True
    except BadSignatureError:
        print(f"  ❌ Error: Firma Ed25519 inválida")
        return False
    except Exception as e:
        print(f"  ❌ Error: {e}")
        return False


def main():
    print("=" * 60)
    print("Verificando datos de prueba Ed25519")
    print("=" * 60)

    # Leer datos de prueba
    try:
        with open("test_oracle_data_ed25519.json", 'r') as f:
            test_data = json.load(f)
    except FileNotFoundError:
        print("❌ Archivo no encontrado: test_oracle_data_ed25519.json")
        print("   Ejecuta primero: python generate_test_data_ed25519.py")
        return

    all_valid = True

    for i, data in enumerate(test_data):
        print(f"\n📊 Test Case {i+1}:")
        print(f"  Sensor ID: {data['sensor_id']}")
        print(f"  Temperature: {data['temperature']/10}°C (raw: {data['temperature']})")
        print(f"  Humidity: {data['humidity']/10}% (raw: {data['humidity']})")
        print(f"  Timestamp: {data['timestamp']}")

        is_valid = verify_signature_ed25519(
            data['sensor_id'],
            data['temperature'],
            data['humidity'],
            data['timestamp'],
            data['signature'],
            data['publicKey']
        )

        if is_valid:
            print(f"  ✅ Firma Ed25519 válida (sobre hash SHA-256)")
        else:
            print(f"  ❌ Firma Ed25519 inválida")
            all_valid = False

    print("\n" + "=" * 60)
    if all_valid:
        print("✅ Todas las firmas Ed25519 son válidas")
        print("   Compatible con sensor_oracle_ed25519.ak")
    else:
        print("❌ Algunas firmas son inválidas")
    print("=" * 60)


if __name__ == "__main__":
    try:
        import nacl
    except ImportError:
        print("❌ Falta instalar dependencias:")
        print("   pip install pynacl")
        exit(1)

    main()
