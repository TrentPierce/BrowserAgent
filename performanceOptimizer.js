/**
 * ============================================================================
 * PERFORMANCE OPTIMIZER - Analysis Pipeline Optimization
 * ============================================================================
 * 
 * Optimizes analysis pipeline performance through intelligent caching,
 * memory management, selective component activation, and resource monitoring.
 * Automatically adapts based on system resources and analysis requirements.
 * 
 * FEATURES:
 * - Multi-layer caching (DOM, screenshot, results)
 * - Memory management and garbage collection optimization
 * - Execution time optimization based on requirements
 * - Selective component activation
 * - Resource monitoring and automatic throttling
 * - Cache invalidation strategies
 * - Performance metrics tracking
 * - Automatic cache cleanup
 * 
 * USAGE:
 * const optimizer = new PerformanceOptimizer({ cacheEnabled: true });
 * const optimized = optimizer.optimizeAnalysis(pageData, options);
 * 
 * ============================================================================
 */

const EventEmitter = require('events');
const crypto = require('crypto');

/**
 * Cache strategy
 * @enum {string}
 */
const CacheStrategy = {
    NONE: 'none',
    AGGRESSIVE: 'aggressive',   // Cache everything
    BALANCED: 'balanced',       // Cache selectively
    CONSERVATIVE: 'conservative' // Minimal caching
};

/**
 * Resource mode
 * @enum {string}
 */
const ResourceMode = {
    HIGH: 'high',      // High resource availability
    MEDIUM: 'medium',  // Medium resources
    LOW: 'low',        // Low resources, throttle
    CRITICAL: 'critical' // Critical, minimal operations
};

/**
 * Performance Optimizer for analysis pipeline
 * @class
 * @extends EventEmitter
 */
class PerformanceOptimizer extends EventEmitter {
    /**
     * Create a new PerformanceOptimizer instance
     * @param {Object} options - Configuration options
     * @param {boolean} [options.cacheEnabled=true] - Enable caching
     * @param {string} [options.cacheStrategy='balanced'] - Cache strategy
     * @param {number} [options.maxCacheSize=50] - Max cache items
     * @param {number} [options.cacheExpiry=300000] - Cache expiry in ms (5 min)
     * @param {boolean} [options.memoryManagement=true] - Enable memory management
     * @param {number} [options.gcInterval=60000] - GC interval in ms (1 min)
     * @param {boolean} [options.resourceMonitoring=true] - Enable resource monitoring
     * @param {number} [options.monitoringInterval=10000] - Monitor interval in ms
     */
    constructor(options = {}) {
        super();
        
        this.cacheEnabled = options.cacheEnabled !== undefined ? options.cacheEnabled : true;
        this.cacheStrategy = options.cacheStrategy || CacheStrategy.BALANCED;
        this.maxCacheSize = options.maxCacheSize || 50;
        this.cacheExpiry = options.cacheExpiry || 300000; // 5 minutes
        this.memoryManagement = options.memoryManagement !== undefined ? options.memoryManagement : true;
        this.gcInterval = options.gcInterval || 60000; // 1 minute
        this.resourceMonitoring = options.resourceMonitoring !== undefined ? options.resourceMonitoring : true;
        this.monitoringInterval = options.monitoringInterval || 10000; // 10 seconds
        
        // Caches
        this.domCache = new Map();
        this.screenshotCache = new Map();
        this.resultCache = new Map();
        this.analysisCache = new Map();
        
        // Resource state
        this.resourceMode = ResourceMode.HIGH;
        this.memoryUsage = { used: 0, total: 0, percentage: 0 };
        
        // Statistics
        this.stats = {
            cacheHits: 0,
            cacheMisses: 0,
            cacheEvictions: 0,
            totalOptimizations: 0,
            timeSaved: 0,
            memoryFreed: 0,
            gcRuns: 0,
            throttleActivations: 0
        };
        
        // Start background tasks
        if (this.memoryManagement) {
            this.startGarbageCollection();
        }
        
        if (this.resourceMonitoring) {
            this.startResourceMonitoring();
        }
        
        console.log('[PerformanceOptimizer] Initialized with strategy:', this.cacheStrategy);
    }
    
