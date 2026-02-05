/**
 * ============================================================================
 * SELF-HEALING SELECTORS - Adaptive Element Location
 * ============================================================================
 * 
 * Implements intelligent selector healing that adapts when sites change.
 * Uses multiple fallback strategies and learns from successful recoveries.
 * 
 * @author Trent Pierce
 * @license BrowserAgent Non-Commercial License
 * @copyright 2026 Trent Pierce
 * ============================================================================
 */

const { SELECTOR_TYPES } = require('./SelectorEngine');

/**
 * Self-healing selector manager with ML-inspired recovery strategies
 */
class SelfHealingSelector {
  /**
     * @param {Object} options - Healing options
     * @param {number} options.maxRetries - Maximum healing attempts
     * @param {boolean} options.enableLearning - Enable learning from recoveries
     * @param {string} options.learningDbPath - Path to learning database
     */
  constructor(options = {}) {
    this.options = {
      maxRetries: 5,
      enableLearning: true,
      confidenceThreshold: 0.7,
      similarityThreshold: 0.8,
      ...options
    };

    // Healing history for learning
    this.healingHistory = new Map();
    this.successfulPatterns = new Map();
    this.elementFingerprints = new Map();
  }

  /**
     * Find element with self-healing
     * @param {Object} page - Page adapter
     * @param {string} selector - Original selector
     * @param {Object} context - Additional context (previous element info)
     * @returns {Promise<Object>} Healing result
     */
  async find(page, selector, context = {}) {
    const startTime = Date.now();
    const attempts = [];

    // Try original selector first
    const originalResult = await this.tryFind(page, selector);
    if (originalResult.success) {
      return {
        success: true,
        element: originalResult.element,
        selector: selector,
        healingApplied: false,
        attempts: 1,
        timeTaken: Date.now() - startTime
      };
    }

    attempts.push({ selector, success: false, error: originalResult.error });

    // Try healing strategies
    const strategies = this.getHealingStrategies(selector, context);

    for (let i = 0; i < Math.min(strategies.length, this.options.maxRetries); i++) {
      const strategy = strategies[i];
            
      try {
        const result = await this.tryFind(page, strategy.selector);
                
        if (result.success) {
          // Validate the healed element
          const validation = await this.validateElement(
            page, 
            result.element, 
            selector, 
            context
          );

          if (validation.confidence >= this.options.confidenceThreshold) {
            // Record successful healing
            this.recordHealing(selector, strategy, validation);

            return {
              success: true,
              element: result.element,
              selector: strategy.selector,
              originalSelector: selector,
              healingApplied: true,
              healedBy: strategy.name,
              confidence: validation.confidence,
              attempts: attempts.length + 1,
              timeTaken: Date.now() - startTime
            };
          }
        }

        attempts.push({ 
          selector: strategy.selector, 
          success: false,
          strategy: strategy.name
        });
      } catch (e) {
        attempts.push({ 
          selector: strategy.selector, 
          success: false, 
          error: e.message,
          strategy: strategy.name
        });
      }
    }

    // All strategies failed
    return {
      success: false,
      originalSelector: selector,
      healingApplied: false,
      attempts: attempts.length,
      timeTaken: Date.now() - startTime,
      error: 'All healing strategies failed',
      attemptLog: attempts
    };
  }

