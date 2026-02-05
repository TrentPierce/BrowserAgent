/**
 * ============================================================================
 * PAGE ADAPTER - Unified Page Interface
 * ============================================================================
 * 
 * Provides a consistent API across all browser implementations (Puppeteer/Playwright).
 * Handles the differences between browser automation libraries transparently.
 * 
 * @author Trent Pierce
 * @license BrowserAgent Non-Commercial License
 * @copyright 2026 Trent Pierce
 * ============================================================================
 */

const { v4: uuidv4 } = require('uuid');

/**
 * Unified page adapter for all browser types
 */
class PageAdapter {
  /**
     * @param {Object} page - Underlying page object (Puppeteer or Playwright)
     * @param {string} browserType - Type of browser ('chrome', 'firefox', 'safari', 'edge')
     */
  constructor(page, browserType) {
    this.id = uuidv4();
    this.page = page;
    this.browserType = browserType;
    this.isPlaywright = this._detectPlaywright(page);
    this.eventHandlers = new Map();
        
    // Set up default event listeners
    this._setupEventListeners();
  }

  /**
     * Detect if page is from Playwright or Puppeteer
     * @private
     */
  _detectPlaywright(page) {
    // Playwright pages have 'context' method, Puppeteer doesn't
    return typeof page.context === 'function' && 
               typeof page.route === 'function';
  }

  /**
     * Set up event listeners
     * @private
     */
  _setupEventListeners() {
    // Console events
    this.page.on('console', (msg) => {
      this.emit('console', {
        type: msg.type(),
        text: msg.text(),
        location: msg.location ? msg.location() : null
      });
    });

    // Error events
    this.page.on('pageerror', (error) => {
      this.emit('pageerror', {
        message: error.message,
        stack: error.stack
      });
    });

    // Request events
    this.page.on('request', (request) => {
      this.emit('request', {
        url: request.url(),
        method: request.method(),
        headers: request.headers(),
        postData: request.postData ? request.postData() : null
      });
    });

    // Response events
    this.page.on('response', (response) => {
      this.emit('response', {
        url: response.url(),
        status: response.status(),
        headers: response.headers()
      });
    });

    // Dialog events
    this.page.on('dialog', async (dialog) => {
      this.emit('dialog', {
        type: dialog.type(),
        message: dialog.message(),
        defaultValue: dialog.defaultValue ? dialog.defaultValue() : '',
        accept: (text) => dialog.accept(text),
        dismiss: () => dialog.dismiss()
      });
    });
  }

  /**
     * Navigate to URL
     * @param {string} url - URL to navigate to
     * @param {Object} options - Navigation options
     * @returns {Promise<Object>}
     */
  async goto(url, options = {}) {
    const navOptions = {
      waitUntil: options.waitUntil || 'networkidle0',
      timeout: options.timeout || 30000,
      ...options
    };

    // Normalize waitUntil for Playwright
    if (this.isPlaywright) {
      const waitUntilMap = {
        'load': 'load',
        'domcontentloaded': 'domcontentloaded',
        'networkidle0': 'networkidle',
        'networkidle2': 'networkidle'
      };
      navOptions.waitUntil = waitUntilMap[navOptions.waitUntil] || 'networkidle';
    }

    const response = await this.page.goto(url, navOptions);
    return {
      status: response ? response.status() : null,
      url: this.page.url()
    };
  }

  /**
     * Get current URL
     * @returns {string}
     */
  url() {
    return this.page.url();
  }

  /**
     * Get page title
     * @returns {Promise<string>}
     */
  async title() {
    return await this.page.title();
  }

  /**
     * Click an element
     * @param {string} selector - Element selector
     * @param {Object} options - Click options
     * @returns {Promise<void>}
     */
  async click(selector, options = {}) {
    if (this.isPlaywright) {
      await this.page.click(selector, options);
    } else {
      // Puppeteer
      await this.page.click(selector, options);
    }
  }

  /**
     * Type text into an element
     * @param {string} selector - Element selector
     * @param {string} text - Text to type
     * @param {Object} options - Type options
     * @returns {Promise<void>}
     */
  async type(selector, text, options = {}) {
    if (options.clear !== false) {
      await this.clear(selector);
    }
        
    if (this.isPlaywright) {
      await this.page.fill(selector, text, options);
    } else {
      await this.page.type(selector, text, options);
    }
  }

