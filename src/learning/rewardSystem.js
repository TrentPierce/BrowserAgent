/**
 * Reward System
 * Calculates rewards and penalties for actions
 */

class RewardSystem {
    constructor(config = {}) {
        this.config = {
            successReward: config.successReward || 10.0,
            progressReward: config.progressReward || 5.0,
            neutralReward: config.neutralReward || 0.0,
            failurePenalty: config.failurePenalty || -5.0,
            errorPenalty: config.errorPenalty || -10.0,
            stuckPenalty: config.stuckPenalty || -3.0,
            efficiencyBonus: config.efficiencyBonus || 2.0,
            timeoutPenalty: config.timeoutPenalty || -8.0,
            ...config
        };

        this.previousStates = [];
        this.actionHistory = [];
    }

    /**
     * Calculate reward for an action outcome
     */
    calculateReward(outcome) {
        const {
            action,
            success,
            error,
            stateChange,
            goalProgress,
            timeTaken,
            isStuck,
            timeout
        } = outcome;

        let reward = this.config.neutralReward;

        // Base rewards/penalties
        if (timeout) {
            reward += this.config.timeoutPenalty;
        } else if (error) {
            reward += this.config.errorPenalty;
        } else if (!success) {
            reward += this.config.failurePenalty;
        } else if (goalProgress === 'complete') {
            reward += this.config.successReward;
        } else if (goalProgress === 'progress') {
            reward += this.config.progressReward;
        }

        // State change bonus/penalty
        if (stateChange) {
            const stateReward = this.evaluateStateChange(stateChange);
            reward += stateReward;
        }

        // Stuck penalty
        if (isStuck) {
            reward += this.config.stuckPenalty;
        }

        // Efficiency bonus (faster actions get bonus)
        if (success && timeTaken < 2000) {
            reward += this.config.efficiencyBonus;
        }

        // Action-specific adjustments
        reward += this.getActionModifier(action, outcome);

        // Track action in history
        this.actionHistory.push({
            action,
            reward,
            timestamp: Date.now()
        });

        return reward;
    }

    /**
     * Evaluate if state change was beneficial
     */
    evaluateStateChange(stateChange) {
        const { from, to } = stateChange;

        // Moving forward in app flow is positive
        const progressionMap = {
            'LOGIN': 1,
            'REGISTRATION': 1,
            'HOME': 2,
            'LIST': 3,
            'DETAIL': 4,
            'FORM': 3,
            'SEARCH': 3
        };

        const fromLevel = progressionMap[from] || 0;
        const toLevel = progressionMap[to] || 0;

        if (toLevel > fromLevel) {
            return 3.0; // Progress bonus
        } else if (toLevel < fromLevel) {
            return -2.0; // Regression penalty
        }

        return 0.0;
    }

    /**
     * Get action-specific reward modifiers
     */
    getActionModifier(action, outcome) {
        let modifier = 0;

        switch (action) {
            case 'click':
            case 'tap':
                // Successful clicks on visible elements are good
                if (outcome.success && outcome.elementVisible) {
                    modifier += 1.0;
                }
                break;

            case 'type':
                // Typing in correct inputs is good
                if (outcome.success && outcome.inputAccepted) {
                    modifier += 1.5;
                }
                break;

            case 'scroll':
            case 'swipe':
                // Scrolling should reveal new content
                if (outcome.newContentRevealed) {
                    modifier += 1.0;
                } else {
                    modifier -= 0.5; // Wasteful scroll
                }
                break;

            case 'wait':
                // Waiting should be necessary
                if (outcome.contentLoaded) {
                    modifier += 0.5;
                } else {
                    modifier -= 1.0; // Unnecessary wait
                }
                break;

            case 'navigate':
                // Navigation should lead to new page
                if (outcome.pageChanged) {
                    modifier += 2.0;
                }
                break;

            case 'longPress':
                // Long press should trigger contextual action
                if (outcome.contextMenuAppeared) {
                    modifier += 1.5;
                }
                break;
        }

        return modifier;
    }

