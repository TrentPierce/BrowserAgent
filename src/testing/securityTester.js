/**
 * Security Testing and Form Fuzzing
 * Automated security vulnerability detection
 * @module testing/securityTester
 */

class SecurityTester {
  constructor(config = {}) {
    this.config = {
      enableXSSTesting: config.enableXSSTesting !== false,
      enableSQLInjection: config.enableSQLInjection !== false,
      enableCSRFTesting: config.enableCSRFTesting !== false,
      enableFormFuzzing: config.enableFormFuzzing !== false,
      maxFuzzIterations: config.maxFuzzIterations || 50,
      fuzzIntensity: config.fuzzIntensity || 'medium', // low, medium, high
      ...config
    };
    
    this.vulnerabilities = [];
    this.testResults = [];
    this.fuzzResults = [];
    
    this.xssPayloads = this.generateXSSPayloads();
    this.sqlPayloads = this.generateSQLPayloads();
    this.fuzzPayloads = this.generateFuzzPayloads();
  }

  /**
   * Run comprehensive security audit
   */
  async runSecurityAudit(page, options = {}) {
    const startTime = Date.now();
    
    try {
      const results = {
        url: page.url(),
        timestamp: Date.now(),
        tests: {}
      };
      
      // Run various security tests
      if (this.config.enableXSSTesting) {
        results.tests.xss = await this.testXSSVulnerabilities(page);
      }
      
      if (this.config.enableSQLInjection) {
        results.tests.sqlInjection = await this.testSQLInjection(page);
      }
      
      if (this.config.enableCSRFTesting) {
        results.tests.csrf = await this.testCSRF(page);
      }
      
      if (this.config.enableFormFuzzing) {
        results.tests.fuzzing = await this.performFormFuzzing(page);
      }
      
      // Additional security checks
      results.tests.headers = await this.checkSecurityHeaders(page);
      results.tests.cookies = await this.analyzeCookieSecurity(page);
      results.tests.mixedContent = await this.checkMixedContent(page);
      results.tests.passwordFields = await this.analyzePasswordFields(page);
      
      results.executionTime = Date.now() - startTime;
      results.vulnerabilities = this.extractVulnerabilities(results.tests);
      results.riskLevel = this.calculateRiskLevel(results.vulnerabilities);
      
      this.testResults.push(results);
      
      return results;
      
    } catch (error) {
      console.error('Security audit failed:', error);
      throw error;
    }
  }

  /**
   * Test for XSS vulnerabilities
   */
  async testXSSVulnerabilities(page) {
    const findings = [];
    
    try {
      const forms = await page.$$('form');
      const inputs = await page.$$('input[type="text"], input[type="search"], textarea');
      
      for (const payload of this.xssPayloads.slice(0, 10)) { // Limit to avoid too many tests
        for (const input of inputs) {
          try {
            // Clear and fill input
            await input.click({ clickCount: 3 });
            await input.type(payload);
            
            // Check if payload is reflected
            const reflected = await page.evaluate((testPayload) => {
              const body = document.body.innerHTML;
              return body.includes(testPayload);
            }, payload);
            
            if (reflected) {
              // Check if it's executable
              const isExecutable = await this.checkXSSExecution(page, payload);
              
              if (isExecutable) {
                findings.push({
                  type: 'xss',
                  severity: 'high',
                  payload: payload,
                  vulnerable: true,
                  element: await this.getElementSelector(input)
                });
              }
            }
          } catch (error) {
            // Continue with next test
          }
        }
      }
      
      return {
        tested: true,
        findings: findings,
        vulnerable: findings.length > 0
      };
      
    } catch (error) {
      return {
        tested: false,
        error: error.message
      };
    }
  }

  /**
   * Check if XSS payload is executable
   */
  async checkXSSExecution(page, payload) {
    try {
      const executed = await page.evaluate((testPayload) => {
        // Set up a flag to detect execution
        window.__xssTestFlag = false;
        
        // Try to execute the payload in various contexts
        const contexts = [
          () => { eval(testPayload); },
          () => { new Function(testPayload)(); },
          () => { document.write(testPayload); }
        ];
        
        for (const context of contexts) {
          try {
            context();
            if (window.__xssTestFlag) return true;
          } catch (e) {
            // Payload failed to execute
          }
        }
        
        return false;
      }, payload);
      
      return executed;
    } catch (error) {
      return false;
    }
  }

