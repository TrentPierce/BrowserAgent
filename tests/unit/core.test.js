/**
 * Core Module Tests
 * Basic test suite to validate core functionality
 */

describe('BrowserAgent Core', () => {
  describe('Module Exports', () => {
    test('should export main module', () => {
      const BrowserAgent = require('../../src/index');
      expect(BrowserAgent).toBeDefined();
    });

    test('main module should be an object', () => {
      const BrowserAgent = require('../../src/index');
      expect(typeof BrowserAgent).toBe('object');
    });
  });

  describe('Package Configuration', () => {
    test('package.json should exist and be valid', () => {
      const pkg = require('../../package.json');
      expect(pkg).toBeDefined();
      expect(pkg.name).toBe('@trentpierce/browser-agent');
      expect(pkg.version).toBeDefined();
    });

    test('package should require Node.js >= 18', () => {
      const pkg = require('../../package.json');
      expect(pkg.engines.node).toMatch(/>=18/);
    });
  });

  describe('Environment', () => {
    test('Node.js version should meet minimum requirements', () => {
      const nodeVersion = process.version;
      const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
      expect(majorVersion).toBeGreaterThanOrEqual(18);
    });

    test('should have access to core Node.js modules', () => {
      expect(() => require('fs')).not.toThrow();
      expect(() => require('path')).not.toThrow();
      expect(() => require('util')).not.toThrow();
    });
  });
});
