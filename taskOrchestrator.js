/**
 * ============================================================================
 * TASK ORCHESTRATOR - Parallel Analysis Coordination
 * ============================================================================
 * 
 * Orchestrates parallel DOM and vision analysis tasks using worker threads
 * and job queues. Manages task lifecycle, priority scheduling, error handling,
 * and result aggregation for multiple concurrent analysis operations.
 * 
 * INTEGRATES WITH:
 * - ScreenshotSegmenter - Visual region analysis
 * - UIElementClassifier - Element type classification
 * - VisualDomMapper - Visual-to-DOM mapping
 * - ResultReconciliator - Multi-source result merging
 * 
 * FEATURES:
 * - Worker thread pool management
 * - Parallel task execution with priority scheduling
 * - Visual analysis integration (Phase 2)
 * - Task cancellation and timeout handling
 * - Error recovery and retry mechanisms
 * - Result aggregation and reconciliation
 * - Performance monitoring and statistics
 * 
 * USAGE:
 * const orchestrator = new TaskOrchestrator({ maxWorkers: 4 });
 * const result = await orchestrator.executeParallelAnalysis({
 *   dom: domData,
 *   screenshot: imageData,
 *   goal: userGoal
 * });
 * 
 * ============================================================================
 */

const { Worker } = require('worker_threads');
const EventEmitter = require('events');
const crypto = require('crypto');
const path = require('path');
const { JobQueue, Priority } = require('./jobQueue');
const { ResultReconciliator, AnalysisSource } = require('./resultReconciliator');
const { ScreenshotSegmenter } = require('./screenshotSegmenter');
const { UIElementClassifier } = require('./uiElementClassifier');
const { VisualDomMapper } = require('./visualDomMapper');

/**
 * Task types
 * @enum {string}
 */
const TaskType = {
    DOM_ANALYSIS: 'dom_analysis',
    VISION_ANALYSIS: 'vision_analysis',
    VISUAL_SEGMENTATION: 'visual_segmentation',
    ELEMENT_CLASSIFICATION: 'element_classification',
    VISUAL_MAPPING: 'visual_mapping',
    PATTERN_MATCHING: 'pattern_matching',
    LEARNING_INFERENCE: 'learning_inference',
    COMBINED_ANALYSIS: 'combined_analysis'
};

/**
 * Task status
 * @enum {string}
 */
const TaskStatus = {
    PENDING: 'pending',
    RUNNING: 'running',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'cancelled',
    TIMEOUT: 'timeout'
};

/**
 * Worker pool for managing worker threads
 * @class
 * @private
 */
class WorkerPool {
    /**
     * Create a worker pool
     * @param {number} maxWorkers - Maximum number of workers
     * @param {string} workerScript - Path to worker script
     */
    constructor(maxWorkers, workerScript) {
        this.maxWorkers = maxWorkers;
        this.workerScript = workerScript;
        this.workers = [];
        this.availableWorkers = [];
        this.busyWorkers = new Set();
        
        console.log(`[WorkerPool] Initializing pool with ${maxWorkers} workers`);
    }
    
    /**
     * Initialize worker pool
     */
    initialize() {
        for (let i = 0; i < this.maxWorkers; i++) {
            const worker = this.createWorker();
            this.workers.push(worker);
            this.availableWorkers.push(worker);
        }
        
        console.log(`[WorkerPool] Pool initialized with ${this.workers.length} workers`);
    }
    
    /**
     * Create a new worker
     * @private
     * @returns {Worker} Worker instance
     */
    createWorker() {
        const worker = {
            id: crypto.randomUUID(),
            isAvailable: true,
            currentTask: null
        };
        
        return worker;
    }
    
    /**
     * Get an available worker
     * @returns {Object|null} Available worker or null
     */
    getAvailableWorker() {
        if (this.availableWorkers.length === 0) {
            return null;
        }
        
        const worker = this.availableWorkers.shift();
        this.busyWorkers.add(worker.id);
        worker.isAvailable = false;
        
        return worker;
    }
    
