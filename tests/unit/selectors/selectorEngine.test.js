/**
 * @jest-environment node
 */

const {
    SelectorEngine,
    SELECTOR_TYPES,
    SelfHealingSelector
} = require('../../../src/selectors');

describe('SelectorEngine', () => {
    let engine;

    beforeEach(() => {
        engine = new SelectorEngine();
    });

    test('should parse CSS selectors', () => {
        const parsed = engine.parse('#myId');
        expect(parsed.type).toBe(SELECTOR_TYPES.CSS);
        expect(parsed.value).toBe('#myId');
    });

    test('should parse XPath selectors', () => {
        const parsed = engine.parse('//div[@id="test"]');
        expect(parsed.type).toBe(SELECTOR_TYPES.XPATH);
    });

    test('should parse text selectors', () => {
        const parsed = engine.parse('text=Submit');
        expect(parsed.type).toBe(SELECTOR_TYPES.TEXT);
        expect(parsed.value).toBe('Submit');
    });

    test('should parse ARIA selectors', () => {
        const parsed = engine.parse('aria=Search');
        expect(parsed.type).toBe(SELECTOR_TYPES.ARIA);
        expect(parsed.value).toBe('Search');
    });

    test('should parse role selectors', () => {
        const parsed = engine.parse('role=button');
        expect(parsed.type).toBe(SELECTOR_TYPES.ROLE);
        expect(parsed.value).toBe('button');
    });

    test('should parse test-id selectors', () => {
        const parsed = engine.parse('data-testid=login-btn');
        expect(parsed.type).toBe(SELECTOR_TYPES.TEST_ID);
        expect(parsed.value).toBe('login-btn');
    });

    test('should build CSS from parsed selector', () => {
        const css = engine.buildCSS({
            type: SELECTOR_TYPES.TEST_ID,
            value: 'my-test'
        });
        expect(css).toBe('[data-testid="my-test"]');
    });

    test('should generate fallback strategies', () => {
        const elementInfo = {
            tag: 'button',
            id: 'submit',
            class: 'btn primary',
            text: 'Submit Form',
            ariaLabel: 'Submit',
            role: 'button',
            testId: 'submit-btn'
        };

        const fallbacks = engine.generateFallbacks(elementInfo);
        expect(fallbacks.length).toBeGreaterThan(0);
        expect(fallbacks[0]).toHaveProperty('type');
        expect(fallbacks[0]).toHaveProperty('priority');
    });

    test('should track statistics', () => {
        engine.recordSuccess('#test', 'css');
        engine.recordFailure('#fail');
        
        const stats = engine.getStats();
        expect(stats.selectorStats).toBeDefined();
    });
});

describe('SelfHealingSelector', () => {
    let healer;

    beforeEach(() => {
        healer = new SelfHealingSelector();
    });

    test('should initialize with default options', () => {
        expect(healer.options.maxRetries).toBe(5);
        expect(healer.options.enableLearning).toBe(true);
        expect(healer.options.confidenceThreshold).toBe(0.7);
    });

    test('should generate ID variations', () => {
        const variations = healer.generateIdVariations('#myElement');
        expect(variations.length).toBeGreaterThan(0);
        expect(variations.some(v => v.includes('[id*="myElement"]'))).toBe(true);
    });

    test('should generate class variations', () => {
        const variations = healer.generateClassVariations('.btn.primary');
        expect(variations.length).toBeGreaterThan(0);
    });

    test('should calculate string similarity', () => {
        const similarity = healer.calculateSimilarity('hello', 'hello');
        expect(similarity).toBe(1);

        const partial = healer.calculateSimilarity('hello', 'helo');
        expect(partial).toBeGreaterThan(0.5);
        expect(partial).toBeLessThan(1);
    });

    test('should export and import knowledge', () => {
        healer.recordHealing('#old', { selector: '#new', name: 'test' }, { confidence: 0.9 });
        
        const knowledge = healer.exportKnowledge();
        expect(knowledge).toHaveProperty('healingHistory');
        expect(knowledge).toHaveProperty('successfulPatterns');
        expect(knowledge).toHaveProperty('exportDate');
    });

    test('should provide healing statistics', () => {
        const stats = healer.getStats();
        expect(stats).toHaveProperty('totalSelectors');
        expect(stats).toHaveProperty('totalAttempts');
        expect(stats).toHaveProperty('successfulHealings');
        expect(stats).toHaveProperty('successRate');
    });
});