  /**
   * Test for SQL injection vulnerabilities
   */
  async testSQLInjection(page) {
    const findings = [];
    
    try {
      const inputs = await page.$$('input[type="text"], input[type="search"], input[type="number"]');
      
      for (const payload of this.sqlPayloads.slice(0, 5)) {
        for (const input of inputs) {
          try {
            await input.click({ clickCount: 3 });
            await input.type(payload);
            
            // Submit form if available
            const form = await this.getParentForm(page, input);
            if (form) {
              // Check page before submission
              const beforeContent = await page.content();
              
              await form.evaluate(f => f.submit());
              await page.waitForTimeout(1000);
              
              // Check for SQL error messages
              const content = await page.content();
              const hasSQLError = this.detectSQLErrors(content);
              
              if (hasSQLError) {
                findings.push({
                  type: 'sql-injection',
                  severity: 'critical',
                  payload: payload,
                  vulnerable: true,
                  element: await this.getElementSelector(input)
                });
              }
            }
          } catch (error) {
            // Continue with next test
          }
        }
      }
      
      return {
        tested: true,
        findings: findings,
        vulnerable: findings.length > 0
      };
      
    } catch (error) {
      return {
        tested: false,
        error: error.message
      };
    }
  }

  /**
   * Detect SQL error messages
   */
  detectSQLErrors(content) {
    const sqlErrorPatterns = [
      /SQL syntax.*MySQL/i,
      /Warning.*mysql_/i,
      /valid MySQL result/i,
      /MySqlClient\./i,
      /PostgreSQL.*ERROR/i,
      /Warning.*pg_/i,
      /valid PostgreSQL result/i,
      /Npgsql\./i,
      /Driver.*SQL.*ERROR/i,
      /ORA-\d{4,5}/i,
      /Oracle.*Driver/i,
      /SQLServer.*JDBC.*Driver/i
    ];
    
    return sqlErrorPatterns.some(pattern => pattern.test(content));
  }

  /**
   * Test for CSRF vulnerabilities
   */
  async testCSRF(page) {
    const findings = [];
    
    try {
      const forms = await page.$$('form');
      
      for (const form of forms) {
        const hasCSRFToken = await form.evaluate(f => {
          const inputs = f.querySelectorAll('input[type="hidden"]');
          for (const input of inputs) {
            const name = input.name.toLowerCase();
            if (name.includes('csrf') || name.includes('token') || name.includes('_token')) {
              return true;
            }
          }
          return false;
        });
        
        if (!hasCSRFToken) {
          const method = await form.evaluate(f => f.method);
          if (method && method.toLowerCase() === 'post') {
            findings.push({
              type: 'csrf',
              severity: 'medium',
              issue: 'Form lacks CSRF token',
              element: await this.getElementSelector(form)
            });
          }
        }
      }
      
      return {
        tested: true,
        findings: findings,
        vulnerable: findings.length > 0
      };
      
    } catch (error) {
      return {
        tested: false,
        error: error.message
      };
    }
  }

  /**
   * Perform comprehensive form fuzzing
   */
  async performFormFuzzing(page) {
    const results = {
      forms: [],
      crashes: [],
      anomalies: [],
      totalTests: 0
    };
    
    try {
      const forms = await page.$$('form');
      
      for (const form of forms) {
        const formResult = await this.fuzzForm(page, form);
        results.forms.push(formResult);
        results.totalTests += formResult.testsRun;
        results.crashes.push(...formResult.crashes);
        results.anomalies.push(...formResult.anomalies);
      }
      
      return results;
      
    } catch (error) {
      return {
        tested: false,
        error: error.message
      };
    }
  }

