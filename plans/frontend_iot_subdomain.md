# Plan: Frontend en `https://matiastrapaglia.space/iot` con nginx

Objetivo: servir el frontend de Next.js en la ruta `/iot` (subpath) de `matiastrapaglia.space`, exponiendo backend y frontend vía nginx con port forwarding estable a 3000/3001.

## Pasos propuestos
1) **Revisar configuración de Next.js**
   - Verificar/ajustar `basePath` y `assetPrefix` a `/iot` en `offchain/frontend/next.config.mjs`.
   - Confirmar que las rutas internas y `NEXT_PUBLIC_API_URL` usen `/iot/api` o el dominio raíz según se decida (ver paso 3 para el rewrite).
2) **Configurar nginx para subpath `/iot`**
   - Crear/editar server block de `matiastrapaglia.space` apuntando 80/443.
   - Añadir `location /iot/` con `proxy_pass http://127.0.0.1:3000;` y cabeceras `Host`, `X-Real-IP`, `X-Forwarded-*`; manejar WebSocket/Upgrade.
   - Añadir `location /iot/api/` que haga `rewrite ^/iot/api/(.*)$ /api/$1 break;` y `proxy_pass http://127.0.0.1:3001;`.
   - Incluir redirección 80→443 si ya hay TLS con certbot.
3) **Port forwarding y servicios locales**
   - Asegurar que el frontend escuche en 3000 y backend en 3001 (`npm run dev` o servicio en pm2/systemd).
   - Revisar firewall/ufw para permitir 80/443; no exponer 3000/3001 públicamente.
4) **Pruebas**
   - `curl -I https://matiastrapaglia.space/iot` debe responder 200/308 sin loops.
   - `curl -I "https://matiastrapaglia.space/iot/api/measurements?token=..."` debe responder 200/404 (según token) desde nginx.
   - Cargar en navegador y validar assets (sin errores 404/redirect en consola).
5) **Cleanup y automatización**
   - Recargar nginx (`nginx -t && sudo systemctl reload nginx`).
   - Documentar comandos en README/plan si se aplican cambios; opcional script de despliegue para reiniciar servicios.

## Consideraciones
- Evitar loops: forzar trailing slash consistente en `/iot/` (nginx `try_files $uri $uri/ @next;` o redirección explícita) y alinear con `basePath` de Next.
- Si se usan cookies, limpiar caché tras mover el path. Verificar que `NEXT_PUBLIC_API_URL` no genere dobles `/iot/iot`.
- Mantener HTTPS activo con certbot; renovar `certbot` si se modifica el server block.

## Progreso
- [x] BasePath y assetPrefix configurados en Next.js (`offchain/frontend/next.config.ts`) con `skipTrailingSlashRedirect` para evitar loops 308.
- [x] Defaults de API apuntan a `/iot/api` en producción; `NEXT_PUBLIC_API_URL` actualizado en `.env.example` para dominio `https://matiastrapaglia.space/iot/api`.
- [x] Config nginx de referencia agregada en `configs/nginx/matiastrapaglia_iot.conf` con rewrites `/iot/`→3000 y `/iot/api/`→3001.
- [x] Script de despliegue `scripts/deploy_nginx_iot.sh` para copiar habilitar y recargar nginx.
- [x] Script de verificación `scripts/check_iot_endpoints.sh` para testear `/iot` y `/iot/api/...`.
- [x] Aplicar/validar config nginx con rewrites `/iot/`→3000 y `/iot/api/`→3001, luego probar con curl/navegador (removido site antiguo `iot`, recarga exitosa).
- [x] Pruebas curl (remoto): `/iot` → 301 a `/iot/` (OK); `/iot/api/measurements?...` → 200 JSON de la API (nginx proxy funcional).
- [x] Ajuste de base API en frontend a `/iot` (evita doble `/api` en peticiones); `.env.example` actualizado.

## Acciones aplicadas en servidor
- Copiado y habilitado `configs/nginx/matiastrapaglia_iot.conf` en `/etc/nginx/sites-available` + symlink en `sites-enabled`.
- Deshabilitado site previo `iot` (backup en `/etc/nginx/sites-available/iot.bak`).
- `nginx -t` sin errores (se removió warn de http2); reload exitoso.
- Backend operativo en `127.0.0.1:3001`; proxy `/iot/api` devuelve JSON 200 con token válido.

## Ejemplo de config nginx (server block `matiastrapaglia.space`)
```
server {
  listen 80;
  listen 443 ssl http2;
  server_name matiastrapaglia.space;
  ssl_certificate /etc/letsencrypt/live/matiastrapaglia.space/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/matiastrapaglia.space/privkey.pem;

  # Redirect HTTP→HTTPS si no lo maneja otro block
  if ($scheme = http) {
    return 301 https://$host$request_uri;
  }

  # Frontend en /iot
  location /iot/ {
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
    proxy_pass http://127.0.0.1:3000;
    try_files $uri $uri/ @next;
  }

  location @next {
    proxy_pass http://127.0.0.1:3000;
  }

  # Backend reescrito desde /iot/api → /api
  location /iot/api/ {
    rewrite ^/iot/api/(.*)$ /api/$1 break;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_pass http://127.0.0.1:3001;
  }
}
```
