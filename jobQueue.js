/**
 * ============================================================================
 * JOB QUEUE SYSTEM - Async Task Management
 * ============================================================================
 * 
 * Manages asynchronous job execution with priority levels, retry logic,
 * and comprehensive status tracking. Supports concurrent job processing
 * with configurable concurrency limits.
 * 
 * FEATURES:
 * - Priority-based job scheduling (HIGH, MEDIUM, LOW)
 * - Automatic retry with exponential backoff
 * - Job status tracking (pending, running, completed, failed, cancelled)
 * - Event-based notifications
 * - Concurrent job processing with limits
 * - Job cancellation support
 * 
 * USAGE:
 * const queue = new JobQueue({ maxConcurrent: 3 });
 * const jobId = await queue.addJob(asyncFunction, args, { priority: 'HIGH' });
 * const result = await queue.waitForJob(jobId);
 * 
 * ============================================================================
 */

const EventEmitter = require('events');
const crypto = require('crypto');

/**
 * Job priority levels
 * @enum {string}
 */
const Priority = {
    HIGH: 'HIGH',
    MEDIUM: 'MEDIUM',
    LOW: 'LOW'
};

/**
 * Job status states
 * @enum {string}
 */
const JobStatus = {
    PENDING: 'pending',
    RUNNING: 'running',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'cancelled',
    RETRYING: 'retrying'
};

/**
 * Priority weights for queue ordering (higher = more priority)
 * @private
 */
const PRIORITY_WEIGHTS = {
    [Priority.HIGH]: 100,
    [Priority.MEDIUM]: 50,
    [Priority.LOW]: 10
};

/**
 * Job Queue System for managing asynchronous tasks
 * @class
 * @extends EventEmitter
 */
class JobQueue extends EventEmitter {
    /**
     * Create a new JobQueue instance
     * @param {Object} options - Configuration options
     * @param {number} [options.maxConcurrent=3] - Maximum concurrent jobs
     * @param {number} [options.maxRetries=3] - Maximum retry attempts per job
     * @param {number} [options.retryDelay=1000] - Base delay between retries (ms)
     * @param {boolean} [options.autoStart=true] - Start processing immediately
     */
    constructor(options = {}) {
        super();
        
        this.maxConcurrent = options.maxConcurrent || 3;
        this.maxRetries = options.maxRetries || 3;
        this.retryDelay = options.retryDelay || 1000;
        this.autoStart = options.autoStart !== undefined ? options.autoStart : true;
        
        this.jobs = new Map();
        this.queue = [];
        this.running = new Set();
        this.isProcessing = false;
        this.isPaused = false;
        
        this.stats = {
            totalJobs: 0,
            completedJobs: 0,
            failedJobs: 0,
            cancelledJobs: 0,
            totalRetries: 0
        };
        
        if (this.autoStart) {
            this.start();
        }
        
        console.log('[JobQueue] Initialized with maxConcurrent:', this.maxConcurrent);
    }
    
    /**
     * Add a job to the queue
     * @param {Function} fn - Async function to execute
     * @param {Array} args - Arguments to pass to the function
     * @param {Object} options - Job options
     * @param {string} [options.priority='MEDIUM'] - Job priority level
     * @param {number} [options.maxRetries] - Override default max retries
     * @param {number} [options.timeout] - Job timeout in milliseconds
     * @param {Object} [options.metadata] - Additional metadata
     * @returns {string} Job ID
     */
    addJob(fn, args = [], options = {}) {
        const jobId = crypto.randomUUID();
        const priority = options.priority || Priority.MEDIUM;
        
        if (!Object.values(Priority).includes(priority)) {
            throw new Error(`Invalid priority: ${priority}. Must be HIGH, MEDIUM, or LOW`);
        }
        
        const job = {
            id: jobId,
            fn: fn,
            args: args,
            priority: priority,
            status: JobStatus.PENDING,
            result: null,
            error: null,
            retryCount: 0,
            maxRetries: options.maxRetries !== undefined ? options.maxRetries : this.maxRetries,
            timeout: options.timeout || null,
            metadata: options.metadata || {},
            createdAt: Date.now(),
            startedAt: null,
            completedAt: null,
            promise: null,
            resolve: null,
            reject: null,
            timeoutHandle: null
        };
        
        // Create promise for waiting
        job.promise = new Promise((resolve, reject) => {
            job.resolve = resolve;
            job.reject = reject;
        });
        
        this.jobs.set(jobId, job);
        this.queue.push(job);
        this.stats.totalJobs++;
        
        // Sort queue by priority and creation time
        this.sortQueue();
        
        console.log(`[JobQueue] Job ${jobId} added with priority ${priority}`);
        this.emit('job:added', { jobId, priority });
        
        // Start processing if not already running
        if (!this.isProcessing && !this.isPaused) {
            this.processQueue();
        }
        
        return jobId;
    }
    
