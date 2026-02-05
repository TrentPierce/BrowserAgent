const AccessibilityTester = require('../../../src/testing/accessibilityTester');

describe('AccessibilityTester', () => {
  let tester;

  beforeEach(() => {
    tester = new AccessibilityTester({
      standard: 'WCAG21AA'
    });
  });

  test('should initialize with config', () => {
    expect(tester.config.standard).toBe('WCAG21AA');
    expect(tester.config.runOnly).toContain('wcag2a');
    expect(tester.config.runOnly).toContain('wcag21aa');
  });

  test('should calculate accessibility score', () => {
    const axeResults = {
      violations: [
        { impact: 'critical', nodes: [{}] },
        { impact: 'serious', nodes: [{}, {}] },
        { impact: 'moderate', nodes: [{}] }
      ]
    };
    const customResults = {
      test1: { count: 2 },
      test2: { count: 1 }
    };
    
    const score = tester.calculateAccessibilityScore(axeResults, customResults);
    expect(score).toBeLessThan(100);
    expect(score).toBeGreaterThanOrEqual(0);
  });

  test('should determine WCAG level', () => {
    const resultsAA = {
      violations: []
    };
    expect(tester.determineWCAGLevel(resultsAA)).toBe('AA');

    const resultsA = {
      violations: [
        { tags: ['wcag2aa'] }
      ]
    };
    expect(tester.determineWCAGLevel(resultsA)).toBe('A');

    const resultsNone = {
      violations: [
        { tags: ['wcag2a'] }
      ]
    };
    expect(tester.determineWCAGLevel(resultsNone)).toBe('None');
  });

  test('should generate summary', () => {
    const axeResults = { violations: [] };
    const customResults = {};
    const keyboardResults = { passed: true };
    const screenReaderResults = { passed: true };

    const summary = tester.generateSummary(
      axeResults,
      customResults,
      keyboardResults,
      screenReaderResults
    );

    expect(summary).toHaveProperty('totalViolations');
    expect(summary).toHaveProperty('score');
    expect(summary).toHaveProperty('wcagLevel');
    expect(summary.passed).toBe(true);
  });

  test('should generate overall summary', () => {
    tester.testResults = [
      { summary: { score: 90, wcagLevel: 'AA' } },
      { summary: { score: 85, wcagLevel: 'AA' } }
    ];

    const summary = tester.generateOverallSummary();
    expect(summary.averageScore).toBe(87.5);
    expect(summary.pagesAudited).toBe(2);
  });
});
