/**
 * ============================================================================
 * COMPREHENSIVE LOGGER - Structured Logging System
 * ============================================================================
 * 
 * Provides detailed structured logging for all components with multiple
 * severity levels, performance metrics, error tracking, and flexible output
 * formats. Supports log rotation, retention policies, and filtering.
 * 
 * FEATURES:
 * - Structured logging with multiple severity levels
 * - Performance metrics logging
 * - Error tracking with stack traces and context
 * - Multiple log formats (JSON, text, structured)
 * - Log rotation and retention policies
 * - Filtering by component, level, and time
 * - Async logging for performance
 * - Log aggregation and analysis
 * 
 * USAGE:
 * const logger = new ComprehensiveLogger({ level: 'INFO' });
 * logger.info('Analysis completed', { duration: 1234, action: 'click' });
 * 
 * ============================================================================
 */

const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');

/**
 * Log levels
 * @enum {string}
 */
const LogLevel = {
    TRACE: 'TRACE',
    DEBUG: 'DEBUG',
    INFO: 'INFO',
    WARN: 'WARN',
    ERROR: 'ERROR',
    FATAL: 'FATAL'
};

/**
 * Log level priorities
 * @private
 */
const LogLevelPriority = {
    TRACE: 0,
    DEBUG: 1,
    INFO: 2,
    WARN: 3,
    ERROR: 4,
    FATAL: 5
};

/**
 * Log format
 * @enum {string}
 */
const LogFormat = {
    JSON: 'json',
    TEXT: 'text',
    STRUCTURED: 'structured'
};

/**
 * Component categories
 * @enum {string}
 */
const LogComponent = {
    API: 'API',
    ORCHESTRATOR: 'ORCHESTRATOR',
    QUEUE: 'QUEUE',
    RECONCILIATOR: 'RECONCILIATOR',
    VISUAL: 'VISUAL',
    TEMPORAL: 'TEMPORAL',
    DECISION: 'DECISION',
    PERFORMANCE: 'PERFORMANCE',
    SYSTEM: 'SYSTEM'
};

/**
 * Comprehensive Logger for system-wide logging
 * @class
 * @extends EventEmitter
 */
class ComprehensiveLogger extends EventEmitter {
    /**
     * Create a new ComprehensiveLogger instance
     * @param {Object} options - Configuration options
     * @param {string} [options.level='INFO'] - Minimum log level
     * @param {string} [options.format='text'] - Log format
     * @param {boolean} [options.console=true] - Log to console
     * @param {boolean} [options.file=false] - Log to file
     * @param {string} [options.logDir='./logs'] - Log directory
     * @param {number} [options.maxFileSize=10485760] - Max file size (10MB)
     * @param {number} [options.maxFiles=5] - Max number of log files
     * @param {number} [options.retentionDays=7] - Log retention in days
     * @param {boolean} [options.includeStackTrace=true] - Include stack traces for errors
     * @param {boolean} [options.includePerformance=true] - Include performance metrics
     */
    constructor(options = {}) {
        super();
        
        this.level = options.level || LogLevel.INFO;
        this.format = options.format || LogFormat.TEXT;
        this.consoleOutput = options.console !== undefined ? options.console : true;
        this.fileOutput = options.file || false;
        this.logDir = options.logDir || './logs';
        this.maxFileSize = options.maxFileSize || 10485760; // 10MB
        this.maxFiles = options.maxFiles || 5;
        this.retentionDays = options.retentionDays || 7;
        this.includeStackTrace = options.includeStackTrace !== undefined ? options.includeStackTrace : true;
        this.includePerformance = options.includePerformance !== undefined ? options.includePerformance : true;
        
        // Log buffer for async writing
        this.logBuffer = [];
        this.bufferFlushInterval = 1000; // 1 second
        this.maxBufferSize = 100;
        
        // Current log file
        this.currentLogFile = null;
        this.currentLogSize = 0;
        
        // Statistics
        this.stats = {
            totalLogs: 0,
            byLevel: {},
            byComponent: {},
            errors: 0,
            warnings: 0,
            performance: {
                avgLogTime: 0,
                totalLogTime: 0
            }
        };
        
        // Initialize level stats
        for (const level of Object.values(LogLevel)) {
            this.stats.byLevel[level] = 0;
        }
        
        // Initialize component stats
        for (const component of Object.values(LogComponent)) {
            this.stats.byComponent[component] = 0;
        }
        
        // Start buffer flushing
        this.startBufferFlushing();
        
        // Initialize log directory if file output is enabled
        if (this.fileOutput) {
            this.initializeLogDirectory();
        }
        
        console.log('[ComprehensiveLogger] Initialized with level:', this.level);
    }
    
