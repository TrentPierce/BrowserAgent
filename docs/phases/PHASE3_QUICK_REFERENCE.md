# Phase 3 Quick Reference Guide

## Installation

No additional dependencies required. Phase 3 uses Node.js built-in modules.

```bash
# Already in your project
npm install
```

## Quick Start

### 1. State Tracking

```javascript
const { StateTracker, ChangeType } = require('./stateTracker');

// Initialize
const tracker = new StateTracker({ maxHistory: 50 });

// Capture states
tracker.captureState({ dom, screenshot, url, viewport });
tracker.captureState({ dom: newDom, screenshot: newScreenshot, url, viewport });

// Detect changes
const changes = tracker.detectChanges();
console.log('Changes:', changes.changeTypes);
console.log('Magnitude:', changes.magnitude);
```

### 2. Animation Detection

```javascript
const { AnimationDetector, LoadingState } = require('./animationDetector');

// Initialize
const detector = new AnimationDetector();

// Analyze animations
const analysis = await detector.analyzeAnimations({
    dom, screenshot, previousScreenshot
});

// Check loading
if (detector.isPageLoading()) {
    await detector.waitForCompletion(5000);
}
```

### 3. Transition Prediction

```javascript
const { TransitionPredictor } = require('./transitionPredictor');

// Initialize
const predictor = new TransitionPredictor();

// Record transition
predictor.recordTransition(fromState, toState, action, duration, success);

// Predict next transition
const prediction = predictor.predictTransition(currentState, proposedAction);
console.log('Success probability:', prediction.successProbability);
```

### 4. Full Temporal Analysis

```javascript
const { TaskOrchestrator } = require('./taskOrchestrator');

// Initialize with temporal analysis
const orchestrator = new TaskOrchestrator({
    enableTemporalAnalysis: true
});

// Execute analysis
const result = await orchestrator.executeParallelAnalysis({
    dom, screenshot, url, viewport, goal
}, {
    useTemporalAnalysis: true
});
```

## Common Patterns

### Pattern 1: Wait for Page Stability

```javascript
const tracker = new StateTracker();

// Capture states
tracker.captureState(state1);
await sleep(500);
tracker.captureState(state2);

// Check stability
const stability = tracker.calculateStability(5);

if (!stability.stable) {
    console.log('Page volatile, waiting...');
    await sleep(1000);
}
```

### Pattern 2: Detect and Wait for Loading

```javascript
const detector = new AnimationDetector();

const analysis = await detector.analyzeAnimations({ dom, screenshot });

if (analysis.shouldWait) {
    console.log(`Waiting ${analysis.estimatedCompletionTime}ms`);
    await detector.waitForCompletion(analysis.estimatedCompletionTime);
}
```

### Pattern 3: Smart Action Timing

```javascript
const predictor = new TransitionPredictor();

// Predict transition
const prediction = predictor.predictTransition(currentState, action);

// Adjust timeout
const timeout = prediction.estimatedDuration * 1.5;

// Execute with predicted timeout
await executeWithTimeout(action, timeout);
```

### Pattern 4: Workflow-Aware Execution

```javascript
const predictor = new TransitionPredictor();

// Get recent transitions
const recent = predictor.getHistory(10);

// Detect pattern
const pattern = predictor.detectWorkflowPattern(recent);

if (pattern.pattern === 'login') {
    console.log('In login workflow');
    console.log('Progress:', pattern.confidence);
}
```

## Configuration Cheat Sheet

### StateTracker

| Option | Default | Description |
|--------|---------|-------------|
| maxHistory | 50 | Maximum states to retain |
| visualThreshold | 0.05 | Visual change threshold |
| domThreshold | 0.1 | DOM change threshold |
| scrollThreshold | 50 | Scroll change threshold (px) |
| enableDiffing | true | Enable screenshot diffing |

### AnimationDetector

| Option | Default | Description |
|--------|---------|-------------|
| minDuration | 100 | Min animation duration (ms) |
| maxDuration | 5000 | Max animation duration (ms) |
| frameRateThreshold | 30 | Min FPS for smooth animation |
| detectLoading | true | Enable loading detection |

### TransitionPredictor

