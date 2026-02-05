/**
 * Cross-Domain Pattern Recognition
 * Learns and applies patterns across different domains and websites
 * @module vision/patternRecognition
 */

class PatternRecognition {
  constructor(database) {
    this.db = database;
    this.patterns = new Map();
    this.domainPatterns = new Map();
    this.crossDomainPatterns = [];
    this.initialize();
  }

  async initialize() {
    await this.loadPatternsFromDatabase();
    this.analyzeCrossDomainPatterns();
  }

  /**
   * Learn pattern from successful interaction
   */
  async learnPattern(interaction) {
    const pattern = {
      id: this.generatePatternId(),
      domain: this.extractDomain(interaction.url),
      type: interaction.type,
      selector: interaction.selector,
      visualFeatures: interaction.visualFeatures || {},
      context: interaction.context || {},
      success: interaction.success,
      timestamp: Date.now(),
      frequency: 1
    };
    
    // Store in memory
    const key = this.generatePatternKey(pattern);
    if (this.patterns.has(key)) {
      const existing = this.patterns.get(key);
      existing.frequency++;
      existing.lastSeen = Date.now();
    } else {
      this.patterns.set(key, pattern);
    }
    
    // Store in database
    if (this.db) {
      await this.savePatternToDatabase(pattern);
    }
    
    // Update domain-specific patterns
    this.updateDomainPatterns(pattern);
    
    // Re-analyze cross-domain patterns
    this.analyzeCrossDomainPatterns();
    
    return pattern;
  }

  /**
   * Find applicable patterns for current context
   */
  findApplicablePatterns(context) {
    const domain = this.extractDomain(context.url);
    const applicable = [];
    
    // 1. Check domain-specific patterns
    if (this.domainPatterns.has(domain)) {
      applicable.push(...this.domainPatterns.get(domain));
    }
    
    // 2. Check cross-domain patterns
    const crossDomain = this.crossDomainPatterns.filter(p => 
      this.matchesContext(p, context)
    );
    applicable.push(...crossDomain);
    
    // 3. Check similar domains
    const similarDomains = this.findSimilarDomains(domain);
    similarDomains.forEach(similarDomain => {
      if (this.domainPatterns.has(similarDomain)) {
        const patterns = this.domainPatterns.get(similarDomain).map(p => ({
          ...p,
          source: 'similar-domain',
          confidence: p.confidence * 0.8
        }));
        applicable.push(...patterns);
      }
    });
    
    // Sort by relevance
    return applicable.sort((a, b) => 
      (b.frequency || 0) * (b.confidence || 1) - (a.frequency || 0) * (a.confidence || 1)
    );
  }

  /**
   * Analyze and extract cross-domain patterns
   */
  analyzeCrossDomainPatterns() {
    const patternGroups = new Map();
    
    // Group patterns by characteristics
    for (const [key, pattern] of this.patterns) {
      const characteristics = this.extractCharacteristics(pattern);
      const charKey = JSON.stringify(characteristics);
      
      if (!patternGroups.has(charKey)) {
        patternGroups.set(charKey, []);
      }
      patternGroups.get(charKey).push(pattern);
    }
    
    // Identify patterns that work across domains
    this.crossDomainPatterns = [];
    for (const [charKey, patterns] of patternGroups) {
      if (patterns.length >= 3) { // Pattern seen in at least 3 contexts
        const domains = new Set(patterns.map(p => p.domain));
        if (domains.size >= 2) { // Works across at least 2 domains
          const crossPattern = this.createCrossPattern(patterns);
          this.crossDomainPatterns.push(crossPattern);
        }
      }
    }
  }

  /**
   * Extract pattern characteristics
   */
  extractCharacteristics(pattern) {
    return {
      type: pattern.type,
      hasText: !!pattern.visualFeatures?.text,
      hasIcon: !!pattern.visualFeatures?.icon,
      position: this.normalizePosition(pattern.visualFeatures?.position),
      colorScheme: this.normalizeColorScheme(pattern.visualFeatures?.colors),
      size: this.normalizeSize(pattern.visualFeatures?.size)
    };
  }

  /**
   * Create cross-domain pattern from similar patterns
   */
  createCrossPattern(patterns) {
    const totalFrequency = patterns.reduce((sum, p) => sum + (p.frequency || 1), 0);
    const successRate = patterns.filter(p => p.success).length / patterns.length;
    
    return {
      id: this.generatePatternId(),
      type: 'cross-domain',
      characteristics: this.extractCharacteristics(patterns[0]),
      domains: [...new Set(patterns.map(p => p.domain))],
      frequency: totalFrequency,
      successRate: successRate,
      confidence: Math.min(successRate * (totalFrequency / patterns.length), 1),
      examples: patterns.slice(0, 5),
      lastUpdated: Date.now()
    };
  }

  /**
   * Find domains similar to given domain
   */
  findSimilarDomains(domain) {
    const similar = [];
    const domainParts = domain.split('.');
    
    for (const [otherDomain] of this.domainPatterns) {
      if (otherDomain === domain) continue;
      
      const otherParts = otherDomain.split('.');
      const similarity = this.calculateDomainSimilarity(domainParts, otherParts);
      
      if (similarity > 0.5) {
        similar.push(otherDomain);
      }
    }
    
    return similar;
  }