    /**
     * Sort queue by priority and creation time
     * @private
     */
    sortQueue() {
        this.queue.sort((a, b) => {
            const priorityDiff = PRIORITY_WEIGHTS[b.priority] - PRIORITY_WEIGHTS[a.priority];
            if (priorityDiff !== 0) return priorityDiff;
            return a.createdAt - b.createdAt;
        });
    }
    
    /**
     * Process jobs in the queue
     * @private
     */
    async processQueue() {
        if (this.isProcessing || this.isPaused) return;
        
        this.isProcessing = true;
        
        while (this.queue.length > 0 || this.running.size > 0) {
            if (this.isPaused) {
                this.isProcessing = false;
                return;
            }
            
            // Start new jobs if we have capacity
            while (this.running.size < this.maxConcurrent && this.queue.length > 0) {
                const job = this.queue.shift();
                this.runJob(job);
            }
            
            // Wait a bit before checking again
            if (this.queue.length === 0 && this.running.size === 0) {
                break;
            }
            
            await this.sleep(10);
        }
        
        this.isProcessing = false;
    }
    
    /**
     * Execute a job
     * @private
     * @param {Object} job - Job to execute
     */
    async runJob(job) {
        if (job.status === JobStatus.CANCELLED) {
            return;
        }
        
        this.running.add(job.id);
        job.status = JobStatus.RUNNING;
        job.startedAt = Date.now();
        
        console.log(`[JobQueue] Running job ${job.id} (attempt ${job.retryCount + 1}/${job.maxRetries + 1})`);
        this.emit('job:started', { jobId: job.id, attempt: job.retryCount + 1 });
        
        try {
            // Set up timeout if specified
            if (job.timeout) {
                job.timeoutHandle = setTimeout(() => {
                    this.handleJobTimeout(job);
                }, job.timeout);
            }
            
            // Execute the job function
            const result = await job.fn(...job.args);
            
            // Clear timeout
            if (job.timeoutHandle) {
                clearTimeout(job.timeoutHandle);
                job.timeoutHandle = null;
            }
            
            // Check if job was cancelled during execution
            if (job.status === JobStatus.CANCELLED) {
                this.running.delete(job.id);
                return;
            }
            
            // Job succeeded
            job.status = JobStatus.COMPLETED;
            job.result = result;
            job.completedAt = Date.now();
            
            this.stats.completedJobs++;
            this.running.delete(job.id);
            
            console.log(`[JobQueue] Job ${job.id} completed successfully`);
            this.emit('job:completed', { jobId: job.id, result, duration: job.completedAt - job.startedAt });
            
            if (job.resolve) {
                job.resolve(result);
            }
            
        } catch (error) {
            // Clear timeout
            if (job.timeoutHandle) {
                clearTimeout(job.timeoutHandle);
                job.timeoutHandle = null;
            }
            
            // Check if job was cancelled
            if (job.status === JobStatus.CANCELLED) {
                this.running.delete(job.id);
                return;
            }
            
            console.error(`[JobQueue] Job ${job.id} failed:`, error.message);
            
            // Retry logic
            if (job.retryCount < job.maxRetries) {
                job.retryCount++;
                job.status = JobStatus.RETRYING;
                this.stats.totalRetries++;
                
                const delay = this.retryDelay * Math.pow(2, job.retryCount - 1);
                
                console.log(`[JobQueue] Retrying job ${job.id} in ${delay}ms (attempt ${job.retryCount + 1}/${job.maxRetries + 1})`);
                this.emit('job:retry', { jobId: job.id, attempt: job.retryCount + 1, delay });
                
                this.running.delete(job.id);
                
                // Re-queue the job after delay
                setTimeout(() => {
                    if (job.status !== JobStatus.CANCELLED) {
                        job.status = JobStatus.PENDING;
                        this.queue.unshift(job);
                        this.processQueue();
                    }
                }, delay);
                
            } else {
                // All retries exhausted
                job.status = JobStatus.FAILED;
                job.error = error;
                job.completedAt = Date.now();
                
                this.stats.failedJobs++;
                this.running.delete(job.id);
                
                console.error(`[JobQueue] Job ${job.id} failed after ${job.retryCount} retries`);
                this.emit('job:failed', { jobId: job.id, error, retries: job.retryCount });
                
                if (job.reject) {
                    job.reject(error);
                }
            }
        }
    }
    
