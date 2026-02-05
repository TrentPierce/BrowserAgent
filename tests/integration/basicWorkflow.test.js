/**
 * Basic integration tests for core workflows
 */

describe('Basic Workflow Integration', () => {
  test('should load vision modules', () => {
    const { ComputerVision, PatternRecognition } = require('../../src/vision');
    expect(ComputerVision).toBeDefined();
    expect(PatternRecognition).toBeDefined();
  });

  test('should load enterprise modules', () => {
    const { DistributedExecutor, LoadBalancer, MonitoringDashboard } = require('../../src/enterprise');
    expect(DistributedExecutor).toBeDefined();
    expect(LoadBalancer).toBeDefined();
    expect(MonitoringDashboard).toBeDefined();
  });

  test('should load testing modules', () => {
    const { AccessibilityTester, PerformanceMetrics, SecurityTester } = require('../../src/testing');
    expect(AccessibilityTester).toBeDefined();
    expect(PerformanceMetrics).toBeDefined();
    expect(SecurityTester).toBeDefined();
  });

  test('should create instances of all modules', () => {
    const { ComputerVision } = require('../../src/vision');
    const { LoadBalancer } = require('../../src/enterprise');
    const { AccessibilityTester } = require('../../src/testing');

    const cv = new ComputerVision();
    const lb = new LoadBalancer();
    const at = new AccessibilityTester();

    expect(cv).toBeInstanceOf(ComputerVision);
    expect(lb).toBeInstanceOf(LoadBalancer);
    expect(at).toBeInstanceOf(AccessibilityTester);
  });
});
