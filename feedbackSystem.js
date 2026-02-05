/**
 * ============================================================================
 * FEEDBACK SYSTEM - Action Feedback and Strategy Adaptation
 * ============================================================================
 * 
 * Collects and analyzes feedback from action outcomes to adaptively improve
 * decision-making strategies. Uses reinforcement learning principles to
 * adjust parameters and recommend optimal strategies for different domains.
 * 
 * FEATURES:
 * - Action outcome feedback collection
 * - Success/failure pattern analysis
 * - Strategy performance metrics tracking
 * - Adaptive parameter tuning per domain
 * - Reinforcement learning style updates
 * - Strategy recommendation based on historical performance
 * - Domain-specific learning
 * - Exploration vs exploitation balancing
 * 
 * USAGE:
 * const feedback = new FeedbackSystem();
 * feedback.recordOutcome(action, result, duration, success);
 * const recommendation = feedback.recommendStrategy(domain);
 * 
 * ============================================================================
 */

const EventEmitter = require('events');
const crypto = require('crypto');

/**
 * Outcome types
 * @enum {string}
 */
const OutcomeType = {
    SUCCESS: 'success',
    FAILURE: 'failure',
    TIMEOUT: 'timeout',
    ERROR: 'error',
    PARTIAL: 'partial'
};

/**
 * Strategy types
 * @enum {string}
 */
const StrategyType = {
    CONSERVATIVE: 'conservative',     // High confidence, low risk
    BALANCED: 'balanced',             // Medium confidence, balanced
    AGGRESSIVE: 'aggressive',         // Lower confidence, exploratory
    ADAPTIVE: 'adaptive'              // Dynamically adjusts
};

/**
 * Feedback System for learning from action outcomes
 * @class
 * @extends EventEmitter
 */
class FeedbackSystem extends EventEmitter {
    /**
     * Create a new FeedbackSystem instance
     * @param {Object} options - Configuration options
     * @param {number} [options.learningRate=0.1] - Learning rate for updates (0-1)
     * @param {number} [options.discountFactor=0.9] - Discount factor for future rewards
     * @param {number} [options.explorationRate=0.1] - Exploration rate for strategy selection
     * @param {number} [options.maxFeedbackHistory=1000] - Maximum feedback records to store
     * @param {boolean} [options.enableDomainLearning=true] - Enable domain-specific learning
     */
    constructor(options = {}) {
        super();
        
        this.learningRate = options.learningRate || 0.1;
        this.discountFactor = options.discountFactor || 0.9;
        this.explorationRate = options.explorationRate || 0.1;
        this.maxFeedbackHistory = options.maxFeedbackHistory || 1000;
        this.enableDomainLearning = options.enableDomainLearning !== undefined 
            ? options.enableDomainLearning 
            : true;
        
        // Feedback storage
        this.feedbackHistory = [];
        this.domainFeedback = new Map();
        
        // Strategy performance tracking
        this.strategyPerformance = new Map();
        this.initializeStrategies();
        
        // Domain-specific parameters
        this.domainParameters = new Map();
        
        // Action value estimates (Q-values)
        this.actionValues = new Map();
        
        // Statistics
        this.stats = {
            totalFeedback: 0,
            successfulOutcomes: 0,
            failedOutcomes: 0,
            averageReward: 0,
            totalReward: 0,
            outcomesByType: {},
            domainCount: 0,
            strategyUseCount: {},
            parametersAdjusted: 0
        };
        
        console.log('[FeedbackSystem] Initialized with learning rate:', this.learningRate);
    }
    
    /**
     * Initialize strategy performance tracking
     * @private
     */
    initializeStrategies() {
        const strategies = Object.values(StrategyType);
        
        for (const strategy of strategies) {
            this.strategyPerformance.set(strategy, {
                strategy: strategy,
                useCount: 0,
                successCount: 0,
                failureCount: 0,
                totalReward: 0,
                averageReward: 0,
                successRate: 0,
                averageDuration: 0,
                totalDuration: 0
            });
        }
    }
    
