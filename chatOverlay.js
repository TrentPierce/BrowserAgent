class ChatOverlay {
    constructor() {
        this.messages = [];
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
        this.createOverlay();
        this.attachEventListeners();
        this.loadInitialMessages();
    }

    createOverlay() {
        // Create main container
        this.container = document.createElement('div');
        this.container.id = 'chat-overlay';
        this.container.className = 'chat-overlay expanded';
        
        // Create header
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
        
        // Create search container
        this.searchContainer = document.createElement('div');
        this.searchContainer.className = 'chat-search-container';
        this.searchContainer.style.display = 'none';
        this.searchContainer.innerHTML = `
            <input type="text" class="chat-search-input" placeholder="Search chat history...">
            <button class="chat-search-close">✕</button>
        `;
        
        // Create messages container
        this.messagesContainer = document.createElement('div');
        this.messagesContainer.className = 'chat-messages';
        this.messagesContainer.id = 'chat-messages';
        
        // Create input container
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
        
        // Assemble overlay
        this.container.appendChild(header);
        this.container.appendChild(this.searchContainer);
        this.container.appendChild(this.messagesContainer);
        this.container.appendChild(this.inputContainer);
        
        // Add to page
        document.body.appendChild(this.container);
        
        // Add styles
        this.addStyles();
    }

    addStyles() {
        const styles = document.createElement('style');
        styles.textContent = `
            .chat-overlay {
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                background: linear-gradient(180deg, #1e1e2e 0%, #181825 100%);
                border-top: 2px solid #45475a;
                display: flex;
                flex-direction: column;
                z-index: 10000;
                font-family: 'Inter', system-ui, -apple-system, sans-serif;
                transition: all 0.3s ease;
                box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.5);
            }
            
            .chat-overlay.expanded {
                height: 250px;
            }
            
            .chat-overlay.collapsed {
                height: 44px;
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
                padding: 10px 15px;
                background: #11111b;
                border-bottom: 1px solid #313244;
                cursor: pointer;
                user-select: none;
            }
            
            .chat-title {
                display: flex;
                align-items: center;
                gap: 8px;
                color: #cdd6f4;
                font-weight: 600;
                font-size: 14px;
            }
            
            .chat-icon {
                font-size: 16px;
            }
            
            .chat-unread {
                background: #f38ba8;
                color: #1e1e2e;
                font-size: 11px;
                font-weight: bold;
                padding: 2px 6px;
                border-radius: 10px;
                margin-left: 5px;
            }
            
            .chat-controls {
                display: flex;
                gap: 5px;
            }
            
            .chat-btn {
                background: #313244;
                border: none;
                color: #cdd6f4;
                padding: 5px 10px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
                transition: all 0.2s;
            }
            
            .chat-btn:hover {
                background: #45475a;
            }
            
            .chat-search-container {
                display: flex;
                gap: 10px;
                padding: 10px 15px;
                background: #181825;
                border-bottom: 1px solid #313244;
            }
            
            .chat-search-input {
                flex: 1;
                background: #313244;
                border: 1px solid #45475a;
                color: #cdd6f4;
                padding: 8px 12px;
                border-radius: 6px;
                font-size: 13px;
                outline: none;
            }
            
            .chat-search-input:focus {
                border-color: #89b4fa;
            }
            
            .chat-search-close {
                background: #313244;
                border: 1px solid #45475a;
                color: #cdd6f4;
                padding: 8px 12px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 13px;
            }
            
            .chat-messages {
                flex: 1;
                overflow-y: auto;
                padding: 15px;
                display: flex;
                flex-direction: column;
                gap: 10px;
                background: #1e1e2e;
            }
            
            .chat-message {
                max-width: 85%;
                padding: 10px 14px;
                border-radius: 12px;
                font-size: 13px;
                line-height: 1.5;
                word-wrap: break-word;
                animation: messageSlide 0.2s ease;
            }
            
            @keyframes messageSlide {
                from {
                    opacity: 0;
                    transform: translateY(10px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            
            .chat-message.agent {
                background: #313244;
                color: #cdd6f4;
                align-self: flex-start;
                border-bottom-left-radius: 4px;
            }
            
            .chat-message.user {
                background: #89b4fa;
                color: #1e1e2e;
                align-self: flex-end;
                border-bottom-right-radius: 4px;
                font-weight: 500;
            }
            
            .chat-message.option {
                background: #45475a;
                color: #a6e3a1;
                align-self: flex-start;
                border-bottom-left-radius: 4px;
                font-family: monospace;
                margin-left: 20px;
                padding: 6px 12px;
            }
            
            .chat-message.system {
                background: transparent;
                color: #6c7086;
                align-self: center;
                font-size: 11px;
                font-style: italic;
                padding: 5px;
            }
            
            .chat-message-time {
                font-size: 10px;
                opacity: 0.7;
                margin-top: 4px;
            }
            
            .chat-input-container {
                padding: 10px 15px;
                background: #11111b;
                border-top: 1px solid #313244;
            }
            
            .chat-input-wrapper {
                display: flex;
                gap: 10px;
                align-items: flex-end;
            }
            
            .chat-input {
                flex: 1;
                background: #313244;
                border: 1px solid #45475a;
                color: #cdd6f4;
                padding: 10px 12px;
                border-radius: 8px;
                font-size: 13px;
                font-family: inherit;
                resize: none;
                outline: none;
                max-height: 100px;
                min-height: 40px;
            }
            
            .chat-input:focus {
                border-color: #89b4fa;
            }
            
            .chat-input::placeholder {
                color: #6c7086;
            }
            
            .chat-send-btn {
                background: #89b4fa;
                border: none;
                color: #1e1e2e;
                padding: 10px 15px;
                border-radius: 8px;
                cursor: pointer;
                font-size: 14px;
                transition: all 0.2s;
                height: 40px;
            }
            
            .chat-send-btn:hover {
                background: #b4befe;
            }
            
            .chat-send-btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            
            .chat-typing-indicator {
                display: flex;
                align-items: center;
                gap: 5px;
                color: #6c7086;
                font-size: 11px;
                margin-top: 5px;
                padding-left: 5px;
            }
            
            .typing-dots span {
                animation: typingAnimation 1.4s infinite;
                animation-fill-mode: both;
            }
            
            .typing-dots span:nth-child(2) {
                animation-delay: 0.2s;
            }
            
            .typing-dots span:nth-child(3) {
                animation-delay: 0.4s;
            }
            
            @keyframes typingAnimation {
                0%, 60%, 100% {
                    opacity: 0;
                    transform: translateY(0);
                }
                30% {
                    opacity: 1;
                    transform: translateY(-3px);
                }
            }
            
            .chat-search-results {
                background: #313244;
                border: 1px solid #45475a;
                border-radius: 6px;
                max-height: 150px;
                overflow-y: auto;
                margin-top: 5px;
            }
            
            .chat-search-result {
                padding: 8px 12px;
                border-bottom: 1px solid #45475a;
                cursor: pointer;
                font-size: 12px;
                color: #cdd6f4;
            }
            
            .chat-search-result:hover {
                background: #45475a;
            }
            
            .chat-search-result:last-child {
                border-bottom: none;
            }
            
            /* Scrollbar styling */
            .chat-messages::-webkit-scrollbar {
                width: 6px;
            }
            
            .chat-messages::-webkit-scrollbar-track {
                background: #1e1e2e;
            }
            
            .chat-messages::-webkit-scrollbar-thumb {
                background: #45475a;
                border-radius: 3px;
            }
            
            .chat-messages::-webkit-scrollbar-thumb:hover {
                background: #585b70;
            }
        `;
        
        document.head.appendChild(styles);
    }

    attachEventListeners() {
        // Toggle chat
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
        
        // Send message
        const input = this.container.querySelector('.chat-input');
        const sendBtn = this.container.querySelector('.chat-send-btn');
        
        const sendMessage = () => {
            const text = input.value.trim();
            if (text) {
                this.sendMessage(text);
                input.value = '';
                input.style.height = 'auto';
            }
        };
        
        sendBtn.addEventListener('click', sendMessage);
        
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        
        // Auto-resize textarea
        input.addEventListener('input', () => {
            input.style.height = 'auto';
            input.style.height = Math.min(input.scrollHeight, 100) + 'px';
        });
        
        // Search functionality
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

    loadInitialMessages() {
        // Load initial welcome message
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
        
        // Update unread count if collapsed
        if (this.container.classList.contains('collapsed') && sender === 'agent') {
            this.unreadCount++;
            this.updateUnreadCount();
        }
        
        // Scroll to bottom
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
        // Add user message to UI
        this.addMessage('user', text);
        
        // Send to main process
        if (window.ipcRenderer) {
            window.ipcRenderer.send('chat-user-message', text);
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
        this.scrollToBottom();
    }

    collapse() {
        this.container.classList.remove('expanded');
        this.container.classList.add('collapsed');
        this.container.querySelector('.chat-toggle').textContent = '+';
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
        
        // Send search request to main process
        if (window.ipcRenderer) {
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
        const resultsContainer = document.createElement('div');
        resultsContainer.className = 'chat-search-results';
        
        const resultEl = document.createElement('div');
        resultEl.className = 'chat-search-result';
        resultEl.textContent = text;
        
        if (messageId) {
            resultEl.addEventListener('click', () => {
                this.jumpToMessage(messageId);
            });
        }
        
        resultsContainer.appendChild(resultEl);
        this.searchContainer.appendChild(resultsContainer);
    }

    clearSearchResults() {
        const existingResults = this.searchContainer.querySelector('.chat-search-results');
        if (existingResults) {
            existingResults.remove();
        }
    }

    jumpToMessage(messageId) {
        // Find and scroll to message
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

    clear() {
        this.messages = [];
        this.messagesContainer.innerHTML = '';
        this.unreadCount = 0;
        this.updateUnreadCount();
    }

    destroy() {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChatOverlay;
} else {
    window.ChatOverlay = ChatOverlay;
}
