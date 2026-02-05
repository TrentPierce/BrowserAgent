/**
 * Accessibility Testing Automation
 * Comprehensive WCAG 2.1 compliance testing
 * @module testing/accessibilityTester
 */

const axe = require('axe-core');

class AccessibilityTester {
  constructor(config = {}) {
    this.config = {
      standard: config.standard || 'WCAG21AA',
      runOnly: config.runOnly || ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
      reporter: config.reporter || 'v2',
      resultTypes: config.resultTypes || ['violations', 'incomplete', 'passes'],
      ...config
    };
    
    this.testResults = [];
    this.violations = [];
    this.recommendations = [];
  }

  /**
   * Run comprehensive accessibility audit
   */
  async runAudit(page, options = {}) {
    const startTime = Date.now();
    
    try {
      // Inject axe-core
      await this.injectAxe(page);
      
      // Run axe tests
      const results = await page.evaluate((axeOptions) => {
        return window.axe.run(axeOptions);
      }, {
        runOnly: {
          type: 'tag',
          values: this.config.runOnly
        },
        resultTypes: this.config.resultTypes
      });
      
      // Additional custom tests
      const customResults = await this.runCustomTests(page);
      
      // Analyze keyboard navigation
      const keyboardResults = await this.testKeyboardNavigation(page);
      
      // Test screen reader compatibility
      const screenReaderResults = await this.testScreenReaderCompatibility(page);
      
      // Compile results
      const compiledResults = {
        url: page.url(),
        timestamp: Date.now(),
        executionTime: Date.now() - startTime,
        axe: results,
        custom: customResults,
        keyboard: keyboardResults,
        screenReader: screenReaderResults,
        summary: this.generateSummary(results, customResults, keyboardResults, screenReaderResults)
      };
      
      this.testResults.push(compiledResults);
      this.violations.push(...results.violations);
      
      return compiledResults;
      
    } catch (error) {
      console.error('Accessibility audit failed:', error);
      throw error;
    }
  }

  /**
   * Inject axe-core into page
   */
  async injectAxe(page) {
    const axeSource = require('axe-core').source;
    await page.evaluate(axeSource);
  }

  /**
   * Run custom accessibility tests
   */
  async runCustomTests(page) {
    const results = {
      colorContrast: await this.testColorContrast(page),
      formLabels: await this.testFormLabels(page),
      headingHierarchy: await this.testHeadingHierarchy(page),
      altText: await this.testAltText(page),
      ariaLabels: await this.testAriaLabels(page),
      focusIndicators: await this.testFocusIndicators(page),
      semanticHTML: await this.testSemanticHTML(page)
    };
    
    return results;
  }

