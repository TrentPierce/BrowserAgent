/**
 * Performance Metrics Collection
 * Comprehensive web performance monitoring
 * @module testing/performanceMetrics
 */

class PerformanceMetrics {
  constructor(config = {}) {
    this.config = {
      collectWebVitals: config.collectWebVitals !== false,
      collectResourceTiming: config.collectResourceTiming !== false,
      collectUserTiming: config.collectUserTiming !== false,
      collectNetworkInfo: config.collectNetworkInfo !== false,
      budgets: config.budgets || {
        FCP: 1800,
        LCP: 2500,
        FID: 100,
        CLS: 0.1,
        TTI: 3800,
        TBT: 300
      },
      ...config
    };
    
    this.metrics = [];
    this.violations = [];
  }

  /**
   * Collect comprehensive performance metrics
   */
  async collect(page) {
    const startTime = Date.now();
    
    try {
      const metrics = {
        url: page.url(),
        timestamp: Date.now(),
        webVitals: this.config.collectWebVitals ? await this.collectWebVitals(page) : null,
        navigation: await this.collectNavigationTiming(page),
        resources: this.config.collectResourceTiming ? await this.collectResourceTiming(page) : null,
        userTiming: this.config.collectUserTiming ? await this.collectUserTiming(page) : null,
        network: this.config.collectNetworkInfo ? await this.collectNetworkInfo(page) : null,
        lighthouse: await this.runLighthouseAudit(page),
        collectionTime: Date.now() - startTime
      };
      
      // Analyze against budgets
      metrics.budgetAnalysis = this.analyzeBudgets(metrics);
      metrics.score = this.calculatePerformanceScore(metrics);
      
      this.metrics.push(metrics);
      
      return metrics;
      
    } catch (error) {
      console.error('Performance metrics collection failed:', error);
      throw error;
    }
  }