  /**
   * Calculate similarity between domains
   */
  calculateDomainSimilarity(parts1, parts2) {
    let matches = 0;
    const maxLen = Math.max(parts1.length, parts2.length);
    
    for (let i = 0; i < Math.min(parts1.length, parts2.length); i++) {
      if (parts1[i] === parts2[i]) matches++;
    }
    
    return matches / maxLen;
  }

  /**
   * Check if pattern matches current context
   */
  matchesContext(pattern, context) {
    if (pattern.type !== context.type) return false;
    
    // Check visual features if available
    if (pattern.characteristics && context.visualFeatures) {
      const similarity = this.calculateVisualSimilarity(
        pattern.characteristics,
        this.extractCharacteristics({ visualFeatures: context.visualFeatures })
      );
      return similarity > 0.7;
    }
    
    return true;
  }

  /**
   * Calculate visual similarity between patterns
   */
  calculateVisualSimilarity(char1, char2) {
    let score = 0;
    let weights = 0;
    
    if (char1.type === char2.type) { score += 0.3; }
    weights += 0.3;
    
    if (char1.hasText === char2.hasText) { score += 0.2; }
    weights += 0.2;
    
    if (char1.hasIcon === char2.hasIcon) { score += 0.1; }
    weights += 0.1;
    
    if (char1.position === char2.position) { score += 0.2; }
    weights += 0.2;
    
    if (char1.size === char2.size) { score += 0.2; }
    weights += 0.2;
    
    return score / weights;
  }

  /**
   * Update domain-specific patterns
   */
  updateDomainPatterns(pattern) {
    const domain = pattern.domain;
    if (!this.domainPatterns.has(domain)) {
      this.domainPatterns.set(domain, []);
    }
    
    const patterns = this.domainPatterns.get(domain);
    const existing = patterns.find(p => 
      p.type === pattern.type && 
      p.selector === pattern.selector
    );
    
    if (existing) {
      existing.frequency++;
      existing.lastSeen = Date.now();
    } else {
      patterns.push(pattern);
    }
  }

  /**
   * Helper methods
   */
  extractDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return 'unknown';
    }
  }

  generatePatternId() {
    return `pattern_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generatePatternKey(pattern) {
    return `${pattern.domain}_${pattern.type}_${pattern.selector}`;
  }

  normalizePosition(position) {
    if (!position) return 'unknown';
    const { x = 0, y = 0 } = position;
    
    if (y < 0.2) return 'top';
    if (y > 0.8) return 'bottom';
    if (x < 0.2) return 'left';
    if (x > 0.8) return 'right';
    return 'center';
  }

  normalizeColorScheme(colors) {
    if (!colors || !colors.length) return 'unknown';
    
    const isDark = colors.some(c => this.isDarkColor(c));
    const isLight = colors.some(c => this.isLightColor(c));
    
    if (isDark && !isLight) return 'dark';
    if (isLight && !isDark) return 'light';
    return 'mixed';
  }

  normalizeSize(size) {
    if (!size) return 'medium';
    const area = (size.width || 0) * (size.height || 0);
    
    if (area < 1000) return 'small';
    if (area > 10000) return 'large';
    return 'medium';
  }

  isDarkColor(color) {
    // Simple brightness calculation
    if (typeof color === 'string') {
      const hex = color.replace('#', '');
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      const brightness = (r * 299 + g * 587 + b * 114) / 1000;
      return brightness < 128;
    }
    return false;
  }

  isLightColor(color) {
    return !this.isDarkColor(color);
  }

  /**
   * Database operations
   */
  async loadPatternsFromDatabase() {
    if (!this.db) return;
    
    try {
      const stmt = this.db.prepare('SELECT * FROM patterns WHERE timestamp > ?');
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      const rows = stmt.all(thirtyDaysAgo);
      
      rows.forEach(row => {
        const pattern = JSON.parse(row.data);
        const key = this.generatePatternKey(pattern);
        this.patterns.set(key, pattern);
      });
    } catch (error) {
      console.error('Failed to load patterns:', error);
    }
  }

  async savePatternToDatabase(pattern) {
    if (!this.db) return;
    
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO patterns (id, type, domain, data, timestamp)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        pattern.id,
        pattern.type,
        pattern.domain,
        JSON.stringify(pattern),
        pattern.timestamp
      );
    } catch (error) {
      console.error('Failed to save pattern:', error);
    }
  }

  /**
   * Get pattern statistics
   */
  getStats() {
    return {
      totalPatterns: this.patterns.size,
      domainPatterns: this.domainPatterns.size,
      crossDomainPatterns: this.crossDomainPatterns.length,
      averageFrequency: Array.from(this.patterns.values()).reduce((sum, p) => sum + (p.frequency || 1), 0) / this.patterns.size || 0
    };
  }
}

module.exports = PatternRecognition;