    /**
     * Optimize analysis configuration
     * @param {Object} pageData - Page data to analyze
     * @param {Object} options - Analysis options
     * @returns {Object} Optimized configuration
     */
    optimizeAnalysis(pageData, options = {}) {
        this.stats.totalOptimizations++;
        const startTime = Date.now();
        
        // Check caches first
        const cacheKey = this.generateCacheKey(pageData, options);
        
        if (this.cacheEnabled && this.shouldUseCache(options)) {
            const cached = this.getCachedResult(cacheKey);
            if (cached) {
                this.stats.cacheHits++;
                this.stats.timeSaved += cached.originalTime || 0;
                
                console.log('[PerformanceOptimizer] Cache hit, returning cached result');
                this.emit('cache:hit', { key: cacheKey });
                
                return {
                    optimized: true,
                    cached: true,
                    result: cached.result,
                    timeSaved: cached.originalTime || 0
                };
            }
            
            this.stats.cacheMisses++;
            this.emit('cache:miss', { key: cacheKey });
        }
        
        // Optimize based on resource mode
        const optimizedOptions = this.optimizeByResourceMode(options);
        
        // Select components based on requirements
        const componentSelection = this.selectComponents(pageData, optimizedOptions);
        
        // Apply caching strategies
        const cachedData = this.applyCaching(pageData);
        
        const optimizationTime = Date.now() - startTime;
        
        return {
            optimized: true,
            cached: false,
            cacheKey: cacheKey,
            pageData: cachedData,
            options: {
                ...optimizedOptions,
                ...componentSelection
            },
            optimizationTime: optimizationTime,
            resourceMode: this.resourceMode
        };
    }
    
    /**
     * Generate cache key for page data and options
     * @private
     * @param {Object} pageData - Page data
     * @param {Object} options - Options
     * @returns {string} Cache key
     */
    generateCacheKey(pageData, options) {
        const domHash = crypto.createHash('md5')
            .update(pageData.dom || '')
            .digest('hex')
            .substring(0, 8);
        
        const optionsHash = crypto.createHash('md5')
            .update(JSON.stringify(options))
            .digest('hex')
            .substring(0, 8);
        
        return `${domHash}-${optionsHash}`;
    }
    
    /**
     * Check if caching should be used
     * @private
     * @param {Object} options - Analysis options
     * @returns {boolean} Whether to use cache
     */
    shouldUseCache(options) {
        if (options.bypassCache) return false;
        
        switch (this.cacheStrategy) {
            case CacheStrategy.AGGRESSIVE:
                return true;
            case CacheStrategy.BALANCED:
                return !options.requiresFresh;
            case CacheStrategy.CONSERVATIVE:
                return options.allowCache === true;
            case CacheStrategy.NONE:
                return false;
            default:
                return true;
        }
    }
    
    /**
     * Get cached result
     * @private
     * @param {string} key - Cache key
     * @returns {Object|null} Cached result or null
     */
    getCachedResult(key) {
        const cached = this.resultCache.get(key);
        
        if (!cached) return null;
        
        // Check expiry
        if (Date.now() - cached.timestamp > this.cacheExpiry) {
            this.resultCache.delete(key);
            this.stats.cacheEvictions++;
            return null;
        }
        
        // Update access time
        cached.lastAccess = Date.now();
        cached.accessCount++;
        
        return cached;
    }
    
    /**
     * Cache analysis result
     * @param {string} key - Cache key
     * @param {Object} result - Analysis result
     * @param {number} executionTime - Original execution time
     */
    cacheResult(key, result, executionTime) {
        if (!this.cacheEnabled) return;
        
        // Check cache size
        if (this.resultCache.size >= this.maxCacheSize) {
            this.evictLeastRecentlyUsed(this.resultCache);
        }
        
        this.resultCache.set(key, {
            result: result,
            timestamp: Date.now(),
            lastAccess: Date.now(),
            accessCount: 0,
            originalTime: executionTime
        });
        
        this.emit('cache:stored', { key, size: this.resultCache.size });
    }
    
    /**
     * Evict least recently used cache entry
     * @private
     * @param {Map} cache - Cache to evict from
     */
    evictLeastRecentlyUsed(cache) {
        let oldestKey = null;
        let oldestTime = Infinity;
        
        for (const [key, value] of cache.entries()) {
            if (value.lastAccess < oldestTime) {
                oldestTime = value.lastAccess;
                oldestKey = key;
            }
        }
        
        if (oldestKey) {
            cache.delete(oldestKey);
            this.stats.cacheEvictions++;
            this.emit('cache:evicted', { key: oldestKey });
        }
    }
    
