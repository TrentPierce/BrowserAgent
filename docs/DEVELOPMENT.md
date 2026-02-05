# Development Guide

## Prerequisites

### System Requirements

- **Node.js**: >= 18.0.0
- **npm**: >= 9.0.0
- **Python**: 3.x (for native module compilation)

### Native Dependencies

This project uses native Node.js modules that require system-level dependencies:

#### Ubuntu/Debian

```bash
sudo apt-get update
sudo apt-get install -y \
  build-essential \
  cmake \
  libopencv-dev \
  libsecret-1-dev \
  pkg-config \
  python3-dev
```

#### macOS

```bash
brew install opencv cmake pkg-config python3
```

#### Windows

```powershell
# Using Chocolatey
choco install cmake python3 visualstudio2022-workload-vctools

# Note: OpenCV on Windows requires additional setup
# Consider using vcpkg or pre-built binaries
```

## Installation

### Clone the repository

```bash
git clone https://github.com/TrentPierce/BrowserAgent.git
cd BrowserAgent
```

### Install dependencies

```bash
npm install
```

If you encounter native module compilation errors, try:

```bash
# Skip optional dependencies
npm install --no-optional

# Or set OpenCV to skip auto-build
OPENCV_SKIP_AUTO_BUILD=1 npm install
```

## Development Workflow

### Running the application

```bash
# Start Electron app
npm start

# Start in standalone mode
npm run start:standalone

# Start server mode
npm run start:server
```

### Running tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration
```

### Linting

```bash
# Run linter
npm run lint

# Fix linting issues automatically
npm run lint:fix
```

### Building

```bash
# Build documentation
npm run build

# Build Docker image
npm run docker:build

# Run with Docker Compose
npm run docker:run
```

## CI/CD Pipeline

### GitHub Actions Workflows

The project uses three main workflows:

1. **CI Pipeline** (`.github/workflows/ci.yml`)
   - Runs on push/PR to `dev` and `main` branches
   - Tests across Ubuntu, Windows, and macOS
   - Tests Node.js versions 18.x and 20.x
   - Runs linting, testing, building, and security scanning

2. **Publish to npm** (`.github/workflows/publish.yml`)
   - Triggers on version tags (e.g., `v1.0.0`)
   - Runs tests, builds package, and publishes to npm
   - Creates GitHub release with changelog

3. **Dependency Updates** (`.github/workflows/dependency-update.yml`)
   - Runs weekly on Mondays
   - Automatically updates dependencies and creates PR

### CI Status

![CI Pipeline](https://github.com/TrentPierce/BrowserAgent/actions/workflows/ci.yml/badge.svg?branch=dev)

## Troubleshooting

### Native Module Compilation Fails

**Problem**: `gyp ERR! find Python` or similar errors

**Solution**: 
1. Install Python 3.x
2. Install build tools for your platform
3. Try: `npm config set python python3`

### OpenCV Installation Issues

**Problem**: `Could not find OpenCV installation`

**Solutions**:
1. Install OpenCV system-wide (see Prerequisites)
2. Set environment variable: `export OPENCV_SKIP_AUTO_BUILD=1`
3. Consider using pre-built binaries or Docker

### Keytar/libsecret Errors

**Problem**: `Error: libsecret-1.so: cannot open shared object file`

**Solution** (Ubuntu/Debian):
```bash
sudo apt-get install libsecret-1-dev
```

### Windows Build Errors

**Problem**: Various compilation errors on Windows

**Solutions**:
1. Install Visual Studio Build Tools
2. Use `npm install --no-optional` to skip problematic native modules
3. Consider using WSL2 for better compatibility
4. Use Docker for development

### Test Failures

**Problem**: Tests fail due to missing dependencies

**Solution**: Tests are designed to gracefully handle missing native dependencies. If persistent:
1. Check Node.js version (must be >= 18.0.0)
2. Ensure all system dependencies are installed
3. Try: `npm run test:unit` first (lighter dependencies)

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Run tests: `npm test`
5. Run linter: `npm run lint:fix`
6. Commit your changes: `git commit -am 'Add new feature'`
7. Push to the branch: `git push origin feature/my-feature`
8. Create a Pull Request to the `dev` branch

## Release Process

1. Ensure all tests pass on `dev` branch
2. Update version in `package.json`
3. Commit version bump: `git commit -am 'chore: bump version to x.y.z'`
4. Create and push tag: `git tag vx.y.z && git push origin vx.y.z`
5. GitHub Actions will automatically:
   - Run tests
   - Build package
   - Publish to npm
   - Create GitHub release with changelog

## Project Structure

```
BrowserAgent/
├── .github/
│   ├── workflows/        # CI/CD workflows
│   └── changelog-config.json
├── src/
│   ├── api/             # API modules
│   ├── core/            # Core functionality
│   ├── enterprise/      # Enterprise features
│   ├── learning/        # ML/RL components
│   ├── mobile/          # Mobile automation
│   ├── providers/       # LLM providers
│   ├── testing/         # Testing utilities
│   ├── tools/           # Helper tools
│   ├── vision/          # Computer vision
│   └── index.js         # Main entry point
├── tests/
│   ├── unit/            # Unit tests
│   ├── integration/     # Integration tests
│   └── setup.js         # Test setup
├── bin/                 # CLI executables
├── docs/                # Documentation
├── examples/            # Usage examples
├── package.json
├── jest.config.js
├── .eslintrc.json
├── Dockerfile
└── docker-compose.yml
```

## License

MIT License - see LICENSE file for details
