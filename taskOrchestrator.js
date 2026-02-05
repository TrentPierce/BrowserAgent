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
 * - Phase 4: BayesianBeliefNetwork, FeedbackSystem, ConfidenceThresholdManager
 * 
 * FEATURES:
 * - Worker thread pool management
 * - Parallel task execution with priority scheduling
 * - Visual analysis integration (Phase 2)
 * - Temporal analysis integration (Phase 3)
 * - Probabilistic decision fusion (Phase 4)
 * - Task cancellation and timeout handling
 * - Error recovery and retry mechanisms
 * - Result aggregation and reconciliation
 * - Performance monitoring and statistics
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
const { BayesianBeliefNetwork, EvidenceSource, ActionType } = require('./beliefNetwork');
const { FeedbackSystem, OutcomeType, StrategyType } = require('./feedbackSystem');
const { ConfidenceThresholdManager, ConfidenceLevel, RiskLevel } = require('./confidenceManager');

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

class WorkerPool {
    constructor(maxWorkers, workerScript) {
        this.maxWorkers = maxWorkers;
        this.workerScript = workerScript;
        this.workers = [];
        this.availableWorkers = [];
        this.busyWorkers = new Set();
    }
    
    initialize() {
        for (let i = 0; i < this.maxWorkers; i++) {
            this.workers.push(this.createWorker());
            this.availableWorkers.push(this.workers[i]);
        }
    }
    
    createWorker() {
        return { id: crypto.randomUUID(), isAvailable: true, currentTask: null };
    }
    
