/**
 * BrowserAgent TypeScript Type Definitions
 * @package @trentpierce/browser-agent
 * @version 2.2.0
 */

import { EventEmitter } from 'events';

// ============================================================================
// Core Types
// ============================================================================

export interface BrowserAgentOptions {
  /** LLM provider: 'gemini', 'openai', 'anthropic' */
  provider?: 'gemini' | 'openai' | 'anthropic';
  /** API key for the provider */
  apiKey?: string;
  /** Additional LLM configuration */
  llmConfig?: Record<string, any>;
  /** Run in headless mode (default: false) */
  headless?: boolean;
  /** Enable adaptive learning (default: true) */
  enableLearning?: boolean;
  /** Enable visual understanding (default: true) */
  enableVisualAnalysis?: boolean;
  /** Enable temporal awareness (default: true) */
  enableTemporalAnalysis?: boolean;
  /** Enable intelligent decision-making (default: true) */
  enableDecisionFusion?: boolean;
  /** TaskOrchestrator configuration */
  orchestratorConfig?: TaskOrchestratorConfig;
}

export interface TaskOrchestratorConfig {
  maxConcurrent?: number;
  taskTimeout?: number;
  enableVisualAnalysis?: boolean;
  enableTemporalAnalysis?: boolean;
  enableDecisionFusion?: boolean;
}

export interface ActionResult {
  success: boolean;
  data?: any;
  error?: string;
  duration: number;
}

export interface AgentStats {
  agent: {
    actionsExecuted: number;
    actionsSucceeded: number;
    actionsFailed: number;
    extractionsPerformed: number;
    averageActionTime: number;
    totalTime: number;
  };
  orchestrator: {
    tasksCompleted: number;
    tasksFailed: number;
    averageTaskTime: number;
  };
}

// ============================================================================
// Main BrowserAgent Class
// ============================================================================

export declare class BrowserAgent extends EventEmitter {
  constructor(options?: BrowserAgentOptions);
  
  /** Initialize the browser agent */
  init(): Promise<void>;
  
  /** Navigate to a URL */
  goto(url: string): Promise<void>;
  
  /** Execute an action on the page */
  act(action: string, options?: Record<string, any>): Promise<ActionResult>;
  
  /** Extract information from the page */
  extract(instruction: string, options?: Record<string, any>): Promise<any>;
  
  /** Observe page state */
  observe(instruction: string): Promise<any>;
  
  /** Get current page information */
  page(): Promise<{
    url: string;
    title: string;
    viewport: { width: number; height: number };
  }>;
  
  /** Register a custom tool */
  registerTool(name: string, handler: Function, schema?: Record<string, any>): void;
  
  /** Execute a registered tool */
  useTool(toolName: string, params: Record<string, any>): Promise<any>;
  
  /** Get agent statistics */
  getStats(): AgentStats;
  
  /** Close the browser agent */
  close(): Promise<void>;
}

/** Create a new BrowserAgent instance (convenience function) */
export declare function createAgent(options?: BrowserAgentOptions): Promise<BrowserAgent>;

// ============================================================================
// LLM Providers
// ============================================================================

export interface LLMProvider {
  generateContent(prompt: string, options?: GenerateContentOptions): Promise<LLMResponse>;
  getModelName(): string;
}

export interface GenerateContentOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
}

export interface LLMResponse {
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export declare class GeminiProvider implements LLMProvider {
  constructor(apiKey: string, config?: Record<string, any>);
  generateContent(prompt: string, options?: GenerateContentOptions): Promise<LLMResponse>;
  getModelName(): string;
}

export declare class OpenAIProvider implements LLMProvider {
  constructor(apiKey: string, config?: Record<string, any>);
  generateContent(prompt: string, options?: GenerateContentOptions): Promise<LLMResponse>;
  getModelName(): string;
}

export declare class AnthropicProvider implements LLMProvider {
  constructor(apiKey: string, config?: Record<string, any>);
  generateContent(prompt: string, options?: GenerateContentOptions): Promise<LLMResponse>;
  getModelName(): string;
}

export declare class LLMProviderFactory {
  static createProvider(provider: string, apiKey: string, config?: Record<string, any>): LLMProvider;
}

// ============================================================================
// Mobile Automation
// ============================================================================

export interface MobileAgentConfig {
  platform: 'android' | 'ios';
  deviceName?: string;
  platformVersion?: string;
  appPackage?: string;
  appActivity?: string;
  bundleId?: string;
  udid?: string;
  automationName?: string;
  newCommandTimeout?: number;
  enableLearning?: boolean;
}

export interface MobileState {
  screenType: string;
  navigationContext: string;
  currentActivity?: string;
  elements: Array<{
    type: string;
    text?: string;
    bounds?: { x: number; y: number; width: number; height: number };
    enabled: boolean;
    visible: boolean;
  }>;
}

export interface SwipeOptions {
  direction?: 'up' | 'down' | 'left' | 'right';
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
  duration?: number;
}

export declare class MobileAgent {
  constructor(config: MobileAgentConfig);
  
