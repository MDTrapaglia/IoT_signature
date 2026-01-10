import nacl from 'tweetnacl';

/**
 * Verifica firma Ed25519
 * @param message - Mensaje binario original (Buffer) o hash SHA-256
 * @param signature - Firma Ed25519 (128 chars hex = 64 bytes)
 * @param publicKey - Clave pública Ed25519 (64 chars hex = 32 bytes)
 * @returns true si la firma es válida
 */
export function verifyEd25519Signature(message: Buffer, signature: string, publicKey: string): boolean {
  try {
    // Convertir hex strings a Uint8Array
    const signatureBytes = new Uint8Array(Buffer.from(signature, 'hex'));
    const publicKeyBytes = new Uint8Array(Buffer.from(publicKey, 'hex'));
    const messageBytes = new Uint8Array(message);

    // Verificar longitudes
    if (signatureBytes.length !== 64) {
      console.error('Invalid signature length:', signatureBytes.length, 'expected 64');
      return false;
    }

    if (publicKeyBytes.length !== 32) {
      console.error('Invalid public key length:', publicKeyBytes.length, 'expected 32');
      return false;
    }

    // Verificar firma Ed25519 usando tweetnacl
    return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
  } catch (error) {
    console.error('Error verificando firma Ed25519:', error);
    return false;
  }
}
