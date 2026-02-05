# Phase 4 Quick Reference - Decision-Making and Learning

## Quick Start

### 1. Bayesian Belief Network

```javascript
const { BayesianBeliefNetwork, EvidenceSource, ActionType } = require('./beliefNetwork');

// Initialize
const network = new BayesianBeliefNetwork();

// Add evidence
network.addEvidence(EvidenceSource.DOM, ActionType.CLICK, 0.9, 0.9);
network.addEvidence(EvidenceSource.VISION, ActionType.CLICK, 0.8, 0.8);

// Compute beliefs
const beliefs = network.computeBeliefs();
const bestAction = network.getMostLikelyAction();

console.log(`Action: ${bestAction.action}, P=${bestAction.probability.toFixed(3)}`);

// Clear for next decision
network.clearEvidence();
```

### 2. Feedback System

```javascript
const { FeedbackSystem, StrategyType } = require('./feedbackSystem');

// Initialize
const feedback = new FeedbackSystem();

// Record outcome
feedback.recordOutcome(action, result, duration, success, {
    domain: 'example.com',
    strategy: StrategyType.BALANCED
});

// Get recommendation
const strategy = feedback.recommendStrategy('example.com');
console.log(`Use ${strategy.strategy} strategy`);
```

### 3. Confidence Manager

```javascript
const { ConfidenceThresholdManager } = require('./confidenceManager');

// Initialize
const manager = new ConfidenceThresholdManager();

// Select action
const candidates = [
    { action: 'click', confidence: 0.85 },
    { action: 'type', confidence: 0.7 }
];

const selection = manager.selectAction(candidates, 'example.com');
console.log(`Selected: ${selection.action.action}`);
console.log(`Risk: ${selection.risk.level}`);
```

## Common Patterns

### Pattern 1: Evidence-Based Decision

```javascript
const network = new BayesianBeliefNetwork();

// Collect evidence from analyses
for (const result of analysisResults) {
    network.addEvidence(
        result.source,
        result.action,
        result.confidence,
        0.9
    );
}

// Decide
const beliefs = network.computeBeliefs();
const action = network.getMostLikelyAction();

if (action.uncertainty < 0.3) {
    executeAction(action);
} else {
    console.warn('High uncertainty, gathering more evidence');
}
```

### Pattern 2: Learning Loop

```javascript
const feedback = new FeedbackSystem();

// Execute and learn
const domain = getDomain(url);
const strategy = feedback.recommendStrategy(domain);

const startTime = Date.now();
const success = await executeAction(action);
const duration = Date.now() - startTime;

feedback.recordOutcome(
    action,
    { success },
    duration,
    success,
    { domain, strategy: strategy.strategy }
);
```

### Pattern 3: Confidence-Based Fallback

```javascript
const manager = new ConfidenceThresholdManager();

const selection = manager.selectAction(candidates, domain);

switch (selection.level) {
    case 'very_high':
    case 'high':
        await execute(selection.action);
        break;
    
    case 'medium':
        await executeWithMonitoring(selection.action);
        break;
    
    case 'low':
        await executeWithFallback(selection.action);
        break;
    
    case 'very_low':
        await handleLowConfidence(selection);
        break;
}
```

## Configuration Cheat Sheet

### Bayesian Belief Network

| Option | Default | Description |
|--------|---------|-------------|
| defaultPrior | 0.16 | Default action prior |
| evidenceDecay | 0.95 | Evidence decay per second |
| minConfidence | 0.3 | Min confidence threshold |
| useConditionalDependencies | true | Model source dependencies |

### Feedback System

| Option | Default | Description |
|--------|---------|-------------|
| learningRate | 0.1 | Q-learning rate (α) |
| discountFactor | 0.9 | Future reward discount (γ) |
| explorationRate | 0.1 | ε for ε-greedy |
| maxFeedbackHistory | 1000 | Max feedback records |
| enableDomainLearning | true | Domain-specific learning |

### Confidence Manager

| Option | Default | Description |
|--------|---------|-------------|
| defaultHighThreshold | 0.75 | High confidence threshold |
| defaultMediumThreshold | 0.6 | Medium confidence threshold |
| defaultLowThreshold | 0.4 | Low confidence threshold |
| adjustmentRate | 0.05 | Threshold adjustment rate |
| minPerformanceSamples | 20 | Min samples for adjustment |
| enableDomainOptimization | true | Domain-specific thresholds |

