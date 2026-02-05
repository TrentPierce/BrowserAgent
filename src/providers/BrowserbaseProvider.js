/**
 * BrowserbaseProvider - Cloud browser automation provider
 * Integrates with Browserbase (browserbase.com) for scalable, managed browser instances
 * @module BrowserbaseProvider
 * @version 2.2.0
 *
 * IMPORTANT: This is an ORIGINAL implementation that uses Browserbase's public REST API.
 * This code does NOT contain any proprietary Browserbase source code.
 * It makes standard HTTP API calls using axios to interact with Browserbase's service.
 *
 * This implementation:
 * - Uses only the public documented API (https://api.browserbase.com)
 * - Contains 100% original code written for BrowserAgent
 * - Uses axios (MIT licensed) for HTTP requests
 * - Complies with all Browserbase terms of service
 *
 * API Documentation: https://docs.browserbase.com
 */

const axios = require('axios');

/**
 * Custom error classes for better error handling
 */
class BrowserbaseError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'BrowserbaseError';
    this.code = code;
    this.details = details;
  }
}

class AuthenticationError extends BrowserbaseError {
  constructor(message = 'Authentication failed') {
    super(message, 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
  }
}

class SessionNotFoundError extends BrowserbaseError {
  constructor(message = 'Session not found') {
    super(message, 'SESSION_NOT_FOUND');
    this.name = 'SessionNotFoundError';
  }
}

class RateLimitError extends BrowserbaseError {
  constructor(message = 'Rate limit exceeded') {
    super(message, 'RATE_LIMIT_EXCEEDED');
    this.name = 'RateLimitError';
  }
}

class NetworkError extends BrowserbaseError {
  constructor(message = 'Network error occurred') {
    super(message, 'NETWORK_ERROR');
    this.name = 'NetworkError';
  }
}

/**
 * Browserbase Provider for cloud-based browser automation
 * Supports Puppeteer and Playwright connections to Browserbase managed browsers
 */
class BrowserbaseProvider {
  /**
   * Create a new BrowserbaseProvider instance
   * @param {string} apiKey - Browserbase API key
   * @param {Object} config - Provider configuration
   * @param {string} config.projectId - Browserbase project ID
   * @param {string} config.region - Browserbase region (default: 'us-west-2')
   * @param {boolean} config.stealth - Enable stealth mode (default: true)
   * @param {Object} config.proxy - Proxy configuration
   * @param {string} config.browser - Browser type: 'chrome' or 'firefox' (default: 'chrome')
   * @param {string} config.resolution - Screen resolution (default: '1920x1080')
   * @param {number} config.timeout - Request timeout in ms (default: 30000)
   * @param {number} config.maxRetries - Maximum retry attempts for failed requests (default: 3)
   * @param {number} config.retryDelay - Initial retry delay in ms (default: 1000)
   * @param {boolean} config.keepAlive - Enable keep-alive for longer sessions (default: false)
   * @param {boolean} config.recording - Enable session recording (default: true)
   * @param {boolean} config.logging - Enable session logging (default: true)
   * @param {Object} config.metadata - Custom metadata for the session
   * @param {number} config.sessionTimeout - Session idle timeout in ms (default: 300000)
   * @param {string} config.contextId - Browser context ID to use
   * @param {Array<string>} config.extensionIds - List of browser extension IDs to load
   * @param {string} config.apiBaseURL - Custom API base URL (default: 'https://api.browserbase.com/v1')
   */
  constructor(apiKey, config = {}) {
    if (!apiKey) {
      throw new AuthenticationError('Browserbase API key is required');
    }

    this.apiKey = apiKey;
    this.config = {
      projectId: config.projectId || process.env.BROWSERBASE_PROJECT_ID,
      region: config.region || 'us-west-2',
      stealth: config.stealth !== false,
      proxy: config.proxy || null,
      browser: config.browser || 'chrome',
      resolution: config.resolution || '1920x1080',
      timeout: config.timeout || 30000,
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000,
      keepAlive: config.keepAlive || false,
      recording: config.recording !== false,
      logging: config.logging !== false,
      metadata: config.metadata || {},
      sessionTimeout: config.sessionTimeout || 300000,
      contextId: config.contextId || null,
      extensionIds: config.extensionIds || [],
      ...config
    };

    // Use the correct API base URL
    this.baseURL = config.apiBaseURL || 'https://api.browserbase.com/v1';
    this.sessionId = null;
    this.connectURL = null;
    this.debuggerUrl = null;
    this.liveViewUrl = null;
    this.browser = null;
    this.page = null;
    this.initialized = false;

    // Statistics tracking
    this.stats = {
      sessionsCreated: 0,
      sessionsClosed: 0,
      actionsExecuted: 0,
      screenshotsTaken: 0,
      downloadsCaptured: 0,
      pdfsGenerated: 0,
      errors: []
    };
  }

