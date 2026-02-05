/**
 * ============================================================================
 * SELECTOR ENGINE - Advanced Element Selection
 * ============================================================================
 * 
 * Provides multiple selector strategies: CSS, XPath, Text, ARIA, and Data attributes.
 * Implements self-healing capabilities with fallback strategies.
 * 
 * @author Trent Pierce
 * @license BrowserAgent Non-Commercial License
 * @copyright 2026 Trent Pierce
 * ============================================================================
 */

/**
 * Selector types supported by the engine
 */
const SELECTOR_TYPES = {
  CSS: 'css',
  XPATH: 'xpath',
  TEXT: 'text',
  ARIA: 'aria',
  DATA: 'data',
  ROLE: 'role',
  LABEL: 'label',
  PLACEHOLDER: 'placeholder',
  TEST_ID: 'testId',
  NESTED: 'nested'
};

/**
 * Advanced selector engine with self-healing capabilities
 */
class SelectorEngine {
  /**
     * @param {Object} options - Engine options
     * @param {boolean} options.enableHealing - Enable self-healing
     * @param {number} options.timeout - Default timeout in ms
     * @param {Array<string>} options.preferredStrategies - Ordered list of fallback strategies
     */
  constructor(options = {}) {
    this.options = {
      enableHealing: true,
      timeout: 30000,
      preferredStrategies: [
        SELECTOR_TYPES.TEST_ID,
        SELECTOR_TYPES.DATA,
        SELECTOR_TYPES.ARIA,
        SELECTOR_TYPES.ROLE,
        SELECTOR_TYPES.CSS,
        SELECTOR_TYPES.XPATH,
        SELECTOR_TYPES.TEXT
      ],
      ...options
    };
        
    this.healingHistory = new Map();
    this.selectorStats = new Map();
  }