  initialize(): Promise<void>;
  tap(selector: string, options?: { duration?: number }): Promise<void>;
  type(selector: string, text: string): Promise<void>;
  swipe(options?: SwipeOptions): Promise<void>;
  scroll(options?: { direction: 'up' | 'down'; element?: string }): Promise<void>;
  longPress(selector: string, options?: { duration?: number }): Promise<void>;
  installApp(path: string): Promise<void>;
  launchApp(): Promise<void>;
  closeApp(): Promise<void>;
  getState(): Promise<MobileState>;
  screenshot(filepath?: string): Promise<string>;
  isStuck(): boolean;
  close(): Promise<void>;
}

// ============================================================================
// Reinforcement Learning
// ============================================================================

export interface RLAgentConfig {
  algorithm: 'qlearning' | 'policy' | 'hybrid';
  platform: 'web' | 'android' | 'ios';
  enableDatabase?: boolean;
  databasePath?: string;
  learningRate?: number;
  discountFactor?: number;
  epsilon?: number;
  epsilonDecay?: number;
  epsilonMin?: number;
}

export interface State {
  id: string;
  features: Record<string, any>;
  url?: string;
  timestamp: number;
}

export interface Action {
  type: string;
  selector?: string;
  value?: string;
  params?: Record<string, any>;
}

export interface Experience {
  state: State;
  action: Action;
  reward: number;
  nextState: State;
  done: boolean;
  timestamp: number;
}

export declare class ReinforcementAgent {
  constructor(config: RLAgentConfig);
  
  initialize(): Promise<void>;
  chooseAction(state: State, validActions?: Action[]): Action;
  learn(state: State, action: Action, reward: number, nextState: State, done: boolean): Promise<void>;
  calculateReward(outcome: { success: boolean; duration: number; error?: string }): number;
  getBestAction(state: State): Action | null;
  getQValue(state: State, action: Action): number;
  getPolicy(state: State): Record<string, number>;
  getStats(): {
    totalEpisodes: number;
    totalSteps: number;
    totalReward: number;
    averageReward: number;
    epsilon: number;
  };
  export(): Record<string, any>;
  import(data: Record<string, any>): void;
  close(): Promise<void>;
}

// ============================================================================
// Browserbase Cloud
// ============================================================================

export interface BrowserbaseConfig {
  projectId: string;
  stealth?: boolean;
  region?: string;
  proxy?: {
    type: 'browserbase' | 'custom';
    host?: string;
    port?: number;
    username?: string;
    password?: string;
  };
}

export interface BrowserbaseSession {
  sessionId: string;
  connectUrl: string;
  createdAt: number;
  expiresAt: number;
}

export declare class BrowserbaseProvider {
  constructor(apiKey: string, config: BrowserbaseConfig);
  
  init(): Promise<void>;
  connectPuppeteer(puppeteer: any): Promise<{ browser: any; page: any }>;
  connectPlaywright(playwright: any): Promise<{ browser: any; page: any }>;
  getSessionRecording(): Promise<string | null>;
  getSessionLogs(): Promise<any[]>;
  close(): Promise<void>;
}

export interface SessionManagerConfig {
  maxSessions?: number;
  enablePooling?: boolean;
  sessionTimeout?: number;
}

export declare class BrowserbaseSessionManager {
  constructor(config: SessionManagerConfig);
  
  init(): Promise<void>;
  acquireSession(options?: BrowserbaseConfig): Promise<BrowserbaseProvider>;
  releaseSession(provider: BrowserbaseProvider): Promise<void>;
  getActiveSessionCount(): number;
  closeAllSessions(): Promise<void>;
}

// ============================================================================
// Tools
// ============================================================================

export interface ToolSchema {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface Tool {
  name: string;
  handler: Function;
  schema: ToolSchema;
}

export declare class ToolRegistry {
  constructor();
  
