/**
 * Mobile State Detector
 * Detects app state, screen state, and navigation context for mobile apps
 */

class MobileStateDetector {
    constructor(driver, platform) {
        this.driver = driver;
        this.platform = platform.toLowerCase();
        this.previousState = null;
        this.stateHistory = [];
        this.maxHistorySize = 20;
    }

    /**
     * Get current app state
     */
    async detectAppState(bundleId) {
        try {
            let state;
            if (this.platform === 'android') {
                state = await this.driver.execute('mobile: queryAppState', { appId: bundleId });
            } else if (this.platform === 'ios') {
                state = await this.driver.execute('mobile: queryAppState', { bundleId });
            }
            
            const stateMap = {
                0: 'NOT_INSTALLED',
                1: 'NOT_RUNNING',
                2: 'RUNNING_BACKGROUND_SUSPENDED',
                3: 'RUNNING_BACKGROUND',
                4: 'RUNNING_FOREGROUND'
            };
            
            return stateMap[state] || 'UNKNOWN';
        } catch (error) {
            console.error('[MobileStateDetector] App state detection failed:', error.message);
            return 'UNKNOWN';
        }
    }

    /**
     * Detect current screen structure and context
     */
    async detectScreenState() {
        try {
            const pageSource = await this.driver.getPageSource();
            const screenSize = await this.driver.getWindowSize();
            
            // Extract visible elements
            const elements = await this.extractVisibleElements();
            
            // Detect screen type
            const screenType = this.classifyScreenType(elements, pageSource);
            
            // Detect navigation context
            const navigationContext = await this.detectNavigationContext();
            
            // Detect modals/dialogs
            const hasModal = await this.detectModal();
            
            const state = {
                screenType,
                navigationContext,
                hasModal,
                elementCount: elements.length,
                screenSize,
                timestamp: Date.now(),
                elements: elements.slice(0, 50)
            };
            
            this.updateStateHistory(state);
            
            return state;
        } catch (error) {
            console.error('[MobileStateDetector] Screen state detection failed:', error.message);
            return null;
        }
    }

    /**
     * Extract visible interactive elements
     */
    async extractVisibleElements() {
        try {
            const elements = [];
            
            // Common interactive element types
            const selectors = this.platform === 'android' ? [
                'android.widget.Button',
                'android.widget.EditText',
                'android.widget.TextView',
                'android.widget.ImageButton',
                'android.widget.CheckBox',
                'android.widget.Switch',
                'android.view.ViewGroup[clickable=true]'
            ] : [
                'XCUIElementTypeButton',
                'XCUIElementTypeTextField',
                'XCUIElementTypeStaticText',
                'XCUIElementTypeCell',
                'XCUIElementTypeSwitch',
                'XCUIElementTypeLink'
            ];
            
            for (const selector of selectors) {
                try {
                    const foundElements = await this.driver.$$(`//${selector}`);
                    
                    for (const el of foundElements) {
                        try {
                            const isDisplayed = await el.isDisplayed();
                            if (!isDisplayed) continue;
                            
                            const text = await this.getElementText(el);
                            const bounds = await el.getLocation();
                            const size = await el.getSize();
                            
                            elements.push({
                                type: selector,
                                text,
                                bounds,
                                size,
                                isClickable: await this.isElementClickable(el)
                            });
                        } catch (e) {
                            // Skip elements that can't be accessed
                            continue;
                        }
                    }
                } catch (e) {
                    // Skip selectors that don't find elements
                    continue;
                }
            }
            
            return elements;
        } catch (error) {
            console.error('[MobileStateDetector] Element extraction failed:', error.message);
            return [];
        }
    }

    /**
     * Classify screen type based on content
     */
    classifyScreenType(elements, pageSource) {
        const text = elements.map(e => e.text?.toLowerCase() || '').join(' ');
        const source = pageSource.toLowerCase();
        
        // Login/Auth screens
        if ((text.includes('login') || text.includes('sign in') || text.includes('username') || text.includes('password')) &&
            (text.includes('submit') || text.includes('login') || text.includes('sign in'))) {
            return 'LOGIN';
        }
        
        // Registration screens
        if ((text.includes('register') || text.includes('sign up') || text.includes('create account')) &&
            (text.includes('email') || text.includes('password'))) {
            return 'REGISTRATION';
        }
        
        // List/Feed screens
        const listCount = elements.filter(e => e.type.includes('Cell') || e.type.includes('Item')).length;
        if (listCount > 5) {
            return 'LIST';
        }
        
        // Form screens
        const inputCount = elements.filter(e => 
            e.type.includes('EditText') || e.type.includes('TextField')
        ).length;
        if (inputCount >= 3) {
            return 'FORM';
        }
        
        // Detail/Profile screens
        if (text.includes('profile') || text.includes('settings') || text.includes('account')) {
            return 'DETAIL';
        }
        
        // Search screens
        if (text.includes('search') && inputCount > 0) {
            return 'SEARCH';
        }
        
        // Home/Dashboard
        if (text.includes('home') || text.includes('dashboard')) {
            return 'HOME';
        }
        
        // WebView
        if (source.includes('webview') || source.includes('webkit')) {
            return 'WEBVIEW';
        }
        
        return 'GENERAL';
    }