  /**
     * Parse a selector string into structured format
     * @param {string} selector - Raw selector string
     * @returns {Object} Parsed selector object
     */
  parse(selector) {
    // Check for XPath
    if (selector.startsWith('//') || selector.startsWith('(//') || selector.startsWith('xpath=')) {
      return {
        type: SELECTOR_TYPES.XPATH,
        value: selector.replace(/^xpath=/, '')
      };
    }

    // Check for text selector
    if (selector.startsWith('text=') || selector.startsWith('has-text=')) {
      return {
        type: SELECTOR_TYPES.TEXT,
        value: selector.replace(/^(text|has-text)=/, '')
      };
    }

    // Check for ARIA selector
    if (selector.startsWith('aria=') || selector.startsWith('[aria-')) {
      const match = selector.match(/aria=(.+)/) || selector.match(/\[aria-label=["'](.+?)["']\]/);
      if (match) {
        return {
          type: SELECTOR_TYPES.ARIA,
          value: match[1]
        };
      }
    }

    // Check for role selector
    if (selector.startsWith('role=') || selector.startsWith('[role=')) {
      const match = selector.match(/role=(.+)/) || selector.match(/\[role=["'](.+?)["']\]/);
      if (match) {
        return {
          type: SELECTOR_TYPES.ROLE,
          value: match[1]
        };
      }
    }

    // Check for test-id selector
    if (selector.startsWith('data-testid=') || selector.startsWith('[data-testid=')) {
      const match = selector.match(/data-testid=(.+)/) || selector.match(/\[data-testid=["'](.+?)["']\]/);
      if (match) {
        return {
          type: SELECTOR_TYPES.TEST_ID,
          value: match[1]
        };
      }
    }

    // Check for data attribute selector
    if (selector.startsWith('data-')) {
      return {
        type: SELECTOR_TYPES.DATA,
        value: selector
      };
    }

    // Default to CSS
    return {
      type: SELECTOR_TYPES.CSS,
      value: selector
    };
  }

  /**
     * Build CSS selector from structured format
     * @param {Object} parsed - Parsed selector object
     * @returns {string} CSS selector
     */
  buildCSS(parsed) {
    switch (parsed.type) {
      case SELECTOR_TYPES.CSS:
        return parsed.value;
            
      case SELECTOR_TYPES.TEST_ID:
        return `[data-testid="${parsed.value}"]`;
            
      case SELECTOR_TYPES.DATA:
        return parsed.value;
            
      case SELECTOR_TYPES.ARIA:
        return `[aria-label="${parsed.value}"]`;
            
      case SELECTOR_TYPES.ROLE:
        return `[role="${parsed.value}"]`;
            
      case SELECTOR_TYPES.LABEL:
        return `label:has-text("${parsed.value}")`;
            
      case SELECTOR_TYPES.PLACEHOLDER:
        return `[placeholder="${parsed.value}"]`;
            
      default:
        return parsed.value;
    }
  }

  /**
     * Generate fallback selectors for an element
     * @param {Object} elementInfo - Element information object
     * @returns {Array<Object>} Array of fallback selector objects
     */
  generateFallbacks(elementInfo) {
    const fallbacks = [];

    // Test ID (highest priority for testing)
    if (elementInfo.testId) {
      fallbacks.push({
        type: SELECTOR_TYPES.TEST_ID,
        value: elementInfo.testId,
        priority: 1
      });
    }

    // Data attributes
    if (elementInfo.dataAttributes) {
      Object.entries(elementInfo.dataAttributes).forEach(([key, value]) => {
        fallbacks.push({
          type: SELECTOR_TYPES.DATA,
          value: `[data-${key}="${value}"]`,
          priority: 2
        });
      });
    }

    // ARIA label
    if (elementInfo.ariaLabel) {
      fallbacks.push({
        type: SELECTOR_TYPES.ARIA,
        value: elementInfo.ariaLabel,
        priority: 3
      });
    }

    // Role + text combination
    if (elementInfo.role && elementInfo.text) {
      fallbacks.push({
        type: SELECTOR_TYPES.NESTED,
        value: `[role="${elementInfo.role}"]:has-text("${elementInfo.text.substring(0, 50)}")`,
        priority: 4
      });
    }

    // ID
    if (elementInfo.id) {
      fallbacks.push({
        type: SELECTOR_TYPES.CSS,
        value: `#${elementInfo.id}`,
        priority: 5
      });
    }

    // Class (if unique enough)
    if (elementInfo.class && elementInfo.class.split(' ').length <= 2) {
      fallbacks.push({
        type: SELECTOR_TYPES.CSS,
        value: `.${elementInfo.class.split(' ').join('.')}`,
        priority: 6
      });
    }

    // Role only
    if (elementInfo.role) {
      fallbacks.push({
        type: SELECTOR_TYPES.ROLE,
        value: elementInfo.role,
        priority: 7
      });
    }

    // Tag + text
    if (elementInfo.tag && elementInfo.text) {
      fallbacks.push({
        type: SELECTOR_TYPES.TEXT,
        value: elementInfo.text.substring(0, 50),
        tag: elementInfo.tag,
        priority: 8
      });
    }

    // XPath with multiple attributes
    if (elementInfo.tag) {
      let xpath = `//${elementInfo.tag}`;
      const conditions = [];
            
      if (elementInfo.text) {
        conditions.push(`contains(text(), "${elementInfo.text.substring(0, 30)}")`);
      }
      if (elementInfo.class) {
        conditions.push(`contains(@class, "${elementInfo.class.split(' ')[0]}")`);
      }
            
      if (conditions.length > 0) {
        xpath += `[${conditions.join(' and ')}]`;
        fallbacks.push({
          type: SELECTOR_TYPES.XPATH,
          value: xpath,
          priority: 9
        });
      }
    }

    // Sort by priority
    return fallbacks.sort((a, b) => a.priority - b.priority);
  }

  /**
     * Find element with healing fallback
     * @param {Object} page - Page adapter instance
     * @param {string} selector - Original selector
     * @param {Object} options - Find options
     * @returns {Promise<Object>} Element handle and metadata
     */
  async findWithHealing(page, selector, options = {}) {
    const startTime = Date.now();
    const parsed = this.parse(selector);
        
    // Try primary selector first
    let element = await this.trySelector(page, parsed);
        
    if (element) {
      this.recordSuccess(selector, parsed.type);
      return {
        element,
        selector: this.buildCSS(parsed),
        originalSelector: selector,
        healingApplied: false,
        strategy: parsed.type,
        timeTaken: Date.now() - startTime
      };
    }

    // If healing is disabled, fail fast
    if (!this.options.enableHealing) {
      throw new Error(`Element not found with selector: ${selector}`);
    }

    // Try fallback strategies
    console.log(`[SelectorEngine] Primary selector failed: ${selector}. Attempting healing...`);
        
    for (const strategy of this.options.preferredStrategies) {
      if (strategy === parsed.type) continue; // Already tried

      const fallbackSelectors = await this.generateHealingSelectors(page, selector, strategy);
            
      for (const fallback of fallbackSelectors) {
        element = await this.trySelector(page, fallback);
                
        if (element) {
          const healedSelector = this.buildCSS(fallback);
          this.recordHealing(selector, healedSelector, strategy);
                    
          console.log(`[SelectorEngine] Healed! Using: ${healedSelector}`);
                    
          return {
            element,
            selector: healedSelector,
            originalSelector: selector,
            healingApplied: true,
            healedBy: strategy,
            timeTaken: Date.now() - startTime
          };
        }
      }
    }

    // All strategies failed
    this.recordFailure(selector);
    throw new Error(
      `Element not found with selector: ${selector}. ` +
            'Healing attempted but no matching element found.'
    );
  }

  /**
     * Try to find element with a specific selector
     * @param {Object} page - Page adapter
     * @param {Object} selectorObj - Selector object
     * @returns {Promise<Object|null>}
     */
  async trySelector(page, selectorObj) {
    try {
      let element;
            
      switch (selectorObj.type) {
        case SELECTOR_TYPES.XPATH:
          element = await page.$x(selectorObj.value);
          return Array.isArray(element) ? element[0] : element;
                
        case SELECTOR_TYPES.TEXT:
          // Use page.evaluate to find by text
          element = await page.evaluateHandle((text) => {
            const walker = document.createTreeWalker(
              document.body,
              NodeFilter.SHOW_TEXT,
              null,
              false
            );
            let node;
            while (node = walker.nextNode()) {
              if (node.textContent.trim().includes(text)) {
                return node.parentElement;
              }
            }
            return null;
          }, selectorObj.value);
          return element;
                
        case SELECTOR_TYPES.ROLE:
          element = await page.$(`[role="${selectorObj.value}"]`);
          return element;
                
        case SELECTOR_TYPES.ARIA:
          element = await page.$(`[aria-label="${selectorObj.value}"]`);
          return element;
                
        default:
          // CSS selector
          const cssSelector = this.buildCSS(selectorObj);
          element = await page.$(cssSelector);
          return element;
      }
    } catch (e) {
      return null;
    }
  }

  /**
     * Generate healing selectors based on strategy
     * @param {Object} page - Page adapter
     * @param {string} originalSelector - Original failed selector
     * @param {string} strategy - Healing strategy
     * @returns {Promise<Array>}
     */
  async generateHealingSelectors(page, originalSelector, strategy) {
    const selectors = [];

    // Get page context to analyze DOM
    const pageInfo = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*'));
      return elements.map(el => ({
        tag: el.tagName.toLowerCase(),
        id: el.id,
        class: el.className,
        text: el.textContent?.trim().substring(0, 100),
        ariaLabel: el.getAttribute('aria-label'),
        role: el.getAttribute('role'),
        testId: el.getAttribute('data-testid'),
        placeholder: el.getAttribute('placeholder'),
        dataAttributes: Object.fromEntries(
          Array.from(el.attributes)
            .filter(attr => attr.name.startsWith('data-'))
            .map(attr => [attr.name.replace('data-', ''), attr.value])
        )
      }));
    });

    // Parse original selector to understand what we're looking for
    const parsed = this.parse(originalSelector);

    switch (strategy) {
      case SELECTOR_TYPES.TEXT:
        // Find elements with similar text
        pageInfo.forEach(info => {
          if (info.text && parsed.value && 
                        (info.text.includes(parsed.value) || 
                         parsed.value.includes(info.text))) {
            selectors.push({
              type: SELECTOR_TYPES.TEXT,
              value: info.text
            });
          }
        });
        break;

      case SELECTOR_TYPES.ARIA:
        // Find by ARIA label similarity
        pageInfo.forEach(info => {
          if (info.ariaLabel) {
            selectors.push({
              type: SELECTOR_TYPES.ARIA,
              value: info.ariaLabel
            });
          }
        });
        break;

      case SELECTOR_TYPES.ROLE:
        // Find by role
        pageInfo.forEach(info => {
          if (info.role) {
            selectors.push({
              type: SELECTOR_TYPES.ROLE,
              value: info.role
            });
          }
        });
        break;

      case SELECTOR_TYPES.CSS:
        // Try variations of the original selector
        if (parsed.type === SELECTOR_TYPES.CSS) {
          // Try without classes
          const noClass = parsed.value.replace(/\.[a-zA-Z0-9_-]+/g, '');
          if (noClass !== parsed.value) {
            selectors.push({ type: SELECTOR_TYPES.CSS, value: noClass });
          }
                    
          // Try with partial ID
          const idMatch = parsed.value.match(/#([a-zA-Z0-9_-]+)/);
          if (idMatch) {
            selectors.push({ 
              type: SELECTOR_TYPES.CSS, 
              value: `[id*="${idMatch[1]}"]` 
            });
          }
        }
        break;

      default:
        // Generate fallbacks from page info
        pageInfo.slice(0, 20).forEach(info => {
          const fallbacks = this.generateFallbacks(info);
          selectors.push(...fallbacks);
        });
    }

    return selectors;
  }

  /**
     * Wait for element with healing
     * @param {Object} page - Page adapter
     * @param {string} selector - Element selector
     * @param {Object} options - Wait options
     * @returns {Promise<Object>}
     */
  async waitForElement(page, selector, options = {}) {
    const timeout = options.timeout || this.options.timeout;
    const startTime = Date.now();
        
    while (Date.now() - startTime < timeout) {
      try {
        const result = await this.findWithHealing(page, selector, options);
        if (result.element) {
          return result;
        }
      } catch (e) {
        // Continue waiting
      }
            
      await page.waitForTimeout(100);
    }

    throw new Error(`Timeout waiting for element: ${selector}`);
  }

  /**
     * Record successful selector usage
     * @private
     */
  recordSuccess(selector, type) {
    const key = `${type}:${selector}`;
    const stats = this.selectorStats.get(key) || { successes: 0, failures: 0 };
    stats.successes++;
    stats.lastSuccess = Date.now();
    this.selectorStats.set(key, stats);
  }

  /**
     * Record healing event
     * @private
     */
  recordHealing(original, healed, strategy) {
    const key = original;
    const history = this.healingHistory.get(key) || [];
    history.push({
      from: original,
      to: healed,
      strategy,
      timestamp: Date.now()
    });
    this.healingHistory.set(key, history);
  }

  /**
     * Record selector failure
     * @private
     */
  recordFailure(selector) {
    const key = selector;
    const stats = this.selectorStats.get(key) || { successes: 0, failures: 0 };
    stats.failures++;
    stats.lastFailure = Date.now();
    this.selectorStats.set(key, stats);
  }

  /**
     * Get healing statistics
     * @returns {Object}
     */
  getStats() {
    return {
      selectorStats: Object.fromEntries(this.selectorStats),
      healingEvents: Array.from(this.healingHistory.entries()).map(([key, history]) => ({
        selector: key,
        healCount: history.length,
        lastHealed: history[history.length - 1]?.timestamp
      }))
    };
  }

  /**
     * Clear healing history
     */
  clearHistory() {
    this.healingHistory.clear();
    this.selectorStats.clear();
  }
}

module.exports = {
  SelectorEngine,
  SELECTOR_TYPES
};
