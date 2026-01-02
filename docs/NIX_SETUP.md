# Nix Development Environment Setup

## Overview

This project uses [Nix](https://nixos.org/) to provide a **reproducible development environment**. This means everyone working on the project has the exact same versions of Node.js, TypeScript, and all other tools, regardless of their operating system.

## Why Nix?

### Benefits

- **Reproducibility**: Identical environment across Linux, macOS, and even Windows (via WSL2)
- **Isolation**: No conflicts with system-wide packages or other projects
- **Declarative**: All dependencies defined in `flake.nix`
- **Version Control**: Environment configuration tracked in git
- **Zero Configuration**: Run `nix develop` and you're ready to code

### Use Cases

This is especially valuable for:
- Onboarding new developers (no "works on my machine" issues)
- CI/CD pipelines (exact same environment as local development)
- Long-term maintenance (reproduce environment from any commit)
- Multi-language projects (Node.js + Cardano/Aiken + Arduino tooling)

## Installation

### 1. Install Nix

#### Linux / macOS

```bash
# Install Nix with flakes and nix-command enabled
sh <(curl -L https://nixos.org/nix/install) --daemon

# Enable flakes (required for this project)
mkdir -p ~/.config/nix
echo "experimental-features = nix-command flakes" >> ~/.config/nix/nix.conf
```

#### Windows (WSL2)

First install WSL2 with Ubuntu, then follow the Linux instructions above.

### 2. Verify Installation

```bash
nix --version  # Should show nix (Nix) 2.18.0 or higher
```

### 3. (Optional) Install direnv

[direnv](https://direnv.net/) automatically loads the Nix environment when you `cd` into the project directory.

```bash
# On NixOS
nix profile install nixpkgs#direnv

# On other systems (macOS with Homebrew)
brew install direnv

# Add to your shell (bash/zsh)
echo 'eval "$(direnv hook bash)"' >> ~/.bashrc  # or ~/.zshrc
```

## Usage

### Option A: Manual Activation (No direnv)

```bash
cd /path/to/esp32_sign/full_stack

# Enter the Nix development environment
nix develop

# You're now in a shell with all tools available
node --version   # Node.js 20.x
npm --version    # npm 10.x
tsc --version    # TypeScript 5.x

# Install project dependencies
npm install

# Run the project
./scripts/backend_start.sh
./scripts/frontend_start.sh
```

### Option B: Automatic Activation (With direnv)

```bash
cd /path/to/esp32_sign/full_stack

# Allow direnv to load the environment
direnv allow

# Environment automatically loads!
# Now you can run commands directly:
npm install
./scripts/backend_start.sh
```

## What's Included

The Nix environment (`flake.nix`) provides:

### Node.js Ecosystem
- **Node.js 20 LTS**: JavaScript runtime
- **npm**: Package manager
- **TypeScript**: Type-safe JavaScript
- **tsx**: TypeScript execution with hot-reload

### Development Tools
- **Arduino CLI**: For ESP32 firmware development
- **git**: Version control
- **curl**: HTTP testing
- **jq**: JSON processing
- **procps**: Process management utilities

### Future Additions
- **Aiken**: Cardano smart contract language (install separately)
  ```bash
  nix profile install github:aiken-lang/aiken
  ```

## Customizing the Environment

### Adding New Tools

Edit `flake.nix`:

```nix
buildInputs = with pkgs; [
  nodejs_20
  # Add your package here
  postgresql  # Example: add PostgreSQL
  docker      # Example: add Docker
];
```

Then reload:
```bash
exit  # Exit nix develop shell
nix develop  # Re-enter with new packages
```

### Updating Dependencies

```bash
# Update all flake inputs to latest versions
nix flake update

# Lock specific version
nix flake lock --update-input nixpkgs
```

## Troubleshooting

### "experimental-features" Error

**Error**: `error: experimental Nix feature 'nix-command' is disabled`

**Solution**: Enable flakes in your Nix configuration:
```bash
mkdir -p ~/.config/nix
echo "experimental-features = nix-command flakes" >> ~/.config/nix/nix.conf
```

### Direnv Not Loading

**Error**: `.envrc is blocked`

**Solution**: Allow direnv to load the environment:
```bash
direnv allow
```

### Slow First Run

The first time you run `nix develop`, Nix downloads all dependencies. This can take 5-10 minutes depending on your internet connection. Subsequent runs are instant thanks to Nix's caching.

### Clear Nix Cache (Nuclear Option)

If something is broken:
```bash
# Remove project's Nix artifacts
rm -rf .direnv result*

# Garbage collect unused Nix packages
nix-collect-garbage -d
```

## Comparison with Traditional Setup

### Without Nix
```bash
# Install Node.js (version might differ per developer)
# Install npm
# Install TypeScript globally
# Install Arduino CLI
# Hope everyone has the same versions
npm install
```

### With Nix
```bash
nix develop  # Everything ready, guaranteed same versions
npm install  # Only project dependencies
```

## CI/CD Integration

Use the same environment in GitHub Actions:

```yaml
name: CI
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: cachix/install-nix-action@v22
        with:
          extra_nix_config: |
            experimental-features = nix-command flakes
      - run: nix develop --command npm install
      - run: nix develop --command npm test
```

## Learning Resources

- [Nix Official Documentation](https://nixos.org/manual/nix/stable/)
- [Nix Pills](https://nixos.org/guides/nix-pills/) - Detailed tutorial
- [Flakes Tutorial](https://nixos.wiki/wiki/Flakes)
- [Zero to Nix](https://zero-to-nix.com/) - Beginner-friendly guide

## FAQ

**Q: Do I need NixOS to use Nix?**
A: No! Nix works on Linux, macOS, and Windows (WSL2). You don't need to run NixOS.

**Q: Can I still use npm install?**
A: Yes! Nix provides the environment (Node.js, npm, etc.), you still use npm for project dependencies.

**Q: Will this conflict with my system Node.js?**
A: No. Nix environments are isolated. Your system Node.js is untouched.

**Q: What if I don't want to use Nix?**
A: No problem! You can still install Node.js, TypeScript, etc. manually. Nix is optional but recommended.

**Q: How big is the Nix installation?**
A: The Nix package manager is ~100MB. The development environment (Node.js, tools) adds ~500MB-1GB (cached and shared across projects).

## Next Steps

1. Install Nix (see Installation section)
2. Run `nix develop` in the project directory
3. Follow the main [README.md](../README.md) setup instructions
4. Start coding! 🚀
