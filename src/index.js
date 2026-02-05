/**
 * BrowserAgent - Intelligent Browser Automation Library
 * Main entry point for library mode
 * @module browser-agent
 * 
 * This project uses BrowserAgent by Trent Pierce
 * https://github.com/TrentPierce/BrowserAgent
 * Licensed under the BrowserAgent Non-Commercial License
 * 
 * Copyright (c) 2026 Trent Pierce. All rights reserved.
 * See LICENSE file for full terms.
 */

const { BrowserAgentCore } = require('./core/BrowserAgentCore');
const { LLMProviderFactory } = require('./providers/LLMProviderFactory');
const { TaskOrchestrator } = require('../taskOrchestrator');
const { ToolRegistry } = require('./tools/ToolRegistry');

// New Browser Infrastructure
const {
  BrowserAdapter,
  ChromeAdapter,
  FirefoxAdapter,
  SafariAdapter,
  EdgeAdapter,
  PageAdapter,
  ContextManager,
  BrowserFactory,
  BROWSER_TYPES
} = require('./browser');

// Selectors
const {
  SelectorEngine,
  SELECTOR_TYPES,
  SelfHealingSelector
} = require('./selectors');

// Network
const { NetworkInterceptor } = require('./network');

// Session
const { SessionManager } = require('./session');

// Waiting
const { AutoWaiter } = require('./waiting');

// Trace
const { TraceViewer } = require('./trace');

// Debugging
const { DOMSnapshotManager } = require('./debugging');

// Human Behavior
const { HumanBehaviorSimulator } = require('./human');

/**
 * Stagehand-compatible BrowserAgent
 * Provides a simple API interface similar to Stagehand while maintaining
 * the advanced capabilities of BrowserAgent
 */
class BrowserAgent {
  /**
     * Create a new BrowserAgent instance
     * @param {Object} options - Configuration options
     * @param {string} options.provider - LLM provider: 'gemini', 'openai', 'anthropic'
     * @param {string} options.apiKey - API key for the provider
     * @param {Object} options.llmConfig - Additional LLM configuration
     * @param {boolean} options.headless - Run in headless mode (default: false)
     * @param {boolean} options.enableLearning - Enable adaptive learning (default: true)
     * @param {boolean} options.enableVisualAnalysis - Enable visual understanding (default: true)
     * @param {boolean} options.enableTemporalAnalysis - Enable temporal awareness (default: true)
     * @param {boolean} options.enableDecisionFusion - Enable intelligent decision-making (default: true)
     * @param {Object} options.orchestratorConfig - TaskOrchestrator configuration
     */
  constructor(options = {}) {
    this.options = {
      provider: options.provider || 'gemini',
      apiKey: options.apiKey,
      llmConfig: options.llmConfig || {},
      headless: options.headless !== undefined ? options.headless : false,
      enableLearning: options.enableLearning !== undefined ? options.enableLearning : true,
      enableVisualAnalysis: options.enableVisualAnalysis !== undefined ? options.enableVisualAnalysis : true,
      enableTemporalAnalysis: options.enableTemporalAnalysis !== undefined ? options.enableTemporalAnalysis : true,
      enableDecisionFusion: options.enableDecisionFusion !== undefined ? options.enableDecisionFusion : true,
      orchestratorConfig: options.orchestratorConfig || {}
    };

    this.initialized = false;
    this.core = null;
    this.llmProvider = null;
    this.orchestrator = null;
    this.toolRegistry = null;
  }

  /**
     * Initialize the browser agent
     * @returns {Promise<void>}
     */
  async init() {
    if (this.initialized) {
      throw new Error('BrowserAgent already initialized');
    }

    // Initialize LLM provider
    this.llmProvider = LLMProviderFactory.createProvider(
      this.options.provider,
      this.options.apiKey,
      this.options.llmConfig
    );

    // Initialize orchestrator with all phases
    this.orchestrator = new TaskOrchestrator({
      maxConcurrent: 4,
      taskTimeout: 30000,
      enableVisualAnalysis: this.options.enableVisualAnalysis,
      enableTemporalAnalysis: this.options.enableTemporalAnalysis,
      enableDecisionFusion: this.options.enableDecisionFusion,
      ...this.options.orchestratorConfig
    });

    // Initialize tool registry
    this.toolRegistry = new ToolRegistry();

    // Initialize core agent
    this.core = new BrowserAgentCore({
      llmProvider: this.llmProvider,
      orchestrator: this.orchestrator,
      toolRegistry: this.toolRegistry,
      headless: this.options.headless,
      enableLearning: this.options.enableLearning
    });

    await this.core.init();
    this.initialized = true;
  }

