# CI/CD Troubleshooting Guide

## Common Failure Scenarios and Solutions

### 1. Native Module Compilation Failures

#### opencv4nodejs

**Error Messages**:
```
gyp ERR! find Python
gyp ERR! Could not find OpenCV installation
Error: 'opencv4nodejs' failed to compile
```

**Solutions**:

**Ubuntu/Debian**:
```bash
sudo apt-get update
sudo apt-get install -y libopencv-dev cmake pkg-config build-essential python3
```

**macOS**:
```bash
brew install opencv cmake pkg-config
```

**Windows**:
```powershell
choco install opencv cmake python3 visualstudio2022buildtools
```

**Fallback**: Set `OPENCV_SKIP_AUTO_BUILD=1` or install without optional deps:
```bash
npm ci --no-optional
```

---

#### better-sqlite3

**Error Messages**:
```
gyp ERR! build error
gyp ERR! stack Error: `make` failed with exit code: 2
node-gyp rebuild failed
```

**Solutions**:

**Ubuntu/Debian**:
```bash
sudo apt-get install -y build-essential python3 python3-dev
```

**macOS**:
```bash
# Usually works out of the box
xcode-select --install
```

**Windows**:
```powershell
npm install --global windows-build-tools
# or
choco install python3 visualstudio2022-workload-vctools
```

---

#### keytar

**Error Messages**:
```
gyp ERR! find Python
Error: libsecret-1.so: cannot open shared object file
```

**Solutions**:

**Ubuntu/Debian**:
```bash
sudo apt-get install -y libsecret-1-dev
```

**macOS**:
```bash
# Uses system keychain - usually no extra deps needed
```

**Windows**:
```powershell
# Uses Windows Credential Manager - usually no extra deps needed
```

---

### 2. Node.js Version Issues

**Error Messages**:
```
npm ERR! engine Unsupported engine
npm ERR! Required: {"node":">=18.0.0"}
npm ERR! Actual: {"node":"16.20.2"}
```

**Solution**: Upgrade Node.js to version 18 or higher

```bash
# Using nvm
nvm install 18
nvm use 18

# Or install directly
# Ubuntu
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# macOS
brew install node@18

# Windows
choco install nodejs-lts
```

---

### 3. ESLint Configuration Errors

**Error Messages**:
```
Oops! Something went wrong! :(
ESLint: 9.15.0
Error: .eslintrc.json is no longer supported
```

**Solutions**:

**Option A - Use ESLint v8 (Recommended)**:
```bash
npm install --save-dev eslint@^8.57.0
```

**Option B - Migrate to Flat Config**:

Create `eslint.config.js`:
```javascript
const js = require('@eslint/js');

module.exports = [
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...require('globals').node,
        jest: true
      }
    },
    rules: {
      'indent': ['error', 2],
      'quotes': ['error', 'single'],
      'semi': ['error', 'always']
    }
  }
];
```

Delete `.eslintrc.json`

---

### 4. Test Failures

**Error Messages**:
```
No tests found, exiting with code 1
Jest: Failed to collect coverage from <file>
Coverage thresholds not met: 0% < 70%
```

**Solutions**:

**Add Test Files**:
```bash
# Create basic test
mkdir -p tests/unit
cat > tests/unit/basic.test.js << 'EOF'
describe('Basic Tests', () => {
  test('should pass', () => {
    expect(true).toBe(true);
  });
});
EOF
```

**Adjust Coverage Thresholds** (temporarily):

Edit `jest.config.js`:
```javascript
coverageThreshold: {
  global: {
    branches: 0,    // Temporarily 0 until tests written
    functions: 0,
    lines: 0,
    statements: 0
  }
}
```

**Skip Tests Temporarily**:

Edit workflow:
```yaml
- name: Run tests
  run: npm test
  continue-on-error: true  # Add this
```

---

### 5. Docker Build Failures

**Error Messages**:
```
ERROR [internal] load metadata for docker.io/library/node:18
failed to solve: node:18: not found
```

**Solutions**:

**Update Dockerfile**:
```dockerfile
FROM node:20-bullseye

# Install system dependencies
RUN apt-get update && apt-get install -y \\
    build-essential \\
    cmake \\
    libopencv-dev \\
    libsecret-1-dev \\
    pkg-config \\
    python3 \\
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

# Install dependencies
RUN npm ci --no-optional || npm ci

COPY . .

CMD [\"npm\", \"start\"]
```

---

### 6. Workflow Permission Errors

**Error Messages**:
```
Error: Resource not accessible by integration
HttpError: Resource not accessible by integration
```

**Solutions**:

Add permissions to workflow:
```yaml
permissions:
  contents: write
  pull-requests: write
  issues: write
```

Or enable in repository settings:
Settings → Actions → General → Workflow permissions → Read and write permissions

---

### 7. Cache-Related Issues

**Error Messages**:
```
Failed to restore cache
Cache not found for input keys
```

**Solutions**:

**Clear Cache**:
- Go to Actions → Caches → Delete all caches
- Re-run workflow

**Update Cache Key**:
```yaml
- uses: actions/setup-node@v4
  with:
    cache: 'npm'
    cache-dependency-path: '**/package-lock.json'  # Add this
```

---

### 8. Secrets Not Found

**Error Messages**:
```
Error: Snyk token is not set
Input required and not supplied: token
```