    /**
     * Record action outcome feedback
     * @param {Object} action - Action taken
     * @param {Object} result - Action result
     * @param {number} duration - Action duration in milliseconds
     * @param {boolean} success - Whether action succeeded
     * @param {Object} [metadata] - Additional metadata
     * @returns {string} Feedback ID
     */
    recordOutcome(action, result, duration, success, metadata = {}) {
        const feedbackId = crypto.randomUUID();
        
        // Determine outcome type
        let outcomeType = success ? OutcomeType.SUCCESS : OutcomeType.FAILURE;
        if (metadata.timeout) outcomeType = OutcomeType.TIMEOUT;
        if (metadata.error) outcomeType = OutcomeType.ERROR;
        if (metadata.partial) outcomeType = OutcomeType.PARTIAL;
        
        // Calculate reward
        const reward = this.calculateReward(success, duration, outcomeType, metadata);
        
        const feedback = {
            id: feedbackId,
            timestamp: Date.now(),
            action: {
                type: action.action || action.type,
                selector: action.selector,
                confidence: action.confidence || 0
            },
            result: result,
            duration: duration,
            success: success,
            outcomeType: outcomeType,
            reward: reward,
            domain: metadata.domain || 'default',
            strategy: metadata.strategy || StrategyType.BALANCED,
            metadata: metadata
        };
        
        // Store feedback
        this.feedbackHistory.push(feedback);
        
        // Trim history if needed
        if (this.feedbackHistory.length > this.maxFeedbackHistory) {
            this.feedbackHistory.shift();
        }
        
        // Store domain-specific feedback
        if (this.enableDomainLearning) {
            const domain = feedback.domain;
            if (!this.domainFeedback.has(domain)) {
                this.domainFeedback.set(domain, []);
                this.stats.domainCount++;
            }
            this.domainFeedback.get(domain).push(feedback);
        }
        
        // Update action values (Q-learning)
        this.updateActionValues(feedback);
        
        // Update strategy performance
        this.updateStrategyPerformance(feedback);
        
        // Adjust parameters based on feedback
        this.adjustParameters(feedback);
        
        // Update statistics
        this.updateStats(feedback);
        
        console.log(`[FeedbackSystem] Recorded ${outcomeType} outcome for ${action.action || action.type} (reward: ${reward.toFixed(2)})`);
        this.emit('feedback:recorded', { feedbackId, feedback });
        
        return feedbackId;
    }
    
    /**
     * Calculate reward for action outcome
     * @private
     * @param {boolean} success - Whether action succeeded
     * @param {number} duration - Action duration
     * @param {string} outcomeType - Type of outcome
     * @param {Object} metadata - Additional metadata
     * @returns {number} Reward value
     */
    calculateReward(success, duration, outcomeType, metadata) {
        let reward = 0;
        
        // Base reward for success/failure
        if (outcomeType === OutcomeType.SUCCESS) {
            reward = 1.0;
        } else if (outcomeType === OutcomeType.PARTIAL) {
            reward = 0.5;
        } else if (outcomeType === OutcomeType.FAILURE) {
            reward = -0.5;
        } else if (outcomeType === OutcomeType.TIMEOUT) {
            reward = -0.3;
        } else if (outcomeType === OutcomeType.ERROR) {
            reward = -0.7;
        }
        
        // Adjust for duration (faster is better)
        const durationPenalty = Math.min(0.3, duration / 10000); // Max 0.3 penalty
        reward -= durationPenalty;
        
        // Bonus for high confidence actions that succeed
        if (success && metadata.confidence) {
            reward += metadata.confidence * 0.2;
        }
        
        // Penalty for low confidence actions that fail
        if (!success && metadata.confidence) {
            reward -= (1 - metadata.confidence) * 0.1;
        }
        
        return reward;
    }
    
    /**
     * Update action values using Q-learning
     * @private
     * @param {Object} feedback - Feedback record
     */
    updateActionValues(feedback) {
        const actionKey = this.getActionKey(feedback.action.type, feedback.domain);
        
        // Get current Q-value
        const currentQ = this.actionValues.get(actionKey) || 0;
        
        // Q-learning update: Q(s,a) = Q(s,a) + α * [r + γ * maxQ(s',a') - Q(s,a)]
        // Simplified: Q(s,a) = Q(s,a) + α * [r - Q(s,a)]
        const newQ = currentQ + this.learningRate * (feedback.reward - currentQ);
        
        this.actionValues.set(actionKey, newQ);
    }
    
    /**
     * Get action key for value storage
     * @private
     * @param {string} actionType - Action type
     * @param {string} domain - Domain
     * @returns {string} Action key
     */
    getActionKey(actionType, domain) {
        return `${domain}:${actionType}`;
    }
    
