/**
 * Testing Module
 * Accessibility, performance, and security testing
 * @module testing
 */

const AccessibilityTester = require('./accessibilityTester');
const PerformanceMetrics = require('./performanceMetrics');
const SecurityTester = require('./securityTester');

module.exports = {
  AccessibilityTester,
  PerformanceMetrics,
  SecurityTester
};
