/**
 * ============================================================================
 * NETWORK INTERCEPTOR - Request/Response Interception & Mocking
 * ============================================================================
 * 
 * Provides network interception, request mocking, HAR recording, and
 * response modification capabilities across all browser adapters.
 * 
 * @author Trent Pierce
 * @license BrowserAgent Non-Commercial License
 * @copyright 2026 Trent Pierce
 * ============================================================================
 */

const fs = require('fs').promises;
const path = require('path');

/**
 * Network interceptor for request/response handling
 */
class NetworkInterceptor {
  /**
     * @param {Object} options - Interceptor options
     * @param {boolean} options.recordHAR - Enable HAR recording
     * @param {string} options.harOutputPath - Path to save HAR file
     */
  constructor(options = {}) {
    this.options = {
      recordHAR: false,
      harOutputPath: './network.har',
      ...options
    };

    this.routes = new Map();
    this.requestLog = [];
    this.interceptEnabled = false;
    this.mockResponses = new Map();
    this.requestModifiers = [];
    this.responseModifiers = [];
  }

  /**
     * Initialize interceptor on a page
     * @param {Object} page - Page adapter instance
     */
  async init(page) {
    this.page = page;
        
    // Set up request interception
    await page.setRequestInterception(true);
        
    // Listen for requests
    page.on('request', (request) => this.handleRequest(request));
        
    // Listen for responses
    page.on('response', (response) => this.handleResponse(response));

    this.interceptEnabled = true;
  }

  /**
     * Handle incoming request
     * @private
     */
  async handleRequest(request) {
    const url = request.url();
    const method = request.method();
        
    // Log request
    this.logRequest(request);

    // Check for mock response
    const mock = this.findMock(url, method);
    if (mock) {
      await request.respond(mock);
      return;
    }

    // Apply request modifiers
    let modifiedRequest = request;
    for (const modifier of this.requestModifiers) {
      if (modifier.matches(url, method)) {
        modifiedRequest = await modifier.modify(modifiedRequest);
      }
    }

    // Check for route handler
    const handler = this.findRoute(url);
    if (handler) {
      await handler(modifiedRequest);
      return;
    }

    // Continue request
    await modifiedRequest.continue();
  }

  /**
     * Handle response
     * @private
     */
  async handleResponse(response) {
    const url = response.url();
        
    // Log response
    this.logResponse(response);

    // Apply response modifiers
    for (const modifier of this.responseModifiers) {
      if (modifier.matches(url)) {
        await modifier.modify(response);
      }
    }
  }

  /**
     * Route requests matching pattern to handler
     * @param {string|RegExp} pattern - URL pattern to match
     * @param {Function} handler - Route handler
     */
  route(pattern, handler) {
    this.routes.set(pattern, handler);
  }

  /**
     * Mock API response
     * @param {string|RegExp} pattern - URL pattern to mock
     * @param {Object} mockResponse - Mock response configuration
     * @param {number} mockResponse.status - HTTP status code
     * @param {Object} mockResponse.headers - Response headers
     * @param {Object|Array|string} mockResponse.body - Response body
     * @param {string} mockResponse.contentType - Content type
     */
  mock(pattern, mockResponse) {
    const normalizedResponse = {
      status: mockResponse.status || 200,
      headers: mockResponse.headers || {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': mockResponse.contentType || 'application/json'
      },
      body: typeof mockResponse.body === 'object' 
        ? JSON.stringify(mockResponse.body) 
        : mockResponse.body
    };

    this.mockResponses.set(pattern, normalizedResponse);
  }

  /**
     * Mock API with dynamic response
     * @param {string|RegExp} pattern - URL pattern
     * @param {Function} handler - Handler function(request) => response
     */
  mockDynamic(pattern, handler) {
    this.mockResponses.set(pattern, { dynamic: true, handler });
  }

  /**
     * Find matching mock for URL
     * @private
     */
  findMock(url, method) {
    for (const [pattern, mock] of this.mockResponses) {
      if (this.matchesPattern(url, pattern)) {
        if (mock.dynamic) {
          // Execute dynamic handler
          return mock.handler({ url, method });
        }
        return mock;
      }
    }
    return null;
  }

  /**
     * Find route handler for URL
     * @private
     */
  findRoute(url) {
    for (const [pattern, handler] of this.routes) {
      if (this.matchesPattern(url, pattern)) {
        return handler;
      }
    }
    return null;
  }

