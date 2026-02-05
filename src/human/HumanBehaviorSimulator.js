/**
 * ============================================================================
 * HUMAN BEHAVIOR SIMULATOR - Realistic Mouse & Keyboard Actions
 * ============================================================================
 * 
 * Simulates human-like mouse movements, typing patterns, and behavior
 * to avoid bot detection systems.
 * 
 * @author Trent Pierce
 * @license BrowserAgent Non-Commercial License
 * @copyright 2026 Trent Pierce
 * ============================================================================
 */

/**
 * Human behavior simulator for realistic interactions
 */
class HumanBehaviorSimulator {
  /**
     * @param {Object} options - Simulator options
     * @param {number} options.typingSpeed - Base typing speed (ms per char)
     * @param {number} options.typingVariance - Variance in typing speed
     * @param {number} options.mouseSpeed - Base mouse movement speed
     * @param {boolean} options.addMistakes - Add occasional typos
     * @param {number} options.pauseChance - Chance to pause between actions
     */
  constructor(options = {}) {
    this.options = {
      typingSpeed: 100,
      typingVariance: 50,
      mouseSpeed: 500,
      addMistakes: true,
      mistakeRate: 0.02,
      pauseChance: 0.1,
      minPause: 200,
      maxPause: 1000,
      ...options
    };

    this.mistakeChars = 'abcdefghijklmnopqrstuvwxyz';
  }

  /**
     * Type text with human-like delays and occasional mistakes
     * @param {Object} page - Page adapter
     * @param {string} selector - Input selector
     * @param {string} text - Text to type
     * @param {Object} options - Type options
     */
  async typeHumanLike(page, selector, text, options = {}) {
    const opts = { ...this.options, ...options };
        
    // Focus the element first
    await page.focus(selector);
        
    // Clear existing content
    await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (el) {
        el.value = '';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, selector);

    let typed = '';

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
            
      // Occasionally make a mistake and correct it
      if (opts.addMistakes && Math.random() < opts.mistakeRate) {
        // Type wrong character
        const wrongChar = this.mistakeChars[Math.floor(Math.random() * this.mistakeChars.length)];
        await page.keyboard.sendCharacter(wrongChar);
                
        // Pause (realizing the mistake)
        await this.sleep(this.randomBetween(300, 800));
                
        // Delete the mistake
        await page.press('Backspace');
                
        // Pause before continuing
        await this.sleep(this.randomBetween(200, 500));
      }

      // Type the correct character
      await page.keyboard.sendCharacter(char);
      typed += char;

      // Random delay between keystrokes
      const delay = this.getTypingDelay(opts);
      await this.sleep(delay);

      // Occasionally pause (thinking)
      if (Math.random() < opts.pauseChance) {
        await this.sleep(this.randomBetween(opts.minPause, opts.maxPause));
      }
    }

