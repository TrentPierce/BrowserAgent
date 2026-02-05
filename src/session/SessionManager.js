/**
 * ============================================================================
 * SESSION MANAGER - Authentication & State Persistence
 * ============================================================================
 * 
 * Manages browser sessions, authentication state, cookies, and storage.
 * Enables persistent logins across browser sessions.
 * 
 * @author Trent Pierce
 * @license BrowserAgent Non-Commercial License
 * @copyright 2026 Trent Pierce
 * ============================================================================
 */

const fs = require('fs').promises;
const path = require('path');

/**
 * Session manager for authentication and state persistence
 */
class SessionManager {
  /**
     * @param {Object} options - Session options
     * @param {string} options.storagePath - Path to store session data
     * @param {number} options.ttl - Session time-to-live in milliseconds
     */
  constructor(options = {}) {
    this.options = {
      storagePath: './.sessions',
      ttl: 7 * 24 * 60 * 60 * 1000, // 7 days default
      ...options
    };

    this.sessions = new Map();
    this.activeSession = null;
  }

  /**
     * Initialize session storage
     */
  async init() {
    try {
      await fs.mkdir(this.options.storagePath, { recursive: true });
    } catch (e) {
      // Directory may already exist
    }
  }

  /**
     * Create new session
     * @param {string} name - Session name/identifier
     * @param {Object} metadata - Session metadata
     * @returns {Object} Session object
     */
  async createSession(name, metadata = {}) {
    const session = {
      id: this.generateId(),
      name,
      createdAt: Date.now(),
      lastUsed: Date.now(),
      metadata: {
        userAgent: metadata.userAgent,
        viewport: metadata.viewport,
        timezone: metadata.timezone,
        locale: metadata.locale,
        ...metadata
      },
      cookies: [],
      localStorage: {},
      sessionStorage: {}
    };

    this.sessions.set(session.id, session);
    this.activeSession = session.id;

    await this.saveSession(session);
    return session;
  }

  /**
     * Load session from storage
     * @param {string} sessionId - Session ID or name
     * @returns {Object|null}
     */
  async loadSession(sessionId) {
    // Check memory cache first
    if (this.sessions.has(sessionId)) {
      const session = this.sessions.get(sessionId);
      session.lastUsed = Date.now();
      this.activeSession = sessionId;
      return session;
    }

    // Try loading from file
    try {
      const sessionPath = path.join(this.options.storagePath, `${sessionId}.json`);
      const data = await fs.readFile(sessionPath, 'utf8');
      const session = JSON.parse(data);

      // Check TTL
      if (Date.now() - session.lastUsed > this.options.ttl) {
        await this.deleteSession(sessionId);
        return null;
      }

      this.sessions.set(sessionId, session);
      this.activeSession = sessionId;
      return session;
    } catch (e) {
      return null;
    }
  }

  /**
     * Save session to storage
     * @param {Object} session - Session object
     */
  async saveSession(session) {
    const sessionPath = path.join(this.options.storagePath, `${session.id}.json`);
    await fs.writeFile(sessionPath, JSON.stringify(session, null, 2));
  }

  /**
     * Delete session
     * @param {string} sessionId - Session ID
     */
  async deleteSession(sessionId) {
    this.sessions.delete(sessionId);
        
    try {
      const sessionPath = path.join(this.options.storagePath, `${sessionId}.json`);
      await fs.unlink(sessionPath);
    } catch (e) {
      // File may not exist
    }

    if (this.activeSession === sessionId) {
      this.activeSession = null;
    }
  }

  /**
     * Capture current browser state into session
     * @param {Object} page - Page adapter
     * @param {string} sessionId - Session ID (uses active if not provided)
     */
  async captureState(page, sessionId) {
    const session = sessionId 
      ? this.sessions.get(sessionId) 
      : this.sessions.get(this.activeSession);

    if (!session) {
      throw new Error('No active session to capture state into');
    }

    // Capture cookies
    session.cookies = await page.cookies();

    // Capture storage
    const storage = await page.evaluate(() => {
      const localStorage = {};
      const sessionStorage = {};

      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        localStorage[key] = window.localStorage.getItem(key);
      }

      for (let i = 0; i < window.sessionStorage.length; i++) {
        const key = window.sessionStorage.key(i);
        sessionStorage[key] = window.sessionStorage.getItem(key);
      }

      return { localStorage, sessionStorage };
    });

    session.localStorage = storage.localStorage;
    session.sessionStorage = storage.sessionStorage;
    session.lastUsed = Date.now();
    session.url = page.url();