  /**
     * Try to find element with a selector
     * @private
     */
  async tryFind(page, selector) {
    try {
      const element = await page.$(selector);
      if (element) {
        return { success: true, element };
      }
      return { success: false, error: 'Element not found' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  /**
     * Get ordered list of healing strategies
     * @private
     */
  getHealingStrategies(originalSelector, context) {
    const strategies = [];

    // Strategy 1: Try learned successful alternatives
    if (this.options.enableLearning) {
      const learned = this.getLearnedStrategies(originalSelector);
      learned.forEach(s => strategies.push({
        name: 'learned',
        selector: s,
        priority: 1
      }));
    }

    // Strategy 2: ID variations
    const idVariations = this.generateIdVariations(originalSelector);
    idVariations.forEach(s => strategies.push({
      name: 'id-variation',
      selector: s,
      priority: 2
    }));

    // Strategy 3: Class variations
    const classVariations = this.generateClassVariations(originalSelector);
    classVariations.forEach(s => strategies.push({
      name: 'class-variation',
      selector: s,
      priority: 3
    }));

    // Strategy 4: Attribute-based selectors
    const attributeSelectors = this.generateAttributeSelectors(originalSelector, context);
    attributeSelectors.forEach(s => strategies.push({
      name: 'attribute',
      selector: s,
      priority: 4
    }));

    // Strategy 5: XPath alternatives
    const xpathAlternatives = this.generateXPathAlternatives(originalSelector, context);
    xpathAlternatives.forEach(s => strategies.push({
      name: 'xpath',
      selector: s,
      priority: 5
    }));

    // Strategy 6: Text-based search
    if (context.text) {
      strategies.push({
        name: 'text-search',
        selector: `text=${context.text}`,
        priority: 6
      });
    }

    // Strategy 7: ARIA-based
    if (context.ariaLabel) {
      strategies.push({
        name: 'aria',
        selector: `[aria-label="${context.ariaLabel}"]`,
        priority: 7
      });
    }

    // Strategy 8: Visual similarity (if CV available)
    if (context.visualFingerprint) {
      strategies.push({
        name: 'visual',
        selector: `:has-visual-match("${context.visualFingerprint}")`,
        priority: 8
      });
    }

    // Sort by priority
    return strategies.sort((a, b) => a.priority - b.priority);
  }

  /**
     * Generate ID-based variations
     * @private
     */
  generateIdVariations(selector) {
    const variations = [];
        
    // Extract ID if present
    const idMatch = selector.match(/#([a-zA-Z0-9_-]+)/);
    if (idMatch) {
      const id = idMatch[1];
            
      // Partial ID match
      variations.push(`[id*="${id}"]`);
            
      // ID with different prefixes/suffixes
      variations.push(`[id^="${id}"]`);
      variations.push(`[id$="${id}"]`);
            
      // Case-insensitive
      variations.push(`[id="${id}" i]`);
    }

    return variations;
  }

  /**
     * Generate class-based variations
     * @private
     */
  generateClassVariations(selector) {
    const variations = [];
        
    // Extract classes
    const classMatches = selector.match(/\.([a-zA-Z0-9_-]+)/g);
    if (classMatches) {
      const classes = classMatches.map(c => c.substring(1));
            
      // Try with fewer classes
      if (classes.length > 1) {
        variations.push(`.${classes[0]}`);
        variations.push(`.${classes.slice(0, 2).join('.')}`);
      }
            
      // Partial class match
      classes.forEach(cls => {
        variations.push(`[class*="${cls}"]`);
      });
            
      // Contains any of the classes
      variations.push(classes.map(c => `[class~="${c}"]`).join(''));
    }

    return variations;
  }

  /**
     * Generate attribute-based selectors
     * @private
     */
  generateAttributeSelectors(selector, context) {
    const selectors = [];
        
    // Common attributes to try
    const attributes = ['name', 'type', 'placeholder', 'title', 'data-testid'];
        
    attributes.forEach(attr => {
      if (context[attr]) {
        selectors.push(`[${attr}="${context[attr]}"]`);
      }
    });

    // Tag + attribute combinations
    if (context.tag && context.type) {
      selectors.push(`${context.tag}[type="${context.type}"]`);
    }

    return selectors;
  }

  /**
     * Generate XPath alternatives
     * @private
     */
  generateXPathAlternatives(selector, context) {
    const xpaths = [];
        
    if (context.tag) {
      // Simple tag-based XPath
      xpaths.push(`//${context.tag}`);
            
      // Tag with text
      if (context.text) {
        xpaths.push(`//${context.tag}[contains(text(), "${context.text.substring(0, 30)}")]`);
      }
            
      // Tag with class
      if (context.class) {
        const firstClass = context.class.split(' ')[0];
        xpaths.push(`//${context.tag}[contains(@class, "${firstClass}")]`);
      }
            
      // Tag with ID
      if (context.id) {
        xpaths.push(`//${context.tag}[@id="${context.id}"]`);
      }
    }

    return xpaths;
  }

  /**
     * Get learned strategies from history
     * @private
     */
  getLearnedStrategies(selector) {
    const history = this.healingHistory.get(selector);
    if (!history) return [];

    // Return strategies that worked before, sorted by success rate
    return history
      .filter(h => h.success)
      .sort((a, b) => b.confidence - a.confidence)
      .map(h => h.healedSelector);
  }

  /**
     * Validate healed element matches original intent
     * @private
     */
  async validateElement(page, element, originalSelector, context) {
    const checks = [];

    // Check 1: Element type matches
    if (context.tag) {
      const tagName = await page.evaluate(el => el.tagName.toLowerCase(), element);
      checks.push(tagName === context.tag.toLowerCase() ? 1 : 0.5);
    }

    // Check 2: Text content similarity
    if (context.text) {
      const text = await page.evaluate(el => el.textContent, element);
      const similarity = this.calculateSimilarity(
        context.text.toLowerCase(),
        (text || '').toLowerCase()
      );
      checks.push(similarity);
    }

    // Check 3: ARIA attributes match
    if (context.ariaLabel) {
      const ariaLabel = await page.evaluate(
        el => el.getAttribute('aria-label'),
        element
      );
      checks.push(ariaLabel === context.ariaLabel ? 1 : 0);
    }

    // Check 4: Role matches
    if (context.role) {
      const role = await page.evaluate(
        el => el.getAttribute('role'),
        element
      );
      checks.push(role === context.role ? 1 : 0.5);
    }

    // Calculate overall confidence
    const confidence = checks.length > 0 
      ? checks.reduce((a, b) => a + b, 0) / checks.length 
      : 0.5;

    return { confidence, checks };
  }

  /**
     * Calculate string similarity (Levenshtein-based)
     * @private
     */
  calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
        
    if (longer.length === 0) return 1.0;
        
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  /**
     * Calculate Levenshtein distance
     * @private
     */
  levenshteinDistance(str1, str2) {
    const matrix = [];
        
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
        
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
        
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
        
    return matrix[str2.length][str1.length];
  }

  /**
     * Record successful healing for learning
     * @private
     */
  recordHealing(originalSelector, strategy, validation) {
    if (!this.options.enableLearning) return;

    const history = this.healingHistory.get(originalSelector) || [];
    history.push({
      healedSelector: strategy.selector,
      strategy: strategy.name,
      confidence: validation.confidence,
      success: true,
      timestamp: Date.now()
    });
        
    this.healingHistory.set(originalSelector, history);

    // Also record as successful pattern
    const patterns = this.successfulPatterns.get(strategy.name) || [];
    patterns.push({
      from: originalSelector,
      to: strategy.selector,
      confidence: validation.confidence
    });
    this.successfulPatterns.set(strategy.name, patterns);
  }

  /**
     * Create element fingerprint for future healing
     * @param {Object} page - Page adapter
     * @param {Object} element - Element handle
     * @returns {Promise<Object>} Element fingerprint
     */
  async createFingerprint(page, element) {
    return await page.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
            
      return {
        tag: el.tagName.toLowerCase(),
        id: el.id,
        class: el.className,
        text: el.textContent?.trim().substring(0, 100),
        ariaLabel: el.getAttribute('aria-label'),
        role: el.getAttribute('role'),
        testId: el.getAttribute('data-testid'),
        type: el.getAttribute('type'),
        name: el.getAttribute('name'),
        placeholder: el.getAttribute('placeholder'),
        position: {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height
        },
        styles: {
          color: style.color,
          backgroundColor: style.backgroundColor,
          fontSize: style.fontSize,
          fontFamily: style.fontFamily
        },
        attributes: Array.from(el.attributes).reduce((acc, attr) => {
          acc[attr.name] = attr.value;
          return acc;
        }, {})
      };
    }, element);
  }

  /**
     * Export healing knowledge
     * @returns {Object}
     */
  exportKnowledge() {
    return {
      healingHistory: Object.fromEntries(this.healingHistory),
      successfulPatterns: Object.fromEntries(this.successfulPatterns),
      exportDate: new Date().toISOString()
    };
  }

  /**
     * Import healing knowledge
     * @param {Object} knowledge - Knowledge object
     */
  importKnowledge(knowledge) {
    if (knowledge.healingHistory) {
      this.healingHistory = new Map(Object.entries(knowledge.healingHistory));
    }
    if (knowledge.successfulPatterns) {
      this.successfulPatterns = new Map(Object.entries(knowledge.successfulPatterns));
    }
  }

  /**
     * Get healing statistics
     * @returns {Object}
     */
  getStats() {
    let totalAttempts = 0;
    let successfulHealings = 0;

    this.healingHistory.forEach(history => {
      totalAttempts += history.length;
      successfulHealings += history.filter(h => h.success).length;
    });

    return {
      totalSelectors: this.healingHistory.size,
      totalAttempts,
      successfulHealings,
      successRate: totalAttempts > 0 ? successfulHealings / totalAttempts : 0,
      strategyStats: Object.fromEntries(
        Array.from(this.successfulPatterns.entries()).map(([name, patterns]) => [
          name,
          { usageCount: patterns.length }
        ])
      )
    };
  }

  /**
     * Clear all healing history
     */
  clearHistory() {
    this.healingHistory.clear();
    this.successfulPatterns.clear();
    this.elementFingerprints.clear();
  }
}

module.exports = SelfHealingSelector;
