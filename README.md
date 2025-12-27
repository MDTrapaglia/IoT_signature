# Sistema de Certificacion IoT de Datos en Cardano

## 1. Vision General

El sistema permite capturar mediciones desde un dispositivo Arduino, firmarlas criptograficamente en el origen y subirlas a la blockchain de Cardano. El usuario final puede visualizar a traves de un Dashboard el estado del sensor, la validez de la firma y la prueba de inmutabilidad (Transaction ID) en la red.

## 2. Arquitectura del Sistema

### A. Capa de Dispositivo (Hardware/Edge)

- **Tecnologia:** Arduino (ESP32 recomendado por capacidad de memoria)
- **Responsabilidad:**
  - Captura de datos del sensor
  - Firma de los datos usando el algoritmo Ed25519
  - Envio de JSON: `{ data: {...}, signature: "...", public_key: "..." }`

### B. Capa de Backend (Orquestador)

- **Tecnologia:** Node.js, TypeScript, Express
- **Responsabilidad:**
  - **Validacion de Origen:** Verifica que la firma del Arduino sea valida antes de gastar fees de red
  - **Integracion Blockchain:** Utiliza MeshJS o Lucid para construir la transaccion que incluye los datos en los metadatos (Standard CIP-20)
  - **Persistencia:** Guarda una copia en PostgreSQL para acceso rapido (cache)

### C. Capa de Frontend (Dashboard)

- **Tecnologia:** Next.js (React), Tailwind CSS, Lucide React
- **Responsabilidad:**
  - Visualizacion en tiempo real (WebSockets o Polling)
  - Verificador de Integridad: Un boton que compare el dato local vs. el dato consultado en la red mediante Blockfrost
  - Conexion de Wallet (Eternl/Nami) para que el administrador autorice la subida de datos

## 3. Especificaciones Tecnicas y Conexiones

### Flujo de Datos (Data Pipeline)

```
Arduino --> Backend: Comunicacion via REST API (HTTP Post)
Backend --> Database: Registro del estado "Pending"
Backend --> Cardano: El Backend prepara la transaccion (Hot Wallet o firma manual)
Cardano --> Frontend: Consulta el Transaction Hash usando Blockfrost
```

### Modelo de Datos (Esquema Sugerido)

| Campo      | Tipo   | Descripcion                                            |
|------------|--------|--------------------------------------------------------|
| sensor_id  | UUID   | Identificador unico del hardware                       |
| payload    | JSON   | Datos de la medicion (ej: temperatura, humedad)        |
| signature  | String | Firma generada por el Arduino                          |
| tx_hash    | String | Hash de la transaccion en Cardano (Null si pendiente)  |
| status     | Enum   | `pending`, `confirmed`, `failed`                       |

## 4. Requisitos No Funcionales

- **Seguridad:** Implementacion de firmas Ed25519 (criptografia aplicada)
- **Escalabilidad:** Uso de Next.js para optimizar el SEO y la carga del Dashboard
- **Observabilidad:** Logs detallados del proceso de minado de la transaccion

## 5. Roadmap de Implementacion

- [ ] **Fase 1:** Script de Arduino que firme un "Hello World"
- [ ] **Fase 2:** API en Node.js que reciba el JSON y verifique la firma con la clave publica del Arduino
- [ ] **Fase 3:** Integracion con la Testnet de Cardano (Preprod) para subir los metadatos
- [ ] **Fase 4:** Frontend en Next.js con graficos de las mediciones y enlaces a Cardanoscan

## Scripts Disponibles

```bash
./start.sh   # Inicia el servidor (mata proceso previo si existe)
./stop.sh    # Detiene el servidor
./test.sh    # Envia curl de prueba al API
```

## Desarrollo

```bash
npm install
npm run dev
```

### Endpoints

- `POST /api/ingest` - Recibe datos del sensor
- `GET /api/measurements` - Consulta historial de mediciones