**Solutions**:

**Add Secrets**:
1. Go to Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Add required secrets:
   - `NPM_TOKEN` (for publishing)
   - `SNYK_TOKEN` (for Snyk scanning - optional)
   - `CODECOV_TOKEN` (for Codecov - optional)

**Make Secrets Optional**:
```yaml
- name: Run Snyk scan
  uses: snyk/actions/node@master
  continue-on-error: true  # Won't fail if token missing
  env:
    SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
```

---

## Platform-Specific Issues

### Ubuntu/Linux

**Issue**: Missing build tools
```bash
sh: 1: make: not found
```

**Fix**:
```bash
sudo apt-get install -y build-essential
```

---

**Issue**: Missing OpenCV
```bash
fatal error: opencv2/opencv.hpp: No such file or directory
```

**Fix**:
```bash
sudo apt-get install -y libopencv-dev
```

---

### macOS

**Issue**: Missing Xcode Command Line Tools
```bash
xcrun: error: invalid active developer path
```

**Fix**:
```bash
xcode-select --install
```

---

**Issue**: Homebrew not found
```bash
brew: command not found
```

**Fix**:
```bash
/bin/bash -c \"$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\"
```

---

### Windows

**Issue**: Python not found
```bash
gyp ERR! find Python
```

**Fix**:
```powershell
choco install python3
# or
winget install Python.Python.3.11
```

---

**Issue**: Visual Studio Build Tools missing
```bash
error MSB8020: The build tools for v142 cannot be found
```

**Fix**:
```powershell
choco install visualstudio2022buildtools --package-parameters \"--add Microsoft.VisualStudio.Workload.VCTools\"
```

---

## Quick Diagnostic Commands

### Check Node.js Version
```bash
node --version
npm --version
```

### Check Python Availability
```bash
python --version
python3 --version
which python
```

### Check Build Tools
```bash
# Linux/macOS
which make
which cmake
which gcc

# Windows
where cmake
where cl
```

### Check OpenCV
```bash
# Linux
pkg-config --modversion opencv4

# macOS
brew list opencv

# Check if opencv4nodejs can find it
npm explore opencv4nodejs -- npm run build
```

### Test npm install locally
```bash
# Full install
npm ci

# Without optional
npm ci --no-optional

# Verbose output
npm ci --loglevel verbose
```

---

## Monitoring Workflow Runs

### View Logs
1. Go to repository → Actions tab
2. Click on failed workflow run
3. Click on failed job
4. Expand step to see logs

### Download Logs
```bash
gh run download <run-id>
```

### Re-run Failed Jobs
1. Go to failed workflow run
2. Click "Re-run jobs" → "Re-run failed jobs"

---

## Performance Optimization

### Cache Node Modules
Already configured in workflow:
```yaml
- uses: actions/setup-node@v4
  with:
    cache: 'npm'
```

### Skip Native Modules in CI
Set environment variable:
```yaml
env:
  OPENCV_SKIP_AUTO_BUILD: '1'
  npm_config_build_from_source: 'false'
```

### Parallel Testing
Update jest config:
```javascript
module.exports = {
  maxWorkers: '50%',  // Use half of available CPUs
  // ...
};
```

---

## Debugging Tips

### Enable Verbose Logging
```yaml
- name: Install dependencies
  run: npm ci --loglevel verbose
```

### Add Debug Steps
```yaml
- name: Debug info
  run: |
    echo \"Node version: $(node --version)\"
    echo \"NPM version: $(npm --version)\"
    echo \"Python version: $(python --version || python3 --version)\"
    echo \"OS: ${{ runner.os }}\"
    ls -la
```

### Test Specific Platforms
```yaml
# Add to workflow for testing
if: matrix.os == 'ubuntu-latest'  # Only run on Ubuntu
```

### Use Act for Local Testing
```bash
# Install act
brew install act  # macOS
# or
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash

# Run workflow locally
act -j lint-and-test
```

---

## Emergency Fixes

### Bypass Failing Step Temporarily
```yaml
- name: Problematic step
  run: some-command
  continue-on-error: true  # Add this
```

### Skip Job Temporarily
```yaml
jobs:
  problematic-job:
    if: false  # Skip entire job
    runs-on: ubuntu-latest
```

### Cancel Workflow Early
Add to problematic job:
```yaml
- name: Cancel if condition
  if: failure()
  run: |
    echo \"Cancelling due to failure\"
    exit 1
```

---

## Best Practices

1. **Always test locally first** before pushing
2. **Use `continue-on-error`** for non-critical steps
3. **Add system dependencies** at the beginning of jobs
4. **Use specific action versions** (e.g., `@v4` not `@latest`)
5. **Keep secrets optional** with `continue-on-error: true`
6. **Cache dependencies** to speed up builds
7. **Monitor workflow run times** and optimize slow steps
8. **Document required secrets** in repository README

---

## Getting Help

### Resources
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Node.js Native Addons](https://nodejs.org/api/addons.html)
- [opencv4nodejs Docs](https://github.com/justadudewhohacks/opencv4nodejs)
- [Jest Documentation](https://jestjs.io/docs/getting-started)

### Contact
- Open an issue in this repository
- Check existing issues for similar problems
- Review `.github/README.md` for additional info

---

**Last Updated**: February 5, 2026
**Maintained By**: Trent Pierce