  /**
   * Fuzz individual form
   */
  async fuzzForm(page, form) {
    const result = {
      selector: await this.getElementSelector(form),
      testsRun: 0,
      crashes: [],
      anomalies: []
    };
    
    try {
      const inputs = await form.$$('input, textarea, select');
      const iterations = Math.min(this.config.maxFuzzIterations, this.fuzzPayloads.length);
      
      for (let i = 0; i < iterations; i++) {
        const payload = this.fuzzPayloads[i % this.fuzzPayloads.length];
        
        try {
          // Fill all inputs with fuzz data
          for (const input of inputs) {
            const inputType = await input.evaluate(el => el.type);
            const fuzzValue = this.generateFuzzValue(payload, inputType);
            
            try {
              await input.click({ clickCount: 3 });
              await input.type(String(fuzzValue));
            } catch (e) {
              // Continue if input fails
            }
          }
          
          // Attempt to submit
          const beforeUrl = page.url();
          await form.evaluate(f => f.submit());
          await page.waitForTimeout(500);
          
          // Check for anomalies
          const anomaly = await this.detectAnomaly(page, beforeUrl);
          if (anomaly) {
            result.anomalies.push({
              payload: payload,
              anomaly: anomaly
            });
          }
          
          result.testsRun++;
          
        } catch (error) {
          result.crashes.push({
            payload: payload,
            error: error.message
          });
        }
      }
      
    } catch (error) {
      console.error('Form fuzzing error:', error);
    }
    
    return result;
  }

  /**
   * Generate fuzz value based on input type
   */
  generateFuzzValue(payload, inputType) {
    switch (inputType) {
      case 'email':
        return payload + '@example.com';
      case 'number':
        return isNaN(payload) ? '123' : payload;
      case 'tel':
        return payload.replace(/[^0-9]/g, '') || '1234567890';
      case 'url':
        return 'http://example.com/' + payload;
      case 'date':
        return '2026-01-01';
      default:
        return payload;
    }
  }

  /**
   * Detect anomalies in response
   */
  async detectAnomaly(page, beforeUrl) {
    try {
      const afterUrl = page.url();
      const content = await page.content();
      
      // Check for error messages
      const errorPatterns = [
        /error/i,
        /exception/i,
        /stack trace/i,
        /internal server error/i,
        /500/,
        /fatal/i
      ];
      
      for (const pattern of errorPatterns) {
        if (pattern.test(content)) {
          return `Error pattern detected: ${pattern}`;
        }
      }
      
      // Check for unexpected redirects
      if (afterUrl !== beforeUrl && !afterUrl.includes('success') && !afterUrl.includes('thank')) {
        return `Unexpected redirect to: ${afterUrl}`;
      }
      
      return null;
      
    } catch (error) {
      return `Detection failed: ${error.message}`;
    }
  }

  /**
   * Check security headers
   */
  async checkSecurityHeaders(page) {
    const response = await page.goto(page.url());
    const headers = response.headers();
    
    const securityHeaders = {
      'strict-transport-security': 'HSTS not configured',
      'x-frame-options': 'Clickjacking protection missing',
      'x-content-type-options': 'MIME-sniffing protection missing',
      'content-security-policy': 'CSP not configured',
      'x-xss-protection': 'XSS protection missing'
    };
    
    const findings = [];
    
    Object.entries(securityHeaders).forEach(([header, issue]) => {
      if (!headers[header]) {
        findings.push({
          type: 'missing-header',
          severity: 'medium',
          header: header,
          issue: issue
        });
      }
    });
    
    return {
      tested: true,
      findings: findings,
      headersPresent: Object.keys(securityHeaders).filter(h => headers[h])
    };
  }

  /**
   * Analyze cookie security
   */
  async analyzeCookieSecurity(page) {
    const cookies = await page.cookies();
    const findings = [];
    
    cookies.forEach(cookie => {
      if (!cookie.secure) {
        findings.push({
          type: 'insecure-cookie',
          severity: 'medium',
          cookie: cookie.name,
          issue: 'Cookie missing Secure flag'
        });
      }
      
      if (!cookie.httpOnly && (cookie.name.toLowerCase().includes('session') || cookie.name.toLowerCase().includes('auth'))) {
        findings.push({
          type: 'cookie-httponly',
          severity: 'high',
          cookie: cookie.name,
          issue: 'Sensitive cookie missing HttpOnly flag'
        });
      }
      
      if (!cookie.sameSite || cookie.sameSite === 'none') {
        findings.push({
          type: 'cookie-samesite',
          severity: 'medium',
          cookie: cookie.name,
          issue: 'Cookie missing SameSite attribute'
        });
      }
    });
    
    return {
      tested: true,
      findings: findings,
      totalCookies: cookies.length
    };
  }