    // Small delay after typing
    await this.sleep(this.randomBetween(100, 300));
  }

  /**
     * Move mouse with human-like bezier curve
     * @param {Object} page - Page adapter
     * @param {number} startX - Start X coordinate
     * @param {number} startY - Start Y coordinate
     * @param {number} endX - End X coordinate
     * @param {number} endY - End Y coordinate
     * @param {Object} options - Movement options
     */
  async moveMouseHumanLike(page, startX, startY, endX, endY, options = {}) {
    const opts = { ...this.options, ...options };
    const steps = Math.floor(opts.mouseSpeed / 10);
        
    // Generate bezier curve points
    const controlX = (startX + endX) / 2 + this.randomBetween(-100, 100);
    const controlY = (startY + endY) / 2 + this.randomBetween(-100, 100);

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
            
      // Quadratic bezier curve
      const x = Math.pow(1 - t, 2) * startX + 
                     2 * (1 - t) * t * controlX + 
                     Math.pow(t, 2) * endX;
            
      const y = Math.pow(1 - t, 2) * startY + 
                     2 * (1 - t) * t * controlY + 
                     Math.pow(t, 2) * endY;

      // Add slight jitter
      const jitterX = this.randomBetween(-2, 2);
      const jitterY = this.randomBetween(-2, 2);

      await page.evaluate((px, py) => {
        const event = new MouseEvent('mousemove', {
          clientX: px,
          clientY: py,
          bubbles: true
        });
        document.dispatchEvent(event);
      }, Math.round(x + jitterX), Math.round(y + jitterY));

      // Variable delay between movements
      await this.sleep(this.randomBetween(5, 15));
    }
  }

  /**
     * Click element with human-like behavior
     * @param {Object} page - Page adapter
     * @param {string} selector - Element selector
     * @param {Object} options - Click options
     */
  async clickHumanLike(page, selector, options = {}) {
    // Get element position
    const box = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        width: rect.width,
        height: rect.height
      };
    }, selector);

    if (!box) {
      throw new Error(`Element '${selector}' not found`);
    }

    // Get current mouse position (simulate from random position)
    const startX = this.randomBetween(0, 1280);
    const startY = this.randomBetween(0, 720);

    // Move to element with human-like curve
    await this.moveMouseHumanLike(page, startX, startY, box.x, box.y);

    // Pause before clicking (hesitation)
    await this.sleep(this.randomBetween(50, 200));

    // Perform click sequence
    await page.hover(selector);
    await this.sleep(this.randomBetween(20, 50));
    await page.click(selector);

    // Pause after clicking
    await this.sleep(this.randomBetween(100, 300));
  }

  /**
     * Scroll with human-like behavior
     * @param {Object} page - Page adapter
     * @param {Object} options - Scroll options
     */
  async scrollHumanLike(page, options = {}) {
    const {
      direction = 'down',
      amount = 500,
      speed = 'medium'
    } = options;

    const speedMap = {
      slow: { steps: 50, delay: 20 },
      medium: { steps: 30, delay: 15 },
      fast: { steps: 15, delay: 10 }
    };

    const { steps, delay } = speedMap[speed] || speedMap.medium;
    const stepSize = amount / steps;

    for (let i = 0; i < steps; i++) {
      await page.evaluate((dir, size) => {
        window.scrollBy({
          top: dir === 'down' ? size : -size,
          behavior: 'auto'
        });
      }, direction, stepSize);

      // Variable delay with occasional pauses
      await this.sleep(delay + this.randomBetween(-5, 10));

      if (Math.random() < 0.1) {
        await this.sleep(this.randomBetween(100, 300)); // Pause to "read"
      }
    }
  }

  /**
     * Hover over element with realistic movement
     * @param {Object} page - Page adapter
     * @param {string} selector - Element selector
     */
  async hoverHumanLike(page, selector) {
    // Get element position
    const box = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      };
    }, selector);

    if (!box) {
      throw new Error(`Element '${selector}' not found`);
    }

    // Move to element from off-screen or random position
    const startX = this.randomBetween(-100, 100) > 0 ? -50 : 1330;
    const startY = this.randomBetween(0, 720);

    await this.moveMouseHumanLike(page, startX, startY, box.x, box.y);

    // Hover for a realistic duration
    await page.hover(selector);
    await this.sleep(this.randomBetween(500, 2000));
  }

  /**
     * Perform reading behavior (scroll + pause pattern)
     * @param {Object} page - Page adapter
     * @param {Object} options - Reading options
     */
  async simulateReading(page, options = {}) {
    const {
      scrollAmount = 300,
      paragraphs = 3
    } = options;

    for (let i = 0; i < paragraphs; i++) {
      // Scroll a bit
      await this.scrollHumanLike(page, {
        direction: 'down',
        amount: scrollAmount,
        speed: 'slow'
      });

      // "Read" (pause)
      const readTime = this.randomBetween(2000, 5000);
      await this.sleep(readTime);

      // Occasional back-scroll (re-reading)
      if (Math.random() < 0.3) {
        await this.scrollHumanLike(page, {
          direction: 'up',
          amount: scrollAmount / 2,
          speed: 'medium'
        });
        await this.sleep(this.randomBetween(1000, 2000));
      }
    }
  }

  /**
     * Get typing delay with variance
     * @private
     */
  getTypingDelay(options) {
    const base = options.typingSpeed;
    const variance = options.typingVariance;
    return this.randomBetween(base - variance, base + variance);
  }

  /**
     * Get random number between min and max
     * @private
     */
  randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
     * Sleep for duration
     * @private
     */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
     * Generate random delay pattern
     * @param {string} pattern - Pattern name ('fast', 'normal', 'careful')
 * @returns {number} Delay in ms
     */
  getDelayPattern(pattern = 'normal') {
    const patterns = {
      fast: () => this.randomBetween(50, 150),
      normal: () => this.randomBetween(100, 300),
      careful: () => this.randomBetween(200, 600)
    };

    return (patterns[pattern] || patterns.normal)();
  }

  /**
     * Simulate natural browsing session
     * @param {Object} page - Page adapter
     * @param {Object} options - Session options
     */
  async simulateBrowsingSession(page, options = {}) {
    const {
      actions = ['read', 'scroll', 'hover', 'click'],
      duration = 30000
    } = options;

    const startTime = Date.now();

    while (Date.now() - startTime < duration) {
      const action = actions[Math.floor(Math.random() * actions.length)];

      switch (action) {
        case 'read':
          await this.simulateReading(page, { paragraphs: 1 });
          break;
        case 'scroll':
          await this.scrollHumanLike(page, {
            direction: Math.random() > 0.5 ? 'down' : 'up',
            amount: this.randomBetween(200, 500)
          });
          break;
        case 'hover': {
          // Get random clickable element
          const elements = await page.$$('a, button, [role="button"]');
          if (elements.length > 0) {
            const randomEl = elements[this.randomBetween(0, elements.length - 1)];
            const selector = await page.evaluate(el => {
              // Generate simple selector
              if (el.id) return `#${el.id}`;
              if (el.className) return `.${el.className.split(' ')[0]}`;
              return el.tagName.toLowerCase();
            }, randomEl);
                        
            if (selector) {
              await this.hoverHumanLike(page, selector).catch(() => {});
            }
          }
          break;
        }
        case 'click':
          // Random pause between actions
          await this.sleep(this.randomBetween(1000, 3000));
          break;
      }

      // Random pause between actions
      await this.sleep(this.randomBetween(1000, 3000));
    }
  }
}

module.exports = HumanBehaviorSimulator;