  /**
     * Check if URL matches pattern
     * @private
     */
  matchesPattern(url, pattern) {
    if (pattern instanceof RegExp) {
      return pattern.test(url);
    }
    if (typeof pattern === 'string') {
      // Support glob patterns
      const regex = new RegExp(
        pattern
          .replace(/\*\*/g, '<<<DOUBLESTAR>>>')
          .replace(/\*/g, '[^/]*')
          .replace(/<<<DOUBLESTAR>>>/g, '.*')
      );
      return regex.test(url);
    }
    return url === pattern;
  }

  /**
     * Log request for HAR recording
     * @private
     */
  logRequest(request) {
    if (!this.options.recordHAR) return;

    this.requestLog.push({
      type: 'request',
      url: request.url(),
      method: request.method(),
      headers: request.headers(),
      postData: request.postData(),
      timestamp: Date.now()
    });
  }

  /**
     * Log response for HAR recording
     * @private
     */
  async logResponse(response) {
    if (!this.options.recordHAR) return;

    try {
      const body = await response.text().catch(() => null);
            
      this.requestLog.push({
        type: 'response',
        url: response.url(),
        status: response.status(),
        headers: response.headers(),
        body: body,
        timestamp: Date.now()
      });
    } catch (e) {
      // Ignore logging errors
    }
  }

  /**
     * Add request modifier
     * @param {Object} modifier - Request modifier
     * @param {Function} modifier.matches - (url, method) => boolean
     * @param {Function} modifier.modify - (request) => modifiedRequest
     */
  addRequestModifier(modifier) {
    this.requestModifiers.push(modifier);
  }

  /**
     * Add response modifier
     * @param {Object} modifier - Response modifier
     * @param {Function} modifier.matches - (url) => boolean
     * @param {Function} modifier.modify - (response) => modifiedResponse
     */
  addResponseModifier(modifier) {
    this.responseModifiers.push(modifier);
  }

  /**
     * Set authentication headers for all requests
     * @param {Object} headers - Headers to add
     */
  setExtraHeaders(headers) {
    this.addRequestModifier({
      matches: () => true,
      modify: (request) => {
        const currentHeaders = request.headers();
        request.continue({
          headers: { ...currentHeaders, ...headers }
        });
        return request;
      }
    });
  }

  /**
     * Block specific resource types
     * @param {Array<string>} resourceTypes - Resource types to block
     */
  blockResources(resourceTypes) {
    this.route('**/*', (request) => {
      if (resourceTypes.includes(request.resourceType())) {
        request.abort('blockedbyclient');
      } else {
        request.continue();
      }
    });
  }

  /**
     * Cache responses and serve from cache
     * @param {Object} options - Cache options
     * @param {number} options.maxAge - Max age in milliseconds
     */
  enableCache(options = {}) {
    const cache = new Map();
    const maxAge = options.maxAge || 300000; // 5 minutes default

    this.route('**/*', async (request) => {
      const url = request.url();
      const cached = cache.get(url);

      if (cached && (Date.now() - cached.timestamp) < maxAge) {
        await request.respond(cached.response);
        return;
      }

      // Continue and cache response
      request.continue();
            
      // Cache the response when it comes back
      const originalResponse = await request.response();
      if (originalResponse) {
        cache.set(url, {
          response: {
            status: originalResponse.status(),
            headers: originalResponse.headers(),
            body: await originalResponse.buffer()
          },
          timestamp: Date.now()
        });
      }
    });
  }

  /**
     * Record HAR file
     * @param {string} outputPath - Output file path
     */
  async startHARRecording(outputPath) {
    this.options.recordHAR = true;
    this.options.harOutputPath = outputPath || this.options.harOutputPath;
    this.requestLog = [];
  }

  /**
     * Stop HAR recording and save file
     */
  async stopHARRecording() {
    this.options.recordHAR = false;

    const har = this.generateHAR();
        
    await fs.writeFile(
      this.options.harOutputPath,
      JSON.stringify(har, null, 2)
    );

    return this.options.harOutputPath;
  }

  /**
     * Generate HAR format from request log
     * @private
     */
  generateHAR() {
    return {
      log: {
        version: '1.2',
        creator: {
          name: 'BrowserAgent Network Interceptor',
          version: '1.0.0'
        },
        pages: [{
          startedDateTime: new Date(this.requestLog[0]?.timestamp || Date.now()).toISOString(),
          id: 'page_1',
          title: 'Network Capture',
          pageTimings: {}
        }],
        entries: this.requestLog
          .filter(log => log.type === 'request')
          .map(req => {
            const res = this.requestLog.find(
              r => r.type === 'response' && r.url === req.url
            );
                        
            return {
              startedDateTime: new Date(req.timestamp).toISOString(),
              time: res ? res.timestamp - req.timestamp : 0,
              request: {
                method: req.method,
                url: req.url,
                headers: Object.entries(req.headers || {}).map(([name, value]) => ({
                  name,
                  value: String(value)
                })),
                postData: req.postData ? { text: req.postData } : undefined
              },
              response: res ? {
                status: res.status,
                headers: Object.entries(res.headers || {}).map(([name, value]) => ({
                  name,
                  value: String(value)
                })),
                content: res.body ? {
                  size: res.body.length,
                  text: res.body
                } : undefined
              } : undefined
            };
          })
      }
    };
  }

