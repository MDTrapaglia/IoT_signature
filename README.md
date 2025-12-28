# Sistema de Certificacion IoT de Datos en Cardano

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
- **Archivo:** `sign_device.ino` (Arduino sketch)

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
- **Archivo Principal:** `src/api_server.ts`
- **Puerto:** 3001
- **Scripts de Control:**
  - `./backend_start.sh` - Inicia el servidor backend
  - `./backend_stop.sh` - Detiene el servidor backend
  - `./test_signatures.sh` - Prueba de validacion de 4 firmas reales + 1 invalida

### C. Capa de Frontend (Dashboard)

- **Tecnologia:** Next.js 15, React, TypeScript, Tailwind CSS, Lucide React
- **Responsabilidad:**
  - Visualizacion en tiempo real con polling cada 5 segundos
  - Muestra hash, firma, clave publica y estado de verificacion
  - Indicadores visuales: verde para firmas validas, rojo para rechazadas
  - Tema oscuro (zinc palette)
- **Directorio:** `frontend/`
- **Puerto:** 3000
- **Scripts de Control:**
  - `./frontend_start.sh` - Inicia el servidor Next.js
  - `./frontend_stop.sh` - Detiene el servidor frontend
- **Configuracion:** `.env.local` (API URL y token de acceso)

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
npm install              # Instalar dependencias
npm run dev              # Servidor con hot-reload (tsx watch)
./backend_start.sh       # Iniciar backend (guarda PID en .dev.pid)
./backend_stop.sh        # Detener backend por PID
./test.sh                # Test basico con curl
./test_signatures.sh     # Test completo de validacion de firmas
```

### Frontend

```bash
cd frontend
npm install              # Instalar dependencias Next.js
npm run dev              # Servidor de desarrollo (puerto 3000)
# O desde el directorio raiz:
./frontend_start.sh      # Iniciar frontend
./frontend_stop.sh       # Detener frontend
```

## Desarrollo

### Configuracion Inicial

1. Clonar el repositorio
2. Copiar `.env.example` a `.env` y configurar `ACCESS_TOKEN`
3. Instalar dependencias: `npm install`
4. En `frontend/`, copiar `.env.example` a `.env.local`
5. Configurar `NEXT_PUBLIC_API_URL` y `NEXT_PUBLIC_ACCESS_TOKEN`

### Iniciar Sistema Completo

```bash
./backend_start.sh    # Terminal 1
./frontend_start.sh   # Terminal 2
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

## Archivos Clave

- `src/api_server.ts` - Servidor Express con validacion ECDSA
- `sign_device.ino` - Sketch Arduino para ESP32
- `test_payloads.json` - Datos de prueba con firmas reales del ESP32
- `signed_msgs.txt` - Mensajes firmados originales del dispositivo
- `CLAUDE.md` - Documentacion para Claude Code
- `frontend/app/page.tsx` - Dashboard principal de Next.js

## Testing

El script `test_signatures.sh` valida automaticamente:
- 4 firmas validas del ESP32 (retorna 201)
- 1 firma alterada (retorna 401)

```bash
./test_signatures.sh
```

## Proximos Pasos

1. **Persistencia:** Integrar PostgreSQL con Prisma ORM
2. **Cardano:** Configurar wallet y Blockfrost para Preprod
3. **Metadata:** Implementar CIP-20 para formato de metadatos
4. **Frontend:** Agregar verificador de integridad que consulte Cardanoscan
5. **Wallet:** Integrar Eternl/Nami para autorizacion de transacciones
