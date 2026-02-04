const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // Agent controls
    startAgent: (goal, webContentsId) => ipcRenderer.send('start-agent', { goal, webContentsId }),
    stopAgent: () => ipcRenderer.send('stop-agent'),

    // Chat
    sendChatMessage: (message, tabId) => ipcRenderer.send('chat-user-message', { message, tabId }),
    searchChat: (query) => ipcRenderer.send('chat-search', query),

    // Password dialogs
    setPassword: (password) => ipcRenderer.send('password-set', password),
    enterPassword: (password) => ipcRenderer.send('password-entered', password),
    cancelPassword: () => ipcRenderer.send('password-cancel'),

    // Tab management
    tabSwitched: (tabId) => ipcRenderer.send('tab-switched', tabId),

    // Data management
    cleanupOldData: () => ipcRenderer.send('cleanup-old-data'),
    clearAllData: () => ipcRenderer.send('clear-all-data'),

    // Async handlers
    getSessionStats: () => ipcRenderer.invoke('get-session-stats'),
    getChatHistory: () => ipcRenderer.invoke('get-chat-history'),
    exportLearningData: () => ipcRenderer.invoke('export-learning-data'),

    // Event listeners
    onAgentLog: (callback) => {
        const listener = (event, message) => callback(message);
        ipcRenderer.on('agent-log', listener);
        return () => ipcRenderer.removeListener('agent-log', listener);
    },

    onAgentStats: (callback) => {
        const listener = (event, stats) => callback(stats);
        ipcRenderer.on('agent-stats', listener);
        return () => ipcRenderer.removeListener('agent-stats', listener);
    },

    onAgentStopped: (callback) => {
        const listener = () => callback();
        ipcRenderer.on('agent-stopped', listener);
        return () => ipcRenderer.removeListener('agent-stopped', listener);
    },

    onAgentQuestion: (callback) => {
        const listener = (event, questionData) => callback(questionData);
        ipcRenderer.on('agent-question', listener);
        return () => ipcRenderer.removeListener('agent-question', listener);
    },

    onChatMessage: (callback) => {
        const listener = (event, messageData) => callback(messageData);
        ipcRenderer.on('chat-message', listener);
        return () => ipcRenderer.removeListener('chat-message', listener);
    },

    onChatSearchResults: (callback) => {
        const listener = (event, results) => callback(results);
        ipcRenderer.on('chat-search-results', listener);
        return () => ipcRenderer.removeListener('chat-search-results', listener);
    }
});
