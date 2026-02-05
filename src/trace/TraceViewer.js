/**
 * ============================================================================
 * TRACE VIEWER - Playwright-style Execution Recording
 * ============================================================================
 * 
 * Records browser execution traces for playback analysis.
 * Creates detailed timeline of actions, screenshots, and network activity.
 * 
 * @author Trent Pierce
 * @license BrowserAgent Non-Commercial License
 * @copyright 2026 Trent Pierce
 * ============================================================================
 */

const fs = require('fs').promises;
const path = require('path');

/**
 * Trace viewer for recording and replaying browser sessions
 */
class TraceViewer {
  /**
     * @param {Object} options - Trace options
     * @param {string} options.outputDir - Directory for trace files
     * @param {boolean} options.screenshots - Capture screenshots
     * @param {boolean} options.snapshots - Capture DOM snapshots
     * @param {boolean} options.network - Record network activity
     */
  constructor(options = {}) {
    this.options = {
      outputDir: './traces',
      screenshots: true,
      snapshots: true,
      network: true,
      ...options
    };

    this.isRecording = false;
    this.currentTrace = null;
    this.eventCounter = 0;
  }

  /**
     * Initialize trace directory
     */
  async init() {
    await fs.mkdir(this.options.outputDir, { recursive: true });
  }

  /**
     * Start recording a new trace
     * @param {string} name - Trace name
     * @param {Object} metadata - Trace metadata
     */
  async start(name, metadata = {}) {
    if (this.isRecording) {
      await this.stop();
    }

    await this.init();

    this.traceId = `${name}_${Date.now()}`;
    this.traceDir = path.join(this.options.outputDir, this.traceId);
    await fs.mkdir(this.traceDir, { recursive: true });

    this.currentTrace = {
      version: '1.0',
      name,
      metadata: {
        startTime: Date.now(),
        userAgent: metadata.userAgent,
        viewport: metadata.viewport,
        ...metadata
      },
      events: []
    };

    this.isRecording = true;
    this.eventCounter = 0;

    return this.traceId;
  }

  /**
     * Stop recording and save trace
     */
  async stop() {
    if (!this.isRecording) return;

    this.currentTrace.metadata.endTime = Date.now();
    this.currentTrace.metadata.duration = 
            this.currentTrace.metadata.endTime - this.currentTrace.metadata.startTime;

    // Save trace JSON
    await fs.writeFile(
      path.join(this.traceDir, 'trace.json'),
      JSON.stringify(this.currentTrace, null, 2)
    );

    // Generate HTML viewer
    await this.generateViewer();

    this.isRecording = false;
        
    return {
      traceId: this.traceId,
      tracePath: this.traceDir,
      eventCount: this.currentTrace.events.length
    };
  }

  /**
     * Record an action event
     * @param {string} type - Event type ('action', 'navigation', 'network', 'error')
     * @param {Object} data - Event data
     */
  async recordEvent(type, data) {
    if (!this.isRecording) return;

    const event = {
      id: ++this.eventCounter,
      type,
      timestamp: Date.now(),
      data
    };

    this.currentTrace.events.push(event);

    // Capture screenshot if enabled
    if (this.options.screenshots && data.page) {
      try {
        const screenshotPath = path.join(this.traceDir, `screenshot_${event.id}.png`);
        await data.page.screenshot({ path: screenshotPath });
        event.screenshot = `screenshot_${event.id}.png`;
      } catch (e) {
        // Screenshot may fail
      }
    }

    // Capture DOM snapshot if enabled
    if (this.options.snapshots && data.page) {
      try {
        const snapshotPath = path.join(this.traceDir, `snapshot_${event.id}.html`);
        const content = await data.page.content();
        await fs.writeFile(snapshotPath, content);
        event.snapshot = `snapshot_${event.id}.html`;
      } catch (e) {
        // Snapshot may fail
      }
    }
  }

  /**
     * Record action
     * @param {string} action - Action name
     * @param {Object} params - Action parameters
     * @param {Object} page - Page adapter
     */
  async recordAction(action, params, page) {
    await this.recordEvent('action', {
      action,
      params,
      page,
      url: page.url()
    });
  }

  /**
     * Record navigation
     * @param {string} url - Navigation URL
     * @param {Object} page - Page adapter
     */
  async recordNavigation(url, page) {
    await this.recordEvent('navigation', {
      url,
      page,
      title: await page.title().catch(() => null)
    });
  }