  /**
   * Test color contrast
   */
  async testColorContrast(page) {
    return await page.evaluate(() => {
      const results = [];
      const elements = document.querySelectorAll('*');
      
      elements.forEach(el => {
        const style = window.getComputedStyle(el);
        const bgColor = style.backgroundColor;
        const textColor = style.color;
        
        if (bgColor && textColor && el.textContent.trim()) {
          const contrast = calculateContrastRatio(bgColor, textColor);
          const fontSize = parseFloat(style.fontSize);
          const fontWeight = style.fontWeight;
          
          const minContrast = (fontSize >= 18 || (fontSize >= 14 && fontWeight >= 700)) ? 3 : 4.5;
          
          if (contrast < minContrast) {
            results.push({
              element: el.tagName,
              selector: generateSelector(el),
              contrast: contrast,
              required: minContrast,
              textColor: textColor,
              backgroundColor: bgColor
            });
          }
        }
      });
      
      function calculateContrastRatio(bg, fg) {
        const l1 = getLuminance(bg);
        const l2 = getLuminance(fg);
        return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      }
      
      function getLuminance(color) {
        const rgb = color.match(/\d+/g);
        if (!rgb) return 0;
        const [r, g, b] = rgb.map(v => {
          v = parseInt(v) / 255;
          return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      }
      
      function generateSelector(el) {
        if (el.id) return `#${el.id}`;
        if (el.className) return `${el.tagName}.${el.className.split(' ')[0]}`;
        return el.tagName;
      }
      
      return {
        passed: results.length === 0,
        violations: results,
        count: results.length
      };
    });
  }

  /**
   * Test form labels
   */
  async testFormLabels(page) {
    return await page.evaluate(() => {
      const results = [];
      const inputs = document.querySelectorAll('input, select, textarea');
      
      inputs.forEach(input => {
        const hasLabel = input.labels && input.labels.length > 0;
        const hasAriaLabel = input.hasAttribute('aria-label') || input.hasAttribute('aria-labelledby');
        const hasTitle = input.hasAttribute('title');
        
        if (!hasLabel && !hasAriaLabel && !hasTitle) {
          results.push({
            element: input.tagName,
            type: input.type,
            id: input.id,
            name: input.name
          });
        }
      });
      
      return {
        passed: results.length === 0,
        violations: results,
        count: results.length
      };
    });
  }

  /**
   * Test heading hierarchy
   */
  async testHeadingHierarchy(page) {
    return await page.evaluate(() => {
      const results = [];
      const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
      let previousLevel = 0;
      
      headings.forEach(heading => {
        const level = parseInt(heading.tagName.charAt(1));
        
        if (previousLevel > 0 && level > previousLevel + 1) {
          results.push({
            heading: heading.tagName,
            text: heading.textContent.substring(0, 50),
            issue: `Skipped from H${previousLevel} to H${level}`
          });
        }
        
        previousLevel = level;
      });
      
      return {
        passed: results.length === 0,
        violations: results,
        count: results.length
      };
    });
  }

  /**
   * Test alt text for images
   */
  async testAltText(page) {
    return await page.evaluate(() => {
      const results = [];
      const images = document.querySelectorAll('img');
      
      images.forEach(img => {
        const hasAlt = img.hasAttribute('alt');
        const altText = img.getAttribute('alt');
        const isDecorative = img.hasAttribute('role') && img.getAttribute('role') === 'presentation';
        
        if (!hasAlt && !isDecorative) {
          results.push({
            src: img.src,
            issue: 'Missing alt attribute'
          });
        } else if (hasAlt && !altText && !isDecorative) {
          results.push({
            src: img.src,
            issue: 'Empty alt text (should be decorative or have description)'
          });
        }
      });
      
      return {
        passed: results.length === 0,
        violations: results,
        count: results.length
      };
    });
  }

  /**
   * Test ARIA labels
   */
  async testAriaLabels(page) {
    return await page.evaluate(() => {
      const results = [];
      const ariaElements = document.querySelectorAll('[role]');
      
      ariaElements.forEach(el => {
        const role = el.getAttribute('role');
        const requiresLabel = ['button', 'link', 'checkbox', 'radio', 'textbox'].includes(role);
        
        if (requiresLabel) {
          const hasAriaLabel = el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby');
          const hasTextContent = el.textContent.trim().length > 0;
          
          if (!hasAriaLabel && !hasTextContent) {
            results.push({
              role: role,
              element: el.tagName,
              issue: 'Missing accessible name'
            });
          }
        }
      });
      
      return {
        passed: results.length === 0,
        violations: results,
        count: results.length
      };
    });
  }

  /**
   * Test focus indicators
   */
  async testFocusIndicators(page) {
    return await page.evaluate(() => {
      const results = [];
      const focusableElements = document.querySelectorAll(
        'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      
      focusableElements.forEach(el => {
        const style = window.getComputedStyle(el, ':focus');
        const hasOutline = style.outline !== 'none' && style.outline !== '0px';
        const hasBorder = style.borderWidth !== '0px';
        const hasBoxShadow = style.boxShadow !== 'none';
        
        if (!hasOutline && !hasBorder && !hasBoxShadow) {
          results.push({
            element: el.tagName,
            type: el.type,
            issue: 'No visible focus indicator'
          });
        }
      });
      
      return {
        passed: results.length === 0,
        violations: results,
        count: results.length
      };
    });
  }

  /**
   * Test semantic HTML
   */
  async testSemanticHTML(page) {
    return await page.evaluate(() => {
      const results = [];
      
      // Check for semantic landmarks
      const hasHeader = document.querySelector('header, [role="banner"]');
      const hasMain = document.querySelector('main, [role="main"]');
      const hasNav = document.querySelector('nav, [role="navigation"]');
      
      if (!hasHeader) results.push({ issue: 'Missing header landmark' });
      if (!hasMain) results.push({ issue: 'Missing main landmark' });
      
      // Check for divs that should be buttons
      const clickableDivs = Array.from(document.querySelectorAll('div[onclick], div[ng-click]'));
      clickableDivs.forEach(div => {
        results.push({
          element: 'div',
          issue: 'Clickable div should be a button',
          innerHTML: div.innerHTML.substring(0, 50)
        });
      });
      
      return {
        passed: results.length === 0,
        violations: results,
        count: results.length
      };
    });
  }

  /**
   * Test keyboard navigation
   */
  async testKeyboardNavigation(page) {
    try {
      const focusableElements = await page.evaluate(() => {
        const elements = document.querySelectorAll(
          'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        return elements.length;
      });
      
      let tabCount = 0;
      let focusedElements = [];
      
      // Simulate Tab navigation
      for (let i = 0; i < Math.min(focusableElements, 20); i++) {
        await page.keyboard.press('Tab');
        tabCount++;
        
        const focusedElement = await page.evaluate(() => {
          const el = document.activeElement;
          return {
            tag: el.tagName,
            id: el.id,
            class: el.className,
            visible: el.offsetWidth > 0 && el.offsetHeight > 0
          };
        });
        
        focusedElements.push(focusedElement);
      }
      
      return {
        passed: tabCount > 0,
        focusableCount: focusableElements,
        tabNavigationWorks: tabCount > 0,
        focusedElements: focusedElements
      };
      
    } catch (error) {
      return {
        passed: false,
        error: error.message
      };
    }
  }

  /**
   * Test screen reader compatibility
   */
  async testScreenReaderCompatibility(page) {
    return await page.evaluate(() => {
      const results = {
        ariaLive: [],
        ariaHidden: [],
        roleUsage: []
      };
      
      // Check aria-live regions
      const liveRegions = document.querySelectorAll('[aria-live]');
      results.ariaLive = Array.from(liveRegions).map(el => ({
        element: el.tagName,
        ariaLive: el.getAttribute('aria-live')
      }));
      
      // Check aria-hidden usage
      const hiddenElements = document.querySelectorAll('[aria-hidden="true"]');
      hiddenElements.forEach(el => {
        const hasFocusableChild = el.querySelector(
          'a[href], button, input, select, textarea'
        );
        if (hasFocusableChild) {
          results.ariaHidden.push({
            element: el.tagName,
            issue: 'Focusable element inside aria-hidden'
          });
        }
      });
      
      // Check role usage
      const roleElements = document.querySelectorAll('[role]');
      results.roleUsage = Array.from(roleElements).map(el => ({
        element: el.tagName,
        role: el.getAttribute('role')
      }));
      
      return {
        passed: results.ariaHidden.length === 0,
        ...results
      };
    });
  }

  /**
   * Generate summary report
   */
  generateSummary(axeResults, customResults, keyboardResults, screenReaderResults) {
    const totalViolations = 
      axeResults.violations.length +
      Object.values(customResults).reduce((sum, r) => sum + (r.count || 0), 0);
    
    const criticalIssues = axeResults.violations.filter(v => v.impact === 'critical').length;
    const seriousIssues = axeResults.violations.filter(v => v.impact === 'serious').length;
    
    return {
      totalViolations,
      criticalIssues,
      seriousIssues,
      passed: totalViolations === 0,
      score: this.calculateAccessibilityScore(axeResults, customResults),
      wcagLevel: this.determineWCAGLevel(axeResults),
      keyboardAccessible: keyboardResults.passed,
      screenReaderFriendly: screenReaderResults.passed
    };
  }

  /**
   * Calculate accessibility score (0-100)
   */
  calculateAccessibilityScore(axeResults, customResults) {
    let score = 100;
    
    // Deduct for axe violations
    axeResults.violations.forEach(v => {
      const deduction = {
        'critical': 10,
        'serious': 5,
        'moderate': 2,
        'minor': 1
      }[v.impact] || 1;
      
      score -= deduction * v.nodes.length;
    });
    
    // Deduct for custom test failures
    Object.values(customResults).forEach(result => {
      score -= (result.count || 0) * 2;
    });
    
    return Math.max(0, score);
  }

  /**
   * Determine WCAG compliance level
   */
  determineWCAGLevel(axeResults) {
    const aViolations = axeResults.violations.filter(v => 
      v.tags.includes('wcag2a') || v.tags.includes('wcag21a')
    );
    
    const aaViolations = axeResults.violations.filter(v => 
      v.tags.includes('wcag2aa') || v.tags.includes('wcag21aa')
    );
    
    if (aViolations.length === 0 && aaViolations.length === 0) return 'AA';
    if (aViolations.length === 0) return 'A';
    return 'None';
  }

  /**
   * Generate recommendations
   */
  generateRecommendations(results) {
    const recommendations = [];
    
    // Analyze results and generate actionable recommendations
    if (results.axe.violations.length > 0) {
      results.axe.violations.forEach(violation => {
        recommendations.push({
          priority: violation.impact,
          issue: violation.description,
          help: violation.help,
          helpUrl: violation.helpUrl,
          affectedElements: violation.nodes.length
        });
      });
    }
    
    return recommendations;
  }

  /**
   * Get test results
   */
  getResults() {
    return {
      results: this.testResults,
      violations: this.violations,
      summary: this.generateOverallSummary()
    };
  }

  /**
   * Generate overall summary
   */
  generateOverallSummary() {
    if (this.testResults.length === 0) return null;
    
    const avgScore = this.testResults.reduce((sum, r) => sum + r.summary.score, 0) / this.testResults.length;
    const totalViolations = this.violations.length;
    
    return {
      averageScore: avgScore,
      totalViolations: totalViolations,
      pagesAudited: this.testResults.length,
      overallWCAGLevel: this.testResults.every(r => r.summary.wcagLevel === 'AA') ? 'AA' : 'Partial'
    };
  }
}

module.exports = AccessibilityTester;