    /**
     * Handle job timeout
     * @private
     * @param {Object} job - Job that timed out
     */
    handleJobTimeout(job) {
        if (job.status !== JobStatus.RUNNING) return;
        
        const error = new Error(`Job ${job.id} timed out after ${job.timeout}ms`);
        console.error(`[JobQueue] ${error.message}`);
        
        job.status = JobStatus.FAILED;
        job.error = error;
        job.completedAt = Date.now();
        
        this.stats.failedJobs++;
        this.running.delete(job.id);
        
        this.emit('job:timeout', { jobId: job.id, timeout: job.timeout });
        
        if (job.reject) {
            job.reject(error);
        }
    }
    
    /**
     * Cancel a job
     * @param {string} jobId - Job ID to cancel
     * @returns {boolean} True if job was cancelled, false if not found or already completed
     */
    cancelJob(jobId) {
        const job = this.jobs.get(jobId);
        
        if (!job) {
            console.warn(`[JobQueue] Cannot cancel job ${jobId}: not found`);
            return false;
        }
        
        if (job.status === JobStatus.COMPLETED || job.status === JobStatus.FAILED) {
            console.warn(`[JobQueue] Cannot cancel job ${jobId}: already ${job.status}`);
            return false;
        }
        
        job.status = JobStatus.CANCELLED;
        job.completedAt = Date.now();
        
        // Clear timeout if exists
        if (job.timeoutHandle) {
            clearTimeout(job.timeoutHandle);
            job.timeoutHandle = null;
        }
        
        // Remove from queue if pending
        const queueIndex = this.queue.findIndex(j => j.id === jobId);
        if (queueIndex !== -1) {
            this.queue.splice(queueIndex, 1);
        }
        
        // Remove from running set
        this.running.delete(jobId);
        
        this.stats.cancelledJobs++;
        
        console.log(`[JobQueue] Job ${jobId} cancelled`);
        this.emit('job:cancelled', { jobId });
        
        if (job.reject) {
            job.reject(new Error('Job cancelled'));
        }
        
        return true;
    }
    
    /**
     * Wait for a job to complete
     * @param {string} jobId - Job ID to wait for
     * @returns {Promise<*>} Job result
     * @throws {Error} If job fails or is cancelled
     */
    async waitForJob(jobId) {
        const job = this.jobs.get(jobId);
        
        if (!job) {
            throw new Error(`Job ${jobId} not found`);
        }
        
        if (job.status === JobStatus.COMPLETED) {
            return job.result;
        }
        
        if (job.status === JobStatus.FAILED) {
            throw job.error;
        }
        
        if (job.status === JobStatus.CANCELLED) {
            throw new Error('Job cancelled');
        }
        
        return job.promise;
    }
    
    /**
     * Get job status
     * @param {string} jobId - Job ID
     * @returns {Object|null} Job status information
     */
    getJobStatus(jobId) {
        const job = this.jobs.get(jobId);
        
        if (!job) {
            return null;
        }
        
        return {
            id: job.id,
            status: job.status,
            priority: job.priority,
            retryCount: job.retryCount,
            maxRetries: job.maxRetries,
            createdAt: job.createdAt,
            startedAt: job.startedAt,
            completedAt: job.completedAt,
            duration: job.completedAt ? job.completedAt - job.createdAt : null,
            metadata: job.metadata,
            error: job.error ? job.error.message : null
        };
    }
    
