# Guia para crear la pagina `/example` en matiastrapaglia

Esta guia explica como crear una pagina nueva desde cero en el frontend (Next.js, carpeta `offchain/frontend`) y publicarla bajo la ruta `/iot/example`, que sera visible en tu dominio `matiastrapaglia` (por ejemplo `https://matiastrapaglia.com/iot/example`). Incluye un ejemplo con el token `gaelito2025`.

## 1) Crear la pagina en Next.js (ruta `/example`)
1. Ir al frontend:
   ```bash
   cd offchain/frontend
   ```
2. Crear la carpeta de la ruta y el archivo:
   ```bash
   mkdir -p app/example
   ```
3. Agregar `app/example/page.tsx` con contenido base. El token `gaelito2025` se usa como demo (no es seguro guardarlo en el cliente si es un secreto real).
   ```tsx
   import Link from "next/link";

   const ACCESS_TOKEN = "gaelito2025";

   export const metadata = {
     title: "Example",
     description: "Custom example page for matiastrapaglia",
   };

   export default function ExamplePage() {
     return (
       <main className="min-h-screen bg-zinc-900 text-zinc-50 px-6 py-10">
         <section className="max-w-3xl mx-auto space-y-6">
           <h1 className="text-3xl font-semibold">Example page</h1>
           <p className="text-zinc-300">
             This page lives under the <code>/iot/example</code> path because the app uses a basePath.
           </p>
           <p className="text-zinc-300">
             Token (demo only): <span className="font-mono">{ACCESS_TOKEN}</span>
           </p>
           <Link
             href="/example"
             className="text-blue-400 hover:text-blue-300 underline underline-offset-4"
           >
             Back to dashboard
           </Link>
         </section>
       </main>
     );
   }
   ```
   Notas:
   - El proyecto tiene `basePath: "/iot"` en `next.config.ts`, por lo que la ruta publica sera `/iot/example`. Los `Link` de Next.js prefijan `/iot` de forma automatica.
   - Usa nombres y texto en ingles en el codigo para respetar el estandar del repositorio.

## 2) Probar local
```bash
npm run dev
# Abrir en el navegador:
# http://localhost:3000/iot/example
```

## 3) Enlazar desde el dashboard (opcional)
- Si quieres un enlace visible, puedes agregar un `<a href="/example">` en `app/components/layout/Header.tsx` o en cualquier componente de UI.
- Si necesitas un tab nuevo en la navegacion principal, modifica `app/components/layout/TabNavigation.tsx` para agregar el tab y maneja su contenido en `app/page.tsx`.

## 4) Publicar en el dominio o subdominio
- La basePath hace que la URL final sea `https://matiastrapaglia.com/iot/example` (ajusta el dominio segun tu DNS).
- Para un subdominio dedicado como `example.matiastrapaglia.com`, crea un registro DNS (CNAME o A) apuntando al host donde corre Next.js y agrega una regla en tu proxy inverso (Nginx/Apache):
  ```nginx
  server {
    server_name example.matiastrapaglia.com;
    location / {
      proxy_pass http://localhost:3000;  # puerto donde corre npm run start
    }
    location = / {
      return 302 /iot/example;
    }
  }
  ```
  Asi `example.matiastrapaglia.com` redirige a la ruta `"/iot/example"` ya servida por Next.js.

## 5) Sobre el token `gaelito2025`
- En el ejemplo anterior se muestra en el cliente (visible para cualquier usuario). Si el token debe ser secreto, colocalo en el backend o en variables de entorno y valida la peticion en el servidor en lugar de exponerlo en el cliente.
- Si solo necesitas un check basico en el cliente, puedes leer `?token=gaelito2025` desde la URL y mostrar el contenido condicionalmente, sabiendo que no es seguro para control de acceso real.