  /**
   * Check for mixed content
   */
  async checkMixedContent(page) {
    const findings = await page.evaluate(() => {
      const results = [];
      const protocol = window.location.protocol;
      
      if (protocol === 'https:') {
        // Check images
        document.querySelectorAll('img').forEach(img => {
          if (img.src.startsWith('http:')) {
            results.push({
              type: 'mixed-content',
              severity: 'medium',
              resource: img.src,
              element: 'img'
            });
          }
        });
        
        // Check scripts
        document.querySelectorAll('script[src]').forEach(script => {
          if (script.src.startsWith('http:')) {
            results.push({
              type: 'mixed-content',
              severity: 'high',
              resource: script.src,
              element: 'script'
            });
          }
        });
        
        // Check stylesheets
        document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
          if (link.href.startsWith('http:')) {
            results.push({
              type: 'mixed-content',
              severity: 'medium',
              resource: link.href,
              element: 'link'
            });
          }
        });
      }
      
      return results;
    });
    
    return {
      tested: true,
      findings: findings,
      vulnerable: findings.length > 0
    };
  }

  /**
   * Analyze password field security
   */
  async analyzePasswordFields(page) {
    const findings = await page.evaluate(() => {
      const results = [];
      const passwordFields = document.querySelectorAll('input[type="password"]');
      
      passwordFields.forEach(field => {
        // Check if form uses HTTPS
        const form = field.closest('form');
        if (form) {
          const action = form.action;
          if (action && action.startsWith('http:')) {
            results.push({
              type: 'insecure-password',
              severity: 'critical',
              issue: 'Password field submitted over HTTP'
            });
          }
        }
        
        // Check for autocomplete
        if (field.autocomplete === 'on') {
          results.push({
            type: 'password-autocomplete',
            severity: 'low',
            issue: 'Password field allows autocomplete'
          });
        }
      });
      
      return results;
    });
    
    return {
      tested: true,
      findings: findings
    };
  }

  /**
   * Generate XSS payloads
   */
  generateXSSPayloads() {
    return [
      '<script>alert(1)</script>',
      '<img src=x onerror=alert(1)>',
      '<svg/onload=alert(1)>',
      'javascript:alert(1)',
      '"><script>alert(1)</script>',
      "'><script>alert(1)</script>",
      '<iframe src="javascript:alert(1)">',
      '<body onload=alert(1)>',
      '<input onfocus=alert(1) autofocus>',
      '<select onfocus=alert(1) autofocus>'
    ];
  }

  /**
   * Generate SQL injection payloads
   */
  generateSQLPayloads() {
    return [
      "' OR '1'='1",
      "1' OR '1' = '1",
      "' OR 1=1--",
      "admin'--",
      "' UNION SELECT NULL--",
      "1; DROP TABLE users--",
      "' OR 'x'='x",
      "1' AND '1'='1"
    ];
  }

  /**
   * Generate fuzz payloads
   */
  generateFuzzPayloads() {
    const payloads = [
      // Buffer overflow attempts
      'A'.repeat(1000),
      'A'.repeat(10000),
      
      // Special characters
      '!@#$%^&*()_+-=[]{}|;:,.<>?',
      '\\'\n\r\t\b\f',
      
      // Unicode
      '\u0000\u0001\u0002',
      '💩🔥🎉',
      
      // Format strings
      '%s%s%s%s%s%s%s',
      '%n%n%n%n',
      
      // Command injection
      '; ls -la',
      '| whoami',
      '`whoami`',
      '$(whoami)',
      
      // Path traversal
      '../../../../../etc/passwd',
      '..\\..\\..\\..\\windows\\system32',
      
      // Null bytes
      'test\x00.jpg',
      
      // Very long strings
      'x'.repeat(100000),
      
      // Numbers
      '0',
      '-1',
      '999999999',
      '2147483647',
      '-2147483648'
    ];
    
    // Add more based on intensity
    if (this.config.fuzzIntensity === 'high') {
      payloads.push(...this.generateAdvancedFuzzPayloads());
    }
    
    return payloads;
  }

  /**
   * Generate advanced fuzz payloads
   */
  generateAdvancedFuzzPayloads() {
    return [
      // XML/XXE
      '<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><foo>&xxe;</foo>',
      
      // LDAP injection
      'admin*)(|(password=*))',
      
      // Template injection
      '{{7*7}}',
      '${7*7}',
      '#{7*7}',
      
      // NoSQL injection
      '{"$gt":""}',
      '{"$ne":null}'
    ];
  }

  /**
   * Helper methods
   */
  async getElementSelector(element) {
    try {
      return await element.evaluate(el => {
        if (el.id) return `#${el.id}`;
        if (el.className) return `${el.tagName}.${el.className.split(' ')[0]}`;
        return el.tagName;
      });
    } catch {
      return 'unknown';
    }
  }

  async getParentForm(page, input) {
    try {
      return await input.evaluateHandle(el => el.closest('form'));
    } catch {
      return null;
    }
  }

  /**
   * Extract vulnerabilities from test results
   */
  extractVulnerabilities(tests) {
    const vulnerabilities = [];
    
    Object.entries(tests).forEach(([testName, result]) => {
      if (result.findings && result.findings.length > 0) {
        vulnerabilities.push(...result.findings);
      }
      if (result.vulnerable) {
        vulnerabilities.push({
          test: testName,
          severity: result.severity || 'medium',
          details: result
        });
      }
    });
    
    return vulnerabilities;
  }

  /**
   * Calculate overall risk level
   */
  calculateRiskLevel(vulnerabilities) {
    const critical = vulnerabilities.filter(v => v.severity === 'critical').length;
    const high = vulnerabilities.filter(v => v.severity === 'high').length;
    const medium = vulnerabilities.filter(v => v.severity === 'medium').length;
    
    if (critical > 0) return 'critical';
    if (high > 2) return 'high';
    if (high > 0 || medium > 5) return 'medium';
    if (medium > 0) return 'low';
    return 'minimal';
  }

  /**
   * Generate security report
   */
  generateReport() {
    return {
      summary: {
        totalTests: this.testResults.length,
        totalVulnerabilities: this.vulnerabilities.length,
        riskLevel: this.calculateOverallRisk(),
        criticalIssues: this.vulnerabilities.filter(v => v.severity === 'critical').length
      },
      results: this.testResults,
      recommendations: this.generateRecommendations()
    };
  }

  /**
   * Calculate overall risk
   */
  calculateOverallRisk() {
    const allVulns = [];
    this.testResults.forEach(result => {
      allVulns.push(...result.vulnerabilities);
    });
    return this.calculateRiskLevel(allVulns);
  }

  /**
   * Generate security recommendations
   */
  generateRecommendations() {
    const recommendations = [];
    const vulnTypes = new Set();
    
    this.testResults.forEach(result => {
      result.vulnerabilities.forEach(vuln => {
        vulnTypes.add(vuln.type);
      });
    });
    
    vulnTypes.forEach(type => {
      const recommendation = this.getRecommendationForVulnerability(type);
      if (recommendation) {
        recommendations.push(recommendation);
      }
    });
    
    return recommendations;
  }

  /**
   * Get recommendation for vulnerability type
   */
  getRecommendationForVulnerability(type) {
    const recommendations = {
      'xss': 'Implement input validation and output encoding. Use Content Security Policy headers.',
      'sql-injection': 'Use parameterized queries or prepared statements. Validate and sanitize all user inputs.',
      'csrf': 'Implement CSRF tokens for all state-changing operations.',
      'missing-header': 'Configure proper security headers including HSTS, X-Frame-Options, and CSP.',
      'insecure-cookie': 'Set Secure, HttpOnly, and SameSite flags on all cookies.',
      'mixed-content': 'Ensure all resources are loaded over HTTPS.',
      'insecure-password': 'Always submit passwords over HTTPS. Never use HTTP for authentication.'
    };
    
    return recommendations[type] ? {
      type,
      recommendation: recommendations[type],
      priority: type.includes('password') || type.includes('sql') || type.includes('xss') ? 'high' : 'medium'
    } : null;
  }

  /**
   * Get test results
   */
  getResults() {
    return this.testResults;
  }

  /**
   * Clear results
   */
  clear() {
    this.testResults = [];
    this.vulnerabilities = [];
    this.fuzzResults = [];
  }
}

module.exports = SecurityTester;
