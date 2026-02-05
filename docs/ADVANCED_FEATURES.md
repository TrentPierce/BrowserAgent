# Advanced Features Documentation

## Table of Contents

1. [Computer Vision](#computer-vision)
2. [Cross-Domain Pattern Recognition](#cross-domain-pattern-recognition)
3. [Distributed Execution](#distributed-execution)
4. [Load Balancing](#load-balancing)
5. [Monitoring Dashboard](#monitoring-dashboard)
6. [Accessibility Testing](#accessibility-testing)
7. [Performance Metrics](#performance-metrics)
8. [Security Testing](#security-testing)
9. [GitHub Actions CI/CD](#github-actions-cicd)

---

## Computer Vision

### Overview

The Computer Vision module provides advanced visual element detection capabilities for elements not present in the DOM, using the latest AI vision models.

### Features

- **Visual Element Detection**: Identify buttons, links, and interactive elements through computer vision
- **OCR (Optical Character Recognition)**: Extract text from images with layout understanding
- **Object Detection**: Detect and classify UI elements
- **Semantic Segmentation**: Identify visual regions and layouts
- **Visual Change Detection**: Compare screenshots and identify changes

### Usage

```javascript
const { ComputerVision } = require('@trentpierce/browser-agent/vision');

const cv = new ComputerVision({
  geminiApiKey: process.env.GEMINI_API_KEY,
  model: 'gemini-2.0-flash-exp',
  confidenceThreshold: 0.75,
  enableOCR: true,
  enableObjectDetection: true
});

// Detect visual elements
const screenshot = await page.screenshot();
const results = await cv.detectVisualElements(screenshot, {
  targetElements: ['buttons', 'links', 'inputs']
});

console.log('Detected elements:', results.elements);
console.log('Extracted text:', results.text);

// Find element by visual description
const element = await cv.findElementByVisualDescription(
  screenshot,
  'blue login button in top right corner'
);

// Detect visual changes
const changes = await cv.detectVisualChanges(screenshot1, screenshot2);
if (changes.changed) {
  console.log('Changes detected:', changes.changes);
}
```

### Configuration Options

- `model`: AI model to use (default: 'gemini-2.0-flash-exp')
- `confidenceThreshold`: Minimum confidence for detections (0-1)
- `enableOCR`: Enable text extraction
- `enableObjectDetection`: Enable object detection
- `enableSemanticSegmentation`: Enable region segmentation

---

## Cross-Domain Pattern Recognition

### Overview

Learn and apply interaction patterns across different domains and websites, enabling intelligent automation that adapts to similar interfaces.

### Features

- **Pattern Learning**: Automatically learn successful interaction patterns
- **Domain-Specific Patterns**: Store patterns per domain
- **Cross-Domain Intelligence**: Apply learned patterns to similar sites
- **Visual Similarity Matching**: Match patterns based on visual characteristics

### Usage

```javascript
const { PatternRecognition } = require('@trentpierce/browser-agent/vision');
const database = require('./database');

const pr = new PatternRecognition(database);

// Learn from successful interaction
await pr.learnPattern({
  url: 'https://example.com',
  type: 'click',
  selector: 'button.login',
  visualFeatures: {
    text: 'Sign In',
    position: { x: 0.9, y: 0.1 },
    colors: ['#0066cc']
  },
  success: true
});

// Find applicable patterns for current context
const patterns = pr.findApplicablePatterns({
  url: 'https://similar-site.com',
  type: 'click',
  visualFeatures: { text: 'Login' }
});

console.log('Applicable patterns:', patterns);

// Get statistics
const stats = pr.getStats();
console.log(`Total patterns: ${stats.totalPatterns}`);
console.log(`Cross-domain patterns: ${stats.crossDomainPatterns}`);
```

---

## Distributed Execution

### Overview

Scale your browser automation across multiple workers and nodes for large-scale testing and parallel execution.

### Features

- **Worker Pool Management**: Automatic worker creation and management
- **Task Queue**: Intelligent task queuing and distribution
- **Load Balancing**: Multiple strategies for optimal distribution
- **Health Monitoring**: Automatic health checks and worker recovery
- **Retry Logic**: Configurable retry strategies

### Usage

```javascript
const { DistributedExecutor } = require('@trentpierce/browser-agent/enterprise');

const executor = new DistributedExecutor({
  maxWorkers: 8,
  enableClustering: true,
  taskTimeout: 300000,
  retryAttempts: 3,
  loadBalancingStrategy: 'least-loaded'
});

await executor.initialize();

// Submit tasks
const tasks = [
  { type: 'test', payload: { url: 'https://example1.com' } },
  { type: 'test', payload: { url: 'https://example2.com' } },
  { type: 'test', payload: { url: 'https://example3.com' } }
];

const results = await Promise.all(
  tasks.map(task => executor.submitTask(task))
);

// Get statistics
const stats = executor.getStats();
console.log('Completed tasks:', stats.completedTasks);
console.log('Success rate:', stats.successRate);

// Shutdown
await executor.shutdown();
```

### Load Balancing Strategies

- `round-robin`: Distribute tasks evenly across workers
- `least-loaded`: Assign to worker with fewest active tasks
- `random`: Random worker selection
- `performance-based`: Select based on worker performance metrics

---

## Load Balancing

### Overview

Handle high-volume automation requests with rate limiting, circuit breakers, and intelligent request distribution.

### Features

- **Rate Limiting**: Token bucket algorithm for request throttling
- **Circuit Breaker**: Prevent cascading failures
- **Request Queue**: Handle backpressure gracefully
- **Retry Strategies**: Exponential, linear, or constant backoff
- **Metrics Tracking**: Real-time performance metrics

### Usage

```javascript
const { LoadBalancer } = require('@trentpierce/browser-agent/enterprise');

const lb = new LoadBalancer({
  maxConcurrentRequests: 100,
  requestsPerSecond: 50,
  enableRateLimiting: true,
  enableCircuitBreaker: true,
  circuitBreakerThreshold: 0.5,
  retryStrategy: 'exponential',
  maxRetries: 3
});

// Process requests
const handler = async (request) => {
  // Your automation logic here
  return { success: true, data: request };
};

const result = await lb.processRequest(
  { url: 'https://example.com' },
  handler
);

// Get statistics
const stats = lb.getStats();
console.log('Active requests:', stats.activeRequests);
console.log('Success rate:', stats.successRate);

// Monitor circuit breakers
lb.on('circuit-opened', ({ target }) => {
  console.log(`Circuit breaker opened for ${target}`);
});
```

---

## Monitoring Dashboard

### Overview

Real-time monitoring dashboard with WebSocket updates, alerting, and comprehensive metrics visualization.

### Features

- **Real-Time Metrics**: Live system and application metrics
- **WebSocket Updates**: Push updates to connected clients
- **Alert System**: Threshold-based alerting
- **HTTP API**: REST endpoints for metrics and stats
- **Historical Data**: Time-series metrics storage

### Usage

```javascript
const { MonitoringDashboard } = require('@trentpierce/browser-agent/enterprise');

const dashboard = new MonitoringDashboard({
  port: 3000,
  enableWebSocket: true,
  metricsInterval: 1000,
  retentionPeriod: 3600000,
  alertThresholds: {
    errorRate: 0.1,
    responseTime: 5000,
    cpuUsage: 80,
    memoryUsage: 90
  }
});

await dashboard.start();
console.log('Dashboard running at http://localhost:3000');

// Listen for alerts
dashboard.on('alert-created', (alert) => {
  console.log(`Alert: ${alert.message}`);
  // Send notification, email, etc.
});

// Access metrics programmatically
const metrics = dashboard.getCurrentMetrics();
const history = dashboard.getMetricsHistory(3600000);
```

### API Endpoints

- `GET /api/metrics` - Current metrics
- `GET /api/metrics/history` - Historical metrics
- `GET /api/alerts` - Active alerts
- `GET /api/stats` - Aggregated statistics
- `POST /api/alerts/:id/acknowledge` - Acknowledge alert
- `GET /api/health` - Health check

---

## Accessibility Testing

### Overview

Comprehensive WCAG 2.1 compliance testing with axe-core integration and custom accessibility audits.

### Features

- **axe-core Integration**: Industry-standard accessibility testing
- **WCAG 2.1 Compliance**: Test against AA and AAA standards
- **Custom Tests**: Color contrast, form labels, heading hierarchy, etc.
- **Keyboard Navigation**: Test keyboard accessibility
- **Screen Reader Compatibility**: ARIA and semantic HTML validation

### Usage

```javascript
const { AccessibilityTester } = require('@trentpierce/browser-agent/testing');

const tester = new AccessibilityTester({
  standard: 'WCAG21AA',
  runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']
});

// Run comprehensive audit
const results = await tester.runAudit(page);

console.log('Accessibility Score:', results.summary.score);
console.log('WCAG Level:', results.summary.wcagLevel);
console.log('Violations:', results.axe.violations.length);

// Check specific aspects
if (!results.summary.keyboardAccessible) {
  console.log('Keyboard navigation issues detected');
}

if (!results.summary.screenReaderFriendly) {
  console.log('Screen reader compatibility issues detected');
}

// Generate report
const report = tester.getResults();
console.log('Overall Summary:', report.summary);
```

### Test Categories

- **Color Contrast**: WCAG contrast ratio requirements
- **Form Labels**: Input labeling and associations
- **Heading Hierarchy**: Proper heading structure
- **Alt Text**: Image alternative text
- **ARIA Labels**: ARIA attributes and roles
- **Focus Indicators**: Visible focus states
- **Semantic HTML**: Proper semantic element usage

---

## Performance Metrics

### Overview

Collect comprehensive web performance metrics including Core Web Vitals, resource timing, and lighthouse scores.

### Features

- **Core Web Vitals**: LCP, FID, CLS, FCP, TTFB
- **Navigation Timing**: Detailed page load metrics
- **Resource Timing**: Per-resource performance data
- **User Timing**: Custom performance marks
- **Performance Budgets**: Set and validate performance budgets

### Usage

```javascript
const { PerformanceMetrics } = require('@trentpierce/browser-agent/testing');

const metrics = new PerformanceMetrics({
  collectWebVitals: true,
  collectResourceTiming: true,
  budgets: {
    FCP: 1800,
    LCP: 2500,
    FID: 100,
    CLS: 0.1,
    TTI: 3800,
    TBT: 300
  }
});

// Collect metrics
const results = await metrics.collect(page);

console.log('Performance Score:', results.score);
console.log('LCP:', results.webVitals.LCP);
console.log('FID:', results.webVitals.FID);
console.log('CLS:', results.webVitals.CLS);

// Check budget violations
if (results.budgetAnalysis.violations.length > 0) {
  console.log('Budget violations:', results.budgetAnalysis.violations);
}

// Generate report with recommendations
const report = metrics.generateReport();
console.log('Recommendations:', report.recommendations);
```

### Metrics Collected

- **Core Web Vitals**: LCP, FID, CLS, FCP, TTFB
- **Navigation Timing**: DNS, TCP, Request, Response, Processing
- **Resource Timing**: All resource load times and sizes
- **Custom Timing**: User-defined performance marks
- **Network Info**: Connection type, downlink speed, RTT

---

## Security Testing

### Overview

Automated security vulnerability detection including XSS, SQL injection, CSRF, and comprehensive form fuzzing.

### Features

- **XSS Testing**: Reflected XSS detection with various payloads
- **SQL Injection**: Database error detection and injection testing
- **CSRF Testing**: CSRF token validation
- **Form Fuzzing**: Comprehensive input fuzzing
- **Security Headers**: Validate security header configuration
- **Cookie Security**: HttpOnly, Secure, SameSite validation
- **Mixed Content**: HTTPS mixed content detection

### Usage

```javascript
const { SecurityTester } = require('@trentpierce/browser-agent/testing');

const tester = new SecurityTester({
  enableXSSTesting: true,
  enableSQLInjection: true,
  enableCSRFTesting: true,
  enableFormFuzzing: true,
  maxFuzzIterations: 50,
  fuzzIntensity: 'medium'
});

// Run security audit
const results = await tester.runSecurityAudit(page);

console.log('Risk Level:', results.riskLevel);
console.log('Vulnerabilities:', results.vulnerabilities.length);

// Check specific vulnerabilities
if (results.tests.xss.vulnerable) {
  console.log('XSS vulnerabilities found:', results.tests.xss.findings);
}

if (results.tests.sqlInjection.vulnerable) {
  console.log('SQL injection vulnerabilities found');
}

// Form fuzzing results
if (results.tests.fuzzing) {
  console.log('Fuzz tests run:', results.tests.fuzzing.totalTests);
  console.log('Crashes:', results.tests.fuzzing.crashes.length);
  console.log('Anomalies:', results.tests.fuzzing.anomalies.length);
}

// Generate report with recommendations
const report = tester.generateReport();
console.log('Recommendations:', report.recommendations);
```

### Vulnerability Types

- **XSS**: Script injection, DOM-based XSS
- **SQL Injection**: Error-based detection
- **CSRF**: Missing token validation
- **Security Headers**: HSTS, CSP, X-Frame-Options, etc.
- **Cookie Security**: Secure, HttpOnly, SameSite flags
- **Mixed Content**: HTTP resources on HTTPS pages
- **Password Fields**: Insecure password handling

---

## GitHub Actions CI/CD

### Overview

Comprehensive CI/CD pipeline with multi-platform testing, security scanning, and automated publishing.

### Workflows

#### 1. CI Pipeline (`.github/workflows/ci.yml`)

- **Multi-Platform Testing**: Ubuntu, Windows, macOS
- **Multi-Node Testing**: Node.js 16.x, 18.x, 20.x
- **Linting and Testing**: ESLint + Jest with coverage
- **Security Scanning**: npm audit, Snyk, CodeQL
- **Dependency Review**: Automated on pull requests
- **Docker Build**: Test Docker image builds

#### 2. Publish Workflow (`.github/workflows/publish.yml`)

- **Triggered On**: Git tags matching `v*.*.*`
- **Pre-Publish Tests**: Full test suite
- **npm Publishing**: Automated package publishing
- **GitHub Release**: Automatic release creation
- **Changelog Generation**: Auto-generated from commits

#### 3. Dependency Updates (`.github/workflows/dependency-update.yml`)

- **Schedule**: Weekly on Mondays
- **Auto-Update**: Dependencies updated automatically
- **Pull Request**: Creates PR with updates
- **Tests**: Runs test suite before PR creation

### Setting Up CI/CD

1. **Required Secrets**:
   - `NPM_TOKEN`: npm authentication token
   - `SNYK_TOKEN`: Snyk security scanning token (optional)

2. **Publishing a Release**:
   ```bash
   npm version patch  # or minor, major
   git push origin dev --tags
   ```

3. **Monitoring Builds**:
   - Check Actions tab on GitHub
   - View test results and coverage
   - Review security scan reports

### Build Status

All workflows provide:
- ✅ Build status badges
- 📊 Code coverage reports
- 🔒 Security scan results
- 📦 Build artifacts

---

## Best Practices

### Computer Vision
- Cache processed images to avoid redundant API calls
- Use appropriate confidence thresholds for your use case
- Combine DOM and visual detection for best results

### Distributed Execution
- Monitor worker health and restart failed workers
- Adjust worker count based on available resources
- Use appropriate task timeouts
- Implement proper error handling

### Load Balancing
- Set realistic rate limits
- Monitor circuit breakers
- Adjust retry strategies based on failure patterns

### Testing
- Run accessibility tests early in development
- Set performance budgets and enforce them
- Include security testing in your CI/CD pipeline
- Regular fuzz testing for critical forms

### CI/CD
- Keep dependencies up to date
- Monitor security vulnerabilities
- Test on multiple platforms
- Use semantic versioning for releases

---

## Troubleshooting

### Computer Vision Issues
- **API Errors**: Check API key and quota
- **Poor Detection**: Adjust confidence threshold or improve image quality
- **Slow Performance**: Enable caching and limit detection scope

### Distributed Execution
- **Worker Crashes**: Check resource limits and task complexity
- **Slow Performance**: Adjust worker count and load balancing strategy
- **Task Timeouts**: Increase timeout or optimize task execution

### Testing Failures
- **Accessibility**: Review specific violations and fix critical issues first
- **Performance**: Focus on LCP and CLS improvements
- **Security**: Prioritize critical and high-severity vulnerabilities

---

## Support

For issues, questions, or contributions:
- GitHub Issues: https://github.com/TrentPierce/BrowserAgent/issues
- Documentation: https://github.com/TrentPierce/BrowserAgent/docs
- Examples: https://github.com/TrentPierce/BrowserAgent/examples
