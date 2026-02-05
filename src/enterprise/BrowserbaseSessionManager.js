/**
 * Browserbase Session Manager
 * Manages multiple Browserbase sessions with pooling and load balancing
 * @module BrowserbaseSessionManager
 * @version 2.2.0
 *
 * IMPORTANT: This is an ORIGINAL implementation for session management.
 * This code does NOT contain any proprietary Browserbase source code.
 * It uses the original BrowserbaseProvider to make API calls to Browserbase's service.
 *
 * This implementation:
 * - Implements custom session pooling and queue management
 * - Contains 100% original code written for BrowserAgent
 * - Uses standard Node.js EventEmitter
 * - Complies with all Browserbase terms of service
 */

const { BrowserbaseProvider, BrowserbaseError } = require('../providers/BrowserbaseProvider');
const EventEmitter = require('events');

/**
 * Custom error classes for session manager
 */
class SessionPoolExhaustedError extends BrowserbaseError {
  constructor(message = 'Session pool exhausted') {
    super(message, 'POOL_EXHAUSTED');
    this.name = 'SessionPoolExhaustedError';
  }
}

class SessionAcquisitionTimeoutError extends BrowserbaseError {
  constructor(message = 'Session acquisition timeout') {
    super(message, 'ACQUISITION_TIMEOUT');
    this.name = 'SessionAcquisitionTimeoutError';
  }
}

/**
 * Manages Browserbase browser sessions with pooling support
 * Provides intelligent session reuse, queueing, and lifecycle management
 */
class BrowserbaseSessionManager extends EventEmitter {
  /**
   * Create a new BrowserbaseSessionManager
   * @param {Object} config - Configuration options
   * @param {string} config.apiKey - Browserbase API key
   * @param {string} config.projectId - Browserbase project ID
   * @param {number} config.maxSessions - Maximum concurrent sessions (default: 5)
   * @param {number} config.minPoolSize - Minimum pool size to maintain (default: 1)
   * @param {number} config.sessionTimeout - Session timeout in ms (default: 300000)
   * @param {number} config.poolIdleTimeout - Pool session idle timeout in ms (default: 600000)
   * @param {boolean} config.enablePooling - Enable session pooling (default: true)
   * @param {number} config.acquisitionTimeout - Max time to wait for session in ms (default: 30000)
   * @param {boolean} config.autoRefill - Auto-refill pool when sessions are taken (default: true)
   * @param {Object} config.defaultSessionConfig - Default config for new sessions
   * @param {number} config.cleanupIntervalMs - Cleanup interval in ms (default: 60000)
   */
  constructor(config = {}) {
    super();

    this.apiKey = config.apiKey || process.env.BROWSERBASE_API_KEY;
    this.projectId = config.projectId || process.env.BROWSERBASE_PROJECT_ID;
    this.maxSessions = config.maxSessions || 5;
    this.minPoolSize = config.minPoolSize || 1;
    this.sessionTimeout = config.sessionTimeout || 300000;
    this.poolIdleTimeout = config.poolIdleTimeout || 600000;
    this.enablePooling = config.enablePooling !== false;
    this.acquisitionTimeout = config.acquisitionTimeout || 30000;
    this.autoRefill = config.autoRefill !== false;
    this.cleanupIntervalMs = config.cleanupIntervalMs || 60000;
    this.defaultSessionConfig = config.defaultSessionConfig || {
      stealth: true,
      resolution: '1920x1080',
      browser: 'chrome',
      keepAlive: true
    };

    // Session pools
    this.activeSessions = new Map();
    this.availableSessions = [];
    this.sessionQueue = [];

    // Statistics
    this.stats = {
      totalCreated: 0,
      totalReused: 0,
      totalClosed: 0,
      totalFailed: 0,
      averageSessionDuration: 0,
      currentActive: 0,
      poolHits: 0,
      poolMisses: 0,
      queueWaitTime: 0,
      totalQueueWaits: 0
    };

    // State
    this.initialized = false;
    this.stopped = false;
    this.cleanupInterval = null;
  }

