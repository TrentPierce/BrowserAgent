# Phase 2 Quick Reference Guide

## Installation

No additional dependencies required. Phase 2 builds on Phase 1 using Node.js built-in modules.

```bash
# Already in your project
npm install
```

## Quick Start

### 1. Screenshot Segmentation

```javascript
const { ScreenshotSegmenter } = require('./screenshotSegmenter');

// Initialize
const segmenter = new ScreenshotSegmenter();

// Analyze screenshot
const analysis = await segmenter.analyzeScreenshot(
    screenshotData,
    { width: 1920, height: 1080, scrollY: 0 }
);

// Use results
console.log('Regions:', analysis.regions);
console.log('Layout:', analysis.layout.pattern);
```

### 2. UI Element Classification

```javascript
const { UIElementClassifier } = require('./uiElementClassifier');

// Initialize
const classifier = new UIElementClassifier();

// Classify single element
const result = classifier.classifyElement({
    tag: 'button',
    className: 'btn btn-primary',
    text: 'Submit'
});

// Batch classification
const results = classifier.classifyBatch(elements);
```

### 3. Visual-DOM Mapping

```javascript
const { VisualDomMapper } = require('./visualDomMapper');

// Initialize
const mapper = new VisualDomMapper();

// Map elements
const mapping = await mapper.mapVisualToDom({
    visualElements: visualElements,
    domNodes: domNodes,
    viewport: { width: 1920, height: 1080 }
});

// Find click target
const target = mapper.findClickTarget(500, 300, mapping.mappings);
```

### 4. Full Visual Analysis

```javascript
const { TaskOrchestrator, TaskType } = require('./taskOrchestrator');

// Initialize with visual analysis
const orchestrator = new TaskOrchestrator({
    enableVisualAnalysis: true
});

// Execute comprehensive analysis
const result = await orchestrator.executeParallelAnalysis({
    dom: domString,
    screenshot: base64Image,
    goal: 'Click submit button',
    viewport: { width: 1920, height: 1080, scrollY: 0 },
    domNodes: domNodesWithBounds
}, {
    useVisualAnalysis: true
});
```

## Common Patterns

### Pattern 1: Region-Based Analysis

```javascript
const segmenter = new ScreenshotSegmenter();
const analysis = await segmenter.analyzeScreenshot(screenshot, metadata);

// Find content region
const contentRegion = analysis.regions.find(r => r.type === 'content');

// Find forms in content
const forms = analysis.functionalAreas.filter(a => 
    a.type === 'form' && a.region === 'content'
);
```

### Pattern 2: Framework-Aware Classification

```javascript
const classifier = new UIElementClassifier({
    detectFrameworks: true
});

const elements = extractElementsFromDom(dom);
const classifications = classifier.classifyBatch(elements);

// Filter by framework
const reactElements = classifications.filter(c => 
    c.framework && c.framework.type === 'react'
);
```

### Pattern 3: High-Confidence Mapping

```javascript
const mapper = new VisualDomMapper({
    overlapStrategy: OverlapStrategy.INTERACTION_PRIORITY
});

const mapping = await mapper.mapVisualToDom(data);

// Get only high-confidence mappings
const confident = mapping.mappings.filter(m => 
    m.confidence === 'exact' || m.confidence === 'high'
);
```

### Pattern 4: Responsive-Aware Analysis

```javascript
const segmenter = new ScreenshotSegmenter({
    detectResponsive: true
});

const analysis = await segmenter.analyzeScreenshot(screenshot, {
    width: 375,  // Mobile width
    height: 667,
    scrollY: 0
});

if (analysis.responsive.isMobile) {
    console.log('Mobile layout detected');
    console.log('Recommendations:', analysis.responsive.recommendedActions);
}
```

## Configuration Cheat Sheet

### ScreenshotSegmenter

| Option | Default | Description |
|--------|---------|-------------|
| minRegionHeight | 50 | Minimum region height (px) |
| headerMaxHeight | 200 | Maximum header height (px) |
| footerMaxHeight | 150 | Maximum footer height (px) |
| sidebarMinWidth | 150 | Minimum sidebar width (px) |
| detectResponsive | true | Enable responsive detection |

### UIElementClassifier