  /**
     * Record network request
     * @param {Object} request - Request object
     */
  async recordNetworkRequest(request) {
    if (!this.options.network) return;

    await this.recordEvent('network', {
      direction: 'request',
      url: request.url(),
      method: request.method(),
      headers: request.headers()
    });
  }

  /**
     * Record network response
     * @param {Object} response - Response object
     */
  async recordNetworkResponse(response) {
    if (!this.options.network) return;

    const body = await response.text().catch(() => null);
        
    await this.recordEvent('network', {
      direction: 'response',
      url: response.url(),
      status: response.status(),
      headers: response.headers(),
      bodyPreview: body ? body.substring(0, 1000) : null
    });
  }

  /**
     * Record error
     * @param {Error} error - Error object
     * @param {Object} context - Error context
     */
  async recordError(error, context = {}) {
    await this.recordEvent('error', {
      message: error.message,
      stack: error.stack,
      context
    });
  }

  /**
     * Generate HTML viewer for trace
     * @private
     */
  async generateViewer() {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Trace Viewer - ${this.currentTrace.name}</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #1a1a1a; color: #fff; }
        .header { background: #2d2d2d; padding: 16px; border-bottom: 1px solid #444; }
        .header h1 { font-size: 18px; font-weight: 600; }
        .header .meta { font-size: 12px; color: #888; margin-top: 4px; }
        .container { display: flex; height: calc(100vh - 80px); }
        .sidebar { width: 300px; background: #252525; border-right: 1px solid #444; overflow-y: auto; }
        .event { padding: 12px; border-bottom: 1px solid #333; cursor: pointer; transition: background 0.2s; }
        .event:hover { background: #333; }
        .event.active { background: #0066cc; }
        .event-type { font-size: 11px; text-transform: uppercase; color: #888; margin-bottom: 4px; }
        .event-action { font-weight: 500; }
        .event-url { font-size: 12px; color: #aaa; margin-top: 4px; word-break: break-all; }
        .event-time { font-size: 11px; color: #666; margin-top: 4px; }
        .content { flex: 1; display: flex; flex-direction: column; }
        .tabs { display: flex; background: #2d2d2d; border-bottom: 1px solid #444; }
        .tab { padding: 12px 20px; cursor: pointer; border-bottom: 2px solid transparent; }
        .tab.active { border-color: #0066cc; color: #0066cc; }
        .tab-content { flex: 1; overflow: auto; padding: 20px; }
        .screenshot { max-width: 100%; border: 1px solid #444; border-radius: 4px; }
        .snapshot { background: #252525; padding: 16px; border-radius: 4px; font-family: monospace; font-size: 12px; overflow: auto; white-space: pre-wrap; }
        .details { background: #252525; padding: 16px; border-radius: 4px; }
        .detail-row { display: flex; padding: 8px 0; border-bottom: 1px solid #333; }
        .detail-row:last-child { border-bottom: none; }
        .detail-label { width: 120px; color: #888; font-size: 12px; }
        .detail-value { flex: 1; font-size: 12px; word-break: break-all; }
        .timeline { padding: 8px 16px; background: #2d2d2d; border-bottom: 1px solid #444; }
        .timeline-item { display: inline-block; width: 8px; height: 20px; margin-right: 2px; border-radius: 2px; }
        .timeline-item.action { background: #4CAF50; }
        .timeline-item.navigation { background: #2196F3; }
        .timeline-item.network { background: #FF9800; }
        .timeline-item.error { background: #f44336; }
    </style>
</head>
<body>
    <div class="header">
        <h1>${this.currentTrace.name}</h1>
        <div class="meta">
            ${this.currentTrace.events.length} events | 
            Duration: ${this.currentTrace.metadata.duration}ms | 
            ${new Date(this.currentTrace.metadata.startTime).toLocaleString()}
        </div>
    </div>
    
    <div class="timeline">
        ${this.currentTrace.events.map(e => 
    `<div class="timeline-item ${e.type}" title="${e.data.action || e.type}"></div>`
  ).join('')}
    </div>
    
    <div class="container">
        <div class="sidebar">
            ${this.currentTrace.events.map((e, i) => `
                <div class="event ${i === 0 ? 'active' : ''}" data-index="${i}">
                    <div class="event-type">${e.type}</div>
                    <div class="event-action">${e.data.action || e.data.url || e.data.message || 'Event'}</div>
                    ${e.data.url ? `<div class="event-url">${e.data.url.substring(0, 60)}...</div>` : ''}
                    <div class="event-time">${new Date(e.timestamp).toLocaleTimeString()}</div>
                </div>
            `).join('')}
        </div>
        
        <div class="content">
            <div class="tabs">
                <div class="tab active" data-tab="screenshot">Screenshot</div>
                <div class="tab" data-tab="details">Details</div>
                <div class="tab" data-tab="snapshot">DOM Snapshot</div>
            </div>
            
            <div class="tab-content" id="content">
                <p>Select an event to view details</p>
            </div>
        </div>
    </div>

    <script>
        const events = ${JSON.stringify(this.currentTrace.events)};
        let currentIndex = 0;

        function showEvent(index) {
            currentIndex = index;
            const event = events[index];
            const content = document.getElementById('content');
            
            // Update active state
            document.querySelectorAll('.event').forEach((el, i) => {
                el.classList.toggle('active', i === index);
            });

            // Show screenshot if available
            if (event.screenshot) {
                content.innerHTML = \`<img class="screenshot" src="\${event.screenshot}" alt="Screenshot" />\`;
            } else {
                content.innerHTML = '<p>No screenshot available for this event</p>';
            }
        }

        // Event listeners
        document.querySelectorAll('.event').forEach(el => {
            el.addEventListener('click', () => {
                showEvent(parseInt(el.dataset.index));
            });
        });

        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                const event = events[currentIndex];
                const content = document.getElementById('content');
                
                switch(tab.dataset.tab) {
                    case 'screenshot':
                        content.innerHTML = event.screenshot 
                            ? \`<img class="screenshot" src="\${event.screenshot}" alt="Screenshot" />\`
                            : '<p>No screenshot available</p>';
                        break;
                    case 'details':
                        content.innerHTML = \`
                            <div class="details">
                                \${Object.entries(event.data).map(([k, v]) => \`
                                    <div class="detail-row">
                                        <div class="detail-label">\${k}</div>
                                        <div class="detail-value">\${JSON.stringify(v, null, 2)}</div>
                                    </div>
                                \`).join('')}
                            </div>
                        \`;
                        break;
                    case 'snapshot':
                        content.innerHTML = event.snapshot
                            ? \`<div class="snapshot">Loading... <iframe src="\${event.snapshot}" style="width:100%;height:500px;border:none;"></iframe></div>\`
                            : '<p>No DOM snapshot available</p>';
                        break;
                }
            });
        });

        // Show first event
        showEvent(0);
    </script>
</body>
</html>`;

    await fs.writeFile(path.join(this.traceDir, 'index.html'), html);
  }

  /**
     * Load and view a trace
     * @param {string} traceId - Trace ID
     * @returns {Object} Trace data
     */
  async loadTrace(traceId) {
    const tracePath = path.join(this.options.outputDir, traceId, 'trace.json');
    const data = await fs.readFile(tracePath, 'utf8');
    return JSON.parse(data);
  }

  /**
     * List all traces
     * @returns {Promise<Array>}
     */
  async listTraces() {
    try {
      const entries = await fs.readdir(this.options.outputDir);
      const traces = [];

      for (const entry of entries) {
        const tracePath = path.join(this.options.outputDir, entry, 'trace.json');
        try {
          const data = await fs.readFile(tracePath, 'utf8');
          const trace = JSON.parse(data);
          traces.push({
            id: entry,
            name: trace.name,
            eventCount: trace.events.length,
            duration: trace.metadata.duration,
            createdAt: trace.metadata.startTime
          });
        } catch (e) {
          // Skip invalid traces
        }
      }

      return traces.sort((a, b) => b.createdAt - a.createdAt);
    } catch (e) {
      return [];
    }
  }

  /**
     * Delete a trace
     * @param {string} traceId - Trace ID
     */
  async deleteTrace(traceId) {
    const traceDir = path.join(this.options.outputDir, traceId);
        
    const deleteRecursive = async (dirPath) => {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
            
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          await deleteRecursive(fullPath);
        } else {
          await fs.unlink(fullPath);
        }
      }
            
      await fs.rmdir(dirPath);
    };

    await deleteRecursive(traceDir);
  }
}

module.exports = TraceViewer;
