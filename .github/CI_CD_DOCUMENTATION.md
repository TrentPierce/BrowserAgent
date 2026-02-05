# GitHub Actions CI/CD Documentation

## Overview

This directory contains the CI/CD workflows and configurations for the BrowserAgent project.

## Workflows

### 1. CI Pipeline (`ci.yml`)

**Triggers**: Push and Pull Requests to `dev` and `main` branches

**Jobs**:
- **lint-and-test**: Runs linting and tests across multiple platforms and Node.js versions
- **build**: Creates build artifacts
- **security-scan**: Performs security scanning with npm audit, Snyk, and CodeQL
- **dependency-review**: Reviews dependencies in pull requests
- **docker-build**: Tests Docker image building

**Platform Matrix**:
- Ubuntu Latest
- Windows Latest
- macOS Latest

**Node.js Versions**:
- 18.x
- 20.x

### 2. Publish Pipeline (`publish.yml`)

**Triggers**: Git tags matching `v*.*.*` pattern

**Jobs**:
- **test**: Run tests before publishing
- **build**: Build package
- **publish**: Publish to npm
- **create-release**: Create GitHub release with changelog

### 3. Dependency Updates (`dependency-update.yml`)

**Triggers**: 
- Weekly schedule (Mondays)
- Manual workflow dispatch

**Purpose**: Automatically update dependencies and create pull requests

## Native Dependencies

The project uses native Node.js modules that require system-level dependencies:

### opencv4nodejs
- **Ubuntu**: `libopencv-dev`, `cmake`, `pkg-config`
- **macOS**: `opencv`, `cmake`, `pkg-config` (via Homebrew)
- **Windows**: CMake, Python (via Chocolatey)

### better-sqlite3
- **All Platforms**: Python, build tools

### keytar
- **Ubuntu**: `libsecret-1-dev`
- **macOS**: Keychain (built-in)
- **Windows**: Credential Manager (built-in)

## Troubleshooting

### Issue: Native Module Compilation Failures

**Symptoms**:
```
npm ERR! gyp ERR! find Python
npm ERR! Error: not found: python
```

**Solution**:
1. Ensure system dependencies are installed (see workflow)
2. Check that Python 3 is available
3. Verify build tools are installed

**Fallback**: Native modules are marked as `optionalDependencies`, so the build will continue without them.

### Issue: ESLint Configuration Errors

**Symptoms**:
```
Error: ESLint configuration in .eslintrc.json is invalid
```

**Solution**:
- ESLint v8 is used for compatibility with `.eslintrc.json` format
- If upgrading to ESLint v9, migrate to flat config (`eslint.config.js`)

### Issue: Test Failures

**Current Test Suite**:
- `tests/unit/core.test.js` - Core module tests
- `tests/unit/utils.test.js` - Utility tests
- `tests/integration/basic.test.js` - Integration tests

**Coverage Requirements**: 70% for branches, functions, lines, and statements

### Issue: Windows-Specific Failures

**Known Issues**:
- OpenCV compilation often fails on Windows
- Workflow uses `continue-on-error` for Windows + optional deps

**Workaround**: 
- Tests run with `--no-optional` flag as fallback
- Core functionality still validated

## Configuration Files

### changelog-config.json

Configures automated changelog generation for releases.

**Categories**:
- 🚀 Features
- 🐛 Bug Fixes
- 📚 Documentation
- 🔧 Maintenance
- 🔒 Security
- ⚡ Performance

**Conventional Commits**: Automatically categorizes commits starting with `feat:`, `fix:`, `docs:`, `chore:`

## Secrets Required

### For CI/CD:
- `GITHUB_TOKEN` (automatically provided)

### For Publishing:
- `NPM_TOKEN` - Required for publishing to npm registry

### Optional:
- `SNYK_TOKEN` - For Snyk security scanning
- `CODECOV_TOKEN` - For code coverage reporting (can work without it)

## Adding New Dependencies

### Regular Dependencies
Add to `dependencies` in `package.json`

### Native Dependencies
Add to `optionalDependencies` and:
1. Update system dependency installation in workflow
2. Add fallback handling in code
3. Document in this README

### Dev Dependencies
Add to `devDependencies` - no special handling needed

## Local Development Setup

### Prerequisites
```bash
# Ubuntu/Debian
sudo apt-get install build-essential cmake libopencv-dev libsecret-1-dev pkg-config python3

# macOS
brew install opencv cmake pkg-config

# Windows
choco install cmake python3 visualstudio2022buildtools
```

### Install Dependencies
```bash
npm install
# or without optional dependencies
npm install --no-optional
```

### Run Tests
```bash
npm test
# or specific suites
npm run test:unit
npm run test:integration
```

### Run Linting
```bash
npm run lint
# auto-fix issues
npm run lint:fix
```

## Workflow Maintenance

### Updating Node.js Versions
Edit matrix in `ci.yml`:
```yaml
matrix:
  node-version: [18.x, 20.x, 22.x]  # Add new versions
```

### Updating System Dependencies
Modify the platform-specific steps in `ci.yml`:
```yaml
- name: Install system dependencies (Ubuntu)
  run: |
    sudo apt-get install -y <new-package>
```

### Updating Actions Versions
Check for updates:
- `actions/checkout@v4`
- `actions/setup-node@v4`
- `actions/setup-python@v5`

Use Dependabot to automate this.

## Performance Optimization

### Caching
- npm cache: Automatically handled by `actions/setup-node@v4`
- Docker cache: Uses `type=gha` for GitHub Actions cache

### Build Speed
- Native modules: ~2-5 minutes compile time
- Regular dependencies: ~30-60 seconds
- Tests: ~10-30 seconds

## Security Considerations

### CodeQL Analysis
- Runs on all pushes to main branches
- Scans for security vulnerabilities
- Results viewable in Security tab

### Dependency Scanning
- npm audit: Checks for known vulnerabilities
- Snyk: Additional security scanning (if token provided)
- Dependency Review: Blocks PRs with vulnerable dependencies

## Contributing

When adding new workflows or modifying existing ones:
1. Test locally with act: `act -j lint-and-test`
2. Create feature branch
3. Use conventional commits
4. Ensure all checks pass
5. Request review

## Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Native Node.js Modules](https://nodejs.org/api/addons.html)
- [opencv4nodejs](https://github.com/justadudewhohacks/opencv4nodejs)
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)
- [ESLint v8 Documentation](https://eslint.org/docs/v8.x/)
