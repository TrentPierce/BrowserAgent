/**
 * Browserbase Session Manager
 * Manages multiple Browserbase sessions with pooling and load balancing
 * @module BrowserbaseSessionManager
 */

const { BrowserbaseProvider } = require('../providers/BrowserbaseProvider');
const EventEmitter = require('events');

/**
 * Manages Browserbase browser sessions with pooling support
 */
class BrowserbaseSessionManager extends EventEmitter {
    /**
     * Create a new BrowserbaseSessionManager
     * @param {Object} config - Configuration options
     * @param {string} config.apiKey - Browserbase API key
     * @param {string} config.projectId - Browserbase project ID
     * @param {number} config.maxSessions - Maximum concurrent sessions (default: 5)
     * @param {number} config.sessionTimeout - Session timeout in ms (default: 300000)
     * @param {boolean} config.enablePooling - Enable session pooling (default: true)
     * @param {Object} config.defaultSessionConfig - Default config for new sessions
     */
    constructor(config = {}) {
        super();
        
        this.apiKey = config.apiKey || process.env.BROWSERBASE_API_KEY;
        this.projectId = config.projectId || process.env.BROWSERBASE_PROJECT_ID;
        this.maxSessions = config.maxSessions || 5;
        this.sessionTimeout = config.sessionTimeout || 300000;
        this.enablePooling = config.enablePooling !== false;
        this.defaultSessionConfig = config.defaultSessionConfig || {
            stealth: true,
            resolution: '1920x1080',
            browser: 'chrome'
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
            currentActive: 0
        };

        // Cleanup interval
        this.cleanupInterval = null;
        this.startCleanupInterval();
    }

    /**
     * Initialize the session manager
     * @returns {Promise<void>}
     */
    async init() {
        if (!this.apiKey) {
            throw new Error('Browserbase API key is required. Set BROWSERBASE_API_KEY environment variable or pass apiKey in config.');
        }

        if (!this.projectId) {
            throw new Error('Browserbase project ID is required. Set BROWSERBASE_PROJECT_ID environment variable or pass projectId in config.');
        }

        // Test connection
        const isConnected = await BrowserbaseProvider.checkConnection(this.apiKey);
        if (!isConnected) {
            throw new Error('Failed to connect to Browserbase API. Please check your API key.');
        }

        this.emit('initialized');
        console.log('✅ Browserbase Session Manager initialized');
    }

    /**
     * Acquire a session from the pool or create a new one
     * @param {Object} options - Session options
     * @returns {Promise<BrowserbaseProvider>} Session instance
     */
    async acquireSession(options = {}) {
        // Check if we have available sessions in pool
        if (this.enablePooling && this.availableSessions.length > 0) {
            const session = this.availableSessions.shift();
            this.activeSessions.set(session.sessionId, {
                provider: session,
                acquiredAt: Date.now(),
                options
            });
            this.stats.totalReused++;
            this.emit('sessionAcquired', { sessionId: session.sessionId, fromPool: true });
            return session;
        }

        // Check if we're at max sessions
        if (this.activeSessions.size >= this.maxSessions) {
            // Add to queue and wait
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    const index = this.sessionQueue.findIndex(item => item.resolve === resolve);
                    if (index > -1) {
                        this.sessionQueue.splice(index, 1);
                    }
                    reject(new Error('Session acquisition timeout'));
                }, 30000);

                this.sessionQueue.push({
                    resolve,
                    reject,
                    options,
                    timeout
                });

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
                options
            });

            this.stats.totalCreated++;
            this.stats.currentActive = this.activeSessions.size;

            this.emit('sessionCreated', { sessionId: provider.sessionId });

            return provider;
        } catch (error) {
            this.stats.totalFailed++;
            this.emit('sessionFailed', { error: error.message });
            throw error;
        }
    }

    /**
     * Release a session back to the pool
     * @param {BrowserbaseProvider} provider - Session provider
     * @param {boolean} closeSession - Whether to close the session (default: false)
     * @returns {Promise<void>}
     */
    async releaseSession(provider, closeSession = false) {
        if (!provider || !provider.sessionId) {
            return;
        }

        const sessionId = provider.sessionId;
        const sessionInfo = this.activeSessions.get(sessionId);

        if (!sessionInfo) {
            return;
        }

        // Remove from active
        this.activeSessions.delete(sessionId);

        if (closeSession) {
            // Close the session
            try {
                await provider.close();
                this.stats.totalClosed++;
                this.emit('sessionClosed', { sessionId });
            } catch (error) {
                console.warn(`Error closing session ${sessionId}:`, error.message);
            }
        } else if (this.enablePooling) {
            // Return to pool
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

        // Update average duration
        if (sessionInfo) {
            const duration = Date.now() - sessionInfo.acquiredAt;
            this.updateAverageDuration(duration);
        }
    }

    /**
     * Process the session queue
     * @private
     */
    async processQueue() {
        while (this.sessionQueue.length > 0 && this.activeSessions.size < this.maxSessions) {
            const { resolve, reject, options, timeout } = this.sessionQueue.shift();
            clearTimeout(timeout);

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
                    console.warn(`Error closing pooled session:`, error.message);
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
        this.cleanupInterval = setInterval(() => {
            this.cleanupStaleSessions();
        }, 60000); // Run every minute
    }

    /**
     * Clean up stale sessions
     * @private
     */
    async cleanupStaleSessions() {
        const now = Date.now();
        const staleSessions = [];

        for (const [sessionId, sessionInfo] of this.activeSessions) {
            if (now - sessionInfo.acquiredAt > this.sessionTimeout) {
                staleSessions.push(sessionId);
            }
        }

        for (const sessionId of staleSessions) {
            console.log(`Cleaning up stale session: ${sessionId}`);
            const sessionInfo = this.activeSessions.get(sessionId);
            if (sessionInfo) {
                await this.releaseSession(sessionInfo.provider, true);
            }
        }

        // Clean up pooled sessions if too many
        while (this.availableSessions.length > this.maxSessions / 2) {
            const provider = this.availableSessions.shift();
            if (provider) {
                await provider.close().catch(() => {});
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
     * Stop the session manager and clean up
     * @returns {Promise<void>}
     */
    async stop() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }

        // Clear queue
        for (const { reject, timeout } of this.sessionQueue) {
            clearTimeout(timeout);
            reject(new Error('Session manager stopped'));
        }
        this.sessionQueue = [];

        // Close all sessions
        await this.closeAllSessions();

        this.emit('stopped');
    }
}

module.exports = { BrowserbaseSessionManager };
