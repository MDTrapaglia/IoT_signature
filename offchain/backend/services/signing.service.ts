import nacl from 'tweetnacl';
import { buildMessage, calculateHash } from '../utils/message-builder.js';
import type { MessageData } from '../utils/message-builder.js';

/**
 * Service for signing messages and hashes with Ed25519 server private key
 */

interface SignHashResult {
  signature: string;
  publicKey: string;
}

interface SignMessageResult {
  hash: string;
  signature: string;
  publicKey: string;
  message: string;
}

class SigningService {
  private privateKey: Uint8Array | null = null;
  private publicKey: Uint8Array | null = null;

  constructor() {
    this.initializeKeys();
  }

  /**
   * Initialize Ed25519 keypair from environment variable
   */
  private initializeKeys(): void {
    const privateKeyHex = process.env.ED25519_PRIVATE_KEY;

    if (!privateKeyHex) {
      console.warn('ED25519_PRIVATE_KEY not found in environment. Signing service disabled.');
      return;
    }

    try {
      // Convert hex private key to Uint8Array (32 bytes)
      const privateKeyBytes = Buffer.from(privateKeyHex, 'hex');

      if (privateKeyBytes.length !== 32) {
        throw new Error(`Invalid private key length: ${privateKeyBytes.length}, expected 32 bytes`);
      }

      this.privateKey = new Uint8Array(privateKeyBytes);

      // Generate keypair from private key (tweetnacl requires full 64-byte secret key)
      const keyPair = nacl.sign.keyPair.fromSeed(this.privateKey);
      this.privateKey = keyPair.secretKey;
      this.publicKey = keyPair.publicKey;

      console.log('Ed25519 signing service initialized successfully');
      console.log('Public Key:', Buffer.from(this.publicKey).toString('hex'));
    } catch (error) {
      console.error('Failed to initialize Ed25519 signing service:', error);
      this.privateKey = null;
      this.publicKey = null;
    }
  }

  /**
   * Check if signing service is available
   */
  isAvailable(): boolean {
    return this.privateKey !== null && this.publicKey !== null;
  }

  /**
   * Sign a SHA-256 hash with Ed25519 private key
   * @param hash - SHA-256 hash (64 hex chars)
   * @returns Signature and public key
   */
  async signHash(hash: string): Promise<SignHashResult> {
    if (!this.isAvailable()) {
      throw new Error('Signing service not available. Check ED25519_PRIVATE_KEY environment variable.');
    }

    // Validate hash format
    if (!/^[0-9a-fA-F]{64}$/.test(hash)) {
      throw new Error('Invalid hash format. Expected 64 hex characters (SHA-256).');
    }

    // Convert hash to bytes
    const hashBytes = new Uint8Array(Buffer.from(hash, 'hex'));

    // Sign the hash
    const signatureBytes = nacl.sign.detached(hashBytes, this.privateKey!);

    // Convert to hex strings
    const signature = Buffer.from(signatureBytes).toString('hex');
    const publicKey = Buffer.from(this.publicKey!).toString('hex');

    return {
      signature,
      publicKey
    };
  }

  /**
   * Build message from sensor data, calculate hash, and sign
   * @param data - Sensor measurement data
   * @returns Hash, signature, public key, and message
   */
  async signMessage(data: MessageData): Promise<SignMessageResult> {
    if (!this.isAvailable()) {
      throw new Error('Signing service not available. Check ED25519_PRIVATE_KEY environment variable.');
    }

    // Validate required fields
    if (!data.sensor_id) {
      throw new Error('Missing required field: sensor_id');
    }

    // Build binary message (alphabetical order: humidity || sensor_id || temperature || timestamp)
    const message = buildMessage(data);

    // Calculate SHA-256 hash
    const hash = calculateHash(message);

    // Sign the hash
    const { signature, publicKey } = await this.signHash(hash);

    return {
      hash,
      signature,
      publicKey,
      message: message.toString('hex')
    };
  }
}

// Export singleton instance
export const signingService = new SigningService();
