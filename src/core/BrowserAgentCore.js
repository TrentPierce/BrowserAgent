/**
 * BrowserAgentCore - Core browser automation engine
 * Provides the main automation logic for library mode
 * @module BrowserAgentCore
 */

const EventEmitter = require('events');

class BrowserAgentCore extends EventEmitter {
  /**
     * Create BrowserAgentCore instance
     * @param {Object} options - Configuration options
     * @param {Object} options.llmProvider - LLM provider instance
     * @param {Object} options.orchestrator - Task orchestrator
     * @param {Object} options.toolRegistry - Tool registry
     * @param {boolean} options.headless - Headless mode
     * @param {boolean} options.enableLearning - Enable learning
     */
  constructor(options = {}) {
    super();
        
    this.llmProvider = options.llmProvider;
    this.orchestrator = options.orchestrator;
    this.toolRegistry = options.toolRegistry;
    this.headless = options.headless || false;
    this.enableLearning = options.enableLearning !== false;
        
    this.browser = null;
    this.page = null;
    this.initialized = false;
        
    this.stats = {
      actionsExecuted: 0,
      actionsSucceeded: 0,
      actionsFailed: 0,
      extractionsPerformed: 0,
      averageActionTime: 0,
      totalTime: 0
    };
  }
    
  /**
     * Initialize the core agent
     * @returns {Promise<void>}
     */
  async init() {
    if (this.initialized) {
      throw new Error('BrowserAgentCore already initialized');
    }
        
    // Initialize browser (Electron or Puppeteer based on environment)
    await this.initializeBrowser();
        
    this.initialized = true;
    this.emit('initialized');
  }
    