  /**
     * Navigate to a URL
     * @param {string} url - URL to navigate to
     * @returns {Promise<void>}
     */
  async goto(url) {
    this.ensureInitialized();
    return this.core.goto(url);
  }

  /**
     * Execute an action on the page
     * @param {string} action - Natural language action description
     * @param {Object} options - Action options
     * @returns {Promise<Object>} Action result
     */
  async act(action, options = {}) {
    this.ensureInitialized();
    return this.core.executeAction(action, options);
  }

  /**
     * Extract information from the page
     * @param {string} instruction - What to extract
     * @param {Object} options - Extraction options
     * @returns {Promise<any>} Extracted data
     */
  async extract(instruction, options = {}) {
    this.ensureInitialized();
    return this.core.extractInformation(instruction, options);
  }

  /**
     * Observe page state
     * @param {string} instruction - What to observe
     * @returns {Promise<any>} Observation result
     */
  async observe(instruction) {
    this.ensureInitialized();
    return this.core.observeState(instruction);
  }

  /**
     * Get current page information
     * @returns {Promise<Object>} Page info
     */
  async page() {
    this.ensureInitialized();
    return this.core.getPageInfo();
  }

  /**
     * Register a custom tool
     * @param {string} name - Tool name
     * @param {Function} handler - Tool handler function
     * @param {Object} schema - Tool schema
     */
  registerTool(name, handler, schema) {
    this.ensureInitialized();
    this.toolRegistry.registerTool(name, handler, schema);
  }

  /**
     * Execute a registered tool
     * @param {string} toolName - Name of the tool
     * @param {Object} params - Tool parameters
     * @returns {Promise<any>} Tool result
     */
  async useTool(toolName, params) {
    this.ensureInitialized();
    return this.toolRegistry.executeTool(toolName, params);
  }

  /**
     * Get agent statistics
     * @returns {Object} Statistics
     */
  getStats() {
    this.ensureInitialized();
    return {
      agent: this.core.getStats(),
      orchestrator: this.orchestrator.getStats()
    };
  }

  /**
     * Close the browser agent
     * @returns {Promise<void>}
     */
  async close() {
    if (!this.initialized) return;

    if (this.core) {
      await this.core.close();
    }

    if (this.orchestrator) {
      this.orchestrator.destroy();
    }

    this.initialized = false;
  }

  /**
     * Ensure the agent is initialized
     * @private
     */
  ensureInitialized() {
    if (!this.initialized) {
      throw new Error('BrowserAgent not initialized. Call init() first.');
    }
  }
}

/**
 * Create a new BrowserAgent instance (convenience function)
 * @param {Object} options - Configuration options
 * @returns {Promise<BrowserAgent>} Initialized agent
 */
async function createAgent(options = {}) {
  const agent = new BrowserAgent(options);
  await agent.init();
  return agent;
}

module.exports = {
  // Main BrowserAgent
  BrowserAgent,
  createAgent,
  
  // Core Components
  BrowserAgentCore,
  LLMProviderFactory,
  TaskOrchestrator,
  ToolRegistry,
  
  // Browser Adapters (Multi-Browser Support)
  BrowserAdapter,
  ChromeAdapter,
  FirefoxAdapter,
  SafariAdapter,
  EdgeAdapter,
  PageAdapter,
  ContextManager,
  BrowserFactory,
  BROWSER_TYPES,
  
  // Selectors (Self-Healing)
  SelectorEngine,
  SELECTOR_TYPES,
  SelfHealingSelector,
  
  // Network (Interception & Mocking)
  NetworkInterceptor,
  
  // Session (Auth Management)
  SessionManager,
  
  // Waiting (Auto-Wait)
  AutoWaiter,
  
  // Trace (Execution Recording)
  TraceViewer,
  
  // Debugging (DOM Snapshots)
  DOMSnapshotManager,
  
  // Human Behavior Simulation
  HumanBehaviorSimulator
};
