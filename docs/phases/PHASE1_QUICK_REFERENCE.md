# Phase 1 Quick Reference Guide

## Installation

No additional dependencies required. All Phase 1 components use Node.js built-in modules.

```bash
# Already in your project
npm install
```

## Quick Start

### 1. Job Queue

```javascript
const { JobQueue, Priority } = require('./jobQueue');

// Create queue
const queue = new JobQueue({ maxConcurrent: 3 });

// Add job
const jobId = queue.addJob(
    async (x) => x * 2,
    [5],
    { priority: Priority.HIGH }
);

// Wait for result
const result = await queue.waitForJob(jobId);
```

### 2. Result Reconciliation

```javascript
const { ResultReconciliator, AnalysisSource } = require('./resultReconciliator');

// Create reconciliator
const reconciliator = new ResultReconciliator();

// Reconcile results
const result = await reconciliator.reconcile([
    { source: AnalysisSource.DOM, action: 'click', confidence: 0.8, selector: '[data-agent-id="5"]' },
    { source: AnalysisSource.VISION, action: 'click', confidence: 0.9, selector: '[data-agent-id="5"]' }
]);
```

### 3. Task Orchestrator

```javascript
const { TaskOrchestrator, TaskType } = require('./taskOrchestrator');

// Create orchestrator
const orchestrator = new TaskOrchestrator({ maxConcurrent: 3 });

// Execute parallel analysis
const result = await orchestrator.executeParallelAnalysis({
    dom: simplifiedDomString,
    screenshot: base64Screenshot,
    goal: 'Click the submit button',
    context: {}
});
```

## Common Patterns

### Pattern 1: Simple Job Queue

```javascript
const queue = new JobQueue();

// Add multiple jobs
const jobs = [];
for (let i = 0; i < 5; i++) {
    const jobId = queue.addJob(
        async (n) => processItem(n),
        [i],
        { priority: Priority.MEDIUM }
    );
    jobs.push(jobId);
}

// Wait for all
const results = await Promise.all(jobs.map(id => queue.waitForJob(id)));
```

### Pattern 2: Result Reconciliation with Custom Weights

```javascript
const reconciliator = new ResultReconciliator({
    sourceWeights: {
        dom: 1.0,
        vision: 0.95,
        pattern: 0.85
    },
    minConfidence: 0.4
});

const result = await reconciliator.reconcile(multipleResults);
```

### Pattern 3: Parallel Analysis with Error Handling

```javascript
const orchestrator = new TaskOrchestrator();

try {
    const result = await orchestrator.executeParallelAnalysis(data, {
        analysisTypes: [TaskType.DOM_ANALYSIS, TaskType.VISION_ANALYSIS],
        priority: Priority.HIGH
    });
    
    // Use result
    console.log('Action:', result.action);
    console.log('Confidence:', result.confidence);
    
} catch (error) {
    console.error('Analysis failed:', error.message);
    // Fallback logic
}
```

## Event Handling

### Job Queue Events

```javascript
queue.on('job:completed', ({ jobId, result, duration }) => {
    console.log(`Job ${jobId} completed in ${duration}ms`);
});

queue.on('job:failed', ({ jobId, error }) => {
    console.error(`Job ${jobId} failed:`, error.message);
});

queue.on('job:retry', ({ jobId, attempt, delay }) => {
    console.log(`Job ${jobId} retrying (attempt ${attempt}) in ${delay}ms`);
});
```

### Orchestrator Events

```javascript
orchestrator.on('analysis:completed', ({ analysisId, result, duration }) => {
    console.log(`Analysis ${analysisId} completed in ${duration}ms`);
});

orchestrator.on('analysis:failed', ({ analysisId, error }) => {
    console.error(`Analysis ${analysisId} failed:`, error.message);
});
```

## Configuration Cheat Sheet

### JobQueue

| Option | Default | Description |
|--------|---------|-------------|
| maxConcurrent | 3 | Max parallel jobs |
| maxRetries | 3 | Retry attempts |
| retryDelay | 1000 | Base retry delay (ms) |
| autoStart | true | Auto-start processing |

