/**
 * Worker Thread for Distributed Execution
 * Handles task execution in worker threads
 */

const { parentPort, workerData } = require('worker_threads');

class Worker {
  constructor(config) {
    this.workerId = config.workerId;
    this.config = config.config;
    this.setupMessageHandler();
    this.startHeartbeat();
  }

  setupMessageHandler() {
    if (!parentPort) return;
    
    parentPort.on('message', async (message) => {
      switch (message.type) {
        case 'execute-task':
          await this.executeTask(message.task);
          break;
        case 'shutdown':
          this.shutdown();
          break;
      }
    });
  }

  async executeTask(task) {
    try {
      // Execute the task based on its type
      const result = await this.performTask(task);
      
      parentPort.postMessage({
        type: 'task-completed',
        taskId: task.id,
        result: result
      });
    } catch (error) {
      parentPort.postMessage({
        type: 'task-failed',
        taskId: task.id,
        error: error.message
      });
    }
  }

  async performTask(task) {
    // This would be implemented based on task type
    // For now, just simulate work
    await new Promise(resolve => setTimeout(resolve, 100));
    return { success: true, data: task.payload };
  }

  startHeartbeat() {
    setInterval(() => {
      if (parentPort) {
        parentPort.postMessage({
          type: 'heartbeat',
          workerId: this.workerId,
          metrics: this.getMetrics()
        });
      }
    }, 5000);
  }

  getMetrics() {
    const usage = process.memoryUsage();
    return {
      memory: usage.heapUsed / 1024 / 1024,
      uptime: process.uptime()
    };
  }

  shutdown() {
    process.exit(0);
  }
}

if (workerData) {
  new Worker(workerData);
}

module.exports = Worker;