    /**
     * Release a worker back to the pool
     * @param {Object} worker - Worker to release
     */
    releaseWorker(worker) {
        worker.isAvailable = true;
        worker.currentTask = null;
        this.busyWorkers.delete(worker.id);
        this.availableWorkers.push(worker);
    }
    
    /**
     * Get pool statistics
     * @returns {Object} Pool stats
     */
    getStats() {
        return {
            totalWorkers: this.workers.length,
            availableWorkers: this.availableWorkers.length,
            busyWorkers: this.busyWorkers.size
        };
    }
    
    /**
     * Terminate all workers
     */
    terminate() {
        console.log('[WorkerPool] Terminating all workers');
        
        for (const worker of this.workers) {
            if (worker.terminate) {
                worker.terminate();
            }
        }
        
        this.workers = [];
        this.availableWorkers = [];
        this.busyWorkers.clear();
    }
}

/**
 * Task Orchestrator for parallel analysis coordination
 * @class
 * @extends EventEmitter
 */
class TaskOrchestrator extends EventEmitter {
    /**
     * Create a new TaskOrchestrator instance
     * @param {Object} options - Configuration options
     * @param {number} [options.maxWorkers=4] - Maximum worker threads
     * @param {number} [options.maxConcurrent=3] - Maximum concurrent tasks
     * @param {number} [options.taskTimeout=30000] - Task timeout in milliseconds
     * @param {boolean} [options.enableWorkers=false] - Enable worker threads (experimental)
     * @param {boolean} [options.enableVisualAnalysis=true] - Enable Phase 2 visual analysis
     * @param {Object} [options.reconciliatorOptions] - Options for result reconciliator
     */
    constructor(options = {}) {
        super();
        
        this.maxWorkers = options.maxWorkers || 4;
        this.maxConcurrent = options.maxConcurrent || 3;
        this.taskTimeout = options.taskTimeout || 30000;
        this.enableWorkers = options.enableWorkers || false;
        this.enableVisualAnalysis = options.enableVisualAnalysis !== undefined ? options.enableVisualAnalysis : true;
        
        // Initialize job queue
        this.jobQueue = new JobQueue({
            maxConcurrent: this.maxConcurrent,
            maxRetries: 2,
            retryDelay: 1000
        });
        
        // Initialize result reconciliator
        this.reconciliator = new ResultReconciliator(options.reconciliatorOptions || {});
        
        // Initialize Phase 2 visual analysis components
        if (this.enableVisualAnalysis) {
            this.screenshotSegmenter = new ScreenshotSegmenter();
            this.uiElementClassifier = new UIElementClassifier();
            this.visualDomMapper = new VisualDomMapper();
            console.log('[TaskOrchestrator] Visual analysis components enabled');
        }
        
        // Initialize worker pool if enabled
        this.workerPool = null;
        if (this.enableWorkers) {
            this.workerPool = new WorkerPool(this.maxWorkers, './analysisWorker.js');
            this.workerPool.initialize();
        }
        
        // Task tracking
        this.tasks = new Map();
        this.activeAnalyses = new Map();
        
        // Statistics
        this.stats = {
            totalTasks: 0,
            completedTasks: 0,
            failedTasks: 0,
            cancelledTasks: 0,
            averageExecutionTime: 0,
            totalExecutionTime: 0
        };
        
        // Set up event listeners
        this.setupEventListeners();
        
        console.log('[TaskOrchestrator] Initialized');
    }
    
    /**
     * Set up event listeners for job queue
     * @private
     */
    setupEventListeners() {
        this.jobQueue.on('job:completed', ({ jobId, result, duration }) => {
            this.emit('task:completed', { taskId: jobId, result, duration });
        });
        
        this.jobQueue.on('job:failed', ({ jobId, error }) => {
            this.emit('task:failed', { taskId: jobId, error });
        });
        
        this.jobQueue.on('job:cancelled', ({ jobId }) => {
            this.emit('task:cancelled', { taskId: jobId });
        });
    }
    
