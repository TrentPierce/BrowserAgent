/**
 * ============================================================================
 * AUTO-WAITER - Smart Waiting & Flakiness Reduction
 * ============================================================================
 * 
 * Intelligent waiting system that reduces test flakiness through
 * smart polling, auto-retry, and predictive waiting strategies.
 * 
 * @author Trent Pierce
 * @license BrowserAgent Non-Commercial License
 * @copyright 2026 Trent Pierce
 * ============================================================================
 */

/**
 * Auto-waiter for reliable element interactions
 */
class AutoWaiter {
  /**
     * @param {Object} options - Wait options
     * @param {number} options.timeout - Default timeout in ms
     * @param {number} options.pollInterval - Polling interval in ms
     * @param {boolean} options.enableRetry - Enable automatic retry
     * @param {number} options.maxRetries - Maximum retry attempts
     */
  constructor(options = {}) {
    this.options = {
      timeout: 30000,
      pollInterval: 100,
      enableRetry: true,
      maxRetries: 3,
      stabilizationTime: 500, // Wait for element to stabilize
      ...options
    };

    this.retryCount = 0;
    this.waitStats = [];
  }

  /**
     * Wait for element and perform action with auto-retry
     * @param {Object} page - Page adapter
     * @param {string} selector - Element selector
     * @param {string} action - Action to perform ('click', 'type', 'visible', etc.)
     * @param {*} actionParams - Parameters for the action
     * @param {Object} options - Wait options
     * @returns {Promise<Object>}
     */
  async waitAndPerform(page, selector, action, actionParams = null, options = {}) {
    const opts = { ...this.options, ...options };
    const startTime = Date.now();

    for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
      try {
        // Wait for element to exist
        await this.waitForElement(page, selector, opts);

        // Wait for element to be ready
        await this.waitForReady(page, selector, action, opts);

        // Perform action
        const result = await this.performAction(
          page, 
          selector, 
          action, 
          actionParams
        );

        // Record success
        this.recordStat({
          selector,
          action,
          success: true,
          duration: Date.now() - startTime,
          attempts: attempt + 1
        });

        return {
          success: true,
          result,
          attempts: attempt + 1,
          duration: Date.now() - startTime
        };

      } catch (error) {
        if (attempt === opts.maxRetries) {
          this.recordStat({
            selector,
            action,
            success: false,
            duration: Date.now() - startTime,
            attempts: attempt + 1,
            error: error.message
          });

          throw new Error(
            `Failed to ${action} element '${selector}' after ${attempt + 1} attempts: ${error.message}`
          );
        }

        // Wait before retry
        const retryDelay = Math.min(1000 * Math.pow(2, attempt), 5000);
        await this.sleep(retryDelay);
      }
    }
  }

  /**
     * Wait for element to exist in DOM
     * @param {Object} page - Page adapter
     * @param {string} selector - Element selector
     * @param {Object} options - Wait options
     */
  async waitForElement(page, selector, options = {}) {
    const timeout = options.timeout || this.options.timeout;
    const pollInterval = options.pollInterval || this.options.pollInterval;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const element = await page.$(selector);
      if (element) {
        return element;
      }
      await this.sleep(pollInterval);
    }

    throw new Error(`Element '${selector}' not found within ${timeout}ms`);
  }

  /**
     * Wait for element to be ready for interaction
     * @param {Object} page - Page adapter
     * @param {string} selector - Element selector
     * @param {string} action - Intended action
     * @param {Object} options - Wait options
     */
  async waitForReady(page, selector, action, options = {}) {
    const timeout = options.timeout || this.options.timeout;
    const pollInterval = options.pollInterval || this.options.pollInterval;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const isReady = await this.checkReady(page, selector, action);
      if (isReady) {
        // Additional stabilization wait
        if (options.stabilizationTime) {
          await this.sleep(options.stabilizationTime);
        }
        return true;
      }
      await this.sleep(pollInterval);
    }

    throw new Error(`Element '${selector}' not ready for ${action} within ${timeout}ms`);
  }

  /**
     * Check if element is ready for specific action
     * @private
     */
  async checkReady(page, selector, action) {
    return await page.evaluate((sel, act) => {
      const el = document.querySelector(sel);
      if (!el) return false;

      // Check visibility for most actions
      const rect = el.getBoundingClientRect();
      const isVisible = rect.width > 0 && 
                             rect.height > 0 && 
                             rect.top >= 0 && 
                             rect.left >= 0;

      if (!isVisible) return false;

      // Check specific requirements based on action
      switch (act) {
        case 'click':
        case 'tap':
          return !el.disabled && 
                           el.offsetParent !== null &&
                           getComputedStyle(el).pointerEvents !== 'none';
                
        case 'type':
        case 'fill':
          return !el.disabled && 
                           !el.readOnly &&
                           (el.tagName === 'INPUT' || 
                            el.tagName === 'TEXTAREA' ||
                            el.contentEditable === 'true');
                
        case 'select':
          return el.tagName === 'SELECT' && !el.disabled;
                
        case 'visible':
          return isVisible;
                
        case 'enabled':
          return !el.disabled;
                
        default:
          return isVisible;
      }
    }, selector, action);
  }

  /**
     * Perform the specified action
     * @private
     */
  async performAction(page, selector, action, params) {
    switch (action) {
      case 'click':
        return await page.click(selector);
            
      case 'type':
        return await page.type(selector, params);
            
      case 'fill':
        return await page.fill(selector, params);
            
      case 'select':
        return await page.select(selector, params);
            
      case 'hover':
        return await page.hover(selector);
            
      case 'focus':
        return await page.focus(selector);
            
      case 'tap':
        return await page.tap(selector);
            
      case 'scrollIntoView':
        return await page.evaluate((sel) => {
          document.querySelector(sel)?.scrollIntoView({
            behavior: 'instant',
            block: 'center'
          });
        }, selector);
            
      case 'check':
        return await page.evaluate((sel) => {
          const el = document.querySelector(sel);
          if (el && el.type === 'checkbox') {
            el.checked = true;
            el.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }, selector);
            
      case 'uncheck':
        return await page.evaluate((sel) => {
          const el = document.querySelector(sel);
          if (el && el.type === 'checkbox') {
            el.checked = false;
            el.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }, selector);
            
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  /**
     * Wait for navigation to complete
     * @param {Object} page - Page adapter
     * @param {Object} options - Wait options
     */
  async waitForNavigation(page, options = {}) {
    const opts = {
      waitUntil: 'networkidle0',
      timeout: 30000,
      ...options
    };

    try {
      await page.waitForNavigation(opts);
    } catch (e) {
      // Navigation may have already completed
    }
  }

  /**
     * Wait for network to be idle
     * @param {Object} page - Page adapter
     * @param {Object} options - Wait options
     */
  async waitForNetworkIdle(page, options = {}) {
    const { idleTime = 500, timeout = 30000 } = options;
        
    return new Promise((resolve, reject) => {
      let idleTimer;
      const startTime = Date.now();

      const checkIdle = () => {
        if (Date.now() - startTime > timeout) {
          cleanup();
          reject(new Error('Timeout waiting for network idle'));
          return;
        }

        idleTimer = setTimeout(() => {
          cleanup();
          resolve();
        }, idleTime);
      };

      const onRequest = () => {
        clearTimeout(idleTimer);
        checkIdle();
      };

      const cleanup = () => {
        page.off('request', onRequest);
        clearTimeout(idleTimer);
      };

      page.on('request', onRequest);
      checkIdle();
    });
  }

  /**
     * Wait for page load state
     * @param {Object} page - Page adapter
     * @param {string} state - Load state ('load', 'domcontentloaded', 'networkidle')
     * @param {Object} options - Wait options
     */
  async waitForLoadState(page, state = 'networkidle', options = {}) {
    const timeout = options.timeout || 30000;

    const stateMap = {
      'load': 'load',
      'domcontentloaded': 'domcontentloaded',
      'networkidle': 'networkidle0',
      'networkidle0': 'networkidle0',
      'networkidle2': 'networkidle2'
    };

    await page.waitForLoadState(stateMap[state] || state, { timeout });
  }

  /**
     * Wait for function to return truthy
     * @param {Object} page - Page adapter
     * @param {Function} fn - Function to evaluate
     * @param {*} args - Arguments to pass
     * @param {Object} options - Wait options
     */
  async waitForFunction(page, fn, args = [], options = {}) {
    const timeout = options.timeout || 30000;
    const pollInterval = options.pollInterval || 100;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const result = await page.evaluate(fn, ...args);
      if (result) {
        return result;
      }
      await this.sleep(pollInterval);
    }

    throw new Error('Timeout waiting for function condition');
  }

  /**
     * Wait for text to appear on page
     * @param {Object} page - Page adapter
     * @param {string} text - Text to wait for
     * @param {Object} options - Wait options
     */
  async waitForText(page, text, options = {}) {
    const timeout = options.timeout || this.options.timeout;
    const pollInterval = options.pollInterval || this.options.pollInterval;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const pageText = await page.text();
      if (pageText.includes(text)) {
        return true;
      }
      await this.sleep(pollInterval);
    }

    throw new Error(`Text '${text}' not found within ${timeout}ms`);
  }

  /**
     * Wait for element to be stable (not moving)
     * @param {Object} page - Page adapter
     * @param {string} selector - Element selector
     * @param {Object} options - Wait options
     */
  async waitForStable(page, selector, options = {}) {
    const stabilityTime = options.stabilityTime || 500;
    const timeout = options.timeout || 10000;
    const startTime = Date.now();

    let lastPosition = null;
    let stableStartTime = null;

    while (Date.now() - startTime < timeout) {
      const position = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      }, selector);

      if (!position) {
        throw new Error(`Element '${selector}' not found`);
      }

      if (lastPosition && 
                lastPosition.x === position.x && 
                lastPosition.y === position.y) {
                
        if (!stableStartTime) {
          stableStartTime = Date.now();
        } else if (Date.now() - stableStartTime >= stabilityTime) {
          return true;
        }
      } else {
        stableStartTime = null;
      }

      lastPosition = position;
      await this.sleep(50);
    }

    throw new Error(`Element '${selector}' not stable within ${timeout}ms`);
  }

  /**
     * Wait for all elements matching selector
     * @param {Object} page - Page adapter
     * @param {string} selector - Element selector
     * @param {Object} options - Wait options
     */
  async waitForAll(page, selector, options = {}) {
    const timeout = options.timeout || this.options.timeout;
    const pollInterval = options.pollInterval || this.options.pollInterval;
    const minCount = options.minCount || 1;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const elements = await page.$$(selector);
      if (elements.length >= minCount) {
        return elements;
      }
      await this.sleep(pollInterval);
    }

    throw new Error(`Less than ${minCount} elements '${selector}' found within ${timeout}ms`);
  }

  /**
     * Wait for element to be hidden
     * @param {Object} page - Page adapter
     * @param {string} selector - Element selector
     * @param {Object} options - Wait options
     */
  async waitForHidden(page, selector, options = {}) {
    const timeout = options.timeout || this.options.timeout;
    const pollInterval = options.pollInterval || this.options.pollInterval;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const hidden = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return true;
                
        const style = getComputedStyle(el);
        return style.display === 'none' || 
                       style.visibility === 'hidden' || 
                       style.opacity === '0';
      }, selector);

      if (hidden) {
        return true;
      }
      await this.sleep(pollInterval);
    }

    throw new Error(`Element '${selector}' still visible after ${timeout}ms`);
  }

  /**
     * Record wait statistics
     * @private
     */
  recordStat(stat) {
    this.waitStats.push({
      ...stat,
      timestamp: Date.now()
    });

    // Keep only last 1000 stats
    if (this.waitStats.length > 1000) {
      this.waitStats = this.waitStats.slice(-1000);
    }
  }

  /**
     * Get wait statistics
     * @returns {Object}
     */
  getStats() {
    const total = this.waitStats.length;
    const successful = this.waitStats.filter(s => s.success).length;
    const averageDuration = total > 0
      ? this.waitStats.reduce((sum, s) => sum + (s.duration || 0), 0) / total
      : 0;

    return {
      totalWaits: total,
      successfulWaits: successful,
      failedWaits: total - successful,
      successRate: total > 0 ? successful / total : 0,
      averageDuration,
      byAction: this.groupByAction()
    };
  }

  /**
     * Group stats by action type
     * @private
     */
  groupByAction() {
    const grouped = {};
        
    this.waitStats.forEach(stat => {
      const action = stat.action || 'unknown';
      if (!grouped[action]) {
        grouped[action] = { count: 0, successful: 0, totalDuration: 0 };
      }
      grouped[action].count++;
      if (stat.success) grouped[action].successful++;
      grouped[action].totalDuration += stat.duration || 0;
    });

    // Calculate averages
    Object.keys(grouped).forEach(action => {
      const g = grouped[action];
      g.averageDuration = g.count > 0 ? g.totalDuration / g.count : 0;
      g.successRate = g.count > 0 ? g.successful / g.count : 0;
    });

    return grouped;
  }

  /**
     * Clear statistics
     */
  clearStats() {
    this.waitStats = [];
  }

  /**
     * Get typing delay with variance for human-like typing simulation
     * @param {Object} options - Typing options
     * @param {number} options.typingSpeed - Base typing speed in ms per character
     * @param {number} options.typingVariance - Variance in typing speed
     * @returns {number} Delay in milliseconds
     */
  getTypingDelay(options = {}) {
    const typingSpeed = options.typingSpeed || 100;
    const typingVariance = options.typingVariance || 50;
        
    // Calculate random delay within variance range
    const variance = (Math.random() * 2 - 1) * typingVariance;
    return Math.max(10, typingSpeed + variance);
  }

  /**
     * Utility sleep function
     * @private
     */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = AutoWaiter;