  /**
     * Initialize browser based on environment
     * @private
     */
  async initializeBrowser() {
    // Check if running in Electron
    if (typeof window !== 'undefined' && window.process && window.process.type) {
      this.environment = 'electron';
      // Use Electron's BrowserWindow
    } else {
      this.environment = 'standalone';
      // Use Puppeteer or similar
      try {
        const puppeteer = require('puppeteer');
        this.browser = await puppeteer.launch({
          headless: this.headless,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        this.page = await this.browser.newPage();
        await this.page.setViewport({ width: 1280, height: 720 });
      } catch (error) {
        throw new Error(`Failed to initialize browser: ${error.message}`);
      }
    }
  }
    
  /**
     * Navigate to URL
     * @param {string} url - Target URL
     * @returns {Promise<void>}
     */
  async goto(url) {
    this.ensureInitialized();
        
    const startTime = Date.now();
        
    try {
      if (this.environment === 'electron') {
        // Use Electron navigation
        await this.electronGoto(url);
      } else {
        await this.page.goto(url, { waitUntil: 'networkidle2' });
      }
            
      this.emit('navigated', { url, duration: Date.now() - startTime });
    } catch (error) {
      this.emit('error', { type: 'navigation', error: error.message });
      throw error;
    }
  }
    
  /**
     * Execute an action
     * @param {string} action - Natural language action
     * @param {Object} options - Execution options
     * @returns {Promise<Object>} Result
     */
  async executeAction(action, options = {}) {
    this.ensureInitialized();
        
    const startTime = Date.now();
    this.stats.actionsExecuted++;
        
    try {
      // Capture page state
      const pageState = await this.capturePageState();
            
      // Analyze with orchestrator
      const actionPlan = await this.orchestrator.executeParallelAnalysis({
        dom: pageState.dom,
        screenshot: pageState.screenshot,
        url: pageState.url,
        goal: action,
        context: options.context || {},
        viewport: pageState.viewport,
        domNodes: pageState.domNodes
      });
            
      // Execute the plan
      const result = await this.executeActionPlan(actionPlan);
            
      const duration = Date.now() - startTime;
      this.updateStats(true, duration);
            
      this.emit('actionCompleted', { action, result, duration });
            
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.updateStats(false, duration);
            
      this.emit('actionFailed', { action, error: error.message, duration });
      throw error;
    }
  }
    
  /**
     * Extract information from page
     * @param {string} instruction - What to extract
     * @param {Object} options - Extraction options
     * @returns {Promise<any>} Extracted data
     */
  async extractInformation(instruction, options = {}) {
    this.ensureInitialized();
        
    this.stats.extractionsPerformed++;
        
    try {
      const pageState = await this.capturePageState();
            
      // Use LLM to extract information
      const extractedData = await this.llmProvider.extract({
        instruction,
        dom: pageState.dom,
        screenshot: options.includeScreenshot ? pageState.screenshot : null
      });
            
      this.emit('extracted', { instruction, data: extractedData });
            
      return extractedData;
    } catch (error) {
      this.emit('error', { type: 'extraction', error: error.message });
      throw error;
    }
  }
    
  /**
     * Observe page state
     * @param {string} instruction - What to observe
     * @returns {Promise<any>} Observation
     */
  async observeState(instruction) {
    this.ensureInitialized();
        
    const pageState = await this.capturePageState();
        
    const observation = await this.llmProvider.observe({
      instruction,
      dom: pageState.dom,
      url: pageState.url
    });
        
    return observation;
  }
    
  /**
     * Get current page information
     * @returns {Promise<Object>} Page info
     */
  async getPageInfo() {
    this.ensureInitialized();
        
    if (this.environment === 'electron') {
      return this.getElectronPageInfo();
    } else {
      return {
        url: this.page.url(),
        title: await this.page.title()
      };
    }
  }
    
  /**
     * Capture complete page state
     * @private
     * @returns {Promise<Object>} Page state
     */
  async capturePageState() {
    if (this.environment === 'electron') {
      return this.captureElectronState();
    } else {
      return this.capturePuppeteerState();
    }
  }
    
  /**
     * Capture state in Puppeteer mode
     * @private
     */
  async capturePuppeteerState() {
    const dom = await this.page.evaluate(() => {
      const elements = [];
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_ELEMENT,
        null,
        false
      );
            
      let node;
      while ((node = walker.nextNode()) !== null) {
        if (node.offsetWidth > 0 && node.offsetHeight > 0) {
          const rect = node.getBoundingClientRect();
          elements.push({
            tag: node.tagName.toLowerCase(),
            id: node.id,
            className: node.className,
            text: node.textContent?.trim().substring(0, 100),
            bounds: {
              x: rect.left,
              y: rect.top,
              width: rect.width,
              height: rect.height
            }
          });
        }
      }
      return elements;
    });
        
    const screenshot = await this.page.screenshot({ encoding: 'base64' });
        
    const viewport = await this.page.evaluate(() => ({
      width: window.innerWidth,
      height: window.innerHeight,
      scrollY: window.scrollY,
      scrollX: window.scrollX
    }));
        
    return {
      dom,
      screenshot,
      url: this.page.url(),
      viewport,
      domNodes: dom
    };
  }
    
  /**
     * Execute action plan
     * @private
     */
  async executeActionPlan(plan) {
    if (this.environment === 'electron') {
      return this.executeElectronAction(plan);
    } else {
      return this.executePuppeteerAction(plan);
    }
  }
    
  /**
     * Execute action in Puppeteer
     * @private
     */
  async executePuppeteerAction(plan) {
    switch (plan.action) {
      case 'click':
        await this.page.click(plan.selector);
        break;
      case 'type':
        await this.page.type(plan.selector, plan.value);
        break;
      case 'navigate':
        await this.page.goto(plan.url);
        break;
      case 'scroll':
        await this.page.evaluate((y) => window.scrollTo(0, y), plan.scrollY);
        break;
      case 'wait':
        await this.page.waitForTimeout(plan.duration);
        break;
      default:
        throw new Error(`Unknown action: ${plan.action}`);
    }
        
    return { success: true, action: plan.action };
  }
    
  /**
     * Update statistics
     * @private
     */
  updateStats(success, duration) {
    if (success) {
      this.stats.actionsSucceeded++;
    } else {
      this.stats.actionsFailed++;
    }
        
    this.stats.totalTime += duration;
    this.stats.averageActionTime = 
            this.stats.totalTime / this.stats.actionsExecuted;
  }
    
  /**
     * Get statistics
     * @returns {Object} Statistics
     */
  getStats() {
    return {
      ...this.stats,
      successRate: this.stats.actionsExecuted > 0
        ? (this.stats.actionsSucceeded / this.stats.actionsExecuted * 100).toFixed(2) + '%'
        : '0%'
    };
  }
    
  /**
     * Close the core agent
     * @returns {Promise<void>}
     */
  async close() {
    if (!this.initialized) return;
        
    if (this.browser) {
      await this.browser.close();
    }
        
    this.initialized = false;
    this.emit('closed');
  }
    
  /**
     * Ensure initialized
     * @private
     */
  ensureInitialized() {
    if (!this.initialized) {
      throw new Error('BrowserAgentCore not initialized');
    }
  }
    
  // Electron-specific methods (stubs for now)
  async electronGoto(url) {
    throw new Error('Electron mode not yet implemented in library');
  }
    
  async captureElectronState() {
    throw new Error('Electron mode not yet implemented in library');
  }
    
  async executeElectronAction(plan) {
    throw new Error('Electron mode not yet implemented in library');
  }
    
  async getElectronPageInfo() {
    throw new Error('Electron mode not yet implemented in library');
  }
}

module.exports = { BrowserAgentCore };