    /**
     * Execute parallel analysis of DOM and vision data
     * @param {Object} analysisData - Data for analysis
     * @param {string} analysisData.dom - Simplified DOM string
     * @param {string} analysisData.screenshot - Base64 screenshot
     * @param {string} analysisData.goal - User goal
     * @param {Object} analysisData.context - Additional context
     * @param {Object} [analysisData.viewport] - Viewport metadata
     * @param {Array} [analysisData.domNodes] - DOM nodes with position data
     * @param {Object} options - Analysis options
     * @param {Array<string>} [options.analysisTypes] - Types of analysis to run
     * @param {string} [options.priority] - Task priority
     * @param {boolean} [options.useVisualAnalysis] - Use Phase 2 visual analysis
     * @returns {Promise<Object>} Reconciled analysis result
     */
    async executeParallelAnalysis(analysisData, options = {}) {
        const analysisId = crypto.randomUUID();
        const startTime = Date.now();
        
        console.log(`[TaskOrchestrator] Starting parallel analysis ${analysisId}`);
        
        // Default analysis types
        let analysisTypes = options.analysisTypes || [
            TaskType.DOM_ANALYSIS,
            TaskType.VISION_ANALYSIS
        ];
        
        // Add Phase 2 visual analysis tasks if enabled
        const useVisual = options.useVisualAnalysis !== undefined 
            ? options.useVisualAnalysis 
            : this.enableVisualAnalysis;
        
        if (useVisual && analysisData.screenshot && analysisData.viewport) {
            analysisTypes = [
                TaskType.VISUAL_SEGMENTATION,
                TaskType.ELEMENT_CLASSIFICATION,
                ...analysisTypes
            ];
            
            // Add visual mapping if DOM nodes are available
            if (analysisData.domNodes && analysisData.domNodes.length > 0) {
                analysisTypes.push(TaskType.VISUAL_MAPPING);
            }
        }
        
        const priority = options.priority || Priority.MEDIUM;
        
        // Create analysis tasks
        const taskPromises = [];
        const taskIds = [];
        
        for (const analysisType of analysisTypes) {
            const taskId = await this.createAnalysisTask(
                analysisType,
                analysisData,
                { priority, timeout: this.taskTimeout }
            );
            
            taskIds.push(taskId);
            taskPromises.push(this.jobQueue.waitForJob(taskId));
        }
        
        // Store active analysis
        this.activeAnalyses.set(analysisId, {
            id: analysisId,
            taskIds: taskIds,
            taskTypes: analysisTypes,
            startTime: startTime,
            status: 'running'
        });
        
        try {
            // Wait for all tasks to complete
            const results = await Promise.allSettled(taskPromises);
            
            // Extract successful results
            const successfulResults = [];
            const failedTasks = [];
            
            results.forEach((result, index) => {
                if (result.status === 'fulfilled' && result.value) {
                    successfulResults.push(result.value);
                } else {
                    failedTasks.push({
                        taskId: taskIds[index],
                        taskType: analysisTypes[index],
                        reason: result.reason?.message || 'Unknown error'
                    });
                }
            });
            
            if (failedTasks.length > 0) {
                console.warn(`[TaskOrchestrator] ${failedTasks.length}/${analysisTypes.length} tasks failed`);
            }
            
            // Reconcile results
            let reconciledResult;
            
            if (successfulResults.length === 0) {
                throw new Error('All analysis tasks failed');
            } else if (successfulResults.length === 1) {
                reconciledResult = successfulResults[0];
                reconciledResult.confidence = reconciledResult.confidence || 0.7;
                reconciledResult.sources = [successfulResults[0].source || 'unknown'];
            } else {
                reconciledResult = await this.reconciliator.reconcile(
                    successfulResults,
                    { context: analysisData.context }
                );
            }
            
            // Update statistics
            const duration = Date.now() - startTime;
            this.updateStats(duration, true);
            
            // Update active analysis
            const analysis = this.activeAnalyses.get(analysisId);
            if (analysis) {
                analysis.status = 'completed';
                analysis.duration = duration;
                analysis.result = reconciledResult;
                analysis.tasksCompleted = successfulResults.length;
                analysis.tasksFailed = failedTasks.length;
            }
            
            console.log(`[TaskOrchestrator] Parallel analysis ${analysisId} completed in ${duration}ms (${successfulResults.length}/${analysisTypes.length} tasks succeeded)`);
            this.emit('analysis:completed', { analysisId, result: reconciledResult, duration });
            
            return reconciledResult;
            
        } catch (error) {
            console.error(`[TaskOrchestrator] Parallel analysis ${analysisId} failed:`, error.message);
            
            const duration = Date.now() - startTime;
            this.updateStats(duration, false);
            
            const analysis = this.activeAnalyses.get(analysisId);
            if (analysis) {
                analysis.status = 'failed';
                analysis.duration = duration;
                analysis.error = error.message;
            }
            
            this.emit('analysis:failed', { analysisId, error });
            
            throw error;
        }
    }
    
