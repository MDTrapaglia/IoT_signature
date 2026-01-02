#!/usr/bin/env python3
"""
Ejemplo de envío de datos de sensor al backend con firma ECDSA
Genera firmas válidas usando secp256k1 y las envía al API
"""

import hashlib
import requests
from ecdsa import SigningKey, SECP256k1
from ecdsa.util import sigencode_string

# Configuración del backend
BACKEND_URL = "http://192.168.100.200:3001"  # Cambia por tu IP/puerto
ACCESS_TOKEN = "c90e31d3f88c8851687014fa69a601fb65717449a3d07a50bd84ee75046fb885"
SENSOR_ID = "PYTHON_SENSOR_001"


def generate_keypair():
    """Genera un par de claves ECDSA secp256k1"""
    private_key = SigningKey.generate(curve=SECP256k1)
    public_key = private_key.get_verifying_key()
    return private_key, public_key


def create_sensor_message(sensor_id: str, temperature: float, humidity: float):
    """Crea un mensaje de sensor simulado"""
    return f"sensor_id={sensor_id},temp={temperature},humidity={humidity}"


def sign_message(message: str, private_key: SigningKey):
    """
    Firma un mensaje con ECDSA secp256k1

    Returns:
        tuple: (hash_hex, signature_hex, public_key_hex)
    """
    # 1. Calcular hash SHA-256 del mensaje
    hash_bytes = hashlib.sha256(message.encode()).digest()
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


def send_to_backend(sensor_id: str, hash_hex: str, signature_hex: str, public_key_hex: str):
    """
    Envía los datos firmados al backend

    Args:
        sensor_id: Identificador del sensor
        hash_hex: Hash SHA-256 en hexadecimal (64 caracteres)
        signature_hex: Firma ECDSA en hexadecimal (128 caracteres)
        public_key_hex: Clave pública en hexadecimal (128 caracteres)

    Returns:
        dict: Respuesta del servidor
    """
    payload = {
        "sensor_id": sensor_id,
        "hash": hash_hex,
        "signature": signature_hex,
        "publicKey": public_key_hex
    }

    # Mostrar información de debug
    print(f"📤 Enviando datos del sensor {sensor_id}:")
    print(f"   Hash: {hash_hex[:16]}... ({len(hash_hex)} chars)")
    print(f"   Signature: {signature_hex[:16]}... ({len(signature_hex)} chars)")
    print(f"   PublicKey: {public_key_hex[:16]}... ({len(public_key_hex)} chars)")

    # Enviar petición POST
    url = f"{BACKEND_URL}/api/ingest"
    headers = {
        "Content-Type": "application/json",
        "x-access-token": ACCESS_TOKEN
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

    print("🔐 Generando par de claves ECDSA secp256k1...")
    private_key, public_key = generate_keypair()

    # Crear mensaje del sensor (simulando lectura de temperatura y humedad)
    temperature = 23.5
    humidity = 65.2
    message = create_sensor_message(SENSOR_ID, temperature, humidity)

    print(f"\n📝 Mensaje original: {message}")

    # Firmar el mensaje
    hash_hex, signature_hex, public_key_hex = sign_message(message, private_key)

    # Enviar al backend
    result = send_to_backend(SENSOR_ID, hash_hex, signature_hex, public_key_hex)

    if result and result.get("verified"):
        print("\n✅ Firma verificada exitosamente!")
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
