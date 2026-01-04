#!/usr/bin/env python3
"""
Ejemplo de envío de datos de sensor al backend con firma ECDSA
Genera firmas válidas usando secp256k1 y las envía al API
Lee la configuración desde sensor_config.json
"""

import hashlib
import requests
import time
import json
import os
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


def build_message(sensor_id: str, temperature: float = None, humidity: float = None, timestamp: int = None):
    """
    Construye el mensaje a partir de los campos ordenados alfabéticamente
    Debe coincidir con la lógica del backend
    """
    fields = {}

    if sensor_id:
        fields['sensor_id'] = sensor_id
    if temperature is not None:
        fields['temperature'] = temperature
    if humidity is not None:
        fields['humidity'] = humidity
    if timestamp is not None:
        fields['timestamp'] = timestamp

    # Ordenar las claves alfabéticamente
    sorted_keys = sorted(fields.keys())

    # Construir el mensaje en formato clave=valor separado por comas
    return ','.join([f"{key}={fields[key]}" for key in sorted_keys])


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


def send_to_backend(config: dict, sensor_id: str, message: str, temperature: float, humidity: float,
                    hash_hex: str, signature_hex: str, public_key_hex: str, timestamp: int):
    """
    Envía los datos firmados al backend

    Args:
        config: Configuración cargada desde JSON (backend_url, access_token)
        sensor_id: Identificador del sensor
        message: Mensaje construido para debug
        temperature: Temperatura en °C
        humidity: Humedad relativa en %
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
    print(f"   Mensaje construido: {message}")
    print(f"   Temperatura: {temperature}°C")
    print(f"   Humedad: {humidity}%")
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
    temperature = config['sensor_data'].get('temperature')
    humidity = config['sensor_data'].get('humidity')

    # Timestamp de cuando se toma la medición (en milisegundos)
    timestamp = int(time.time() * 1000)

    # Construir mensaje con campos ordenados alfabéticamente
    message = build_message(sensor_id, temperature, humidity, timestamp)

    print(f"\n📝 Mensaje construido: {message}")
    print(f"⏰ Timestamp de medición: {time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(timestamp/1000))}")
    print(f"🌡️  Temperatura: {temperature}°C")
    print(f"💧 Humedad: {humidity}%")

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