## Enumerations

### Evidence Sources

```javascript
EvidenceSource.DOM
EvidenceSource.VISION
EvidenceSource.PATTERN
EvidenceSource.HEURISTIC
EvidenceSource.LEARNING
EvidenceSource.TEMPORAL
```

### Action Types

```javascript
ActionType.CLICK
ActionType.TYPE
ActionType.SCROLL
ActionType.NAVIGATE
ActionType.WAIT
ActionType.COMPLETE
```

### Evidence Strength

```javascript
EvidenceStrength.VERY_STRONG  // 0.9-1.0
EvidenceStrength.STRONG       // 0.7-0.9
EvidenceStrength.MODERATE     // 0.5-0.7
EvidenceStrength.WEAK         // 0.3-0.5
EvidenceStrength.VERY_WEAK    // 0.0-0.3
```

### Outcome Types

```javascript
OutcomeType.SUCCESS
OutcomeType.FAILURE
OutcomeType.TIMEOUT
OutcomeType.ERROR
OutcomeType.PARTIAL
```

### Strategy Types

```javascript
StrategyType.CONSERVATIVE
StrategyType.BALANCED
StrategyType.AGGRESSIVE
StrategyType.ADAPTIVE
```

### Confidence Levels

```javascript
ConfidenceLevel.VERY_HIGH
ConfidenceLevel.HIGH
ConfidenceLevel.MEDIUM
ConfidenceLevel.LOW
ConfidenceLevel.VERY_LOW
```

### Risk Levels

```javascript
RiskLevel.MINIMAL
RiskLevel.LOW
RiskLevel.MODERATE
RiskLevel.HIGH
RiskLevel.VERY_HIGH
```

## Common Methods

### Bayesian Belief Network

```javascript
network.setActionPrior(action, probability)
network.setSourceWeight(source, weight)
network.setDependency(source1, source2, correlation)
network.addEvidence(source, action, likelihood, confidence)
network.computeBeliefs()
network.getBelief(action)
network.getMostLikelyAction()
network.getRankedActions(minProbability)
network.clearEvidence()
network.clearBeliefs()
network.reset()
network.getStats()
network.exportState()
network.importState(state)
```

### Feedback System

```javascript
feedback.recordOutcome(action, result, duration, success, metadata)
feedback.recommendStrategy(domain)
feedback.getDomainParameters(domain)
feedback.getActionValue(actionType, domain)
feedback.analyzePerformance(domain, windowSize)
feedback.getStrategyComparison()
feedback.getRecentFeedback(limit)
feedback.clearHistory(domain)
feedback.reset()
feedback.getStats()
feedback.exportState()
feedback.importState(state)
```

### Confidence Manager

```javascript
manager.getThresholds(domain)
manager.setThresholds(domain, thresholds)
manager.classifyConfidence(confidence, domain)
manager.selectAction(candidates, domain, options)
manager.assessRisk(confidence, action, domain)
manager.recordOutcome(domain, confidence, success, level)
manager.getFallbackChain(level)
manager.getSuccessRates()
manager.getDomainPerformance(domain)
manager.clearHistory(domain)
manager.reset()
manager.getStats()
```

## Complete Example