  /**
   * Collect Core Web Vitals
   */
  async collectWebVitals(page) {
    return await page.evaluate(() => {
      return new Promise((resolve) => {
        const vitals = {
          LCP: null,
          FID: null,
          CLS: null,
          FCP: null,
          TTFB: null
        };
        
        // Collect performance entries
        const perfObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'largest-contentful-paint') {
              vitals.LCP = entry.renderTime || entry.loadTime;
            }
            if (entry.entryType === 'first-input') {
              vitals.FID = entry.processingStart - entry.startTime;
            }
            if (entry.entryType === 'layout-shift' && !entry.hadRecentInput) {
              vitals.CLS = (vitals.CLS || 0) + entry.value;
            }
            if (entry.name === 'first-contentful-paint') {
              vitals.FCP = entry.startTime;
            }
          }
        });
        
        try {
          perfObserver.observe({ entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift', 'paint'] });
        } catch (e) {
          console.error('Performance observer failed:', e);
        }
        
        // TTFB
        const navTiming = performance.getEntriesByType('navigation')[0];
        if (navTiming) {
          vitals.TTFB = navTiming.responseStart - navTiming.requestStart;
        }
        
        // Resolve after a short delay to collect metrics
        setTimeout(() => {
          perfObserver.disconnect();
          resolve(vitals);
        }, 2000);
      });
    });
  }

  /**
   * Collect navigation timing
   */
  async collectNavigationTiming(page) {
    return await page.evaluate(() => {
      const timing = performance.timing;
      const navigation = performance.getEntriesByType('navigation')[0];
      
      return {
        // Core metrics
        domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
        loadComplete: timing.loadEventEnd - timing.navigationStart,
        
        // Detailed timings
        dns: timing.domainLookupEnd - timing.domainLookupStart,
        tcp: timing.connectEnd - timing.connectStart,
        request: timing.responseStart - timing.requestStart,
        response: timing.responseEnd - timing.responseStart,
        processing: timing.domComplete - timing.domLoading,
        
        // Additional metrics from Navigation Timing API
        redirectTime: navigation ? navigation.redirectEnd - navigation.redirectStart : 0,
        cacheTime: navigation ? navigation.domainLookupStart - navigation.fetchStart : 0,
        
        // TTI estimation
        timeToInteractive: timing.domInteractive - timing.navigationStart
      };
    });
  }

  /**
   * Collect resource timing
   */
  async collectResourceTiming(page) {
    return await page.evaluate(() => {
      const resources = performance.getEntriesByType('resource');
      
      const summary = {
        total: resources.length,
        byType: {},
        slowest: [],
        largest: [],
        totalSize: 0,
        totalDuration: 0
      };
      
      resources.forEach(resource => {
        // Group by type
        const type = resource.initiatorType;
        if (!summary.byType[type]) {
          summary.byType[type] = { count: 0, duration: 0, size: 0 };
        }
        summary.byType[type].count++;
        summary.byType[type].duration += resource.duration;
        
        if (resource.transferSize) {
          summary.byType[type].size += resource.transferSize;
          summary.totalSize += resource.transferSize;
        }
        
        summary.totalDuration += resource.duration;
      });
      
      // Find slowest resources
      summary.slowest = resources
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 10)
        .map(r => ({
          name: r.name,
          type: r.initiatorType,
          duration: r.duration,
          size: r.transferSize
        }));
      
      // Find largest resources
      summary.largest = resources
        .filter(r => r.transferSize)
        .sort((a, b) => b.transferSize - a.transferSize)
        .slice(0, 10)
        .map(r => ({
          name: r.name,
          type: r.initiatorType,
          duration: r.duration,
          size: r.transferSize
        }));
      
      return summary;
    });
  }

  /**
   * Collect user timing marks and measures
   */
  async collectUserTiming(page) {
    return await page.evaluate(() => {
      const marks = performance.getEntriesByType('mark');
      const measures = performance.getEntriesByType('measure');
      
      return {
        marks: marks.map(m => ({ name: m.name, startTime: m.startTime })),
        measures: measures.map(m => ({ 
          name: m.name, 
          startTime: m.startTime, 
          duration: m.duration 
        }))
      };
    });
  }

  /**
   * Collect network information
   */
  async collectNetworkInfo(page) {
    return await page.evaluate(() => {
      const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      
      if (!connection) return null;
      
      return {
        effectiveType: connection.effectiveType,
        downlink: connection.downlink,
        rtt: connection.rtt,
        saveData: connection.saveData
      };
    });
  }

  /**
   * Run Lighthouse audit (simplified)
   */
  async runLighthouseAudit(page) {
    try {
      // This would integrate with actual Lighthouse
      // For now, return calculated metrics
      const metrics = await page.metrics();
      
      return {
        performanceScore: this.calculateLighthouseScore(metrics),
        metrics: {
          firstContentfulPaint: metrics.FirstMeaningfulPaint * 1000,
          speedIndex: metrics.DomContentLoaded * 1000,
          largestContentfulPaint: null, // Would come from Lighthouse
          timeToInteractive: metrics.DomInteractive * 1000,
          totalBlockingTime: null,
          cumulativeLayoutShift: null
        }
      };
    } catch (error) {
      console.error('Lighthouse audit failed:', error);
      return null;
    }
  }

  /**
   * Calculate Lighthouse-style performance score
   */
  calculateLighthouseScore(metrics) {
    // Simplified scoring based on key metrics
    let score = 100;
    
    // This would use actual Lighthouse scoring algorithm
    // Simplified for demonstration
    const fcp = metrics.FirstMeaningfulPaint * 1000;
    if (fcp > 3000) score -= 20;
    else if (fcp > 1800) score -= 10;
    
    return Math.max(0, score);
  }

  /**
   * Analyze performance against budgets
   */
  analyzeBudgets(metrics) {
    const analysis = {
      violations: [],
      warnings: [],
      passed: []
    };
    
    if (metrics.webVitals) {
      Object.entries(this.config.budgets).forEach(([metric, budget]) => {
        const value = metrics.webVitals[metric];
        if (value === null || value === undefined) return;
        
        if (value > budget) {
          analysis.violations.push({
            metric,
            value,
            budget,
            overBy: value - budget
          });
        } else if (value > budget * 0.9) {
          analysis.warnings.push({
            metric,
            value,
            budget,
            closeToLimit: true
          });
        } else {
          analysis.passed.push({ metric, value, budget });
        }
      });
    }
    
    return analysis;
  }

  /**
   * Calculate overall performance score
   */
  calculatePerformanceScore(metrics) {
    let score = 100;
    const budgetViolations = metrics.budgetAnalysis?.violations || [];
    
    // Deduct points for budget violations
    budgetViolations.forEach(violation => {
      const severity = {
        'LCP': 15,
        'FCP': 10,
        'FID': 10,
        'CLS': 15,
        'TTI': 10,
        'TBT': 10
      }[violation.metric] || 5;
      
      score -= severity;
    });
    
    return Math.max(0, Math.round(score));
  }

  /**
   * Generate performance report
   */
  generateReport() {
    if (this.metrics.length === 0) return null;
    
    const avgScore = this.metrics.reduce((sum, m) => sum + m.score, 0) / this.metrics.length;
    
    return {
      summary: {
        averageScore: Math.round(avgScore),
        totalPages: this.metrics.length,
        totalViolations: this.metrics.reduce((sum, m) => 
          sum + (m.budgetAnalysis?.violations?.length || 0), 0
        )
      },
      metrics: this.metrics,
      recommendations: this.generateRecommendations()
    };
  }

  /**
   * Generate performance recommendations
   */
  generateRecommendations() {
    const recommendations = [];
    
    this.metrics.forEach(metric => {
      if (metric.resources) {
        // Large resources
        const largeResources = metric.resources.largest.filter(r => r.size > 500000);
        if (largeResources.length > 0) {
          recommendations.push({
            priority: 'high',
            category: 'resources',
            issue: `${largeResources.length} resources exceed 500KB`,
            suggestion: 'Optimize and compress large resources'
          });
        }
        
        // Slow resources
        const slowResources = metric.resources.slowest.filter(r => r.duration > 1000);
        if (slowResources.length > 0) {
          recommendations.push({
            priority: 'medium',
            category: 'resources',
            issue: `${slowResources.length} resources take over 1 second to load`,
            suggestion: 'Review and optimize slow-loading resources'
          });
        }
      }
      
      // Web Vitals recommendations
      if (metric.budgetAnalysis?.violations) {
        metric.budgetAnalysis.violations.forEach(violation => {
          recommendations.push({
            priority: 'high',
            category: 'web-vitals',
            issue: `${violation.metric} exceeds budget by ${violation.overBy.toFixed(2)}`,
            suggestion: this.getSuggestionForMetric(violation.metric)
          });
        });
      }
    });
    
    return recommendations;
  }

  /**
   * Get optimization suggestion for metric
   */
  getSuggestionForMetric(metric) {
    const suggestions = {
      'LCP': 'Optimize largest contentful element - reduce image sizes, improve server response times',
      'FCP': 'Reduce render-blocking resources, optimize critical rendering path',
      'FID': 'Reduce JavaScript execution time, break up long tasks',
      'CLS': 'Set explicit dimensions for images and embeds, avoid inserting content above existing content',
      'TTI': 'Minimize JavaScript, defer non-critical scripts',
      'TBT': 'Break up long-running tasks, optimize third-party scripts'
    };
    
    return suggestions[metric] || 'Review and optimize this metric';
  }

  /**
   * Get collected metrics
   */
  getMetrics() {
    return this.metrics;
  }

  /**
   * Clear collected metrics
   */
  clear() {
    this.metrics = [];
    this.violations = [];
  }
}

module.exports = PerformanceMetrics;