| Option | Default | Description |
|--------|---------|-------------|
| minConfidence | 0.5 | Minimum classification confidence |
| detectFrameworks | true | Enable framework detection |
| detectAccessibility | true | Enable accessibility checks |

### VisualDomMapper

| Option | Default | Description |
|--------|---------|-------------|
| coordinateTolerance | 5 | Pixel tolerance for matching |
| overlapThreshold | 0.5 | Overlap threshold (0-1) |
| overlapStrategy | 'highest_z_index' | Overlap resolution strategy |
| considerVisibility | true | Consider element visibility |

### TaskOrchestrator (Phase 2)

| Option | Default | Description |
|--------|---------|-------------|
| enableVisualAnalysis | true | Enable Phase 2 visual analysis |

## Enumerations

### Region Types

```javascript
RegionType.HEADER
RegionType.NAVIGATION
RegionType.CONTENT
RegionType.SIDEBAR
RegionType.FOOTER
RegionType.MODAL
RegionType.POPUP
RegionType.UNKNOWN
```

### Functional Area Types

```javascript
FunctionalAreaType.FORM
FunctionalAreaType.BUTTON_GROUP
FunctionalAreaType.LIST
FunctionalAreaType.TABLE
FunctionalAreaType.CARD
FunctionalAreaType.MENU
FunctionalAreaType.SEARCH
FunctionalAreaType.MEDIA
FunctionalAreaType.TEXT_CONTENT
```

### Element Types

```javascript
ElementType.BUTTON
ElementType.INPUT
ElementType.TEXTAREA
ElementType.SELECT
ElementType.CHECKBOX
ElementType.RADIO
ElementType.LINK
ElementType.IMAGE
ElementType.ICON
ElementType.MENU
// ... and more (see uiElementClassifier.js)
```

### Framework Types

```javascript
FrameworkType.REACT
FrameworkType.VUE
FrameworkType.ANGULAR
FrameworkType.BOOTSTRAP
FrameworkType.MATERIAL
FrameworkType.TAILWIND
```

### Interaction Types

```javascript
InteractionType.CLICKABLE
InteractionType.EDITABLE
InteractionType.SELECTABLE
InteractionType.HOVERABLE
InteractionType.DRAGGABLE
InteractionType.SCROLLABLE
```

### Overlap Strategies

```javascript
OverlapStrategy.HIGHEST_Z_INDEX
OverlapStrategy.SMALLEST_AREA
OverlapStrategy.CENTER_POINT
OverlapStrategy.INTERACTION_PRIORITY
```

## Common Methods

### ScreenshotSegmenter

```javascript
segmenter.analyzeScreenshot(imageData, metadata, options)
segmenter.getStats()
segmenter.clearCache()
```

### UIElementClassifier

```javascript
classifier.classifyElement(element)
classifier.classifyBatch(elements)
classifier.getStats()
```

### VisualDomMapper

```javascript
mapper.mapVisualToDom(data, options)
mapper.findClickTarget(x, y, mappings)
mapper.getStats()
mapper.clearCache()
```

## Event Handling

### Segmenter Events

```javascript
segmenter.on('analysis:complete', ({ analysis, duration }) => {
    console.log(`Regions: ${analysis.regions.length}`);
});

segmenter.on('analysis:error', ({ error }) => {
    console.error('Segmentation error:', error);
});
```

### Classifier Events

```javascript
classifier.on('element:classified', ({ element, classification }) => {
    console.log(`${element.tag} classified as ${classification.type}`);
});

classifier.on('classification:error', ({ element, error }) => {
    console.error('Classification error:', error);
});
```

### Mapper Events

```javascript
mapper.on('mapping:complete', ({ result, duration }) => {
    console.log(`Mapped ${result.mappings.length} elements`);
});

mapper.on('mapping:error', ({ error }) => {
    console.error('Mapping error:', error);
});
```

## Helper Functions

### Extract DOM Node Positions

```javascript
// Run in browser context
async function getDomNodePositions(guestWebContents) {
    return await guestWebContents.executeJavaScript(`
        Array.from(document.querySelectorAll('[data-agent-id]')).map(el => {
            const rect = el.getBoundingClientRect();
            const styles = window.getComputedStyle(el);
            return {
                selector: '[data-agent-id="' + el.getAttribute('data-agent-id') + '"]',
                tag: el.tagName.toLowerCase(),
                type: el.type || null,
                bounds: {
                    x: rect.left,
                    y: rect.top,
                    width: rect.width,
                    height: rect.height
                },
                zIndex: parseInt(styles.zIndex) || 0,
                visible: styles.display !== 'none' && styles.visibility !== 'hidden'
            };
        })
    `);
}
```