    /**
     * Create an analysis task
     * @private
     * @param {string} taskType - Type of analysis task
     * @param {Object} data - Analysis data
     * @param {Object} options - Task options
     * @returns {Promise<string>} Task ID
     */
    async createAnalysisTask(taskType, data, options = {}) {
        this.stats.totalTasks++;
        
        // Create task function based on type
        const taskFn = this.createTaskFunction(taskType, data);
        
        // Add task to job queue
        const taskId = this.jobQueue.addJob(
            taskFn,
            [],
            {
                priority: options.priority || Priority.MEDIUM,
                timeout: options.timeout || this.taskTimeout,
                metadata: {
                    taskType: taskType,
                    createdAt: Date.now()
                }
            }
        );
        
        // Track task
        this.tasks.set(taskId, {
            id: taskId,
            type: taskType,
            status: TaskStatus.PENDING,
            createdAt: Date.now()
        });
        
        console.log(`[TaskOrchestrator] Created ${taskType} task ${taskId}`);
        
        return taskId;
    }
    
    /**
     * Create task function for specific analysis type
     * @private
     * @param {string} taskType - Task type
     * @param {Object} data - Analysis data
     * @returns {Function} Async task function
     */
    createTaskFunction(taskType, data) {
        switch (taskType) {
            case TaskType.DOM_ANALYSIS:
                return async () => this.executeDomAnalysis(data);
                
            case TaskType.VISION_ANALYSIS:
                return async () => this.executeVisionAnalysis(data);
                
            case TaskType.VISUAL_SEGMENTATION:
                return async () => this.executeVisualSegmentation(data);
                
            case TaskType.ELEMENT_CLASSIFICATION:
                return async () => this.executeElementClassification(data);
                
            case TaskType.VISUAL_MAPPING:
                return async () => this.executeVisualMapping(data);
                
            case TaskType.PATTERN_MATCHING:
                return async () => this.executePatternMatching(data);
                
            case TaskType.LEARNING_INFERENCE:
                return async () => this.executeLearningInference(data);
                
            default:
                throw new Error(`Unknown task type: ${taskType}`);
        }
    }
    