    getAvailableWorker() {
        if (this.availableWorkers.length === 0) return null;
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
        for (const worker of this.workers) {
            if (worker.terminate) worker.terminate();
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
    constructor(options = {}) {
        super();
        
        this.maxWorkers = options.maxWorkers || 4;
        this.maxConcurrent = options.maxConcurrent || 3;
        this.taskTimeout = options.taskTimeout || 30000;
        this.enableWorkers = options.enableWorkers || false;
        this.enableVisualAnalysis = options.enableVisualAnalysis !== undefined ? options.enableVisualAnalysis : true;
        this.enableTemporalAnalysis = options.enableTemporalAnalysis !== undefined ? options.enableTemporalAnalysis : true;
        this.enableDecisionFusion = options.enableDecisionFusion !== undefined ? options.enableDecisionFusion : true;
        
        this.jobQueue = new JobQueue({
            maxConcurrent: this.maxConcurrent,
            maxRetries: 2,
            retryDelay: 1000
        });
        
        this.reconciliator = new ResultReconciliator(options.reconciliatorOptions || {});
        
        if (this.enableVisualAnalysis) {
            this.screenshotSegmenter = new ScreenshotSegmenter();
            this.uiElementClassifier = new UIElementClassifier();
            this.visualDomMapper = new VisualDomMapper();
        }
        
        if (this.enableTemporalAnalysis) {
            this.stateTracker = new StateTracker({ maxHistory: 50 });
            this.animationDetector = new AnimationDetector();
            this.transitionPredictor = new TransitionPredictor();
        }
        
        if (this.enableDecisionFusion) {
            this.beliefNetwork = new BayesianBeliefNetwork(options.beliefNetworkOptions || {});
            this.feedbackSystem = new FeedbackSystem(options.feedbackOptions || {});
            this.confidenceManager = new ConfidenceThresholdManager(options.confidenceOptions || {});
            console.log('[TaskOrchestrator] Decision fusion components enabled');
        }
        
        this.workerPool = null;
        if (this.enableWorkers) {
            this.workerPool = new WorkerPool(this.maxWorkers, './analysisWorker.js');
            this.workerPool.initialize();
        }
        
        this.tasks = new Map();
        this.activeAnalyses = new Map();
        
        this.stats = {
            totalTasks: 0,
            completedTasks: 0,
            failedTasks: 0,
            cancelledTasks: 0,
            averageExecutionTime: 0,
            totalExecutionTime: 0
        };
        
        this.setupEventListeners();
        console.log('[TaskOrchestrator] Initialized with decision fusion');
    }
    
    setupEventListeners() {
        this.jobQueue.on('job:completed', ({ jobId, result, duration }) => {
            this.emit('task:completed', { taskId: jobId, result, duration });
            
            if (this.enableDecisionFusion && this.feedbackSystem && result.action) {
                this.feedbackSystem.recordOutcome(
                    result,
                    { success: true },
                    duration,
                    true,
                    { domain: result.metadata?.domain || 'default' }
                );
            }
        });
        
        this.jobQueue.on('job:failed', ({ jobId, error }) => {
            this.emit('task:failed', { taskId: jobId, error });
        });
        
        this.jobQueue.on('job:cancelled', ({ jobId }) => {
            this.emit('task:cancelled', { taskId: jobId });
        });
        
        if (this.enableTemporalAnalysis) {
            this.setupTemporalEventListeners();
        }
        
        if (this.enableDecisionFusion) {
            this.setupDecisionEventListeners();
        }
    }
    
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
    
    setupDecisionEventListeners() {
        if (this.beliefNetwork) {
            this.beliefNetwork.on('beliefs:computed', ({ beliefs }) => {
                this.emit('decision:beliefsComputed', { beliefCount: beliefs.size });
            });
        }
        
        if (this.feedbackSystem) {
            this.feedbackSystem.on('parameters:adjusted', ({ domain, params }) => {
                this.emit('decision:parametersAdjusted', { domain, params });
            });
        }
        
        if (this.confidenceManager) {
            this.confidenceManager.on('thresholds:adjusted', ({ domain, thresholds }) => {
                this.emit('decision:thresholdsAdjusted', { domain, thresholds });
            });
        }
    }
    
    async executeParallelAnalysis(analysisData, options = {}) {
        const analysisId = crypto.randomUUID();
        const startTime = Date.now();
        
        console.log(`[TaskOrchestrator] Starting parallel analysis ${analysisId}`);
        
        const useTemporal = options.useTemporalAnalysis !== undefined ? options.useTemporalAnalysis : this.enableTemporalAnalysis;
        const useDecision = options.useDecisionFusion !== undefined ? options.useDecisionFusion : this.enableDecisionFusion;
        
        if (useTemporal && this.stateTracker) {
            this.stateTracker.captureState({
                dom: analysisData.dom,
                screenshot: analysisData.screenshot,
                url: analysisData.url,
                viewport: analysisData.viewport
            });
        }
        
        let analysisTypes = options.analysisTypes || [TaskType.DOM_ANALYSIS, TaskType.VISION_ANALYSIS];
        
        const useVisual = options.useVisualAnalysis !== undefined ? options.useVisualAnalysis : this.enableVisualAnalysis;
        
        if (useVisual && analysisData.screenshot && analysisData.viewport) {
            analysisTypes = [TaskType.VISUAL_SEGMENTATION, TaskType.ELEMENT_CLASSIFICATION, ...analysisTypes];
            if (analysisData.domNodes && analysisData.domNodes.length > 0) {
                analysisTypes.push(TaskType.VISUAL_MAPPING);
            }
        }
        
        if (useTemporal) {
            analysisTypes.push(TaskType.STATE_TRACKING);
            analysisTypes.push(TaskType.ANIMATION_DETECTION);
            if (this.transitionPredictor && this.stateTracker.getCurrentState()) {
                analysisTypes.push(TaskType.TRANSITION_PREDICTION);
            }
        }
        
        const priority = options.priority || Priority.MEDIUM;
        const taskPromises = [];
        const taskIds = [];
        
        for (const analysisType of analysisTypes) {
            const taskId = await this.createAnalysisTask(analysisType, analysisData, { priority, timeout: this.taskTimeout });
            taskIds.push(taskId);
            taskPromises.push(this.jobQueue.waitForJob(taskId));
        }
        
        this.activeAnalyses.set(analysisId, {
            id: analysisId,
            taskIds: taskIds,
            taskTypes: analysisTypes,
            startTime: startTime,
            status: 'running'
        });
        
        try {
            const results = await Promise.allSettled(taskPromises);
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
            
            let reconciledResult;
            
            if (successfulResults.length === 0) {
                throw new Error('All analysis tasks failed');
            }
            
            if (useDecision && this.beliefNetwork && successfulResults.length > 1) {
                reconciledResult = await this.fuseWithBeliefNetwork(successfulResults, analysisData);
            } else if (successfulResults.length === 1) {
                reconciledResult = successfulResults[0];
                reconciledResult.confidence = reconciledResult.confidence || 0.7;
                reconciledResult.sources = [successfulResults[0].source || 'unknown'];
            } else {
                reconciledResult = await this.reconciliator.reconcile(successfulResults, { context: analysisData.context });
            }
            
            const duration = Date.now() - startTime;
            this.updateStats(duration, true);
            
            const analysis = this.activeAnalyses.get(analysisId);
            if (analysis) {
                analysis.status = 'completed';
                analysis.duration = duration;
                analysis.result = reconciledResult;
                analysis.tasksCompleted = successfulResults.length;
                analysis.tasksFailed = failedTasks.length;
            }
            
            console.log(`[TaskOrchestrator] Analysis ${analysisId} completed in ${duration}ms`);
            this.emit('analysis:completed', { analysisId, result: reconciledResult, duration });
            
            return reconciledResult;
            
        } catch (error) {
            console.error(`[TaskOrchestrator] Analysis ${analysisId} failed:`, error.message);
            
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
    
    async fuseWithBeliefNetwork(results, analysisData) {
        console.log('[TaskOrchestrator] Fusing results with Bayesian belief network');
        
        this.beliefNetwork.clearEvidence();
        
        const domain = this.extractDomain(analysisData.url);
        
        for (const result of results) {
            const evidenceSource = this.mapSourceToEvidence(result.source);
            const actionType = this.mapActionToType(result.action);
            
            this.beliefNetwork.addEvidence(
                evidenceSource,
                actionType,
                result.confidence || 0.7,
                0.9,
                { source: result.source, selector: result.selector }
            );
        }
        
        const beliefs = this.beliefNetwork.computeBeliefs();
        const ranked = this.beliefNetwork.getRankedActions(0.1);
        
        const candidates = ranked.map(belief => ({
            action: belief.action,
            confidence: belief.probability,
            uncertainty: belief.uncertainty,
            evidenceCount: belief.evidenceCount,
            sources: this.getSourcesForAction(results, belief.action)
        }));
        
        const strategyRec = this.feedbackSystem.recommendStrategy(domain);
        const selection = this.confidenceManager.selectAction(candidates, domain);
        
        const originalResult = results.find(r => this.mapActionToType(r.action) === selection.action.action);
        
        return {
            action: selection.action.action,
            selector: originalResult?.selector || null,
            confidence: selection.confidence,
            reason: originalResult?.reason || 'Bayesian decision fusion',
            sources: selection.action.sources || [],
            metadata: {
                ...originalResult?.metadata,
                belief: {
                    probability: selection.action.confidence,
                    uncertainty: selection.action.uncertainty,
                    evidenceCount: selection.action.evidenceCount,
                    allBeliefs: ranked.slice(0, 3).map(b => ({
                        action: b.action,
                        probability: b.probability
                    }))
                },
                risk: selection.risk,
                strategy: selection.strategy,
                confidenceLevel: selection.level,
                recommendedStrategy: strategyRec,
                alternatives: selection.alternatives?.map(alt => ({
                    action: alt.action,
                    confidence: alt.confidence
                }))
            }
        };
    }
    
    mapSourceToEvidence(source) {
        const mapping = {
            'dom': EvidenceSource.DOM,
            'vision': EvidenceSource.VISION,
            'pattern': EvidenceSource.PATTERN,
            'heuristic': EvidenceSource.HEURISTIC,
            'learning': EvidenceSource.LEARNING
        };
        return mapping[source] || EvidenceSource.HEURISTIC;
    }
    
    mapActionToType(action) {
        const mapping = {
            'click': ActionType.CLICK,
            'type': ActionType.TYPE,
            'scroll': ActionType.SCROLL,
            'navigate': ActionType.NAVIGATE,
            'wait': ActionType.WAIT,
            'complete': ActionType.COMPLETE,
            'continue': ActionType.WAIT
        };
        return mapping[action] || ActionType.WAIT;
    }
    
    getSourcesForAction(results, actionType) {
        return results
            .filter(r => this.mapActionToType(r.action) === actionType)
            .map(r => r.source);
    }
    
    extractDomain(url) {
        try {
            const parsed = new URL(url);
            return parsed.hostname;
        } catch {
            return 'default';
        }
    }
    
    recordOutcome(actionPlan, outcome, metadata = {}) {
        if (!this.enableDecisionFusion || !this.feedbackSystem) return;
        
        const domain = metadata.domain || this.extractDomain(metadata.url || '');
        const success = outcome.success !== undefined ? outcome.success : true;
        const duration = outcome.duration || metadata.duration || 0;
        
        this.feedbackSystem.recordOutcome(
            actionPlan,
            outcome,
            duration,
            success,
            {
                domain: domain,
                strategy: metadata.strategy || StrategyType.BALANCED,
                confidence: actionPlan.confidence || 0
            }
        );
        
        if (this.confidenceManager && actionPlan.metadata?.confidenceLevel) {
            this.confidenceManager.recordOutcome(
                domain,
                actionPlan.confidence || 0,
                success,
                actionPlan.metadata.confidenceLevel
            );
        }
        
        console.log(`[TaskOrchestrator] Recorded outcome for ${actionPlan.action}: ${success ? 'success' : 'failure'}`);
    }
    
    async createAnalysisTask(taskType, data, options = {}) {
        this.stats.totalTasks++;
        const taskFn = this.createTaskFunction(taskType, data);
        const taskId = this.jobQueue.addJob(taskFn, [], {
            priority: options.priority || Priority.MEDIUM,
            timeout: options.timeout || this.taskTimeout,
            metadata: { taskType: taskType, createdAt: Date.now() }
        });
        
        this.tasks.set(taskId, {
            id: taskId,
            type: taskType,
            status: TaskStatus.PENDING,
            createdAt: Date.now()
        });
        
        return taskId;
    }
    
    createTaskFunction(taskType, data) {
        const functions = {
            [TaskType.DOM_ANALYSIS]: () => this.executeDomAnalysis(data),
            [TaskType.VISION_ANALYSIS]: () => this.executeVisionAnalysis(data),
            [TaskType.VISUAL_SEGMENTATION]: () => this.executeVisualSegmentation(data),
            [TaskType.ELEMENT_CLASSIFICATION]: () => this.executeElementClassification(data),
            [TaskType.VISUAL_MAPPING]: () => this.executeVisualMapping(data),
            [TaskType.STATE_TRACKING]: () => this.executeStateTracking(data),
            [TaskType.ANIMATION_DETECTION]: () => this.executeAnimationDetection(data),
            [TaskType.TRANSITION_PREDICTION]: () => this.executeTransitionPrediction(data),
            [TaskType.PATTERN_MATCHING]: () => this.executePatternMatching(data),
            [TaskType.LEARNING_INFERENCE]: () => this.executeLearningInference(data)
        };
        
        return functions[taskType] || (() => { throw new Error(`Unknown task type: ${taskType}`); });
    }
    
    async executeDomAnalysis(data) {
        await this.simulateWork(500);
        const elementCount = (data.dom.match(/data-agent-id/g) || []).length;
        const hasPopups = data.dom.includes('[IN-POPUP]') || data.dom.includes('[COOKIE-BANNER]');
        
        let action = 'wait', confidence = 0.6, selector = null, reason = 'DOM analysis';
        
        if (hasPopups) {
            const popupMatch = data.dom.match(/<button[^>]*id="(\d+)"[^>]*>\[COOKIE-BANNER\]Accept/i);
            if (popupMatch) {
                action = 'click';
                selector = `[data-agent-id='${popupMatch[1]}']`;
                reason = 'Close cookie banner';
                confidence = 0.9;
            }
        }
        
        return { source: AnalysisSource.DOM, action, selector, confidence, reason, metadata: { elementCount, hasPopups } };
    }
    
    async executeVisionAnalysis(data) {
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
        
        const segmentation = await this.screenshotSegmenter.analyzeScreenshot(data.screenshot, {
            width: data.viewport.width,
            height: data.viewport.height,
            scrollY: data.viewport.scrollY || 0,
            scrollX: data.viewport.scrollX || 0
        });
        
        const action = this.segmentationToAction(segmentation, data.goal);
        return { source: AnalysisSource.VISION, ...action, metadata: { segmentation, regions: segmentation.regions.length } };
    }
    
    segmentationToAction(segmentation, goal) {
        const hasModal = segmentation.regions.some(r => r.type === 'modal' || r.type === 'popup');
        if (hasModal) return { action: 'click', selector: null, confidence: 0.8, reason: 'Modal detected' };
        
        const goalLower = goal.toLowerCase();
        if (goalLower.includes('form') || goalLower.includes('submit')) {
            const hasForm = segmentation.functionalAreas.some(a => a.type === 'form');
            if (hasForm) return { action: 'type', selector: null, confidence: 0.75, reason: 'Form detected' };
        }
        
        return { action: 'scroll', selector: null, confidence: 0.6, reason: 'Continue exploring' };
    }
    
    async executeElementClassification(data) {
        if (!this.uiElementClassifier) throw new Error('Element classification requires UIElementClassifier');
        
        const elements = this.extractElementsFromDom(data.dom);
        const classifications = this.uiElementClassifier.classifyBatch(elements);
        const interactive = classifications.filter(c => c.interaction === 'clickable' || c.interaction === 'editable')
            .sort((a, b) => b.confidence - a.confidence);
        
        if (interactive.length > 0) {
            const best = interactive[0];
            const element = elements[classifications.indexOf(best)];
            return {
                source: AnalysisSource.HEURISTIC,
                action: best.interaction === 'editable' ? 'type' : 'click',
                selector: element.selector,
                confidence: best.confidence,
                reason: `Classified as ${best.type}`,
                metadata: { classification: best }
            };
        }
        
        return { source: AnalysisSource.HEURISTIC, action: 'wait', confidence: 0.5, reason: 'No clear interactive elements' };
    }
    
    extractElementsFromDom(dom) {
        const elements = [];
        const regex = /<(\w+)([^>]*)id="(\d+)"[^>]*>([^<]*)<\/\w+>/gi;
        let match;
        while ((match = regex.exec(dom)) !== null) {
            elements.push({
                tag: match[1].toLowerCase(),
                selector: `[data-agent-id='${match[3]}']`,
                text: match[4].replace(/\[.*?\]/g, '').trim(),
                className: this.extractAttribute(match[2], 'class'),
                type: this.extractAttribute(match[2], 'type'),
                role: this.extractAttribute(match[2], 'role')
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
        if (!this.visualDomMapper || !data.domNodes) throw new Error('Visual mapping requires VisualDomMapper');
        
        const mapping = await this.visualDomMapper.mapVisualToDom({
            visualElements: data.visualElements || [],
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
                reason: 'Visual-DOM mapping',
                metadata: { mapping }
            };
        }
        
        return { source: AnalysisSource.VISION, action: 'wait', confidence: 0.4, reason: 'No mapping found' };
    }
    
    async executeStateTracking(data) {
        if (!this.stateTracker) throw new Error('State tracking requires StateTracker');
        
        const changes = this.stateTracker.detectChanges();
        if (!changes) return { source: AnalysisSource.HEURISTIC, action: 'wait', confidence: 0.7, reason: 'First state' };
        
        if (changes.changeTypes.includes(ChangeType.URL)) {
            return { source: AnalysisSource.HEURISTIC, action: 'wait', confidence: 0.8, reason: 'URL changed', metadata: { changes, waitTime: 2000 } };
        }
        
        if (changes.magnitude > 0.5) {
            return { source: AnalysisSource.HEURISTIC, action: 'wait', confidence: 0.75, reason: 'Significant changes', metadata: { changes, waitTime: 1000 } };
        }
        
        return { source: AnalysisSource.HEURISTIC, action: 'continue', confidence: 0.6, reason: 'State stable', metadata: { changes } };
    }
    
    async executeAnimationDetection(data) {
        if (!this.animationDetector) throw new Error('Animation detection requires AnimationDetector');
        
        const prevState = this.stateTracker ? this.stateTracker.getPreviousState() : null;
        const analysis = await this.animationDetector.analyzeAnimations({
            dom: data.dom,
            screenshot: data.screenshot,
            previousScreenshot: prevState?.screenshot,
            viewport: data.viewport
        });
        
        if (analysis.shouldWait) {
            return {
                source: AnalysisSource.HEURISTIC,
                action: 'wait',
                confidence: 0.9,
                reason: `Animations detected (${analysis.animations.length})`,
                metadata: { animations: analysis, waitTime: analysis.estimatedCompletionTime }
            };
        }
        
        return { source: AnalysisSource.HEURISTIC, action: 'continue', confidence: 0.7, reason: 'No blocking animations', metadata: { animations: analysis } };
    }
    
    async executeTransitionPrediction(data) {
        if (!this.transitionPredictor || !this.stateTracker) throw new Error('Transition prediction requires components');
        
        const currentState = this.stateTracker.getCurrentState();
        const proposedAction = {
            action: data.proposedAction?.action || 'wait',
            selector: data.proposedAction?.selector || null,
            text: data.proposedAction?.text || null
        };
        
        const prediction = this.transitionPredictor.predictTransition(currentState, proposedAction);
        
        return {
            source: AnalysisSource.LEARNING,
            action: proposedAction.action,
            selector: proposedAction.selector,
            confidence: prediction.confidence,
            reason: `Predicted ${prediction.predictedOutcome}`,
            metadata: { prediction, estimatedDuration: prediction.estimatedDuration }
        };
    }
    
    mapConfidenceToScore(confidence) {
        const scores = { 'exact': 0.95, 'high': 0.85, 'medium': 0.7, 'low': 0.5, 'uncertain': 0.3 };
        return scores[confidence] || 0.5;
    }
    
    async executePatternMatching(data) {
        await this.simulateWork(500);
        return { source: AnalysisSource.PATTERN, action: 'click', confidence: 0.75, reason: 'Pattern matching', metadata: {} };
    }
    
    async executeLearningInference(data) {
        await this.simulateWork(800);
        return { source: AnalysisSource.LEARNING, action: 'type', confidence: 0.65, reason: 'Learning inference', metadata: {} };
    }
    
    async simulateWork(duration) {
        return new Promise(resolve => setTimeout(resolve, duration));
    }
    
    cancelAnalysis(analysisId) {
        const analysis = this.activeAnalyses.get(analysisId);
        if (!analysis || analysis.status !== 'running') return false;
        
        let count = 0;
        for (const taskId of analysis.taskIds) {
            if (this.jobQueue.cancelJob(taskId)) count++;
        }
        
        analysis.status = 'cancelled';
        this.stats.cancelledTasks += count;
        this.emit('analysis:cancelled', { analysisId, cancelledTasks: count });
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
        return (jobStatus && task) ? { ...jobStatus, type: task.type } : null;
    }
    
    getAnalysisStatus(analysisId) {
        const analysis = this.activeAnalyses.get(analysisId);
        return analysis ? { ...analysis, tasks: analysis.taskIds.map(id => this.getTaskStatus(id)) } : null;
    }
    
    updateStats(duration, success) {
        success ? this.stats.completedTasks++ : this.stats.failedTasks++;
        this.stats.totalExecutionTime += duration;
        this.stats.averageExecutionTime = this.stats.totalExecutionTime / (this.stats.completedTasks + this.stats.failedTasks);
    }
    
    getStats() {
        const base = {
            orchestrator: {
                ...this.stats,
                activeAnalyses: this.activeAnalyses.size,
                activeTasks: this.tasks.size,
                visualAnalysisEnabled: this.enableVisualAnalysis,
                temporalAnalysisEnabled: this.enableTemporalAnalysis,
                decisionFusionEnabled: this.enableDecisionFusion
            },
            queue: this.jobQueue.getStats(),
            reconciliator: this.reconciliator.getStats(),
            workers: this.workerPool ? this.workerPool.getStats() : null
        };
        
        if (this.enableVisualAnalysis) {
            base.visual = {
                segmenter: this.screenshotSegmenter?.getStats(),
                classifier: this.uiElementClassifier?.getStats(),
                mapper: this.visualDomMapper?.getStats()
            };
        }
        
        if (this.enableTemporalAnalysis) {
            base.temporal = {
                stateTracker: this.stateTracker?.getStats(),
                animationDetector: this.animationDetector?.getStats(),
                transitionPredictor: this.transitionPredictor?.getStats()
            };
        }
        
        if (this.enableDecisionFusion) {
            base.decision = {
                beliefNetwork: this.beliefNetwork?.getStats(),
                feedbackSystem: this.feedbackSystem?.getStats(),
                confidenceManager: this.confidenceManager?.getStats()
            };
        }
        
        return base;
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
            this.screenshotSegmenter?.clearCache();
            this.visualDomMapper?.clearCache();
        }
        
        if (this.enableTemporalAnalysis) {
            this.stateTracker?.clearHistory(10);
            this.animationDetector?.clearHistory();
        }
        
        if (count > 0) console.log(`[TaskOrchestrator] Cleaned up ${count} old items`);
        return count;
    }
    
    destroy() {
        console.log('[TaskOrchestrator] Destroying orchestrator');
        
        for (const analysisId of this.activeAnalyses.keys()) {
            this.cancelAnalysis(analysisId);
        }
        
        this.jobQueue.destroy();
        this.workerPool?.terminate();
        this.tasks.clear();
        this.activeAnalyses.clear();
        this.removeAllListeners();
        
        console.log('[TaskOrchestrator] Destroyed');
    }
}

module.exports = { TaskOrchestrator, TaskType, TaskStatus };
