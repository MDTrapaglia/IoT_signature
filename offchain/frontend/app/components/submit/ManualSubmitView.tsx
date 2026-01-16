'use client';

import { useState } from 'react';
import { Send, Hash, Key, Check, Loader2, RefreshCw } from 'lucide-react';
import { ErrorAlert } from '../shared/ErrorAlert';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { buildMessageClient, calculateHashClient } from '@/app/utils/message-builder';
import { getApiBaseUrl, API_ACCESS_TOKEN } from '@/app/utils/api';

const API_URL = getApiBaseUrl();
const ACCESS_TOKEN = API_ACCESS_TOKEN;

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export default function ManualSubmitView() {
  // Form data
  const [formData, setFormData] = useState({
    sensor_id: 'ESP32_DEMO',
    temperature: 25.0,
    humidity: 60.0,
    timestamp: Date.now()
  });

  // Cryptographic data
  const [hash, setHash] = useState('');
  const [signature, setSignature] = useState('');
  const [publicKey, setPublicKey] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [generatingHash, setGeneratingHash] = useState(false);
  const [signing, setSigning] = useState(false);

  // Validation warnings (non-blocking)
  const [hashWarning, setHashWarning] = useState<string | null>(null);
  const [signatureWarning, setSignatureWarning] = useState<string | null>(null);

  /**
   * Handle form input changes
   */
  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
    setSuccess(null);

    // Clear hash warning when data changes (hash may no longer match)
    if (field !== 'timestamp') {
      setHashWarning(null);
    }
  };

  /**
   * Validate hash against current form data
   */
  const validateHash = (hashToValidate: string) => {
    try {
      const message = buildMessageClient(formData);
      const expectedHash = calculateHashClient(message);

      if (hashToValidate.toUpperCase() !== expectedHash.toUpperCase()) {
        setHashWarning('⚠️ Hash no coincide con los datos del formulario. La transacción será rechazada on-chain.');
      } else {
        setHashWarning(null);
      }
    } catch {
      // Ignore validation errors
    }
  };

  /**
   * Handle hash change (manual edit)
   */
  const handleHashChange = (newHash: string) => {
    setHash(newHash);
    if (newHash.length === 64) {
      validateHash(newHash);
    } else {
      setHashWarning(null);
    }
  };

  /**
   * Update timestamp to current time
   */
  const handleRefreshTimestamp = () => {
    setFormData(prev => ({ ...prev, timestamp: Date.now() }));
  };

  /**
   * Generate SHA-256 hash from sensor data
   */
  const handleGenerateHash = () => {
    try {
      setGeneratingHash(true);
      setError(null);

      // Build binary message
      const message = buildMessageClient(formData);

      // Calculate SHA-256 hash
      const calculatedHash = calculateHashClient(message);

      setHash(calculatedHash);
      setHashWarning(null); // Hash is valid since we just generated it
    } catch (err: unknown) {
      setError(`Error generating hash: ${getErrorMessage(err, 'Unknown error')}`);
    } finally {
      setGeneratingHash(false);
    }
  };

  /**
   * Call backend to sign hash with server Ed25519 key
   */
  const handleSign = async () => {
    try {
      setSigning(true);
      setError(null);

      if (!hash) {
        setError('Please generate hash first');
        return;
      }

      const res = await fetch(`${API_URL}/api/sign?token=${ACCESS_TOKEN}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hash })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to sign hash');
      }

      const data = await res.json();
      setSignature(data.signature);
      setPublicKey(data.publicKey);
      setSignatureWarning(null); // Signature is valid since we just got it from server
    } catch (err: unknown) {
      setError(`Error signing: ${getErrorMessage(err, 'Unknown error')}`);
    } finally {
      setSigning(false);
    }
  };

  /**
   * Handle signature change (manual edit)
   */
  const handleSignatureChange = (newSignature: string) => {
    setSignature(newSignature);
    if (newSignature.length > 0 && newSignature.length !== 128) {
      setSignatureWarning('⚠️ Firma editada manualmente. Longitud incorrecta (debe ser 128 caracteres hex).');
    } else if (newSignature.length === 128) {
      setSignatureWarning('⚠️ Firma editada manualmente. Puede ser inválida y la transacción será rechazada on-chain.');
    } else {
      setSignatureWarning(null);
    }
  };

  /**
   * Submit complete payload to /api/ingest
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (!hash) {
        throw new Error('Please generate hash first');
      }

      if (!signature) {
        throw new Error('Please sign hash first');
      }

      const payload = {
        sensor_id: formData.sensor_id,
        temperature: Math.round(formData.temperature * 10), // Convert to int (23.5 → 235)
        humidity: Math.round(formData.humidity * 10),       // Convert to int (60.5 → 605)
        timestamp: formData.timestamp,
        hash,
        signature,
        publicKey
      };

      const res = await fetch(`${API_URL}/api/ingest?token=${ACCESS_TOKEN}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      // Handle both success (201) and invalid data (400 with measurement_id)
      if (!res.ok) {
        // If error but has measurement_id, it was saved for on-chain rejection demo
        if (data.measurement_id) {
          setSuccess(`⚠️ Medición guardada con datos inválidos! ID: ${data.measurement_id}. La medición será enviada a Cardano pero el validador on-chain la rechazará. Error: ${data.error}`);
        } else {
          throw new Error(data.error || 'Failed to submit measurement');
        }
      } else {
        // Success case
        let successMsg = `✅ Medición enviada! ID: ${data.measurement_id}`;
        if (hashWarning || signatureWarning) {
          successMsg += '. ⚠️ Datos inválidos - La transacción será rechazada on-chain.';
        }
        setSuccess(successMsg);
      }

    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to submit measurement'));
    } finally {
      setLoading(false);
    }
  };

  const isSubmitDisabled = !hash || !signature || loading;
  const hasWarnings = hashWarning || signatureWarning;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Send className="w-6 h-6 text-blue-400" />
        <h2 className="text-2xl font-bold text-zinc-100">Manual Measurement Submission</h2>
      </div>

      {/* Instructions */}
      <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-4">
        <p className="text-sm text-zinc-400">
          Fill in sensor data, generate SHA-256 hash, sign with server key, and submit to the backend.
          After submission, you&apos;ll be redirected to the measurements tab.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Sensor Data */}
        <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-zinc-100 mb-4 flex items-center gap-2">
            <Send className="w-5 h-5 text-blue-400" />
            Sensor Data
          </h3>

          <div className="space-y-4">
            {/* Sensor ID */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Sensor ID
              </label>
              <input
                type="text"
                value={formData.sensor_id}
                onChange={(e) => handleInputChange('sensor_id', e.target.value)}
                className="w-full px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-blue-500"
                placeholder="ESP32_001"
              />
            </div>

            {/* Temperature */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Temperature (°C)
              </label>
              <input
                type="number"
                step="0.1"
                value={formData.temperature}
                onChange={(e) => handleInputChange('temperature', parseFloat(e.target.value))}
                className="w-full px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-blue-500"
                placeholder="25.0"
              />
            </div>

            {/* Humidity */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Humidity (%)
              </label>
              <input
                type="number"
                step="0.1"
                value={formData.humidity}
                onChange={(e) => handleInputChange('humidity', parseFloat(e.target.value))}
                className="w-full px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-blue-500"
                placeholder="60.0"
              />
            </div>

            {/* Timestamp */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Timestamp (Unix ms)
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={formData.timestamp}
                  onChange={(e) => handleInputChange('timestamp', parseInt(e.target.value))}
                  className="flex-1 px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-blue-500 font-mono text-sm"
                  placeholder={Date.now().toString()}
                />
                <button
                  type="button"
                  onClick={handleRefreshTimestamp}
                  className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded-lg flex items-center gap-2 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Now
                </button>
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                {new Date(formData.timestamp).toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Section 2: Cryptographic Operations */}
        <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-zinc-100 mb-4 flex items-center gap-2">
            <Key className="w-5 h-5 text-yellow-400" />
            Cryptographic Operations
          </h3>

          <div className="space-y-4">
            {/* Hash */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-zinc-300">
                  SHA-256 Hash
                </label>
                <button
                  type="button"
                  onClick={handleGenerateHash}
                  disabled={generatingHash}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white text-sm rounded-lg flex items-center gap-2 transition-colors"
                >
                  {generatingHash ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Hash className="w-4 h-4" />
                      Generate Hash
                    </>
                  )}
                </button>
              </div>
              <textarea
                value={hash}
                onChange={(e) => handleHashChange(e.target.value)}
                className="w-full px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-blue-500 font-mono text-sm resize-none"
                rows={2}
                placeholder="Click 'Generate Hash' to calculate SHA-256 hash from sensor data"
              />
              {hash && !hashWarning && (
                <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Hash válido ({hash.length} characters)
                </p>
              )}
              {hashWarning && (
                <p className="text-xs text-yellow-400 mt-1 flex items-center gap-1">
                  ⚠️ {hashWarning}
                </p>
              )}
            </div>

            {/* Signature */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-zinc-300">
                  Ed25519 Signature
                </label>
                <button
                  type="button"
                  onClick={handleSign}
                  disabled={!hash || signing}
                  className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 disabled:bg-yellow-800 disabled:cursor-not-allowed text-white text-sm rounded-lg flex items-center gap-2 transition-colors"
                >
                  {signing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Signing...
                    </>
                  ) : (
                    <>
                      <Key className="w-4 h-4" />
                      Sign
                    </>
                  )}
                </button>
              </div>
              <textarea
                value={signature}
                onChange={(e) => handleSignatureChange(e.target.value)}
                className="w-full px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-blue-500 font-mono text-sm resize-none"
                rows={2}
                placeholder="Click 'Sign' to get Ed25519 signature from server"
              />
              {signature && !signatureWarning && (
                <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Firma válida ({signature.length} characters)
                </p>
              )}
              {signatureWarning && (
                <p className="text-xs text-yellow-400 mt-1 flex items-center gap-1">
                  ⚠️ {signatureWarning}
                </p>
              )}
            </div>

            {/* Public Key */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Ed25519 Public Key (read-only)
              </label>
              <input
                type="text"
                value={publicKey}
                readOnly
                className="w-full px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-400 focus:outline-none font-mono text-sm cursor-not-allowed"
                placeholder="Public key will be filled automatically after signing"
              />
              {publicKey && (
                <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Public key ({publicKey.length} characters)
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Section 3: Submission */}
        <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-zinc-100 mb-4 flex items-center gap-2">
            <Send className="w-5 h-5 text-green-400" />
            Submit to Backend
          </h3>

          {error && (
            <div className="mb-4">
              <ErrorAlert message={error} />
            </div>
          )}

          {success && (
            <div className="mb-4 flex items-center gap-3 p-4 bg-green-950/30 border border-green-700 rounded-lg text-green-400">
              <Check className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm">{success}</p>
            </div>
          )}

          {hasWarnings && !error && !success && (
            <div className="mb-4 flex items-center gap-3 p-4 bg-yellow-950/30 border border-yellow-700 rounded-lg text-yellow-400">
              <span className="text-lg flex-shrink-0">⚠️</span>
              <div className="text-sm">
                <p className="font-semibold mb-1">Advertencia: Datos Inválidos</p>
                <p className="text-xs text-yellow-300">
                  Los datos que vas a enviar contienen errores. El backend los aceptará pero la transacción será rechazada por el validador on-chain en Cardano.
                  Esto es útil para demostrar cómo funciona la validación en blockchain.
                </p>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitDisabled}
            className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? (
              <>
                <LoadingSpinner />
                Submitting...
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                Submit Measurement
              </>
            )}
          </button>

          <p className="text-xs text-zinc-500 mt-2 text-center">
            {isSubmitDisabled && !loading
              ? 'Please generate hash and sign before submitting'
              : 'The measurement will be verified and automatically submitted to Cardano'}
          </p>
        </div>
      </form>
    </div>
  );
}
