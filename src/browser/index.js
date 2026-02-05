/**
 * ============================================================================
 * INDEX FILES - Module Exports
 * ============================================================================
 * 
 * Central export points for all browser automation modules.
 * 
 * @author Trent Pierce
 * @license BrowserAgent Non-Commercial License
 * @copyright 2026 Trent Pierce
 * ============================================================================
 */

// src/browser/index.js
const fs = require('fs');
const path = require('path');

// Browser adapters
const BrowserAdapter = require('./BrowserAdapter');
const ChromeAdapter = require('./ChromeAdapter');
const FirefoxAdapter = require('./FirefoxAdapter');
const SafariAdapter = require('./SafariAdapter');
const EdgeAdapter = require('./EdgeAdapter');
const PageAdapter = require('./PageAdapter');
const ContextManager = require('./ContextManager');
const { BrowserFactory, BROWSER_TYPES } = require('./BrowserFactory');

module.exports = {
  BrowserAdapter,
  ChromeAdapter,
  FirefoxAdapter,
  SafariAdapter,
  EdgeAdapter,
  PageAdapter,
  ContextManager,
  BrowserFactory,
  BROWSER_TYPES
};