| Option | Default | Description |
|--------|---------|-------------|
| maxTransitionHistory | 200 | Max transitions to store |
| similarityThreshold | 0.7 | Similarity threshold (0-1) |
| minSamplesForPrediction | 3 | Min samples for prediction |
| enableLearning | true | Enable adaptive learning |

### TaskOrchestrator (Phase 3)

| Option | Default | Description |
|--------|---------|-------------|
| enableTemporalAnalysis | true | Enable Phase 3 temporal analysis |

## Enumerations

### Change Types

```javascript
ChangeType.VISUAL      // Visual changes
ChangeType.DOM         // DOM changes
ChangeType.URL         // URL changes
ChangeType.SCROLL      // Scroll changes
ChangeType.VIEWPORT    // Viewport changes
ChangeType.NONE        // No changes
```

### Animation Types

```javascript
AnimationType.CSS_ANIMATION
AnimationType.CSS_TRANSITION
AnimationType.JS_ANIMATION
AnimationType.LOADING_SPINNER
AnimationType.PROGRESS_BAR
AnimationType.FADE
AnimationType.SLIDE
AnimationType.SCALE
AnimationType.ROTATE
```

### Loading States

```javascript
LoadingState.IDLE
LoadingState.LOADING
LoadingState.TRANSITIONING
LoadingState.COMPLETE
```

### Workflow Patterns

```javascript
WorkflowPattern.LOGIN
WorkflowPattern.REGISTRATION
WorkflowPattern.CHECKOUT
WorkflowPattern.SEARCH
WorkflowPattern.NAVIGATION
WorkflowPattern.FORM_SUBMISSION
WorkflowPattern.MULTI_STEP_FORM
WorkflowPattern.MODAL_INTERACTION
```

## Common Methods

### StateTracker

```javascript
tracker.captureState(state)               // Capture state
tracker.detectChanges()                   // Detect changes
tracker.getCurrentState()                 // Get current state
tracker.getPreviousState()                // Get previous state
tracker.getHistory(limit)                 // Get history
tracker.compareStates(id1, id2)           // Compare states
tracker.calculateStability(windowSize)    // Check stability
tracker.getStats()                        // Get statistics
tracker.clearHistory(keepLast)            // Clear history
tracker.reset()                           // Reset tracker
```

### AnimationDetector

```javascript
detector.analyzeAnimations(data)          // Analyze animations
detector.isPageLoading()                  // Check loading
detector.isPageTransitioning()            // Check transitioning
detector.getLoadingState()                // Get state
detector.predictCompletion()              // Predict completion
detector.waitForCompletion(timeout)       // Wait for completion
detector.analyzeFrameRate(stateHistory)   // Analyze FPS
detector.getStats()                       // Get statistics
detector.clearHistory()                   // Clear history
detector.reset()                          // Reset detector
```

### TransitionPredictor

```javascript
predictor.recordTransition(from, to, action, duration, success) // Record
predictor.predictTransition(state, action)                      // Predict
predictor.getActionTimings(actionType)                          // Get timings
predictor.detectWorkflowPattern(transitions)                    // Detect pattern
predictor.predictWorkflowCompletion(transitions, state)         // Predict completion
predictor.validatePrediction(id, success, duration)             // Validate
predictor.getHistory(limit)                                     // Get history
predictor.getStats()                                            // Get statistics
predictor.clearHistory()                                        // Clear history
predictor.reset()                                               // Reset predictor
```

## Event Handling

### State Tracking Events

```javascript
tracker.on('state:captured', ({ stateId, timestamp }) => {
    console.log(`State ${stateId} captured`);
});

tracker.on('changes:detected', (changes) => {
    console.log('Changes:', changes.changeTypes);
});
```

### Animation Detection Events

```javascript
detector.on('loading:started', () => {
    console.log('Loading started');
});

detector.on('loading:completed', ({ duration }) => {
    console.log(`Loaded in ${duration}ms`);
});
```

### Prediction Events

```javascript
predictor.on('transition:recorded', ({ transition }) => {
    console.log('Transition recorded:', transition.action.type);
});

predictor.on('prediction:made', (prediction) => {
    console.log('Prediction:', prediction.predictedOutcome);
});
```

## Helper Functions

### Get State Snapshot

