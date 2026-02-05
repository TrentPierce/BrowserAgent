# 🚀 Quick Start Guide - BrowserAgent

This guide shows you **all the ways** to start and use BrowserAgent.

---

## ⚡ Fastest Way to Start (Library Mode)

The **easiest and most reliable** way to use BrowserAgent is programmatically in your JavaScript code:

```javascript
const { createAgent } = require('@trentpierce/browser-agent');

async function main() {
    // Create and initialize agent
    const agent = await createAgent({
        provider: 'gemini',
        apiKey: process.env.GEMINI_API_KEY,
        headless: false  // Set to true for headless mode
    });

    // Navigate to a website
    await agent.goto('https://example.com');

    // Perform actions
    await agent.act('Click the login button');
    await agent.type('#username', 'myuser');
    await agent.type('#password', 'mypass');
    await agent.act('Click submit');

    // Extract information
    const data = await agent.extract('Get all product prices');
    console.log(data);

    // Clean up
    await agent.close();
}

main().catch(console.error);
```

**Save as `test.js` and run:**
```bash
node test.js
```

---

## 🖥️ Method 1: Standalone Mode (Electron GUI)

**⚠️ Requires Electron to be installed**

```bash
# Make sure electron is installed (it's a devDependency)
npm install

# Start the Electron GUI
npm start

# OR use the CLI
node bin/browser-agent.js standalone
```

**Note:** If `npm start` doesn't work, electron might not be installed. Run `npm install` first.

---

## 🌐 Method 2: Server Mode (REST API)

Start BrowserAgent as an API server:

```bash
# Start the server
npm run start:server

# OR with custom port
node bin/browser-agent.js server --port 8080 --ws-port 8081
```

**The server provides:**
- REST API at `http://localhost:3000`
- WebSocket at `ws://localhost:3001`

### Example API Usage:

```bash
# Create a session
curl -X POST http://localhost:3000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"provider": "gemini", "headless": false}'

# Navigate
curl -X POST http://localhost:3000/api/sessions/{id}/navigate \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'

# Execute action
curl -X POST http://localhost:3000/api/sessions/{id}/action \
  -H "Content-Type: application/json" \
  -d '{"action": "Click the login button"}'
```

---

## ☁️ Method 3: Browserbase Cloud Mode

Use Browserbase for cloud browser automation (no local browser needed):

```javascript
const { BrowserbaseProvider } = require('@trentpierce/browser-agent/enterprise');
const puppeteer = require('puppeteer');

async function main() {
    // Create Browserbase session
    const provider = new BrowserbaseProvider(
        process.env.BROWSERBASE_API_KEY,
        {
            projectId: process.env.BROWSERBASE_PROJECT_ID,
            stealth: true
        }
    );

    await provider.init();

    // Connect Puppeteer to Browserbase
    const { browser, page } = await provider.connectPuppeteer(puppeteer);

    // Use normally
    await page.goto('https://example.com');
    await page.screenshot({ path: 'screenshot.png' });

    // Get recording for compliance
    const recording = await provider.getSessionRecording();
    console.log('Recording:', recording);

    await provider.close();
}

main().catch(console.error);
```

---

## 🤖 Method 4: Using Different LLM Providers

### Google Gemini (Default)
```javascript
const agent = await createAgent({
    provider: 'gemini',
    apiKey: process.env.GEMINI_API_KEY
});
```

### OpenAI
```javascript
const agent = await createAgent({
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY
});
```

### Anthropic Claude
```javascript
const agent = await createAgent({
    provider: 'anthropic',
    apiKey: process.env.ANTHROPIC_API_KEY
});
```

---

## 📱 Method 5: Mobile Automation

```javascript
const { MobileAgent } = require('@trentpierce/browser-agent/mobile');

async function main() {
    const agent = new MobileAgent({
        platform: 'android',
        deviceName: 'Pixel_6_API_33',
        appPackage: 'com.example.app'
    });

    await agent.initialize();

    // Mobile-specific actions
    await agent.tap('Login');
    await agent.type('#username', 'testuser');
    await agent.swipe({ direction: 'up' });
    await agent.screenshot('./screen.png');

    await agent.close();
}

main().catch(console.error);
```

**Prerequisites:**
```bash
npm install webdriverio @wdio/cli
npm install -g appium
appium --port 4723
```

---

## 🧪 Method 6: Run Tests

```bash
# Run all tests
npm test

# Run specific test
npm test -- tests/integration/basic.test.js

# Run with coverage
npm run test:coverage
```

---

## 🐳 Method 7: Docker

```bash
# Build Docker image
npm run docker:build

# Run with Docker Compose
npm run docker:run

# Stop
npm run docker:stop
```

---

## 🔧 Troubleshooting

### Issue: `npm start` doesn't work

**Solution:**
```bash
# Install all dependencies including devDependencies
npm install

# If that doesn't work, install electron explicitly
npm install -D electron

# Then try again
npm start
```

### Issue: "Cannot find module 'puppeteer'"

**Solution:**
```bash
# Puppeteer is an optional dependency
npm install puppeteer
```

### Issue: "API key not found"

**Solution:**
```bash
# Create .env file
cp .env.example .env

# Edit .env and add your API keys
# GEMINI_API_KEY=your_key_here
# OPENAI_API_KEY=your_key_here
# ANTHROPIC_API_KEY=your_key_here
```

### Issue: "Electron failed to install"

**Solution:** Use library mode instead (Method 1 above) - it's the recommended way anyway!

---

## 📝 Environment Setup

Create a `.env` file in the project root:

```env
# Required - Choose one
GEMINI_API_KEY=your_gemini_api_key
# OPENAI_API_KEY=your_openai_key
# ANTHROPIC_API_KEY=your_anthropic_key

# Optional - For Browserbase
BROWSERBASE_API_KEY=your_browserbase_key
BROWSERBASE_PROJECT_ID=your_project_id

# Optional - For mobile automation
APPIUM_HOST=localhost
APPIUM_PORT=4723
```

---

## 🎯 Recommended Workflow

For **development and testing**:
1. Use **Library Mode** (Method 1) - Most flexible
2. Use **Server Mode** (Method 2) - For API integration

For **production**:
1. Use **Browserbase Mode** (Method 3) - Scalable, no local browser
2. Use **Server Mode** (Method 2) - With Docker

For **mobile testing**:
1. Use **Mobile Mode** (Method 5)

---

## 📚 Next Steps

- Read [CONTRIBUTING.md](CONTRIBUTING.md) for development setup
- Check [ENTERPRISE_AUDIT_REPORT.md](ENTERPRISE_AUDIT_REPORT.md) for architecture details
- See examples in `examples/` directory

---

**Need Help?** Open an issue at https://github.com/TrentPierce/BrowserAgent/issues