    /**
     * Optimize options based on resource mode
     * @private
     * @param {Object} options - Original options
     * @returns {Object} Optimized options
     */
    optimizeByResourceMode(options) {
        const optimized = { ...options };
        
        switch (this.resourceMode) {
            case ResourceMode.CRITICAL:
                optimized.maxConcurrent = 1;
                optimized.taskTimeout = 10000;
                optimized.enableVisualAnalysis = false;
                optimized.enableTemporalAnalysis = false;
                optimized.enableDecisionFusion = false;
                break;
            
            case ResourceMode.LOW:
                optimized.maxConcurrent = 2;
                optimized.taskTimeout = 15000;
                optimized.enableVisualAnalysis = false;
                optimized.enableTemporalAnalysis = false;
                break;
            
            case ResourceMode.MEDIUM:
                optimized.maxConcurrent = 3;
                optimized.taskTimeout = 25000;
                optimized.enableVisualAnalysis = true;
                optimized.enableTemporalAnalysis = false;
                break;
            
            case ResourceMode.HIGH:
                // No changes, use original options
                break;
        }
        
        return optimized;
    }
    
    /**
     * Select components based on requirements
     * @private
     * @param {Object} pageData - Page data
     * @param {Object} options - Options
     * @returns {Object} Component selection
     */
    selectComponents(pageData, options) {
        const selection = {
            useVisualAnalysis: false,
            useTemporalAnalysis: false,
            useDecisionFusion: false
        };
        
        // Enable visual analysis if we have screenshot
        if (pageData.screenshot && pageData.viewport) {
            selection.useVisualAnalysis = options.enableVisualAnalysis !== false;
        }
        
        // Enable temporal analysis if we have history
        if (options.hasHistory !== false) {
            selection.useTemporalAnalysis = options.enableTemporalAnalysis !== false;
        }
        
        // Enable decision fusion if enabled
        selection.useDecisionFusion = options.enableDecisionFusion !== false;
        
        return selection;
    }
    
    /**
     * Apply caching to page data
     * @private
     * @param {Object} pageData - Original page data
     * @returns {Object} Page data with cached elements
     */
    applyCaching(pageData) {
        const cached = { ...pageData };
        
        // Cache DOM if not already cached
        if (pageData.dom) {
            const domKey = this.hashString(pageData.dom);
            
            if (!this.domCache.has(domKey)) {
                if (this.domCache.size >= this.maxCacheSize) {
                    this.evictLeastRecentlyUsed(this.domCache);
                }
                
                this.domCache.set(domKey, {
                    dom: pageData.dom,
                    timestamp: Date.now(),
                    lastAccess: Date.now()
                });
            } else {
                const entry = this.domCache.get(domKey);
                entry.lastAccess = Date.now();
            }
        }
        
        // Cache screenshot if not already cached
        if (pageData.screenshot) {
            const screenshotKey = this.hashString(pageData.screenshot);
            
            if (!this.screenshotCache.has(screenshotKey)) {
                if (this.screenshotCache.size >= this.maxCacheSize) {
                    this.evictLeastRecentlyUsed(this.screenshotCache);
                }
                
                this.screenshotCache.set(screenshotKey, {
                    screenshot: pageData.screenshot,
                    timestamp: Date.now(),
                    lastAccess: Date.now()
                });
            } else {
                const entry = this.screenshotCache.get(screenshotKey);
                entry.lastAccess = Date.now();
            }
        }
        
        return cached;
    }
    
    /**
     * Hash string for cache key
     * @private
     * @param {string} str - String to hash
     * @returns {string} Hash
     */
    hashString(str) {
        return crypto.createHash('md5')
            .update(str)
            .digest('hex')
            .substring(0, 16);
    }
    
    /**
     * Start garbage collection
     * @private
     */
    startGarbageCollection() {
        this.gcTimer = setInterval(() => {
            this.runGarbageCollection();
        }, this.gcInterval);
        
        console.log('[PerformanceOptimizer] Started garbage collection');
    }
    
    /**
     * Run garbage collection
     * @private
     */
    runGarbageCollection() {
        const startSize = this.getCacheSize();
        const now = Date.now();
        
        // Clean expired entries from all caches
        this.cleanExpiredEntries(this.domCache, now);
        this.cleanExpiredEntries(this.screenshotCache, now);
        this.cleanExpiredEntries(this.resultCache, now);
        this.cleanExpiredEntries(this.analysisCache, now);
        
        const endSize = this.getCacheSize();
        const freed = startSize - endSize;
        
        if (freed > 0) {
            this.stats.memoryFreed += freed;
            this.stats.gcRuns++;
            
            console.log(`[PerformanceOptimizer] GC freed ${freed} entries`);
            this.emit('gc:completed', { freed });
        }
        
        // Trigger Node.js GC if available
        if (global.gc && this.stats.gcRuns % 10 === 0) {
            global.gc();
        }
    }
    
    /**
     * Clean expired entries from cache
     * @private
     * @param {Map} cache - Cache to clean
     * @param {number} now - Current timestamp
     */
    cleanExpiredEntries(cache, now) {
        const toDelete = [];
        
        for (const [key, entry] of cache.entries()) {
            if (now - entry.timestamp > this.cacheExpiry) {
                toDelete.push(key);
            }
        }
        
        for (const key of toDelete) {
            cache.delete(key);
            this.stats.cacheEvictions++;
        }
    }
    
