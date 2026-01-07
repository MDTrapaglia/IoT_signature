import elliptic from 'elliptic';

const EC = elliptic.ec;
const ec = new EC('secp256k1'); // Curva secp256k1 (Bitcoin/Ethereum)

/**
 * Verifica firma ECDSA secp256k1
 * @param hash - Hash SHA-256 del mensaje (64 chars hex)
 * @param signature - Firma ECDSA r+s (128 chars hex)
 * @param publicKey - Clave pública x+y (128 chars hex)
 * @returns true si la firma es válida
 */
export function verifyECDSASignature(hash: string, signature: string, publicKey: string): boolean {
  try {
    // Agregar prefijo 04 para indicar clave pública sin comprimir
    const pubKeyWithPrefix = '04' + publicKey.toLowerCase();
    const key = ec.keyFromPublic(pubKeyWithPrefix, 'hex');

    // Dividir firma en r y s (cada uno 32 bytes = 64 hex chars)
    const r = signature.substring(0, 64).toLowerCase();
    const s = signature.substring(64, 128).toLowerCase();

    return key.verify(hash.toLowerCase(), { r, s });
  } catch (error) {
    console.error('Error verificando firma ECDSA:', error);
    return false;
  }
}

/**
 * Verifica firma Ed25519
 * PLACEHOLDER: Implementación futura para migración a Ed25519
 * @param message - Mensaje binario original
 * @param signature - Firma Ed25519 (128 chars hex)
 * @param publicKey - Clave pública Ed25519 (64 chars hex)
 * @returns true si la firma es válida
 */
export function verifyEd25519Signature(message: Buffer, signature: string, publicKey: string): boolean {
  // TODO: Implementar verificación Ed25519 usando @noble/ed25519 o tweetnacl
  console.warn('verifyEd25519Signature: Not implemented yet');
  return false;
}
