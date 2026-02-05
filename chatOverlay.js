/**
 * ChatOverlay - Injected UI for Browser Agent
 * Uses Shadow DOM to isolate styles and behavior from the host page.
 */
class ChatOverlay {
    constructor() {
        this.messages = [];
        this.host = null;
        this.shadow = null;
        this.container = null;
        this.messagesContainer = null;
        this.inputContainer = null;
        this.searchContainer = null;
        this.isExpanded = true;
        this.isTyping = false;
        this.unreadCount = 0;

        this.init();
    }

    init() {
        // Wait for body if not ready (though usually injected after load)
        if (document.body) {
            this.createOverlay();
            this.loadInitialMessages();
        } else {
            window.addEventListener('DOMContentLoaded', () => {
                this.createOverlay();
                this.loadInitialMessages();
            });
        }
    }

    createOverlay() {
        // 1. Create Host (Fixed wrapper)
        this.host = document.createElement('div');
        this.host.id = 'browser-agent-overlay-host';

        // Host styles - fixed, non-blocking
        Object.assign(this.host.style, {
            position: 'fixed',
            zIndex: '2147483647', // Max safe integer
            bottom: '0',
            left: '0',
            right: '0',
            height: '0', // Doesn't take up layout space
            display: 'block',
            fontSize: '16px',
            lineHeight: 'normal',
            pointerEvents: 'none', // Let clicks pass through default areas
            overflow: 'visible'
        });

        // 2. Create Shadow Root (Open mode for accessibility/debug)
        this.shadow = this.host.attachShadow({ mode: 'open' });

        // 3. Create Container (The visible overlay)
        this.container = document.createElement('div');
        this.container.id = 'chat-overlay';
        this.container.className = 'chat-overlay expanded';

        // 4. Build Internal Structure

        // Header
        const header = document.createElement('div');
        header.className = 'chat-header';
        header.innerHTML = `
            <div class="chat-title">
                <span class="chat-icon">💬</span>
                <span>Agent Chat</span>
                <span class="chat-unread" id="chat-unread-count" style="display: none;">0</span>
            </div>
            <div class="chat-controls">
                <button class="chat-btn chat-search-toggle" title="Search history">🔍</button>
                <button class="chat-btn chat-toggle" title="Toggle chat">−</button>
            </div>
        `;

        // Search Container
        this.searchContainer = document.createElement('div');
        this.searchContainer.className = 'chat-search-container';
        this.searchContainer.style.display = 'none';
        this.searchContainer.innerHTML = `
            <input type="text" class="chat-search-input" placeholder="Search chat history...">
            <button class="chat-search-close">✕</button>
        `;

        // Messages Container
        this.messagesContainer = document.createElement('div');
        this.messagesContainer.className = 'chat-messages';
        this.messagesContainer.id = 'chat-messages';

        // Input Container
        this.inputContainer = document.createElement('div');
        this.inputContainer.className = 'chat-input-container';
        this.inputContainer.innerHTML = `
            <div class="chat-input-wrapper">
                <textarea 
                    class="chat-input" 
                    id="chat-input"
                    placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
                    rows="1"
                ></textarea>
                <button class="chat-send-btn" id="chat-send-btn">➤</button>
            </div>
            <div class="chat-typing-indicator" id="chat-typing" style="display: none;">
                <span>Agent is typing</span>
                <span class="typing-dots">
                    <span>.</span><span>.</span><span>.</span>
                </span>
            </div>
        `;

        // Assemble Overlay
        this.container.appendChild(header);
        this.container.appendChild(this.searchContainer);
        this.container.appendChild(this.messagesContainer);
        this.container.appendChild(this.inputContainer);

        // 5. Add Styles
        const style = document.createElement('style');
        style.textContent = this.getStyles();

        // 6. Append to Shadow
        this.shadow.appendChild(style);
        this.shadow.appendChild(this.container);

        // 7. Inject Host into Page
        document.body.appendChild(this.host);

        // 8. setup listeners
        this.attachEventListeners();
    }

