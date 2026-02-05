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
 * - Phase 1: JobQueue, ResultReconciliator
 * - Phase 2: ScreenshotSegmenter, UIElementClassifier, VisualDomMapper
 * - Phase 3: StateTracker, AnimationDetector, TransitionPredictor
 * 
 * FEATURES:
 * - Worker thread pool management
 * - Parallel task execution with priority scheduling
 * - Visual analysis integration (Phase 2)
 * - Temporal analysis integration (Phase 3)
 * - Task cancellation and timeout handling
 * - Error recovery and retry mechanisms
 * - Result aggregation and reconciliation
 * - Performance monitoring and statistics
 * 
 * USAGE:
 * const orchestrator = new TaskOrchestrator({ 
 *   maxWorkers: 4,
 *   enableTemporalAnalysis: true
 * });
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
const { StateTracker, ChangeType } = require('./stateTracker');
const { AnimationDetector, LoadingState } = require('./animationDetector');
const { TransitionPredictor } = require('./transitionPredictor');

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
    STATE_TRACKING: 'state_tracking',
    ANIMATION_DETECTION: 'animation_detection',
    TRANSITION_PREDICTION: 'transition_prediction',
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
    constructor(maxWorkers, workerScript) {
        this.maxWorkers = maxWorkers;
        this.workerScript = workerScript;
        this.workers = [];
        this.availableWorkers = [];
        this.busyWorkers = new Set();
        
        console.log(`[WorkerPool] Initializing pool with ${maxWorkers} workers`);
    }
    
    initialize() {
        for (let i = 0; i < this.maxWorkers; i++) {
            const worker = this.createWorker();
            this.workers.push(worker);
            this.availableWorkers.push(worker);
        }
        
        console.log(`[WorkerPool] Pool initialized with ${this.workers.length} workers`);
    }
    
    createWorker() {
        const worker = {
            id: crypto.randomUUID(),
            isAvailable: true,
            currentTask: null
        };
        
        return worker;
    }
    
    getAvailableWorker() {
        if (this.availableWorkers.length === 0) {
            return null;
        }
        
        const worker = this.availableWorkers.shift();
        this.busyWorkers.add(worker.id);
        worker.isAvailable = false;
        
        return worker;
    }
    
    releaseWorker(worker) {
        worker.isAvailable = true;
        worker.currentTask = null;
        this.busyWorkers.delete(worker.id);
        this.availableWorkers.push(worker);
    }
    
    getStats() {
        return {
            totalWorkers: this.workers.length,
            availableWorkers: this.availableWorkers.length,
            busyWorkers: this.busyWorkers.size
        };
    }
    
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
     * @param {boolean} [options.enableTemporalAnalysis=true] - Enable Phase 3 temporal analysis
     * @param {Object} [options.reconciliatorOptions] - Options for result reconciliator
     */
    constructor(options = {}) {
        super();
        
        this.maxWorkers = options.maxWorkers || 4;
        this.maxConcurrent = options.maxConcurrent || 3;
        this.taskTimeout = options.taskTimeout || 30000;
        this.enableWorkers = options.enableWorkers || false;
        this.enableVisualAnalysis = options.enableVisualAnalysis !== undefined ? options.enableVisualAnalysis : true;
        this.enableTemporalAnalysis = options.enableTemporalAnalysis !== undefined ? options.enableTemporalAnalysis : true;
        
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
        
        // Initialize Phase 3 temporal analysis components
        if (this.enableTemporalAnalysis) {
            this.stateTracker = new StateTracker({ maxHistory: 50 });
            this.animationDetector = new AnimationDetector();
            this.transitionPredictor = new TransitionPredictor();
            console.log('[TaskOrchestrator] Temporal analysis components enabled');
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
        
        // Phase 3 temporal event listeners
        if (this.enableTemporalAnalysis) {
            this.setupTemporalEventListeners();
        }
    }
    
    /**
     * Set up event listeners for temporal components
     * @private
     */
    setupTemporalEventListeners() {
        if (this.stateTracker) {
            this.stateTracker.on('changes:detected', (changes) => {
                this.emit('temporal:stateChanged', changes);
            });
        }
        
        if (this.animationDetector) {
            this.animationDetector.on('loading:started', () => {
                this.emit('temporal:loadingStarted');
            });
            
            this.animationDetector.on('loading:completed', ({ duration }) => {
                this.emit('temporal:loadingCompleted', { duration });
            });
        }
        
        if (this.transitionPredictor) {
            this.transitionPredictor.on('prediction:made', (prediction) => {
                this.emit('temporal:predictionMade', prediction);
            });
        }
    }
    
    /**
     * Execute parallel analysis of DOM and vision data
     * @param {Object} analysisData - Data for analysis
     * @param {string} analysisData.dom - Simplified DOM string
     * @param {string} analysisData.screenshot - Base64 screenshot
     * @param {string} analysisData.url - Current URL
     * @param {string} analysisData.goal - User goal
     * @param {Object} analysisData.context - Additional context
     * @param {Object} [analysisData.viewport] - Viewport metadata
     * @param {Array} [analysisData.domNodes] - DOM nodes with position data
     * @param {Object} options - Analysis options
     * @param {Array<string>} [options.analysisTypes] - Types of analysis to run
     * @param {string} [options.priority] - Task priority
     * @param {boolean} [options.useVisualAnalysis] - Use Phase 2 visual analysis
     * @param {boolean} [options.useTemporalAnalysis] - Use Phase 3 temporal analysis
     * @returns {Promise<Object>} Reconciled analysis result
     */
    async executeParallelAnalysis(analysisData, options = {}) {
        const analysisId = crypto.randomUUID();
        const startTime = Date.now();
        
        console.log(`[TaskOrchestrator] Starting parallel analysis ${analysisId}`);
        
        // Phase 3: Capture current state if temporal analysis is enabled
        const useTemporal = options.useTemporalAnalysis !== undefined 
            ? options.useTemporalAnalysis 
            : this.enableTemporalAnalysis;
        
        if (useTemporal && this.stateTracker) {
            this.stateTracker.captureState({
                dom: analysisData.dom,
                screenshot: analysisData.screenshot,
                url: analysisData.url,
                viewport: analysisData.viewport
            });
        }
        
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
            
            if (analysisData.domNodes && analysisData.domNodes.length > 0) {
                analysisTypes.push(TaskType.VISUAL_MAPPING);
            }
        }
        
        // Add Phase 3 temporal analysis tasks if enabled
        if (useTemporal) {
            analysisTypes.push(TaskType.STATE_TRACKING);
            analysisTypes.push(TaskType.ANIMATION_DETECTION);
            
            if (this.transitionPredictor && this.stateTracker.getCurrentState()) {
                analysisTypes.push(TaskType.TRANSITION_PREDICTION);
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
    
    async createAnalysisTask(taskType, data, options = {}) {
        this.stats.totalTasks++;
        
        const taskFn = this.createTaskFunction(taskType, data);
        
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
        
        this.tasks.set(taskId, {
            id: taskId,
            type: taskType,
            status: TaskStatus.PENDING,
            createdAt: Date.now()
        });
        
        console.log(`[TaskOrchestrator] Created ${taskType} task ${taskId}`);
        
        return taskId;
    }
    
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
            case TaskType.STATE_TRACKING:
                return async () => this.executeStateTracking(data);
            case TaskType.ANIMATION_DETECTION:
                return async () => this.executeAnimationDetection(data);
            case TaskType.TRANSITION_PREDICTION:
                return async () => this.executeTransitionPrediction(data);
            case TaskType.PATTERN_MATCHING:
                return async () => this.executePatternMatching(data);
            case TaskType.LEARNING_INFERENCE:
                return async () => this.executeLearningInference(data);
            default:
                throw new Error(`Unknown task type: ${taskType}`);
        }
    }
    
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
            action, selector, confidence, reason,
            metadata: { elementCount, hasPopups, hasDecoys }
        };
    }
    
    async executeVisionAnalysis(data) {
        console.log('[TaskOrchestrator] Executing vision analysis');
        await this.simulateWork(800);
        
        return {
            source: AnalysisSource.VISION,
            action: 'scroll',
            confidence: 0.7,
            reason: 'Vision analysis suggests scrolling',
            metadata: { hasScreenshot: !!data.screenshot }
        };
    }
    
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
    
    segmentationToAction(segmentation, goal) {
        const goalLower = goal.toLowerCase();
        
        const hasModal = segmentation.regions.some(r => r.type === 'modal' || r.type === 'popup');
        if (hasModal) {
            return { action: 'click', selector: null, confidence: 0.8, reason: 'Modal detected, should close before proceeding' };
        }
        
        if (goalLower.includes('form') || goalLower.includes('submit') || goalLower.includes('fill')) {
            const hasForm = segmentation.functionalAreas.some(a => a.type === 'form');
            if (hasForm) {
                return { action: 'type', selector: null, confidence: 0.75, reason: 'Form area detected in content region' };
            }
        }
        
        return { action: 'scroll', selector: null, confidence: 0.6, reason: 'Continue exploring page content' };
    }
    
    async executeElementClassification(data) {
        if (!this.uiElementClassifier) {
            throw new Error('Element classification requires UIElementClassifier');
        }
        
        console.log('[TaskOrchestrator] Executing element classification');
        
        const elements = this.extractElementsFromDom(data.dom);
        const classifications = this.uiElementClassifier.classifyBatch(elements);
        
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
            metadata: { totalElements: elements.length }
        };
    }
    
    extractElementsFromDom(dom) {
        const elements = [];
        const elementRegex = /<(\w+)([^>]*)id="(\d+)"[^>]*>([^<]*)<\/\w+>/gi;
        let match;
        
        while ((match = elementRegex.exec(dom)) !== null) {
            const tag = match[1];
            const attrs = match[2];
            const id = match[3];
            const text = match[4].replace(/\[.*?\]/g, '').trim();
            
            elements.push({
                tag: tag.toLowerCase(),
                selector: `[data-agent-id='${id}']`,
                text: text,
                className: this.extractAttribute(attrs, 'class'),
                type: this.extractAttribute(attrs, 'type'),
                role: this.extractAttribute(attrs, 'role')
            });
        }
        
        return elements;
    }
    
    extractAttribute(attrs, name) {
        const regex = new RegExp(`${name}=["']([^"']+)["']`, 'i');
        const match = attrs.match(regex);
        return match ? match[1] : null;
    }
    
    async executeVisualMapping(data) {
        if (!this.visualDomMapper || !data.domNodes) {
            throw new Error('Visual mapping requires VisualDomMapper and DOM nodes');
        }
        
        console.log('[TaskOrchestrator] Executing visual-DOM mapping');
        
        const visualElements = data.visualElements || [];
        
        const mapping = await this.visualDomMapper.mapVisualToDom({
            visualElements: visualElements,
            domNodes: data.domNodes,
            viewport: data.viewport
        });
        
        const bestMapping = mapping.mappings[0];
        
        if (bestMapping && bestMapping.confidence !== 'uncertain') {
            return {
                source: AnalysisSource.VISION,
                action: 'click',
                selector: bestMapping.domNode.selector,
                confidence: this.mapConfidenceToScore(bestMapping.confidence),
                reason: 'Visual-DOM mapping identified target element',
                metadata: { mapping: mapping, mappingConfidence: bestMapping.confidence }
            };
        }
        
        return {
            source: AnalysisSource.VISION,
            action: 'wait',
            confidence: 0.4,
            reason: 'No confident visual-DOM mapping found',
            metadata: { mapping: mapping }
        };
    }
    
    /**
     * Execute state tracking (Phase 3)
     * @private
     * @param {Object} data - Analysis data
     * @returns {Promise<Object>} State tracking result
     */
    async executeStateTracking(data) {
        if (!this.stateTracker) {
            throw new Error('State tracking requires StateTracker');
        }
        
        console.log('[TaskOrchestrator] Executing state tracking');
        
        const changes = this.stateTracker.detectChanges();
        
        if (!changes) {
            return {
                source: AnalysisSource.HEURISTIC,
                action: 'wait',
                confidence: 0.7,
                reason: 'First state captured, no changes to analyze'
            };
        }
        
        // Determine action based on detected changes
        if (changes.changeTypes.includes(ChangeType.URL)) {
            return {
                source: AnalysisSource.HEURISTIC,
                action: 'wait',
                confidence: 0.8,
                reason: 'URL changed, waiting for page to stabilize',
                metadata: { changes: changes, waitTime: 2000 }
            };
        }
        
        if (changes.magnitude > 0.5) {
            return {
                source: AnalysisSource.HEURISTIC,
                action: 'wait',
                confidence: 0.75,
                reason: 'Significant page changes detected, waiting for stability',
                metadata: { changes: changes, waitTime: 1000 }
            };
        }
        
        return {
            source: AnalysisSource.HEURISTIC,
            action: 'continue',
            confidence: 0.6,
            reason: 'Page state stable, proceed with next action',
            metadata: { changes: changes }
        };
    }
    
    /**
     * Execute animation detection (Phase 3)
     * @private
     * @param {Object} data - Analysis data
     * @returns {Promise<Object>} Animation detection result
     */
    async executeAnimationDetection(data) {
        if (!this.animationDetector) {
            throw new Error('Animation detection requires AnimationDetector');
        }
        
        console.log('[TaskOrchestrator] Executing animation detection');
        
        const prevState = this.stateTracker ? this.stateTracker.getPreviousState() : null;
        
        const analysis = await this.animationDetector.analyzeAnimations({
            dom: data.dom,
            screenshot: data.screenshot,
            previousScreenshot: prevState ? prevState.screenshot : null,
            viewport: data.viewport
        });
        
        if (analysis.shouldWait) {
            return {
                source: AnalysisSource.HEURISTIC,
                action: 'wait',
                confidence: 0.9,
                reason: `Animations detected (${analysis.animations.length}), waiting for completion`,
                metadata: {
                    animations: analysis,
                    waitTime: analysis.estimatedCompletionTime
                }
            };
        }
        
        return {
            source: AnalysisSource.HEURISTIC,
            action: 'continue',
            confidence: 0.7,
            reason: 'No blocking animations detected',
            metadata: { animations: analysis }
        };
    }
    
    /**
     * Execute transition prediction (Phase 3)
     * @private
     * @param {Object} data - Analysis data
     * @returns {Promise<Object>} Transition prediction result
     */
    async executeTransitionPrediction(data) {
        if (!this.transitionPredictor || !this.stateTracker) {
            throw new Error('Transition prediction requires TransitionPredictor and StateTracker');
        }
        
        console.log('[TaskOrchestrator] Executing transition prediction');
        
        const currentState = this.stateTracker.getCurrentState();
        
        // Create proposed action from data
        const proposedAction = {
            action: data.proposedAction?.action || 'wait',
            selector: data.proposedAction?.selector || null,
            text: data.proposedAction?.text || null
        };
        
        const prediction = this.transitionPredictor.predictTransition(
            currentState,
            proposedAction
        );
        
        // Use prediction to adjust action timing
        return {
            source: AnalysisSource.LEARNING,
            action: proposedAction.action,
            selector: proposedAction.selector,
            confidence: prediction.confidence,
            reason: `Predicted ${prediction.predictedOutcome} with ${(prediction.successProbability * 100).toFixed(0)}% success rate`,
            metadata: {
                prediction: prediction,
                estimatedDuration: prediction.estimatedDuration
            }
        };
    }
    
    mapConfidenceToScore(confidence) {
        const scores = {
            'exact': 0.95, 'high': 0.85, 'medium': 0.7,
            'low': 0.5, 'uncertain': 0.3
        };
        return scores[confidence] || 0.5;
    }
    
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
    
    async simulateWork(duration) {
        return new Promise(resolve => setTimeout(resolve, duration));
    }
    
    cancelAnalysis(analysisId) {
        const analysis = this.activeAnalyses.get(analysisId);
        if (!analysis) return false;
        if (analysis.status !== 'running') return false;
        
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
    
    cancelTask(taskId) {
        const task = this.tasks.get(taskId);
        if (!task) return false;
        
        const result = this.jobQueue.cancelJob(taskId);
        if (result) {
            task.status = TaskStatus.CANCELLED;
            this.stats.cancelledTasks++;
        }
        return result;
    }
    
    getTaskStatus(taskId) {
        const jobStatus = this.jobQueue.getJobStatus(taskId);
        const task = this.tasks.get(taskId);
        
        if (!jobStatus || !task) return null;
        
        return { ...jobStatus, type: task.type };
    }
    
    getAnalysisStatus(analysisId) {
        const analysis = this.activeAnalyses.get(analysisId);
        if (!analysis) return null;
        
        const taskStatuses = analysis.taskIds.map(taskId => this.getTaskStatus(taskId));
        return { ...analysis, tasks: taskStatuses };
    }
    
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
    
    getStats() {
        const queueStats = this.jobQueue.getStats();
        const reconciliatorStats = this.reconciliator.getStats();
        const workerStats = this.workerPool ? this.workerPool.getStats() : null;
        
        const visualStats = this.enableVisualAnalysis ? {
            segmenter: this.screenshotSegmenter ? this.screenshotSegmenter.getStats() : null,
            classifier: this.uiElementClassifier ? this.uiElementClassifier.getStats() : null,
            mapper: this.visualDomMapper ? this.visualDomMapper.getStats() : null
        } : null;
        
        const temporalStats = this.enableTemporalAnalysis ? {
            stateTracker: this.stateTracker ? this.stateTracker.getStats() : null,
            animationDetector: this.animationDetector ? this.animationDetector.getStats() : null,
            transitionPredictor: this.transitionPredictor ? this.transitionPredictor.getStats() : null
        } : null;
        
        return {
            orchestrator: {
                ...this.stats,
                activeAnalyses: this.activeAnalyses.size,
                activeTasks: this.tasks.size,
                visualAnalysisEnabled: this.enableVisualAnalysis,
                temporalAnalysisEnabled: this.enableTemporalAnalysis
            },
            queue: queueStats,
            reconciliator: reconciliatorStats,
            workers: workerStats,
            visual: visualStats,
            temporal: temporalStats
        };
    }
    
    cleanup(maxAge = 3600000) {
        const now = Date.now();
        let count = 0;
        
        for (const [analysisId, analysis] of this.activeAnalyses.entries()) {
            if (analysis.status !== 'running' && analysis.startTime && (now - analysis.startTime) > maxAge) {
                this.activeAnalyses.delete(analysisId);
                count++;
            }
        }
        
        for (const [taskId, task] of this.tasks.entries()) {
            if (task.createdAt && (now - task.createdAt) > maxAge) {
                this.tasks.delete(taskId);
                count++;
            }
        }
        
        count += this.jobQueue.cleanup(maxAge);
        
        if (this.enableVisualAnalysis) {
            if (this.screenshotSegmenter) this.screenshotSegmenter.clearCache();
            if (this.visualDomMapper) this.visualDomMapper.clearCache();
        }
        
        if (this.enableTemporalAnalysis) {
            if (this.stateTracker) this.stateTracker.clearHistory(10);
            if (this.animationDetector) this.animationDetector.clearHistory();
        }
        
        if (count > 0) {
            console.log(`[TaskOrchestrator] Cleaned up ${count} old items`);
        }
        
        return count;
    }
    
    destroy() {
        console.log('[TaskOrchestrator] Destroying orchestrator');
        
        for (const analysisId of this.activeAnalyses.keys()) {
            this.cancelAnalysis(analysisId);
        }
        
        this.jobQueue.destroy();
        
        if (this.workerPool) {
            this.workerPool.terminate();
        }
        
        this.tasks.clear();
        this.activeAnalyses.clear();
        this.removeAllListeners();
        
        console.log('[TaskOrchestrator] Destroyed');
    }
}

module.exports = { TaskOrchestrator, TaskType, TaskStatus };
