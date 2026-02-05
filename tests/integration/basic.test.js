/**
 * Basic integration tests
 */

describe('Integration Tests', () => {
  test('environment should be configured', () => {
    expect(process.env.NODE_ENV).toBeDefined();
  });

  test('Node.js version should be >= 18', () => {
    const version = process.version;
    const major = parseInt(version.split('.')[0].substring(1));
    expect(major).toBeGreaterThanOrEqual(18);
  });
});
