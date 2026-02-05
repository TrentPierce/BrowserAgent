/**
 * ============================================================================
 * DOM SNAPSHOT MANAGER - Time-Travel Debugging
 * ============================================================================
 * 
 * Captures and replays DOM snapshots for debugging and analysis.
 * Enables time-travel debugging similar to Cypress.
 * 
 * @author Trent Pierce
 * @license BrowserAgent Non-Commercial License
 * @copyright 2026 Trent Pierce
 * ============================================================================
 */

const fs = require('fs').promises;
const path = require('path');

/**
 * DOM snapshot manager for time-travel debugging
 */
class DOMSnapshotManager {
  /**
     * @param {Object} options - Snapshot options
     * @param {boolean} options.autoCapture - Auto-capture on actions
     * @param {number} options.maxSnapshots - Maximum snapshots to keep
     */
  constructor(options = {}) {
    this.options = {
      autoCapture: true,
      maxSnapshots: 100,
      ...options
    };

    this.snapshots = [];
    this.currentIndex = -1;
  }

  /**
     * Capture DOM snapshot
     * @param {Object} page - Page adapter
     * @param {Object} metadata - Snapshot metadata
     * @returns {Promise<Object>} Snapshot data
     */
  async capture(page, metadata = {}) {
    const content = await page.content();
    const url = page.url();
        
    const snapshot = {
      id: this.snapshots.length,
      timestamp: Date.now(),
      url,
      title: await page.title().catch(() => null),
      html: content,
      metadata: {
        action: metadata.action,
        selector: metadata.selector,
        ...metadata
      }
    };

    this.snapshots.push(snapshot);
    this.currentIndex = this.snapshots.length - 1;

    // Limit max snapshots
    if (this.snapshots.length > this.options.maxSnapshots) {
      this.snapshots.shift();
      // Reindex
      this.snapshots.forEach((s, i) => s.id = i);
    }

    return snapshot;
  }

  /**
     * Restore snapshot to page
     * @param {Object} page - Page adapter
     * @param {number} index - Snapshot index
     */
  async restore(page, index) {
    if (index < 0 || index >= this.snapshots.length) {
      throw new Error(`Snapshot index ${index} out of range`);
    }

    const snapshot = this.snapshots[index];
    await page.setContent(snapshot.html);
    this.currentIndex = index;

    return snapshot;
  }

  /**
     * Go back to previous snapshot
     * @param {Object} page - Page adapter
     */
  async back(page) {
    if (this.currentIndex > 0) {
      return await this.restore(page, this.currentIndex - 1);
    }
    return null;
  }

  /**
     * Go forward to next snapshot
     * @param {Object} page - Page adapter
     */
  async forward(page) {
    if (this.currentIndex < this.snapshots.length - 1) {
      return await this.restore(page, this.currentIndex + 1);
    }
    return null;
  }

  /**
     * Get current snapshot
     * @returns {Object|null}
     */
  getCurrent() {
    if (this.currentIndex >= 0 && this.currentIndex < this.snapshots.length) {
      return this.snapshots[this.currentIndex];
    }
    return null;
  }

  /**
     * Get all snapshots
     * @returns {Array<Object>}
     */
  getAll() {
    return this.snapshots.map(s => ({
      id: s.id,
      timestamp: s.timestamp,
      url: s.url,
      title: s.title,
      metadata: s.metadata
    }));
  }

  /**
     * Clear all snapshots
     */
  clear() {
    this.snapshots = [];
    this.currentIndex = -1;
  }

  /**
     * Export snapshots to file
     * @param {string} filePath - Export file path
     */
  async export(filePath) {
    const data = {
      version: '1.0',
      exportedAt: Date.now(),
      snapshots: this.snapshots
    };

    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  }

  /**
     * Import snapshots from file
     * @param {string} filePath - Import file path
     */
  async import(filePath) {
    const data = JSON.parse(await fs.readFile(filePath, 'utf8'));
        
    if (data.snapshots) {
      this.snapshots = data.snapshots;
      this.currentIndex = this.snapshots.length - 1;
    }
  }

  /**
     * Compare two snapshots
     * @param {number} index1 - First snapshot index
     * @param {number} index2 - Second snapshot index
     * @returns {Object} Diff result
     */
  compare(index1, index2) {
    const s1 = this.snapshots[index1];
    const s2 = this.snapshots[index2];

    if (!s1 || !s2) {
      throw new Error('Invalid snapshot indices');
    }

    // Simple text comparison (could be enhanced with DOM diffing)
    const diff = {
      added: [],
      removed: [],
      modified: []
    };

    // This is a placeholder - real implementation would use a DOM diffing library
    if (s1.html !== s2.html) {
      diff.modified.push('DOM structure changed');
    }

    if (s1.url !== s2.url) {
      diff.modified.push(`URL: ${s1.url} → ${s2.url}`);
    }

    return diff;
  }
}

module.exports = DOMSnapshotManager;