  /**
     * Fill an input (clears first)
     * @param {string} selector - Element selector
     * @param {string} text - Text to fill
     * @returns {Promise<void>}
     */
  async fill(selector, text) {
    if (this.isPlaywright) {
      await this.page.fill(selector, text);
    } else {
      await this.page.evaluate((sel, value) => {
        const el = document.querySelector(sel);
        if (el) {
          el.value = value;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, selector, text);
    }
  }

  /**
     * Clear an input field
     * @param {string} selector - Element selector
     * @returns {Promise<void>}
     */
  async clear(selector) {
    if (this.isPlaywright) {
      await this.page.fill(selector, '');
    } else {
      const input = await this.page.$(selector);
      if (input) {
        await input.click({ clickCount: 3 }); // Select all
        await input.press('Backspace');
      }
    }
  }

  /**
     * Press a key
     * @param {string} key - Key to press
     * @param {Object} options - Press options
     * @returns {Promise<void>}
     */
  async press(key, options = {}) {
    if (this.isPlaywright) {
      await this.page.keyboard.press(key, options);
    } else {
      await this.page.keyboard.press(key, options);
    }
  }

  /**
     * Wait for selector to appear
     * @param {string} selector - Element selector
     * @param {Object} options - Wait options
     * @returns {Promise<Object>}
     */
  async waitForSelector(selector, options = {}) {
    const waitOptions = {
      visible: options.visible !== false,
      hidden: options.hidden || false,
      timeout: options.timeout || 30000
    };

    const element = await this.page.waitForSelector(selector, waitOptions);
    return element;
  }

  /**
     * Wait for navigation
     * @param {Object} options - Wait options
     * @returns {Promise<Object>}
     */
  async waitForNavigation(options = {}) {
    if (this.isPlaywright) {
      return await this.page.waitForNavigation({
        waitUntil: options.waitUntil || 'networkidle',
        timeout: options.timeout || 30000
      });
    } else {
      return await this.page.waitForNavigation({
        waitUntil: options.waitUntil || 'networkidle0',
        timeout: options.timeout || 30000
      });
    }
  }

  /**
     * Wait for function to return truthy
     * @param {Function} fn - Function to evaluate
     * @param {Object} options - Wait options
     * @param {*} args - Arguments to pass to function
     * @returns {Promise<*>}
     */
  async waitForFunction(fn, options = {}, ...args) {
    return await this.page.waitForFunction(fn, {
      timeout: options.timeout || 30000,
      polling: options.polling || 'raf'
    }, ...args);
  }

  /**
     * Wait for timeout
     * @param {number} ms - Milliseconds to wait
     * @returns {Promise<void>}
     */
  async waitForTimeout(ms) {
    await this.page.waitForTimeout(ms);
  }

  /**
     * Evaluate function in page context
     * @param {Function} fn - Function to evaluate
     * @param {*} args - Arguments to pass
     * @returns {Promise<*>}
     */
  async evaluate(fn, ...args) {
    return await this.page.evaluate(fn, ...args);
  }

  /**
     * Evaluate function with element handle
     * @param {string} selector - Element selector
     * @param {Function} fn - Function to evaluate
     * @param {*} args - Arguments to pass
     * @returns {Promise<*>}
     */
  async $eval(selector, fn, ...args) {
    return await this.page.$eval(selector, fn, ...args);
  }

  /**
     * Evaluate function with all matching elements
     * @param {string} selector - Element selector
     * @param {Function} fn - Function to evaluate
     * @param {*} args - Arguments to pass
     * @returns {Promise<Array>}
     */
  async $$eval(selector, fn, ...args) {
    return await this.page.$$eval(selector, fn, ...args);
  }

  /**
     * Get single element handle
     * @param {string} selector - Element selector
     * @returns {Promise<Object|null>}
     */
  async $(selector) {
    return await this.page.$(selector);
  }

  /**
     * Get all element handles
     * @param {string} selector - Element selector
     * @returns {Promise<Array>}
     */
  async $$(selector) {
    return await this.page.$$(selector);
  }

  /**
     * Get element by XPath
     * @param {string} xpath - XPath expression
     * @returns {Promise<Object|null>}
     */
  async $x(xpath) {
    if (this.isPlaywright) {
      // Playwright uses different method
      return await this.page.locator(`xpath=${xpath}`).first();
    } else {
      return await this.page.$x(xpath);
    }
  }

  /**
     * Take screenshot
     * @param {Object} options - Screenshot options
     * @returns {Promise<Buffer>}
     */
  async screenshot(options = {}) {
    const screenshotOptions = {
      path: options.path,
      type: options.type || 'png',
      fullPage: options.fullPage || false,
      encoding: options.encoding || 'binary'
    };

    if (options.selector) {
      // Screenshot specific element
      const element = await this.page.$(options.selector);
      if (element) {
        return await element.screenshot(screenshotOptions);
      }
      throw new Error(`Element not found: ${options.selector}`);
    }

    return await this.page.screenshot(screenshotOptions);
  }

  /**
     * Get page content (HTML)
     * @returns {Promise<string>}
     */
  async content() {
    return await this.page.content();
  }

  /**
     * Set page content
     * @param {string} html - HTML content
     * @returns {Promise<void>}
     */
  async setContent(html) {
    await this.page.setContent(html);
  }

  /**
     * Get page text content
     * @returns {Promise<string>}
     */
  async text() {
    return await this.page.evaluate(() => document.body.innerText);
  }

  /**
     * Reload the page
     * @param {Object} options - Reload options
     * @returns {Promise<Object>}
     */
  async reload(options = {}) {
    const response = await this.page.reload(options);
    return {
      status: response ? response.status() : null,
      url: this.page.url()
    };
  }

  /**
     * Go back in history
     * @param {Object} options - Navigation options
     * @returns {Promise<Object>}
     */
  async goBack(options = {}) {
    const response = await this.page.goBack(options);
    return {
      status: response ? response.status() : null,
      url: this.page.url()
    };
  }

  /**
     * Go forward in history
     * @param {Object} options - Navigation options
     * @returns {Promise<Object>}
     */
  async goForward(options = {}) {
    const response = await this.page.goForward(options);
    return {
      status: response ? response.status() : null,
      url: this.page.url()
    };
  }

  /**
     * Set viewport size
     * @param {Object} viewport - Viewport dimensions
     * @param {number} viewport.width - Width in pixels
     * @param {number} viewport.height - Height in pixels
     * @returns {Promise<void>}
     */
  async setViewport(viewport) {
    if (this.isPlaywright) {
      await this.page.setViewportSize(viewport);
    } else {
      await this.page.setViewport(viewport);
    }
  }

  /**
     * Get viewport size
     * @returns {Promise<Object>}
     */
  async viewport() {
    return await this.page.evaluate(() => {
      return {
        width: window.innerWidth,
        height: window.innerHeight
      };
    });
  }

  /**
     * Add script tag to page
     * @param {Object} options - Script options
     * @returns {Promise<Object>}
     */
  async addScriptTag(options) {
    return await this.page.addScriptTag(options);
  }

  /**
     * Add style tag to page
     * @param {Object} options - Style options
     * @returns {Promise<Object>}
     */
  async addStyleTag(options) {
    return await this.page.addStyleTag(options);
  }

  /**
     * Expose function to page context
     * @param {string} name - Function name
     * @param {Function} fn - Function to expose
     * @returns {Promise<void>}
     */
  async exposeFunction(name, fn) {
    await this.page.exposeFunction(name, fn);
  }

  /**
     * Authenticate (HTTP Basic Auth)
     * @param {Object} credentials - Auth credentials
     * @returns {Promise<void>}
     */
  async authenticate(credentials) {
    if (this.isPlaywright) {
      // Playwright handles auth at context level
      console.warn('Authentication in Playwright should be set at context level');
    } else {
      await this.page.authenticate(credentials);
    }
  }

  /**
     * Set extra HTTP headers
     * @param {Object} headers - Headers to set
     * @returns {Promise<void>}
     */
  async setExtraHTTPHeaders(headers) {
    await this.page.setExtraHTTPHeaders(headers);
  }

  /**
     * Get cookies
     * @param {Array<string>} urls - URLs to get cookies for
     * @returns {Promise<Array>}
     */
  async cookies(urls) {
    if (this.isPlaywright) {
      const context = this.page.context();
      return await context.cookies(urls);
    } else {
      return await this.page.cookies(...(urls || []));
    }
  }

  /**
     * Set cookies
     * @param {Array<Object>} cookies - Cookies to set
     * @returns {Promise<void>}
     */
  async setCookie(...cookies) {
    if (this.isPlaywright) {
      const context = this.page.context();
      await context.addCookies(cookies);
    } else {
      await this.page.setCookie(...cookies);
    }
  }

  /**
     * Delete cookies
     * @param {Array<Object>} cookies - Cookies to delete
     * @returns {Promise<void>}
     */
  async deleteCookie(...cookies) {
    if (this.isPlaywright) {
      const context = this.page.context();
      await context.clearCookies();
    } else {
      await this.page.deleteCookie(...cookies);
    }
  }

  /**
     * Clear all cookies
     * @returns {Promise<void>}
     */
  async clearCookies() {
    if (this.isPlaywright) {
      const context = this.page.context();
      await context.clearCookies();
    } else {
      await this.page.deleteCookie();
    }
  }

  /**
     * Enable request interception
     * @param {boolean} enabled - Enable or disable
     * @returns {Promise<void>}
     */
  async setRequestInterception(enabled) {
    if (!this.isPlaywright) {
      await this.page.setRequestInterception(enabled);
    }
    // Playwright uses route() instead
  }

  /**
     * Set request interception handler
     * @param {string} pattern - URL pattern to match
     * @param {Function} handler - Route handler
     * @returns {Promise<void>}
     */
  async route(pattern, handler) {
    if (this.isPlaywright) {
      await this.page.route(pattern, handler);
    } else {
      this.page.on('request', async (request) => {
        if (request.url().match(new RegExp(pattern.replace(/\*\*/g, '.*')))) {
          await handler(request);
        }
      });
      await this.page.setRequestInterception(true);
    }
  }

  /**
     * Close the page
     * @param {Object} options - Close options
     * @returns {Promise<void>}
     */
  async close(options = {}) {
    if (this.isPlaywright && this._context) {
      await this._context.close();
    } else {
      await this.page.close(options);
    }
  }

  /**
     * Check if page is closed
     * @returns {boolean}
     */
  isClosed() {
    return this.page.isClosed ? this.page.isClosed() : false;
  }

  /**
     * Get metrics
     * @returns {Promise<Object>}
     */
  async metrics() {
    if (this.isPlaywright) {
      return await this.page.evaluate(() => {
        return {
          Timestamp: performance.now(),
          Documents: document.querySelectorAll('*').length,
          Frames: window.length,
          JSEventListeners: 0, // Not directly accessible
          Nodes: document.querySelectorAll('*').length,
          LayoutCount: 0,
          RecalcStyleCount: 0
        };
      });
    } else {
      return await this.page.metrics();
    }
  }

  /**
     * Get PDF buffer
     * @param {Object} options - PDF options
     * @returns {Promise<Buffer>}
     */
  async pdf(options = {}) {
    if (this.isPlaywright) {
      return await this.page.pdf({
        path: options.path,
        format: options.format || 'A4',
        printBackground: options.printBackground || false
      });
    } else {
      return await this.page.pdf(options);
    }
  }

  /**
     * Bring page to front
     * @returns {Promise<void>}
     */
  async bringToFront() {
    await this.page.bringToFront();
  }

  /**
     * Focus an element
     * @param {string} selector - Element selector
     * @returns {Promise<void>}
     */
  async focus(selector) {
    await this.page.focus(selector);
  }

  /**
     * Hover over an element
     * @param {string} selector - Element selector
     * @param {Object} options - Hover options
     * @returns {Promise<void>}
     */
  async hover(selector, options = {}) {
    await this.page.hover(selector, options);
  }

  /**
     * Select option(s) in dropdown
     * @param {string} selector - Select element selector
     * @param {string|Array<string>} values - Value(s) to select
     * @returns {Promise<Array<string>>}
     */
  async select(selector, values) {
    if (this.isPlaywright) {
      if (Array.isArray(values)) {
        await this.page.selectOption(selector, values);
      } else {
        await this.page.selectOption(selector, values);
      }
    } else {
      return await this.page.select(selector, values);
    }
  }

  /**
     * Tap on element (touch event)
     * @param {string} selector - Element selector
     * @returns {Promise<void>}
     */
  async tap(selector) {
    if (this.isPlaywright) {
      await this.page.tap(selector);
    } else {
      await this.page.tap(selector);
    }
  }

  /**
     * Type with delay (human-like)
     * @param {string} selector - Element selector
     * @param {string} text - Text to type
     * @param {number} delay - Delay between keystrokes in ms
     * @returns {Promise<void>}
     */
  async typeWithDelay(selector, text, delay = 50) {
    if (this.isPlaywright) {
      await this.page.type(selector, text, { delay });
    } else {
      await this.page.type(selector, text, { delay });
    }
  }

  /**
     * Scroll element into view
     * @param {string} selector - Element selector
     * @returns {Promise<void>}
     */
  async scrollIntoView(selector) {
    await this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (el) {
        el.scrollIntoView({ behavior: 'instant', block: 'center' });
      }
    }, selector);
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
     * Emit event
     * @private
     */
  emit(event, data) {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.forEach(handler => {
      try {
        handler(data);
      } catch (e) {
        console.error(`Error in page event handler for ${event}:`, e);
      }
    });
  }

  /**
     * Get underlying page object
     * @returns {Object}
     */
  getPage() {
    return this.page;
  }

  /**
     * Get browser type
     * @returns {string}
     */
  getBrowserType() {
    return this.browserType;
  }
}

module.exports = PageAdapter;
