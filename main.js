/**
 * BrowserAgent - Intelligent Browser Automation
 * Electron Main Process
 * 
 * This project uses BrowserAgent by Trent Pierce
 * https://github.com/TrentPierce/BrowserAgent
 * Licensed under the BrowserAgent Non-Commercial License
 * 
 * Copyright (c) 2026 Trent Pierce. All rights reserved.
 * See LICENSE file for full terms.
 */

require('dotenv').config();
const { app, BrowserWindow, ipcMain, webContents, dialog } = require('electron');
const path = require('path');

// Import new components - handle optional dependencies
let SecureDatabase;
try {
    SecureDatabase = require('./database');
} catch (error) {
    console.warn('[Main] Database module not available:', error.message);
    SecureDatabase = null;
}

const AuthManager = require('./auth');
const ContextManager = require('./contextManager');
const LearningEngine = require('./learningEngine');
const EnhancedAgent = require('./enhancedAgent');

let mainWindow;
let activeAgent = null;
let database = null;
let authManager = null;
let contextManager = null;
let learningEngine = null;
let isAuthenticated = false;
let isInitializing = true;
let databaseAvailable = SecureDatabase !== null;

async function initializeApp() {
    // Check if database is available
    if (!databaseAvailable) {
        console.warn('[Main] Running without database support. Some features will be unavailable.');

        // Initialize without database
        authManager = new AuthManager();
        contextManager = new ContextManager();
        learningEngine = new LearningEngine();
        isAuthenticated = true;
        isInitializing = false;

        // Create window first, then show warning (dialog needs a window to display properly)
        createWindow();

        // Show warning after window is created (non-blocking)
        setImmediate(() => {
            dialog.showMessageBox(mainWindow, {
                type: 'warning',
                title: 'Limited Mode',
                message: 'Database not available',
                detail: 'Running in limited mode without persistent storage. Install better-sqlite3 for full functionality.'
            }).catch(err => console.warn('[Main] Dialog error:', err.message));
        });
        return;
    }

    // Initialize authentication
    authManager = new AuthManager();

    // Check if password is already set
    const passwordSet = await authManager.isPasswordSet();

    if (!passwordSet) {
        // First launch - prompt for password setup
        const password = await promptForNewPassword();
        if (!password) {
            app.quit();
            return;
        }

        try {
            await authManager.setPassword(password);
            await initializeDatabase(password);
        } catch (error) {
            console.error('[Main] Failed to initialize:', error);
            dialog.showErrorBox('Initialization Error', error.message);
            app.quit();
            return;
        }
    } else {
        // Returning user - try auto-login with stored credentials
        // Password is only required for sensitive operations (settings, history export)
        try {
            const autoLoginResult = await authManager.autoLogin();
            if (autoLoginResult.success) {
                await initializeDatabase(autoLoginResult.derivedKey);
                console.log('[Main] Auto-login successful');
            } else {
                // Fallback to password prompt if auto-login fails
                const password = await promptForPassword();
                if (!password) {
                    app.quit();
                    return;
                }

                const result = await authManager.verifyPassword(password);
                if (!result.success) {
                    dialog.showErrorBox('Authentication Failed', 'Invalid password. Please try again.');
                    app.quit();
                    return;
                }
                await initializeDatabase(password);
            }
        } catch (error) {
            console.error('[Main] Database initialization failed:', error);
            dialog.showErrorBox('Database Error', 'Could not open secure database.');
            app.quit();
            return;
        }
    }

    isAuthenticated = true;
    isInitializing = false;
    createWindow();
}

async function initializeDatabase(password) {
    if (!SecureDatabase || !SecureDatabase.isAvailable || !SecureDatabase.isAvailable()) {
        console.warn('[Main] Database not available, skipping initialization');
        contextManager = new ContextManager();
        learningEngine = new LearningEngine();
        return;
    }

    database = new SecureDatabase();
    database.initialize(password);
    contextManager = new ContextManager(database);
    learningEngine = new LearningEngine(database, contextManager);
    console.log('[Main] Database initialized successfully');
}

async function promptForNewPassword() {
    return new Promise((resolve) => {
        const inputWindow = new BrowserWindow({
            width: 500,
            height: 750, // Increased height to fit all content
            resizable: true, // Allow resizing just in case
            minimizable: false,
            maximizable: false,
            closable: true,
            alwaysOnTop: true,
            webPreferences: {
                preload: path.join(__dirname, 'preload.js'),
                contextIsolation: true,
                nodeIntegration: false,
                sandbox: true
            },
            show: false
        });

        // Load the password setup HTML file
        inputWindow.loadFile('password-setup.html');

        // Show window once ready to avoid visual flash
        inputWindow.once('ready-to-show', () => {
            inputWindow.show();
            inputWindow.focus();
        });

        // Handle window closed without response
        inputWindow.on('closed', () => {
            resolve(null);
        });

        // Set up IPC handlers for this specific window
        const passwordSetHandler = (event, pwd) => {
            if (event.sender === inputWindow.webContents) {
                inputWindow.close();
                ipcMain.removeListener('password-set', passwordSetHandler);
                ipcMain.removeListener('password-cancel', passwordCancelHandler);
                resolve(pwd);
            }
        };

        const passwordCancelHandler = (event) => {
            if (event.sender === inputWindow.webContents) {
                inputWindow.close();
                ipcMain.removeListener('password-set', passwordSetHandler);
                ipcMain.removeListener('password-cancel', passwordCancelHandler);
                resolve(null);
            }
        };

        ipcMain.on('password-set', passwordSetHandler);
        ipcMain.on('password-cancel', passwordCancelHandler);
    });
}