    /**
     * Execute DOM analysis
     * @private
     * @param {Object} data - Analysis data
     * @returns {Promise<Object>} Analysis result
     */
    async executeDomAnalysis(data) {
        console.log('[TaskOrchestrator] Executing DOM analysis');
        
        await this.simulateWork(500);
        
        const elementCount = (data.dom.match(/data-agent-id/g) || []).length;
        const hasPopups = data.dom.includes('[IN-POPUP]') || data.dom.includes('[COOKIE-BANNER]');
        const hasDecoys = data.dom.includes('[DECOY]');
        
        let action = 'wait';
        let confidence = 0.6;
        let selector = null;
        let reason = 'DOM analysis';
        
        if (hasPopups) {
            const popupMatch = data.dom.match(/<button[^>]*id="(\d+)"[^>]*>\[COOKIE-BANNER\]Accept/i);
            if (popupMatch) {
                action = 'click';
                selector = `[data-agent-id='${popupMatch[1]}']`;
                reason = 'Close cookie banner';
                confidence = 0.9;
            }
        }
        
        return {
            source: AnalysisSource.DOM,
            action: action,
            selector: selector,
            confidence: confidence,
            reason: reason,
            metadata: {
                elementCount: elementCount,
                hasPopups: hasPopups,
                hasDecoys: hasDecoys
            }
        };
    }
    
    /**
     * Execute vision analysis
     * @private
     * @param {Object} data - Analysis data
     * @returns {Promise<Object>} Analysis result
     */
    async executeVisionAnalysis(data) {
        console.log('[TaskOrchestrator] Executing vision analysis');
        
        await this.simulateWork(800);
        
        return {
            source: AnalysisSource.VISION,
            action: 'scroll',
            confidence: 0.7,
            reason: 'Vision analysis suggests scrolling',
            metadata: {
                hasScreenshot: !!data.screenshot
            }
        };
    }
    
    /**
     * Execute visual segmentation (Phase 2)
     * @private
     * @param {Object} data - Analysis data
     * @returns {Promise<Object>} Segmentation result
     */
    async executeVisualSegmentation(data) {
        if (!this.screenshotSegmenter || !data.screenshot || !data.viewport) {
            throw new Error('Visual segmentation requires screenshot and viewport data');
        }
        
        console.log('[TaskOrchestrator] Executing visual segmentation');
        
        const segmentation = await this.screenshotSegmenter.analyzeScreenshot(
            data.screenshot,
            {
                width: data.viewport.width,
                height: data.viewport.height,
                scrollY: data.viewport.scrollY || 0,
                scrollX: data.viewport.scrollX || 0
            }
        );
        
        // Convert segmentation to action recommendation
        const action = this.segmentationToAction(segmentation, data.goal);
        
        return {
            source: AnalysisSource.VISION,
            action: action.action,
            selector: action.selector,
            confidence: action.confidence,
            reason: action.reason,
            metadata: {
                segmentation: segmentation,
                regions: segmentation.regions.length,
                functionalAreas: segmentation.functionalAreas.length
            }
        };
    }
    
    /**
     * Convert segmentation results to action recommendation
     * @private
     * @param {Object} segmentation - Segmentation results
     * @param {string} goal - User goal
     * @returns {Object} Action recommendation
     */
    segmentationToAction(segmentation, goal) {
        const goalLower = goal.toLowerCase();
        
        // Check for modal/popup regions
        const hasModal = segmentation.regions.some(r => r.type === 'modal' || r.type === 'popup');
        if (hasModal) {
            return {
                action: 'click',
                selector: null,
                confidence: 0.8,
                reason: 'Modal detected, should close before proceeding'
            };
        }
        
        // Check for form areas if goal involves form submission
        if (goalLower.includes('form') || goalLower.includes('submit') || goalLower.includes('fill')) {
            const hasForm = segmentation.functionalAreas.some(a => a.type === 'form');
            if (hasForm) {
                return {
                    action: 'type',
                    selector: null,
                    confidence: 0.75,
                    reason: 'Form area detected in content region'
                };
            }
        }
        
        // Default to scrolling if content is extensive
        return {
            action: 'scroll',
            selector: null,
            confidence: 0.6,
            reason: 'Continue exploring page content'
        };
    }
    
