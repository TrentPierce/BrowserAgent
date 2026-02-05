/**
 * Basic Integration Tests
 * Tests for basic integration scenarios
 */

describe('Basic Integration', () => {
  describe('Module Loading', () => {
    test('should load all exported modules without errors', () => {
      expect(() => {
        require('../../src/index');
      }).not.toThrow();
    });

    test('optional dependencies should not break module loading', () => {
      const loadModule = () => {
        try {
          require('../../src/index');
          return true;
        } catch (error) {
          // Only fail if it's not an optional dependency issue
          if (!error.message.includes('opencv') && 
              !error.message.includes('better-sqlite3') && 
              !error.message.includes('keytar') &&
              !error.message.includes('puppeteer') &&
              !error.message.includes('sharp')) {
            throw error;
          }
          return true;
        }
      };
      
      expect(loadModule()).toBe(true);
    });
  });

  describe('Configuration', () => {
    test('should handle missing environment variables gracefully', () => {
      const originalEnv = process.env.GEMINI_API_KEY;
      delete process.env.GEMINI_API_KEY;
      
      expect(() => {
        require('../../src/index');
      }).not.toThrow();
      
      if (originalEnv) {
        process.env.GEMINI_API_KEY = originalEnv;
      }
    });
  });

  describe('System Compatibility', () => {
    test('should detect operating system', () => {
      expect(['darwin', 'linux', 'win32']).toContain(process.platform);
    });

    test('should have access to file system', () => {
      const fs = require('fs');
      expect(fs.existsSync(__filename)).toBe(true);
    });
  });
});