    /**
     * Initialize log directory
     * @private
     */
    async initializeLogDirectory() {
        try {
            await fs.mkdir(this.logDir, { recursive: true });
            this.currentLogFile = this.getLogFileName();
            
            // Get current file size if exists
            try {
                const stats = await fs.stat(this.currentLogFile);
                this.currentLogSize = stats.size;
            } catch {
                this.currentLogSize = 0;
            }
            
            // Clean old logs
            this.cleanOldLogs();
            
        } catch (error) {
            console.error('[ComprehensiveLogger] Failed to initialize log directory:', error);
        }
    }
    
    /**
     * Get current log file name
     * @private
     * @returns {string} Log file path
     */
    getLogFileName() {
        const date = new Date().toISOString().split('T')[0];
        return path.join(this.logDir, `browseragent-${date}.log`);
    }
    
    /**
     * Log trace message
     * @param {string} message - Log message
     * @param {Object} [context] - Additional context
     * @param {string} [component] - Component name
     */
    trace(message, context = {}, component = LogComponent.SYSTEM) {
        this.log(LogLevel.TRACE, message, context, component);
    }
    
    /**
     * Log debug message
     * @param {string} message - Log message
     * @param {Object} [context] - Additional context
     * @param {string} [component] - Component name
     */
    debug(message, context = {}, component = LogComponent.SYSTEM) {
        this.log(LogLevel.DEBUG, message, context, component);
    }
    
    /**
     * Log info message
     * @param {string} message - Log message
     * @param {Object} [context] - Additional context
     * @param {string} [component] - Component name
     */
    info(message, context = {}, component = LogComponent.SYSTEM) {
        this.log(LogLevel.INFO, message, context, component);
    }
    
    /**
     * Log warning message
     * @param {string} message - Log message
     * @param {Object} [context] - Additional context
     * @param {string} [component] - Component name
     */
    warn(message, context = {}, component = LogComponent.SYSTEM) {
        this.log(LogLevel.WARN, message, context, component);
        this.stats.warnings++;
    }
    
    /**
     * Log error message
     * @param {string} message - Log message
     * @param {Error|Object} [error] - Error object or context
     * @param {string} [component] - Component name
     */
    error(message, error = {}, component = LogComponent.SYSTEM) {
        const context = error instanceof Error ? {
            error: error.message,
            stack: this.includeStackTrace ? error.stack : undefined
        } : error;
        
        this.log(LogLevel.ERROR, message, context, component);
        this.stats.errors++;
    }
    
    /**
     * Log fatal message
     * @param {string} message - Log message
     * @param {Error|Object} [error] - Error object or context
     * @param {string} [component] - Component name
     */
    fatal(message, error = {}, component = LogComponent.SYSTEM) {
        const context = error instanceof Error ? {
            error: error.message,
            stack: this.includeStackTrace ? error.stack : undefined
        } : error;
        
        this.log(LogLevel.FATAL, message, context, component);
    }
    
    /**
     * Log performance metric
     * @param {string} operation - Operation name
     * @param {number} duration - Duration in milliseconds
     * @param {Object} [context] - Additional context
     * @param {string} [component] - Component name
     */
    performance(operation, duration, context = {}, component = LogComponent.PERFORMANCE) {
        if (!this.includePerformance) return;
        
        this.log(LogLevel.INFO, `Performance: ${operation}`, {
            ...context,
            operation: operation,
            duration: duration,
            durationFormatted: `${duration.toFixed(2)}ms`
        }, component);
    }
    
    /**
     * Main log method
     * @private
     * @param {string} level - Log level
     * @param {string} message - Log message
     * @param {Object} context - Context data
     * @param {string} component - Component name
     */
    log(level, message, context, component) {
        const startTime = Date.now();
        
        // Check if level is enabled
        if (LogLevelPriority[level] < LogLevelPriority[this.level]) {
            return;
        }
        
        // Create log entry
        const entry = {
            timestamp: new Date().toISOString(),
            level: level,
            component: component,
            message: message,
            context: context,
            processId: process.pid
        };
        
        // Format log entry
        const formatted = this.formatLogEntry(entry);
        
        // Output to console
        if (this.consoleOutput) {
            this.outputToConsole(formatted, level);
        }
        
        // Buffer for file output
        if (this.fileOutput) {
            this.logBuffer.push(formatted);
            
            // Flush if buffer is full
            if (this.logBuffer.length >= this.maxBufferSize) {
                this.flushBuffer();
            }
        }
        
        // Update statistics
        this.stats.totalLogs++;
        this.stats.byLevel[level]++;
        this.stats.byComponent[component]++;
        
        const logTime = Date.now() - startTime;
        this.stats.performance.totalLogTime += logTime;
        this.stats.performance.avgLogTime = this.stats.performance.totalLogTime / this.stats.totalLogs;
        
        // Emit event
        this.emit('log', entry);
    }
    