  registerTool(name: string, handler: Function, schema?: ToolSchema): void;
  unregisterTool(name: string): void;
  executeTool(name: string, params: Record<string, any>): Promise<any>;
  getToolSchema(name: string): ToolSchema | null;
  listTools(): string[];
  getToolStats(name: string): {
    executions: number;
    successes: number;
    failures: number;
    averageExecutionTime: number;
  };
}

// ============================================================================
// Testing
// ============================================================================

export interface AccessibilityViolation {
  rule: string;
  impact: 'minor' | 'moderate' | 'serious' | 'critical';
  element?: string;
  message: string;
  help?: string;
  helpUrl?: string;
}

export interface AccessibilityReport {
  url: string;
  violations: AccessibilityViolation[];
  passes: number;
  incomplete: number;
  score: number;
  wcagLevel: 'A' | 'AA' | 'AAA';
  summary: string;
}

export declare class AccessibilityTester {
  constructor(config?: { standards?: string[]; wcagLevel?: 'A' | 'AA' | 'AAA' });
  
  test(page: any): Promise<AccessibilityReport>;
  testElement(element: any, context?: string): Promise<Partial<AccessibilityReport>>;
  calculateScore(violations: AccessibilityViolation[]): number;
  generateReport(results: any[]): AccessibilityReport;
}

export interface SecurityVulnerability {
  type: 'xss' | 'sqli' | 'csrf' | 'info';
  severity: 'low' | 'medium' | 'high' | 'critical';
  url: string;
  evidence: string;
  remediation: string;
}

export declare class SecurityTester {
  constructor(config?: { tests?: string[]; maxDepth?: number });
  
  test(page: any): Promise<SecurityVulnerability[]>;
  testXSS(page: any): Promise<SecurityVulnerability[]>;
  testSQLInjection(page: any): Promise<SecurityVulnerability[]>;
  testCSRF(page: any): Promise<SecurityVulnerability[]>;
}

// ============================================================================
// Vision
// ============================================================================

export interface ElementDetection {
  type: string;
  text?: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
  attributes?: Record<string, any>;
}

export interface VisionAnalysis {
  layout: {
    type: string;
    regions: Array<{
      type: string;
      bounds: { x: number; y: number; width: number; height: number };
    }>;
  };
  elements: ElementDetection[];
  text: string[];
  confidence: number;
}

export declare class ComputerVision {
  constructor(config?: { confidenceThreshold?: number; enableOCR?: boolean });
  
  analyze(image: Buffer | string): Promise<VisionAnalysis>;
  detectElements(image: Buffer | string, types?: string[]): Promise<ElementDetection[]>;
  extractText(image: Buffer | string): Promise<string[]>;
  detectLayout(image: Buffer | string): Promise<VisionAnalysis['layout']>;
}

// ============================================================================
// API Server
// ============================================================================

export interface ServerConfig {
  port?: number;
  host?: string;
  enableCORS?: boolean;
  enableAuth?: boolean;
  apiKey?: string;
  enableWebSocket?: boolean;
  maxConcurrentSessions?: number;
}

export declare class RestAPIServer {
  constructor(config?: ServerConfig);
  
  start(): Promise<void>;
  stop(): Promise<void>;
  getHealth(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    uptime: number;
    memory: { used: number; total: number };
    activeSessions: number;
  };
}

export declare class WebSocketServer {
  constructor(config?: ServerConfig);
  
  start(): Promise<void>;
  stop(): Promise<void>;
  broadcast(event: string, data: any): void;
  sendToClient(clientId: string, event: string, data: any): void;
}

// ============================================================================
// Enterprise
// ============================================================================

export interface LoadBalancerConfig {
  strategy?: 'round-robin' | 'least-connections' | 'ip-hash' | 'weighted';
  healthCheck?: {
    enabled?: boolean;
    interval?: number;
    timeout?: number;
    path?: string;
  };
  circuitBreaker?: {
    enabled?: boolean;
    failureThreshold?: number;
    resetTimeout?: number;
    halfOpenRequests?: number;
  };
}

export declare class LoadBalancer {
  constructor(config?: LoadBalancerConfig);
  
  addWorker(workerId: string, config: { host: string; port: number; weight?: number }): void;
  removeWorker(workerId: string): void;
  getNextWorker(): { workerId: string; config: any } | null;
  recordSuccess(workerId: string): void;
  recordFailure(workerId: string): void;
  getStats(): {
    totalRequests: number;
    activeWorkers: number;
    averageResponseTime: number;
    errorRate: number;
  };
}

// ============================================================================
// Exports
// ============================================================================

export { BrowserAgentCore } from './core/BrowserAgentCore';
export { TaskOrchestrator } from './taskOrchestrator';

// Mobile exports
export * as mobile from './mobile/index';

// Learning exports
export * as learning from './learning/index';

// Enterprise exports
export * as enterprise from './enterprise/index';

// Testing exports
export * as testing from './testing/index';

// Vision exports
export * as vision from './vision/index';

// Tools exports
export * as tools from './tools/index';
