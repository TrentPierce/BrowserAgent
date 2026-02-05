const LoadBalancer = require('../../../src/enterprise/loadBalancer');

describe('LoadBalancer', () => {
  let lb;

  beforeEach(() => {
    lb = new LoadBalancer({
      maxConcurrentRequests: 10,
      requestsPerSecond: 5
    });
  });

  afterEach(() => {
    // Clean up any pending operations
  });

  test('should initialize with config', () => {
    expect(lb.config.maxConcurrentRequests).toBe(10);
    expect(lb.config.requestsPerSecond).toBe(5);
  });

  test('should generate unique request IDs', () => {
    const id1 = lb.generateRequestId();
    const id2 = lb.generateRequestId();
    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^req_/);
  });

  test('should calculate retry delay with exponential backoff', () => {
    lb.config.retryStrategy = 'exponential';
    expect(lb.calculateRetryDelay(0)).toBe(1000);
    expect(lb.calculateRetryDelay(1)).toBe(2000);
    expect(lb.calculateRetryDelay(2)).toBe(4000);
  });

  test('should calculate retry delay with linear backoff', () => {
    lb.config.retryStrategy = 'linear';
    expect(lb.calculateRetryDelay(0)).toBe(1000);
    expect(lb.calculateRetryDelay(1)).toBe(2000);
    expect(lb.calculateRetryDelay(2)).toBe(3000);
  });

  test('should get circuit breaker', () => {
    const breaker = lb.getCircuitBreaker('test-target');
    expect(breaker).toBeDefined();
    expect(breaker.state).toBe('closed');
    expect(breaker.failures).toBe(0);
  });

  test('should record success', () => {
    const target = 'test-target';
    lb.recordSuccess(target);
    const breaker = lb.getCircuitBreaker(target);
    expect(breaker.successes).toBe(1);
  });

  test('should get stats', () => {
    const stats = lb.getStats();
    expect(stats).toHaveProperty('totalRequests');
    expect(stats).toHaveProperty('successfulRequests');
    expect(stats).toHaveProperty('failedRequests');
    expect(stats).toHaveProperty('activeRequests');
  });
});