```javascript
async function capturePageState(guestWebContents) {
    const dom = await getSimplifiedDOM(guestWebContents);
    const screenshot = await guestWebContents.capturePage();
    const base64 = screenshot.toJPEG(70).toString('base64');
    const url = guestWebContents.getURL();
    
    const viewport = await guestWebContents.executeJavaScript(`({
        width: window.innerWidth,
        height: window.innerHeight,
        scrollY: window.scrollY,
        scrollX: window.scrollX
    })`);
    
    return { dom, screenshot: base64, url, viewport };
}
```

### Record Complete Transition

```javascript
async function recordActionTransition(orchestrator, action, guestWebContents) {
    // Capture before state
    const beforeState = orchestrator.stateTracker.getCurrentState();
    const startTime = Date.now();
    
    // Execute action
    const success = await executeAction(action);
    
    // Wait for settle
    await sleep(500);
    
    // Capture after state
    const afterStateData = await capturePageState(guestWebContents);
    orchestrator.stateTracker.captureState(afterStateData);
    const afterState = orchestrator.stateTracker.getCurrentState();
    
    // Record transition
    const duration = Date.now() - startTime;
    orchestrator.transitionPredictor.recordTransition(
        beforeState,
        afterState,
        action,
        duration,
        success
    );
}
```

## Performance Tips

### 1. Optimize State History

```javascript
// Keep smaller history for memory efficiency
const tracker = new StateTracker({ maxHistory: 30 });

// Clear old states periodically
setInterval(() => {
    tracker.clearHistory(20);
}, 300000); // 5 minutes
```

### 2. Selective Temporal Analysis

```javascript
// Only use temporal when needed
const needsTemporal = 
    pageHasAnimations ||
    pageChangesFrequently ||
    complexWorkflow;

await orchestrator.executeParallelAnalysis(data, {
    useTemporalAnalysis: needsTemporal
});
```

### 3. Cache Animation Patterns

```javascript
// Animation patterns repeat
// Detector learns from repeated patterns
// No manual caching needed
```

### 4. Efficient Prediction

```javascript
// Predictor uses similarity search
// More historical data = better predictions
// But limited to 200 transitions for performance
```

## Debugging

### Enable Verbose Logging

All components log with component prefix:

```javascript
// StateTracker logs
[StateTracker] Initialized with maxHistory: 50
[StateTracker] Captured state abc-123 (history: 5)
[StateTracker] Detecting changes between states
[StateTracker] Detected 2 change types with magnitude 0.450

// AnimationDetector logs
[AnimationDetector] Initialized
[AnimationDetector] Analyzing animations
[AnimationDetector] Detected 3 animations, state: loading
[AnimationDetector] Loading state started
[AnimationDetector] Loading completed after 2100ms

// TransitionPredictor logs
[TransitionPredictor] Initialized
[TransitionPredictor] Recorded transition xyz-456: click (1500ms, success)
[TransitionPredictor] Predicting transition for action: click
[TransitionPredictor] Prediction: success (85% success, 1450ms, confidence: 0.82)
```

### Inspect Statistics

```javascript
// State tracker stats
console.log('State:', tracker.getStats());

// Animation detector stats
console.log('Animations:', detector.getStats());

// Transition predictor stats
console.log('Predictions:', predictor.getStats());

// Full orchestrator stats
console.log('Full:', orchestrator.getStats());
```

## Testing

### Quick Test

```javascript
async function testPhase3() {
    // Test state tracking
    const tracker = new StateTracker();
    const id1 = tracker.captureState({ dom: 'test1', url: 'http://test.com', viewport: {} });
    const id2 = tracker.captureState({ dom: 'test2', url: 'http://test.com', viewport: {} });
    const changes = tracker.detectChanges();
    assert(changes !== null);
    
    // Test animation detection
    const detector = new AnimationDetector();
    const analysis = await detector.analyzeAnimations({
        dom: '<div class="loading spinner"></div>'
    });
    assert(analysis.animations.length > 0);
    
    // Test transition prediction
    const predictor = new TransitionPredictor();
    predictor.recordTransition({}, {}, { action: 'click' }, 1000, true);
    predictor.recordTransition({}, {}, { action: 'click' }, 1200, true);
    predictor.recordTransition({}, {}, { action: 'click' }, 1100, true);
    const pred = predictor.predictTransition({}, { action: 'click' });
    assert(pred.confidence > 0);
    
    console.log('All Phase 3 tests passed');
}
```