### Extract Viewport Info

```javascript
// Run in browser context
async function getViewportInfo(guestWebContents) {
    return await guestWebContents.executeJavaScript(`({
        width: window.innerWidth,
        height: window.innerHeight,
        scrollY: window.scrollY,
        scrollX: window.scrollX
    })`);
}
```

## Performance Tips

### 1. Use Caching

```javascript
// Analysis results are cached automatically
const result1 = await segmenter.analyzeScreenshot(data, metadata); // Cache miss
const result2 = await segmenter.analyzeScreenshot(data, metadata); // Cache hit
```

### 2. Batch Processing

```javascript
// Classify multiple elements at once
const classifications = classifier.classifyBatch(elements);
// Faster than individual classification
```

### 3. Selective Analysis

```javascript
// Only run needed analyses
const result = await orchestrator.executeParallelAnalysis(data, {
    analysisTypes: [
        TaskType.VISUAL_SEGMENTATION,  // Fast
        TaskType.DOM_ANALYSIS          // Fast
    ]
});
```

### 4. Adjust Thresholds

```javascript
// Lower thresholds for speed
const mapper = new VisualDomMapper({
    coordinateTolerance: 10,  // More lenient = faster
    overlapThreshold: 0.3     // Lower = faster
});
```

## Debugging

### Enable Detailed Logging

All components log to console with component prefix:

```javascript
// Segmenter logs
[ScreenshotSegmenter] Initialized
[ScreenshotSegmenter] Analyzing screenshot: 1920 x 1080
[ScreenshotSegmenter] Analysis completed in 125ms

// Classifier logs
[UIElementClassifier] Initialized
[UIElementClassifier] Classifying element: button
[UIElementClassifier] Classified as button with confidence 0.920

// Mapper logs
[VisualDomMapper] Initialized
[VisualDomMapper] Mapping 50 visual elements to 45 DOM nodes
[VisualDomMapper] Mapping completed in 45ms: 90.00% success rate
```

### Inspect Component Statistics

```javascript
// Check segmentation performance
console.log('Segmenter:', segmenter.getStats());

// Check classification accuracy
console.log('Classifier:', classifier.getStats());

// Check mapping success
console.log('Mapper:', mapper.getStats());

// Check full orchestrator stats
console.log('Orchestrator:', orchestrator.getStats());
```

### Monitor Events

```javascript
// Log all events
segmenter.on('analysis:complete', (data) => console.log('Seg complete:', data));
classifier.on('element:classified', (data) => console.log('Classified:', data));
mapper.on('mapping:complete', (data) => console.log('Mapped:', data));
```

## Testing

### Quick Test

```javascript
const assert = require('assert');

async function quickTest() {
    // Test segmentation
    const segmenter = new ScreenshotSegmenter();
    const seg = await segmenter.analyzeScreenshot(null, { width: 1920, height: 1080 });
    assert(seg.regions.length > 0);
    
    // Test classification
    const classifier = new UIElementClassifier();
    const cls = classifier.classifyElement({ tag: 'button', text: 'Submit' });
    assert(cls.type === 'button');
    
    // Test mapping
    const mapper = new VisualDomMapper();
    const map = await mapper.mapVisualToDom({
        visualElements: [{ bounds: { x: 0, y: 0, width: 10, height: 10 } }],
        domNodes: [{ bounds: { x: 0, y: 0, width: 10, height: 10 }, selector: '#test' }],
        viewport: { width: 1920, height: 1080 }
    });
    assert(map.mappings.length === 1);
    
    console.log('All tests passed');
}
```

## Use Cases

### Use Case 1: Popup Detection and Closure

```javascript
const segmenter = new ScreenshotSegmenter();
const analysis = await segmenter.analyzeScreenshot(screenshot, viewport);

const hasModal = analysis.regions.some(r => r.type === 'modal' || r.type === 'popup');
if (hasModal) {
    // Focus on modal region for close button
    const modalRegion = analysis.regions.find(r => r.type === 'modal');
    console.log('Modal detected at:', modalRegion);
}
```

