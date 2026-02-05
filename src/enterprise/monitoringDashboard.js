/**
 * Advanced Monitoring Dashboard
 * Real-time metrics, visualization, and alerting
 * @module enterprise/monitoringDashboard
 */

const EventEmitter = require('events');
const express = require('express');
const WebSocket = require('ws');
const path = require('path');

class MonitoringDashboard extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      port: config.port || 3000,
      enableWebSocket: config.enableWebSocket !== false,
      metricsInterval: config.metricsInterval || 1000,
      retentionPeriod: config.retentionPeriod || 3600000, // 1 hour
      alertThresholds: config.alertThresholds || {
        errorRate: 0.1,
        responseTime: 5000,
        cpuUsage: 80,
        memoryUsage: 90
      },
      ...config
    };
    
    this.metrics = {
      timeSeries: [],
      current: {},
      aggregated: {}
    };
    
    this.alerts = [];
    this.connectedClients = new Set();
    this.isRunning = false;
  }

  /**
   * Start monitoring dashboard
   */
  async start() {
    if (this.isRunning) return;
    
    this.app = express();
    this.setupRoutes();
    
    this.server = this.app.listen(this.config.port, () => {
      console.log(`Monitoring Dashboard running on port ${this.config.port}`);
      this.emit('started', { port: this.config.port });
    });
    
    if (this.config.enableWebSocket) {
      this.setupWebSocket();
    }
    
    this.startMetricsCollection();
    this.isRunning = true;
  }

  /**
   * Setup HTTP routes
   */
  setupRoutes() {
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, '../../dashboard/public')));
    
    // API endpoints
    this.app.get('/api/metrics', (req, res) => {
      res.json(this.getCurrentMetrics());
    });
    
    this.app.get('/api/metrics/history', (req, res) => {
      const duration = parseInt(req.query.duration) || 3600000;
      res.json(this.getMetricsHistory(duration));
    });
    
    this.app.get('/api/alerts', (req, res) => {
      res.json(this.getActiveAlerts());
    });
    
    this.app.get('/api/stats', (req, res) => {
      res.json(this.getAggregatedStats());
    });
    
    this.app.post('/api/alerts/:id/acknowledge', (req, res) => {
      const alertId = req.params.id;
      this.acknowledgeAlert(alertId);
      res.json({ success: true });
    });
    
    this.app.get('/api/health', (req, res) => {
      res.json({
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: Date.now()
      });
    });
    
    // Dashboard UI
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, '../../dashboard/public/index.html'));
    });
  }

  /**
   * Setup WebSocket for real-time updates
   */
  setupWebSocket() {
    this.wss = new WebSocket.Server({ server: this.server });
    
    this.wss.on('connection', (ws) => {
      console.log('Dashboard client connected');
      this.connectedClients.add(ws);
      
      // Send initial data
      ws.send(JSON.stringify({
        type: 'initial',
        data: this.getCurrentMetrics()
      }));
      
      ws.on('close', () => {
        this.connectedClients.delete(ws);
        console.log('Dashboard client disconnected');
      });
      
      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.connectedClients.delete(ws);
      });
    });
  }

  /**
   * Start metrics collection
   */
  startMetricsCollection() {
    this.metricsInterval = setInterval(() => {
      this.collectMetrics();
      this.broadcastMetrics();
      this.checkAlertThresholds();
      this.cleanupOldMetrics();
    }, this.config.metricsInterval);
  }

  /**
   * Collect system and application metrics
   */
  collectMetrics() {
    const timestamp = Date.now();
    const metrics = {
      timestamp,
      system: this.collectSystemMetrics(),
      application: this.collectApplicationMetrics(),
      performance: this.collectPerformanceMetrics()
    };
    
    this.metrics.timeSeries.push(metrics);
    this.metrics.current = metrics;
    
    this.updateAggregatedMetrics();
    this.emit('metrics-collected', metrics);
  }

  /**
   * Collect system metrics
   */
  collectSystemMetrics() {
    const os = require('os');
    
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    
    const cpus = os.cpus();
    const avgLoad = os.loadavg()[0];
    
    return {
      cpu: {
        count: cpus.length,
        model: cpus[0].model,
        usage: (avgLoad / cpus.length) * 100,
        loadAverage: os.loadavg()
      },
      memory: {
        total: totalMem,
        used: usedMem,
        free: freeMem,
        usagePercent: (usedMem / totalMem) * 100
      },
      process: {
        uptime: process.uptime(),
        pid: process.pid,
        memory: process.memoryUsage()
      }
    };
  }

  /**
   * Collect application-specific metrics
   */
  collectApplicationMetrics() {
    return {
      activeWorkers: this.getActiveWorkerCount(),
      activeTasks: this.getActiveTaskCount(),
      queuedTasks: this.getQueuedTaskCount(),
      completedTasks: this.getCompletedTaskCount(),
      failedTasks: this.getFailedTaskCount(),
      successRate: this.getSuccessRate(),
      averageResponseTime: this.getAverageResponseTime()
    };
  }

  /**
   * Collect performance metrics
   */
  collectPerformanceMetrics() {
    return {
      throughput: this.calculateThroughput(),
      latency: this.calculateLatency(),
      errorRate: this.calculateErrorRate(),
      concurrency: this.getConcurrencyLevel()
    };
  }

  /**
   * Update aggregated metrics
   */
  updateAggregatedMetrics() {
    const recentMetrics = this.metrics.timeSeries.slice(-60); // Last minute
    
    this.metrics.aggregated = {
      avgCpuUsage: this.calculateAverage(recentMetrics, 'system.cpu.usage'),
      avgMemoryUsage: this.calculateAverage(recentMetrics, 'system.memory.usagePercent'),
      avgResponseTime: this.calculateAverage(recentMetrics, 'application.averageResponseTime'),
      totalThroughput: this.calculateSum(recentMetrics, 'performance.throughput'),
      peakConcurrency: this.calculateMax(recentMetrics, 'performance.concurrency')
    };
  }

  /**
   * Broadcast metrics to connected clients
   */
  broadcastMetrics() {
    if (!this.config.enableWebSocket || this.connectedClients.size === 0) return;
    
    const message = JSON.stringify({
      type: 'metrics-update',
      data: this.metrics.current
    });
    
    this.connectedClients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  /**
   * Check alert thresholds
   */
  checkAlertThresholds() {
    const current = this.metrics.current;
    const thresholds = this.config.alertThresholds;
    
    // CPU usage alert
    if (current.system?.cpu?.usage > thresholds.cpuUsage) {
      this.createAlert('high-cpu-usage', 'warning', 
        `CPU usage at ${current.system.cpu.usage.toFixed(2)}%`);
    }
    
    // Memory usage alert
    if (current.system?.memory?.usagePercent > thresholds.memoryUsage) {
      this.createAlert('high-memory-usage', 'warning',
        `Memory usage at ${current.system.memory.usagePercent.toFixed(2)}%`);
    }
    
    // Error rate alert
    if (current.performance?.errorRate > thresholds.errorRate) {
      this.createAlert('high-error-rate', 'error',
        `Error rate at ${(current.performance.errorRate * 100).toFixed(2)}%`);
    }
    
    // Response time alert
    if (current.application?.averageResponseTime > thresholds.responseTime) {
      this.createAlert('high-response-time', 'warning',
        `Average response time at ${current.application.averageResponseTime}ms`);
    }
  }

  /**
   * Create alert
   */
  createAlert(type, severity, message) {
    // Check if similar alert already exists
    const existing = this.alerts.find(a => 
      a.type === type && 
      a.severity === severity && 
      !a.acknowledged &&
      (Date.now() - a.timestamp) < 60000 // Within last minute
    );
    
    if (existing) return;
    
    const alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      severity,
      message,
      timestamp: Date.now(),
      acknowledged: false
    };
    
    this.alerts.push(alert);
    this.emit('alert-created', alert);
    
    // Broadcast alert
    this.broadcastAlert(alert);
  }

  /**
   * Broadcast alert to connected clients
   */
  broadcastAlert(alert) {
    if (!this.config.enableWebSocket) return;
    
    const message = JSON.stringify({
      type: 'alert',
      data: alert
    });
    
    this.connectedClients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  /**
   * Acknowledge alert
   */
  acknowledgeAlert(alertId) {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedAt = Date.now();
      this.emit('alert-acknowledged', alert);
    }
  }

  /**
   * Get active alerts
   */
  getActiveAlerts() {
    return this.alerts.filter(a => !a.acknowledged);
  }

  /**
   * Get current metrics
   */
  getCurrentMetrics() {
    return {
      current: this.metrics.current,
      aggregated: this.metrics.aggregated,
      alerts: this.getActiveAlerts()
    };
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(duration) {
    const cutoff = Date.now() - duration;
    return this.metrics.timeSeries.filter(m => m.timestamp >= cutoff);
  }

  /**
   * Get aggregated statistics
   */
  getAggregatedStats() {
    return {
      ...this.metrics.aggregated,
      totalAlerts: this.alerts.length,
      activeAlerts: this.getActiveAlerts().length,
      connectedClients: this.connectedClients.size
    };
  }

  /**
   * Cleanup old metrics
   */
  cleanupOldMetrics() {
    const cutoff = Date.now() - this.config.retentionPeriod;
    this.metrics.timeSeries = this.metrics.timeSeries.filter(m => m.timestamp >= cutoff);
    this.alerts = this.alerts.filter(a => a.timestamp >= cutoff - 86400000); // Keep alerts for 24h
  }

  /**
   * Helper calculation methods
   */
  calculateAverage(metrics, path) {
    const values = metrics.map(m => this.getNestedValue(m, path)).filter(v => v !== undefined);
    return values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;
  }

  calculateSum(metrics, path) {
    const values = metrics.map(m => this.getNestedValue(m, path)).filter(v => v !== undefined);
    return values.reduce((sum, v) => sum + v, 0);
  }

  calculateMax(metrics, path) {
    const values = metrics.map(m => this.getNestedValue(m, path)).filter(v => v !== undefined);
    return values.length > 0 ? Math.max(...values) : 0;
  }

  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Placeholder methods for metrics collection
   * These should be implemented to interface with actual system components
   */
  getActiveWorkerCount() { return 0; }
  getActiveTaskCount() { return 0; }
  getQueuedTaskCount() { return 0; }
  getCompletedTaskCount() { return 0; }
  getFailedTaskCount() { return 0; }
  getSuccessRate() { return 1.0; }
  getAverageResponseTime() { return 0; }
  calculateThroughput() { return 0; }
  calculateLatency() { return 0; }
  calculateErrorRate() { return 0; }
  getConcurrencyLevel() { return 0; }

  /**
   * Stop monitoring dashboard
   */
  async stop() {
    if (!this.isRunning) return;
    
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    
    if (this.wss) {
      this.wss.close();
    }
    
    if (this.server) {
      await new Promise((resolve) => this.server.close(resolve));
    }
    
    this.isRunning = false;
    this.emit('stopped');
  }
}

module.exports = MonitoringDashboard;