## Use Cases

### Use Case 1: Handle Loading States

```javascript
const detector = new AnimationDetector();

// Before action
const preCheck = await detector.analyzeAnimations({ dom });

if (preCheck.isAnimating) {
    console.log('Page already animating, waiting...');
    await detector.waitForCompletion();
}

// Execute action
await executeAction(action);

// Wait for loading
const postCheck = await detector.analyzeAnimations({ dom: newDom });
if (postCheck.shouldWait) {
    await detector.waitForCompletion();
}
```

### Use Case 2: Detect Page Changes

```javascript
const tracker = new StateTracker();

// Continuous monitoring
setInterval(async () => {
    const state = await capturePageState();
    tracker.captureState(state);
    
    const changes = tracker.detectChanges();
    
    if (changes && changes.magnitude > 0.3) {
        console.log('Significant page change detected');
        // Re-analyze page
    }
}, 1000);
```

### Use Case 3: Optimize Action Timing

```javascript
const predictor = new TransitionPredictor();

// Get timing for action type
const timings = predictor.getActionTimings('click');

if (timings) {
    console.log('Average click duration:', timings.averageDuration);
    console.log('Success rate:', timings.successRate);
    
    // Use median for timeout
    const timeout = timings.medianDuration * 2;
}
```

### Use Case 4: Workflow Progress Tracking

```javascript
const predictor = new TransitionPredictor();

// Get recent transitions
const recent = predictor.getHistory(10);

// Detect workflow
const workflow = predictor.detectWorkflowPattern(recent);

if (workflow.pattern !== 'unknown') {
    console.log('Workflow:', workflow.pattern);
    
    // Predict completion
    const completion = predictor.predictWorkflowCompletion(recent, currentState);
    console.log(`Progress: ${(completion.progress * 100).toFixed(0)}%`);
    console.log(`Remaining steps: ${completion.remainingSteps}`);
}
```

## Error Handling

### Graceful Degradation

```javascript
async function analyzeWithFallback(data, orchestrator) {
    try {
        return await orchestrator.executeParallelAnalysis(data, {
            useTemporalAnalysis: true
        });
    } catch (error) {
        console.warn('Temporal analysis failed, using spatial only');
        return await orchestrator.executeParallelAnalysis(data, {
            useTemporalAnalysis: false
        });
    }
}
```

### Handle Insufficient Data

```javascript
function predictWithFallback(predictor, state, action) {
    const prediction = predictor.predictTransition(state, action);
    
    if (prediction.confidence < 0.4) {
        console.warn('Low prediction confidence, using defaults');
        return {
            estimatedDuration: 1000,
            successProbability: 0.7,
            confidence: 0.5
        };
    }
    
    return prediction;
}
```

## Statistics Interpretation

### State Tracker Stats

```javascript
const stats = tracker.getStats();

// Health indicators
if (parseFloat(stats.averageChangeMagnitude) < 0.2) {
    console.log('Page is relatively stable');
}

if (stats.historySize < 10) {
    console.log('Building history, predictions may be inaccurate');
}
```

### Animation Detector Stats

```javascript
const stats = detector.getStats();

// Activity indicators
if (stats.loadingDetections > 10) {
    console.log('Frequent loading detected');
}

if (stats.currentState === 'loading') {
    console.log('Currently loading');
}
```

### Transition Predictor Stats

```javascript
const stats = predictor.getStats();

// Quality indicators
if (parseFloat(stats.successRate) > 80) {
    console.log('High action success rate');
}

if (parseFloat(stats.predictionAccuracy) > 75) {
    console.log('Predictions are accurate');
}
```

## Integration Patterns

### With EnhancedAgent

```javascript
class TemporalAgent extends EnhancedAgent {
    async loop() {
        // Capture state
        const state = await this.captureState();
        this.orchestrator.stateTracker.captureState(state);
        
        // Check for changes
        const changes = this.orchestrator.stateTracker.detectChanges();
        if (changes && changes.magnitude > 0.5) {
            this.log('Major page change, re-analyzing');
        }
        
        // Execute with temporal analysis
        const action = await this.orchestrator.executeParallelAnalysis({
            ...state, goal: this.goal
        }, {
            useTemporalAnalysis: true
        });
        
        // Check animation recommendation
        if (action.metadata?.waitTime) {
            await this.sleep(action.metadata.waitTime);
            return;
        }
        
        // Execute and record
        await this.executeAndRecord(action);
    }
}
```