    /**
     * Execute element classification (Phase 2)
     * @private
     * @param {Object} data - Analysis data
     * @returns {Promise<Object>} Classification result
     */
    async executeElementClassification(data) {
        if (!this.uiElementClassifier) {
            throw new Error('Element classification requires UIElementClassifier');
        }
        
        console.log('[TaskOrchestrator] Executing element classification');
        
        // Parse DOM to extract elements for classification
        const elements = this.extractElementsFromDom(data.dom);
        
        // Classify elements in batch
        const classifications = this.uiElementClassifier.classifyBatch(elements);
        
        // Find best interactive element
        const interactive = classifications.filter(c => 
            c.interaction === 'clickable' || c.interaction === 'editable'
        ).sort((a, b) => b.confidence - a.confidence);
        
        if (interactive.length > 0) {
            const best = interactive[0];
            const element = elements[classifications.indexOf(best)];
            
            return {
                source: AnalysisSource.HEURISTIC,
                action: best.interaction === 'editable' ? 'type' : 'click',
                selector: element.selector,
                confidence: best.confidence,
                reason: `Classified as ${best.type} with ${best.interaction} interaction`,
                metadata: {
                    classification: best,
                    totalElements: elements.length,
                    interactiveCount: interactive.length
                }
            };
        }
        
        return {
            source: AnalysisSource.HEURISTIC,
            action: 'wait',
            confidence: 0.5,
            reason: 'No clear interactive elements classified',
            metadata: {
                totalElements: elements.length
            }
        };
    }
    
    /**
     * Extract elements from DOM string for classification
     * @private
     * @param {string} dom - DOM string
     * @returns {Array} Element data
     */
    extractElementsFromDom(dom) {
        const elements = [];
        const elementRegex = /<(\w+)([^>]*)id="(\d+)"[^>]*>([^<]*)<\/\w+>/gi;
        let match;
        
        while ((match = elementRegex.exec(dom)) !== null) {
            const tag = match[1];
            const attrs = match[2];
            const id = match[3];
            const text = match[4].replace(/\[.*?\]/g, '').trim();
            
            const element = {
                tag: tag.toLowerCase(),
                selector: `[data-agent-id='${id}']`,
                text: text,
                className: this.extractAttribute(attrs, 'class'),
                type: this.extractAttribute(attrs, 'type'),
                role: this.extractAttribute(attrs, 'role')
            };
            
            elements.push(element);
        }
        
        return elements;
    }
    
    /**
     * Extract attribute value from attribute string
     * @private
     * @param {string} attrs - Attribute string
     * @param {string} name - Attribute name
     * @returns {string|null} Attribute value
     */
    extractAttribute(attrs, name) {
        const regex = new RegExp(`${name}=["']([^"']+)["']`, 'i');
        const match = attrs.match(regex);
        return match ? match[1] : null;
    }
    
    /**
     * Execute visual mapping (Phase 2)
     * @private
     * @param {Object} data - Analysis data
     * @returns {Promise<Object>} Mapping result
     */
    async executeVisualMapping(data) {
        if (!this.visualDomMapper || !data.domNodes) {
            throw new Error('Visual mapping requires VisualDomMapper and DOM nodes');
        }
        
        console.log('[TaskOrchestrator] Executing visual-DOM mapping');
        
        // Extract visual elements from segmentation if available
        const visualElements = data.visualElements || [];
        
        const mapping = await this.visualDomMapper.mapVisualToDom({
            visualElements: visualElements,
            domNodes: data.domNodes,
            viewport: data.viewport
        });
        
        // Use mapping to enhance action selection
        const bestMapping = mapping.mappings[0];
        
        if (bestMapping && bestMapping.confidence !== 'uncertain') {
            return {
                source: AnalysisSource.VISION,
                action: 'click',
                selector: bestMapping.domNode.selector,
                confidence: this.mapConfidenceToScore(bestMapping.confidence),
                reason: 'Visual-DOM mapping identified target element',
                metadata: {
                    mapping: mapping,
                    mappingConfidence: bestMapping.confidence
                }
            };
        }
        
        return {
            source: AnalysisSource.VISION,
            action: 'wait',
            confidence: 0.4,
            reason: 'No confident visual-DOM mapping found',
            metadata: {
                mapping: mapping
            }
        };
    }
    