    /**
     * Update strategy performance metrics
     * @private
     * @param {Object} feedback - Feedback record
     */
    updateStrategyPerformance(feedback) {
        const strategy = feedback.strategy;
        const perf = this.strategyPerformance.get(strategy);
        
        if (!perf) return;
        
        perf.useCount++;
        perf.totalReward += feedback.reward;
        perf.averageReward = perf.totalReward / perf.useCount;
        perf.totalDuration += feedback.duration;
        perf.averageDuration = perf.totalDuration / perf.useCount;
        
        if (feedback.success) {
            perf.successCount++;
        } else {
            perf.failureCount++;
        }
        
        perf.successRate = perf.successCount / perf.useCount;
        
        this.stats.strategyUseCount[strategy] = perf.useCount;
    }
    
    /**
     * Adjust parameters based on feedback
     * @private
     * @param {Object} feedback - Feedback record
     */
    adjustParameters(feedback) {
        if (!this.enableDomainLearning) return;
        
        const domain = feedback.domain;
        
        // Get or create domain parameters
        if (!this.domainParameters.has(domain)) {
            this.domainParameters.set(domain, {
                confidenceThreshold: 0.7,
                timeoutMultiplier: 1.0,
                retryAttempts: 2,
                explorationRate: this.explorationRate,
                lastAdjusted: Date.now()
            });
        }
        
        const params = this.domainParameters.get(domain);
        const domainHistory = this.domainFeedback.get(domain) || [];
        
        // Only adjust after sufficient feedback
        if (domainHistory.length < 10) return;
        
        // Calculate recent performance
        const recentHistory = domainHistory.slice(-20);
        const recentSuccessRate = recentHistory.filter(f => f.success).length / recentHistory.length;
        const avgDuration = recentHistory.reduce((sum, f) => sum + f.duration, 0) / recentHistory.length;
        
        // Adjust confidence threshold
        if (recentSuccessRate < 0.6) {
            // Low success rate, increase threshold (be more conservative)
            params.confidenceThreshold = Math.min(0.9, params.confidenceThreshold + 0.02);
            this.stats.parametersAdjusted++;
        } else if (recentSuccessRate > 0.85) {
            // High success rate, can be more aggressive
            params.confidenceThreshold = Math.max(0.5, params.confidenceThreshold - 0.02);
            this.stats.parametersAdjusted++;
        }
        
        // Adjust timeout multiplier based on duration
        if (avgDuration > 5000) {
            // Slow actions, increase timeout
            params.timeoutMultiplier = Math.min(2.0, params.timeoutMultiplier + 0.1);
            this.stats.parametersAdjusted++;
        } else if (avgDuration < 2000) {
            // Fast actions, can reduce timeout
            params.timeoutMultiplier = Math.max(0.5, params.timeoutMultiplier - 0.1);
            this.stats.parametersAdjusted++;
        }
        
        // Adjust exploration rate
        const timeoutRate = recentHistory.filter(f => f.outcomeType === OutcomeType.TIMEOUT).length / recentHistory.length;
        if (timeoutRate > 0.2) {
            // High timeout rate, reduce exploration
            params.explorationRate = Math.max(0.05, params.explorationRate - 0.01);
            this.stats.parametersAdjusted++;
        }
        
        params.lastAdjusted = Date.now();
        
        console.log(`[FeedbackSystem] Adjusted parameters for domain ${domain}`);
        this.emit('parameters:adjusted', { domain, params });
    }
    
