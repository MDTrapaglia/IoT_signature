#!/usr/bin/env bash
#
# Nix Development Environment Validation Script
# Verifies that Nix is properly installed and configured
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Nix Development Environment Validation ===${NC}\n"

# Function to print status
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $2"
    else
        echo -e "${RED}✗${NC} $2"
    fi
}

# Function to print info
print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Function to print warning
print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# 1. Check if Nix is installed
echo "Checking Nix installation..."
if command -v nix &> /dev/null; then
    NIX_VERSION=$(nix --version 2>/dev/null || echo "unknown")
    print_status 0 "Nix is installed: $NIX_VERSION"
else
    print_status 1 "Nix is not installed"
    echo -e "\n${YELLOW}Install Nix with:${NC}"
    echo "  curl -L https://nixos.org/nix/install | sh -s -- --daemon"
    exit 1
fi

# 2. Check if flakes are enabled
echo -e "\nChecking Nix configuration..."
if [ -f ~/.config/nix/nix.conf ]; then
    if grep -q "experimental-features.*flakes" ~/.config/nix/nix.conf; then
        print_status 0 "Flakes are enabled"
    else
        print_status 1 "Flakes are not enabled in ~/.config/nix/nix.conf"
        echo -e "\n${YELLOW}Enable flakes with:${NC}"
        echo '  echo "experimental-features = nix-command flakes" >> ~/.config/nix/nix.conf'
        exit 1
    fi
else
    print_status 1 "Nix config file not found: ~/.config/nix/nix.conf"
    echo -e "\n${YELLOW}Create config and enable flakes:${NC}"
    echo '  mkdir -p ~/.config/nix'
    echo '  echo "experimental-features = nix-command flakes" >> ~/.config/nix/nix.conf'
    exit 1
fi

# 3. Check if flake.nix exists
echo -e "\nChecking project flake..."
if [ -f flake.nix ]; then
    print_status 0 "flake.nix found"
else
    print_status 1 "flake.nix not found in project root"
    exit 1
fi

# 4. Validate flake syntax
echo -e "\nValidating flake.nix syntax..."
if nix flake show . --no-write-lock-file &> /dev/null; then
    print_status 0 "flake.nix syntax is valid"
else
    print_status 1 "flake.nix has syntax errors"
    echo -e "\n${YELLOW}Run this to see the error:${NC}"
    echo "  nix flake show ."
    exit 1
fi

# 5. Check if flake.lock exists (informational)
echo -e "\nChecking flake lock file..."
if [ -f flake.lock ]; then
    print_status 0 "flake.lock exists (dependencies are pinned)"
else
    print_warning "flake.lock not found (will be created on first run)"
    print_info "This is normal for first-time setup"
fi

# 6. Test development shell
echo -e "\nTesting development shell..."
print_info "Attempting to build development shell (this may take a few minutes on first run)..."
if timeout 300 nix develop . --command true &> /dev/null; then
    print_status 0 "Development shell can be built and entered"
else
    print_status 1 "Development shell has configuration errors"
    echo -e "\n${YELLOW}Run this to see the error:${NC}"
    echo "  nix develop . --command true"
    exit 1
fi

# 7. List available tools in the shell
echo -e "\n${GREEN}=== Available Tools in Development Shell ===${NC}\n"
nix develop . --command bash -c '
echo "Node.js:      $(node --version)"
echo "npm:          $(npm --version)"
echo "TypeScript:   $(tsc --version)"
echo "Arduino CLI:  $(arduino-cli version 2>/dev/null || echo not available)"
echo "Git:          $(git --version)"
echo "Curl:         $(curl --version 2>&1 | grep curl)"
echo "jq:           $(jq --version)"
echo ""
echo "Note: tsx is installed via npm (run npm install in the project)"
'

# Success message
echo -e "\n${GREEN}=== ✓ All checks passed! ===${NC}\n"
echo -e "${BLUE}Quick start:${NC}"
echo "  1. Enter the development environment:"
echo "     ${YELLOW}nix develop${NC}"
echo ""
echo "  2. Install project dependencies:"
echo "     ${YELLOW}npm install${NC}"
echo ""
echo "  3. Start the backend:"
echo "     ${YELLOW}./scripts/backend_start.sh${NC}"
echo ""
echo "  4. Start the frontend:"
echo "     ${YELLOW}./scripts/frontend_start.sh${NC}"
echo ""
echo -e "${BLUE}Tip:${NC} Use ${YELLOW}direnv${NC} for automatic environment activation:"
echo "  ${YELLOW}direnv allow${NC}"
echo ""