    /**
     * Map confidence level to numeric score
     * @private
     * @param {string} confidence - Confidence level
     * @returns {number} Numeric score
     */
    mapConfidenceToScore(confidence) {
        const scores = {
            'exact': 0.95,
            'high': 0.85,
            'medium': 0.7,
            'low': 0.5,
            'uncertain': 0.3
        };
        
        return scores[confidence] || 0.5;
    }
    
    /**
     * Execute pattern matching
     * @private
     * @param {Object} data - Analysis data
     * @returns {Promise<Object>} Analysis result
     */
    async executePatternMatching(data) {
        console.log('[TaskOrchestrator] Executing pattern matching');
        
        await this.simulateWork(500);
        
        return {
            source: AnalysisSource.PATTERN,
            action: 'click',
            confidence: 0.75,
            reason: 'Pattern matching result',
            metadata: {}
        };
    }
    
    /**
     * Execute learning inference
     * @private
     * @param {Object} data - Analysis data
     * @returns {Promise<Object>} Analysis result
     */
    async executeLearningInference(data) {
        console.log('[TaskOrchestrator] Executing learning inference');
        
        await this.simulateWork(800);
        
        return {
            source: AnalysisSource.LEARNING,
            action: 'type',
            confidence: 0.65,
            reason: 'Learning-based inference',
            metadata: {}
        };
    }
    
    /**
     * Simulate work for testing
     * @private
     * @param {number} duration - Duration in milliseconds
     * @returns {Promise<void>}
     */
    async simulateWork(duration) {
        return new Promise(resolve => setTimeout(resolve, duration));
    }
    
    /**
     * Cancel an active analysis
     * @param {string} analysisId - Analysis ID to cancel
     * @returns {boolean} True if cancelled successfully
     */
    cancelAnalysis(analysisId) {
        const analysis = this.activeAnalyses.get(analysisId);
        
        if (!analysis) {
            console.warn(`[TaskOrchestrator] Analysis ${analysisId} not found`);
            return false;
        }
        
        if (analysis.status !== 'running') {
            console.warn(`[TaskOrchestrator] Analysis ${analysisId} is not running`);
            return false;
        }
        
        console.log(`[TaskOrchestrator] Cancelling analysis ${analysisId}`);
        
        // Cancel all associated tasks
        let cancelledCount = 0;
        for (const taskId of analysis.taskIds) {
            if (this.jobQueue.cancelJob(taskId)) {
                cancelledCount++;
            }
        }
        
        analysis.status = 'cancelled';
        this.stats.cancelledTasks += cancelledCount;
        
        this.emit('analysis:cancelled', { analysisId, cancelledTasks: cancelledCount });
        
        return true;
    }
    
    /**
     * Cancel a specific task
     * @param {string} taskId - Task ID to cancel
     * @returns {boolean} True if cancelled successfully
     */
    cancelTask(taskId) {
        const task = this.tasks.get(taskId);
        
        if (!task) {
            console.warn(`[TaskOrchestrator] Task ${taskId} not found`);
            return false;
        }
        
        const result = this.jobQueue.cancelJob(taskId);
        
        if (result) {
            task.status = TaskStatus.CANCELLED;
            this.stats.cancelledTasks++;
        }
        
        return result;
    }
    
    /**
     * Get task status
     * @param {string} taskId - Task ID
     * @returns {Object|null} Task status
     */
    getTaskStatus(taskId) {
        const jobStatus = this.jobQueue.getJobStatus(taskId);
        const task = this.tasks.get(taskId);
        
        if (!jobStatus || !task) {
            return null;
        }
        
        return {
            ...jobStatus,
            type: task.type
        };
    }
    