async function promptForPassword() {
    return new Promise((resolve) => {
        const inputWindow = new BrowserWindow({
            width: 500,
            height: 550, // Increased height to fit content
            resizable: true, // Allow resizing
            minimizable: false,
            maximizable: false,
            closable: true,
            alwaysOnTop: true,
            webPreferences: {
                preload: path.join(__dirname, 'preload.js'),
                contextIsolation: true,
                nodeIntegration: false,
                sandbox: true
            },
            show: false
        });

        // Load the password login HTML file
        inputWindow.loadFile('password-login.html');

        // Show window once ready
        inputWindow.once('ready-to-show', () => {
            inputWindow.show();
            inputWindow.focus();
        });

        // Handle window closed without response
        inputWindow.on('closed', () => {
            resolve(null);
        });

        // Set up IPC handlers
        const passwordEnteredHandler = (event, pwd) => {
            if (event.sender === inputWindow.webContents) {
                inputWindow.close();
                ipcMain.removeListener('password-entered', passwordEnteredHandler);
                ipcMain.removeListener('password-cancel', passwordCancelHandler);
                resolve(pwd);
            }
        };

        const passwordCancelHandler = (event) => {
            if (event.sender === inputWindow.webContents) {
                inputWindow.close();
                ipcMain.removeListener('password-entered', passwordEnteredHandler);
                ipcMain.removeListener('password-cancel', passwordCancelHandler);
                resolve(null);
            }
        };

        ipcMain.on('password-entered', passwordEnteredHandler);
        ipcMain.on('password-cancel', passwordCancelHandler);
    });
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        backgroundColor: '#1e1e2e',
        show: true, // Ensure window is visible immediately
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false, // Required for webview tag
            webviewTag: true
        }
    });

    mainWindow.loadFile('index.html');

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        mainWindow.focus();
    });

    // Cleanup on close
    mainWindow.on('closed', () => {
        if (database) {
            database.close();
        }
        mainWindow = null;
    });
}

app.whenReady().then(initializeApp);

app.on('window-all-closed', () => {
    if (isInitializing) return;

    if (database) {
        database.close();
    }
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        if (isAuthenticated) {
            createWindow();
        } else {
            initializeApp();
        }
    }
});

// --- IPC Handlers ---

ipcMain.on('start-agent', (event, { goal, webContentsId }) => {
    console.log(`[Main] Starting agent for goal: "${goal}"`);

    // Check if we can proceed (either db initialized OR in limited mode)
    if (!isAuthenticated) {
        event.sender.send('agent-log', '❌ Error: Not authenticated.');
        event.sender.send('agent-stopped');
        return;
    }

    const guestContents = webContents.fromId(webContentsId);

    if (!guestContents) {
        console.error('[Main] Guest WebContents not found!');
        event.sender.send('agent-log', '❌ Error: Could not verify browser view.');
        event.sender.send('agent-stopped');
        return;
    }

    if (activeAgent) {
        activeAgent.stop();
    }

    // Initialize Enhanced Agent with all components
    activeAgent = new EnhancedAgent(
        guestContents,
        event.sender,
        contextManager,
        learningEngine
    );

    activeAgent.start(goal);
});

ipcMain.on('stop-agent', (event) => {
    console.log('[Main] Stopping agent...');
    if (activeAgent) {
        activeAgent.stop();
        activeAgent = null;
    }
    // Notify all renderer processes that agent stopped
    BrowserWindow.getAllWindows().forEach(window => {
        if (!window.isDestroyed()) {
            window.webContents.send('agent-stopped');
        }
    });
});

// Chat handlers
ipcMain.on('chat-user-message', (event, { message, tabId }) => {
    if (contextManager) {
        contextManager.addChatMessage('user', message);
    }

    // In a real implementation, this would trigger an agent response
    // For now, allow the UI to simply display it
});

ipcMain.on('chat-search', (event, query) => {
    if (contextManager) {
        const results = contextManager.searchChatHistory(query);
        event.sender.send('chat-search-results', results);
    } else {
        event.sender.send('chat-search-results', []);
    }
});

ipcMain.handle('get-chat-history', () => {
    if (contextManager) {
        return contextManager.getChatHistory(50);
    }
    return [];
});

// Clear data handlers
ipcMain.on('cleanup-old-data', (event) => {
    if (database) {
        try {
            database.performMaintenance();
            event.sender.send('agent-log', '✅ Database maintenance completed.');
        } catch (error) {
            console.error('Maintenance failed:', error);
            event.sender.send('agent-log', '❌ Maintenance failed: ' + error.message);
        }
    } else {
        event.sender.send('agent-log', '⚠️ Maintenance skipped (Database not available).');
    }
});