    getStyles() {
        return `
            @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');

            :host {
                all: initial; /* Reset inherited styles */
                font-family: 'DM Sans', 'Söhne', ui-sans-serif, system-ui, -apple-system, sans-serif;
            }

            * {
                box-sizing: border-box;
            }

            .chat-overlay {
                position: absolute; /* Relative to host */
                bottom: 0;
                left: 0;
                right: 0;
                background: linear-gradient(180deg, #0e151c 0%, #0a0f14 100%);
                border-top: 2px solid rgba(212, 168, 83, 0.25);
                display: flex;
                flex-direction: column;
                z-index: 10000;
                transition: height 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.5);
                pointer-events: auto; /* Enable clicks */
            }

            .chat-overlay.expanded {
                height: 300px;
            }

            .chat-overlay.collapsed {
                height: 48px;
            }

            .chat-overlay.collapsed .chat-messages,
            .chat-overlay.collapsed .chat-input-container,
            .chat-overlay.collapsed .chat-search-container {
                display: none !important;
            }

            .chat-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px 16px;
                background: #0a0f14;
                border-bottom: 1px solid rgba(163, 176, 202, 0.12);
                cursor: pointer;
                user-select: none;
            }

            .chat-title {
                display: flex;
                align-items: center;
                gap: 8px;
                color: #f0f2f5;
                font-weight: 600;
                font-size: 14px;
                letter-spacing: 0.01em;
            }

            .chat-icon {
                font-size: 16px;
            }

            .chat-unread {
                background: linear-gradient(135deg, #d4a853 0%, #c99b3a 100%);
                color: #0a0f14;
                font-size: 11px;
                font-weight: 700;
                padding: 3px 8px;
                border-radius: 12px;
                margin-left: 5px;
                letter-spacing: 0.02em;
            }

            .chat-controls {
                display: flex;
                gap: 6px;
            }

            .chat-btn {
                background: #131c26;
                border: 1px solid rgba(163, 176, 202, 0.12);
                color: #a8b0bc;
                padding: 6px 10px;
                border-radius: 8px;
                cursor: pointer;
                font-size: 13px;
                transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            }

            .chat-btn:hover {
                background: #1a2532;
                border-color: rgba(212, 168, 83, 0.25);
                color: #f0f2f5;
            }

            .chat-search-container {
                display: flex;
                gap: 10px;
                padding: 10px 16px;
                background: #0e151c;
                border-bottom: 1px solid rgba(163, 176, 202, 0.12);
            }

            .chat-search-input {
                flex: 1;
                background: #1a2532;
                border: 1px solid rgba(163, 176, 202, 0.12);
                color: #f0f2f5;
                padding: 8px 12px;
                border-radius: 8px;
                font-size: 13px;
                font-family: 'DM Sans', sans-serif;
                outline: none;
                transition: all 0.2s ease;
            }

            .chat-search-input:focus {
                border-color: rgba(212, 168, 83, 0.3);
                box-shadow: 0 0 0 3px rgba(212, 168, 83, 0.1);
            }

            .chat-search-close {
                background: #1a2532;
                border: 1px solid rgba(163, 176, 202, 0.12);
                color: #a8b0bc;
                padding: 8px 12px;
                border-radius: 8px;
                cursor: pointer;
                font-size: 13px;
                transition: all 0.2s ease;
            }

            .chat-search-close:hover {
                background: #253242;
                color: #f0f2f5;
            }

            .chat-messages {
                flex: 1;
                overflow-y: auto;
                padding: 16px;
                display: flex;
                flex-direction: column;
                gap: 12px;
                background: #0e151c;
            }

            .chat-message {
                max-width: 85%;
                padding: 12px 16px;
                border-radius: 14px;
                font-size: 13px;
                line-height: 1.6;
                word-wrap: break-word;
                animation: messageSlide 0.25s cubic-bezier(0.16, 1, 0.3, 1);
            }

            @keyframes messageSlide {
                from {
                    opacity: 0;
                    transform: translateY(12px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            .chat-message.agent {
                background: #1a2532;
                color: #a8b0bc;
                align-self: flex-start;
                border-bottom-left-radius: 4px;
                border: 1px solid rgba(163, 176, 202, 0.08);
            }

            .chat-message.user {
                background: linear-gradient(135deg, #1a5f4e 0%, #0c3d32 100%);
                color: #f0f2f5;
                align-self: flex-end;
                border-bottom-right-radius: 4px;
                font-weight: 500;
                box-shadow: 0 2px 8px rgba(26, 95, 78, 0.25);
            }

            .chat-message.option {
                background: rgba(212, 168, 83, 0.12);
                color: #d4a853;
                align-self: flex-start;
                border-bottom-left-radius: 4px;
                font-family: 'JetBrains Mono', monospace;
                margin-left: 20px;
                padding: 8px 14px;
                border: 1px solid rgba(212, 168, 83, 0.2);
                cursor: pointer;
            }
            
            .chat-message.option:hover {
                background: rgba(212, 168, 83, 0.2);
            }

            .chat-message.system {
                background: transparent;
                color: #6b7585;
                align-self: center;
                font-size: 11px;
                font-style: italic;
                padding: 4px 8px;
            }

            .chat-message-time {
                font-size: 11px;
                opacity: 0.6;
                margin-top: 4px;
                font-family: 'JetBrains Mono', monospace;
            }

            .chat-input-container {
                padding: 12px 16px;
                background: #0a0f14;
                border-top: 1px solid rgba(163, 176, 202, 0.12);
            }

            .chat-input-wrapper {
                display: flex;
                gap: 10px;
                align-items: flex-end;
            }

            .chat-input {
                flex: 1;
                background: #1a2532;
                border: 1px solid rgba(163, 176, 202, 0.12);
                color: #f0f2f5;
                padding: 10px 12px;
                border-radius: 10px;
                font-size: 13px;
                font-family: 'DM Sans', sans-serif;
                resize: none;
                outline: none;
                max-height: 100px;
                min-height: 40px;
                transition: all 0.2s ease;
            }

            .chat-input:focus {
                border-color: rgba(212, 168, 83, 0.3);
                box-shadow: 0 0 0 3px rgba(212, 168, 83, 0.1);
            }

            .chat-input::placeholder {
                color: #6b7585;
            }

            .chat-send-btn {
                background: linear-gradient(135deg, #1a5f4e 0%, #0c3d32 100%);
                border: none;
                color: #f0f2f5;
                padding: 10px 16px;
                border-radius: 10px;
                cursor: pointer;
                font-size: 14px;
                transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                height: 42px;
                box-shadow: 0 2px 8px rgba(26, 95, 78, 0.25);
            }

            .chat-send-btn:hover {
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(26, 95, 78, 0.35);
            }

            .chat-send-btn:active {
                transform: translateY(0);
            }

            .chat-typing-indicator {
                display: flex;
                align-items: center;
                gap: 5px;
                color: #6b7585;
                font-size: 11px;
                margin-top: 6px;
                padding-left: 6px;
            }

            .typing-dots span {
                animation: typingAnimation 1.5s infinite;
                animation-fill-mode: both;
            }
            
            .typing-dots span:nth-child(2) { animation-delay: 0.2s; }
            .typing-dots span:nth-child(3) { animation-delay: 0.4s; }

            @keyframes typingAnimation {
                0%, 60%, 100% { opacity: 0; transform: translateY(0); }
                30% { opacity: 1; transform: translateY(-3px); }
            }
            
            .chat-search-results {
                background: #1a2532;
                border: 1px solid rgba(163, 176, 202, 0.12);
                border-radius: 10px;
                max-height: 150px;
                overflow-y: auto;
                margin-top: 6px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            }

            .chat-search-result {
                padding: 10px 14px;
                border-bottom: 1px solid rgba(163, 176, 202, 0.08);
                cursor: pointer;
                font-size: 12px;
                color: #a8b0bc;
                transition: all 0.2s ease;
            }

            .chat-search-result:hover {
                background: #253242;
                color: #f0f2f5;
            }
            
            /* Scrollbar */
            .chat-messages::-webkit-scrollbar { width: 6px; }
            .chat-messages::-webkit-scrollbar-track { background: #0e151c; }
            .chat-messages::-webkit-scrollbar-thumb { background: rgba(163, 176, 202, 0.15); border-radius: 3px; }
            .chat-messages::-webkit-scrollbar-thumb:hover { background: rgba(212, 168, 83, 0.3); }
        `;
    }

