const ComputerVision = require('../../../src/vision/computerVision');

describe('ComputerVision', () => {
  let cv;

  beforeEach(() => {
    cv = new ComputerVision({
      geminiApiKey: 'test-key'
    });
  });

  test('should initialize with default config', () => {
    expect(cv.config.model).toBe('gemini-2.0-flash-exp');
    expect(cv.config.confidenceThreshold).toBe(0.75);
  });

  test('should prepare image from buffer', async () => {
    const buffer = Buffer.from('test');
    const result = await cv.prepareImage(buffer);
    expect(Buffer.isBuffer(result)).toBe(true);
  });

  test('should generate cache key', () => {
    const buffer = Buffer.from('test');
    const key = cv.generateCacheKey(buffer);
    expect(typeof key).toBe('string');
    expect(key.length).toBeGreaterThan(0);
  });

  test('should deduplicate elements', () => {
    const elements = [
      { type: 'button', x: 10, y: 20 },
      { type: 'button', x: 10, y: 20 },
      { type: 'link', x: 30, y: 40 }
    ];
    const deduplicated = cv.deduplicateElements(elements);
    expect(deduplicated.length).toBe(2);
  });

  test('should filter by confidence', () => {
    const elements = [
      { confidence: 0.9 },
      { confidence: 0.5 },
      { confidence: 0.8 }
    ];
    const filtered = cv.filterByConfidence(elements);
    expect(filtered.length).toBe(2);
  });

  test('should track statistics', () => {
    cv.detectionHistory.push(
      { elementCount: 10, processingTime: 100 },
      { elementCount: 15, processingTime: 150 }
    );
    const stats = cv.getStats();
    expect(stats.detectionCount).toBe(2);
    expect(stats.averageProcessingTime).toBe(125);
    expect(stats.averageElementsDetected).toBe(12.5);
  });
});
