/**
 * @jest-environment node
 */

const {
    BrowserFactory,
    BROWSER_TYPES,
    ChromeAdapter,
    FirefoxAdapter,
    SafariAdapter,
    EdgeAdapter,
    ContextManager
} = require('../../../src/browser');

describe('BrowserFactory', () => {
    test('should export browser types', () => {
        expect(BROWSER_TYPES).toBeDefined();
        expect(BROWSER_TYPES.CHROME).toBe('chrome');
        expect(BROWSER_TYPES.FIREFOX).toBe('firefox');
        expect(BROWSER_TYPES.SAFARI).toBe('safari');
        expect(BROWSER_TYPES.EDGE).toBe('edge');
    });

    test('should list available browser types', () => {
        const types = BrowserFactory.getAvailableTypes();
        expect(types).toContain('chrome');
        expect(types).toContain('firefox');
        expect(types).toContain('safari');
        expect(types).toContain('edge');
    });

    test('should validate supported browser types', () => {
        expect(BrowserFactory.isSupported('chrome')).toBe(true);
        expect(BrowserFactory.isSupported('firefox')).toBe(true);
        expect(BrowserFactory.isSupported('safari')).toBe(true);
        expect(BrowserFactory.isSupported('edge')).toBe(true);
        expect(BrowserFactory.isSupported('unknown')).toBe(false);
    });

    test('should create browser adapter instances', () => {
        const chrome = BrowserFactory.create('chrome');
        expect(chrome).toBeInstanceOf(ChromeAdapter);

        const firefox = BrowserFactory.create('firefox');
        expect(firefox).toBeInstanceOf(FirefoxAdapter);

        const safari = BrowserFactory.create('safari');
        expect(safari).toBeInstanceOf(SafariAdapter);

        const edge = BrowserFactory.create('edge');
        expect(edge).toBeInstanceOf(EdgeAdapter);
    });

    test('should throw error for unsupported browser', () => {
        expect(() => {
            BrowserFactory.create('unknown');
        }).toThrow('Unsupported browser type');
    });
});

describe('ContextManager', () => {
    let manager;

    beforeEach(() => {
        manager = new ContextManager();
    });

    test('should initialize with default options', () => {
        expect(manager.contexts).toBeDefined();
        expect(manager.pages).toBeDefined();
        expect(manager.activeContextId).toBeNull();
        expect(manager.activePageId).toBeNull();
    });

    test('should generate unique context IDs', async () => {
        const mockBrowser = {
            createContext: jest.fn().mockResolvedValue({})
        };

        const id1 = await manager.createContext(mockBrowser);
        const id2 = await manager.createContext(mockBrowser);

        expect(id1).not.toBe(id2);
        expect(id1).toMatch(/^ctx_/);
        expect(id2).toMatch(/^ctx_/);
    });

    test('should track context stats', () => {
        const stats = manager.getStats();
        expect(stats).toHaveProperty('totalContexts');
        expect(stats).toHaveProperty('totalPages');
        expect(stats).toHaveProperty('activeContext');
        expect(stats).toHaveProperty('activePage');
    });
});
