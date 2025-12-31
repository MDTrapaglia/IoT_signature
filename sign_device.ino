#include <uECC.h>
#include "SHA256.h"

// Llave privada de "unos"
uint8_t private_key[32] = {0xA3, 0x3D, 0x9C, 0x42, 0x04, 0x76, 0xBA, 0xEB, 0xE1, 0x3B, 0x7E, 0x0E, 0xE7, 0xE9, 0x77, 0xC6, 0xE3, 0x38, 0xD5, 0x12, 0x51, 0x60, 0x7D, 0x07, 0xC7, 0xBB, 0x2A, 0x51, 0x21, 0xD1, 0xE5, 0xB2};

uint8_t sig[64];
const struct uECC_Curve_t * curve = uECC_secp256k1();

unsigned long initTime;
unsigned long signTime;
unsigned long shaTime;

// Función para generar un número aleatorio (necesaria para la firma ECC)
// En un Nano, usamos el ruido del pin analógico 0 como semilla.
static int RNG(uint8_t *dest, unsigned size) {
  while (size--) {
    uint8_t val = 0;
    for (int i = 0; i < 8; ++i) {
      val = (val << 1) | (analogRead(0) & 0x01);
    }
    *dest++ = val;
  }
  return 1;
}

void printHex(uint8_t *data, uint8_t len) {
  for (int i = 0; i < len; i++) {
    if (data[i] < 0x10) Serial.print("0");
    Serial.print(data[i], HEX);
  }
  Serial.println();
}


void setup() {
  Serial.begin(9600);
  uECC_set_rng(&RNG);

  uint8_t public_key[64]; // Aquí guardaremos la pública

  // 1. Derivar la llave pública a partir de la privada
  uECC_compute_public_key(private_key, public_key, curve);


  Serial.print("PUB_KEY:"); 
  printHex(public_key, 64);
}

void loop() {
  // 1. Lectura del sensor (ejemplo)
  float temp = 26.75;
  char payload[16];
  dtostrf(temp, 4, 2, payload); // "26.75"

  // 2. Calcular SHA-256 del payload
  uint8_t hash[32];
  initTime = millis();
  Sha256.init();
  Sha256.print(payload);
  Sha256.final(hash);
  shaTime = millis() - initTime ; 
  
  // 2. Firmar el hash
  uECC_sign(private_key, hash, 32, sig, curve);
  signTime = millis - shaTime ;
  Serial.print("\n\nHASH:"); 
  printHex(hash, 32);
  Serial.print("SHA execution time (s): ");
  Serial.print(shaTime / 1000.0, 4);
  Serial.print("\nSIG:"); 
  printHex(sig, 64);
  Serial.print("Signature execution time (s): ");
  Serial.print(signTime  / 1000.0, 4);
  
  delay(10000);
}