```javascript
const { BayesianBeliefNetwork, EvidenceSource, ActionType } = require('./beliefNetwork');
const { FeedbackSystem, StrategyType } = require('./feedbackSystem');
const { ConfidenceThresholdManager, ConfidenceLevel } = require('./confidenceManager');

async function makeIntelligentDecision(analysisResults, domain) {
    // 1. Initialize components
    const network = new BayesianBeliefNetwork();
    const feedback = new FeedbackSystem();
    const manager = new ConfidenceThresholdManager();
    
    // 2. Get strategy recommendation
    const strategyRec = feedback.recommendStrategy(domain);
    console.log(`Strategy: ${strategyRec.strategy}`);
    
    // 3. Add evidence to belief network
    for (const result of analysisResults) {
        network.addEvidence(
            result.source,
            result.action,
            result.confidence,
            0.9
        );
    }
    
    // 4. Compute beliefs
    const beliefs = network.computeBeliefs();
    const ranked = network.getRankedActions(0.1);
    
    // 5. Select action with confidence management
    const candidates = ranked.map(b => ({
        action: b.action,
        confidence: b.probability,
        uncertainty: b.uncertainty,
        evidenceStrength: b.strength
    }));
    
    const selection = manager.selectAction(candidates, domain);
    
    console.log(`Selected: ${selection.action.action}`);
    console.log(`Confidence: ${selection.confidence.toFixed(2)}`);
    console.log(`Level: ${selection.level}`);
    console.log(`Risk: ${selection.risk.level}`);
    
    // 6. Execute based on confidence level
    let outcome;
    
    if (selection.level === ConfidenceLevel.VERY_LOW) {
        console.warn('Confidence too low, using safe alternative');
        outcome = await executeSafeAction();
    } else {
        outcome = await executeAction(
            selection.action,
            {
                retries: selection.strategy.maxRetries,
                timeout: selection.strategy.timeout
            }
        );
    }
    
    // 7. Record feedback
    const duration = outcome.duration || 0;
    const success = outcome.success || false;
    
    feedback.recordOutcome(
        selection.action,
        outcome,
        duration,
        success,
        {
            domain: domain,
            strategy: strategyRec.strategy,
            confidence: selection.confidence
        }
    );
    
    manager.recordOutcome(
        domain,
        selection.confidence,
        success,
        selection.level
    );
    
    // 8. Clean up
    network.clearEvidence();
    
    return outcome;
}
```

## Helper Functions

### Extract Domain from URL

```javascript
function extractDomain(url) {
    try {
        const parsed = new URL(url);
        return parsed.hostname;
    } catch {
        return 'default';
    }
}
```

### Get Source Reliability

```javascript
function getSourceReliability(source) {
    const weights = {
        'dom': 1.0,
        'vision': 0.9,
        'pattern': 0.85,
        'heuristic': 0.8,
        'learning': 0.75,
        'temporal': 0.85
    };
    return weights[source] || 0.7;
}
```

### Convert Analysis to Evidence

```javascript
function analysisToEvidence(analysisResult) {
    return {
        source: analysisResult.source,
        action: analysisResult.action,
        likelihood: analysisResult.confidence,
        confidence: getSourceReliability(analysisResult.source),
        metadata: analysisResult.metadata
    };
}
```

## Performance Tips

### 1. Efficient Evidence Collection

```javascript
// Collect evidence in parallel
const evidencePromises = analysisResults.map(async result => {
    return analysisToEvidence(result);
});

const evidence = await Promise.all(evidencePromises);

// Add all at once
for (const e of evidence) {
    network.addEvidence(e.source, e.action, e.likelihood, e.confidence);
}
```

### 2. Domain-Specific Optimization

```javascript
// Use domain parameters when available
const params = feedback.getDomainParameters(domain);

if (params) {
    manager.setThresholds(domain, {
        high: params.confidenceThreshold,
        medium: params.confidenceThreshold - 0.15,
        low: params.confidenceThreshold - 0.3
    });
}
```

### 3. Batch Processing

```javascript
// Record multiple outcomes
const outcomes = [...]; // Array of outcomes

for (const outcome of outcomes) {
    feedback.recordOutcome(
        outcome.action,
        outcome.result,
        outcome.duration,
        outcome.success,
        { domain: outcome.domain }
    );
}
```

## Debugging

### Check Belief Computation

```javascript
const network = new BayesianBeliefNetwork();

// Add evidence
network.addEvidence(EvidenceSource.DOM, ActionType.CLICK, 0.9, 0.9);

// Compute
const beliefs = network.computeBeliefs();

// Inspect
console.log('Beliefs computed:', beliefs.size);
for (const [action, belief] of beliefs.entries()) {
    console.log(`${action}: ${belief.probability.toFixed(3)}, uncertainty: ${belief.uncertainty.toFixed(3)}`);
}

// Check total probability
const total = Array.from(beliefs.values())
    .reduce((sum, b) => sum + b.probability, 0);
console.log('Total probability:', total.toFixed(3)); // Should be ~1.0
```

### Monitor Learning Progress

```javascript
const feedback = new FeedbackSystem();

// Check Q-values
const qValue = feedback.getActionValue('click', 'example.com');
console.log('Q-value for click:', qValue);

// Check performance
const perf = feedback.analyzePerformance('example.com');
console.log('Success rate:', (perf.successRate * 100).toFixed(1) + '%');
console.log('Trend:', perf.trend);

// Check strategy performance
const comparison = feedback.getStrategyComparison();
console.log('Best strategy:', comparison[0].strategy);
```