    /**
     * Get all jobs with optional status filter
     * @param {string} [statusFilter] - Optional status to filter by
     * @returns {Array<Object>} Array of job status information
     */
    getAllJobs(statusFilter = null) {
        const jobs = [];
        
        for (const job of this.jobs.values()) {
            if (!statusFilter || job.status === statusFilter) {
                jobs.push(this.getJobStatus(job.id));
            }
        }
        
        return jobs;
    }
    
    /**
     * Get queue statistics
     * @returns {Object} Queue statistics
     */
    getStats() {
        return {
            ...this.stats,
            queueLength: this.queue.length,
            runningJobs: this.running.size,
            totalJobs: this.jobs.size,
            isPaused: this.isPaused,
            isProcessing: this.isProcessing,
            successRate: this.stats.totalJobs > 0 
                ? (this.stats.completedJobs / this.stats.totalJobs * 100).toFixed(2) + '%'
                : 'N/A'
        };
    }
    
    /**
     * Start queue processing
     */
    start() {
        if (!this.isPaused) {
            console.log('[JobQueue] Already running');
            return;
        }
        
        this.isPaused = false;
        console.log('[JobQueue] Starting queue processing');
        this.emit('queue:started');
        this.processQueue();
    }
    
    /**
     * Pause queue processing
     */
    pause() {
        if (this.isPaused) {
            console.log('[JobQueue] Already paused');
            return;
        }
        
        this.isPaused = true;
        console.log('[JobQueue] Pausing queue processing');
        this.emit('queue:paused');
    }
    
    /**
     * Clear all pending jobs
     * @returns {number} Number of jobs cleared
     */
    clearQueue() {
        const count = this.queue.length;
        
        for (const job of this.queue) {
            job.status = JobStatus.CANCELLED;
            this.stats.cancelledJobs++;
            
            if (job.reject) {
                job.reject(new Error('Queue cleared'));
            }
        }
        
        this.queue = [];
        
        console.log(`[JobQueue] Cleared ${count} pending jobs`);
        this.emit('queue:cleared', { count });
        
        return count;
    }
    
    /**
     * Cancel all running jobs
     * @returns {number} Number of jobs cancelled
     */
    cancelAllRunning() {
        const runningIds = Array.from(this.running);
        let count = 0;
        
        for (const jobId of runningIds) {
            if (this.cancelJob(jobId)) {
                count++;
            }
        }
        
        console.log(`[JobQueue] Cancelled ${count} running jobs`);
        return count;
    }
    
    /**
     * Cleanup old completed/failed jobs
     * @param {number} maxAge - Maximum age in milliseconds
     * @returns {number} Number of jobs cleaned up
     */
    cleanup(maxAge = 3600000) {
        const now = Date.now();
        let count = 0;
        
        for (const [jobId, job] of this.jobs.entries()) {
            if (job.completedAt && (now - job.completedAt) > maxAge) {
                this.jobs.delete(jobId);
                count++;
            }
        }
        
        if (count > 0) {
            console.log(`[JobQueue] Cleaned up ${count} old jobs`);
            this.emit('queue:cleanup', { count });
        }
        
        return count;
    }
    
    /**
     * Sleep utility
     * @private
     * @param {number} ms - Milliseconds to sleep
     * @returns {Promise<void>}
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * Destroy the queue and cleanup resources
     */
    destroy() {
        console.log('[JobQueue] Destroying queue');
        
        this.pause();
        this.clearQueue();
        this.cancelAllRunning();
        
        // Clear all timeouts
        for (const job of this.jobs.values()) {
            if (job.timeoutHandle) {
                clearTimeout(job.timeoutHandle);
            }
        }
        
        this.jobs.clear();
        this.removeAllListeners();
        
        this.emit('queue:destroyed');
    }
}

module.exports = { JobQueue, Priority, JobStatus };