### ResultReconciliator

| Option | Default | Description |
|--------|---------|-------------|
| conflictStrategy | 'highest_confidence' | Resolution strategy |
| minConfidence | 0.3 | Min confidence threshold |
| consensusThreshold | 0.7 | Consensus agreement level |
| sourceWeights | {...} | Source reliability weights |

### TaskOrchestrator

| Option | Default | Description |
|--------|---------|-------------|
| maxWorkers | 4 | Max worker threads |
| maxConcurrent | 3 | Max concurrent tasks |
| taskTimeout | 30000 | Task timeout (ms) |
| enableWorkers | false | Enable worker threads |

## Priority Levels

```javascript
Priority.HIGH    // Process first
Priority.MEDIUM  // Normal priority
Priority.LOW     // Process last
```

## Conflict Strategies

```javascript
ConflictStrategy.HIGHEST_CONFIDENCE  // Select highest confidence
ConflictStrategy.WEIGHTED_AVERAGE    // Average similar actions
ConflictStrategy.CONSENSUS           // Require agreement
ConflictStrategy.SOURCE_PRIORITY     // Trust source order
```

## Analysis Sources

```javascript
AnalysisSource.DOM        // DOM analysis
AnalysisSource.VISION     // Screenshot analysis
AnalysisSource.PATTERN    // Pattern matching
AnalysisSource.LEARNING   // Learning engine
AnalysisSource.HEURISTIC  // Heuristic rules
```

## Task Types

```javascript
TaskType.DOM_ANALYSIS        // Analyze DOM structure
TaskType.VISION_ANALYSIS     // Analyze screenshot
TaskType.PATTERN_MATCHING    // Match patterns
TaskType.LEARNING_INFERENCE  // Learning predictions
TaskType.COMBINED_ANALYSIS   // Multi-source
```

## Common Methods

### JobQueue

```javascript
queue.addJob(fn, args, options)           // Add job
queue.waitForJob(jobId)                   // Wait for completion
queue.cancelJob(jobId)                    // Cancel job
queue.getJobStatus(jobId)                 // Get status
queue.getStats()                          // Get statistics
queue.pause()                             // Pause processing
queue.start()                             // Start processing
queue.clearQueue()                        // Clear pending jobs
queue.cleanup(maxAge)                     // Remove old jobs
queue.destroy()                           // Cleanup resources
```

### ResultReconciliator

```javascript
reconciliator.reconcile(results, options) // Reconcile results
reconciliator.calculateAgreement(r1, r2)  // Calculate agreement
reconciliator.getStats()                  // Get statistics
reconciliator.getHistory(limit)           // Get history
reconciliator.clearHistory()              // Clear history
```

### TaskOrchestrator

```javascript
orchestrator.executeParallelAnalysis(data, options) // Run analysis
orchestrator.cancelAnalysis(analysisId)             // Cancel analysis
orchestrator.cancelTask(taskId)                     // Cancel task
orchestrator.getTaskStatus(taskId)                  // Get task status
orchestrator.getAnalysisStatus(analysisId)          // Get analysis status
orchestrator.getStats()                             // Get statistics
orchestrator.cleanup(maxAge)                        // Remove old data
orchestrator.destroy()                              // Cleanup resources
```

## Error Handling

### Try-Catch Pattern

```javascript
try {
    const result = await orchestrator.executeParallelAnalysis(data);
} catch (error) {
    if (error.message.includes('timeout')) {
        // Handle timeout
    } else if (error.message.includes('cancelled')) {
        // Handle cancellation
    } else {
        // Handle other errors
    }
}
```

### Event-Based Pattern

```javascript
queue.on('job:failed', ({ jobId, error }) => {
    // Log error
    console.error(`Job ${jobId} failed:`, error.message);
    
    // Trigger fallback
    handleFailedJob(jobId);
});
```

