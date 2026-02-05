/**
 * BrowserbaseProvider - Cloud browser automation provider
 * Integrates with Browserbase (browserbase.com) for scalable, managed browser instances
 * @module BrowserbaseProvider
 */

const axios = require('axios');

/**
 * Browserbase Provider for cloud-based browser automation
 * Supports Puppeteer and Playwright connections to Browserbase managed browsers
 */
class BrowserbaseProvider {
    /**
     * Create a new BrowserbaseProvider instance
     * @param {string} apiKey - Browserbase API key
     * @param {Object} config - Provider configuration
     * @param {string} config.projectId - Browserbase project ID
     * @param {string} config.region - Browserbase region (default: 'us-west-2')
     * @param {boolean} config.stealth - Enable stealth mode (default: true)
     * @param {Object} config.proxy - Proxy configuration
     * @param {string} config.browser - Browser type: 'chrome' or 'firefox' (default: 'chrome')
     * @param {string} config.resolution - Screen resolution (default: '1920x1080')
     */
    constructor(apiKey, config = {}) {
        if (!apiKey) {
            throw new Error('Browserbase API key is required');
        }

        this.apiKey = apiKey;
        this.config = {
            projectId: config.projectId || process.env.BROWSERBASE_PROJECT_ID,
            region: config.region || 'us-west-2',
            stealth: config.stealth !== false,
            proxy: config.proxy || null,
            browser: config.browser || 'chrome',
            resolution: config.resolution || '1920x1080',
            timeout: config.timeout || 30000,
            ...config
        };

        this.baseURL = `https://www.browserbase.com/v1`;
        this.sessionId = null;
        this.connectURL = null;
        this.browser = null;
        this.page = null;
        this.initialized = false;

        // Statistics tracking
        this.stats = {
            sessionsCreated: 0,
            sessionsClosed: 0,
            actionsExecuted: 0,
            screenshotsTaken: 0,
            downloadsCaptured: 0,
            errors: []
        };
    }

    /**
     * Initialize the Browserbase provider
     * Creates a new browser session on Browserbase
     * @returns {Promise<void>}
     */
    async init() {
        if (this.initialized) {
            throw new Error('BrowserbaseProvider already initialized');
        }

        try {
            // Create a new session on Browserbase
            const session = await this.createSession();
            this.sessionId = session.id;
            this.connectURL = session.connectUrl;
            this.initialized = true;

            console.log(`✅ Browserbase session created: ${this.sessionId}`);
        } catch (error) {
            this.stats.errors.push({
                timestamp: new Date().toISOString(),
                action: 'init',
                error: error.message
            });
            throw new Error(`Failed to initialize Browserbase: ${error.message}`);
        }
    }

    /**
     * Create a new browser session on Browserbase
     * @private
     * @returns {Promise<Object>} Session details
     */
    async createSession() {
        const response = await axios.post(
            `${this.baseURL}/sessions`,
            {
                projectId: this.config.projectId,
                browser: this.config.browser,
                stealth: this.config.stealth,
                proxy: this.config.proxy,
                resolution: this.config.resolution
            },
            {
                headers: {
                    'X-BB-API-Key': this.apiKey,
                    'Content-Type': 'application/json'
                },
                timeout: this.config.timeout
            }
        );

        this.stats.sessionsCreated++;
        return response.data;
    }

    /**
     * Get the WebSocket debugger URL for Puppeteer/Playwright connection
     * @returns {Promise<string>} WebSocket URL
     */
    async getConnectURL() {
        if (!this.sessionId) {
            throw new Error('No active session. Call init() first.');
        }

        const response = await axios.get(
            `${this.baseURL}/sessions/${this.sessionId}/debug`,
            {
                headers: {
                    'X-BB-API-Key': this.apiKey
                },
                timeout: this.config.timeout
            }
        );

        return response.data.debuggerUrl;
    }

    /**
     * Connect Puppeteer to the Browserbase session
     * @param {Object} puppeteer - Puppeteer instance
     * @returns {Promise<Object>} { browser, page }
     */
    async connectPuppeteer(puppeteer) {
        if (!this.initialized) {
            await this.init();
        }

        const wsEndpoint = await this.getConnectURL();

        this.browser = await puppeteer.connect({
            browserWSEndpoint: wsEndpoint,
            defaultViewport: {
                width: 1920,
                height: 1080
            }
        });

        // Get or create a page
        const pages = await this.browser.pages();
        this.page = pages[0] || await this.browser.newPage();

        return { browser: this.browser, page: this.page };
    }

    /**
     * Connect Playwright to the Browserbase session
     * @param {Object} playwright - Playwright instance
     * @returns {Promise<Object>} { browser, context, page }
     */
    async connectPlaywright(playwright) {
        if (!this.initialized) {
            await this.init();
        }

        const wsEndpoint = await this.getConnectURL();

        this.browser = await playwright.chromium.connectOverCDP(wsEndpoint);
        const context = this.browser.contexts()[0] || await this.browser.newContext();
        this.page = context.pages()[0] || await context.newPage();

        return { browser: this.browser, context, page: this.page };
    }

    /**
     * Get session logs
     * @returns {Promise<Array>} Session logs
     */
    async getSessionLogs() {
        if (!this.sessionId) {
            throw new Error('No active session');
        }

        const response = await axios.get(
            `${this.baseURL}/sessions/${this.sessionId}/logs`,
            {
                headers: {
                    'X-BB-API-Key': this.apiKey
                }
            }
        );

        return response.data;
    }