    /**
     * Format log entry based on format setting
     * @private
     * @param {Object} entry - Log entry
     * @returns {string} Formatted log string
     */
    formatLogEntry(entry) {
        switch (this.format) {
            case LogFormat.JSON:
                return JSON.stringify(entry);
            
            case LogFormat.STRUCTURED:
                return this.formatStructured(entry);
            
            case LogFormat.TEXT:
            default:
                return this.formatText(entry);
        }
    }
    
    /**
     * Format log entry as text
     * @private
     * @param {Object} entry - Log entry
     * @returns {string} Text format
     */
    formatText(entry) {
        let text = `[${entry.timestamp}] [${entry.level}] [${entry.component}] ${entry.message}`;
        
        if (Object.keys(entry.context).length > 0) {
            const contextStr = Object.entries(entry.context)
                .map(([key, value]) => {
                    if (key === 'stack') {
                        return `\n  Stack: ${value}`;
                    }
                    return `${key}=${JSON.stringify(value)}`;
                })
                .join(', ');
            
            text += ` | ${contextStr}`;
        }
        
        return text;
    }
    
    /**
     * Format log entry as structured
     * @private
     * @param {Object} entry - Log entry
     * @returns {string} Structured format
     */
    formatStructured(entry) {
        const parts = [
            `timestamp="${entry.timestamp}"`,
            `level="${entry.level}"`,
            `component="${entry.component}"`,
            `message="${entry.message}"`
        ];
        
        for (const [key, value] of Object.entries(entry.context)) {
            if (key === 'stack') {
                parts.push(`stack="${value.replace(/\n/g, '\\n')}"`);
            } else {
                parts.push(`${key}="${JSON.stringify(value)}"`);
            }
        }
        
        return parts.join(' ');
    }
    
    /**
     * Output to console with colors
     * @private
     * @param {string} formatted - Formatted log
     * @param {string} level - Log level
     */
    outputToConsole(formatted, level) {
        const colors = {
            TRACE: '\x1b[90m',    // Gray
            DEBUG: '\x1b[36m',    // Cyan
            INFO: '\x1b[32m',     // Green
            WARN: '\x1b[33m',     // Yellow
            ERROR: '\x1b[31m',    // Red
            FATAL: '\x1b[35m'     // Magenta
        };
        
        const reset = '\x1b[0m';
        const color = colors[level] || '';
        
        console.log(color + formatted + reset);
    }
    
    /**
     * Start buffer flushing
     * @private
     */
    startBufferFlushing() {
        this.flushTimer = setInterval(() => {
            if (this.logBuffer.length > 0) {
                this.flushBuffer();
            }
        }, this.bufferFlushInterval);
    }
    
    /**
     * Flush log buffer to file
     * @private
     */
    async flushBuffer() {
        if (!this.fileOutput || this.logBuffer.length === 0) {
            return;
        }
        
        const logs = this.logBuffer.splice(0, this.logBuffer.length);
        const content = logs.join('\n') + '\n';
        
        try {
            // Check if rotation is needed
            if (this.currentLogSize + content.length > this.maxFileSize) {
                await this.rotateLogFile();
            }
            
            // Write to file
            await fs.appendFile(this.currentLogFile, content);
            this.currentLogSize += content.length;
            
        } catch (error) {
            console.error('[ComprehensiveLogger] Failed to write logs:', error);
            // Put logs back in buffer
            this.logBuffer.unshift(...logs);
        }
    }
    
    /**
     * Rotate log file
     * @private
     */
    async rotateLogFile() {
        try {
            // Get current log files
            const files = await fs.readdir(this.logDir);
            const logFiles = files
                .filter(f => f.startsWith('browseragent-') && f.endsWith('.log'))
                .sort()
                .reverse();
            
            // Delete old files if we have too many
            if (logFiles.length >= this.maxFiles) {
                const toDelete = logFiles.slice(this.maxFiles - 1);
                for (const file of toDelete) {
                    await fs.unlink(path.join(this.logDir, file));
                }
            }
            
            // Create new log file
            this.currentLogFile = this.getLogFileName();
            this.currentLogSize = 0;
            
            this.emit('log:rotated', { newFile: this.currentLogFile });
            
        } catch (error) {
            console.error('[ComprehensiveLogger] Failed to rotate log file:', error);
        }
    }
    