## Performance Tips

1. **Optimize Concurrency**
   ```javascript
   // For I/O-bound tasks
   const queue = new JobQueue({ maxConcurrent: 10 });
   
   // For CPU-bound tasks
   const queue = new JobQueue({ maxConcurrent: 2 });
   ```

2. **Adjust Timeouts**
   ```javascript
   // For quick operations
   orchestrator.taskTimeout = 5000;
   
   // For complex analysis
   orchestrator.taskTimeout = 60000;
   ```

3. **Regular Cleanup**
   ```javascript
   // Clean up every 15 minutes
   setInterval(() => {
       queue.cleanup(900000);  // 15 minutes
       orchestrator.cleanup(900000);
   }, 900000);
   ```

4. **Monitor Statistics**
   ```javascript
   // Check every minute
   setInterval(() => {
       const stats = queue.getStats();
       if (parseFloat(stats.successRate) < 80) {
           console.warn('Low success rate:', stats.successRate);
       }
   }, 60000);
   ```

## Debugging

### Enable Verbose Logging

All components log to console with `[ComponentName]` prefix:

```javascript
// JobQueue logs
[JobQueue] Initialized with maxConcurrent: 3
[JobQueue] Job abc-123 added with priority HIGH
[JobQueue] Running job abc-123 (attempt 1/3)
[JobQueue] Job abc-123 completed successfully

// ResultReconciliator logs
[ResultReconciliator] Initialized with strategy: highest_confidence
[ResultReconciliator] Reconciling 2 results using highest_confidence strategy
[ResultReconciliator] Reconciled to action: click with confidence 0.850

// TaskOrchestrator logs
[TaskOrchestrator] Initialized
[TaskOrchestrator] Starting parallel analysis xyz-456
[TaskOrchestrator] Created dom_analysis task task-789
[TaskOrchestrator] Executing DOM analysis
[TaskOrchestrator] Parallel analysis xyz-456 completed in 1234ms
```

### Check Statistics

```javascript
// Queue stats
console.log('Queue:', queue.getStats());
// { totalJobs: 10, completedJobs: 8, failedJobs: 2, ... }

// Reconciliator stats
console.log('Reconciliator:', reconciliator.getStats());
// { totalReconciliations: 5, averageConfidence: '0.812', ... }

// Orchestrator stats
console.log('Orchestrator:', orchestrator.getStats());
// { orchestrator: {...}, queue: {...}, reconciliator: {...} }
```

### Inspect Job Status

```javascript
const status = queue.getJobStatus(jobId);
console.log('Job status:', status);
// {
//   id: 'abc-123',
//   status: 'running',
//   priority: 'HIGH',
//   retryCount: 0,
//   duration: 1234,
//   ...
// }
```

## Testing

### Unit Test Example

```javascript
const assert = require('assert');

async function testJobQueue() {
    const queue = new JobQueue({ maxConcurrent: 1 });
    
    const jobId = queue.addJob(async (x) => x * 2, [5]);
    const result = await queue.waitForJob(jobId);
    
    assert.strictEqual(result, 10);
    queue.destroy();
    
    console.log('Test passed');
}

testJobQueue();
```

## Cleanup Pattern

```javascript
// Proper cleanup on shutdown
process.on('SIGINT', () => {
    console.log('Shutting down...');
    
    // Stop accepting new jobs
    queue.pause();
    
    // Wait for running jobs
    setTimeout(() => {
        queue.destroy();
        orchestrator.destroy();
        process.exit(0);
    }, 5000);
});
```

## Resources

- **Full Documentation**: See PHASE1_IMPLEMENTATION.md
- **Implementation Summary**: See PHASE1_SUMMARY.md
- **Source Code**: jobQueue.js, resultReconciliator.js, taskOrchestrator.js

## Support

For issues:
1. Check the logs for error messages
2. Review statistics for performance issues
3. Consult PHASE1_IMPLEMENTATION.md for detailed usage
4. Check inline JSDoc comments in source files
