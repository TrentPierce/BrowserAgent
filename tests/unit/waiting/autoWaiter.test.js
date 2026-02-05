/**
 * @jest-environment node
 */

const { AutoWaiter } = require('../../../src/waiting');

describe('AutoWaiter', () => {
    let waiter;

    beforeEach(() => {
        waiter = new AutoWaiter();
    });

    test('should initialize with default options', () => {
        expect(waiter.options.timeout).toBe(30000);
        expect(waiter.options.pollInterval).toBe(100);
        expect(waiter.options.enableRetry).toBe(true);
        expect(waiter.options.maxRetries).toBe(3);
    });

    test('should accept custom options', () => {
        const customWaiter = new AutoWaiter({
            timeout: 60000,
            maxRetries: 5
        });
        expect(customWaiter.options.timeout).toBe(60000);
        expect(customWaiter.options.maxRetries).toBe(5);
    });

    test('should track statistics', () => {
        waiter.recordStat({
            selector: '#test',
            action: 'click',
            success: true,
            duration: 100,
            attempts: 1
        });

        const stats = waiter.getStats();
        expect(stats.totalWaits).toBe(1);
        expect(stats.successfulWaits).toBe(1);
        expect(stats.failedWaits).toBe(0);
    });

    test('should group stats by action', () => {
        waiter.recordStat({ selector: '#a', action: 'click', success: true, duration: 100 });
        waiter.recordStat({ selector: '#b', action: 'click', success: true, duration: 200 });
        waiter.recordStat({ selector: '#c', action: 'type', success: false, duration: 300 });

        const stats = waiter.getStats();
        expect(stats.byAction.click).toBeDefined();
        expect(stats.byAction.click.count).toBe(2);
        expect(stats.byAction.type).toBeDefined();
        expect(stats.byAction.type.count).toBe(1);
    });

    test('should clear statistics', () => {
        waiter.recordStat({ selector: '#test', action: 'click', success: true });
        waiter.clearStats();
        
        const stats = waiter.getStats();
        expect(stats.totalWaits).toBe(0);
    });

    test('should get typing delay with variance', () => {
        const delay = waiter.getTypingDelay({
            typingSpeed: 100,
            typingVariance: 50
        });
        
        expect(delay).toBeGreaterThanOrEqual(50);
        expect(delay).toBeLessThanOrEqual(150);
    });
});
