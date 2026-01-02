# GitHub Actions Workflows

Este directorio contiene los workflows de CI/CD para el proyecto ESP32 IoT Data Certification System.

## Workflows Disponibles

### 1. CI/CD Pipeline (`ci.yml`)

**Trigger**: Push o Pull Request a las ramas `main` o `develop`

**Funcionalidad**:
- **Backend Job**:
  - Instala dependencias
  - Ejecuta linting con ESLint
  - Compila TypeScript
  - Ejecuta tests del backend
  - Sube artefactos de build

- **Frontend Job**:
  - Instala dependencias del frontend
  - Ejecuta linting (ESLint con configuración Next.js)
  - Compila Next.js build
  - Sube artefactos de build

- **Integration Job**:
  - Inicia el servidor backend
  - Ejecuta tests de API (`./scripts/test.sh`)
  - Ejecuta tests de validación de firmas (`./scripts/test_signatures.sh`)
  - Detiene el servidor

- **Quality Job**:
  - Ejecuta `npm audit` para detectar vulnerabilidades
  - Verifica la calidad del código

- **Deploy Job** (solo en `main`):
  - Descarga artefactos de build
  - Preparación para deployment automático
  - Placeholder para comandos de deployment

**Badge Status**:
```markdown
[![CI/CD Pipeline](https://github.com/MDTrapaglia/IoT_signature/actions/workflows/ci.yml/badge.svg)](https://github.com/MDTrapaglia/IoT_signature/actions/workflows/ci.yml)
```

### 2. Manual Deployment (`deploy.yml`)

**Trigger**: Manual (workflow_dispatch)

**Parámetros**:
- `environment`: Seleccionar staging o production
- `deploy_backend`: Desplegar backend (true/false)
- `deploy_frontend`: Desplegar frontend (true/false)

**Cómo ejecutar**:
1. Ve a la pestaña "Actions" en GitHub
2. Selecciona "Manual Deployment" en el sidebar
3. Haz clic en "Run workflow"
4. Selecciona los parámetros:
   - Environment: staging o production
   - Deploy backend: ✓ o ✗
   - Deploy frontend: ✓ o ✗
5. Haz clic en "Run workflow"

**Funcionalidad**:
- Builds separados para backend y frontend
- Deployment selectivo (puedes desplegar solo backend o solo frontend)
- Soporte para múltiples ambientes (staging/production)
- Creación de paquetes de deployment
- Artefactos con retención de 30 días

## Configuración de Secrets

Para que los workflows funcionen correctamente, configura estos secrets en GitHub:

1. Ve a Settings → Secrets and variables → Actions
2. Agrega los siguientes secrets:

### Required Secrets

- `API_ACCESS_TOKEN`: Token de acceso para la API backend
  - Usado en builds del frontend y tests de integración

### Optional Secrets (para deployment)

- `VERCEL_TOKEN`: Token para deployment en Vercel
- `NETLIFY_AUTH_TOKEN`: Token para deployment en Netlify
- `AWS_ACCESS_KEY_ID`: Para deployment en AWS
- `AWS_SECRET_ACCESS_KEY`: Para deployment en AWS
- `SSH_PRIVATE_KEY`: Clave SSH para deployment en VPS
- `SERVER_HOST`: Host del servidor de producción
- `SERVER_USER`: Usuario para SSH

## Environments

Configura environments en GitHub para deployment:

1. Ve a Settings → Environments
2. Crea los siguientes environments:
   - `staging`
   - `production`

3. Para cada environment, configura:
   - **Protection rules**: Requiere aprobación manual para production
   - **Environment secrets**: Secrets específicos del ambiente
   - **Deployment branches**: Limita qué ramas pueden deployar

## Scripts Disponibles

Los workflows usan los siguientes scripts de npm:

### Root package.json

```bash
npm run dev                  # Servidor dev con hot-reload
npm run build:backend        # Compilar TypeScript del backend
npm run lint:backend         # Linting del backend
npm run lint:fix             # Fix automático de linting
npm run test                 # Ejecutar todos los tests
npm run test:backend         # Tests unitarios (placeholder)
npm run test:integration     # Tests de integración
```

### Frontend package.json

```bash
npm run dev                  # Next.js dev server
npm run build                # Build de producción Next.js
npm run start                # Iniciar servidor Next.js
npm run lint                 # ESLint para frontend
```

## Customización del Deployment

Para adaptar los workflows a tu infraestructura:

### Deploy a VPS con SSH

Edita `.github/workflows/deploy.yml` en la sección "Deploy Backend" o "Deploy Frontend":

```yaml
- name: Deploy Backend
  if: inputs.deploy_backend
  run: |
    echo "${{ secrets.SSH_PRIVATE_KEY }}" > deploy_key
    chmod 600 deploy_key
    scp -i deploy_key -r deployment/dist ${{ secrets.SERVER_USER }}@${{ secrets.SERVER_HOST }}:/app/
    ssh -i deploy_key ${{ secrets.SERVER_USER }}@${{ secrets.SERVER_HOST }} 'cd /app && npm install --production && pm2 restart backend'
    rm deploy_key
```

### Deploy a Vercel

```yaml
- name: Deploy Frontend to Vercel
  if: inputs.deploy_frontend
  run: |
    npm install -g vercel
    vercel --prod --token=${{ secrets.VERCEL_TOKEN }}
  working-directory: offchain/frontend
```

### Deploy con Docker

```yaml
- name: Build and push Docker image
  if: inputs.deploy_backend
  run: |
    docker build -t ${{ secrets.DOCKER_REGISTRY }}/backend:${{ github.sha }} deployment/
    echo "${{ secrets.DOCKER_PASSWORD }}" | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin
    docker push ${{ secrets.DOCKER_REGISTRY }}/backend:${{ github.sha }}
```

## Troubleshooting

### El workflow falla en "Install dependencies"

**Solución**: Asegúrate de que `package-lock.json` esté commiteado al repositorio.

```bash
npm install
git add package-lock.json
git commit -m "Add package-lock.json"
```

### El workflow falla en "Build backend"

**Solución**: Verifica que el tsconfig.json esté correctamente configurado y que no haya errores de TypeScript.

```bash
npm run build:backend
```

### Tests de integración fallan

**Solución**: Asegúrate de que los scripts tengan permisos de ejecución:

```bash
chmod +x scripts/test.sh
chmod +x scripts/test_signatures.sh
git add scripts/
git commit -m "Add execute permissions to scripts"
```

### Deployment falla

1. Verifica que todos los secrets estén configurados correctamente
2. Revisa los logs del workflow en GitHub Actions
3. Ejecuta los comandos de deployment manualmente primero para validar

## Mejoras Futuras

- [ ] Agregar tests unitarios para backend
- [ ] Agregar tests E2E con Playwright para frontend
- [ ] Configurar deployment automático a staging en cada merge a develop
- [ ] Agregar notificaciones de Slack/Discord en deployment
- [ ] Implementar rollback automático en caso de fallo
- [ ] Agregar health checks post-deployment
- [ ] Configurar cache de dependencies para builds más rápidos