    await this.saveSession(session);
  }

  /**
     * Restore session state to browser
     * @param {Object} page - Page adapter
     * @param {string} sessionId - Session ID (uses active if not provided)
     */
  async restoreState(page, sessionId) {
    const session = sessionId 
      ? await this.loadSession(sessionId)
      : this.sessions.get(this.activeSession);

    if (!session) {
      throw new Error('Session not found');
    }

    // Restore cookies
    if (session.cookies && session.cookies.length > 0) {
      await page.setCookie(...session.cookies);
    }

    // Restore localStorage
    if (session.localStorage) {
      await page.evaluate((data) => {
        Object.entries(data).forEach(([key, value]) => {
          window.localStorage.setItem(key, value);
        });
      }, session.localStorage);
    }

    // Restore sessionStorage
    if (session.sessionStorage) {
      await page.evaluate((data) => {
        Object.entries(data).forEach(([key, value]) => {
          window.sessionStorage.setItem(key, value);
        });
      }, session.sessionStorage);
    }

    // Navigate to last URL if available
    if (session.url && session.url !== 'about:blank') {
      await page.goto(session.url);
    }

    session.lastUsed = Date.now();
    await this.saveSession(session);
  }

  /**
     * Perform authentication workflow
     * @param {Object} page - Page adapter
     * @param {Object} credentials - Auth credentials
     * @param {Object} config - Auth configuration
     * @returns {Promise<boolean>}
     */
  async authenticate(page, credentials, config) {
    const {
      loginUrl,
      usernameSelector,
      passwordSelector,
      submitSelector,
      successIndicator,
      preAuthSteps = []
    } = config;

    // Navigate to login page
    await page.goto(loginUrl);

    // Execute pre-auth steps if any
    for (const step of preAuthSteps) {
      if (step.type === 'click') {
        await page.click(step.selector);
      } else if (step.type === 'wait') {
        await page.waitForTimeout(step.duration);
      } else if (step.type === 'waitForSelector') {
        await page.waitForSelector(step.selector);
      }
    }

    // Fill credentials
    await page.type(usernameSelector, credentials.username);
    await page.type(passwordSelector, credentials.password);

    // Submit
    await page.click(submitSelector);

    // Wait for success indicator
    try {
      await page.waitForSelector(successIndicator, { timeout: 10000 });
            
      // Capture authenticated state
      if (this.activeSession) {
        await this.captureState(page, this.activeSession);
      }
            
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
     * Handle MFA/2FA flow
     * @param {Object} page - Page adapter
     * @param {Object} config - MFA configuration
     * @returns {Promise<boolean>}
     */
  async handleMFA(page, config) {
    const {
      mfaSelector,
      submitSelector,
      codeProvider, // Function that returns the MFA code
      successIndicator,
      timeout = 60000
    } = config;

    // Wait for MFA input
    await page.waitForSelector(mfaSelector, { timeout });

    // Get MFA code from provider
    const code = await codeProvider();

    // Enter code
    await page.type(mfaSelector, code);
    await page.click(submitSelector);

    // Wait for success
    try {
      await page.waitForSelector(successIndicator, { timeout: 10000 });
            
      // Capture authenticated state
      if (this.activeSession) {
        await this.captureState(page, this.activeSession);
      }
            
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
     * Check if session is authenticated
     * @param {Object} page - Page adapter
     * @param {Object} config - Auth check configuration
     * @returns {Promise<boolean>}
     */
  async isAuthenticated(page, config) {
    const {
      checkUrl,
      authIndicator,
      unauthIndicator
    } = config;

    await page.goto(checkUrl);

    // Check for auth indicator
    const isAuth = await page.evaluate((selector) => {
      return !!document.querySelector(selector);
    }, authIndicator);

    if (isAuth) return true;

    // Check for unauth indicator
    if (unauthIndicator) {
      const isUnauth = await page.evaluate((selector) => {
        return !!document.querySelector(selector);
      }, unauthIndicator);
            
      return !isUnauth;
    }

    return false;
  }

  /**
     * List all saved sessions
     * @returns {Promise<Array>}
     */
  async listSessions() {
    const sessions = [];

    try {
      const files = await fs.readdir(this.options.storagePath);
            
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const data = await fs.readFile(
              path.join(this.options.storagePath, file),
              'utf8'
            );
            const session = JSON.parse(data);
            sessions.push({
              id: session.id,
              name: session.name,
              createdAt: session.createdAt,
              lastUsed: session.lastUsed,
              metadata: session.metadata
            });
          } catch (e) {
            // Skip invalid session files
          }
        }
      }
    } catch (e) {
      // Directory may not exist
    }

    return sessions.sort((a, b) => b.lastUsed - a.lastUsed);
  }

  /**
     * Clear expired sessions
     */
  async clearExpired() {
    const sessions = await this.listSessions();
    const now = Date.now();

    for (const session of sessions) {
      if (now - session.lastUsed > this.options.ttl) {
        await this.deleteSession(session.id);
      }
    }
  }

  /**
     * Export session for sharing
     * @param {string} sessionId - Session ID
     * @returns {Promise<Object>}
     */
  async exportSession(sessionId) {
    const session = await this.loadSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    return {
      version: '1.0',
      exportedAt: Date.now(),
      session: {
        name: session.name,
        metadata: session.metadata,
        cookies: session.cookies,
        localStorage: session.localStorage,
        sessionStorage: session.sessionStorage
      }
    };
  }

  /**
     * Import session from export
     * @param {Object} exportedData - Exported session data
     * @param {string} newName - Optional new name for session
     * @returns {Promise<Object>}
     */
  async importSession(exportedData, newName) {
    if (!exportedData.session) {
      throw new Error('Invalid session export format');
    }

    const session = await this.createSession(
      newName || exportedData.session.name,
      exportedData.session.metadata
    );

    session.cookies = exportedData.session.cookies || [];
    session.localStorage = exportedData.session.localStorage || {};
    session.sessionStorage = exportedData.session.sessionStorage || {};

    await this.saveSession(session);
    return session;
  }

  /**
     * Generate unique session ID
     * @private
     */
  generateId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
     * Get active session
     * @returns {Object|null}
     */
  getActiveSession() {
    return this.activeSession ? this.sessions.get(this.activeSession) : null;
  }

  /**
     * Set active session
     * @param {string} sessionId - Session ID
     */
  setActiveSession(sessionId) {
    if (!this.sessions.has(sessionId)) {
      throw new Error('Session not found');
    }
    this.activeSession = sessionId;
  }
}

module.exports = SessionManager;
