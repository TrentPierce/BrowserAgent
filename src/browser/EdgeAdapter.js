/**
 * ============================================================================
 * EDGE BROWSER ADAPTER
 * ============================================================================
 * 
 * Microsoft Edge browser implementation using Playwright.
 * Edge is Chromium-based, so it uses similar patterns to Chrome.
 * 
 * @author Trent Pierce
 * @license BrowserAgent Non-Commercial License
 * @copyright 2026 Trent Pierce
 * ============================================================================
 */

const BrowserAdapter = require('./BrowserAdapter');
const PageAdapter = require('./PageAdapter');

/**
 * Microsoft Edge browser adapter using Playwright
 */
class EdgeAdapter extends BrowserAdapter {
  /**
     * @param {Object} options - Edge-specific options
     * @param {boolean} options.headless - Run in headless mode
     * @param {string} options.executablePath - Path to Edge executable
     * @param {Object} options.channel - Edge channel ('msedge', 'msedge-beta', 'msedge-dev', 'msedge-canary')
     * @param {boolean} options.ignoreHTTPSErrors - Ignore HTTPS errors
     */
  constructor(options = {}) {
    super(options);
    this.playwright = null;
    this.channel = options.channel || 'msedge';
  }

  /**
     * Launch Edge browser
     * @returns {Promise<void>}
     */
  async launch() {
    try {
      // Use Playwright for Edge support
      const { chromium } = require('playwright');
      this.playwright = chromium;

      const launchOptions = {
        headless: this.options.headless,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          ...this.options.args
        ],
        ignoreHTTPSErrors: this.options.ignoreHTTPSErrors || true,
        channel: this.channel // Use Edge channel
      };

      if (this.options.executablePath) {
        launchOptions.executablePath = this.options.executablePath;
      }

      // Handle proxy
      if (this.options.proxy) {
        launchOptions.proxy = {
          server: typeof this.options.proxy === 'string' 
            ? this.options.proxy 
            : this.options.proxy.server
        };
        if (this.options.proxy.username) {
          launchOptions.proxy.username = this.options.proxy.username;
          launchOptions.proxy.password = this.options.proxy.password;
        }
      }

      this.browser = await chromium.launch(launchOptions);
            
      // Set up event listeners
      this.browser.on('disconnected', () => {
        this.emit('disconnected');
        this.browser = null;
      });

      this.emit('launched', { browser: 'edge' });
    } catch (error) {
      if (error.message.includes('Cannot find module')) {
        throw new Error(
          'Playwright not installed. Install with: npm install playwright'
        );
      }
      throw new Error(`Failed to launch Edge: ${error.message}`);
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

    const contextOptions = {
      viewport: options.viewport || this.options.viewport
    };

    const context = await this.browser.newContext(contextOptions);
    const playwrightPage = await context.newPage();

    const pageAdapter = new PageAdapter(playwrightPage, 'edge');
    pageAdapter._context = context;
    this.pages.set(pageAdapter.id, pageAdapter);

    playwrightPage.on('close', () => {
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
    return 'edge';
  }

  /**
     * Check if connected
     * @returns {boolean}
     */
  isConnected() {
    return this.browser !== null;
  }

  /**
     * Enable network interception
     * @param {Function} handler - Route handler
     * @returns {Promise<void>}
     */
  async enableInterception(handler) {
    this._routeHandler = handler;
  }

  /**
     * Get browser contexts
     * @returns {Array}
     */
  contexts() {
    return [];
  }

  /**
     * Create new browser context
     * @param {Object} options - Context options
     * @returns {Promise<Object>}
     */
  async createContext(options = {}) {
    if (!this.browser) {
      throw new Error('Browser not launched');
    }
    const context = await this.browser.newContext(options);
        
    if (this._routeHandler) {
      await context.route('**/*', this._routeHandler);
    }
        
    return context;
  }

  /**
     * Get browser type
     * @returns {string}
     */
  getBrowserType() {
    return 'edge';
  }

  /**
     * Get WebSocket endpoint
     * @returns {null}
     */
  wsEndpoint() {
    return null;
  }
}

module.exports = EdgeAdapter;
