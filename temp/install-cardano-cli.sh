#!/bin/bash
# Script para compilar cardano-cli desde fuente en ARM64
# Tiempo estimado: 1-2 horas

set -e  # Salir si hay error

echo "================================================"
echo "Instalación de cardano-cli desde fuente"
echo "================================================"

# 1. Limpiar instalaciones previas (OPCIONAL)
echo "1. Limpiando instalaciones previas..."
sudo rm -rf /tmp/libsodium /tmp/secp256k1 /tmp/cardano-node ~/.ghcup ~/.cabal

# 2. Instalar dependencias del sistema
echo "2. Instalando dependencias del sistema..."
sudo apt-get update
sudo apt-get install -y \
  automake build-essential pkg-config libffi-dev libgmp-dev \
  libssl-dev libtinfo-dev libsystemd-dev zlib1g-dev make g++ \
  tmux git jq wget libncurses-dev libtool autoconf liblmdb-dev \
  curl

# 3. Instalar libsodium
echo "3. Compilando libsodium..."
cd /tmp
git clone https://github.com/input-output-hk/libsodium
cd libsodium
git checkout dbb48cc
./autogen.sh
./configure
make -j$(nproc)
sudo make install

# 4. Instalar libsecp256k1
echo "4. Compilando libsecp256k1..."
cd /tmp
git clone https://github.com/bitcoin-core/secp256k1
cd secp256k1
./autogen.sh
./configure --enable-module-schnorrsig --enable-experimental
make -j$(nproc)
sudo make install

# 5. Actualizar cache de librerías
echo "5. Actualizando cache de librerías..."
sudo ldconfig

# 6. Instalar GHCup (Haskell toolchain)
echo "6. Instalando GHCup..."
curl --proto '=https' --tlsv1.2 -sSf https://get-ghcup.haskell.org | sh

# 7. Cargar entorno de GHCup
echo "7. Cargando entorno de GHCup..."
source $HOME/.ghcup/env

# 8. Instalar GHC 9.6.6 y Cabal 3.10.3.0
echo "8. Instalando GHC y Cabal..."
ghcup install ghc 9.6.6
ghcup install cabal 3.10.3.0
ghcup set ghc 9.6.6
ghcup set cabal 3.10.3.0

# 9. Actualizar Cabal
echo "9. Actualizando Cabal..."
cabal update

# 10. Clonar repositorio de cardano-node
echo "10. Clonando cardano-node..."
cd /tmp
git clone https://github.com/IntersectMBO/cardano-node.git
cd cardano-node

# 11. Checkout a versión estable (10.1.3)
echo "11. Checkout a versión 10.1.3..."
git fetch --all --tags
git checkout tags/10.1.3

# 12. Configurar y compilar cardano-cli
echo "12. Compilando cardano-cli (esto toma ~1 hora)..."
echo "ADVERTENCIA: Este paso consume mucha RAM y puede tomar mucho tiempo"
cabal configure --with-compiler=ghc-9.6.6
cabal build cardano-cli

# 13. Copiar binario a /usr/local/bin
echo "13. Instalando cardano-cli..."
sudo cp $(find dist-newstyle -name cardano-cli -type f | head -1) /usr/local/bin/

# 14. Verificar instalación
echo "14. Verificando instalación..."
cardano-cli --version

echo ""
echo "================================================"
echo "✅ cardano-cli instalado exitosamente!"
echo "================================================"
echo ""
echo "Versión instalada:"
cardano-cli --version
echo ""
echo "Para usar cardano-cli en nuevas sesiones, agrega a ~/.bashrc o ~/.zshrc:"
echo "  source \$HOME/.ghcup/env"