  /**
   * Initialize the Browserbase provider
   * Creates a new browser session on Browserbase
   * @returns {Promise<Object>} Session details including ID, debug URL, and live view URL
   * @throws {BrowserbaseError} If initialization fails
   */
  async init() {
    if (this.initialized) {
      throw new BrowserbaseError('BrowserbaseProvider already initialized', 'ALREADY_INITIALIZED');
    }

    try {
      // Create a new session on Browserbase
      const session = await this.createSession();
      this.sessionId = session.id;
      this.connectURL = session.connectUrl;
      this.debuggerUrl = session.debuggerUrl;
      this.liveViewUrl = session.liveViewUrl;
      this.initialized = true;

      console.log(`✅ Browserbase session created: ${this.sessionId}`);
      return session;
    } catch (error) {
      this.stats.errors.push({
        timestamp: new Date().toISOString(),
        action: 'init',
        error: error.message,
        code: error.code || 'UNKNOWN'
      });
      throw error;
    }
  }

  /**
   * Retry request with exponential backoff
   * @private
   * @param {Function} requestFn - Function to execute that returns a Promise
   * @returns {Promise<any>} Result of the request function
   * @throws {BrowserbaseError} If all retry attempts fail
   */
  async _retryRequest(requestFn) {
    let lastError;
    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        lastError = this._normalizeError(error);

        // Don't retry on authentication errors
        if (lastError.code === 'AUTHENTICATION_ERROR') {
          throw lastError;
        }

        // Don't retry on the last attempt
        if (attempt === this.config.maxRetries - 1) {
          break;
        }

        // Calculate delay with exponential backoff
        const delay = this.config.retryDelay * Math.pow(2, attempt);
        console.warn(`Retry attempt ${attempt + 1}/${this.config.maxRetries} after ${delay}ms`);
        await this._sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * Sleep for a specified duration
   * @private
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Normalize error to appropriate error class
   * @private
   * @param {Error} error - Original error
   * @returns {BrowserbaseError} Normalized error
   */
  _normalizeError(error) {
    if (error instanceof BrowserbaseError) {
      return error;
    }

    const status = error.response?.status;
    const message = error.response?.data?.error || error.message;

    switch (status) {
      case 401:
      case 403:
        return new AuthenticationError(message);
      case 404:
        return new SessionNotFoundError(message);
      case 429:
        return new RateLimitError(message);
      default:
        if (error.code === 'ECONNABORTED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
          return new NetworkError(error.message);
        }
        return new BrowserbaseError(message, 'UNKNOWN', { originalError: error });
    }
  }

  /**
   * Create a new browser session on Browserbase
   * @private
   * @returns {Promise<Object>} Session details
   * @throws {AuthenticationError} If authentication fails
   * @throws {RateLimitError} If rate limit is exceeded
   * @throws {NetworkError} If network error occurs
   */
  async createSession() {
    const sessionBody = {
      projectId: this.config.projectId,
      browser: this.config.browser,
      stealth: this.config.stealth,
      resolution: this.config.resolution,
      keepAlive: this.config.keepAlive,
      recording: this.config.recording,
      logging: this.config.logging,
      timeout: this.config.sessionTimeout
    };

    // Add proxy configuration if provided
    if (this.config.proxy) {
      sessionBody.proxy = this.config.proxy;
    }

    // Add context ID if provided
    if (this.config.contextId) {
      sessionBody.contextId = this.config.contextId;
    }

    // Add extensions if provided
    if (this.config.extensionIds.length > 0) {
      sessionBody.extensionIds = this.config.extensionIds;
    }

    // Add metadata if provided
    if (Object.keys(this.config.metadata).length > 0) {
      sessionBody.metadata = this.config.metadata;
    }

    return this._retryRequest(async () => {
      const response = await axios.post(
        `${this.baseURL}/sessions`,
        sessionBody,
        {
          headers: {
            'X-BB-API-Key': this.apiKey,
            'Content-Type': 'application/json'
          },
          timeout: this.config.timeout
        }
      );

      this.stats.sessionsCreated++;
      return response.data;
    });
  }

  /**
   * Get the WebSocket debugger URL for Puppeteer/Playwright connection
   * @returns {Promise<string>} WebSocket URL
   * @throws {BrowserbaseError} If no active session or API call fails
   */
  async getConnectURL() {
    if (!this.sessionId) {
      throw new BrowserbaseError('No active session. Call init() first.', 'NO_SESSION');
    }

    // Return cached debugger URL if available
    if (this.debuggerUrl) {
      return this.debuggerUrl;
    }

    return this._retryRequest(async () => {
      const response = await axios.get(
        `${this.baseURL}/sessions/${this.sessionId}/debug`,
        {
          headers: {
            'X-BB-API-Key': this.apiKey
          },
          timeout: this.config.timeout
        }
      );

      this.debuggerUrl = response.data.debuggerUrl;
      return this.debuggerUrl;
    });
  }

  /**
   * Connect Puppeteer to the Browserbase session
   * @param {Object} puppeteer - Puppeteer instance
   * @param {Object} options - Connection options
   * @param {Object} options.viewport - Custom viewport settings
   * @returns {Promise<Object>} { browser, page }
   * @throws {BrowserbaseError} If connection fails
   */
  async connectPuppeteer(puppeteer, options = {}) {
    if (!this.initialized) {
      await this.init();
    }

    const wsEndpoint = await this.getConnectURL();

    this.browser = await puppeteer.connect({
      browserWSEndpoint: wsEndpoint,
      defaultViewport: options.viewport || {
        width: 1920,
        height: 1080
      }
    });

    // Get or create a page
    const pages = await this.browser.pages();
    this.page = pages[0] || await this.browser.newPage();

    this.stats.actionsExecuted++;
    return { browser: this.browser, page: this.page };
  }

  /**
   * Connect Playwright to the Browserbase session
   * @param {Object} playwright - Playwright instance
   * @param {Object} options - Connection options
   * @param {Object} options.viewport - Custom viewport settings
   * @returns {Promise<Object>} { browser, context, page }
   * @throws {BrowserbaseError} If connection fails
   */
  async connectPlaywright(playwright, options = {}) {
    if (!this.initialized) {
      await this.init();
    }

    const wsEndpoint = await this.getConnectURL();

    this.browser = await playwright.chromium.connectOverCDP(wsEndpoint);
    const context = this.browser.contexts()[0] || await this.browser.newContext(options);
    this.page = context.pages()[0] || await context.newPage();

    this.stats.actionsExecuted++;
    return { browser: this.browser, context, page: this.page };
  }

  /**
   * Get session logs
   * @returns {Promise<Array>} Session logs
   * @throws {BrowserbaseError} If no active session or API call fails
   */
  async getSessionLogs() {
    if (!this.sessionId) {
      throw new BrowserbaseError('No active session', 'NO_SESSION');
    }

    return this._retryRequest(async () => {
      const response = await axios.get(
        `${this.baseURL}/sessions/${this.sessionId}/logs`,
        {
          headers: {
            'X-BB-API-Key': this.apiKey
          },
          timeout: this.config.timeout
        }
      );

      return response.data;
    });
  }

  /**
   * Get session recording URL
   * @returns {Promise<string>} Recording URL
   * @throws {BrowserbaseError} If no active session or API call fails
   */
  async getSessionRecording() {
    if (!this.sessionId) {
      throw new BrowserbaseError('No active session', 'NO_SESSION');
    }

    return this._retryRequest(async () => {
      const response = await axios.get(
        `${this.baseURL}/sessions/${this.sessionId}/recording`,
        {
          headers: {
            'X-BB-API-Key': this.apiKey
          },
          timeout: this.config.timeout
        }
      );

      return response.data.recordingUrl;
    });
  }

  /**
   * Get live view URL for the session
   * @returns {Promise<string>} Live view URL
   * @throws {BrowserbaseError} If no active session or API call fails
   */
  async getLiveViewUrl() {
    if (!this.sessionId) {
      throw new BrowserbaseError('No active session', 'NO_SESSION');
    }

    // Return cached live view URL if available
    if (this.liveViewUrl) {
      return this.liveViewUrl;
    }

    return this._retryRequest(async () => {
      const response = await axios.get(
        `${this.baseURL}/sessions/${this.sessionId}/live`,
        {
          headers: {
            'X-BB-API-Key': this.apiKey
          },
          timeout: this.config.timeout
        }
      );

      this.liveViewUrl = response.data.liveUrl;
      return this.liveViewUrl;
    });
  }

  /**
   * Generate a PDF of the current page via Browserbase API
   * @param {Object} options - PDF generation options
   * @param {boolean} options.printBackground - Print background graphics (default: true)
   * @param {boolean} options.landscape - Use landscape orientation (default: false)
   * @param {string} options.format - Paper format: 'Letter', 'Legal', 'Tabloid', 'A4' (default: 'A4')
   * @param {number} options.scale - Scale of the webpage rendering (default: 1.0)
   * @returns {Promise<Buffer>} PDF buffer
   * @throws {BrowserbaseError} If no active page or API call fails
   */
  async generatePDF(options = {}) {
    if (!this.page) {
      throw new BrowserbaseError('Browser not connected. Call connectPuppeteer() or connectPlaywright() first.', 'NO_BROWSER');
    }

    const pdf = await this.page.pdf({
      printBackground: options.printBackground !== false,
      landscape: options.landscape || false,
      format: options.format || 'A4',
      scale: options.scale || 1.0,
      margin: options.margin || {
        top: '1cm',
        right: '1cm',
        bottom: '1cm',
        left: '1cm'
      }
    });

    this.stats.pdfsGenerated++;
    return pdf;
  }

  /**
   * Get session status with detailed information
   * @returns {Promise<Object>} Session status details
   * @throws {BrowserbaseError} If no active session or API call fails
   */
  async getSessionStatus() {
    if (!this.sessionId) {
      throw new BrowserbaseError('No active session', 'NO_SESSION');
    }

    return this._retryRequest(async () => {
      const response = await axios.get(
        `${this.baseURL}/sessions/${this.sessionId}`,
        {
          headers: {
            'X-BB-API-Key': this.apiKey
          },
          timeout: this.config.timeout
        }
      );

      return response.data;
    });
  }

  /**
   * Get session downloads
   * @returns {Promise<Array>} Downloaded files
   * @throws {BrowserbaseError} If no active session or API call fails
   */
  async getSessionDownloads() {
    if (!this.sessionId) {
      throw new BrowserbaseError('No active session', 'NO_SESSION');
    }

    return this._retryRequest(async () => {
      const response = await axios.get(
        `${this.baseURL}/sessions/${this.sessionId}/downloads`,
        {
          headers: {
            'X-BB-API-Key': this.apiKey
          },
          timeout: this.config.timeout
        }
      );

      this.stats.downloadsCaptured += response.data.length || 0;
      return response.data;
    });
  }

  /**
   * Take a screenshot via connected browser
   * @param {Object} options - Screenshot options
   * @param {boolean} options.fullPage - Capture full page (default: false)
   * @param {string} options.type - Image type: 'png' or 'jpeg' (default: 'png')
   * @param {string} options.encoding - Encoding: 'base64' or 'binary' (default: 'binary')
   * @param {number} options.quality - JPEG quality 0-100 (for JPEG only)
   * @param {Object} options.clip - Clip area {x, y, width, height}
   * @returns {Promise<Buffer|string>} Screenshot buffer or base64 string
   * @throws {BrowserbaseError} If browser not connected
   */
  async takeScreenshot(options = {}) {
    if (!this.page) {
      throw new BrowserbaseError(
        'Browser not connected. Call connectPuppeteer() or connectPlaywright() first.',
        'NO_BROWSER'
      );
    }

    const screenshot = await this.page.screenshot({
      fullPage: options.fullPage || false,
      type: options.type || 'png',
      encoding: options.encoding || 'binary',
      quality: options.quality,
      clip: options.clip
    });

    this.stats.screenshotsTaken++;
    return screenshot;
  }

  /**
   * Upload a file to the session
   * @param {string|Buffer} file - File path or buffer
   * @param {string} filename - Filename
   * @returns {Promise<Object>} Upload result
   * @throws {BrowserbaseError} If no active session or upload fails
   */
  async uploadFile(file, filename) {
    if (!this.sessionId) {
      throw new BrowserbaseError('No active session', 'NO_SESSION');
    }

    if (!filename) {
      throw new BrowserbaseError('Filename is required', 'INVALID_PARAMETER');
    }

    const FormData = require('form-data');
    const fs = require('fs');
    const form = new FormData();

    if (typeof file === 'string') {
      form.append('file', fs.createReadStream(file), filename);
    } else {
      form.append('file', file, filename);
    }

    return this._retryRequest(async () => {
      const response = await axios.post(
        `${this.baseURL}/sessions/${this.sessionId}/uploads`,
        form,
        {
          headers: {
            'X-BB-API-Key': this.apiKey,
            ...form.getHeaders()
          },
          timeout: this.config.timeout * 2 // Uploads may take longer
        }
      );

      return response.data;
    });
  }

  /**
   * Update session (e.g., enable/disable stealth, update metadata)
   * @param {Object} updates - Updates to apply
   * @param {boolean} updates.stealth - Enable/disable stealth mode
   * @param {Object} updates.metadata - Update session metadata
   * @returns {Promise<Object>} Updated session
   * @throws {BrowserbaseError} If no active session or API call fails
   */
  async updateSession(updates) {
    if (!this.sessionId) {
      throw new BrowserbaseError('No active session', 'NO_SESSION');
    }

    return this._retryRequest(async () => {
      const response = await axios.patch(
        `${this.baseURL}/sessions/${this.sessionId}`,
        updates,
        {
          headers: {
            'X-BB-API-Key': this.apiKey,
            'Content-Type': 'application/json'
          },
          timeout: this.config.timeout
        }
      );

      return response.data;
    });
  }

  /**
   * Get active sessions for the project
   * @param {Object} filters - Optional filters
   * @param {string} filters.status - Session status filter (default: 'active')
   * @param {number} filters.limit - Maximum number of sessions to return
   * @returns {Promise<Array>} Active sessions
   * @throws {BrowserbaseError} If API call fails
   */
  async listActiveSessions(filters = {}) {
    return this._retryRequest(async () => {
      const params = {
        projectId: this.config.projectId,
        status: filters.status || 'active'
      };

      if (filters.limit) {
        params.limit = filters.limit;
      }

      const response = await axios.get(
        `${this.baseURL}/sessions`,
        {
          headers: {
            'X-BB-API-Key': this.apiKey
          },
          params,
          timeout: this.config.timeout
        }
      );

      return response.data;
    });
  }

  // ============ Contexts API ============

  /**
   * List all browser contexts for the project
   * @returns {Promise<Array>} List of contexts
   * @throws {BrowserbaseError} If API call fails
   */
  async listContexts() {
    return this._retryRequest(async () => {
      const response = await axios.get(
        `${this.baseURL}/contexts`,
        {
          headers: {
            'X-BB-API-Key': this.apiKey
          },
          params: {
            projectId: this.config.projectId
          },
          timeout: this.config.timeout
        }
      );

      return response.data;
    });
  }

  /**
   * Get details of a specific context
   * @param {string} contextId - Context ID
   * @returns {Promise<Object>} Context details
   * @throws {BrowserbaseError} If API call fails
   */
  async getContext(contextId) {
    if (!contextId) {
      throw new BrowserbaseError('Context ID is required', 'INVALID_PARAMETER');
    }

    return this._retryRequest(async () => {
      const response = await axios.get(
        `${this.baseURL}/contexts/${contextId}`,
        {
          headers: {
            'X-BB-API-Key': this.apiKey
          },
          timeout: this.config.timeout
        }
      );

      return response.data;
    });
  }

  /**
   * Create a new browser context
   * @param {Object} contextConfig - Context configuration
   * @param {string} contextConfig.name - Context name
   * @param {string} contextConfig.projectId - Project ID
   * @param {Object} contextConfig.persist - Persistence options
   * @param {Array} contextConfig.extensions - Extensions to include
   * @returns {Promise<Object>} Created context details
   * @throws {BrowserbaseError} If API call fails
   */
  async createContext(contextConfig) {
    if (!contextConfig.name) {
      throw new BrowserbaseError('Context name is required', 'INVALID_PARAMETER');
    }

    return this._retryRequest(async () => {
      const response = await axios.post(
        `${this.baseURL}/contexts`,
        {
          ...contextConfig,
          projectId: contextConfig.projectId || this.config.projectId
        },
        {
          headers: {
            'X-BB-API-Key': this.apiKey,
            'Content-Type': 'application/json'
          },
          timeout: this.config.timeout
        }
      );

      return response.data;
    });
  }

  /**
   * Delete a browser context
   * @param {string} contextId - Context ID to delete
   * @returns {Promise<void>}
   * @throws {BrowserbaseError} If API call fails
   */
  async deleteContext(contextId) {
    if (!contextId) {
      throw new BrowserbaseError('Context ID is required', 'INVALID_PARAMETER');
    }

    return this._retryRequest(async () => {
      await axios.delete(
        `${this.baseURL}/contexts/${contextId}`,
        {
          headers: {
            'X-BB-API-Key': this.apiKey
          },
          timeout: this.config.timeout
        }
      );
    });
  }

  // ============ Browser Extensions API ============

  /**
   * List all browser extensions for the project
   * @returns {Promise<Array>} List of extensions
   * @throws {BrowserbaseError} If API call fails
   */
  async listExtensions() {
    return this._retryRequest(async () => {
      const response = await axios.get(
        `${this.baseURL}/extensions`,
        {
          headers: {
            'X-BB-API-Key': this.apiKey
          },
          params: {
            projectId: this.config.projectId
          },
          timeout: this.config.timeout
        }
      );

      return response.data;
    });
  }

  /**
   * Get details of a specific extension
   * @param {string} extensionId - Extension ID
   * @returns {Promise<Object>} Extension details
   * @throws {BrowserbaseError} If API call fails
   */
  async getExtension(extensionId) {
    if (!extensionId) {
      throw new BrowserbaseError('Extension ID is required', 'INVALID_PARAMETER');
    }

    return this._retryRequest(async () => {
      const response = await axios.get(
        `${this.baseURL}/extensions/${extensionId}`,
        {
          headers: {
            'X-BB-API-Key': this.apiKey
          },
          timeout: this.config.timeout
        }
      );

      return response.data;
    });
  }

  /**
   * Close the current session and cleanup resources
   * @returns {Promise<void>}
   */
  async close() {
    if (!this.sessionId) {
      return;
    }

    try {
      // Close browser connection if exists
      if (this.browser) {
        try {
          await this.browser.disconnect();
        } catch (browserError) {
          console.warn('Error disconnecting browser:', browserError.message);
        }
      }

      // Close the Browserbase session
      await this._retryRequest(async () => {
        await axios.delete(
          `${this.baseURL}/sessions/${this.sessionId}`,
          {
            headers: {
              'X-BB-API-Key': this.apiKey
            },
            timeout: this.config.timeout
          }
        );
      });

      this.stats.sessionsClosed++;
      console.log(`✅ Browserbase session closed: ${this.sessionId}`);
    } catch (error) {
      this.stats.errors.push({
        timestamp: new Date().toISOString(),
        action: 'close',
        error: error.message,
        code: error.code || 'UNKNOWN'
      });
      console.warn(`⚠️ Error closing Browserbase session: ${error.message}`);
    } finally {
      this.sessionId = null;
      this.connectURL = null;
      this.debuggerUrl = null;
      this.liveViewUrl = null;
      this.browser = null;
      this.page = null;
      this.initialized = false;
    }
  }

  /**
     * Get provider statistics
     * @returns {Object} Statistics
     */
  getStats() {
    return {
      ...this.stats,
      sessionId: this.sessionId,
      initialized: this.initialized,
      config: {
        ...this.config,
        apiKey: '***' // Hide API key
      }
    };
  }

  /**
     * Validate provider configuration
     * @param {Object} config - Configuration to validate
     * @returns {boolean} Valid or not
     */
  static validateConfig(config) {
    const validRegions = ['us-west-2', 'us-east-1', 'eu-west-1'];
    const validBrowsers = ['chrome', 'firefox'];

    if (config.region && !validRegions.includes(config.region)) {
      return false;
    }

    if (config.browser && !validBrowsers.includes(config.browser)) {
      return false;
    }

    return true;
  }

  /**
   * Check if Browserbase API is accessible
   * @param {string} apiKey - API key to test
   * @param {string} apiBaseURL - Custom API base URL (optional)
   * @returns {Promise<boolean>} True if accessible
   */
  static async checkConnection(apiKey, apiBaseURL = 'https://api.browserbase.com/v1') {
    try {
      const response = await axios.get(
        `${apiBaseURL}/sessions`,
        {
          headers: {
            'X-BB-API-Key': apiKey
          },
          timeout: 5000
        }
      );
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }
}

/**
 * Export classes
 */
module.exports = {
  BrowserbaseProvider,
  BrowserbaseError,
  AuthenticationError,
  SessionNotFoundError,
  RateLimitError,
  NetworkError
};
