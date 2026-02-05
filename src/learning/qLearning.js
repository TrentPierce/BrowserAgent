/**
 * Q-Learning Engine
 * Implements Q-learning algorithm for action optimization
 */

class QLearning {
    constructor(config = {}) {
        this.config = {
            learningRate: config.learningRate || 0.1,
            discountFactor: config.discountFactor || 0.95,
            explorationRate: config.explorationRate || 0.3,
            explorationDecay: config.explorationDecay || 0.995,
            minExplorationRate: config.minExplorationRate || 0.05,
            ...config
        };

        this.qTable = new Map();
        this.actionSpace = [
            'navigate',
            'click',
            'type',
            'scroll',
            'wait',
            'swipe',
            'tap',
            'longPress'
        ];
    }

    /**
     * Get state key for Q-table lookup
     */
    getStateKey(state) {
        const normalized = {
            screenType: state.screenType || 'unknown',
            elementCount: Math.floor((state.elementCount || 0) / 10) * 10,
            hasModal: state.hasModal || false,
            navigationContext: JSON.stringify(state.navigationContext || {})
        };
        return JSON.stringify(normalized);
    }

    /**
     * Get Q-value for state-action pair
     */
    getQValue(state, action) {
        const stateKey = this.getStateKey(state);
        
        if (!this.qTable.has(stateKey)) {
            this.qTable.set(stateKey, new Map());
        }
        
        const stateActions = this.qTable.get(stateKey);
        
        if (!stateActions.has(action)) {
            stateActions.set(action, 0.0);
        }
        
        return stateActions.get(action);
    }

    /**
     * Set Q-value for state-action pair
     */
    setQValue(state, action, value) {
        const stateKey = this.getStateKey(state);
        
        if (!this.qTable.has(stateKey)) {
            this.qTable.set(stateKey, new Map());
        }
        
        this.qTable.get(stateKey).set(action, value);
    }

    /**
     * Get best action for current state
     */
    getBestAction(state) {
        const stateKey = this.getStateKey(state);
        
        if (!this.qTable.has(stateKey)) {
            return null;
        }
        
        const stateActions = this.qTable.get(stateKey);
        let bestAction = null;
        let bestValue = -Infinity;
        
        for (const [action, value] of stateActions.entries()) {
            if (value > bestValue) {
                bestValue = value;
                bestAction = action;
            }
        }
        
        return bestAction;
    }

    /**
     * Choose action using epsilon-greedy strategy
     */
    chooseAction(state, validActions = null) {
        const actions = validActions || this.actionSpace;
        
        // Exploration: random action
        if (Math.random() < this.config.explorationRate) {
            return actions[Math.floor(Math.random() * actions.length)];
        }
        
        // Exploitation: best known action
        const bestAction = this.getBestAction(state);
        
        if (bestAction && actions.includes(bestAction)) {
            return bestAction;
        }
        
        // Fallback to random if no learned action
        return actions[Math.floor(Math.random() * actions.length)];
    }

    /**
     * Update Q-value based on experience
     */
    update(state, action, reward, nextState, done = false) {
        const currentQ = this.getQValue(state, action);
        
        let maxNextQ = 0;
        if (!done) {
            // Find maximum Q-value for next state
            const nextStateKey = this.getStateKey(nextState);
            if (this.qTable.has(nextStateKey)) {
                const nextActions = this.qTable.get(nextStateKey);
                maxNextQ = Math.max(...Array.from(nextActions.values()));
            }
        }
        
        // Q-learning update formula
        const newQ = currentQ + this.config.learningRate * (
            reward + this.config.discountFactor * maxNextQ - currentQ
        );
        
        this.setQValue(state, action, newQ);
        
        // Decay exploration rate
        this.config.explorationRate = Math.max(
            this.config.minExplorationRate,
            this.config.explorationRate * this.config.explorationDecay
        );
    }

    /**
     * Batch update from experiences
     */
    batchUpdate(experiences) {
        for (const exp of experiences) {
            this.update(
                exp.state,
                exp.action,
                exp.reward,
                exp.nextState,
                exp.done
            );
        }
    }

    /**
     * Get Q-value statistics for a state
     */
    getStateStats(state) {
        const stateKey = this.getStateKey(state);
        
        if (!this.qTable.has(stateKey)) {
            return null;
        }
        
        const stateActions = this.qTable.get(stateKey);
        const values = Array.from(stateActions.values());
        
        return {
            count: values.length,
            mean: values.reduce((a, b) => a + b, 0) / values.length,
            max: Math.max(...values),
            min: Math.min(...values),
            actions: Array.from(stateActions.entries()).map(([action, value]) => ({
                action,
                value
            }))
        };
    }

    /**
     * Export Q-table for persistence
     */
    export() {
        const exported = {};
        
        for (const [stateKey, actions] of this.qTable.entries()) {
            exported[stateKey] = {};
            for (const [action, value] of actions.entries()) {
                exported[stateKey][action] = value;
            }
        }
        
        return {
            qTable: exported,
            config: this.config,
            timestamp: Date.now()
        };
    }

    /**
     * Import Q-table from persistence
     */
    import(data) {
        this.qTable.clear();
        
        for (const [stateKey, actions] of Object.entries(data.qTable)) {
            const actionMap = new Map();
            for (const [action, value] of Object.entries(actions)) {
                actionMap.set(action, value);
            }
            this.qTable.set(stateKey, actionMap);
        }
        
        if (data.config) {
            this.config = { ...this.config, ...data.config };
        }
        
        console.log(`[QLearning] Imported ${this.qTable.size} states from persistence`);
    }

    /**
     * Clear all learned values
     */
    reset() {
        this.qTable.clear();
        this.config.explorationRate = 0.3;
    }

    /**
     * Get total number of learned state-action pairs
     */
    getSize() {
        let total = 0;
        for (const actions of this.qTable.values()) {
            total += actions.size;
        }
        return total;
    }
}

module.exports = QLearning;