    /**
     * Get total cache size
     * @private
     * @returns {number} Total cache entries
     */
    getCacheSize() {
        return this.domCache.size + 
               this.screenshotCache.size + 
               this.resultCache.size + 
               this.analysisCache.size;
    }
    
    /**
     * Start resource monitoring
     * @private
     */
    startResourceMonitoring() {
        this.monitorTimer = setInterval(() => {
            this.monitorResources();
        }, this.monitoringInterval);
        
        console.log('[PerformanceOptimizer] Started resource monitoring');
    }
    
    /**
     * Monitor system resources
     * @private
     */
    monitorResources() {
        const usage = process.memoryUsage();
        const totalMemory = require('os').totalmem();
        const freeMemory = require('os').freemem();
        const usedMemory = totalMemory - freeMemory;
        
        this.memoryUsage = {
            used: usedMemory,
            total: totalMemory,
            percentage: (usedMemory / totalMemory) * 100,
            heapUsed: usage.heapUsed,
            heapTotal: usage.heapTotal
        };
        
        // Update resource mode based on usage
        const oldMode = this.resourceMode;
        
        if (this.memoryUsage.percentage > 90) {
            this.resourceMode = ResourceMode.CRITICAL;
        } else if (this.memoryUsage.percentage > 75) {
            this.resourceMode = ResourceMode.LOW;
        } else if (this.memoryUsage.percentage > 60) {
            this.resourceMode = ResourceMode.MEDIUM;
        } else {
            this.resourceMode = ResourceMode.HIGH;
        }
        
        if (oldMode !== this.resourceMode) {
            console.log(`[PerformanceOptimizer] Resource mode changed: ${oldMode} -> ${this.resourceMode}`);
            this.emit('resource:modeChanged', {
                oldMode,
                newMode: this.resourceMode,
                memoryUsage: this.memoryUsage
            });
            
            if (this.resourceMode === ResourceMode.LOW || this.resourceMode === ResourceMode.CRITICAL) {
                this.stats.throttleActivations++;
                this.emit('resource:throttle', { mode: this.resourceMode });
            }
        }
    }
    
    /**
     * Clear all caches
     */
    clearAllCaches() {
        const totalSize = this.getCacheSize();
        
        this.domCache.clear();
        this.screenshotCache.clear();
        this.resultCache.clear();
        this.analysisCache.clear();
        
        console.log(`[PerformanceOptimizer] Cleared all caches (${totalSize} entries)`);
        this.emit('cache:cleared', { count: totalSize });
    }
    
    /**
     * Clear specific cache
     * @param {string} cacheType - Cache type (dom, screenshot, result, analysis)
     */
    clearCache(cacheType) {
        const caches = {
            dom: this.domCache,
            screenshot: this.screenshotCache,
            result: this.resultCache,
            analysis: this.analysisCache
        };
        
        const cache = caches[cacheType];
        if (cache) {
            const size = cache.size;
            cache.clear();
            console.log(`[PerformanceOptimizer] Cleared ${cacheType} cache (${size} entries)`);
            this.emit('cache:cleared', { type: cacheType, count: size });
        }
    }
    
    /**
     * Get optimizer statistics
     * @returns {Object} Statistics
     */
    getStats() {
        const cacheTotal = this.stats.cacheHits + this.stats.cacheMisses;
        const hitRate = cacheTotal > 0 ? (this.stats.cacheHits / cacheTotal * 100) : 0;
        
        return {
            ...this.stats,
            cacheHitRate: hitRate.toFixed(2) + '%',
            cacheSizes: {
                dom: this.domCache.size,
                screenshot: this.screenshotCache.size,
                result: this.resultCache.size,
                analysis: this.analysisCache.size,
                total: this.getCacheSize()
            },
            resourceMode: this.resourceMode,
            memoryUsage: this.memoryUsage,
            timeSavedSeconds: (this.stats.timeSaved / 1000).toFixed(2) + 's'
        };
    }
    
    /**
     * Stop all background tasks and cleanup
     */
    destroy() {
        console.log('[PerformanceOptimizer] Destroying optimizer');
        
        if (this.gcTimer) {
            clearInterval(this.gcTimer);
        }
        
        if (this.monitorTimer) {
            clearInterval(this.monitorTimer);
        }
        
        this.clearAllCaches();
        this.removeAllListeners();
    }
}

module.exports = { 
    PerformanceOptimizer, 
    CacheStrategy, 
    ResourceMode 
};