### Verify Threshold Adjustment

```javascript
const manager = new ConfidenceThresholdManager();

// Record outcomes
for (let i = 0; i < 30; i++) {
    manager.recordOutcome('test.com', 0.8, true, 'high');
}

// Check thresholds
const thresholds = manager.getThresholds('test.com');
console.log('Thresholds:', thresholds);

// Check adjustments
const stats = manager.getStats();
console.log('Adjustments made:', stats.thresholdAdjustments);
```

## Use Cases

### Use Case 1: Probabilistic Action Selection

```javascript
// Multiple analyses suggest different actions
const results = [
    { source: 'dom', action: 'click', confidence: 0.8 },
    { source: 'vision', action: 'scroll', confidence: 0.7 },
    { source: 'heuristic', action: 'click', confidence: 0.75 }
];

const network = new BayesianBeliefNetwork();

for (const r of results) {
    network.addEvidence(r.source, r.action, r.confidence, 0.9);
}

const beliefs = network.computeBeliefs();
const decision = network.getMostLikelyAction();

// click wins with combined evidence
console.log(`Decision: ${decision.action}`);
console.log(`Probability: ${decision.probability.toFixed(3)}`);
```

### Use Case 2: Domain Adaptation

```javascript
const feedback = new FeedbackSystem({ enableDomainLearning: true });

// Record performance on domain
for (const action of actionHistory) {
    feedback.recordOutcome(
        action.action,
        action.result,
        action.duration,
        action.success,
        { domain: 'example.com' }
    );
}

// Get optimized parameters
const params = feedback.getDomainParameters('example.com');

console.log('Learned parameters:');
console.log('- Confidence threshold:', params.confidenceThreshold);
console.log('- Timeout multiplier:', params.timeoutMultiplier);
console.log('- Exploration rate:', params.explorationRate);

// Use parameters
applyParameters(params);
```

### Use Case 3: Risk-Aware Execution

```javascript
const manager = new ConfidenceThresholdManager();

const selection = manager.selectAction(candidates, domain);

// Check risk before executing
if (selection.risk.level === 'very_high') {
    console.error('Action too risky, seeking alternatives');
    
    if (selection.alternatives && selection.alternatives.length > 0) {
        // Try safer alternative
        const safer = selection.alternatives.find(alt => 
            manager.assessRisk(alt.confidence, alt, domain).level !== 'very_high'
        );
        
        if (safer) {
            await executeAction(safer);
        }
    }
} else {
    await executeAction(selection.action);
}
```

### Use Case 4: Strategy Evolution

```javascript
const feedback = new FeedbackSystem();

// Track strategy performance
const domains = ['site1.com', 'site2.com', 'site3.com'];

for (const domain of domains) {
    const perf = feedback.analyzePerformance(domain);
    
    console.log(`${domain}:`);
    console.log('- Success rate:', (perf.successRate * 100).toFixed(1) + '%');
    console.log('- Trend:', perf.trend);
    
    if (perf.trend === 'declining') {
        console.warn(`Performance declining on ${domain}, adjusting strategy`);
    }
}

// Compare strategies
const comparison = feedback.getStrategyComparison();

console.log('Strategy Rankings:');
for (const s of comparison) {
    console.log(`${s.strategy}: ${s.successRate}, avg reward: ${s.averageReward}`);
}
```

## Statistics Interpretation

### Belief Network Stats

```javascript
const stats = network.getStats();

// Quality indicators
if (parseFloat(stats.averageConfidence) > 0.8) {
    console.log('High confidence decisions');
}

if (stats.totalEvidence / stats.currentBeliefs > 2) {
    console.log('Good evidence diversity');
}
```

### Feedback Stats

```javascript
const stats = feedback.getStats();

// Performance indicators
if (parseFloat(stats.successRate) > 85) {
    console.log('Excellent performance');
}

if (parseFloat(stats.averageReward) > 0.5) {
    console.log('Positive learning trend');
}

// Domain coverage
if (stats.domainCount > 10) {
    console.log('Learning across multiple domains');
}
```

### Confidence Stats

```javascript
const stats = manager.getStats();

// Threshold quality
if (stats.thresholdAdjustments > 10) {
    console.log('Thresholds actively optimizing');
}

// Selection distribution
const highPercentage = (stats.selectionsByLevel.high || 0) / stats.totalSelections;

if (highPercentage > 0.6) {
    console.log('Mostly high-confidence decisions');
}
```