    attachEventListeners() {
        const toggleBtn = this.container.querySelector('.chat-toggle');
        const header = this.container.querySelector('.chat-header');

        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggle();
        });

        header.addEventListener('click', () => {
            if (this.container.classList.contains('collapsed')) {
                this.expand();
            }
        });

        const input = this.container.querySelector('.chat-input');
        const sendBtn = this.container.querySelector('.chat-send-btn');

        const sendMessage = () => {
            const text = input.value.trim();
            if (text) {
                this.sendMessage(text);
                input.value = '';
                input.style.height = 'auto'; // Reset height
            }
        };

        sendBtn.addEventListener('click', sendMessage);

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        input.addEventListener('input', () => {
            input.style.height = 'auto';
            input.style.height = Math.min(input.scrollHeight, 100) + 'px';
        });

        const searchToggle = this.container.querySelector('.chat-search-toggle');
        const searchClose = this.container.querySelector('.chat-search-close');
        const searchInput = this.container.querySelector('.chat-search-input');

        searchToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleSearch();
        });

        searchClose.addEventListener('click', () => {
            this.toggleSearch();
        });

        searchInput.addEventListener('input', (e) => {
            this.handleSearch(e.target.value);
        });
    }

    // ... (rest of methods: loadInitialMessages, addMessage, renderMessage, etc. unchanged logic) ...

    loadInitialMessages() {
        this.addMessage('agent', '👋 Welcome! I\'m your AI browser assistant. Start a task and I\'ll help you navigate.');
    }

    addMessage(sender, message, type = 'text') {
        const messageObj = {
            sender: sender,
            message: message,
            type: type,
            timestamp: new Date()
        };

        this.messages.push(messageObj);
        this.renderMessage(messageObj);

        if (this.container.classList.contains('collapsed') && sender === 'agent') {
            this.unreadCount++;
            this.updateUnreadCount();
        }

        this.scrollToBottom();
    }

    renderMessage(messageObj) {
        const messageEl = document.createElement('div');
        messageEl.className = `chat-message ${messageObj.sender} ${messageObj.type}`;

        const time = messageObj.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        messageEl.innerHTML = `
            ${this.escapeHtml(messageObj.message)}
            <div class="chat-message-time">${time}</div>
        `;

        this.messagesContainer.appendChild(messageEl);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    scrollToBottom() {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    sendMessage(text) {
        this.addMessage('user', text);
        if (window.electronAPI) {
            window.electronAPI.sendChatMessage(text, null);
        } else if (window.ipcRenderer) {
            window.ipcRenderer.send('chat-user-message', { message: text, tabId: null });
        }
    }

    setTyping(typing) {
        this.isTyping = typing;
        const typingIndicator = this.container.querySelector('.chat-typing-indicator');
        if (typingIndicator) {
            typingIndicator.style.display = typing ? 'flex' : 'none';
        }
    }

    toggle() {
        if (this.container.classList.contains('expanded')) {
            this.collapse();
        } else {
            this.expand();
        }
    }

    expand() {
        this.container.classList.remove('collapsed');
        this.container.classList.add('expanded');
        this.container.querySelector('.chat-toggle').textContent = '−';
        this.unreadCount = 0;
        this.updateUnreadCount();
        this.updateHostHeight();
        this.scrollToBottom();
    }

    collapse() {
        this.container.classList.remove('expanded');
        this.container.classList.add('collapsed');
        this.container.querySelector('.chat-toggle').textContent = '+';
        this.updateHostHeight();
    }

    toggleSearch() {
        const isVisible = this.searchContainer.style.display !== 'none';
        this.searchContainer.style.display = isVisible ? 'none' : 'flex';

        if (!isVisible) {
            this.searchContainer.querySelector('.chat-search-input').focus();
        }
    }

    handleSearch(query) {
        if (!query.trim()) {
            this.clearSearchResults();
            return;
        }
        if (window.electronAPI) {
            window.electronAPI.searchChat(query);
        } else if (window.ipcRenderer) {
            window.ipcRenderer.send('chat-search', query);
        }
    }

    displaySearchResults(results) {
        this.clearSearchResults();
        if (results.length === 0) {
            this.showSearchResult('No messages found', null);
            return;
        }
        results.forEach(result => {
            const preview = result.message.substring(0, 50) + (result.message.length > 50 ? '...' : '');
            this.showSearchResult(preview, result.id);
        });
    }

    showSearchResult(text, messageId) {
        let resultsContainer = this.searchContainer.querySelector('.chat-search-results');

        if (!resultsContainer) {
            resultsContainer = document.createElement('div');
            resultsContainer.className = 'chat-search-results';
            this.searchContainer.appendChild(resultsContainer);
        }

        const resultEl = document.createElement('div');
        resultEl.className = 'chat-search-result';
        resultEl.textContent = text;

        if (messageId) {
            resultEl.addEventListener('click', () => {
                this.jumpToMessage(messageId);
            });
        }

        resultsContainer.appendChild(resultEl);
    }

    clearSearchResults() {
        const existingResults = this.searchContainer.querySelector('.chat-search-results');
        if (existingResults) {
            existingResults.remove();
        }
    }

    jumpToMessage(messageId) {
        const messageEl = this.messagesContainer.querySelector(`[data-message-id="${messageId}"]`);
        if (messageEl) {
            messageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            messageEl.style.background = '#585b70';
            setTimeout(() => {
                messageEl.style.background = '';
            }, 2000);
        }
    }

    updateUnreadCount() {
        const unreadEl = this.container.querySelector('#chat-unread-count');
        if (unreadEl) {
            unreadEl.textContent = this.unreadCount;
            unreadEl.style.display = this.unreadCount > 0 ? 'inline' : 'none';
        }
    }

    updateHostHeight() {
        // Logic to prevent blocking clicks:
        // Host is pointer-events: none.
        // Overlay is pointer-events: auto.
        // So we don't need to change height of host really, 
        // provided the host doesn't have a background.
        // Host has no background.
        // So we are good.
    }

    clear() {
        this.messages = [];
        this.messagesContainer.innerHTML = '';
        this.unreadCount = 0;
        this.updateUnreadCount();
    }

    destroy() {
        if (this.host && this.host.parentNode) {
            this.host.parentNode.removeChild(this.host);
        }
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChatOverlay;
} else {
    window.ChatOverlay = ChatOverlay;
}
