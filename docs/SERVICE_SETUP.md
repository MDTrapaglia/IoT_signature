# Servicio systemd (iot-service) para backend y frontend 24/7

Archivos listos para systemd (modo usuario) que mantienen el backend (Express + auto-submission) y el frontend (Next.js) ejecutándose con reinicio automático bajo el nombre `iot-service`.

## Ubicación de los archivos

- `scripts/systemd/iot-service-backend.service`
- `scripts/systemd/iot-service-frontend.service`
- `scripts/systemd/iot-service.target`
- `scripts/systemd/start-backend.sh`
- `scripts/systemd/start-frontend.sh`

## Instalación (modo usuario)

1) Copia los units a tu carpeta de systemd de usuario:
   ```bash
   mkdir -p ~/.config/systemd/user
   cp scripts/systemd/iot-service-* ~/.config/systemd/user/
   cp scripts/systemd/iot-service.target ~/.config/systemd/user/
   ```
2) Recarga los units y arranca todo el stack:
   ```bash
   systemctl --user daemon-reload
   systemctl --user enable --now iot-service.target
   ```
3) (Opcional, recomendado) Mantenerlos activos tras cerrar sesión:
   ```bash
   loginctl enable-linger "$USER"
   ```

## Comandos útiles

- Ver estado: `systemctl --user status iot-service-backend.service iot-service-frontend.service` o `scripts/systemd/status-iot-service.sh` para estado rápido + últimos logs.
- Ver logs en vivo: `journalctl --user -u iot-service-backend.service -f` (o frontend)
- Reiniciar servicios: `systemctl --user restart iot-service-backend.service` (o frontend)
- Detener todo: `systemctl --user stop iot-service.target`
- Deshabilitar en arranque: `systemctl --user disable iot-service.target`

## Ajustes rápidos

- **Rutas**: Si mueves el repo, actualiza `WorkingDirectory` y `ExecStart` en los `.service` o crea un drop-in con `systemctl --user edit iot-service-backend.service`.
- **Comando de frontend**: Por defecto usa `npm run dev`. Si quieres modo producción, primero ejecuta `npm run build` en `offchain/frontend` y luego define `FRONTEND_COMMAND=start` en el unit (o con un drop-in).
- **Node vía nvm**: Los scripts `start-*.sh` cargan `~/.nvm/nvm.sh` si existe, para que `npm` funcione dentro de systemd.
- **Variables de entorno**: Los `.service` leen opcionalmente `.env` (backend) y `.env.local` (frontend). Si necesitas más variables, añádelas en un drop-in o exporta en esos archivos.

Con esto, backend (puerto 3001) y frontend (puerto 3000) se reinician automáticamente si fallan y arrancan al iniciar sesión.