    /**
     * Calculate reward for goal completion
     */
    calculateGoalReward(outcome) {
        const {
            goalAchieved,
            stepsCount,
            timeElapsed,
            errorsCount,
            optimalSteps
        } = outcome;

        if (!goalAchieved) {
            return this.config.errorPenalty;
        }

        let reward = this.config.successReward * 2;

        // Efficiency bonus
        if (optimalSteps && stepsCount <= optimalSteps) {
            reward += this.config.efficiencyBonus * 3;
        } else if (optimalSteps) {
            const overhead = stepsCount - optimalSteps;
            reward -= overhead * 0.5;
        }

        // Time bonus
        if (timeElapsed < 30000) {
            reward += 5.0;
        } else if (timeElapsed > 120000) {
            reward -= 3.0;
        }

        // Error penalty
        reward -= errorsCount * 2.0;

        return Math.max(reward, 0);
    }

    /**
     * Get shaping reward for intermediate steps
     */
    getShapingReward(progress) {
        const {
            currentStep,
            totalSteps,
            distanceToGoal,
            previousDistance
        } = progress;

        let reward = 0;

        // Progress through steps
        if (totalSteps > 0) {
            const progressRatio = currentStep / totalSteps;
            reward += progressRatio * 2.0;
        }

        // Distance to goal decreased
        if (previousDistance !== undefined && distanceToGoal < previousDistance) {
            reward += 1.0;
        } else if (previousDistance !== undefined && distanceToGoal > previousDistance) {
            reward -= 0.5;
        }

        return reward;
    }

    /**
     * Evaluate action quality
     */
    evaluateActionQuality(action, context) {
        const {
            screenType,
            availableElements,
            previousAction,
            goalContext
        } = context;

        let quality = 0.5; // Neutral

        // Check if action is appropriate for screen type
        const appropriateActions = this.getAppropriateActions(screenType);
        if (appropriateActions.includes(action)) {
            quality += 0.2;
        }

        // Check for repeated actions
        if (previousAction === action) {
            quality -= 0.1;
        }

        // Check if action is possible
        if (action === 'click' || action === 'tap') {
            if (availableElements && availableElements.length > 0) {
                quality += 0.2;
            } else {
                quality -= 0.3;
            }
        }

        return quality;
    }

    /**
     * Get appropriate actions for screen type
     */
    getAppropriateActions(screenType) {
        const actionMap = {
            'LOGIN': ['type', 'click', 'tap'],
            'REGISTRATION': ['type', 'click', 'tap', 'scroll'],
            'HOME': ['click', 'tap', 'scroll', 'swipe'],
            'LIST': ['click', 'tap', 'scroll', 'swipe'],
            'DETAIL': ['click', 'tap', 'scroll', 'longPress'],
            'FORM': ['type', 'click', 'tap', 'scroll'],
            'SEARCH': ['type', 'click', 'tap'],
            'WEBVIEW': ['click', 'type', 'scroll', 'navigate']
        };

        return actionMap[screenType] || ['click', 'tap', 'scroll'];
    }

    /**
     * Get reward statistics
     */
    getStats() {
        if (this.actionHistory.length === 0) {
            return null;
        }

        const rewards = this.actionHistory.map(a => a.reward);
        const total = rewards.reduce((a, b) => a + b, 0);
        const positive = rewards.filter(r => r > 0).length;
        const negative = rewards.filter(r => r < 0).length;

        return {
            totalReward: total,
            averageReward: total / rewards.length,
            maxReward: Math.max(...rewards),
            minReward: Math.min(...rewards),
            positiveActions: positive,
            negativeActions: negative,
            totalActions: rewards.length
        };
    }

    /**
     * Reset reward history
     */
    reset() {
        this.actionHistory = [];
        this.previousStates = [];
    }
}

module.exports = RewardSystem;
