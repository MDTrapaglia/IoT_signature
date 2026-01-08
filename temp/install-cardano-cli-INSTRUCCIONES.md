# Instalación de cardano-cli desde fuente

## ⏱️ Tiempo estimado: 1-2 horas

## 📋 Requisitos
- Sistema: Debian/Ubuntu ARM64
- RAM: Mínimo 4GB (recomendado 8GB)
- Espacio en disco: ~10GB libres
- Conexión a internet estable

## 🚀 Opción 1: Script Automático (Recomendado)

```bash
cd /home/mtrapaglia/projects/esp32_sign/full_stack/temp
chmod +x install-cardano-cli.sh
./install-cardano-cli.sh
```

**Notas:**
- El script puede tardar 1-2 horas en completar
- Durante la compilación, el sistema puede estar lento
- Si falla, revisar logs de error y reintentar desde el paso que falló

## 🔧 Opción 2: Comandos Manuales

Si prefieres ejecutar paso a paso:

### 1. Limpiar instalaciones previas (OPCIONAL)
```bash
sudo rm -rf /tmp/libsodium /tmp/secp256k1 /tmp/cardano-node ~/.ghcup ~/.cabal
```

### 2. Dependencias del sistema
```bash
sudo apt-get update
sudo apt-get install -y automake build-essential pkg-config libffi-dev \
  libgmp-dev libssl-dev libtinfo-dev libsystemd-dev zlib1g-dev make g++ \
  tmux git jq wget libncurses-dev libtool autoconf liblmdb-dev curl
```

### 3. libsodium
```bash
cd /tmp
git clone https://github.com/input-output-hk/libsodium
cd libsodium
git checkout dbb48cc
./autogen.sh
./configure
make -j$(nproc)
sudo make install
```

### 4. libsecp256k1
```bash
cd /tmp
git clone https://github.com/bitcoin-core/secp256k1
cd secp256k1
./autogen.sh
./configure --enable-module-schnorrsig --enable-experimental
make -j$(nproc)
sudo make install
```

### 5. Actualizar cache de librerías
```bash
sudo ldconfig
```

### 6. Instalar GHCup (Haskell toolchain)
```bash
curl --proto '=https' --tlsv1.2 -sSf https://get-ghcup.haskell.org | sh
```

Cuando pregunte, responde:
- "Do you want to install haskell-language-server (HLS)?" → **NO** (n)
- "Do you want to install stack?" → **NO** (n)
- "Do you want to enable better integration of stack with GHCup?" → **NO** (n)
- "Press ENTER to proceed" → **ENTER**

### 7. Cargar entorno GHCup
```bash
source $HOME/.ghcup/env
```

### 8. Instalar GHC y Cabal
```bash
ghcup install ghc 9.6.6
ghcup install cabal 3.10.3.0
ghcup set ghc 9.6.6
ghcup set cabal 3.10.3.0
```

### 9. Actualizar Cabal
```bash
cabal update
```

### 10. Clonar cardano-node
```bash
cd /tmp
git clone https://github.com/IntersectMBO/cardano-node.git
cd cardano-node
```

### 11. Checkout versión estable
```bash
git fetch --all --tags
git checkout tags/10.1.3
```

### 12. Compilar cardano-cli ⏱️ ~1 hora
```bash
cabal configure --with-compiler=ghc-9.6.6
cabal build cardano-cli
```

**ADVERTENCIA:** Este paso:
- Toma ~1 hora o más
- Consume mucha RAM (puede usar swap)
- Descarga y compila muchas dependencias de Haskell

### 13. Instalar binario
```bash
sudo cp $(find dist-newstyle -name cardano-cli -type f | head -1) /usr/local/bin/
```

### 14. Verificar instalación
```bash
cardano-cli --version
```

Debería mostrar algo como:
```
cardano-cli 10.1.3 - linux-aarch64 - ghc-9.6
```

## ✅ Post-instalación

### Agregar al PATH permanentemente

Agrega esto a `~/.bashrc` o `~/.zshrc`:
```bash
source $HOME/.ghcup/env
export LD_LIBRARY_PATH="/usr/local/lib:$LD_LIBRARY_PATH"
```

Luego recarga:
```bash
source ~/.bashrc  # o source ~/.zshrc
```

## 🧹 Limpiar archivos temporales

Una vez instalado, puedes limpiar:
```bash
rm -rf /tmp/libsodium /tmp/secp256k1 /tmp/cardano-node
```

## ❌ Troubleshooting

### Error: "command not found: ghcup"
```bash
source $HOME/.ghcup/env
```

### Error: "cannot find -lsodium"
```bash
sudo ldconfig
export LD_LIBRARY_PATH="/usr/local/lib:$LD_LIBRARY_PATH"
```

### Error: "out of memory" durante compilación
```bash
# Usar menos cores para compilación paralela
cabal build cardano-cli -j2  # en lugar de -j$(nproc)
```

### Error: versión incorrecta de GHC
```bash
ghcup set ghc 9.6.6
ghcup set cabal 3.10.3.0
```

## 📝 Próximos pasos después de instalar

Una vez instalado cardano-cli:

1. Volver al proyecto:
   ```bash
   cd /home/mtrapaglia/projects/esp32_sign/full_stack
   ```

2. Ejecutar script de validación on-chain (a crear):
   ```bash
   # El script usará cardano-cli para construir y enviar la transacción
   npm run test:simple:cli
   ```

3. Actualizar documentación en `temp/fase1-progress.md`
