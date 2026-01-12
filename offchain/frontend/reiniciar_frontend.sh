#!/bin/bash
echo "🔄 Reiniciando frontend de Next.js..."

# Matar procesos de Next.js
pkill -f "next dev"

# Limpiar cache de Next.js
rm -rf .next

echo "✅ Frontend limpio. Ahora ejecuta: npm run dev"