    /**
     * Get session recording URL
     * @returns {Promise<string>} Recording URL
     */
    async getSessionRecording() {
        if (!this.sessionId) {
            throw new Error('No active session');
        }

        const response = await axios.get(
            `${this.baseURL}/sessions/${this.sessionId}/recording`,
            {
                headers: {
                    'X-BB-API-Key': this.apiKey
                }
            }
        );

        return response.data.recordingUrl;
    }

    /**
     * Get session downloads
     * @returns {Promise<Array>} Downloaded files
     */
    async getSessionDownloads() {
        if (!this.sessionId) {
            throw new Error('No active session');
        }

        const response = await axios.get(
            `${this.baseURL}/sessions/${this.sessionId}/downloads`,
            {
                headers: {
                    'X-BB-API-Key': this.apiKey
                }
            }
        );

        this.stats.downloadsCaptured += response.data.length || 0;
        return response.data;
    }

    /**
     * Take a screenshot via Browserbase API
     * @param {Object} options - Screenshot options
     * @returns {Promise<Buffer>} Screenshot buffer
     */
    async takeScreenshot(options = {}) {
        if (!this.page) {
            throw new Error('Browser not connected. Call connectPuppeteer() or connectPlaywright() first.');
        }

        const screenshot = await this.page.screenshot({
            fullPage: options.fullPage || false,
            type: options.type || 'png',
            encoding: options.encoding || 'binary',
            ...options
        });

        this.stats.screenshotsTaken++;
        return screenshot;
    }

    /**
     * Upload a file to the session
     * @param {string|Buffer} file - File path or buffer
     * @param {string} filename - Filename
     * @returns {Promise<Object>} Upload result
     */
    async uploadFile(file, filename) {
        if (!this.sessionId) {
            throw new Error('No active session');
        }

        const FormData = require('form-data');
        const fs = require('fs');
        const form = new FormData();

        if (typeof file === 'string') {
            form.append('file', fs.createReadStream(file), filename);
        } else {
            form.append('file', file, filename);
        }

        const response = await axios.post(
            `${this.baseURL}/sessions/${this.sessionId}/files`,
            form,
            {
                headers: {
                    'X-BB-API-Key': this.apiKey,
                    ...form.getHeaders()
                }
            }
        );

        return response.data;
    }

    /**
     * Get session status
     * @returns {Promise<Object>} Session status
     */
    async getSessionStatus() {
        if (!this.sessionId) {
            throw new Error('No active session');
        }

        const response = await axios.get(
            `${this.baseURL}/sessions/${this.sessionId}`,
            {
                headers: {
                    'X-BB-API-Key': this.apiKey
                }
            }
        );

        return response.data;
    }

    /**
     * Update session (e.g., enable/disable stealth)
     * @param {Object} updates - Updates to apply
     * @returns {Promise<Object>} Updated session
     */
    async updateSession(updates) {
        if (!this.sessionId) {
            throw new Error('No active session');
        }

        const response = await axios.patch(
            `${this.baseURL}/sessions/${this.sessionId}`,
            updates,
            {
                headers: {
                    'X-BB-API-Key': this.apiKey,
                    'Content-Type': 'application/json'
                }
            }
        );

        return response.data;
    }

    /**
     * Get active sessions for the project
     * @returns {Promise<Array>} Active sessions
     */
    async listActiveSessions() {
        const response = await axios.get(
            `${this.baseURL}/sessions`,
            {
                headers: {
                    'X-BB-API-Key': this.apiKey
                },
                params: {
                    projectId: this.config.projectId,
                    status: 'active'
                }
            }
        );

        return response.data;
    }

    /**
     * Close the current session
     * @returns {Promise<void>}
     */
    async close() {
        if (!this.sessionId) {
            return;
        }

        try {
            // Close browser connection if exists
            if (this.browser) {
                await this.browser.disconnect();
            }

            // Close the Browserbase session
            await axios.delete(
                `${this.baseURL}/sessions/${this.sessionId}`,
                {
                    headers: {
                        'X-BB-API-Key': this.apiKey
                    }
                }
            );

            this.stats.sessionsClosed++;
            console.log(`✅ Browserbase session closed: ${this.sessionId}`);
        } catch (error) {
            this.stats.errors.push({
                timestamp: new Date().toISOString(),
                action: 'close',
                error: error.message
            });
            console.warn(`⚠️ Error closing Browserbase session: ${error.message}`);
        } finally {
            this.sessionId = null;
            this.connectURL = null;
            this.browser = null;
            this.page = null;
            this.initialized = false;
        }
    }

    /**
     * Get provider statistics
     * @returns {Object} Statistics
     */
    getStats() {
        return {
            ...this.stats,
            sessionId: this.sessionId,
            initialized: this.initialized,
            config: {
                ...this.config,
                apiKey: '***' // Hide API key
            }
        };
    }

    /**
     * Validate provider configuration
     * @param {Object} config - Configuration to validate
     * @returns {boolean} Valid or not
     */
    static validateConfig(config) {
        const validRegions = ['us-west-2', 'us-east-1', 'eu-west-1'];
        const validBrowsers = ['chrome', 'firefox'];

        if (config.region && !validRegions.includes(config.region)) {
            return false;
        }

        if (config.browser && !validBrowsers.includes(config.browser)) {
            return false;
        }

        return true;
    }

    /**
     * Check if Browserbase API is accessible
     * @param {string} apiKey - API key to test
     * @returns {Promise<boolean>} True if accessible
     */
    static async checkConnection(apiKey) {
        try {
            const response = await axios.get(
                'https://www.browserbase.com/v1/sessions',
                {
                    headers: {
                        'X-BB-API-Key': apiKey
                    },
                    timeout: 5000
                }
            );
            return response.status === 200;
        } catch (error) {
            return false;
        }
    }
}

module.exports = { BrowserbaseProvider };