## Integration with TaskOrchestrator

```javascript
const { TaskOrchestrator } = require('./taskOrchestrator');

// Enable decision fusion
const orchestrator = new TaskOrchestrator({
    enableDecisionFusion: true
});

// Analysis returns enhanced result
const result = await orchestrator.executeParallelAnalysis(data, {
    useDecisionFusion: true
});

// Access Phase 4 enhancements
if (result.metadata?.belief) {
    console.log('Posterior probability:', result.metadata.belief.probability);
    console.log('Uncertainty:', result.metadata.belief.uncertainty);
}

if (result.metadata?.risk) {
    console.log('Risk level:', result.metadata.risk.level);
}

if (result.metadata?.strategy) {
    console.log('Recommended strategy:', result.metadata.strategy);
}
```

## Error Handling

### Graceful Degradation

```javascript
async function robustDecisionMaking(analysisResults, domain) {
    try {
        // Try Bayesian approach
        const network = new BayesianBeliefNetwork();
        
        for (const result of analysisResults) {
            network.addEvidence(
                result.source,
                result.action,
                result.confidence,
                0.9
            );
        }
        
        const beliefs = network.computeBeliefs();
        return network.getMostLikelyAction();
        
    } catch (error) {
        console.warn('Bayesian decision failed, using fallback');
        
        // Fallback to simple max confidence
        return analysisResults.reduce((best, r) => 
            r.confidence > best.confidence ? r : best
        );
    }
}
```

## Testing

### Quick Test

```javascript
function testPhase4() {
    // Test Bayesian network
    const network = new BayesianBeliefNetwork();
    network.addEvidence('dom', 'click', 0.9, 0.9);
    const beliefs = network.computeBeliefs();
    assert(beliefs.size > 0);
    
    // Test feedback system
    const feedback = new FeedbackSystem();
    feedback.recordOutcome({ action: 'click' }, {}, 1000, true, { domain: 'test' });
    const rec = feedback.recommendStrategy('test');
    assert(rec.confidence >= 0);
    
    // Test confidence manager
    const manager = new ConfidenceThresholdManager();
    const sel = manager.selectAction([{ action: 'click', confidence: 0.8 }], 'test');
    assert(sel.action !== null);
    
    console.log('Phase 4 tests passed');
}
```

## Optimization Strategies

### 1. Tune Learning Rate

```javascript
// Fast learning for new domains
feedback.learningRate = 0.2;

// Slow learning for stable domains
feedback.learningRate = 0.05;

// Adaptive learning rate
const performance = feedback.analyzePerformance(domain);
if (performance.trend === 'declining') {
    feedback.learningRate *= 1.5;  // Learn faster
}
```

### 2. Balance Exploration/Exploitation

```javascript
// More exploration early
feedback.explorationRate = 0.2;

// Less exploration when confident
if (feedback.getDomainParameters(domain)) {
    feedback.explorationRate = 0.05;
}

// Adaptive exploration
const qValue = feedback.getActionValue('click', domain);
if (Math.abs(qValue) < 0.1) {
    feedback.explorationRate = 0.3;  // Explore more
}
```

### 3. Optimize Thresholds

```javascript
// Start conservative
manager.setThresholds(domain, {
    high: 0.85,
    medium: 0.7,
    low: 0.5
});

// Let system optimize over time
// After 20+ samples, thresholds auto-adjust
```

## Resources

- **Full Documentation**: PHASE4_IMPLEMENTATION.md
- **Summary**: PHASE4_SUMMARY.md
- **All Phases**: ALL_PHASES_COMPLETE.md
- **Source Code**: beliefNetwork.js, feedbackSystem.js, confidenceManager.js

## Common Issues

**Q: Beliefs not stable**  
A: This is expected as evidence changes. Clear evidence between decisions.

**Q: Strategy recommendations inconsistent**  
A: Need more feedback samples (10+) or reduce exploration rate.

**Q: Thresholds not adjusting**  
A: Need 20+ performance samples and recordOutcome calls.

**Q: High memory usage**  
A: Reduce maxFeedbackHistory or clear history more frequently.

---

**Quick Start Time**: <5 minutes  
**Learning Required**: Bayesian inference, reinforcement learning basics  
**Production Ready**: Yes  
**Dependencies**: Node.js built-ins only