    /**
     * Recommend strategy for a domain
     * @param {string} [domain='default'] - Domain name
     * @returns {Object} Strategy recommendation
     */
    recommendStrategy(domain = 'default') {
        console.log(`[FeedbackSystem] Recommending strategy for domain: ${domain}`);
        
        // Epsilon-greedy strategy selection
        if (Math.random() < this.explorationRate) {
            // Explore: random strategy
            const strategies = Object.values(StrategyType);
            const randomStrategy = strategies[Math.floor(Math.random() * strategies.length)];
            
            return {
                strategy: randomStrategy,
                reason: 'exploration',
                confidence: 0.5,
                expectedReward: 0
            };
        }
        
        // Exploit: best performing strategy
        const domainHistory = this.domainFeedback.get(domain) || [];
        
        if (domainHistory.length < 5) {
            // Insufficient data, use balanced strategy
            return {
                strategy: StrategyType.BALANCED,
                reason: 'insufficient_data',
                confidence: 0.6,
                expectedReward: 0
            };
        }
        
        // Calculate strategy performance for this domain
        const strategyScores = new Map();
        
        for (const strategy of Object.values(StrategyType)) {
            const strategyFeedback = domainHistory.filter(f => f.strategy === strategy);
            
            if (strategyFeedback.length === 0) {
                strategyScores.set(strategy, 0);
                continue;
            }
            
            const avgReward = strategyFeedback.reduce((sum, f) => sum + f.reward, 0) / strategyFeedback.length;
            const successRate = strategyFeedback.filter(f => f.success).length / strategyFeedback.length;
            
            // Combined score
            const score = avgReward * 0.6 + successRate * 0.4;
            strategyScores.set(strategy, score);
        }
        
        // Find best strategy
        let bestStrategy = StrategyType.BALANCED;
        let bestScore = -Infinity;
        
        for (const [strategy, score] of strategyScores.entries()) {
            if (score > bestScore) {
                bestScore = score;
                bestStrategy = strategy;
            }
        }
        
        const confidence = Math.min(0.9, 0.5 + bestScore * 0.4);
        
        return {
            strategy: bestStrategy,
            reason: 'best_performance',
            confidence: confidence,
            expectedReward: bestScore,
            alternatives: Array.from(strategyScores.entries())
                .map(([s, score]) => ({ strategy: s, score: score }))
                .sort((a, b) => b.score - a.score)
        };
    }
    
    /**
     * Get domain parameters
     * @param {string} domain - Domain name
     * @returns {Object|null} Domain parameters
     */
    getDomainParameters(domain) {
        return this.domainParameters.get(domain) || null;
    }
    
    /**
     * Get action value estimate
     * @param {string} actionType - Action type
     * @param {string} [domain='default'] - Domain name
     * @returns {number} Q-value estimate
     */
    getActionValue(actionType, domain = 'default') {
        const key = this.getActionKey(actionType, domain);
        return this.actionValues.get(key) || 0;
    }
    
    /**
     * Get performance analysis for domain
     * @param {string} domain - Domain name
     * @param {number} [windowSize=50] - Analysis window size
     * @returns {Object} Performance analysis
     */
    analyzePerformance(domain, windowSize = 50) {
        const domainHistory = this.domainFeedback.get(domain) || [];
        
        if (domainHistory.length === 0) {
            return {
                domain: domain,
                sampleSize: 0,
                successRate: 0,
                averageReward: 0,
                averageDuration: 0,
                trend: 'unknown'
            };
        }
        
        const recentHistory = domainHistory.slice(-windowSize);
        
        const successRate = recentHistory.filter(f => f.success).length / recentHistory.length;
        const averageReward = recentHistory.reduce((sum, f) => sum + f.reward, 0) / recentHistory.length;
        const averageDuration = recentHistory.reduce((sum, f) => sum + f.duration, 0) / recentHistory.length;
        
        // Calculate trend (comparing first half to second half)
        const halfSize = Math.floor(recentHistory.length / 2);
        const firstHalf = recentHistory.slice(0, halfSize);
        const secondHalf = recentHistory.slice(halfSize);
        
        const firstHalfSuccess = firstHalf.filter(f => f.success).length / firstHalf.length;
        const secondHalfSuccess = secondHalf.filter(f => f.success).length / secondHalf.length;
        
        let trend = 'stable';
        if (secondHalfSuccess > firstHalfSuccess + 0.1) trend = 'improving';
        if (secondHalfSuccess < firstHalfSuccess - 0.1) trend = 'declining';
        
        return {
            domain: domain,
            sampleSize: recentHistory.length,
            successRate: successRate,
            averageReward: averageReward,
            averageDuration: averageDuration,
            trend: trend,
            outcomeDistribution: this.getOutcomeDistribution(recentHistory)
        };
    }
    
    /**
     * Get outcome distribution
     * @private
     * @param {Array<Object>} history - Feedback history
     * @returns {Object} Outcome distribution
     */
    getOutcomeDistribution(history) {
        const distribution = {};
        
        for (const feedback of history) {
            const type = feedback.outcomeType;
            distribution[type] = (distribution[type] || 0) + 1;
        }
        
        // Convert to percentages
        for (const type in distribution) {
            distribution[type] = (distribution[type] / history.length * 100).toFixed(1) + '%';
        }
        
        return distribution;
    }
    
