/**
 * ============================================================================
 * CONTEXT MANAGER - Multi-Tab & Multi-Window Support
 * ============================================================================
 * 
 * Manages multiple browser contexts, tabs, and windows.
 * Enables seamless switching between pages and contexts.
 * 
 * @author Trent Pierce
 * @license BrowserAgent Non-Commercial License
 * @copyright 2026 Trent Pierce
 * ============================================================================
 */

/**
 * Context manager for multi-tab and multi-window operations
 */
class ContextManager {
  /**
     * @param {Object} options - Manager options
     * @param {number} options.maxContexts - Maximum concurrent contexts
     */
  constructor(options = {}) {
    this.options = {
      maxContexts: 10,
      ...options
    };

    this.contexts = new Map();
    this.pages = new Map();
    this.activeContextId = null;
    this.activePageId = null;
  }

  /**
     * Create new browser context (isolated session)
     * @param {Object} browser - Browser adapter
     * @param {Object} options - Context options
     * @returns {Promise<Object>} Context object
     */
  async createContext(browser, options = {}) {
    const contextId = this.generateId();
        
    const context = await browser.createContext({
      ...options,
      viewport: options.viewport || { width: 1280, height: 720 }
    });

    this.contexts.set(contextId, {
      id: contextId,
      browserContext: context,
      pages: new Set(),
      createdAt: Date.now()
    });

    return contextId;
  }

  /**
     * Create new page in context
     * @param {Object} browser - Browser adapter
     * @param {string} contextId - Context ID (optional, uses active)
     * @param {Object} options - Page options
     * @returns {Promise<Object>} Page adapter
     */
  async createPage(browser, contextId = null, options = {}) {
    const ctxId = contextId || this.activeContextId;
        
    if (!ctxId || !this.contexts.has(ctxId)) {
      // Create new context if none exists
      if (!ctxId) {
        await this.createContext(browser, options);
      }
    }

    const page = await browser.newPage(options);
    const pageId = page.id;

    this.pages.set(pageId, {
      id: pageId,
      page: page,
      contextId: ctxId,
      createdAt: Date.now(),
      title: null,
      url: null
    });

    // Add to context
    if (ctxId && this.contexts.has(ctxId)) {
      this.contexts.get(ctxId).pages.add(pageId);
    }

    // Set as active
    this.activePageId = pageId;

    // Set up page event listeners
    this.setupPageListeners(pageId, page);

    return page;
  }

  /**
     * Set up page event listeners
     * @private
     */
  setupPageListeners(pageId, page) {
    page.on('load', async () => {
      const pageInfo = this.pages.get(pageId);
      if (pageInfo) {
        pageInfo.url = page.url();
        try {
          pageInfo.title = await page.title();
        } catch (e) {
          // Page may be closed
        }
      }
    });

    page.on('close', () => {
      this.pages.delete(pageId);
            
      // Remove from context
      this.contexts.forEach(ctx => {
        ctx.pages.delete(pageId);
      });

      if (this.activePageId === pageId) {
        this.activePageId = null;
      }
    });
  }

  /**
     * Switch to a specific page
     * @param {string} pageId - Page ID
     * @returns {Object} Page adapter
     */
  switchToPage(pageId) {
    const pageInfo = this.pages.get(pageId);
    if (!pageInfo) {
      throw new Error(`Page '${pageId}' not found`);
    }

    this.activePageId = pageId;
    this.activeContextId = pageInfo.contextId;
        
    return pageInfo.page;
  }

  /**
     * Switch to page by index
     * @param {number} index - Page index
     * @returns {Object} Page adapter
     */
  switchToPageByIndex(index) {
    const pageIds = Array.from(this.pages.keys());
    if (index < 0 || index >= pageIds.length) {
      throw new Error(`Page index ${index} out of range`);
    }

    return this.switchToPage(pageIds[index]);
  }

  /**
     * Switch to page by title
     * @param {string} title - Page title (partial match)
     * @returns {Object} Page adapter
     */
  async switchToPageByTitle(title) {
    for (const [pageId, pageInfo] of this.pages) {
      try {
        const pageTitle = await pageInfo.page.title();
        if (pageTitle.includes(title)) {
          return this.switchToPage(pageId);
        }
      } catch (e) {
        // Page may be closed
      }
    }

    throw new Error(`No page with title containing '${title}' found`);
  }

  /**
     * Switch to page by URL
     * @param {string} urlPattern - URL pattern to match
     * @returns {Object} Page adapter
     */
  switchToPageByURL(urlPattern) {
    const regex = new RegExp(urlPattern);
        
    for (const [pageId, pageInfo] of this.pages) {
      if (regex.test(pageInfo.url || '')) {
        return this.switchToPage(pageId);
      }
    }

    throw new Error(`No page with URL matching '${urlPattern}' found`);
  }

  /**
     * Get active page
     * @returns {Object|null}
     */
  getActivePage() {
    if (!this.activePageId) return null;
    const pageInfo = this.pages.get(this.activePageId);
    return pageInfo ? pageInfo.page : null;
  }

  /**
     * Close a specific page
     * @param {string} pageId - Page ID
     */
  async closePage(pageId) {
    const pageInfo = this.pages.get(pageId);
    if (!pageInfo) {
      throw new Error(`Page '${pageId}' not found`);
    }

    await pageInfo.page.close();
    this.pages.delete(pageId);

    // Remove from context
    if (pageInfo.contextId && this.contexts.has(pageInfo.contextId)) {
      this.contexts.get(pageInfo.contextId).pages.delete(pageId);
    }

    if (this.activePageId === pageId) {
      this.activePageId = null;
    }
  }