    /**
     * Detect navigation context (tab bar, nav bar, etc.)
     */
    async detectNavigationContext() {
        try {
            const context = {
                hasTabBar: false,
                hasNavBar: false,
                hasBackButton: false,
                hasMenu: false
            };
            
            if (this.platform === 'android') {
                // Check for bottom navigation
                const bottomNav = await this.driver.$$('//android.widget.BottomNavigationView');
                context.hasTabBar = bottomNav.length > 0;
                
                // Check for action bar
                const actionBar = await this.driver.$$('//android.widget.Toolbar');
                context.hasNavBar = actionBar.length > 0;
                
                // Check for back button
                const backButton = await this.driver.$$('//*[@content-desc="Navigate up"]');
                context.hasBackButton = backButton.length > 0;
                
                // Check for menu
                const menu = await this.driver.$$('//*[@content-desc="More options"]');
                context.hasMenu = menu.length > 0;
            } else if (this.platform === 'ios') {
                // Check for tab bar
                const tabBar = await this.driver.$$('//XCUIElementTypeTabBar');
                context.hasTabBar = tabBar.length > 0;
                
                // Check for navigation bar
                const navBar = await this.driver.$$('//XCUIElementTypeNavigationBar');
                context.hasNavBar = navBar.length > 0;
                
                // Check for back button
                const backButton = await this.driver.$$('//XCUIElementTypeButton[@name="Back"]');
                context.hasBackButton = backButton.length > 0;
            }
            
            return context;
        } catch (error) {
            console.error('[MobileStateDetector] Navigation context detection failed:', error.message);
            return {
                hasTabBar: false,
                hasNavBar: false,
                hasBackButton: false,
                hasMenu: false
            };
        }
    }

    /**
     * Detect if modal/dialog is present
     */
    async detectModal() {
        try {
            if (this.platform === 'android') {
                const dialogs = await this.driver.$$('//android.app.Dialog');
                const alertDialogs = await this.driver.$$('//android.app.AlertDialog');
                return dialogs.length > 0 || alertDialogs.length > 0;
            } else if (this.platform === 'ios') {
                const alerts = await this.driver.$$('//XCUIElementTypeAlert');
                const sheets = await this.driver.$$('//XCUIElementTypeSheet');
                return alerts.length > 0 || sheets.length > 0;
            }
            return false;
        } catch (error) {
            return false;
        }
    }

    /**
     * Get text from element (platform-specific)
     */
    async getElementText(element) {
        try {
            if (this.platform === 'android') {
                const text = await element.getAttribute('text');
                const contentDesc = await element.getAttribute('content-desc');
                return text || contentDesc || '';
            } else if (this.platform === 'ios') {
                const label = await element.getAttribute('label');
                const value = await element.getAttribute('value');
                const name = await element.getAttribute('name');
                return label || value || name || '';
            }
            return '';
        } catch (error) {
            return '';
        }
    }

    /**
     * Check if element is clickable
     */
    async isElementClickable(element) {
        try {
            if (this.platform === 'android') {
                const clickable = await element.getAttribute('clickable');
                return clickable === 'true';
            } else if (this.platform === 'ios') {
                const enabled = await element.getAttribute('enabled');
                return enabled === 'true';
            }
            return false;
        } catch (error) {
            return false;
        }
    }

    /**
     * Update state history
     */
    updateStateHistory(state) {
        this.stateHistory.push(state);
        
        if (this.stateHistory.length > this.maxHistorySize) {
            this.stateHistory.shift();
        }
        
        this.previousState = state;
    }

    /**
     * Detect if app is stuck (same state repeating)
     */
    isStuck() {
        if (this.stateHistory.length < 3) {
            return false;
        }
        
        const recent = this.stateHistory.slice(-3);
        const screenTypes = recent.map(s => s.screenType);
        const elementCounts = recent.map(s => s.elementCount);
        
        // Same screen type and similar element count
        const sameScreen = screenTypes.every(t => t === screenTypes[0]);
        const similarCount = Math.max(...elementCounts) - Math.min(...elementCounts) < 5;
        
        return sameScreen && similarCount;
    }

    /**
     * Get state transition
     */
    getStateTransition() {
        if (this.stateHistory.length < 2) {
            return null;
        }
        
        const current = this.stateHistory[this.stateHistory.length - 1];
        const previous = this.stateHistory[this.stateHistory.length - 2];
        
        return {
            from: previous.screenType,
            to: current.screenType,
            timestamp: current.timestamp,
            changed: previous.screenType !== current.screenType
        };
    }

    /**
     * Clear state history
     */
    clearHistory() {
        this.stateHistory = [];
        this.previousState = null;
    }
}

module.exports = MobileStateDetector;