    /**
     * Clean old logs based on retention policy
     * @private
     */
    async cleanOldLogs() {
        try {
            const files = await fs.readdir(this.logDir);
            const now = Date.now();
            const retentionMs = this.retentionDays * 24 * 60 * 60 * 1000;
            
            for (const file of files) {
                if (!file.startsWith('browseragent-') || !file.endsWith('.log')) {
                    continue;
                }
                
                const filePath = path.join(this.logDir, file);
                const stats = await fs.stat(filePath);
                
                if (now - stats.mtime.getTime() > retentionMs) {
                    await fs.unlink(filePath);
                    console.log(`[ComprehensiveLogger] Deleted old log file: ${file}`);
                }
            }
        } catch (error) {
            console.error('[ComprehensiveLogger] Failed to clean old logs:', error);
        }
    }
    
    /**
     * Get logger statistics
     * @returns {Object} Statistics
     */
    getStats() {
        return {
            ...this.stats,
            performance: {
                avgLogTime: this.stats.performance.avgLogTime.toFixed(3) + 'ms',
                totalLogTime: this.stats.performance.totalLogTime.toFixed(3) + 'ms'
            },
            errorRate: this.stats.totalLogs > 0
                ? (this.stats.errors / this.stats.totalLogs * 100).toFixed(2) + '%'
                : '0%',
            warningRate: this.stats.totalLogs > 0
                ? (this.stats.warnings / this.stats.totalLogs * 100).toFixed(2) + '%'
                : '0%'
        };
    }
    
    /**
     * Get logs by filter
     * @param {Object} filter - Filter criteria
     * @param {string} [filter.level] - Filter by level
     * @param {string} [filter.component] - Filter by component
     * @param {number} [filter.since] - Filter by timestamp (ms)
     * @param {number} [filter.limit=100] - Max number of logs
     * @returns {Promise<Array>} Filtered logs
     */
    async getLogs(filter = {}) {
        if (!this.fileOutput) {
            return [];
        }
        
        try {
            const content = await fs.readFile(this.currentLogFile, 'utf8');
            const lines = content.split('\n').filter(l => l.trim());
            
            let logs = lines;
            
            // Apply filters
            if (filter.level) {
                logs = logs.filter(l => l.includes(`[${filter.level}]`));
            }
            
            if (filter.component) {
                logs = logs.filter(l => l.includes(`[${filter.component}]`));
            }
            
            if (filter.since) {
                const sinceDate = new Date(filter.since).toISOString();
                logs = logs.filter(l => l.includes(sinceDate) || l > sinceDate);
            }
            
            // Apply limit
            const limit = filter.limit || 100;
            return logs.slice(-limit);
            
        } catch (error) {
            console.error('[ComprehensiveLogger] Failed to read logs:', error);
            return [];
        }
    }
    
    /**
     * Change log level
     * @param {string} level - New log level
     */
    setLevel(level) {
        if (!Object.values(LogLevel).includes(level)) {
            throw new Error(`Invalid log level: ${level}`);
        }
        
        console.log(`[ComprehensiveLogger] Changing level from ${this.level} to ${level}`);
        this.level = level;
    }
    
    /**
     * Cleanup and destroy logger
     */
    async destroy() {
        console.log('[ComprehensiveLogger] Destroying logger');
        
        // Stop buffer flushing
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
        }
        
        // Flush remaining logs
        await this.flushBuffer();
        
        this.removeAllListeners();
    }
}

/**
 * Create logger with preset configuration
 * @param {string} preset - Configuration preset (development, production)
 * @returns {ComprehensiveLogger} Logger instance
 */
function createLogger(preset = 'development') {
    const presets = {
        development: {
            level: LogLevel.DEBUG,
            format: LogFormat.TEXT,
            console: true,
            file: false
        },
        production: {
            level: LogLevel.INFO,
            format: LogFormat.JSON,
            console: true,
            file: true,
            logDir: './logs',
            maxFiles: 10,
            retentionDays: 30
        }
    };
    
    return new ComprehensiveLogger(presets[preset] || presets.development);
}

module.exports = {
    ComprehensiveLogger,
    LogLevel,
    LogFormat,
    LogComponent,
    createLogger
};
