/**
 * Mobile Agent
 * Unified agent for iOS and Android automation with RL integration
 */

const MobileDriver = require('./mobileDriver');
const PlatformSelectors = require('./platformSelectors');
const MobileCommands = require('./mobileCommands');
const MobileStateDetector = require('./mobileStateDetector');
const StateRepresentation = require('../learning/stateRepresentation');

class MobileAgent {
  constructor(config = {}) {
    this.config = config;
    this.driver = new MobileDriver(config);
    this.platform = config.platform || 'android';
    this.selectors = new PlatformSelectors(this.platform);
    this.commands = null;
    this.stateDetector = null;
    this.stateRepresentation = new StateRepresentation(this.platform);
    this.isInitialized = false;
    this.learningEnabled = config.enableLearning !== false;
  }

  /**
     * Initialize mobile agent
     */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    console.log('[MobileAgent] Initializing for', this.platform);
        
    await this.driver.initialize();
    const driverInstance = await this.driver.getDriver();
        
    this.commands = new MobileCommands(driverInstance, this.platform);
    this.stateDetector = new MobileStateDetector(driverInstance, this.platform);
        
    this.isInitialized = true;
    console.log('[MobileAgent] Initialized successfully');
  }

  /**
     * Get current state
     */
  async getState() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const screenState = await this.stateDetector.detectScreenState();
    const state = this.stateRepresentation.createState(screenState);
        
    return state;
  }

  /**
     * Find element using platform-agnostic selector
     */
  async findElement(selector, type = 'auto') {
    const driverInstance = await this.driver.getDriver();
    const platformSelector = this.selectors.convert(selector, type);
        
    try {
      if (typeof platformSelector === 'string') {
        return await driverInstance.$(platformSelector);
      } else {
        const { strategy, selector: sel } = platformSelector;
        return await driverInstance.$(strategy + '=' + sel);
      }
    } catch (error) {
      console.error('[MobileAgent] Element not found:', error.message);
      return null;
    }
  }

  /**
     * Find multiple elements
     */
  async findElements(selector, type = 'auto') {
    const driverInstance = await this.driver.getDriver();
    const platformSelector = this.selectors.convert(selector, type);
        
    try {
      if (typeof platformSelector === 'string') {
        return await driverInstance.$$(platformSelector);
      } else {
        const { strategy, selector: sel } = platformSelector;
        return await driverInstance.$$(strategy + '=' + sel);
      }
    } catch (error) {
      console.error('[MobileAgent] Elements not found:', error.message);
      return [];
    }
  }

  /**
     * Tap on element or coordinates
     */
  async tap(selector = null, options = {}) {
    let element = null;
        
    if (selector) {
      element = await this.findElement(selector);
      if (!element) {
        throw new Error(`Element not found: ${selector}`);
      }
    }
        
    await this.commands.tap(element, options);
  }

  /**
     * Type text into element
     */
  async type(selector, text) {
    const element = await this.findElement(selector);
        
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }
        
    await element.setValue(text);
  }

  /**
     * Swipe gesture
     */
  async swipe(options) {
    await this.commands.swipe(options);
  }

  /**
     * Scroll
     */
  async scroll(options = {}) {
    await this.commands.scroll(options);
  }

  /**
     * Long press
     */
  async longPress(selector, options = {}) {
    const element = await this.findElement(selector);
        
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }
        
    await this.commands.longPress(element, options);
  }

  /**
     * Install app
     */
  async installApp(appPath) {
    await this.commands.installApp(appPath);
  }

  /**
     * Launch app
     */
  async launchApp() {
    await this.commands.launchApp();
  }

  /**
     * Close app
     */
  async closeApp() {
    await this.commands.closeApp();
  }

  /**
     * Get app state
     */
  async getAppState(bundleId) {
    return await this.commands.getAppState(bundleId);
  }

  /**
     * Execute action (for RL integration)
     */
  async executeAction(action, params = {}) {
    const startTime = Date.now();
    let success = false;
    let error = null;
        
    try {
      switch (action) {
        case 'tap':
        case 'click':
          await this.tap(params.selector, params.options);
          success = true;
          break;
                    
        case 'type':
          await this.type(params.selector, params.text);
          success = true;
          break;
                    
        case 'swipe':
          await this.swipe(params);
          success = true;
          break;
                    
        case 'scroll':
          await this.scroll(params);
          success = true;
          break;
                    
        case 'longPress':
          await this.longPress(params.selector, params.options);
          success = true;
          break;
                    
        case 'wait': {
          const driver = await this.driver.getDriver();
          await driver.pause(params.duration || 1000);
          success = true;
          break;
        }
                    
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    } catch (err) {
      error = err.message;
      console.error(`[MobileAgent] Action ${action} failed:`, err.message);
    }
        
    const timeTaken = Date.now() - startTime;
        
    return {
      action,
      success,
      error,
      timeTaken,
      timestamp: Date.now()
    };
  }

  /**
     * Take screenshot
     */
  async screenshot(filepath = null) {
    const driver = await this.driver.getDriver();
    const screenshot = await driver.takeScreenshot();
        
    if (filepath) {
      const fs = require('fs');
      fs.writeFileSync(filepath, screenshot, 'base64');
    }
        
    return screenshot;
  }

  /**
     * Get page source
     */
  async getPageSource() {
    const driver = await this.driver.getDriver();
    return await driver.getPageSource();
  }

  /**
     * Check if stuck
     */
  isStuck() {
    return this.stateDetector.isStuck();
  }

  /**
     * Close agent
     */
  async close() {
    await this.driver.quit();
    this.isInitialized = false;
  }
}

module.exports = MobileAgent;
