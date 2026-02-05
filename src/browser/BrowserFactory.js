/**
 * ============================================================================
 * BROWSER FACTORY - Unified Browser Creation
 * ============================================================================
 * 
 * Factory pattern for creating browser instances across all supported browsers.
 * Provides a unified API for launching Chrome, Firefox, Safari, and Edge.
 * 
 * @author Trent Pierce
 * @license BrowserAgent Non-Commercial License
 * @copyright 2026 Trent Pierce
 * ============================================================================
 */

const ChromeAdapter = require('./ChromeAdapter');
const FirefoxAdapter = require('./FirefoxAdapter');
const SafariAdapter = require('./SafariAdapter');
const EdgeAdapter = require('./EdgeAdapter');

/**
 * Supported browser types
 */
const BROWSER_TYPES = {
  CHROME: 'chrome',
  CHROMIUM: 'chromium',
  FIREFOX: 'firefox',
  SAFARI: 'safari',
  WEBKIT: 'webkit',
  EDGE: 'edge'
};

/**
 * Factory for creating browser adapters
 */
class BrowserFactory {
  /**
     * Create a browser adapter
     * @param {string} browserType - Type of browser to create
     * @param {Object} options - Browser options
     * @returns {BrowserAdapter}
     */
  static create(browserType, options = {}) {
    const type = browserType.toLowerCase();

    switch (type) {
      case BROWSER_TYPES.CHROME:
      case BROWSER_TYPES.CHROMIUM:
        return new ChromeAdapter(options);

      case BROWSER_TYPES.FIREFOX:
        return new FirefoxAdapter(options);

      case BROWSER_TYPES.SAFARI:
      case BROWSER_TYPES.WEBKIT:
        return new SafariAdapter(options);

      case BROWSER_TYPES.EDGE:
        return new EdgeAdapter(options);

      default:
        throw new Error(
          `Unsupported browser type: ${browserType}. ` +
                    `Supported types: ${Object.values(BROWSER_TYPES).join(', ')}`
        );
    }
  }

  /**
     * Launch a browser with the given type
     * @param {string} browserType - Type of browser to launch
     * @param {Object} options - Browser options
     * @returns {Promise<BrowserAdapter>}
     */
  static async launch(browserType, options = {}) {
    const browser = this.create(browserType, options);
    await browser.launch();
    return browser;
  }

  /**
     * Launch multiple browsers in parallel
     * @param {Array<{type: string, options: Object}>} configurations - Browser configurations
     * @returns {Promise<Array<BrowserAdapter>>}
     */
  static async launchMultiple(configurations) {
    const launchPromises = configurations.map(config => {
      return this.launch(config.type, config.options || {});
    });

    return await Promise.all(launchPromises);
  }

  /**
     * Get available browser types
     * @returns {Array<string>}
     */
  static getAvailableTypes() {
    return Object.values(BROWSER_TYPES);
  }

  /**
     * Check if browser type is supported
     * @param {string} browserType - Browser type to check
     * @returns {boolean}
     */
  static isSupported(browserType) {
    return Object.values(BROWSER_TYPES).includes(browserType.toLowerCase());
  }

  /**
     * Launch browser with auto-install if needed
     * @param {string} browserType - Type of browser
     * @param {Object} options - Browser options
     * @returns {Promise<BrowserAdapter>}
     */
  static async launchWithInstall(browserType, options = {}) {
    try {
      return await this.launch(browserType, options);
    } catch (error) {
      if (error.message.includes('executablePath') || 
                error.message.includes('not installed')) {
        console.log(`Installing ${browserType} browser...`);
        await this.installBrowser(browserType);
        return await this.launch(browserType, options);
      }
      throw error;
    }
  }

  /**
     * Install browser binaries
     * @param {string} browserType - Browser to install
     * @returns {Promise<void>}
     */
  static async installBrowser(browserType) {
    const type = browserType.toLowerCase();
        
    try {
      // For Chrome/Chromium via Puppeteer
      if (type === BROWSER_TYPES.CHROME || type === BROWSER_TYPES.CHROMIUM) {
        const { install } = require('puppeteer/install');
        await install();
        return;
      }

      // For Firefox, Safari, Edge via Playwright
      if ([BROWSER_TYPES.FIREFOX, BROWSER_TYPES.SAFARI, BROWSER_TYPES.WEBKIT, BROWSER_TYPES.EDGE].includes(type)) {
        const { installBrowsersForNpmInstall } = require('playwright/lib/server');
        await installBrowsersForNpmInstall([type === 'safari' ? 'webkit' : type]);
        return;
      }
    } catch (error) {
      console.error(`Failed to install ${browserType}:`, error.message);
      throw new Error(
        `Please install ${browserType} manually:\n` +
                '- For Chrome: npm install puppeteer\n' +
                `- For Firefox/Safari/Edge: npm install playwright && npx playwright install ${type === 'safari' ? 'webkit' : type}`
      );
    }
  }

  /**
     * Create headless browser (default for CI/CD)
     * @param {string} browserType - Type of browser
     * @param {Object} options - Additional options
     * @returns {Promise<BrowserAdapter>}
     */
  static async createHeadless(browserType, options = {}) {
    return await this.launch(browserType, {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      ...options
    });
  }

  /**
     * Create headed browser (with visible window)
     * @param {string} browserType - Type of browser
     * @param {Object} options - Additional options
     * @returns {Promise<BrowserAdapter>}
     */
  static async createHeaded(browserType, options = {}) {
    return await this.launch(browserType, {
      headless: false,
      ...options
    });
  }

  /**
     * Launch browser for debugging
     * @param {string} browserType - Type of browser
     * @param {Object} options - Additional options
     * @returns {Promise<BrowserAdapter>}
     */
  static async createForDebugging(browserType, options = {}) {
    return await this.launch(browserType, {
      headless: false,
      devtools: true,
      slowMo: 100, // Slow down operations for visibility
      ...options
    });
  }
}

module.exports = {
  BrowserFactory,
  BROWSER_TYPES
};