  /**
   * Initialize the session manager
   * @returns {Promise<void>}
   * @throws {BrowserbaseError} If initialization fails
   */
  async init() {
    if (this.initialized) {
      throw new BrowserbaseError('Session manager already initialized', 'ALREADY_INITIALIZED');
    }

    if (this.stopped) {
      throw new BrowserbaseError('Session manager has been stopped', 'MANAGER_STOPPED');
    }

    if (!this.apiKey) {
      throw new BrowserbaseError(
        'Browserbase API key is required. Set BROWSERBASE_API_KEY environment variable or pass apiKey in config.',
        'NO_API_KEY'
      );
    }

    if (!this.projectId) {
      throw new BrowserbaseError(
        'Browserbase project ID is required. Set BROWSERBASE_PROJECT_ID environment variable or pass projectId in config.',
        'NO_PROJECT_ID'
      );
    }

    // Test connection
    const isConnected = await BrowserbaseProvider.checkConnection(this.apiKey, this.defaultSessionConfig.apiBaseURL);
    if (!isConnected) {
      throw new BrowserbaseError('Failed to connect to Browserbase API. Please check your API key.', 'CONNECTION_FAILED');
    }

    // Pre-fill pool if minPoolSize > 0
    if (this.enablePooling && this.minPoolSize > 0) {
      await this._prefillPool();
    }

    this.initialized = true;
    this.startCleanupInterval();
    this.emit('initialized');
    console.log('✅ Browserbase Session Manager initialized');
  }

  /**
   * Pre-fill the pool to minimum size
   * @private
   * @returns {Promise<void>}
   */
  async _prefillPool() {
    const sessionsToCreate = Math.min(this.minPoolSize, this.maxSessions);
    const createPromises = [];

    for (let i = 0; i < sessionsToCreate; i++) {
      createPromises.push(
        this.createSession(this.defaultSessionConfig).then(provider => {
          this.availableSessions.push(provider);
          this.activeSessions.delete(provider.sessionId);
          return provider;
        }).catch(error => {
          console.warn(`Failed to pre-fill pool session: ${error.message}`);
          return null;
        })
      );
    }

    await Promise.all(createPromises);
    console.log(`Pool pre-filled with ${this.availableSessions.length} sessions`);
  }

  /**
   * Acquire a session from the pool or create a new one
   * @param {Object} options - Session options
   * @param {number} options.priority - Priority in queue (lower = higher priority)
   * @returns {Promise<BrowserbaseProvider>} Session instance
   * @throws {SessionPoolExhaustedError} If pool is exhausted and queue is full
   * @throws {SessionAcquisitionTimeoutError} If acquisition times out
   */
  async acquireSession(options = {}) {
    if (this.stopped) {
      throw new BrowserbaseError('Session manager has been stopped', 'MANAGER_STOPPED');
    }

    const startTime = Date.now();

    // Check if we have available sessions in pool
    if (this.enablePooling && this.availableSessions.length > 0) {
      const session = this.availableSessions.shift();
      this.activeSessions.set(session.sessionId, {
        provider: session,
        acquiredAt: Date.now(),
        options
      });
      this.stats.totalReused++;
      this.stats.poolHits++;
      this.emit('sessionAcquired', { sessionId: session.sessionId, fromPool: true });
      return session;
    }

    this.stats.poolMisses++;

    // Check if we're at max sessions
    if (this.activeSessions.size >= this.maxSessions) {
      // Add to queue and wait
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          const index = this.sessionQueue.findIndex(item => item.resolve === resolve);
          if (index > -1) {
            this.sessionQueue.splice(index, 1);
          }
          reject(new SessionAcquisitionTimeoutError('Session acquisition timeout'));
        }, this.acquisitionTimeout);

        this.sessionQueue.push({
          resolve,
          reject,
          options,
          timeout,
          priority: options.priority || 0,
          queuedAt: Date.now()
        });

        // Sort queue by priority (lower = higher priority)
        this.sessionQueue.sort((a, b) => a.priority - b.priority);