    /**
     * Get strategy performance comparison
     * @returns {Array<Object>} Strategy performance rankings
     */
    getStrategyComparison() {
        return Array.from(this.strategyPerformance.values())
            .map(perf => ({
                strategy: perf.strategy,
                useCount: perf.useCount,
                successRate: (perf.successRate * 100).toFixed(1) + '%',
                averageReward: perf.averageReward.toFixed(3),
                averageDuration: perf.averageDuration.toFixed(0) + 'ms'
            }))
            .sort((a, b) => parseFloat(b.averageReward) - parseFloat(a.averageReward));
    }
    
    /**
     * Update statistics
     * @private
     * @param {Object} feedback - Feedback record
     */
    updateStats(feedback) {
        this.stats.totalFeedback++;
        
        if (feedback.success) {
            this.stats.successfulOutcomes++;
        } else {
            this.stats.failedOutcomes++;
        }
        
        this.stats.totalReward += feedback.reward;
        this.stats.averageReward = this.stats.totalReward / this.stats.totalFeedback;
        
        const type = feedback.outcomeType;
        this.stats.outcomesByType[type] = (this.stats.outcomesByType[type] || 0) + 1;
    }
    
    /**
     * Get feedback system statistics
     * @returns {Object} Statistics
     */
    getStats() {
        const successRate = this.stats.totalFeedback > 0
            ? (this.stats.successfulOutcomes / this.stats.totalFeedback * 100).toFixed(1) + '%'
            : '0%';
        
        return {
            ...this.stats,
            averageReward: this.stats.averageReward.toFixed(3),
            successRate: successRate,
            historySize: this.feedbackHistory.length,
            actionValuesLearned: this.actionValues.size
        };
    }
    
    /**
     * Get recent feedback
     * @param {number} [limit=20] - Number of records to return
     * @returns {Array<Object>} Recent feedback
     */
    getRecentFeedback(limit = 20) {
        return this.feedbackHistory.slice(-limit);
    }
    
    /**
     * Clear feedback history
     * @param {string} [domain] - Specific domain to clear (or all if not specified)
     */
    clearHistory(domain = null) {
        if (domain) {
            this.domainFeedback.delete(domain);
            this.feedbackHistory = this.feedbackHistory.filter(f => f.domain !== domain);
            console.log(`[FeedbackSystem] Cleared history for domain: ${domain}`);
        } else {
            const size = this.feedbackHistory.length;
            this.feedbackHistory = [];
            this.domainFeedback.clear();
            console.log(`[FeedbackSystem] Cleared ${size} feedback records`);
        }
        
        this.emit('history:cleared', { domain });
    }
    
    /**
     * Reset feedback system
     */
    reset() {
        console.log('[FeedbackSystem] Resetting system');
        
        this.feedbackHistory = [];
        this.domainFeedback.clear();
        this.actionValues.clear();
        this.domainParameters.clear();
        this.initializeStrategies();
        
        this.stats = {
            totalFeedback: 0,
            successfulOutcomes: 0,
            failedOutcomes: 0,
            averageReward: 0,
            totalReward: 0,
            outcomesByType: {},
            domainCount: 0,
            strategyUseCount: {},
            parametersAdjusted: 0
        };
        
        this.emit('system:reset');
    }
    
    /**
     * Export feedback system state
     * @returns {Object} System state
     */
    exportState() {
        return {
            feedbackHistory: this.feedbackHistory,
            domainFeedback: Array.from(this.domainFeedback.entries()),
            strategyPerformance: Array.from(this.strategyPerformance.entries()),
            domainParameters: Array.from(this.domainParameters.entries()),
            actionValues: Array.from(this.actionValues.entries()),
            stats: this.stats
        };
    }
    
    /**
     * Import feedback system state
     * @param {Object} state - System state
     */
    importState(state) {
        console.log('[FeedbackSystem] Importing system state');
        
        this.feedbackHistory = state.feedbackHistory;
        this.domainFeedback = new Map(state.domainFeedback);
        this.strategyPerformance = new Map(state.strategyPerformance);
        this.domainParameters = new Map(state.domainParameters);
        this.actionValues = new Map(state.actionValues);
        this.stats = state.stats;
        
        this.emit('state:imported');
    }
}

module.exports = { 
    FeedbackSystem, 
    OutcomeType, 
    StrategyType 
};