  /**
     * Replay requests from HAR file
     * @param {string} harPath - Path to HAR file
     * @param {Object} options - Replay options
     */
  async replayFromHAR(harPath, options = {}) {
    const harContent = await fs.readFile(harPath, 'utf8');
    const har = JSON.parse(harContent);

    const results = [];
        
    for (const entry of har.log.entries) {
      const request = entry.request;
            
      // Skip if filtered
      if (options.filter && !options.filter(request)) continue;

      try {
        // Replay the request
        const response = await this.page.evaluate(async (req) => {
          const res = await fetch(req.url, {
            method: req.method,
            headers: req.headers.reduce((acc, h) => {
              acc[h.name] = h.value;
              return acc;
            }, {}),
            body: req.postData?.text
          });
          return {
            status: res.status,
            statusText: res.statusText
          };
        }, request);

        results.push({
          url: request.url,
          method: request.method,
          status: response.status,
          success: response.status >= 200 && response.status < 300
        });
      } catch (e) {
        results.push({
          url: request.url,
          method: request.method,
          error: e.message,
          success: false
        });
      }
    }

    return results;
  }

  /**
     * Wait for specific network request
     * @param {string|RegExp} pattern - URL pattern to wait for
     * @param {Object} options - Wait options
     * @returns {Promise<Object>}
     */
  async waitForRequest(pattern, options = {}) {
    const timeout = options.timeout || 30000;
        
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for request matching: ${pattern}`));
      }, timeout);

      const checkRequest = (request) => {
        if (this.matchesPattern(request.url(), pattern)) {
          clearTimeout(timer);
          this.page.off('request', checkRequest);
          resolve(request);
        }
      };

      this.page.on('request', checkRequest);
    });
  }

  /**
     * Wait for specific network response
     * @param {string|RegExp} pattern - URL pattern to wait for
     * @param {Object} options - Wait options
     * @returns {Promise<Object>}
     */
  async waitForResponse(pattern, options = {}) {
    const timeout = options.timeout || 30000;
        
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for response matching: ${pattern}`));
      }, timeout);

      const checkResponse = async (response) => {
        if (this.matchesPattern(response.url(), pattern)) {
          clearTimeout(timer);
          this.page.off('response', checkResponse);
                    
          try {
            const body = await response.text();
            resolve({
              url: response.url(),
              status: response.status(),
              headers: response.headers(),
              body
            });
          } catch (e) {
            resolve({
              url: response.url(),
              status: response.status(),
              headers: response.headers()
            });
          }
        }
      };

      this.page.on('response', checkResponse);
    });
  }

  /**
     * Get network activity statistics
     * @returns {Object}
     */
  getStats() {
    const requests = this.requestLog.filter(l => l.type === 'request');
    const responses = this.requestLog.filter(l => l.type === 'response');

    const byType = {};
    requests.forEach(req => {
      const type = this.getRequestType(req.url);
      byType[type] = (byType[type] || 0) + 1;
    });

    return {
      totalRequests: requests.length,
      totalResponses: responses.length,
      byType,
      averageResponseTime: responses.length > 0
        ? responses.reduce((sum, r) => sum + (r.timestamp || 0), 0) / responses.length
        : 0
    };
  }

  /**
     * Get request type from URL
     * @private
     */
  getRequestType(url) {
    const ext = path.extname(new URL(url).pathname).toLowerCase();
    const typeMap = {
      '.js': 'script',
      '.css': 'stylesheet',
      '.png': 'image',
      '.jpg': 'image',
      '.jpeg': 'image',
      '.gif': 'image',
      '.svg': 'image',
      '.woff': 'font',
      '.woff2': 'font',
      '.json': 'xhr'
    };
    return typeMap[ext] || 'other';
  }

  /**
     * Clear all routes and mocks
     */
  clear() {
    this.routes.clear();
    this.mockResponses.clear();
    this.requestModifiers = [];
    this.responseModifiers = [];
  }

  /**
     * Disable interception
     */
  async disable() {
    if (this.page) {
      await this.page.setRequestInterception(false);
    }
    this.interceptEnabled = false;
  }
}

module.exports = NetworkInterceptor;