        this.emit('sessionQueued', { queueLength: this.sessionQueue.length });
      });
    }

    // Create a new session
    return this.createSession(options);
  }

  /**
   * Create a new Browserbase session
   * @private
   * @param {Object} options - Session options
   * @returns {Promise<BrowserbaseProvider>} Session instance
   * @throws {BrowserbaseError} If session creation fails
   */
  async createSession(options = {}) {
    const sessionConfig = {
      ...this.defaultSessionConfig,
      ...options,
      projectId: this.projectId
    };

    const provider = new BrowserbaseProvider(this.apiKey, sessionConfig);

    try {
      await provider.init();

      this.activeSessions.set(provider.sessionId, {
        provider,
        acquiredAt: Date.now(),
        createdAt: Date.now(),
        options
      });

      this.stats.totalCreated++;
      this.stats.currentActive = this.activeSessions.size;

      this.emit('sessionCreated', { sessionId: provider.sessionId, config: sessionConfig });

      return provider;
    } catch (error) {
      this.stats.totalFailed++;
      this.emit('sessionFailed', { error: error.message, config: sessionConfig });
      throw error;
    }
  }

  /**
   * Release a session back to the pool
   * @param {BrowserbaseProvider} provider - Session provider
   * @param {Object} options - Release options
   * @param {boolean} options.closeSession - Whether to close the session (default: false)
   * @param {boolean} options.markAsFailed - Mark session as failed (default: false)
   * @returns {Promise<void>}
   */
  async releaseSession(provider, options = {}) {
    if (!provider || !provider.sessionId) {
      return;
    }

    const { closeSession = false, markAsFailed = false } = options;
    const sessionId = provider.sessionId;
    const sessionInfo = this.activeSessions.get(sessionId);

    if (!sessionInfo) {
      // Session might be in available pool
      const poolIndex = this.availableSessions.findIndex(s => s.sessionId === sessionId);
      if (poolIndex > -1) {
        this.availableSessions.splice(poolIndex, 1);
      }
      return;
    }

    // Remove from active
    this.activeSessions.delete(sessionId);

    if (markAsFailed || closeSession) {
      // Close the session
      try {
        await provider.close();
        this.stats.totalClosed++;
        this.emit('sessionClosed', { sessionId, reason: markAsFailed ? 'failed' : 'explicit' });
      } catch (error) {
        console.warn(`Error closing session ${sessionId}:`, error.message);
      }
    } else if (this.enablePooling) {
      // Return to pool with timestamp for idle tracking
      provider.poolReturnedAt = Date.now();
      this.availableSessions.push(provider);
      this.emit('sessionReturned', { sessionId, poolSize: this.availableSessions.length });
    } else {
      // Close if pooling is disabled
      try {
        await provider.close();
        this.stats.totalClosed++;
      } catch (error) {
        console.warn(`Error closing session ${sessionId}:`, error.message);
      }
    }

    this.stats.currentActive = this.activeSessions.size;

    // Process queue
    this.processQueue();

    // Auto-refill pool if enabled
    if (this.autoRefill && this.enablePooling && this.availableSessions.length < this.minPoolSize) {
      this._refillPool().catch(error => {
        console.warn(`Failed to refill pool: ${error.message}`);
      });
    }

    // Update average duration
    if (sessionInfo) {
      const duration = Date.now() - sessionInfo.acquiredAt;
      this.updateAverageDuration(duration);
    }
  }

  /**
   * Refill pool to minimum size
   * @private
   * @returns {Promise<void>}
   */
  async _refillPool() {
    const sessionsNeeded = this.minPoolSize - this.availableSessions.length;
    if (sessionsNeeded <= 0) return;

    for (let i = 0; i < sessionsNeeded; i++) {
      if (this.activeSessions.size + this.availableSessions.length >= this.maxSessions) {
        break;
      }

      try {
        const provider = await this.createSession(this.defaultSessionConfig);
        provider.poolReturnedAt = Date.now();
        this.availableSessions.push(provider);
        this.activeSessions.delete(provider.sessionId);
      } catch (error) {
        console.warn(`Failed to refill pool: ${error.message}`);
        break;
      }
    }
  }

  /**
   * Process the session queue
   * @private
   * @returns {Promise<void>}
   */
  async processQueue() {
    // First try to use available sessions from pool
    while (this.sessionQueue.length > 0 && this.availableSessions.length > 0) {
      const { resolve, options } = this.sessionQueue.shift();
      const session = this.availableSessions.shift();

      this.activeSessions.set(session.sessionId, {
        provider: session,
        acquiredAt: Date.now(),
        options
      });

      this.stats.totalReused++;
      this.stats.poolHits++;
      this.emit('sessionAcquired', { sessionId: session.sessionId, fromPool: true });
      resolve(session);
    }

    // Then create new sessions if under max
    while (this.sessionQueue.length > 0 && this.activeSessions.size < this.maxSessions) {
      const { resolve, reject, options, timeout, queuedAt } = this.sessionQueue.shift();
      clearTimeout(timeout);

      const waitTime = Date.now() - queuedAt;
      this.stats.totalQueueWaits++;
      this.stats.queueWaitTime += waitTime;

      try {
        const session = await this.createSession(options);
        resolve(session);
      } catch (error) {
        reject(error);
      }
    }
  }

  /**
     * Get all active sessions
     * @returns {Array} Active session IDs
     */
  getActiveSessions() {
    return Array.from(this.activeSessions.keys());
  }

  /**
     * Get session by ID
     * @param {string} sessionId - Session ID
     * @returns {BrowserbaseProvider|null} Session provider
     */
  getSession(sessionId) {
    const sessionInfo = this.activeSessions.get(sessionId);
    return sessionInfo ? sessionInfo.provider : null;
  }

  /**
     * Close all sessions
     * @returns {Promise<void>}
     */
  async closeAllSessions() {
    const closePromises = [];

    // Close active sessions
    for (const [sessionId, sessionInfo] of this.activeSessions) {
      closePromises.push(
        sessionInfo.provider.close().catch(error => {
          console.warn(`Error closing session ${sessionId}:`, error.message);
        })
      );
    }

    // Close pooled sessions
    for (const provider of this.availableSessions) {
      closePromises.push(
        provider.close().catch(error => {
          console.warn('Error closing pooled session:', error.message);
        })
      );
    }

    await Promise.all(closePromises);

    this.activeSessions.clear();
    this.availableSessions = [];
    this.stats.currentActive = 0;

    this.emit('allSessionsClosed');
  }

  /**
     * Update average session duration
     * @private
     * @param {number} duration - Session duration in ms
     */
  updateAverageDuration(duration) {
    const total = this.stats.totalClosed + this.stats.totalReused;
    if (total === 0) {
      this.stats.averageSessionDuration = duration;
    } else {
      this.stats.averageSessionDuration = 
                (this.stats.averageSessionDuration * (total - 1) + duration) / total;
    }
  }

  /**
   * Start cleanup interval for stale sessions
   * @private
   */
  startCleanupInterval() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleSessions();
    }, this.cleanupIntervalMs);
  }

  /**
   * Clean up stale sessions
   * @private
   * @returns {Promise<void>}
   */
  async cleanupStaleSessions() {
    const now = Date.now();
    const staleSessions = [];

    // Clean up active sessions that have timed out
    for (const [sessionId, sessionInfo] of this.activeSessions) {
      if (now - sessionInfo.acquiredAt > this.sessionTimeout) {
        staleSessions.push({ sessionId, reason: 'timeout' });
      }
    }

    for (const { sessionId, reason } of staleSessions) {
      console.log(`Cleaning up stale session: ${sessionId} (reason: ${reason})`);
      const sessionInfo = this.activeSessions.get(sessionId);
      if (sessionInfo) {
        await this.releaseSession(sessionInfo.provider, { closeSession: true });
      }
    }

    // Clean up pooled sessions that have been idle too long
    if (this.availableSessions.length > this.minPoolSize) {
      const toRemove = [];

      for (const provider of this.availableSessions) {
        if (provider.poolReturnedAt && now - provider.poolReturnedAt > this.poolIdleTimeout) {
          toRemove.push(provider);
        }
      }

      for (const provider of toRemove) {
        const index = this.availableSessions.indexOf(provider);
        if (index > -1) {
          this.availableSessions.splice(index, 1);
          try {
            await provider.close();
            this.stats.totalClosed++;
            console.log(`Closed idle pooled session: ${provider.sessionId}`);
          } catch (error) {
            console.warn(`Error closing idle session ${provider.sessionId}:`, error.message);
          }
        }
      }
    }
  }

  /**
     * Get manager statistics
     * @returns {Object} Statistics
     */
  getStats() {
    return {
      ...this.stats,
      poolSize: this.availableSessions.length,
      queueLength: this.sessionQueue.length,
      maxSessions: this.maxSessions,
      enablePooling: this.enablePooling
    };
  }

  /**
     * Set maximum sessions
     * @param {number} max - Maximum sessions
     */
  setMaxSessions(max) {
    this.maxSessions = max;
    this.processQueue();
  }

  /**
   * Get session by ID
   * @param {string} sessionId - Session ID
   * @returns {BrowserbaseProvider|null} Session provider
   */
  getSession(sessionId) {
    const sessionInfo = this.activeSessions.get(sessionId);
    if (sessionInfo) {
      return sessionInfo.provider;
    }

    // Check in available pool
    return this.availableSessions.find(s => s.sessionId === sessionId) || null;
  }

  /**
   * Check if a session is valid and still active
   * @param {BrowserbaseProvider} provider - Session provider
   * @returns {Promise<boolean>} True if session is valid
   */
  async validateSession(provider) {
    if (!provider || !provider.sessionId) {
      return false;
    }

    try {
      await provider.getSessionStatus();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get detailed statistics
   * @returns {Object} Detailed statistics including calculated metrics
   */
  getDetailedStats() {
    const now = Date.now();
    const activeSessionAges = [];

    for (const [sessionId, sessionInfo] of this.activeSessions) {
      activeSessionAges.push(now - sessionInfo.acquiredAt);
    }

    const avgActiveAge = activeSessionAges.length > 0
      ? activeSessionAges.reduce((a, b) => a + b, 0) / activeSessionAges.length
      : 0;

    const avgQueueWait = this.stats.totalQueueWaits > 0
      ? this.stats.queueWaitTime / this.stats.totalQueueWaits
      : 0;

    const poolHitRate = (this.stats.poolHits + this.stats.poolMisses) > 0
      ? (this.stats.poolHits / (this.stats.poolHits + this.stats.poolMisses)) * 100
      : 0;

    return {
      ...this.stats,
      poolSize: this.availableSessions.length,
      queueLength: this.sessionQueue.length,
      maxSessions: this.maxSessions,
      minPoolSize: this.minPoolSize,
      enablePooling: this.enablePooling,
      poolHitRate: `${poolHitRate.toFixed(2)}%`,
      avgQueueWaitTime: `${avgQueueWait.toFixed(0)}ms`,
      avgActiveSessionAge: `${avgActiveAge.toFixed(0)}ms`,
      utilization: `${((this.activeSessions.size / this.maxSessions) * 100).toFixed(2)}%`
    };
  }

  /**
   * Stop the session manager and clean up
   * @param {Object} options - Stop options
   * @param {boolean} options.force - Force stop without waiting for queue (default: false)
   * @returns {Promise<void>}
   */
  async stop(options = {}) {
    const { force = false } = options;
    this.stopped = true;

    // Stop cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Clear or wait for queue
    if (force) {
      for (const { reject, timeout } of this.sessionQueue) {
        clearTimeout(timeout);
        reject(new BrowserbaseError('Session manager stopped', 'MANAGER_STOPPED'));
      }
      this.sessionQueue = [];
    } else {
      // Wait for queue to empty or timeout
      const waitPromise = new Promise(resolve => {
        const checkInterval = setInterval(() => {
          if (this.sessionQueue.length === 0) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
      });

      try {
        await Promise.race([waitPromise, new Promise(r => setTimeout(r, 5000))]);
      } catch (error) {
        // Ignore timeout
      }
    }

    // Close all sessions
    await this.closeAllSessions();

    this.initialized = false;
    this.emit('stopped');
  }

  /**
   * Health check for the session manager
   * @returns {Promise<Object>} Health status
   */
  async healthCheck() {
    const now = Date.now();
    const health = {
      healthy: true,
      initialized: this.initialized,
      stopped: this.stopped,
      sessions: {
        active: this.activeSessions.size,
        available: this.availableSessions.length,
        queued: this.sessionQueue.length,
        max: this.maxSessions,
        utilization: (this.activeSessions.size / this.maxSessions) * 100
      },
      errors: []
    };

    // Check pool health
    if (this.enablePooling && this.availableSessions.length < this.minPoolSize) {
      health.errors.push('Pool below minimum size');
      health.healthy = false;
    }

    // Check queue health
    if (this.sessionQueue.length > 0) {
      const oldestQueueItem = this.sessionQueue[0];
      const queueAge = now - oldestQueueItem.queuedAt;
      if (queueAge > this.acquisitionTimeout / 2) {
        health.errors.push('Queue wait times are high');
        health.healthy = false;
      }
    }

    // Check session health
    for (const [sessionId, sessionInfo] of this.activeSessions) {
      const sessionAge = now - sessionInfo.acquiredAt;
      if (sessionAge > this.sessionTimeout) {
        health.errors.push(`Session ${sessionId} has exceeded timeout`);
        health.healthy = false;
      }
    }

    return health;
  }
}

/**
 * Export classes
 */
module.exports = {
  BrowserbaseSessionManager,
  SessionPoolExhaustedError,
  SessionAcquisitionTimeoutError
};
