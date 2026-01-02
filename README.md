# Sistema de Certificacion IoT de Datos en Cardano

[![CI/CD Pipeline](https://github.com/MDTrapaglia/IoT_signature/actions/workflows/ci.yml/badge.svg)](https://github.com/MDTrapaglia/IoT_signature/actions/workflows/ci.yml)

## 1. Vision General

El sistema permite capturar mediciones desde un dispositivo ESP32, firmarlas criptograficamente en el origen usando ECDSA (secp256k1) y validarlas en un backend seguro. El usuario final puede visualizar a traves de un Dashboard en tiempo real el estado del sensor, la validez de la firma y los datos certificados.

**Estado Actual:** Fase 2 completada con verificacion de firmas ECDSA funcionando. Fases 3-4 (integracion con Cardano) pendientes.

## 2. Arquitectura del Sistema

### A. Capa de Dispositivo (Hardware/Edge)

- **Tecnologia:** ESP32 con soporte para criptografia ECDSA
- **Responsabilidad:**
  - Captura de datos del sensor (temperatura, humedad, etc.)
  - Firma de los datos usando el algoritmo ECDSA secp256k1
  - Envio de JSON: `{ sensor_id, hash, signature, publicKey }`
- **Archivo:** `hardware/sign_device.ino` (Arduino sketch)

### B. Capa de Backend (Orquestador)

- **Tecnologia:** Node.js, TypeScript, Express
- **Seguridad:**
  - **Autenticacion por Token:** Endpoint protegido con token de acceso (variable `ACCESS_TOKEN`)
  - **Rate Limiting:** 100 requests por 15 minutos por IP
  - **CORS:** Configurado para permitir peticiones cross-origin
- **Responsabilidad:**
  - **Validacion de Origen:** Verifica firmas ECDSA secp256k1 usando la libreria `elliptic`
  - **Almacenamiento:** In-memory (array), retorna 401 para firmas invalidas
  - **Integracion Blockchain (Futura):** MeshJS o Lucid para transacciones en Cardano
- **Archivo Principal:** `offchain/backend/api_server.ts`
- **Puerto:** 3001
- **Scripts de Control:**
  - `./scripts/backend_start.sh` - Inicia el servidor backend
  - `./scripts/backend_stop.sh` - Detiene el servidor backend
  - `./scripts/test_signatures.sh` - Prueba de validacion de 4 firmas reales + 1 invalida

### C. Capa de Frontend (Dashboard)

- **Tecnologia:** Next.js 15, React, TypeScript, Tailwind CSS, Lucide React
- **Responsabilidad:**
  - Visualizacion en tiempo real con polling cada 5 segundos
  - Muestra hash, firma, clave publica y estado de verificacion
  - Indicadores visuales: verde para firmas validas, rojo para rechazadas
  - Tema oscuro (zinc palette)
- **Directorio:** `offchain/frontend/`
- **Puerto:** 3000
- **Scripts de Control:**
  - `./scripts/frontend_start.sh` - Inicia el servidor Next.js
  - `./scripts/frontend_stop.sh` - Detiene el servidor frontend
- **Configuracion:** `offchain/frontend/.env.local` (API URL y token de acceso)

## 3. Especificaciones Tecnicas y Conexiones

### Flujo de Datos (Data Pipeline Actual)

```
ESP32 → POST /api/ingest?token=XXX → Express Backend (Verifica ECDSA)
                                            ↓
                                    (Almacenamiento In-Memory)
                                            ↓
Frontend ← GET /api/measurements?token=XXX ←┘
```

### Flujo de Datos (Futuro con Cardano)

```
ESP32 → Backend (Valida firma) → PostgreSQL → Cardano Testnet (Preprod)
                                                      ↓
Frontend ← Blockfrost API (verifica TX Hash) ←───────┘
```

### Modelo de Datos Actual

```typescript
interface ArduinoPayload {
  sensor_id: string;
  hash: string;        // SHA-256 del mensaje original
  signature: string;   // Firma ECDSA en formato hexadecimal
  publicKey: string;   // Clave publica secp256k1 (hex)
}

interface StoredMeasurement extends ArduinoPayload {
  verified: boolean;
  timestamp: number;
}
```

### Endpoints API

- `POST /api/ingest` - Recibe datos firmados del ESP32
  - Requiere token: `?token=XXX` o header `x-access-token`
  - Retorna 401 si la firma es invalida
  - Retorna 201 con `{ verified: true }` si es valida

- `GET /api/measurements` - Retorna historial de mediciones
  - Requiere token: `?token=XXX` o header `x-access-token`
  - Retorna array de mediciones con estado de verificacion

## 4. Requisitos No Funcionales Implementados

- **Seguridad:**
  - Firmas ECDSA secp256k1 verificadas criptograficamente
  - Autenticacion por token en todos los endpoints
  - Rate limiting para prevenir abuso
- **Escalabilidad:** Next.js con optimizaciones de renderizado
- **Observabilidad:** Logs de verificacion de firmas en consola

## 5. Roadmap de Implementacion

- [x] **Fase 1:** ESP32 genera firmas ECDSA para mensajes de prueba
- [x] **Fase 2:** API en Node.js verifica firmas con libreria `elliptic` + Dashboard Next.js
- [ ] **Fase 3:** Integracion con Testnet de Cardano (Preprod) para subir metadatos
- [ ] **Fase 4:** PostgreSQL + Prisma para persistencia + Enlaces a Cardanoscan

## Scripts Disponibles

### Backend

```bash
# Desarrollo
npm install                  # Instalar dependencias
npm run dev                  # Servidor con hot-reload (tsx watch)
./scripts/backend_start.sh   # Iniciar backend (guarda PID en .dev.pid)
./scripts/backend_stop.sh    # Detener backend por PID

# Build y Calidad
npm run build:backend        # Compilar TypeScript a dist/
npm run lint:backend         # Linting con ESLint
npm run lint:fix             # Fix automático de linting

# Testing
./scripts/test.sh            # Test basico con curl
./scripts/test_signatures.sh # Test completo de validacion de firmas
npm run test                 # Ejecutar todos los tests
npm run test:integration     # Solo tests de integración
```

### Frontend

```bash
cd offchain/frontend
npm install                  # Instalar dependencias Next.js
npm run dev                  # Servidor de desarrollo (puerto 3000)
npm run build                # Build de producción
npm run lint                 # ESLint para frontend

# O desde el directorio raiz:
./scripts/frontend_start.sh  # Iniciar frontend
./scripts/frontend_stop.sh   # Detener frontend
```

## CI/CD Pipeline

El proyecto incluye automatización completa con GitHub Actions:

### Pipeline de CI (Integración Continua)

Ejecutado automáticamente en cada push o pull request a `main` o `develop`:

- ✅ **Build**: Compilación de backend (TypeScript) y frontend (Next.js)
- ✅ **Linting**: Verificación de calidad de código con ESLint
- ✅ **Tests**: Ejecución de tests de API y validación de firmas ECDSA
- ✅ **Security**: Audit de vulnerabilidades con `npm audit`
- ✅ **Artifacts**: Generación de builds para deployment

### Pipeline de CD (Deployment Continuo)

Dos opciones de deployment:

1. **Automático**: Se ejecuta en cada push a `main` (preparación de artefactos)
2. **Manual**: Workflow activable desde GitHub Actions con opciones:
   - Selección de ambiente (staging/production)
   - Deployment selectivo (backend/frontend)
   - Control total del proceso

### Uso del Deployment Manual

```bash
# Desde la interfaz de GitHub:
# 1. Ir a Actions → Manual Deployment
# 2. Click en "Run workflow"
# 3. Seleccionar:
#    - Environment: staging o production
#    - Deploy backend: sí/no
#    - Deploy frontend: sí/no
# 4. Confirmar
```

### Documentación Completa

Ver [`.github/workflows/README.md`](.github/workflows/README.md) para:
- Configuración de secrets
- Customización de deployment
- Troubleshooting
- Ejemplos de deployment a diferentes plataformas

## Development

### Reproducible Development Environment with Nix (Recommended)

This project uses [Nix](https://nixos.org/) to provide a reproducible development environment with all required tools pre-configured.

#### Prerequisites

- Install Nix with flakes enabled: https://nixos.org/download.html
- Optionally install [direnv](https://direnv.net/) for automatic environment activation

#### Quick Start with Nix

```bash
# Validate your Nix installation and flake configuration
./scripts/validate_nix.sh

# Enter the Nix development environment
nix develop

# Or if you have direnv installed:
direnv allow  # Automatically loads the environment when you cd into the project
```

The Nix environment includes:
- Node.js 20 LTS
- npm, TypeScript, tsx
- Arduino CLI (for ESP32 development)
- Git, curl, jq, and other utilities

#### Benefits
- **Reproducible**: Same environment across all machines
- **Isolated**: No conflicts with system-wide packages
- **Declarative**: All dependencies defined in `flake.nix`
- **Version-pinned**: Guarantees exact tool versions

📖 **Detailed guide**: See [docs/NIX_SETUP.md](docs/NIX_SETUP.md) for complete installation instructions, troubleshooting, and advanced usage.

### Configuracion Inicial

1. Clonar el repositorio
2. Copiar `.env.example` a `.env` y configurar `ACCESS_TOKEN`
3. **(Nix)** Run `nix develop` OR **(Traditional)** Install dependencies: `npm install`
4. En `offchain/frontend/`, copiar `.env.example` a `.env.local`
5. Configurar `NEXT_PUBLIC_API_URL` y `NEXT_PUBLIC_ACCESS_TOKEN`

### Iniciar Sistema Completo

```bash
./scripts/backend_start.sh    # Terminal 1
./scripts/frontend_start.sh   # Terminal 2
```

Acceder a:
- Backend: http://localhost:3001
- Frontend Dashboard: http://localhost:3000

## Tecnologias Utilizadas

### Backend
- **Express 5** - Framework web
- **elliptic** - Verificacion de firmas ECDSA secp256k1
- **express-rate-limit** - Proteccion contra abuso
- **cors** - Manejo de CORS
- **tsx** - Ejecucion TypeScript con hot-reload

### Frontend
- **Next.js 15** - Framework React con App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Estilos utility-first
- **lucide-react** - Iconos

## Estructura del Proyecto

```
/
├── offchain/
│   ├── backend/        # API Express con validacion ECDSA
│   ├── frontend/       # Dashboard Next.js
│   └── transactions/   # Codigo de transacciones Cardano
├── onchain/
│   └── sensors-oracle/ # Contratos Aiken para Cardano
├── hardware/           # Codigo Arduino/ESP32
├── scripts/            # Scripts de gestion del sistema
├── docs/               # Documentacion
└── test-data/          # Datos de prueba

## Archivos Clave

- `offchain/backend/api_server.ts` - Servidor Express con validacion ECDSA
- `hardware/sign_device.ino` - Sketch Arduino para ESP32
- `test-data/test_payloads.json` - Datos de prueba con firmas reales del ESP32
- `test-data/signed_msgs.txt` - Mensajes firmados originales del dispositivo
- `docs/CLAUDE.md` - Documentacion para Claude Code
- `offchain/frontend/app/page.tsx` - Dashboard principal de Next.js

## Testing

El script `test_signatures.sh` valida automaticamente:
- 4 firmas validas del ESP32 (retorna 201)
- 1 firma alterada (retorna 401)

```bash
./scripts/test_signatures.sh
```

## Proximos Pasos

1. **Persistencia:** Integrar PostgreSQL con Prisma ORM
2. **Cardano:** Configurar wallet y Blockfrost para Preprod
3. **Metadata:** Implementar CIP-20 para formato de metadatos
4. **Frontend:** Agregar verificador de integridad que consulte Cardanoscan
5. **Wallet:** Integrar Eternl/Nami para autorizacion de transacciones
