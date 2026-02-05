/**
 * ============================================================================
 * CHROME BROWSER ADAPTER
 * ============================================================================
 * 
 * Chrome/Chromium browser implementation using Puppeteer.
 * Supports headless and headed modes, extensions, and debugging.
 * 
 * @author Trent Pierce
 * @license BrowserAgent Non-Commercial License
 * @copyright 2026 Trent Pierce
 * ============================================================================
 */

const BrowserAdapter = require('./BrowserAdapter');
const PageAdapter = require('./PageAdapter');

/**
 * Chrome/Chromium browser adapter using Puppeteer
 */
class ChromeAdapter extends BrowserAdapter {
  /**
     * @param {Object} options - Chrome-specific options
     * @param {boolean} options.headless - Run in headless mode
     * @param {string} options.executablePath - Path to Chrome executable
     * @param {Array<string>} options.extensions - Paths to extension CRX files
     * @param {boolean} options.devtools - Auto-open DevTools
     * @param {number} options.slowMo - Slow down operations by N milliseconds
     * @param {boolean} options.ignoreHTTPSErrors - Ignore HTTPS errors
     */
  constructor(options = {}) {
    super(options);
    this.puppeteer = null;
  }

  /**
     * Launch Chrome/Chromium browser
     * @returns {Promise<void>}
     */
  async launch() {
    try {
      // Dynamic import to handle optional dependency
      const puppeteer = require('puppeteer');
      this.puppeteer = puppeteer;

      const launchOptions = {
        headless: this.options.headless,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--window-size=1280,720',
          ...this.options.args
        ],
        ignoreHTTPSErrors: this.options.ignoreHTTPSErrors || true,
        slowMo: this.options.slowMo || 0,
        defaultViewport: this.options.viewport
      };

      if (this.options.executablePath) {
        launchOptions.executablePath = this.options.executablePath;
      }

      if (this.options.devtools) {
        launchOptions.devtools = true;
      }

      // Handle extensions
      if (this.options.extensions && this.options.extensions.length > 0) {
        launchOptions.args.push(
          `--disable-extensions-except=${this.options.extensions.join(',')}`,
          `--load-extension=${this.options.extensions.join(',')}`
        );
      }

      // Handle proxy
      if (this.options.proxy) {
        const proxyUrl = typeof this.options.proxy === 'string' 
          ? this.options.proxy 
          : `${this.options.proxy.server}`;
        launchOptions.args.push(`--proxy-server=${proxyUrl}`);
      }

      this.browser = await puppeteer.launch(launchOptions);
            
      // Set up event listeners
      this.browser.on('disconnected', () => {
        this.emit('disconnected');
        this.browser = null;
      });

      this.browser.on('targetcreated', (target) => {
        this.emit('targetcreated', target);
      });

      this.emit('launched', { browser: 'chrome' });
    } catch (error) {
      throw new Error(`Failed to launch Chrome: ${error.message}`);
    }
  }

  /**
     * Close the browser
     * @returns {Promise<void>}
     */
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.emit('closed');
    }
  }

  /**
     * Create a new page
     * @param {Object} options - Page options
     * @returns {Promise<PageAdapter>}
     */
  async newPage(options = {}) {
    if (!this.browser) {
      throw new Error('Browser not launched. Call launch() first.');
    }

    const puppeteerPage = await this.browser.newPage();
        
    // Set viewport if specified
    if (options.viewport) {
      await puppeteerPage.setViewport(options.viewport);
    }

    // Handle proxy authentication
    if (this.options.proxy && this.options.proxy.username) {
      await puppeteerPage.authenticate({
        username: this.options.proxy.username,
        password: this.options.proxy.password
      });
    }

    const pageAdapter = new PageAdapter(puppeteerPage, 'chrome');
    this.pages.set(pageAdapter.id, pageAdapter);

    // Track page close
    puppeteerPage.on('close', () => {
      this.pages.delete(pageAdapter.id);
    });

    return pageAdapter;
  }

  /**
     * Get all open pages
     * @returns {Array<PageAdapter>}
     */
  pages() {
    return Array.from(this.pages.values());
  }

  /**
     * Get browser version
     * @returns {Promise<string>}
     */
  async version() {
    if (!this.browser) {
      throw new Error('Browser not launched');
    }
    return await this.browser.version();
  }

  /**
     * Check if connected
     * @returns {boolean}
     */
  isConnected() {
    return this.browser ? this.browser.isConnected() : false;
  }

  /**
     * Enable network interception
     * @param {Function} handler - Route handler
     * @returns {Promise<void>}
     */
  async enableInterception(handler) {
    // Interception is handled per-page in Puppeteer
    // This sets up a default handler for new pages
    this.on('targetcreated', async (target) => {
      if (target.type() === 'page') {
        const page = await target.page();
        if (page && handler) {
          await page.setRequestInterception(true);
          page.on('request', handler);
        }
      }
    });
  }

  /**
     * Get browser contexts
     * @returns {Array}
     */
  contexts() {
    return this.browser ? this.browser.browserContexts() : [];
  }

  /**
     * Create new browser context (incognito)
     * @param {Object} options - Context options
     * @returns {Promise<Object>}
     */
  async createContext(options = {}) {
    if (!this.browser) {
      throw new Error('Browser not launched');
    }
    return await this.browser.createIncognitoBrowserContext(options);
  }

  /**
     * Get browser type
     * @returns {string}
     */
  getBrowserType() {
    return 'chrome';
  }

  /**
     * Get WebSocket endpoint for debugging
     * @returns {string|null}
     */
  wsEndpoint() {
    return this.browser ? this.browser.wsEndpoint() : null;
  }

  /**
     * Get the underlying Puppeteer browser instance
     * @returns {Object|null}
     */
  getPuppeteerBrowser() {
    return this.browser;
  }
}

module.exports = ChromeAdapter;
