/**
 * ============================================================================
 * FIREFOX BROWSER ADAPTER
 * ============================================================================
 * 
 * Firefox browser implementation using Playwright's Firefox engine.
 * Provides full Firefox compatibility with the unified BrowserAdapter API.
 * 
 * @author Trent Pierce
 * @license BrowserAgent Non-Commercial License
 * @copyright 2026 Trent Pierce
 * ============================================================================
 */

const BrowserAdapter = require('./BrowserAdapter');
const PageAdapter = require('./PageAdapter');

/**
 * Firefox browser adapter using Playwright
 */
class FirefoxAdapter extends BrowserAdapter {
  /**
     * @param {Object} options - Firefox-specific options
     * @param {boolean} options.headless - Run in headless mode
     * @param {string} options.executablePath - Path to Firefox executable
     * @param {Object} options.firefoxUserPrefs - Firefox user preferences
     * @param {boolean} options.ignoreHTTPSErrors - Ignore HTTPS errors
     */
  constructor(options = {}) {
    super(options);
    this.playwright = null;
    this.browserType = null;
  }

  /**
     * Launch Firefox browser
     * @returns {Promise<void>}
     */
  async launch() {
    try {
      // Use Playwright for Firefox support
      const { firefox } = require('playwright');
      this.playwright = firefox;

      const launchOptions = {
        headless: this.options.headless,
        args: this.options.args,
        ignoreHTTPSErrors: this.options.ignoreHTTPSErrors || true
      };

      if (this.options.executablePath) {
        launchOptions.executablePath = this.options.executablePath;
      }

      // Firefox-specific preferences
      if (this.options.firefoxUserPrefs) {
        launchOptions.firefoxUserPrefs = this.options.firefoxUserPrefs;
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

      this.browser = await firefox.launch(launchOptions);
            
      // Set up event listeners
      this.browser.on('disconnected', () => {
        this.emit('disconnected');
        this.browser = null;
      });

      this.emit('launched', { browser: 'firefox' });
    } catch (error) {
      if (error.message.includes('Cannot find module')) {
        throw new Error(
          'Playwright not installed. Install with: npm install playwright'
        );
      }
      throw new Error(`Failed to launch Firefox: ${error.message}`);
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

    // Create a new context for isolation
    const context = await this.browser.newContext(contextOptions);
    const playwrightPage = await context.newPage();

    const pageAdapter = new PageAdapter(playwrightPage, 'firefox');
    pageAdapter._context = context; // Keep reference for cleanup
    this.pages.set(pageAdapter.id, pageAdapter);

    // Track page close
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
    // Playwright doesn't expose version directly, return browser type
    return 'firefox';
  }

  /**
     * Check if connected
     * @returns {boolean}
     */
  isConnected() {
    // Playwright doesn't have isConnected, check if browser object exists
    return this.browser !== null;
  }

  /**
     * Enable network interception
     * @param {Function} handler - Route handler
     * @returns {Promise<void>}
     */
  async enableInterception(handler) {
    // Store handler for new contexts
    this._routeHandler = handler;
  }

  /**
     * Get browser contexts
     * @returns {Array}
     */
  contexts() {
    // Playwright manages contexts differently
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
        
    // Apply route handler if set
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
    return 'firefox';
  }

  /**
     * Get WebSocket endpoint
     * @returns {null}
     */
  wsEndpoint() {
    // Playwright doesn't expose WebSocket endpoint
    return null;
  }
}

module.exports = FirefoxAdapter;
