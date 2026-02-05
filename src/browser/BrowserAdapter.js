/**
 * ============================================================================
 * BROWSER INTERFACE - Abstract Base Class for All Browser Adapters
 * ============================================================================
 * 
 * Defines the contract that all browser implementations must follow.
 * Enables seamless switching between Chrome, Firefox, Safari, and Edge.
 * 
 * @author Trent Pierce
 * @license BrowserAgent Non-Commercial License
 * @copyright 2026 Trent Pierce
 * ============================================================================
 */

/**
 * Abstract base class for browser adapters
 * All browser implementations (Chrome, Firefox, Safari, Edge) must extend this
 */
class BrowserAdapter {
  /**
     * @param {Object} options - Browser configuration options
     * @param {boolean} options.headless - Run in headless mode
     * @param {string} options.executablePath - Path to browser executable
     * @param {Object} options.viewport - Viewport dimensions {width, height}
     * @param {Array<string>} options.args - Additional browser arguments
     * @param {Object} options.proxy - Proxy configuration
     */
  constructor(options = {}) {
    if (new.target === BrowserAdapter) {
      throw new TypeError('Cannot instantiate abstract BrowserAdapter directly');
    }
        
    this.options = {
      headless: true,
      viewport: { width: 1280, height: 720 },
      args: [],
      ...options
    };
        
    this.browser = null;
    this.pages = new Map();
    this.eventHandlers = new Map();
  }

  /**
     * Launch the browser instance
     * @returns {Promise<void>}
     * @abstract
     */
  async launch() {
    throw new Error('launch() must be implemented by subclass');
  }

  /**
     * Close the browser and all its pages
     * @returns {Promise<void>}
     * @abstract
     */
  async close() {
    throw new Error('close() must be implemented by subclass');
  }

  /**
     * Create a new page/tab
     * @param {Object} options - Page options
     * @returns {Promise<PageAdapter>} New page instance
     * @abstract
     */
  async newPage(options = {}) {
    throw new Error('newPage() must be implemented by subclass');
  }

  /**
     * Get all open pages
     * @returns {Array<PageAdapter>}
     * @abstract
     */
  pages() {
    throw new Error('pages() must be implemented by subclass');
  }

  /**
     * Get the browser version
     * @returns {Promise<string>}
     * @abstract
     */
  async version() {
    throw new Error('version() must be implemented by subclass');
  }

  /**
     * Check if browser is connected/running
     * @returns {boolean}
     * @abstract
     */
  isConnected() {
    throw new Error('isConnected() must be implemented by subclass');
  }

  /**
     * Enable request/response interception
     * @param {Function} handler - Interception handler
     * @returns {Promise<void>}
     * @abstract
     */
  async enableInterception(handler) {
    throw new Error('enableInterception() must be implemented by subclass');
  }

  /**
     * Get browser contexts (incognito profiles)
     * @returns {Array<Context>}
     * @abstract
     */
  contexts() {
    throw new Error('contexts() must be implemented by subclass');
  }

  /**
     * Create a new browser context (incognito profile)
     * @param {Object} options - Context options
     * @returns {Promise<Context>}
     * @abstract
     */
  async createContext(options = {}) {
    throw new Error('createContext() must be implemented by subclass');
  }

  /**
     * Register event handler
     * @param {string} event - Event name
     * @param {Function} handler - Event handler
     */
  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event).push(handler);
  }

  /**
     * Emit event to all registered handlers
     * @param {string} event - Event name
     * @param {*} data - Event data
     */
  emit(event, data) {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.forEach(handler => {
      try {
        handler(data);
      } catch (e) {
        console.error(`Error in event handler for ${event}:`, e);
      }
    });
  }

  /**
     * Get browser name/type
     * @returns {string}
     * @abstract
     */
  getBrowserType() {
    throw new Error('getBrowserType() must be implemented by subclass');
  }

  /**
     * Get debugging protocol endpoint
     * @returns {string|null}
     * @abstract
     */
  wsEndpoint() {
    throw new Error('wsEndpoint() must be implemented by subclass');
  }
}

module.exports = BrowserAdapter;