    /**
     * Get analysis status
     * @param {string} analysisId - Analysis ID
     * @returns {Object|null} Analysis status
     */
    getAnalysisStatus(analysisId) {
        const analysis = this.activeAnalyses.get(analysisId);
        
        if (!analysis) {
            return null;
        }
        
        const taskStatuses = analysis.taskIds.map(taskId => this.getTaskStatus(taskId));
        
        return {
            ...analysis,
            tasks: taskStatuses
        };
    }
    
    /**
     * Update statistics
     * @private
     * @param {number} duration - Task duration
     * @param {boolean} success - Whether task succeeded
     */
    updateStats(duration, success) {
        if (success) {
            this.stats.completedTasks++;
        } else {
            this.stats.failedTasks++;
        }
        
        this.stats.totalExecutionTime += duration;
        this.stats.averageExecutionTime = 
            this.stats.totalExecutionTime / (this.stats.completedTasks + this.stats.failedTasks);
    }
    
    /**
     * Get orchestrator statistics
     * @returns {Object} Statistics
     */
    getStats() {
        const queueStats = this.jobQueue.getStats();
        const reconciliatorStats = this.reconciliator.getStats();
        const workerStats = this.workerPool ? this.workerPool.getStats() : null;
        
        // Get Phase 2 component stats if enabled
        const visualStats = this.enableVisualAnalysis ? {
            segmenter: this.screenshotSegmenter ? this.screenshotSegmenter.getStats() : null,
            classifier: this.uiElementClassifier ? this.uiElementClassifier.getStats() : null,
            mapper: this.visualDomMapper ? this.visualDomMapper.getStats() : null
        } : null;
        
        return {
            orchestrator: {
                ...this.stats,
                activeAnalyses: this.activeAnalyses.size,
                activeTasks: this.tasks.size,
                visualAnalysisEnabled: this.enableVisualAnalysis
            },
            queue: queueStats,
            reconciliator: reconciliatorStats,
            workers: workerStats,
            visual: visualStats
        };
    }
    
    /**
     * Cleanup old completed analyses and tasks
     * @param {number} maxAge - Maximum age in milliseconds
     * @returns {number} Number of items cleaned up
     */
    cleanup(maxAge = 3600000) {
        const now = Date.now();
        let count = 0;
        
        // Cleanup old analyses
        for (const [analysisId, analysis] of this.activeAnalyses.entries()) {
            if (analysis.status !== 'running' && 
                analysis.startTime && 
                (now - analysis.startTime) > maxAge) {
                this.activeAnalyses.delete(analysisId);
                count++;
            }
        }
        
        // Cleanup old tasks
        for (const [taskId, task] of this.tasks.entries()) {
            if (task.createdAt && (now - task.createdAt) > maxAge) {
                this.tasks.delete(taskId);
                count++;
            }
        }
        
        // Cleanup job queue
        count += this.jobQueue.cleanup(maxAge);
        
        // Cleanup Phase 2 components
        if (this.enableVisualAnalysis) {
            if (this.screenshotSegmenter) {
                this.screenshotSegmenter.clearCache();
            }
            if (this.visualDomMapper) {
                this.visualDomMapper.clearCache();
            }
        }
        
        if (count > 0) {
            console.log(`[TaskOrchestrator] Cleaned up ${count} old items`);\n        }
        
        return count;
    }
    
    /**
     * Destroy orchestrator and cleanup resources
     */
    destroy() {
        console.log('[TaskOrchestrator] Destroying orchestrator');
        
        // Cancel all active analyses
        for (const analysisId of this.activeAnalyses.keys()) {
            this.cancelAnalysis(analysisId);
        }
        
        // Destroy job queue
        this.jobQueue.destroy();
        
        // Terminate worker pool
        if (this.workerPool) {
            this.workerPool.terminate();
        }
        
        // Clear data structures
        this.tasks.clear();
        this.activeAnalyses.clear();
        
        // Remove listeners
        this.removeAllListeners();
        
        console.log('[TaskOrchestrator] Destroyed');
    }
}

module.exports = { 
    TaskOrchestrator, 
    TaskType, 
    TaskStatus 
};