  /**
     * Close all pages except one
     * @param {string} keepPageId - Page ID to keep
     */
  async closeOtherPages(keepPageId) {
    const pageIds = Array.from(this.pages.keys());
        
    for (const pageId of pageIds) {
      if (pageId !== keepPageId) {
        await this.closePage(pageId);
      }
    }
  }

  /**
     * Get all pages
     * @returns {Array<Object>}
     */
  getAllPages() {
    return Array.from(this.pages.values()).map(p => ({
      id: p.id,
      url: p.url,
      title: p.title,
      contextId: p.contextId,
      createdAt: p.createdAt
    }));
  }

  /**
     * Get pages in a context
     * @param {string} contextId - Context ID
     * @returns {Array<Object>}
     */
  getContextPages(contextId) {
    const context = this.contexts.get(contextId);
    if (!context) return [];

    return Array.from(context.pages).map(pageId => {
      const pageInfo = this.pages.get(pageId);
      return pageInfo ? {
        id: pageInfo.id,
        url: pageInfo.url,
        title: pageInfo.title
      } : null;
    }).filter(Boolean);
  }

  /**
     * Close a context and all its pages
     * @param {string} contextId - Context ID
     */
  async closeContext(contextId) {
    const context = this.contexts.get(contextId);
    if (!context) {
      throw new Error(`Context '${contextId}' not found`);
    }

    // Close all pages in context
    for (const pageId of context.pages) {
      const pageInfo = this.pages.get(pageId);
      if (pageInfo) {
        try {
          await pageInfo.page.close();
        } catch (e) {
          // Page may already be closed
        }
        this.pages.delete(pageId);
      }
    }

    // Close browser context
    try {
      await context.browserContext.close();
    } catch (e) {
      // Context may already be closed
    }

    this.contexts.delete(contextId);

    if (this.activeContextId === contextId) {
      this.activeContextId = null;
      this.activePageId = null;
    }
  }

  /**
     * Wait for new page to open
     * @param {Object} browser - Browser adapter
     * @param {Function} trigger - Function that triggers new page
     * @param {Object} options - Wait options
     * @returns {Promise<Object>} New page
     */
  async waitForNewPage(browser, trigger, options = {}) {
    const timeout = options.timeout || 10000;
        
    const initialPageCount = this.pages.size;
        
    // Execute trigger
    await trigger();

    // Wait for new page
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      if (this.pages.size > initialPageCount) {
        // Find the new page
        const newPageId = Array.from(this.pages.keys()).pop();
        return this.switchToPage(newPageId);
      }
      await this.sleep(100);
    }

    throw new Error('Timeout waiting for new page');
  }

  /**
     * Popups handling - wait for and interact with popup
     * @param {Function} trigger - Function that triggers popup
     * @param {Function} handler - Handler for popup page
     * @param {Object} options - Options
     */
  async withPopup(trigger, handler, options = {}) {
    const timeout = options.timeout || 10000;
        
    // Execute trigger first
    await trigger();
        
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Timeout waiting for popup'));
      }, timeout);

      const checkForPopup = async () => {
        // Look for popup indicator (new page with about:blank or different domain)
        for (const [pageId, pageInfo] of this.pages) {
          if (pageInfo.url && pageInfo.url !== 'about:blank') {
            try {
              clearTimeout(timer);
              const result = await handler(pageInfo.page);
              resolve(result);
              return;
            } catch (e) {
              reject(e);
              return;
            }
          }
        }
        setTimeout(checkForPopup, 100);
      };

      checkForPopup();
    });
  }

  /**
     * Bring page to front
     * @param {string} pageId - Page ID (uses active if not provided)
     */
  async bringToFront(pageId = null) {
    const targetPageId = pageId || this.activePageId;
    if (!targetPageId) {
      throw new Error('No active page');
    }

    const pageInfo = this.pages.get(targetPageId);
    if (!pageInfo) {
      throw new Error(`Page '${targetPageId}' not found`);
    }

    await pageInfo.page.bringToFront();
  }

  /**
     * Refresh page info (URL, title)
     * @param {string} pageId - Page ID
     */
  async refreshPageInfo(pageId = null) {
    const targetPageId = pageId || this.activePageId;
    const pageInfo = this.pages.get(targetPageId);
        
    if (pageInfo && pageInfo.page) {
      try {
        pageInfo.url = pageInfo.page.url();
        pageInfo.title = await pageInfo.page.title();
      } catch (e) {
        // Page may be closed
      }
    }
  }

  /**
     * Generate unique ID
     * @private
     */
  generateId() {
    return `ctx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
     * Utility sleep function
     * @private
     */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
     * Get manager stats
     * @returns {Object}
     */
  getStats() {
    return {
      totalContexts: this.contexts.size,
      totalPages: this.pages.size,
      activeContext: this.activeContextId,
      activePage: this.activePageId,
      contexts: Array.from(this.contexts.values()).map(ctx => ({
        id: ctx.id,
        pageCount: ctx.pages.size,
        createdAt: ctx.createdAt
      }))
    };
  }
}

module.exports = ContextManager;