### With Learning Engine

```javascript
// Learn from temporal patterns
const prediction = predictor.predictTransition(state, action);

if (prediction.successProbability > 0.8) {
    learningEngine.recordSuccess(
        domain,
        action.selector,
        prediction.estimatedDuration
    );
}
```

## Complete Example

```javascript
const { TaskOrchestrator } = require('./taskOrchestrator');
const { Priority } = require('./jobQueue');

async function automateWithTemporal(guestWebContents, goal) {
    const orchestrator = new TaskOrchestrator({
        maxConcurrent: 4,
        enableVisualAnalysis: true,
        enableTemporalAnalysis: true
    });
    
    // Monitor temporal events
    orchestrator.on('temporal:loadingStarted', () => {
        console.log('Loading detected');
    });
    
    orchestrator.on('temporal:stateChanged', (changes) => {
        console.log('State changed:', changes.magnitude);
    });
    
    while (true) {
        // Capture comprehensive state
        const dom = await getSimplifiedDOM(guestWebContents);
        const screenshot = await guestWebContents.capturePage();
        const base64 = screenshot.toJPEG(70).toString('base64');
        const url = guestWebContents.getURL();
        const viewport = await getViewportInfo(guestWebContents);
        const domNodes = await getDomNodePositions(guestWebContents);
        
        // Execute full analysis
        const result = await orchestrator.executeParallelAnalysis({
            dom, screenshot, url, goal, viewport, domNodes
        }, {
            priority: Priority.HIGH,
            useVisualAnalysis: true,
            useTemporalAnalysis: true
        });
        
        // Handle temporal recommendations
        if (result.metadata?.waitTime) {
            console.log(`Waiting ${result.metadata.waitTime}ms`);
            await sleep(result.metadata.waitTime);
            continue;
        }
        
        // Execute action
        const success = await executeAction(result);
        
        if (result.action === 'complete' || !success) {
            break;
        }
        
        await sleep(500);
    }
    
    orchestrator.destroy();
}
```

## Optimization Strategies

### 1. Adjust Thresholds for Site Characteristics

```javascript
// For static sites
const tracker = new StateTracker({
    visualThreshold: 0.1,   // Less sensitive
    domThreshold: 0.2       // Less sensitive
});

// For dynamic sites
const tracker = new StateTracker({
    visualThreshold: 0.03,  // More sensitive
    domThreshold: 0.05      // More sensitive
});
```

### 2. Balance History and Memory

```javascript
// For memory-constrained environments
const tracker = new StateTracker({ maxHistory: 20 });
const predictor = new TransitionPredictor({ maxTransitionHistory: 100 });

// For better predictions
const tracker = new StateTracker({ maxHistory: 100 });
const predictor = new TransitionPredictor({ maxTransitionHistory: 500 });
```

### 3. Conditional Analysis

```javascript
// Only use temporal when beneficial
const useTemporal = 
    hasAnimations ||
    frequentStateChanges ||
    complexWorkflow;

await orchestrator.executeParallelAnalysis(data, {
    useTemporalAnalysis: useTemporal
});
```

## Resources

- **Full Documentation**: PHASE3_IMPLEMENTATION.md
- **Summary**: PHASE3_SUMMARY.md
- **Previous Phases**: PHASE1_QUICK_REFERENCE.md, PHASE2_QUICK_REFERENCE.md
- **Source Code**: stateTracker.js, animationDetector.js, transitionPredictor.js

## Common Issues

**Q: Changes not detected between states**  
A: Ensure both current and previous states exist, check thresholds

**Q: Animation detector not recommending wait**  
A: Check if loading patterns are in DOM, verify detectLoading is true

**Q: Predictions have low confidence**  
A: Record more transitions for training, check similarity threshold

**Q: High memory usage**  
A: Reduce maxHistory and maxTransitionHistory, clear histories more often

## Support

For Phase 3 issues:
1. Check logs for component errors
2. Review statistics for insights
3. Monitor events for debugging
4. Consult PHASE3_IMPLEMENTATION.md