### Use Case 2: Form Field Detection

```javascript
const segmenter = new ScreenshotSegmenter();
const classifier = new UIElementClassifier();

const analysis = await segmenter.analyzeScreenshot(screenshot, viewport);
const formAreas = analysis.functionalAreas.filter(a => a.type === 'form');

const elements = extractElementsFromDom(dom);
const inputs = elements.filter(el => {
    const cls = classifier.classifyElement(el);
    return cls.type === 'input' || cls.type === 'textarea';
});

console.log(`Found ${formAreas.length} forms with ${inputs.length} input fields`);
```

### Use Case 3: Precise Click Targeting

```javascript
const mapper = new VisualDomMapper({
    overlapStrategy: OverlapStrategy.INTERACTION_PRIORITY
});

const mapping = await mapper.mapVisualToDom(data);

// Find best element to click at coordinates
const clickX = 500;
const clickY = 300;
const target = mapper.findClickTarget(clickX, clickY, mapping.mappings);

if (target) {
    console.log('Click target:', target.domNode.selector);
    console.log('Confidence:', target.confidence);
}
```

### Use Case 4: Responsive Layout Handling

```javascript
const segmenter = new ScreenshotSegmenter({ detectResponsive: true });
const analysis = await segmenter.analyzeScreenshot(screenshot, {
    width: 375,  // iPhone width
    height: 667,
    scrollY: 0
});

if (analysis.responsive.isMobile) {
    console.log('Mobile layout detected');
    console.log('Breakpoint:', analysis.responsive.breakpoint);
    
    // Adjust strategy for mobile
    // - Use larger tap targets
    // - Expect stacked layout
    // - Look for hamburger menu
}
```

## Error Handling

### Graceful Degradation

```javascript
async function analyzeWithFallback(data) {
    try {
        // Try full visual analysis
        return await orchestrator.executeParallelAnalysis(data, {
            useVisualAnalysis: true
        });
    } catch (error) {
        console.warn('Visual analysis failed, falling back to DOM-only');
        
        // Fallback to DOM-only
        return await orchestrator.executeParallelAnalysis(data, {
            useVisualAnalysis: false,
            analysisTypes: [TaskType.DOM_ANALYSIS]
        });
    }
}
```

### Validate Input Data

```javascript
function validateAnalysisData(data) {
    if (!data.dom) {
        throw new Error('DOM data required');
    }
    
    if (data.useVisual && !data.screenshot) {
        console.warn('Screenshot missing, disabling visual analysis');
        data.useVisual = false;
    }
    
    if (data.useVisual && !data.viewport) {
        console.warn('Viewport missing, disabling visual analysis');
        data.useVisual = false;
    }
    
    return data;
}
```

## Optimization Strategies

### 1. Cache Management

```javascript
// Clear caches periodically
setInterval(() => {
    segmenter.clearCache();
    mapper.clearCache();
}, 600000); // 10 minutes
```

### 2. Conditional Visual Analysis

```javascript
// Only use visual analysis when beneficial
const needsVisualAnalysis = 
    dom.includes('[DECOY]') ||
    dom.includes('modal') ||
    complexLayout;

const result = await orchestrator.executeParallelAnalysis(data, {
    useVisualAnalysis: needsVisualAnalysis
});
```

### 3. Batch Operations

```javascript
// Classify all elements at once
const allElements = extractAllElements(dom);
const allClassifications = classifier.classifyBatch(allElements);

// More efficient than individual classification
```

### 4. Selective Task Types

```javascript
// Only run classification if needed
const taskTypes = [TaskType.DOM_ANALYSIS];

if (complexUI) {
    taskTypes.push(TaskType.ELEMENT_CLASSIFICATION);
}

if (hasVisualElements) {
    taskTypes.push(TaskType.VISUAL_MAPPING);
}

await orchestrator.executeParallelAnalysis(data, { analysisTypes: taskTypes });
```

## Integration Patterns

### With EnhancedAgent

