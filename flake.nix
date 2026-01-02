{
  description = "IoT Data Certification System on Cardano - Development Environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.11";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
          config.allowUnfree = true;
        };

      in {
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            # Node.js ecosystem
            nodejs_20
            nodePackages.npm
            nodePackages.typescript
            # tsx is installed via npm in package.json

            # Cardano development
            # aiken  # Install manually: https://aiken-lang.org/installation-instructions
            # Or use: nix profile install github:aiken-lang/aiken

            # Arduino/ESP32 development (optional)
            arduino-cli

            # Development utilities
            git
            curl
            jq

            # Process management
            procps
          ];

          shellHook = ''
            echo "🚀 IoT Data Certification on Cardano - Development Environment"
            echo ""
            echo "📦 Available tools:"
            echo "  • Node.js:       $(node --version)"
            echo "  • npm:           $(npm --version)"
            echo "  • TypeScript:    $(tsc --version)"
            echo "  • Arduino CLI:   $(arduino-cli version 2>/dev/null || echo 'not installed')"
            # echo "  • Aiken:         $(aiken --version 2>/dev/null || echo 'not installed')"
            # tsx is installed via npm install
            echo ""
            echo "💡 Quick start:"
            echo "  npm install                    # Install dependencies"
            echo "  ./scripts/backend_start.sh     # Start backend API"
            echo "  ./scripts/frontend_start.sh    # Start frontend dashboard"
            echo ""
            echo "📚 Documentation: README.md"
            echo ""
          '';

          # Environment variables
          NODE_ENV = "development";

          # Prevent npm from modifying PATH
          npm_config_prefix = "$HOME/.npm-global";
        };
      }
    );
}