```javascript
class VisualAgent extends EnhancedAgent {
    async loop() {
        // Standard capture
        const dom = await this.getSimplifiedDOM();
        const screenshot = await this.guestWebContents.capturePage();
        const base64Image = screenshot.toJPEG(70).toString('base64');
        
        // Get visual data
        const viewport = await this.getViewportInfo();
        const domNodes = await this.getDomNodePositions();
        
        // Parallel visual analysis
        const action = await this.orchestrator.executeParallelAnalysis({
            dom, screenshot: base64Image, goal: this.goal,
            viewport, domNodes
        });
        
        await this.executeWithRetry(action);
    }
}
```

### With Learning Engine

```javascript
// Use visual analysis to improve learning
const result = await orchestrator.executeParallelAnalysis(data);

if (result.metadata && result.metadata.classification) {
    learningEngine.recordPattern(
        result.metadata.classification.type,
        domain,
        result.selector,
        result.metadata.classification.framework?.type
    );
}
```

## Statistics Interpretation

### Segmenter Stats

```javascript
const stats = segmenter.getStats();

// Good performance indicators
if (parseFloat(stats.cacheHitRate) > 50) {
    console.log('Cache is effective');
}
if (stats.averageAnalysisTime < 200) {
    console.log('Segmentation is fast');
}
```

### Classifier Stats

```javascript
const stats = classifier.getStats();

// Quality indicators
if (parseFloat(stats.averageConfidence) > 0.75) {
    console.log('High classification quality');
}

console.log('Most common elements:', stats.mostCommonType);
console.log('Detected framework:', stats.mostCommonFramework);
```

### Mapper Stats

```javascript
const stats = mapper.getStats();

// Mapping quality indicators
if (parseFloat(stats.successRate) > 80) {
    console.log('High mapping success');
}
if (parseFloat(stats.ambiguousRate) < 10) {
    console.log('Low ambiguity');
}
```

## Complete Example

```javascript
const { TaskOrchestrator } = require('./taskOrchestrator');
const { ScreenshotSegmenter } = require('./screenshotSegmenter');
const { UIElementClassifier } = require('./uiElementClassifier');
const { VisualDomMapper } = require('./visualDomMapper');

async function analyzePageCompletely(guestWebContents, goal) {
    // Initialize components
    const orchestrator = new TaskOrchestrator({ enableVisualAnalysis: true });
    
    // Capture page state
    const dom = await getSimplifiedDOM(guestWebContents);
    const screenshot = await guestWebContents.capturePage();
    const base64 = screenshot.toJPEG(70).toString('base64');
    
    const viewport = await guestWebContents.executeJavaScript(`({
        width: window.innerWidth,
        height: window.innerHeight,
        scrollY: window.scrollY
    })`);
    
    const domNodes = await guestWebContents.executeJavaScript(`
        Array.from(document.querySelectorAll('[data-agent-id]')).map(el => {
            const rect = el.getBoundingClientRect();
            return {
                selector: '[data-agent-id="' + el.getAttribute('data-agent-id') + '"]',
                bounds: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
                zIndex: parseInt(getComputedStyle(el).zIndex) || 0
            };
        })
    `);
    
    // Execute analysis
    const result = await orchestrator.executeParallelAnalysis({
        dom, screenshot: base64, goal, viewport, domNodes
    }, {
        useVisualAnalysis: true
    });
    
    // Get detailed stats
    const stats = orchestrator.getStats();
    console.log('Analysis complete:', stats);
    
    return result;
}
```

## Resources

- **Full Documentation**: PHASE2_IMPLEMENTATION.md
- **Summary**: PHASE2_SUMMARY.md
- **Phase 1 Reference**: PHASE1_QUICK_REFERENCE.md
- **Source Code**: screenshotSegmenter.js, uiElementClassifier.js, visualDomMapper.js

## Common Issues

**Q: Visual analysis always returns 'wait' action**  
A: Check that viewport and domNodes data are provided correctly

**Q: Classification confidence is low**  
A: Ensure elements have className and text properties

**Q: Mapping fails with 'uncertain' confidence**  
A: Verify DOM node bounds are accurate and in viewport coordinates

**Q: High memory usage**  
A: Clear caches regularly and limit cache sizes

## Support

For Phase 2 issues:
1. Check logs for component-specific errors
2. Review statistics for performance metrics
3. Validate input data completeness
4. Consult PHASE2_IMPLEMENTATION.md for detailed guidance
